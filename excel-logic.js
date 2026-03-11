window.hesaplaYakit = function () {
    const litre = parseFloat(document.getElementById('yakit-litre').value) || 0;
    const fiyat = parseFloat(document.getElementById('yakit-fiyat').value) || 0;
    document.getElementById('yakit-tutar').value = (litre * fiyat).toFixed(2);
}
async function loadExcelGrid() {
    const musteriId = document.getElementById('excel-musteri-sec').value;
    const ayYil = document.getElementById('excel-ay-sec').value; // "YYYY-MM"

    if (!musteriId || !ayYil) {
        alert("Lütfen önce bir müşteri ve ay seçiniz.");
        return;
    }

    const thead = document.getElementById('excel-thead');
    const tbody = document.getElementById('excel-tbody');
    const saveBtn = document.getElementById('excel-save-btn');

    tbody.innerHTML = '<tr><td colspan="33" class="px-4 py-8 text-center text-sm text-gray-400">Yükleniyor...</td></tr>';

    try {
        // Bu müşteriye tanımlanmış araçları çek
        const { data: tanimlar, error: tanimErr } = await supabaseClient
            .from('musteri_arac_tanimlari')
            .select('*, araclar(id, plaka)')
            .eq('musteri_id', musteriId);

        if (tanimErr) throw tanimErr;

        if (!tanimlar || tanimlar.length === 0) {
            tbody.innerHTML = '<tr><td colspan="33" class="px-4 py-8 text-center text-sm text-gray-400">Bu müşteriye tanımlanmış hiçbir araç bulunmuyor. Önce "+ Araç Tanımla" butonundan araç ekleyiniz.</td></tr>';
            saveBtn.classList.add('hidden');
            return;
        }

        // Araçları Alfabetik Sırala
        const tumAraclarData = tanimlar.map(t => t.araclar).filter(a => a != null);
        // Remove duplicates if any vehicle is assigned twice (shouldn't happen but defensive)
        const uniqueAraclarMap = new Map();
        tumAraclarData.forEach(a => uniqueAraclarMap.set(a.id, a));
        const tumAraclar = Array.from(uniqueAraclarMap.values()).sort((a, b) => a.plaka.localeCompare(b.plaka));

        const [yearStr, monthStr] = ayYil.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const daysInMonth = new Date(year, month, 0).getDate();

        const startDate = `${year}-${monthStr}-01`;
        const endDate = `${year}-${monthStr}-${daysInMonth}`;

        // DB'den o aya ait puantaj kayıtlarını çek
        const { data: kayitlar, error: kayitErr } = await supabaseClient
            .from('musteri_servis_puantaj')
            .select('*')
            .eq('musteri_id', musteriId)
            .gte('tarih', startDate)
            .lte('tarih', endDate);
        if (kayitErr) throw kayitErr;

        // Başlık (Thead)
        let thHtml = '<tr><th class="px-3 py-2.5 text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 w-[120px] min-w-[120px] border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">ARAÇ (V/T)</th>';
        for (let i = 1; i <= daysInMonth; i++) {
            thHtml += `<th class="p-0 py-2.5 text-center text-[11px] font-semibold text-slate-600 border-l border-b border-slate-200 w-[38px] min-w-[38px]">${i}</th>`;
        }
        thHtml += '<th class="px-0 py-2.5 text-center text-[10px] font-bold text-slate-600 border-l border-b border-slate-200 uppercase tracking-wider sticky right-0 bg-slate-50 z-10 w-[45px] min-w-[45px] shadow-[-1px_0_0_0_#e2e8f0]">TOP</th></tr>';
        thead.innerHTML = thHtml;

        let tblHtml = '';
        excelCurrentData = [];

        // Tablo Gövdesi (Tbody)
        tumAraclar.forEach((arac, index) => {
            const bgPlaka = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40';

            // --- VARDİYA SATIRI ---
            tblHtml += `<tr class="hover:bg-blue-50/40 transition-colors">`;
            tblHtml += `<td class="px-3 py-1.5 text-[11px] font-medium text-slate-800 sticky left-0 ${bgPlaka} z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] leading-tight min-w-[120px] max-w-[120px]" rowspan="2">
                            <div class="font-bold text-slate-900 truncate" title="${arac.plaka}">${arac.plaka}</div>
                            <div class="text-[9px] text-slate-500 mt-1.5 flex justify-between pr-1"><span>Vardiya:</span></div>
                            <div class="text-[9px] text-slate-500 mt-1 flex justify-between pr-1"><span>Tek Sfr:</span></div>
                        </td>`;

            let rowVardiyaTotal = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dayStr = i < 10 ? '0' + i : '' + i;
                const dateCode = `${year}-${monthStr}-${dayStr}`;

                const record = kayitlar.find(k => k.arac_id === arac.id && k.tarih === dateCode);
                const val = record ? (record.vardiya || '') : '';
                if (record && !isNaN(parseInt(val))) rowVardiyaTotal += parseInt(val);

                const inpid = `cell-${arac.id}-${dateCode}-vardiya`;
                excelCurrentData.push({ id: record ? record.id : null, arac_id: arac.id, tarih: dateCode, field: 'vardiya', val_original: val });

                let bgClass = 'bg-transparent text-slate-700';
                if (val.toUpperCase() === 'X') bgClass = 'bg-red-50 text-red-600 font-bold';
                else if (val.toUpperCase() === 'R') bgClass = 'bg-amber-50 text-amber-600 font-bold';
                else if (val.toUpperCase() === 'İ' || val.toUpperCase() === 'I') bgClass = 'bg-purple-50 text-purple-600 font-bold';
                else if (!isNaN(parseInt(val)) && parseInt(val) > 0) bgClass = 'bg-blue-50/60 text-blue-700 font-bold';

                tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="Vardiya" data-day="${i}" value="${val}"
                            class="w-full h-[26px] text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                            onchange="excelInputChanged('${arac.id}', 'Vardiya', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="total-${arac.id}-Vardiya">${rowVardiyaTotal}</td>`;
            tblHtml += `</tr>`;

            // --- TEK SEFER SATIRI ---
            tblHtml += `<tr class="hover:bg-orange-50/40 transition-colors">`;
            let rowTekTotal = 0;
            for (let i = 1; i <= daysInMonth; i++) {
                const dayStr = i < 10 ? '0' + i : '' + i;
                const dateCode = `${year}-${monthStr}-${dayStr}`;

                const record = kayitlar.find(k => k.arac_id === arac.id && k.tarih === dateCode);
                const val = record ? (record.tek || '') : '';
                if (record && !isNaN(parseInt(val))) rowTekTotal += parseInt(val);

                const inpid = `cell-${arac.id}-${dateCode}-tek`;
                excelCurrentData.push({ id: record ? record.id : null, arac_id: arac.id, tarih: dateCode, field: 'tek', val_original: val });

                let bgClass = 'bg-transparent text-slate-700';
                if (val.toUpperCase() === 'X') bgClass = 'bg-red-50 text-red-600 font-bold';
                else if (val.toUpperCase() === 'R') bgClass = 'bg-amber-50 text-amber-600 font-bold';
                else if (val.toUpperCase() === 'İ' || val.toUpperCase() === 'I') bgClass = 'bg-purple-50 text-purple-600 font-bold';
                else if (!isNaN(parseInt(val)) && parseInt(val) > 0) bgClass = 'bg-orange-50/60 text-orange-700 font-bold';

                tblHtml += `<td class="p-0 border-l border-b border-slate-200 align-middle">
                            <input type="text" id="${inpid}" data-arac="${arac.id}" data-type="Tek" data-day="${i}" value="${val}"
                            class="w-full h-[26px] text-center text-[11px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-orange-500 focus:bg-white p-0 m-0 border-none ${bgClass} transition-all"
                            onchange="excelInputChanged('${arac.id}', 'Tek', ${i})">
                        </td>`;
            }
            tblHtml += `<td class="px-0 py-0 text-center text-[11px] font-bold text-slate-700 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="total-${arac.id}-Tek">${rowTekTotal}</td>`;
            tblHtml += `</tr>`;
        });

        // Vardiya Toplam Satırı (Alt Toplamlar)
        tblHtml += `<tr class="bg-slate-50 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right">VARDİYA TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-bold text-slate-600 border-l border-b border-slate-200 bg-slate-50" id="coltotal-Vardiya-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-black text-slate-800 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-Vardiya">0</td>`;
        tblHtml += `</tr>`;

        // Tek Sefer Toplam Satırı (Alt Toplamlar)
        tblHtml += `<tr class="bg-slate-50">`;
        tblHtml += `<td class="px-3 py-2 text-[10px] font-bold text-slate-600 whitespace-nowrap sticky left-0 bg-slate-50 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#e2e8f0] text-right">TEK SEFER TOPLAM:</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-bold text-slate-600 border-l border-b border-slate-200 bg-slate-50" id="coltotal-Tek-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-2 text-center text-[11px] font-black text-slate-800 border-l border-b border-slate-200 bg-slate-50 sticky right-0 shadow-[-1px_0_0_0_#e2e8f0]" id="grandtotal-Tek">0</td>`;
        tblHtml += `</tr>`;

        // Genel Toplam Satırı (Günün Toplam Seferi)
        tblHtml += `<tr class="bg-slate-100 border-t-2 border-slate-300">`;
        tblHtml += `<td class="px-3 py-3 text-[11px] font-black text-slate-800 whitespace-nowrap sticky left-0 bg-slate-100 z-10 border-r border-b border-slate-200 shadow-[1px_0_0_0_#cbd5e1] text-right">GENEL (V+T):</td>`;
        for (let i = 1; i <= daysInMonth; i++) {
            tblHtml += `<td class="px-0 py-3 text-center text-[12px] font-bold text-slate-800 border-l border-b border-slate-200 bg-slate-100" id="geneltotal-col-${i}">0</td>`;
        }
        tblHtml += `<td class="px-0 py-3 text-center text-[12px] font-black text-slate-900 border-l border-b border-slate-200 bg-slate-100 sticky right-0 shadow-[-1px_0_0_0_#cbd5e1]" id="geneltotal-grand">0</td>`;
        tblHtml += `</tr>`;

        tbody.innerHTML = tblHtml;

        // Modal butonunu göster
        const openModalBtn = document.getElementById('btn-open-puantaj-modal');
        if (openModalBtn) openModalBtn.classList.remove('hidden');
        saveBtn.classList.remove('hidden');
        document.getElementById('excel-summary-cards').classList.remove('hidden');
        document.getElementById('excel-autofill-btn').classList.remove('hidden');
        document.getElementById('excel-print-btn').classList.remove('hidden');
        const legendEl = document.getElementById('puantaj-legend');
        if (legendEl) legendEl.classList.remove('hidden');

        // Initial Tabloları Hesapla
        recalculateAllTotals(daysInMonth);

        // Araç Bazlı Analizi Göster (Yeni)
        displayMusteriAracAnaliz(kayitlar, tanimlar);

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="33" class="px-4 py-8 text-center text-sm text-danger">Bağlantı Hatası: ${error.message}</td></tr>`;
    }
}
window.excelInputChanged = function (aracId, type, dayIndex) {
    // Sadece değişen hücrenin (input) rengini güncelle
    const inpid = `cell-${aracId}-` + (document.getElementById('excel-ay-sec').value) + '-' + (dayIndex < 10 ? '0' + dayIndex : dayIndex) + `-${type.toLowerCase()}`;
    const inp = document.getElementById(inpid);
    if (inp) {
        const val = inp.value.trim().toUpperCase();
        inp.classList.remove('bg-transparent', 'bg-red-100', 'text-danger', 'font-bold', 'bg-yellow-100', 'text-yellow-800', 'bg-purple-100', 'text-purple-800', 'bg-blue-50', 'text-blue-800', 'bg-orange-50', 'text-orange-800', 'text-gray-700');

        if (val === 'X') inp.classList.add('bg-red-100', 'text-danger', 'font-bold');
        else if (val === 'R') inp.classList.add('bg-yellow-100', 'text-yellow-800', 'font-bold');
        else if (val === 'İ' || val === 'I') inp.classList.add('bg-purple-100', 'text-purple-800', 'font-bold');
        else if (!isNaN(parseInt(val)) && parseInt(val) > 0) inp.classList.add(type === 'Vardiya' ? 'bg-blue-50' : 'bg-orange-50', type === 'Vardiya' ? 'text-blue-800' : 'text-orange-800', 'font-bold');
        else inp.classList.add('bg-transparent', 'text-gray-700');
    }

    // Update Row Total for that specific Type
    let rowT = 0;
    document.querySelectorAll(`input[data-arac="${aracId}"][data-type="${type}"]`).forEach(el => {
        if (!isNaN(parseInt(el.value))) rowT += parseInt(el.value);
    });
    const totalTd = document.getElementById(`total-${aracId}-${type}`);
    if (totalTd) totalTd.innerText = rowT;

    // Recalculate Column & Grand Totals
    const daysInMonth = new Date(
        document.getElementById('excel-ay-sec').value.split('-')[0],
        document.getElementById('excel-ay-sec').value.split('-')[1],
        0
    ).getDate();
    recalculateAllTotals(daysInMonth);
}
function recalculateAllTotals(daysInMonth) {
    const groups = ['Vardiya', 'Tek'];
    let absoluteGrandTotal = 0;
    let absoluteColTotals = new Array(daysInMonth + 1).fill(0);

    groups.forEach(groupName => {
        let groupGrandTotal = 0;
        for (let i = 1; i <= daysInMonth; i++) {
            let colT = 0;
            document.querySelectorAll(`input[data-type="${groupName}"][data-day="${i}"]`).forEach(inp => {
                if (!isNaN(parseInt(inp.value))) colT += parseInt(inp.value);
            });
            const colTd = document.getElementById(`coltotal-${groupName}-${i}`);
            if (colTd) colTd.innerText = colT || '';
            groupGrandTotal += colT;
            absoluteColTotals[i] += colT;
        }
        const gTd = document.getElementById(`grandtotal-${groupName}`);
        if (gTd) gTd.innerText = groupGrandTotal;
        absoluteGrandTotal += groupGrandTotal;
    });

    // Update General Totals
    for (let i = 1; i <= daysInMonth; i++) {
        const gcTd = document.getElementById(`geneltotal-col-${i}`);
        if (gcTd) gcTd.innerText = absoluteColTotals[i] || '';
    }
    const absGTd = document.getElementById(`geneltotal-grand`);
    if (absGTd) absGTd.innerText = absoluteGrandTotal;

    // Update Summary Cards
    const sumVar = document.getElementById('summary-vardiya');
    const sumTek = document.getElementById('summary-tek');
    const sumGenel = document.getElementById('summary-genel');
    if (sumVar) sumVar.innerText = document.getElementById('grandtotal-Vardiya') ? document.getElementById('grandtotal-Vardiya').innerText : 0;
    if (sumTek) sumTek.innerText = document.getElementById('grandtotal-Tek') ? document.getElementById('grandtotal-Tek').innerText : 0;
    if (sumGenel) sumGenel.innerText = absoluteGrandTotal;
}
window.autoFillWeekdays = function () {
    if (!confirm("Bu işlem tablodaki Pazar günleri HARİÇ tüm boş kutulara '1' yazacaktır. Onaylıyor musunuz?")) return;

    const ayYil = document.getElementById('excel-ay-sec').value;
    if (!ayYil) return;
    const [yearStr, monthStr] = ayYil.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const inputs = document.querySelectorAll('#excel-tbody input[type="text"]');
    inputs.forEach(inp => {
        const day = parseInt(inp.getAttribute('data-day'));
        const date = new Date(year, month - 1, day);
        // 0 is Sunday
        if (date.getDay() !== 0 && inp.value.trim() === '') {
            inp.value = '1';
            // Sadece değer atıyoruz, olayı tetiklememiz lazım
            const aracId = inp.getAttribute('data-arac');
            const groupName = inp.getAttribute('data-type');
            excelInputChanged(aracId, groupName, day);
        }
    });
}
window.saveExcelGrid = async function () {
    const musteriId = document.getElementById('excel-musteri-sec').value;
    const saveBtn = document.getElementById('excel-save-btn');

    saveBtn.innerHTML = 'Kaydediliyor...';
    saveBtn.disabled = true;

    try {
        if (supabaseUrl === 'YOUR_SUPABASE_URL') throw new Error("Supabase bilgileri eksik");
        const upsertsMap = new Map(); // key: "arac_id_tarih" -> {upsertObj}
        const deletes = new Set(); // store IDs to delete if both vardiya and tek are empty Strings AND had an ID before

        for (let data of excelCurrentData) {
            // Because one cell represents ONE field ('vardiya' or 'tek'), we look it up:
            const inpid = `cell-${data.arac_id}-${data.tarih}-${data.field}`;
            const inputEl = document.getElementById(inpid);
            if (!inputEl) continue;

            const newVal = inputEl.value.trim();
            const key = `${data.arac_id}_${data.tarih}`;

            // Differentiate logic: Initialize upsert map if not exists
            if (!upsertsMap.has(key)) {
                upsertsMap.set(key, {
                    id: data.id || undefined, // use existing row ID if modifying
                    musteri_id: musteriId,
                    arac_id: data.arac_id,
                    tarih: data.tarih,
                    vardiya: null,
                    tek: null,
                    gunluk_ucret: 0,
                    // Track if this row is entirely empty
                    _emptyVardiya: true,
                    _emptyTek: true,
                    _isModified: false,
                    _originalId: data.id
                });
            }
            const record = upsertsMap.get(key);

            // If ID wasn't set earlier but is present in another field's data object, set it
            if (!record.id && data.id) {
                record.id = data.id;
                record._originalId = data.id;
            }

            // Assign value for the current field
            if (data.field === 'vardiya') {
                record.vardiya = newVal;
                record._emptyVardiya = (newVal === '');
            } else if (data.field === 'tek') {
                record.tek = newVal;
                record._emptyTek = (newVal === '');
            }

            if (newVal !== (data.val_original || '').trim()) {
                record._isModified = true;
            }
        }

        const finalUpserts = [];
        const finalDeletes = [];

        for (const [key, record] of upsertsMap.entries()) {
            // Clean up temporary fields
            const emptyVardiya = record._emptyVardiya;
            const emptyTek = record._emptyTek;
            const isModified = record._isModified;
            const originalId = record._originalId;

            delete record._emptyVardiya;
            delete record._emptyTek;
            delete record._isModified;
            delete record._originalId;

            if (isModified) {
                if (emptyVardiya && emptyTek) {
                    if (originalId) finalDeletes.push(originalId);
                } else {
                    finalUpserts.push(record);
                }
            }
        }

        if (finalDeletes.length > 0) {
            const { error: delErr } = await supabaseClient.from('musteri_servis_puantaj').delete().in('id', finalDeletes);
            if (delErr) throw delErr;
        }
        if (finalUpserts.length > 0) {
            const { error: upErr } = await supabaseClient.from('musteri_servis_puantaj').upsert(finalUpserts);
            if (upErr) throw upErr;
        }

        // Close the modal upon saving
        document.getElementById('puantaj-fullscreen-modal').classList.add('hidden');
        alert("Puantaj başarıyla kaydedildi!");
        loadExcelGrid();
        fetchMusteriServis();
    } catch (e) {
        alert("Hata: " + e.message);
    } finally {
        saveBtn.innerHTML = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Değişiklikleri Kaydet`;
        saveBtn.disabled = false;
    }
}
window.displayMusteriAracAnaliz = function (kayitlar, tanimlar) {
    const tbody = document.getElementById('musteri-arac-rapor-tbody');
    const section = document.getElementById('musteri-arac-analiz-section');
    const totalEl = document.getElementById('musteri-arac-analiz-toplam');
    if (!tbody || !section) return;

    section.classList.remove('hidden');
    tbody.innerHTML = '';

    const stats = {}; // { arac_id: { plaka, vardiya: 0, tek: 0, tutar: 0 } }

    // Tanımlardan plaka ve tipleri al
    (tanimlar || []).forEach(t => {
        const aid = t.arac_id;
        if (!stats[aid]) stats[aid] = { plaka: t.araclar?.plaka || 'Bilinmiyor', vardiya: 0, tek: 0, tutar: 0 };
    });

    // Kayıtlardan sayıları ve tutarları topla
    (kayitlar || []).forEach(k => {
        const aid = k.arac_id;
        if (!stats[aid]) return;

        const val = parseInt(k.vardiya) || 0;
        if (val <= 0) return;

        const tanim = tanimlar.find(t => t.arac_id === aid);
        if (tanim?.tarife_turu === 'Vardiya') {
            stats[aid].vardiya += val;
        } else {
            stats[aid].tek += val;
        }
        stats[aid].tutar += (k.gunluk_ucret || 0) * val;
    });

    let grandTotal = 0;
    const ids = Object.keys(stats).sort((a, b) => stats[a].plaka.localeCompare(stats[b].plaka));

    if (ids.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-gray-500 italic">Bu ay bu müşteriye hizmet veren araç bulunmadı.</td></tr>';
        if (totalEl) totalEl.textContent = '₺0';
        return;
    }

    ids.forEach(id => {
        const s = stats[id];
        grandTotal += s.tutar;
        const isVardiya = s.vardiya > 0 && s.tek === 0;
        const isTek = s.tek > 0 && s.vardiya === 0;
        const tipLabel = isVardiya ? 'Vardiya' : isTek ? 'Tek' : 'Karma';
        const tipClass = isVardiya ? 'bg-orange-500/10 text-orange-400' : isTek ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400';
        const tr = document.createElement('tr');
        tr.className = "border-b border-white/5 hover:bg-white/5 transition-colors";
        tr.innerHTML = `
            <td class="px-4 py-3 font-bold text-white font-mono text-xs">${s.plaka}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[9px] font-black ${tipClass}">${tipLabel}</span></td>
            <td class="px-4 py-3 text-center font-bold text-xs text-orange-400">${s.vardiya || '—'}</td>
            <td class="px-4 py-3 text-center font-bold text-xs text-blue-400">${s.tek || '—'}</td>
            <td class="px-4 py-3 text-right font-black text-xs text-green-400">${s.tutar > 0 ? '₺' + s.tutar.toLocaleString('tr-TR') : '—'}</td>
        `;
        tbody.appendChild(tr);
    });

    if (totalEl) totalEl.textContent = '₺' + grandTotal.toLocaleString('tr-TR');
}
