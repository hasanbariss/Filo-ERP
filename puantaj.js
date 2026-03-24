const urlParams = new URLSearchParams(window.location.search);
const musteriId = urlParams.get('musteri_id');
const monthStr = urlParams.get('ay'); // 'YYYY-MM'

let isolatedGridData = [];
let isolatedAraclar = [];
let isolatedKayitlar = [];

async function initPuantaj() {
    try {
        if (!window.supabaseClient) throw new Error("SupabaseClient tanımsız! config.js yüklenemedi.");
        if (!musteriId || !monthStr) {
            const hTitle = document.getElementById('header-title');
            const hSub = document.getElementById('header-subtitle');
            if (hTitle) hTitle.textContent = "Hata: Eksik Parametre";
            if (hSub) hSub.textContent = "Lütfen pencereyi kapatıp tekrar açın.";
            return;
        }

        const [year, mStr] = monthStr.split('-');
        const ay = parseInt(mStr, 10);
        const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

        const { data: musteriData } = await window.supabaseClient.from('musteriler').select('ad').eq('id', musteriId).single();
        const musteriAdi = musteriData ? musteriData.ad : 'Bilinmeyen Müşteri';

        document.getElementById('header-title').textContent = `${musteriAdi} - Servis Puantajı`;
        document.getElementById('header-subtitle').textContent = `${months[ay - 1]} ${year} Dönemi`;

        if (document.getElementById('filter-donem')) {
            document.getElementById('filter-donem').value = monthStr;
        }

        await loadGridData();
        
        if (typeof window.filterPuantaj === 'function') {
            window.filterPuantaj();
        }
    } catch (e) {
        alert("Init Hatası: " + e.message + "\nStack: " + e.stack);
        const hTitle = document.getElementById('header-title');
        const hSub = document.getElementById('header-subtitle');
        if (hTitle) hTitle.textContent = "KRİTİK HATA";
        if (hSub) hSub.textContent = e.message;
    }
}

