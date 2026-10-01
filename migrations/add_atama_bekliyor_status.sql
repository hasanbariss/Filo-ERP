-- Filo ERP: ATAMA_BEKLIYOR statüsü desteği
-- Excel'den yakıt aktarırken sistemde tanımlı olmayan plakalar ATAMA_BEKLIYOR
-- statüsüyle araclar tablosuna eklenir. Kullanıcı daha sonra Özmal/Taşeron atar.
-- Supabase SQL Editor'de çalıştırın.

-- 1. Mevcut mulkiyet_durumu CHECK constraint varsa kaldır
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.araclar'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%mulkiyet_durumu%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.araclar DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Constraint % kaldırıldı.', constraint_name;
    ELSE
        RAISE NOTICE 'mulkiyet_durumu CHECK constraint bulunamadı, atlanıyor.';
    END IF;
END;
$$;

-- 2. Yeni constraint ekle (ATAMA_BEKLIYOR dahil)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'araclar_mulkiyet_durumu_check'
          AND conrelid = 'public.araclar'::regclass
    ) THEN
        ALTER TABLE public.araclar
            ADD CONSTRAINT araclar_mulkiyet_durumu_check
            CHECK (mulkiyet_durumu IS NULL OR mulkiyet_durumu IN (
                'ÖZMAL', 'TAŞERON', 'KİRALIK', 'ATAMA_BEKLIYOR'
            ))
            NOT VALID;
        RAISE NOTICE 'Yeni constraint eklendi.';
    END IF;
END;
$$;

-- 3. Index ekle (performans)
CREATE INDEX IF NOT EXISTS idx_araclar_mulkiyet_durumu
    ON public.araclar (mulkiyet_durumu);

-- Kontrol
SELECT id, plaka, mulkiyet_durumu, created_at
FROM public.araclar
WHERE mulkiyet_durumu = 'ATAMA_BEKLIYOR'
ORDER BY created_at DESC;
