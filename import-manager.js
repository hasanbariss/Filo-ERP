// ============================================================
// IDEOL Filo ERP — Import Manager
// GRUP 7: Günlük Puantaj Grid Excel Import Sistemi
//
// Excel formatı:
//   Satır 0 : [MÜŞTERİ ADI] [TARİH:] [tarih metni]
//   Satır 1 : [GÜZERGAH]  [CİNSİ] [SAAT] [07:30] [08:00] [18:00] [20:30] [21:00]
//   Satır 2 : [NO] [İZMİR]              [GİRİŞ] [ÇIKIŞ] [ÇIKIŞ] [GİRİŞ] [ÇIKIŞ]
//   Satır 3+: [no] [güzergah adı] [cin] [saat] [PLAKA|boş] ...
//
// Vardiya kuralı:
//   Aynı plaka art arda iki sütunda → 1 TAM vardiya
//   Yalnız ya da boşlukla ayrılmış  → her biri 1 TEK vardiya
//
// Yazılan tablo: musteri_servis_puantaj
// ============================================================

(function () {
    'use strict';

    // ── Türkçe ay isimleri ──────────────────────────────────────────────
    const TURKCE_AYLAR = {
        'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04',
        'mayıs': '05', 'haziran': '06', 'temmuz': '07', 'ağustos': '08',
        'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
    };

    // ── Toast ────────────────────────────────────────────────────────────
    function showImportToast(mesaj, tip) {
        const renk = tip === 'success' ? 'rgba(22,163,74,0.92)'
                   : tip === 'error'   ? 'rgba(220,38,68,0.92)'
                   : 'rgba(30,100,200,0.92)';
        const t = document.createElement('div');
        t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;background:${renk};color:white;font-size:0.8rem;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,0.25);backdrop-filter:blur(8px);max-width:360px;word-break:break-word;`;
        t.textContent = mesaj;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 5000);
    }

    // ── Loading butonu ───────────────────────────────────────────────────
    function setImportLoading(durum) {
        const btn = document.getElementById('import-onayla-btn');
        if (!btn) return;
        btn.disabled = durum;
        btn.innerHTML = durum
            ? '<span class="inline-block animate-spin mr-1">↻</span> Aktarılıyor...'
            : (btn.dataset.originalText || 'İçe Aktar');
    }

    // ══════════════════════════════════════════════════════════════════════
    //  1. Ham Excel → 2D array okuyucu
    // ══════════════════════════════════════════════════════════════════════
    async function readRawExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (typeof XLSX === 'undefined') {
                        reject(new Error('SheetJS yüklenemedi.')); return;
                    }
                    const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: false });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    // header:1 → 2D dizi, boş hücreler '' olsun
                    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                    if (rows.length === 0) reject(new Error('Excel boş.'));
                    else resolve(rows);
                } catch (err) {
                    reject(new Error('Excel okunamadı: ' + err.message));
                }
            };
            reader.onerror = () => reject(new Error('Dosya okunamadı.'));
            reader.readAsBinaryString(file);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  2. Tarih parser ("31 Ocak 2026 Cumartesi" veya "20.3.2026" → "2026-01-31")
    // ══════════════════════════════════════════════════════════════════════
    function parseTurkishDate(text) {
        if (!text) return null;
        const s = String(text).toLowerCase().trim();

        const dotMatch = s.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
        if (dotMatch) {
            const gun = dotMatch[1].padStart(2, '0');
            const ay = dotMatch[2].padStart(2, '0');
            const yil = dotMatch[3];
            return `${yil}-${ay}-${gun}`;
        }

        const m = s.match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
        if (m) {
            const gun  = m[1].padStart(2, '0');
            const ay   = TURKCE_AYLAR[m[2]] || null;
            const yil  = m[3];
            if (ay) return `${yil}-${ay}-${gun}`;
        }

        const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return iso[0];
        return null;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  3. Header analizi: müşteri adı, tarih, sütun indeksleri, veri başlangıcı
    // ══════════════════════════════════════════════════════════════════════
    function parseHeaderInfo(rows) {
        let musteriAdi   = '';
        let tarih        = null;
        let timeColIdx   = -1;  // HH:MM başlıklarının başladığı satır indeksi
        let dataStartRow = -1;
        let guzergahCol  = -1;  // güzergah isim sütunu
        let timeCols     = [];  // { colIdx, saat, yon } listesi

        // ── 3A. Müşteri adı ve tarihi bul ─────────────────────────────
        for (let r = 0; r < Math.min(rows.length, 5); r++) {
            const row = rows[r];
            for (let c = 0; c < row.length; c++) {
                const val = String(row[c] || '').trim();
                if (!val) continue;

                // Tarih ara
                const d = parseTurkishDate(val);
                if (d && !tarih) { tarih = d; continue; }

                // "TARİH:" veya "DATE:" gibi etiket hücresini atla
                if (/^tarih[:\s]/i.test(val)) continue;

                // İlk anlamlı alfanümerik hücre = müşteri adı (büyük harf, Türkçe)
                if (!musteriAdi && /^[A-ZÇĞİÖŞÜa-zçğışöüñ\s]+$/.test(val) && val.length > 2) {
                    musteriAdi = val.toUpperCase();
                }
            }
        }

        // ── 3B. Zaman sütunlarını bul (HH:MM pattern) ──────────────────
        for (let r = 0; r < Math.min(rows.length, 6); r++) {
            const row = rows[r];
            const timesInRow = row.filter(v => /^\d{1,2}:\d{2}$/.test(String(v || '').trim()));
            if (timesInRow.length >= 2) {
                timeColIdx = r;
                // Saat başlıklarının sütun indekslerini kaydet
                row.forEach((v, c) => {
                    if (/^\d{1,2}:\d{2}$/.test(String(v || '').trim())) {
                        timeCols.push({ colIdx: c, saat: String(v).trim() });
                    }
                });
                break;
            }
        }

        if (timeCols.length === 0) throw new Error('Zaman sütunları bulunamadı (07:30, 18:00 gibi HH:MM başlıkları bekleniyor).');
        if (!tarih) throw new Error('Tarih bulunamadı. Başlıkta "31 Ocak 2026" gibi bir tarih olmalı.');
        if (!musteriAdi) throw new Error('Müşteri/Şirket adı Excel başlığında bulunamadı.');

        // ── 3C. Giriş/Çıkış alt başlık satırı + veri başlangıcı ──────────
        // Saat başlıklarından sonraki satır GİRİŞ/ÇIKIŞ alt başlıkları
        const subHeaderRow = rows[timeColIdx + 1] || [];

        // timeCols'a yön bilgisini ekle
        timeCols = timeCols.map(tc => {
            const sub = String(subHeaderRow[tc.colIdx] || '').toUpperCase().trim();
            const yon = sub.includes('ÇIKIŞ') ? 'ÇIKIŞ' : 'GİRİŞ';
            return { ...tc, yon };
        });

        // Veri satırları GİRİŞ/ÇIKIŞ satırından sonra başlar
        dataStartRow = timeColIdx + 2;

        // ── 3D. Güzergah sütununu bul: Çok katmanlı header taraması
        // "NO", "İZMİR", "GÜZERGAH" kelimesine bak
        const headerRow = rows[timeColIdx] || [];
        guzergahCol = 1; // varsayılan
        for (let c = 0; c < Math.min(headerRow.length, timeCols[0].colIdx); c++) {
            const vText = [
                String(rows[Math.max(0, timeColIdx - 1)]?.[c] || ''),
                String(rows[timeColIdx]?.[c] || ''),
                String(rows[timeColIdx + 1]?.[c] || '')
            ].join(' ').toUpperCase();

            if (vText.includes('GÜZERGAH') || vText.includes('GUZERGAH') || vText.includes('İZMİR') || vText.includes('IZMIR')) {
                guzergahCol = c;
            }
        }

        return { musteriAdi, tarih, timeCols, dataStartRow, guzergahCol };
    }

    // ══════════════════════════════════════════════════════════════════════
    //  4. Vardiya Gruplama — Aynı plaka yan yana → TAM, tek/aralıklı → TEK
    // ══════════════════════════════════════════════════════════════════════
    function grupVardiyalar(plakalar, timeCols) {
        // plakalar: string[], timeCols[i].saat / .yon ile eşleşiyor
        const result = [];
        let i = 0;
        while (i < plakalar.length) {
            const plaka = String(plakalar[i] || '').trim();
            if (!plaka) { i++; continue; }

            // Sonraki sütunda da aynı plaka var mı?
            const sonrakiPlaka = i + 1 < plakalar.length ? String(plakalar[i + 1] || '').trim() : '';
            if (sonrakiPlaka && sonrakiPlaka === plaka) {
                // TAM vardiya: iki sütun birden
                result.push({
                    plaka,
                    vardiya: 'TAM',
                    giris_saati: timeCols[i].saat,
                    cikis_saati: timeCols[i + 1].saat
                });
                i += 2;
            } else {
                // TEK sefer
                result.push({
                    plaka,
                    vardiya: 'TEK',
                    giris_saati: timeCols[i].saat,
                    cikis_saati: null
                });
                i++;
            }
        }
        return result;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  5. Tüm Excel'i parse et → ham kayıt listesi
    // ══════════════════════════════════════════════════════════════════════
    function parseExcelRows(rows, headerInfo) {
        const { musteriAdi, tarih, timeCols, dataStartRow, guzergahCol } = headerInfo;
        const kayitlar = [];

        // Sona kadar satır oku
        for (let r = dataStartRow; r < rows.length; r++) {
            const row = rows[r];

            // Güzergah adı
            const guzergah = String(row[guzergahCol] || '').trim();

            // Boş satır veya TOPLAM satırı atla
            if (!guzergah || /^toplam/i.test(guzergah)) continue;

            // Her zaman sütunu için plaka al
            const plakalar = timeCols.map(tc => {
                const val = String(row[tc.colIdx] || '').trim();
                // Hücre plaka formatında mı? Harf+rakam içeriyorsa plaka kabul et
                return val && /[A-Z0-9]/.test(val.toUpperCase()) ? val.toUpperCase() : '';
            });

            // Hiç plaka yoksa bu satırı atla
            if (plakalar.every(p => !p)) continue;

            // Vardiya gruplama uygula
            const vardiyalar = grupVardiyalar(plakalar, timeCols);

            for (const v of vardiyalar) {
                kayitlar.push({
                    musteriAdi,
                    tarih,
                    guzergah,
                    plaka: v.plaka,
                    vardiya: v.vardiya,
                    giris_saati: v.giris_saati,
                    cikis_saati: v.cikis_saati
                });
            }
        }

        return kayitlar;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  6. Supabase Validasyonu
    // ══════════════════════════════════════════════════════════════════════
    async function validateKayitlar(kayitlar) {
        const supabase = window.supabaseClient;

        const [aracRes, musteriRes, mevcutRes] = await Promise.all([
            supabase.from('araclar').select('plaka, id, mulkiyet_durumu, kira_bedeli'),
            supabase.from('musteriler').select('id, ad'),
            supabase.from('musteri_servis_puantaj').select('tarih, arac_id, musteri_id')
        ]);

        if (aracRes.error)   throw new Error('Araç listesi alınamadı: ' + aracRes.error.message);
        if (musteriRes.error) throw new Error('Müşteri listesi alınamadı: ' + musteriRes.error.message);

        const plakaMap   = Object.fromEntries((aracRes.data || []).map(a => [a.plaka.toUpperCase().trim(), a]));
        const musteriMap = Object.fromEntries((musteriRes.data || []).map(m => [m.ad.toUpperCase().trim(), m]));
        const mevcutSet  = new Set((mevcutRes.data || []).map(r => `${r.tarih}|${r.arac_id}|${r.musteri_id}`));

        return kayitlar.map((k, i) => {
            const errors   = [];
            const warnings = [];

            const arac    = plakaMap[k.plaka] || null;
            const musteri = musteriMap[k.musteriAdi.toUpperCase().trim()] || null;

            if (!arac)    errors.push(`Plaka "${k.plaka}" sistemde yok`);
            if (!musteri) warnings.push(`Müşteri "${k.musteriAdi}" sistemde yok — yeni oluşturulacak`);

            // Duplicate kontrolü
            if (arac && musteri) {
                const key = `${k.tarih}|${arac.id}|${musteri.id}`;
                if (mevcutSet.has(key)) warnings.push('Bu kayıt zaten mevcut');
            }

            return {
                ...k,
                satir: i + 1,
                arac,
                musteri,
                durum:  errors.length > 0 ? 'hata' : warnings.length > 0 ? 'uyari' : 'ok',
                errors,
                warnings
            };
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  7. Önizleme Tablosu
    // ══════════════════════════════════════════════════════════════════════
    function renderPreview(validatedRows) {
        const hatali      = validatedRows.filter(r => r.durum === 'hata').length;
        const uyarili     = validatedRows.filter(r => r.durum === 'uyari').length;
        const temiz       = validatedRows.filter(r => r.durum === 'ok').length;
        const aktarilacak = temiz + uyarili;

        const body = document.getElementById('import-modal-body');
        if (!body) return;

        body.innerHTML = `
            <div class="import-ozet">
                <span class="badge badge-success">✓ ${temiz} hazır</span>
                <span class="badge badge-warning">⚠ ${uyarili} uyarı</span>
                <span class="badge badge-error">✗ ${hatali} hata</span>
                <span style="margin-left:auto;font-size:0.75rem;color:hsl(var(--text-dim));">
                    Müşteri: <strong>${validatedRows[0]?.musteriAdi || '?'}</strong>
                    &nbsp;|&nbsp; Tarih: <strong>${validatedRows[0]?.tarih || '?'}</strong>
                </span>
            </div>

            ${hatali > 0 ? `<div class="import-hatalar-kutu"><strong>⚠ ${hatali} satırda hata var</strong> — bu satırlar aktarılmayacak.</div>` : ''}

            <div class="import-tablo-kap">
                <table class="import-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Güzergah</th>
                            <th>Plaka</th>
                            <th>Vardiya</th>
                            <th>Giriş Saati</th>
                            <th>Durum</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${validatedRows.map(r => `
                            <tr class="row-${r.durum}">
                                <td class="text-center">${r.satir}</td>
                                <td>${r.guzergah}</td>
                                <td><strong>${r.plaka}</strong></td>
                                <td><span class="${r.vardiya === 'TAM' ? 'badge badge-success' : 'badge badge-warning'}">${r.vardiya}</span></td>
                                <td>${r.giris_saati || ''}${r.cikis_saati ? ' – ' + r.cikis_saati : ''}</td>
                                <td class="durum-cell">
                                    ${r.errors.map(e => `<div class="import-err">✗ ${e}</div>`).join('')}
                                    ${r.warnings.map(w => `<div class="import-warn">⚠ ${w}</div>`).join('')}
                                    ${r.durum === 'ok' ? '<div class="import-ok">✓ Hazır</div>' : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="import-actions">
                <button id="import-onayla-btn"
                    onclick="window.importConfirm()"
                    class="import-btn-primary"
                    data-original-text="${aktarilacak} Kaydı İçe Aktar"
                    ${aktarilacak === 0 ? 'disabled' : ''}>
                    ${aktarilacak === 0
                        ? 'Tüm satırlarda hata — düzeltin'
                        : hatali > 0
                        ? `${aktarilacak} kaydı aktar (${hatali} hatalı atlanacak)`
                        : `${aktarilacak} Kaydı İçe Aktar`}
                </button>
                <button onclick="window.closeImportModal()" class="import-btn-secondary">İptal</button>
            </div>
        `;

        openImportModal();
    }

    // ══════════════════════════════════════════════════════════════════════
    //  8. Toplu Supabase Yazma
    // ══════════════════════════════════════════════════════════════════════
    window.importConfirm = async function () {
        const validatedRows = window._importRows;
        if (!validatedRows || validatedRows.length === 0) return;

        const aktarilacaklar = validatedRows.filter(r => r.durum !== 'hata');
        if (aktarilacaklar.length === 0) {
            showImportToast('Aktarılacak geçerli satır yok.', 'error');
            return;
        }

        const btn = document.getElementById('import-onayla-btn');
        if (btn) btn.dataset.originalText = btn.textContent.trim();
        setImportLoading(true);

        const supabase = window.supabaseClient;

        try {
            let servisCount      = 0;
            let yeniMusteriCount = 0;
            let hakedisCount     = 0;

            // Aynı müşteri adı için yeni oluşturmayı cache'le
            const yeniMusteriCache = {};

            for (const row of aktarilacaklar) {
                // Müşteri ID bul ya da oluştur
                let musteriId = row.musteri?.id || null;

                if (!musteriId) {
                    // Cache'de var mı?
                    if (yeniMusteriCache[row.musteriAdi]) {
                        musteriId = yeniMusteriCache[row.musteriAdi];
                    } else {
                        const { data: yeni, error: mErr } = await supabase
                            .from('musteriler')
                            .insert({ ad: row.musteriAdi })
                            .select('id')
                            .single();
                        if (mErr) { console.error('Müşteri oluşturulamadı:', mErr); continue; }
                        musteriId = yeni.id;
                        yeniMusteriCache[row.musteriAdi] = musteriId;
                        yeniMusteriCount++;
                    }
                }

                // musteri_servis_puantaj'a yaz
                const { error: sErr } = await supabase
                    .from('musteri_servis_puantaj')
                    .insert({
                        musteri_id: musteriId,
                        arac_id:    row.arac.id,
                        tarih:      row.tarih,
                        vardiya:    row.vardiya,
                        gunluk_ucret: 0
                    });

                if (sErr) {
                    console.error(`[import] satır ${row.satir} servis hatası:`, sErr);
                } else {
                    servisCount++;
                }

                // Taşeron araç ise taseron_hakedis'e de yaz
                if (row.arac.mulkiyet_durumu === 'TAŞERON') {
                    const { error: hErr } = await supabase
                        .from('taseron_hakedis')
                        .insert({
                            arac_id:         row.arac.id,
                            sefer_tarihi:    row.tarih,
                            guzergah:        `${row.guzergah} (${row.giris_saati})`,
                            anlasilan_tutar: row.arac.kira_bedeli || 0,
                            yakit_kesintisi: 0
                        });
                    if (!hErr) hakedisCount++;
                }
            }

            let mesaj = `${servisCount} servis kaydı aktarıldı.`;
            if (yeniMusteriCount > 0) mesaj += ` ${yeniMusteriCount} yeni müşteri oluşturuldu.`;
            if (hakedisCount > 0)    mesaj += ` ${hakedisCount} taşeron hakediş eklendi.`;

            showImportToast(mesaj, 'success');
            window.closeImportModal();

            if (typeof window.refreshAllModules === 'function') window.refreshAllModules();
            if (typeof window.fetchMusteriler    === 'function') window.fetchMusteriler();

        } catch (err) {
            console.error('[import] Genel hata:', err);
            showImportToast('İçe aktarma hatası: ' + err.message, 'error');
        } finally {
            setImportLoading(false);
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    //  9. Dosya Tetikleyicileri
    // ══════════════════════════════════════════════════════════════════════
    window.handleImportFile = async function (file) {
        if (!file) return;
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            showImportToast('Sadece .xlsx veya .xls dosyaları kabul edilir.', 'error');
            return;
        }

        const dropArea = document.querySelector('.import-drop-area');
        if (dropArea) dropArea.classList.add('import-drop-active');

        try {
            showImportToast('Excel okunuyor...', 'info');
            const rows = await readRawExcel(file);

            const headerInfo = parseHeaderInfo(rows);
            showImportToast(
                `Müşteri: ${headerInfo.musteriAdi} | Tarih: ${headerInfo.tarih} | ${headerInfo.timeCols.length} saat sütunu`,
                'info'
            );

            const kayitlar = parseExcelRows(rows, headerInfo);
            if (kayitlar.length === 0) throw new Error('İçe aktarılacak geçerli satır bulunamadı.');

            showImportToast(`${kayitlar.length} sefer tespit edildi, doğrulanıyor...`, 'info');
            const validated = await validateKayitlar(kayitlar);
            window._importRows = validated;
            renderPreview(validated);

        } catch (err) {
            showImportToast(err.message, 'error');
        } finally {
            if (dropArea) dropArea.classList.remove('import-drop-active');
            const fi = document.getElementById('import-file-input');
            if (fi) fi.value = '';
        }
    };

    window.handleImportDrop = function (e) {
        e.preventDefault(); e.stopPropagation();
        const dropArea = document.querySelector('.import-drop-area');
        if (dropArea) dropArea.classList.remove('import-drop-hover');
        const file = e.dataTransfer?.files?.[0];
        if (file) window.handleImportFile(file);
    };

    window.handleImportDragOver = function (e) {
        e.preventDefault();
        const dropArea = document.querySelector('.import-drop-area');
        if (dropArea) dropArea.classList.add('import-drop-hover');
    };

    window.handleImportDragLeave = function () {
        const dropArea = document.querySelector('.import-drop-area');
        if (dropArea) dropArea.classList.remove('import-drop-hover');
    };

    // ── Modal Aç/Kapat ───────────────────────────────────────────────────
    function openImportModal() {
        const m = document.getElementById('import-preview-modal');
        if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
        if (window.lucide) window.lucide.createIcons();
    }

    window.closeImportModal = function () {
        const m = document.getElementById('import-preview-modal');
        if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
        window._importRows = null;
    };

})();
