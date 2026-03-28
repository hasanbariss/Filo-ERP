const urlParams = new URLSearchParams(window.location.search);
const musteriId = urlParams.get('musteri_id');
const monthStr = urlParams.get('ay'); // 'YYYY-MM'

let isolatedGridData = [];
let isolatedAraclar = [];
let isolatedKayitlar = [];
let kayitlarMap = {}; // Global O(1) lookup: aracId_tarih_field -> value

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

        // 1. Parallelize data fetching for lightning fast initial load
        const [musteriRes, tanimRes] = await Promise.all([
            window.supabaseClient.from('musteriler').select('ad').eq('id', musteriId).single(),
            window.supabaseClient.from('musteri_arac_tanimlari')
                .select('*, araclar(id, plaka, mulkiyet_durumu)')
                .eq('musteri_id', musteriId)
        ]);

        const musteriAdi = musteriRes.data ? musteriRes.data.ad : 'Bilinmeyen Müşteri';
        document.getElementById('header-title').textContent = `${musteriAdi} - Servis Puantajı`;
        document.getElementById('header-subtitle').textContent = `${months[ay - 1]} ${year} Dönemi`;

        if (document.getElementById('filter-donem')) {
            document.getElementById('filter-donem').value = monthStr;
        }

        await loadGridData(tanimRes.data, musteriAdi);
        
        if (typeof window.filterPuantaj === 'function') {
            window.filterPuantaj();
        }
    } catch (e) {
        alert("Init Hatası: " + e.message + "\nStack: " + e.stack);
    }
}