async function loadGridData() {
    const thead = document.getElementById('excel-thead');
    const tbody = document.getElementById('excel-tbody');

    try {
        const [year, mStr] = monthStr.split('-');
        const ay = parseInt(mStr, 10);
        const daysInMonth = new Date(year, ay, 0).getDate();
        const startDate = `${year}-${String(ay).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(ay).padStart(2, '0')}-${daysInMonth}`;

        // Get tools matching customer ID
        const { data: tanimlar, error: tanimErr } = await window.supabaseClient
            .from('musteri_arac_tanimlari')
            .select('*, araclar(id, plaka, mulkiyet_durumu)')
            .eq('musteri_id', musteriId);

        if (tanimErr) throw tanimErr;

        if (!tanimlar || tanimlar.length === 0) {
            tbody.innerHTML = '<tr><td colspan="33" class="p-8 text-center text-slate-500 font-medium">Bu müşteriye tanımlı araç bulunamadı.</td></tr>';
            return;
        }

        const seenIds = new Set();
        isolatedAraclar = [];
        for (const t of tanimlar) {
            if (t.araclar && t.araclar.id && !seenIds.has(t.araclar.id)) {
                seenIds.add(t.araclar.id);
                isolatedAraclar.push({
                    id: t.araclar.id,
                    plaka: t.araclar.plaka,
                    mulkiyet: t.araclar.mulkiyet_durumu
                });
            }
        }

        const filterSelect = document.getElementById('filter-arac');
        if (filterSelect) {
            let opts = '<option value="ALL">Tüm Araçlar</option>';
            isolatedAraclar.forEach(a => {
                opts += `<option value="${a.id}">${a.plaka}</option>`;
            });
            filterSelect.innerHTML = opts;
        }

        // Get puantaj records
        const { data: qKayitlar, error: kayitErr } = await window.supabaseClient
            .from('musteri_servis_puantaj')
            .select('*')
            .eq('musteri_id', musteriId)
            .gte('tarih', startDate)
            .lte('tarih', endDate);

        if (kayitErr) throw kayitErr;
        isolatedKayitlar = qKayitlar || [];

        // Build THEAD
        let thHtml = `<tr>
            <th class="px-3 py-2.5 text-left text-[11px] font-extrabold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-100 z-20 border-b border-r border-slate-300 shadow-[1px_0_0_0_#cbd5e1]" style="width: 90px; min-width: 90px; max-width: 90px;">ARAÇ</th>
            <th class="px-2 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-[90px] bg-slate-50 z-20 border-b border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]" style="left: 90px; width: 55px; min-width: 55px; max-width: 55px;">TÜR</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            thHtml += `<th class="p-0 py-2.5 text-center text-[11px] font-semibold text-slate-600 border-r border-b border-slate-200" style="width: 38px; min-width: 38px; max-width: 38px;">${i}</th>`;
        }
        thHtml += `<th class="px-0 py-2.5 text-center text-[10px] font-bold text-slate-600 border-r border-b border-slate-200 uppercase tracking-wider sticky right-0 bg-slate-50 z-20 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;">TOP</th></tr>`;
        thead.innerHTML = thHtml;

        let tblHtml = '';
        isolatedGridData = [];

        // Build TBODY
        isolatedAraclar.forEach((arac, index) => {
            const bgPlaka = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

            const relatedRecords = isolatedKayitlar.filter(k => k.arac_id === arac.id);
            const aracVeriVar = relatedRecords.some(r => Boolean(r.vardiya) || Boolean(r.tek));
            const dataStr = aracVeriVar ? 'true' : 'false';

            // --- VARDİYA ---
            tblHtml += `<tr class="hover:bg-blue-50/40 transition-colors" data-arac-id="${arac.id}" data-has-data="${dataStr}">`;
            
            // First Column - Plate (Spans 2 rows)
            tblHtml += `<td class="p-2 text-[11px] font-bold text-slate-800 sticky left-0 ${bgPlaka} z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] uppercase text-center align-middle" style="width: 90px; min-width: 90px; max-width: 90px;" rowspan="2" title="${arac.plaka}">
                            ${arac.plaka}
                        </td>`;
            
            // Second Column - Vardiya Label
            tblHtml += `<td class="px-2 py-0 text-[10px] font-semibold text-slate-500 sticky left-[90px] ${bgPlaka} z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] align-middle" style="left: 90px; width: 55px; min-width: 55px; max-width: 55px; height: 28px;">
                            Vardiya
                        </td>`;

            let rowVardiyaTotal = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const record = isolatedKayitlar.find(k => k.arac_id === arac.id && k.tarih === dateCode);
                const val = record ? (record.vardiya || '') : '';
                const safeVal = String(val);
                if (record && !isNaN(parseInt(safeVal))) rowVardiyaTotal += parseInt(safeVal);

                const inpid = `cell-${arac.id}-${dateCode}-vardiya`;
                isolatedGridData.push({ id: record ? record.id : null, arac_id: arac.id, tarih: dateCode, field: 'vardiya', val_original: safeVal, val_new: safeVal });

                let bgClass = 'bg-transparent text-slate-700';
                if (safeVal.toUpperCase() === 'X') bgClass = 'bg-red-50 text-red-600 font-bold';
                else if (safeVal.toUpperCase() === 'R') bgClass = 'bg-amber-50 text-amber-600 font-bold';
                else if (safeVal.toUpperCase() === 'İ' || safeVal.toUpperCase() === 'I') bgClass = 'bg-purple-50 text-purple-600 font-bold';
                else if (!isNaN(parseInt(safeVal)) && parseInt(safeVal) > 0) bgClass = 'bg-blue-50/60 text-blue-700 font-bold';

                tblHtml += `<td class="p-0 border-r border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="vardiya" data-day="${i}" value="${safeVal}"
                            class="w-full h-full text-center text-[12px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 focus:bg-white focus:z-20 relative p-0 m-0 border-none ${bgClass} transition-all"
                            style="height: 28px; line-height: 28px;"
                            onchange="window.excelInputChanged('${arac.id}', 'vardiya', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[12px] font-bold text-slate-700 border-r border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;" id="total-${arac.id}-vardiya">${rowVardiyaTotal}</td>`;
            tblHtml += `</tr>`;

            // --- TEK SEFER ---
            tblHtml += `<tr class="hover:bg-orange-50/40 transition-colors" data-arac-id="${arac.id}" data-has-data="${dataStr}">`;
            
            // Second Column - Tek Sefer Label
            tblHtml += `<td class="px-2 py-0 text-[10px] font-semibold text-slate-500 sticky left-[90px] bg-orange-50/30 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] align-middle" style="left: 90px; width: 55px; min-width: 55px; max-width: 55px; height: 28px;">
                            Tek
                        </td>`;
            
            let rowTekTotal = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const record = isolatedKayitlar.find(k => k.arac_id === arac.id && k.tarih === dateCode);
                const val = record ? (record.tek || '') : '';
                const safeVal = String(val);
                if (record && !isNaN(parseInt(safeVal))) rowTekTotal += parseInt(safeVal);

                const inpid = `cell-${arac.id}-${dateCode}-tek`;
                isolatedGridData.push({ id: record ? record.id : null, arac_id: arac.id, tarih: dateCode, field: 'tek', val_original: safeVal, val_new: safeVal });

                let bgClass = 'bg-transparent text-slate-700';
                if (safeVal.toUpperCase() === 'X') bgClass = 'bg-red-50 text-red-600 font-bold';
                else if (safeVal.toUpperCase() === 'R') bgClass = 'bg-amber-50 text-amber-600 font-bold';
                else if (safeVal.toUpperCase() === 'İ' || safeVal.toUpperCase() === 'I') bgClass = 'bg-purple-50 text-purple-600 font-bold';
                else if (!isNaN(parseInt(safeVal)) && parseInt(safeVal) > 0) bgClass = 'bg-orange-50/60 text-orange-700 font-bold';

                tblHtml += `<td class="p-0 border-r border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="tek" data-day="${i}" value="${safeVal}"
                            class="w-full h-full text-center text-[12px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 focus:bg-white focus:z-20 relative p-0 m-0 border-none ${bgClass} transition-all"
                            style="height: 28px; line-height: 28px;"
                            onchange="window.excelInputChanged('${arac.id}', 'tek', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[12px] font-bold text-slate-700 border-r border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;" id="total-${arac.id}-tek">${rowTekTotal}</td>`;
            tblHtml += `</tr>`;
        });

        // Totals Rows
        tblHtml += `<tr class="bg-slate-50 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right" colspan="2">VARDİYA TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[12px] font-bold text-slate-600 border-r border-b border-slate-200 bg-slate-50" id="coltotal-vardiya-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[12px] font-black text-slate-800 border-r border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-vardiya">0</td>`;
        tblHtml += `</tr>`;

        tblHtml += `<tr class="bg-slate-50">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right" colspan="2">TEK SEFER TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[12px] font-bold text-slate-600 border-r border-b border-slate-200 bg-slate-50" id="coltotal-tek-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[12px] font-black text-slate-800 border-r border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-tek">0</td>`;
        tblHtml += `</tr>`;

        tblHtml += `<tr class="bg-indigo-50 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-3 text-[11px] font-black text-indigo-900 whitespace-nowrap sticky left-0 bg-indigo-50 z-10 border-r border-b border-indigo-200 shadow-[1px_0_0_0_#c7d2fe] text-right uppercase tracking-wider" colspan="2">Genel Toplam (V+T):</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-3 text-center text-[13px] font-black text-indigo-800 border-r border-b border-indigo-200 bg-indigo-50" id="geneltotal-col-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-3 text-center text-[13px] font-black text-indigo-950 border-r border-b border-indigo-200 bg-indigo-100 sticky right-0 shadow-[-1px_0_0_0_#c7d2fe]" id="geneltotal-grand">0</td>`;
        tblHtml += `</tr>`;

        tbody.innerHTML = tblHtml;
        recalcAllTotals(daysInMonth);

    } catch (e) {
        console.error("GRID LOAD ERROR:", e);
        alert("Grid Çekme Hatası: " + e.message + "\n\n" + e.stack);
        tbody.innerHTML = `<tr><td colspan="33" class="p-8 text-center text-red-500 font-bold text-lg">Veri Çekme Hatası: ${e.message}</td></tr>`;
        document.getElementById('header-title').textContent = "BAĞLANTI HATASI";
        document.getElementById('header-subtitle').textContent = "Veriler alınamadı.";
    }
}

