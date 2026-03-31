const urlParams = new URLSearchParams(window.location.search);
const musteriId = urlParams.get('musteri_id');
const monthStr = urlParams.get('ay'); // 'YYYY-MM'
const urlBolge = urlParams.get('bolge') || ''; // opsiyonel bölge param

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

        // Tüm kayıtları çek — bölge filtresi DB seviyesinde değil, client-side yapılır
        // Böylece dropdown değişince yeni sorgu atmadan anında filtrele
        const { data: qKayitlar, error: kayitErr } = await window.supabaseClient
            .from('musteri_servis_puantaj')
            .select('*')
            .eq('musteri_id', musteriId)
            .gte('tarih', startDate)
            .lte('tarih', endDate);

        if (kayitErr) throw kayitErr;
        isolatedKayitlar = qKayitlar || [];

        const isDikkan = musteriAdi.toLowerCase().includes('dikkan');

        // 2. O(1) Indexing for records
        kayitlarMap = {};
        isolatedKayitlar.forEach(k => {
            let b = k.bolge || (isDikkan ? 'İzmir' : 'Manisa');
            if (isDikkan) b = 'İzmir';
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_vardiya`]    = (k.vardiya === 0 || k.vardiya === '0') ? '' : (k.vardiya || '');
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_tek`]        = (k.tek === 0 || k.tek === '0') ? '' : (k.tek || '');
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_cikis_8`]   = (k.cikis_8 === 0 || k.cikis_8 === '0') ? '' : (k.cikis_8 || '');
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_giris_2030`] = (k.giris_2030 === 0 || k.giris_2030 === '0') ? '' : (k.giris_2030 || '');
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_mesai`]      = (k.mesai === 0 || k.mesai === '0') ? '' : (k.mesai || '');
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_id`]         = k.id;
            kayitlarMap[`${k.arac_id}_${k.tarih}_${b}_bolge`]      = b;
            
            if (isDikkan) k.bolge = 'İzmir';
        });

        // ⭐ Gruplama: arac_id + bolge kombinasyonu — aynı plaka İzmir ve Manisa için ayrı satır
        const seenKeys = new Set();
        isolatedAraclar = [];
        for (const t of tanimlar) {
            if (t.araclar && t.araclar.id) {
                // Bu araç için kac farkli bolge var?
                const aracBolgeler = [...new Set(
                    isolatedKayitlar
                        .filter(k => k.arac_id === t.araclar.id)
                        .map(k => k.bolge || (isDikkan ? 'İzmir' : 'Manisa'))
                )];
                // Kaydı olmayan ama tanimda olan araçlar için en az bir satır goster
                if (aracBolgeler.length === 0) aracBolgeler.push(isDikkan ? 'İzmir' : 'Manisa');
                for (const bolge of aracBolgeler) {
                    const key = `${t.araclar.id}|${bolge}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        isolatedAraclar.push({
                            id:      t.araclar.id,
                            plaka:   t.araclar.plaka,
                            mulkiyet: t.araclar.mulkiyet_durumu,
                            bolge:   bolge
                        });
                    }
                }
            }
        }

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
        const colV  = new Array(daysInMonth + 1).fill(0);
        const colT  = new Array(daysInMonth + 1).fill(0);
        const colC8 = new Array(daysInMonth + 1).fill(0); // 8 Çıkışı
        const colG2 = new Array(daysInMonth + 1).fill(0); // 20:30 Girişi
        const colM  = new Array(daysInMonth + 1).fill(0);

        isolatedAraclar.forEach((arac, index) => {
            const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
            const rowSpan = isDikkan ? 5 : 2;
            let rowVardiyaTotal = 0, rowTekTotal = 0, rowCikis8Total = 0, rowGiris2030Total = 0, rowMesaiTotal = 0;

            // Pre-calculate visibility and filter
            const hasDataInMonth = isolatedKayitlar.some(k => 
                k.arac_id === arac.id && 
                (k.bolge || (isDikkan ? 'İzmir' : 'Manisa')) === arac.bolge && 
                (Boolean(k.vardiya) || Boolean(k.tek))
            );
            const dataStr = hasDataInMonth ? 'true' : 'false';
            const aracBolge = arac.bolge; // ⭐ Artık objeden geliyor

            // Bölge badge HTML
            const isIzmir = aracBolge === 'İzmir';
            const bolgeBadge = `<span style="display:block;font-size:8px;font-weight:900;letter-spacing:0.05em;margin-top:2px;padding:1px 4px;border-radius:4px;${
                isIzmir
                    ? 'background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3)'
                    : 'background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.3)'
            }">${isIzmir ? '🔵' : '🟠'} ${aracBolge}</span>`;

            // --- VARDİYA ROW ---
            let vRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}" data-bolge="${aracBolge}">
                <td class="sticky-col font-black text-slate-800 text-[11px] text-center brand-font" rowspan="${rowSpan}">${arac.plaka}${bolgeBadge}</td>
                <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Vardiya</td>`;

            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const tempVal = kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_vardiya`];
                const safeVal = (tempVal === 0 || tempVal === '0' || !tempVal) ? '' : String(tempVal);
                if (safeVal !== '' && !isNaN(parseInt(safeVal))) {
                    const vNum = parseInt(safeVal);
                    rowVardiyaTotal += vNum;
                    colV[i] += vNum;
                }

                isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_id`], arac_id: arac.id, tarih: dateCode, field: 'vardiya', bolge: aracBolge, val_original: safeVal, val_new: safeVal });

                const uv = safeVal.toUpperCase();
                let cellClass = (uv === 'X') ? 'cell-x' : (uv === 'R' ? 'cell-r' : ((uv === 'İ' || uv === 'I') ? 'cell-i' : ''));
                vRow += `<td class="${cellClass}"><input type="text" id="cell-${arac.id}-${aracBolge}-${dateCode}-vardiya" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'vardiya', ${i}, '${aracBolge}')"></td>`;
            }
            vRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-indigo-600 font-mono" id="total-${arac.id}-${aracBolge}-vardiya">${rowVardiyaTotal}</td></tr>`;
            tblHtml += vRow;

            // --- TEK ROW ---
            let tRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}" data-bolge="${aracBolge}">
                <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Tek Sefer</td>`;

            for (let i = 1; i <= daysInMonth; i++) {
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const tempVal = kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_tek`];
                const safeVal = (tempVal === 0 || tempVal === '0' || !tempVal) ? '' : String(tempVal);
                if (safeVal !== '' && !isNaN(parseInt(safeVal))) {
                    const tNum = parseInt(safeVal);
                    rowTekTotal += tNum;
                    colT[i] += tNum;
                }

                isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_id`], arac_id: arac.id, tarih: dateCode, field: 'tek', bolge: aracBolge, val_original: safeVal, val_new: safeVal });

                const uv = safeVal.toUpperCase();
                let cellClass = (uv === 'X') ? 'cell-x' : (uv === 'R' ? 'cell-r' : ((uv === 'İ' || uv === 'I') ? 'cell-i' : ''));
                tRow += `<td class="${cellClass}"><input type="text" id="cell-${arac.id}-${aracBolge}-${dateCode}-tek" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'tek', ${i}, '${aracBolge}')"></td>`;
            }
            tRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-orange-600 font-mono" id="total-${arac.id}-${aracBolge}-tek">${rowTekTotal}</td></tr>`;
            tblHtml += tRow;

            if (isDikkan) {
                // --- 8 ÇIKIŞI ROW ---
                let c8Row = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}" data-bolge="${aracBolge}">
                    <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-amber-500 text-center uppercase">8 Çıkışı</td>`;
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const val = kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_cikis_8`];
                    const safeVal = (val === 0 || val === '0' || !val) ? '' : String(val);
                    if (safeVal !== '' && !isNaN(parseInt(safeVal))) { const n = parseInt(safeVal); rowCikis8Total += n; colC8[i] += n; }
                    isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_id`], arac_id: arac.id, tarih: dateCode, field: 'cikis_8', bolge: aracBolge, val_original: safeVal, val_new: safeVal });
                    c8Row += `<td style="background:#fffbeb"><input type="text" id="cell-${arac.id}-${aracBolge}-${dateCode}-cikis_8" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'cikis_8', ${i}, '${aracBolge}')"></td>`;
                }
                c8Row += `<td class="sticky right-0 bg-amber-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-amber-600 font-mono" id="total-${arac.id}-${aracBolge}-cikis_8">${rowCikis8Total}</td></tr>`;
                tblHtml += c8Row;

                // --- 20:30 GİRİŞİ ROW ---
                let g2Row = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}" data-bolge="${aracBolge}">
                    <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-purple-500 text-center uppercase">20:30 Giriş</td>`;
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const val = kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_giris_2030`];
                    const safeVal = (val === 0 || val === '0' || !val) ? '' : String(val);
                    if (safeVal !== '' && !isNaN(parseInt(safeVal))) { const n = parseInt(safeVal); rowGiris2030Total += n; colG2[i] += n; }
                    isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_id`], arac_id: arac.id, tarih: dateCode, field: 'giris_2030', bolge: aracBolge, val_original: safeVal, val_new: safeVal });
                    g2Row += `<td style="background:#faf5ff"><input type="text" id="cell-${arac.id}-${aracBolge}-${dateCode}-giris_2030" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'giris_2030', ${i}, '${aracBolge}')"></td>`;
                }
                g2Row += `<td class="sticky right-0 bg-purple-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-purple-600 font-mono" id="total-${arac.id}-${aracBolge}-giris_2030">${rowGiris2030Total}</td></tr>`;
                tblHtml += g2Row;

                // --- MESAİ ROW ---
                let mRow = `<tr class="${rowClass}" data-arac-id="${arac.id}" data-has-data="${dataStr}" data-bolge="${aracBolge}">
                    <td class="sticky left-[100px] bg-inherit z-20 border-r-2 border-slate-200 text-[9px] font-bold text-slate-400 text-center uppercase">Mesai</td>`;
                for (let i = 1; i <= daysInMonth; i++) {
                    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                    const val = kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_mesai`];
                    const safeVal = (val === 0 || val === '0' || !val) ? '' : String(val);
                    if (safeVal !== '' && !isNaN(parseInt(safeVal))) { const mNum = parseInt(safeVal); rowMesaiTotal += mNum; colM[i] += mNum; }
                    isolatedGridData.push({ id: kayitlarMap[`${arac.id}_${dateCode}_${aracBolge}_id`], arac_id: arac.id, tarih: dateCode, field: 'mesai', bolge: aracBolge, val_original: safeVal, val_new: safeVal });
                    mRow += `<td><input type="text" id="cell-${arac.id}-${aracBolge}-${dateCode}-mesai" value="${safeVal}" class="puantaj-input uppercase" onchange="window.excelInputChanged('${arac.id}', 'mesai', ${i}, '${aracBolge}')"></td>`;
                }
                mRow += `<td class="sticky right-0 bg-slate-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-emerald-600 font-mono" id="total-${arac.id}-${aracBolge}-mesai">${rowMesaiTotal}</td></tr>`;
                tblHtml += mRow;
            }
        });

        // 4. Final Totals Generation (O(1) from arrays)
        let sumV = 0, sumT = 0, sumC8 = 0, sumG2 = 0, sumM = 0;
        let vSumRow = `<tr class="bg-slate-100 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-slate-500 uppercase tracking-widest">Vardiya Top.:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { vSumRow += `<td class="text-center text-xs text-slate-600" id="coltotal-vardiya-${i}">${colV[i]}</td>`; sumV += colV[i]; }
        vSumRow += `<td class="sticky right-0 bg-indigo-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-indigo-700 font-mono" id="grandtotal-vardiya">${sumV}</td></tr>`;
        
        let tSumRow = `<tr class="bg-slate-100 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-slate-500 uppercase tracking-widest">Tek Sefer Top.:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { tSumRow += `<td class="text-center text-xs text-slate-600" id="coltotal-tek-${i}">${colT[i]}</td>`; sumT += colT[i]; }
        tSumRow += `<td class="sticky right-0 bg-orange-50 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-orange-700 font-mono" id="grandtotal-tek">${sumT}</td></tr>`;

        // Dikkan'a özel Toplam satırları
        let c8SumRow = '';
        let g2SumRow = '';
        if (isDikkan) {
            c8SumRow = `<tr class="bg-amber-50 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-amber-600 uppercase tracking-widest">8 Çıkışı Top.:</td>`;
            for (let i = 1; i <= daysInMonth; i++) { c8SumRow += `<td class="text-center text-xs text-amber-600" id="coltotal-cikis8-${i}">${colC8[i]}</td>`; sumC8 += colC8[i]; }
            c8SumRow += `<td class="sticky right-0 bg-amber-100 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-amber-700 font-mono" id="grandtotal-cikis8">${sumC8}</td></tr>`;

            g2SumRow = `<tr class="bg-purple-50 font-bold total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-3 text-right text-[10px] text-purple-600 uppercase tracking-widest">20:30 Giriş Top.:</td>`;
            for (let i = 1; i <= daysInMonth; i++) { g2SumRow += `<td class="text-center text-xs text-purple-600" id="coltotal-giris2030-${i}">${colG2[i]}</td>`; sumG2 += colG2[i]; }
            g2SumRow += `<td class="sticky right-0 bg-purple-100 z-20 border-l-2 border-slate-200 text-center text-xs font-black text-purple-700 font-mono" id="grandtotal-giris2030">${sumG2}</td></tr>`;
        }

        let gSumRow = `<tr class="bg-slate-800 text-white font-black total-row"><td colspan="2" class="sticky left-0 bg-inherit z-20 border-r-2 border-slate-200 px-4 py-4 text-right text-[10px] uppercase tracking-widest">Genel Toplam:</td>`;
        for (let i = 1; i <= daysInMonth; i++) { gSumRow += `<td class="text-center text-xs" id="geneltotal-col-${i}">${colV[i] + colT[i] + colC8[i] + colG2[i] + colM[i]}</td>`; sumM += colM[i]; }
        gSumRow += `<td class="sticky right-0 bg-slate-900 z-20 border-l-2 border-slate-700 text-center text-sm font-mono" id="geneltotal-grand">${sumV + sumT + sumC8 + sumG2 + sumM}</td></tr>`;

        tbody.innerHTML = tblHtml + vSumRow + tSumRow + c8SumRow + g2SumRow + gSumRow;

        // ⭐ Plaka Filtresi: filter-arac dropdown'ını doldur
        const filterAracDropdown = document.getElementById('filter-arac-dropdown');
        if (filterAracDropdown) {
            const hiddenInput = document.getElementById('filter-arac');
            const searchInput = document.getElementById('filter-arac-input');
            const currentVal = hiddenInput ? hiddenInput.value : 'ALL';

            let htmlStr = `<div class="arac-option px-4 py-2.5 text-[10px] font-black text-indigo-600 uppercase tracking-widest cursor-pointer hover:bg-slate-50 border-b border-slate-100 transition-colors" data-plaka="" onclick="window.selectAracFilter('ALL', '')">TÜM ARAÇLAR</div>`;
            const seenPlates = new Set();
            isolatedAraclar.forEach(arac => {
                if (!seenPlates.has(arac.id)) {
                    seenPlates.add(arac.id);
                    htmlStr += `<div class="arac-option px-4 py-2 text-[10px] font-bold text-slate-600 uppercase cursor-pointer hover:bg-slate-50 hover:text-indigo-600 border-b border-slate-50 transition-colors" data-plaka="${arac.plaka}" onclick="window.selectAracFilter('${arac.id}', '${arac.plaka}')">${arac.plaka}</div>`;
                }
            });
            filterAracDropdown.innerHTML = htmlStr;

            // Eski seçimi geri yazdırma / input update
            if (currentVal && currentVal !== 'ALL') {
                const ar = isolatedAraclar.find(a => a.id.toString() === currentVal);
                if (ar && searchInput) {
                    searchInput.value = ar.plaka;
                }
            }
        }

        // Final Top Summary
        if (document.getElementById('summary-vardiya')) document.getElementById('summary-vardiya').textContent = sumV;
        if (document.getElementById('summary-tek'))     document.getElementById('summary-tek').textContent = sumT;
        if (document.getElementById('summary-genel'))   document.getElementById('summary-genel').textContent = sumV + sumT + sumC8 + sumG2 + sumM;

        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error("GRID LOAD ERROR:", e);
        tbody.innerHTML = `<tr><td colspan="33" class="p-8 text-center text-red-500 font-bold">Veri Çekme Hatası: ${e.message}</td></tr>`;
    }
}

window.excelInputChanged = function (aracId, type, day, bolge) {
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const inp = document.getElementById(`cell-${aracId}-${bolge}-${dateCode}-${type}`);
    if (!inp) return;
    let val = String(inp.value).trim().toUpperCase();
    inp.value = val;
    const dataObj = isolatedGridData.find(d => d.arac_id === aracId && d.tarih === dateCode && d.field === type && d.bolge === bolge);
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
    let gV = 0, gT = 0, gC8 = 0, gG2 = 0, gM = 0;
    
    // Day Totals (Columns)
    for (let i = 1; i <= daysInMonth; i++) {
        let colV = 0, colT = 0, colC8 = 0, colG2 = 0, colM = 0;
        const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        isolatedAraclar.forEach(arac => {
            const b = arac.bolge;
            const vInp  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-vardiya`);
            const tInp  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-tek`);
            const c8Inp = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-cikis_8`);
            const g2Inp = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-giris_2030`);
            const mInp  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-mesai`);
            if (vInp  && !isNaN(parseInt(vInp.value)))  colV  += parseInt(vInp.value);
            if (tInp  && !isNaN(parseInt(tInp.value)))  colT  += parseInt(tInp.value);
            if (c8Inp && !isNaN(parseInt(c8Inp.value))) colC8 += parseInt(c8Inp.value);
            if (g2Inp && !isNaN(parseInt(g2Inp.value))) colG2 += parseInt(g2Inp.value);
            if (mInp  && !isNaN(parseInt(mInp.value)))  colM  += parseInt(mInp.value);
        });
        const vEl   = document.getElementById(`coltotal-vardiya-${i}`);
        const tEl   = document.getElementById(`coltotal-tek-${i}`);
        const c8El  = document.getElementById(`coltotal-cikis8-${i}`);
        const g2El  = document.getElementById(`coltotal-giris2030-${i}`);
        const gEl   = document.getElementById(`geneltotal-col-${i}`);
        if(vEl)  vEl.textContent  = colV;
        if(tEl)  tEl.textContent  = colT;
        if(c8El) c8El.textContent = colC8;
        if(g2El) g2El.textContent = colG2;
        if(gEl)  gEl.textContent  = colV + colT + colC8 + colG2 + colM;
        gV += colV; gT += colT; gC8 += colC8; gG2 += colG2; gM += colM;
    }
    
    // Vehicle Totals (Rows)
    isolatedAraclar.forEach(arac => {
        let rV = 0, rT = 0, rC8 = 0, rG2 = 0, rM = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const b = arac.bolge;
            const vVal  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-vardiya`)?.value;
            const tVal  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-tek`)?.value;
            const c8Val = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-cikis_8`)?.value;
            const g2Val = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-giris_2030`)?.value;
            const mVal  = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-mesai`)?.value;
            if(!isNaN(parseInt(vVal)))  rV  += parseInt(vVal);
            if(!isNaN(parseInt(tVal)))  rT  += parseInt(tVal);
            if(!isNaN(parseInt(c8Val))) rC8 += parseInt(c8Val);
            if(!isNaN(parseInt(g2Val))) rG2 += parseInt(g2Val);
            if(!isNaN(parseInt(mVal)))  rM  += parseInt(mVal);
        }
        const vT  = document.getElementById(`total-${arac.id}-${arac.bolge}-vardiya`);
        const tT  = document.getElementById(`total-${arac.id}-${arac.bolge}-tek`);
        const c8T = document.getElementById(`total-${arac.id}-${arac.bolge}-cikis_8`);
        const g2T = document.getElementById(`total-${arac.id}-${arac.bolge}-giris_2030`);
        const mT  = document.getElementById(`total-${arac.id}-${arac.bolge}-mesai`);
        if(vT)  vT.textContent  = rV;
        if(tT)  tT.textContent  = rT;
        if(c8T) c8T.textContent = rC8;
        if(g2T) g2T.textContent = rG2;
        if(mT)  mT.textContent  = rM;
    });

    if (document.getElementById('summary-vardiya')) document.getElementById('summary-vardiya').textContent = gV;
    if (document.getElementById('summary-tek'))     document.getElementById('summary-tek').textContent     = gT;
    if (document.getElementById('summary-genel'))   document.getElementById('summary-genel').textContent   = gV + gT + gC8 + gG2 + gM;
    if (document.getElementById('grandtotal-vardiya')) document.getElementById('grandtotal-vardiya').textContent = gV;
    if (document.getElementById('grandtotal-tek'))     document.getElementById('grandtotal-tek').textContent     = gT;
    if (document.getElementById('grandtotal-cikis8'))  document.getElementById('grandtotal-cikis8').textContent  = gC8;
    if (document.getElementById('grandtotal-giris2030')) document.getElementById('grandtotal-giris2030').textContent = gG2;
    if (document.getElementById('geneltotal-grand'))   document.getElementById('geneltotal-grand').textContent   = gV + gT + gC8 + gG2 + gM;
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
                const b = arac.bolge;
                const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const inp = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-vardiya`);
                if (inp && !inp.value) { inp.value = '1'; window.excelInputChanged(arac.id, 'vardiya', i, b); }
            });
        }
    }
}

