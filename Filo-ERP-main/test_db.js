const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tegpcyfhjuwfjufjjuig.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const tables = ['arac_bakimlari', 'yakit_takip', 'arac_policeler', 'sofor_maas_bordro'];
    
    for (const table of tables) {
        console.log(`--- Table: ${table} ---`);
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.error(`Error fetching ${table}:`, error.message);
            } else if (data && data.length > 0) {
                console.log('Columns:', Object.keys(data[0]));
                console.log('Sample data:', JSON.stringify(data[0], null, 2));
            } else {
                console.log('No data found in table.');
            }
        } catch (e) {
            console.error(`Exception in ${table}:`, e.message);
        }
    }
}

checkColumns();
