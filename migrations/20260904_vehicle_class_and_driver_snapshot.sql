-- Baris.Flow Drive: araç sınıfı ve tarihsel şoför ilişkisinin güvenli eklenmesi.
-- Mevcut satırlar değiştirilmez veya geriye dönük tahminle doldurulmaz.

alter table public.araclar
    add column if not exists arac_sinifi text null;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'araclar_arac_sinifi_check'
          and conrelid = 'public.araclar'::regclass
    ) then
        alter table public.araclar
            add constraint araclar_arac_sinifi_check
            check (arac_sinifi is null or arac_sinifi in ('TAKSİ', '16+1', '27+1', '46+1', 'DİĞER'))
            not valid;
    end if;
end;
$$;

-- Şoför anahtarının türünü varsayma; mevcut soforler.id türünü aynen kullan.
do $$
declare
    driver_id_type text;
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'musteri_servis_puantaj'
          and column_name = 'sofor_id'
    ) then
        select format_type(attribute.atttypid, attribute.atttypmod)
          into driver_id_type
          from pg_attribute attribute
          join pg_class relation on relation.oid = attribute.attrelid
          join pg_namespace namespace on namespace.oid = relation.relnamespace
         where namespace.nspname = 'public'
           and relation.relname = 'soforler'
           and attribute.attname = 'id'
           and attribute.attnum > 0
           and not attribute.attisdropped;

        if driver_id_type is null then
            raise exception 'public.soforler.id veri türü belirlenemedi';
        end if;

        execute format(
            'alter table public.musteri_servis_puantaj add column sofor_id %s null',
            driver_id_type
        );
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'musteri_servis_puantaj_sofor_id_fkey'
          and conrelid = 'public.musteri_servis_puantaj'::regclass
    ) then
        alter table public.musteri_servis_puantaj
            add constraint musteri_servis_puantaj_sofor_id_fkey
            foreign key (sofor_id) references public.soforler(id) on delete set null
            not valid;
    end if;
end;
$$;

create index if not exists idx_musteri_servis_puantaj_sofor_tarih
    on public.musteri_servis_puantaj (sofor_id, tarih);

create or replace function public.set_musteri_puantaj_driver_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    if new.sofor_id is null and new.arac_id is not null then
        select a.sofor_id into new.sofor_id
        from public.araclar a
        where a.id = new.arac_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_musteri_puantaj_driver_snapshot on public.musteri_servis_puantaj;
create trigger trg_musteri_puantaj_driver_snapshot
before insert on public.musteri_servis_puantaj
for each row execute function public.set_musteri_puantaj_driver_snapshot();

comment on column public.araclar.arac_sinifi is
    'Operasyon ve tüketim karşılaştırma sınıfı. Mevcut araçlarda kullanıcı seçene kadar null kalır.';

comment on column public.musteri_servis_puantaj.sofor_id is
    'Sefer kaydı oluşturulduğu andaki araç şoförünün tarihsel kopyası. Mevcut kayıtlar geriye dönük doldurulmaz.';
