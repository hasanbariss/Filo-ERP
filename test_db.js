const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

async function fetchSupabase(table, select = '*') {
    const res = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=5`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    return res.json();
}

async function run() {
    const soforler = await fetchSupabase('soforler', 'id,ad_soyad');
    const araclar = await fetchSupabase('araclar', 'id,plaka,sofor_id');
    const cariler = await fetchSupabase('cariler', 'id,unvan,tur');
    const puantaj = await fetchSupabase('musteri_servis_puantaj', 'id,musteri_id,tarih');
    
    console.log("=== SOFORLER ===");
    console.log(JSON.stringify(soforler, null, 2));
    
    console.log("=== ARACLAR ===");
    console.log(JSON.stringify(araclar, null, 2));

    console.log("=== CARILER ===");
    console.log(JSON.stringify(cariler, null, 2));

    console.log("=== PUANTAJ ===");
    console.log(JSON.stringify(puantaj, null, 2));
}

run();
