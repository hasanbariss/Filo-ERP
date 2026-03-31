
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    try {
        console.log('--- Fetching a sample vehicle from puantaj ---');
        const { data: pData } = await supabase.from('musteri_servis_puantaj').select('arac_id, musteri_id').limit(1);
        if (!pData || !pData[0]) {
            console.log('No puantaj data found.');
            return;
        }
        const { arac_id, musteri_id } = pData[0];
        console.log(`Analyzing for arac_id: ${arac_id}, musteri_id: ${musteri_id}`);

        console.log('\n--- Records in musteri_arac_tanimlari for this pair ---');
        const { data: tData, error: tErr } = await supabase
            .from('musteri_arac_tanimlari')
            .select('*')
            .eq('arac_id', arac_id)
            .eq('musteri_id', musteri_id);
        
        if (tErr) {
            console.error('Error fetching tanimlar:', tErr);
        } else {
            console.log(`Found ${tData.length} records:`, tData);
        }

        console.log('\n--- Checking for ANY record with this arac_id ---');
        const { data: aData } = await supabase
            .from('musteri_arac_tanimlari')
            .select('id, musteri_id, tarife_turu')
            .eq('arac_id', arac_id);
        console.log(`Total records for this arac_id: ${aData?.length || 0}`, aData);

    } catch (e) {
        console.error('Exception:', e);
    }
}

diagnose();