window.bulkFillAll = function () {
    const fillVal = document.getElementById('bulk-fill-value')?.value || '1';
    if (!confirm(`Tüm araçların boş hücrelerine '${fillVal}' eklenecek. Onaylıyor musunuz?`)) return;
    const [year, mStr] = monthStr.split('-');
    const ay = parseInt(mStr, 10);
    const daysInMonth = new Date(year, ay, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
        isolatedAraclar.forEach(arac => {
            const b = arac.bolge;
            const dateCode = `${year}-${String(ay).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const inp = document.getElementById(`cell-${arac.id}-${b}-${dateCode}-vardiya`);
            if (inp && !inp.value) { inp.value = fillVal; window.excelInputChanged(arac.id, 'vardiya', i, b); }
        });
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
        const isDikkan = document.getElementById('header-title').textContent.toLowerCase().includes('dikkan');
        // ⭐ FIX: bolge referansını fallback ile kur, böylece eski kayıtlarda duplicate oluşmaz
        isolatedKayitlar.forEach(k => { 
            const b = k.bolge || (isDikkan ? 'İzmir' : 'Manisa');
            dbMap[`${k.arac_id}_${k.tarih}_${b}`] = k; 
        });
        toSaveOrUpdate.forEach(item => {
            // ⭐ FIX: item.bolge aracBolge olarak grid'den geldiği için her zaman dolu
            const key = `${item.arac_id}_${item.tarih}_${item.bolge}`;
            if (!updatesByDateAndVehicle[key]) {
                updatesByDateAndVehicle[key] = { ...(dbMap[key] || {
                    musteri_id: musteriId, arac_id: item.arac_id, tarih: item.tarih,
                    // ⭐ FIX: yeni kayıtta bolge alanını da kaydet
                    bolge: item.bolge || '',
                    vardiya: '', tek: '', cikis_8: 0, giris_2030: 0, mesai: 0
                }) };
            }
            if (item.field === 'vardiya')    updatesByDateAndVehicle[key].vardiya    = item.val_new;
            if (item.field === 'tek')        updatesByDateAndVehicle[key].tek        = item.val_new;
            if (item.field === 'cikis_8')    updatesByDateAndVehicle[key].cikis_8   = !item.val_new ? 0 : (parseInt(item.val_new) || 0);
            if (item.field === 'giris_2030') updatesByDateAndVehicle[key].giris_2030 = !item.val_new ? 0 : (parseInt(item.val_new) || 0);
            if (item.field === 'mesai')      updatesByDateAndVehicle[key].mesai      = !item.val_new ? 0 : (parseInt(item.val_new) || 0);
        });
        const upsertArray = [], deleteIds = [];
        Object.values(updatesByDateAndVehicle).forEach(item => {
            if (!item.vardiya && !item.tek && !item.cikis_8 && !item.giris_2030 && !item.mesai && item.id) deleteIds.push(item.id);
            else { if (!item.id) delete item.id; upsertArray.push(item); }
        });
        if (upsertArray.length > 0) { const { error: ue } = await window.supabaseClient.from('musteri_servis_puantaj').upsert(upsertArray); if (ue) throw ue; }
        if (deleteIds.length > 0) { const { error: de } = await window.supabaseClient.from('musteri_servis_puantaj').delete().in('id', deleteIds); if (de) throw de; }
        alert(`Mükemmel! Kaydedildi.`); window.location.reload();
    } catch (e) { alert('Hata: ' + e.message); btn.innerHTML = ogHtml; }
}

window.filterPuantaj = function() {
    const filterAracEl = document.getElementById('filter-arac');
    const sId    = filterAracEl?.value || 'ALL';
    const sOwner = (document.getElementById('filter-owner')?.value || 'Tümü').toUpperCase();
    const sBolge = document.getElementById('filter-bolge')?.value || '';

    document.querySelectorAll('#excel-tbody tr[data-arac-id]').forEach(tr => {
        const aId     = tr.getAttribute('data-arac-id');
        const trBolge = tr.getAttribute('data-bolge') || '';
        const hasData = tr.getAttribute('data-has-data') === 'true';

        const arac = isolatedAraclar.find(a => a.id.toString() === aId && a.bolge === trBolge);
        const aMulkiyet = (arac?.mulkiyet || 'Diğer').toUpperCase();

        // Plaka filtresi: sadece arac_id eşleşmesi (bölge farkı gözetmez)
        const mV = (sId === 'ALL' || aId === sId);
        const mO = (sOwner === 'TÜMÜ' || aMulkiyet === sOwner);
        // Bölge filtresi: üstteki dropdown'dan ayrı kontrol edilir
        const mB = (!sBolge || trBolge === sBolge);

        // Varsayılan görünüm: Filtrelere uyan tüm kayıtlar gösterilir
        const show = mV && mO && mB;
        tr.style.display = show ? '' : 'none';
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
    const sBolge = document.getElementById('filter-bolge')?.value || '';

    // Aktif filtrelere göre yazdırılacak araçları belirle (bölge filtresi dahil)
    const rowsToPrint = isolatedAraclar.filter(a => {
        const mV = (sId === 'ALL' || a.id.toString() === sId);
        const mO = (sOwner === 'TÜMÜ' || (a.mulkiyet || 'Diğer').toUpperCase() === sOwner);
        const mB = (!sBolge || a.bolge === sBolge);
        return mV && mO && mB;
    });

    const isD = headersTitle.toLowerCase().includes('dikkan');
    let cV = new Array(dim+1).fill(0), cT = new Array(dim+1).fill(0);
    let cC8 = new Array(dim+1).fill(0), cG2 = new Array(dim+1).fill(0);
    let cM = new Array(dim+1).fill(0);

    rowsToPrint.forEach(arac => {
        const b = arac.bolge;
        const isIzmir = b === 'İzmir';
        const bolgeStyle = isIzmir
            ? 'background:rgba(59,130,246,0.1);color:#1d4ed8;'
            : 'background:rgba(249,115,22,0.1);color:#c2410c;';
        const bolgeText = (isIzmir ? '🔵 ' : '🟠 ') + b;

        let rV = 0, rT = 0, rC8 = 0, rG2 = 0, rM = 0, hasData = false;
        let vH  = `<tr style="page-break-inside: avoid;"><td rowspan="${isD?5:2}" style="border: 1px solid #e2e8f0; font-weight: 800; text-align: center; color: #0f172a; background: #fff; font-size: 9px;">${arac.plaka}<br><span style="font-size:7px;font-weight:900;padding:1px 3px;border-radius:3px;${bolgeStyle}">${bolgeText}</span></td><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Vardiya</td>`;
        let tH  = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Tek</td>`;
        let c8H = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #d97706; background-color: #fffbeb; font-weight: 700; font-size: 7px; text-transform: uppercase;">8 Çıkışı</td>`;
        let g2H = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #7c3aed; background-color: #faf5ff; font-weight: 700; font-size: 7px; text-transform: uppercase;">20:30 Giriş</td>`;
        let mH  = `<tr style="page-break-inside: avoid;"><td style="border: 1px solid #e2e8f0; padding: 4px; color: #64748b; background-color: #f8fafc; font-weight: 700; font-size: 7px; text-transform: uppercase;">Mesai</td>`;
        
        for(let i=1; i<=dim; i++) {
            const dc = `${y}-${mStr}-${String(i).padStart(2,'0')}`;
            // ⭐ Doğru cell ID formatı: cell-{arac_id}-{bolge}-{dateCode}-{field}
            const v  = document.getElementById(`cell-${arac.id}-${b}-${dc}-vardiya`)?.value    || '';
            const t  = document.getElementById(`cell-${arac.id}-${b}-${dc}-tek`)?.value        || '';
            const c8 = document.getElementById(`cell-${arac.id}-${b}-${dc}-cikis_8`)?.value    || '';
            const g2 = document.getElementById(`cell-${arac.id}-${b}-${dc}-giris_2030`)?.value || '';
            const n  = document.getElementById(`cell-${arac.id}-${b}-${dc}-mesai`)?.value      || '';
            if(v||t||c8||g2||n) hasData = true;
            if(!isNaN(parseInt(v)))  { rV  += parseInt(v);  cV[i]  += parseInt(v); }
            if(!isNaN(parseInt(t)))  { rT  += parseInt(t);  cT[i]  += parseInt(t); }
            if(!isNaN(parseInt(c8))) { rC8 += parseInt(c8); cC8[i] += parseInt(c8); }
            if(!isNaN(parseInt(g2))) { rG2 += parseInt(g2); cG2[i] += parseInt(g2); }
            if(!isNaN(parseInt(n)))  { rM  += parseInt(n);  cM[i]  += parseInt(n); }
            const st = (val) => {
                if(val === 'X') return 'background: #fee2e2; color: #991b1b; font-weight: 800;';
                if(val === 'R') return 'background: #fef3c7; color: #92400e; font-weight: 800;';
                if(val === 'İ' || val === 'I') return 'background: #f3e8ff; color: #6b21a8; font-weight: 800;';
                return '';
            };
            vH  += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; ${st(v)}">${v}</td>`;
            tH  += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; ${st(t)}">${t}</td>`;
            c8H += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #d97706; background:#fffbeb;">${c8}</td>`;
            g2H += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #7c3aed; background:#faf5ff;">${g2}</td>`;
            mH  += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155;">${n}</td>`;
        }
        const shouldPrint = (sId !== 'ALL' || sOwner !== 'TÜMÜ' || sBolge || hasData);
        if(shouldPrint) {
            vH  += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #4f46e5;">${rV}</td></tr>`;
            tH  += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #ea580c;">${rT}</td></tr>`;
            c8H += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #fffbeb; color: #d97706;">${rC8}</td></tr>`;
            g2H += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #faf5ff; color: #7c3aed;">${rG2}</td></tr>`;
            mH  += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 800; background: #f1f5f9; color: #059669;">${rM}</td></tr>`;
            h += vH + tH + (isD ? c8H + g2H + mH : '');
        }
    });

    // Alt Toplam Satırları
    let sV = 0, sT = 0, sC8 = 0, sG2 = 0, sGrand = 0;
    
    // Vardiya Toplamı Satırı
    let vSumRow = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #f8fafc; font-size: 7px; color: #64748b; text-transform: uppercase;">Vardiya Top.:</td>`;
    for(let i=1; i<=dim; i++) { vSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: 700;">${cV[i]}</td>`; sV += cV[i]; }
    vSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #e0e7ff; color: #4338ca;">${sV}</td></tr>`;
    
    // Tek Sefer Toplamı Satırı
    let tSumRow = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #f8fafc; font-size: 7px; color: #64748b; text-transform: uppercase;">Tek Top.:</td>`;
    for(let i=1; i<=dim; i++) { tSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #334155; font-weight: 700;">${cT[i]}</td>`; sT += cT[i]; }
    tSumRow += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #ffedd5; color: #c2410c;">${sT}</td></tr>`;

    // Dikkan's 8 Çıkışı ve 20:30 Girişi satırları (sadece print'te de)
    let c8SumPrint = '';
    let g2SumPrint = '';
    if (isD) {
        c8SumPrint = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #fffbeb; font-size: 7px; color: #d97706; text-transform: uppercase;">8 Çıkışı Top.:</td>`;
        for(let i=1; i<=dim; i++) { c8SumPrint += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #d97706; font-weight: 700;">${cC8[i]}</td>`; sC8 += cC8[i]; }
        c8SumPrint += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #fef3c7; color: #b45309;">${sC8}</td></tr>`;

        g2SumPrint = `<tr><td colspan="2" style="border: 1px solid #e2e8f0; padding: 4px; text-align: right; font-weight: 800; background: #faf5ff; font-size: 7px; color: #7c3aed; text-transform: uppercase;">20:30 Giriş Top.:</td>`;
        for(let i=1; i<=dim; i++) { g2SumPrint += `<td style="border: 1px solid #e2e8f0; text-align: center; color: #7c3aed; font-weight: 700;">${cG2[i]}</td>`; sG2 += cG2[i]; }
        g2SumPrint += `<td style="border: 1px solid #e2e8f0; text-align: center; font-weight: 900; background: #ede9fe; color: #6d28d9;">${sG2}</td></tr>`;
    } else {
        // Non-Dikkan: sum up colM
        for(let i=1; i<=dim; i++) { /* already accumulated colM above */ }
    }

    // Genel Toplam Satırı
    let gSumRow = `<tr style="background: #1e293b; color: white;"><td colspan="2" style="border: 1px solid #334155; padding: 5px; text-align: right; font-weight: 900; font-size: 8px; text-transform: uppercase; letter-spacing: 1px;">Genel Toplam:</td>`;
    for(let i=1; i<=dim; i++) { const tot = cV[i] + cT[i] + cC8[i] + cG2[i] + cM[i]; gSumRow += `<td style="border: 1px solid #334155; text-align: center; font-weight: 800; font-size: 9px;">${tot}</td>`; sGrand += tot; }
    gSumRow += `<td style="border: 1px solid #334155; text-align: center; font-weight: 900; background: #0f172a; color: #34d399; font-size: 10px;">${sGrand}</td></tr>`;

    h += vSumRow + tSumRow + c8SumPrint + g2SumPrint + gSumRow + `</tbody></table></div>`;

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

// Araca Özel Custom Dropdown Event'leri
window.openAracDropdown = function() {
    const el = document.getElementById('filter-arac-dropdown');
    if(el) {
        el.classList.remove('hidden', 'scale-95', 'opacity-0');
        el.classList.add('flex', 'scale-100', 'opacity-100');
    }
}
window.closeAracDropdown = function() {
    const el = document.getElementById('filter-arac-dropdown');
    if(!el) return;
    el.classList.remove('flex', 'scale-100', 'opacity-100');
    el.classList.add('hidden', 'scale-95', 'opacity-0');
    
    // Eğer Input'ta yazılı olan metin silinmiş ama hidden value hala id ise metni geri getir
    const hi = document.getElementById('filter-arac');
    const input = document.getElementById('filter-arac-input');
    if (hi && input) {
        if (hi.value === 'ALL') {
            input.value = '';
        } else {
            const ar = isolatedAraclar.find(a => a.id.toString() === hi.value);
            if (ar) input.value = ar.plaka;
        }
    }
}
window.filterAracOptions = function() {
    const search = document.getElementById('filter-arac-input').value.toUpperCase();
    document.querySelectorAll('#filter-arac-dropdown .arac-option').forEach(opt => {
        const plaka = opt.getAttribute('data-plaka') || '';
        if (plaka === '') {
            opt.style.display = search === '' ? 'block' : 'none';
        } else {
            opt.style.display = plaka.includes(search) ? 'block' : 'none';
        }
    });
}
window.selectAracFilter = function(id, plaka) {
    document.getElementById('filter-arac').value = id;
    document.getElementById('filter-arac-input').value = plaka;
    document.getElementById('filter-arac').dispatchEvent(new Event('change'));
}
