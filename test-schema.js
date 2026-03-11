const fs = require('fs');
const p = 'C:/Users/hhasa/OneDrive/Desktop/Filo-ERP/config.js';
const c = fs.readFileSync(p, 'utf8');
const url = c.match(/supabaseUrl = ['"]([^'"]+)['"]/)[1];
const key = c.match(/supabaseKey = ['"]([^'"]+)['"]/)[1];

fetch(`${url}/rest/v1/?apikey=${key}`)
    .then(r => r.json())
    .then(data => {
        let t = data.definitions ? data.definitions.musteri_servis_puantaj : null;
        if (t) {
            console.log("SCHEMA COLUMNS:", Object.keys(t.properties));
        } else {
            console.log("Could not find table definitions.", Object.keys(data));
        }
    });
