-- Mevcut kısıtlamayı kaldırıyoruz
ALTER TABLE public.arac_bakimlari DROP CONSTRAINT IF EXISTS arac_bakimlari_islem_turu_check;

-- Yeni seçenekleri içerecek şekilde kısıtlamayı tekrar ekliyoruz
ALTER TABLE public.arac_bakimlari ADD CONSTRAINT arac_bakimlari_islem_turu_check 
CHECK (islem_turu IN ('Bakım/İşçilik', 'Yedek Parça', 'Hasar Onarım', 'Yağ Değişimi', 'Servis/Bakım (Faturadan)'));
