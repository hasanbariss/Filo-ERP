const fs = require('fs');
let html = fs.readFileSync('filoyonetim.html', 'utf8');

const tSearch = '                <!-- KPI Satırı -->';
const tReplace = [
    '                <!-- Akıllı Vade Alarmları -->',
    '                <div class="mb-6">',
    '                    <div class="flex justify-between items-center mb-4">',
    '                        <h3 class="text-sm font-bold text-red-500 w-full flex justify-between items-center gap-4">',
    '                            <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-red-500 animate-ping"></div> FİLO RİSKLERİ / GECİKMİŞ VADELER</div> ',
    '                            <button onclick="if(window.sendAutoWhatsAppReport) window.sendAutoWhatsAppReport()" class="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg uppercase text-[10px] font-bold shadow-lg shadow-green-500/20">',
    '                                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i> OTO-RAPOR AL (WHATSAPP)',
    '                            </button>',
    '                        </h3>',
    '                    </div>',
    '                    <div id="vade-alarmlari-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"></div>',
    '                </div>',
    '',
    '                <!-- KPI Satırı -->'
].join('\\n');

if(html.includes('id="vade-alarmlari-container"')) {
    console.log('Already patched!');
} else {
    if(html.includes(tSearch)) {
        html = html.replace(tSearch, tReplace);
        fs.writeFileSync('filoyonetim.html', html);
        console.log('Successfully added Vade Alarmlari + Button!');
    } else {
        console.log('HTML target string not found...');
    }
}