window.excelInputChanged = function (aracId, type, day) {
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const inp = document.getElementById(`cell-${aracId}-${dateCode}-${type}`);
    if (!inp) return;

    let val = String(inp.value).trim().toUpperCase();
    inp.value = val;

    // Stylize immediately based on input
    inp.className = `w-full text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none transition-all`;
    inp.style.height = '26px';
    inp.style.lineHeight = '26px';

    if (val === 'X') inp.classList.add('bg-red-50', 'text-red-600', 'font-bold');
    else if (val === 'R') inp.classList.add('bg-amber-50', 'text-amber-600', 'font-bold');
    else if (val === 'İ' || val === 'I') inp.classList.add('bg-purple-50', 'text-purple-600', 'font-bold');
    else if (!isNaN(parseInt(val)) && parseInt(val) > 0) {
        if (type === 'vardiya') inp.classList.add('bg-blue-50/60', 'text-blue-700', 'font-bold');
        else inp.classList.add('bg-orange-50/60', 'text-orange-700', 'font-bold');
    } else {
        inp.classList.add('bg-transparent', 'text-slate-700');
    }

    const dataObj = isolatedGridData.find(d => d.arac_id === aracId && d.tarih === dateCode && d.field === type);
    if (dataObj) {
        dataObj.val_new = val;
    } else {
        isolatedGridData.push({ id: null, arac_id: aracId, tarih: dateCode, field: type, val_original: '', val_new: val });
    }

    // Satırın görünürlüğünün kaybolmamasını sağla
    if (val !== '') {
        document.querySelectorAll(`tr[data-arac-id="${aracId}"]`).forEach(tr => {
            tr.setAttribute('data-has-data', 'true');
        });
    }

    const daysInMonth = new Date(year, ay, 0).getDate();
    recalcAllTotals(daysInMonth);
}

