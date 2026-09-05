BEGIN;
CREATE FUNCTION public.kaydet_dogrulanmis_gps(p_referans uuid,p_km numeric,p_an timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE vehicle uuid;
BEGIN
 SELECT arac_id INTO vehicle FROM public.arac_km_referanslari WHERE id=p_referans;
 PERFORM id FROM public.araclar WHERE id=vehicle FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.arac_km_referanslari WHERE id=p_referans AND aktif) THEN RETURN; END IF;
 IF p_km IS NULL OR p_km<0 OR p_an IS NULL OR p_an>now() THEN RAISE EXCEPTION 'Geçersiz GPS sonucu'; END IF;
 INSERT INTO public.arac_gps_durumlari(referans_id,km,hesaplanan_an,son_deneme,durum,hata)
 VALUES(p_referans,p_km,p_an,now(),'ready',NULL)
 ON CONFLICT(referans_id) DO UPDATE SET km=excluded.km,hesaplanan_an=excluded.hesaplanan_an,son_deneme=now(),durum='ready',hata=NULL
 WHERE arac_gps_durumlari.hesaplanan_an IS NULL OR excluded.hesaplanan_an>=arac_gps_durumlari.hesaplanan_an;
 -- Never reduce a manually entered odometer reading.
 UPDATE public.araclar SET guncel_km=GREATEST(COALESCE(guncel_km,0),floor(p_km)) WHERE id=vehicle;
END $$;
REVOKE ALL ON FUNCTION public.kaydet_dogrulanmis_gps(uuid,numeric,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kaydet_dogrulanmis_gps(uuid,numeric,timestamptz) TO service_role;
COMMIT;
