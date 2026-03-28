/**
 * DİKKAN ÖZEL İMPORT SİSTEMİ
 * Bu dosya sadece Dikkan fabrikasının günlük Excel formatını işler.
 */

window.handleDikkanImport = async function(file) {
    console.log("Dikkan import started:", file?.name);
    if (!file) return;

    // Kütüphane Kontrolü
    if (typeof XLSX === 'undefined') {
        alert("Hata: Excel kütüphanesi (XLSX) henüz yüklenmedi. Lütfen sayfayı yenileyip tekrar deneyin.");
        console.error("XLSX is not defined");
        return;
    }

    if (!window.supabaseClient) {
        alert("Hata: Veritabanı bağlantısı (Supabase) hazır değil.");
        console.error("supabaseClient is not defined");
        return;
    }
    
    // Yükleniyor overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    overlay.innerHTML = '<div class="text-white text-sm font-bold animate-pulse text-center"><i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto mb-2"></i> Dikkan Exceli İşleniyor...</div>';
    document.body.appendChild(overlay);
    if(window.lucide) window.lucide.createIcons();

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 5) throw new Error("Excel dosyası çok kısa veya geçersiz format.");

        // 1. Tarih Çekme (C1 hücresi - jsonData[0][2])
        const dateStr = jsonData[0][2]; // "1 Mart 2026 Pazar" gibi
        const parsedDate = parseTurkishDate(dateStr);
        if (!parsedDate) throw new Error("Excel'den tarih okunamadı (C1 hücresini kontrol edin). Beklenen: '1 Mart 2026 Pazar'");

        // 2. Dikkan Müşteri ID Bul
        const { data: musteri, error: mErr } = await window.supabaseClient
            .from('musteriler')
            .select('id')
            .ilike('ad', '%Dikkan%')
            .single();
        
        if (mErr || !musteri) throw new Error("Sistemde 'Dikkan' isimli müşteri bulunamadı. Lütfen önce müşteriyi ekleyin.");
        const musteriId = musteri.id;

        // 3. Verileri Ayrıştır
        // Col D: 07:00 (Giriş) -> Tek
        // Col F: 18:00 (Çıkış) -> Tek
        // Col G: 21:00 (Mesai) -> Mesai
        
        const plateResults = {}; // { plaka: { tek: 0, mesai: 0 } }

        for (let i = 2; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length < 2) continue; // Güzergah yoksa atla

            const sabahPlaka = String(row[2] || '').trim().toUpperCase(); // Col C (index 2)
            const aksamPlaka = String(row[3] || '').trim().toUpperCase(); // Col D (index 3)
            const mesaiPlaka = String(row[4] || '').trim().toUpperCase(); // Col E (index 4)

            const processPlate = (plate, type) => {
                if (plate && plate.length > 5 && plate.includes(' ')) {
                    if (!plateResults[plate]) plateResults[plate] = { tek: 0, mesai: 0 };
                    plateResults[plate][type]++;
                }
            };

            processPlate(sabahPlaka, 'tek');
            processPlate(aksamPlaka, 'tek');
            processPlate(mesaiPlaka, 'mesai');
        }

        const plates = Object.keys(plateResults);
        if (plates.length === 0) throw new Error("Excel'de geçerli plaka bulunamadı.");

        // 4. Plakaları ID'ye Çevir & Doğrula
        const { data: dbAraclar } = await window.supabaseClient
            .from('araclar')
            .select('id, plaka')
            .in('plaka', plates);
        
        const plateMap = {};
        dbAraclar?.forEach(a => plateMap[a.plaka] = a.id);

        // Preview Rows Oluştur
        const previewRows = plates.map(plaka => {
            const aracId = plateMap[plaka];
            const counts = plateResults[plaka];
            return {
                plaka,
                aracId,
                tek: counts.tek,
                mesai: counts.mesai,
                tarih: parsedDate,
                musteriId: musteriId,
                durum: aracId ? 'ok' : 'uyari',
                warnings: aracId ? [] : [`"${plaka}" sistemde kayıtlı değil. Atlanacak.`]
            };
        });

        // 5. Önizleme Modalını Göster
        window._dikkanImportRows = previewRows;
        renderDikkanPreview(previewRows);

    } catch (error) {
        console.error('Dikkan Import Hatası:', error);
        alert("HATA: " + error.message);
    } finally {
        overlay.remove();
    }
};

