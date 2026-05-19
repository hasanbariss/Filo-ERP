-- Araçlar tablosuna eksik olan kilometre takip sütunlarını ekler
-- Bu sütunlar zaten varsa hata vermez, yoksa oluşturur.

ALTER TABLE public.araclar 
ADD COLUMN IF NOT EXISTS guncel_km INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS son_yag_km INTEGER DEFAULT 0;
