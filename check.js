const fetch = require('node-fetch');
const url = 'https://tegpcyfhjuwfjufjjuig.supabase.co/rest/v1/kredi_karti_islemleri?select=aciklama,tutar&order=id.desc&limit=20';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZ3BjeWZoanV3Zmp1ZmpqdWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1ODc2NzAsImV4cCI6MjA4NzE2MzY3MH0.reu-qWRg0GA3LPcwWPIGGM7-AgzTgWmIRuzSjdW85qg';

fetch(url, {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
}).then(r => r.json()).then(console.log).catch(console.error);
