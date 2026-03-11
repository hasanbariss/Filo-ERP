const fs = require('fs');
const content = fs.readFileSync('data-services.js', 'utf8');
const match = content.match(/window\.supabaseUrl\s*=\s*'([^']+)'/);
const matchKey = content.match(/window\.supabaseAnonKey\s*=\s*'([^']+)'/);
(async () => {
    if (match && matchKey) {
        const res = await fetch(match[1] + '/rest/v1/soforler?select=ad_soyad,aylik_maas,gunluk_ucret,id', { headers: { 'apikey': matchKey[1], 'Authorization': 'Bearer ' + matchKey[1] } });
        const soforler = await res.json();
        console.log("SOFORLER:", soforler);
        const resBordro = await fetch(match[1] + '/rest/v1/sofor_maas_bordro?select=*', { headers: { 'apikey': matchKey[1], 'Authorization': 'Bearer ' + matchKey[1] } });
        console.log("BORDRO:", await resBordro.json());
    } else {
        console.log("No match found.");
    }
})();
