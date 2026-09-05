BEGIN;
CREATE TABLE public.arac_km_referanslari (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arac_id uuid NOT NULL REFERENCES public.araclar(id),
 km numeric NOT NULL CHECK(km>=0), olcum_zamani timestamptz NOT NULL CHECK(olcum_zamani<=now()),
 mobile_id text NOT NULL, aktif boolean NOT NULL DEFAULT true, neden text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid DEFAULT auth.uid()
);
CREATE UNIQUE INDEX arac_km_aktif ON public.arac_km_referanslari(arac_id) WHERE aktif;
CREATE TABLE public.arac_gps_mesafeleri (
 referans_id uuid NOT NULL REFERENCES public.arac_km_referanslari(id), baslangic timestamptz NOT NULL,
 bitis timestamptz NOT NULL, km numeric NOT NULL CHECK(km>=0), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(referans_id,baslangic), CHECK(bitis>baslangic)
);
CREATE TABLE public.arac_gps_durumlari (
 referans_id uuid PRIMARY KEY REFERENCES public.arac_km_referanslari(id), km numeric,
 hesaplanan_an timestamptz, son_deneme timestamptz NOT NULL DEFAULT now(), durum text NOT NULL, hata text
);
CREATE TABLE public.arac_bakim_planlari (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), arac_id uuid NOT NULL REFERENCES public.araclar(id),
 tur text NOT NULL, konum text NOT NULL DEFAULT '', km_araligi numeric CHECK(km_araligi>0), gun_araligi integer CHECK(gun_araligi>0),
 uyari_km numeric NOT NULL DEFAULT 1000 CHECK(uyari_km>=0), uyari_gun integer NOT NULL DEFAULT 14 CHECK(uyari_gun>=0),
 ilk_bakim_km numeric CHECK(ilk_bakim_km>=0), ilk_bakim_zamani timestamptz,
 aktif boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(km_araligi IS NOT NULL OR gun_araligi IS NOT NULL), UNIQUE(arac_id,tur,konum)
);
ALTER TABLE public.arac_bakimlari ADD COLUMN bakim_plan_id uuid REFERENCES public.arac_bakim_planlari(id),
 ADD COLUMN islem_zamani timestamptz, ADD COLUMN km_kaynagi text;
CREATE TABLE public.arac_yakit_referanslari (
 arac_id uuid PRIMARY KEY REFERENCES public.araclar(id), kapasite numeric NOT NULL CHECK(kapasite>0),
 litre numeric NOT NULL CHECK(litre>=0), km numeric NOT NULL CHECK(km>=0), tarih date NOT NULL,
 tuketim numeric NOT NULL CHECK(tuketim>0), tum_dolumlar boolean NOT NULL DEFAULT false,
 CHECK(litre<=kapasite)
);
-- New tables follow existing authenticated application access. Derived GPS data
-- can only be written by the server; browser sessions can read it.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['arac_km_referanslari','arac_bakim_planlari','arac_yakit_referanslari'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY authenticated_all_access ON public.%I FOR ALL TO authenticated USING(true) WITH CHECK(true)',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['arac_gps_mesafeleri','arac_gps_durumlari'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY authenticated_read ON public.%I FOR SELECT TO authenticated USING(true)',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE FUNCTION public.yeni_km_referansi(p_arac uuid,p_km numeric,p_an timestamptz,p_mobile text,p_neden text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR p_km<0 OR p_an>now() OR length(trim(p_mobile))=0 OR length(trim(p_neden))=0 THEN RAISE EXCEPTION 'Geçersiz kilometre referansı'; END IF;
 PERFORM id FROM public.araclar WHERE id=p_arac FOR UPDATE;
 UPDATE public.arac_km_referanslari SET aktif=false WHERE arac_id=p_arac AND aktif;
 INSERT INTO public.arac_km_referanslari(arac_id,km,olcum_zamani,mobile_id,neden) VALUES(p_arac,p_km,p_an,p_mobile,p_neden) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.yeni_km_referansi(uuid,numeric,timestamptz,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.yeni_km_referansi(uuid,numeric,timestamptz,text,text) TO authenticated;
COMMIT;