async function loadGridData(tanimlar, musteriAdi) {
    const thead = document.getElementById('excel-thead');
    const tbody = document.getElementById('excel-tbody');

    try {
        const [year, mStr] = monthStr.split('-');
        const ay = parseInt(mStr, 10);
        const daysInMonth = new Date(year, ay, 0).getDate();
        const startDate = `${year}-${String(ay).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(ay).padStart(2, '0')}-${daysInMonth}`;

        if (!tanimlar || tanimlar.length === 0) {
            tbody.innerHTML = '<tr><td colspan="33" class="p-8 text-center text-slate-500 font-medium">Bu müşteriye tanımlı araç bulunamadı.</td></tr>';
            return;
        }

        // Parallelize month records fetch
        const { data: qKayitlar, error: kayitErr } = await window.supabaseClient
            .from('musteri_servis_puantaj')
            .select('*')
            .eq('musteri_id', musteriId)
            .gte('tarih', startDate)
            .lte('tarih', endDate);

        if (kayitErr) throw kayitErr;
        isolatedKayitlar = qKayitlar || [];

        // 2. O(1) Indexing for records
        kayitlarMap = {};
        isolatedKayitlar.forEach(k => {
            kayitlarMap[`${k.arac_id}_${k.tarih}_vardiya`] = k.vardiya || '';
            kayitlarMap[`${k.arac_id}_${k.tarih}_tek`] = k.tek || '';
            kayitlarMap[`${k.arac_id}_${k.tarih}_mesai`] = k.mesai || 0;
            kayitlarMap[`${k.arac_id}_${k.tarih}_id`] = k.id;
        });

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

        const isDikkan = musteriAdi.toLowerCase().includes('dikkan');

        // Build THEAD
        let thHtml = `<tr>
            <th class="sticky left-0 bg-slate-100 z-30 border-r-2 border-slate-200 shadow-sm" style="width: 100px; min-width: 100px;">PLAKA</th>
            <th class="sticky left-[100px] bg-slate-50 z-30 border-r-2 border-slate-200 shadow-sm" style="width: 65px; min-width: 65px;">TÜR</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            thHtml += `<th style="width: 38px; min-width: 38px;">${i}</th>`;
        }
        thHtml += `<th class="sticky right-0 bg-slate-100 z-30 border-l-2 border-slate-200 shadow-sm" style="width: 50px; min-width: 50px;">TOP</th></tr>`;
        thead.innerHTML = thHtml;

        let tblHtml = '';
        isolatedGridData = [];
        
        // 3. Performance Optimization: Inline Calculations
        // Using arrays for column totals (Day 1 to 31)
        const colV = new Array(daysInMonth + 1).fill(0);
        const colT = new Array(daysInMonth + 1).fill(0);
        const colM = new Array(daysInMonth + 1).fill(0);

        isolatedAraclar.forEach((arac, index) => {
            const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
            const rowSpan = isDikkan ? 3 : 2;
            let rowVardiyaTotal = 0, rowTekTotal = 0, rowMesaiTotal = 0;

            // Pre-calculate visibility and filter
            const hasDataInMonth = isolatedKayitlar.some(k => k.arac_id === arac.id && (Boolean(k.vardiya) || Boolean(k.tek)));
            const dataStr = hasDataInMonth ? 'true' : 'false';

            // --- VARDİYA ROW ---
            let vRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}">
                <td class="sticky-col font-black text-slate-800 text-[11px] text-center brand-font" rowspan="${rowSpan}">${arac.plaka}</td>
                <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Vardiya</td>`;

            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const val = kayitlarMap[`${arac.id}_${dateCode}_vardiya`] || '';
                const safeVal = String(val);
                if (!isNaN(parseInt(safeVal))) {
                    const vNum = parseInt(safeVal);
                    rowVardiyaTotal += vNum;
                    colV[i] += vNum;
                }

                isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_id`], arac_id: arac.id, tarih: dateCode, field: 'vardiya', val_original: safeVal, val_new: safeVal });

                const uv = safeVal.toUpperCase();
                let cellClass = (uv === 'X') ? 'cell-x' : (uv === 'R' ? 'cell-r' : ((uv === 'İ' || uv === 'I') ? 'cell-i' : ''));
                vRow += `<td class="${cellClass}"><input type="text" id="cell-${arac.id}-${dateCode}-vardiya" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'vardiya', ${i})"></td>`;
            }
            vRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-indigo-600 font-mono" id="total-${arac.id}-vardiya">${rowVardiyaTotal}</td></tr>`;
            tblHtml += vRow;

            // --- TEK ROW ---
            let tRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}">
                <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Tek Sefer</td>`;

            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const val = kayitlarMap[`${arac.id}_${dateCode}_tek`] || '';
                const safeVal = String(val);
                if (!isNaN(parseInt(safeVal))) {
                    const tNum = parseInt(safeVal);
                    rowTekTotal += tNum;
                    colT[i] += tNum;
                }

                isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_id`], arac_id: arac.id, tarih: dateCode, field: 'tek', val_original: safeVal, val_new: safeVal });

                const uv = safeVal.toUpperCase();
                let cellClass = (uv === 'X') ? 'cell-x' : (uv === 'R' ? 'cell-r' : ((uv === 'İ' || uv === 'I') ? 'cell-i' : ''));
                tRow += `<td class="${cellClass}"><input type="text" id="cell-${arac.id}-${dateCode}-tek" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'tek', ${i})"></td>`;
            }
            tRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-orange-600 font-mono" id="total-${arac.id}-tek">${rowTekTotal}</td></tr>`;
            tblHtml += tRow;

            if (isDikkan) {
                let mRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}">
                    <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Mesai</td>`;
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const val = kayitlarMap[`${arac.id}_${dateCode}_mesai`] || 0;
                    const safeVal = String(val);
                    if (!isNaN(parseInt(safeVal))) {
                        const mNum = parseInt(safeVal);
                        rowMesaiTotal += mNum;
                        colM[i] += mNum;
                    }
                    isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_id`], arac_id: arac.id, tarih: dateCode, field: 'mesai', val_original: safeVal, val_new: safeVal });
                    mRow += `<td><input type="text" id="cell-${arac.id}-${dateCode}-mesai" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'mesai', ${i})"></td>`;
                }
                mRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-emerald-600 font-mono" id="total-${arac.id}-mesai">${rowMesaiTotal}</td></tr>`;
                tblHtml += mRow;
            }
        });

        // 4. Final Totals Generation (O(1) from arrays)
        let sumV = 0, sumT = 0, sumM = 0;
        let vSumRow = `<tr class="bg-slate-100 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-slate-500 uppercase tracking-widest">Vardiya Top.:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { vSumRow += `<td class="text-center text-xs text-slate-600" id="coltotal-vardiya-${i}">${colV[i]}</td>`; sumV += colV[i]; }
        vSumRow += `<td class="sticky right-0 bg-indigo-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-indigo-700 font-mono" id="grandtotal-vardiya">${sumV}</td></tr>`;
        
        let tSumRow = `<tr class="bg-slate-100 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-slate-500 uppercase tracking-widest">Tek Sefer Top.:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { tSumRow += `<td class="text-center text-xs text-slate-600" id="coltotal-tek-${i}">${colT[i]}</td>`; sumT += colT[i]; }
        tSumRow += `<td class="sticky right-0 bg-orange-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-orange-700 font-mono" id="grandtotal-tek">${sumT}</td></tr>`;

        let gSumRow = `<tr class="bg-slate-800 text-white font-black total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-4 text-right text-[10px] uppercase tracking-widest">Genel Toplam:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { gSumRow += `<td class="text-center text-xs" id="geneltotal-col-${i}">${colV[i] + colT[i] + colM[i]}</td>`; sumM += colM[i]; }
        gSumRow += `<td class="sticky right-0 bg-slate-900 z-20 border-l-2 border-slate-700 text-center text-sm font-mono" id="geneltotal-grand">${sumV + sumT + sumM}</td></tr>`;

        tbody.innerHTML = tblHtml + vSumRow + tSumRow + gSumRow;
        
        // Final Top Summary
        if (document.getElementById('summary-vardiya')) document.getElementById('summary-vardiya').textContent = sumV;
        if (document.getElementById('summary-tek')) document.getElementById('summary-tek').textContent = sumT;
        if (document.getElementById('summary-genel')) document.getElementById('summary-genel').textContent = sumV + sumT + sumM;

        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error("GRID LOAD ERROR:", e);
        tbody.innerHTML = `<tr><td colspan="33" class="p-8 text-center text-red-500 font-bold">Veri Çekme Hatası: ${e.message}</td></tr>`;
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
    const dataObj = isolatedGridData.find(d => d.arac_id === aracId && d.tarih === dateCode && d.field === type);
    if (dataObj) dataObj.val_new = val;
    const td = inp.parentElement;
    td.className = ""; 
    const uv = val.toUpperCase();
    if (uv === 'X') td.classList.add('cell-x'); else if (uv === 'R') td.classList.add('cell-r'); else if (uv === 'İ' || uv === 'I') td.classList.add('cell-i');
    const daysInMonth = new Date(year, ay, 0).getDate();
    recalcAllTotals(daysInMonth);
}

function recalcAllTotals(daysInMonth) {
    // Only used for live cell updates (incremental)
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    let gV = 0, gT = 0, gM = 0;
    
    // Day Totals (Columns)
    for (let i = 1; i <= daysInMonth; i++) {
        let colV = 0, colT = 0, colM = 0;
        const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        isolatedAraclar.forEach(arac => {
            const vInp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
            const tInp = document.getElementById(`cell-${arac.id}-${dateCode}-tek`);
            const mInp = document.getElementById(`cell-${arac.id}-${dateCode}-mesai`);
            if (vInp && !isNaN(parseInt(vInp.value))) colV += parseInt(vInp.value);
            if (tInp && !isNaN(parseInt(tInp.value))) colT += parseInt(tInp.value);
            if (mInp && !isNaN(parseInt(mInp.value))) colM += parseInt(mInp.value);
        });
        const vEl = document.getElementById(`coltotal-vardiya-${i}`), tEl = document.getElementById(`coltotal-tek-${i}`), gEl = document.getElementById(`geneltotal-col-${i}`);
        if(vEl) vEl.textContent = colV; if(tEl) tEl.textContent = colT; if(gEl) gEl.textContent = colV + colT + colM;
        gV += colV; gT += colT; gM += colM;
    }
    
    // Vehicle Totals (Rows)
    isolatedAraclar.forEach(arac => {
        let rV = 0, rT = 0, rM = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const vVal = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`)?.value;
            const tVal = document.getElementById(`cell-${arac.id}-${dateCode}-tek`)?.value;
            const mVal = document.getElementById(`cell-${arac.id}-${dateCode}-mesai`)?.value;
            if(!isNaN(parseInt(vVal))) rV += parseInt(vVal);
            if(!isNaN(parseInt(tVal))) rT += parseInt(tVal);
            if(!isNaN(parseInt(mVal))) rM += parseInt(mVal);
        }
        const vT = document.getElementById(`total-${arac.id}-vardiya`), tT = document.getElementById(`total-${arac.id}-tek`), mT = document.getElementById(`total-${arac.id}-mesai`);
        if(vT) vT.textContent = rV; if(tT) tT.textContent = rT; if(mT) mT.textContent = rM;
    });

    if (document.getElementById('summary-vardiya')) document.getElementById('summary-vardiya').textContent = gV;
    if (document.getElementById('summary-tek')) document.getElementById('summary-tek').textContent = gT;
    if (document.getElementById('summary-genel')) document.getElementById('summary-genel').textContent = gV + gT + gM;
    if (document.getElementById('grandtotal-vardiya')) document.getElementById('grandtotal-vardiya').textContent = gV;
    if (document.getElementById('grandtotal-tek')) document.getElementById('grandtotal-tek').textContent = gT;
    if (document.getElementById('geneltotal-grand')) document.getElementById('geneltotal-grand').textContent = gV + gT + gM;
}

