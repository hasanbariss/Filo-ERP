-- ============================================================
-- DİKKAN FABRİKASI BÖLGE MIGRATION (v2 — Duplicate-Safe)
-- Sorun: Aynı araç+tarih için hem İzmir hem Manisa/NULL kaydı var.
-- Çözüm: 1) Zaten İzmir kaydı olan satırların Manisa/NULL kopyalarını sil
--         2) Geriye kalan Manisa/NULL kayıtları İzmir yap
--
-- Supabase Dashboard > SQL Editor'da SIRAYLA çalıştırın.
-- ============================================================

-- ─── ADIM 1: Mevcut durumu gör ───────────────────────────────
SELECT 
    m.ad AS musteri_adi,
    p.bolge,
    COUNT(*) AS kayit_sayisi
FROM musteri_servis_puantaj p
JOIN musteriler m ON m.id = p.musteri_id
WHERE LOWER(m.ad) LIKE '%dikkan%'
GROUP BY m.ad, p.bolge
ORDER BY p.bolge;

-- ─── ADIM 2: Çakışan kayıtları sil ──────────────────────────
-- Aynı (musteri_id, arac_id, tarih) için zaten 'İzmir' kaydı varsa
-- Manisa veya NULL olan kopyaları sil (veriyi kaybetmeden)
DELETE FROM musteri_servis_puantaj
WHERE id IN (
    -- Dikkan'a ait Manisa/NULL kayıtları bul
    SELECT p.id
    FROM musteri_servis_puantaj p
    JOIN musteriler m ON m.id = p.musteri_id
    WHERE LOWER(m.ad) LIKE '%dikkan%'
      AND (p.bolge IS NULL OR p.bolge != 'İzmir')
      -- Aynı araç+tarih için zaten İzmir kaydı varsa bu fazlalık
      AND EXISTS (
          SELECT 1
          FROM musteri_servis_puantaj p2
          WHERE p2.musteri_id = p.musteri_id
            AND p2.arac_id   = p.arac_id
            AND p2.tarih     = p.tarih
            AND p2.bolge     = 'İzmir'
      )
);

-- ─── ADIM 3: Geri kalan Manisa/NULL kayıtları İzmir yap ─────
-- (İzmir kopyası olmayan, tek başına duran Manisa/NULL kayıtlar)
UPDATE musteri_servis_puantaj
SET bolge = 'İzmir'
WHERE musteri_id IN (
    SELECT id FROM musteriler WHERE LOWER(ad) LIKE '%dikkan%'
)
AND (bolge IS NULL OR bolge != 'İzmir');

-- ─── ADIM 4: Sonucu doğrula ─────────────────────────────────
-- Sadece 'İzmir' görünmeli, Manisa veya NULL kalmamalı
SELECT 
    m.ad AS musteri_adi,
    p.bolge,
    COUNT(*) AS kayit_sayisi
FROM musteri_servis_puantaj p
JOIN musteriler m ON m.id = p.musteri_id
WHERE LOWER(m.ad) LIKE '%dikkan%'
GROUP BY m.ad, p.bolge
ORDER BY p.bolge;
