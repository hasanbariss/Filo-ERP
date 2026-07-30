// ============================================================
// Manisa Fabrika Toplu Puantaj Importu
// Hazırlanmış, fabrika başına ayrılmış Excel dosyalarını işler.
// Genel import ve Dikkan importundan tamamen bağımsızdır.
// ============================================================
(function () {
    'use strict';

    const REGION = 'Manisa';
    const METADATA_SHEET = 'IMPORT BİLGİSİ';

    function notify(message, type = 'info') {
        try {
            if (window.Toast?.show) {
                window.Toast.show(message, type);
                return;
            }
        } catch (error) {
            console.warn('[Manisa Fabrika Import] Bildirim gösterilemedi:', error);
        }
        alert(message);
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function text(value) {
        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function normalized(value) {
        return text(value)
            .toLocaleUpperCase('tr-TR')
            .replace(/İ/g, 'I')
            .replace(/ı/g, 'I')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function parseDailySheetDate(value) {
        const valueText = text(value);
        const isoMatch = valueText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const localMatch = valueText.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
        const match = isoMatch || localMatch;
        if (!match) return null;
        const [year, month, day] = isoMatch
            ? isoMatch.slice(1).map(Number)
            : [Number(localMatch[3]), Number(localMatch[2]), Number(localMatch[1])];
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
            ? `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            : null;
    }

    function isTimeHeader(value) {
        const raw = text(value);
        return /^\d{1,2}[:.]\d{2}(?:\s|$)/.test(raw) || /^\d{1,2}\s+\d{2}$/.test(raw);
    }

    function isDirectionRow(row) {
        return (row || []).some(value => /GIRIS|CIKIS|MEMUR|MESAI|VARDIYA/.test(normalized(value)));
    }

    function normalizePlate(value) {
        const raw = text(value).toLocaleUpperCase('tr-TR');
        if (!raw || !/\d/.test(raw)) return '';
        const compactValue = raw.replace(/\s+/g, '');
        const strict = compactValue.match(/^(\d{2})([A-Z]{1,3})(\d{2,4})$/);
        if (strict) return `${strict[1]} ${strict[2]} ${strict[3]}`;
        return raw.replace(/\s+/g, ' ');
    }

    function findMetadata(workbook) {
        const sheet = workbook.Sheets[METADATA_SHEET];
        if (!sheet) return null;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
        const fields = {};
        rows.forEach(row => {
            const label = normalized(row[0]);
            if (label) fields[label] = text(row[1]);
        });
        const factory = fields.FABRIKA;
        const region = fields.BOLGE;
        if (region && normalized(region) !== normalized(REGION)) {
            throw new Error(`Bu import sadece ${REGION} dosyalarını kabul eder.`);
        }
        return factory ? { factory, region: region || REGION } : null;
    }

    function findDailySheetFactory(rows) {
        const ignored = new Set(['', 'TARIH', 'NO', 'GUZERGAH', 'CINSI', 'BOLGE']);
        const candidates = [rows?.[0]?.[0], rows?.[2]?.[0]];
        for (const candidate of candidates) {
            const factory = text(candidate);
            if (factory && !ignored.has(normalized(factory))) return factory;
        }
        return '';
    }

    function findDailySheetDate(rows, sheetName) {
        return parseDailySheetDate(sheetName) || parseDailySheetDate(rows?.[1]?.[2]);
    }

    function assignmentKey(customerId, vehicleId) {
        return `${String(customerId)}|${String(vehicleId)}`;
    }

    async function fetchAllRows(supabase, table, columns) {
        const pageSize = 1000;
        const rows = [];
        for (let start = 0; ; start += pageSize) {
            const { data, error } = await supabase.from(table)
                .select(columns)
                .range(start, start + pageSize - 1);
            if (error) throw new Error(`${table} verisi alınamadı: ${error.message}`);
            rows.push(...(data || []));
            if (!data || data.length < pageSize) return rows;
        }
    }

    function parseDailySheet(rows, factory, date, sheetName) {
        const headerRowIndex = rows.findIndex(row =>
            normalized(row?.[0]) === 'NO' && row.slice(3).some(isTimeHeader)
        );
        if (headerRowIndex < 0) {
            return { records: [], warning: `${sheetName}: "NO" ve saat başlıkları bulunamadı.` };
        }

        const header = rows[headerRowIndex] || [];
        const timeColumns = [];
        header.forEach((value, column) => {
            if (column >= 3 && isTimeHeader(value)) timeColumns.push({ column, time: text(value) });
        });
        if (!timeColumns.length) {
            return { records: [], warning: `${sheetName}: saat sütunları bulunamadı.` };
        }

        let routeColumn = 1;
        for (let column = 0; column < Math.min(header.length, timeColumns[0].column); column += 1) {
            if (/GUZERGAH|IZMIR|MANISA/.test(normalized(header[column]))) routeColumn = column;
        }

        const dataStartRow = headerRowIndex + (isDirectionRow(rows[headerRowIndex + 1]) ? 2 : 1);
        const records = [];
        for (let rowIndex = dataStartRow; rowIndex < rows.length; rowIndex += 1) {
            const row = rows[rowIndex] || [];
            const route = text(row[routeColumn]);
            if (!route || /^TOPLAM/i.test(route)) continue;

            const plates = row
                .slice(3)
                .map((value, offset) => ({ column: offset + 3, plate: normalizePlate(value) }))
                .filter(entry => entry.plate);
            let index = 0;
            while (index < plates.length) {
                const current = plates[index];
                const next = plates[index + 1];
                if (next && current.column + 1 === next.column && current.plate === next.plate) {
                    records.push({ factory, date, sheetName, route, plate: current.plate, vardiya: 1, tek: 0 });
                    index += 2;
                } else {
                    records.push({ factory, date, sheetName, route, plate: current.plate, vardiya: 0, tek: 1 });
                    index += 1;
                }
            }
        }
        return { records, warning: null };
    }

    function consolidate(records) {
        const grouped = new Map();
        records.forEach(record => {
            const key = `${normalized(record.factory)}|${record.date}|${normalized(record.plate)}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    ...record,
                    routes: [record.route],
                    vardiya: 0,
                    tek: 0,
                });
            }
            const target = grouped.get(key);
            target.vardiya += record.vardiya;
            target.tek += record.tek;
            if (!target.routes.includes(record.route)) target.routes.push(record.route);
        });
        return [...grouped.values()].map(record => ({ ...record, route: record.routes.join(', ') }));
    }

    async function readWorkbook(file) {
        const buffer = await file.arrayBuffer();
        return XLSX.read(buffer, { type: 'array', cellDates: true });
    }

    async function validate(records) {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Veritabanı bağlantısı hazır değil.');

        const [customersRows, vehiclesRows, assignmentRows, currentRows] = await Promise.all([
            fetchAllRows(supabase, 'musteriler', 'id, ad'),
            fetchAllRows(supabase, 'araclar', 'id, plaka'),
            fetchAllRows(supabase, 'musteri_arac_tanimlari', 'musteri_id, arac_id'),
            fetchAllRows(supabase, 'musteri_servis_puantaj', 'id, tarih, arac_id, musteri_id, bolge'),
        ]);

        const customers = new Map(customersRows.map(customer => [normalized(customer.ad), customer]));
        const vehicles = new Map(vehiclesRows.map(vehicle => [normalized(normalizePlate(vehicle.plaka)), vehicle]));
        const assignments = new Set(assignmentRows.map(row => assignmentKey(row.musteri_id, row.arac_id)));
        const currentRowMap = new Map(currentRows.map(row => [`${row.tarih}|${row.arac_id}|${row.musteri_id}|${row.bolge || REGION}`, row.id]));

        return records.map((record, index) => {
            const errors = [];
            const warnings = [];
            const customer = customers.get(normalized(record.factory));
            const vehicle = vehicles.get(normalized(record.plate));
            if (!customer) errors.push(`"${record.factory}" adına ait bir fabrika kartı sistemde bulunamadı.`);
            if (!vehicle) errors.push(`"${record.plate}" plakası sistemde bulunamadı; yeni araç otomatik açılmayacak.`);
            if (customer && vehicle && !assignments.has(assignmentKey(customer.id, vehicle.id))) {
                warnings.push(`Araç ${record.factory} fabrikasına bağlanacak.`);
            }
            const currentId = customer && vehicle
                ? currentRowMap.get(`${record.date}|${vehicle.id}|${customer.id}|${REGION}`) || null
                : null;
            if (currentId) warnings.push('Aynı Manisa puantaj kaydı var; üzerine yazılacak.');
            return {
                ...record,
                line: index + 1,
                customer,
                vehicle,
                currentId,
                errors,
                warnings,
                status: errors.length ? 'error' : warnings.length ? 'warning' : 'ready',
            };
        });
    }

    function closeModal() {
        document.getElementById('manisa-fabrika-import-modal')?.remove();
        window._manisaFabrikaImportRows = null;
    }

    function renderPreview(rows, metadata, notices) {
        const ready = rows.filter(row => row.status === 'ready').length;
        const warnings = rows.filter(row => row.status === 'warning').length;
        const errors = rows.filter(row => row.status === 'error').length;
        const uniqueDays = new Set(rows.map(row => row.date)).size;
        const importable = ready + warnings;
        const overlay = document.createElement('div');
        overlay.id = 'manisa-fabrika-import-modal';
        overlay.className = 'fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
        overlay.innerHTML = `
            <div class="w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border border-violet-500/30 bg-[#111827] shadow-2xl flex flex-col">
                <div class="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
                    <div>
                        <p class="text-[10px] uppercase tracking-[0.2em] font-black text-violet-300">Manisa Fabrika Toplu Import</p>
                        <h3 class="text-xl font-black text-white mt-1">${escapeHtml(metadata.factory)}</h3>
                        <p class="text-xs text-gray-400 mt-1">${uniqueDays} gün · Bölge: <strong class="text-orange-300">Manisa</strong> · Yan yana aynı plaka: vardiya</p>
                    </div>
                    <button onclick="window.closeManisaFabrikaImportModal()" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
                </div>
                <div class="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-white/10">
                    <div class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3"><p class="text-[10px] text-emerald-300 font-bold uppercase">Hazır</p><p class="text-xl text-white font-black">${ready}</p></div>
                    <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3"><p class="text-[10px] text-amber-300 font-bold uppercase">Uyarı</p><p class="text-xl text-white font-black">${warnings}</p></div>
                    <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3"><p class="text-[10px] text-rose-300 font-bold uppercase">Hata</p><p class="text-xl text-white font-black">${errors}</p></div>
                    <div class="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3"><p class="text-[10px] text-blue-300 font-bold uppercase">Aktarılacak</p><p class="text-xl text-white font-black">${importable}</p></div>
                </div>
                ${notices.length ? `<div class="mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">${notices.map(escapeHtml).join('<br>')}</div>` : ''}
                <div class="overflow-auto p-6 flex-1">
                    <table class="w-full text-left text-xs">
                        <thead class="sticky top-0 bg-[#111827] text-gray-400 uppercase tracking-wider">
                            <tr class="border-b border-white/10"><th class="py-3 pr-2">Tarih</th><th class="py-3 pr-2">Fabrika</th><th class="py-3 pr-2">Güzergah</th><th class="py-3 pr-2">Plaka</th><th class="py-3 pr-2 text-center">Vardiya</th><th class="py-3 pr-2 text-center">Tek</th><th class="py-3">Durum</th></tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            ${rows.map(row => `<tr><td class="py-3 pr-2 text-gray-300">${escapeHtml(row.date)}</td><td class="py-3 pr-2 text-violet-200 font-bold">${escapeHtml(row.factory)}</td><td class="py-3 pr-2 text-white">${escapeHtml(row.route)}</td><td class="py-3 pr-2 font-black text-white">${escapeHtml(row.plate)}</td><td class="py-3 pr-2 text-center">${row.vardiya || '–'}</td><td class="py-3 pr-2 text-center">${row.tek || '–'}</td><td class="py-3 ${row.status === 'error' ? 'text-rose-300' : row.status === 'warning' ? 'text-amber-300' : 'text-emerald-300'}">${row.errors.concat(row.warnings).map(escapeHtml).join('<br>') || 'Hazır'}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="px-6 py-5 border-t border-white/10 flex justify-end gap-3">
                    <button onclick="window.closeManisaFabrikaImportModal()" class="px-5 py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-300 hover:text-white">Vazgeç</button>
                    <button id="confirm-manisa-fabrika-import" ${importable ? '' : 'disabled'} onclick="window.confirmManisaFabrikaImport()" class="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-black text-white">${importable} Kaydı Manisa'ya Aktar</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }

    window.openManisaFabrikaImport = function () {
        document.getElementById('manisa-fabrika-file-input')?.click();
    };

    window.closeManisaFabrikaImportModal = closeModal;

    window.handleManisaFabrikaImport = async function (file) {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) {
            notify('Bu import için yalnızca hazırlanan .xlsx fabrika dosyaları kullanılabilir.', 'error');
            return;
        }
        if (typeof XLSX === 'undefined') {
            notify('Excel okuyucusu yüklenemedi.', 'error');
            return;
        }
        try {
            notify('Manisa fabrika dosyası okunuyor...', 'info');
            const workbook = await readWorkbook(file);
            const metadata = findMetadata(workbook);
            const notices = [];
            const rawRecords = [];
            workbook.SheetNames.filter(name => normalized(name) !== normalized(METADATA_SHEET)).forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
                const date = findDailySheetDate(rows, sheetName);
                if (!date) {
                    notices.push(`${sheetName}: geçerli tarih sekmesi olmadığı için atlandı.`);
                    return;
                }
                const factory = findDailySheetFactory(rows) || metadata?.factory;
                if (!factory) {
                    notices.push(`${sheetName}: fabrika adı bulunamadı. Fabrika adını günlük sekmenin A1 hücresine yazın.`);
                    return;
                }
                const parsed = parseDailySheet(rows, factory, date, sheetName);
                if (parsed.warning) notices.push(parsed.warning);
                rawRecords.push(...parsed.records);
            });
            const records = consolidate(rawRecords);
            if (!records.length) throw new Error('İçe aktarılacak plaka kaydı bulunamadı.');
            const validatedRows = await validate(records);
            const factories = [...new Set(records.map(record => record.factory))];
            const previewMetadata = {
                factory: factories.length === 1 ? factories[0] : `${factories.length} fabrika`,
                region: REGION,
            };
            window._manisaFabrikaImportRows = validatedRows;
            renderPreview(validatedRows, previewMetadata, notices);
        } catch (error) {
            console.error('[Manisa Fabrika Import]', error);
            notify(error.message || 'Fabrika Exceli okunamadı.', 'error');
        } finally {
            const input = document.getElementById('manisa-fabrika-file-input');
            if (input) input.value = '';
        }
    };

    window.confirmManisaFabrikaImport = async function () {
        const importButton = document.getElementById('confirm-manisa-fabrika-import');
        if (importButton?.dataset.importing === 'true') return;
        const rows = (window._manisaFabrikaImportRows || []).filter(row => !row.errors.length);
        if (!rows.length) {
            notify('Aktarılacak geçerli kayıt yok.', 'error');
            return;
        }
        if (importButton) {
            importButton.dataset.importing = 'true';
            importButton.disabled = true;
            importButton.textContent = 'Aktarılıyor...';
        }
        const supabase = window.supabaseClient;
        const assignmentCache = new Set();
        let inserted = 0;
        let updated = 0;
        let assigned = 0;
        try {
            for (const row of rows) {
                const rowAssignmentKey = assignmentKey(row.customer.id, row.vehicle.id);
                if (!assignmentCache.has(rowAssignmentKey) && row.warnings.some(warning => warning.includes('bağlanacak'))) {
                    const { error: assignmentError } = await supabase.from('musteri_arac_tanimlari').insert({
                        musteri_id: row.customer.id,
                        arac_id: row.vehicle.id,
                        tarife_turu: row.vardiya > 0 ? 'Vardiya' : 'Tek',
                        tek_fiyat: 0,
                        vardiya_fiyat: 0,
                    });
                    if (assignmentError && assignmentError.code !== '23505') throw new Error(`Araç-fabrika ataması yapılamadı: ${assignmentError.message}`);
                    assignmentCache.add(rowAssignmentKey);
                    assigned += 1;
                }

                const payload = {
                    musteri_id: row.customer.id,
                    arac_id: row.vehicle.id,
                    tarih: row.date,
                    vardiya: row.vardiya ? String(row.vardiya) : null,
                    tek: row.tek ? String(row.tek) : null,
                    gunluk_ucret: 0,
                    bolge: REGION,
                };
                const result = row.currentId
                    ? await supabase.from('musteri_servis_puantaj').update(payload).eq('id', row.currentId)
                    : await supabase.from('musteri_servis_puantaj').insert(payload);
                if (result.error) throw new Error(`${row.date} / ${row.plate}: ${result.error.message}`);
                if (row.currentId) updated += 1;
                else inserted += 1;
            }
            closeModal();
            notify(`Aktarım tamamlandı: ${inserted} yeni, ${updated} güncellenen Manisa puantaj kaydı.${assigned ? ` ${assigned} araç fabrika ile eşleştirildi.` : ''}`, 'success');
            if (typeof window.refreshAllModules === 'function') window.refreshAllModules();
        } catch (error) {
            console.error('[Manisa Fabrika Import]', error);
            notify(error.message || 'Puantaj aktarımı tamamlanamadı.', 'error');
            if (importButton) {
                importButton.dataset.importing = 'false';
                importButton.disabled = false;
                importButton.textContent = `${rows.length} Kaydı Manisa'ya Aktar`;
            }
        }
    };
})();
