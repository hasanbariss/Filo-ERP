const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'sb_publishable_3rTWqqV2CgIYwowmfg0s1A_bORvQSTk';
(async () => {
    try {
        const res = await fetch(url + '/rest/v1/soforler?select=id,ad_soyad,aylik_maas,gunluk_ucret&ad_soyad=ilike.*Adem*', {
            headers: {
                'apikey': key,
                'Authorization': 'Bearer ' + key
            }
        });
        const data = await res.json();
        console.log('Sofor:', data);

        if (data.length > 0) {
            const soforId = data[0].id;
            const res2 = await fetch(url + '/rest/v1/sofor_maas_bordro?sofor_id=eq.' + soforId, {
                headers: {
                    'apikey': key,
                    'Authorization': 'Bearer ' + key
                }
            });
            console.log('Bordro:', await res2.json());
        }
    } catch (err) { console.error(err); }
})();
