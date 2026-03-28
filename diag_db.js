
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    try {
        console.log('--- musteri_servis_puantaj ---');
        const { data: pData } = await supabase.from('musteri_servis_puantaj').select('*').limit(1);
        if (pData && pData[0]) {
            console.log('Sample puantaj:', pData[0]);
            console.log('arac_id type:', typeof pData[0].arac_id);
            console.log('musteri_id type:', typeof pData[0].musteri_id);
        }

        console.log('\n--- musteri_arac_tanimlari ---');
        const { data: tData } = await supabase.from('musteri_arac_tanimlari').select('*').limit(1);
        if (tData && tData[0]) {
            console.log('Sample tanim:', tData[0]);
            console.log('arac_id type:', typeof tData[0].arac_id);
            console.log('musteri_id type:', typeof tData[0].musteri_id);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

diagnose();
