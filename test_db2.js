const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

async function run() {
    const fetchArgs = { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } };

    // 1. Öztürk Yılmaz Query
    let res = await fetch(`${url}/rest/v1/soforler?select=id,ad_soyad&limit=100`, fetchArgs);
    const soforler = await res.json();
    const ozturk = soforler.find(s => s.ad_soyad && s.ad_soyad.includes('ztürk'));
    console.log("OZTURK:", ozturk);

    // 2. All araclar tracking
    res = await fetch(`${url}/rest/v1/araclar?select=id,plaka,sofor_id&limit=500`, fetchArgs);
    const araclar = await res.json();
    if (ozturk) {
        const hisCars = araclar.filter(a => String(a.sofor_id).trim() === String(ozturk.id).trim());
        console.log("HIS ASSIGNED CARS BY UUID MATCH:", hisCars);
        const nameCars = araclar.filter(a => typeof a.sofor_id === 'string' && a.sofor_id.includes('ztürk'));
        console.log("CARS ASSIGNED BY NAME MALFORMATION:", nameCars);
    }

    // 3. What car does he drive? Let's find any car that might belong to him.
    // We already query all cars. Let's see if anyone has a broken sofor_id.
    const brokenCars = araclar.filter(a => a.sofor_id && a.sofor_id.length !== 36);
    console.log("CARS WITH MALFORMED SOFOR_ID:", brokenCars);

    // 4. Müşteri (Puantaj) Check
    res = await fetch(`${url}/rest/v1/musteri_servis_puantaj?select=musteri_id&limit=10`, fetchArgs);
    const puantaj = await res.json();
    const mid = puantaj.length > 0 ? puantaj[0].musteri_id : null;
    console.log("SAMPLE MUSTERI_ID IN PUANTAJ:", mid);

    if (mid) {
        res = await fetch(`${url}/rest/v1/cariler?select=id,unvan,ad_soyad&id=eq.${mid}`, fetchArgs);
        const cariCheck = await res.json();
        console.log("CARI MATCH FOR THAT MUSTERI_ID:", cariCheck);
    }
}
run();
