const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

async function run() {
    const fetchArgs = { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } };

    // Simulate openSoforDetay exact logic after my v1.0.8 fix:
    const soforId = '60312a32-e9da-4352-a616-a23fc5bd6633'; // Öztürk Yılmaz
    let res = await fetch(`${url}/rest/v1/araclar?select=plaka,marka_model&sofor_id=eq.${soforId}`, fetchArgs);
    const asignedArac = await res.json();
    console.log("SIMULATED openSoforDetay FIX:", asignedArac);
}
run();