window.autoFillWeekdays = function () {
    if (!confirm('Hafta içi günlere 1 vardiya eklenecek. Onaylıyor musunuz?')) return;
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, ay - 1, i);
        if (d.getDay() !== 0 && d.getDay() !== 6) { 
            isolatedAraclar.forEach(arac => {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const inp = document.getElementById(`cell-${arac.id}-${dateCode}-vardiya`);
                if (inp && !inp.value) { inp.value = '1'; window.excelInputChanged(arac.id, 'vardiya', i); }
            });
        }
    }
}

window.saveExcelGrid = async function () {
    const btn = document.querySelector('button[onclick="saveExcelGrid()"]');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = `Kaydediliyor...`;
    try {
        const toSaveOrUpdate = isolatedGridData.filter(d => d.val_new !== d.val_original);
        if (toSaveOrUpdate.length === 0) { alert('Değişiklik bulunamadı.'); btn.innerHTML = ogHtml; return; }
        const updatesByDateAndVehicle = {};
        const dbMap = {};
        isolatedKayitlar.forEach(k => { dbMap[`${k.arac_id}_${k.tarih}`] = k; });
        toSaveOrUpdate.forEach(item => {
            const key = `${item.arac_id}_${item.tarih}`;
            if (!updatesByDateAndVehicle[key]) { updatesByDateAndVehicle[key] = { ...(dbMap[key] || { musteri_id: musteriId, arac_id: item.arac_id, tarih: item.tarih, vardiya: '', tek: '', mesai: 0 }) }; }
            if (item.field === 'vardiya') updatesByDateAndVehicle[key].vardiya = item.val_new;
            if (item.field === 'tek') updatesByDateAndVehicle[key].tek = item.val_new;
            if (item.field === 'mesai') updatesByDateAndVehicle[key].mesai = !item.val_new ? 0 : (parseInt(item.val_new) || 0);
        });
        const upsertArray = [], deleteIds = [];
        Object.values(updatesByDateAndVehicle).forEach(item => {
            if (!item.vardiya && !item.tek && !item.mesai && item.id) deleteIds.push(item.id);
            else { if (!item.id) delete item.id; upsertArray.push(item); }
        });
        if (upsertArray.length > 0) { const { error: ue } = await window.supabaseClient.from('musteri_servis_puantaj').upsert(upsertArray); if (ue) throw ue; }
        if (deleteIds.length > 0) { const { error: de } = await window.supabaseClient.from('musteri_servis_puantaj').delete().in('id', deleteIds); if (de) throw de; }
        alert(`Mükemmel! Kaydedildi.`); window.location.reload();
    } catch (e) { alert('Hata: ' + e.message); btn.innerHTML = ogHtml; }
}