function recalcAllTotals(daysInMonth) {
    let grandVardiya = 0;
    let grandTek = 0;

    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);

    for (let i = 1; i <= daysInMonth; i++) {
        let colV = 0;
        let colT = 0;
        const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        isolatedAraclar.forEach(arac => {
            // Görünür değilse atla
            const tr = document.querySelector(`tr[data-arac-id="${arac.id}"]`);
            if (tr && tr.style.display === 'none') return;

            const vInp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
            const tInp = document.getElementById(`cell-${arac.id}-${dateCode}-tek`);

            if (vInp && !isNaN(parseInt(vInp.value))) colV += parseInt(vInp.value);
            if (tInp && !isNaN(parseInt(tInp.value))) colT += parseInt(tInp.value);
        });

        const cVEl = document.getElementById(`coltotal-vardiya-${i}`);
        const cTEl = document.getElementById(`coltotal-tek-${i}`);
        const cGEl = document.getElementById(`geneltotal-col-${i}`);

        if (cVEl) cVEl.textContent = colV;
        if (cTEl) cTEl.textContent = colT;
        if (cGEl) cGEl.textContent = colV + colT;

        grandVardiya += colV;
        grandTek += colT;
    }

    // Row Logic 
    isolatedAraclar.forEach(arac => {
        let rV = 0, rT = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const vInp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
            const tInp = document.getElementById(`cell-${arac.id}-${dateCode}-tek`);
            if (vInp && !isNaN(parseInt(vInp.value))) rV += parseInt(vInp.value);
            if (tInp && !isNaN(parseInt(tInp.value))) rT += parseInt(tInp.value);
        }
        const rvEl = document.getElementById(`total-${arac.id}-vardiya`);
        const rtEl = document.getElementById(`total-${arac.id}-tek`);
        if (rvEl) rvEl.textContent = rV;
        if (rtEl) rtEl.textContent = rT;
    });

    document.getElementById('grandtotal-vardiya').textContent = grandVardiya;
    document.getElementById('grandtotal-tek').textContent = grandTek;
    document.getElementById('geneltotal-grand').textContent = grandVardiya + grandTek;

    document.getElementById('summary-vardiya').textContent = grandVardiya;
    document.getElementById('summary-tek').textContent = grandTek;
    document.getElementById('summary-genel').textContent = grandVardiya + grandTek;
}

window.autoFillWeekdays = function () {
    if (!confirm('Tüm araçlar için hafta içi günlere 1 vardiya otomatik eklenecek. Onaylıyor musunuz?')) return;

    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, ay - 1, i);
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Weekdays only
            isolatedAraclar.forEach(arac => {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const inp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
                if (inp && !inp.value) {
                    inp.value = '1';
                    window.excelInputChanged(arac.id, 'vardiya', i);
                }
            });
        }
    }
}

