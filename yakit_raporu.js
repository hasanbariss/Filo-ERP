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
    if (typeof window.refreshFuelTemplateDropdowns === 'function') window.refreshFuelTemplateDropdowns();
    if (typeof updateOrderIndicator === 'function') updateOrderIndicator();
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
    
    if (currentView === 'grid') {
        const sortedVehicles = currentOwnerGroups().flatMap(g => g.vehicles.map(v => v.vehicle));
        let gridList = sortedVehicles;
        if (query) {
            gridList = gridList.filter(a => (a.plaka || '').toUpperCase().includes(query));
        }
        renderGridView(gridList);
    }
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

/* === ÖZEL SIRALAMA VE ŞABLON YÖNETİMİ === */
const FUEL_TEMPLATES_KEY = 'fuel_report_templates_v1';
const FUEL_ACTIVE_TEMPLATE_KEY = 'fuel_report_active_template_v1';

window.getFuelTemplates = function () {
    try {
        const raw = localStorage.getItem(FUEL_TEMPLATES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
};

window.saveFuelTemplatesDict = function (dict) {
    try {
        localStorage.setItem(FUEL_TEMPLATES_KEY, JSON.stringify(dict));
    } catch (e) { console.error('Save templates error:', e); }
};

window.getActiveFuelTemplateName = function () {
    try {
        return localStorage.getItem(FUEL_ACTIVE_TEMPLATE_KEY) || '';
    } catch { return ''; }
};

window.setActiveFuelTemplateName = function (name) {
    try {
        if (name) localStorage.setItem(FUEL_ACTIVE_TEMPLATE_KEY, name);
        else localStorage.removeItem(FUEL_ACTIVE_TEMPLATE_KEY);
    } catch (e) { console.error('Set active template error:', e); }
};

function getFuelOrderStorageKey() {
    const start = document.getElementById('fuel-start')?.value || '';
    const end = document.getElementById('fuel-end')?.value || '';
    const preset = document.getElementById('fuel-preset')?.value || 'all';
    return `fuel_report_order_${start}_${end}_${preset}`;
}

window.loadCustomFuelOrder = function () {
    try {
        const activeName = window.getActiveFuelTemplateName();
        if (activeName) {
            const templates = window.getFuelTemplates();
            if (templates[activeName]) {
                return templates[activeName];
            }
        }
        const raw = localStorage.getItem(getFuelOrderStorageKey());
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
};

window.saveCustomFuelOrder = function (orderObj) {
    try {
        const activeName = window.getActiveFuelTemplateName();
        if (activeName) {
            const templates = window.getFuelTemplates();
            templates[activeName] = {
                ...orderObj,
                name: activeName,
                updatedAt: new Date().toISOString()
            };
            window.saveFuelTemplatesDict(templates);
        } else {
            localStorage.setItem(getFuelOrderStorageKey(), JSON.stringify(orderObj));
        }
        updateOrderIndicator();
        window.refreshFuelTemplateDropdowns();
    } catch (e) { console.error('Save order error:', e); }
};

window.selectFuelTemplate = function (name) {
    window.setActiveFuelTemplateName(name);
    window.refreshFuelTemplateDropdowns();
    updateOrderIndicator();
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
};

window.promptSaveNewFuelTemplate = function () {
    const templates = window.getFuelTemplates();
    const count = Object.keys(templates).length + 1;
    const defaultName = `Şablon ${count}`;
    const name = window.prompt('Kaydedilecek Sıralama Şablonu Adını Girin:\n(Örn: Müdüriyet Raporu, Muhasebe Sırası, Bölge Önceliği)', defaultName);
    if (!name || !name.trim()) return;

    const trimmed = name.trim();
    const currentOrder = window.loadCustomFuelOrder() || {
        ownerKeys: currentOwnerGroups().map(g => g.key),
        vehicleOrder: {}
    };

    if (!currentOrder.vehicleOrder || Object.keys(currentOrder.vehicleOrder).length === 0) {
        currentOrder.vehicleOrder = {};
        currentOwnerGroups().forEach(g => {
            currentOrder.vehicleOrder[g.key] = g.vehicles.map(v => v.vehicle.plaka);
        });
    }

    templates[trimmed] = {
        name: trimmed,
        createdAt: new Date().toISOString(),
        ownerKeys: currentOrder.ownerKeys,
        vehicleOrder: currentOrder.vehicleOrder
    };

    window.saveFuelTemplatesDict(templates);
    window.setActiveFuelTemplateName(trimmed);
    window.refreshFuelTemplateDropdowns();
    updateOrderIndicator();
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
    alert(`"${trimmed}" sıralama şablonu başarıyla kaydedildi ve uygulandı.`);
};

window.deleteCurrentFuelTemplate = function () {
    const activeName = window.getActiveFuelTemplateName();
    if (!activeName) {
        alert('Şu anda seçili kayıtlı bir şablon yok.');
        return;
    }

    if (!confirm(`"${activeName}" sıralama şablonunu silmek istediğinizden emin misiniz?`)) {
        return;
    }

    const templates = window.getFuelTemplates();
    delete templates[activeName];
    window.saveFuelTemplatesDict(templates);
    window.setActiveFuelTemplateName('');
    window.refreshFuelTemplateDropdowns();
    updateOrderIndicator();
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
};

window.resetFuelOrder = function () {
    try {
        window.setActiveFuelTemplateName('');
        localStorage.removeItem(getFuelOrderStorageKey());
        window.refreshFuelTemplateDropdowns();
        updateOrderIndicator();
        renderView();
        if (document.getElementById('fuel-reorder-dialog')?.open) {
            window.renderReorderModalItems();
        }
    } catch (e) { console.error('Reset order error:', e); }
};

window.refreshFuelTemplateDropdowns = function () {
    const templates = window.getFuelTemplates();
    const activeName = window.getActiveFuelTemplateName();
    const tplNames = Object.keys(templates);

    const dropdownIds = ['fuel-template-select', 'modal-fuel-template-select'];
    dropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        let html = '<option value="">Varsayılan Sıralama (Doğal)</option>';
        tplNames.forEach(name => {
            const isSel = (name === activeName) ? 'selected' : '';
            html += `<option value="${fuelEscape(name)}" ${isSel}>Şablon: ${fuelEscape(name)}</option>`;
        });
        el.innerHTML = html;
        el.value = activeName;
    });

    const deleteBtn = document.getElementById('btn-delete-template');
    if (deleteBtn) {
        deleteBtn.style.display = activeName ? 'inline-flex' : 'none';
    }
    const modalDeleteBtn = document.getElementById('btn-modal-delete-template');
    if (modalDeleteBtn) {
        modalDeleteBtn.style.display = activeName ? 'inline-flex' : 'none';
    }
};

function updateOrderIndicator() {
    const activeName = window.getActiveFuelTemplateName();
    const isCustom = Boolean(window.loadCustomFuelOrder());
    const badge = document.getElementById('fuel-order-badge');
    if (badge) {
        if (activeName) {
            badge.style.display = 'inline-flex';
            badge.innerHTML = `★ Şablon: <strong>${fuelEscape(activeName)}</strong> <button onclick="window.resetFuelOrder()" style="margin-left:6px;text-decoration:underline;color:#dc2626;background:none;border:0;cursor:pointer;font-weight:bold;">Sıfırla</button>`;
        } else if (isCustom) {
            badge.style.display = 'inline-flex';
            badge.innerHTML = `★ Özel Sıralama Aktif <button onclick="window.resetFuelOrder()" style="margin-left:6px;text-decoration:underline;color:#dc2626;background:none;border:0;cursor:pointer;font-weight:bold;">Sıfırla</button>`;
        } else {
            badge.style.display = 'none';
        }
    }
}

function currentOwnerGroups() {
    const baseGroups = window.FuelAnalytics.ownerGroups(isolatedAraclar, isolatedYakitlar);
    const custom = window.loadCustomFuelOrder();
    if (!custom || (!custom.ownerKeys && !custom.vehicleOrder)) {
        return baseGroups;
    }

    // 1. Sahip gruplarını özel sıralamaya göre diz
    if (Array.isArray(custom.ownerKeys) && custom.ownerKeys.length > 0) {
        const oMap = new Map(custom.ownerKeys.map((k, i) => [k, i]));
        baseGroups.sort((a, b) => {
            const idxA = oMap.has(a.key) ? oMap.get(a.key) : (oMap.has(a.owner) ? oMap.get(a.owner) : 9999);
            const idxB = oMap.has(b.key) ? oMap.get(b.key) : (oMap.has(b.owner) ? oMap.get(b.owner) : 9999);
            if (idxA !== idxB) return idxA - idxB;
            return a.owner.localeCompare(b.owner, 'tr');
        });
    }

    // 2. Her sahip grubunun içindeki araçları özel sıralamaya göre diz
    if (custom.vehicleOrder && typeof custom.vehicleOrder === 'object') {
        baseGroups.forEach(group => {
            const list = custom.vehicleOrder[group.key] || custom.vehicleOrder[group.owner];
            if (Array.isArray(list) && list.length > 0) {
                const vMap = new Map(list.map((p, i) => [String(p).replace(/\s+/g, '').toUpperCase(), i]));
                group.vehicles.sort((va, vb) => {
                    const pa = String(va.vehicle.plaka).replace(/\s+/g, '').toUpperCase();
                    const pb = String(vb.vehicle.plaka).replace(/\s+/g, '').toUpperCase();
                    const iA = vMap.has(pa) ? vMap.get(pa) : 9999;
                    const iB = vMap.has(pb) ? vMap.get(pb) : 9999;
                    if (iA !== iB) return iA - iB;
                    return String(va.vehicle.plaka).localeCompare(String(vb.vehicle.plaka), 'tr', { numeric: true });
                });
            }
        });
    }

    return baseGroups;
}

window.shiftOwnerGroup = function (groupKey, delta) {
    const groups = currentOwnerGroups();
    const idx = groups.findIndex(g => g.key === groupKey || g.owner === groupKey);
    if (idx === -1 || idx + delta < 0 || idx + delta >= groups.length) return;

    const currentCustom = window.loadCustomFuelOrder() || {};
    const ownerKeys = groups.map(g => g.key);
    const temp = ownerKeys[idx];
    ownerKeys[idx] = ownerKeys[idx + delta];
    ownerKeys[idx + delta] = temp;

    const vehicleOrder = currentCustom.vehicleOrder || {};
    groups.forEach(g => {
        if (!vehicleOrder[g.key]) {
            vehicleOrder[g.key] = g.vehicles.map(v => v.vehicle.plaka);
        }
    });

    window.saveCustomFuelOrder({ ownerKeys, vehicleOrder });
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
};

window.shiftVehicleInOwner = function (groupKey, plate, delta) {
    const groups = currentOwnerGroups();
    const group = groups.find(g => g.key === groupKey || g.owner === groupKey);
    if (!group) return;

    const vIdx = group.vehicles.findIndex(v => v.vehicle.plaka === plate);
    if (vIdx === -1 || vIdx + delta < 0 || vIdx + delta >= group.vehicles.length) return;

    const currentCustom = window.loadCustomFuelOrder() || {};
    const ownerKeys = currentCustom.ownerKeys || groups.map(g => g.key);
    const vehicleOrder = currentCustom.vehicleOrder || {};

    const plates = group.vehicles.map(v => v.vehicle.plaka);
    const temp = plates[vIdx];
    plates[vIdx] = plates[vIdx + delta];
    plates[vIdx + delta] = temp;

    vehicleOrder[group.key] = plates;
    if (group.owner !== group.key) vehicleOrder[group.owner] = plates;

    window.saveCustomFuelOrder({ ownerKeys, vehicleOrder });
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
};

window.quickSortFuel = function (type) {
    const baseGroups = window.FuelAnalytics.ownerGroups(isolatedAraclar, isolatedYakitlar);
    if (type === 'cost-desc') {
        baseGroups.sort((a, b) => (b.cost || 0) - (a.cost || 0));
        baseGroups.forEach(g => g.vehicles.sort((va, vb) => (vb.totals.cost || 0) - (va.totals.cost || 0)));
    } else if (type === 'liters-desc') {
        baseGroups.sort((a, b) => (b.liters || 0) - (a.liters || 0));
        baseGroups.forEach(g => g.vehicles.sort((va, vb) => (vb.totals.liters || 0) - (va.totals.liters || 0)));
    } else if (type === 'owner-az') {
        baseGroups.sort((a, b) => a.owner.localeCompare(b.owner, 'tr'));
        baseGroups.forEach(g => g.vehicles.sort((va, vb) => String(va.vehicle.plaka).localeCompare(String(vb.vehicle.plaka), 'tr', { numeric: true })));
    } else if (type === 'plate-az') {
        baseGroups.sort((a, b) => a.owner.localeCompare(b.owner, 'tr'));
        baseGroups.forEach(g => g.vehicles.sort((va, vb) => String(va.vehicle.plaka).localeCompare(String(vb.vehicle.plaka), 'tr', { numeric: true })));
    }

    const orderObj = {
        ownerKeys: baseGroups.map(g => g.key),
        vehicleOrder: {}
    };
    baseGroups.forEach(g => {
        orderObj.vehicleOrder[g.key] = g.vehicles.map(v => v.vehicle.plaka);
    });

    window.saveCustomFuelOrder(orderObj);
    renderView();
    if (document.getElementById('fuel-reorder-dialog')?.open) {
        window.renderReorderModalItems();
    }
};

window.openFuelReorderModal = function () {
    if (!fuelReady) return;
    if (typeof window.refreshFuelTemplateDropdowns === 'function') window.refreshFuelTemplateDropdowns();
    window.renderReorderModalItems();
    document.getElementById('fuel-reorder-dialog').showModal();
    if (window.lucide) window.lucide.createIcons();
};

window.renderReorderModalItems = function () {
    const container = document.getElementById('fuel-reorder-items');
    if (!container) return;
    const groups = currentOwnerGroups();
    if (!groups.length) {
        container.innerHTML = '<div style="text-align:center;padding:24px;color:#64748b;">Sıralanacak araç veya sahip bulunamadı.</div>';
        return;
    }

    container.innerHTML = groups.map((group, gIdx) => {
        const vehiclesHtml = group.vehicles.map((it, vIdx) => {
            const v = it.vehicle;
            return `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:10px;font-weight:700;color:#94a3b8;width:18px;">${vIdx + 1}.</span>
                        <strong style="font-size:12px;color:#0f172a;letter-spacing:0.5px;">${fuelEscape(v.plaka)}</strong>
                        <span style="font-size:10px;color:#64748b;">(${fuelEscape(v.mulkiyet_durumu || '—')} • ${fuelEscape(v.sirket || '—')})</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:11px;font-weight:700;color:#334155;">${fuelNumber(it.totals.cost)} TL</span>
                        <div style="display:flex;gap:3px;">
                            <button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',-1)" ${vIdx === 0 ? 'disabled style="opacity:0.3;"' : ''} class="secondary-button" style="min-height:24px;padding:1px 6px;font-size:10px;cursor:pointer;">▲</button>
                            <button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',1)" ${vIdx === group.vehicles.length - 1 ? 'disabled style="opacity:0.3;"' : ''} class="secondary-button" style="min-height:24px;padding:1px 6px;font-size:10px;cursor:pointer;">▼</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="background:white;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9;padding-bottom:8px;margin-bottom:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:12px;font-weight:800;color:#0f172a;background:#e2e8f0;padding:2px 7px;border-radius:4px;">#${gIdx + 1}</span>
                        <div>
                            <h4 style="margin:0;font-size:13px;font-weight:700;color:#0f172a;">${fuelEscape(group.owner)}</h4>
                            <span style="font-size:10px;color:#64748b;">${group.vehicles.length} araç • ${fuelNumber(group.liters)} L</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <strong style="font-size:13px;color:#ea580c;">${fuelNumber(group.cost)} TL</strong>
                        <div style="display:flex;gap:4px;">
                            <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',-1)" ${gIdx === 0 ? 'disabled style="opacity:0.3;"' : ''} class="secondary-button" style="min-height:26px;padding:2px 8px;font-size:11px;font-weight:bold;cursor:pointer;">▲ Yukarı</button>
                            <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',1)" ${gIdx === groups.length - 1 ? 'disabled style="opacity:0.3;"' : ''} class="secondary-button" style="min-height:26px;padding:2px 8px;font-size:11px;font-weight:bold;cursor:pointer;">▼ Aşağı</button>
                        </div>
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:5px;padding-left:14px;border-left:2px solid #e2e8f0;">
                    ${vehiclesHtml}
                </div>
            </div>
        `;
    }).join('');
};

window.saveFuelReorderAndApply = function () {
    document.getElementById('fuel-reorder-dialog')?.close();
    renderView();
    updateOrderIndicator();
};

function ownerSummaryTable(group) {
    return '<div class="table-scroll"><table class="fuel-summary-table"><thead><tr><th style="width:130px;">Plaka</th><th>Şirket</th><th>Mülkiyet</th><th class="num">Fiş</th><th class="num">Litre</th><th class="num">Tutar (TL)</th><th class="no-print" style="width:65px;text-align:center;">Sıra</th></tr></thead><tbody>'+group.vehicles.map(function(item){
        const v = item.vehicle;
        const reorderBtns = `<span class="no-print" style="display:inline-flex;gap:3px;">
            <button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',-1)" title="Aracı Yukarı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;line-height:1;">▲</button>
            <button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',1)" title="Aracı Aşağı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;line-height:1;">▼</button>
        </span>`;
        return '<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td><span class="ownership-badge">'+fuelEscape(v.mulkiyet_durumu)+'</span></td><td class="num">'+item.totals.count+'</td><td class="num">'+fuelNumber(item.totals.liters)+'</td><td class="num">'+fuelNumber(item.totals.cost)+'</td><td class="no-print" style="text-align:center;">'+reorderBtns+'</td></tr>';
    }).join('')+'<tr class="owner-subtotal"><td colspan="4">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td><td class="num">'+fuelNumber(group.cost)+'</td><td class="no-print"></td></tr></tbody></table></div>';
}
function renderSummaryView() {
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    const groups=currentOwnerGroups();
    document.getElementById('view-list').innerHTML=groups.map(group=>`
        <section class="owner-card">
            <div class="owner-heading">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="no-print" style="display:flex;gap:3px;">
                        <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',-1)" title="Sahibi Yukarı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">▲</button>
                        <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',1)" title="Sahibi Aşağı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">▼</button>
                    </div>
                    <h3>${fuelEscape(group.owner)}<small>${group.vehicles.length} araç</small></h3>
                </div>
                <span>${fuelNumber(group.cost)} TL</span>
            </div>
            ${ownerSummaryTable(group)}
        </section>
    `).join('') || '<div class="empty-report">Bu filtrelerde araç bulunamadı.</div>';
    updateOrderIndicator();
}
function renderVehicleView() {
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    document.getElementById('view-list').innerHTML=currentOwnerGroups().map(group=>`
        <section class="owner-card">
            <div class="owner-heading">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div class="no-print" style="display:flex;gap:3px;">
                        <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',-1)" title="Sahibi Yukarı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">▲</button>
                        <button type="button" onclick="window.shiftOwnerGroup('${fuelEscape(group.key)}',1)" title="Sahibi Aşağı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer;font-weight:bold;">▼</button>
                    </div>
                    <h3>${fuelEscape(group.owner)}<small>${group.vehicles.length} araç</small></h3>
                </div>
                <span>${fuelNumber(group.cost)} TL</span>
            </div>
            <div class="table-scroll">${ownerPrintTable(group,true,false)}</div>
        </section>
    `).join('') || '<div class="empty-report">Bu filtrelerde araç bulunamadı.</div>';
    updateOrderIndicator();
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

function ownerPrintTable(group, detail, isForPrint = false) {
    const columns=detail?(isForPrint?6:7):(isForPrint?5:6);
    const orderHeader=isForPrint?'':'<th class="no-print" style="width:65px;text-align:center;">Sıra</th>';
    const head=detail?('<th>Plaka</th><th>Tarih</th><th>Şirket</th><th class="num">Litre</th><th class="num">Birim (TL)</th><th class="num">Tutar (TL)</th>'+orderHeader):('<th>Plaka</th><th>Şirket</th><th class="num">Fiş</th><th class="num">Litre</th><th class="num">Tutar (TL)</th>'+orderHeader);
    let rows='';
    group.vehicles.forEach(item=>{
        const v=item.vehicle;
        const reorderBtns = isForPrint ? '' : `<td class="no-print" style="text-align:center;"><span style="display:inline-flex;gap:3px;"><button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',-1)" title="Aracı Yukarı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;line-height:1;">▲</button><button type="button" onclick="window.shiftVehicleInOwner('${fuelEscape(group.key)}','${fuelEscape(v.plaka)}',1)" title="Aracı Aşağı Taşı" style="border:1px solid #cbd5e1;background:#fff;border-radius:4px;padding:1px 5px;font-size:10px;cursor:pointer;line-height:1;">▼</button></span></td>`;
        if(detail && item.records.length) {
            item.records.forEach((row, rIdx)=>{
                rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelDate(row.tarih)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td class="num">'+fuelNumber(row.litre)+'</td><td class="num">'+fuelNumber(row.birim_fiyat)+'</td><td class="num">'+fuelNumber(row.toplam_tutar)+'</td>'+(rIdx===0 ? reorderBtns : (isForPrint?'':'<td class="no-print"></td>'))+'</tr>';
            });
        } else if(detail) {
            rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td colspan="2">Yakıt kaydı yok</td><td class="num">0,00</td><td class="num">—</td><td class="num">0,00</td>'+reorderBtns+'</tr>';
        } else {
            rows+='<tr><td>'+fuelEscape(v.plaka)+'</td><td>'+fuelEscape(v.sirket || '—')+'</td><td class="num">'+item.totals.count+'</td><td class="num">'+fuelNumber(item.totals.liters)+'</td><td class="num">'+fuelNumber(item.totals.cost)+'</td>'+reorderBtns+'</tr>';
        }
    });
    const subtotal=detail?'<td colspan="3">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td><td></td>':'<td colspan="3">Sahip toplamı</td><td class="num">'+fuelNumber(group.liters)+'</td>';
    return '<table class="owner-print-table"><thead><tr class="owner-title"><th colspan="'+columns+'">'+fuelEscape(group.owner)+'<small>'+group.vehicles.length+' araç</small></th></tr><tr class="column-titles">'+head+'</tr></thead><tbody>'+rows+'<tr class="owner-subtotal">'+subtotal+'<td class="num">'+fuelNumber(group.cost)+'</td>'+(isForPrint?'':'<td class="no-print"></td>')+'</tr></tbody></table>';
}
function fuelPrintPeriodLabel() {
    const start = document.getElementById('fuel-start').value;
    const end = document.getElementById('fuel-end').value;
    const format = value => new Intl.DateTimeFormat('tr-TR', {month:'long', year:'numeric', timeZone:'Europe/Istanbul'}).format(new Date(value + 'T12:00:00Z'));
    return start.slice(0,7) === end.slice(0,7) ? format(start) : format(start) + ' – ' + format(end);
}
function buildFuelPrintDocument() {
    const fueledIds = new Set(isolatedYakitlar.map(row => String(row.arac_id)));
    // Özel sıralanmış sahip ve araç listesini al
    const allGroups = currentOwnerGroups();
    const printGroups = allGroups.map(group => {
        const filteredVehicles = group.vehicles.filter(item => fueledIds.has(String(item.vehicle.id)));
        if (!filteredVehicles.length) return null;
        const groupLiters = filteredVehicles.reduce((s, it) => s + (it.totals.liters || 0), 0);
        const groupCost = filteredVehicles.reduce((s, it) => s + (it.totals.cost || 0), 0);
        return {
            ...group,
            vehicles: filteredVehicles,
            liters: groupLiters,
            cost: groupCost
        };
    }).filter(Boolean);

    const printVehicleCount = printGroups.reduce((s, g) => s + g.vehicles.length, 0);
    if (!printGroups.length) return '<p class="empty-report">Seçili dönemde yazdırılacak yakıt kaydı bulunmuyor.</p>';
    
    const summary=window.FuelAnalytics.summarizeFuelRows(isolatedYakitlar);
    const detail=document.getElementById('fuel-print-format').value==='detail';
    const activeTplName = typeof window.getActiveFuelTemplateName === 'function' ? window.getActiveFuelTemplateName() : '';
    const tplSuffix = activeTplName ? ' · Sıralama: Şablon (' + fuelEscape(activeTplName) + ')' : (window.loadCustomFuelOrder() ? ' · Özel Sıralama' : '');
    return '<article class="fuel-document"><header class="document-header"><div><p class="document-period">Dönem: '+fuelEscape(fuelPrintPeriodLabel())+tplSuffix+'</p><p>'+fuelEscape(document.getElementById('header-subtitle').textContent)+'</p></div><div class="document-brand">İDEOL</div></header><div class="document-totals"><span>Araç sayısı<strong>'+printVehicleCount+'</strong></span><span>Yakıt fişi<strong>'+summary.count+'</strong></span><span>Toplam litre<strong>'+fuelNumber(summary.liters)+'</strong></span><span>Toplam tutar<strong>'+fuelNumber(summary.cost)+' TL</strong></span></div>'+printGroups.map(group=>ownerPrintTable(group,detail,true)).join('')+'<div class="document-grand-total">Genel toplam: '+fuelNumber(summary.cost)+' TL</div><footer class="document-footer"><span>Düzenleme tarihi: '+new Date().toLocaleDateString('tr-TR')+' · Tutarlar Türk lirasıdır.</span><small>Baris.Flow</small></footer></article>';
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