window.filterPuantaj = function() {
    const sId = document.getElementById('filter-arac')?.value || 'ALL';
    const sOwner = (document.getElementById('filter-owner')?.value || 'Tümü').toUpperCase();
    document.querySelectorAll('#excel-tbody tr[data-arac-id]').forEach(tr => {
        const aId = tr.getAttribute('data-arac-id'), hasData = tr.getAttribute('data-has-data') === 'true';
        const arac = isolatedAraclar.find(a => a.id.toString() === aId);
        const aMulkiyet = (arac?.mulkiyet || 'Diğer').toUpperCase();
        const mV = (sId === 'ALL' || aId === sId), mO = (sOwner === 'TÜMÜ' || aMulkiyet === sOwner);
        tr.style.display = (mV && mO && (sId !== 'ALL' || sOwner !== 'TÜMÜ' || hasData)) ? '' : 'none';
    });
    const [y, m] = monthStr.split('-');
    recalcAllTotals(new Date(y, parseInt(m), 0).getDate());
}

window.handlePrint = function() {
    const sId = document.getElementById('filter-arac')?.value || 'ALL';
    const [y, mStr] = monthStr.split('-');
    const m = parseInt(mStr, 10), dim = new Date(y, m, 0).getDate();
    const headersTitle = document.getElementById('header-title').textContent;
    const headersSubtitle = document.getElementById('header-subtitle').textContent;

    let h = `<div style="padding: 8mm; font-family: 'Inter', sans-serif; color: #1e293b; background: white;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6mm; border-bottom: 2px solid #334155; padding-bottom: 3mm;">
            <div>
                <h1 style="margin: 0; font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${headersTitle}</h1>
                <p style="margin: 2px 0 0; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 1px;">${headersSubtitle} / SERVİS PUANTAJ RAPORU</p>
            </div>
            <div style="text-align: right;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 900; color: #ea580c; font-style: italic;">IDEOL TURİZM</h2>
                <p style="margin: 2px 0 0; font-size: 9px; font-weight: 700; color: #94a3b8;">FILO YÖNETIM SISTEMI</p>
            </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 8px; table-layout: fixed; border: 1px solid #e2e8f0;">
            <thead>
                <tr style="background-color: #f8fafc;">
                    <th style="padding: 6px 2px; border: 1px solid #e2e8f0; width: 65px; color: #475569; font-weight: 800; background: #f1f5f9;">ARAÇ</th>
                    <th style="padding: 6px 2px; border: 1px solid #e2e8f0; width: 45px; color: #475569; font-weight: 800; background: #f1f5f9;">TÜR</th>`;
    
    for(let i=1; i<=dim; i++) h += `<th style="border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; text-align: center;">${i}</th>`;
    h += `<th style="border: 1px solid #e2e8f0; width: 30px; background-color: #f1f5f9; font-weight: 900; color: #1e293b; text-align: center;">TOP</th></tr></thead><tbody>`;

    const sOwner = (document.getElementById('filter-owner')?.value || 'Tümü').toUpperCase();
    const rowsToPrint = isolatedAraclar.filter(a => (sId === 'ALL' || a.id.toString() === sId) && (sOwner === 'TÜMÜ' || (a.mulkiyet || 'Diğer').toUpperCase() === sOwner));
    const isD = headersTitle.toLowerCase().includes('dikkan');
    let cV = new Array(dim+1).fill(0), cT = new Array(dim+1).fill(0), cM = new Array(dim+1).fill(0);

    rowsToPrint.forEach(arac => {
        let rV = 0, rT = 0, rM = 0, hasData = false;
        let vH = `<tr style="page-break-inside: avoid;"><td rowspan="${isD?3:2}" style="border: 1px solid #e2e8f0; font-weight: 800; text-align: center; color: #0f172a; background: #fff; font-size: 9px;">${arac.plaka}</td><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Vardiya</td>`;
        let tH = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Tek</td>`;
        let mH = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Mesai</td>`;
        
        for(let i=1; i<=dim; i++) {
            const dc = `${y}-${mStr}-${String(i).padStart(2,'0')}`;
            const v = document.getElementById(`cell-${arac.id}-${dc}-vardiya`)?.value || '';
            const t = document.getElementById(`cell-${arac.id}-${dc}-tek`)?.value || '';
            const n = document.getElementById(`cell-${arac.id}-${dc}-mesai`)?.value || '';
            if(v||t||n) hasData = true;
            if(!isNaN(parseInt(v))) { rV+=parseInt(v); cV[i]+=parseInt(v); }
            if(!isNaN(parseInt(t))) { rT+=parseInt(t); cT[i]+=parseInt(t); }
            if(!isNaN(parseInt(n))) { rM+=parseInt(n); cM[i]+=parseInt(n); }
            const st = (val) => {
                if(val === 'X') return 'background: #fee2e2; color: #991b1b; font-weight: 800;';
                if(val === 'R') return 'background: #fef3c7; color: #92400e; font-weight: 800;';
                if(val === 'İ' || val === 'I') return 'background: #f3e8ff; color: #6b21a8; font-weight: 800;';
                return '';
            };
            vH += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; ${st(v)}">${v}</td>`;
            tH += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; ${st(t)}">${t}</td>`;
            mH += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155;">${n}</td>`;
        }
        if(hasData) {
            vH += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #4f46e5;">${rV}</td></tr>`;
            tH += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #ea580c;">${rT}</td></tr>`;
            mH += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #059669;">${rM}</td></tr>`;
            h += vH + tH + (isD?mH:'');
        }
    });

    // Alt Toplam Satırları
    let sV = 0, sT = 0, sG = 0;
    
    // Vardiya Toplamı Satırı
    let vSumRow = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #f8fafc; font-size: 7px; color: #64748b; text-transform: uppercase;">Vardiya Top.:</td>`;
    for(let i=1; i<=dim; i++) { vSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: 700;">${cV[i]}</td>`; sV += cV[i]; }
    vSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #e0e7ff; color: #4338ca;">${sV}</td></tr>`;
    
    // Tek Sefer Toplamı Satırı
    let tSumRow = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #f8fafc; font-size: 7px; color: #64748b; text-transform: uppercase;">Tek Top.:</td>`;
    for(let i=1; i<=dim; i++) { tSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: 700;">${cT[i]}</td>`; sT += cT[i]; }
    tSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #ffedd5; color: #c2410c;">${sT}</td></tr>`;
    
    // Genel Toplam Satırı
    let gSumRow = `<tr style="background: #1e293b; color: white;"><td colspan="2" style="border: 1px solid #334155; padding: 5px; text-align: right; font-weight: 900; font-size: 8px; text-transform: uppercase; letter-spacing: 1px;">Genel Toplam:</td>`;
    for(let i=1; i<=dim; i++) { gSumRow += `<td style="border: 1px solid #334155; text-align: center; font-weight: 800; font-size: 9px;">${cV[i] + cT[i] + cM[i]}</td>`; sG += (cV[i] + cT[i] + cM[i]); }
    gSumRow += `<td style="border: 1px solid #334155; text-align: center; font-weight: 900; background: #0f172a; color: #34d399; font-size: 10px;">${sG}</td></tr>`;

    h += vSumRow + tSumRow + gSumRow + `</tbody></table></div>`;

    const ps = document.getElementById('print-section');
    if(ps) {
        ps.innerHTML = '';
        const container = document.createElement('div');
        container.style.visibility = 'visible';
        container.innerHTML = h;
        ps.appendChild(container);
        setTimeout(() => { window.print(); }, 500);
    }
}

window.changeDonem = function() {
    const nd = document.getElementById('filter-donem').value;
    if (nd) { urlParams.set('ay', nd); window.location.search = urlParams.toString(); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPuantaj);
else initPuantaj();
