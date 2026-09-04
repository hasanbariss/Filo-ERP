-- Baris.Flow Drive: özmal filo araç sınıfını kullanıcı seçimiyle saklar.
-- Mevcut satırlar değiştirilmez; alan nullable olarak eklenir.

alter table public.araclar
    add column if not exists arac_sinifi text null;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
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

comment on column public.araclar.arac_sinifi is
    'Operasyon ve tüketim karşılaştırma sınıfı. Kullanıcı seçene kadar null kalır.';
