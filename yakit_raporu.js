/* Baris.Flow Drive — owner-grouped fuel reports and print preview. */
const urlParams = new URLSearchParams(window.location.search);
const monthStr = urlParams.get('ay') || new Date().toISOString().substring(0, 7); // 'YYYY-MM'

let isolatedAraclar = [];
let isolatedYakitlar = [];
window.currentView = 'summary';
let reportVehicles = [], reportFuel = [];
let fuelRequest = 0, fuelReady = false;
function fuelEscape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
window.searchQuery = '';

async function initYakitRaporu() {
    try {
        if (!window.supabaseClient) throw new Error("SupabaseClient tanımsız! config.js yüklenemedi.");

        const [year, mStr] = monthStr.split('-');
        const ay = parseInt(mStr, 10);
        const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

        document.getElementById('header-title').textContent = `Yakıt Raporu`;
        document.getElementById('header-subtitle').textContent = `${months[ay - 1]} ${year}`;

        if (document.getElementById('filter-donem')) {
            document.getElementById('filter-donem').value = monthStr;
        }

        // Initialize checkboxes from URL if provided (comma-separated)
        const mulkiyetParam = urlParams.get('mulkiyet');
        if (mulkiyetParam) {
            const values = mulkiyetParam.split(',');
            document.querySelectorAll('#dropdown-mulkiyet input[type="checkbox"]').forEach(cb => {
                cb.checked = values.includes(cb.value);
            });
        }

        const sirketParam = urlParams.get('sirket');
        if (sirketParam) {
            const values = sirketParam.split(',');
            document.querySelectorAll('#dropdown-sirket input[type="checkbox"]').forEach(cb => {
                cb.checked = values.includes(cb.value);
            });
        }

        const bounds = window.FuelAnalytics.periodBounds('month', monthStr + '-01');
        document.getElementById('fuel-start').value = bounds.start;
        document.getElementById('fuel-end').value = bounds.end;
        await fetchData();
        if (fuelReady) window.switchView('summary');
    } catch (e) {
        showFuelError(e);
    }
}

