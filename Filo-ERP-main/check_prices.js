
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPrices() {
    try {
        console.log('--- Checking for non-zero prices in musteri_arac_tanimlari ---');
        const { data, error } = await supabase
            .from('musteri_arac_tanimlari')
            .select('*')
            .or('mesai_fiyat.gt.0,tek_fiyat.gt.0,vardiya_fiyat.gt.0')
            .limit(10);
        
        if (error) {
            console.error('Error:', error);
        } else {
            console.log(`Found ${data.length} records with non-zero prices:`, data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkPrices();
