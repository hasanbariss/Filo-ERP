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

        await loadGridData();
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
            .select('*, araclar(id, plaka)')
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
                    plaka: t.araclar.plaka
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
        let thHtml = `<tr><th class="px-3 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0]" style="width: 130px; min-width: 130px;">ARAÇ ${ay}/${year} [${daysInMonth}]</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            thHtml += `<th class="p-0 py-2.5 text-center text-[11px] font-semibold text-slate-600 border-l border-b border-slate-200" style="width: 38px; min-width: 38px; max-width: 38px;">${i}</th>`;
        }
        thHtml += '<th class="px-0 py-2.5 text-center text-[10px] font-bold text-slate-600 border-l border-b border-slate-200 uppercase tracking-wider sticky right-0 bg-slate-50 z-10 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;">TOP</th></tr>';
        thead.innerHTML = thHtml;

        let tblHtml = '';
        isolatedGridData = [];

        // Build TBODY
        isolatedAraclar.forEach((arac, index) => {
            const bgPlaka = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

            // --- VARDİYA ---
            tblHtml += `<tr class="hover:bg-blue-50/40 transition-colors" data-arac-id="${arac.id}">`;
            tblHtml += `<td class="p-0 text-[11px] font-medium text-slate-800 sticky left-0 ${bgPlaka} z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] leading-tight" style="width: 130px; min-width: 130px;" rowspan="2">
                            <div class="px-3 py-1.5 font-bold text-slate-900 break-all border-b border-slate-100" title="${arac.plaka}">${arac.plaka}</div>
                            <div class="flex flex-col">
                                <div class="px-3 text-[9px] text-slate-500 flex items-center justify-between" style="height: 26px;"><span>Vardiya:</span></div>
                                <div class="px-3 text-[9px] text-slate-500 flex items-center justify-between bg-orange-50/20" style="height: 26px;"><span>Tek Sfr:</span></div>
                            </div>
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

                tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="vardiya" data-day="${i}" value="${safeVal}"
                            class="w-full text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                            style="height: 26px; line-height: 26px;"
                            onchange="window.excelInputChanged('${arac.id}', 'vardiya', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;" id="total-${arac.id}-vardiya">${rowVardiyaTotal}</td>`;
            tblHtml += `</tr>`;

            // --- TEK SEFER ---
            tblHtml += `<tr class="hover:bg-orange-50/40 transition-colors" data-arac-id="${arac.id}">`;
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

                tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle" style="width: 38px; min-width: 38px; max-width: 38px;">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="tek" data-day="${i}" value="${safeVal}"
                            class="w-full text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                            style="height: 26px; line-height: 26px;"
                            onchange="window.excelInputChanged('${arac.id}', 'tek', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" style="width: 50px; min-width: 50px;" id="total-${arac.id}-tek">${rowTekTotal}</td>`;
            tblHtml += `</tr>`;
        });

        // Totals Rows
        tblHtml += `<tr class="bg-slate-50 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right">VARDİYA TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-bold text-slate-600 border-l border-b border-slate-200 bg-slate-50" id="coltotal-vardiya-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-black text-slate-800 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-vardiya">0</td>`;
        tblHtml += `</tr>`;

        tblHtml += `<tr class="bg-slate-50">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right">TEK SEFER TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-bold text-slate-600 border-l border-b border-slate-200 bg-slate-50" id="coltotal-tek-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-black text-slate-800 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-tek">0</td>`;
        tblHtml += `</tr>`;

        tblHtml += `<tr class="bg-slate-100 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-3 text-[11px] font-black text-slate-800 whitespace-nowrap sticky left-0 bg-slate-100 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#cbd5e1] text-right">GENEL (V+T):</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-3 text-center text-[12px] font-bold text-slate-800 border-l border-b border-slate-200 bg-slate-100" id="geneltotal-col-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-3 text-center text-[12px] font-black text-slate-900 border-l border-b border-slate-200 bg-slate-100 sticky right-0 shadow-[-1px_0_0_0_#cbd5e1]" id="geneltotal-grand">0</td>`;
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
        isolatedKayitlar.forEach(k => {
            dbMap[`${k.arac_id}_${k.tarih}`] = k;
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
            
            if (!v && !t && item.id) {
                // Her ikisi de boş ve VT'de varsa tamamen sil
                deleteIds.push(item.id);
            } else if (!v && !t && !item.id) {
                // Veritabanında yok ve her ikisi de boş (yeni açılıp silinen) - geç
            } else {
                if (!item.id) delete item.id;
                upsertArray.push(item);
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
    const rows = document.querySelectorAll('#excel-tbody tr[data-arac-id]');
    
    rows.forEach(tr => {
        if (selectedId === 'ALL') {
            tr.style.display = '';
        } else {
            if (tr.getAttribute('data-arac-id') === selectedId) {
                tr.style.display = '';
            } else {
                tr.style.display = 'none';
            }
        }
    });
}

window.handlePrint = function() {
    const selectedId = document.getElementById('filter-arac')?.value || 'ALL';
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    const headersTitle = document.getElementById('header-title').textContent;
    const headersSubtitle = document.getElementById('header-subtitle').textContent;

    let html = `
        <div style="padding: 24px; font-family: sans-serif; color: #1e293b;">
            <div style="text-align:center; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;">
                <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0;">${headersTitle}</h2>
                <p style="color: #64748b; font-size: 1rem; margin-top: 8px;">${headersSubtitle}</p>
            </div>
            
            <table style="width:100%; border-collapse: collapse; text-align:left; font-size: 0.85rem;">
                <thead>
                    <tr>
                        <th style="padding:10px; border-bottom: 2px solid #cbd5e1; color:#334155;">Plaka</th>
                        <th style="padding:10px; border-bottom: 2px solid #cbd5e1; color:#334155;">Tarih</th>
                        <th style="padding:10px; border-bottom: 2px solid #cbd5e1; color:#334155;">Tür</th>
                        <th style="padding:10px; border-bottom: 2px solid #cbd5e1; color:#334155;">Değer</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let hasData = false;

    isolatedAraclar.forEach(arac => {
        if (selectedId !== 'ALL' && arac.id.toString() !== selectedId) return;

        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const vInp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
            const tInp = document.getElementById(`cell-${arac.id}-${dateCode}-tek`);
            
            if (vInp && vInp.value) {
                html += `
                    <tr>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${arac.plaka}</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; color:#475569;">${dateCode}</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color:#0284c7;">Vardiya</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${vInp.value}</td>
                    </tr>
                `;
                hasData = true;
            }
            if (tInp && tInp.value) {
                html += `
                    <tr>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${arac.plaka}</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; color:#475569;">${dateCode}</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 600; color:#ea580c;">Tek Sefer</td>
                        <td style="padding:10px; border-bottom: 1px solid #f1f5f9; font-weight: 700;">${tInp.value}</td>
                    </tr>
                `;
                hasData = true;
            }
        }
    });

    if (!hasData) {
        html += `<tr><td colspan="4" style="padding:20px; text-align:center; color:#94a3b8;">Yazdırılacak puantaj verisi bulunamadı.</td></tr>`;
    }

    html += `</tbody></table></div>`;

    const printSection = document.getElementById('print-section');
    if(printSection) {
        printSection.innerHTML = html;
    }
    window.print();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPuantaj);
} else {
    initPuantaj();
}
