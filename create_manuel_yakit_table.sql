-- Manuel Yakıt ve KM Takip Fişleri Tablosu
-- Bu tablo finansal otomasyon sisteminden bağımsız olarak sadece KM ve lokal yakıt takibi için kullanılır.

CREATE TABLE IF NOT EXISTS public.manuel_yakit_fisleri (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    arac_id UUID REFERENCES public.araclar(id) ON DELETE CASCADE,
    sofor_adi TEXT,
    tarih DATE NOT NULL,
    kilometre INTEGER NOT NULL,
    fark_km INTEGER DEFAULT 0,
    tutar NUMERIC(10, 2) DEFAULT 0,
    olusturulma_tarihi TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) ayarları
ALTER TABLE public.manuel_yakit_fisleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes görebilir" ON public.manuel_yakit_fisleri
    FOR SELECT USING (true);

CREATE POLICY "Herkes ekleyebilir" ON public.manuel_yakit_fisleri
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Herkes güncelleyebilir" ON public.manuel_yakit_fisleri
    FOR UPDATE USING (true);

CREATE POLICY "Herkes silebilir" ON public.manuel_yakit_fisleri
    FOR DELETE USING (true);
