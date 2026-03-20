const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

async function run() {
    const fetchArgs = { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } };

    let res = await fetch(`${url}/rest/v1/araclar?select=plaka,marka_model,guncel_km&sofor_id=eq.60312a32-e9da-4352-a616-a23fc5bd6633`, fetchArgs);
    console.log("ARAC QUERY FOR OZTURK YILMAZ:", await res.json());

    // Takvim test
    let resM = await fetch(`${url}/rest/v1/cariler?select=id,unvan`, fetchArgs);
    const caris = await resM.json();
    console.log("CARILER IN TAKVIM QUERY RESULT:", caris.slice(0, 5));
}
run();
