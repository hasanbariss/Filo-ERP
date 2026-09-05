-- Independent additions approved by the user. No legacy rows, triggers or schemas changed.
create table public.ek_workspace_entries (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('sale','collection','owner','owner_adjustment')),
 entity text not null, period text not null check(period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 reference text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid(),
 unique(kind,entity,reference)
);
create table public.ek_workspace_snapshots (
 id uuid primary key default gen_random_uuid(), title text not null,
 kind text not null, period text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid()
);
create table public.ek_stock_parts (
 id uuid primary key default gen_random_uuid(), code text not null unique check(length(trim(code))>0),
 name text not null check(length(trim(name))>0), unit text not null, location text not null default '',
 minimum numeric not null default 0 check(minimum>=0), compatible_vehicles uuid[] not null default '{}',
 model_notes text not null default '', created_at timestamptz not null default now()
);
create table public.ek_stock_movements (
 id uuid primary key, part_id uuid not null references public.ek_stock_parts(id),
 quantity numeric not null check(quantity<>0), vehicle_id uuid, note text not null check(length(trim(note))>0),
 occurred_on date not null, created_at timestamptz not null default now(), created_by uuid not null default auth.uid(),
 check(quantity>0 or vehicle_id is not null)
);
create index on public.ek_workspace_entries(period,kind);
create index on public.ek_workspace_snapshots(period,created_at);
create index on public.ek_stock_movements(part_id);
do $$ declare t text; begin
 foreach t in array array['ek_workspace_entries','ek_workspace_snapshots','ek_stock_parts','ek_stock_movements'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy workspace_read on public.%I for select to authenticated using (true)',t);
 end loop;
 foreach t in array array['ek_workspace_entries','ek_workspace_snapshots','ek_stock_parts'] loop
 execute format('grant insert on public.%I to authenticated',t);
 execute format('create policy workspace_insert on public.%I for insert to authenticated with check (true)',t);
 end loop;
end $$;
-- Append-only snapshots/financial entries: no UPDATE/DELETE policies.
create function public.ek_stock_move(p_id uuid,p_part uuid,p_quantity numeric,p_vehicle uuid,p_note text,p_date date)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare balance numeric; existing public.ek_stock_movements%rowtype;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli'; end if;
 if p_quantity is null or p_quantity=0 or p_quantity::text in ('NaN','Infinity','-Infinity') or p_date is null or p_date>current_date or length(trim(coalesce(p_note,'')))=0 then raise exception 'Geçersiz stok hareketi'; end if;
 perform 1 from public.ek_stock_parts where id=p_part for update;
 if not found then raise exception 'Parça bulunamadı'; end if;
 select * into existing from public.ek_stock_movements where id=p_id;
 if found then
 if existing.part_id=p_part and existing.quantity=p_quantity and existing.vehicle_id is not distinct from p_vehicle and existing.note=p_note and existing.occurred_on=p_date then return p_id; end if;
 raise exception 'İşlem kimliği farklı bir kayıtta kullanılmış'; end if;
 if p_quantity<0 and (p_vehicle is null or not exists(select 1 from public.araclar where id=p_vehicle)) then raise exception 'Çıkış için geçerli araç seçin'; end if;
 select coalesce(sum(quantity),0) into balance from public.ek_stock_movements where part_id=p_part;
 if balance+p_quantity<0 then raise exception 'Yetersiz stok'; end if;
 insert into public.ek_stock_movements(id,part_id,quantity,vehicle_id,note,occurred_on) values(p_id,p_part,p_quantity,p_vehicle,p_note,p_date);
 return p_id;
end $$;
revoke all on function public.ek_stock_move(uuid,uuid,numeric,uuid,text,date) from public,anon;
grant execute on function public.ek_stock_move(uuid,uuid,numeric,uuid,text,date) to authenticated;
