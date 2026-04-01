
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTypes() {
    try {
        console.log('--- Checking column types via RPC or sample reflection ---');
        // Since I can't easily query information_schema via Supabase client, I will try to infer from data
        const { data, error } = await supabase.from('musteri_arac_tanimlari').select('*').limit(5);
        if (data && data.length > 0) {
            data.forEach((row, idx) => {
                console.log(`Row ${idx}:`);
                console.log(`  arac_id: ${row.arac_id} (type: ${typeof row.arac_id})`);
                console.log(`  musteri_id: ${row.musteri_id} (type: ${typeof row.musteri_id})`);
            });
        }

        console.log('\n--- Checking musteri_servis_puantaj types ---');
        const { data: pData } = await supabase.from('musteri_servis_puantaj').select('arac_id, musteri_id').limit(5);
        if (pData && pData.length > 0) {
            pData.forEach((row, idx) => {
                console.log(`Row ${idx}:`);
                console.log(`  arac_id: ${row.arac_id} (type: ${typeof row.arac_id})`);
                console.log(`  musteri_id: ${row.musteri_id} (type: ${typeof row.musteri_id})`);
            });
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkTypes();
