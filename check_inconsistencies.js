
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInconsistencies() {
    try {
        console.log('--- Checking for duplicate (arac_id, musteri_id) with different prices ---');
        const { data, error } = await supabase
            .from('musteri_arac_tanimlari')
            .select('*');
        
        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        const map = {};
        const inconsistencies = [];

        data.forEach(row => {
            const key = `${row.arac_id}-${row.musteri_id}`;
            if (map[key]) {
                const prev = map[key];
                if (prev.vardiya_fiyat !== row.vardiya_fiyat || 
                    prev.tek_fiyat !== row.tek_fiyat || 
                    prev.mesai_fiyat !== row.mesai_fiyat) {
                    inconsistencies.push({
                        pair: key,
                        record1: { id: prev.id, vf: prev.vardiya_fiyat, tf: prev.tek_fiyat, mf: prev.mesai_fiyat, type: prev.tarife_turu },
                        record2: { id: row.id, vf: row.vardiya_fiyat, tf: row.tek_fiyat, mf: row.mesai_fiyat, type: row.tarife_turu }
                    });
                }
            } else {
                map[key] = row;
            }
        });

        if (inconsistencies.length > 0) {
            console.log(`Found ${inconsistencies.length} inconsistent pairs:`);
            console.log(JSON.stringify(inconsistencies.slice(0, 5), null, 2));
        } else {
            console.log('No price inconsistencies found among duplicates.');
        }

        console.log('\n--- Checking for records with null arac_id or musteri_id ---');
        const nulls = data.filter(r => !r.arac_id || !r.musteri_id);
        console.log(`Found ${nulls.length} records with null ID.`);

    } catch (e) {
        console.error('Exception:', e);
    }
}

checkInconsistencies();