function showFuelError(error) {
    fuelReady = false;
    isolatedAraclar = []; isolatedYakitlar = [];
    document.getElementById('fuel-report-status').innerHTML = 'Yakıt raporu yüklenemedi: ' + fuelEscape(error.message || error) + ' <button onclick="location.reload()">Tekrar dene</button>';
    document.getElementById('yakit-tbody').innerHTML = '';
    document.getElementById('view-list').innerHTML = '';
    document.getElementById('fuel-report-kpis').innerHTML = '';
    document.getElementById('total-summary-tutar').textContent = '—';
}
async function fuelPages(makeQuery) {
    const rows = [];
    for (let from = 0; ; from += 1000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        let response;
        try {
            const query = makeQuery().order('id').range(from, from + 999);
            response = await (query.abortSignal ? query.abortSignal(controller.signal) : query);
        } finally { clearTimeout(timer); }
        const {data, error} = response;
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 1000) return rows;
    }
}
async function fetchData() {
    const request = ++fuelRequest;
    fuelReady = false;
    document.getElementById('fuel-report-status').textContent = 'Veriler çekiliyor…';
    const start = document.getElementById('fuel-start').value;
    const end = document.getElementById('fuel-end').value;
    try {
        if (!window.supabaseClient) throw new Error('Bağlantı yapılandırması yüklenemedi.');
        if (!start || !end || start > end) throw new Error('Geçerli bir tarih aralığı seçin.');
        let vehicles;
        try { vehicles = await fuelPages(() => window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu, sirket, sofor_id, firma_adi, arac_sinifi')); }
        catch (error) {
            if (!/arac_sinifi/i.test(error.message || '')) throw error;
            vehicles = await fuelPages(() => window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu, sirket, sofor_id, firma_adi'));
        }
        const [drivers, rows] = await Promise.all([
            fuelPages(() => window.supabaseClient.from('soforler').select('id, ad_soyad')),
            fuelPages(() => window.supabaseClient.from('yakit_takip').select('*').gte('tarih', start).lte('tarih', end))
        ]);
        if (request !== fuelRequest) return;
        const driverMap = new Map(drivers.map(d => [String(d.id), d.ad_soyad]));
        reportVehicles = vehicles.map(v => ({...v, display_name:v.mulkiyet_durumu === 'TAŞERON' ? v.firma_adi || 'Bilinmiyor' : driverMap.get(String(v.sofor_id)) || 'Atanmamış'}));
        reportFuel = rows;
        const select = document.getElementById('fuel-plates');
        const selected = new Set(Array.from(select.selectedOptions).map(o => o.value));
        select.innerHTML = vehicles.sort((a,b) => a.plaka.localeCompare(b.plaka,'tr')).map(v => '<option value="'+fuelEscape(v.id)+'"'+(selected.has(String(v.id))?' selected':'')+'>'+fuelEscape(v.plaka)+'</option>').join('');
        fuelReady = true;
        applyReportFilters();
    } catch (error) { if (request === fuelRequest) showFuelError(error); }
}
window.applyFuelPreset = function(value) {
    document.querySelectorAll('#dropdown-mulkiyet input, #dropdown-sirket input').forEach(cb => cb.checked = false);
    applyReportFilters();
};
function applyReportFilters() {
    if (!fuelReady) return;
    const preset = document.getElementById('fuel-preset').value;
    const owners = Array.from(document.querySelectorAll('#dropdown-mulkiyet input:checked')).map(cb => cb.value);
    const companies = Array.from(document.querySelectorAll('#dropdown-sirket input:checked')).map(cb => cb.value);
    const plates = Array.from(document.getElementById('fuel-plates').selectedOptions).map(o => o.value);
    const vehicleClass = document.getElementById('fuel-class').value;
    const query = window.FuelAnalytics.normalizePlate(document.getElementById('search-plaka').value);
    isolatedAraclar = reportVehicles.filter(v => window.FuelAnalytics.matchesReportPreset(v, preset) &&
        (!owners.length || owners.includes(v.mulkiyet_durumu)) && (!companies.length || companies.includes(v.sirket)) &&
        (!plates.length || plates.includes(String(v.id))) && (!vehicleClass || (v.arac_sinifi || 'SINIFLANDIRILMAMIŞ') === vehicleClass) &&
        (!query || window.FuelAnalytics.normalizePlate(v.plaka+' '+(v.firma_adi || '')+' '+(v.sirket || '')).includes(query)));
    const ids = new Set(isolatedAraclar.map(v => String(v.id)));
    isolatedYakitlar = reportFuel.filter(r => ids.has(String(r.arac_id)));
    const summary = window.FuelAnalytics.summarizeFuelRows(isolatedYakitlar);
    document.getElementById('total-summary-tutar').textContent = '₺' + summary.cost.toLocaleString('tr-TR');
    document.getElementById('fuel-report-kpis').innerHTML = [['Araç sayısı', isolatedAraclar.length],['Yakıt fişi',summary.count],['Toplam litre',summary.liters],['Toplam tutar · TL',summary.cost]].map(([label,value]) => '<article>'+label+'<strong>'+value.toLocaleString('tr-TR',{minimumFractionDigits:label.includes('Toplam')?2:0,maximumFractionDigits:2})+'</strong></article>').join('');
    const unmatched = reportFuel.filter(r => !reportVehicles.some(v => String(v.id) === String(r.arac_id))).length;
    document.getElementById('fuel-report-status').textContent = (!summary.count ? 'Seçili filtrelerde yakıt kaydı yok. ' : '') + (unmatched ? unmatched+' kayıt araçla eşleşmedi; toplamlara dahil edilmedi. ' : '') + (preset === 'other-subcontract' ? 'Şirketi boş taşeronlar bu kapsama dahil edilmez.' : '');
    document.getElementById('header-subtitle').textContent = fuelDate(document.getElementById('fuel-start').value)+' – '+fuelDate(document.getElementById('fuel-end').value)+' · '+document.getElementById('fuel-preset').selectedOptions[0].textContent + (owners.length ? ' · '+owners.join(', ') : '') + (companies.length ? ' · '+companies.join(', ') : '') + (vehicleClass ? ' · '+vehicleClass : '') + (plates.length || query ? ' · Seçili plakalar' : '');
    document.getElementById('print-section').innerHTML = '';
    renderView();
}
window.exportFuelExcel = function() {
    if (!fuelReady) return;
    const rows = currentOwnerGroups().flatMap(group=>group.vehicles.flatMap(item=>item.records.map(r=>{const v=item.vehicle;return {'Araç sahibi':group.owner,'Tarih':r.tarih,'Plaka':v.plaka,'Şirket':v.sirket,'Mülkiyet':v.mulkiyet_durumu,'Litre':Number(r.litre)||0,'Birim fiyat':Number(r.birim_fiyat)||0,'Tutar':Number(r.toplam_tutar)||0}; })));
    const sheet = XLSX.utils.aoa_to_sheet([[document.getElementById('header-subtitle').textContent]]);
    XLSX.utils.sheet_add_json(sheet, rows, {origin:'A3'});
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Yakıt');
    XLSX.writeFile(book,'Yakit_'+document.getElementById('fuel-start').value+'.xlsx');
};

function renderView() {
    document.getElementById('view-list').innerHTML = '';
    
    // Apply Plate Search Filter
    const query = (window.searchQuery || '').toUpperCase().trim();
    let filteredAraclar = isolatedAraclar;
    if (query) {
        filteredAraclar = isolatedAraclar.filter(a => (a.plaka || '').toUpperCase().includes(query));
    }
    
    if (currentView === 'grid') renderGridView(filteredAraclar);
    else if (window.currentView === 'list') renderListView(filteredAraclar);
    else if (window.currentView === 'vehicle') renderVehicleView(filteredAraclar);
    else renderSummaryView(filteredAraclar);
    
    if (window.lucide) window.lucide.createIcons();
}

window.filterSearch = applyReportFilters;

function renderGridView(araclar = isolatedAraclar) {
    const thead = document.getElementById('yakit-thead');
    const tbody = document.getElementById('yakit-tbody');
    document.getElementById('view-grid').classList.remove('hidden');
    document.getElementById('view-list').classList.add('hidden');
    const dates = [];
    const end = document.getElementById('fuel-end').value;
    for (let date = new Date(document.getElementById('fuel-start').value+'T12:00:00Z'); date.toISOString().slice(0,10) <= end; date.setUTCDate(date.getUTCDate()+1)) dates.push(date.toISOString().slice(0,10));
    const daysInMonth = dates.length;
    if (araclar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="35" class="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Seçili kriterlerde araç bulunamadı.</td></tr>`;
        return;
    }
    let thHtml = `<tr><th class="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-white z-20 border-b border-r border-slate-100" style="width: 110px;">ARAÇ</th>`;
    for (let i = 1; i <= daysInMonth; i++) thHtml += `<th class="p-0 py-3 text-center text-[10px] font-bold text-slate-400 border-r border-b border-slate-50" style="width: 45px;">${dates[i-1].slice(5).split('-').reverse().join('.')}</th>`;
    thHtml += `<th class="px-0 py-3 text-center text-[10px] font-black text-slate-500 border-r border-b border-slate-100 uppercase tracking-widest sticky right-[75px] bg-slate-50 z-20" style="width: 75px;">LİTRE</th>`;
    thHtml += `<th class="px-0 py-3 text-center text-[10px] font-black text-slate-500 border-b border-slate-100 uppercase tracking-widest sticky right-0 bg-slate-50 z-20" style="width: 85px;">TUTAR</th></tr>`;
    thead.innerHTML = thHtml;
    let tblHtml = '';
    araclar.forEach(arac => {
        const plateDisplay = `${arac.plaka} <br> <span class="text-[8px] text-slate-400 font-medium">${arac.display_name}</span>`;
        tblHtml += `<tr class="hover:bg-slate-50 transition-colors"><td class="px-4 py-2 text-[11px] font-black text-slate-900 sticky left-0 bg-white z-10 border-r border-b border-slate-50 uppercase text-center">${plateDisplay}</td>`;
        let rowLitreTotal = 0; let rowTutarTotal = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = dates[i-1];
            const records = isolatedYakitlar.filter(y => String(y.arac_id) === String(arac.id) && y.tarih === dateCode);
            const dayLitre = records.reduce((sum, r) => sum + (parseFloat(r.litre) || 0), 0);
            const dayTutar = records.reduce((sum, r) => sum + (parseFloat(r.toplam_tutar) || 0), 0);
            rowLitreTotal += dayLitre; rowTutarTotal += dayTutar;
            const displayVal = dayLitre > 0 ? `<div class="leading-none mb-0.5 text-[10px] font-black text-slate-900">${dayLitre.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</div><div class="text-[7.5px] text-orange-600 font-bold leading-none">₺${Math.round(dayTutar).toLocaleString('tr-TR')}</div>` : '';
            tblHtml += `<td class="p-0 border-r border-b border-slate-50 text-center ${dayLitre > 0 ? 'bg-orange-50/20' : ''}" style="width: 45px; height: 38px;">${displayVal}</td>`;
        }
        tblHtml += `<td class="px-1 py-0 text-center text-[10px] font-black text-slate-900 border-r border-b border-slate-100 bg-slate-50/50 sticky right-[75px]">${rowLitreTotal.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}</td>`;
        tblHtml += `<td class="px-1 py-0 text-center text-[10px] font-black text-slate-900 border-b border-slate-100 bg-slate-50/50 sticky right-0">₺${rowTutarTotal.toLocaleString('tr-TR')}</td></tr>`;
    });
    tbody.innerHTML = tblHtml;
}

function renderListView() {
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    const days=new Map();
    currentOwnerGroups().forEach(group=>group.vehicles.forEach(item=>item.records.forEach(row=>{if(!days.has(row.tarih))days.set(row.tarih,[]);days.get(row.tarih).push({row:row,vehicle:item.vehicle,owner:group.owner});})));
    document.getElementById('view-list').innerHTML=Array.from(days.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,items])=>{
        const totals=window.FuelAnalytics.summarizeFuelRows(items.map(item=>item.row));
        return '<section class="owner-card"><div class="owner-heading"><h3>'+fuelDate(date)+'<small>'+items.length+' yakıt fişi</small></h3><span>'+fuelNumber(totals.cost)+' TL</span></div><div class="table-scroll"><table class="owner-print-table"><thead><tr class="column-titles"><th>Araç sahibi</th><th>Plaka</th><th class="num">Litre</th><th class="num">Birim (TL)</th><th class="num">Tutar (TL)</th></tr></thead><tbody>'+items.map(({row,vehicle,owner})=>'<tr><td>'+fuelEscape(owner)+'</td><td>'+fuelEscape(vehicle.plaka)+'</td><td class="num">'+fuelNumber(row.litre)+'</td><td class="num">'+fuelNumber(row.birim_fiyat)+'</td><td class="num">'+fuelNumber(row.toplam_tutar)+'</td></tr>').join('')+'</tbody></table></div></section>';
    }).join('') || '<div class="empty-report">Bu filtrelerde yakıt hareketi bulunamadı.</div>';
}

