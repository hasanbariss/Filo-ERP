// ============================================================
// Manisa Şehir Hastanesi Özel Puantaj Import Modülü
// Sadece "Manisa Şehir Hastanesi" fabrikasına giriş yapılır.
// Diğer fabrikaları/import sistemlerini etkilemez.
// ============================================================
(function () {
    'use strict';

    const FACTORY_NAME = 'Manisa Şehir Hastanesi';
    const REGION = 'Manisa';
    const MODULE_ID = 'msh-import';

    // ── Saat çiftleri: [giriş_col, çıkış_col] indeksleri (0-bazlı, sütun C=0 olarak)
    // Excel sütun haritası (C sütunundan itibaren, index 2'den başlıyor aslında ama
    // biz row.slice(2) yaparak normalize ediyoruz):
    //
    //  Col index (slice sonrası) → Saat  → Yön
    //   0  06:15  GİRİŞ  → TEK
    //   1  07:10  GİRİŞ  → pair[1,2] veya pair[1,3]  (07:50 ÇIKIŞ veya 08:15 ÇIKIŞ)
    //   2  07:50  ÇIKIŞ  → pair[1,2]
    //   3  08:15  ÇIKIŞ  → pair[1,3]
    //   4  09:00  GİRİŞ  → TEK
    //   5  13:45  GİRİŞ  → pair[5,6]
    //   6  15:40  ÇIKIŞ  → pair[5,6]
    //   7  16:00  GİRİŞ  → pair[7,9]
    //   8  16:15  ÇIKIŞ  → TEK (her türlü)
    //   9  17:15  ÇIKIŞ  → pair[7,9]
    //  10  18:15  ÇIKIŞ  → TEK (her türlü)
    //  11  19:15  ÇIKIŞ  → TEK (her türlü)
    //  12  22:10  GİRİŞ  → pair[12,13]
    //  13  23:20  ÇIKIŞ  → pair[12,13]
    //  14  23:00  GİRİŞ  → pair[14,15]
    //  15  00:00  ÇIKIŞ  → pair[14,15]

    // VARDİYA çiftleri: her eleman [giriş_idx, çıkış_idx]
    const VARDIYA_PAIRS = [
        [1, 2],   // 07:10→07:50
        [1, 3],   // 07:10→08:15
        [5, 6],   // 13:45→15:40
        [7, 9],   // 16:00→17:15
        [12, 13], // 22:10→23:20
        [14, 15], // 23:00→00:00
    ];

    // TEK olan sütunlar (hangi koşulda olursa olsun TEK sayılır)
    const ALWAYS_TEK = new Set([0, 4, 8, 10, 11]);
    // ALWAYS_TEK olmayan VE pair'in girişi olmayan sütunlar da tek sayılır

    // ── Yardımcı fonksiyonlar ──────────────────────────────────────────────

    function notify(message, type = 'info') {
        try {
            if (window.Toast?.show) { window.Toast.show(message, type); return; }
        } catch (_) {}
        alert(message);
    }

    function esc(v) {
        return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function txt(v) { return String(v ?? '').replace(/\s+/g,' ').trim(); }

    function norm(v) {
        return txt(v).toLocaleUpperCase('tr-TR')
            .replace(/İ/g,'I').replace(/ı/g,'I')
            .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    }

    /**
     * Plaka normalizer — Manisa Şehir Hastanesi özel
     * Giriş: "45 J 994", "45J 994", "45  J 1089", "45 J 084", "45 J 1857"
     * Çıkış: "45 J 0994", "45 J 0994", "45 J 1089", "45 J 0084", "45 J 1857"
     * Sayısal kısım her zaman 4 haneye pad edilir.
     */
    function normalizePlate(raw) {
        if (!raw || typeof raw !== 'string') return '';
        let s = raw.toLocaleUpperCase('tr-TR').replace(/\s+/g,' ').trim();
        if (!s || !/\d/.test(s)) return '';
        // Compact et: tüm boşlukları kaldır
        const compact = s.replace(/\s+/g,'');
        // Standart Türk plaka: 2 rakam + 1-3 harf + 2-4 rakam
        const m = compact.match(/^(\d{2})([A-ZÇĞİÖŞÜ]{1,3})(\d{2,4})$/);
        if (m) {
            const sayisal = m[3].padStart(4,'0');
            return `${m[1]} ${m[2]} ${sayisal}`;
        }
        // Match olmadıysa olduğu gibi döndür (ama boşlukları normalize et)
        return s.replace(/\s+/g,' ');
    }

    /**
     * normalizePlate'i uygular ama ayrıca orijinal ile farkı raporlamak için
     * kullanılacak { original, normalized, changed } döndürür.
     */
    function normalizePlateWithDiff(raw) {
        const original = txt(raw).toLocaleUpperCase('tr-TR');
        const normalized = normalizePlate(raw);
        return { original, normalized, changed: original !== normalized && normalized !== '' };
    }

    function parseDateFromSheetName(name) {
        // "06.10.2026 (3)", "02.10.2026" gibi sekme adları
        const m = name.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (!m) return null;
        const d = parseInt(m[1],10), mo = parseInt(m[2],10), y = parseInt(m[3],10);
        const date = new Date(Date.UTC(y, mo-1, d));
        if (date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d) return null;
        return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function parseDateFromCell(value) {
        if (!value) return null;
        const s = txt(value);
        // "TARİH:02.10.2026", "TARIH:02.10.2026", "02.10.2026" formatları
        const m = s.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
        if (!m) return null;
        const d = parseInt(m[1],10), mo = parseInt(m[2],10), y = parseInt(m[3],10);
        const date = new Date(Date.UTC(y, mo-1, d));
        if (date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d) return null;
        return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function isTimeHeader(v) {
        if (!v && v !== 0) return false;
        const s = txt(v);
        // "06:15:00", "06:15", "6:15" formatları (XLSX raw:false çıktısı)
        if (/^\d{1,2}[:\.]\d{2}/.test(s)) return true;
        // "1900-01-01 00:00:00" — Excel'de 00:00 saati bu şekilde gelir
        if (/^1900-01-01/.test(s)) return true;
        // Excel bazen "00:00" ya da "0:00" verebilir
        if (/^0[:.]00/.test(s)) return true;
        return false;
    }

    /**
     * Sekme adını ve sayfa içindeki "TARİH:" hücresini çapraz kontrol eder.
     * Sayfa içindeki tarih (A2, A1 vb.) her zaman asıl belgedir.
     * Sekme adı yanlış yazılmışsa veya kopyalanmışsa (örn: "03.10.2026 (2)"),
     * içerideki tarih kullanılır ve kullanıcıya uyarı bildirilir.
     */
    function extractDateFromRows(rows, sheetName) {
        const fromName = parseDateFromSheetName(sheetName);
        let fromCell = parseDateFromCell(rows?.[1]?.[0]) || parseDateFromCell(rows?.[0]?.[0]);

        if (!fromCell) {
            for (let r = 0; r <= 4; r++) {
                for (let c = 0; c <= 3; c++) {
                    const v = parseDateFromCell(rows?.[r]?.[c]);
                    if (v) { fromCell = v; break; }
                }
                if (fromCell) break;
            }
        }

        // Hem sekme adında hem hücrede tarih varsa çapraz kontrol yap
        if (fromCell && fromName) {
            if (fromCell !== fromName) {
                return {
                    date: fromCell,
                    notice: `"${sheetName}" sekmesinde sekme adı tarihi (${fromName}) ile sayfa içi tarih (${fromCell}) farklı; hücredeki asıl tarih (${fromCell}) esas alındı.`
                };
            }
            return { date: fromCell, notice: null };
        }

        if (fromCell) return { date: fromCell, notice: null };
        if (fromName) return { date: fromName, notice: null };

        return { date: null, notice: null };
    }

    /**
     * Sütun sırasını normalize et: header satırından saat sütunlarını bul,
     * col 2'den (C sütunu) itibaren olduğunu varsay. 
     * Döndürür: { timeColOffset: number } — ilk saat sütununun row içindeki indeksi
     */
    function findTimeColumns(headerRow) {
        // Header: [NO, GÜZERGAH, 06:15, 07:10, 07:50, ...]
        // İlk saat sütununun indeksini bul
        for (let i = 0; i < headerRow.length; i++) {
            if (isTimeHeader(headerRow[i])) return i;
        }
        return 2; // varsayılan
    }

    /**
     * Bir row'daki plakaları ayıkla: timeOffset'ten itibaren, her sütun için
     * { colIdx, plate } döndür (plate boşsa dahil etme).
     */
    function extractPlatesFromRow(row, timeOffset) {
        const result = [];
        for (let i = timeOffset; i < row.length; i++) {
            const p = normalizePlate(txt(row[i]));
            if (p) result.push({ colIdx: i - timeOffset, plate: p, rawPlate: txt(row[i]) });
        }
        return result;
    }

    /**
     * Ana işleme mantığı: bir satırdaki plakaları saat sütunlarına göre
     * TEK veya VARDİYA olarak sınıflandır.
     *
     * Plaka başına toplam { vardiya, tek } döndürür (bir plaka aynı günde
     * birden fazla servise çıkabilir).
     */
    function classifyPlatesInRow(rowPlates) {
        // Her plaka için kullanılan colIdx'leri takip et (aynı seferde birden
        // fazla pair'e girmemesi için)
        const plateGroups = {}; // plate -> [colIdx, ...]
        rowPlates.forEach(({ plate, colIdx }) => {
            if (!plateGroups[plate]) plateGroups[plate] = [];
            plateGroups[plate].push(colIdx);
        });

        const results = {}; // plate -> { vardiya, tek }

        Object.entries(plateGroups).forEach(([plate, cols]) => {
            const colSet = new Set(cols);
            const usedCols = new Set();
            let vardiya = 0, tek = 0;

            // VARDİYA çiftlerini kontrol et
            VARDIYA_PAIRS.forEach(([gCol, cCol]) => {
                if (colSet.has(gCol) && colSet.has(cCol) &&
                    !usedCols.has(gCol) && !usedCols.has(cCol)) {
                    vardiya++;
                    usedCols.add(gCol);
                    usedCols.add(cCol);
                }
            });

            // Kalan sütunları TEK say
            cols.forEach(c => {
                if (!usedCols.has(c)) {
                    tek++;
                    usedCols.add(c);
                }
            });

            results[plate] = { vardiya, tek };
        });

        return results;
    }

    /**
     * Bir Excel sheet'ini parse et.
     * Döndürür: { records: [{date, plate, vardiya, tek}], warnings, plateCorrections }
     */
    function parseSheet(rows, date, sheetName) {
        const warnings = [];
        const records = [];
        const plateCorrections = []; // { original, normalized } düzeltmeler

        // Header satırını bul (NO + zaman sütunları olan satır)
        const headerIdx = rows.findIndex(row =>
            norm(row?.[0]) === 'NO' && (row || []).some(isTimeHeader)
        );

        if (headerIdx < 0) {
            warnings.push(`${sheetName}: Başlık satırı bulunamadı, atlandı.`);
            return { records, warnings, plateCorrections };
        }

        const headerRow = rows[headerIdx] || [];
        const timeOffset = findTimeColumns(headerRow);

        // Yön satırını atla (GİRİŞ/ÇIKIŞ satırı)
        let dataStart = headerIdx + 1;
        const nextRow = rows[dataStart] || [];
        const hasDirectionRow = nextRow.some(v => /GIRIS|CIKIS/i.test(norm(v)));
        if (hasDirectionRow) dataStart++;

        // Veri satırlarını işle
        for (let ri = dataStart; ri < rows.length; ri++) {
            const row = rows[ri] || [];
            const no = txt(row[0]);

            // Boş satır veya "NO" tekrarı veya TOPLAM satırı
            if (!no || norm(no) === 'NO' || /^TOPLAM/i.test(norm(no))) continue;

            // Sayısal NO veya benzeri bir değer bekliyoruz
            // (bazı satırlar not/açıklama içerebilir; eğer hiç plaka yoksa atla)
            const rowPlates = extractPlatesFromRow(row, timeOffset);
            if (!rowPlates.length) continue;

            // Plaka düzeltmelerini kaydet
            rowPlates.forEach(({ rawPlate, plate }) => {
                const rawNorm = rawPlate.toLocaleUpperCase('tr-TR');
                if (rawNorm !== plate) {
                    const already = plateCorrections.find(c => c.original === rawNorm && c.normalized === plate);
                    if (!already) plateCorrections.push({ original: rawNorm, normalized: plate });
                }
            });

            const classified = classifyPlatesInRow(rowPlates);
            Object.entries(classified).forEach(([plate, { vardiya, tek }]) => {
                records.push({ date, plate, vardiya, tek, sheetName });
            });
        }

        return { records, warnings, plateCorrections };
    }

    /**
     * Tüm sheet'lerdeki kayıtları aynı tarih+plaka kombinasyonu bazında birleştir.
     * Bir gün içinde bir plaka birden fazla sheet/section'da görünebilir.
     */
    function consolidate(records) {
        const map = new Map();
        records.forEach(r => {
            const key = `${r.date}|${norm(r.plate)}`;
            if (!map.has(key)) {
                map.set(key, { date: r.date, plate: r.plate, vardiya: 0, tek: 0 });
            }
            const entry = map.get(key);
            entry.vardiya += r.vardiya;
            entry.tek += r.tek;
        });
        return [...map.values()];
    }

    async function fetchAllRows(supabase, table, columns) {
        const SIZE = 1000;
        const rows = [];
        for (let start = 0; ; start += SIZE) {
            const { data, error } = await supabase.from(table).select(columns).range(start, start + SIZE - 1);
            if (error) throw new Error(`${table} alınamadı: ${error.message}`);
            rows.push(...(data || []));
            if (!data || data.length < SIZE) return rows;
        }
    }

    function assignKey(cId, vId) { return `${cId}|${vId}`; }

    async function validate(records) {
        const supabase = window.supabaseClient;
        if (!supabase) throw new Error('Veritabanı bağlantısı hazır değil.');

        const [custRows, vehRows, asgRows, curRows] = await Promise.all([
            fetchAllRows(supabase, 'musteriler', 'id, ad'),
            fetchAllRows(supabase, 'araclar', 'id, plaka'),
            fetchAllRows(supabase, 'musteri_arac_tanimlari', 'musteri_id, arac_id'),
            fetchAllRows(supabase, 'musteri_servis_puantaj', 'id, tarih, arac_id, musteri_id, bolge'),
        ]);

        const customers = new Map(custRows.map(c => [norm(c.ad), c]));
        const vehicles  = new Map(vehRows.map(v => [norm(normalizePlate(v.plaka)), v]));
        const assignments = new Set(asgRows.map(r => assignKey(r.musteri_id, r.arac_id)));
        const curMap = new Map(curRows.map(r => [`${r.tarih}|${r.arac_id}|${r.musteri_id}|${r.bolge||REGION}`, r.id]));

        const customer = customers.get(norm(FACTORY_NAME));

        return records.map((record, idx) => {
            const errors = [], warnings = [];

            if (!customer) {
                errors.push(`"${FACTORY_NAME}" adına fabrika kartı sistemde yok. Lütfen önce Fabrikalar menüsünden ekleyin.`);
            }

            const vehicle = vehicles.get(norm(record.plate));
            if (!vehicle) errors.push(`"${record.plate}" plakası sistemde bulunamadı.`);

            if (customer && vehicle && !assignments.has(assignKey(customer.id, vehicle.id))) {
                warnings.push(`Araç, ${FACTORY_NAME} fabrikasına otomatik bağlanacak.`);
            }

            const currentId = (customer && vehicle)
                ? (curMap.get(`${record.date}|${vehicle.id}|${customer.id}|${REGION}`) || null)
                : null;

            if (currentId) warnings.push('Bu tarih için mevcut kayıt var; üzerine yazılacak.');

            return {
                ...record,
                line: idx + 1,
                customer,
                vehicle,
                currentId,
                errors,
                warnings,
                status: errors.length ? 'error' : warnings.length ? 'warning' : 'ready',
            };
        });
    }

    // ── Modal ──────────────────────────────────────────────────────────────

    function closeModal() {
        document.getElementById(`${MODULE_ID}-modal`)?.remove();
        window._mshImportRows = null;
    }

    function renderPreview(validatedRows, allCorrections, notices) {
        const ready    = validatedRows.filter(r => r.status === 'ready').length;
        const warnings = validatedRows.filter(r => r.status === 'warning').length;
        const errors   = validatedRows.filter(r => r.status === 'error').length;
        const importable = ready + warnings;
        const uniqueDays = new Set(validatedRows.map(r => r.date)).size;

        // Düzeltme tablosu HTML
        const corrHTML = allCorrections.length
            ? `<div class="mx-6 mt-4 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3">
                <p class="text-[10px] font-black uppercase tracking-widest text-teal-300 mb-2">🔧 Otomatik Plaka Düzeltmeleri (${allCorrections.length} adet)</p>
                <div class="flex flex-wrap gap-2">
                  ${allCorrections.map(c =>
                    `<span class="text-[10px] font-bold text-teal-100 bg-teal-900/40 border border-teal-500/20 rounded-lg px-2 py-1">
                       <span class="line-through text-red-300">${esc(c.original)}</span>
                       → <span class="text-emerald-300">${esc(c.normalized)}</span>
                     </span>`
                  ).join('')}
                </div>
               </div>`
            : '';

        const noticeHTML = notices.length
            ? `<div class="mx-6 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">${notices.map(esc).join('<br>')}</div>`
            : '';

        const overlay = document.createElement('div');
        overlay.id = `${MODULE_ID}-modal`;
        overlay.className = 'fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
        overlay.innerHTML = `
        <div class="ios-modal-sheet w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-3xl border border-teal-500/30 bg-[#111827] shadow-2xl flex flex-col">
            <div class="ios-modal-header px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                    <p class="text-[10px] uppercase tracking-[0.2em] font-black text-teal-300">Manisa Şehir Hastanesi Puantaj Import</p>
                    <h3 class="text-xl font-black text-white mt-1">${esc(FACTORY_NAME)}</h3>
                    <p class="text-xs text-gray-400 mt-1">
                        ${uniqueDays} gün · Bölge: <strong class="text-orange-300">${esc(REGION)}</strong>
                        · 07:10→07:50/08:15 | 13:45→15:40 | 16:00→17:15 | 22:10→23:20 | 23:00→00:00 = Vardiya
                    </p>
                </div>
                <button onclick="window.closeMshImportModal()" class="text-gray-400 hover:text-white text-2xl leading-none">×</button>
            </div>

            <div class="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-white/10">
                <div class="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3"><p class="text-[10px] text-emerald-300 font-bold uppercase">Hazır</p><p class="text-xl text-white font-black">${ready}</p></div>
                <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3"><p class="text-[10px] text-amber-300 font-bold uppercase">Uyarı</p><p class="text-xl text-white font-black">${warnings}</p></div>
                <div class="rounded-xl bg-rose-500/10 border border-rose-500/20 p-3"><p class="text-[10px] text-rose-300 font-bold uppercase">Hata</p><p class="text-xl text-white font-black">${errors}</p></div>
                <div class="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3"><p class="text-[10px] text-blue-300 font-bold uppercase">Aktarılacak</p><p class="text-xl text-white font-black">${importable}</p></div>
            </div>

            ${corrHTML}
            ${noticeHTML}

            <div class="ios-modal-body overflow-auto p-6 flex-1">
                <table class="w-full text-left text-xs">
                    <thead class="sticky top-0 bg-[#111827] text-gray-400 uppercase tracking-wider">
                        <tr class="border-b border-white/10">
                            <th class="py-3 pr-2">Tarih</th>
                            <th class="py-3 pr-2">Plaka</th>
                            <th class="py-3 pr-2 text-center">Vardiya</th>
                            <th class="py-3 pr-2 text-center">Tek</th>
                            <th class="py-3">Durum</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        ${validatedRows.map(r => `
                        <tr>
                            <td class="py-2 pr-2 text-gray-300">${esc(r.date)}</td>
                            <td class="py-2 pr-2 font-black text-white">${esc(r.plate)}</td>
                            <td class="py-2 pr-2 text-center ${r.vardiya ? 'text-indigo-300 font-bold' : 'text-gray-500'}">${r.vardiya || '–'}</td>
                            <td class="py-2 pr-2 text-center ${r.tek ? 'text-orange-300 font-bold' : 'text-gray-500'}">${r.tek || '–'}</td>
                            <td class="py-2 ${r.status==='error'?'text-rose-300':r.status==='warning'?'text-amber-300':'text-emerald-300'}">
                                ${r.errors.concat(r.warnings).map(esc).join('<br>') || 'Hazır'}
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>

            <div class="ios-modal-footer px-6 py-5 border-t border-white/10 flex justify-end gap-3">
                <button onclick="window.closeMshImportModal()" class="px-5 py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-300 hover:text-white">Vazgeç</button>
                <button id="confirm-msh-import"
                    ${importable ? '' : 'disabled'}
                    onclick="window.confirmMshImport()"
                    class="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-sm font-black text-white">
                    ${importable} Kaydı Manisa Şehir Hastanesine Aktar
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
    }

    // ── Public API ─────────────────────────────────────────────────────────

    window.openMshImport = function () {
        document.getElementById('msh-file-input')?.click();
    };

    window.closeMshImportModal = closeModal;

    window.handleMshImport = async function (file) {
        if (!file) return;
        if (!/\.xlsx$/i.test(file.name)) {
            notify('Yalnızca .xlsx dosyaları desteklenir.', 'error');
            return;
        }
        if (typeof XLSX === 'undefined') {
            notify('Excel okuyucusu yüklenemedi.', 'error');
            return;
        }

        try {
            notify('Manisa Şehir Hastanesi puantajı okunuyor...', 'info');

            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

            const allRaw = [];
            const allCorrections = [];
            const notices = [];

            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

                // Tarihi bul: sekme adı ve sayfa içi "TARİH:" hücresini çapraz doğrula
                const { date, notice: dateNotice } = extractDateFromRows(rows, sheetName);
                if (dateNotice) notices.push(dateNotice);

                if (!date) {
                    notices.push(`"${sheetName}" sekmesinde geçerli tarih bulunamadı, atlandı.`);
                    continue;
                }

                const { records, warnings, plateCorrections } = parseSheet(rows, date, sheetName);
                notices.push(...warnings);
                allRaw.push(...records);
                plateCorrections.forEach(c => {
                    const ex = allCorrections.find(x => x.original === c.original && x.normalized === c.normalized);
                    if (!ex) allCorrections.push(c);
                });
            }

            if (!allRaw.length) {
                throw new Error('Aktarılacak plaka kaydı bulunamadı. Dosyayı kontrol edin.');
            }

            const consolidated = consolidate(allRaw);
            const validatedRows = await validate(consolidated);

            window._mshImportRows = validatedRows;
            renderPreview(validatedRows, allCorrections, notices);

        } catch (err) {
            console.error('[MSH Import]', err);
            notify(err.message || 'Dosya okunamadı.', 'error');
        } finally {
            const inp = document.getElementById('msh-file-input');
            if (inp) inp.value = '';
        }
    };

    window.confirmMshImport = async function () {
        const btn = document.getElementById('confirm-msh-import');
        if (btn?.dataset.importing === 'true') return;

        const rows = (window._mshImportRows || []).filter(r => !r.errors.length);
        if (!rows.length) { notify('Aktarılacak geçerli kayıt yok.', 'error'); return; }

        if (btn) { btn.dataset.importing = 'true'; btn.disabled = true; btn.textContent = 'Aktarılıyor...'; }

        const supabase = window.supabaseClient;
        const asgCache = new Set();
        let inserted = 0, updated = 0, assigned = 0;

        try {
            for (const row of rows) {
                const ak = assignKey(row.customer.id, row.vehicle.id);
                if (!asgCache.has(ak) && row.warnings.some(w => w.includes('bağlanacak'))) {
                    const { error: ae } = await supabase.from('musteri_arac_tanimlari').insert({
                        musteri_id: row.customer.id,
                        arac_id: row.vehicle.id,
                        tarife_turu: row.vardiya > 0 ? 'Vardiya' : 'Tek',
                        tek_fiyat: 0,
                        vardiya_fiyat: 0,
                    });
                    if (ae && ae.code !== '23505') throw new Error(`Araç-fabrika ataması yapılamadı: ${ae.message}`);
                    asgCache.add(ak);
                    assigned++;
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
                row.currentId ? updated++ : inserted++;
            }

            closeModal();
            notify(
                `Aktarım tamamlandı: ${inserted} yeni, ${updated} güncellenen kayıt.`
                + (assigned ? ` ${assigned} araç fabrikayla eşleştirildi.` : ''),
                'success'
            );
            if (typeof window.refreshAllModules === 'function') window.refreshAllModules();
            if (typeof window.fetchImportCalendar === 'function') window.fetchImportCalendar();

        } catch (err) {
            console.error('[MSH Import]', err);
            notify(err.message || 'Aktarım tamamlanamadı.', 'error');
            if (btn) { btn.dataset.importing = 'false'; btn.disabled = false; btn.textContent = `${rows.length} Kaydı Aktar`; }
        }
    };

})();

