const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

async function run() {
    const fetchArgs = { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } };

    // Get puantaj records
    let res = await fetch(`${url}/rest/v1/musteri_servis_puantaj?select=musteri_id`, fetchArgs);
    const puantaj = await res.json();
    const uniqueIds = [...new Set(puantaj.map(p => p.musteri_id))];
    console.log("UNIQUE MUSTERI IDs IN PUANTAJ:", uniqueIds);

    // Filter out nulls
    const validIds = uniqueIds.filter(id => id && id !== 'diger');

    if (validIds.length > 0) {
        // Build an "in" query
        const inStr = `(${validIds.join(',')})`;
        res = await fetch(`${url}/rest/v1/cariler?select=id,unvan&id=in.${inStr}`, fetchArgs);
        const matchedCaris = await res.json();
        console.log("MATCHING CARILER FOR THESE IDs:", matchedCaris);
    } else {
        console.log("No valid musteriIds to check.");
    }
}
run();