window.saveExcelGrid = async function () {
    const btn = document.querySelector('button[onclick="saveExcelGrid()"]');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Kaydediliyor...`;
    lucide.createIcons();

    try {
        const toSaveOrUpdate = isolatedGridData.filter(d => d.val_new !== d.val_original);
        if (toSaveOrUpdate.length === 0) {
            alert('Değişiklik bulunamadı.');
            btn.innerHTML = ogHtml;
            lucide.createIcons();
            return;
        }

        // Gruplayarak UPSERT operasyonu
        const updatesByDateAndVehicle = {};

        // Önce mevcut db kayıtlarından bir harita çıkaralım
        const dbMap = {};
        const dbIdsMap = {};
        
        isolatedKayitlar.forEach(k => {
            const key = `${k.arac_id}_${k.tarih}`;
            if (!dbIdsMap[key]) dbIdsMap[key] = [];
            dbIdsMap[key].push(k.id);
            // keep the first one as representative for upsert
            if (!dbMap[key]) dbMap[key] = k; 
        });

        toSaveOrUpdate.forEach(item => {
            const key = `${item.arac_id}_${item.tarih}`;
            if (!updatesByDateAndVehicle[key]) {
                const existing = dbMap[key] || { musteri_id: musteriId, arac_id: item.arac_id, tarih: item.tarih, vardiya: '', tek: '' };
                updatesByDateAndVehicle[key] = { ...existing };
            }
            if (item.field === 'vardiya') updatesByDateAndVehicle[key].vardiya = item.val_new;
            if (item.field === 'tek') updatesByDateAndVehicle[key].tek = item.val_new;
        });

        const upsertArray = [];
        const deleteIds = [];

        Object.values(updatesByDateAndVehicle).forEach(item => {
            const v = String(item.vardiya || '').trim();
            const t = String(item.tek || '').trim();
            const key = `${item.arac_id}_${item.tarih}`;
            const existingIds = dbIdsMap[key] || [];
            
            if (!v && !t && existingIds.length > 0) {
                // Her ikisi de boş ve VT'de kayıt(lar) varsa tamamen sil
                deleteIds.push(...existingIds);
            } else if (!v && !t && existingIds.length === 0) {
                // Veritabanında yok ve her ikisi de boş (yeni açılıp silinen) - geç
            } else {
                if (!item.id) delete item.id;
                upsertArray.push(item);
                
                // Eğer veritabanında aynı güne ait birden fazla kopya varsa (duplicate) diğerlerini temizle
                if (existingIds.length > 1) {
                    for (let x = 1; x < existingIds.length; x++) {
                        deleteIds.push(existingIds[x]);
                    }
                }
            }
        });

        if (upsertArray.length > 0) {
            const { error: upsertErr } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .upsert(upsertArray); 
            if (upsertErr) throw upsertErr;
        }

        if (deleteIds.length > 0) {
            const { error: delErr } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .delete()
                .in('id', deleteIds);
            if (delErr) throw delErr;
        }

        alert(`Mükemmel! ${toSaveOrUpdate.length} adet hücre başarıyla kaydedildi.`);
        window.location.reload(); // Re-fetch all clean state
    } catch (e) {
        console.error(e);
        alert('Kaydetme başarısız: ' + e.message);
        btn.innerHTML = ogHtml;
        lucide.createIcons();
    }
}

window.filterPuantaj = function() {
    const selectedId = document.getElementById('filter-arac')?.value || 'ALL';
    const selectedOwner = (document.getElementById('filter-owner')?.value || 'Tümü').toUpperCase();
    const rows = document.querySelectorAll('#excel-tbody tr[data-arac-id]');
    
    rows.forEach(tr => {
        const aracId = tr.getAttribute('data-arac-id');
        const hasData = tr.getAttribute('data-has-data') === 'true';

        // Find the vehicle in our isolated list to get its ownership status
        const arac = isolatedAraclar.find(a => a.id.toString() === aracId);
        const aracMulkiyet = (arac?.mulkiyet || 'Diğer').toUpperCase();

        const matchesVehicle = (selectedId === 'ALL' || aracId === selectedId);
        const matchesOwner = (selectedOwner === 'TÜMÜ' || aracMulkiyet === selectedOwner);

        if (matchesVehicle && matchesOwner) {
            // "ALL" and "TÜMÜ" case: only show those with data
            if (selectedId === 'ALL' && selectedOwner === 'TÜMÜ') {
                tr.style.display = hasData ? '' : 'none';
            } else {
                tr.style.display = '';
            }
        } else {
            tr.style.display = 'none';
        }
    });

    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    recalcAllTotals(daysInMonth);
}

window.handlePrint = function() {
    const selectedId = document.getElementById('filter-arac')?.value || 'ALL';
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    const headersTitle = document.getElementById('header-title').textContent;
    const headersSubtitle = document.getElementById('header-subtitle').textContent;

    let html = `
        <div style="font-family: sans-serif; color: #000; width: 100%; box-sizing: border-box; padding: 5mm; position: relative;">
            <div style="position: absolute; top: 3mm; right: 5mm; text-align: right; z-index: 10;">
                <div style="font-size: 1.15rem; font-weight: 900; color: #ea580c; font-style: italic; letter-spacing: 1.5px; border-bottom: 2px solid #ea580c; padding-bottom: 2px; margin-bottom: 2px;">IDEOL TURİZM</div>
            </div>
            
            <div style="text-align:center; padding-bottom: 5px; margin-bottom: 5px; margin-top: 15px;">
                <h2 style="font-size: 1.15rem; font-weight: bold; margin: 0; color: #111;">${headersTitle}</h2>
                <p style="color: #444; font-size: 0.85rem; margin-top: 3px;">${headersSubtitle}</p>
            </div>
            
            <table class="print-table" style="width:100%; border-collapse: collapse; text-align:center; font-size: 8.5px; page-break-inside: auto; table-layout: fixed;">
                <thead>
                    <tr style="background-color: #f8fafc; font-weight: bold;">
                        <th style="border: 1px solid #cbd5e1; padding: 2px; width: 55px; overflow: hidden;">ARAÇ</th>
                        <th style="border: 1px solid #cbd5e1; padding: 2px; width: 35px; overflow: hidden;">TÜR</th>`;
                        
    for (let i = 1; i <= daysInMonth; i++) {
        html += `<th style="border: 1px solid #cbd5e1; padding: 2px;">${i}</th>`;
    }
    html += `<th style="border: 1px solid #cbd5e1; padding: 2px; width: 25px; background-color: #f1f5f9;">TOP</th></tr></thead><tbody>`;

    let hasData = false;
    const selectedOwner = (document.getElementById('filter-owner')?.value || 'Tümü').toUpperCase();
    let rowsToPrint = isolatedAraclar.filter(arac => {
        const matchesVehicle = (selectedId === 'ALL' || arac.id.toString() === selectedId);
        const aracMulkiyet = (arac.mulkiyet || 'Diğer').toUpperCase();
        const matchesOwner = (selectedOwner === 'TÜMÜ' || aracMulkiyet === selectedOwner);
        return matchesVehicle && matchesOwner;
    });

    let grandVardiya = 0;
    let grandTek = 0;
    let colVardiya = new Array(daysInMonth + 1).fill(0);
    let colTek = new Array(daysInMonth + 1).fill(0);

    rowsToPrint.forEach((arac, index) => {
        let rowV = 0;
        let rowT = 0;
        let aracVeriVar = false;
        const bgPlaka = index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;';

        let vardiyaRowHTML = `<tr style="page-break-inside: avoid;">
            <td rowspan="2" style="border: 1px solid #cbd5e1; padding: 2px; font-weight: bold; overflow: hidden; ${bgPlaka}">${arac.plaka}</td>
            <td style="border: 1px solid #cbd5e1; padding: 2px; color: #475569;">Vardiya</td>`;
        let tekRowHTML = `<tr style="page-break-inside: avoid;">
            <td style="border: 1px solid #cbd5e1; padding: 2px; color: #475569; background-color: #fffaf0;">Tek</td>`;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const vInp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
            const tInp = document.getElementById(`cell-${arac.id}-${dateCode}-tek`);
            
            let vVal = vInp ? String(vInp.value).trim() : '';
            let tVal = tInp ? String(tInp.value).trim() : '';
            
            if (vVal !== '' || tVal !== '') {
                aracVeriVar = true;
            }

            // calculations for totals
            if (vVal && !isNaN(parseInt(vVal))) { rowV += parseInt(vVal); colVardiya[i] += parseInt(vVal); grandVardiya += parseInt(vVal); }
            if (tVal && !isNaN(parseInt(tVal))) { rowT += parseInt(tVal); colTek[i] += parseInt(tVal); grandTek += parseInt(tVal); }

            vardiyaRowHTML += `<td style="border: 1px solid #cbd5e1; padding: 2px; ${getPrintBg(vVal, 'v')}">${vVal}</td>`;
            tekRowHTML += `<td style="border: 1px solid #cbd5e1; padding: 2px; ${getPrintBg(tVal, 't')}">${tVal}</td>`;
        }
        
        if (aracVeriVar) {
            vardiyaRowHTML += `<td style="border: 1px solid #cbd5e1; padding: 2px; font-weight: bold; background-color: #f8fafc;">${rowV}</td></tr>`;
            tekRowHTML += `<td style="border: 1px solid #cbd5e1; padding: 2px; font-weight: bold; background-color: #f8fafc;">${rowT}</td></tr>`;

            html += vardiyaRowHTML + tekRowHTML;
            hasData = true;
        }
    });

    if (!hasData) {
        html += `<tr><td colspan="${daysInMonth + 3}" style="padding:10px; text-align:center; color:#94a3b8;">Yazdırılacak puantaj verisi bulunamadı.</td></tr>`;
    } else {
        // Totals Rows
        html += `<tr style="background-color: #f8fafc; font-weight: bold; border-top: 2px solid #94a3b8;">
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #475569; font-size: 7.5px; overflow: hidden; white-space: nowrap;">VARDİYA TOP:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            html += `<td style="border: 1px solid #cbd5e1; padding: 3px; color: #475569;">${colVardiya[i]}</td>`;
        }
        html += `<td style="border: 1px solid #cbd5e1; padding: 3px; color: #0f172a;">${grandVardiya}</td></tr>`;

        html += `<tr style="background-color: #f8fafc; font-weight: bold;">
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 3px; text-align: right; color: #475569; font-size: 7.5px; overflow: hidden; white-space: nowrap;">TEK SEFER TOP:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            html += `<td style="border: 1px solid #cbd5e1; padding: 3px; color: #475569;">${colTek[i]}</td>`;
        }
        html += `<td style="border: 1px solid #cbd5e1; padding: 3px; color: #0f172a;">${grandTek}</td></tr>`;

        html += `<tr style="background-color: #eef2ff; font-weight: 900; border-top: 2px solid #94a3b8;">
            <td colspan="2" style="border: 1px solid #cbd5e1; padding: 4px; text-align: right; color: #3730a3; font-size: 8.5px; overflow: hidden; white-space: nowrap;">G. TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            html += `<td style="border: 1px solid #cbd5e1; padding: 4px; color: #3730a3;">${colVardiya[i] + colTek[i]}</td>`;
        }
        html += `<td style="border: 1px solid #cbd5e1; padding: 4px; color: #1e1b4b; background-color: #e0e7ff;">${grandVardiya + grandTek}</td></tr>`;
    }

    html += `</tbody></table></div>`;

    const printSection = document.getElementById('print-section');
    if(printSection) {
        printSection.innerHTML = html;
    }

    setTimeout(() => {
        window.print();
    }, 150);
}

function getPrintBg(val, type) {
    if(!val) return '';
    val = val.toUpperCase();
    if (val === 'X') return 'background-color: #fee2e2; color: #dc2626; font-weight: bold;';
    if (val === 'R') return 'background-color: #fef3c7; color: #d97706; font-weight: bold;';
    if (val === 'İ' || val === 'I') return 'background-color: #f3e8ff; color: #9333ea; font-weight: bold;';
    if (!isNaN(parseInt(val)) && parseInt(val) > 0) {
        if (type === 'v') return 'background-color: #eff6ff; color: #1d4ed8; font-weight: bold;';
        else return 'background-color: #fff7ed; color: #c2410c; font-weight: bold;';
    }
    return '';
}

window.changeDonem = function() {
    const newDonem = document.getElementById('filter-donem').value;
    if (newDonem) {
        urlParams.set('ay', newDonem);
        window.location.search = urlParams.toString();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPuantaj);
} else {
    initPuantaj();
}
