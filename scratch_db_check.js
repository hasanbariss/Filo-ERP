const fs = require('fs');
const configMatch = fs.readFileSync('C:/Users/hhasa/OneDrive/Desktop/Filo-ERP-main/config.js', 'utf8').match(/window\.supabaseUrl = '([^']+)'[\s\S]+?window\.supabaseKey = '([^']+)'/);
if (configMatch) {
    const supabaseUrl = configMatch[1];
    const supabaseKey = configMatch[2];
    fetch(supabaseUrl + '/rest/v1/kredi_karti_islemleri?select=aciklama,tutar&order=id.desc&limit=10', {
        headers: {
            'apikey': supabaseKey,
            'Authorization': 'Bearer ' + supabaseKey
        }
    }).then(res => res.json()).then(console.log).catch(console.error);
}
