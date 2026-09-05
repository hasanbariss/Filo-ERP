-- Defines an explicit, reviewed deletion workflow. This migration deletes no data.
create table public.vehicle_deletion_audit (
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null,
 plate text not null, vehicle jsonb not null, choices jsonb not null, summary jsonb not null,
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid()
);
alter table public.vehicle_deletion_audit enable row level security;
revoke all on public.vehicle_deletion_audit from anon,authenticated;
grant select on public.vehicle_deletion_audit to authenticated;
create policy audit_read on public.vehicle_deletion_audit for select to authenticated using(true);

create function public.vehicle_delete_preview(p_vehicle uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v jsonb; edge record; child record; n bigint; child_n bigint; fingerprint text; child_fingerprint text; samples jsonb;
 groups jsonb:='[]'; extras jsonb; blocked boolean; nullable boolean; supported boolean;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
 select to_jsonb(a) into v from public.araclar a where id=p_vehicle;
 if v is null then raise exception 'Araç bulunamadı veya silinmiş'; end if;
 if exists(select 1 from pg_constraint k where contype='f' and confrelid='public.araclar'::regclass and (cardinality(conkey)<>1 or k.confkey[1]<>(select attnum from pg_attribute where attrelid='public.araclar'::regclass and attname='id'))) then
 raise exception 'Bileşik araç bağlantısı bulundu; silmeden önce bağlantı yapısı incelenmeli'; end if;
 if exists(select 1 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace where k.contype='f' and k.confrelid='public.araclar'::regclass and (ns.nspname<>'public' or c.relkind<>'r')) then raise exception 'Özel araç bağlantısı bulundu; silme yapısı incelenmeli';end if;
 if exists(select 1 from pg_trigger where tgrelid='public.araclar'::regclass and not tgisinternal and tgenabled<>'D' and (tgtype::integer & 8)>0) then raise exception 'Araç silmeye bağlı özel veritabanı işlemi incelenmeli';end if;
 if exists(select 1 from pg_constraint where contype='f' and confrelid='public.araclar'::regclass group by conrelid having count(*)>1) then raise exception 'Aynı tabloda birden fazla araç bağlantısı bulundu; silme yapısı incelenmeli';end if;
 for edge in
  select c.oid,c.relname,a.attname,a.attnotnull,
   exists(select 1 from pg_constraint k where k.contype='f' and k.conrelid=c.oid and k.confrelid='public.araclar'::regclass and a.attnum=any(k.conkey)) as required
  from pg_class c join pg_namespace ns on ns.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
  where ns.nspname='public' and c.relkind='r' and not a.attisdropped and a.atttypid='uuid'::regtype
  and c.relname not in ('araclar','vehicle_deletion_audit')
  and (a.attname in ('arac_id','vehicle_id') or exists(select 1 from pg_constraint k where k.contype='f' and k.conrelid=c.oid and k.confrelid='public.araclar'::regclass and a.attnum=any(k.conkey)))
  order by c.relname,a.attname
 loop
  execute format('select count(*),md5(coalesce(string_agg(to_jsonb(t)::text,''|'' order by to_jsonb(t)::text),'''')) from public.%I t where %I=$1',edge.relname,edge.attname) into n,fingerprint using p_vehicle;
  if n=0 then continue; end if;
  execute format('select coalesce(jsonb_agg(x.row),''[]'') from (select to_jsonb(t) as row from public.%I t where %I=$1 order by to_jsonb(t)::text limit 8) x',edge.relname,edge.attname) into samples using p_vehicle;
  extras:='[]';blocked:=false;
  -- Unknown downstream effects are never silently cascaded.
  for child in select k.conrelid::regclass as relation, c.relname, a.attname, pa.attname as parent_column,k.conkey,k.confkey
    from pg_constraint k join pg_class c on c.oid=k.conrelid
    join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
    join pg_attribute pa on pa.attrelid=k.confrelid and pa.attnum=k.confkey[1]
    where k.contype='f' and k.confrelid=edge.oid
  loop
   if cardinality(child.conkey)<>1 then blocked:=true;continue;end if;
   execute format('select count(*),md5(coalesce(string_agg(to_jsonb(x)::text,''|'' order by to_jsonb(x)::text),'''')) from %s x where %I in (select %I from public.%I where %I=$1)',child.relation,child.attname,child.parent_column,edge.relname,edge.attname) into child_n,child_fingerprint using p_vehicle;
   if child_n>0 then
    supported:=(edge.relname='arac_km_referanslari' and child.relname in ('arac_gps_mesafeleri','arac_gps_durumlari') and child.attname='referans_id')
      or (edge.relname='arac_bakim_planlari' and child.relname='arac_bakimlari' and child.attname='bakim_plan_id');
    if supported and edge.relname='arac_bakim_planlari' then
     execute 'select exists(select 1 from public.arac_bakimlari where bakim_plan_id in(select id from public.arac_bakim_planlari where arac_id=$1) and arac_id is distinct from $1)' into nullable using p_vehicle;
     if nullable then supported:=false;end if;
    end if;
    if supported and (exists(select 1 from pg_trigger where tgrelid=child.relation and not tgisinternal and tgenabled<>'D' and (tgtype::integer & case when edge.relname='arac_km_referanslari' then 8 else 16 end)>0) or (edge.relname='arac_km_referanslari' and exists(select 1 from pg_constraint where contype='f' and confrelid=child.relation))) then supported:=false;end if;
    if not supported then blocked:=true;end if;
    extras:=extras||jsonb_build_array(jsonb_build_object('table',child.relname,'count',child_n,'fingerprint',child_fingerprint,'effect',case when not supported then 'blocked' when edge.relname='arac_km_referanslari' then 'delete' else 'unlink_plan' end));
   end if;
  end loop;
  if exists(select 1 from pg_trigger where tgrelid=edge.oid and not tgisinternal and tgenabled<>'D' and (tgtype::integer & 8)>0) then blocked:=true;end if;
  nullable:=not edge.attnotnull and not exists(select 1 from pg_trigger where tgrelid=edge.oid and not tgisinternal and tgenabled<>'D' and (tgtype::integer & 16)>0) and not exists(select 1 from pg_constraint k where k.conrelid=edge.oid and k.contype='p' and (select attnum from pg_attribute where attrelid=edge.oid and attname=edge.attname)=any(k.conkey));
  groups:=groups||jsonb_build_array(jsonb_build_object('key',edge.relname||'.'||edge.attname,'table',edge.relname,'column',edge.attname,'count',n,'fingerprint',fingerprint,'samples',samples,'required',edge.required,'can_unlink',edge.required and nullable,'can_delete',edge.required and not blocked,'extra',extras,'blocked',blocked));
 end loop;
 -- Append-only working dossiers and stock mappings stay intact, including their historical references.
 select groups||jsonb_build_array(jsonb_build_object('key','workspace_history','table','workspace_history','count',count(*),'required',false,'can_unlink',false,'can_delete',false,'samples','[]'::jsonb,'extra','[]'::jsonb)) into groups
 from public.ek_workspace_entries where payload::text like '%'||p_vehicle::text||'%';
 select groups||jsonb_build_array(jsonb_build_object('key','stock_compatibility','table','stock_compatibility','count',count(*),'required',false,'can_unlink',false,'can_delete',false,'samples','[]'::jsonb,'extra','[]'::jsonb)) into groups from public.ek_stock_parts where p_vehicle=any(compatible_vehicles);
 select groups||jsonb_build_array(jsonb_build_object('key','saved_snapshots','table','saved_snapshots','count',count(*),'required',false,'can_unlink',false,'can_delete',false,'samples','[]'::jsonb,'extra','[]'::jsonb)) into groups from public.ek_workspace_snapshots where payload::text like '%'||p_vehicle::text||'%';
 return jsonb_build_object('vehicle',v,'groups',groups,'token',md5(v::text||groups::text));
end $$;
revoke all on function public.vehicle_delete_preview(uuid) from public,anon;
grant execute on function public.vehicle_delete_preview(uuid) to authenticated;

create function public.vehicle_delete_execute(p_vehicle uuid,p_token text,p_choices jsonb,p_plate text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare preview jsonb; g jsonb; mode text; t record; result uuid; removed bigint;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
 if jsonb_typeof(p_choices) is distinct from 'object' then raise exception 'Silme seçimleri geçersiz'; end if;
 -- Briefly lock the affected relation set so changes between review and execution are detected.
 for t in
 with recursive affected(oid) as (
  select 'public.araclar'::regclass::oid
  union select k.conrelid from pg_constraint k join affected p on k.confrelid=p.oid where k.contype='f'
 ) select oid::regclass as relation from affected order by oid
 loop execute format('lock table %s in share row exclusive mode',t.relation); end loop;
 preview:=public.vehicle_delete_preview(p_vehicle);
 if p_token is distinct from preview->>'token' then raise exception 'Bağlı kayıtlar değişti. Listeyi yenileyip tekrar kontrol edin'; end if;
 if trim(p_plate) is distinct from trim(preview->'vehicle'->>'plaka') then raise exception 'Onay plakası eşleşmiyor'; end if;
 for g in select value from jsonb_array_elements(preview->'groups') loop
  mode:=coalesce(p_choices->>(g->>'key'),'keep');
  if mode not in ('keep','unlink','delete') then raise exception 'Geçersiz silme seçimi'; end if;
  if mode='keep' and (g->>'required')::boolean then raise exception '% bağlı kayıtları korunuyor; araç silinemez',g->>'table'; end if;
  if mode='unlink' and not (g->>'can_unlink')::boolean then raise exception '% bağlantısı kaldırılamaz',g->>'table';end if;
  if mode='delete' and not (g->>'can_delete')::boolean then raise exception '% için alt bağlantıları inceleyin; otomatik silme yapılmadı',g->>'table';end if;
 end loop;
 -- Clear reviewed derived links first; the primary maintenance records follow their own choice.
 for g in select value from jsonb_array_elements(preview->'groups') loop
  if p_choices->>(g->>'key')='delete' and g->>'table'='arac_km_referanslari' then
   delete from public.arac_gps_mesafeleri where referans_id in(select id from public.arac_km_referanslari where arac_id=p_vehicle);
   delete from public.arac_gps_durumlari where referans_id in(select id from public.arac_km_referanslari where arac_id=p_vehicle);
  elsif p_choices->>(g->>'key')='delete' and g->>'table'='arac_bakim_planlari' then
   update public.arac_bakimlari set bakim_plan_id=null where bakim_plan_id in(select id from public.arac_bakim_planlari where arac_id=p_vehicle);
  end if;
 end loop;
 for g in select value from jsonb_array_elements(preview->'groups') loop
  mode:=coalesce(p_choices->>(g->>'key'),'keep');
  if mode='delete' then execute format('delete from public.%I where %I=$1',g->>'table',g->>'column') using p_vehicle;
  elsif mode='unlink' then execute format('update public.%I set %I=null where %I=$1',g->>'table',g->>'column',g->>'column') using p_vehicle;
  end if;
 end loop;
 delete from public.araclar where id=p_vehicle;
 get diagnostics removed=row_count;
 if removed<>1 then raise exception 'Araç silinemedi';end if;
 insert into public.vehicle_deletion_audit(vehicle_id,plate,vehicle,choices,summary) values(p_vehicle,preview->'vehicle'->>'plaka',preview->'vehicle',p_choices,preview->'groups') returning id into result;
 return jsonb_build_object('deleted',true,'audit_id',result,'plate',preview->'vehicle'->>'plaka');
end $$;
revoke all on function public.vehicle_delete_execute(uuid,text,jsonb,text) from public,anon;
grant execute on function public.vehicle_delete_execute(uuid,text,jsonb,text) to authenticated;

create function public.vehicle_delete_rows(p_vehicle uuid,p_key text,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t text:=split_part(p_key,'.',1); col text:=split_part(p_key,'.',2); rows jsonb; total bigint;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli';end if;
 if p_offset<0 or p_offset>1000000 then raise exception 'Geçersiz sayfa';end if;
 if not exists(select 1 from pg_class c join pg_namespace ns on ns.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
 where ns.nspname='public' and c.relkind='r' and c.relname=t and a.attname=col and not a.attisdropped and a.atttypid='uuid'::regtype
 and c.relname not in ('araclar','vehicle_deletion_audit') and (a.attname in ('arac_id','vehicle_id') or exists(select 1 from pg_constraint k where k.contype='f' and k.conrelid=c.oid and k.confrelid='public.araclar'::regclass and a.attnum=any(k.conkey)))) then raise exception 'Araç bağlantısı bulunamadı';end if;
 execute format('select count(*) from public.%I where %I=$1',t,col) into total using p_vehicle;
 execute format('select coalesce(jsonb_agg(x.row),''[]'') from (select to_jsonb(r) as row from public.%I r where %I=$1 order by to_jsonb(r)::text limit 25 offset $2) x',t,col) into rows using p_vehicle,p_offset;
 return jsonb_build_object('rows',rows,'total',total,'offset',p_offset);
end $$;
revoke all on function public.vehicle_delete_rows(uuid,text,integer) from public,anon;
grant execute on function public.vehicle_delete_rows(uuid,text,integer) to authenticated;
