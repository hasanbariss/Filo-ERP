/* VERSION: 1.0.4 - Resilient Rendering */
const urlParams = new URLSearchParams(window.location.search);
const monthStr = urlParams.get('ay') || new Date().toISOString().substring(0, 7); // 'YYYY-MM'

let isolatedAraclar = [];
let isolatedYakitlar = [];
window.currentView = 'grid';
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

        await fetchData();
        renderView();
    } catch (e) {
        console.error("Init Hatası:", e);
    }
}

async function fetchData() {
    try {
        const [year, mStr] = monthStr.split('-');
        const ay = parseInt(mStr, 10);
        const daysInMonth = new Date(year, ay, 0).getDate();
        const startDate = `${year}-${String(ay).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(ay).padStart(2, '0')}-${daysInMonth}`;

        const mulkiyetChecks = document.querySelectorAll('#dropdown-mulkiyet input[type="checkbox"]:checked');
        const sirketChecks = document.querySelectorAll('#dropdown-sirket input[type="checkbox"]:checked');
        
        const mulkiyetValues = Array.from(mulkiyetChecks).map(c => c.value);
        const sirketValues = Array.from(sirketChecks).map(c => c.value);

        // Update labels
        const labelMulkiyet = document.getElementById('label-mulkiyet');
        const labelSirket = document.getElementById('label-sirket');
        
        if (labelMulkiyet) labelMulkiyet.textContent = mulkiyetValues.length === 0 ? 'Mülkiyet' : (mulkiyetValues.length === 2 ? 'Mülkiyet' : mulkiyetValues[0]);
        if (labelSirket) labelSirket.textContent = sirketValues.length === 0 ? 'Şirket' : (sirketValues.length > 1 ? `Şirket (${sirketValues.length})` : sirketValues[0]);

        let aracQuery = window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu, sirket, sofor_id, firma_adi');
        
        // Only apply filter if something is selected. If nothing is selected, show all (more resilient).
        if (mulkiyetValues.length > 0) {
            aracQuery = aracQuery.in('mulkiyet_durumu', mulkiyetValues);
        }

        if (sirketValues.length > 0) {
            aracQuery = aracQuery.in('sirket', sirketValues);
        }
        
        const { data: araclar, error: aracErr } = await aracQuery.order('plaka');
        
        if (aracErr) throw aracErr;
        
        // Fetch driver names for mapping
        const { data: drivers } = await window.supabaseClient.from('soforler').select('id, ad_soyad');
        const driverMap = {};
        if (drivers) drivers.forEach(d => driverMap[d.id] = d.ad_soyad);
        isolatedAraclar = (araclar || []).map(a => ({
            ...a,
            display_name: a.mulkiyet_durumu === 'TAŞERON' ? (a.firma_adi || 'Bilinmiyor') : (driverMap[a.sofor_id] || 'Atanmamış')
        }));

        if (isolatedAraclar.length > 0) {
            const { data: yakitlar, error: yakitErr } = await window.supabaseClient
                .from('yakit_takip')
                .select('*')
                .gte('tarih', startDate)
                .lte('tarih', endDate)
                .in('arac_id', isolatedAraclar.map(a => a.id));

            if (yakitErr) throw yakitErr;
            isolatedYakitlar = yakitlar || [];
        } else {
            isolatedYakitlar = [];
        }

        const totalTutar = isolatedYakitlar.reduce((sum, y) => sum + (parseFloat(y.toplam_tutar) || 0), 0);
        const sumEl = document.getElementById('total-summary-tutar');
        if (sumEl) {
            sumEl.textContent = `₺${totalTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
            sumEl.title = `Araç: ${isolatedAraclar.length}, Kayıt: ${isolatedYakitlar.length}`;
        }
        
        console.log(`Fetch: ${isolatedAraclar.length} araç, ${isolatedYakitlar.length} yakıt kaydı.`);

    } catch (e) {
        console.error("Fetch Data Error:", e);
    }
}

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

window.filterSearch = function() {
    window.searchQuery = document.getElementById('search-plaka').value;
    renderView();
};

function renderGridView(araclar = isolatedAraclar) {
    const thead = document.getElementById('yakit-thead');
    const tbody = document.getElementById('yakit-tbody');
    document.getElementById('view-grid').classList.remove('hidden');
    document.getElementById('view-list').classList.add('hidden');
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    if (araclar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="35" class="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Seçili kriterlerde araç bulunamadı.</td></tr>`;
        return;
    }
    let thHtml = `<tr><th class="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-white z-20 border-b border-r border-slate-100" style="width: 110px;">ARAÇ</th>`;
    for (let i = 1; i <= daysInMonth; i++) thHtml += `<th class="p-0 py-3 text-center text-[10px] font-bold text-slate-400 border-r border-b border-slate-50" style="width: 45px;">${i}</th>`;
    thHtml += `<th class="px-0 py-3 text-center text-[10px] font-black text-slate-500 border-r border-b border-slate-100 uppercase tracking-widest sticky right-[75px] bg-slate-50 z-20" style="width: 75px;">LİTRE</th>`;
    thHtml += `<th class="px-0 py-3 text-center text-[10px] font-black text-slate-500 border-b border-slate-100 uppercase tracking-widest sticky right-0 bg-slate-50 z-20" style="width: 85px;">TUTAR</th></tr>`;
    thead.innerHTML = thHtml;
    let tblHtml = '';
    araclar.forEach(arac => {
        const plateDisplay = `${arac.plaka} <br> <span class="text-[8px] text-slate-400 font-medium">${arac.display_name}</span>`;
        tblHtml += `<tr class="hover:bg-slate-50 transition-colors"><td class="px-4 py-2 text-[11px] font-black text-slate-900 sticky left-0 bg-white z-10 border-r border-b border-slate-50 uppercase text-center">${plateDisplay}</td>`;
        let rowLitreTotal = 0; let rowTutarTotal = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
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

function renderListView(araclar = isolatedAraclar) {
    const listContainer = document.getElementById('view-list');
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    
    // Filter yakitlar by the current filtered set of araclar
    const validAracIds = new Set(araclar.map(a => String(a.id)));
    const filteredYakitlar = isolatedYakitlar.filter(y => validAracIds.has(String(y.arac_id)));

    if (filteredYakitlar.length === 0) { 
        listContainer.innerHTML = `<div class="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Bu dönemde yakıt verisi bulunamadı (Araç: ${araclar.length})</div>`; 
        return; 
    }
    const grouped = {};
    filteredYakitlar.forEach(y => {
        if (!grouped[y.tarih]) grouped[y.tarih] = { items: [], totalLitre: 0, totalTutar: 0 };
        grouped[y.tarih].items.push(y); grouped[y.tarih].totalLitre += (parseFloat(y.litre) || 0); grouped[y.tarih].totalTutar += (parseFloat(y.toplam_tutar) || 0);
    });
    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
    let html = '';
    sortedDates.forEach(date => {
        const data = grouped[date]; const dateObj = new Date(date);
        const dateFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(dateObj);
        html += `<div class="bg-white rounded-3xl border border-slate-100 mb-10 print-avoid-break overflow-hidden"><div class="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center"><h4 class="text-sm font-black text-slate-900 uppercase tracking-tight">${dateFormatted}</h4><div class="flex gap-6"><div class="text-right"><p class="text-[8px] font-black text-slate-400">GÜN LİTRE</p><p class="text-xs font-black text-slate-900">${data.totalLitre.toLocaleString('tr-TR')} L</p></div><div class="text-right"><p class="text-[8px] font-black text-slate-400">GÜN TUTAR</p><p class="text-xs font-black text-orange-600">₺${data.totalTutar.toLocaleString('tr-TR')}</p></div></div></div><div class="px-8 pb-4"><table class="w-full text-left text-xs border-collapse"><thead><tr class="text-slate-400 font-bold uppercase text-[9px]"><th class="py-3 border-b border-slate-50">ARAÇ PLAKA</th><th class="py-3 border-b border-slate-50 text-center">MİKTAR</th><th class="py-3 border-b border-slate-50 text-center">BİRİM</th><th class="py-3 border-b border-slate-50 text-right">TOPLAM</th></tr></thead><tbody class="divide-y divide-slate-50">`;
        data.items.forEach(item => {
            const arac = isolatedAraclar.find(a => a.id === item.arac_id);
            const plateDisplay = arac ? `${arac.plaka} <span class="text-[10px] text-slate-400 font-bold ml-2">• ${arac.display_name}</span>` : '---';
            html += `<tr class="hover:bg-slate-50/50 transition-colors"><td class="py-3 font-black text-slate-900 uppercase">${plateDisplay}</td><td class="py-3 text-center text-slate-600 font-bold">${(parseFloat(item.litre) || 0).toLocaleString('tr-TR')} L</td><td class="py-3 text-center text-slate-400">₺${(parseFloat(item.birim_fiyat) || 0).toLocaleString('tr-TR')}</td><td class="py-3 text-right font-black text-slate-900">₺${(parseFloat(item.toplam_tutar) || 0).toLocaleString('tr-TR')}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
    });
    listContainer.innerHTML = html;
}

function renderVehicleView(araclar = isolatedAraclar) {
    const listContainer = document.getElementById('view-list');
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    
    // Filter yakitlar by the current filtered set of araclar
    const validAracIds = new Set(araclar.map(a => String(a.id)));
    const filteredYakitlar = isolatedYakitlar.filter(y => validAracIds.has(String(y.arac_id)));

    if (filteredYakitlar.length === 0) { 
        listContainer.innerHTML = `<div class="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Bu dönemde yakıt verisi bulunamadı (Araç: ${araclar.length})</div>`; 
        return; 
    }
    const grouped = {};
    filteredYakitlar.forEach(y => {
        if (!grouped[y.arac_id]) grouped[y.arac_id] = { items: [], totalLitre: 0, totalTutar: 0 };
        grouped[y.arac_id].items.push(y); grouped[y.arac_id].totalLitre += (parseFloat(y.litre) || 0); grouped[y.arac_id].totalTutar += (parseFloat(y.toplam_tutar) || 0);
    });
    const sortedAracIds = Object.keys(grouped).sort((a, b) => {
        const plakaA = isolatedAraclar.find(ar => ar.id == a)?.plaka || ''; const plakaB = isolatedAraclar.find(ar => ar.id == b)?.plaka || '';
        return plakaA.localeCompare(plakaB);
    });
    let html = '';
    sortedAracIds.forEach(aracId => {
        const data = grouped[aracId]; const arac = isolatedAraclar.find(a => a.id == aracId); 
        const plaka = arac ? arac.plaka : '---';
        const displayName = arac ? arac.display_name : '';
        html += `<div class="bg-white rounded-3xl border border-slate-100 mb-10 print-avoid-break overflow-hidden"><div class="px-8 py-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center"><h4 class="text-sm font-black text-slate-900 uppercase tracking-tight">${plaka} <span class="text-xs text-slate-400 font-bold ml-2">• ${displayName}</span></h4><div class="flex gap-6"><div class="text-right"><p class="text-[8px] font-black text-slate-400">ARAÇ LİTRE</p><p class="text-xs font-black text-slate-900">${data.totalLitre.toLocaleString('tr-TR')} L</p></div><div class="text-right"><p class="text-[8px] font-black text-slate-400">ARAÇ TUTAR</p><p class="text-xs font-black text-orange-600">₺${data.totalTutar.toLocaleString('tr-TR')}</p></div></div></div><div class="px-8 pb-4"><table class="w-full text-left text-xs border-collapse"><thead><tr class="text-slate-400 font-bold uppercase text-[9px]"><th class="py-3 border-b border-slate-50">TARİH</th><th class="py-3 border-b border-slate-50 text-center">MİKTAR</th><th class="py-3 border-b border-slate-50 text-center">BİRİM</th><th class="py-3 border-b border-slate-50 text-right">TOPLAM</th></tr></thead><tbody class="divide-y divide-slate-50">`;
        data.items.sort((a,b) => new Date(a.tarih) - new Date(b.tarih)).forEach(item => {
            const dateObj = new Date(item.tarih); const dateFormatted = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }).format(dateObj);
            html += `<tr class="hover:bg-slate-50/50 transition-colors"><td class="py-3 font-bold text-slate-700 uppercase">${dateFormatted}</td><td class="py-3 text-center text-slate-600 font-bold">${(parseFloat(item.litre) || 0).toLocaleString('tr-TR')} L</td><td class="py-3 text-center text-slate-400">₺${(parseFloat(item.birim_fiyat) || 0).toLocaleString('tr-TR')}</td><td class="py-3 text-right font-black text-slate-900">₺${(parseFloat(item.toplam_tutar) || 0).toLocaleString('tr-TR')}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
    });
    listContainer.innerHTML = html;
}

function renderSummaryView(araclar = isolatedAraclar) {
    const listContainer = document.getElementById('view-list');
    document.getElementById('view-grid').classList.add('hidden');
    document.getElementById('view-list').classList.remove('hidden');
    
    // Filter yakitlar by the current filtered set of araclar
    const validAracIds = new Set(araclar.map(a => String(a.id)));
    const filteredYakitlar = isolatedYakitlar.filter(y => validAracIds.has(String(y.arac_id)));

    if (filteredYakitlar.length === 0 && araclar.length === 0) { 
        listContainer.innerHTML = `<div class="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-xs">Seçili kriterlerde araç bulunamadı.</div>`; 
        return; 
    }

    const grouped = {};
    filteredYakitlar.forEach(y => {
        if (!grouped[y.arac_id]) grouped[y.arac_id] = { totalLitre: 0, totalTutar: 0 };
        grouped[y.arac_id].totalLitre += (parseFloat(y.litre) || 0); 
        grouped[y.arac_id].totalTutar += (parseFloat(y.toplam_tutar) || 0);
    });

    const sortedAraclar = [...araclar].sort((a, b) => (a.plaka || '').localeCompare(b.plaka || ''));
    
    const totalLitreAll = Object.values(grouped).reduce((acc, curr) => acc + curr.totalLitre, 0);
    const totalTutarAll = Object.values(grouped).reduce((acc, curr) => acc + curr.totalTutar, 0);

    let html = `
        <div class="max-w-5xl mx-auto space-y-8 pb-12">
            <!-- Premium Totals Section -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <i data-lucide="fuel" class="w-6 h-6 text-blue-600 group-hover:text-white"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPLAM TÜKETİM</p>
                            <p class="text-2xl font-black text-slate-900">${totalLitreAll.toLocaleString('tr-TR', {maximumFractionDigits:1})} <span class="text-sm font-medium text-slate-400 uppercase">LT</span></p>
                        </div>
                    </div>
                    <div class="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500 rounded-full" style="width: 100%"></div>
                    </div>
                </div>

                <div class="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <i data-lucide="coins" class="w-6 h-6 text-orange-600 group-hover:text-white"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPLAM TUTAR</p>
                            <p class="text-2xl font-black text-orange-600">₺${totalTutarAll.toLocaleString('tr-TR', {minimumFractionDigits:2})}</p>
                        </div>
                    </div>
                    <div class="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-500 rounded-full" style="width: 100%"></div>
                    </div>
                </div>

                <div class="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div class="flex items-center gap-4 mb-4">
                        <div class="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <i data-lucide="truck" class="w-6 h-6 text-emerald-600 group-hover:text-white"></i>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">FİLO GENELİ</p>
                            <p class="text-2xl font-black text-slate-900">${sortedAraclar.length} <span class="text-sm font-medium text-slate-400 uppercase">ARAÇ</span></p>
                        </div>
                    </div>
                    <div class="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500 rounded-full" style="width: 100%"></div>
                    </div>
                </div>
            </div>

            <!-- Enhanced List Section -->
            <div class="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                <div class="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                            <i data-lucide="clipboard-list" class="w-5 h-5 text-slate-400"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-black text-slate-900 uppercase tracking-tight">ARAÇ BAZLI ÖZET RAPOR</h4>
                            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Dönem içi tüm yakıt hareketleri</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="px-4 py-2 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 uppercase shadow-sm flex items-center gap-2">
                             <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                             ${new Date().toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                <div class="p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-x-8 gap-y-2">
                        <!-- Table Header (Hidden on Mobile) -->
                        <div class="hidden md:flex items-center px-6 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                            <span class="flex-1">PLAKA / ARAÇ</span>
                            <span class="w-24 text-center">LİTRE</span>
                            <span class="w-32 text-right">TOPLAM TUTAR</span>
                        </div>
                        <div class="hidden lg:flex items-center px-6 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                            <span class="flex-1">PLAKA / ARAÇ</span>
                            <span class="w-24 text-center">LİTRE</span>
                            <span class="w-32 text-right">TOPLAM TUTAR</span>
                        </div>

                        ${sortedAraclar.map(arac => {
                            const data = grouped[arac.id] || { totalLitre: 0, totalTutar: 0 };
                            return `
                                <div class="group flex items-center px-6 py-4 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                                    <div class="flex-1 min-w-0">
                                        <p class="text-xs font-black text-slate-900 uppercase truncate">${arac.plaka || '---'}</p>
                                        <p class="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">${arac.display_name || 'BİLİNMİYOR'}</p>
                                    </div>
                                    <div class="w-24 text-center">
                                        <p class="text-xs font-bold text-slate-600">${data.totalLitre.toLocaleString('tr-TR', {maximumFractionDigits:1})} <span class="text-[9px] font-medium opacity-50">L</span></p>
                                    </div>
                                    <div class="w-32 text-right">
                                        <p class="text-xs font-black text-orange-600">₺${data.totalTutar.toLocaleString('tr-TR', {minimumFractionDigits:2})}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>`;
    
    listContainer.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

window.switchView = function(view) {
    window.currentView = view;
    const btns = { grid: document.getElementById('btn-view-grid'), list: document.getElementById('btn-view-list'), vehicle: document.getElementById('btn-view-vehicle'), summary: document.getElementById('btn-view-summary') };
    const activeClass = "view-btn-active px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all shadow-lg";
    const inactiveClass = "view-btn-inactive px-4 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all hover:bg-slate-50";
    Object.values(btns).forEach(b => { if(b) b.className = inactiveClass; });
    if(btns[view]) btns[view].className = activeClass;
    renderView();
}

window.filterYakit = function() { fetchData().then(() => renderView()); }
window.changeDonem = function() {
    const newDonem = document.getElementById('filter-donem').value;
    if (newDonem) { urlParams.set('ay', newDonem); window.location.search = urlParams.toString(); }
}

window.onbeforeprint = () => {
    document.querySelectorAll('.glass-header, main').forEach(el => {
        el.setAttribute('data-prev-display', el.style.display);
        el.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('print-section').style.setProperty('display', 'block', 'important');
};
window.onafterprint = () => {
    document.querySelectorAll('.glass-header, main').forEach(el => {
        const prev = el.getAttribute('data-prev-display');
        el.style.display = prev === 'none' ? 'none' : prev;
    });
    document.getElementById('print-section').style.display = 'none';
};

window.toggleDropdown = function(id) {
    const dropdown = document.querySelector(`#dropdown-${id} .dropdown-menu`);
    const allDropdowns = document.querySelectorAll('.dropdown-menu');
    allDropdowns.forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
    dropdown.classList.toggle('hidden');
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
        document.querySelectorAll('.dropdown-menu').forEach(d => d.classList.add('hidden'));
    }
});

window.handlePrint = function() {
    const title = document.getElementById('header-title').textContent;
    const subtitle = document.getElementById('header-subtitle').textContent;
    const totalLitre = isolatedYakitlar.reduce((sum, y) => sum + (parseFloat(y.litre) || 0), 0);
    const totalTutar = isolatedYakitlar.reduce((sum, y) => sum + (parseFloat(y.toplam_tutar) || 0), 0);
    const vehicleCount = new Set(isolatedYakitlar.map(y => y.arac_id)).size;

    let contentHtml = '';
    const view = window.currentView || 'list';
    
    if (view === 'summary') {
        const grouped = {};
        isolatedYakitlar.forEach(y => { 
            if (!grouped[y.arac_id]) grouped[y.arac_id] = { totalLitre: 0, totalTutar: 0 }; 
            grouped[y.arac_id].totalLitre += (parseFloat(y.litre) || 0); 
            grouped[y.arac_id].totalTutar += (parseFloat(y.toplam_tutar) || 0); 
        });
        const sortedAracIds = Object.keys(grouped).sort((a,b) => (isolatedAraclar.find(ar => ar.id == a)?.plaka || '').localeCompare(isolatedAraclar.find(ar => ar.id == b)?.plaka || ''));

        let tableRows = '';
        sortedAracIds.forEach(aracId => {
            const data = grouped[aracId]; 
            const arac = isolatedAraclar.find(a => a.id == aracId);
            const label = arac ? `${arac.plaka} <br> <small style="font-size:7px; opacity:0.7">${arac.display_name}</small>` : '---';
            tableRows += `
                <div class="print-summary-row">
                    <span class="p-plaka">${label}</span>
                    <span class="p-litre">${data.totalLitre.toLocaleString('tr-TR', {maximumFractionDigits:1})}L</span>
                    <span class="p-tutar">₺${Math.round(data.totalTutar).toLocaleString('tr-TR')}</span>
                </div>`;
        });

        contentHtml = `
            <div class="print-summary-grid">
                <div class="print-summary-header">
                    <span>ARAÇ PLAKA</span><span>LİTRE</span><span>TUTAR</span>
                    <span class="p-divider"></span>
                    <span>ARAÇ PLAKA</span><span>LİTRE</span><span>TUTAR</span>
                </div>
                <div class="print-summary-body">
                    ${tableRows}
                </div>
            </div>`;
    } else {
        contentHtml = `<div class="print-list-container">${document.getElementById('view-list').innerHTML}</div>`;
    }

    let html = `
        <div style="padding: 10px; font-family: 'Inter', sans-serif;">
            <style>
                @page { size: portrait; margin: 5mm; }
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
                
                .print-list-container > div { margin-bottom: 20px !important; page-break-inside: avoid; break-inside: avoid; border-bottom: 2px solid #000 !important; padding-bottom: 10px !important; }
                .print-list-container h4 { background: #eee !important; padding: 5px !important; margin: 0 0 10px 0 !important; font-size: 14px !important; }
                .print-list-container table { width: 100% !important; border-collapse: collapse !important; }
                .print-list-container td, .print-list-container th { padding: 5px !important; font-size: 11px !important; border-bottom: 1px solid #ddd !important; }
                
                .print-summary-grid { width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; page-break-inside: auto; }
                .print-summary-header { 
                    display: grid; 
                    grid-template-columns: 1fr 50px 70px 1px 1fr 50px 70px;
                    background: #f1f5f9 !important; color: #475569 !important;
                    padding: 8px 12px; font-size: 9px; font-weight: 900;
                    text-align: center;
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky; top: 0;
                }
                .print-summary-header span:first-child, .print-summary-header span:nth-child(5) { text-align: left; }
                .print-summary-body { display: grid; grid-template-columns: 1fr 1fr; column-gap: 0px; }
                .print-summary-row { display: grid; grid-template-columns: 1fr 50px 70px; padding: 6px 12px; font-size: 10.5px; border-bottom: 0.5px solid #f1f5f9; align-items: center; page-break-inside: avoid; }
                .p-plaka { font-weight: 900; text-transform: uppercase; color: #0f172a; }
                .p-litre { text-align: center; font-weight: 700; color: #64748b; }
                .p-tutar { text-align: right; font-weight: 950; color: #000; }
                .p-divider { background: #cbd5e1; width: 1px; height: 100%; grid-row: span 1000; }

                .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 10px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 16px; background: #f8fafc !important; }
                .summary-item label { display: block; font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.05em; }
                .summary-item span { font-size: 18px; font-weight: 950; color: #0f172a; }
                
                .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 100px; page-break-inside: avoid; }
                .sig-box { border-top: 1.5px solid #0f172a; padding-top: 10px; text-align: center; font-size: 12px; font-weight: 900; color: #0f172a; text-transform: uppercase; }
            </style>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 2px solid #0f172a; padding-bottom: 8px;">
                <div>
                    <h1 style="margin: 0; font-size: 20px; font-weight: 950; text-transform: uppercase; color: #0f172a;">${title}</h1>
                    <p style="margin: 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">DONEM: ${subtitle}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 18px; font-weight: 950; color: #0f172a; letter-spacing: -0.02em;">IDEOL TURİZM</div>
                    <div style="font-size: 9px; font-weight: 800; color: #94a3b8;">FİLO YÖNETİM SİSTEMİ</div>
                </div>
            </div>

            <div class="summary-box">
                <div class="summary-item"><label>TOPLAM MİKTAR</label><span>${totalLitre.toLocaleString('tr-TR', {maximumFractionDigits:1})} LT</span></div>
                <div class="summary-item"><label>TOPLAM TUTAR</label><span style="color: #ea580c;">₺${totalTutar.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span></div>
                <div class="summary-item"><label>ARAÇ SAYISI</label><span>${vehicleCount} ARAÇ</span></div>
            </div>

            ${contentHtml}

            <div class="signature-area">
                <div class="sig-box">HAZIRLAYAN</div>
                <div class="sig-box">ONAYLAYAN</div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; font-size: 8px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">
                Rapor Tarihi: ${new Date().toLocaleString('tr-TR')} • Belge No: ERP-YKT-${Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
        </div>
    `;
    const printSec = document.getElementById('print-section');
    printSec.innerHTML = html;
    window.print();
}

document.addEventListener('DOMContentLoaded', initYakitRaporu);