function renderDikkanPreview(rows) {
    const body = document.getElementById('import-modal-body');
    if (!body) return;

    const uyarili = rows.filter(r => r.durum === 'uyari').length;
    const temiz = rows.filter(r => r.durum === 'ok').length;

    body.innerHTML = `
        <div class="import-ozet mb-4 flex items-center gap-4">
            <span class="px-3 py-1 bg-emerald-500/20 text-emerald-500 rounded-lg text-xs font-bold">✓ ${temiz} Hazır</span>
            ${uyarili > 0 ? `<span class="px-3 py-1 bg-orange-500/20 text-orange-500 rounded-lg text-xs font-bold">⚠ ${uyarili} Uyarı</span>` : ''}
            <span class="ml-auto text-[10px] text-gray-500 uppercase font-bold tracking-widest">Tarih: ${rows[0]?.tarih}</span>
        </div>

        <div class="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
            <table class="w-full text-left border-collapse text-xs">
                <thead>
                    <tr class="bg-white/5 text-gray-400 uppercase tracking-widest">
                        <th class="p-4 font-bold">Plaka</th>
                        <th class="p-4 font-bold text-center">Tek Sefer</th>
                        <th class="p-4 font-bold text-center">Mesai</th>
                        <th class="p-4 font-bold">Durum</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                    ${rows.map(r => `
                        <tr class="hover:bg-white/5 transition-colors">
                            <td class="p-4 font-bold ${r.durum === 'uyari' ? 'text-orange-400' : 'text-white'}">${r.plaka}</td>
                            <td class="p-4 text-center font-black text-blue-400">${r.tek}</td>
                            <td class="p-4 text-center font-black text-emerald-400">${r.mesai}</td>
                            <td class="p-4">
                                ${r.durum === 'ok' ? '<span class="text-emerald-500">✓ Hazır</span>' : ''}
                                ${r.warnings.map(w => `<div class="text-[10px] text-orange-500">⚠ ${w}</div>`).join('')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="mt-6 flex gap-3">
            <button onclick="window.dikkanImportConfirm()" class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all">
                ${temiz} Kaydı İçe Aktar
            </button>
            <button onclick="window.closeImportModal()" class="px-6 py-3 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-xl transition-all">
                İptal
            </button>
        </div>
    `;

    const modal = document.getElementById('import-preview-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); }
    if (window.lucide) window.lucide.createIcons();
}

window.dikkanImportConfirm = async function() {
    const rows = window._dikkanImportRows;
    if (!rows) return;

    const finalRows = rows.filter(r => r.aracId);
    if (finalRows.length === 0) {
        alert("Aktarılacak geçerli kayıt yok.");
        return;
    }

    const btn = event.target;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Aktarılıyor...";

    try {
        let successCount = 0;
        let errorMessages = [];

        for (const row of finalRows) {
            // 1. Puantaj Kaydı (Upsert)
            const payload = {
                musteri_id: row.musteriId,
                arac_id: row.aracId,
                tarih: row.tarih,
                tek: row.tek,
                mesai: row.mesai,
                vardiya: 0
            };

            const { error: upsertErr } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .upsert(payload, { onConflict: 'musteri_id, arac_id, tarih' });
            
            if (upsertErr) {
                console.error("Puantaj upsert hatası:", upsertErr);
                errorMessages.push(`${row.plaka}: ${upsertErr.message}`);
                continue;
            }

            // 2. Müşteri Araç Ataması (Müşteri Portföyü'ne ekle)
            // SADECE eğer araç bu müşteriye daha önce atanmamışsa ekle (Fiyatları sıfırlamamak için)
            const { data: existingAtama } = await window.supabaseClient
                .from('musteri_arac_tanimlari')
                .select('id')
                .eq('musteri_id', row.musteriId)
                .eq('arac_id', row.aracId)
                .maybeSingle();

            if (!existingAtama) {
                const atamaPayload = {
                    musteri_id: row.musteriId,
                    arac_id: row.aracId,
                    tarife_turu: 'Tek' 
                };
                const { error: atamaErr } = await window.supabaseClient
                    .from('musteri_arac_tanimlari')
                    .insert([atamaPayload]);

                if (atamaErr) {
                    console.error("Müşteri araç atama hatası:", atamaErr);
                }
            }

            successCount++;
        }

        if (errorMessages.length > 0 && successCount === 0) {
            alert("HATA: Kayıtlar işlenemedi!\n\nSebeb: " + errorMessages[0] + "\n\nNot: Veritabanı kısıtlamaları (Unique Constraint) eksik olabilir. Lütfen SQL güncellemelerini çalıştırın.");
        } else {
            alert(`DİKKAN İMPORT TAMAMLANDI!\nBaşarılı: ${successCount}\nHatalı: ${errorMessages.length}`);
        }
        
        window.closeImportModal();
        if(window.fetchMusteriler) window.fetchMusteriler();

    } catch (e) {
        alert("BEKLENMEDİK HATA: " + e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
};

// Yardımcı Fonksiyon: Türkçeleştirilmiş Tarih Parse
function parseTurkishDate(str) {
    if (!str) return null;
    const months = {
        "Ocak": "01", "Şubat": "02", "Mart": "03", "Nisan": "04", "Mayıs": "05", "Haziran": "06",
        "Temmuz": "07", "Ağustos": "08", "Eylül": "09", "Ekim": "10", "Kasım": "11", "Aralık": "12"
    };
    
    // "1 Mart 2026 Pazar" formatını parçala
    const parts = String(str).split(' ');
    if (parts.length < 3) return null;
    
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];
    const year = parts[2];
    
    if (!month || !year) return null;
    return `${year}-${month}-${day}`;
}

window.downloadDikkanSample = async function() {
    console.log("downloadDikkanSample called with ExcelJS");
    try {
        if (typeof ExcelJS === 'undefined') {
            alert("Hata: ExcelJS kütüphanesi henüz yüklenmedi. Lütfen sayfayı yenileyip tekrar deneyin.");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dikkan Rapor');

        // Sütun Genişlikleri
        worksheet.columns = [
            { header: 'NO', key: 'no', width: 6 },
            { header: 'GÜZERGAH', key: 'guzergah', width: 25 },
            { header: '07:00', key: 'time1', width: 15 },
            { header: '18:00', key: 'time2', width: 15 },
            { header: '21:00', key: 'time3', width: 15 },
        ];

        // 1. SATIR: Başlık ve Tarih
        // Resime göre A1 boş, B1 DİKKAN, C1 Tarih
        const row1 = worksheet.getRow(1);
        row1.values = ['', 'DİKKAN', '1 Mart 2026 Pazar'];
        
        // Stil 1. Satır: Açık Mavi Arkaplan (#BDD7EE), Kalın Yazı
        const lightBlueFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFBDD7EE' }
        };
        
        for(let i=1; i<=5; i++) {
            const cell = row1.getCell(i);
            cell.fill = lightBlueFill;
            cell.font = { bold: true, size: 11 };
            cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
            cell.border = {
                top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
            };
        }

        // 2. SATIR: Tablo Başlıkları
        const row2 = worksheet.getRow(2);
        row2.values = ['NO', 'GÜZERGAH', '07:00', '18:00', '21:00'];
        
        // Stil 2. Satır: Koyu Mavi Arkaplan (#2F75B5), Beyaz Kalın Yazı, Orta Hizalama
        const darkBlueFill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2F75B5' }
        };
        const whiteFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };

        for(let i=1; i<=5; i++) {
            const cell = row2.getCell(i);
            cell.fill = darkBlueFill;
            cell.font = whiteFont;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
            };
        }

        // 3. SATIR VE SONRASI: Örnek Veriler
        const sampleData = [
            [1, "ÇİĞLİ", "34 ABC 123", "34 ABC 123", "34 ABC 123"],
            [2, "MAVİŞEHİR", "35 XYZ 789", "35 XYZ 789", ""],
            [3, "ŞEMİKLER", "06 DEF 456", "06 DEF 456", "06 DEF 456"],
            [4, "BAYRAKLI", "", "", ""],
            [5, "BORNOVA", "", "", ""],
        ];

        // Verileri ekle ve boş satırları tamamla (Toplam 22 satır)
        for (let i = 0; i < 20; i++) {
            const rowIdx = i + 3;
            const dataRow = worksheet.getRow(rowIdx);
            if (i < sampleData.length) {
                dataRow.values = sampleData[i];
            } else {
                dataRow.values = [i + 1, "", "", "", ""];
            }

            // Veri satırı stili: Kenarlıklar ve hizzalama
            for(let j=1; j<=5; j++) {
                const cell = dataRow.getCell(j);
                cell.alignment = { vertical: 'middle', horizontal: (j === 2) ? 'left' : 'center' };
                cell.border = {
                    top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}
                };
            }
        }

        // Dosyayı oluştur ve indir
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'Dikkan_Ornek_Puantaj_Stil.xlsx';
        anchor.click();
        window.URL.revokeObjectURL(url);

    } catch (e) {
        console.error("Örnek Excel oluşturma hatası:", e);
        alert("Örnek dosya oluşturulamadı: " + e.message);
    }
};