function fuelNumber(value) { return Number(value || 0).toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fuelDate(value) { return String(value || '').slice(0,10).split('-').reverse().join('.'); }
function currentOwnerGroups() { return window.FuelAnalytics.ownerGroups(isolatedAraclar,isolatedYakitlar); }
function ownerSummaryTable(group) {
    return '<div class="table-scroll"><table class="fuel-summary-table"><thead><tr><th>Plaka</th><th>Şirket</th><th>Mülkiyet</th><th class="num">Fiş</th><th class="num">Litre</th><th class="num">Tutar (TL)</th></tr></thead><tbody>'+group.vehicles.map(function(item){const v=item.vehicle;return '<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td><span class="ownership-badge">'+fuelEscape(v.mulkiyet_durumu)+'</span></td><td class="num">'+item.totals.count+'</td><td class="num">'+fuelNumber(item.totals.liters)+'</td><td class="num">'+fuelNumber(item.totals.cost)+'</td></tr>';}).join('')+'<tr class="owner-subtotal"><td colspan="4">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td><td class="num">'+fuelNumber(group.cost)+'</td></tr></tbody></table></div>';
}
function renderSummaryView() {
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    const groups=currentOwnerGroups();
    document.getElementById('view-list').innerHTML=groups.map(group=>'<section class="owner-card"><div class="owner-heading"><h3>'+fuelEscape(group.owner)+'<small>'+group.vehicles.length+' araç</small></h3><span>'+fuelNumber(group.cost)+' TL</span></div>'+ownerSummaryTable(group)+'</section>').join('') || '<div class="empty-report">Bu filtrelerde araç bulunamadı.</div>';
}
function renderVehicleView() {
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    document.getElementById('view-list').innerHTML=currentOwnerGroups().map(group=>'<section class="owner-card"><div class="owner-heading"><h3>'+fuelEscape(group.owner)+'<small>'+group.vehicles.length+' araç</small></h3><span>'+fuelNumber(group.cost)+' TL</span></div><div class="table-scroll">'+ownerPrintTable(group,true)+'</div></section>').join('') || '<div class="empty-report">Bu filtrelerde araç bulunamadı.</div>';
}
window.switchView = function(view) {
    window.currentView=view;
    ['summary','vehicle','list','grid'].forEach(key=>{const button=document.getElementById('btn-view-'+key);button.className=key===view?'is-active':'';button.setAttribute('aria-pressed',key===view?'true':'false');});
    renderView();
};

window.filterYakit = function() { document.getElementById('fuel-preset').value = 'custom'; fetchData(); }
window.changeDonem = function() {
    const newDonem = document.getElementById('filter-donem').value;
    if (newDonem) { const bounds = window.FuelAnalytics.periodBounds('month', newDonem+'-01'); document.getElementById('fuel-start').value=bounds.start; document.getElementById('fuel-end').value=bounds.end; fetchData(); }
}

function ownerPrintTable(group, detail) {
    const columns=detail?6:5;
    const head=detail?'<th>Plaka</th><th>Tarih</th><th>Şirket</th><th class="num">Litre</th><th class="num">Birim (TL)</th><th class="num">Tutar (TL)</th>':'<th>Plaka</th><th>Şirket</th><th class="num">Fiş</th><th class="num">Litre</th><th class="num">Tutar (TL)</th>';
    let rows='';
    group.vehicles.forEach(item=>{
        const v=item.vehicle;
        if(detail && item.records.length) {
            item.records.forEach(row=>{rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelDate(row.tarih)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td class="num">'+fuelNumber(row.litre)+'</td><td class="num">'+fuelNumber(row.birim_fiyat)+'</td><td class="num">'+fuelNumber(row.toplam_tutar)+'</td></tr>';});
        } else if(detail) {
            rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td colspan="2">Yakıt kaydı yok</td><td class="num">0,00</td><td class="num">—</td><td class="num">0,00</td></tr>';
        } else {
            rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td class="num">'+item.totals.count+'</td><td class="num">'+fuelNumber(item.totals.liters)+'</td><td class="num">'+fuelNumber(item.totals.cost)+'</td></tr>';
        }
    });
    const subtotal=detail?'<td colspan="3">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td><td></td>':'<td colspan="3">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td>';
    return '<table class="owner-print-table"><thead><tr class="owner-title"><th colspan="'+columns+'">'+fuelEscape(group.owner)+'<small>'+group.vehicles.length+' araç</small></th></tr><tr class="column-titles">'+head+'</tr></thead><tbody>'+rows+'<tr class="owner-subtotal">'+subtotal+'<td class="num">'+fuelNumber(group.cost)+'</td></tr></tbody></table>';
}
function fuelPrintPeriodLabel() {
    const start = document.getElementById('fuel-start').value;
    const end = document.getElementById('fuel-end').value;
    const format = value => new Intl.DateTimeFormat('tr-TR', {month:'long', year:'numeric', timeZone:'Europe/Istanbul'}).format(new Date(value + 'T12:00:00Z'));
    return start.slice(0,7) === end.slice(0,7) ? format(start) : format(start) + ' – ' + format(end);
}
function buildFuelPrintDocument() {
    const fueledIds = new Set(isolatedYakitlar.map(row => String(row.arac_id)));
    const printVehicles = isolatedAraclar.filter(vehicle => fueledIds.has(String(vehicle.id)));
    const printGroups = window.FuelAnalytics.ownerGroups(printVehicles, isolatedYakitlar);
    if (!printVehicles.length) return '<p class="empty-report">Seçili dönemde yazdırılacak yakıt kaydı bulunmuyor.</p>';
    const summary=window.FuelAnalytics.summarizeFuelRows(isolatedYakitlar);
    const detail=document.getElementById('fuel-print-format').value==='detail';
    return '<article class="fuel-document"><header class="document-header"><div><p class="document-period">Dönem: '+fuelEscape(fuelPrintPeriodLabel())+'</p><p>'+fuelEscape(document.getElementById('header-subtitle').textContent)+'</p></div><div class="document-brand">İDEOL</div></header><div class="document-totals"><span>Araç sayısı<strong>'+printVehicles.length+'</strong></span><span>Yakıt fişi<strong>'+summary.count+'</strong></span><span>Toplam litre<strong>'+fuelNumber(summary.liters)+'</strong></span><span>Toplam tutar<strong>'+fuelNumber(summary.cost)+' TL</strong></span></div>'+printGroups.map(group=>ownerPrintTable(group,detail)).join('')+'<div class="document-grand-total">Genel toplam: '+fuelNumber(summary.cost)+' TL</div><footer class="document-footer"><span>Düzenleme tarihi: '+new Date().toLocaleDateString('tr-TR')+' · Tutarlar Türk lirasıdır.</span><small>Baris.Flow</small></footer></article>';
}
window.refreshFuelPrintPreview = function() {
    if(!fuelReady)return;
    document.getElementById('fuel-print-preview').innerHTML=buildFuelPrintDocument();
};
window.openFuelPrintPreview = function() {
    if(!fuelReady)return;
    window.refreshFuelPrintPreview();
    document.getElementById('fuel-print-dialog').showModal();
};
window.onbeforeprint = function() { document.getElementById('print-section').innerHTML=fuelReady?buildFuelPrintDocument():'<p>Yazdırmak için rapor verilerinin yüklenmesini bekleyin.</p>'; };
window.handlePrint = function() {
    if(!fuelReady || !isolatedYakitlar.length)return;
    document.getElementById('fuel-print-dialog').close();
    window.onbeforeprint();
    window.print();
};
document.addEventListener('DOMContentLoaded', initYakitRaporu);
