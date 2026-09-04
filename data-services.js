// === GLOBAL BAĞLANTI KONTROLÜ ===
window.checkSupabaseConnection = function () {
    if (!window.supabaseUrl || window.supabaseUrl === 'YOUR_SUPABASE_URL') {
        return { ok: false, msg: "Supabase URL yapılandırılmamış (config.js)." };
    }
    if (!window.supabaseKey || window.supabaseKey.startsWith('sb_publishable_')) {
        return { ok: false, msg: "Hatalı Supabase Key! config.js dosyasındaki anahtar muhtemelen bir Stripe anahtarı. Lütfen Supabase anon-public key ile değiştirin." };
    }
    if (!window.supabaseClient) {
        return { ok: false, msg: "Supabase istemcisi başlatılamadı." };
    }
    return { ok: true };
};

window.showGlobalError = function (containerId, message) {
    const el = document.getElementById(containerId);
    if (el) {
        // XSS Safe: user-visible data via textContent, not innerHTML interpolation
        const wrapper = document.createElement('div');
        wrapper.className = 'col-span-full py-12 text-center';

        const badge = document.createElement('div');
        badge.className = 'inline-flex items-center gap-3 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 mb-2';
        badge.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5"></i><span class="font-bold">Bağlantı Hatası</span>';

        const p = document.createElement('p');
        p.className = 'text-sm text-gray-400 max-w-sm mx-auto';
        p.textContent = message; // XSS safe

        const btn = document.createElement('button');
        btn.className = 'mt-4 text-xs underline text-gray-500 hover:text-white transition-all';
        btn.textContent = 'Tekrar Dene';
        btn.addEventListener('click', function() { location.reload(); });

        wrapper.appendChild(badge);
        wrapper.appendChild(p);
        wrapper.appendChild(btn);
        el.innerHTML = '';
        el.appendChild(wrapper);

        if (window.lucide) window.lucide.createIcons();
    }
};

window.uploadDosya = async function (file, folder = 'common') {
    const conn = window.checkSupabaseConnection();
    if (!conn.ok) {
        if (window.Toast) { window.Toast.error(conn.msg); }
        else { alert(conn.msg); }
        return null;
    }
    if (!file) return null;
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error } = await window.supabaseClient.storage.from('filo-erp').upload(`${folder}/${fileName}`, file);
    if (error) {
        console.error("Dosya yükleme hatası:", error);
        return null;
    }
    const { data: { publicUrl } } = window.supabaseClient.storage.from('filo-erp').getPublicUrl(`${folder}/${fileName}`);
    return publicUrl;
};

window.createFuelRecord = async function (payload, currentKm, options = {}) {
    const litre = Number(payload && payload.litre);
    const toplamTutar = Number(payload && payload.toplam_tutar);
    if (!payload || !payload.tarih || !payload.arac_id || !Number.isFinite(litre) || litre <= 0 || !Number.isFinite(toplamTutar) || toplamTutar <= 0) {
        throw new Error('Tarih, araç, litre ve toplam tutar alanları zorunludur.');
    }
    const insertData = {
        tarih: payload.tarih,
        arac_id: payload.arac_id,
        litre,
        birim_fiyat: Number(payload.birim_fiyat) > 0 ? Number(payload.birim_fiyat) : Number((toplamTutar / litre).toFixed(4)),
        toplam_tutar: toplamTutar
    };
    if (!options.skipDuplicateCheck) {
        const { data: similarRows, error: similarError } = await window.supabaseClient.from('yakit_takip').select('arac_id, tarih, litre, toplam_tutar').eq('arac_id', insertData.arac_id).eq('tarih', insertData.tarih);
        if (similarError) throw similarError;
        const similar = window.FuelAnalytics ? window.FuelAnalytics.similarFuelRecords(similarRows || [], insertData) : [];
        if (similar.length && !window.confirm('Benzer bir yakıt kaydı zaten mevcut. Yine de kaydetmek istiyor musunuz?')) throw new Error('Yakıt kaydı kullanıcı tarafından iptal edildi.');
    }
    const { error } = await window.supabaseClient.from('yakit_takip').insert([insertData]);
    if (error) throw error;
    const parsedKm = parseInt(currentKm, 10) || null;
    if (parsedKm) {
        const { data: arac } = await window.supabaseClient.from('araclar').select('guncel_km').eq('id', payload.arac_id).single();
        if (!arac || parsedKm > (arac.guncel_km || 0)) await window.supabaseClient.from('araclar').update({ guncel_km: parsedKm }).eq('id', payload.arac_id);
    }
    if (typeof fetchYakitlar === 'function') fetchYakitlar();
    if (typeof fetchTaseronFinans === 'function') fetchTaseronFinans();
    if (typeof fetchFinansDashboard === 'function') fetchFinansDashboard();
    if (typeof window.fetchFuelAnalytics === 'function') window.fetchFuelAnalytics();
    return insertData;
};

window.saveDataAndClose = async function (event, keepOpen = false) {
    const btn = event.currentTarget;
    const originalHTML = btn.innerHTML;

    // Yükleniyor durumu animasyonu
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Kaydediliyor...`;
    btn.classList.add('opacity-80', 'cursor-wait');

    const formTitle = modalTitle.textContent;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') {
            throw new Error("Lütfen index.html içerisindeki Supabase URL ve KEY değerlerini kendi projenize göre girin. Aksi halde veritabanı bağlantısı kurulamaz!");
        }

        if (formTitle === 'Yeni Araç Ekle') {
            const plaka = document.getElementById('arac-plaka').value;
            const marka = document.getElementById('arac-marka').value;
            const mulkiyet = document.getElementById('arac-mulkiyet').value;
            const arac_sinifi = document.getElementById('arac-sinifi')?.value || null;
            const belge_turu = document.getElementById('arac-belge').value;
            const sirket = document.getElementById('arac-sirket').value;
            if (!plaka) throw new Error("Plaka zorunludur.");
            let { error } = await window.supabaseClient.from('araclar').insert([{ plaka, marka_model: marka, mulkiyet_durumu: mulkiyet, arac_sinifi, belge_turu, sirket }]);
            if (error && /arac_sinifi|column|schema cache/i.test(error.message || '')) {
                const fallback = await window.supabaseClient.from('araclar').insert([{ plaka, marka_model: marka, mulkiyet_durumu: mulkiyet, belge_turu, sirket }]);
                error = fallback.error;
            }
            if (error) throw error;
            if (typeof fetchAraclar === 'function') fetchAraclar();
        } else if (formTitle === 'Araç Güncelle') {
            const id = document.getElementById('edit-arac-id').value;
            const plaka = document.getElementById('edit-arac-plaka').value;
            const marka = document.getElementById('edit-arac-marka').value;
            const mulkiyet = document.getElementById('edit-arac-mulkiyet').value;
            const arac_sinifi = document.getElementById('edit-arac-sinifi')?.value || null;
            const belge_turu = document.getElementById('edit-arac-belge').value;
            const sirket = document.getElementById('edit-arac-sirket').value;
            const firma_adi = document.getElementById('edit-arac-firma')?.value || null;

            if (!plaka || !id) throw new Error("Plaka zorunludur.");

            // Önce firma_adi dahil güncellemeyi dene (sütun yoksa graceful fallback)
            let updatePayload = { plaka, marka_model: marka, mulkiyet_durumu: mulkiyet, arac_sinifi, belge_turu, sirket, firma_adi };
            let { error } = await window.supabaseClient.from('araclar').update(updatePayload).eq('id', id);

            if (error && /arac_sinifi|firma_adi|column|schema cache/i.test(error.message || '')) {
                // Yeni opsiyonel alanlardan biri henüz yoksa temel araç kaydını koru.
                const { plaka: p, marka_model, mulkiyet_durumu, belge_turu: bt, sirket: s } = { plaka, marka_model: marka, mulkiyet_durumu: mulkiyet, belge_turu, sirket };
                const fallbackRes = await window.supabaseClient.from('araclar').update({ plaka, marka_model: marka, mulkiyet_durumu: mulkiyet, belge_turu, sirket }).eq('id', id);
                error = fallbackRes.error;
            }

            if (error) throw error;
            // Listeyi yenile: hem özmal hem taşeron kartlarını güncelle
            if (typeof fetchAraclar === 'function') fetchAraclar();
            if (typeof fetchTaseronlar === 'function') fetchTaseronlar();
        } else if (formTitle === 'Yeni Şoför Ekle') {
            const ad_soyad = document.getElementById('sofor-ad').value?.trim();
            const telefon = document.getElementById('sofor-telefon').value?.trim();
            const gunluk_ucret = parseFloat(document.getElementById('sofor-ucret').value) || 0;
            const aylik_maas = parseFloat(document.getElementById('sofor-aylik-maas')?.value) || 0;
            const sigorta_durumu = document.getElementById('sofor-sigorta').value;
            const tc_no = document.getElementById('sofor-tc')?.value?.trim() || null;
            const dogum_tarihi = document.getElementById('sofor-dogum')?.value || null;
            const ehliyet_sinifi = document.getElementById('sofor-ehliyet')?.value || null;
            const src_belgesi = document.getElementById('sofor-src')?.value || null;
            const belge_url = document.getElementById('sofor-belge-url')?.value?.trim() || null;
            const ise_baslama = document.getElementById('sofor-ise-baslama')?.value || null;
            const iban = document.getElementById('sofor-iban')?.value?.trim() || null;
            const sirket = document.getElementById('sofor-sirket')?.value || 'IDEOL';

            if (!ad_soyad) throw new Error("İsim boş bırakılamaz.");

            const driverData = {
                ad_soyad,
                telefon,
                gunluk_ucret,
                aylik_maas: aylik_maas || 0,
                sigorta_durumu,
                tc_no: tc_no || null,
                dogum_tarihi: dogum_tarihi || null,
                ehliyet_sinifi: ehliyet_sinifi || null,
                src_belgesi: src_belgesi || null,
                belge_url: belge_url || null,
                ise_baslama_tarihi: ise_baslama || null,
                iban: iban || null,
                sirket
            };

            const acil_kisi = document.getElementById('sofor-acil-kisi')?.value?.trim();
            const acil_tel = document.getElementById('sofor-acil-telefon')?.value?.trim();
            if (acil_kisi) driverData.acil_durum_kisi = acil_kisi;
            if (acil_tel) driverData.acil_durum_telefon = acil_tel;

            const { error } = await window.supabaseClient.from('soforler').insert([driverData]);
            if (error) throw error;
            if (typeof fetchSoforler === 'function') fetchSoforler();
            if (typeof fetchSoforMaaslar === 'function') fetchSoforMaaslar();
            if (typeof fetchDashboard === 'function') fetchDashboard();

        } else if (formTitle === 'Şoför Güncelle') {
            const id = document.getElementById('edit-sofor-id').value;
            const ad_soyad = document.getElementById('edit-sofor-ad').value;
            const tc_no = document.getElementById('edit-sofor-tc').value;
            const dogum_tarihi = document.getElementById('edit-sofor-dogum').value || null;
            const telefon = document.getElementById('edit-sofor-telefon').value;
            const ehliyet_sinifi = document.getElementById('edit-sofor-ehliyet').value;
            const src_belgesi = document.getElementById('edit-sofor-src').value;
            const belge_url = document.getElementById('edit-sofor-belge-url').value;
            const aylik_maas = parseFloat(document.getElementById('edit-sofor-aylik-maas').value) || 0;
            const gunluk_ucret = parseFloat(document.getElementById('edit-sofor-ucret').value) || 0;
            const sigorta_durumu = document.getElementById('edit-sofor-sigorta').value;
            const ise_baslama_tarihi = document.getElementById('edit-sofor-ise-baslama').value || null;
            const sirket = document.getElementById('edit-sofor-sirket')?.value || 'IDEOL';

            const updateData = {
                ad_soyad, tc_no, dogum_tarihi, telefon, ehliyet_sinifi,
                src_belgesi, belge_url, aylik_maas, gunluk_ucret,
                sigorta_durumu, ise_baslama_tarihi, sirket
            };

            const acil_kisi = document.getElementById('edit-sofor-acil-kisi')?.value?.trim();
            const acil_tel = document.getElementById('edit-sofor-acil-telefon')?.value?.trim();
            if (acil_kisi) updateData.acil_durum_kisi = acil_kisi;
            if (acil_tel) updateData.acil_durum_telefon = acil_tel;

            const { error } = await window.supabaseClient.from('soforler').update(updateData).eq('id', id);
            if (error) throw error;
            if (typeof fetchSoforler === 'function') fetchSoforler();
            if (typeof fetchSoforMaaslar === 'function') fetchSoforMaaslar();
        }
        else if (formTitle === 'Yeni Finans İşlemi') {
            const sofor_id = document.getElementById('finans-sofor').value;
            const islem_turu = document.getElementById('finans-tur').value;
            let tutar = parseFloat(document.getElementById('finans-tutar').value);
            let aciklama = document.getElementById('finans-aciklama').value || '';

            // Dinamik Alanlar
            if (islem_turu === 'AVANS') {
                const odemeSekli = document.getElementById('finans-avans-odeme')?.value;
                if (odemeSekli) aciklama = `[Şekli: ${odemeSekli}] ` + aciklama;
            } else if (islem_turu === 'KESİNTİ (Ceza/Hasar)') {
                const sebep = document.getElementById('finans-kesinti-sebep')?.value;
                const cezaNo = document.getElementById('finans-kesinti-no')?.value;
                let not = `[Sebep: ${sebep || '-'}] `;
                if (cezaNo) not += `[No: ${cezaNo}] `;
                aciklama = not + aciklama;
            } else if (islem_turu === 'PRİM/HARCIRAH') {
                const donem = document.getElementById('finans-prim-donem')?.value; // YYYY-MM
                if (donem) aciklama = `[Dönem: ${donem}] ` + aciklama;
            }

            if (!sofor_id || isNaN(tutar)) throw new Error("Şoför ve tutar zorunludur.");

            if (islem_turu === 'AVANS' || islem_turu === 'KESİNTİ (Ceza/Hasar)') {
                if (tutar > 0) tutar = -tutar; // ensure negative for deductions
            } else {
                if (tutar < 0) tutar = -tutar; // ensure positive for salary
            }

            const { error } = await window.supabaseClient.from('sofor_finans').insert([{ sofor_id, islem_turu, tutar, aciklama }]);
            if (error) throw error;
            if (typeof fetchSoforFinans === 'function') fetchSoforFinans();
        }
        else if (formTitle === 'Yeni Sefer Hakedişi Ekle') {
            const arac_id = document.getElementById('taseron-arac').value;
            const sefer_tarihi = document.getElementById('taseron-tarih').value;
            const guzergah = document.getElementById('taseron-guzergah').value;
            const anlasilan_tutar = parseFloat(document.getElementById('taseron-tutar').value);
            const yakit_kesintisi = parseFloat(document.getElementById('taseron-yakit').value) || 0;
            if (!arac_id || !sefer_tarihi || isNaN(anlasilan_tutar)) throw new Error("Araç, tarih ve anlaşılan tutar zorunludur.");

            // The net_hakedis is generated in postgres
            const { error } = await window.supabaseClient.from('taseron_hakedis').insert([{
                arac_id, sefer_tarihi, guzergah, anlasilan_tutar, yakit_kesintisi
            }]);
            if (error) throw error;
            if (typeof fetchTaseronFinans === 'function') fetchTaseronFinans();
        } else if (formTitle === 'Yeni Taşeron Kaydı') {
            const plaka = document.getElementById('taseron-yeni-plaka').value;
            const firma_adi = document.getElementById('taseron-yeni-firma').value;
            const marka_model = document.getElementById('taseron-yeni-marka').value;
            const kira_bedeli = parseFloat(document.getElementById('taseron-yeni-kira').value) || 0;
            const sofor_id = document.getElementById('taseron-yeni-sofor').value;

            if (!plaka || !firma_adi) throw new Error("Plaka ve firma adı zorunludur.");
            const { error } = await window.supabaseClient.from('araclar').insert([{
                plaka, firma_adi, marka_model, kira_bedeli, sofor_id: sofor_id || null, mulkiyet_durumu: 'TAŞERON'
            }]);
            if (error) throw error;
            if (typeof fetchTaseronlar === 'function') fetchTaseronlar();
        } else if (formTitle === 'Yeni Müşteri Ekle') {
            const ad = document.getElementById('musteri-ad').value;
            const vergi_no_daire = document.getElementById('musteri-vergi').value;
            const yetkili_kisi = document.getElementById('musteri-yetkili').value;
            const telefon = document.getElementById('musteri-tel').value;
            const adres = document.getElementById('musteri-adres').value;
            const vade_gun = document.getElementById('musteri-vade').value;
            const logo_url = document.getElementById('musteri-logo').value;

            if (!ad) throw new Error("Müşteri adı zorunludur.");
            const { error } = await window.supabaseClient.from('musteriler').insert([{
                ad, vergi_no_daire, yetkili_kisi_ad_soyad: yetkili_kisi,
                telefon, adres, vade_gun, logo_url
            }]);
            if (error) throw error;
            if (typeof fetchMusteriler === 'function') fetchMusteriler();
        } else if (formTitle === 'Müşteri Güncelle') {
            const id = document.getElementById('edit-musteri-id').value;
            const ad = document.getElementById('edit-musteri-ad').value;
            const vergi_no_daire = document.getElementById('edit-musteri-vergi').value;
            const yetkili_kisi = document.getElementById('edit-musteri-yetkili').value;
            const telefon = document.getElementById('edit-musteri-tel').value;
            const adres = document.getElementById('edit-musteri-adres').value;
            const vade_gun = document.getElementById('edit-musteri-vade').value;
            const logo_url = document.getElementById('edit-musteri-logo').value;

            if (!ad || !id) throw new Error("Müşteri adı zorunludur.");
            const { error } = await window.supabaseClient.from('musteriler').update({
                ad, vergi_no_daire, yetkili_kisi_ad_soyad: yetkili_kisi,
                telefon, adres, vade_gun, logo_url
            }).eq('id', id);

            if (error) throw error;
            if (typeof fetchMusteriler === 'function') fetchMusteriler();
        } else if (formTitle === 'Yeni Servis Kaydı') {
            const musteri_id = document.getElementById('servis-musteri').value;
            const arac_id = document.getElementById('servis-arac').value;
            const tarih = document.getElementById('servis-tarih').value;
            const vardiya = document.getElementById('servis-vardiya').value;
            const gunluk_ucret = parseFloat(document.getElementById('servis-fatura').value) || 0;
            if (!musteri_id || !arac_id || !tarih) throw new Error("Müşteri, araç ve tarih alanları zorunludur.");
            const { error } = await window.supabaseClient.from('musteri_servis_puantaj').insert([{
                musteri_id, arac_id, tarih, vardiya, gunluk_ucret
            }]);
            if (error) throw error;
            try {
                const { data: arac } = await window.supabaseClient.from('araclar').select('mulkiyet_durumu, kira_bedeli').eq('id', arac_id).single();
                if (arac && arac.mulkiyet_durumu === 'TAŞERON') {
                    const t = vardiya.toUpperCase();
                    if (t !== 'X' && t !== 'R' && t !== 'I' && t !== 'İ') {
                        await window.supabaseClient.from('taseron_hakedis').insert({
                            arac_id: arac_id,
                            sefer_tarihi: tarih,
                            guzergah: 'Müşteri Servisi (Oto)',
                            anlasilan_tutar: arac.kira_bedeli || gunluk_ucret,
                            yakit_kesintisi: 0
                        });
                    }
                }
            } catch(te) { console.warn(te); }
            if (typeof fetchMusteriServis === 'function') fetchMusteriServis();
        } else if (formTitle === 'Yeni Puantaj Gir') {
            const sofor_id = document.getElementById('puantaj-sofor').value;
            const arac_id = document.getElementById('puantaj-arac').value;
            const tarih = document.getElementById('puantaj-tarih').value;
            const durum = document.getElementById('puantaj-durum').value;
            const gunluk_harcirah = parseFloat(document.getElementById('puantaj-harcirah').value) || 0;
            if (!sofor_id || !tarih) throw new Error("Şoför ve tarih seçimi zorunludur.");
            const { error } = await window.supabaseClient.from('sofor_puantaj').insert([{
                sofor_id, arac_id, tarih, durum, gunluk_harcirah
            }]);
            if (error) throw error;
            if (typeof fetchSoforPuantaj === 'function') fetchSoforPuantaj();
        } else if (formTitle === 'Araç Şoför Ata') {
            const arac_id = document.getElementById('atama-arac-id').value;
            const sofor_id = document.getElementById('atama-sofor').value;
            if (!arac_id || !sofor_id) throw new Error("Araç ve Şoför seçimi zorunludur.");
            const { error } = await window.supabaseClient.from('araclar').update({ sofor_id }).eq('id', arac_id);
            if (error) throw error;
            if (typeof fetchAraclar === 'function') fetchAraclar();
        } else if (formTitle === 'Araç Evrak Güncelle') {
            const arac_id = document.getElementById('evrak-arac-id').value;
            const vize_bitis = document.getElementById('evrak-vize').value || null;
            const vize_dosya_url = document.getElementById('evrak-vize-url').value || null;
            const sigorta_bitis = document.getElementById('evrak-sigorta').value || null;
            const sigorta_dosya_url = document.getElementById('evrak-sigorta-url').value || null;
            const kasko_bitis = document.getElementById('evrak-kasko').value || null;
            const kasko_dosya_url = document.getElementById('evrak-kasko-url').value || null;

            const koltuk_bitis = document.getElementById('evrak-koltuk')?.value || null;
            const koltuk_dosya_url = document.getElementById('evrak-koltuk-url')?.value || null;

            if (!arac_id) throw new Error("Araç ID bulunamadı.");
            let payload = {
                vize_bitis, vize_dosya_url,
                sigorta_bitis, sigorta_dosya_url,
                kasko_bitis, kasko_dosya_url,
                koltuk_bitis, koltuk_dosya_url
            };
            let { error } = await window.supabaseClient.from('araclar').update(payload).eq('id', arac_id);

            if (error && error.message && (error.message.toLowerCase().includes('could not find') || error.message.toLowerCase().includes('does not exist') || error.message.toLowerCase().includes('could not identify column'))) {
                delete payload.koltuk_bitis;
                delete payload.koltuk_dosya_url;
                const fallbackRes = await window.supabaseClient.from('araclar').update(payload).eq('id', arac_id);
                error = fallbackRes.error;
                // Removed window.Toast.info to allow silent syncing without warning the user
            }

            if (error) throw error;
            if (typeof fetchAraclar === 'function') fetchAraclar();
        } else if (formTitle === 'Müşteriye Araç Tanımla') {
            const musteriSelect = document.getElementById('tanim-musteri');
            const musteri_id = musteriSelect.value;
            const musteriAd  = musteriSelect.options[musteriSelect.selectedIndex]?.text || '';
            const arac_id    = document.getElementById('tanim-arac').value;

            // Tarife türünü fabrika adına göre otomatik belirle
            // Dikkan → 'Tek' (kendi puantaj satırları olan fabrika)
            // Diğerleri → 'Vardiya'
            const isDikkanFabrika = musteriAd.toUpperCase().includes('DİKKAN') || musteriAd.toUpperCase().includes('DIKKAN');
            const tarife_turu = isDikkanFabrika ? 'Tek' : 'Vardiya';

            if (!musteri_id || !arac_id) throw new Error("Müşteri ve Araç seçimi zorunludur.");
            const { error } = await window.supabaseClient.from('musteri_arac_tanimlari').insert([{
                musteri_id, arac_id, tarife_turu, tek_fiyat: 0, vardiya_fiyat: 0
            }]);
            if (error) {
                if (error.code === '23505') throw new Error("Bu araç zaten bu müşteriye tanımlı.");
                throw error;
            }
            // Auto-refresh müşteri kartı
            if (typeof fetchMusteriler === 'function') {
                setTimeout(async () => {
                    await fetchMusteriler();
                    const btn = document.querySelector(`[data-musteri-id="${musteri_id}"] button[onclick*="toggleMusteriAraclar"]`);
                    if(btn) btn.click();
                }, 400);
            }
            const excelMusteriSec = document.getElementById('excel-musteri-sec');
            if (typeof loadExcelGrid === 'function' && excelMusteriSec && excelMusteriSec.value === musteri_id) {
                loadExcelGrid();
            }
        } else if (formTitle === 'Yeni Teklif Ekle' && document.getElementById('teklif-tur')) {
            const arac_id = document.getElementById('teklif-arac')?.value;
            const police_turu = document.getElementById('teklif-tur')?.value || 'Trafik';
            const firmaSelect = document.getElementById('teklif-firma');
            const cari_id = firmaSelect?.value || null;
            const firma_adi = firmaSelect?.options[firmaSelect.selectedIndex]?.text?.trim() || '';
            const teklif_tarihi = document.getElementById('teklif-tarih')?.value || '';
            const konu = document.getElementById('teklif-konu')?.value?.trim() || '';
            const taksit_sayisi = parseInt(document.getElementById('teklif-taksit')?.value) || 1;
            const police_bitis = document.getElementById('teklif-bitis')?.value || null;
            const totals = window.teklifToplamHesapla();
            const kalemler = totals.lines;

            if (!arac_id) throw new Error('Araç seçimi zorunludur.');
            if (!cari_id) throw new Error('Cari / müşteri seçimi zorunludur.');
            if (!teklif_tarihi) throw new Error('Teklif tarihi zorunludur.');
            if (!konu) throw new Error('Teklif konusu zorunludur.');
            if (!kalemler.length || kalemler.some(kalem => !kalem.aciklama || kalem.miktar <= 0 || kalem.birim_fiyat <= 0)) {
                throw new Error('Her teklif kalemi için açıklama, miktar ve birim fiyat girilmelidir.');
            }
            if (totals.genelToplam <= 0) throw new Error('Teklif toplamı sıfırdan büyük olmalıdır.');

            const createdAt = new Date().toISOString();
            const secenekler = {
                teklif_no: `TKL-${teklif_tarihi.replaceAll('-', '')}-${Date.now().toString().slice(-6)}`,
                teklif_turu: police_turu,
                teklif_tarihi,
                police_bitis,
                konu,
                kalemler,
                ara_toplam: totals.araToplam,
                kdv_toplam: totals.kdv,
                taksit_sayisi,
                durum: window.TeklifManagement.STATUSES.draft,
                son_islem: createdAt,
                gecmis: [{ durum: window.TeklifManagement.STATUSES.draft, tarih: createdAt }]
            };
            const insertData = { arac_id, cari_id, firma_adi, tutar: totals.genelToplam, secenekler };

            const { error } = await window.supabaseClient.from('sigorta_teklifleri').insert([insertData]);
            if (error) throw error;
            if (typeof fetchTeklifler === 'function') fetchTeklifler();

        } else if (formTitle === 'Yeni Yakıt Kaydı') {
            const tarih = document.getElementById('yakit-tarih').value;
            const arac_id = document.getElementById('yakit-arac').value;
            const litre = document.getElementById('yakit-litre').value;
            const birim_fiyat = document.getElementById('yakit-fiyat').value;
            const toplam_tutar = document.getElementById('yakit-tutar').value;
            const anlik_km = parseInt(document.getElementById('yakit-km')?.value) || null;

            if (!tarih || !arac_id || !litre) throw new Error("Lütfen zorunlu yakıt bilgilerini giriniz.");

            await window.createFuelRecord({ tarih, arac_id, litre, birim_fiyat, toplam_tutar }, anlik_km);
        } else if (formTitle === 'Yeni Yakıt/KM Fişi') {
            const arac_id = document.getElementById('manuel-yakit-arac').value;
            const tarih = document.getElementById('manuel-yakit-tarih').value;
            const sofor_adi = document.getElementById('manuel-yakit-sofor').value;
            const tutar = parseFloat(document.getElementById('manuel-yakit-tutar').value) || 0;
            const kilometre = parseInt(document.getElementById('manuel-yakit-km').value);

            if (!arac_id || !tarih || isNaN(kilometre)) {
                throw new Error("Lütfen Araç, Tarih ve KM alanlarını eksiksiz doldurun.");
            }

            // Önce aracın bir önceki KM kaydını bulalım (farkı hesaplamak için)
            let fark_km = 0;
            try {
                const { data: lastRecord } = await window.supabaseClient
                    .from('manuel_yakit_fisleri')
                    .select('kilometre')
                    .eq('arac_id', arac_id)
                    .order('kilometre', { ascending: false })
                    .limit(1)
                    .single();

                if (lastRecord && lastRecord.kilometre) {
                    fark_km = kilometre - lastRecord.kilometre;
                    if (fark_km < 0) fark_km = 0; // Yanlış giriş ihtimaline karşı
                }
            } catch (err) {
                // Kayıt yoksa hata verir, fark 0 kalır. Normal durum.
            }

            // Yeni kaydı oluştur
            const insertData = { arac_id, tarih, sofor_adi, tutar, kilometre, fark_km };
            const { error } = await window.supabaseClient.from('manuel_yakit_fisleri').insert([insertData]);
            
            if (error) {
                if (error.message && error.message.includes('relation "public.manuel_yakit_fisleri" does not exist')) {
                    throw new Error("Veritabanında 'manuel_yakit_fisleri' tablosu bulunamadı. Lütfen size iletilen SQL komutunu Supabase'de çalıştırın.");
                }
                throw error;
            }

            // Aracın güncel KM değerini ana tabloda güncelle
            try {
                const { data: arac } = await window.supabaseClient.from('araclar').select('guncel_km').eq('id', arac_id).single();
                if (!arac || kilometre > (arac.guncel_km || 0)) {
                    await window.supabaseClient.from('araclar').update({ guncel_km: kilometre }).eq('id', arac_id);
                    if (typeof fetchAraclar === 'function') fetchAraclar();
                    if (typeof fetchDashboardData === 'function') fetchDashboardData();
                }
            } catch(e) { console.warn("KM Guncelleme hatasi:", e); }

            if (typeof window.fetchManuelYakitFisleri === 'function') window.fetchManuelYakitFisleri();
            
            if (keepOpen) {
                // Sadece formu temizle, modalı açık bırak
                document.getElementById('manuel-yakit-tarih').value = new Date().toISOString().split('T')[0];
                document.getElementById('manuel-yakit-tutar').value = '';
                document.getElementById('manuel-yakit-km').value = '';
                
                // Submit butonunu tekrar aktif et
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalHTML;
                }
                
                if (typeof showToast === 'function') showToast("Kayıt eklendi. Yeni fiş girebilirsiniz.", 'success');
                
                return; // closeModal()'a gitmesini engelle
            }
        } else if (formTitle === 'Yeni Cari Hesap') {
            let unvan = document.getElementById('cari-unvan').value;
            const tur = document.getElementById('cari-tur').value;
            let telefon = document.getElementById('cari-telefon').value || '';

            // Dinamik Alanları Yükle (Açıklama alanı olmadığı için ünvan/telefon sonuna not olarak ekliyoruz)
            let ekNot = '';
            if (tur === 'Tamirci') {
                const belge = document.getElementById('cari-tamirci-belge')?.value;
                const uzmanlik = document.getElementById('cari-tamirci-uzmanlik')?.value;
                if (belge) ekNot += `[Yetki Belgesi: ${belge}] `;
                if (uzmanlik) ekNot += `[Uzmanlık: ${uzmanlik}]`;
            } else if (tur === 'Sigorta Acentesi') {
                const levha = document.getElementById('cari-sigorta-levha')?.value;
                if (levha) ekNot += `[Acente No: ${levha}]`;
            } else if (tur === 'Tedarikçi') {
                const grup = document.getElementById('cari-tedarikci-grup')?.value;
                if (grup) ekNot += `[Grup: ${grup}]`;
            }

            if (ekNot) {
                unvan = unvan + ` ${ekNot.trim()}`;
            }

            if (!unvan.trim()) throw new Error("Ünvan zorunludur.");
            const { error } = await window.supabaseClient.from('cariler').insert([{
                unvan, tur, telefon
            }]);
            if (error) throw error;
            if (typeof fetchCariler === 'function') fetchCariler();
        } else if (formTitle === 'Cari Güncelle') {
            const id = document.getElementById('edit-cari-id').value;
            const unvan = document.getElementById('edit-cari-unvan').value;
            const tur = document.getElementById('edit-cari-tur').value;
            const telefon = document.getElementById('edit-cari-telefon').value || '';

            if (!unvan.trim() || !id) throw new Error("Unvan zorunludur.");
            const { error } = await window.supabaseClient.from('cariler').update({ unvan, tur, telefon }).eq('id', id);
            if (error) throw error;
            if (typeof fetchCariler === 'function') fetchCariler();
        } else if (formTitle === 'Yeni Bakım/Parça Kaydı') {
            const islem_tarihi = document.getElementById('bakim-tarih').value;
            const arac_id = document.getElementById('bakim-arac').value;
            const islem_turu = document.getElementById('bakim-tur').value;
            const cari_id = document.getElementById('bakim-cari').value || null;
            let aciklama = document.getElementById('bakim-aciklama').value || '';
            const bakim_km = parseInt(document.getElementById('bakim-km')?.value) || null;
            const toplam_tutar = parseFloat(document.getElementById('bakim-tutar').value) || 0;

            const odeme_turu = document.getElementById('bakim-odeme-turu')?.value || 'VADELİ (Cariye Yaz)';
            const kredi_karti_id = document.getElementById('bakim-kredi-karti')?.value || null;

            if (bakim_km) {
                aciklama = `[O Anki KM: ${bakim_km}] ` + aciklama;
            }

            // Dinamik Alanları Yükle
            if (islem_turu === 'Yedek Parça') {
                const parcaAdi = document.getElementById('bakim-parca-adi')?.value;
                const adet = document.getElementById('bakim-parca-adet')?.value || '1';
                if (parcaAdi) aciklama = `[Parça: ${parcaAdi} | Adet: ${adet}] ` + aciklama;
            } else if (islem_turu === 'Hasar Onarım') {
                const dosyaNo = document.getElementById('bakim-dosya-no')?.value;
                if (dosyaNo) aciklama = `[Hasar Dosya No: ${dosyaNo}] ` + aciklama;
            }

            // Dosya yükleme
            const bakimDosya = document.getElementById('bakim-dosya');
            let dosya_url = null;
            if (bakimDosya?.files?.length > 0) {
                dosya_url = await window.uploadDosya(bakimDosya.files[0], 'bakimlar');
            }

            if (!arac_id || !aciklama) throw new Error("Araç ve açıklama alanları zorunludur.");
            const { error, data: bakimData } = await window.supabaseClient.from('arac_bakimlari').insert([{
                islem_tarihi, arac_id, islem_turu, cari_id, aciklama, toplam_tutar, dosya_url
            }]).select();
            if (error) throw error;
            
            // Eğer bakım sırasında KM girildiyse aracın güncel KM'sini de güncelle
            if (bakim_km && arac_id) {
                try {
                    const { data: aData } = await window.supabaseClient.from('araclar').select('guncel_km').eq('id', arac_id).single();
                    if (!aData || bakim_km > (aData.guncel_km || 0)) {
                        await window.supabaseClient.from('araclar').update({ guncel_km: bakim_km }).eq('id', arac_id);
                    }
                    if (islem_turu === 'Yağ Değişimi') {
                        await window.supabaseClient.from('araclar').update({ son_yag_km: bakim_km }).eq('id', arac_id);
                    }
                } catch(err) { console.error('KM update error:', err); }
            }

            // Ödeme işlemi varsa otomatik düşüm yap
            if (odeme_turu !== 'VADELİ (Cariye Yaz)' && toplam_tutar > 0) {
                const odeme_cari_id = document.getElementById('bakim-odeme-cari')?.value || cari_id;
                let odemeAciklama = `[${islem_turu}] Otomatik Ödeme - Bakım ID: ${bakimData?.[0]?.id || ''}`;
                let gercekOdemeTuru = odeme_turu === 'KREDİ KARTI' ? 'Kredi Kartı' : (odeme_turu === 'CARİ HESABI' ? 'Cari Hesap' : 'Nakit');

                if (odeme_cari_id) {
                    const { error: odemeHata } = await window.supabaseClient.from('cari_odemeler').insert([{
                        cari_id: odeme_cari_id, tarih: islem_tarihi, odeme_turu: gercekOdemeTuru, tutar: toplam_tutar, aciklama: odemeAciklama
                    }]);
                    if (odemeHata) console.error('Otomatik cari ödeme eklenemedi:', odemeHata);
                }

                if (odeme_turu === 'KREDİ KARTI' && kredi_karti_id) {
                    const { error: kkHata } = await window.supabaseClient.from('kredi_karti_islemleri').insert([{
                        kart_id: kredi_karti_id, 
                        islem_tarihi, 
                        taksit_sayisi: 1,
                        aciklama: `[BAKIM/PARÇA] ${aciklama.substring(0, 50)}`, 
                        toplam_tutar: toplam_tutar
                    }]);
                    if (kkHata) console.error('Otomatik kredi kartı harcaması eklenemedi:', kkHata);
                }
            }

            // Yağ Bakımı Kaydı: Eğer bakım türü yağ değişimi ise son_yag_km güncelle
            if (bakim_km && arac_id) {
                const { data: arac } = await window.supabaseClient.from('araclar').select('guncel_km, son_yag_km').eq('id', arac_id).single();
                const updatePayload = {};
                if (!arac || bakim_km > (arac.guncel_km || 0)) updatePayload.guncel_km = bakim_km;
                const islemTuruLower = islem_turu?.toLowerCase() || '';
                if (
                    islem_turu.trim() === 'Yağ Değişimi' ||
                    islem_turu.trim() === 'Periyodik Bakım' ||
                    islem_turu.trim() === '10.000 Yağ' ||
                    islemTuruLower.includes('yağ') ||
                    islemTuruLower.includes('yag')
                ) {
                    updatePayload.son_yag_km = bakim_km;
                }
                if (Object.keys(updatePayload).length > 0) {
                    await window.supabaseClient.from('araclar').update(updatePayload).eq('id', arac_id);
                }
            }
            if (typeof fetchBakimlar === 'function') fetchBakimlar();
            if (typeof fetchDashboardData === 'function') fetchDashboardData();
        } else if (formTitle === 'Toplu Poliçe Kaydı') {
            // Toplu kaydetme islemi ui-manager.js'teki saveTopluPolice fonksiyonuna delege edilir
            if (typeof window.saveTopluPolice === 'function') {
                await window.saveTopluPolice();
            }
            return; // saveTopluPolice kendi toast ve modal kapatma islemini yonetir
        } else if (formTitle === 'Yeni Poliçe Kaydı') {
            const arac_id = document.getElementById('police-arac').value;
            const cari_id = document.getElementById('police-cari').value || null;
            const police_turu = document.getElementById('police-tur').value;
            const baslangic_tarihi = document.getElementById('police-baslangic').value;
            const bitis_tarihi = document.getElementById('police-bitis').value;
            const toplam_tutar = parseFloat(document.getElementById('police-tutar').value) || 0;
            const taksit_sayisi = parseInt(document.getElementById('police-taksit').value) || 1;

            const odeme_turu = document.getElementById('police-odeme-turu')?.value || 'VADELİ (Cariye Yaz)';
            const kredi_karti_id = document.getElementById('police-kredi-karti')?.value || null;
            const odeme_cari_id_police = document.getElementById('police-odeme-cari')?.value || null;

            // Dosya yükleme
            const dosyaInput = document.getElementById('police-dosya');
            let dosya_url = null;
            if (dosyaInput?.files?.length > 0) {
                dosya_url = await window.uploadDosya(dosyaInput.files[0], 'policeler');
            }

            if (!arac_id) throw new Error("Araç seçimi zorunludur.");
            if (!bitis_tarihi) throw new Error("Bitiş tarihi zorunludur.");

            const { error, data: policeData } = await window.supabaseClient.from('arac_policeler').insert([{
                arac_id, cari_id, police_turu,
                baslangic_tarihi: baslangic_tarihi || null,
                bitis_tarihi: bitis_tarihi || null,
                toplam_tutar, taksit_sayisi, dosya_url
            }]).select();
            if (error) throw error;

            // --- 3. ARAÇ BİTİŞ TARİHLERİNİ GÜNCELLE (OTOMATİK) ---
            const updatePayload = {};
            const pType = String(police_turu).trim().toLowerCase();
            if (pType.includes('kasko')) updatePayload.kasko_bitis = bitis_tarihi;
            else if (pType.includes('trafik') || pType.includes('sigort') || pType.includes('zorunlu')) updatePayload.sigorta_bitis = bitis_tarihi;
            else if (pType.includes('koltuk')) updatePayload.koltuk_bitis = bitis_tarihi;

            if (Object.keys(updatePayload).length > 0) {
                const { error: updError } = await window.supabaseClient.from('araclar').update(updatePayload).eq('id', arac_id);
                if (updError) {
                    if (updError.message && updError.message.toLowerCase().includes('could not find') && updatePayload.koltuk_bitis) {
                        delete updatePayload.koltuk_bitis;
                        if (Object.keys(updatePayload).length > 0) {
                            await window.supabaseClient.from('araclar').update(updatePayload).eq('id', arac_id);
                        }
                    } else {
                        console.error("Araç tarih güncelleme hatası:", updError);
                    }
                }
            }

            // --- 4. ÖDEME KAYITLARI (Entegre Detaylar) ---
            if (odeme_turu !== 'VADELİ (Cariye Yaz)' && toplam_tutar > 0) {
                const tarihIcin = baslangic_tarihi || new Date().toISOString().split('T')[0];
                const plakaDetay = document.getElementById('police-arac')?.options[document.getElementById('police-arac')?.selectedIndex]?.text || '-';
                const acenteDetay = document.getElementById('police-cari')?.options[document.getElementById('police-cari')?.selectedIndex]?.text || 'Genel';
                
                let odemeAciklama = `[${police_turu}] ${plakaDetay} - ${acenteDetay} - ${taksit_sayisi} Taksit [POLİÇE ID: ${policeData?.[0]?.id || ''}]`;
                let gercekOdemeTuru = odeme_turu === 'KREDİ KARTI' ? 'Kredi Kartı' : (odeme_turu === 'CARİ HESABI' ? 'Cari Hesap' : 'Nakit');
                const payer_cari = odeme_cari_id_police || cari_id;

                if (payer_cari) {
                    await window.supabaseClient.from('cari_odemeler').insert([{
                        cari_id: payer_cari, tarih: tarihIcin,
                        odeme_turu: gercekOdemeTuru, tutar: toplam_tutar, aciklama: odemeAciklama
                    }]);
                }

                if (odeme_turu === 'KREDİ KARTI' && kredi_karti_id) {
                    await window.supabaseClient.from('kredi_karti_islemleri').insert([{
                        kart_id: kredi_karti_id, islem_tarihi: tarihIcin,
                        taksit_sayisi: taksit_sayisi,
                        aciklama: odemeAciklama, tutar: toplam_tutar
                    }]);
                }
            }

            if (typeof fetchPoliceler === 'function') fetchPoliceler();
            if (typeof fetchAraclar === 'function') fetchAraclar();
            if (typeof fetchTaksitler === 'function') fetchTaksitler();
        } else if (formTitle === 'Poliçe Düzenle') {
            const id = document.getElementById('edit-police-id').value;
            const baslangic_tarihi = document.getElementById('edit-police-baslangic').value || null;
            const bitis_tarihi = document.getElementById('edit-police-bitis').value || null;
            const toplam_tutar = parseFloat(document.getElementById('edit-police-tutar').value) || 0;
            const taksit_sayisi = parseInt(document.getElementById('edit-police-taksit').value) || 1;
            const aciklama = document.getElementById('edit-police-aciklama').value || null;
            const kredi_karti_id = document.getElementById('edit-police-kredi-karti')?.value || null;
            
            if (!id) throw new Error("Poliçe ID bulunamadı.");
            
            let payload = { baslangic_tarihi, bitis_tarihi, toplam_tutar, taksit_sayisi, aciklama };
            let { error } = await window.supabaseClient.from('arac_policeler').update(payload).eq('id', id);
            
            if (error && error.message && (error.message.toLowerCase().includes('could not find') || error.message.toLowerCase().includes('not exist') || error.message.toLowerCase().includes('could not identify column'))) {
                delete payload.aciklama;
                let fallback = await window.supabaseClient.from('arac_policeler').update(payload).eq('id', id);
                error = fallback.error;
                if (!error && window.Toast) window.Toast.info("Poliçe Notu için Supabase ayarı gerekli. Diğer veriler güncellendi.");
            }
            if (error) throw error;
            
            // Kredi Kartı Senkronizasyonu
            const odemeAciklamaTag = `[POLİÇE ID: ${id}]`;
            const plakaDetay = document.getElementById('edit-arac-plaka')?.textContent || document.getElementById('police-arac')?.options[document.getElementById('police-arac')?.selectedIndex]?.text || '';
            const guncelAciklama = `[Poliçe Düzenleme] ${plakaDetay} - ${aciklama || ''} ${odemeAciklamaTag}`;
            
            if (kredi_karti_id) {
                const existing = await window.supabaseClient.from('kredi_karti_islemleri').select('id, tutar, toplam_tutar').ilike('aciklama', `%${odemeAciklamaTag}%`).maybeSingle();
                if (existing?.data) {
                    await window.supabaseClient.from('kredi_karti_islemleri').update({
                        kart_id: kredi_karti_id, tutar: toplam_tutar, taksit_sayisi: taksit_sayisi,
                        islem_tarihi: baslangic_tarihi || new Date().toISOString().split('T')[0], aciklama: guncelAciklama
                    }).eq('id', existing.data.id);
                } else {
                    await window.supabaseClient.from('kredi_karti_islemleri').insert([{
                        kart_id: kredi_karti_id, tutar: toplam_tutar, taksit_sayisi: taksit_sayisi,
                        islem_tarihi: baslangic_tarihi || new Date().toISOString().split('T')[0], aciklama: guncelAciklama
                    }]);
                }
            } else {
                await window.supabaseClient.from('kredi_karti_islemleri').delete().ilike('aciklama', `%${odemeAciklamaTag}%`);
            }
            
            if (typeof fetchPoliceler === 'function') fetchPoliceler();
            if (typeof fetchKrediKartlari === 'function') fetchKrediKartlari();
        } else if (formTitle === 'Yeni Fatura Kaydı') {
            const cari_id = document.getElementById('fatura-cari-id').value;
            const fatura_tarihi = document.getElementById('fatura-tarih').value;
            const fatura_no = document.getElementById('fatura-no').value;
            let aciklama = document.getElementById('fatura-aciklama').value || '';
            const toplam_tutar = parseFloat(document.getElementById('fatura-tutar').value) || 0;
            const dosya_url = document.getElementById('fatura-dosya').value;
            const fatura_turu = document.getElementById('fatura-tur')?.value;

            // Dinamik Alanları Yükle
            if (fatura_turu === 'Yakıt') {
                const litre = document.getElementById('fatura-yakit-litre')?.value;
                const plaka = document.getElementById('fatura-yakit-plaka')?.value;
                let not = `[${fatura_turu}] `;
                if (litre) not += `${litre} Litre `;
                if (plaka) not += `(${plaka}) `;
                aciklama = not + aciklama;
            } else if (fatura_turu === 'OGS/HGS') {
                const ihlalMi = document.getElementById('fatura-ogs-ihlal')?.checked;
                const guzergah = document.getElementById('fatura-ogs-guzergah')?.value;
                let not = `[${fatura_turu}] `;
                if (ihlalMi) not += `!!İHLALLİ GEÇİŞ!! `;
                if (guzergah) not += `Güzergah: ${guzergah} `;
                aciklama = not + aciklama;
            } else if (fatura_turu === 'Genel Gider') {
                const ref = document.getElementById('fatura-genel-ref')?.value;
                let not = `[Genel Gider] `;
                if (ref) not += `Ref: ${ref} `;
                aciklama = not + aciklama;
            } else if (fatura_turu === 'Bakım / Servis Gideri') {
                const bAracId = document.getElementById('fatura-bakim-arac')?.value;
                const bKm = parseInt(document.getElementById('fatura-bakim-km')?.value) || null;
                const bPlaka = document.getElementById('fatura-bakim-arac')?.options[document.getElementById('fatura-bakim-arac')?.selectedIndex]?.text;
                
                let not = `[Bakım/Servis] `;
                if (bPlaka) not += `Araç: ${bPlaka} `;
                if (bKm) not += `(${bKm} KM) `;
                aciklama = not + aciklama;

                // KM Güncelleme & Teknik Geçişe Ekleme
                if (bAracId) {
                    try {
                        // 1. KM Güncelle
                        if (bKm) {
                            const { data: aData } = await window.supabaseClient.from('araclar').select('guncel_km').eq('id', bAracId).single();
                            if (!aData || bKm > (aData.guncel_km || 0)) {
                                await window.supabaseClient.from('araclar').update({ guncel_km: bKm }).eq('id', bAracId);
                            }
                        }
                        // 2. Teknik Bakım Geçmişine İşle (Çift kayıt ama takip için önemli)
                        await window.supabaseClient.from('arac_bakimlari').insert([{
                            islem_tarihi: fatura_tarihi,
                            arac_id: bAracId,
                            islem_turu: 'Servis/Bakım (Faturadan)',
                            cari_id: cari_id,
                            aciklama: aciklama,
                            toplam_tutar: toplam_tutar
                        }]);
                    } catch(err) { console.error('Fatura-Bakım entegrasyon hatası:', err); }
                }
            } else if (fatura_turu) {
                aciklama = `[${fatura_turu}] ` + aciklama;
            }

            if (!cari_id || !fatura_tarihi) throw new Error("Cari ve tarih seçimi zorunludur.");
            const { error } = await window.supabaseClient.from('cari_faturalar').insert([{
                cari_id, fatura_tarihi, fatura_no, aciklama, toplam_tutar, dosya_url
            }]);
            if (error) throw error;
            if (typeof fetchCariler === 'function') fetchCariler();
        } else if (formTitle === 'Yeni Ödeme Kaydı') {
            const cari_id = document.getElementById('odeme-cari').value;
            const tarih = document.getElementById('odeme-tarih').value;
            const odeme_turu = document.getElementById('odeme-tur').value;
            const tutar = parseFloat(document.getElementById('odeme-tutar').value) || 0;
            let aciklama = document.getElementById('odeme-aciklama').value || '';

            // Dinamik Alanları Yükle
            if (odeme_turu === 'Çek/Senet') {
                const cekNo = document.getElementById('odeme-cek-no')?.value;
                const vade = document.getElementById('odeme-vade')?.value;
                if (cekNo || vade) aciklama = `[Çek/Senet No: ${cekNo || '-'} | Vade: ${vade || '-'}] ` + aciklama;
            } else if (odeme_turu === 'Banka/Havale') {
                const dekont = document.getElementById('odeme-dekont-no')?.value;
                if (dekont) aciklama = `[Dekont/Ref: ${dekont}] ` + aciklama;
            } else if (odeme_turu === 'Kredi Kartı') {
                const kart = document.getElementById('odeme-kart-no')?.value;
                const fisAlindi = document.getElementById('odeme-fis-kart')?.checked;
                const fisNo = document.getElementById('odeme-fis-no-kart')?.value;
                let not = '';
                if (kart) not += `[Kart/Slip: ${kart}] `;
                if (fisAlindi) not += `[Fiş Kapatıldı` + (fisNo ? ` - No: ${fisNo}` : '') + `] `;
                aciklama = not + aciklama;
            } else if (odeme_turu === 'Nakit') {
                const fisAlindi = document.getElementById('odeme-fis-nakit')?.checked;
                const fisNo = document.getElementById('odeme-fis-no-nakit')?.value;
                if (fisAlindi) aciklama = `[Fiş Kapatıldı` + (fisNo ? ` - No: ${fisNo}` : '') + `] ` + aciklama;
            }

            if (!cari_id || !tarih || !tutar) throw new Error("Cari, tarih ve tutar zorunludur.");
            const { error } = await window.supabaseClient.from('cari_odemeler').insert([{
                cari_id, tarih, odeme_turu, tutar, aciklama
            }]);
            if (error) throw error;
            if (typeof fetchCariler === 'function') fetchCariler();
        } else if (formTitle === 'Yeni Maaş Kaydı') {
            const sofor_id = document.getElementById('maas-sofor').value;
            const arac_id = document.getElementById('maas-arac').value || null;
            const donem = document.getElementById('maas-donem').value;
            const calisma_gun = parseInt(document.getElementById('maas-gun').value) || 0;
            const net_maas = parseFloat(document.getElementById('maas-net').value) || 0;
            const avans = parseFloat(document.getElementById('maas-avans').value) || 0;
            const ceza = parseFloat(document.getElementById('maas-ceza').value) || 0;
            const haciz = parseFloat(document.getElementById('maas-haciz').value) || 0;
            const mk_banka = parseFloat(document.getElementById('maas-mk-banka').value) || 0;
            const ideol_banka = parseFloat(document.getElementById('maas-ideol-banka').value) || 0;
            const aciklama = document.getElementById('maas-aciklama').value;

            if (!sofor_id || !donem || !net_maas) throw new Error("Şoför, dönem ve net maaş zorunludur.");
            const { error } = await window.supabaseClient.from('sofor_maas_bordro').insert([{
                sofor_id, arac_id, donem, calisma_gun, net_maas, avans, ceza, haciz, mk_banka, ideol_banka, aciklama
            }]);
            if (error) throw error;
            if (typeof fetchSoforMaasBordro === 'function') fetchSoforMaasBordro();
        } else if (formTitle === 'Yeni Teklif Ekle') {
            const arac_id = document.getElementById('teklif-arac').value;

            // Cari select'ten hem id hem unvan al
            const firmaSelect = document.getElementById('teklif-firma');
            const cari_id = firmaSelect.value || null;
            const firma_adi = firmaSelect.options[firmaSelect.selectedIndex]?.text || '';

            const tutar = parseFloat(document.getElementById('teklif-tutar').value) || 0;
            const baslangic_tarihi = document.getElementById('teklif-baslangic').value || null;
            const bitis_tarihi = document.getElementById('teklif-bitis')?.value || null;
            const taksit_sayisi = parseInt(document.getElementById('teklif-taksit-sayisi')?.value) || 1;
            const taksit_tutar = parseFloat(document.getElementById('teklif-taksit-tutar')?.value) || 0;

            // Poliçe türünü çek (radio butonlardan)
            const turRadios = document.getElementsByName('teklif_turu');
            let teklif_turu = 'Trafik';
            for (let r of turRadios) { if (r.checked) teklif_turu = r.value; }

            const secenekler = {
                teklif_turu: teklif_turu,
                taksit_sayisi: taksit_sayisi,
                taksit_tutar: taksit_tutar,
                imm: document.getElementById('teklif-imm').checked,
                imm_limit: document.getElementById('teklif-imm-limit')?.value || '',
                yol_yardim: document.getElementById('teklif-yolyardim').checked,
                ikame_arac: document.getElementById('teklif-ikame').checked,
                ikame_gun: document.getElementById('teklif-ikame-sure')?.value || '',
                cam: document.getElementById('teklif-cam').checked
            };

            if (!arac_id || !firma_adi || !tutar) throw new Error("Araç, firma ve tutar zorunludur.");
            const insertData = { arac_id, firma_adi, tutar, baslangic_tarihi, bitis_tarihi: bitis_tarihi || null, taksit_sayisi, secenekler };
            if (cari_id) insertData.cari_id = cari_id;
            const { error } = await window.supabaseClient.from('sigorta_teklifleri').insert([insertData]);
            if (error) throw error;
            if (typeof fetchTeklifler === 'function') fetchTeklifler();
        } else if (formTitle === 'Yeni Kredi Kartı') {
            const kart_adi = document.getElementById('kredi-kart-adi').value;
            const kart_sahibi = document.getElementById('kredi-kart-sahibi').value || null;
            let kart_no = document.getElementById('kredi-kart-no').value || null;
            if (kart_no) kart_no = kart_no.replace(/\s+/g, '');
            let limit_tutari = parseFloat(document.getElementById('kredi-kart-limit').value);
            if(isNaN(limit_tutari)) limit_tutari = 0;

            if (!kart_adi) throw new Error("Kart adı zorunludur.");
            
            try {
                const { error } = await window.supabaseClient.from('kredi_kartlari').insert([{ kart_adi, kart_sahibi, kart_no, limit_tutari }]);
                if (error) throw error;
            } catch(e) {
                if(e.message && (e.message.toLowerCase().includes('could not find') || e.message.toLowerCase().includes('does not exist'))) {
                    // Fallback in case kart_no isn't added yet
                    await window.supabaseClient.from('kredi_kartlari').insert([{ kart_adi, kart_sahibi, limit_tutari }]);
                } else throw e;
            }
            if (typeof fetchKrediKartlari === 'function') fetchKrediKartlari();
        } else if (formTitle === 'Yeni Kart İşlemi') {
            const kart_id = document.getElementById('kredi-kart-secim').value;
            const islem_tarihi = document.getElementById('kart-islem-tarih').value;
            const taksit_sayisi = parseInt(document.getElementById('kart-islem-taksit').value) || 1;
            const aciklama = document.getElementById('kart-islem-aciklama').value || '';
            const toplam_tutar = parseFloat(document.getElementById('kart-islem-tutar').value) || 0;

            if (!kart_id || !islem_tarihi || !toplam_tutar) throw new Error("Kart, tarih ve tutar zorunludur.");
            
            try {
                const { error } = await window.supabaseClient.from('kredi_karti_islemleri').insert([{
                    kart_id, islem_tarihi, taksit_sayisi, aciklama, toplam_tutar
                }]);
                if (error) throw error;
            } catch(e) {
                if(e.message && (e.message.toLowerCase().includes('could not find') || e.message.toLowerCase().includes('does not exist'))) {
                    // Fallback to minimal set (some users might not have aciklama or taksit)
                    const { error: err2 } = await window.supabaseClient.from('kredi_karti_islemleri').insert([{
                        kart_id, islem_tarihi, toplam_tutar
                    }]);
                    if(err2) throw err2;
                } else throw e;
            }
            if (typeof fetchKrediKartlari === 'function') fetchKrediKartlari();

        // === SRP MODÜLLER: Evrak Arşivi & İş Emirleri ===
        } else if (formTitle === 'Yeni Evrak Ekle') {
            if (typeof window.saveEvrak === 'function') {
                await window.saveEvrak();
            } else {
                throw new Error('Evrak modülü yüklenemedi. Lütfen sayfayı yenileyin.');
            }
        } else if (formTitle === 'Yeni İş Emri') {
            if (typeof window.saveIsEmri === 'function') {
                await window.saveIsEmri();
            } else {
                throw new Error('İş emirleri modülü yüklenemedi. Lütfen sayfayı yenileyin.');
            }
        } else if (formTitle === 'Yeni Araç Çıkış Formu') {
            if (typeof window.saveChecklist === 'function') {
                await window.saveChecklist();
            } else {
                throw new Error('Checklist modülü yüklenemedi. Lütfen sayfayı yenileyin.');
            }
        }

        // Başarı toast göster ve modalı kapat
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:10px;background:rgba(22,163,74,0.92);color:white;font-size:0.8rem;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,0.25);backdrop-filter:blur(8px);`;
        toast.textContent = `✓ ${formTitle} kaydedildi`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        closeModal();
        if (typeof window.refreshAllModules === 'function') window.refreshAllModules();
    } catch (error) {
        console.error("Supabase Hatası:", error);
        // Hata mesajını modal içinde göster
        let errBox = document.getElementById('modal-error-box');
        if (!errBox) {
            errBox = document.createElement('div');
            errBox.id = 'modal-error-box';
            errBox.style.cssText = `margin-top:12px;padding:10px 14px;border-radius:8px;background:rgba(220,38,68,0.1);border:1px solid rgba(220,38,68,0.35);color:#e03050;font-size:0.78rem;font-weight:600;`;
            const dynBody = document.getElementById('modal-dynamic-body');
            if (dynBody) dynBody.appendChild(errBox);
        }

        let message = error.message || "Bilinmeyen bir hata oluştu.";
        if (error.details) message += ` | Detay: ${error.details}`;
        if (error.hint) message += ` | İpucu: ${error.hint}`;

        // XSS Safe: textContent yerine DOM API kullan
        errBox.textContent = '';
        const warnIcon = document.createTextNode('⚠ Kayıt başarısız: ');
        const msgSpan = document.createElement('span');
        msgSpan.style.fontWeight = '400';
        msgSpan.textContent = message; // user data → textContent, never innerHTML
        errBox.appendChild(warnIcon);
        errBox.appendChild(msgSpan);
        errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
        btn.innerHTML = originalHTML;
        btn.classList.remove('opacity-80', 'cursor-wait');
    }
}
window.deleteRecord = async function (tableName, id, fetchFunctionName) {
    const btn = window.event?.currentTarget;
    const originalHTML = btn ? btn.innerHTML : 'Sil';



    window.showConfirm("Bu kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.", async () => {
        if (btn) {
            btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span> Siliniyor...';
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }

        try {
            if (tableName === 'cariler') {
                await handleCariDeletion(id);
            } else if (tableName === 'soforler') {
                await handleSoforDeletion(id);
            } else if (tableName === 'arac_policeler') {
                await window.supabaseClient.from('kredi_karti_islemleri').delete().ilike('aciklama', `%[POLİÇE ID: ${id}]%`);
            }


            const { error } = await window.supabaseClient.from(tableName).delete().eq('id', id);

            if (error) {
                console.error("[SİLME] Supabase Silme Hatası:", error);
                if (error.code === '23503') {
                    throw new Error("Bu kayıt başka verilerle bağlantılı. Lütfen önce bağlı alt kayıtları siliniz.");
                }
                throw error;
            }

            if (window.Toast) { window.Toast.success('Kayıt başarıyla silindi.'); }
            else { alert("Kayıt başarıyla silindi."); }
            if (typeof window[fetchFunctionName] === 'function') window[fetchFunctionName]();
            if (typeof window.refreshAllModules === 'function' && fetchFunctionName !== 'refreshAllModules') window.refreshAllModules();
        } catch (error) {
            console.error("[SİLME] Hata:", error);
            if (window.Toast) { window.Toast.error('Silme hatası: ' + error.message); }
            else { alert("Silme hatası: " + error.message); }
        } finally {
            if (btn) {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    });
}
async function handleSoforDeletion(soforId) {

    try {

        const { error: aracErr } = await window.supabaseClient.from('araclar').update({ sofor_id: null }).eq('sofor_id', soforId);
        if (aracErr) console.warn("[SİLME-DERİN] Araç ataması kaldırılırken hata:", aracErr);


        const { error: finErr } = await window.supabaseClient.from('sofor_finans').delete().eq('sofor_id', soforId);
        if (finErr) console.warn("[SİLME-DERİN] İşlem geçmişi silinirken hata:", finErr);


        const { error: bordroErr } = await window.supabaseClient.from('sofor_maas_bordro').delete().eq('sofor_id', soforId);
        if (bordroErr) console.warn("[SİLME-DERİN] Bordro silinirken hata:", bordroErr);
    } catch (e) {
        console.error("[SİLME-DERİN] Şoför temizlik aşamasında kritik hata:", e);
        throw e;
    }
}
async function handleCariDeletion(cariId) {

    try {
        // 1. Bağlı Poliçeleri Temizle ve Araç Durumlarını Güncelle

        const { data: policeler } = await window.supabaseClient.from('arac_policeler').select('*').eq('cari_id', cariId);

        if (policeler && policeler.length > 0) {

            for (const p of policeler) {
                const updateData = {};
                if (p.police_turu && (p.police_turu.trim() === 'Trafik' || p.police_turu.trim() === 'Trafik Sigortası')) updateData.sigorta_bitis = null;
                else if (p.police_turu && p.police_turu.trim() === 'Kasko') updateData.kasko_bitis = null;

                if (Object.keys(updateData).length > 0) {
                    await window.supabaseClient.from('araclar').update(updateData).eq('id', p.arac_id);
                }
            }
            // Poliçeleri açıkça sil
            const { error: polErr } = await window.supabaseClient.from('arac_policeler').delete().eq('cari_id', cariId);
            if (polErr) console.warn("[SİLME-DERİN] Poliçe silme uyarısı:", polErr);
        }

        // 2. Bakım Kayıtlarındaki Referansları Temizle (NULL yap)

        const { error: bakimErr } = await window.supabaseClient.from('arac_bakimlari').update({ cari_id: null }).eq('cari_id', cariId);
        if (bakimErr) console.warn("[SİLME-DERİN] Bakım temizleme uyarısı:", bakimErr);

        // 3. Bağlı Faturaları Açıkça Sil

        const { error: fatErr } = await window.supabaseClient.from('cari_faturalar').delete().eq('cari_id', cariId);
        if (fatErr) console.warn("[SİLME-DERİN] Fatura silme uyarısı:", fatErr);

        // 4. Bağlı Ödemeleri (Hızlı Ödemeler, Tahsilatlar vb.) Sil

        const { error: odemeErr } = await window.supabaseClient.from('cari_odemeler').delete().eq('cari_id', cariId);
        if (odemeErr) console.warn("[SİLME-DERİN] Ödeme silme uyarısı:", odemeErr);



        // Diğer tabloları güncelle
        if (typeof fetchAraclar === 'function') fetchAraclar();
        if (typeof fetchPoliceler === 'function') fetchPoliceler();
        if (typeof fetchBakimlar === 'function') fetchBakimlar();
        if (typeof fetchTaksitler === 'function') fetchTaksitler();
    } catch (err) {
        console.error("[SİLME-DERİN] Kritik Hata:", err);
        // Ana silme işleminin devam etmesi için hatayı yutuyoruz ama logluyoruz
    }
}

window.currentOzmalFilter = 'hepsi';

window.filterOzmalCizelge = function(sirketName) {
    window.currentOzmalFilter = sirketName || 'hepsi';
    const companySelect = document.getElementById('cizelge-company-filter');
    if (companySelect && companySelect.value !== window.currentOzmalFilter) companySelect.value = window.currentOzmalFilter;
    const btns = {
        'hepsi': 'filter-cizelge-hepsi',
        'IDEOL': 'filter-cizelge-ideol',
        'DİKKAN': 'filter-cizelge-dikkan',
        'M.K.': 'filter-cizelge-mk'
    };

    // Tüm butonları pasif yap
    Object.values(btns).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 hover:bg-white/10 transition-all";
    });

    // Sadece basılanı aktif et
    const activeBtn = document.getElementById(btns[sirketName] || 'filter-cizelge-hepsi');
    if (activeBtn) {
        activeBtn.className = "px-3 py-1.5 text-[11px] font-bold rounded-lg bg-orange-500 text-white transition-all";
    }

    // Veriyi filtreli çek
    if (typeof fetchOzmalCizelge === 'function') fetchOzmalCizelge(window.currentOzmalFilter);
};

window.setCizelgeSort = function(value, btnEl) {
    // Gizli select'i güncelle (fetchOzmalCizelge bu değeri okur)
    const sel = document.getElementById('cizelge-sort');
    if (sel) sel.value = value;

    // Tüm sort butonlarını pasife al
    ['sort-btn-alfa','sort-btn-yaklasan','sort-btn-trafik','sort-btn-kasko','sort-btn-vize'].forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.classList.remove('bg-orange-500','text-white');
            b.classList.add('text-gray-400','hover:bg-white/10');
        }
    });
    // Tıklanan butonu aktif yap
    if (btnEl) {
        btnEl.classList.add('bg-orange-500','text-white');
        btnEl.classList.remove('text-gray-400','hover:bg-white/10');
    }
    // Tabloyu yenile
    if (typeof window.fetchOzmalCizelge === 'function') window.fetchOzmalCizelge(window.currentOzmalFilter);
};

window.fetchOzmalCizelge = async function(sirketFilter = window.currentOzmalFilter) {
    const tbody = document.getElementById('cizelge-tbody');
    if (!tbody) return;

    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

    // Banner-only modda tablo yeniden render etme (tarih girişi odak kaybetmesin)
    const bannerOnly = window._cizelgeBannerOnly === true;
    window._cizelgeBannerOnly = false;

    if (!bannerOnly) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="loading-state"><i data-lucide="loader-2" class="animate-spin"></i><p>Çizelge verileri yükleniyor...</p></div></td></tr>';
        if(window.lucide) window.lucide.createIcons();
    }

    try {
        let query = window.supabaseClient
            .from('araclar')
            .select('*')
            .eq('mulkiyet_durumu', 'ÖZMAL');

        if (sirketFilter && sirketFilter !== 'hepsi') {
            query = query.eq('sirket', sirketFilter);
        }

        const { data, error } = await query
            .order('sirket', { ascending: true })
            .order('plaka', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div><strong>Özmal araç bulunamadı.</strong><p>Seçili şirket için çizelge kaydı bulunmuyor.</p></div></div></td></tr>';
            const visibleCount = document.getElementById('cizelge-visible-count');
            if (visibleCount) visibleCount.textContent = '0';
            return;
        }

        const today = new Date();
        today.setHours(0,0,0,0);

        const getColorClass = (dateValue) => {
            if (!dateValue) return 'is-missing';
            const dateObj = new Date(dateValue);
            const diffDays = Math.ceil((dateObj - today) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 'is-danger';
            if (diffDays <= 30) return 'is-warning';
            return 'is-current';
        };

        // Helper to format date relative state
        const getDateRenderer = (dateValue, fieldName, aracId) => {
            const cl = getColorClass(dateValue);
            // data-arac / data-field kullanarak in-place renk güncellemesi yapalım
            return `
                <div class="cizelge-date-cell ${cl}" data-arac="${aracId}" data-field="${fieldName}">
                    <input type="date"
                        value="${dateValue || ''}"
                        onchange="window.updateCizelgeDateInPlace(this, '${aracId}', '${fieldName}')"
                        aria-label="${fieldLabels?.[fieldName] || 'Bitiş tarihi'}"
                    />
                </div>
            `;
        };

        // ---- Uyarı Banner'ı ----
        const WARN_DAYS = 30;
        const fieldLabels = { sigorta_bitis: 'Trafik Sig.', koltuk_bitis: 'Koltuk Sig.', kasko_bitis: 'Kasko', vize_bitis: 'Vize' };
        const warnings = [];
        (data || []).forEach(a => {
            Object.keys(fieldLabels).forEach(f => {
                if (!a[f]) return;
                const d = new Date(a[f]);
                const diff = Math.ceil((d - today) / 86400000);
                if (diff < 0) {
                    warnings.push({ plaka: a.plaka, label: fieldLabels[f], diff, cls: 'bg-red-500/15 border-red-500/40 text-red-400', icon: 'alert-octagon', text: `Süresi doldu (${Math.abs(diff)} gün önce)` });
                } else if (diff <= WARN_DAYS) {
                    warnings.push({ plaka: a.plaka, label: fieldLabels[f], diff, cls: 'bg-orange-500/15 border-orange-500/40 text-orange-400', icon: 'alert-triangle', text: `${diff} gün kaldı` });
                }
            });
        });
        warnings.sort((a, b) => a.diff - b.diff);

        let bannerEl = document.getElementById('cizelge-uyari-banner');
        if (!bannerEl) {
            bannerEl = document.createElement('div');
            bannerEl.id = 'cizelge-uyari-banner';
            bannerEl.className = 'cizelge-warning-wrap';
            tbody.closest('table').parentElement.before(bannerEl);
        }
        if (warnings.length === 0) {
            bannerEl.innerHTML = '<div class="cizelge-warning-panel is-clear"><i data-lucide="shield-check"></i><span>Tüm araçların belgeleri güncel; yaklaşan bitiş tarihi yok.</span></div>';
        } else {
            bannerEl.innerHTML = `
            <div class="cizelge-warning-panel is-alert">
                <div class="cizelge-warning-head">
                    <i data-lucide="bell-ring"></i>
                    <strong>${warnings.length} yaklaşan veya süresi geçmiş evrak</strong>
                </div>
                <div class="cizelge-warning-items">
                    ${warnings.map(w => `
                        <div class="cizelge-warning-item ${w.diff < 0 ? 'is-danger' : 'is-warning'}">
                            <i data-lucide="${w.icon}"></i>
                            <strong>${w.plaka}</strong>
                            <span>${w.label}</span>
                            <em>${w.text}</em>
                        </div>`).join('')}
                </div>
            </div>`;
        }
        if (window.lucide) window.lucide.createIcons({ el: bannerEl });

        const cizelgeSort = document.getElementById('cizelge-sort')?.value || 'varsayilan';
        if (cizelgeSort !== 'varsayilan') {
            const getTimestamp = (d) => {
                if (!d) return 9999999999999;
                return new Date(d).getTime();
            };
            
            data.sort((a,b) => {
                let valA = 9999999999999, valB = 9999999999999;
                let isAsc = cizelgeSort.endsWith('_yakin') || cizelgeSort === 'yaklasan_genel';
                let key = cizelgeSort.replace('_yakin','').replace('_uzak','');
                
                if (key === 'yaklasan_genel') {
                    valA = Math.min(getTimestamp(a.sigorta_bitis), getTimestamp(a.koltuk_bitis), getTimestamp(a.kasko_bitis), getTimestamp(a.vize_bitis));
                    valB = Math.min(getTimestamp(b.sigorta_bitis), getTimestamp(b.koltuk_bitis), getTimestamp(b.kasko_bitis), getTimestamp(b.vize_bitis));
                } else if (key === 'trafik') {
                    valA = getTimestamp(a.sigorta_bitis); valB = getTimestamp(b.sigorta_bitis);
                } else if (key === 'koltuk') {
                    valA = getTimestamp(a.koltuk_bitis); valB = getTimestamp(b.koltuk_bitis);
                } else if (key === 'kasko') {
                    valA = getTimestamp(a.kasko_bitis); valB = getTimestamp(b.kasko_bitis);
                } else if (key === 'vize') {
                    valA = getTimestamp(a.vize_bitis); valB = getTimestamp(b.vize_bitis);
                }
                
                if (valA < valB) return isAsc ? -1 : 1;
                if (valA > valB) return isAsc ? 1 : -1;
                return 0;
            });
        }

        const rows = data.map(a => {
            const sirket = window.CompanyBranding.companyDisplayName(a.sirket);
            const plaka = a.plaka || '-';
            
            // Kullanıcı marka ve model istiyor. Eğer "marka_model" bütünleşikse bölelim veya direkt yazalım.
            const marka_model = a.marka_model || '-'; 

            return `
                <tr data-cizelge-search="${[sirket, plaka, marka_model].join(' ')}">
                    <td><span class="badge-info">${sirket}</span></td>
                    <td><strong class="cizelge-plate">${plaka}</strong></td>
                    <td><span class="cizelge-model">${marka_model}</span></td>
                    <td>
                        ${getDateRenderer(a.sigorta_bitis, 'sigorta_bitis', a.id)}
                    </td>
                    <td>
                        ${getDateRenderer(a.koltuk_bitis, 'koltuk_bitis', a.id)}
                    </td>
                    <td>
                        ${getDateRenderer(a.kasko_bitis, 'kasko_bitis', a.id)}
                    </td>
                    <td>
                        ${getDateRenderer(a.vize_bitis, 'vize_bitis', a.id)}
                    </td>
                </tr>
            `;
        });

        if (!bannerOnly) {
            tbody.innerHTML = rows.join('');
            if (typeof window.applyCizelgeSearch === 'function') window.applyCizelgeSearch();
            if (window.lucide) window.lucide.createIcons();
        } else {
            // Sadece uyarı bannerı güncellendi, tablo DOM'una dokunmadık
            if (window.lucide) window.lucide.createIcons({ el: document.getElementById('cizelge-uyari-banner') });
        }

    } catch (e) {
        console.error("[fetchOzmalCizelge] Error:", e);
        if (typeof showToast === 'function') showToast('Çizelge verisi alınamadı: ' + e.message, 'error');
    }
};

// Tablo yeniden render etmeden sadece o hücrenin rengini günceller
window.updateCizelgeDateInPlace = async function(inputEl, aracId, fieldName) {
    if (!aracId) return;
    const newDate = inputEl.value;
    const cell = inputEl.closest('.cizelge-date-cell');
    const payload = {};
    payload[fieldName] = newDate || null;

    // Optimistic UI — rengi hemen güncelle
    if (cell) {
        const today = new Date(); today.setHours(0,0,0,0);
        const allCls = ['is-danger', 'is-warning', 'is-current', 'is-missing'];
        allCls.forEach(c => cell.classList.remove(c));
        if (!newDate) {
            cell.classList.add('is-missing');
        } else {
            const diff = Math.ceil((new Date(newDate) - today) / 86400000);
            if (diff < 0) cell.classList.add('is-danger');
            else if (diff <= 30) cell.classList.add('is-warning');
            else cell.classList.add('is-current');
        }
    }

    try {
        const { error } = await window.supabaseClient.from('araclar').update(payload).eq('id', aracId);
        if (error) throw error;
        if (typeof showToast === 'function') showToast('Tarih güncellendi!', 'success');
        // Sadece uyarı banner'ını yenile, tablo DOM'una dokunma
        if (typeof window.fetchOzmalCizelge === 'function') {
            window._cizelgeBannerOnly = true;
            window.fetchOzmalCizelge();
        }
        if (typeof fetchDashboardData === 'function') setTimeout(fetchDashboardData, 800);
    } catch (e) {
        console.error('updateCizelgeDateInPlace Error:', e);
        if (typeof showToast === 'function') showToast('Tarih güncellenirken hata oluştu!', 'error');
        // Hatada eski rengi geri al — tüm tabloyu yenile
        window._cizelgeBannerOnly = false;
        if (typeof window.fetchOzmalCizelge === 'function') window.fetchOzmalCizelge();
    }
};

// Eski fonksiyonu da koru (geriye uyumluluk)
window.updateCizelgeDate = window.updateCizelgeDateInPlace;

/* === 4. SUPABASE VERİ ÇEKME (READ / SELECT) İŞLEMLERİ === */
window.fetchAraclar = async function fetchAraclar(mulkiyetFilter = 'hepsi', sirketFilter = 'hepsi') {
    const grid = document.getElementById('arac-cards-grid');
    const listBody = document.getElementById('arac-list-tbody');
    if (!grid && !listBody) return;

    // Loading state
    if (grid && !grid.classList.contains('hidden')) grid.innerHTML = '<div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Araçlar yükleniyor...</p></div></div>';
    if (listBody && document.getElementById('arac-list-container') && !document.getElementById('arac-list-container').classList.contains('hidden')) {
        listBody.innerHTML = '<tr><td colspan="6"><div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Araçlar yükleniyor...</p></div></div></td></tr>';
    }

    const conn = window.checkSupabaseConnection();
    if (!conn.ok) {
        window.showGlobalError('arac-cards-grid', conn.msg);
        if (listBody) listBody.innerHTML = `<tr><td colspan="6"><div class="empty-state fleet-error-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div></td></tr>`;
        return;
    }



    try {

        let query = window.supabaseClient
            .from('araclar')
            .select('*')
            .order('id', { ascending: false });

        // Mulkiyet/Belge Filtresi
        if (mulkiyetFilter && mulkiyetFilter !== 'hepsi') {
            if (mulkiyetFilter === 'D2' || mulkiyetFilter === 'D4S') {
                query = query.eq('belge_turu', mulkiyetFilter);
            } else {
                query = query.eq('mulkiyet_durumu', mulkiyetFilter);
            }
        }

        // Şirket Filtresi (IDEOL / M.K.)
        if (sirketFilter && sirketFilter !== 'hepsi') {
            query = query.eq('sirket', sirketFilter);
        }


        let { data: araclar, error } = await query;


        // EĞER "belge_turu" sütunu SUPEBASE'de henüz yoksa (PGRST204: column does not exist) ve filtre d2/d4s değilse
        if (error && error.message && typeof error.message === 'string' && error.message.includes("belge_turu does not exist")) {
            console.warn("Supabase tablosunda 'belge_turu' sütunu henüz oluşturulmadığı için esnek sorguya (fallback) geçiliyor...");
            let fallbackQuery = window.supabaseClient.from('araclar').select('*').order('id', { ascending: false });
            if (mulkiyetFilter && mulkiyetFilter !== 'hepsi' && mulkiyetFilter !== 'D2' && mulkiyetFilter !== 'D4S') {
                fallbackQuery = fallbackQuery.eq('mulkiyet_durumu', mulkiyetFilter);
            }
            const fallbackRes = await fallbackQuery;
            araclar = fallbackRes.data || [];

            // Eğer D2 veya D4S filtresine basılmışsa ama DB'de kolon yoksa boş liste göster
            if (mulkiyetFilter === 'D2' || mulkiyetFilter === 'D4S') {
                araclar = [];
            }
            error = null; // UI Çökmesini engellemek için hatayı null yap
        }

        if (error) throw error;
        araclar = window.sanitizeDataArray(araclar);

        // Fetch driver names manually to avoid Supabase join errors
        const { data: tumSoforler } = await window.supabaseClient.from('soforler').select('id, ad_soyad');
        const soforMap = {};
        if (tumSoforler) tumSoforler.forEach(s => soforMap[s.id] = s.ad_soyad);

        const documentFields = ['vize_bitis', 'sigorta_bitis', 'kasko_bitis', 'koltuk_bitis'];
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const documentState = (arac) => documentFields.reduce((state, field) => {
            if (!arac[field]) {
                state.missing = true;
                return state;
            }
            const days = Math.ceil((new Date(arac[field]) - todayStart) / 86400000);
            if (days < 0) state.expired = true;
            else if (days <= 30) state.upcoming = true;
            return state;
        }, { missing: false, expired: false, upcoming: false });
        const fleetSummary = araclar.reduce((summary, arac) => {
            const state = documentState(arac);
            if (arac.sofor_id) summary.assigned += 1;
            if (state.upcoming) summary.upcoming += 1;
            if (state.missing || state.expired) summary.critical += 1;
            if (state.missing || state.expired || state.upcoming) summary.action += 1;
            return summary;
        }, { assigned: 0, upcoming: 0, critical: 0, action: 0 });
        const summaryValues = {
            'fleet-kpi-total': araclar.length,
            'fleet-kpi-assigned': fleetSummary.assigned,
            'fleet-kpi-upcoming': fleetSummary.upcoming,
            'fleet-kpi-critical': fleetSummary.critical,
            'fleet-summary-total': araclar.length,
            'fleet-summary-assigned': fleetSummary.assigned,
            'fleet-summary-action': fleetSummary.action,
            'fleet-visible-count': araclar.length
        };
        Object.entries(summaryValues).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element) element.textContent = String(value);
        });

        // Tabloyu temizle
        if (grid) grid.innerHTML = '';
        if (listBody) listBody.innerHTML = '';

        if (araclar.length === 0) {
            if (grid) grid.innerHTML = '<div class="empty-state fleet-empty-state"><div><span class="fleet-state-icon"><i data-lucide="truck"></i></span><strong>Henüz araç bulunmuyor.</strong><p>Filonuza ilk aracı ekleyerek başlayabilirsiniz.</p><button class="btn-primary" onclick="openModal(\'Yeni Araç Ekle\')"><i data-lucide="plus"></i>Araç Ekle</button></div></div>';
            if (listBody) listBody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Henüz araç bulunmuyor.</strong><p>Seçili filtrelere uygun araç kaydı bulunamadı.</p></div></div></td></tr>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Verileri Döngüye Alıp Ekrana Bas
        function getStatusHtml(dateString, label, aracId) {
            const tur = label.includes('Sigorta') ? 'Trafik Sigortası' : (label.includes('Kasko') ? 'Kasko' : (label.includes('Koltuk') ? 'Koltuk' : 'Vize'));
            const shortLabel = label === 'Sigorta' ? 'SİG' : (label === 'Kasko' ? 'KSK' : (label === 'Koltuk' ? 'KLT' : 'VİZE'));

            if (!dateString) {
                return `<span class="fleet-document-badge is-missing" onclick="openModal('Yeni Poliçe Kaydı', '${aracId}')">
                            <i data-lucide="plus"></i>${shortLabel} Eksik
                        </span>`;
            }

            const today = new Date();
            const expiryDate = new Date(dateString);
            const diffTime = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

            if (diffTime < 0) {
                return `<span class="fleet-document-badge is-danger" onclick="showPolicyDetails('${aracId}', '${tur}')">
                            <i data-lucide="circle-x"></i>${shortLabel} Bitti
                        </span>`;
            } else if (diffTime <= 30) {
                return `<span class="fleet-document-badge is-warning" onclick="showPolicyDetails('${aracId}', '${tur}')">
                            <i data-lucide="clock-3"></i>${shortLabel} ${diffTime}g
                        </span>`;
            } else {
                return `<span class="fleet-document-badge is-success" onclick="showPolicyDetails('${aracId}', '${tur}')">
                            <i data-lucide="circle-check"></i>${shortLabel} Güncel
                        </span>`;
            }
        }

        window.showPolicyDetails = async function (aracId, tur) {
            try {
                const { data: p, error } = await window.supabaseClient
                    .from('arac_policeler')
                    .select('*, cariler(unvan)')
                    .eq('arac_id', aracId)
                    .eq('police_turu', tur)
                    .order('bitis_tarihi', { ascending: false })
                    .limit(1)
                    .single();

                if (error || !p) {
                    // Veritabanında (arac_policeler) detaylı poliçe kaydı yoksa sadece aracın kendi tarihini göster
                    let bitisSutun = tur.toLowerCase().includes('kasko') ? 'kasko_bitis' : 
                                    (tur.toLowerCase().includes('koltuk') ? 'koltuk_bitis' : 
                                    (tur.toLowerCase().includes('vize') ? 'vize_bitis' : 'sigorta_bitis'));
                    
                    const { data: aracData } = await window.supabaseClient.from('araclar').select(bitisSutun).eq('id', aracId).single();
                    let bitisTarihi = aracData ? aracData[bitisSutun] : null;

                    if (!bitisTarihi) {
                        alert(`${tur} kaydı bulunamadı.`);
                        return;
                    }
                    
                    let fallbackContent = `
                        <div class="text-left space-y-3 p-2">
                            <div class="flex justify-between border-b pb-2">
                                <span class="text-xs text-gray-400 uppercase font-bold">Poliçe / Evrak Türü</span>
                                <span class="text-sm font-bold text-primary">${tur}</span>
                            </div>
                            <div class="flex justify-between border-b pb-2">
                                <span class="text-xs text-gray-400 uppercase font-bold">Geçerlilik Bitiş</span>
                                <span class="text-sm font-bold text-danger">${window.formatDate ? window.formatDate(bitisTarihi) : bitisTarihi}</span>
                            </div>
                            <div class="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200 text-[11px] text-yellow-700">
                                <b>Bilgi:</b> Bu araç için yalnızca son geçerlilik tarihi girilmiştir. (Sistemde detaylı poliçe/ödeme kaydı veya doküman eşleşmesi bulunmamaktadır.)
                            </div>
                        </div>
                    `;

                    const detailModal = document.createElement('div');
                    detailModal.id = "policy-detail-overlay";
                    detailModal.className = "fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4";
                    detailModal.innerHTML = `
                        <div class="ios-modal-sheet bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
                            <div class="ios-modal-header bg-primary px-4 py-3 flex justify-between items-center">
                                <h3 class="text-white font-bold text-sm uppercase tracking-wider">${tur} Özet Bilgisi</h3>
                                <button onclick="document.getElementById('policy-detail-overlay').remove()" class="text-white hover:rotate-90 transition-transform">✕</button>
                            </div>
                            <div class="ios-modal-body p-4 font-sans">${fallbackContent}</div>
                            <div class="ios-modal-footer bg-gray-50 px-4 py-3 text-right">
                                <button onclick="document.getElementById('policy-detail-overlay').remove()" class="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase">Kapat</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(detailModal);
                    return;
                }

                let content = `
                            <div class="text-left space-y-3 p-2">
                                <div class="flex justify-between border-b pb-2">
                                    <span class="text-xs text-gray-400 uppercase font-bold">Poliçe Türü</span>
                                    <span class="text-sm font-bold text-primary">${p.police_turu}</span>
                                </div>
                                <div class="flex justify-between border-b pb-2">
                                    <span class="text-xs text-gray-400 uppercase font-bold">Acente / Cari</span>
                                    <span class="text-sm font-bold text-primary">${p.cariler ? p.cariler.unvan : '-'}</span>
                                </div>
                                <div class="flex justify-between border-b pb-2">
                                    <span class="text-xs text-gray-400 uppercase font-bold">Başlangıç</span>
                                    <span class="text-sm font-medium text-gray-600">${p.baslangic_tarihi}</span>
                                </div>
                                <div class="flex justify-between border-b pb-2">
                                    <span class="text-xs text-gray-400 uppercase font-bold">Bitiş Tarihi</span>
                                    <span class="text-sm font-bold text-danger">${p.bitis_tarihi}</span>
                                </div>
                                ${p.dosya_url ? `
                                <div class="mt-4">
                                    <a href="${p.dosya_url}" target="_blank" class="w-full bg-blue-600 hover:bg-blue-700 text-white block text-center py-2 rounded font-bold text-sm shadow-md transition-all">
                                        📄 POLİÇE PDF / DOSYAYI AÇ
                                    </a>
                                </div>` : '<p class="text-[10px] text-gray-400 italic text-center">Bu poliçeye ait döküman yüklenmemiş.</p>'}
                            </div>
                        `;

                // Modal kullanarak göster (veya alert yerine daha şık bir div)
                const detailModal = document.createElement('div');
                detailModal.id = "policy-detail-overlay";
                detailModal.className = "fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4";
                detailModal.innerHTML = `
                            <div class="ios-modal-sheet bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-scaleIn">
                                <div class="ios-modal-header bg-primary px-4 py-3 flex justify-between items-center">
                                    <h3 class="text-white font-bold text-sm uppercase tracking-wider">${tur} Detayları</h3>
                                    <button onclick="document.getElementById('policy-detail-overlay').remove()" class="text-white hover:rotate-90 transition-transform">✕</button>
                                </div>
                                <div class="ios-modal-body p-4 font-sans">${content}</div>
                                <div class="ios-modal-footer bg-gray-50 px-4 py-3 text-right">
                                    <button onclick="document.getElementById('policy-detail-overlay').remove()" class="text-xs font-bold text-gray-400 hover:text-gray-600 uppercase">Kapat</button>
                                </div>
                            </div>
                        `;
                document.body.appendChild(detailModal);

            } catch (e) {
                console.error(e);
                alert("Poliçe detayları yüklenemedi.");
            }
        }

        araclar.forEach(arac => {
            // Varsayılan değerler
            const plaka = arac.plaka || 'Bilinmiyor';
            const marka = arac.marka_model || 'Bilinmiyor';
            const mulkiyet = arac.mulkiyet_durumu || 'ÖZMAL';
            const soforAdi = arac.sofor_id && soforMap[arac.sofor_id] ? soforMap[arac.sofor_id] : null;
            const sofor = soforAdi ? soforAdi : '<span class="text-gray-400 italic">Atanmamış</span>';

            const vizeHtml = getStatusHtml(arac.vize_bitis, 'Vize', arac.id);
            const sigortaHtml = getStatusHtml(arac.sigorta_bitis, 'Sigorta', arac.id);
            const kaskoHtml = getStatusHtml(arac.kasko_bitis, 'Kasko', arac.id);
            const koltukHtml = getStatusHtml(arac.koltuk_bitis, 'Koltuk', arac.id);

            // Şirket badge
            let sirketBadgeHtml = '';
            if (arac.sirket && arac.sirket !== 'Belirtilmemiş') {
                sirketBadgeHtml = `
                    <span class="badge-info fleet-company-badge">
                        ${window.CompanyBranding.companyDisplayName(arac.sirket)}
                    </span>
                `;
            }

            // Belge türü badge (D2, D4S vs)
            let belgeBadgeHtml = '';
            if (arac.belge_turu && arac.belge_turu !== 'Yok') {
                belgeBadgeHtml = `
                    <span class="badge-neutral fleet-license-badge">
                        ${arac.belge_turu}
                    </span>
                `;
            }

            const searchText = [plaka, marka, soforAdi || '', arac.sirket || '', mulkiyet, arac.belge_turu || ''].join(' ');
            const state = documentState(arac);
            const documentStatus = (state.missing || state.expired) ? 'critical' : (state.upcoming ? 'upcoming' : 'current');
            const licenseType = arac.belge_turu && arac.belge_turu !== 'Yok' ? arac.belge_turu : 'none';
            const driverStatus = soforAdi ? 'assigned' : 'unassigned';
            const companyName = arac.sirket && arac.sirket !== 'Belirtilmemiş' ? arac.sirket : '';

            // Supabase'den gelen veriye göre modern card oluştur
            if (grid) {
                const card = document.createElement('div');
                card.className = "fleet-vehicle-card";
                card.dataset.fleetSearch = searchText;
                card.dataset.fleetOwnership = mulkiyet;
                card.dataset.fleetDriver = driverStatus;
                card.dataset.fleetCompany = companyName;
                card.dataset.fleetLicense = licenseType;
                card.dataset.fleetDocument = documentStatus;

                card.innerHTML = `
                    <div class="fleet-vehicle-summary" onclick="window.openAracDetay('${arac.id}')">
                        <div class="fleet-vehicle-head">
                            <div class="fleet-vehicle-identity">
                                <div class="fleet-vehicle-icon">
                                    <i data-lucide="truck"></i>
                                </div>
                                <div>
                                    <h3>${plaka}</h3>
                                    <p>${marka}</p>
                                    <div class="fleet-vehicle-badges">
                                        ${sirketBadgeHtml}
                                        ${belgeBadgeHtml}
                                    </div>
                                </div>
                            </div>
                            <span class="${arac.mulkiyet_durumu === 'ÖZMAL' ? 'badge-success' : 'badge-neutral'}">${mulkiyet}</span>
                        </div>

                        <div class="fleet-vehicle-meta">
                            <div class="fleet-driver-row">
                                <span><i data-lucide="user"></i>Sürücü</span>
                                <strong>${sofor}</strong>
                            </div>
                            <div class="fleet-document-list">
                                ${vizeHtml}
                                ${sigortaHtml}
                                ${kaskoHtml}
                                ${koltukHtml}
                            </div>
                        </div>
                    </div>

                    <div class="fleet-card-actions">
                        <button onclick="openModal('Araç Şoför Ata', '${arac.id}')" title="Şoför eşleştir"><i data-lucide="user-plus"></i><span>Şoför</span></button>
                        <button onclick="openModal('Araç Evrak Güncelle', '${arac.id}')" title="Poliçe ve evrak"><i data-lucide="file-text"></i><span>Evrak</span></button>
                        <button onclick="openModal('Araç Bakım Geçmişi', '${arac.id}')" title="Bakım geçmişi"><i data-lucide="history"></i><span>Geçmiş</span></button>
                        <button onclick="openModal('Araç Güncelle', '${arac.id}')" title="Aracı düzenle"><i data-lucide="edit-2"></i><span>Düzenle</span></button>
                        <button class="is-danger" onclick="deleteRecord('araclar', '${arac.id}', 'fetchAraclar')" title="Aracı sil"><i data-lucide="trash-2"></i><span>Sil</span></button>
                    </div>
                `;
                grid.appendChild(card);
            }


            if (listBody) {
                const tr = document.createElement('tr');
                tr.dataset.fleetSearch = searchText;
                tr.dataset.fleetOwnership = mulkiyet;
                tr.dataset.fleetDriver = driverStatus;
                tr.dataset.fleetCompany = companyName;
                tr.dataset.fleetLicense = licenseType;
                tr.dataset.fleetDocument = documentStatus;
                tr.innerHTML = `
                    <td>
                        <div class="fleet-table-vehicle" onclick="window.openAracDetay('${arac.id}')">
                            <div class="fleet-vehicle-icon">
                                <i data-lucide="truck"></i>
                            </div>
                            <div>
                                <strong>${plaka}</strong>
                                <span>${marka}</span>
                            </div>
                        </div>
                    </td>
                    <td><div class="fleet-company-cell">${sirketBadgeHtml || '<span class="fleet-empty-value">—</span>'}</div></td>
                    <td>
                        <div class="fleet-ownership-cell">
                            <span class="${mulkiyet === 'ÖZMAL' ? 'badge-success' : 'badge-neutral'}">${mulkiyet}</span>
                            ${belgeBadgeHtml || '<span class="fleet-empty-value">Belge yok</span>'}
                        </div>
                    </td>
                    <td>
                        <div class="fleet-driver-name">${sofor}</div>
                    </td>
                    <td class="hidden md:table-cell">
                        <div class="fleet-document-list">
                            ${vizeHtml}
                            ${sigortaHtml}
                            ${kaskoHtml}
                            ${koltukHtml}
                        </div>
                    </td>
                    <td>
                        <div class="fleet-row-actions">
                            <button onclick="openModal('Araç Şoför Ata', '${arac.id}')" title="Şoför Ata"><i data-lucide="user-plus"></i></button>
                            <button onclick="openModal('Araç Evrak Güncelle', '${arac.id}')" title="Evrak/Poliçe"><i data-lucide="file-text"></i></button>
                            <button onclick="openModal('Araç Bakım Geçmişi', '${arac.id}')" title="Bakım Geçmişi"><i data-lucide="history"></i></button>
                            <button onclick="openModal('Araç Güncelle', '${arac.id}')" title="Düzenle"><i data-lucide="edit-2"></i></button>
                            <button class="is-danger" onclick="deleteRecord('araclar', '${arac.id}', 'fetchAraclar')" title="Sil"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                `;
                listBody.appendChild(tr);
            }


        });

        if (typeof window.applyOwnedFleetFilters === 'function') window.applyOwnedFleetFilters();

        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        console.error("Araçları çekerken hata:", error);
        if (grid) grid.innerHTML = `<div class="empty-state fleet-error-state"><div><i data-lucide="circle-alert"></i><strong>Veriler yüklenemedi.</strong><p>${error.message}</p></div></div>`;
        if (listBody) listBody.innerHTML = `<tr><td colspan="6"><div class="empty-state fleet-error-state"><div><strong>Veriler yüklenemedi.</strong><p>${error.message}</p></div></div></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

/* =====================================================
   ARAÇ KÂRLILIK (P&L) HESAPLAMA EKLENTİSİ
   ===================================================== */
window.loadAracPL = async function(aracId) {
    const section = document.getElementById('arac-pl-section');
    if (!section) return;
    
    try {
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
        
        const [resYakit, resBakim, resPuantaj, resHakedis] = await Promise.allSettled([
            window.supabaseClient.from('yakit_takip').select('toplam_tutar').eq('arac_id', aracId).gte('tarih', monthStart),
            window.supabaseClient.from('arac_bakimlari').select('toplam_tutar').eq('arac_id', aracId).gte('islem_tarihi', monthStart),
            window.supabaseClient.from('musteri_servis_puantaj').select('gunluk_ucret').eq('arac_id', aracId).gte('tarih', monthStart),
            window.supabaseClient.from('taseron_hakedis').select('net_hakedis').eq('arac_id', aracId).gte('sefer_tarihi', monthStart)
        ]);
        
        const yakitlar = resYakit.value?.data || [];
        const bakimlar = resBakim.value?.data || [];
        const puantaj = resPuantaj.value?.data || [];
        const hakedis = resHakedis.value?.data || [];
        
        const giderYakit = yakitlar.reduce((s, y) => s + (parseFloat(y.toplam_tutar) || 0), 0);
        const giderBakim = bakimlar.reduce((s, b) => s + (parseFloat(b.toplam_tutar) || 0), 0);
        const toplamGider = giderYakit + giderBakim;
        
        const ciroPuantaj = puantaj.reduce((s, p) => s + (parseFloat(p.gunluk_ucret) || 0), 0);
        const ciroHakedis = hakedis.reduce((s, h) => s + (parseFloat(h.net_hakedis) || 0), 0);
        const toplamGelir = ciroPuantaj + ciroHakedis;
        
        const netKar = toplamGelir - toplamGider;
        const karClass = netKar >= 0 ? 'text-green-400' : 'text-red-400';
        
        const fmt = v => new Intl.NumberFormat('tr-TR', {style:'currency', currency:'TRY', maximumFractionDigits:0}).format(v);
        
        section.innerHTML = `
            <div class="text-[10px] text-gray-400 uppercase tracking-widest mb-2 font-bold flex items-center justify-between">
                <span>Finansal Analiz (Bu Ay)</span>
            </div>
            <div class="bg-black/40 p-3 rounded-xl border border-white/5 grid grid-cols-3 gap-2 text-center divide-x divide-white/5">
                <div>
                    <div class="text-[9px] text-gray-500 uppercase mb-1">Gelir (Ciro)</div>
                    <div class="font-bold text-blue-400 text-sm">${fmt(toplamGelir)}</div>
                </div>
                <div>
                    <div class="text-[9px] text-gray-500 uppercase mb-1">Gider (Yakıt+Bkm)</div>
                    <div class="font-bold text-orange-400 text-sm">${fmt(toplamGider)}</div>
                </div>
                <div>
                    <div class="text-[9px] text-gray-500 uppercase mb-1">Net Kâr</div>
                    <div class="font-black ${karClass} text-sm">${fmt(netKar)}</div>
                </div>
            </div>
        `;
    } catch(e) {
        console.error('[loadAracPL]', e);
        section.innerHTML = `<div class="text-xs text-red-400 text-center py-2">Finansal veriler yüklenemedi.</div>`;
    }
};

/* =====================================================
   ARAÇ CARİ KARTI — Bakım + Yakıt geçmişi
   ===================================================== */
window.loadAracCariKarti = async function(aracId) {
    const section = document.getElementById('arac-cari-section');
    if (!section) return;
    try {
        const [bakimRes, yakitRes, policeRes] = await Promise.all([
            window.supabaseClient.from('arac_bakimlari')
                .select('islem_tarihi, islem_turu, aciklama, toplam_tutar, cariler(unvan)')
                .eq('arac_id', aracId).order('islem_tarihi', { ascending: false }).limit(10),
            window.supabaseClient.from('yakit_islemleri')
                .select('tarih, litre, tutar, aciklama')
                .eq('arac_id', aracId).order('tarih', { ascending: false }).limit(10),
            window.supabaseClient.from('arac_policeler')
                .select('baslangic_tarihi, police_turu, toplam_tutar, cariler(unvan), aciklama')
                .eq('arac_id', aracId).order('baslangic_tarihi', { ascending: false }).limit(10)
        ]);
        const bakimlar = bakimRes.data || [];
        const yakitlar = yakitRes.data || [];
        const policeler = policeRes.data || [];
        
        const fmt = v => Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        const fmtDate = d => d ? new Date(d).toLocaleDateString('tr-TR') : '-';
        
        const toplamBakim = bakimlar.reduce((s, b) => s + Number(b.toplam_tutar || 0), 0);
        const toplamYakit = yakitlar.reduce((s, y) => s + Number(y.tutar || 0), 0);
        const toplamPolice = policeler.reduce((s, p) => s + Number(p.toplam_tutar || 0), 0);

        const tabId = 'ct' + aracId;
        
        // Tab function to handle 3 tabs
        window[`switchTab_${tabId}`] = function(type) {
            document.getElementById(`${tabId}-bakim`).classList.add('hidden');
            document.getElementById(`${tabId}-yakit`).classList.add('hidden');
            document.getElementById(`${tabId}-police`).classList.add('hidden');
            
            document.getElementById(`${tabId}-b`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 bg-white/5 transition-all';
            document.getElementById(`${tabId}-y`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 bg-white/5 transition-all';
            document.getElementById(`${tabId}-p`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 bg-white/5 transition-all';
            
            if (type === 'bakim') {
                document.getElementById(`${tabId}-bakim`).classList.remove('hidden');
                document.getElementById(`${tabId}-b`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-orange-500 text-white transition-all';
            } else if (type === 'yakit') {
                document.getElementById(`${tabId}-yakit`).classList.remove('hidden');
                document.getElementById(`${tabId}-y`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-blue-500 text-white transition-all';
            } else if (type === 'police') {
                document.getElementById(`${tabId}-police`).classList.remove('hidden');
                document.getElementById(`${tabId}-p`).className = 'flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-500 text-white transition-all';
            }
        };

        let html = `<div class="flex gap-2 mb-3">
            <button id="${tabId}-b" onclick="window.switchTab_${tabId}('bakim')" class="flex-1 py-1.5 text-[11px] font-bold rounded-lg bg-orange-500 text-white transition-all">
                Bakım (${bakimlar.length})
            </button>
            <button id="${tabId}-y" onclick="window.switchTab_${tabId}('yakit')" class="flex-1 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 bg-white/5 transition-all">
                Yakıt (${yakitlar.length})
            </button>
            <button id="${tabId}-p" onclick="window.switchTab_${tabId}('police')" class="flex-1 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 bg-white/5 transition-all">
                Sigorta (${policeler.length})
            </button>
            </div>
            
            <!-- BAKIM Tabi -->
            <div id="${tabId}-bakim" class="max-h-52 overflow-y-auto space-y-1.5">`;

        if (bakimlar.length === 0) {
            html += `<p class="text-xs text-gray-500 italic text-center py-4">Bakım geçmişi yok.</p>`;
        } else {
            bakimlar.forEach(b => {
                html += `<div class="flex items-start justify-between py-2 px-3 rounded-lg bg-white/5">
                    <div class="flex-1 min-w-0">
                        <div class="text-[11px] font-bold text-orange-400 uppercase">${b.islem_turu}</div>
                        <div class="text-[10px] text-gray-400 font-bold mb-0.5">${fmtDate(b.islem_tarihi)}${b.cariler && b.cariler.unvan ? ' · Servis: ' + b.cariler.unvan : ''}</div>
                        ${b.aciklama ? `<div class="text-[10px] text-gray-500 italic max-w-[200px] truncate" title="${b.aciklama}">Detay: ${b.aciklama}</div>` : ''}
                    </div>
                    <div class="text-[11px] font-black text-orange-400 ml-2 whitespace-nowrap">${fmt(b.toplam_tutar)} ₺</div>
                </div>`;
            });
            html += `<div class="flex justify-between border-t border-white/10 pt-1.5 mt-1 px-1">
                <span class="text-[10px] text-gray-500 font-bold uppercase">Toplam Bakım</span>
                <span class="text-sm font-black text-orange-400">${fmt(toplamBakim)} ₺</span>
            </div>`;
        }

        html += `</div>
        
        <!-- YAKIT Tabi -->
        <div id="${tabId}-yakit" class="hidden max-h-52 overflow-y-auto space-y-1.5">`;

        if (yakitlar.length === 0) {
            html += `<p class="text-xs text-gray-500 italic text-center py-4">Yakıt geçmişi yok.</p>`;
        } else {
            yakitlar.forEach(y => {
                html += `<div class="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white/5">
                    <div class="flex-1 min-w-0">
                        <div class="text-[10px] text-gray-400 font-bold">${fmtDate(y.tarih)}${y.litre ? ' · ' + y.litre + ' Lt' : ''}</div>
                    </div>
                    <div class="text-[11px] font-black text-blue-400 ml-2 whitespace-nowrap">${fmt(y.tutar)} ₺</div>
                </div>`;
            });
            html += `<div class="flex justify-between border-t border-white/10 pt-1.5 mt-1 px-1">
                <span class="text-[10px] text-gray-500 font-bold uppercase">Toplam Yakıt</span>
                <span class="text-sm font-black text-blue-400">${fmt(toplamYakit)} ₺</span>
            </div>`;
        }
        
        html += `</div>
        
        <!-- POLİÇE (SİGORTA) Tabi -->
        <div id="${tabId}-police" class="hidden max-h-52 overflow-y-auto space-y-1.5">`;

        if (policeler.length === 0) {
            html += `<p class="text-xs text-gray-500 italic text-center py-4">Sigorta geçmişi yok.</p>`;
        } else {
            policeler.forEach(p => {
                html += `<div class="flex items-start justify-between py-2 px-3 rounded-lg bg-white/5">
                    <div class="flex-1 min-w-0">
                        <div class="text-[11px] font-bold text-violet-400 uppercase">${p.police_turu || 'Sigorta'}</div>
                        <div class="text-[10px] text-gray-400 font-bold mb-0.5">${fmtDate(p.baslangic_tarihi)}${p.cariler && p.cariler.unvan ? ' · Sigorta: ' + p.cariler.unvan : ''}</div>
                        ${p.aciklama ? `<div class="text-[10px] text-gray-500 italic max-w-[200px] truncate" title="${p.aciklama}">Poliçe Notu: ${p.aciklama}</div>` : ''}
                    </div>
                    <div class="text-[11px] font-black text-violet-400 ml-2 whitespace-nowrap">${fmt(p.toplam_tutar)} ₺</div>
                </div>`;
            });
            html += `<div class="flex justify-between border-t border-white/10 pt-1.5 mt-1 px-1">
                <span class="text-[10px] text-gray-500 font-bold uppercase">Toplam Sigorta</span>
                <span class="text-sm font-black text-violet-400">${fmt(toplamPolice)} ₺</span>
            </div>`;
        }

        html += `</div>`;
        section.innerHTML = html;
    } catch(e) {
        console.error('[loadAracCariKarti]', e);
        if (section) section.innerHTML = '<div class="text-xs text-red-400 text-center py-2">Geçmiş yüklenemedi.</div>';
    }
};

/* =====================================================
   ARAÇ DETAY ÖZET MODAL — Karta tıklayınca açılır
   ===================================================== */
window.openAracDetay = async function(aracId) {
    // Eğer butonlara tıklandıysa kart tıklaması tetiklenmesin (event bubling engelleyici)
    const ev = window.event;
    if (ev && ev.target && (ev.target.tagName === 'BUTTON' || ev.target.closest('button'))) return;

    // Mevcut overlay varsa kaldır
    const existingOverlay = document.getElementById('arac-detay-overlay');
    if (existingOverlay) existingOverlay.remove();

    // Yükleme göstergesi
    const overlay = document.createElement('div');
    overlay.id = 'arac-detay-overlay';
    overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="ios-modal-sheet bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh]">
            <div class="ios-modal-header flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-orange-500/10 rounded-xl text-orange-500">
                        <i data-lucide="truck" class="w-5 h-5"></i>
                    </div>
                    <div id="arac-detay-plaka-header" class="text-lg font-black text-white">Yükleniyor...</div>
                </div>
                <button onclick="document.getElementById('arac-detay-overlay').remove()" class="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="arac-detay-body" class="ios-modal-body p-6 space-y-4">
                <div class="animate-pulse space-y-3">
                    <div class="h-4 bg-white/10 rounded w-3/4"></div>
                    <div class="h-4 bg-white/10 rounded w-1/2"></div>
                    <div class="h-4 bg-white/10 rounded w-2/3"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();

    try {
        const { data: a, error } = await window.supabaseClient
            .from('araclar')
            .select('*')
            .eq('id', aracId)
            .single();

        if (error || !a) { overlay.remove(); return; }

        if (a.sofor_id) {
            const { data: sof } = await window.supabaseClient.from('soforler').select('ad_soyad, telefon').eq('id', a.sofor_id).maybeSingle();
            a.soforler = sof || null;
        } else {
            a.soforler = null;
        }

        const fmt = (d) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
        const today = new Date();
        const daysLeft = (d) => {
            if (!d) return null;
            return Math.ceil((new Date(d) - today) / 86400000);
        };
        const statusBadge = (d, label) => {
            const dl = daysLeft(d);
            if (dl === null) return `<span class="px-2 py-0.5 bg-gray-700 text-gray-400 text-[10px] font-bold rounded uppercase">${label}: —</span>`;
            if (dl < 0) return `<span class="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold rounded uppercase">${label}: BİTTİ</span>`;
            if (dl <= 30) return `<span class="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold rounded uppercase">${label}: ${dl}g</span>`;
            return `<span class="px-2 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold rounded uppercase">${label}: ${fmt(d)}</span>`;
        };

        document.getElementById('arac-detay-plaka-header').textContent = a.plaka || 'Bilinmiyor';
        document.getElementById('arac-detay-body').innerHTML = `
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Marka/Model</div>
                    <div class="font-bold text-white">${a.marka_model || '—'}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Mülkiyet</div>
                    <div class="font-bold text-blue-400">${a.mulkiyet_durumu || '—'}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3 relative group flex flex-col justify-center">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Atanan Şoför</div>
                    <div class="font-bold text-white flex justify-between items-center">
                        <span>${a.soforler?.ad_soyad || '—'}</span>
                        ${a.soforler?.telefon ? `<a href="https://wa.me/90${a.soforler.telefon.replace(/\D/g,'')}?text=Merhaba%20${encodeURIComponent(a.soforler.ad_soyad.split(' ')[0])},%20${a.plaka}%20plakalı%20aracınla%20ilgili%20bir%20bilgilendirme:" target="_blank" class="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all ml-2" title="WhatsApp Mesajı Gönder"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.488-1.761-1.665-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.011c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.052 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg></a>` : ''}
                    </div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Güncel KM</div>
                    <div class="font-bold text-orange-400">${a.guncel_km ? a.guncel_km.toLocaleString('tr-TR') + ' km' : '—'}</div>
                </div>
                ${a.sirket && a.sirket !== 'Belirtilmemiş' ? `
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Şirket</div>
                    <div class="font-bold text-orange-400">${window.CompanyBranding.companyDisplayName(a.sirket)}</div>
                </div>` : ''}
                ${a.belge_turu && a.belge_turu !== 'Yok' ? `
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Belge Türü</div>
                    <div class="font-bold text-purple-400">${a.belge_turu}</div>
                </div>` : ''}
            </div>

            <div class="border-t border-white/10 pt-4">
                <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold">Sigorta & Evrak Durumu</div>
                <div class="flex flex-wrap gap-2">
                    ${statusBadge(a.vize_bitis, 'Vize')}
                    ${statusBadge(a.sigorta_bitis, 'Trafik Sig.')}
                    ${statusBadge(a.kasko_bitis, 'Kasko')}
                    ${statusBadge(a.koltuk_bitis, 'Koltuk Sig.')}
                </div>
            </div>
            
            <div id="arac-pl-section" class="mt-4 border-t border-white/10 pt-4">
                <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Kâr / Zarar Analizi (Bu Ay)</div>
                <div class="h-16 bg-white/5 rounded-xl animate-pulse"></div>
            </div>

            <div class="mt-4 border-t border-white/10 pt-4">
                <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-bold flex items-center gap-1.5">
                    <i data-lucide="book-open" class="w-3 h-3"></i> ARAÇ CARİ KARTI
                </div>
                <div id="arac-cari-section">
                    <div class="h-12 bg-white/5 rounded-xl animate-pulse"></div>
                </div>
            </div>

            <div class="flex gap-2 pt-2 border-t border-white/5">
                <button onclick="document.getElementById('arac-detay-overlay').remove(); openModal('Araç Evrak Güncelle','${aracId}')"
                    class="flex-1 py-3 text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                    <i data-lucide="file-text" class="w-4 h-4"></i>Evrak/Poliçe Güncelle
                </button>
                <button onclick="document.getElementById('arac-detay-overlay').remove(); openModal('Araç Güncelle','${aracId}')"
                    class="flex-1 py-3 text-[10px] font-bold bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-400 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>Araç Düzenle
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        
        // P&L datalarını asenkron yükle
        window.loadAracPL(aracId);
        
        // Araç Cari Kartı (Bakım + Yakıt geçmişini) asenkron yükle
        window.loadAracCariKarti(aracId);

        if (window.lucide) window.lucide.createIcons();
    } catch(e) {
        console.error('[ARAÇ DETAY]', e);
        overlay.remove();
    }
};




async function fetchTaseronlar() {
    const grid = document.getElementById('taseron-cards-grid');
    const tbody = document.getElementById('taseron-tbody');
    const container = grid || tbody;
    if (!container) return;

    if (grid) grid.innerHTML = '<div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Taşeron araçlar yükleniyor...</p></div></div>';
    if (tbody) tbody.innerHTML = '<tr><td colspan="6"><div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Taşeron araçlar yükleniyor...</p></div></div></td></tr>';

    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) {
            if (grid) grid.innerHTML = `<div class="empty-state contractor-error-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div>`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state contractor-error-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div></td></tr>`;
            return;
        }

        const { data: taseronlar, error } = await window.supabaseClient
            .from('araclar')
            .select('*, soforler(ad_soyad)')
            .eq('mulkiyet_durumu', 'TAŞERON')
            .order('id', { ascending: false });

        if (error) throw error;

        const records = taseronlar || [];
        const firmNames = new Set(records.map(a => String(a.firma_adi || '').trim()).filter(Boolean));
        const summaryValues = {
            'contractor-kpi-firms': firmNames.size,
            'contractor-kpi-vehicles': records.length,
            'contractor-kpi-assigned': records.filter(a => a.sofor_id).length,
            'contractor-kpi-missing': records.filter(a => !a.firma_adi || !a.sofor_id).length,
            'taseron-total-count': records.length,
            'contractor-visible-count': records.length
        };
        Object.entries(summaryValues).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element) element.textContent = String(value);
        });

        if (grid) grid.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
        if (records.length === 0) {
            if (grid) grid.innerHTML = `<div class="empty-state contractor-empty-state"><div><span class="contractor-state-icon"><i data-lucide="building-2"></i></span><strong>Henüz taşeron firma bulunmuyor.</strong><p>Yeni taşeron ekleyerek başlayabilirsiniz.</p><button class="btn-primary" onclick="openModal('Yeni Taşeron Kaydı')"><i data-lucide="plus"></i>Taşeron Ekle</button></div></div>`;
            if (tbody) tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Henüz taşeron firma bulunmuyor.</strong><p>Yeni taşeron ekleyerek başlayabilirsiniz.</p></div></div></td></tr>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        records.forEach(a => {
            const soforAdi = a.soforler ? a.soforler.ad_soyad : null;
            const firmaAdi = a.firma_adi || null;
            const searchText = [firmaAdi || '', a.plaka || '', a.marka_model || '', soforAdi || ''].join(' ');

            if (grid) {
                const card = document.createElement('div');
                card.className = 'contractor-card';
                card.dataset.contractorSearch = searchText;
                card.innerHTML = `
                    <div class="contractor-card-head">
                        <div class="contractor-card-identity">
                            <div class="contractor-card-icon"><i data-lucide="building-2"></i></div>
                            <div>
                                <h3>${firmaAdi || 'Firma belirtilmemiş'}</h3>
                                <p>Dış firma / iş ortağı</p>
                            </div>
                        </div>
                        <span class="${firmaAdi && soforAdi ? 'badge-success' : 'badge-warning'}">${firmaAdi && soforAdi ? 'Hazır' : 'Bilgi eksik'}</span>
                    </div>
                    <div class="contractor-card-details">
                        <div><span><i data-lucide="truck"></i>Araç</span><strong>${a.plaka || '—'}</strong><small>${a.marka_model || 'Marka belirtilmemiş'}</small></div>
                        <div><span><i data-lucide="user"></i>Şoför</span><strong>${soforAdi || 'Atanmamış'}</strong></div>
                        <div><span><i data-lucide="wallet-cards"></i>Kira Bedeli</span><strong>${a.kira_bedeli ? window.formatCurrency(a.kira_bedeli) : '—'}</strong></div>
                    </div>
                    <div class="contractor-card-actions">
                        <button onclick="openModal('Araç Güncelle', '${a.id}')"><i data-lucide="edit-2"></i><span>Düzenle</span></button>
                        <button class="is-danger" onclick="deleteRecord('araclar', '${a.id}', 'fetchTaseronlar')" aria-label="${a.plaka || 'Taşeron'} kaydını sil" title="Sil">
                            <i data-lucide="trash-2"></i><span>Sil</span>
                        </button>
                    </div>`;
                grid.appendChild(card);
            }

            if (tbody) {
                const tr = document.createElement('tr');
                tr.dataset.contractorSearch = searchText;
                tr.innerHTML = `
                    <td><div class="contractor-company-cell"><span class="contractor-company-icon"><i data-lucide="building-2"></i></span><div><strong>${firmaAdi || 'Firma belirtilmemiş'}</strong><span>Dış firma / iş ortağı</span></div></div></td>
                    <td><div class="contractor-vehicle-cell"><strong>${a.plaka || '—'}</strong><span>${a.marka_model || 'Marka belirtilmemiş'}</span></div></td>
                    <td><div class="contractor-driver-cell"><i data-lucide="user"></i><span>${soforAdi || 'Atanmamış'}</span></div></td>
                    <td class="contractor-money">${a.kira_bedeli ? window.formatCurrency(a.kira_bedeli) : '—'}</td>
                    <td><span class="${firmaAdi && soforAdi ? 'badge-success' : 'badge-warning'}">${firmaAdi && soforAdi ? 'Hazır' : 'Bilgi eksik'}</span></td>
                    <td><div class="contractor-row-actions">
                        <button onclick="openModal('Araç Güncelle', '${a.id}')" aria-label="${a.plaka || 'Taşeron'} kaydını düzenle" title="Düzenle"><i data-lucide="edit-2"></i></button>
                        <button class="is-danger" onclick="deleteRecord('araclar', '${a.id}', 'fetchTaseronlar')" aria-label="${a.plaka || 'Taşeron'} kaydını sil" title="Sil"><i data-lucide="trash-2"></i></button>
                    </div></td>`;
                tbody.appendChild(tr);
            }
        });

        const searchInput = document.getElementById('search-taseron');
        if (searchInput) window.filterTaseronCards(searchInput.value);

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('Taşeron fetch hatası:', e);
        if (grid) grid.innerHTML = `<div class="empty-state contractor-error-state"><div><i data-lucide="circle-alert"></i><strong>Taşeronlar yüklenemedi.</strong><p>${e.message}</p></div></div>`;
        if (tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state contractor-error-state"><div><strong>Taşeronlar yüklenemedi.</strong><p>${e.message}</p></div></div></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

window.filterTaseronCards = function(q) {
    const query = String(q || '').trim().toLocaleLowerCase('tr-TR');
    let visibleRows = 0;
    document.querySelectorAll('#taseron-cards-grid [data-contractor-search], #taseron-tbody [data-contractor-search]').forEach(item => {
        const text = String(item.dataset.contractorSearch || '').toLocaleLowerCase('tr-TR');
        const matches = !query || text.includes(query);
        item.hidden = !matches;
        if (matches && item.closest('#taseron-tbody')) visibleRows += 1;
    });
    const count = document.getElementById('contractor-visible-count');
    if (count) count.textContent = String(visibleRows);
};

/* =====================================================
   ŞOFÖR DETAY OVERLAY — ŞOför kartına tıklayınca açılır
   ===================================================== */
window.filterPersonnelRoster = function (value) {
    const query = String(value || '').trim().toLocaleLowerCase('tr-TR');
    document.querySelectorAll('#personnel-cards-grid [data-personnel-search], #personnel-list-tbody [data-personnel-search]').forEach(item => {
        const content = String(item.dataset.personnelSearch || '').toLocaleLowerCase('tr-TR');
        item.hidden = query.length > 0 && !content.includes(query);
    });
};

window.openSoforDetay = async function(soforId, ev) {
    if (ev && ev.target && (ev.target.tagName === 'BUTTON' || ev.target.tagName === 'A' || ev.target.closest('button') || ev.target.closest('a'))) return;

    const existing = document.getElementById('sofor-detay-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'sofor-detay-overlay';
    overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="ios-modal-sheet bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh]">
            <div class="ios-modal-header flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-blue-500/10 rounded-xl text-blue-400"><i data-lucide="user" class="w-5 h-5"></i></div>
                    <div id="sofor-detay-isim" class="text-lg font-black text-white">Yükleniyor...</div>
                </div>
                <button onclick="document.getElementById('sofor-detay-overlay').remove()" class="text-gray-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg" aria-label="Personel detayını kapat">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            <div id="sofor-detay-body" class="ios-modal-body p-6 space-y-4">
                <div class="animate-pulse space-y-3">
                    <div class="h-4 bg-white/10 rounded w-3/4"></div>
                    <div class="h-4 bg-white/10 rounded w-1/2"></div>
                    <div class="h-4 bg-white/10 rounded w-2/3"></div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();

    try {
        const { data: s, error } = await window.supabaseClient
            .from('soforler')
            .select('*')
            .eq('id', soforId)
            .single();
        if (error || !s) { overlay.remove(); return; }

        const { data: asignedArac } = await window.supabaseClient
            .from('araclar')
            .select('plaka, marka_model')
            .eq('sofor_id', soforId)
            .maybeSingle();
        s.araclar = asignedArac || null;

        const fmt = v => Number(v || 0).toLocaleString('tr-TR');
        const sigortaColor = s.sigorta_durumu === 'SGK' ? 'text-green-400 bg-green-500/10 border-green-500/20'
            : s.sigorta_durumu === 'Bağkur' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
            : 'text-red-400 bg-red-500/10 border-red-500/20';
        const maasStr = s.aylik_maas ? fmt(s.aylik_maas) + ' ₺/ay' : (s.gunluk_ucret ? fmt(s.gunluk_ucret) + ' ₺/gün' : '—');

        document.getElementById('sofor-detay-isim').textContent = s.ad_soyad || 'Bilinmiyor';
        document.getElementById('sofor-detay-body').innerHTML = `
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">TC Kimlik No</div>
                    <div class="font-mono font-bold text-white">${s.tc_no || '—'}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Telefon</div>
                    <div class="font-bold text-white">${s.telefon || '—'}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Ehliyet</div>
                    <div class="font-bold text-indigo-400">${s.ehliyet_sinifi || '—'} ${s.src_belgesi && s.src_belgesi !== 'Yok' ? '/ ' + s.src_belgesi : ''}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Sigorta</div>
                    <div class="px-2 py-0.5 rounded border text-[11px] font-bold inline-block ${sigortaColor}">${s.sigorta_durumu || '?'}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Maaş / Ücret</div>
                    <div class="font-bold text-orange-400">${maasStr}</div>
                </div>
                <div class="bg-white/5 rounded-xl p-3">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Atanan Araç</div>
                    <div class="font-bold text-white">${s.araclar ? s.araclar.plaka + (s.araclar.marka_model ? ' · ' + s.araclar.marka_model : '') : '—'}</div>
                </div>

                ${s.sirket ? `
                <div class="bg-white/5 rounded-xl p-3 col-span-2">
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Şirket</div>
                    <div class="font-bold ${s.sirket === 'IDEOL' ? 'text-orange-400' : 'text-red-400'}">${window.CompanyBranding.companyDisplayName(s.sirket)}</div>
                </div>` : ''}
            </div>
            ${s.adres ? `<div class="bg-white/5 rounded-xl p-3">
                <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Adres</div>
                <div class="text-sm text-gray-300">${s.adres}</div>
            </div>` : ''}
            <div class="flex gap-2 pt-2 border-t border-white/5">
                <button onclick="document.getElementById('sofor-detay-overlay').remove(); openModal('Şoför Güncelle','${soforId}')"
                    class="flex-1 py-3 text-[10px] font-bold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>Şoför Düzenle
                </button>
                ${s.telefon ? `<a href="https://wa.me/90${s.telefon.replace(/\\D/g,'')}?text=Merhaba%20${encodeURIComponent(s.ad_soyad.split(' ')[0])}" target="_blank"
                    class="flex-1 py-3 text-[10px] font-bold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wide">
                    <i data-lucide="message-circle" class="w-4 h-4"></i>WhatsApp
                </a>` : ''}
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    } catch(e) {
        console.error('[openSoforDetay]', e);
        overlay.remove();
    }
};

async function fetchSoforler(sirketFilter) {
    const grid = document.getElementById('sofor-cards-grid');
    const listBody = document.getElementById('sofor-list-tbody');
    const tbody = document.getElementById('soforler-tbody');
    const personnelGrid = document.getElementById('personnel-cards-grid');
    const personnelBody = document.getElementById('personnel-list-tbody');
    if (!grid && !tbody && !listBody && !personnelGrid && !personnelBody) return;

    if (personnelGrid) personnelGrid.innerHTML = '<div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Personeller yükleniyor...</p></div></div>';
    if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="6"><div class="loading-state">Personeller yükleniyor...</div></td></tr>';

    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) {
            if (grid) window.showGlobalError('sofor-cards-grid', conn.msg);
            if (listBody) listBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div></td></tr>`;
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-red-500 font-bold">${conn.msg}</td></tr>`;
            if (personnelGrid) personnelGrid.innerHTML = `<div class="empty-state personnel-error-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div>`;
            if (personnelBody) personnelBody.innerHTML = `<tr><td colspan="6"><div class="empty-state personnel-error-state"><div><strong>Bağlantı kurulamadı.</strong><p>${conn.msg}</p></div></div></td></tr>`;
            return;
        }

        let query = window.supabaseClient
            .from('soforler')
            .select('*')
            .order('ad_soyad', { ascending: true });

        if (sirketFilter && sirketFilter !== 'hepsi') {
            query = query.eq('sirket', sirketFilter);
        }

        let { data: soforler, error } = await query;
        soforler = window.sanitizeDataArray(soforler);
        if (error) throw error;

        // Prepare assigned vehicles manually (without Postgrest relation)
        const { data: atananAraclar } = await window.supabaseClient.from('araclar').select('sofor_id, plaka').not('sofor_id', 'is', null);
        const aracMap = {};
        if (atananAraclar) {
            atananAraclar.forEach(a => { if(a.sofor_id) aracMap[a.sofor_id] = a.plaka; });
        }

        if (grid) grid.innerHTML = '';
        if (listBody) listBody.innerHTML = '';
        if (tbody) tbody.innerHTML = '';
        if (personnelGrid) personnelGrid.innerHTML = '';
        if (personnelBody) personnelBody.innerHTML = '';

        const personnelSummary = {
            'personnel-kpi-total': soforler.length,
            'personnel-kpi-assigned': soforler.filter(sofor => Boolean(aracMap[sofor.id])).length,
            'personnel-kpi-insured': soforler.filter(sofor => sofor.sigorta_durumu === 'SGK').length,
            'personnel-kpi-missing': soforler.filter(sofor => !sofor.tc_no || !sofor.telefon || !sofor.sirket).length,
            'fleet-driver-summary-total': soforler.length,
            'fleet-driver-summary-assigned': soforler.filter(sofor => Boolean(aracMap[sofor.id])).length,
            'fleet-driver-summary-insured': soforler.filter(sofor => sofor.sigorta_durumu === 'SGK').length,
            'fleet-driver-visible-count': soforler.length
        };
        Object.entries(personnelSummary).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = String(value);
        });

        if (soforler.length === 0) {
            if (grid) grid.innerHTML = '<div class="col-span-full py-12 text-center text-gray-500 italic">Henüz kayıtlı şoför bulunmuyor. Yeni Şoför butonu ile ekleyin.</div>';
            if (listBody) listBody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div><strong>Henüz şoför bulunmuyor.</strong><p>Yeni şoför ekleyerek kadroyu oluşturmaya başlayabilirsiniz.</p></div></div></td></tr>';
            if (personnelGrid) personnelGrid.innerHTML = '<div class="empty-state personnel-empty-state"><div><span class="personnel-state-icon"><i data-lucide="users-round"></i></span><strong>Henüz personel bulunmuyor.</strong><p>İlk personel kaydını ekleyerek başlayabilirsiniz.</p><button class="btn-primary" onclick="openModal(\'Yeni Şoför Ekle\')"><i data-lucide="user-plus"></i>Personel Ekle</button></div></div>';
            if (personnelBody) personnelBody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Henüz personel bulunmuyor.</strong><p>İlk personel kaydını ekleyerek başlayabilirsiniz.</p></div></div></td></tr>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const colors = ['bg-orange-500', 'bg-blue-500', 'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];

        soforler.forEach((sofor, idx) => {
            const initial = sofor.ad_soyad ? sofor.ad_soyad.charAt(0).toUpperCase() : '?';
            const colorClass = colors[idx % colors.length];

            const sigortaColor = sofor.sigorta_durumu === 'SGK' ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : sofor.sigorta_durumu === 'Bağkur' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-red-500/10 text-red-500 border-red-500/20';

            const sirketBadgeColor = sofor.sirket === 'IDEOL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : (sofor.sirket === 'DİKKAN' ? 'bg-violet-500/10 text-violet-400 border-violet-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30');
            const sirketBadgeHtml = sofor.sirket ? `
                <span class="px-1.5 py-0.5 rounded border ${sirketBadgeColor} text-[9px] font-bold uppercase tracking-wider ml-2">
                    ${window.CompanyBranding.companyDisplayName(sofor.sirket)}
                </span>` : '';

            const maasText = sofor.aylik_maas ? `₺${Number(sofor.aylik_maas).toLocaleString('tr-TR')} <span class="text-[9px] text-gray-500 ml-1 font-normal uppercase">Aylık</span>`
                : (sofor.gunluk_ucret ? `₺${sofor.gunluk_ucret} <span class="text-[9px] text-gray-500 ml-1 font-normal uppercase">Günlük</span>` : '<span class="text-gray-500 text-sm font-normal italic">Belirtilmedi</span>');

            const ehlHtml = sofor.ehliyet_sinifi ? `<span class="px-2 py-1 text-[9px] uppercase tracking-wider font-bold rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flexitems-center gap-1"><i data-lucide="credit-card" class="w-3 h-3"></i>${sofor.ehliyet_sinifi}</span>` : '';
            const srcHtml = (sofor.src_belgesi && sofor.src_belgesi !== 'Yok') ? `<span class="px-2 py-1 text-[9px] uppercase tracking-wider font-bold rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center gap-1"><i data-lucide="award" class="w-3 h-3"></i>${sofor.src_belgesi}</span>` : '';

            const companyName = sofor.sirket ? window.CompanyBranding.companyDisplayName(sofor.sirket) : 'Birim belirtilmemiş';
            const personnelStatusClass = sofor.sigorta_durumu === 'SGK' ? 'badge-success' : (sofor.sigorta_durumu === 'Bağkur' ? 'badge-info' : 'badge-neutral');
            const personnelStatusText = sofor.sigorta_durumu || 'Sigorta belirtilmemiş';
            const personnelSearch = [sofor.ad_soyad || '', sofor.telefon || '', sofor.tc_no || '', companyName, aracMap[sofor.id] || '', personnelStatusText, sofor.ehliyet_sinifi || '', sofor.src_belgesi || ''].join(' ');
            const assignmentStatus = aracMap[sofor.id] ? 'assigned' : 'unassigned';
            const insuranceFilter = ['SGK', 'Bağkur'].includes(sofor.sigorta_durumu) ? sofor.sigorta_durumu : 'other';

            if (personnelGrid) {
                const personnelCard = document.createElement('article');
                personnelCard.className = 'personnel-card';
                personnelCard.dataset.personnelSearch = personnelSearch;
                personnelCard.onclick = (event) => window.openSoforDetay(sofor.id, event);
                personnelCard.innerHTML = `
                    <div class="personnel-card-head">
                        <span class="personnel-avatar">${initial}</span>
                        <div><h3>${sofor.ad_soyad || 'İsimsiz personel'}</h3><p>Şoför · ${companyName}</p></div>
                        <span class="${personnelStatusClass}">${personnelStatusText}</span>
                    </div>
                    <div class="personnel-card-details">
                        <div><span><i data-lucide="phone"></i>Telefon</span><strong>${sofor.telefon || 'Belirtilmemiş'}</strong></div>
                        <div><span><i data-lucide="truck"></i>Atanan Araç</span><strong>${aracMap[sofor.id] || 'Atanmamış'}</strong></div>
                        <div><span><i data-lucide="credit-card"></i>Ehliyet / SRC</span><strong>${[sofor.ehliyet_sinifi, sofor.src_belgesi !== 'Yok' ? sofor.src_belgesi : ''].filter(Boolean).join(' · ') || 'Belirtilmemiş'}</strong></div>
                    </div>
                    <div class="personnel-card-actions">
                        <button onclick="window.openSoforDetay('${sofor.id}')"><i data-lucide="eye"></i><span>Detay</span></button>
                        <button onclick="openModal('Şoför Güncelle', '${sofor.id}')"><i data-lucide="edit-2"></i><span>Düzenle</span></button>
                        <button class="is-danger" onclick="deleteRecord('soforler', '${sofor.id}', 'fetchSoforler')" aria-label="${sofor.ad_soyad || 'Personel'} kaydını sil"><i data-lucide="trash-2"></i><span>Sil</span></button>
                    </div>`;
                personnelGrid.appendChild(personnelCard);
            }

            if (personnelBody) {
                const personnelRow = document.createElement('tr');
                personnelRow.dataset.personnelSearch = personnelSearch;
                personnelRow.innerHTML = `
                    <td><div class="personnel-identity"><span class="personnel-avatar">${initial}</span><div><strong>${sofor.ad_soyad || 'İsimsiz personel'}</strong><span>Şoför</span></div></div></td>
                    <td><span class="personnel-phone">${sofor.telefon || 'Belirtilmemiş'}</span></td>
                    <td><span class="personnel-unit">${companyName}</span></td>
                    <td><span class="personnel-vehicle"><i data-lucide="truck"></i>${aracMap[sofor.id] || 'Atanmamış'}</span></td>
                    <td><span class="${personnelStatusClass}">${personnelStatusText}</span></td>
                    <td><div class="personnel-row-actions">
                        <button onclick="window.openSoforDetay('${sofor.id}')" aria-label="${sofor.ad_soyad || 'Personel'} detayını aç"><i data-lucide="eye"></i></button>
                        <button onclick="openModal('Şoför Güncelle', '${sofor.id}')" aria-label="${sofor.ad_soyad || 'Personel'} kaydını düzenle"><i data-lucide="edit-2"></i></button>
                        <button class="is-danger" onclick="deleteRecord('soforler', '${sofor.id}', 'fetchSoforler')" aria-label="${sofor.ad_soyad || 'Personel'} kaydını sil"><i data-lucide="trash-2"></i></button>
                    </div></td>`;
                personnelBody.appendChild(personnelRow);
            }

            if (grid) {
                const card = document.createElement('div');
                card.className = 'dashboard-card hover:border-blue-500/50 transition-all flex flex-col justify-between p-5 cursor-pointer';
                card.dataset.fleetDriverSearch = personnelSearch;
                card.dataset.fleetDriverCompany = sofor.sirket || '';
                card.dataset.fleetDriverAssignment = assignmentStatus;
                card.dataset.fleetDriverInsurance = insuranceFilter;
                card.onclick = (e) => window.openSoforDetay(sofor.id, e);
                card.innerHTML = `
                    <div>
                        <div class="flex items-center gap-4 mb-4 border-b border-white/5 pb-4">
                            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg ${colorClass}">${initial}</div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center flex-wrap">
                                    <h3 class="font-bold text-white text-base truncate" title="${sofor.ad_soyad}">${sofor.ad_soyad}</h3>
                                    ${sirketBadgeHtml}
                                </div>
                                <div class="text-[10px] font-mono text-gray-500 mt-0.5 truncate">${sofor.tc_no || 'TC Yok'}</div>
                            </div>
                        </div>

                        <div class="space-y-3 mb-4">
                            <div class="flex justify-between items-center bg-black/20 p-2 rounded-lg mb-2 border border-white/5">
                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="truck" class="w-3 h-3"></i>Atanan Araç</span>
                                <span class="text-xs font-bold text-white">${aracMap[sofor.id] || '<span class="text-gray-600 italic font-medium">Bilinmiyor/Yok</span>'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i>Telefon</span>
                                <span class="text-xs font-semibold text-gray-300">${sofor.telefon || '—'}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="wallet" class="w-3 h-3"></i>Maaş</span>
                                <span class="text-xs font-bold text-white">${maasText}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1"><i data-lucide="shield-check" class="w-3 h-3"></i>Sigorta</span>
                                <span class="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded-md border ${sigortaColor}">${sofor.sigorta_durumu || '?'}</span>
                            </div>
                            ${(ehlHtml || srcHtml) ? `<div class="flex flex-wrap gap-2 pt-3 border-t border-white/5 mt-3">${ehlHtml}${srcHtml}</div>` : ''}
                        </div>
                    </div>

                    <div class="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                        ${sofor.belge_url ? `<a href="${sofor.belge_url}" target="_blank" class="text-[10px] font-bold text-gray-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1"><i data-lucide="file-check" class="w-3 h-3"></i>Belge</a>` : '<div></div>'}
                        <div class="flex items-center gap-3">
                            <button onclick="openModal('Şoför Güncelle', '${sofor.id}')" class="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest flex items-center gap-1"><i data-lucide="edit-2" class="w-3 h-3"></i>Düzenle</button>
                            <button onclick="deleteRecord('soforler', '${sofor.id}', 'fetchSoforler')" class="text-[10px] font-bold text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-1"><i data-lucide="trash-2" class="w-3 h-3"></i>Sil</button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            }

            if (listBody) {
                const tr = document.createElement('tr');
                const salaryValue = sofor.aylik_maas ? `₺${Number(sofor.aylik_maas).toLocaleString('tr-TR')}` : (sofor.gunluk_ucret ? `₺${Number(sofor.gunluk_ucret).toLocaleString('tr-TR')}` : '—');
                const salaryPeriod = sofor.aylik_maas ? 'Aylık' : (sofor.gunluk_ucret ? 'Günlük' : 'Belirtilmedi');
                tr.dataset.fleetDriverSearch = personnelSearch;
                tr.dataset.fleetDriverCompany = sofor.sirket || '';
                tr.dataset.fleetDriverAssignment = assignmentStatus;
                tr.dataset.fleetDriverInsurance = insuranceFilter;
                tr.innerHTML = `
                    <td>
                        <button type="button" class="fleet-driver-identity" onclick="window.openSoforDetay('${sofor.id}')">
                            <span class="personnel-avatar">${initial}</span>
                            <span><strong>${sofor.ad_soyad || 'İsimsiz şoför'}</strong><small>${sofor.telefon || sofor.tc_no || 'İletişim bilgisi yok'}</small></span>
                        </button>
                    </td>
                    <td><span class="${sofor.sirket ? 'badge-info' : 'badge-neutral'}">${companyName}</span></td>
                    <td><span class="fleet-driver-vehicle ${assignmentStatus === 'unassigned' ? 'is-unassigned' : ''}"><i data-lucide="truck"></i>${aracMap[sofor.id] || 'Atanmamış'}</span></td>
                    <td>
                        <div class="fleet-driver-credentials">
                            ${sofor.ehliyet_sinifi ? `<span class="badge-neutral">Ehliyet ${sofor.ehliyet_sinifi}</span>` : ''}
                            ${(sofor.src_belgesi && sofor.src_belgesi !== 'Yok') ? `<span class="badge-info">${sofor.src_belgesi}</span>` : ''}
                            ${(!sofor.ehliyet_sinifi && (!sofor.src_belgesi || sofor.src_belgesi === 'Yok')) ? '<span class="fleet-empty-value">Belirtilmedi</span>' : ''}
                        </div>
                    </td>
                    <td><span class="${personnelStatusClass}">${personnelStatusText}</span></td>
                    <td class="fleet-driver-money"><strong>${salaryValue}</strong><span>${salaryPeriod}</span></td>
                    <td>
                        <div class="fleet-driver-row-actions">
                            <button onclick="window.openSoforDetay('${sofor.id}')" title="Detay"><i data-lucide="eye"></i></button>
                            ${sofor.belge_url ? `<a href="${sofor.belge_url}" target="_blank" title="Belge"><i data-lucide="file-check"></i></a>` : ''}
                            <button onclick="openModal('Şoför Güncelle', '${sofor.id}')" title="Düzenle"><i data-lucide="edit-2"></i></button>
                            <button class="is-danger" onclick="deleteRecord('soforler', '${sofor.id}', 'fetchSoforler')" title="Sil"><i data-lucide="trash-2"></i></button>
                        </div>
                    </td>
                `;
                listBody.appendChild(tr);
            }

            if (tbody) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${sofor.ad_soyad} (${sofor.tc_no || ''})</td>
                    <td>${sofor.ehliyet_sinifi || ''} / ${sofor.src_belgesi || ''}</td>
                    <td>${sofor.sigorta_durumu || ''}</td>
                    <td>${sofor.aylik_maas || sofor.gunluk_ucret || ''}</td>
                    <td>-</td>
                `;
                tbody.appendChild(tr);
            }
        });

        const personnelSearchInput = document.getElementById('personnel-search-input');
        if (personnelSearchInput && typeof window.filterPersonnelRoster === 'function') window.filterPersonnelRoster(personnelSearchInput.value);
        if (typeof window.applyFleetDriverFilters === 'function') window.applyFleetDriverFilters();

        if (window.lucide) window.lucide.createIcons();

    } catch (error) {
        if (grid) grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-500 font-bold">Hata: ${error.message}</div>`;
        if (listBody) listBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Hata: ${error.message}</td></tr>`;
        if (personnelGrid) personnelGrid.innerHTML = `<div class="empty-state personnel-error-state"><div><strong>Personeller yüklenemedi.</strong><p>${error.message}</p></div></div>`;
        if (personnelBody) personnelBody.innerHTML = `<tr><td colspan="6"><div class="empty-state personnel-error-state"><div><strong>Personeller yüklenemedi.</strong><p>${error.message}</p></div></div></td></tr>`;
    }
}

async function fetchSoforFinans() {
    const tbody = document.getElementById('sofor-finans-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        const { data: islemler, error } = await window.supabaseClient
            .from('sofor_finans')
            .select('*, soforler(ad_soyad)')
            .order('olusturulma_tarihi', { ascending: false });
        if (error) throw error;
        tbody.innerHTML = '';
        if (islemler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">İşlem bulunmuyor.</td></tr>';
            return;
        }
        islemler.forEach(islem => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";
            const tutarClass = islem.tutar < 0 ? 'text-danger' : 'text-primary';
            const tutarPrefix = islem.tutar < 0 ? '' : '+';

            tr.innerHTML = `
                    < td class="px-6 py-5 whitespace-nowrap text-sm text-gray-500" > ${islem.tarih}</td >
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-medium text-primary">${islem.soforler ? islem.soforler.ad_soyad : 'Bilinmiyor'}</td>
                        <td class="px-6 py-5 whitespace-nowrap">
                            <span class="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold border border-gray-200 text-gray-600 bg-gray-50">${islem.islem_turu}</span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-medium ${tutarClass}">${tutarPrefix}₺${Math.abs(islem.tutar).toLocaleString('tr-TR')}</td>
                        <td class="px-6 py-5 whitespace-nowrap"><span class="text-sm font-medium text-gray-500">Tamamlandı</span></td>
                        <td class="px-6 py-5 whitespace-nowrap text-right text-sm">
                            <button onclick="deleteRecord('sofor_finans', '${islem.id}', 'fetchSoforFinans')" class="text-danger hover:text-red-800 text-xs font-semibold uppercase tracking-wider">Sil</button>
                        </td>
                `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function fetchTaseronFinans() {
    window.fetchTaseronFinans = fetchTaseronFinans;
    const tbody = document.getElementById('taseron-finans-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        tbody.innerHTML = '<tr><td colspan="6"><div class="progress-state"><i data-lucide="loader-2" class="animate-spin"></i><strong>Hakedişler hesaplanıyor</strong><p>Seçili dönem verileri hazırlanıyor.</p></div></td></tr>';
        if (window.lucide) window.lucide.createIcons();

        // Get Ownership Filter
        const ownerFilter = document.getElementById('fin-filter-owner')?.value || 'Tümü';

        // 1. Ay filtresini al
        let filterAy = document.getElementById('filter-cari-hakedis-ay')?.value;
        if (!filterAy) {
            filterAy = new Date().toISOString().slice(0, 7); // YYYY-MM
            const el = document.getElementById('filter-cari-hakedis-ay');
            if(el) el.value = filterAy;
        }
        const [year, month] = filterAy.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
        const endDate = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

        // 2. Data Fetching (Paginated)
        let puantajData = [];
        let pFrom = 0;
        const pStep = 1000;
        while (true) {
            const { data: pBatch, error: pErr } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .select('*')
                .gte('tarih', startDate)
                .lte('tarih', endDate)
                .order('tarih', { ascending: true })
                .order('id', { ascending: true })
                .range(pFrom, pFrom + pStep - 1);

            if (pErr) throw pErr;
            if (!pBatch || pBatch.length === 0) break;
            puantajData = puantajData.concat(pBatch);
            if (pBatch.length < pStep) break;
            pFrom += pStep;
        }

        // Pagination for tanimlar (Fetch current period + Global defaults)
        let tanimlar = [];
        let rFrom = 0;
        const rStep = 1000;
        while (true) {
            const { data: pTanim, error: tErr } = await window.supabaseClient
                .from('musteri_arac_tanimlari')
                .select('*')
                .or(`donem.eq.${filterAy},donem.is.null`)
                .order('id', { ascending: true })
                .range(rFrom, rFrom + rStep - 1);
            if (tErr || !pTanim || pTanim.length === 0) break;
            tanimlar = tanimlar.concat(pTanim);
            if (pTanim.length < rStep) break;
            rFrom += rStep;
        }

        const { data: musteriListesi } = await window.supabaseClient
            .from('musteriler')
            .select('id, ad');
        const musteriAdMap = {};
        musteriListesi?.forEach(m => musteriAdMap[m.id] = m.ad || '-');

        // Şoförleri Çek (Özmal araçlar için kullanılacak)
        const { data: soforler } = await window.supabaseClient
            .from('soforler')
            .select('id, ad_soyad');
        const soforMap = {};
        soforler?.forEach(s => soforMap[s.id] = s.ad_soyad || 'Bilinmiyor');
            
        // Paginated Yakitlar Fetch
        let yakitlar = [];
        let yFrom = 0;
        const yStep = 1000;
        while (true) {
            const { data: yBatch, error: yErr } = await window.supabaseClient
                .from('yakit_takip')
                .select('*')
                .gte('tarih', startDate)
                .lte('tarih', endDate)
                .range(yFrom, yFrom + yStep - 1);
            if (yErr || !yBatch || yBatch.length === 0) break;
            yakitlar = yakitlar.concat(yBatch);
            if (yBatch.length < yStep) break;
            yFrom += yStep;
        }

        // Paginated Araclar Fetch (Büyük filolarda 'Bilinmiyor' hatası almamak için)
        let araclar = [];
        let aFrom = 0;
        const aStep = 1000;
        while (true) {
            const { data: aBatch, error: aErr } = await window.supabaseClient
                .from('araclar')
                .select('id, plaka, mulkiyet_durumu, sofor_id, firma_adi')
                .range(aFrom, aFrom + aStep - 1);
            
            if (aErr) {
                console.error("Araclar fetch error:", aErr);
                break;
            }
            if (!aBatch || aBatch.length === 0) break;
            
            araclar = araclar.concat(aBatch);
            if (aBatch.length < aStep) break;
            aFrom += aStep;
        }

        const aracMap = {};
        araclar?.forEach(a => aracMap[a.id] = a);

        // Yardımcı fonksiyon: Summary objesini başlat
        const initSummaryRow = (aId) => {
            const arac = aracMap[aId];
            const mulkiyet = (arac?.mulkiyet_durumu || 'Diğer').toUpperCase();
            
            let sahip_bilgisi = '';
            if (mulkiyet === 'ÖZMAL') {
                sahip_bilgisi = soforMap[arac?.sofor_id] ? `Şoför: ${soforMap[arac.sofor_id]}` : 'Atanmış Şoför Yok';
            } else if (mulkiyet === 'TAŞERON') {
                sahip_bilgisi = arac?.firma_adi || 'Firma Bilinmiyor';
            } else {
                sahip_bilgisi = arac?.firma_adi || '';
            }

            return { 
                arac_id: aId, 
                plaka: arac?.plaka || 'Bilinmiyor', 
                mulkiyet_durumu: mulkiyet,
                sahip_bilgisi: sahip_bilgisi, 
                vardiya: 0, tek: 0, cikis_8: 0, giris_2030: 0, mesai: 0, 
                brut: 0, yakit: 0, musteriDetay: {} 
            };
        };

        // 3. Aggregate Data per Vehicle
        const summary = {};

        if (puantajData) {
            puantajData.forEach(p => {
                const aId = p.arac_id;
                const arac = aracMap[aId];
                if (!arac) return; // Araç silinmişse puantajı atla
                const mulkiyet = (arac?.mulkiyet_durumu || 'Diğer').toUpperCase();
                const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
                
                if (currentFilter !== 'TÜMÜ' && mulkiyet !== currentFilter) return;

                if (!summary[aId]) {
                    summary[aId] = initSummaryRow(aId);
                }
                const parseSafe = (val) => {
                    const str = String(val || '').trim();
                    if (str === '') return 0;
                    const num = parseInt(str, 10);
                    return isNaN(num) ? 0 : num;
                };
                const v  = parseSafe(p.vardiya);
                const t  = parseSafe(p.tek);
                const c8 = parseSafe(p.cikis_8);
                const g2 = parseSafe(p.giris_2030);
                const mId = p.musteri_id;
                const m  = parseSafe(p.mesai);
                
                if(v > 0 || t > 0 || c8 > 0 || g2 > 0 || m > 0) {
                    summary[aId].vardiya  += v;
                    summary[aId].tek      += t;
                    summary[aId].cikis_8  = (summary[aId].cikis_8  || 0) + c8;
                    summary[aId].giris_2030 = (summary[aId].giris_2030 || 0) + g2;
                    summary[aId].mesai    = (summary[aId].mesai    || 0) + m;

                    // ⭐ Dikkan fabrikası için bölgeyi daima 'İzmir' olarak normalize et
                    // DB'de 'Manisa' veya NULL olarak kayıtlı olsa bile Dikkan = İzmir
                    const musteriAdi = (musteriAdMap[mId] || '').toUpperCase();
                    const isDikkanMusteri = musteriAdi.includes('DİKKAN') || musteriAdi.includes('DIKKAN');
                    const bolge   = isDikkanMusteri ? 'İzmir' : (p.bolge || 'Manisa');
                    const detayKey = `${mId}|||${bolge}`;
                    const isIzmir  = bolge === 'İzmir';
                    const bolgeBadge = `<span style="font-size:9px;font-weight:900;padding:1px 5px;border-radius:4px;margin-left:6px;${
                        isIzmir
                            ? 'background:rgba(59,130,246,0.2);color:#3b82f6'
                            : 'background:rgba(249,115,22,0.2);color:#f97316'
                    }">${isIzmir ? '🔵' : '🟠'} ${bolge}</span>`;

                    if(!summary[aId].musteriDetay[detayKey]) {
                        summary[aId].musteriDetay[detayKey] = {
                            vardiya: 0, tek: 0, cikis_8: 0, giris_2030: 0, mesai: 0,
                            vardiya_fiyat: 0, tek_fiyat: 0, cikis_8_fiyat: 0, giris_2030_fiyat: 0, mesai_fiyat: 0,
                            kdv_oran: 0, tev_oran: 0,
                            musteri_ad: (musteriAdMap[mId] || '?') + bolgeBadge,
                            bolge: bolge,
                            musteri_id: mId
                        };
                        // Fiyat tanımını bul — önce bolge eşleşmesi, yoksa bolge'siz (eski/genel) kayıt
                        const tanim = window.HakedisCalculations.selectPriceDefinition(tanimlar, {
                            musteriId: mId,
                            aracId: aId,
                            bolge,
                            donem: filterAy
                        });
                        if(tanim) {
                            summary[aId].musteriDetay[detayKey].vardiya_fiyat    = parseFloat(tanim.vardiya_fiyat)    || 0;
                            summary[aId].musteriDetay[detayKey].tek_fiyat        = parseFloat(tanim.tek_fiyat)        || 0;
                            summary[aId].musteriDetay[detayKey].cikis_8_fiyat    = parseFloat(tanim.cikis_8_fiyat)    || 0;
                            summary[aId].musteriDetay[detayKey].giris_2030_fiyat = parseFloat(tanim.giris_2030_fiyat) || 0;
                            summary[aId].musteriDetay[detayKey].mesai_fiyat      = parseFloat(tanim.mesai_fiyat)      || 0;
                            summary[aId].musteriDetay[detayKey].kdv_oran         = parseFloat(tanim.kdv_oran)         || 0;
                            summary[aId].musteriDetay[detayKey].tev_oran         = parseFloat(tanim.tev_oran)         || 0;
                            
                            // Map override counts
                            const overrideContext = { bolge, donem: filterAy, fallback: null };
                            summary[aId].musteriDetay[detayKey].override_vardiya    = window.HakedisCalculations.periodOverride(tanim, 'override_vardiya', overrideContext);
                            summary[aId].musteriDetay[detayKey].override_tek        = window.HakedisCalculations.periodOverride(tanim, 'override_tek', overrideContext);
                            summary[aId].musteriDetay[detayKey].override_cikis_8    = window.HakedisCalculations.periodOverride(tanim, 'override_cikis_8', overrideContext);
                            summary[aId].musteriDetay[detayKey].override_giris_2030 = window.HakedisCalculations.periodOverride(tanim, 'override_giris_2030', overrideContext);
                            summary[aId].musteriDetay[detayKey].override_mesai      = window.HakedisCalculations.periodOverride(tanim, 'override_mesai', overrideContext);
                        }
                    }
                    summary[aId].musteriDetay[detayKey].vardiya    += v;
                    summary[aId].musteriDetay[detayKey].tek        += t;
                    summary[aId].musteriDetay[detayKey].cikis_8    = (summary[aId].musteriDetay[detayKey].cikis_8    || 0) + c8;
                    summary[aId].musteriDetay[detayKey].giris_2030 = (summary[aId].musteriDetay[detayKey].giris_2030 || 0) + g2;
                    summary[aId].musteriDetay[detayKey].mesai      = (summary[aId].musteriDetay[detayKey].mesai      || 0) + m;
                }
            });
        }

        if (yakitlar) {
            yakitlar.forEach(y => {
                const aId = y.arac_id;
                const arac = aracMap[aId];
                if (!arac) return; // Araç silinmişse yakıtı atla
                const mulkiyet = (arac?.mulkiyet_durumu || 'Diğer').toUpperCase();
                const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
                
                if (currentFilter !== 'TÜMÜ' && mulkiyet !== currentFilter) return;

                if (!summary[aId]) {
                    summary[aId] = initSummaryRow(aId);
                }
                summary[aId].yakit += parseFloat(y.toplam_tutar) || 0;
            });
        }

        Object.values(summary).forEach(row => {
            let totalBrutOfRow = 0;
            let totalVardiya = 0;
            let totalTek = 0;
            let totalMesai = 0;
            
            Object.values(row.musteriDetay).forEach(md => {
                const effV = md.override_vardiya ?? md.vardiya;
                const effT = md.override_tek ?? md.tek;
                const effC8 = md.override_cikis_8 ?? (md.cikis_8 || 0);
                const effG2 = md.override_giris_2030 ?? (md.giris_2030 || 0);
                const effM = md.override_mesai ?? (md.mesai || 0);

                totalBrutOfRow += (effV * md.vardiya_fiyat)
                               + (effT * md.tek_fiyat)
                               + (effC8 * (md.cikis_8_fiyat || 0))
                               + (effG2 * (md.giris_2030_fiyat || 0))
                               + (effM * (md.mesai_fiyat || 0));
                               
                totalVardiya += effV;
                totalTek += effT;
                totalMesai += effM;
            });
            row.brut = totalBrutOfRow;
            row.vardiya = totalVardiya;
            row.tek = totalTek;
            row.mesai = totalMesai;
        });

        let rows = Object.values(summary).sort((a,b) => a.plaka.localeCompare(b.plaka));

        const plakaFilter = document.getElementById('taseron-finans-search')?.value?.toUpperCase();
        if (plakaFilter) {
            rows = rows.filter(r => r.plaka.toUpperCase().includes(plakaFilter) || (r.firma_adi || aracMap[r.arac_id]?.firma_adi || '').toUpperCase().includes(plakaFilter) || (r.sahip_bilgisi || '').toUpperCase().includes(plakaFilter));
        }

        tbody.innerHTML = '';
        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="progress-state"><i data-lucide="file-search"></i><strong>Seçilen kriterlere uygun hakediş kaydı bulunamadı.</strong><p>Filtreleri değiştirerek tekrar deneyin.</p></div></td></tr>';
            const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
            const elBrut = document.getElementById('fin-kpi-brut'); if (elBrut) elBrut.textContent = fmt(0);
            const elYakit = document.getElementById('fin-kpi-yakit'); if (elYakit) elYakit.textContent = fmt(0);
            const elNet = document.getElementById('fin-kpi-net'); if (elNet) elNet.textContent = fmt(0);
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        window._taseronCariData = summary;
        window._taseronCariAy = filterAy;

        // --- firma_adi'ne göre grupla ---
        const firmaGroups = {};
        rows.forEach(row => {
            const firmaAdi = (aracMap[row.arac_id]?.firma_adi || '').trim();
            const key = firmaAdi || row.plaka;
            if (!firmaGroups[key]) {
                firmaGroups[key] = { label: key, firma_adi: firmaAdi || null, plakaList: [], vardiya: 0, tek: 0, mesai: 0, brut: 0, yakit: 0 };
            }
            firmaGroups[key].plakaList.push(row);
            firmaGroups[key].vardiya += row.vardiya;
            firmaGroups[key].tek     += row.tek;
            firmaGroups[key].mesai   += (row.mesai || 0);
            firmaGroups[key].brut    += row.brut;
            firmaGroups[key].yakit   += row.yakit;
        });
        let groupedRows = Object.values(firmaGroups);
        const amountStatus = document.getElementById('filter-cari-hakedis-status')?.value || '';
        if (amountStatus) {
            groupedRows = groupedRows.filter(group => {
                const net = group.brut - group.yakit;
                if (amountStatus === 'positive') return net > 0;
                if (amountStatus === 'negative') return net < 0;
                return Math.abs(net) < 0.005;
            });
        }
        const hakedisSort = document.getElementById('sort-cari-hakedis')?.value || 'net-desc';
        const hakedisSorters = {
            'net-desc': (a, b) => (b.brut - b.yakit) - (a.brut - a.yakit),
            'gross-desc': (a, b) => b.brut - a.brut,
            'fuel-desc': (a, b) => b.yakit - a.yakit,
            'name-asc': (a, b) => a.label.localeCompare(b.label, 'tr')
        };
        groupedRows.sort(hakedisSorters[hakedisSort] || hakedisSorters['net-desc']);
        const visibleCount = document.getElementById('hakedis-visible-count');
        if (visibleCount) visibleCount.textContent = groupedRows.length;

        if (groupedRows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="progress-state"><i data-lucide="file-search"></i><strong>Filtreye uygun cari hakediş bulunamadı.</strong><p>Tutar filtresini veya arama ölçütünü değiştirin.</p></div></td></tr>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let totalVardiya=0, totalTek=0, totalMesai=0, totalBrut=0, totalYakit=0, totalNet=0;

        groupedRows.forEach(group => {
            const net = group.brut - group.yakit;
            totalVardiya += group.vardiya;
            totalTek     += group.tek;
            totalMesai   += group.mesai;
            totalBrut    += group.brut;
            totalYakit   += group.yakit;
            totalNet     += net;

            const isSingle = group.plakaList.length === 1 && !group.firma_adi;

            const plakaHTML = group.plakaList.map(r =>
                `<span onclick="event.stopPropagation(); window.openCariHakedisDetay('${r.arac_id}')"
                       class="hakedis-plate-chip"
                       title="${r.plaka} — Cari Kartı Aç">${r.plaka}</span>`
            ).join('');

            const tr = document.createElement('tr');
            tr.className = `hakedis-ledger-row${isSingle ? ' is-interactive' : ''}`;
            if (isSingle) tr.onclick = () => window.openCariHakedisDetay(group.plakaList[0].arac_id);

            tr.innerHTML = `
                <td class="cari-card-identity" data-label="Cari / Firma">
                    <div class="cari-card-name">${group.label}</div>
                    ${!isSingle ? `<div class="cari-card-plates">${plakaHTML}</div>` : '<span class="cari-card-context">Tek araç · detaya açılabilir</span>'}
                </td>
                <td class="cari-card-services" data-label="Seferler">
                    <div class="work-summary-line">
                        <span class="work-summary-item"><strong>${group.vardiya}</strong><span>Vardiya</span></span>
                        <span class="work-summary-item"><strong>${group.tek}</strong><span>Tek</span></span>
                        <span class="work-summary-item"><strong>${group.mesai}</strong><span>Mesai</span></span>
                    </div>
                </td>
                <td class="cari-card-money is-gross" data-label="Brüt Hizmet"><strong>₺${group.brut.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
                <td class="cari-card-money is-deduction" data-label="Yakıt Kesintisi"><strong>-₺${group.yakit.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
                <td class="cari-card-money cari-card-net${net < 0 ? ' is-negative' : ''}" data-label="Net Hakediş"><strong>₺${net.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
                <td class="cari-card-detail" data-label="Detaylar">
                    ${isSingle ? '<span class="hakedis-detail-action">İncele <i data-lucide="arrow-up-right"></i></span>' : `<span class="cari-card-count">${group.plakaList.length} araç</span>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        const tfoot = document.createElement('tr');
        tfoot.className = "hakedis-ledger-total";
        tfoot.innerHTML = `
            <td data-label="Toplam"><span>Seçili dönem</span><strong>GENEL TOPLAM</strong></td>
            <td data-label="Seferler"><span>${totalVardiya} Vardiya · ${totalTek} Tek · ${totalMesai} Mesai</span></td>
            <td data-label="Brüt"><span>Brüt</span><strong>₺${totalBrut.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
            <td data-label="Yakıt"><span>Yakıt</span><strong>-₺${totalYakit.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
            <td data-label="Net"><span>Net Hakediş</span><strong class="${totalNet < 0 ? 'is-negative' : ''}">₺${totalNet.toLocaleString('tr-TR', {minimumFractionDigits:2})}</strong></td>
            <td class="cari-card-detail"></td>
        `;
        tbody.appendChild(tfoot);
        
        const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        const elBrut = document.getElementById('fin-kpi-brut'); if (elBrut) elBrut.textContent = fmt(totalBrut);
        const elYakit = document.getElementById('fin-kpi-yakit'); if (elYakit) elYakit.textContent = fmt(totalYakit);
        const elNet = document.getElementById('fin-kpi-net'); if (elNet) elNet.textContent = fmt(totalNet);
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("fetchTaseronFinans error:", e);
        if(tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="progress-state is-error"><i data-lucide="triangle-alert"></i><strong>Hakedişler yüklenemedi</strong><p>Veriler yüklenirken bir hata oluştu.</p></div></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function fetchTaseronAylikRapor() {
    const tbody = document.getElementById('taseron-rapor-tbody');
    const tfoot = document.getElementById('taseron-rapor-tfoot');
    if (!tbody) return;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        tbody.innerHTML = '<tr><td colspan="6"><div class="progress-state"><i data-lucide="loader-2" class="animate-spin"></i><strong>Rapor hazırlanıyor</strong><p>Seçili dönem özeti hesaplanıyor.</p></div></td></tr>';
        if (window.lucide) window.lucide.createIcons();
        if(tfoot) tfoot.classList.add('hidden');

        // Get Ownership and Date Filters
        const ownerFilter = document.getElementById('fin-filter-owner')?.value || 'Tümü';
        let filterAy = document.getElementById('filter-taseron-rapor-ay')?.value;
        if (!filterAy) {
            filterAy = new Date().toISOString().slice(0, 7);
            const el = document.getElementById('filter-taseron-rapor-ay');
            if(el) el.value = filterAy;
        }

        const [year, month] = filterAy.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
        const endDate = `${year}-${month}-${String(lastDayObj.getDate()).padStart(2, '0')}`;

        // Parallel Fetch Data (Small tables)
        const [yakitRes, bakimRes, aracRes] = await Promise.all([
            window.supabaseClient.from('yakit_takip').select('*').gte('tarih', startDate).lte('tarih', endDate),
            window.supabaseClient.from('arac_bakimlari').select('*').gte('islem_tarihi', startDate).lte('islem_tarihi', endDate),
            window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu')
        ]);

        // Paginated Puantaj Fetch (MUST be paginated to exceed 1000 rows)
        let puantajData = [];
        let pf = 0;
        const ps = 1000;
        while (true) {
            const { data: batch, error } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .select('*')
                .gte('tarih', startDate)
                .lte('tarih', endDate)
                .order('id', { ascending: true })
                .range(pf, pf + ps - 1);
            if (error || !batch || batch.length === 0) break;
            puantajData = puantajData.concat(batch);
            if (batch.length < ps) break;
            pf += ps;
        }

        // Paginated Tanimlar Fetch
        let tanimlar = [];
        let tf = 0;
        const ts = 1000;
        while (true) {
            const { data: pt, error: te } = await window.supabaseClient
                .from('musteri_arac_tanimlari')
                .select('*')
                .order('id', { ascending: true })
                .range(tf, tf + ts - 1);
            if (te || !pt || pt.length === 0) break;
            tanimlar = tanimlar.concat(pt);
            if (pt.length < ts) break;
            tf += ts;
        }

        const aracMap = {};
        aracRes.data?.forEach(a => aracMap[a.id] = a);

        const summary = {};

        // Aggregate Group data
        const addRow = (aid) => {
            if (!summary[aid]) summary[aid] = { plaka: aracMap[aid]?.plaka || '?', sefer: 0, brut: 0, yakit: 0, servis: 0, net: 0 };
        };

        (puantajData || []).forEach(p => {
            const aid = p.arac_id;
            if (!aracMap[aid]) return; // Araç silinmişse atla
            const mulkiyet = (aracMap[aid]?.mulkiyet_durumu || 'Diğer').toUpperCase();
            const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
            if (currentFilter !== 'TÜMÜ' && mulkiyet !== currentFilter) return;

            addRow(aid);
            const parseSafe = (val) => {
                const str = String(val || '').trim();
                if (str === '') return 0;
                const num = parseInt(str, 10);
                return isNaN(num) ? 0 : num;
            };
            const v = parseSafe(p.vardiya);
            const t = parseSafe(p.tek);
            const m = parseSafe(p.mesai);

            if(v > 0 || t > 0 || m > 0) {
                addRow(aid);
                const bolge = p.bolge || 'Manisa';
                const tanim = window.HakedisCalculations.selectPriceDefinition(tanimlar, {
                    musteriId: p.musteri_id,
                    aracId: aid,
                    bolge,
                    donem: filterAy
                });
                const overrideContext = { bolge, donem: filterAy };
                const effV = window.HakedisCalculations.periodOverride(tanim, 'override_vardiya', { ...overrideContext, fallback: v });
                const effT = window.HakedisCalculations.periodOverride(tanim, 'override_tek', { ...overrideContext, fallback: t });
                const effM = window.HakedisCalculations.periodOverride(tanim, 'override_mesai', { ...overrideContext, fallback: m });

                summary[aid].sefer += (effV + effT + effM);

                if(tanim) {
                    summary[aid].brut += (effV * (tanim.vardiya_fiyat || 0)) + (effT * (tanim.tek_fiyat || 0)) + (effM * (tanim.mesai_fiyat || 0));
                }
            }
        });

        (yakitRes.data || []).forEach(y => {
            const aid = y.arac_id;
            if (!aracMap[aid]) return; // Araç silinmişse atla
            const mulkiyet = (aracMap[aid]?.mulkiyet_durumu || 'Diğer').toUpperCase();
            const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
            if (currentFilter !== 'TÜMÜ' && mulkiyet !== currentFilter) return;
            
            addRow(aid);
            summary[aid].yakit += parseFloat(y.toplam_tutar) || 0;
        });

        (bakimRes.data || []).forEach(b => {
             const aid = b.arac_id;
             if (!aracMap[aid]) return; // Araç silinmişse atla
             const mulkiyet = (aracMap[aid]?.mulkiyet_durumu || 'Diğer').toUpperCase();
             const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
             if (currentFilter !== 'TÜMÜ' && mulkiyet !== currentFilter) return;
             
             addRow(aid);
             summary[aid].servis += parseFloat(b.toplam_tutar) || 0;
        });

        // Render table
        tbody.innerHTML = '';
        let gtSefer=0, gtBrut=0, gtYakit=0, gtServis=0, gtNet=0;

        const sortedRows = Object.values(summary).sort((a,b) => a.plaka.localeCompare(b.plaka));
        
        if (sortedRows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="progress-state"><i data-lucide="file-search"></i><strong>Seçilen kriterlere uygun hakediş kaydı bulunamadı.</strong><p>Filtreleri değiştirerek tekrar deneyin.</p></div></td></tr>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        sortedRows.forEach(row => {
            row.net = row.brut - row.yakit - row.servis;
            gtSefer += row.sefer; gtBrut += row.brut; gtYakit += row.yakit; gtServis += row.servis; gtNet += row.net;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-white" data-label="Araç / Plaka">${row.plaka}</td>
                <td class="px-6 py-4 text-center text-gray-400 font-mono" data-label="Sefer">${row.sefer}</td>
                <td class="px-6 py-4 text-right font-bold text-gray-300" data-label="Brüt Kazanç">₺${row.brut.toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4 text-right font-bold text-orange-400" data-label="Yakıt">₺${row.yakit.toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4 text-right font-bold text-red-400" data-label="Servis">₺${row.servis.toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4 text-right font-black text-orange-400" data-label="Net Ödenecek">₺${row.net.toLocaleString('tr-TR')}</td>
            `;
            tbody.appendChild(tr);
        });

        // Update Footers
        if(tfoot) {
            tfoot.classList.remove('hidden');
            document.getElementById('total-taseron-sefer').textContent = gtSefer;
            document.getElementById('total-taseron-brut').textContent = '₺' + gtBrut.toLocaleString('tr-TR');
            document.getElementById('total-taseron-yakit').textContent = '₺' + gtYakit.toLocaleString('tr-TR');
            document.getElementById('total-taseron-servis').textContent = '₺' + gtServis.toLocaleString('tr-TR');
            document.getElementById('total-taseron-net').textContent = '₺' + gtNet.toLocaleString('tr-TR');
        }

        // Update KPIs
        const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        const elBrut = document.getElementById('fin-kpi-brut'); if (elBrut) elBrut.textContent = fmt(gtBrut);
        const elYakit = document.getElementById('fin-kpi-yakit'); if (elYakit) elYakit.textContent = fmt(gtYakit);
        const elNet = document.getElementById('fin-kpi-net'); if (elNet) elNet.textContent = fmt(gtNet);
        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("fetchTaseronAylikRapor error:", e);
        tbody.innerHTML = `<tr><td colspan="6"><div class="progress-state is-error"><i data-lucide="triangle-alert"></i><strong>Hakediş raporu yüklenemedi</strong><p>Veriler yüklenirken bir hata oluştu.</p></div></td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

window.toggleCariFactory = function(button) {
    const card = button?.closest('.cari-factory-card');
    if (!card) return;
    const willOpen = !card.classList.contains('is-open');
    const list = card.closest('.cari-factory-list');
    list?.querySelectorAll('.cari-factory-card.is-open').forEach(item => {
        if (item === card) return;
        item.classList.remove('is-open');
        item.querySelector('.cari-factory-toggle')?.setAttribute('aria-expanded', 'false');
    });
    card.classList.toggle('is-open', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
};

window.openCariHakedisDetay = async function(arac_id) {
    if(!window._taseronCariData || !window._taseronCariData[arac_id]) return;
    const data = window._taseronCariData[arac_id];
    const month = window._taseronCariAy;
    
    // Yükleniyor overlay
    const overlay = document.createElement('div');
    overlay.className = 'hakedis-detail-overlay fixed inset-0 bg-black/80 backdrop-blur-sm z-[99] flex items-center justify-center p-4';
    overlay.id = 'cari-kart-modal-overlay';
    overlay.setAttribute('data-arac-id', arac_id);
    overlay.innerHTML = '<div class="text-white text-sm font-bold animate-pulse"><i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i> Yükleniyor...</div>';
    document.body.appendChild(overlay);
    if(window.lucide) window.lucide.createIcons();

    try {
        const { data: musteriler, error: mErr } = await window.supabaseClient.from('musteriler').select('id, ad');
        if(mErr) console.warn('Musteriler fetch error:', mErr);
        const musteriMap = {};
        musteriler?.forEach(m => musteriMap[m.id] = m.ad || '-');
        
        const [year, m] = month.split('-');
        const startDate = `${year}-${m}-01`;
        const lastDayObj = new Date(parseInt(year), parseInt(m), 0);
        const endDate = `${year}-${m}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
        const { data: yakitlar } = await window.supabaseClient
            .from('yakit_takip')
            .select('*')
            .eq('arac_id', arac_id)
            .gte('tarih', startDate)
            .lte('tarih', endDate)
            .order('tarih', {ascending: false});

        // === ÖZMAL: Bakım ve Sigorta Giderlerini Çek ===
        const isOzmal = (data.mulkiyet_durumu || '').toUpperCase() === 'ÖZMAL';
        let otoBakimlar = [];
        let otoPoliceler = [];
        if (isOzmal) {
            const [bakimRes, policeRes] = await Promise.all([
                window.supabaseClient.from('arac_bakimlari')
                    .select('id, islem_tarihi, islem_turu, aciklama, toplam_tutar')
                    .eq('arac_id', arac_id)
                    .gte('islem_tarihi', startDate)
                    .lte('islem_tarihi', endDate)
                    .order('islem_tarihi', { ascending: false }),
                window.supabaseClient.from('arac_policeler')
                    .select('id, baslangic_tarihi, bitis_tarihi, police_turu, toplam_tutar')
                    .eq('arac_id', arac_id)
                    .gte('baslangic_tarihi', startDate)
                    .lte('baslangic_tarihi', endDate)
                    .order('baslangic_tarihi', { ascending: false })
            ]);
            otoBakimlar  = bakimRes.data  || [];
            otoPoliceler = policeRes.data || [];
        }

        let factoriesHTML = '';
        const mIds = Object.keys(data.musteriDetay);
        if(mIds.length === 0) {
            factoriesHTML = '<div class="text-sm text-gray-500 italic p-4 text-center border dashed border-white/5 rounded-xl">Bu ay hiç servis kaydı bulunmuyor.</div>';
        } else {
            factoriesHTML = `<div class="cari-factory-list space-y-4">`;
            mIds.forEach((mId, factoryIndex) => {
                const md = data.musteriDetay[mId];
                const unvan = md.musteri_ad || musteriMap[mId] || `Fabrika ID: ${mId}`;
                factoriesHTML += `
                    <div class="cari-factory-card${factoryIndex === 0 ? ' is-open' : ''} bg-black/30 p-5 rounded-xl border border-white/5 musteri-calc-row shadow-inner" data-mid="${mId}">
                        <button type="button" class="cari-factory-toggle" onclick="window.toggleCariFactory(this)" aria-expanded="${factoryIndex === 0 ? 'true' : 'false'}">
                            <span><i data-lucide="building-2"></i><strong>${unvan}</strong><small>${md.vardiya || 0} vardiya · ${md.tek || 0} tek sefer</small></span>
                            <i data-lucide="chevron-down" class="cari-factory-chevron"></i>
                        </button>
                        <div class="cari-factory-content">
                        <div class="cari-rate-grid grid grid-cols-2 gap-4">
                            <div class="cari-rate-head" aria-hidden="true">
                                <span>Hizmet</span>
                                <span>Adet / Puantaj</span>
                                <span>Birim fiyat</span>
                            </div>
                            <div class="cari-rate-item is-shift bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm focus-within:border-orange-500/50 transition-colors">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                                    <div class="flex justify-between items-center">
                                        <span>Vardiya</span>
                                        <div class="flex items-center gap-1">
                                            <input type="number" min="0" step="1" class="calc-vardiya-count w-14 bg-white/10 text-orange-300 text-xs font-black border border-white/20 rounded-md px-1 py-0.5 text-right focus:outline-none focus:border-orange-500 transition-colors" value="${md.override_vardiya !== null && md.override_vardiya !== undefined ? md.override_vardiya : md.vardiya}" data-puantaj="${md.vardiya}" data-period-override="${md.override_vardiya !== null && md.override_vardiya !== undefined}" title="D\u00fczenlene bilir. Puantaj: ${md.vardiya}">
                                            <span class="text-gray-600 text-[9px] whitespace-nowrap">/ ${md.vardiya}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 relative">
                                    <span class="text-gray-400 text-sm font-bold absolute left-2 pointer-events-none">₺</span>
                                    <input type="number" step="0.01" class="calc-vardiya-fiyat w-full bg-transparent text-white text-base font-black border-none focus:outline-none transition-all pl-6 pr-2 py-1 placeholder-white/20" value="${md.vardiya_fiyat}">
                                </div>
                            </div>
                            <div class="cari-rate-item is-single bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm focus-within:border-blue-500/50 transition-colors">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                                    <div class="flex justify-between items-center">
                                        <span>Tek Sefer</span>
                                        <div class="flex items-center gap-1">
                                            <input type="number" min="0" step="1" class="calc-tek-count w-14 bg-white/10 text-blue-300 text-xs font-black border border-white/20 rounded-md px-1 py-0.5 text-right focus:outline-none focus:border-blue-500 transition-colors" value="${md.override_tek !== null && md.override_tek !== undefined ? md.override_tek : md.tek}" data-puantaj="${md.tek}" data-period-override="${md.override_tek !== null && md.override_tek !== undefined}" title="D\u00fczenlene bilir. Puantaj: ${md.tek}">
                                            <span class="text-gray-600 text-[9px] whitespace-nowrap">/ ${md.tek}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 relative">
                                    <span class="text-gray-400 text-sm font-bold absolute left-2 pointer-events-none">₺</span>
                                    <input type="number" step="0.01" class="calc-tek-fiyat w-full bg-transparent text-white text-base font-black border-none focus:outline-none transition-all pl-6 pr-2 py-1 placeholder-white/20" value="${md.tek_fiyat}">
                                </div>
                            </div>
                            <!-- 8 Çıkışı Satırı (Dikkan Özel) -->
                            <div class="cari-rate-item bg-amber-500/5 p-3 rounded-xl border border-amber-500/20 shadow-sm focus-within:border-amber-500/50 transition-colors">
                                <div class="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-2">
                                    <div class="flex justify-between items-center">
                                        <span>8 Çıkışı</span>
                                        <div class="flex items-center gap-1">
                                            <input type="number" min="0" step="1" class="calc-cikis8-count w-14 bg-amber-500/10 text-amber-300 text-xs font-black border border-amber-500/20 rounded-md px-1 py-0.5 text-right focus:outline-none focus:border-amber-500 transition-colors" value="${md.override_cikis_8 !== null && md.override_cikis_8 !== undefined ? md.override_cikis_8 : (md.cikis_8 || 0)}" data-puantaj="${md.cikis_8 || 0}" data-period-override="${md.override_cikis_8 !== null && md.override_cikis_8 !== undefined}" title="Puantaj: ${md.cikis_8 || 0}">
                                            <span class="text-gray-600 text-[9px] whitespace-nowrap">/ ${md.cikis_8 || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 relative">
                                    <span class="text-amber-500/60 text-sm font-bold absolute left-2 pointer-events-none">₺</span>
                                    <input type="number" step="0.01" class="calc-cikis8-fiyat w-full bg-transparent text-amber-200 text-base font-black border-none focus:outline-none transition-all pl-6 pr-2 py-1 placeholder-white/20" value="${md.cikis_8_fiyat || 0}">
                                </div>
                            </div>
                            <!-- 20:30 Girişi Satırı (Dikkan Özel) -->
                            <div class="cari-rate-item bg-purple-500/5 p-3 rounded-xl border border-purple-500/20 shadow-sm focus-within:border-purple-500/50 transition-colors">
                                <div class="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-2">
                                    <div class="flex justify-between items-center">
                                        <span>20:30 Giriş</span>
                                        <div class="flex items-center gap-1">
                                            <input type="number" min="0" step="1" class="calc-giris2030-count w-14 bg-purple-500/10 text-purple-300 text-xs font-black border border-purple-500/20 rounded-md px-1 py-0.5 text-right focus:outline-none focus:border-purple-500 transition-colors" value="${md.override_giris_2030 !== null && md.override_giris_2030 !== undefined ? md.override_giris_2030 : (md.giris_2030 || 0)}" data-puantaj="${md.giris_2030 || 0}" data-period-override="${md.override_giris_2030 !== null && md.override_giris_2030 !== undefined}" title="Puantaj: ${md.giris_2030 || 0}">
                                            <span class="text-gray-600 text-[9px] whitespace-nowrap">/ ${md.giris_2030 || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 relative">
                                    <span class="text-purple-500/60 text-sm font-bold absolute left-2 pointer-events-none">₺</span>
                                    <input type="number" step="0.01" class="calc-giris2030-fiyat w-full bg-transparent text-purple-200 text-base font-black border-none focus:outline-none transition-all pl-6 pr-2 py-1 placeholder-white/20" value="${md.giris_2030_fiyat || 0}">
                                </div>
                            </div>
                            <!-- Mesai Row -->
                            <div class="cari-rate-item is-overtime bg-white/5 p-3 rounded-xl border border-white/10 shadow-sm focus-within:border-indigo-500/50 transition-colors col-span-2">
                                <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                                    <div class="flex justify-between items-center">
                                        <span>Mesai (Dikkan Özel)</span>
                                        <div class="flex items-center gap-1">
                                            <input type="number" min="0" step="1" class="calc-mesai-count w-14 bg-white/10 text-indigo-300 text-xs font-black border border-white/20 rounded-md px-1 py-0.5 text-right focus:outline-none focus:border-indigo-500 transition-colors" value="${md.override_mesai !== null && md.override_mesai !== undefined ? md.override_mesai : (md.mesai || 0)}" data-puantaj="${md.mesai || 0}" data-period-override="${md.override_mesai !== null && md.override_mesai !== undefined}" title="Puantaj: ${md.mesai || 0}">
                                            <span class="text-gray-600 text-[9px] whitespace-nowrap">/ ${md.mesai || 0}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 relative">
                                    <span class="text-gray-400 text-sm font-bold absolute left-2 pointer-events-none">₺</span>
                                    <input type="number" step="0.01" class="calc-mesai-fiyat w-full bg-transparent text-white text-base font-black border-none focus:outline-none transition-all pl-6 pr-2 py-1 placeholder-white/20" value="${md.mesai_fiyat || 0}">
                                </div>
                            </div>
                        </div>
                        <div class="cari-tax-grid grid grid-cols-2 gap-3 mt-3">
                            <div class="cari-tax-item is-vat bg-white/5 p-3 rounded-xl border border-blue-500/20 focus-within:border-blue-500/50 transition-colors">
                                <div class="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-2">KDV %</div>
                                <div class="flex items-center gap-1">
                                    <input type="number" min="0" max="100" step="1" class="calc-kdv-oran w-full bg-transparent text-blue-300 text-sm font-black border-none focus:outline-none py-1" value="${md.kdv_oran || 0}">
                                    <span class="text-gray-500 text-xs font-bold">%</span>
                                </div>
                            </div>
                            <div class="cari-tax-item is-withholding bg-white/5 p-3 rounded-xl border border-yellow-500/20 focus-within:border-yellow-500/50 transition-colors">
                                <div class="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-2">TEV %</div>
                                <div class="flex items-center gap-1">
                                    <input type="number" min="0" max="100" step="1" class="calc-tev-oran w-full bg-transparent text-yellow-300 text-sm font-black border-none focus:outline-none py-1" value="${md.tev_oran || 0}">
                                    <span class="text-gray-500 text-xs font-bold">%</span>
                                </div>
                            </div>
                        </div>
                        <div class="cari-factory-total mt-3 pt-3 border-t border-white/10 space-y-1">
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Brüt Tutar:</span>
                                <span class="text-white font-black text-sm row-toplam">₺0,00</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-blue-400 uppercase font-bold tracking-widest">+ KDV:</span>
                                <span class="text-blue-300 font-bold text-xs row-kdv-tutar">+₺0,00</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-[10px] text-yellow-400 uppercase font-bold tracking-widest">- TEV:</span>
                                <span class="text-yellow-300 font-bold text-xs row-tev-tutar">-₺0,00</span>
                            </div>
                        </div>
                        </div>
                    </div>
                `;
            });
            factoriesHTML += `</div>`;
        }

        let yakitHTML = '';
        let totalYakit = 0;
        if(!yakitlar || yakitlar.length === 0) {
            yakitHTML = '<div class="text-sm text-gray-500 italic p-4 text-center border dashed border-white/5 rounded-xl">Bu ay hiç yakıt alımı bulunmuyor.</div>';
        } else {
            yakitHTML = `
            <div class="flex justify-between items-center mb-2 px-1">
                <label class="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" onchange="document.querySelectorAll('.yakit-cb').forEach(cb => cb.checked = this.checked)" class="w-3.5 h-3.5 rounded border-gray-600 bg-black/20 text-orange-500 focus:ring-orange-500/30 cursor-pointer">
                    <span class="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors uppercase tracking-widest">Tümünü Seç</span>
                </label>
                <button onclick="window.transferSelectedYakitlar('${arac_id}')" class="px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition-colors uppercase tracking-widest">
                    <i data-lucide="arrow-right-left" class="w-3 h-3"></i> Toplu Aktar
                </button>
            </div>
            <div class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2" id="yakitlar-list-container">`;
            yakitlar.forEach(y => {
                const tutar = parseFloat(y.toplam_tutar) || 0;
                totalYakit += tutar;
                yakitHTML += `
                    <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:bg-white/10 transition-colors group">
                        <div class="flex items-center gap-3">
                            <input type="checkbox" value="${y.id}" class="yakit-cb w-4 h-4 rounded border-gray-600 bg-black/40 text-orange-500 focus:ring-orange-500/30 cursor-pointer">
                            <div class="p-2 bg-orange-500/10 text-orange-400 rounded-lg"><i data-lucide="fuel" class="w-4 h-4"></i></div>
                            <div>
                                <div class="text-xs text-white font-bold">${y.tarih}</div>
                                <div class="text-[10px] text-gray-400 mt-0.5">${y.litre} Lt x ₺${y.birim_fiyat}</div>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <div class="text-sm font-black text-orange-400">-₺${tutar.toLocaleString('tr-TR', {minimumFractionDigits:2})}</div>
                            <button onclick="window.transferYakit(['${y.id}'], '${arac_id}')" class="opacity-0 group-hover:opacity-100 p-1.5 bg-white/5 hover:bg-blue-500/20 text-gray-400 hover:text-blue-400 rounded-lg transition-all" title="Başka Araca Aktar">
                                <i data-lucide="arrow-right-left" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
            yakitHTML += `</div>`;
        }

        overlay.innerHTML = `
            <div class="cari-card-sheet bg-[#1a1c23] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                <div class="cari-card-header p-5 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-transparent">
                    <div class="cari-card-heading">
                        <span class="cari-card-eyebrow">DÖNEMSEL HAKEDİŞ</span>
                        <h2 class="text-xl font-black text-white flex items-center gap-2"><i data-lucide="calculator" class="w-6 h-6 text-orange-500"></i><span class="cari-hakedis-title">Hakediş</span><span class="cari-hakedis-plate">${data.plaka}</span></h2>
                        <div class="cari-card-meta flex items-center gap-2 mt-1">
                            <p class="text-xs text-gray-400">${month} Dönemi Hakediş Detayları</p>
                            <span class="text-gray-600">|</span>
                            <p class="text-xs font-bold text-orange-400/80 uppercase tracking-wider" id="modal-sahip-bilgisi">${data.sahip_bilgisi || ''}</p>
                        </div>
                    </div>
                        <div class="cari-card-actions flex items-center gap-3">
                        <button onclick="window.printCariKart('${data.plaka}', '${month}')" class="cari-card-action is-print px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold rounded transition-all flex items-center gap-1.5">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i> Yazdır
                        </button>
                        <button onclick="window.saveHakedisFiyatlar('${arac_id}', this, '${month}')" class="cari-card-action is-save px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded shadow-[0_0_15px_rgba(234,88,12,0.3)] transition-all flex items-center gap-1.5">
                            <i data-lucide="save" class="w-3.5 h-3.5"></i> Kaydet
                        </button>
                        <button onclick="document.getElementById('cari-kart-modal-overlay').remove()" class="cari-card-close p-2 bg-white/5 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors" aria-label="Hakediş detayını kapat">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>

                <div class="cari-card-body p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    <div class="cari-card-section cari-service-section">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="briefcase" class="w-4 h-4"></i> Hizmet Fiyatlandırma</h3>
                        ${factoriesHTML}
                    </div>

                    <div class="cari-card-section cari-fuel-section">
                        <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2"><i data-lucide="droplets" class="w-4 h-4 text-orange-400"></i> Yakıt Kesintileri</h3>
                        ${yakitHTML}
                    </div>

                    <!-- ÖZMAL OTOMATİK GİDERLER BÖLÜMÜ -->
                    ${isOzmal ? `
                    <div class="cari-card-section cari-auto-expense-section">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <i data-lucide="wrench" class="w-4 h-4 text-amber-400"></i>
                                Bakım & Sigorta Giderleri
                                <span class="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded border border-amber-500/30 uppercase tracking-wider">OTOMATİK</span>
                            </h3>
                        </div>
                        <div id="auto-gider-container" class="space-y-2"></div>
                    </div>
                    ` : ''}

                    <!-- MANUEL GELİR/GİDER BÖLÜMÜ -->
                    <div class="cari-card-section cari-manual-section">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <i data-lucide="plus-minus" class="w-4 h-4 text-purple-400"></i> Manuel Gelir / Gider Kalemleri
                            </h3>
                            <div class="flex items-center gap-2">
                                <button onclick="window.addManuelKalem('gelir')" class="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 rounded-lg text-[11px] font-bold transition-all">
                                    <i data-lucide="plus" class="w-3 h-3"></i> Gelir Ekle
                                </button>
                                <button onclick="window.addManuelKalem('gider')" class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-bold transition-all">
                                    <i data-lucide="minus" class="w-3 h-3"></i> Gider Ekle
                                </button>
                            </div>
                        </div>
                        <div id="manuel-kalemler-container" class="space-y-2 min-h-[40px]">
                            <p class="text-xs text-gray-600 italic text-center py-3" id="manuel-bos-mesaj">Henüz manuel kalem eklenmedi. Gelir veya gider eklemek için yukarıdaki butonları kullanın.</p>
                        </div>
                    </div>

                </div>

                <div class="cari-card-summary p-6 border-t border-white/10 bg-black/60 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-10" aria-label="Hakediş hesap özeti">
                    <div class="flex flex-col gap-2.5">
                        <div class="cari-summary-row is-base flex justify-between items-center">
                            <span class="text-sm text-gray-400 font-bold">Fatura Matrahı</span>
                            <span class="text-lg text-gray-300 font-black" id="modal-brut-total">₺0,00</span>
                        </div>
                        <div class="cari-summary-row is-vat flex justify-between items-center">
                            <span class="text-sm text-blue-400 font-bold">+ Toplam KDV</span>
                            <span class="text-base text-blue-300 font-black" id="modal-kdv-total">+₺0,00</span>
                        </div>
                        <div class="cari-summary-row is-withholding flex justify-between items-center">
                            <span class="text-sm text-yellow-400 font-bold">- Toplam TEV (Stopaj)</span>
                            <span class="text-base text-yellow-300 font-black" id="modal-tev-total">-₺0,00</span>
                        </div>
                        <div class="cari-summary-row is-fuel flex justify-between items-center">
                            <span class="text-sm text-gray-400 font-bold">Toplam Yakıt Kesintisi</span>
                            <span class="text-base text-orange-500 font-black" id="modal-yakit-total" data-val="${totalYakit}">-₺${totalYakit.toLocaleString('tr-TR', {minimumFractionDigits:2})}</span>
                        </div>
                        <div class="cari-summary-row is-expense flex justify-between items-center pb-3 border-b border-dashed border-white/10" id="modal-auto-gider-row" style="display:none!important">
                            <span class="text-sm text-amber-400 font-bold">- Bakım &amp; Sigorta</span>
                            <span class="text-base text-amber-300 font-black" id="modal-auto-gider">-₺0,00</span>
                        </div>
                        <div class="cari-summary-row is-net flex justify-between items-center pt-2">
                            <span class="text-xl text-white font-black uppercase tracking-widest">NET HAKEDİŞ</span>
                            <span class="text-3xl text-orange-400 font-black" id="modal-net-total">₺0,00</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if(window.lucide) window.lucide.createIcons();

        // === HESAPLAMA FONKSİYONU (önce tanımla) ===
        const calculateTotals = () => {
            let totalBrut = 0;
            let totalKdv  = 0;
            let totalTev  = 0;
            const counts = data.musteriDetay;

            overlay.querySelectorAll('.musteri-calc-row').forEach(row => {
                const mId    = row.getAttribute('data-mid');
                const vFiyat = parseFloat(row.querySelector('.calc-vardiya-fiyat').value)    || 0;
                const tFiyat = parseFloat(row.querySelector('.calc-tek-fiyat').value)         || 0;
                const c8Fiyat= parseFloat(row.querySelector('.calc-cikis8-fiyat')?.value)    || 0;
                const g2Fiyat= parseFloat(row.querySelector('.calc-giris2030-fiyat')?.value) || 0;
                const mFiyat = parseFloat(row.querySelector('.calc-mesai-fiyat').value)       || 0;

                const vCount  = parseFloat(row.querySelector('.calc-vardiya-count')?.value)  || 0;
                const tCount  = parseFloat(row.querySelector('.calc-tek-count')?.value)       || 0;
                const c8Count = parseFloat(row.querySelector('.calc-cikis8-count')?.value)    || 0;
                const g2Count = parseFloat(row.querySelector('.calc-giris2030-count')?.value) || 0;
                const mCount  = parseFloat(row.querySelector('.calc-mesai-count')?.value)     || 0;

                const kdvOran = parseFloat(row.querySelector('.calc-kdv-oran')?.value) || 0;
                const tevOran = parseFloat(row.querySelector('.calc-tev-oran')?.value) || 0;
                const rowBrut = (vCount*vFiyat)+(tCount*tFiyat)+(c8Count*c8Fiyat)+(g2Count*g2Fiyat)+(mCount*mFiyat);
                const rowKdv  = rowBrut * (kdvOran / 100);
                const rowTev  = rowBrut * (tevOran / 100);
                row.querySelector('.row-toplam').innerText = '₺' + rowBrut.toLocaleString('tr-TR', {minimumFractionDigits:2});
                const kdvEl2 = row.querySelector('.row-kdv-tutar'); if(kdvEl2) kdvEl2.innerText = '+₺' + rowKdv.toLocaleString('tr-TR', {minimumFractionDigits:2});
                const tevEl2 = row.querySelector('.row-tev-tutar'); if(tevEl2) tevEl2.innerText = '-₺' + rowTev.toLocaleString('tr-TR', {minimumFractionDigits:2});
                totalBrut += rowBrut;
                totalKdv  += rowKdv;
                totalTev  += rowTev;
            });

            const manualLines = [];
            overlay.querySelectorAll('.manuel-kalem-row').forEach(row => {
                manualLines.push({
                    tip: row.getAttribute('data-tip'),
                    tutar: parseFloat(row.querySelector('.manuel-tutar')?.value) || 0,
                    kdv_oran: parseFloat(row.querySelector('.manuel-kdv-oran')?.value) || 0,
                    kdv_dahil: row.querySelector('.manuel-kdv-dahil')?.value === 'dahil',
                    tev_oran: parseFloat(row.querySelector('.manuel-tev-oran')?.value) || 0
                });
            });

            // Otomatik bakım/sigorta giderleri (dismiss edilmemişler)
            let autoGiderToplam = 0;
            overlay.querySelectorAll('.auto-gider-row:not([data-dismissed="true"])').forEach(row => {
                autoGiderToplam += parseFloat(row.getAttribute('data-tutar') || 0);
            });

            const totals = window.HakedisCalculations.calculateTotals({
                serviceBrut: totalBrut,
                serviceKdv: totalKdv,
                serviceTev: totalTev,
                yakit: parseFloat(document.getElementById('modal-yakit-total')?.getAttribute('data-val')) || 0,
                autoGider: autoGiderToplam,
                manualLines
            });

            // Auto gider satırı
            const autoGiderRow = document.getElementById('modal-auto-gider-row');
            const autoGiderEl  = document.getElementById('modal-auto-gider');
            if (autoGiderRow) autoGiderRow.style.display = autoGiderToplam > 0 ? 'flex' : 'none';
            if (autoGiderEl)  autoGiderEl.innerText = '-₺' + autoGiderToplam.toLocaleString('tr-TR', {minimumFractionDigits:2});

            const brutEl  = document.getElementById('modal-brut-total');  if(brutEl)  brutEl.innerText  = '₺' + totals.matrah.toLocaleString('tr-TR', {minimumFractionDigits:2});
            const kdvTEl  = document.getElementById('modal-kdv-total');   if(kdvTEl)  kdvTEl.innerText  = (totals.kdv >= 0 ? '+₺' : '-₺') + Math.abs(totals.kdv).toLocaleString('tr-TR', {minimumFractionDigits:2});
            const tevTEl  = document.getElementById('modal-tev-total');   if(tevTEl)  tevTEl.innerText  = (totals.tev >= 0 ? '-₺' : '+₺') + Math.abs(totals.tev).toLocaleString('tr-TR', {minimumFractionDigits:2});

            const netEl = document.getElementById('modal-net-total');
            if (netEl) {
                netEl.innerText = '₺' + totals.net.toLocaleString('tr-TR', {minimumFractionDigits:2});
                netEl.classList.toggle('text-orange-400', totals.net >= 0);
                netEl.classList.toggle('text-red-500', totals.net < 0);
            }
        };

        // === MANUEL KALEM YARDIMCI FONKSİYONLARI ===
        const STORAGE_KEY = `cari_manuel_${arac_id}_${month}`;

        const loadFromStorage = () => {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
        };

        const saveToStorage = () => {
            const kalemler = [];
            overlay.querySelectorAll('.manuel-kalem-row').forEach(row => {
                kalemler.push({
                    id:     row.getAttribute('data-kid'),
                    tip:    row.getAttribute('data-tip'),
                    baslik: row.querySelector('.manuel-baslik').value || '',
                    tutar:  parseFloat(row.querySelector('.manuel-tutar').value) || 0,
                    kdv_oran: parseFloat(row.querySelector('.manuel-kdv-oran')?.value) || 0,
                    kdv_dahil: row.querySelector('.manuel-kdv-dahil')?.value === 'dahil',
                    tev_oran: parseFloat(row.querySelector('.manuel-tev-oran')?.value) || 0
                });
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(kalemler));
            calculateTotals();
        };

        const renderKalemRow = (kalem) => {
            const container = overlay.querySelector('#manuel-kalemler-container');
            const bosMsg    = overlay.querySelector('#manuel-bos-mesaj');
            if (bosMsg) bosMsg.remove();

            const isGelir = kalem.tip === 'gelir';
            const row = document.createElement('div');
            row.className = 'manuel-kalem-row flex flex-wrap items-center gap-2 p-3 rounded-xl border transition-all ' +
                (isGelir
                    ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40'
                    : 'bg-red-500/5   border-red-500/20   hover:border-red-500/40');
            row.setAttribute('data-kid', kalem.id);
            row.setAttribute('data-tip', kalem.tip);
            row.innerHTML = `
                <div class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black ${isGelir ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}">
                    ${isGelir ? '+' : '−'}
                </div>
                <input type="text"
                    placeholder="${isGelir ? 'Gelir başlığı (örn: Ekstra Sefer)' : 'Gider başlığı (örn: Köprü Cezası)'}"
                    class="manuel-baslik flex-1 bg-transparent text-white text-xs font-bold border-none outline-none placeholder-gray-600"
                    value="${String(kalem.baslik || '').replace(/"/g, '&quot;')}"
                />
                <div class="flex items-center gap-1">
                    <span class="text-gray-500 text-xs font-bold">₺</span>
                    <input type="number" step="0.01" min="0" placeholder="0,00"
                        class="manuel-tutar w-28 bg-transparent text-xs font-black border-none outline-none text-right ${isGelir ? 'text-orange-300' : 'text-red-300'}"
                        value="${kalem.tutar || ''}"
                    />
                </div>
                <div class="w-full grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                    <label class="text-[9px] text-gray-500 font-bold uppercase">KDV %
                        <input type="number" min="0" max="100" step="1" class="manuel-kdv-oran mt-1 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white" value="${kalem.kdv_oran || 0}">
                    </label>
                    <label class="text-[9px] text-gray-500 font-bold uppercase">KDV Biçimi
                        <select class="manuel-kdv-dahil mt-1 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white">
                            <option value="haric" ${kalem.kdv_dahil ? '' : 'selected'}>KDV Hariç</option>
                            <option value="dahil" ${kalem.kdv_dahil ? 'selected' : ''}>KDV Dahil</option>
                        </select>
                    </label>
                    <label class="text-[9px] text-gray-500 font-bold uppercase">Tevkifat %
                        <input type="number" min="0" max="100" step="1" class="manuel-tev-oran mt-1 w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white" value="${kalem.tev_oran || 0}">
                    </label>
                </div>
                <button class="manuel-sil-btn flex-shrink-0 p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all" title="Kalemi Sil">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            `;
            row.querySelector('.manuel-baslik').addEventListener('input', saveToStorage);
            row.querySelector('.manuel-tutar').addEventListener('input', saveToStorage);
            row.querySelector('.manuel-kdv-oran').addEventListener('input', saveToStorage);
            row.querySelector('.manuel-kdv-dahil').addEventListener('change', saveToStorage);
            row.querySelector('.manuel-tev-oran').addEventListener('input', saveToStorage);
            row.querySelector('.manuel-sil-btn').addEventListener('click', () => {
                row.style.transition = 'all 0.2s';
                row.style.opacity    = '0';
                row.style.transform  = 'translateX(10px)';
                setTimeout(() => {
                    row.remove();
                    const c = overlay.querySelector('#manuel-kalemler-container');
                    if (c && c.querySelectorAll('.manuel-kalem-row').length === 0) {
                        const msg = document.createElement('p');
                        msg.id        = 'manuel-bos-mesaj';
                        msg.className = 'text-xs text-gray-600 italic text-center py-3';
                        msg.textContent = 'Henüz manuel kalem eklenmedi. Gelir veya gider eklemek için yukarıdaki butonları kullanın.';
                        c.appendChild(msg);
                    }
                    saveToStorage();
                }, 200);
            });
            container.appendChild(row);
        };

        // Kayıtlı kalemleri yükle
        loadFromStorage().forEach(k => renderKalemRow(k));

        // === OTOMATİK BAKAM/SİGORTA GİDERLERİ ===
        const AUTO_DISMISSED_KEY = `cari_auto_dismissed_${arac_id}_${month}`;
        const loadDismissed = () => {
            try { return new Set(JSON.parse(localStorage.getItem(AUTO_DISMISSED_KEY) || '[]')); } catch { return new Set(); }
        };
        const saveDismissed = (set) => {
            localStorage.setItem(AUTO_DISMISSED_KEY, JSON.stringify([...set]));
        };

        const renderAutoGider = (item) => {
            const container = overlay.querySelector('#auto-gider-container');
            if (!container) return;
            const dismissed = loadDismissed();
            const row = document.createElement('div');
            row.className = 'auto-gider-row flex items-center gap-2 p-3 rounded-xl border bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40 transition-all';
            row.setAttribute('data-agid', item.id);
            row.setAttribute('data-tutar', item.tutar || 0);
            if (dismissed.has(item.id)) {
                row.setAttribute('data-dismissed', 'true');
                row.style.opacity = '0.35';
            }
            const isSimulation = !dismissed.has(item.id);
            row.innerHTML = `
                <div class="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black bg-amber-500/20 text-amber-400">−</div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-amber-200 truncate">${item.baslik}</div>
                    <div class="text-[10px] text-gray-500">${item.tarih} &nbsp;·&nbsp; <span class="uppercase tracking-wide">${item.tur}</span></div>
                </div>
                <div class="text-xs font-black text-amber-300 flex-shrink-0">-₺${(item.tutar||0).toLocaleString('tr-TR',{minimumFractionDigits:2})}</div>
                <button class="auto-dismiss-btn flex-shrink-0 p-1.5 rounded-lg transition-all ${dismissed.has(item.id) ? 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30' : 'bg-white/5 text-gray-500 hover:bg-red-500/20 hover:text-red-400'}" title="${dismissed.has(item.id) ? 'Geri Ekle' : 'Gideri Kaldır'}">
                    ${dismissed.has(item.id)
                        ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg>'
                        : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
                    }
                </button>
            `;
            row.querySelector('.auto-dismiss-btn').addEventListener('click', () => {
                const d = loadDismissed();
                if (d.has(item.id)) {
                    d.delete(item.id);
                    row.removeAttribute('data-dismissed');
                    row.style.opacity = '1';
                } else {
                    d.add(item.id);
                    row.setAttribute('data-dismissed', 'true');
                    row.style.opacity = '0.35';
                }
                saveDismissed(d);
                calculateTotals();
                // Dismiss butonu ikonunu ve rengini güncelle
                const newDismissed = d.has(item.id);
                const btn = row.querySelector('.auto-dismiss-btn');
                btn.className = `auto-dismiss-btn flex-shrink-0 p-1.5 rounded-lg transition-all ${newDismissed ? 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30' : 'bg-white/5 text-gray-500 hover:bg-red-500/20 hover:text-red-400'}`;
                btn.title = newDismissed ? 'Geri Ekle' : 'Gideri Kaldır';
                btn.innerHTML = newDismissed
                    ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg>'
                    : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
            });
            container.appendChild(row);
        };

        if (isOzmal) {
            const autoGiderContainer = overlay.querySelector('#auto-gider-container');
            if (otoBakimlar.length === 0 && otoPoliceler.length === 0) {
                if (autoGiderContainer) autoGiderContainer.innerHTML = '<p class="text-xs text-gray-600 italic text-center py-2">Bu ay için bakım/sigorta kaydı bulunmuyor.</p>';
            } else {
                otoBakimlar.forEach(b => renderAutoGider({
                    id:     'bakim_' + b.id,
                    baslik: (b.islem_turu || 'Bakım') + (b.aciklama ? ` — ${b.aciklama}` : ''),
                    tarih:  b.islem_tarihi,
                    tur:    'bakım/tamir',
                    tutar:  b.toplam_tutar || 0
                }));
                otoPoliceler.forEach(p => renderAutoGider({
                    id:     'police_' + p.id,
                    baslik: (p.police_turu || 'Sigorta') + ' Poliçesi',
                    tarih:  p.baslangic_tarihi,
                    tur:    'sigorta',
                    tutar:  p.toplam_tutar || 0
                }));
            }
        }


        // Global: buton onclick'ten çağrılır
        window.addManuelKalem = (tip) => {
            const kalem = { id: Date.now().toString(), tip, baslik: '', tutar: 0, kdv_oran: 0, kdv_dahil: false, tev_oran: 0 };
            renderKalemRow(kalem);
            saveToStorage();
            const allRows = overlay.querySelectorAll('.manuel-kalem-row');
            const lastRow = allRows[allRows.length - 1];
            if (lastRow) lastRow.querySelector('.manuel-baslik')?.focus();
        };

        // Fiyat inputlarına dinleyici ekle ve ilk hesaplamayı çalıştır
        overlay.querySelectorAll('.calc-vardiya-fiyat, .calc-tek-fiyat, .calc-cikis8-fiyat, .calc-giris2030-fiyat, .calc-mesai-fiyat, .calc-kdv-oran, .calc-tev-oran, .calc-vardiya-count, .calc-tek-count, .calc-cikis8-count, .calc-giris2030-count, .calc-mesai-count').forEach(inp => {
            inp.addEventListener('input', () => {
                if (inp.className.includes('-count')) inp.setAttribute('data-override-dirty', 'true');
                calculateTotals();
            });
        });
        calculateTotals();


    } catch (e) {
        console.error(e);
        overlay.innerHTML = `<div class="bg-white p-6 rounded text-red-500 font-bold">Hata oluştu: ${e.message} <button class="ml-4 underline blur-none text-black" onclick="this.parentElement.parentElement.remove()">Kapat</button></div>`;
    }
};



window.saveHakedisFiyatlar = async function(arac_id, btnEl, specificDonem) {
    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
    const overlay = document.getElementById('cari-kart-modal-overlay');
    if (!overlay) return;

    const originalHtml = btnEl.innerHTML;
    btnEl.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Sabredin...';
    btnEl.disabled = true;
    if(window.lucide) window.lucide.createIcons();

    try {
        const rows = overlay.querySelectorAll('.musteri-calc-row');
        const taseronAy = specificDonem || document.getElementById('filter-cari-hakedis-ay')?.value;
        if (!/^\d{4}-\d{2}$/.test(taseronAy || '')) {
            throw new Error('Hakediş kaydı için geçerli bir dönem seçilmelidir.');
        }

        for (const row of rows) {
            // data-mid contains composite key "uuid|||bolge" — extract real musteri_id and bolge
            const rawMid = row.getAttribute('data-mid') || '';
            const midParts = rawMid.split('|||');
            const musteri_id = midParts[0];
            const rowBolge   = midParts[1] || 'Manisa';
            const tk   = parseFloat(row.querySelector('.calc-tek-fiyat')?.value)        || 0;
            const vd   = parseFloat(row.querySelector('.calc-vardiya-fiyat')?.value)    || 0;
            const c8f  = parseFloat(row.querySelector('.calc-cikis8-fiyat')?.value)     || 0;
            const g2f  = parseFloat(row.querySelector('.calc-giris2030-fiyat')?.value)  || 0;
            const mf   = parseFloat(row.querySelector('.calc-mesai-fiyat')?.value)      || 0;
            const kdv_oran = parseFloat(row.querySelector('.calc-kdv-oran')?.value)     || 0;
            const tev_oran = parseFloat(row.querySelector('.calc-tev-oran')?.value)     || 0;
            // Puantaj değeri değiştirilmediyse override üretme; dönem içindeki canlı
            // puantaj hesaplaması kullanılmaya devam etsin.
            const readOverride = selector => {
                const input = row.querySelector(selector);
                if (!input) return null;
                const current = parseFloat(input.value);
                const puantaj = parseFloat(input.getAttribute('data-puantaj'));
                const hadPeriodOverride = input.getAttribute('data-period-override') === 'true';
                const changedInModal = input.getAttribute('data-override-dirty') === 'true';
                if (isNaN(current)) return null;
                return current === puantaj && (!hadPeriodOverride || changedInModal) ? null : current;
            };
            const ov  = readOverride('.calc-vardiya-count');
            const ot  = readOverride('.calc-tek-count');
            const oc8 = readOverride('.calc-cikis8-count');
            const og2 = readOverride('.calc-giris2030-count');
            const om  = readOverride('.calc-mesai-count');

            // Sutun hatasi kontrolcu (schema cache veya eksik kolon)
            const isColErr = (e) => e && e.message && (
                e.message.toLowerCase().includes('column') ||
                e.message.toLowerCase().includes('does not exist') ||
                e.message.toLowerCase().includes('schema cache')
            );

            // Kademeli payload (bazi tablolarda kdv/tev veya dikkan alanlari olmayabilir)
            // 1. tam, 2. kdv/tev'siz, 3. sadece temel
            const payloads = [
                { tek_fiyat: tk, vardiya_fiyat: vd, cikis_8_fiyat: c8f, giris_2030_fiyat: g2f, mesai_fiyat: mf, kdv_oran, tev_oran, tarife_turu: 'Vardiya',
                  override_vardiya: ov, override_tek: ot, override_cikis_8: oc8, override_giris_2030: og2, override_mesai: om },
                { tek_fiyat: tk, vardiya_fiyat: vd, cikis_8_fiyat: c8f, giris_2030_fiyat: g2f, mesai_fiyat: mf, kdv_oran, tev_oran, tarife_turu: 'Vardiya' },
                { tek_fiyat: tk, vardiya_fiyat: vd, cikis_8_fiyat: c8f, giris_2030_fiyat: g2f, mesai_fiyat: mf, tarife_turu: 'Vardiya' },
                { tek_fiyat: tk, vardiya_fiyat: vd, mesai_fiyat: mf, tarife_turu: 'Vardiya' }
            ];

            // Yalnızca seçili dönemin tam kaydını güncelle. Global fiyat fallback kaydı
            // hiçbir zaman dönemsel override hedefi değildir.
            let existingList = null;
            try {
                const { data: d1, error: d1Error } = await window.supabaseClient
                    .from('musteri_arac_tanimlari')
                    .select('id, donem, bolge')
                    .eq('arac_id', arac_id)
                    .eq('musteri_id', musteri_id)
                    .eq('bolge', rowBolge)
                    .eq('donem', taseronAy);
                if (d1Error) throw d1Error;
                existingList = d1;
            } catch(queryError) {
                if (!isColErr(queryError)) throw queryError;
                // bolge kolonu henüz yoksa bolgesiz sorgula
                const { data: d2, error: d2Error } = await window.supabaseClient
                    .from('musteri_arac_tanimlari')
                    .select('id, donem')
                    .eq('arac_id', arac_id)
                    .eq('musteri_id', musteri_id)
                    .eq('donem', taseronAy);
                if (d2Error) throw d2Error;
                existingList = d2;
            }

            const existing = existingList?.find(e => e.donem === taseronAy);

            if (existing) {
                // ID uzerinden direkt guncelle - en dolu payload'dan basla
                // ⭐ bolge'yi de rowBolge olarak set et (Dikkan için Manisa→İzmir güncellemesi)
                let saved = false;
                for (const payload of payloads) {
                    const updatePayload = { ...payload, bolge: rowBolge, donem: taseronAy };
                    let { error: updErr } = await window.supabaseClient
                        .from('musteri_arac_tanimlari')
                        .update(updatePayload)
                        .eq('id', existing.id);
                    if (!updErr) { saved = true; break; }
                    // bolge kolonu güncelleme hatası → bolge'siz dene
                    if (isColErr(updErr)) {
                        const { error: updErr2 } = await window.supabaseClient
                            .from('musteri_arac_tanimlari')
                            .update(payload)
                            .eq('id', existing.id);
                        if (!updErr2) { saved = true; break; }
                        if (!isColErr(updErr2)) throw updErr2;
                    } else {
                        throw updErr;
                    }
                }
                if (!saved) throw new Error('Fiyatlar kaydedilemedi.');
            } else {
                // Hic kayit yok, yeni olustur - bolge dahil payload
                let saved = false;
                for (const payload of payloads) {
                    // Önce bolge ile insert dene, hata alırsan bolgesiz dene
                    const { error: insErr } = await window.supabaseClient
                        .from('musteri_arac_tanimlari')
                        .insert([{ arac_id, musteri_id, bolge: rowBolge, donem: taseronAy || null, ...payload }]);
                    if (!insErr) { saved = true; break; }
                    if (isColErr(insErr)) {
                        // bolge kolonu yoksa bolgesiz dene
                        const { error: insErr2 } = await window.supabaseClient
                            .from('musteri_arac_tanimlari')
                            .insert([{ arac_id, musteri_id, donem: taseronAy || null, ...payload }]);
                        if (!insErr2) { saved = true; break; }
                        if (insErr2.message?.includes('duplicate')) { saved = true; break; }
                        if (!isColErr(insErr2)) throw insErr2;
                    } else {
                        throw insErr;
                    }
                }
                if (!saved) throw new Error('Fiyat kaydi eklenemedi.');
            }
        }
        
        if (window.Toast) { 
            window.Toast.success('Fiyatlar başarıyla güncellendi. Liste yenileniyor...'); 
        } else { 
            const toast = document.createElement('div');
            toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:10000;padding:12px 20px;border-radius:10px;background:rgba(22,163,74,0.92);color:white;font-size:0.8rem;font-weight:700;box-shadow:0 8px 30px rgba(0,0,0,0.25);backdrop-filter:blur(8px);`;
            toast.textContent = `✓ Fiyatlar başarıyla güncellendi. Liste yenileniyor...`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        // Tabloyu ve başlıkları güncelle
        if (typeof fetchTaseronFinans === 'function') {
            await fetchTaseronFinans();
        }

        // Modal kapatılıyor
        if (overlay) overlay.remove();

    } catch (error) {
        console.error("Fiyat Kaydetme Hatası:", error);
        alert("Kaydedilemedi: " + (error.message || error.details || "Bilinmeyen hata"));
    } finally {
        btnEl.innerHTML = originalHtml;
        btnEl.disabled = false;
        if(window.lucide) window.lucide.createIcons();
    }
};

async function fetchSoforPuantaj() {
    const tbody = document.getElementById('sofor-puantaj-tbody');
    const thead = document.querySelector('#sofor-puantaj-table thead');
    if (!tbody || !thead) return;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

        // Ay filtresini al
        let filterVal = document.getElementById('filter-puantaj-ay')?.value;
        if (!filterVal) {
            filterVal = new Date().toISOString().slice(0, 7);
            if (document.getElementById('filter-puantaj-ay')) document.getElementById('filter-puantaj-ay').value = filterVal;
        }

        const [year, month] = filterVal.split('-');
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        const startDate = `${year} -${month}-01`;
        const endDate = `${year} -${month} -${daysInMonth} `;

        // Verileri Çek
        const [
            { data: soforler },
            { data: puantajlar }
        ] = await Promise.all([
            window.supabaseClient.from('soforler').select('id, ad_soyad').order('ad_soyad'),
            window.supabaseClient.from('sofor_puantaj').select('*').gte('tarih', startDate).lte('tarih', endDate)
        ]);

        // Table Header (Günler)
        let headerHtml = `< tr > <th class="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider sticky left-0 bg-[#1a1c1e] z-10 w-48">Şoför / Günler</th>`;
        for (let i = 1; i <= daysInMonth; i++) {
            headerHtml += `< th class="px-2 py-3 text-center text-[10px] font-bold text-gray-500 border-l border-white/5 w-8" > ${i}</th > `;
        }
        headerHtml += `</tr > `;
        thead.innerHTML = headerHtml;

        // Table Body
        tbody.innerHTML = '';
        if (!soforler || soforler.length === 0) {
            tbody.innerHTML = `< tr > <td colspan="${daysInMonth + 1}" class="px-6 py-8 text-center text-sm text-gray-500 italic">Şoför bulunamadı.</td></tr > `;
            return;
        }

        soforler.forEach(s => {
            let rowHtml = `< td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-white sticky left-0 bg-[#1a1c1e] z-10 border-r border-white/10" > ${s.ad_soyad}</td > `;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year} -${month} -${String(day).padStart(2, '0')} `;
                const p = puantajlar.find(item => item.sofor_id === s.id && item.tarih === dateStr);

                let cellContent = '';
                let cellClass = 'bg-transparent';

                if (p) {
                    if (p.durum === 'ÇALIŞTI') {
                        cellContent = 'Ç';
                        cellClass = 'bg-cyan-500/20 text-cyan-600 font-bold';
                    } else if (p.durum === 'İZİNLİ') {
                        cellContent = 'İ';
                        cellClass = 'bg-blue-500/20 text-blue-500 font-bold';
                    } else if (p.durum === 'RAPORLU') {
                        cellContent = 'R';
                        cellClass = 'bg-orange-500/20 text-orange-500 font-bold';
                    } else {
                        cellContent = 'D';
                        cellClass = 'bg-red-500/20 text-red-500 font-bold';
                    }
                } else {
                    cellContent = '-';
                    cellClass = 'text-gray-700';
                }

                rowHtml += `<td class="px-1 py-3 text-center text-xs border-l border-white/5 cursor-pointer hover:bg-white/5 ${cellClass}"
                onclick="openModal('Yeni Puantaj Gir', '${s.id}', '${dateStr}')">
                    ${cellContent}
                            </td>`;
            }

            const tr = document.createElement('tr');
            tr.className = "border-b border-white/5";
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Puantaj hatası:", e);
    }
}

async function fetchMusteriler() {
    const grid = document.getElementById('musteri-cards-grid');
    const tableBody = document.getElementById('factory-list-tbody');
    if (!grid) return;

    const loadingState = `<div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Fabrikalar yükleniyor...</p></div></div>`;
    grid.innerHTML = loadingState;
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6">${loadingState}</td></tr>`;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        
        // Müşterileri çek
        const { data: must, error: mErr } = await window.supabaseClient
            .from('musteriler')
            .select('*')
            .order('olusturulma_tarihi', { ascending: false });

        if (mErr) throw mErr;

        // Atamaları PAGINATED çek (1000 sınırı aşmak için)
        let tanimlar = [];
        let rangeFrom = 0;
        const rangeStep = 1000;
        
        while (true) {
            const { data: part, error: tErr } = await window.supabaseClient
                .from('musteri_arac_tanimlari')
                .select('*, araclar(id, plaka)')
                .order('id', { ascending: true })
                .range(rangeFrom, rangeFrom + rangeStep - 1);
            
            if (tErr) {
                console.error('Tanimlar fetch error at range', rangeFrom, tErr);
                break;
            }
            
            if (!part || part.length === 0) break;
            
            tanimlar = tanimlar.concat(part);
            if (part.length < rangeStep) break;
            rangeFrom += rangeStep;
        }

        console.log(`[fetchMusteriler] Müşteriler: ${must?.length || 0}, Toplam Atamalar: ${tanimlar?.length || 0}`);

        // Populate legacy table if exists
        const legacyTbody = document.getElementById('musteri-list-tbody');
        if (legacyTbody) {
            legacyTbody.innerHTML = '';
            (must || []).forEach(m => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${m.ad || m.unvan}</td><td>${m.yetkili_kisi_ad_soyad || '-'}</td><td>${m.vergi_no_daire || '-'}</td><td>${m.vade_gun || '-'} Gün</td>`;
                legacyTbody.appendChild(tr);
            });
        }

        // Populate the puantaj select
        const selectEl = document.getElementById('excel-musteri-sec');
        if (selectEl) {
            selectEl.innerHTML = '<option value="">— Fabrika / Müşteri Seç —</option>';
            (must || []).forEach(m => {
                selectEl.innerHTML += `<option value="${m.id}">${m.ad || m.unvan}</option>`;
            });
        }

        if (!must || must.length === 0) {
            const emptyState = `<div class="factory-empty-state"><span class="factory-state-icon"><i data-lucide="factory"></i></span><strong>Henüz fabrika kaydı yok</strong><p>İlk operasyon noktasını ekleyerek araç ve puantaj yönetimine başlayın.</p><button onclick="openModal('Yeni Müşteri Ekle')" class="btn-primary"><i data-lucide="plus"></i>Fabrika Ekle</button></div>`;
            grid.innerHTML = emptyState;
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="6">${emptyState}</td></tr>`;
            ['factory-kpi-total', 'factory-kpi-assigned', 'factory-kpi-vehicles', 'factory-kpi-unassigned', 'factory-visible-count'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '0';
            });
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Group tanimlar by musteri_id
        const tanimMap = {};
        (tanimlar || []).forEach(t => {
            if (!tanimMap[t.musteri_id]) tanimMap[t.musteri_id] = [];
            tanimMap[t.musteri_id].push(t);
        });

        const assignedFactoryCount = (must || []).filter(m => (tanimMap[m.id] || []).length > 0).length;
        const uniqueVehicleCount = new Set((tanimlar || []).map(t => t.arac_id).filter(Boolean)).size;
        const kpiValues = {
            'factory-kpi-total': must.length,
            'factory-kpi-assigned': assignedFactoryCount,
            'factory-kpi-vehicles': uniqueVehicleCount,
            'factory-kpi-unassigned': must.length - assignedFactoryCount,
            'factory-visible-count': must.length
        };
        Object.entries(kpiValues).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });

        grid.innerHTML = '';
        if (tableBody) tableBody.innerHTML = '';

        must.forEach(m => {
            const factoryName = m.ad || m.unvan || 'İsimsiz Fabrika';
            const initials = factoryName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
            const araclar = tanimMap[m.id] || [];
            const regions = [...new Set(araclar.map(t => t.bolge).filter(Boolean))];
            const tariffTypes = [...new Set(araclar.map(t => t.tarife_turu).filter(Boolean))];
            const regionLabel = regions.length ? regions.join(', ') : 'Bölge belirtilmemiş';
            const operationLabel = tariffTypes.length ? tariffTypes.join(', ') : 'Servis tanımı yok';
            const contactName = m.yetkili_kisi_ad_soyad || 'Yetkili belirtilmemiş';

            const buildAracChip = (t) => {
                const plaka = t.araclar?.plaka || 'Bilinmiyor';
                return `<span class="factory-vehicle-chip"><span>${plaka}</span><button onclick="deleteRecord('musteri_arac_tanimlari','${t.id}','fetchMusteriler')" title="${plaka} atamasını kaldır" aria-label="${plaka} atamasını kaldır"><i data-lucide="x"></i></button></span>`;
            };

            const card = document.createElement('div');
            card.className = 'factory-card';
            card.setAttribute('data-musteri-id', m.id);
            card.dataset.filterable = 'true';
            card.dataset.filterSearch = [factoryName, contactName, m.telefon, m.adres, regionLabel, operationLabel].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
            card.dataset.filterRegion = regions.join(' ').toLocaleLowerCase('tr-TR');
            card.dataset.filterAssignment = araclar.length ? 'assigned' : 'unassigned';
            card.dataset.filterTariff = tariffTypes.join(' ').toLocaleLowerCase('tr-TR');

            card.innerHTML = `
                <div class="factory-card-head">
                    <div class="factory-card-identity">
                        <span class="factory-avatar">${m.logo_url ? `<img src="${m.logo_url}" alt="" onerror="this.parentElement.textContent='${initials}'">` : initials}</span>
                        <div><h3>${factoryName}</h3><p>${contactName}</p></div>
                    </div>
                    <span class="${araclar.length ? 'badge-success' : 'badge-warning'}">${araclar.length ? 'Araç tanımlı' : 'Atama bekliyor'}</span>
                </div>
                <div class="factory-card-details">
                    <div><span><i data-lucide="map-pin"></i>Bölge</span><strong>${regionLabel}</strong></div>
                    <div><span><i data-lucide="route"></i>Servisler</span><strong>${tariffTypes.length ? `${tariffTypes.length} tanım · ${operationLabel}` : operationLabel}</strong></div>
                    <div><span><i data-lucide="phone"></i>Telefon</span><strong>${m.telefon || 'Belirtilmemiş'}</strong></div>
                </div>
                <div class="factory-vehicle-disclosure">
                    <button onclick="toggleMusteriAraclar(this)">
                        <span><i data-lucide="bus-front"></i>Atanan araçlar <b>${araclar.length}</b></span><i data-lucide="chevron-down" class="musteri-arac-chevron"></i>
                    </button>
                    <div class="musteri-arac-panel hidden">
                        <div class="factory-vehicle-list">${araclar.length ? araclar.map(buildAracChip).join('') : '<p>Henüz araç atanmamış.</p>'}</div>
                        <div class="factory-assignment-actions">
                            <button onclick="openMusteriAracTanim('${m.id}','${factoryName}')"><i data-lucide="plus"></i>Ekle</button>
                            <button onclick="window.openTopluAracEkle('${m.id}','${factoryName}')"><i data-lucide="list-plus"></i>Toplu ekle</button>
                            <button class="is-danger" onclick="window.openTopluAracSil('${m.id}','${factoryName}')"><i data-lucide="trash-2"></i>Toplu sil</button>
                        </div>
                    </div>
                </div>
                <div class="factory-card-actions">
                    <button onclick="openPuantajForMusteri('${m.id}')"><i data-lucide="table-2"></i>Puantaj</button>
                    <button onclick="openModal('Müşteri Güncelle', '${m.id}')"><i data-lucide="pencil"></i>Düzenle</button>
                    <button class="is-danger" onclick="deleteRecord('musteriler','${m.id}','fetchMusteriler')"><i data-lucide="trash-2"></i>Sil</button>
                </div>
            `;
            grid.appendChild(card);

            if (tableBody) {
                const row = document.createElement('tr');
                row.dataset.filterable = 'true';
                row.dataset.filterSearch = [factoryName, contactName, m.telefon, m.adres, regionLabel, operationLabel].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
                row.dataset.filterRegion = regions.join(' ').toLocaleLowerCase('tr-TR');
                row.dataset.filterAssignment = araclar.length ? 'assigned' : 'unassigned';
                row.dataset.filterTariff = tariffTypes.join(' ').toLocaleLowerCase('tr-TR');
                row.innerHTML = `
                    <td><div class="factory-identity"><span class="factory-avatar">${m.logo_url ? `<img src="${m.logo_url}" alt="" onerror="this.parentElement.textContent='${initials}'">` : initials}</span><div><strong>${factoryName}</strong><span>${m.adres || 'Adres belirtilmemiş'}</span></div></div></td>
                    <td><div class="factory-contact"><strong>${contactName}</strong><span>${m.telefon || 'Telefon belirtilmemiş'}</span></div></td>
                    <td><span class="factory-region"><i data-lucide="map-pin"></i>${regionLabel}</span><small>${tariffTypes.length ? `${tariffTypes.length} servis tanımı · ${operationLabel}` : operationLabel}</small></td>
                    <td><details class="factory-table-vehicles"><summary><i data-lucide="bus-front"></i>${araclar.length} araç</summary><div>${araclar.length ? araclar.map(buildAracChip).join('') : '<p>Henüz araç atanmamış.</p>'}<button class="factory-inline-action" onclick="openMusteriAracTanim('${m.id}','${factoryName}')"><i data-lucide="plus"></i>Araç ekle</button></div></details></td>
                    <td><span class="${araclar.length ? 'badge-success' : 'badge-warning'}">${araclar.length ? 'Araç tanımlı' : 'Atama bekliyor'}</span></td>
                    <td><div class="factory-row-actions"><button onclick="openPuantajForMusteri('${m.id}')" title="Puantajı aç" aria-label="${factoryName} puantajını aç"><i data-lucide="table-2"></i></button><button onclick="openModal('Müşteri Güncelle', '${m.id}')" title="Düzenle" aria-label="${factoryName} kaydını düzenle"><i data-lucide="pencil"></i></button><button class="is-danger" onclick="deleteRecord('musteriler','${m.id}','fetchMusteriler')" title="Sil" aria-label="${factoryName} kaydını sil"><i data-lucide="trash-2"></i></button></div></td>`;
                tableBody.appendChild(row);
            }
        });

        if (typeof window.filterFactoryTable === 'function') window.filterFactoryTable();

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error(e);
        const errorState = `<div class="factory-error-state"><span class="factory-state-icon"><i data-lucide="triangle-alert"></i></span><strong>Fabrika verileri yüklenemedi</strong><p>${e.message}</p><button onclick="fetchMusteriler()" class="btn-secondary"><i data-lucide="refresh-cw"></i>Tekrar dene</button></div>`;
        grid.innerHTML = errorState;
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6">${errorState}</td></tr>`;
        if (window.lucide) window.lucide.createIcons();
    }
}

window.filterFactoryTable = function () {
    const normalize = value => String(value || '').trim().toLocaleLowerCase('tr-TR');
    const query = normalize(document.getElementById('factory-filter-search')?.value);
    const region = normalize(document.getElementById('factory-filter-region')?.value);
    const assignment = document.getElementById('factory-filter-assignment')?.value || '';
    const tariff = normalize(document.getElementById('factory-filter-tariff')?.value);
    let visible = 0;

    document.querySelectorAll('#factory-list-tbody tr[data-filterable="true"]').forEach(row => {
        const show = (!query || row.dataset.filterSearch.includes(query)) &&
            (!region || row.dataset.filterRegion.includes(region)) &&
            (!assignment || row.dataset.filterAssignment === assignment) &&
            (!tariff || row.dataset.filterTariff.includes(tariff));
        row.hidden = !show;
        if (show) visible += 1;
    });
    document.querySelectorAll('#musteri-cards-grid [data-filterable="true"]').forEach(card => {
        const show = (!query || card.dataset.filterSearch.includes(query)) &&
            (!region || card.dataset.filterRegion.includes(region)) &&
            (!assignment || card.dataset.filterAssignment === assignment) &&
            (!tariff || card.dataset.filterTariff.includes(tariff));
        card.hidden = !show;
    });

    const count = document.getElementById('factory-visible-count');
    if (count) count.textContent = visible;
};

window.clearFactoryFilters = function () {
    ['factory-filter-search', 'factory-filter-region', 'factory-filter-assignment', 'factory-filter-tariff'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.value = '';
    });
    window.filterFactoryTable();
};

window.toggleMusteriAraclar = function (btn) {
    const panel = btn.nextElementSibling;
    const chevron = btn.querySelector('.musteri-arac-chevron');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (chevron) chevron.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
    if (window.lucide) window.lucide.createIcons();
};

window.openPuantajForMusteri = function (musteriId) {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const url = `puantaj.html?musteri_id=${musteriId}&ay=${currentMonth}`;
    window.open(url, `Puantaj_${musteriId}`, 'width=1500,height=850,center=1,titlebar=1,resizable=1,scrollbars=1');
};

window.openMusteriAracTanim = function (musteriId, musteriAdi) {
    // Pre-fill the modal with the customer
    openModal('Müşteriye Araç Tanımla');
    setTimeout(() => {
        const sel = document.getElementById('tanim-musteri');
        if (sel) sel.value = musteriId;
    }, 100);
};

window.excelPrevMonth = function () {
    const el = document.getElementById('excel-ay-sec');
    if (!el || !el.value) return;
    const [y, m] = el.value.split('-').map(Number);
    const d = new Date(y, m - 2);
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

window.excelNextMonth = function () {
    const el = document.getElementById('excel-ay-sec');
    if (!el || !el.value) return;
    const [y, m] = el.value.split('-').map(Number);
    const d = new Date(y, m);
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

window.loadExcelMusteriler = async function () {
    const tbody = document.getElementById('excel-tbody') || document.createElement('tbody');
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        const { data: must, error } = await window.supabaseClient.from('musteriler').select('*').order('unvan');

        if (error) throw error;
        tbody.innerHTML = '';

        const selectEl = document.getElementById('excel-musteri-sec');
        if (selectEl) selectEl.innerHTML = '<option value="">-- Müşteri Seç --</option>';

        if (must && must.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-sm text-gray-500">Kayıtlı müşteri bulunmuyor.</td></tr>';
            return;
        }
    } catch (err) { console.error(err); }
};

// ============================================
// TOPLU ARAÇ EKLEME
// ============================================
window.openTopluAracEkle = function (musteriId, musteriAdi) {
    // If we have an existing openTopluAracModal, clear its state
    const overlay = document.createElement('div');
    overlay.id = "toplu-arac-modal-overlay";
    overlay.className = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto pt-20 pb-20";
    
    // We fetch araclar here directly
    overlay.innerHTML = `
        <div class="ios-modal-sheet bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl relative animate-scaleIn">
            <div class="ios-modal-header p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div>
                    <h2 class="text-lg font-black text-white uppercase tracking-wider">Toplu Araç Tanımlama</h2>
                    <p class="text-xs text-gray-500 mt-1">${musteriAdi} Müşterisine/Fabrikasına Araç Ata</p>
                </div>
                <button onclick="document.getElementById('toplu-arac-modal-overlay').remove()" class="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">✕</button>
            </div>
            
            <div class="ios-modal-body p-6">
                <!-- Üst Kontroller -->
                <div class="flex gap-4 mb-6">
                    <div class="flex-1">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Plaka Ara</label>
                        <input type="text" id="toplu-arac-search" onkeyup="window.filterTopluAraclar()" placeholder="Plaka girin..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all">
                    </div>
                    <div class="flex items-end pb-0.5">
                        <div class="px-4 py-3 rounded-xl border text-[11px] font-bold leading-tight text-center ${musteriAdi.toUpperCase().includes('DİKKAN') || musteriAdi.toUpperCase().includes('DIKKAN') ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'}">
                            ${musteriAdi.toUpperCase().includes('DİKKAN') || musteriAdi.toUpperCase().includes('DIKKAN')
                                ? '✨ Dikkan — Tek · Vardiya · Mesai<br>8 Çıkışı · 20:30 Girişi<br><span class="opacity-70">Puantaj açınca otomatik</span>'
                                : '✓ Standart Fabrika<br>Vardiya + Tek<br><span class="opacity-70">Puantaj açınca otomatik</span>'
                            }
                        </div>
                    </div>
                </div>


                <!-- Araç Seçim Listesi -->
                <div class="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                    <div class="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                        <h3 class="text-xs font-bold text-white uppercase tracking-widest">Araç Kayıtları</h3>
                        <div class="flex gap-3 text-[10px] font-bold">
                            <button onclick="document.querySelectorAll('.toplu-arac-cb').forEach(cb=>cb.checked=true)" class="text-blue-400 hover:text-blue-300">Tümünü Seç</button>
                            <span class="text-gray-600">|</span>
                            <button onclick="document.querySelectorAll('.toplu-arac-cb').forEach(cb=>cb.checked=false)" class="text-gray-500 hover:text-gray-400">Temizle</button>
                        </div>
                    </div>
                    
                    <div class="max-h-[400px] overflow-y-auto p-4 custom-scrollbar" id="toplu-arac-list">
                        <div class="animate-pulse flex items-center justify-center p-8 text-sm text-gray-500">Araçlar yükleniyor...</div>
                    </div>
                </div>
            </div>

            <div class="ios-modal-footer p-5 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                <button onclick="document.getElementById('toplu-arac-modal-overlay').remove()" class="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/20">İptal</button>
                <button onclick="kaydetTopluAraclar('${musteriId}')" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-black text-sm shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                    <i data-lucide="save" class="w-4 h-4"></i>
                    Seçili Araçları Kaydet
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if(window.lucide) window.lucide.createIcons();

    // Fetch araclar list
    window.supabaseClient.from('araclar').select('id, plaka, marka_model, mulkiyet_durumu').order('plaka').then(res => {
        const listDiv = document.getElementById('toplu-arac-list');
        if(!listDiv) return;
        
        if(res.error || !res.data || res.data.length === 0) {
            listDiv.innerHTML = '<div class="text-center p-8 text-red-400 text-sm">Araç bilgileri alınamadı.</div>';
            return;
        }

        const araclar = res.data;
        listDiv.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' + araclar.map(a => `
            <label class="toplu-arac-item flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-white/20 bg-white/5 cursor-pointer transition-colors group">
                <input type="checkbox" class="toplu-arac-cb w-4 h-4 rounded bg-black/50 border-white/20 text-orange-500 focus:ring-orange-500/50 focus:ring-offset-gray-900" value="${a.id}">
                <div>
                    <div class="plaka-text font-bold text-white text-sm">${a.plaka}</div>
                    <div class="text-[10px] text-gray-500 uppercase">${a.marka_model||'-'} <span class="opacity-50">(${a.mulkiyet_durumu})</span></div>
                </div>
            </label>
        `).join('') + '</div>';
    });
};

window.filterTopluAraclar = function() {
    const term = document.getElementById('toplu-arac-search')?.value.toUpperCase() || '';
    document.querySelectorAll('.toplu-arac-item').forEach(lbl => {
        const plaka = lbl.querySelector('.plaka-text')?.innerText.toUpperCase() || '';
        if (plaka.includes(term)) lbl.style.display = 'flex';
        else lbl.style.display = 'none';
    });
};

window.kaydetTopluAraclar = async function(musteriId) {
    const checked = Array.from(document.querySelectorAll('.toplu-arac-cb:checked')).map(cb => cb.value);
    if(checked.length === 0) {
        if(window.Toast) window.Toast.error("Lütfen en az bir araç seçin.");
        else alert("Lütfen en az bir araç seçin.");
        return;
    }

    // Musteri adi verilmedi ise DB'den musteri adini al (fabrika tespiti icin)
    // musteriId zaten elimizde, musteriAdi'ni overlay'den aliyoruz
    const musteriAdiText = document.querySelector('#toplu-arac-modal-overlay p.text-xs')?.textContent || '';
    const isDikkan = musteriAdiText.toUpperCase().includes('DİKKAN') || musteriAdiText.toUpperCase().includes('DIKKAN');
    // Dikkan: 'Tek' (puantaj acildiginda 5 satir otomatik goster)
    // Diger fabrikalar: 'Vardiya' (puantaj acildiginda 2 satir: vardiya + tek)
    const tur = isDikkan ? 'Tek' : 'Vardiya';

    try {
        const payload = checked.map(aracId => ({
            musteri_id: musteriId,
            arac_id: aracId,
            tarife_turu: tur,
            tek_fiyat: 0,
            vardiya_fiyat: 0
        }));

        // Upsert format might fail on duplicate, so standard insert with ignore duplicates is better.
        // We do insert with onConflict not supported easily in pure js client w/o setup, so we handle standard error or check first
        // Simple approach: try to insert all, if fails, tell user some might be duplicates, but supabase bulk insert fails completely if 1 dup.
        // Let's get existing first
        const { data: existing } = await window.supabaseClient.from('musteri_arac_tanimlari').select('arac_id').eq('musteri_id', musteriId);
        const existingIds = (existing||[]).map(e => e.arac_id);
        
        const toInsert = payload.filter(p => !existingIds.includes(p.arac_id));
        
        if(toInsert.length > 0) {
            const { error } = await window.supabaseClient.from('musteri_arac_tanimlari').insert(toInsert);
            if(error) throw error;
        }

        if(window.Toast) window.Toast.success(`${toInsert.length} adet araç başarıyla atandı.`);
        else alert(`${toInsert.length} adet araç başarıyla atandı.`);
        
        document.getElementById('toplu-arac-modal-overlay').remove();
        if(typeof window.fetchMusteriler==='function') window.fetchMusteriler();
        
    } catch(e) {
        console.error("Toplu Kayıt Hatası:", e);
        if(window.Toast) window.Toast.error("Kayıt hatası: " + e.message);
        else alert("Kayıt hatası: " + e.message);
        btn.innerHTML = origHtml;
        btn.disabled = false;
        if(window.lucide) window.lucide.createIcons();
    }
};

// ============================================
// TOPLU ARAÇ SİLME
// ============================================
window.openTopluAracSil = function (musteriId, musteriAdi) {
    const overlay = document.createElement('div');
    overlay.id = "toplu-arac-sil-modal-overlay";
    overlay.className = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto pt-20 pb-20";
    
    overlay.innerHTML = `
        <div class="ios-modal-sheet bg-gray-900 border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl relative animate-scaleIn">
            <div class="ios-modal-header p-5 border-b border-white/10 flex justify-between items-center bg-black/20">
                <div>
                    <h2 class="text-lg font-black text-white uppercase tracking-wider text-red-500">Toplu Araç Silme</h2>
                    <p class="text-xs text-gray-500 mt-1">${musteriAdi} Müşterisinden Araçları Çıkar</p>
                </div>
                <button onclick="document.getElementById('toplu-arac-sil-modal-overlay').remove()" class="text-gray-500 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">✕</button>
            </div>
            
            <div class="ios-modal-body p-6">
                <!-- Üst Kontroller -->
                <div class="flex gap-4 mb-6">
                    <div class="flex-1">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Plaka Ara</label>
                        <input type="text" id="toplu-sil-search" onkeyup="window.filterTopluSilAraclar()" placeholder="Plaka girin..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 transition-all">
                    </div>
                </div>

                <!-- Araç Seçim Listesi -->
                <div class="border border-white/10 rounded-xl overflow-hidden bg-black/20">
                    <div class="flex items-center justify-between p-3 border-b border-white/10 bg-white/5">
                        <h3 class="text-xs font-bold text-white uppercase tracking-widest">Atanmış Araçlar</h3>
                        <div class="flex gap-3 text-[10px] font-bold">
                            <button onclick="document.querySelectorAll('.toplu-sil-cb').forEach(cb=>cb.checked=true)" class="text-blue-400 hover:text-blue-300">Tümünü Seç</button>
                            <span class="text-gray-600">|</span>
                            <button onclick="document.querySelectorAll('.toplu-sil-cb').forEach(cb=>cb.checked=false)" class="text-gray-500 hover:text-gray-400">Temizle</button>
                        </div>
                    </div>
                    
                    <div class="max-h-[400px] overflow-y-auto p-4 custom-scrollbar" id="toplu-sil-list">
                        <div class="animate-pulse flex items-center justify-center p-8 text-sm text-gray-500">Araçlar yükleniyor...</div>
                    </div>
                </div>
            </div>

            <div class="ios-modal-footer p-5 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                <button onclick="document.getElementById('toplu-arac-sil-modal-overlay').remove()" class="px-6 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-white/20">İptal</button>
                <button onclick="silTopluAraclar('${musteriId}')" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black text-sm shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-500/50">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                    Seçili Araçları Sil
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if(window.lucide) window.lucide.createIcons();

    // Fetch currently assigned vehicles
    window.supabaseClient
        .from('musteri_arac_tanimlari')
        .select(`
            id,
            arac_id,
            araclar ( id, plaka, marka_model, mulkiyet_durumu )
        `)
        .eq('musteri_id', musteriId)
        .then(res => {
            const listDiv = document.getElementById('toplu-sil-list');
            if(!listDiv) return;
            
            if(res.error || !res.data || res.data.length === 0) {
                listDiv.innerHTML = '<div class="text-center p-8 text-gray-500 text-sm">Bu müşteriye atanmış araç bulunamadı.</div>';
                return;
            }

            // sort by plaka
            const data = res.data.sort((a,b) => {
                const pa = a.araclar ? a.araclar.plaka : '';
                const pb = b.araclar ? b.araclar.plaka : '';
                return pa.localeCompare(pb);
            });

            listDiv.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3">' + data.map(item => {
                const a = item.araclar || {};
                return `
                <label class="toplu-sil-item flex items-center gap-3 p-3 rounded-xl border border-white/5 hover:border-red-500/30 bg-white/5 hover:bg-red-500/5 cursor-pointer transition-colors group">
                    <input type="checkbox" class="toplu-sil-cb w-4 h-4 rounded bg-black/50 border-white/20 text-red-500 focus:ring-red-500/50 focus:ring-offset-gray-900" value="${item.arac_id}">
                    <div>
                        <div class="plaka-text font-bold text-white text-sm">${a.plaka || 'Bilinmeyen'}</div>
                        <div class="text-[10px] text-gray-500 uppercase">${a.marka_model||'-'} <span class="opacity-50">(${a.mulkiyet_durumu || '-'})</span></div>
                    </div>
                </label>
                `;
            }).join('') + '</div>';
        });
};

window.filterTopluSilAraclar = function() {
    const term = document.getElementById('toplu-sil-search')?.value.toUpperCase() || '';
    document.querySelectorAll('.toplu-sil-item').forEach(lbl => {
        const plaka = lbl.querySelector('.plaka-text')?.innerText.toUpperCase() || '';
        if (plaka.includes(term)) lbl.style.display = 'flex';
        else lbl.style.display = 'none';
    });
};

window.silTopluAraclar = async function(musteriId) {
    const checked = Array.from(document.querySelectorAll('.toplu-sil-cb:checked')).map(cb => cb.value);
    if (checked.length === 0) {
        if(window.Toast) window.Toast.error("Lütfen silinecek en az bir araç seçin.");
        else alert("Lütfen silinecek en az bir araç seçin.");
        return;
    }

    if (!confirm(`Seçili ${checked.length} aracı bu müşteriden çıkarmak istediğinize emin misiniz?`)) return;

    const btn = document.querySelector('button[onclick*="silTopluAraclar"]');
    let origHtml = '';
    if (btn) {
        origHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Siliniyor...';
        btn.disabled = true;
    }

    try {
        const { error } = await window.supabaseClient
            .from('musteri_arac_tanimlari')
            .delete()
            .eq('musteri_id', musteriId)
            .in('arac_id', checked);

        if (error) throw error;

        if (window.Toast) window.Toast.success(`${checked.length} adet araç başarıyla çıkarıldı.`);
        else alert(`${checked.length} adet araç başarıyla çıkarıldı.`);
        
        document.getElementById('toplu-arac-sil-modal-overlay').remove();
        if (typeof window.fetchMusteriler === 'function') window.fetchMusteriler();
        
    } catch (e) {
        console.error("Toplu Silme Hatası:", e);
        if (window.Toast) window.Toast.error("Silme hatası: " + e.message);
        else alert("Silme hatası: " + e.message);
        if (btn) {
            btn.innerHTML = origHtml;
            btn.disabled = false;
        }
        if (window.lucide) window.lucide.createIcons();
    }
};

async function fetchMusteriServis() {
    const tbody = document.getElementById('musteri-servis-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        const { data: msp, error } = await window.supabaseClient
            .from('musteri_servis_puantaj')
            .select('*, araclar(plaka), musteriler(unvan)')
            .order('tarih', { ascending: false });
        if (error) throw error;
        tbody.innerHTML = '';
        if (msp.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Servis kaydı bulunmuyor.</td></tr>';
            return;
        }
        msp.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";
            tr.innerHTML = `
                        <td class="px-6 py-5 whitespace-nowrap">
                            <div class="text-sm font-medium text-primary">${s.musteriler ? s.musteriler.unvan : 'Bilinmiyor'}</div>
                            <div class="text-xs text-gray-500">${s.tarih}</div>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap">
                            <span class="px-2 py-1 border border-gray-200 bg-gray-50 text-[10px] uppercase font-semibold text-gray-600">${s.vardiya}</span>
                        </td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm text-gray-500">${s.araclar ? s.araclar.plaka : '-'}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-sm font-medium text-primary">₺${s.gunluk_ucret.toLocaleString('tr-TR')}</td>
                        <td class="px-6 py-5 whitespace-nowrap text-right text-sm">
                            <button onclick="deleteRecord('musteri_servis_puantaj', '${s.id}', 'fetchMusteriServis')" class="text-danger hover:text-red-800 text-xs font-semibold uppercase tracking-wider">Sil</button>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

/* === CARİ & BAKIM FETCH JS === */
window.fetchCariler = async function() {
    const tbody = document.getElementById('cariler-tbody');
    const cards = document.getElementById('cari-cards-grid');
    if (!tbody) return;
    const loadingState = '<div class="loading-state"><div><i data-lucide="loader-2" class="animate-spin"></i><p>Cariler yükleniyor...</p></div></div>';
    tbody.innerHTML = `<tr><td colspan="6">${loadingState}</td></tr>`;
    if (cards) cards.innerHTML = loadingState;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

        const [
            carilerRes,
            faturalarRes,
            odemelerRes,
            policelerRes,
            bakimlarRes,
            kartIslemleriRes
        ] = await Promise.all([
            window.supabaseClient.from('cariler').select('*').order('unvan', { ascending: true }),
            window.supabaseClient.from('cari_faturalar').select('cari_id, toplam_tutar'),
            window.supabaseClient.from('cari_odemeler').select('cari_id, tutar'),
            window.supabaseClient.from('arac_policeler').select('cari_id, toplam_tutar, taksit_sayisi'),
            window.supabaseClient.from('arac_bakimlari').select('cari_id, toplam_tutar'),
            window.supabaseClient.from('kredi_karti_islemleri').select('kart_id, toplam_tutar')
        ]);

        if (carilerRes.error) throw carilerRes.error;
        
        // Fetch cards to map kart_id to cari_id for balance calc
        // Legacy şemalarda cari_id bulunmayabilir; select('*') eksik sütun nedeniyle
        // dashboard açılışında gereksiz 400 üretmeden aynı eşlemeyi güvenle no-op bırakır.
        const { data: kartlar } = await window.supabaseClient.from('kredi_kartlari').select('*');
        const kartToCari = {};
        (kartlar || []).forEach(k => { if(k.cari_id) kartToCari[k.id] = k.cari_id; });

        const cariler = carilerRes.data || [];
        const faturalar = faturalarRes.data || [];
        const odemeler = odemelerRes.data || [];
        const policeler = policelerRes.data || [];
        const bakimlar = bakimlarRes.data || [];
        const kartIslemleri = (kartIslemleriRes && kartIslemleriRes.data) || [];

        const carilerClean = window.sanitizeDataArray(cariler);

        const typeFilter = document.getElementById('cari-filter-type');
        if (typeFilter) {
            const selectedType = typeFilter.value;
            const types = [...new Set(carilerClean.map(c => c.tur || c.isletme_turu || 'Cari').filter(Boolean))]
                .sort((a, b) => a.localeCompare(b, 'tr'));
            typeFilter.replaceChildren(new Option('Tüm cari türleri', ''));
            types.forEach(type => typeFilter.add(new Option(type, type.toLocaleLowerCase('tr-TR'))));
            typeFilter.value = selectedType;
        }

        // Dashboard Güncelleme
        const cariCountEl = document.getElementById('ozet-cari-sayisi');
        if (cariCountEl) cariCountEl.textContent = carilerClean.length;

        tbody.innerHTML = '';
        if (carilerClean.length === 0) {
            const emptyState = '<div class="receivables-empty-state"><span class="receivables-state-icon"><i data-lucide="building-2"></i></span><strong>Henüz cari kaydı bulunmuyor.</strong><p>İlk ticari hesabı ekleyerek bakiye ve hareket takibine başlayın.</p><button onclick="openModal(\'Yeni Cari Hesap\')" class="btn-primary"><i data-lucide="plus"></i>Cari Ekle</button></div>';
            tbody.innerHTML = `<tr><td colspan="6">${emptyState}</td></tr>`;
            if (cards) cards.innerHTML = emptyState;
            ['cari-kpi-total', 'cari-kpi-debt', 'cari-kpi-credit', 'cari-kpi-balance'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = id === 'cari-kpi-total' ? '0' : window.formatCurrency(0);
            });
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        if (cards) cards.innerHTML = '';
        let portfolioDebt = 0;
        let portfolioCredit = 0;

        carilerClean.forEach(c => {
            // Borç Hesabı: Faturalar + Poliçeler + Bakımlar + Kredi Kartı Harcamaları
            const cariFaturalar = (faturalar || []).filter(f => f.cari_id === c.id);
            const cariPoliceler = (policeler || []).filter(p => p.cari_id === c.id);
            const cariBakimlar = (bakimlar || []).filter(b => b.cari_id === c.id);
            
            // Eğer bu bir kredi kartı carisiyse, ona bağlı kartın işlemlerini de borca ekle
            const cariKartIslemleri = (kartIslemleri || []).filter(ki => kartToCari[ki.kart_id] === c.id);

            const totalBorc = cariFaturalar.reduce((sum, f) => sum + (Number(f.toplam_tutar) || 0), 0) +
                cariPoliceler.reduce((sum, p) => sum + (Number(p.toplam_tutar) || 0), 0) +
                cariBakimlar.reduce((sum, b) => sum + (Number(b.toplam_tutar) || 0), 0) +
                cariKartIslemleri.reduce((sum, ki) => sum + (Number(ki.toplam_tutar) || 0), 0);

            // Ödeme Hesabı
            const cariOdemeler = (odemeler || []).filter(o => o.cari_id === c.id);
            const totalOdeme = cariOdemeler.reduce((sum, o) => sum + (Number(o.tutar) || 0), 0);

            const bakiye = totalBorc - totalOdeme;
            portfolioDebt += totalBorc;
            portfolioCredit += totalOdeme;

            // Aylık taksit yükü (bilgi amaçlı kalsın veya bakiye ile yer değiştirsin)
            let aylikYuk = 0;
            cariPoliceler.forEach(p => {
                const tutar = Number(p.toplam_tutar) || 0;
                const taksit = Number(p.taksit_sayisi) || 0;
                if (taksit > 0) aylikYuk += (tutar / taksit);
            });

            const tr = document.createElement('tr');
            tr.className = "ios-cari-row receivables-row";
            tr.dataset.filterable = 'true';
            tr.dataset.filterSearch = [c.unvan, c.tur, c.isletme_turu, c.telefon].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');
            tr.dataset.filterType = (c.tur || c.isletme_turu || 'Cari').toLocaleLowerCase('tr-TR');
            tr.dataset.filterBalance = bakiye > 0 ? 'debt' : bakiye < 0 ? 'credit' : 'settled';
            tr.dataset.filterContact = c.telefon ? 'present' : 'missing';
            tr.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') window.openCariDetail(c.id);
            };
            tr.innerHTML = `
                <td class="cari-list-name" data-label="Cari"><div class="receivables-simple-identity"><strong>${c.unvan || '-'}</strong><span class="badge-neutral">${c.tur || c.isletme_turu || 'Cari'}</span><small>Ekstre için satırı açın</small></div></td>
                <td class="cari-list-phone" data-label="İletişim">${c.telefon || 'Belirtilmemiş'}</td>
                <td class="receivables-money" data-label="Borç">${window.formatCurrency(totalBorc)}</td>
                <td class="receivables-money" data-label="Ödeme">${window.formatCurrency(totalOdeme)}</td>
                <td class="cari-list-balance receivables-money" data-label="Güncel Bakiye"><span class="${bakiye > 0 ? 'receivables-balance is-debt' : bakiye < 0 ? 'receivables-balance is-credit' : 'receivables-balance is-settled'}"><i data-lucide="${bakiye > 0 ? 'arrow-up-right' : bakiye < 0 ? 'arrow-down-left' : 'check'}"></i>${window.formatCurrency(bakiye)} · ${bakiye > 0 ? 'Borç' : bakiye < 0 ? 'Alacak' : 'Kapalı'}</span>${aylikYuk > 0 ? `<small>Aylık yük: ${window.formatCurrency(aylikYuk)}</small>` : ''}</td>
                <td class="cari-list-actions" data-label="İşlemler"><div class="receivables-row-actions"><button onclick="event.stopPropagation(); openModal('Yeni Bakım/Parça Kaydı', '${c.id}')" aria-label="Bakım kaydı ekle" title="Bakım ekle"><i data-lucide="wrench"></i></button><button onclick="event.stopPropagation(); openModal('Yeni Fatura Kaydı', '${c.id}')" aria-label="Fatura kaydı ekle" title="Fatura ekle"><i data-lucide="file-plus-2"></i></button><button onclick="event.stopPropagation(); openModal('Cari Güncelle', '${c.id}')" aria-label="Cari kaydını düzenle" title="Düzenle"><i data-lucide="pencil"></i></button><button class="is-danger" onclick="event.stopPropagation(); deleteRecord('cariler', '${c.id}', 'fetchCariler')" aria-label="Cari kaydını sil" title="Sil"><i data-lucide="trash-2"></i></button></div></td>
            `;
            tbody.appendChild(tr);

            if (cards) {
                const card = document.createElement('article');
                card.className = 'receivables-card is-simple';
                card.dataset.filterable = 'true';
                card.dataset.filterSearch = tr.dataset.filterSearch;
                card.dataset.filterType = tr.dataset.filterType;
                card.dataset.filterBalance = tr.dataset.filterBalance;
                card.dataset.filterContact = tr.dataset.filterContact;
                card.innerHTML = `<div class="receivables-card-head"><div class="receivables-card-identity"><div><h3>${c.unvan || '-'}</h3><p>${c.tur || c.isletme_turu || 'Cari'} · ${c.telefon || 'Telefon belirtilmemiş'}</p></div></div><span class="${bakiye > 0 ? 'badge-warning' : bakiye < 0 ? 'badge-info' : 'badge-success'}">${bakiye > 0 ? 'Borç' : bakiye < 0 ? 'Alacak' : 'Kapalı'}</span></div><div class="receivables-card-balance"><span>Güncel bakiye</span><strong>${window.formatCurrency(bakiye)}</strong></div><div class="receivables-card-summary"><div><span>Borç</span><strong>${window.formatCurrency(totalBorc)}</strong></div><div><span>Ödeme</span><strong>${window.formatCurrency(totalOdeme)}</strong></div></div><div class="receivables-card-actions"><button class="is-primary-action" onclick="window.openCariDetail('${c.id}')"><i data-lucide="book-open"></i>Ekstre</button><button onclick="openModal('Cari Güncelle', '${c.id}')"><i data-lucide="pencil"></i>Düzenle</button><button onclick="openModal('Yeni Fatura Kaydı', '${c.id}')"><i data-lucide="file-plus-2"></i>Fatura</button></div>`;
                cards.appendChild(card);
            }
        });

        const portfolioBalance = portfolioDebt - portfolioCredit;
        const cariKpis = { 'cari-kpi-total': carilerClean.length, 'cari-kpi-debt': window.formatCurrency(portfolioDebt), 'cari-kpi-credit': window.formatCurrency(portfolioCredit), 'cari-kpi-balance': window.formatCurrency(portfolioBalance) };
        Object.entries(cariKpis).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
        // Borclu cari sayisini hesapla
        const borcluEl = document.getElementById('ozet-cari-borclu');
        if (borcluEl) {
            let borcluCount = 0;
            carilerClean.forEach(c => {
                const borFat = (faturalar || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borPol = (policeler || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borBak = (bakimlar || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borOd  = (odemeler || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.tutar) || 0), 0);
                if ((borFat + borPol + borBak) - borOd > 0) borcluCount++;
            });
            borcluEl.textContent = borcluCount;
        }
        if (typeof window.filterCariTable === 'function') window.filterCariTable();
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error('[CARİFETCH] Error:', e);
        const errorState = `<div class="receivables-error-state"><span class="receivables-state-icon"><i data-lucide="triangle-alert"></i></span><strong>Cari kayıtları yüklenemedi</strong><p>${e.message}</p><button onclick="fetchCariler()" class="btn-secondary"><i data-lucide="refresh-cw"></i>Tekrar dene</button></div>`;
        tbody.innerHTML = `<tr><td colspan="6">${errorState}</td></tr>`;
        if (cards) cards.innerHTML = errorState;
        if (window.lucide) window.lucide.createIcons();
    }
}

window.filterCariTable = function () {
    const normalize = value => String(value || '').trim().toLocaleLowerCase('tr-TR');
    const query = normalize(document.getElementById('cari-filter-search')?.value);
    const type = normalize(document.getElementById('cari-filter-type')?.value);
    const balance = document.getElementById('cari-filter-balance')?.value || '';
    const contact = document.getElementById('cari-filter-contact')?.value || '';
    let visible = 0;

    document.querySelectorAll('#cariler-tbody tr[data-filterable="true"]').forEach(row => {
        const show = (!query || row.dataset.filterSearch.includes(query)) &&
            (!type || row.dataset.filterType === type) &&
            (!balance || row.dataset.filterBalance === balance) &&
            (!contact || row.dataset.filterContact === contact);
        row.hidden = !show;
        if (show) visible += 1;
    });
    document.querySelectorAll('#cari-cards-grid [data-filterable="true"]').forEach(card => {
        const show = (!query || card.dataset.filterSearch.includes(query)) &&
            (!type || card.dataset.filterType === type) &&
            (!balance || card.dataset.filterBalance === balance) &&
            (!contact || card.dataset.filterContact === contact);
        card.hidden = !show;
    });

    const count = document.getElementById('cari-visible-count');
    if (count) count.textContent = visible;
};

window.clearCariFilters = function () {
    ['cari-filter-search', 'cari-filter-type', 'cari-filter-balance', 'cari-filter-contact'].forEach(id => {
        const control = document.getElementById(id);
        if (control) control.value = '';
    });
    window.filterCariTable();
};

window.fetchTaksitler = async function() {
    const tbody = document.getElementById('taksitler-tbody');
    if (!tbody) return;

    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

        const { data: cariler } = await window.supabaseClient.from('cariler').select('id, unvan');
        let { data: policeler, error } = await window.supabaseClient.from('arac_policeler').select('*');
        if (error) throw error;
        
        policeler = window.sanitizeDataArray(policeler || []);

        tbody.innerHTML = '';
        if (!policeler || policeler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-gray-400">Aktif taksitli işlem bulunamadı.</td></tr>';
            return;
        }

        policeler.forEach(p => {
            const cari = cariler.find(c => c.id === p.cari_id);
            const tutar = Number(p.toplam_tutar) || 0;
            const taksit = Number(p.taksit_sayisi) || 0;
            const aylik = taksit > 0 ? (tutar / taksit) : tutar;

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">${cari ? cari.unvan : 'Bilinmeyen'}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="text-xs text-gray-500 uppercase">${p.tur || 'BELİRSİZ'} POLİÇESİ</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">₺${tutar.toLocaleString('tr-TR')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${taksit} Taksit</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-danger">₺${aylik.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { 
        console.error('[TAKSİTFETCH] Error:', e);
        tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-danger font-bold uppercase">Hata: ${e.message}</td></tr>`;
    }
}

async function fetchYakitlar() {
    const tbody = document.getElementById('yakit-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        
        // Get Filters
        const mulkiyetFilter = window.currentYakitMulkiyet || 'hepsi';
        const sirketFilter = window.currentYakitSirket || 'hepsi';
        const filterVal = document.getElementById('filter-yakit-ay')?.value;

        // "ilgili araçların mülkiyeti ve şirketini" getirebilmek için join mantığını genişletiyoruz
        let query = window.supabaseClient
            .from('yakit_takip')
            .select('*, araclar!inner(plaka, mulkiyet_durumu, sirket)')
            .order('tarih', { ascending: false });

        if (mulkiyetFilter !== 'hepsi') {
            query = query.eq('araclar.mulkiyet_durumu', mulkiyetFilter);
        }

        if (sirketFilter !== 'hepsi') {
            query = query.eq('araclar.sirket', sirketFilter);
        }

        if (filterVal) {
            const [year, month] = filterVal.split('-');
            const daysInMonth = new Date(year, parseInt(month), 0).getDate();
            query = query.gte('tarih', `${year}-${month}-01`).lte('tarih', `${year}-${month}-${daysInMonth}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        tbody.innerHTML = '';
        
        let filteredData = data;
        const plakaFilter = document.getElementById('yakit-search')?.value?.toUpperCase();
        if (plakaFilter) {
            filteredData = data.filter(y => (y.araclar?.plaka || '').toUpperCase().includes(plakaFilter));
        }

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">Kayıt bulunmuyor.</td></tr>';
            return;
        }

        // GRUPLAMA MANTIĞI
        const groups = {};
        let grandLitre = 0;
        let grandTutar = 0;
        let islemSayisi = filteredData.length;

        filteredData.forEach(y => {
            const plaka = y.araclar ? y.araclar.plaka : 'BİLİNMİYOR';
            if (!groups[plaka]) {
                groups[plaka] = { items: [], totalLitre: 0, totalTutar: 0 };
            }
            groups[plaka].items.push(y);
            groups[plaka].totalLitre += (y.litre || 0);
            groups[plaka].totalTutar += (y.toplam_tutar || 0);
            
            grandLitre += (y.litre || 0);
            grandTutar += (y.toplam_tutar || 0);
        });

        // SIRALAMA: Plaka ismine göre
        const sortedPlakas = Object.keys(groups).sort((a,b) => a.localeCompare(b));

        sortedPlakas.forEach(plaka => {
            const g = groups[plaka];
            
            // Grup içi tarih sıralaması (Mazot alım tarihleri sırayla) - En yeniden en eskiye
            g.items.sort((a,b) => new Date(b.tarih) - new Date(a.tarih));
            
            // Plaka Başlık Satırı
            const headTr = document.createElement('tr');
            headTr.className = "bg-gray-50/50 border-t-2 border-gray-100";
            headTr.innerHTML = `
                <td class="px-6 py-3 font-black text-gray-900 bg-white/50" colspan="2">
                    <div class="flex items-center gap-2">
                        <span class="w-2 h-6 bg-orange-500 rounded-full"></span>
                        ${plaka}
                    </div>
                </td>
                <td class="px-6 py-3 text-xs text-gray-400 font-bold uppercase tracking-widest">TARİHÇE</td>
                <td class="px-6 py-3 text-xs text-gray-400 font-bold uppercase tracking-widest">LİTRE</td>
                <td class="px-6 py-3 text-xs text-gray-400 font-bold uppercase tracking-widest">BİRİM F.</td>
                <td class="px-6 py-3 text-xs text-gray-400 font-bold uppercase tracking-widest">TOTAL</td>
                <td class="px-6 py-3"></td>
            `;
            tbody.appendChild(headTr);

            // Detay Satırları
            g.items.forEach(y => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50/30 transition-colors border-b border-gray-50";
                tr.innerHTML = `
                    <td class="px-6 py-2 whitespace-nowrap">
                        <input type="checkbox" name="yakit-checkbox" value="${y.id}" onchange="updateYakitBulkDeleteBtn()" 
                            class="rounded border-gray-300 text-orange-500 focus:ring-orange-500 w-4 h-4">
                    </td>
                    <td colspan="1"></td>
                    <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-600">${formatTurkishDate(y.tarih)}</td>
                    <td class="px-6 py-2 whitespace-nowrap text-sm font-medium text-blue-600">${y.litre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}LT</td>
                    <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-400">₺${y.birim_fiyat}</td>
                    <td class="px-6 py-2 whitespace-nowrap text-sm font-semibold text-gray-700">₺${(y.toplam_tutar || 0).toLocaleString('tr-TR')}</td>
                    <td class="px-6 py-2 whitespace-nowrap text-right text-sm">
                        <button onclick="deleteRecord('yakit_takip', '${y.id}', 'refreshYakitAndKPIs')" class="text-gray-300 hover:text-danger p-1 transition-colors">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Alt Toplam Satırı
            const footTr = document.createElement('tr');
            footTr.className = "bg-orange-50/30 border-b border-orange-100";
            footTr.innerHTML = `
                <td colspan="3" class="px-6 py-2 text-right text-[10px] font-black text-orange-600 uppercase tracking-widest">${plaka} TOPLAMI:</td>
                <td class="px-6 py-2 whitespace-nowrap text-sm font-black text-blue-700">${g.totalLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}LT</td>
                <td></td>
                <td class="px-6 py-2 whitespace-nowrap text-sm font-black text-orange-700">₺${g.totalTutar.toLocaleString('tr-TR')}</td>
                <td></td>
            `;
            tbody.appendChild(footTr);
        });

        if (window.lucide) window.lucide.createIcons();

        // Update KPIs
        const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        const el1 = document.getElementById('fin-kpi-brut'); if (el1) el1.textContent = islemSayisi.toString();
        const el2 = document.getElementById('fin-kpi-yakit'); if (el2) el2.textContent = Number(grandLitre).toLocaleString('tr-TR', { maximumFractionDigits: 0 }) + ' LT';
        const el3 = document.getElementById('fin-kpi-net'); if (el3) el3.textContent = fmt(grandTutar);

        // Reset Master Checkbox and Delete Button
        const master = document.getElementById('yakit-master-checkbox');
        if (master) master.checked = false;
        const bulkBtn = document.getElementById('yakit-bulk-delete-btn');
        if (bulkBtn) bulkBtn.classList.add('hidden');

    } catch (e) { console.error("fetchYakitlar error:", e); }
}

// --- Bulk Management ---
window.refreshYakitAndKPIs = function() {
    if (typeof fetchYakitlar === 'function') fetchYakitlar();
    if (typeof fetchTaseronFinans === 'function') fetchTaseronFinans();
    if (typeof fetchFinansDashboard === 'function') fetchFinansDashboard();
};

window.toggleAllYakitCheckboxes = function(master) {
    const checkboxes = document.querySelectorAll('input[name="yakit-checkbox"]');
    checkboxes.forEach(cb => cb.checked = master.checked);
    updateYakitBulkDeleteBtn();
};

window.updateYakitBulkDeleteBtn = function() {
    const checkedCount = document.querySelectorAll('input[name="yakit-checkbox"]:checked').length;
    const btn = document.getElementById('yakit-bulk-delete-btn');
    if (btn) {
        if (checkedCount > 0) {
            btn.classList.remove('hidden');
            btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i> ${checkedCount} Seçilenleri Sil`;
            if (window.lucide) window.lucide.createIcons();
        } else {
            btn.classList.add('hidden');
        }
    }
};

window.deleteSelectedYakitlar = async function() {
    const checked = document.querySelectorAll('input[name="yakit-checkbox"]:checked');
    const ids = Array.from(checked).map(cb => cb.value);
    if (!ids.length) return;

    if (!confirm(`${ids.length} adet yakıt kaydını silmek istediğinize emin misiniz?`)) return;

    try {
        const { error } = await window.supabaseClient.from('yakit_takip').delete().in('id', ids);
        if (error) throw error;
        if (window.Toast) window.Toast.success(`${ids.length} kayıt silindi.`);
        if (typeof window.refreshYakitAndKPIs === 'function') window.refreshYakitAndKPIs();
    } catch (e) {
        console.error(e);
        if (window.Toast) window.Toast.error("Silme hatası: " + e.message);
    }
};

// Tarih & Saat Formatı (14.03.2026 15:30)
// Tarih Formatı (14.03.2026)
function formatTurkishDate(iso) {
    if (!iso) return "";
    try {
        const parts = iso.split('T');
        const datePart = parts[0];
        const [y, m, d] = datePart.split('-');
        return `${parseInt(d).toString().padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
    } catch(e) { return iso; }
}

// Plaka formatlama yardımcısı (0 siral, boşluklu)
function formatPlakaForDB(p) {
    if (!p) return "";
    let clean = window.FuelAnalytics
        ? window.FuelAnalytics.normalizePlate(p)
        : String(p).replace(/[^A-Z0-9ÇĞİÖŞÜ]/gi, '').toLocaleUpperCase('tr-TR');
    clean = clean.replace(/^0+/, ''); 
    const m = clean.match(/^(\d+)([A-Z]+)(\d+)$/);
    if (m) return `${m[1]} ${m[2]} ${m[3]}`;
    return clean;
}

window.importYakitExcel = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!window.XLSX) { alert("Excel kütüphanesi yüklenemedi!"); return; }

    showYakitImportPreview([], "Dosya okunuyor...");
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                updateYakitImportStatus("Veriler çözümleniyor...");
                const data = new Uint8Array(e.target.result);
                
                let ws;
                const decoder = new TextDecoder('windows-1254');
                const textForm = decoder.decode(data).substring(0, 1500).toLowerCase();
                
                if (textForm.includes('<frameset')) {
                    throw new Error("Yüklediğiniz dosya sadece bir dış kabuk (frameset). Lütfen verinin kendisini içeren 'Export_dosyalar/sheet001.htm' dosyasını yükleyin veya mevcut dosyayı Excel'de açıp Farklı Kaydet diyerek .xlsx formatında kaydedin.");
                }

                if (textForm.includes('<html') || textForm.includes('<table')) {
                    const fullText = decoder.decode(data);
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(fullText, 'text/html');
                    const table = doc.querySelector('table');
                    if (!table) throw new Error("HTML formatında dosya yüklendi fakat içinde tablo bulunamadı.");
                    
                    // raw: true enforces treating everything as string, bypassing SheetJS American format number bugs
                    ws = window.XLSX.utils.table_to_sheet(table, { raw: true });
                } else {
                    const workbook = window.XLSX.read(data, { type: 'array', cellDates: true, cellNF: true, cellText: true });
                    ws = workbook.Sheets[workbook.SheetNames[0]];
                }
                
                if (!ws['!ref']) throw new Error("Excel sayfası boş görünüyor.");
                
                // 1. Zeki Başlık Satırı Arama (İlk 10 satırı tarayıp Plaka ve Tarih olanı bulur)
                let headerRowIndex = 0;
                let headers = [];
                for (let r = 0; r < 10; r++) {
                    const row = XLSX.utils.sheet_to_json(ws, { header: 1, range: r, raw: false })[0] || [];
                    const rowText = row.map(h => String(h || "").toLowerCase().trim());
                    if (rowText.some(h => h.includes('plaka')) && rowText.some(h => h.includes('tarih'))) {
                        headerRowIndex = r;
                        headers = rowText;
                        break;
                    }
                    if (r === 0) headers = rowText; // Fallback
                }

                // Geliştirilmiş Sütun Bulucu (Blacklist destekli)
                const findIdx = (keywords, blacklist = []) => {
                    return headers.findIndex(h => 
                        keywords.some(k => h.includes(k)) && 
                        !blacklist.some(b => h.includes(b))
                    );
                };
                
                // Tutar (KDV'li asıl rakamı bulmak için çok kritik)
                // Önce en spesifik 'Genel Toplam' gruplarını arıyoruz, KDV ve Matrah sütunlarını eliyoruz.
                const tutarBlacklist = ['kdv', 'matrah', 'iskonto', 'ötv', 'vergi', 'isk.', 'indirim'];
                let idxTutar = findIdx(['genel toplam', 'ödenecek', 'fatura tutarı', 'net tutar', 'toplam tutar'], tutarBlacklist);
                if (idxTutar === -1) idxTutar = findIdx(['toplam', 'total'], tutarBlacklist);
                
                // Eğer hala bulunamadıysa veya kullanıcı 7. sütun dediyse (index 6), onu bir kontrol edelim
                if (idxTutar === -1) idxTutar = 6; 

                const idx = {
                    tarih: findIdx(['tarih', 'gün', 'date']),
                    plaka: findIdx(['plaka', 'araç', 'plate']),
                    litre: findIdx(['litre', 'lt', 'miktar', 'vol', 'qty', 'quantity']),
                    tutar: idxTutar,
                    birim: findIdx(['birim', 'fiyat', 'price'])
                };
                
                // Hata ayıklama için başlık isimlerini sakla
                const detectedHeaders = {
                    tarih: idx.tarih !== -1 ? headers[idx.tarih] : "Bulunamadı",
                    plaka: idx.plaka !== -1 ? headers[idx.plaka] : "Bulunamadı",
                    litre: idx.litre !== -1 ? headers[idx.litre] : "Bulunamadı",
                    tutar: headers[idxTutar] || "7. Sütun",
                    birim: idx.birim !== -1 ? headers[idx.birim] : "Otomatik"
                };

                if (idx.tarih === -1 || idx.plaka === -1 || idx.litre === -1) {
                    throw new Error("Gerekli sütunlar (Tarih, Plaka, Litre) bulunamadı. Lütfen başlıkları kontrol edin.");
                }

                const range = XLSX.utils.decode_range(ws['!ref']);
                const { data: araclar } = await window.supabaseClient.from('araclar').select('id, plaka');
                const cleanPlaka = (p) => {
                    const normalized = window.FuelAnalytics
                        ? window.FuelAnalytics.normalizePlate(p)
                        : String(p || "").replace(/[^A-Z0-9ÇĞİÖŞÜ]/gi, '').toLocaleUpperCase('tr-TR');
                    return normalized.replace(/^0+/, '');
                };
                const aracMap = {};
                (araclar || []).forEach(a => { aracMap[cleanPlaka(a.plaka)] = { id: a.id, plaka: a.plaka }; });

                const parseTrNumber = (valStr) => {
                    if (valStr === null || valStr === undefined) return 0;
                    let s = String(valStr).trim().replace(/\s+/g, '').replace(/[^0-9,.-]/g, '');
                    if (s === "") return 0;

                    // Eğer Excel'den 4.406,25 gibi gelmişse
                    if (s.includes(',') && s.includes('.')) {
                        if (s.lastIndexOf(',') > s.lastIndexOf('.')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
                        else return parseFloat(s.replace(/,/g, '')) || 0;
                    }

                    // Tek bir ayraç varsa (Virgül veya Nokta)
                    // Yakıt faturasında 100 liranın altında tutar pek olmaz (istisna harici)
                    // 3 hane kuralı en garantisidir.
                    if (s.includes(',') || s.includes('.')) {
                        const sep = s.includes(',') ? ',' : '.';
                        const parts = s.split(sep);
                        if (sep === ',' || (parts.length === 2 && parts[0].length <= 2)) return parseFloat(s.replace(',', '.')) || 0;
                        if (parts.length === 2 && parts[1].length === 3) return parseFloat(s.replace(/[,\.]/g, '')) || 0;
                        return parseFloat(s.replace(',', '.')) || 0;
                    }
                    return parseFloat(s) || 0;
                };

                const rawRecords = [];
                for (let R = headerRowIndex + 1; R <= range.e.r; R++) {
                    const addrP = XLSX.utils.encode_cell({ r: R, c: idx.plaka }), cellP = ws[addrP];
                    if (!cellP || !cellP.v) continue;

                    const rawPlaka = String(cellP.v), cleaned = cleanPlaka(rawPlaka), formatted = formatPlakaForDB(rawPlaka);
                    if (!cleaned || !formatted) continue;

                    const vehicle = aracMap[cleaned];
                    const addrT = XLSX.utils.encode_cell({ r: R, c: idx.tarih }), cellT = ws[addrT];
                    let dt = null;

                    // 1. Text-First Katı DD.MM.YYYY Parçalama (Ağırlıklı Görünen Metne Güvenilir)
                    let textVal = cellT ? (cellT.w || String(cellT.v)) : null;
                    let parsed = false;
                    
                    if (textVal) {
                        textVal = textVal.toString().toLowerCase().trim().split(' ')[0]; // Sadece tarih
                        const parts = textVal.split(/[\/\.\-]/).filter(p => p.trim() !== '');
                        
                        if (parts.length >= 2) {
                            let d = parseInt(parts[0]);
                            let mRaw = parts[1];
                            let m = NaN;
                            
                            // Aylar metin ise (06-Oca-26 gibi)
                            if (isNaN(parseInt(mRaw))) {
                                const ayMap = { 'oca':1, 'şub':2, 'sub':2, 'mar':3, 'nis':4, 'may':5, 'haz':6, 'tem':7, 'ağu':8, 'agu':8, 'eyl':9, 'eki':10, 'kas':11, 'ara':12, 'jan':1, 'feb':2, 'apr':4, 'jun':6, 'jul':7, 'aug':8, 'sep':9, 'oct':10, 'nov':11, 'dec':12 };
                                for (const [k, v] of Object.entries(ayMap)) {
                                    if (mRaw.includes(k)) { m = v; break; }
                                }
                            } else { m = parseInt(mRaw); }

                            let y = new Date().getFullYear();
                            if (parts.length >= 3) {
                                let yStr = parts[2].replace(/\D/g, '');
                                y = parseInt(yStr.length === 2 ? '20' + yStr : yStr);
                                if (yStr.length === 2 && y < 2000) y += 2000;
                            }

                            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                                // ABD Yanılgısını Düzelt (Eğer parçalar matematiken M/D/Y olmak ZORUNDAYSA)
                                // Not: Türkiye'de genel format her zaman D/M/Y'dir. O yüzden inatçı D/M varsayılır.
                                if (d <= 12 && m > 12) {
                                    let temp = d; d = m; m = temp; // 01/15/2026 => D:15, M:1
                                } else if (d > 31) {
                                    y = d; d = parseInt(parts[2]); // 2026/01/15 formatı
                                }
                                
                                const candidateDate = new Date(y, m - 1, d, 0, 0, 0);
                                if (candidateDate.getFullYear() === y && candidateDate.getMonth() === m - 1 && candidateDate.getDate() === d) {
                                    dt = candidateDate;
                                    parsed = true;
                                }
                            }
                        }
                    }

                    // 2. Eğer Text Parsing çuvallarsa Excel Native Value'su (Serial No veya JS Date)
                    if (!parsed || !dt || isNaN(dt.getTime())) {
                        if (cellT && cellT.v instanceof Date) dt = cellT.v;
                        else if (cellT && typeof cellT.v === 'number') dt = new Date(Math.round((cellT.v - 25569) * 86400 * 1000));
                    }
                    
                    const hasValidDate = dt && !isNaN(dt.getTime());
                    if (hasValidDate) dt.setHours(0,0,0,0); // Garanti

                    const displayTarih = hasValidDate
                        ? `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
                        : (textVal || 'Geçersiz tarih');
                    
                    const addrL = XLSX.utils.encode_cell({ r: R, c: idx.litre }), cellL = ws[addrL];
                    const rawL = cellL ? (cellL.w || String(cellL.v || "0")) : "0";
                    const pLitre = parseTrNumber(rawL);
                    const displayLitre = pLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) + 'LT';
                    
                    const addrTur = idx.tutar !== -1 ? XLSX.utils.encode_cell({ r: R, c: idx.tutar }) : null;
                    const cellTur = addrTur ? ws[addrTur] : null;
                    const displayTutar = cellTur ? (cellTur.w || String(cellTur.v || "0")) : "0";

                    const addrBir = idx.birim !== -1 ? XLSX.utils.encode_cell({ r: R, c: idx.birim }) : null;
                    const cellBir = addrBir ? ws[addrBir] : null;
                    const displayBirim = cellBir ? (cellBir.w || String(cellBir.v || "0")) : "0";

                    // Sadece string parsing'e güveniyoruz çünkü numeric cell logic locale bağımlı sapıtabiliyor
                    const pTutar = parseTrNumber(displayTutar);
                    let pBirim = parseTrNumber(displayBirim);

                    // Eğer Excel'de birim fiyat sütunu yoksa veya eksikse, tutar/litre den hesapla
                    if (pBirim <= 0 && pLitre > 0 && pTutar > 0) {
                        pBirim = parseFloat((pTutar / pLitre).toFixed(4));
                    }

                    const yyyy = hasValidDate ? dt.getFullYear() : '';
                    const mm = hasValidDate ? String(dt.getMonth() + 1).padStart(2, '0') : '';
                    const dd = hasValidDate ? String(dt.getDate()).padStart(2, '0') : '';
                    const localISODate = hasValidDate ? `${yyyy}-${mm}-${dd}` : '';

                    rawRecords.push({
                        displayTarih: displayTarih,
                        displayLitre: displayLitre,
                        displayTutar: displayTutar,
                        sortableDT: localISODate,
                        tarih: localISODate,
                        formattedPlaka: formatted,
                        aracId: vehicle ? vehicle.id : null,
                        arac_id: vehicle ? vehicle.id : null,
                        litre: pLitre,
                        tutar: pTutar,
                        toplam_tutar: pTutar,
                        birim: pBirim,
                        birim_fiyat: pBirim
                    });
                }

                const vehicleIds = [...new Set(rawRecords.map(r => r.arac_id).filter(Boolean))];
                const importDates = rawRecords.map(r => r.tarih).filter(Boolean).sort();
                let existingRows = [];
                if (vehicleIds.length && importDates.length) {
                    const { data: databaseRows, error: duplicateError } = await window.supabaseClient.from('yakit_takip')
                        .select('arac_id, tarih, litre, birim_fiyat, toplam_tutar')
                        .in('arac_id', vehicleIds).gte('tarih', importDates[0]).lte('tarih', importDates[importDates.length - 1]);
                    if (duplicateError) throw duplicateError;
                    existingRows = databaseRows || [];
                }
                const importPlan = window.FuelAnalytics.planImport(rawRecords, existingRows);
                importPlan.invalid.forEach(item => { item.row._importErrors = item.errors; });
                importPlan.fileDuplicates.forEach(item => { item._fileDuplicate = true; });
                importPlan.databaseDuplicates.forEach(item => { item._databaseDuplicate = true; });

                const groupedMap = {};
                rawRecords.forEach(r => {
                    if (!groupedMap[r.formattedPlaka]) {
                        groupedMap[r.formattedPlaka] = { plaka: r.formattedPlaka, aracId: r.aracId, items: [], totalLitre: 0, totalTutar: 0 };
                    }
                    groupedMap[r.formattedPlaka].items.push(r);
                    groupedMap[r.formattedPlaka].totalLitre += r.litre;
                    groupedMap[r.formattedPlaka].totalTutar += r.tutar;
                });

                const finalGroups = Object.values(groupedMap).sort((a,b) => a.plaka.localeCompare(b.plaka));
                finalGroups.forEach(g => {
                    g.items.sort((a,b) => String(a.sortableDT || '').localeCompare(String(b.sortableDT || ''))); // Kronolojik sıralama
                });

                showYakitImportPreview(finalGroups, null, detectedHeaders, importPlan);
                event.target.value = ""; 
            } catch (err) { updateYakitImportStatus("Hata: " + err.message, true); }
        };
        reader.readAsArrayBuffer(file);
    } catch (e) { updateYakitImportStatus("Hata oluştu.", true); }
};



window.showYakitImportPreview = function(groups, initialStatus = null, detectedHeaders = null, importPlan = null) {
    try {
        const existing = document.getElementById('yakit-import-preview-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'yakit-import-preview-overlay';
        overlay.className = "fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4";
        
        const isLoading = initialStatus !== null;
        let totalRows = 0, grandTotalLitre = 0, grandTotalTutar = 0;
        
        if (!isLoading && groups) {
            groups.forEach(g => {
                totalRows += g.items.length;
                grandTotalLitre += g.totalLitre;
                grandTotalTutar += g.totalTutar;
            });
        }
        
        overlay.innerHTML = `
            <div class="ios-modal-sheet bg-[#0b0d0f] border border-white/10 rounded-[2rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/5">
                <div class="ios-modal-header p-8 border-b border-white/10 bg-white/[0.02] flex justify-between items-center bg-gradient-to-r from-orange-500/5 to-transparent">
                    <div>
                        <h3 class="text-2xl font-black text-white flex items-center gap-4 tracking-tighter">
                            <span class="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 shadow-inner">
                                <i data-lucide="fuel" class="w-6 h-6 text-orange-500"></i>
                            </span>
                            Yakıt İçe Aktarma Önizleme
                        </h3>
                        ${!isLoading ? `<div class="mt-4 flex flex-wrap items-center gap-4 bg-white/5 py-2.5 px-5 rounded-xl border border-white/10 w-fit shadow-md">
                            <div class="flex items-center gap-2" title="Toplam Plaka Sayısı">
                                <i data-lucide="car" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-white font-black">${groups.length}</span>
                                <span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Plaka</span> 
                            </div>
                            <div class="w-px h-5 bg-white/10 border-r border-white/5"></div>
                            <div><span class="text-emerald-400 font-black">${importPlan ? importPlan.valid.length : totalRows}</span><span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Geçerli</span></div>
                            <div><span class="text-red-400 font-black">${importPlan ? importPlan.invalid.length : 0}</span><span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Hatalı</span></div>
                            <div><span class="text-amber-400 font-black">${importPlan ? importPlan.fileDuplicates.length + importPlan.databaseDuplicates.length : 0}</span><span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Duplicate</span></div>
                            <div><span class="text-orange-400 font-black">${importPlan ? importPlan.invalid.filter(x => !x.row.arac_id).length : 0}</span><span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Eşleşmeyen</span></div>
                            <div class="w-px h-5 bg-white/10 border-r border-white/5"></div>
                            <div class="flex items-center gap-2" title="Toplam Kayıt Sayısı">
                                <i data-lucide="list" class="w-4 h-4 text-gray-400"></i>
                                <span class="text-white font-black">${totalRows}</span>
                                <span class="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Kayıt</span>
                            </div>
                            <div class="w-px h-5 bg-white/10 border-r border-white/5"></div>
                            <div class="flex items-center gap-2" title="Genel Toplam Litre">
                                <i data-lucide="droplet" class="w-4 h-4 text-blue-400"></i>
                                <span class="text-blue-400 font-black">${grandTotalLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}LT</span>
                                <span class="text-blue-400/50 text-[10px] font-bold uppercase tracking-wider">Toplam Litre</span>
                            </div>
                            <div class="w-px h-5 bg-white/10 border-r border-white/5"></div>
                            <div class="flex items-center gap-2" title="Genel Toplam Tutar">
                                <i data-lucide="coins" class="w-4 h-4 text-orange-500"></i>
                                <span class="text-orange-500 font-black text-lg">₺${grandTotalTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                ${detectedHeaders ? `<span class="text-gray-500 text-[9px] font-bold ml-1 italic group-hover:text-orange-400/50 transition-colors uppercase tracking-widest">[SÜTUN: ${detectedHeaders.tutar}]</span>` : ''}
                            </div>
                        </div>` : `<p id="yakit-import-status-text" class="text-sm font-bold text-gray-400 mt-2">${initialStatus}</p>`}
                    </div>
                </div>
                
                <div class="ios-modal-body flex-1 overflow-auto p-8 bg-gradient-to-b from-transparent to-white/[0.01]">
                    ${isLoading ? `
                        <div class="h-full flex flex-col items-center justify-center gap-6 py-24">
                            <div id="yakit-import-status-icon" class="w-20 h-20 border-[6px] border-orange-500/10 border-t-orange-500 rounded-full animate-spin shadow-lg shadow-orange-500/10"></div>
                            <p class="text-white text-lg font-bold tracking-tight animate-pulse">Veriler Hazırlanıyor...</p>
                        </div>
                    ` : `
                        <div class="space-y-6">
                            ${groups.map(g => `
                                <div class="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden group hover:border-orange-500/30 transition-all shadow-sm">
                                    <!-- Plaka Başlığı -->
                                    <div class="p-4 bg-white/[0.03] flex items-center justify-between border-b border-white/5">
                                        <div class="flex items-center gap-4">
                                            <span class="text-lg font-black font-mono text-white bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 shadow-inner">${g.plaka}</span>
                                            ${g.aracId 
                                                ? '<span class="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-black tracking-widest uppercase">MEVCUT ARAÇ</span>'
                                                : '<span class="text-[10px] bg-red-500/10 text-red-400 px-3 py-1 rounded-full border border-red-500/20 font-black tracking-widest uppercase">EŞLEŞMEYEN PLAKA</span>'
                                            }
                                        </div>
                                        <div class="text-right">
                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">PLAKA TOPLAMI</div>
                                            <div class="flex items-center gap-4">
                                                <span class="text-sm font-bold text-blue-400">${g.totalLitre.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}LT</span>
                                                <span class="text-sm font-black text-orange-500">₺${g.totalTutar.toLocaleString('tr-TR')}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Tarih Detayları -->
                                    <div class="divide-y divide-white/5 px-4">
                                        ${g.items.map(r => `
                                            <div class="py-3 flex justify-between items-center text-sm">
                                                <span class="text-gray-400 font-medium">${r.displayTarih}${r._importErrors ? `<small class="block text-red-400 mt-1">${r._importErrors.join(' · ')}</small>` : r._fileDuplicate ? '<small class="block text-amber-400 mt-1">Dosya içinde duplicate</small>' : r._databaseDuplicate ? '<small class="block text-amber-400 mt-1">Veritabanında mevcut</small>' : ''}</span>
                                                <div class="flex items-center gap-6">
                                                    <span class="text-gray-300 font-mono w-28 text-right">${r.displayLitre}</span>
                                                    <span class="text-orange-400 font-mono font-black w-32 text-right">₺${r.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <div class="ios-modal-footer p-8 border-t border-white/10 bg-white/[0.03] flex justify-between items-center">
                    <button onclick="document.getElementById('yakit-import-preview-overlay').remove()" class="px-8 py-3 rounded-2xl text-sm font-black text-gray-400 hover:text-white transition-all border border-white/10 hover:bg-white/5">İptal Et</button>
                    ${!isLoading ? `
                        <button onclick="confirmYakitImport()" ${importPlan && !importPlan.valid.length ? 'disabled' : ''} class="px-10 py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black rounded-2xl text-base transition-all shadow-2xl shadow-orange-500/20 flex items-center gap-3 transform hover:scale-[1.02] active:scale-95">
                            <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                            Verileri Onayla ve Kaydet
                        </button>
                    ` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        if (window.lucide) window.lucide.createIcons();
        if (!isLoading) {
            // Flatten back for confirm function but keep the objects
            window.yakitImportPlan = importPlan;
        }
    } catch (err) { alert("Hata: " + err.message); }
};

// Durum güncelleme yardımcısı
function updateYakitImportStatus(message, isError = false) {
    const statusEl = document.getElementById('yakit-import-status-text');
    const loadingIcon = document.getElementById('yakit-import-status-icon');
    if (statusEl) {
        statusEl.innerText = message;
        statusEl.className = isError ? "text-red-400 font-bold" : "text-gray-400";
    }
    if (loadingIcon && isError) {
        loadingIcon.innerHTML = '<i data-lucide="alert-circle" class="w-8 h-8 text-red-500"></i>';
        if (window.lucide) window.lucide.createIcons();
    }
}

window.confirmYakitImport = async function() {
    const records = window.yakitImportPlan?.valid || [];
    if (!records || !records.length) {
        alert("İşlenecek kayıt bulunamadı.");
        return;
    }

    const overlay = document.getElementById('yakit-import-preview-overlay');
    const btn = overlay.querySelector('button[onclick="confirmYakitImport()"]');
    btn.disabled = true;
    btn.innerHTML = '<i class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></i> İşleniyor...';

    try {
        // Yalnızca önizlemede doğrulanan ve mevcut araçla eşleşen kayıtları hazırla.
        const candidatePayload = records.map(r => ({
            tarih: r.sortableDT,
            arac_id: r.aracId,
            litre: r.litre,
            birim_fiyat: r.birim,
            toplam_tutar: r.tutar
        }));

        const vehicleIds = [...new Set(candidatePayload.map(row => row.arac_id).filter(Boolean))];
        const dates = candidatePayload.map(row => row.tarih).filter(Boolean).sort();
        let existingRows = [];
        if (vehicleIds.length && dates.length) {
            const { data: currentRows, error: duplicateError } = await window.supabaseClient
                .from('yakit_takip')
                .select('arac_id, tarih, litre, birim_fiyat, toplam_tutar')
                .in('arac_id', vehicleIds)
                .gte('tarih', dates[0])
                .lte('tarih', dates[dates.length - 1]);
            if (duplicateError) throw duplicateError;
            existingRows = currentRows || [];
        }
        const finalPlan = window.FuelAnalytics.planImport(candidatePayload, existingRows);
        const payload = finalPlan.valid;
        const duplicateCount = finalPlan.fileDuplicates.length + finalPlan.databaseDuplicates.length;

        // 3. Yakıt kayıtlarını ekle
        if (payload.length) {
            const { error: yakitErr } = await window.supabaseClient.from('yakit_takip').insert(payload);
            if (yakitErr) throw yakitErr;
        }

        if (window.Toast) {
            const duplicateLabel = duplicateCount ? ` ${duplicateCount} mükerrer kayıt atlandı.` : '';
            window.Toast.success(`${payload.length} adet yakıt kaydı işlendi.${duplicateLabel}`);
        }
        overlay.remove();
        fetchYakitlar();
        if (typeof window.fetchFuelAnalytics === 'function') window.fetchFuelAnalytics();
        if (typeof fetchAraclar === 'function') fetchAraclar();
        if (typeof fetchTaseronFinans === 'function') fetchTaseronFinans();
        if (typeof fetchFinansDashboard === 'function') fetchFinansDashboard();
        
    } catch (e) {
        console.error(e);
        alert("Hata oluştu: " + e.message);
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Tümünü Onayla ve Kaydet';
    }
};

async function fetchSoforMaaslar() {
    const tbodyFinans = document.getElementById('sofor-maas-tbody');
    const tbodyCari = document.getElementById('maas-tbody');
    if (!tbodyFinans && !tbodyCari) return;

    try {
        // Seçilen Ay Filtresi
        const puantajFilterStr = document.getElementById('filter-bordro-ay')?.value;
        const maasFilterEl = document.getElementById('filter-maas-ay');

        // Maaş sekmesine ilk tıklandığında puantajdaki ay'ı baz al
        if (puantajFilterStr && maasFilterEl && !maasFilterEl.dataset.synced) {
            maasFilterEl.value = puantajFilterStr;
            maasFilterEl.dataset.synced = "true";
        }

        const filterVal = maasFilterEl?.value || puantajFilterStr || new Date().toISOString().slice(0, 7);
        const [year, month] = filterVal.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

        // Verileri çek
        let { data: soforler } = await window.supabaseClient.from('soforler').select('*');
        soforler = window.sanitizeDataArray(soforler || []);
        let bordroData = [];
        try {
            const { data: bd, error: be } = await window.supabaseClient.from('sofor_maas_bordro').select('*').eq('donem', filterVal);
            if (!be) bordroData = bd;
            else console.warn("Bordro verisi çekilemedi (donem kolonu eksik olabilir):", be);
        } catch (e) { console.warn("Bordro fetch hatası:", e); }

        const { data: puantajData } = await window.supabaseClient.from('sofor_puantaj').select('*').gte('tarih', startDate).lte('tarih', endDate);
        const { data: finansData } = await window.supabaseClient.from('sofor_finans').select('*').gte('tarih', startDate).lte('tarih', endDate);

        if (tbodyFinans) tbodyFinans.innerHTML = '';
        if (tbodyCari) tbodyCari.innerHTML = '';
        if (!soforler || soforler.length === 0) {
            const noData = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">Şoför bulunmuyor.</td></tr>';
            if (tbodyFinans) tbodyFinans.innerHTML = noData;
            if (tbodyCari) tbodyCari.innerHTML = noData;
            return;
        }

        soforler.forEach(s => {
            const b = bordroData ? bordroData.find(x => x.sofor_id === s.id) : null;
            const sPuantaj = puantajData ? puantajData.filter(p => p.sofor_id === s.id) : [];
            const sFinans = finansData ? finansData.filter(f => f.sofor_id === s.id) : [];

            // Eğer manuel bordro girilmişse onu kullan, yoksa puantaj göre default hesapla
            const pCalisilanGun = sPuantaj.filter(p => p.durum === 'ÇALIŞTI').length;
            const pHarcirah = sPuantaj.reduce((acc, curr) => acc + (Number(curr.gunluk_harcirah) || 0), 0);

            // Eğer bordro kaydı varsa oradaki değeri al, yoksa pCalisilanGun
            const calisilanGun = b && b.calisma_gun !== null ? Number(b.calisma_gun) : pCalisilanGun;

            // Varsayılan Brüt (Bordroda değişiklik yoksa otomatik hesaplanan)
            let aylikMaas = Number(s.aylik_maas) || 0;
            let gunlukUcret = Number(s.gunluk_ucret) || 0;
            let calculatedWage = gunlukUcret > 0 ? gunlukUcret : (aylikMaas / 30);
            let defaultNet = (calisilanGun * calculatedWage) + pHarcirah;

            // Kullanıcı bordroda sıfır değilse kullan, yoksa defaultNet
            const netMaas = b && b.net_maas !== null && Number(b.net_maas) > 0 ? Number(b.net_maas) : defaultNet;

            // Kesintiler (Finans Tablosu + Bordro Toplamı)
            // Note: The logic from the new ui relies on Bordro overrides. If user modifies fields we should respect them.
            // But we also need backward compatibility with older avans records in finans.
            const sAvantajFromFinans = sFinans.filter(f => f.islem_turu === 'AVANS').reduce((acc, curr) => acc + (Number(curr.tutar) || 0), 0);

            const avans = b ? (Number(b.avans) || 0) : sAvantajFromFinans;
            const ceza = b ? (Number(b.ceza) || 0) : 0;
            const haciz = b ? (Number(b.haciz) || 0) : 0;
            const toplamAvans = avans + ceza + haciz;

            // Toplam Hakediş
            const finalHakedis = Math.max(0, netMaas - toplamAvans);

            if (tbodyFinans) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-gray-50 transition-colors bg-[#1a1c1e]";
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap border-b border-white/5">
                        <div class="font-medium text-white">${s.ad_soyad}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-tighter mt-1">${s.sigorta_durumu || 'SGK'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 border-b border-white/5">
                         <div>₺${calculatedWage > 0 ? calculatedWage.toLocaleString('tr-TR') : 0} / Gün ${gunlukUcret === 0 && aylikMaas > 0 ? '<span class="text-[9px] text-gray-500">(Aylıktan)</span>' : ''}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 border-b border-white/5">
                        <div class="font-bold text-white">${calisilanGun} Gün Çalışma</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-orange-400 font-medium border-b border-white/5">-₺${toplamAvans.toLocaleString('tr-TR')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right border-b border-white/5">
                        <div class="text-lg font-bold text-white">₺${finalHakedis.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</div>
                        <div class="text-[9px] text-gray-500 uppercase">Toplam Hakediş</div>
                    </td>
                `;
                tbodyFinans.appendChild(tr);
            }

            if (tbodyCari) {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-white/5 transition-colors border-b border-white/5";
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-medium text-white">${s.ad_soyad}</div>
                        <div class="text-[10px] text-gray-500 uppercase tracking-widest">${s.sigorta_durumu || 'PERSONEL'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                        ${filterVal}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-bold">
                        ₺${netMaas.toLocaleString('tr-TR')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-orange-400">
                        -₺${toplamAvans}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right">
                        <span class="px-3 py-1 rounded-lg text-[10px] font-black bg-green-500/10 text-green-500 border border-green-500/20 uppercase tracking-widest">ÖDEME HAZIR</span>
                    </td>
                `;
                tbodyCari.appendChild(tr);
            }
        });

    } catch (e) { console.error(e); }
}

async function fetchBakimlar() {
    const tbody = document.getElementById('bakim-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

        let query = window.supabaseClient.from('arac_bakimlari').select('*, araclar:araclar(plaka, guncel_km, son_yag_km), cariler:cariler(unvan)').order('islem_tarihi', { ascending: false });

        const filterVal = document.getElementById('filter-bakim-ay')?.value;
        if (filterVal) {
            const [year, month] = filterVal.split('-');
            const daysInMonth = new Date(year, parseInt(month), 0).getDate();
            query = query.gte('islem_tarihi', `${year}-${month}-01`).lte('islem_tarihi', `${year}-${month}-${daysInMonth}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        tbody.innerHTML = '';
        let totalGider = 0;
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state maintenance-empty"><i data-lucide="wrench"></i><strong>Bakım kaydı bulunmuyor</strong><p>Seçili dönem için kayıt bulunamadı.</p></div></td></tr>';
            const ozet = document.getElementById('ozet-bakim');
            if (ozet) ozet.textContent = "0 ₺";
            ['bakim-summary-count', 'bakim-summary-month', 'bakim-summary-due', 'bakim-summary-overdue'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
            const summaryCost = document.getElementById('bakim-summary-cost');
            if (summaryCost) summaryCost.textContent = '₺0';
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        const dueVehicles = new Set();
        const overdueVehicles = new Set();
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let currentMonthCount = 0;
        data.forEach(b => {
            totalGider += Number(b.toplam_tutar) || 0;
            if (String(b.islem_tarihi || '').startsWith(currentMonthKey)) currentMonthCount++;
            const currentKm = Number(b.araclar?.guncel_km) || 0;
            const lastOilKm = Number(b.araclar?.son_yag_km) || 0;
            const remainingKm = currentKm > 0 && lastOilKm > 0 ? 10000 - (currentKm - lastOilKm) : null;
            let maintenanceState = { label: 'Kayıt yok', className: 'is-unknown', detail: 'KM eşiği hesaplanamadı' };
            if (remainingKm !== null && remainingKm < 0) {
                overdueVehicles.add(b.arac_id || b.araclar?.plaka);
                maintenanceState = { label: 'Gecikmiş', className: 'is-overdue', detail: `${Math.abs(remainingKm).toLocaleString('tr-TR')} km geçti` };
            } else if (remainingKm !== null && remainingKm <= 1200) {
                dueVehicles.add(b.arac_id || b.araclar?.plaka);
                maintenanceState = { label: 'Yaklaşıyor', className: 'is-due', detail: `${remainingKm.toLocaleString('tr-TR')} km kaldı` };
            } else if (remainingKm !== null) {
                maintenanceState = { label: 'Güncel', className: 'is-current', detail: `${remainingKm.toLocaleString('tr-TR')} km kaldı` };
            }
            const tr = document.createElement('tr');
            tr.className = "maintenance-row";
            tr.innerHTML = `
                        <td class="maintenance-date" data-label="Tarih">${b.islem_tarihi}</td>
                        <td class="maintenance-vehicle" data-label="Araç"><strong>${b.araclar ? b.araclar.plaka : '-'}</strong><span>${currentKm ? `${currentKm.toLocaleString('tr-TR')} km` : 'KM bilgisi yok'}</span></td>
                        <td class="maintenance-operation" data-label="İşlem / Açıklama">
                            <strong>${b.islem_turu || 'Bakım'}</strong>
                            <span>${b.aciklama || 'Açıklama girilmemiş'}</span>
                        </td>
                        <td class="maintenance-status-cell" data-label="KM Durumu"><span class="maintenance-status ${maintenanceState.className}">${maintenanceState.label}</span><small>${maintenanceState.detail}</small></td>
                        <td class="maintenance-cost" data-label="Tedarikçi & Tutar">
                            <strong>₺${(b.toplam_tutar || 0).toLocaleString('tr-TR')}</strong>
                            <span>${b.cariler ? b.cariler.unvan : 'Servis belirtilmemiş'}</span>
                        </td>
                        <td class="maintenance-actions" data-label="İşlemler">
                            ${b.dosya_url ? `<a href="${b.dosya_url}" target="_blank" rel="noopener" class="table-action" title="Dosyayı Gör" aria-label="Bakım belgesini görüntüle"><i data-lucide="file-search"></i></a>` : ''}
                            <button onclick="deleteRecord('arac_bakimlari', '${b.id}', 'fetchBakimlar')" class="table-action is-danger" title="Kaydı sil" aria-label="Bakım kaydını sil"><i data-lucide="trash-2"></i></button>
                        </td>
                    `;
            tbody.appendChild(tr);
        });
        const ozet = document.getElementById('ozet-bakim');
        if (ozet) ozet.textContent = totalGider.toLocaleString('tr-TR') + " ₺";
        const ozetAdet = document.getElementById('ozet-bakim-adet');
        if (ozetAdet) ozetAdet.textContent = data.length;
        const summaryValues = {
            'bakim-summary-count': data.length,
            'bakim-summary-month': currentMonthCount,
            'bakim-summary-due': dueVehicles.size,
            'bakim-summary-overdue': overdueVehicles.size,
            'bakim-summary-cost': `₺${totalGider.toLocaleString('tr-TR')}`
        };
        Object.entries(summaryValues).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
        if (window.lucide) window.lucide.createIcons();
        
        if (typeof window.makeTableSortable === 'function') {
            window.makeTableSortable(tbody.closest('table'));
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6"><div class="error-state maintenance-empty"><i data-lucide="triangle-alert"></i><strong>Bakım kayıtları yüklenemedi</strong><p>Lütfen bağlantıyı kontrol edip tekrar deneyin.</p></div></td></tr>';
        if (window.lucide) window.lucide.createIcons();
    }
}

window.currentPoliceFilter = 'HEPSİ';
window.filterPoliceler = function(type) {
    window.currentPoliceFilter = type;
    
    // UI Update
    const btns = ['all', 'trafik', 'kasko', 'koltuk'];
    btns.forEach(id => {
        const btn = document.getElementById('police-btn-' + id);
        if(!btn) return;
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-500');
    });
    
    let activeBtnId = 'all';
    if(type === 'Trafik Sigortası') activeBtnId = 'trafik';
    else if(type === 'Kasko') activeBtnId = 'kasko';
    else if(type === 'Koltuk Sigortası') activeBtnId = 'koltuk';
    
    const activeBtn = document.getElementById('police-btn-' + activeBtnId);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-500');
        activeBtn.classList.add('bg-orange-500', 'text-white');
    }
    
    fetchPoliceler();
};

async function fetchPoliceler() {
    const tbody = document.getElementById('police-tbody');
    if (!tbody) return;
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        const { data, error } = await window.supabaseClient.from('arac_policeler').select('*, araclar:araclar(plaka), cariler:cariler(unvan)').order('id', { ascending: false });
        if (error) throw error;
        
        let filteredData = data;
        if (window.currentPoliceFilter !== 'HEPSİ') {
            const searchTerm = window.currentPoliceFilter.replace(' Sigortası', '').toLowerCase();
            filteredData = data.filter(p => p.police_turu && p.police_turu.toLowerCase().includes(searchTerm));
        }

        const isDetailed = window.isDetailedViewPolice || false;
        
        const thead = document.getElementById('police-thead');
        if(thead) {
            if(isDetailed) {
                thead.innerHTML = `<tr><th>Araç Plaka</th><th>Poliçe Tipi & Acente</th><th>Başlangıç & Bitiş D.</th><th>Tutar, Taksit & Açıklama</th><th class="text-right">İşlemler</th></tr>`;
            } else {
                thead.innerHTML = `<tr><th>Araç Plaka</th><th>Poliçe Tipi</th><th>Bitiş D.</th><th>Tutar</th><th class="text-right">İşlemler</th></tr>`;
            }
        }

        tbody.innerHTML = '';
        let totalGider = 0;
        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-400">Poliçe kaydı bulunmuyor.</td></tr>';
            const ozet = document.getElementById('ozet-police');
            if (ozet) ozet.textContent = "0 ₺";
            return;
        }
        filteredData.forEach(p => {
            totalGider += (p.toplam_tutar || 0);
            const isGecerli = new Date(p.bitis_tarihi) > new Date();
            const statusDot = isGecerli ? '<span class="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>' : '<span class="w-2 h-2 rounded-full bg-danger inline-block mr-1"></span>';
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors border-b border-gray-100";
            
            if(isDetailed) {
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap font-bold text-primary">${p.araclar ? p.araclar.plaka : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-gray-700">${p.police_turu}</div>
                        <div class="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">${p.cariler ? p.cariler.unvan : '-'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="block text-xs font-semibold text-gray-800 mb-1">${statusDot}Bitiş: ${p.bitis_tarihi}</span>
                        <span class="block text-[10px] text-gray-500">Başlangıç: ${p.baslangic_tarihi}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="text-sm font-medium text-primary">₺${(p.toplam_tutar || 0).toLocaleString('tr-TR')}</div>
                        <div class="text-[10px] text-gray-500 uppercase mt-0.5 text-center bg-gray-100 rounded-sm py-0.5 inline-block px-2">${p.taksit_sayisi} Taksit</div>
                        ${p.aciklama ? `<div class="text-[10px] text-gray-500 mt-1 max-w-[150px] truncate" title="${p.aciklama}">Not: ${p.aciklama}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                        ${p.dosya_url ? `<a href="${p.dosya_url}" target="_blank" class="inline-flex items-center text-blue-600 hover:text-blue-800" title="Poliçeyi Gör"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></a>` : ''}
                        <button onclick="openModal('Poliçe Düzenle', '${p.id}')" class="text-blue-500 hover:text-blue-700 text-[10px] font-semibold uppercase tracking-wider">Düzenle</button>
                        <button onclick="deleteRecord('arac_policeler', '${p.id}', 'fetchPoliceler')" class="text-danger hover:text-red-800 text-[10px] font-semibold uppercase tracking-wider">Sil</button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="px-6 py-3 whitespace-nowrap font-bold text-gray-800">${p.araclar ? p.araclar.plaka : '-'}</td>
                    <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-600">${p.police_turu}</td>
                    <td class="px-6 py-3 whitespace-nowrap text-xs font-semibold text-gray-700">${statusDot}${p.bitis_tarihi}</td>
                    <td class="px-6 py-3 whitespace-nowrap text-sm font-bold text-orange-600">₺${(p.toplam_tutar || 0).toLocaleString('tr-TR')}</td>
                    <td class="px-6 py-3 whitespace-nowrap text-right text-sm space-x-2">
                        <button onclick="openModal('Poliçe Düzenle', '${p.id}')" class="text-blue-500 hover:text-blue-700 text-[10px] font-semibold uppercase tracking-wider">Düzenle</button>
                        <button onclick="deleteRecord('arac_policeler', '${p.id}', 'fetchPoliceler')" class="text-danger hover:text-red-800 text-[10px] font-semibold uppercase tracking-wider">Sil</button>
                    </td>
                `;
            }
            tbody.appendChild(tr);
        });
        const ozet = document.getElementById('ozet-police');
        const today = new Date();
        const in30days = new Date(today); in30days.setDate(today.getDate() + 30);
        const activePolice = filteredData.filter(p => new Date(p.bitis_tarihi) > today);
        const expiringPolice = filteredData.filter(p => {
            const d = new Date(p.bitis_tarihi);
            return d > today && d <= in30days;
        });
        const activeTutar = activePolice.reduce((s, p) => s + (p.toplam_tutar || 0), 0);
        if (ozet) ozet.textContent = activeTutar.toLocaleString('tr-TR') + " ₺";
        const countEl = document.getElementById('ozet-police-count');
        if (countEl) countEl.textContent = activePolice.length;
        const expiringEl = document.getElementById('ozet-police-expiring');
        const expiringCountEl = document.getElementById('ozet-police-expiring-count');
        if (expiringEl && expiringCountEl) {
            expiringCountEl.textContent = expiringPolice.length;
            expiringEl.classList.toggle('hidden', expiringPolice.length === 0);
        }
    } catch (e) { console.error(e); }
}
async function fetchFinansDashboard() {
    try {
        if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
        const now = new Date();
        const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
        const start = `${y}-${m}-01`;
        const end = `${y}-${m}-${new Date(y, now.getMonth() + 1, 0).getDate()}`;

        // Get Ownership Filter
        const ownerFilter = document.getElementById('fin-filter-owner')?.value || 'Tümü';

        // Fetch Puantaj, Tanimlar, Yakit and Vehicles (for filtering)
        const [puantajRes, tanimRes, yakitRes, aracRes] = await Promise.all([
            window.supabaseClient.from('musteri_servis_puantaj').select('arac_id, vardiya, tek, musteri_id').gte('tarih', start).lte('tarih', end),
            window.supabaseClient.from('musteri_arac_tanimlari').select('musteri_id, arac_id, vardiya_fiyat, tek_fiyat'),
            window.supabaseClient.from('yakit_takip').select('arac_id, toplam_tutar').gte('tarih', start).lte('tarih', end),
            window.supabaseClient.from('araclar').select('id, mulkiyet_durumu')
        ]);

        const aracStatusMap = {};
        (aracRes.data || []).forEach(a => aracStatusMap[a.id] = a.mulkiyet_durumu);

        let totalBrut = 0;
        let totalYakit = 0;

        // Calculate Fuel (Filtered)
        const currentFilter = (ownerFilter || 'TÜMÜ').toUpperCase();
        (yakitRes.data || []).forEach(y => { 
            const mulkiyet = (aracStatusMap[y.arac_id] || 'Diğer').toUpperCase();
            if (currentFilter === 'TÜMÜ' || mulkiyet === currentFilter) {
                totalYakit += parseFloat(y.toplam_tutar) || 0; 
            }
        });

        // Calculate Gross (Filtered)
        if (puantajRes.data) {
            const priceMap = {};
            (tanimRes.data || []).forEach(t => {
                priceMap[`${t.musteri_id}_${t.arac_id}`] = { v: t.vardiya_fiyat || 0, t: t.tek_fiyat || 0 };
            });

            puantajRes.data.forEach(p => {
                const mulkiyet = (aracStatusMap[p.arac_id] || 'Diğer').toUpperCase();
                if (currentFilter === 'TÜMÜ' || mulkiyet === currentFilter) {
                    const key = `${p.musteri_id}_${p.arac_id}`;
                    const prices = priceMap[key] || { v: 0, t: 0 };
                    const v = parseInt(p.vardiya) || 0;
                    const t = parseInt(p.tek) || 0;
                    totalBrut += (v * prices.v) + (t * prices.t);
                }
            });
        }

        const net = totalBrut - totalYakit;
        const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        
        const elBrut = document.getElementById('fin-kpi-brut'); if (elBrut) elBrut.textContent = fmt(totalBrut);
        const elYakit = document.getElementById('fin-kpi-yakit'); if (elYakit) elYakit.textContent = fmt(totalYakit);
        const elNet = document.getElementById('fin-kpi-net'); if (elNet) elNet.textContent = fmt(net);
        
        const legacyMaas = document.getElementById('fin-kpi-maas'); if (legacyMaas) legacyMaas.textContent = '—';

    } catch (e) { console.error("fetchFinansDashboard error:", e); }
}

async function fetchTekliflerLegacy() {
    const tbody = document.getElementById('teklifler-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="py-12 text-center text-gray-500 italic"><i data-lucide="loader-2" class="animate-spin w-5 h-5 mx-auto mb-2"></i>Teklifler güncelleniyor...</td></tr>';

    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-red-500">${conn.msg}</td></tr>`;
            return;
        }

        const { data: teklifler, error: tErr } = await window.supabaseClient
            .from('sigorta_teklifleri')
            .select('*, araclar(plaka)')
            .order('olusturulma_tarihi', { ascending: false });

        if (tErr) throw tErr;

        const tekliflerClean = window.sanitizeDataArray(teklifler || []);

        const validTeklifler = tekliflerClean;

        window._allTeklifData = validTeklifler;

        if (validTeklifler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-12 text-center text-gray-400">Henüz teklif bulunmuyor.</td></tr>';
            return;
        }

        const flatTeklifler = validTeklifler.map(t => ({ ...t, plaka: t.araclar ? t.araclar.plaka : '-' }));
        const bestPrices = {};
        flatTeklifler.forEach(t => {
            const pType = (t.secenekler || {}).teklif_turu || t.police_turu || 'Trafik Sigortası';
            const key = t.arac_id + '_' + pType;
            if (!bestPrices[key] || t.tutar < bestPrices[key]) {
                bestPrices[key] = t.tutar;
            }
        });

        tbody.innerHTML = '';
        flatTeklifler.forEach(t => {
            const opts = t.secenekler || {};
            const pType = opts.teklif_turu || t.police_turu || 'Trafik Sigortası';
            const key = t.arac_id + '_' + pType;
            
            const isBest = t.tutar === bestPrices[key];
            const isSelected = t.secildi;

            let typeBadge = '';
            if (pType.includes('Kasko')) typeBadge = '<span class="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-[10px] font-bold uppercase tracking-widest">Kasko</span>';
            else if (pType.includes('Koltuk')) typeBadge = '<span class="px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-bold uppercase tracking-widest">Koltuk</span>';
            else typeBadge = '<span class="px-2 py-0.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded text-[10px] font-bold uppercase tracking-widest">Trafik</span>';

            const optList = [];
            if (opts.imm) optList.push(`<div class="whitespace-nowrap"><span class="text-[9px] font-bold text-green-400">İMM:</span> <span class="text-[9px] text-gray-400">${opts.imm_limit || '-'}</span></div>`);
            if (opts.yol_yardim) optList.push(`<div class="whitespace-nowrap"><span class="text-[9px] font-bold text-green-400">Yol Y.:</span> <span class="text-[9px] text-gray-400">Dahil</span></div>`);
            if (opts.ikame_arac) optList.push(`<div class="whitespace-nowrap"><span class="text-[9px] font-bold text-green-400">İkame:</span> <span class="text-[9px] text-gray-400">${opts.ikame_gun || 'Mevcut'}</span></div>`);

            const tCount = opts.taksit_sayisi || t.taksit_sayisi || 1;
            const taksitHtml = tCount > 1
                ? `<div class="text-[10px] font-bold text-blue-400">${tCount} Taksit</div><div class="text-[9px] text-gray-500">₺${Number(t.tutar / tCount).toLocaleString('tr-TR')} x ${tCount}</div>`
                : `<div class="text-[10px] font-bold text-gray-400">Peşin / Tek Çekim</div>`;

            const tr = document.createElement('tr');
            tr.className = `hover:bg-white/5 transition-colors border-b border-white/5 ${isSelected ? 'bg-green-500/10' : ''}`;
            tr.innerHTML = `
                <td class="px-5 py-3 whitespace-nowrap text-xs font-bold text-white">
                    <div class="flex items-center gap-2">
                        ${t.plaka}
                        ${isBest && !isSelected ? '<span class="px-1.5 py-0.5 bg-orange-500 text-[8px] text-white rounded font-bold uppercase">En Uygun</span>' : ''}
                        ${isSelected ? '<span class="px-1.5 py-0.5 bg-green-500 text-[8px] text-white rounded font-bold uppercase">✓ Seçildi</span>' : ''}
                    </div>
                </td>
                <td class="px-5 py-3 whitespace-nowrap text-xs">${typeBadge}</td>
                <td class="px-5 py-3 whitespace-nowrap text-xs font-semibold text-gray-300">${t.firma_adi || '-'}</td>
                <td class="px-5 py-3 whitespace-nowrap text-right">
                    <div class="text-sm font-bold text-orange-400">₺${Number(t.tutar).toLocaleString('tr-TR')}</div>
                </td>
                <td class="px-5 py-3 whitespace-nowrap text-center">${taksitHtml}</td>
                <td class="px-5 py-3 whitespace-nowrap">
                    <div class="flex flex-col gap-0.5">${optList.length > 0 ? optList.join('') : '<span class="text-[10px] text-gray-600 italic">Standart</span>'}</div>
                </td>
                <td class="px-5 py-3 whitespace-nowrap text-xs text-gray-500">${t.olusturulma_tarihi ? t.olusturulma_tarihi.split('T')[0] : t.baslangic_tarihi || '-'}</td>
                <td class="px-5 py-3 whitespace-nowrap text-right">
                    <div class="flex items-center justify-end gap-2">
                        ${!isSelected ? `<button onclick="window.confirmTeklifOnay('${t.id}')" class="text-[10px] text-green-400 hover:text-green-300 font-bold border border-green-500/30 px-2 py-1 rounded-lg">Onaylandı</button>` : ''}
                        <button onclick="deleteRecord('sigorta_teklifleri', '${t.id}', 'fetchTeklifler')" class="text-red-500 hover:text-red-400 p-1.5 bg-red-500/10 rounded border border-red-500/20">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();

        // Sync comparison view if open
        if (!document.getElementById('teklif-compare-view')?.classList.contains('hidden')) {
            window.renderTeklifCompare();
        }

    } catch (e) {
        console.error("Teklif Error:", e);
        tbody.innerHTML = `<tr><td colspan="8" class="py-12 text-center text-red-500 font-bold">⚠️ Hata: ${e.message || 'Veriler yüklenemedi'}</td></tr>`;
    }
};

window.fetchTeklifler = async function () {
    const tbody = document.getElementById('teklifler-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="bf-table-state">Teklifler güncelleniyor...</td></tr>';
    try {
        const [teklifRes, cariRes] = await Promise.all([
            window.supabaseClient.from('sigorta_teklifleri').select('*, araclar(plaka)').order('olusturulma_tarihi', { ascending: false }),
            window.supabaseClient.from('cariler').select('id, unvan')
        ]);
        if (teklifRes.error) throw teklifRes.error;
        if (cariRes.error) throw cariRes.error;
        const cariMap = Object.fromEntries((cariRes.data || []).map(cari => [cari.id, cari.unvan]));
        window._allTeklifData = (teklifRes.data || []).map(teklif => ({
            ...teklif,
            cari_unvan: cariMap[teklif.cari_id] || teklif.firma_adi || '—',
            plaka: teklif.araclar?.plaka || '—'
        }));
        window.renderTeklifList();
    } catch (error) {
        console.error('[TEKLİFLER] Liste yüklenemedi:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="bf-table-state">Teklifler yüklenemedi. Lütfen tekrar deneyin.</td></tr>';
    }
};

window.renderTeklifList = function () {
    const tbody = document.getElementById('teklifler-tbody');
    if (!tbody) return;
    const allOffers = window._allTeklifData || [];
    const query = (document.getElementById('teklif-filtre-ara')?.value || '').trim().toLocaleLowerCase('tr-TR');
    const statusFilter = document.getElementById('teklif-filtre-durum')?.value || '';
    const formatMoney = value => window.formatCurrency(Number(value) || 0);
    const formatDate = value => value ? new Date(value).toLocaleDateString('tr-TR') : '—';
    const formatDateTime = value => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
    const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    const totalEl = document.getElementById('teklif-kpi-total');
    const pendingEl = document.getElementById('teklif-kpi-pending');
    const approvedEl = document.getElementById('teklif-kpi-approved');
    const valueEl = document.getElementById('teklif-kpi-value');
    if (totalEl) totalEl.textContent = allOffers.length;
    if (pendingEl) pendingEl.textContent = allOffers.filter(item => ['Taslak', 'Gönderildi'].includes(window.TeklifManagement.getStatus(item))).length;
    if (approvedEl) approvedEl.textContent = allOffers.filter(item => window.TeklifManagement.getStatus(item) === 'Onaylandı').length;
    if (valueEl) valueEl.textContent = formatMoney(allOffers.reduce((sum, item) => sum + (Number(item.tutar) || 0), 0));

    const offers = allOffers.filter(offer => {
        const status = window.TeklifManagement.getStatus(offer);
        const number = window.TeklifManagement.displayNumber(offer);
        const subject = offer.secenekler?.konu || offer.secenekler?.teklif_turu || '';
        const haystack = `${number} ${offer.cari_unvan} ${subject} ${offer.plaka}`.toLocaleLowerCase('tr-TR');
        return (!query || haystack.includes(query)) && (!statusFilter || status === statusFilter);
    });

    if (!offers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="bf-table-state">Seçilen kriterlere uygun teklif bulunamadı.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    offers.forEach(offer => {
        const status = window.TeklifManagement.getStatus(offer);
        const options = offer.secenekler || {};
        const canApprove = window.TeklifManagement.canApprove(offer);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><div class="bf-offer-number">${escapeText(window.TeklifManagement.displayNumber(offer))}</div><div class="bf-offer-subject">${escapeText(options.konu || `${offer.plaka} · ${options.teklif_turu || offer.police_turu || 'Poliçe'}`)}</div></td>
            <td><strong class="text-gray-200">${escapeText(offer.cari_unvan)}</strong><div class="bf-offer-subject">${escapeText(offer.plaka)}</div></td>
            <td>${escapeText(formatDate(options.teklif_tarihi || offer.olusturulma_tarihi || offer.baslangic_tarihi))}</td>
            <td class="text-right"><strong class="text-gray-100">${escapeText(formatMoney(offer.tutar))}</strong></td>
            <td><span class="bf-offer-status" data-status="${escapeText(status)}">${escapeText(status)}</span></td>
            <td>${escapeText(formatDateTime(options.son_islem || offer.olusturulma_tarihi))}</td>
            <td><div class="bf-offer-actions">
                <button type="button" class="bf-offer-action js-offer-detail">Detay</button>
                <select class="bf-offer-status-select js-offer-status" aria-label="Teklif durumunu değiştir" ${status === 'Onaylandı' ? 'disabled' : ''}>
                    <option value="Taslak" ${status === 'Taslak' ? 'selected' : ''}>Taslak</option>
                    <option value="Gönderildi" ${status === 'Gönderildi' ? 'selected' : ''}>Gönderildi</option>
                    <option value="Reddedildi" ${status === 'Reddedildi' ? 'selected' : ''}>Reddedildi</option>
                    <option value="İptal" ${status === 'İptal' ? 'selected' : ''}>İptal</option>
                    ${status === 'Onaylandı' ? '<option selected>Onaylandı</option>' : ''}
                </select>
                <button type="button" class="bf-offer-action is-approve js-offer-approve" ${canApprove ? '' : 'disabled'}>Onaylandı</button>
            </div></td>`;
        row.querySelector('.js-offer-detail').addEventListener('click', () => window.openTeklifDetay(offer.id));
        row.querySelector('.js-offer-status').addEventListener('change', event => window.updateTeklifDurum(offer.id, event.target.value));
        if (canApprove) row.querySelector('.js-offer-approve').addEventListener('click', () => window.confirmTeklifOnay(offer.id));
        tbody.appendChild(row);
    });
};


/* ==========================================
   BORDRO SATIR GÜNCELLEME (INPLACE EDIT)
   ========================================== */
window.updateBordroRow = async function (soforId, field, value, kayitId) {
    try {
        const donem = document.getElementById('filter-bordro-ay')?.value;
        if (!donem || !soforId) return;

        const numVal = parseFloat(value) || 0;
        const row = document.querySelector(`[data-sofor-id="${soforId}"]`);
        const getInput = (f) => parseFloat(row?.querySelector(`input[data-field="${f}"]`)?.value || 0);

        const updateObj = { [field]: numVal };
        let calculatedNet = null;

        if (field === 'calisma_gun') {
            const gunlukUcret = parseFloat(row?.getAttribute('data-gunluk-ucret') || 0);
            const aylikMaas = parseFloat(row?.getAttribute('data-aylik-maas') || 0);
            const dailyRate = gunlukUcret > 0 ? gunlukUcret : (aylikMaas / 30);
            if (dailyRate > 0) {
                calculatedNet = numVal * dailyRate;
                updateObj.net_maas = calculatedNet;
                const netInput = row?.querySelector(`input[data-field="net_maas"]`);
                if (netInput) netInput.value = calculatedNet;
            }
        }

        if (kayitId && kayitId !== 'undefined' && kayitId !== 'null' && kayitId !== '') {
            // Var olan kaydı güncelle - sadece değişen alan
            const { error } = await window.supabaseClient
                .from('sofor_maas_bordro')
                .update(updateObj)
                .eq('id', kayitId);
            if (error) throw error;

            // Sync dashboard & maaş hakedişleri
            if (window.fetchFinansDashboard) window.fetchFinansDashboard();
            if (window.fetchSoforMaaslar) window.fetchSoforMaaslar();
        } else {
            // İLK kaydet: tüm satır inputlarını topla (net_maas silinmesin)
            const rowData = {
                sofor_id: soforId,
                donem,
                net_maas: calculatedNet !== null ? calculatedNet : getInput('net_maas'),
                avans: getInput('avans'),
                ceza: getInput('ceza'),
                haciz: getInput('haciz'),
                mk_banka: getInput('mk_banka'),
                ideol_banka: getInput('ideol_banka'),
                calisma_gun: getInput('calisma_gun')
            };
            rowData[field] = numVal;

            const { data: newRec, error } = await window.supabaseClient
                .from('sofor_maas_bordro')
                .insert([rowData])
                .select('id')
                .single();
            if (error) throw error;

            // Yeni kayit ID'sini tüm satır inputlarına yaz
            // (bir sonraki değişiklikte INSERT yerine UPDATE yapsın)
            if (newRec?.id && row) {
                // Sync dashboard & maaş hakedişleri
                if (window.fetchFinansDashboard) window.fetchFinansDashboard();
                if (window.fetchSoforMaaslar) window.fetchSoforMaaslar();

                row.querySelectorAll('input[data-field]').forEach(inp => {
                    const f = inp.getAttribute('data-field');
                    inp.setAttribute('onchange', `updateBordroRow('${soforId}','${f}',this.value,'${newRec.id}')`);
                });
                // Find actions panel safely
                const actionCell = row.querySelector('.flex.justify-end.pt-1') || row.querySelector('div.puantaj-edit-panel');
                if (actionCell && !row.querySelector('.bordro-del-btn')) {
                    if (actionCell.classList.contains('puantaj-edit-panel')) {
                        const delDiv = document.createElement('div');
                        delDiv.className = 'flex justify-end pt-1';
                        delDiv.innerHTML = `<button onclick="deleteRecord('sofor_maas_bordro','${newRec.id}','fetchSoforMaasBordro')" class="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 bordro-del-btn"><i data-lucide="trash-2" class="w-3 h-3"></i>Kaydı Sil</button>`;
                        actionCell.appendChild(delDiv);
                    }
                }
            }
        }

        // Elden kolonunu anlık hesapla
        if (row) {
            const net = calculatedNet !== null ? calculatedNet : getInput('net_maas');
            const topKesinti = getInput('avans') + getInput('ceza') + getInput('haciz') + getInput('mk_banka') + getInput('ideol_banka');
            const elden = Math.max(0, net - topKesinti);

            // Visual Updates (Card Header Net Maaş)
            const netMaasHeader = row.querySelector('.text-lg.font-black.text-white');
            if (netMaasHeader) {
                netMaasHeader.textContent = '₺' + net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }

            // Visual Updates (Kesinti & Elden displays)
            const kesintilerSpan = row.querySelector('span.text-\\[9px\\].text-gray-500');
            const eldenSpan = row.querySelector('span.text-\\[9px\\].font-bold.text-yellow-400');
            if (kesintilerSpan) kesintilerSpan.textContent = `Kesintiler: ₺${topKesinti.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (eldenSpan) eldenSpan.textContent = `Elden: ₺${elden.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            // Progress Bar Visual Updates
            const progressBars = row.querySelectorAll('.h-full');
            if (progressBars.length) {
                const paidPct = net > 0 ? Math.min(100, Math.round((topKesinti / net) * 100)) : 0;
                const eldenPct = 100 - paidPct;
                // Since this might not be robust, reloading might be easier, but we can do simple math if the bars exist
                if (progressBars[0] && progressBars[0].title === 'Kesintiler') progressBars[0].style.width = `${paidPct}%`;
                if (progressBars[1] && progressBars[1].title === 'Elden') progressBars[1].style.width = `${eldenPct}%`;
            }
        }

        // Toplamları arka planda temizce DB'den yeniden hesapla ve UI'a yansıt
        if (window.refreshPuantajTotals) {
            window.refreshPuantajTotals();
        }

    } catch (e) {
        console.error('[BORDRO UPDATE]', e);
        showToast('❌ Kayıt güncellenemedi: ' + (e.message || 'Bilinmeyen hata'), 'error');
    }
};

/* ==========================================
   AUTH - KULLANICI GİRİŞİ / ÇIKIŞ
   ========================================== */
window.doLogin = async function () {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errBox = document.getElementById('auth-error');
    const btn = document.getElementById('auth-login-btn');

    if (!email || !password) {
        errBox.textContent = 'E-posta ve şifre zorunludur.';
        errBox.classList.remove('hidden');
        return;
    }

    const setLoginButton = (loading) => {
        btn.innerHTML = loading
            ? 'Giriş yapılıyor... <span aria-hidden="true">…</span>'
            : 'Güvenli giriş yap <span aria-hidden="true">→</span>';
    };

    setLoginButton(true);
    btn.disabled = true;
    errBox.classList.add('hidden');

    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') {
        document.getElementById('auth-overlay').style.display = 'none';
        setLoginButton(false);
        btn.disabled = false;
        if (typeof window.initApp === 'function') window.initApp();
        return;
    }

    // 10 sn timeout — fetch takılırsa butonu kurtarır
    const timeout = setTimeout(() => {
        setLoginButton(false);
        btn.disabled = false;
        errBox.textContent = '⏱ Bağlantı zaman aşımı. İnternet bağlantınızı kontrol edin.';
        errBox.classList.remove('hidden');
    }, 10000);

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        clearTimeout(timeout);

        if (error) {
            errBox.textContent = 'Giriş başarısız: ' + (error.message || 'Hatalı e-posta veya şifre.');
            errBox.classList.remove('hidden');
            setLoginButton(false);
            btn.disabled = false;
            return;
        }

        const autoLogin = document.getElementById('auth-auto-login');
        if (autoLogin && autoLogin.checked) {
            localStorage.setItem('ideol-auto-login', '1');
        } else {
            localStorage.removeItem('ideol-auto-login');
        }

        // Başarılı giriş
        if (typeof window.clearViewDataCache === 'function') window.clearViewDataCache();
        document.getElementById('auth-overlay').style.display = 'none';
        setLoginButton(false);
        btn.disabled = false;

        const user = data.user;
        const userNameEl = document.getElementById('user-display-name');
        if (userNameEl && user) {
            const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
            userNameEl.textContent = displayName.substring(0, 2).toUpperCase();
            userNameEl.title = user.email;
        }

        if (typeof window.initApp === 'function') window.initApp();

    } catch (err) {
        clearTimeout(timeout);
        setLoginButton(false);
        btn.disabled = false;
        const msg = err?.message || String(err);
        errBox.textContent = '❌ Hata: ' + msg;
        errBox.classList.remove('hidden');
        console.error('[LOGIN]', err);
    }
};

window.doLogout = async function () {
    localStorage.removeItem('ideol-auto-login');
    if (typeof window.clearViewDataCache === 'function') window.clearViewDataCache();
    if (window.supabaseUrl !== 'YOUR_SUPABASE_URL') {
        await window.supabaseClient.auth.signOut();
    }
    // Auth overlay'i tekrar göster
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'flex';
    // Form alanlarını temizle
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-password');
    if (emailEl) emailEl.value = '';
    if (passEl) passEl.value = '';
};

/* ==========================================
   TEKLİF YÖNETİMİ
   ========================================== */
window.setTeklifView = function (mode) {
    const tableView = document.getElementById('teklif-table-view');
    const compareView = document.getElementById('teklif-compare-view');
    const btnTable = document.getElementById('teklif-view-table');
    const btnCompare = document.getElementById('teklif-view-compare');
    if (mode === 'table') {
        tableView?.classList.remove('hidden');
        compareView?.classList.add('hidden');
        btnTable?.classList.add('bg-orange-500', 'text-white');
        btnTable?.classList.remove('text-gray-400', 'hover:bg-white/10');
        btnCompare?.classList.remove('bg-orange-500', 'text-white');
        btnCompare?.classList.add('text-gray-400', 'hover:bg-white/10');
    } else {
        tableView?.classList.add('hidden');
        compareView?.classList.remove('hidden');
        btnCompare?.classList.add('bg-orange-500', 'text-white');
        btnCompare?.classList.remove('text-gray-400', 'hover:bg-white/10');
        btnTable?.classList.remove('bg-orange-500', 'text-white');
        btnTable?.classList.add('text-gray-400', 'hover:bg-white/10');
        window.renderTeklifCompare();
    }
};

// Mükerrer fetchTeklifler kaldırıldı. Tek ve güncel versiyon satır 2419'da.
window.renderTeklifCompare = function () {
    const container = document.getElementById('teklif-compare-container');
    if (!container) return;
    const data = window._allTeklifData || [];

    if (data.length === 0) {
        container.innerHTML = '<div class="dashboard-card py-12 text-center text-gray-500"><p>Karşılaştırılacak teklif yok.</p></div>';
        return;
    }
    const groups = {};
    data.forEach(t => {
        let normTur = 'Bilinmeyen';
        const rawTur = (t.police_turu || '').toLowerCase().trim();
        if (rawTur.includes('kasko')) normTur = 'Kasko';
        else if (rawTur.includes('koltuk')) normTur = 'Koltuk';
        else if (rawTur.includes('trafik') || rawTur.includes('zorunlu') || rawTur.includes('sigort')) normTur = 'Trafik';
        else normTur = t.police_turu || 'Bilinmeyen';

        const key = `${t.arac_id}|${normTur}`;
        if (!groups[key]) groups[key] = { plaka: t.araclar?.plaka || '?', tur: normTur, teklifler: [] };
        groups[key].teklifler.push(t);
    });

    const fmt = v => v != null ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v) + ' ₺' : '—';
    container.innerHTML = Object.values(groups).map(g => {
        const sorted = [...g.teklifler].sort((a, b) => (a.tutar || 0) - (b.tutar || 0));
        const minTutar = sorted[0]?.tutar || 0;
        const cols = sorted.map(t => {
            const isMin = t.tutar === minTutar;
            const isSelected = t.secildi;
            const border = isSelected ? 'border-green-500/50' : isMin ? 'border-orange-500/40' : 'border-white/10';
            const badge = isSelected
                ? '<div class="text-[10px] font-black text-green-400 text-center mb-2">✓ SEÇİLDİ</div>'
                : isMin ? '<div class="text-[10px] font-black text-orange-400 text-center mb-2">★ En Uygun</div>' : '';
            return `<div class="flex-1 min-w-[180px] dashboard-card border ${border} flex flex-col gap-2 p-4">
                ${badge}
                <div class="text-sm font-bold text-center">${t.firma_adi || 'Firma?'}</div>
                <div class="text-xl font-black text-center ${isMin ? 'text-orange-400' : 'text-white'}">${fmt(t.tutar)}</div>
                <div class="text-[10px] text-gray-500 text-center">${t.taksit_sayisi ? t.taksit_sayisi + ' taksit' : 'Peşin'}</div>
                ${!isSelected ? `<button onclick="window.confirmTeklifOnay('${t.id}')" class="mt-2 text-[10px] font-bold border border-green-500/30 text-green-400 hover:bg-green-500/10 rounded-lg py-1.5 transition-all">Onaylandı</button>` : ''}
            </div>`;
        }).join('');
        return `<div class="dashboard-card mb-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <span class="font-black text-base text-white">${g.plaka}</span>
                    <span class="ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">${g.tur}</span>
                </div>
                <span class="text-xs text-gray-500">${sorted.length} firma teklifi</span>
            </div>
            <div class="flex gap-3 flex-wrap">${cols}</div>
        </div>`;
    }).join('');
};


async function teklifSecLegacy(id) {
    if (!id) return;
    try {
        const row = _allTeklifData.find(t => t.id === id);
        if (!row) return;

        const opts = row.secenekler || {};
        const taksit_sayisi = opts.taksit_sayisi || row.taksit_sayisi || 1;
        const teklif_turu = opts.teklif_turu || row.police_turu || 'Trafik';

        // Cari ID'yi güvenceye al (Eski kayıtlarda ID yoksa unvandan bul)
        let resolvedCariId = row.cari_id;
        if (!resolvedCariId && row.firma_adi && window._cariMap) {
            const bul = Object.values(window._cariMap).find(c => c.unvan === row.firma_adi);
            if (bul) resolvedCariId = bul.id;
        }

        // Başlangıç - Bitiş tarihlerini ayarla
        const baslangic_tarihi = row.baslangic_tarihi || new Date().toISOString().split('T')[0];
        let bitis_tarihi = row.bitis_tarihi;
        if (!bitis_tarihi) {
            // Poliçe bitişi standart 1 yıl sonrasıdır
            const bd = new Date(baslangic_tarihi);
            bd.setFullYear(bd.getFullYear() + 1);
            bitis_tarihi = bd.toISOString().split('T')[0];
        }

        // --- 1. ÖNCE POLİÇE KAYDINI OLUŞTUR (HATA VERİRSE BURADA KESSİN, BUTON GİTMESİN) ---
        const policeData = {
            arac_id: row.arac_id,
            police_turu: teklif_turu,
            toplam_tutar: row.tutar,
            taksit_sayisi: taksit_sayisi,
            baslangic_tarihi: baslangic_tarihi,
            bitis_tarihi: bitis_tarihi,
            cari_id: resolvedCariId || null
        };

        const { error: pErr } = await window.supabaseClient.from('arac_policeler').insert([policeData]);
        if (pErr) {
            console.error('[TEKLİFSEC] Poliçe Oluşturma Hatası:', pErr.message);
            if (typeof showToast === 'function') showToast('❌ Poliçe oluşturulamadı: ' + pErr.message, 'error');
            return; // Hata varsa burada kes, işlem devam etmesin
        }


        // --- 3. ARAÇ BİTİŞ TARİHLERİNİ GÜNCELLE ---
        const updateData = {};
        const turLower = String(teklif_turu).trim().toLowerCase();

        if (turLower.includes('kasko')) {
            updateData.kasko_bitis = bitis_tarihi;
        } else if (turLower.includes('trafik') || turLower.includes('sigort') || turLower.includes('zorunlu')) {
            updateData.sigorta_bitis = bitis_tarihi;
        } else if (turLower.includes('koltuk')) {
            updateData.koltuk_bitis = bitis_tarihi;
        }

        if (Object.keys(updateData).length > 0) {

            const { data: aracRes, error: updError } = await window.supabaseClient.from('araclar').update(updateData).eq('id', row.arac_id).select();
            if (updError) {
                if (updError.message && updError.message.toLowerCase().includes('could not find') && updateData.koltuk_bitis) {
                    delete updateData.koltuk_bitis;
                    if (Object.keys(updateData).length > 0) {
                        await window.supabaseClient.from('araclar').update(updateData).eq('id', row.arac_id);
                    }
                } else {
                    console.error("[TEKLİFSEC] Araç tarih güncelleme hatası:", updError);
                    if (typeof showToast === 'function') showToast('⚠️ Poliçe kesildi ancak araç tarihleri güncellenemedi: ' + updError.message, 'warning');
                }
            } else {

            }
        } else {
            console.warn(`[TEKLİFSEC] Poliçe türü (${teklif_turu}) tanınmadığı için aracın vize/kasko/sigorta tarihleri güncellenmedi.`);
        }

        // --- 4. HER ŞEY BAŞARILI İSE TEKLİFİ 'SEÇİLDİ' OLARAK İŞARETLE (Zaman Damgası Ekle) ---
        await window.supabaseClient.from('sigorta_teklifleri')
            .update({ secildi: false })
            .eq('arac_id', row.arac_id);

        const updatedOpts = { ...opts, secilme_zamani: Date.now() };
        await window.supabaseClient.from('sigorta_teklifleri')
            .update({ secildi: true, secenekler: updatedOpts })
            .eq('id', id);
    } catch (err) {
        console.error('[TEKLİFSEC] Hata:', err);
    }
};

// Güvenli teklif durum akışı: yalnızca koşullu olarak sahiplenilen teklif poliçeye dönüşür.
window.confirmTeklifOnay = function (id) {
    window.showConfirm(
        'Bu teklifi onaylamak ve ilgili cariye işlemek istediğinize emin misiniz?',
        () => window.teklifSec(id),
        { title: 'Teklifi Onayla', confirmText: 'Onayla ve Cari’ye İşle', tone: 'success' }
    );
};

window.updateTeklifDurum = async function (id, nextStatus) {
    if (!id || nextStatus === 'Onaylandı') return window.confirmTeklifOnay(id);
    try {
        const { data: current, error: readError } = await window.supabaseClient
            .from('sigorta_teklifleri').select('id, secildi, secenekler').eq('id', id).single();
        if (readError) throw readError;
        if (window.TeklifManagement.getStatus(current) === 'Onaylandı') {
            throw new Error('Onaylanmış teklifin durumu değiştirilemez.');
        }
        const transition = window.TeklifManagement.transition(current, nextStatus, new Date().toISOString());
        const { data: changed, error } = await window.supabaseClient.from('sigorta_teklifleri')
            .update({ secildi: false, secenekler: transition.options })
            .eq('id', id)
            .or('secildi.is.null,secildi.eq.false')
            .select('id');
        if (error) throw error;
        if (!changed?.length) throw new Error('Onaylanmış teklifin durumu değiştirilemez.');
        if (window.Toast) window.Toast.success(`Teklif durumu ${transition.status} olarak güncellendi.`);
        await window.fetchTeklifler();
    } catch (error) {
        console.error('[TEKLİF DURUM]', error);
        if (window.Toast) window.Toast.error(error.message || 'Teklif durumu güncellenemedi.');
        await window.fetchTeklifler();
    }
};

window.openTeklifDetay = function (id) {
    const offer = (window._allTeklifData || []).find(item => item.id === id);
    if (!offer) return;
    const options = offer.secenekler || {};
    const status = window.TeklifManagement.getStatus(offer);
    const lines = Array.isArray(options.kalemler) ? options.kalemler : [];
    const totals = lines.length ? window.TeklifManagement.calculateTotals(lines) : {
        araToplam: Number(options.ara_toplam ?? offer.tutar) || 0,
        kdv: Number(options.kdv_toplam) || 0,
        genelToplam: Number(offer.tutar) || 0,
        lines: []
    };
    const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const formatDateTime = value => value ? new Date(value).toLocaleString('tr-TR') : '—';
    const lineRows = totals.lines.length ? totals.lines.map(line => `
        <tr><td>${escapeText(line.aciklama || '—')}</td><td>${line.miktar}</td><td class="text-right">${window.formatCurrency(line.birim_fiyat)}</td><td class="text-right">%${line.kdv_oran}</td><td class="text-right"><strong>${window.formatCurrency(line.toplam)}</strong></td></tr>`).join('')
        : '<tr><td colspan="5" class="bf-table-state">Bu eski kayıtta kalem detayı bulunmuyor.</td></tr>';
    const history = Array.isArray(options.gecmis) ? options.gecmis : [];
    const historyHtml = history.length ? history.slice().reverse().map(item => `<li><span>${escapeText(item.durum)}</span><time>${escapeText(formatDateTime(item.tarih))}</time></li>`).join('') : '<li><span>Geçmiş aksiyon bulunmuyor.</span></li>';
    const modalEl = document.getElementById('general-modal');
    const body = document.getElementById('modal-dynamic-body');
    document.getElementById('modal-title').textContent = window.TeklifManagement.displayNumber(offer);
    modalEl.classList.add('bf-offer-modal');
    body.innerHTML = `
        <div class="bf-offer-detail-head"><div><span>Cari / Müşteri</span><strong>${escapeText(offer.cari_unvan)}</strong></div><div><span>Teklif Tarihi</span><strong>${escapeText(options.teklif_tarihi || String(offer.olusturulma_tarihi || '').slice(0, 10) || '—')}</strong></div><div><span>Durum</span><strong><span class="bf-offer-status" data-status="${escapeText(status)}">${escapeText(status)}</span></strong></div></div>
        <div class="bf-offer-detail-subject"><span>Teklif Konusu</span><p>${escapeText(options.konu || options.teklif_turu || 'Poliçe teklifi')}</p></div>
        <div class="bf-table-shell"><table class="bf-data-table"><thead><tr><th>Açıklama</th><th>Miktar</th><th class="text-right">Birim Fiyat</th><th class="text-right">KDV</th><th class="text-right">Toplam</th></tr></thead><tbody>${lineRows}</tbody></table></div>
        <div class="bf-offer-detail-bottom"><ul class="bf-offer-history">${historyHtml}</ul><div class="bf-offer-totals"><div><span>Ara toplam</span><strong>${window.formatCurrency(totals.araToplam)}</strong></div><div><span>KDV</span><strong>${window.formatCurrency(totals.kdv)}</strong></div><div><span>Genel toplam</span><strong>${window.formatCurrency(totals.genelToplam)}</strong></div></div></div>`;
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    modalEl.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
};

window.teklifSec = async function (id) {
    if (!id) return;
    let claimedOffer = null;
    try {
        const { data: current, error: readError } = await window.supabaseClient
            .from('sigorta_teklifleri').select('*, araclar(plaka)').eq('id', id).single();
        if (readError) throw readError;
        const decision = window.TeklifManagement.transition(current, 'Onaylandı', new Date().toISOString());
        if (!decision.shouldCreatePolicy) {
            const message = decision.alreadyProcessed ? 'Bu teklif daha önce onaylanmış ve cariye işlenmiş.' : 'Bu teklif mevcut durumunda onaylanamaz.';
            if (window.Toast) window.Toast.info(message);
            await window.fetchTeklifler();
            return;
        }

        let resolvedCariId = current.cari_id;
        if (!resolvedCariId && current.firma_adi) {
            const { data: matchingCari, error: cariError } = await window.supabaseClient.from('cariler').select('id').eq('unvan', current.firma_adi).limit(1).maybeSingle();
            if (cariError) throw cariError;
            resolvedCariId = matchingCari?.id || null;
        }
        if (!resolvedCariId) throw new Error('Teklifin bağlı olduğu cari bulunamadı.');

        const claimOptions = { ...decision.options, onay_isleniyor: true };
        const { data: claimed, error: claimError } = await window.supabaseClient.from('sigorta_teklifleri')
            .update({ secildi: true, secenekler: claimOptions })
            .eq('id', id)
            .or('secildi.is.null,secildi.eq.false')
            .select('id');
        if (claimError) throw claimError;
        if (!claimed?.length) {
            if (window.Toast) window.Toast.info('Bu teklif başka bir işlem tarafından zaten onaylandı.');
            await window.fetchTeklifler();
            return;
        }
        claimedOffer = { current, claimOptions };

        const options = current.secenekler || {};
        const teklifTuru = options.teklif_turu || current.police_turu || 'Trafik';
        const taksitSayisi = Number(options.taksit_sayisi || current.taksit_sayisi) || 1;
        const baslangicTarihi = options.teklif_tarihi || current.baslangic_tarihi || new Date().toISOString().slice(0, 10);
        let bitisTarihi = options.police_bitis || current.bitis_tarihi;
        if (!bitisTarihi) {
            const endDate = new Date(baslangicTarihi);
            endDate.setFullYear(endDate.getFullYear() + 1);
            bitisTarihi = endDate.toISOString().slice(0, 10);
        }

        const policyMarker = `[TEKLİF ID: ${id}]`;
        const { data: existingPolicy, error: existingPolicyError } = await window.supabaseClient
            .from('arac_policeler').select('id').ilike('aciklama', `%${policyMarker}%`).limit(1);
        if (existingPolicyError) throw existingPolicyError;
        if (!existingPolicy?.length) {
            const { error: policyError } = await window.supabaseClient.from('arac_policeler').insert([{
                arac_id: current.arac_id,
                police_turu: teklifTuru,
                toplam_tutar: current.tutar,
                taksit_sayisi: taksitSayisi,
                baslangic_tarihi: baslangicTarihi,
                bitis_tarihi: bitisTarihi,
                cari_id: resolvedCariId,
                aciklama: `${policyMarker} ${options.konu || 'Onaylanan tekliften oluşturuldu.'}`
            }]);
            if (policyError) throw policyError;
        }

        const vehicleUpdate = {};
        const normalizedType = String(teklifTuru).trim().toLocaleLowerCase('tr-TR');
        if (normalizedType.includes('kasko')) vehicleUpdate.kasko_bitis = bitisTarihi;
        else if (normalizedType.includes('trafik') || normalizedType.includes('sigort') || normalizedType.includes('zorunlu')) vehicleUpdate.sigorta_bitis = bitisTarihi;
        else if (normalizedType.includes('koltuk')) vehicleUpdate.koltuk_bitis = bitisTarihi;
        if (Object.keys(vehicleUpdate).length) {
            const { error: vehicleError } = await window.supabaseClient.from('araclar').update(vehicleUpdate).eq('id', current.arac_id);
            if (vehicleError) console.warn('[TEKLİF ONAY] Araç tarihi güncellenemedi:', vehicleError);
        }

        const finalOptions = { ...claimOptions, onay_isleniyor: false, police_olusturuldu: true, onaylandi_at: new Date().toISOString() };
        const { error: finalError } = await window.supabaseClient.from('sigorta_teklifleri').update({ secildi: true, secenekler: finalOptions }).eq('id', id);
        if (finalError) console.warn('[TEKLİF ONAY] İzleme bilgisi tamamlanamadı:', finalError);
        claimedOffer = null;
        if (window.Toast) window.Toast.success('Teklif onaylandı ve ilgili cariye işlendi.');
        await window.fetchTeklifler();
        if (typeof window.fetchCariler === 'function') window.fetchCariler();
    } catch (error) {
        console.error('[TEKLİF ONAY]', error);
        if (claimedOffer) {
            await window.supabaseClient.from('sigorta_teklifleri').update({
                secildi: claimedOffer.current.secildi ?? false,
                secenekler: claimedOffer.current.secenekler || {}
            }).eq('id', id);
        }
        if (window.Toast) window.Toast.error(error.message || 'Teklif onaylanamadı.');
        await window.fetchTeklifler();
    }
};

window.uploadDosya = async function (file, folder = 'genel') {
    if (!file || window.supabaseUrl === 'YOUR_SUPABASE_URL') return null;
    try {
        const ext = file.name.split('.').pop();
        const dosyaAdi = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data, error } = await window.supabaseClient.storage
            .from('belgeler')
            .upload(dosyaAdi, file, { upsert: true });
        if (error) {
            console.error('[UPLOAD]', error);
            return null;
        }
        const { data: { publicUrl } } = window.supabaseClient.storage.from('belgeler').getPublicUrl(dosyaAdi);
        return publicUrl;
    } catch (e) {
        console.error('[UPLOAD] Hata:', e);
        return null;
    }
};

/**
 * Dosyayı indirir (anchor tıklaması yöntemi)
 */
window.dosyaIndir = function (url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = filename || 'belge';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

/* ==========================================
   AYLIK MAAŞ BORDROSU
   ========================================== */



window.silBordroKayit = async function (kayitId, soforId, adSoyad) {
    if (!confirm(`${adSoyad} isimli personelin bu aya ait bordro kayıtlarını silmek istediğinize emin misiniz?`)) return;

    try {
        const { error } = await window.supabaseClient.from('sofor_maas_bordro').delete().eq('id', kayitId);
        if (error) throw error;

        if (window.fetchSoforMaasBordro) window.fetchSoforMaasBordro();
        if (window.fetchFinansDashboard) window.fetchFinansDashboard();
        if (window.fetchSoforMaaslar) window.fetchSoforMaaslar();

    } catch (e) {
        console.error("Bordro silme hatası:", e);
        alert("Silme başarısız: " + e.message);
    }
};

window.fetchSoforMaasBordro = async function () {
    const grid = document.getElementById('puantaj-cards-grid');
    if (!grid) return;

    const donem = document.getElementById('filter-bordro-ay')?.value;
    if (!donem) return;

    // Update header title
    const baslik = document.getElementById('puantaj-baslik');
    if (baslik) {
        const [y, m] = donem.split('-');
        const ay = new Date(y, m - 1).toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
        baslik.textContent = `${ay} — Personel Puantajı`;
    }

    grid.innerHTML = `<div class="col-span-full py-12 text-center text-gray-500 animate-pulse">Yükleniyor...</div>`;

    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

    try {
        const donemBaslangic = donem + '-01';
        const donemBitisDate = new Date(donem + '-01');
        donemBitisDate.setMonth(donemBitisDate.getMonth() + 1);
        const donemBitisStr = donemBitisDate.toISOString().split('T')[0];

        const [
            { data: soforlerAll, error: sErr },
            { data: araclarData },
            { data: kayitlar },
            { data: finanslar }
        ] = await Promise.all([
            window.supabaseClient.from('soforler').select('id, ad_soyad, tc_no, sigorta_durumu, iban, aylik_maas, gunluk_ucret').order('ad_soyad'),
            window.supabaseClient.from('araclar').select('sofor_id, plaka').not('sofor_id', 'is', null),
            window.supabaseClient.from('sofor_maas_bordro').select('*').eq('donem', donem),
            window.supabaseClient.from('sofor_finans').select('sofor_id, islem_turu, tutar').gte('tarih', donemBaslangic).lt('tarih', donemBitisStr)
        ]);

        if (sErr) throw sErr;

        const aracMap = {};
        (araclarData || []).forEach(a => { aracMap[a.sofor_id] = a.plaka; });

        const kayitMap = {};
        (kayitlar || []).forEach(k => { kayitMap[k.sofor_id] = k; });

        const finansMap = {};
        (finanslar || []).forEach(f => {
            if (!finansMap[f.sofor_id]) finansMap[f.sofor_id] = { avans: 0, ceza: 0, haciz: 0 };
            const tur = (f.islem_turu || '').toLowerCase();
            if (tur.includes('avans')) finansMap[f.sofor_id].avans += Number(f.tutar || 0);
            else if (tur.includes('ceza')) finansMap[f.sofor_id].ceza += Number(f.tutar || 0);
            else if (tur.includes('haciz')) finansMap[f.sofor_id].haciz += Number(f.tutar || 0);
        });

        const allSoforler = soforlerAll || [];
        let totals = { net_maas: 0, avans: 0, banka: 0, elden: 0 };

        if (allSoforler.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-16 text-center text-gray-500">Sistemde şoför kaydı bulunamadı.</div>`;
            return;
        }

        grid.innerHTML = '';

        const fmt = v => v > 0 ? '₺' + Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
        const fmtBold = v => '₺' + Number(v || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        allSoforler.forEach(s => {
            const kayit = kayitMap[s.id];
            const finans = finansMap[s.id] || {};
            const kayitId = kayit?.id || '';
            const plaka = aracMap[s.id] || '';

            let net_maas = Number(s.aylik_maas || 0);
            if (kayit && Number(kayit.net_maas || 0) > 0) {
                net_maas = Number(kayit.net_maas);
            } else {
                let gunlukUcret = Number(kayit?.gunluk_ucret || s.gunluk_ucret) || (Number(s.aylik_maas || 0) / 30) || 0;
                let calisanGun = Number(kayit?.calisma_gun || 0);
                if (calisanGun > 0) {
                    net_maas = calisanGun * gunlukUcret;
                } else {
                    net_maas = 0; // if they haven't worked, they don't get a salary by default unless manually overridden above
                }
            }

            const avans = kayit ? Number(kayit.avans || 0) : Number(finans.avans || 0);
            const ceza = kayit ? Number(kayit.ceza || 0) : Number(finans.ceza || 0);
            const haciz = kayit ? Number(kayit.haciz || 0) : Number(finans.haciz || 0);
            const mk_banka = Number(kayit?.mk_banka || 0);
            const ideol_banka = Number(kayit?.ideol_banka || 0);
            const calisma_gun = kayit?.calisma_gun || 0;
            const topKesinti = avans + ceza + haciz + mk_banka + ideol_banka;
            const elden = Math.max(0, net_maas - topKesinti);

            totals.net_maas += net_maas;
            totals.avans += avans + ceza + haciz;
            totals.banka += mk_banka + ideol_banka;
            totals.elden += elden;

            // Initials avatar color (stable per name)
            const colors = ['bg-orange-500', 'bg-blue-500', 'bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500'];
            const colorIdx = s.ad_soyad.charCodeAt(0) % colors.length;
            const initials = s.ad_soyad.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

            // Status badge
            const sgkBadge = s.sigorta_durumu === 'SGK'
                ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/20 text-blue-400 uppercase">SGK</span>`
                : `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-500/20 text-gray-400 uppercase">${s.sigorta_durumu || 'Belirsiz'}</span>`;

            const plakaTag = plaka
                ? `<span class="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black bg-orange-500/10 text-orange-400"><i data-lucide="truck" class="w-3 h-3"></i>${plaka}</span>`
                : `<span class="text-[10px] text-gray-600">Araç atanmamış</span>`;

            // Progress bar for salary allocation
            const paidPct = net_maas > 0 ? Math.min(100, Math.round((topKesinti / net_maas) * 100)) : 0;
            const eldenPct = 100 - paidPct;

            // Inline input fields
            const inp = (field, val, cls = '', title = '') =>
                `<input type="number" step="0.01" min="0"
                    data-field="${field}" data-sofor-id="${s.id}"
                    value="${val || ''}" placeholder="0"
                    title="${title}"
                    onchange="updateBordroRow('${s.id}','${field}',this.value,'${kayitId}')"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-right text-sm font-bold outline-none focus:border-orange-500 transition-all ${cls}">`;

            const gunInp = `<input type="number" step="1" min="0" max="31"
                    data-field="calisma_gun" data-sofor-id="${s.id}"
                    value="${calisma_gun || ''}" placeholder="0"
                    onchange="updateBordroRow('${s.id}','calisma_gun',this.value,'${kayitId}')"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center text-sm font-black outline-none focus:border-orange-500 transition-all text-white">`;

            const card = document.createElement('div');
            card.className = 'bg-white/3 border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-all group';
            card.setAttribute('data-sofor-id', s.id);
            card.setAttribute('data-gunluk-ucret', s.gunluk_ucret || 0);
            card.setAttribute('data-aylik-maas', s.aylik_maas || 0);
            card.innerHTML = `
                <!-- Card Header -->
                <div class="p-4 flex items-center gap-3 border-b border-white/5">
                    <div class="w-11 h-11 rounded-xl ${colors[colorIdx]} flex items-center justify-center text-white font-black text-sm flex-shrink-0">${initials}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-bold text-white text-sm truncate">${s.ad_soyad}</span>
                            ${sgkBadge}
                        </div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            ${plakaTag}
                            ${s.iban ? `<span class="text-[9px] text-gray-600 font-mono truncate max-w-[140px]" title="${s.iban}">${s.iban}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="text-lg font-black text-white">${fmtBold(net_maas)}</div>
                        <div class="text-[9px] text-gray-500 uppercase tracking-widest">Net Maaş</div>
                    </div>
                </div>

                <!-- Salary Breakdown Chips -->
                <div class="px-4 pt-3 pb-2 flex flex-wrap gap-2">
                    <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span class="text-[10px] font-bold text-blue-400">${calisma_gun > 0 ? calisma_gun + ' Gün' : 'Gün ?'}</span>
                    </div>
                    ${avans > 0 ? `<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg"><span class="w-1.5 h-1.5 rounded-full bg-orange-400"></span><span class="text-[10px] font-bold text-orange-400">Avans: ${fmt(avans)}</span></div>` : ''}
                    ${ceza > 0 ? `<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg"><span class="w-1.5 h-1.5 rounded-full bg-red-400"></span><span class="text-[10px] font-bold text-red-400">Ceza: ${fmt(ceza)}</span></div>` : ''}
                    ${haciz > 0 ? `<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg"><span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span><span class="text-[10px] font-bold text-purple-400">Haciz: ${fmt(haciz)}</span></div>` : ''}
                    ${(mk_banka + ideol_banka) > 0 ? `<div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg"><span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span><span class="text-[10px] font-bold text-indigo-400">Banka: ${fmt(mk_banka + ideol_banka)}</span></div>` : ''}
                </div>

                <!-- Progress Bar -->
                <div class="px-4 pb-3">
                    <div class="flex rounded-full overflow-hidden h-2 bg-white/5">
                        ${paidPct > 0 ? `<div class="h-full bg-orange-500/70" style="width:${paidPct}%" title="Kesintiler"></div>` : ''}
                        ${eldenPct > 0 ? `<div class="h-full bg-yellow-400/70" style="width:${eldenPct}%" title="Elden"></div>` : ''}
                    </div>
                    <div class="flex justify-between mt-1.5">
                        <span class="text-[9px] text-gray-500">Kesintiler: ${fmt(topKesinti)}</span>
                        <span class="text-[9px] font-bold text-yellow-400">Elden: ${fmtBold(elden)}</span>
                    </div>
                </div>

                <!-- Expandable Edit Panel -->
                <div class="border-t border-white/5">
                    <button onclick="togglePuantajEdit(this)" class="w-full px-4 py-2.5 text-[10px] font-bold text-gray-500 hover:text-white hover:bg-white/5 transition-all flex items-center justify-between uppercase tracking-widest">
                        <span class="flex items-center gap-2"><i data-lucide="pencil" class="w-3 h-3"></i>Düzenle / Detay</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 transition-transform puantaj-chevron"></i>
                    </button>
                    <div class="puantaj-edit-panel hidden px-4 pb-4 pt-2 space-y-3 bg-black/20">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Çalışma Günü</label>
                                ${gunInp}
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1">Net Maaş (₺)</label>
                                ${inp('net_maas', net_maas || '', 'text-blue-400')}
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <div>
                                <label class="block text-[9px] font-bold text-orange-400 uppercase tracking-widest mb-1">Avans (₺)</label>
                                ${inp('avans', avans || '', 'text-orange-400')}
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-red-400 uppercase tracking-widest mb-1">Ceza (₺)</label>
                                ${inp('ceza', ceza || '', 'text-red-400')}
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-purple-400 uppercase tracking-widest mb-1">Haciz (₺)</label>
                                ${inp('haciz', haciz || '', 'text-purple-400')}
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">M.K Banka (₺)</label>
                                ${inp('mk_banka', mk_banka || '', '')}
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">İDEOL Banka (₺)</label>
                                ${inp('ideol_banka', ideol_banka || '', 'text-indigo-400')}
                            </div>
                        </div>
                        ${kayit ? `<div class="flex justify-end pt-1"><button onclick="deleteRecord('sofor_maas_bordro','${kayit.id}','fetchSoforMaasBordro')" class="text-[10px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1"><i data-lucide="trash-2" class="w-3 h-3"></i>Kaydı Sil</button></div>` : ''}
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

        // Update totals bar
        const fmtTotal = v => '₺' + Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        const nmEl = document.getElementById('total-net-maas');
        const avEl = document.getElementById('total-avans');
        const bnkEl = document.getElementById('total-ideol-banka');
        const elEl = document.getElementById('total-elden');
        if (nmEl) nmEl.textContent = fmtTotal(totals.net_maas);
        if (avEl) avEl.textContent = totals.avans > 0 ? fmtTotal(totals.avans) : '—';
        if (bnkEl) bnkEl.textContent = totals.banka > 0 ? fmtTotal(totals.banka) : '—';
        if (elEl) elEl.textContent = fmtTotal(totals.elden);

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('[BORDRO]', e);
        grid.innerHTML = `<div class="col-span-full py-12 text-center text-red-400 font-bold">Veri çekilemedi: ${e.message}</div>`;
    }
};

window.refreshPuantajTotals = async function () {
    const donem = document.getElementById('filter-bordro-ay')?.value;
    if (!donem) return;
    try {
        const donemBaslangic = donem + '-01';
        const donemBitisDate = new Date(donem + '-01');
        donemBitisDate.setMonth(donemBitisDate.getMonth() + 1);
        const donemBitisStr = donemBitisDate.toISOString().split('T')[0];

        const [{ data: soforlerAll }, { data: kayitlar }, { data: finanslar }] = await Promise.all([
            window.supabaseClient.from('soforler').select('id, aylik_maas, gunluk_ucret'),
            window.supabaseClient.from('sofor_maas_bordro').select('*').eq('donem', donem),
            window.supabaseClient.from('sofor_finans').select('sofor_id, islem_turu, tutar').gte('tarih', donemBaslangic).lt('tarih', donemBitisStr)
        ]);
        const kayitMap = {};
        (kayitlar || []).forEach(k => { kayitMap[k.sofor_id] = k; });
        const finansMap = {};
        (finanslar || []).forEach(f => {
            if (!finansMap[f.sofor_id]) finansMap[f.sofor_id] = { avans: 0, ceza: 0, haciz: 0 };
            const tur = (f.islem_turu || '').toLowerCase();
            if (tur.includes('avans')) finansMap[f.sofor_id].avans += Number(f.tutar || 0);
            else if (tur.includes('ceza')) finansMap[f.sofor_id].ceza += Number(f.tutar || 0);
            else if (tur.includes('haciz')) finansMap[f.sofor_id].haciz += Number(f.tutar || 0);
        });

        let totals = { net_maas: 0, avans: 0, banka: 0, elden: 0 };
        (soforlerAll || []).forEach(s => {
            const kayit = kayitMap[s.id];
            const finans = finansMap[s.id] || {};

            let net_maas = Number(s.aylik_maas || 0);
            if (kayit && Number(kayit.net_maas || 0) > 0) {
                net_maas = Number(kayit.net_maas);
            } else {
                let gunlukUcret = Number(kayit?.gunluk_ucret || s.gunluk_ucret) || (Number(s.aylik_maas || 0) / 30) || 0;
                let calisanGun = Number(kayit?.calisma_gun || 0);
                if (calisanGun > 0) {
                    net_maas = calisanGun * gunlukUcret;
                } else {
                    net_maas = 0;
                }
            }

            const avans = kayit ? Number(kayit.avans || 0) : Number(finans.avans || 0);
            const ceza = kayit ? Number(kayit.ceza || 0) : Number(finans.ceza || 0);
            const haciz = kayit ? Number(kayit.haciz || 0) : Number(finans.haciz || 0);
            const mk_banka = Number(kayit?.mk_banka || 0);
            const ideol_banka = Number(kayit?.ideol_banka || 0);
            const topKesinti = avans + ceza + haciz + mk_banka + ideol_banka;
            const elden = Math.max(0, net_maas - topKesinti);

            totals.net_maas += net_maas;
            totals.avans += avans + ceza + haciz;
            totals.banka += mk_banka + ideol_banka;
            totals.elden += elden;
        });

        const fmtTotal = v => '₺' + Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        const nmEl = document.getElementById('total-net-maas');
        const avEl = document.getElementById('total-avans');
        const bnkEl = document.getElementById('total-ideol-banka');
        const elEl = document.getElementById('total-elden');
        if (nmEl) nmEl.textContent = fmtTotal(totals.net_maas);
        if (avEl) avEl.textContent = totals.avans > 0 ? fmtTotal(totals.avans) : '—';
        if (bnkEl) bnkEl.textContent = totals.banka > 0 ? fmtTotal(totals.banka) : '—';
        if (elEl) elEl.textContent = fmtTotal(totals.elden);
    } catch (e) {
        console.error('Silently generating totals failed', e);
    }
};

window.togglePuantajEdit = function (btn) {
    const panel = btn.nextElementSibling;
    const chevron = btn.querySelector('.puantaj-chevron');
    if (!panel) return;
    panel.classList.toggle('hidden');
    if (chevron) chevron.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
    if (window.lucide) window.lucide.createIcons();
};

window.puantajMonthPrev = function () {
    const el = document.getElementById('filter-bordro-ay');
    if (!el || !el.value) return;
    const [y, m] = el.value.split('-').map(Number);
    const d = new Date(y, m - 2);
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fetchSoforMaasBordro();
};

window.puantajMonthNext = function () {
    const el = document.getElementById('filter-bordro-ay');
    if (!el || !el.value) return;
    const [y, m] = el.value.split('-').map(Number);
    const d = new Date(y, m);
    el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    fetchSoforMaasBordro();
};

window.puantajExport = function () {
    if (typeof window.exportTableToExcel === 'function') {
        // Build a simple export table from the current data
        const donem = document.getElementById('filter-bordro-ay')?.value || 'bordro';
        const cards = document.querySelectorAll('#puantaj-cards-grid [data-sofor-id]');
        if (!cards.length) { alert('Dışa aktarılacak veri yok.'); return; }
        const rows = [];
        cards.forEach(card => {
            const name = card.querySelector('.font-bold.text-white')?.textContent.trim() || '';
            const chips = [...card.querySelectorAll('.flex-wrap .text-\\[10px\\]')].map(c => c.textContent.trim());
            const inputs = {};
            card.querySelectorAll('input[data-field]').forEach(inp => {
                inputs[inp.dataset.field] = inp.value || '0';
            });
            rows.push({ 'Ad Soyad': name, 'Çalışma Gün': inputs.calisma_gun || '', 'Net Maaş': inputs.net_maas || '', 'Avans': inputs.avans || '', 'Ceza': inputs.ceza || '', 'Haciz': inputs.haciz || '', 'MK Banka': inputs.mk_banka || '', [window.CompanyBranding.currentCompany.shortName + ' Banka']: inputs.ideol_banka || '' });
        });
        if (window.XLSX) {
            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Puantaj');
            XLSX.writeFile(wb, `Puantaj_${donem}.xlsx`);
        } else { alert('Excel kütüphanesi yüklenemedi.'); }
    }
};





/* === TAŞERON HAKEDİŞ TAKİBİ (YENI) === */
window.fetchTaseronHakedis = async function () {
    const tbody = document.getElementById('taseron-hakedis-tbody');
    if (!tbody) return;

    const donem = document.getElementById('taseron-hakedis-month')?.value;
    if (!donem) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Dönem seçimi gerekli.</strong><p>Hakediş kayıtlarını görmek için bir dönem seçiniz.</p></div></div></td></tr>';
        return;
    }

    try {
        tbody.innerHTML = '<tr><td colspan="6"><div class="loading-state"><span class="loading-state-spinner" aria-hidden="true"></span><span>Hakediş kayıtları yükleniyor...</span></div></td></tr>';
        const [year, month] = donem.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-${new Date(year, month, 0).getDate()}`;

        // Bölge filtresi
        const bolgeFilter = document.getElementById('taseron-hakedis-bolge')?.value || '';

        let query = window.supabaseClient
            .from('taseron_hakedis')
            .select('*, araclar(plaka, firma_adi)')
            .gte('sefer_tarihi', startDate)
            .lte('sefer_tarihi', endDate);

        if (bolgeFilter) {
            query = query.eq('bolge', bolgeFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Bu dönemde hakediş bulunmuyor.</strong><p>Seçili dönem ve bölge için kayıt bulunamadı.</p></div></div></td></tr>';
            return;
        }

        // Plaka filtresi
        const plakaFilter = document.getElementById('taseron-hakedis-search')?.value?.toUpperCase();
        let filteredData = data;
        if (plakaFilter) {
            filteredData = data.filter(h => (h.araclar?.plaka || '').toUpperCase().includes(plakaFilter));
        }

        // Firma + Bölge bazlı grupla — her kombinasyon ayrı satır
        const hakedisMap = {};
        filteredData.forEach(h => {
            const firma = h.araclar?.firma_adi || 'Bireysel / Diğer';
            const bolge = h.bolge || 'Manisa';
            const key   = `${firma}|||${bolge}`;
            if (!hakedisMap[key]) {
                hakedisMap[key] = { firma, bolge, araclar: new Set(), trips: 0, total: 0 };
            }
            // Unique araç sayısı için Set kullan
            if (h.arac_id) hakedisMap[key].araclar.add(h.arac_id);
            hakedisMap[key].trips++;
            hakedisMap[key].total += Number(h.anlasilan_tutar || 0);
        });

        // Bölge badge
        const bolgeBadge = (bolge) => {
            const isIzmir = bolge === 'İzmir';
            return `<span class="${isIzmir ? 'badge-info' : 'badge-neutral'}">${isIzmir ? 'İzmir' : bolge}</span>`;
        };

        Object.values(hakedisMap).forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-white">${d.firma}</td>
                <td class="px-6 py-4">${bolgeBadge(d.bolge)}</td>
                <td class="px-6 py-4 text-gray-400">${d.araclar.size}</td>
                <td class="px-6 py-4 text-gray-400">${d.trips}</td>
                <td class="px-6 py-4 font-bold text-orange-400">${window.formatCurrency(d.total)}</td>
                <td class="px-6 py-4 text-right">
                    <span class="badge-warning">BEKLEYEN</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Tabloyu sıralanabilir yap
        if (typeof window.makeTableSortable === 'function') {
            window.makeTableSortable(tbody.closest('table'));
        }

    } catch (e) {
        console.error('Hakediş fetch hatası:', e);
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state contractor-error-state"><div><strong>Hakedişler yüklenemedi.</strong><p>${e.message}</p></div></div></td></tr>`;
    }
};

/* === TAŞERON SEFER RAPORLARI (YENI) === */
window.fetchTaseronSeferler = async function () {
    const tbody = document.getElementById('taseron-sefer-tbody');
    if (!tbody) return;

    try {
        tbody.innerHTML = '<tr><td colspan="6"><div class="loading-state"><span class="loading-state-spinner" aria-hidden="true"></span><span>Sefer kayıtları yükleniyor...</span></div></td></tr>';
        const { data, error } = await window.supabaseClient
            .from('taseron_hakedis')
            .select('*, araclar(plaka), bolge')
            .order('sefer_tarihi', { ascending: false })
            .limit(50);

        if (error) throw error;

        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div><strong>Henüz sefer kaydı bulunmuyor.</strong><p>Yeni kayıtlar eklendiğinde bu alanda görüntülenecek.</p></div></div></td></tr>';
            return;
        }

        const bolgeBadge = (bolge) => {
            const isIzmir = bolge === 'İzmir';
            return `<span class="${isIzmir ? 'badge-info' : 'badge-neutral'}">${bolge || 'Manisa'}</span>`;
        };

        data.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-4 text-gray-400">${new Date(s.sefer_tarihi).toLocaleDateString('tr-TR')}</td>
                <td class="px-6 py-4 font-bold text-white font-mono">${s.araclar?.plaka || '-'}</td>
                <td class="px-6 py-4">${bolgeBadge(s.bolge)}</td>
                <td class="px-6 py-4 text-gray-400">${s.guzergah || '-'}</td>
                <td class="px-6 py-4 text-gray-400">${s.musteriler?.unvan || '-'}</td>
                <td class="px-6 py-4 text-right font-bold text-cyan-500">${window.formatCurrency(s.anlasilan_tutar || 0)}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error('Sefer raporu hatası:', e);
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state contractor-error-state"><div><strong>Seferler yüklenemedi.</strong><p>${e.message}</p></div></div></td></tr>`;
    }
};
/* === PHASE 8: ADVANCED REPORTING LOGIC === */

window.fetchCariDetails = async function (cariId) {
    const tbody = document.getElementById('cari-detail-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-gray-500 italic">Hazırlanıyor...</td></tr>';

    try {
        const [
            { data: cari },
            { data: faturalar },
            { data: odemeler },
            { data: policeler },
            { data: bakimlar },
            { data: kartRes }
        ] = await Promise.all([
            window.supabaseClient.from('cariler').select('*').eq('id', cariId).maybeSingle(),
            window.supabaseClient.from('cari_faturalar').select('*').eq('cari_id', cariId).order('tarih', { ascending: false }),
            window.supabaseClient.from('cari_odemeler').select('*').eq('cari_id', cariId).order('tarih', { ascending: false }),
            window.supabaseClient.from('arac_policeler').select('*, araclar(plaka)').eq('cari_id', cariId).order('baslangic_tarihi', { ascending: false }),
            window.supabaseClient.from('arac_bakimlari').select('*, araclar(plaka)').eq('cari_id', cariId).order('islem_tarihi', { ascending: false }),
            window.supabaseClient.from('kredi_kartlari').select('id').eq('cari_id', cariId).maybeSingle()
        ]);

        if (!cari) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-orange-500 font-bold">Cari kayıt bulunamadı (ID: ${cariId})</td></tr>`;
            const unvanElCatch = document.getElementById('cari-detail-unvan');
            if (unvanElCatch) unvanElCatch.textContent = 'Kayıt Bulunamadı';
            return;
        }

        // If it's a credit card cari, fetch its specific transactions
        let kartIslemleri = [];
        if (kartRes?.id) {
            const { data: ki } = await window.supabaseClient
                .from('kredi_karti_islemleri')
                .select('*')
                .eq('kart_id', kartRes.id)
                .order('islem_tarihi', { ascending: false });
            kartIslemleri = ki || [];
        }

        // UI Header
        const unvanEl = document.getElementById('cari-detail-unvan');
        const turEl = document.getElementById('cari-detail-tur');
        if (unvanEl) unvanEl.textContent = cari.unvan;
        if (turEl) turEl.textContent = (cari.tur || 'Genel Cari').toUpperCase();

        // Transaction list compilation
        window._lastCariId = cariId;
        window.refreshCariDetails = () => {
            window.fetchCariDetails(window._lastCariId);
            if (typeof window.refreshAllModules === 'function') window.refreshAllModules();
        };

        let entries = [];

        (faturalar || []).forEach(f => entries.push({ id: f.id, table: 'cari_faturalar', tarih: f.fatura_tarihi || f.tarih, type: 'FATURA', desc: f.fatura_no ? `Fatura: ${f.fatura_no}` : (f.aciklama || 'Hizmet/Ürün Alımı'), borc: f.toplam_tutar || f.tutar || 0, alacak: 0 }));
        (odemeler || []).forEach(o => entries.push({ id: o.id, table: 'cari_odemeler', tarih: o.tarih, type: 'ÖDEME', desc: o.aciklama || 'Kasa/Banka Ödemesi', borc: 0, alacak: o.tutar || o.toplam_tutar || 0 }));
        (policeler || []).forEach(p => entries.push({ id: p.id, table: 'arac_policeler', tarih: p.baslangic_tarihi, type: 'POLİÇE', desc: `${p.police_turu || p.tur || 'Sigorta'} Poliçesi (${p.araclar ? p.araclar.plaka : '-'})`, borc: p.toplam_tutar || p.tutar || 0, alacak: 0 }));
        (bakimlar || []).forEach(b => entries.push({ id: b.id, table: 'arac_bakimlari', tarih: b.islem_tarihi, type: 'BAKIM/TAMİR', desc: `${b.islem_turu || 'Bakım'} - ${b.aciklama || '-'} (${b.araclar ? b.araclar.plaka : '-'})`, borc: b.toplam_tutar || b.tutar || 0, alacak: 0 }));
        
        // Push Credit Card Transactions as Debt
        (kartIslemleri || []).forEach(ki => entries.push({ 
            id: ki.id, 
            table: 'kredi_karti_islemleri', 
            tarih: ki.islem_tarihi, 
            type: 'KART HARCAMA', 
            desc: ki.aciklama || 'Kredi Kartı Harcaması', 
            borc: ki.tutar || ki.toplam_tutar || 0, 
            alacak: 0 
        }));

        entries.sort((a, b) => new Date(b.tarih) - new Date(a.tarih));

        // --- 8.B. POLİÇE ID'LERİNİ DİNAMİK ÇÖZÜMLEME (Plate/Acente Translation) ---
        const policyIdsInList = entries.filter(e => e.desc && /POLİÇE ID: /i.test(e.desc)).map(e => {
            const match = e.desc.match(/POLİÇE ID: ([a-f0-9-]{36})/i);
            return match ? match[1] : null;
        }).filter(id => id);

        if (policyIdsInList.length > 0) {
            try {
                // Toplu poliçe bilgilerini çek (araclar ve carilerle joinleyerek)
                const { data: pInfos } = await window.supabaseClient
                    .from('arac_policeler')
                    .select('id, police_turu, taksit_sayisi, araclar(plaka), cariler(unvan)')
                    .in('id', policyIdsInList);

                if (pInfos && pInfos.length > 0) {
                    const infoMap = {};
                    pInfos.forEach(p => {
                        infoMap[p.id] = {
                            plaka: p.araclar ? p.araclar.plaka : '-',
                            acente: p.cariler ? p.cariler.unvan : '-',
                            taksit: p.taksit_sayisi || 1,
                            tur: p.police_turu || 'Poliçe'
                        };
                    });

                    // Listeyi güncelle
                    entries.forEach(e => {
                        if (e.desc && /POLİÇE ID: /i.test(e.desc)) {
                            const match = e.desc.match(/POLİÇE ID: ([a-f0-9-]{36})/i);
                            if (match && infoMap[match[1]]) {
                                const i = infoMap[match[1]];
                                // Tüm ID varyasyonlarını temizle (Regex ile)
                                e.desc = e.desc.replace(/\[?POLİÇE ID: [a-f0-9-]{36}\]?/gi, `${i.plaka} - ${i.acente} - ${i.taksit} Taksit`);
                            }
                        }
                    });
                }
            } catch(translateErr) { console.warn("Poliçe detay çözümleme hatası:", translateErr); }
        }

        let currentBakiye = 0;
        let totalBorc = 0;
        let totalAlacak = 0;

        tbody.innerHTML = '';
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-gray-500 italic">Bu cari hesaba ait henüz bir hareket bulunmuyor.</td></tr>';
        }
        entries.reverse().forEach(e => {
            totalBorc += (Number(e.borc) || 0);
            totalAlacak += (Number(e.alacak) || 0);
            currentBakiye += ((Number(e.borc) || 0) - (Number(e.alacak) || 0));

            const tr = document.createElement('tr');
            tr.className = "cari-statement-row border-b border-white/5 hover:bg-white/5 transition-colors";
            tr.innerHTML = `
                <td class="statement-date px-6 py-4 text-gray-400 font-medium" data-label="Tarih">${window.formatDate(e.tarih)}</td>
                <td class="statement-detail px-6 py-4" data-label="İşlem">
                    <div class="text-white font-bold">${e.type}</div>
                    <div class="text-[10px] text-gray-500 uppercase tracking-widest">${e.desc}</div>
                </td>
                <td class="statement-debt px-6 py-4 text-right text-white font-bold" data-label="Borç">${e.borc > 0 ? window.formatCurrency(e.borc) : '-'}</td>
                <td class="statement-credit px-6 py-4 text-right text-green-500 font-bold" data-label="Alacak">${e.alacak > 0 ? window.formatCurrency(e.alacak) : '-'}</td>
                <td class="statement-balance px-6 py-4 text-right ${currentBakiye > 0 ? 'text-orange-500' : 'text-green-400'} font-black text-base" data-label="Bakiye">${window.formatCurrency(currentBakiye)}</td>
                <td class="statement-action px-6 py-4 text-center" data-label="İşlem">
                    <button onclick="deleteRecord('${e.table}', '${e.id}', 'refreshCariDetails')" class="text-[10px] text-red-500 hover:text-red-400 font-bold border border-red-500/20 px-2 py-1 rounded transition-all">SİL</button>
                </td>
            `;
            tbody.prepend(tr);
        });

        // Summary Stats
        const borcEl = document.getElementById('cari-detail-borc');
        const odenenEl = document.getElementById('cari-detail-odenen');
        const bakiyeEl = document.getElementById('cari-detail-bakiye');

        if (borcEl) borcEl.textContent = window.formatCurrency(totalBorc);
        if (odenenEl) odenenEl.textContent = window.formatCurrency(totalAlacak);
        if (bakiyeEl) bakiyeEl.textContent = window.formatCurrency(currentBakiye);

        // Binding for WhatsApp Dynamic Button
        const wpBtn = document.getElementById('cari-whatsapp-btn');
        if (wpBtn) {
            if (cari.telefon) {
                wpBtn.classList.remove('hidden');
                wpBtn.classList.add('flex');
                
                const bakiyeMsj = currentBakiye > 0 
                  ? `${currentBakiye.toLocaleString('tr-TR')} TL BORCUNUZ` 
                  : (currentBakiye < 0 ? `${Math.abs(currentBakiye).toLocaleString('tr-TR')} TL ALACAĞINIZ` : 'BORCUNUZ VEYA ALACAĞINIZ OLMADIĞI');
                  
                let text = `Merhaba Sayın ${cari.unvan}, sistemimizde an itibarıyla ${bakiyeMsj} bulunmaktadır.`;
                wpBtn.onclick = () => window.open(`https://wa.me/90${cari.telefon.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
            } else {
                wpBtn.classList.remove('flex');
                wpBtn.classList.add('hidden');
            }
        }

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('[fetchCariDetails] Hata:', e);
        const tbody2 = document.getElementById('cari-detail-tbody');
        if (tbody2) tbody2.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-red-500 font-bold text-sm">Veri yüklenirken bir hata oluştu.<br><span class="text-xs text-gray-600 font-normal mt-1 block">${e.message}</span></td></tr>`;
        // Başlık takılı kalmasın
        const unvanEl2 = document.getElementById('cari-detail-unvan');
        if (unvanEl2 && unvanEl2.textContent === 'Yükleniyor...') unvanEl2.textContent = 'Hata';
    }
}

// === PERSONEL MAAŞ & BORDRO (YENİ) ===
window.fetchMaaslar = async function () {
    const tbody = document.getElementById('maaslar-tbody');
    if (!tbody) return;
    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

    try {
        const [soforlerRes, finansRes] = await Promise.all([
            window.supabaseClient.from('soforler').select('id, ad_soyad, aylik_maas').order('ad_soyad'),
            window.supabaseClient.from('sofor_finans').select('*')
        ]);

        if (soforlerRes.error) throw soforlerRes.error;
        if (finansRes.error) throw finansRes.error;

        const soforler = soforlerRes.data || [];
        const finans = finansRes.data || [];

        tbody.innerHTML = '';
        if (soforler.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Personel bulunamadı.</td></tr>`;
            return;
        }

        soforler.forEach(s => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-white/5 hover:bg-white/5 transition-colors";

            const maas = Number(s.aylik_maas || 0);
            
            let toplamOdenen = 0;
            let toplamKesinti = 0;
            let netHakedis = 0;

            const islemler = (finans || []).filter(f => f.sofor_id === s.id);
            islemler.forEach(f => {
                const tur = (f.islem_turu || '').toUpperCase();
                const tutar = Number(f.tutar || 0);
                if (tur.includes('AVANS') || tur.includes('MAAŞ') || tur.includes('ÖDEME')) {
                    toplamOdenen += tutar;
                } else if (tur.includes('KESİNTİ') || tur.includes('CEZA')) {
                    toplamKesinti += tutar;
                } else if (tur.includes('PRİM') || tur.includes('HARCIRAH')) {
                    netHakedis += tutar;
                }
            });

            const toplamHakedis = maas + netHakedis;
            const kalanBakiye = toplamHakedis - toplamOdenen - toplamKesinti;

            const bakiyeRenk = kalanBakiye >= 0 ? 'text-green-400' : 'text-red-400';

            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-gray-200">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold">
                            ${(s.ad_soyad || 'A').charAt(0).toUpperCase()}
                        </div>
                        ${s.ad_soyad}
                    </div>
                </td>
                <td class="px-6 py-4 font-bold text-gray-300">
                    <div class="text-[10px] text-gray-500 font-normal uppercase tracking-widest block mb-0.5">Sbt: ${maas.toLocaleString('tr-TR')} ₺</div>
                    ${netHakedis > 0 ? '<span class="text-green-400 text-xs">+' + netHakedis.toLocaleString('tr-TR') + ' ₺ (Ek)</span>' : '<span class="text-gray-600 text-xs">+0 ₺ (Ek)</span>'}
                </td>
                <td class="px-6 py-4 text-orange-400 font-bold">${toplamOdenen.toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺</td>
                <td class="px-6 py-4 text-red-400 font-bold">${toplamKesinti.toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺</td>
                <td class="px-6 py-4 text-right font-black ${bakiyeRenk} text-lg tracking-tight">${kalanBakiye.toLocaleString('tr-TR', {minimumFractionDigits:2})} ₺</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("fetchMaaslar hatası:", e);
        if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-red-500">Maaş/Bordro verileri yüklenirken hata oluştu.</td></tr>';
    }
}

// === KREDİ KARTLARI (KART CARİSİ) (YENİ) ===
window.fetchKrediKartlari = async function () {
    const tbody = document.getElementById('kredi-kartlari-tbody');
    if (!tbody) return;

    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;

    try {
        // 1. Kartları Çek
        const { data: kartlar, error: kartErr } = await window.supabaseClient
            .from('kredi_kartlari')
            .select('*')
            .order('id', { ascending: false });

        if (kartErr) throw kartErr;
        
        // Auto-fix: Link cards to Cari if missing (New & Legacy support)
        for (let k of (kartlar || [])) {
            if (!k.cari_id) {
                try {
                    console.log(`[KART AUTO-FIX] Cari kontrol/oluşturma: ${k.kart_adi}`);
                    const cariUnvan = k.kart_adi + (k.kart_sahibi ? ` (${k.kart_sahibi})` : '');
                    
                    // Önce aynı unvanda bir cari var mı bak
                    const { data: existingCari } = await window.supabaseClient.from('cariler')
                        .select('id').eq('unvan', cariUnvan).limit(1);
                    
                    let targetCariId = existingCari && existingCari.length > 0 ? existingCari[0].id : null;

                    if (!targetCariId) {
                        const { data: newCari, error: cariErr } = await window.supabaseClient.from('cariler').insert([{
                            unvan: cariUnvan,
                            isletme_turu: 'BANKA / KREDİ KARTI',
                            aciklama: 'Kredi kartı hesabı (Otomatik-Sistem)'
                        }]).select();
                        if (!cariErr && newCari?.[0]) targetCariId = newCari[0].id;
                    }

                    if (targetCariId) {
                        await window.supabaseClient.from('kredi_kartlari').update({ cari_id: targetCariId }).eq('id', k.id);
                        k.cari_id = targetCariId; // Yerel nesneyi güncelle
                    }
                } catch(e) { console.error("Card link failed:", e); }
            }
        }

        const kartlarClean = window.sanitizeDataArray(kartlar || []);

        // 2. İşlemleri Çek
        const { data: islemler, error: islemErr } = await window.supabaseClient
            .from('kredi_karti_islemleri')
            .select('*');

        if (islemErr) throw islemErr;

        tbody.innerHTML = '';
        if (kartlarClean.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Kayıtlı kredi kartı bulunmamaktadır.</td></tr>`;
            return;
        }

        // Kart bazlı işlemleri topla
        const islemMap = {};
        (islemler || []).forEach(islem => {
            if (!islemMap[islem.kart_id]) {
                islemMap[islem.kart_id] = { tutar: 0, count: 0, transactions: [] };
            }
            islemMap[islem.kart_id].tutar += Number(islem.toplam_tutar || 0);
            islemMap[islem.kart_id].count += 1;
            islemMap[islem.kart_id].transactions.push(islem);
        });

        kartlarClean.forEach(k => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-white/5 hover:bg-white/5 transition-colors";

            const kIslem = islemMap[k.id] || { tutar: 0, count: 0, transactions: [] };
            const limit = Number(k.limit_tutari || 0);
            const harcanan = kIslem.tutar;
            const kullanilabilir = (limit - harcanan > 0) ? limit - harcanan : 0;

            const txDataStr = encodeURIComponent(JSON.stringify(kIslem.transactions));
            const cariIdStr = k.cari_id ? `'${k.cari_id}'` : 'null';

            tr.innerHTML = `
                <td class="px-6 py-4 cursor-pointer" onclick="window.openCariDetail(${cariIdStr})">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                            <i data-lucide="credit-card" class="w-5 h-5 text-orange-500"></i>
                        </div>
                        <div>
                            <p class="font-bold text-white text-sm uppercase tracking-wide hover:text-orange-400 transition-colors">${k.kart_adi}</p>
                            <p class="text-[10px] text-gray-500">Cari Kartı Görüntüle</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <p class="text-sm font-bold text-indigo-400">${window.formatCurrency(limit)}</p>
                    <p class="text-[10px] text-gray-400">Özet Kullanılabilir: <span class="text-white">${window.formatCurrency(kullanilabilir)}</span></p>
                </td>
                <td class="px-6 py-4 text-orange-500 font-bold text-base">
                    ${window.formatCurrency(harcanan)}
                </td>
                <td class="px-6 py-4 text-xs text-gray-400 italic">
                    ${kIslem.count} İşlem
                </td>
                <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <button onclick="window.openKrediKartiDetay('${k.id}', '${k.kart_adi}')" class="px-4 py-1.5 text-xs font-bold bg-orange-500/10 text-orange-400 rounded-lg hover:bg-orange-500 hover:text-white transition-all">Detay (Ekstre)</button>
                    <button onclick="deleteRecord('kredi_kartlari','${k.id}','fetchKrediKartlari')" class="text-danger text-[10px] font-bold hover:underline px-2">Sil</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error('[KARTLAR]', e);
        tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-red-500 font-bold">Veri çekilemedi: ${e.message}</td></tr>`;
    }
}

window.fetchKrediKartiDetails = async function (kartId) {
    const tbody = document.getElementById('cari-detail-tbody');
    if (!tbody) return;

    try {
        // 1. Kart Bilgilerini ve İşlemleri Al
        const [kartRes, islemRes] = await Promise.all([
            window.supabaseClient.from('kredi_kartlari').select('*').eq('id', kartId).single(),
            window.supabaseClient.from('kredi_karti_islemleri').select('*').eq('kart_id', kartId).order('islem_tarihi', { ascending: false })
        ]);

        if (kartRes.error) throw kartRes.error;
        const kart = kartRes.data;
        const islemler = islemRes.data || [];

        // 2. Özetleri Hesapla
        const limit = Number(kart.limit_tutari || 0);
        const harcanan = islemler.reduce((sum, i) => sum + (Number(i.tutar || i.toplam_tutar || 0)), 0);
        const kullanilabilir = (limit - harcanan > 0) ? limit - harcanan : 0;

        // 3. UI Güncelle (Başı)
        document.getElementById('cari-detail-borc').innerText = window.formatCurrency(harcanan);
        document.getElementById('cari-detail-odenen').innerText = window.formatCurrency(limit);
        document.getElementById('cari-detail-bakiye').innerText = window.formatCurrency(kullanilabilir);
        
        // Modal başlıklarını/etiketlerini geçici olarak değiştir (Cari terminolojisinden Kart terminolojisine)
        // Not: Bu alanlar statik HTML olabildiği için document selector ile bulup metni güncelliyoruz.
        const labels = document.querySelectorAll('#cari-detail-modal label');
        labels.forEach(lbl => {
            if (lbl.innerText.includes('TOPLAM BORÇ')) lbl.innerText = 'TOPLAM HARCAMA';
            if (lbl.innerText.includes('TOPLAM ÖDEME')) lbl.innerText = 'KART LİMİTİ';
            if (lbl.innerText.includes('KALAN BAKİYE')) lbl.innerText = 'KULLANILABİLİR';
        });

        // 4. Detaylı Bilgileri Çözümle (Poliçe ID -> Plaka/Acente)
        const policyIdsInList = islemler.filter(i => i.aciklama && /POLİÇE ID: /i.test(i.aciklama)).map(i => {
            const match = i.aciklama.match(/POLİÇE ID: ([a-f0-9-]{36})/i);
            return match ? match[1] : null;
        }).filter(id => id);

        if (policyIdsInList.length > 0) {
            try {
                const { data: pInfos } = await window.supabaseClient
                    .from('arac_policeler')
                    .select('id, police_turu, taksit_sayisi, araclar(plaka), cariler(unvan)')
                    .in('id', policyIdsInList);

                if (pInfos && pInfos.length > 0) {
                    const infoMap = {};
                    pInfos.forEach(p => {
                        infoMap[p.id] = {
                            plaka: p.araclar ? p.araclar.plaka : '-',
                            acente: p.cariler ? p.cariler.unvan : '-',
                            taksit: p.taksit_sayisi || 1
                        };
                    });

                    islemler.forEach(i => {
                        if (i.aciklama && /POLİÇE ID: /i.test(i.aciklama)) {
                            const match = i.aciklama.match(/POLİÇE ID: ([a-f0-9-]{36})/i);
                            if (match && infoMap[match[1]]) {
                                const info = infoMap[match[1]];
                                i.aciklama = i.aciklama.replace(/\[?POLİÇE ID: [a-f0-9-]{36}\]?/gi, ` - ${info.plaka} - ${info.acente}`);
                            }
                        }
                    });
                }
            } catch(e) { console.warn("Kart ekstre detay çözümleme hatası:", e); }
        }

        // 5. Tabloyu Doldur
        if (islemler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-gray-500 italic">Bu karta ait henüz bir işlem bulunmamaktadır.</td></tr>';
            return;
        }

        tbody.innerHTML = islemler.map(i => {
            const tarih = i.islem_tarihi ? new Date(i.islem_tarihi).toLocaleDateString('tr-TR') : '-';
            const tutarGoster = Number(i.tutar || i.toplam_tutar || 0);
            return `
                <tr class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-600">${tarih}</td>
                    <td class="px-6 py-4 text-sm font-bold text-primary active:text-orange-500">${i.aciklama || 'Kredi Kartı Harcaması'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-black text-danger">₺${tutarGoster.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">-</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">-</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-center">-</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('[KrediKartiDetails]', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-red-500 font-bold">Hata: ${e.message}</td></tr>`;
    }
};

window.fetchTaksitler = async function (category = 'HEPSİ') {
    const tbody = document.getElementById('taksitler-tbody');
    const tfootRow = document.getElementById('taksit-footer-row');
    const tfootTotal = document.getElementById('taksit-toplam-aylik');
    if (!tbody) return;
    
    // UI Update
    const btns = ['all', 'police', 'bakim', 'kredi'];
    btns.forEach(id => {
        const btn = document.getElementById('taksit-btn-' + id);
        if(!btn) return;
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-500');
    });
    let activeBtnId = 'all';
    if(category === 'Police') activeBtnId = 'police';
    else if(category === 'Bakim') activeBtnId = 'bakim';
    else if(category === 'KrediKarti') activeBtnId = 'kredi';
    
    const activeBtn = document.getElementById('taksit-btn-' + activeBtnId);
    if(activeBtn) {
        activeBtn.classList.remove('text-gray-500');
        activeBtn.classList.add('bg-orange-500', 'text-white');
    }

    tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-500 italic">Yükleniyor...</td></tr>';
    if(tfootRow) tfootRow.classList.add('hidden');

    try {
        const { data: cariler } = await window.supabaseClient.from('cariler').select('id, unvan');

        let policeler = [], bakimlar = [], krediIslemleri = [];
        try {
            const pRes = await window.supabaseClient.from('arac_policeler').select('*, araclar(plaka)');
            policeler = pRes.data || [];
        } catch(e) {}
        try {
            const bRes = await window.supabaseClient.from('arac_bakimlari').select('*, araclar(plaka)');
            bakimlar = bRes.data || [];
        } catch(e) {}
        try {
            const kRes = await window.supabaseClient.from('kredi_karti_islemleri').select('*, kredi_kartlari(kart_adi)');
            krediIslemleri = kRes.data || [];
        } catch(e) {}

        let combined = [];

        // Poliçeleri ekle
        (policeler || []).forEach(p => {
            combined.push({
                cari_id: p.cari_id,
                arac: p.araclar?.plaka || '-',
                tur: p.police_turu || p.tur || 'Sigorta',
                tutar: Number(p.toplam_tutar) || 0,
                taksit: Number(p.taksit_sayisi) || 1,
                date: p.baslangic_tarihi,
                source: 'Police'
            });
        });

        // Bakım taksitlerini ekle
        (bakimlar || []).forEach(b => {
            if (b.cari_id) {
                combined.push({
                    cari_id: b.cari_id,
                    arac: b.araclar?.plaka || '-',
                    tur: b.islem_turu || 'Bakım/Parça',
                    tutar: Number(b.toplam_tutar) || 0,
                    taksit: 1, 
                    date: b.islem_tarihi,
                    source: 'Bakim'
                });
            }
        });

        // Kredi Kartı işlemleri
        (krediIslemleri || []).forEach(k => {
            combined.push({
                cari_id: null,
                kart_adi: k.kredi_kartlari?.kart_adi || 'Bilinmeyen Kart',
                arac: k.aciklama || '-',
                tur: 'Kredi Kartı',
                tutar: Number(k.toplam_tutar) || 0,
                taksit: Number(k.taksit_sayisi) || 1,
                date: k.islem_tarihi,
                source: 'KrediKarti'
            });
        });

        // Filtreleme
        let filtered = combined;
        if (category !== 'HEPSİ') {
            filtered = combined.filter(c => c.source === category);
        }

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-400">Bu kategoride taksit veya ödeme kaydı bulunmamaktadır.</td></tr>';
            return;
        }

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        let currentMonthTotal = 0;
        
        const isDetailed = window.isDetailedViewTaksit || false;
        const thead = document.getElementById('taksitler-thead');
        const tfootLabel = document.getElementById('taksit-footer-label');
        if(thead) {
            if(isDetailed) {
                thead.innerHTML = `<tr><th>Cari / Unvan / Kart</th><th>Açıklama / Plaka</th><th>Taksit Türü</th><th>Kalan Toplam (₺)</th><th>Taksit / Vade</th><th class="text-right">Aylık Yük / Tutar (₺)</th></tr>`;
                if(tfootLabel) tfootLabel.colSpan = 5;
            } else {
                thead.innerHTML = `<tr><th>Kime Ödenecek (Cari/Kart)</th><th>Tür</th><th>Kalan Toplam (₺)</th><th class="text-right">Aylık Yük / Tutar (₺)</th></tr>`;
                if(tfootLabel) tfootLabel.colSpan = 3;
            }
        }

        filtered.forEach(p => {
            const cari = cariler?.find(c => c.id === p.cari_id);
            let title = p.source === 'KrediKarti' ? p.kart_adi : (cari ? cari.unvan : 'Bilinmeyen Cari');
            let icon = p.source === 'Police' ? 'shield-check' : (p.source === 'KrediKarti' ? 'credit-card' : 'settings');
            let colorClass = p.source === 'Police' ? 'bg-blue-500/10 text-blue-400' : (p.source === 'KrediKarti' ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400');
            
            const aylik = p.taksit > 0 ? (p.tutar / p.taksit) : p.tutar;
            currentMonthTotal += aylik; 

            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50/5 transition-colors border-b border-white/5";
            
            if(isDetailed) {
                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-300">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${icon}" class="w-4 h-4 text-gray-400"></i>
                            ${title}
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-[10px] text-gray-400 font-medium">
                        ${p.arac}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-0.5 ${colorClass} text-[10px] font-bold rounded uppercase">
                            ${p.tur}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${window.formatCurrency(p.tutar)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${p.taksit} Taksit / Aylık</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-black text-white">${window.formatCurrency(aylik)}</td>
                `;
            } else {
                tr.innerHTML = `
                    <td class="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-300">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${icon}" class="w-4 h-4 text-gray-400"></i>
                            <span class="truncate max-w-[150px]" title="${title}">${title}</span>
                        </div>
                    </td>
                    <td class="px-6 py-3 whitespace-nowrap">
                        <span class="px-2 py-0.5 ${colorClass} text-[10px] font-bold rounded uppercase">
                            ${p.tur}
                        </span>
                    </td>
                    <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-400">${window.formatCurrency(p.tutar)}</td>
                    <td class="px-6 py-3 whitespace-nowrap text-right text-sm font-black text-white">${window.formatCurrency(aylik)}</td>
                `;
            }
            tbody.appendChild(tr);
        });
        
        if (tfootRow && tfootTotal) {
            tfootTotal.innerText = window.formatCurrency(currentMonthTotal);
            tfootRow.classList.remove('hidden');
        }
        // Borclu cari sayisini hesapla
        const borcluEl = document.getElementById('ozet-cari-borclu');
        if (borcluEl) {
            let borcluCount = 0;
            carilerClean.forEach(c => {
                const borFat = (faturalar || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borPol = (policeler || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borBak = (bakimlar || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.toplam_tutar) || 0), 0);
                const borOd  = (odemeler || []).filter(x => x.cari_id === c.id).reduce((s, x) => s + (Number(x.tutar) || 0), 0);
                if ((borFat + borPol + borBak) - borOd > 0) borcluCount++;
            });
            borcluEl.textContent = borcluCount;
        }
        if (window.lucide) window.lucide.createIcons();
    } catch (e) { console.error(e); }
}

window.fetchAylikOdemeOzeti = async function () {
    const tbody = document.getElementById('aylik-odeme-tbody');
    const tfoot = document.getElementById('aylik-odeme-tfoot');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Analiz ediliyor...</td></tr>';

    try {
        const { data: cariler } = await window.supabaseClient.from('cariler').select('*');
        const { data: policeler } = await window.supabaseClient.from('arac_policeler').select('*');
        const { data: bakimlar } = await window.supabaseClient.from('arac_bakimlari').select('*');

        let reportData = [];
        let grandTotal = 0;

        cariler.forEach(cari => {
            const cariPoliceler = (policeler || []).filter(p => p.cari_id === cari.id);
            const cariBakimlar = (bakimlar || []).filter(b => b.cari_id === cari.id);

            if (cariPoliceler.length === 0 && cariBakimlar.length === 0) return;

            let aylikToplam = 0;
            let item_count = 0;

            // Poliçe taksitleri
            cariPoliceler.forEach(p => {
                const tutar = Number(p.toplam_tutar) || 0;
                const taksit = Number(p.taksit_sayisi) || 0;
                if (taksit > 0) aylikToplam += (tutar / taksit);
                else aylikToplam += tutar;
                item_count++;
            });

            // Bakım masrafları (Şimdilik tek seferlik borç olarak bu aya yansıtıyoruz)
            // Not: İleride bakım taksitlendirmesi gelirse burası güncellenmeli
            cariBakimlar.forEach(b => {
                aylikToplam += Number(b.toplam_tutar) || 0;
                item_count++;
            });

            if (aylikToplam > 0) {
                reportData.push({
                    id: cari.id,
                    unvan: cari.unvan,
                    tur: cari.tur,
                    count: item_count,
                    tutar: aylikToplam
                });
                grandTotal += aylikToplam;
            }
        });

        tbody.innerHTML = '';
        if (reportData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-400">Bu ay için bekleyen taksitli ödeme bulunmamaktadır.</td></tr>';
            if (tfoot) tfoot.classList.add('hidden');
            return;
        }

        reportData.sort((a, b) => b.tutar - a.tutar);

        reportData.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-white/5 border-b border-white/5 transition-colors";
            tr.innerHTML = `
                <td class="px-6 py-5 font-bold text-white">${r.unvan}</td>
                <td class="px-6 py-5"><span class="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-[10px] uppercase font-bold rounded">${r.tur || 'Cari'}</span></td>
                <td class="px-6 py-5 text-center font-bold text-gray-400">${r.count} Kalem</td>
                <td class="px-6 py-5 text-right font-black text-orange-500 text-lg">₺${r.tutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                <td class="px-6 py-5 text-right">
                    <button onclick="if('${r.id}') window.openCariDetail('${r.id}')" class="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-all" title="Detay Gör">
                        <i data-lucide="eye" class="w-4 h-4"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (tfoot) {
            tfoot.classList.remove('hidden');
            const totalEl = document.getElementById('total-aylik-odeme');
            if (totalEl) totalEl.textContent = '₺' + grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
        }

        // Update KPIs
        const fmt = v => '₺' + Number(v).toLocaleString('tr-TR', { maximumFractionDigits: 0 });
        const el1 = document.getElementById('fin-kpi-brut'); if (el1) el1.textContent = fmt(grandTotal);
        const el2 = document.getElementById('fin-kpi-yakit'); if (el2) el2.textContent = "₺0";
        const el3 = document.getElementById('fin-kpi-net'); if (el3) el3.textContent = fmt(grandTotal);

        if (window.lucide) window.lucide.createIcons();

    } catch (e) { console.error(e); }
};

window.refreshAllModules = function () {

    if (typeof window.clearViewDataCache === 'function') window.clearViewDataCache();

    if (typeof window.fetchFinansDashboard === 'function') window.fetchFinansDashboard();
    if (typeof window.fetchAraclar === 'function') window.fetchAraclar();
    if (typeof window.fetchCariler === 'function') window.fetchCariler();
    if (typeof window.fetchTaksitler === 'function') window.fetchTaksitler('HEPSİ');
    if (typeof window.fetchBakimlar === 'function') window.fetchBakimlar();
    if (typeof window.fetchPoliceler === 'function') window.fetchPoliceler();
    if (typeof window.fetchMaaslar === 'function') window.fetchMaaslar();
    if (typeof window.fetchKrediKartlari === 'function') window.fetchKrediKartlari();
    if (typeof window.fetchRaporlar === 'function') window.fetchRaporlar();
    if (typeof window.fetchTeklifler === 'function') window.fetchTeklifler();
    if (typeof window.fetchDashboardData === 'function') window.fetchDashboardData();
};

// ============================================================
// RAPORLAR - TAB SWITCH
// ============================================================
window.switchRaporTab = function(tab) {
    const tabs = ['genel','arac','personel','musteri','cari'];
    tabs.forEach(t => {
        const btn = document.getElementById('rapor-tab-' + t);
        const content = document.getElementById('rapor-content-' + t);
        if (btn) {
            if (t === tab) {
                btn.classList.add('bg-orange-500', 'text-white', 'shadow-lg');
                btn.classList.remove('text-gray-400', 'hover:bg-white/5');
            } else {
                btn.classList.remove('bg-orange-500', 'text-white', 'shadow-lg');
                btn.classList.add('text-gray-400', 'hover:bg-white/5');
            }
        }
        if (content) {
            content.classList.toggle('hidden', t !== tab);
            content.classList.toggle('block', t === tab);
        }
    });
    // Load tab data if not already loaded
    const ay = document.getElementById('rapor-ay')?.value;
    if (!ay) return;
    const loadReport = (key, loader) => typeof window.loadViewData === 'function'
        ? window.loadViewData(key, loader)
        : Promise.resolve().then(loader);
    if (tab === 'personel') loadReport(`rapor:personel:${ay}`, () => window.fetchRaporPersonel(ay));
    else if (tab === 'musteri') loadReport(`rapor:musteri:${ay}`, () => window.fetchRaporMusteri(ay));
    else if (tab === 'cari') loadReport(`rapor:cari:${ay}`, () => window.fetchRaporCari());
};

// ============================================================
// RAPORLAR - MAIN FETCH (handles Genel + Arac tabs)
// ============================================================
window.fetchRaporlar = async function() {
    const ay = document.getElementById('rapor-ay')?.value;
    if (!ay) return;
    const conn = window.checkSupabaseConnection();
    if (!conn.ok) return;

    const [year, month] = ay.split('-').map(Number);
    const firstDay = `${ay}-01`;
    const lastDayObj = new Date(year, month, 0);
    const lastDay = `${year}-${String(month).padStart(2,'0')}-${String(lastDayObj.getDate()).padStart(2,'0')}`;
    const fmt = (n) => '₺' + (n || 0).toLocaleString('tr-TR', {minimumFractionDigits:2});

    try {
        // --- Yakıt ---
        const {data: yakitlar} = await window.supabaseClient.from('yakit_takip')
            .select('toplam_tutar, arac_id, araclar(plaka)').gte('tarih', firstDay).lte('tarih', lastDay);

        // --- Bakım ---
        const {data: bakimlar} = await window.supabaseClient.from('arac_bakimlari')
            .select('toplam_tutar, arac_id, araclar(plaka)').gte('islem_tarihi', firstDay).lte('islem_tarihi', lastDay);

        // --- Poliçe / Sigorta ---
        const {data: policeler} = await window.supabaseClient.from('arac_policeler')
            .select('toplam_tutar, arac_id, araclar(plaka)').gte('baslangic_tarihi', firstDay).lte('baslangic_tarihi', lastDay);

        // --- Maaş ---
        const {data: maaslar} = await window.supabaseClient.from('sofor_maas_bordro')
            .select('net_maas, avans, ceza, haciz').eq('donem', ay);

        // --- Avans/Kesinti ---
        const {data: finanslar} = await window.supabaseClient.from('sofor_finans')
            .select('tutar, islem_turu').gte('tarih', firstDay).lte('tarih', lastDay);

        // Toplamlar
        const totalYakit = (yakitlar||[]).reduce((s,r) => s + parseFloat(r.toplam_tutar||0), 0);
        const totalBakim = (bakimlar||[]).reduce((s,r) => s + parseFloat(r.toplam_tutar||0), 0);
        const totalPolice = (policeler||[]).reduce((s,r) => s + parseFloat(r.toplam_tutar||0), 0);
        const totalMaas = (maaslar||[]).reduce((s,r) => s + parseFloat(r.net_maas||0), 0);
        const totalAvans = Math.abs((finanslar||[]).filter(f => f.islem_turu==='AVANS'||f.islem_turu==='KESİNTİ (Ceza/Hasar)').reduce((s,r) => s + parseFloat(r.tutar||0), 0));
        const totalCiro = (maaslar||[]).reduce((s,r) => s + parseFloat(r.net_maas||0) + Math.abs(parseFloat(r.avans||0)) + parseFloat(r.ceza||0) + parseFloat(r.haciz||0), 0);

        // KPI update
        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        safeSet('rapor-yakit', fmt(totalYakit));
        safeSet('rapor-bakim', fmt(totalBakim));
        safeSet('rapor-police', fmt(totalPolice));
        safeSet('rapor-maas', fmt(totalMaas));
        safeSet('rapor-avans', fmt(totalAvans));
        safeSet('rapor-ciro', fmt(totalYakit + totalBakim + totalPolice + totalMaas));
        safeSet('kpi-ciro', fmt(0)); // placeholder if needed from dashboard
        safeSet('kpi-gider', fmt(totalYakit + totalBakim));

        // --- Genel Gelir/Gider Tablosu ---
        const gelirGiderTbody = document.getElementById('rapor-gelir-gider-tbody');
        if (gelirGiderTbody) {
            const rows = [
                {label:'Yakıt Gideri', tur:'GİDER', tutar:totalYakit, color:'text-red-400'},
                {label:'Bakım/Onarım Gideri', tur:'GİDER', tutar:totalBakim, color:'text-red-400'},
                {label:'Sigorta/Poliçe Gideri', tur:'GİDER', tutar:totalPolice, color:'text-red-400'},
                {label:'Personel Maaş Gideri', tur:'GİDER', tutar:totalMaas, color:'text-red-400'},
                {label:'Avans/Kesinti Toplamı', tur:'GİDER', tutar:totalAvans, color:'text-orange-400'},
            ];
            const totalGider = rows.reduce((s,r) => s + r.tutar, 0);
            gelirGiderTbody.innerHTML = rows.map(r => `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                    <td class="p-3 font-medium text-sm text-gray-300">${r.label}</td>
                    <td class="p-3 text-center"><span class="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] uppercase font-bold rounded">${r.tur}</span></td>
                    <td class="p-3 text-right font-bold ${r.color}">${fmt(r.tutar)}</td>
                </tr>
            `).join('') + `<tr class="border-t-2 border-orange-500/30 bg-orange-500/5 font-black">
                <td class="p-4 text-orange-400 uppercase tracking-widest text-xs" colspan="2">TOPLAM GİDER</td>
                <td class="p-4 text-right text-orange-400 text-lg">${fmt(totalGider)}</td>
            </tr>`;

            // Chart 1: Category Distribution
            try {
                const ctx = document.getElementById('raporGelirGiderChart')?.getContext('2d');
                if (ctx) {
                    if (window._raporGelirChart) window._raporGelirChart.destroy();
                    window._raporGelirChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: rows.map(r => r.label),
                            datasets: [{ data: rows.map(r => r.tutar), backgroundColor: ['#3b82f6','#f97316','#ec4899','#eab308','#a855f7'], borderWidth: 0 }]
                        },
                        options: { 
                            responsive: true, maintainAspectRatio: false, cutout: '70%',
                            plugins: { legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 10, weight: 'bold' }, padding: 15, usePointStyle: true } } } 
                        }
                    });
                }
            } catch(e) { console.error('Chart error:', e); }

            // Highlights calculation
            const topCategory = rows.length > 0 ? rows.reduce((prev, current) => (prev.tutar > current.tutar) ? prev : current) : null;
            if (topCategory) {
                const hCat = document.getElementById('highlight-top-category');
                const hCatVal = document.getElementById('highlight-top-category-val');
                if (hCat) hCat.textContent = topCategory.label;
                if (hCatVal) hCatVal.textContent = fmt(topCategory.tutar);
            }
        }

        // --- Araç Bazlı Analiz & Chart 2 ---
        const aracMap = {};
        (yakitlar||[]).forEach(r => {
            const pid = r.arac_id; if(!aracMap[pid]) aracMap[pid] = {plaka:r.araclar?.plaka||pid, yakit:0, bakim:0, police:0};
            aracMap[pid].yakit += parseFloat(r.toplam_tutar||0);
        });
        (bakimlar||[]).forEach(r => {
            const pid = r.arac_id; if(!aracMap[pid]) aracMap[pid] = {plaka:r.araclar?.plaka||pid, yakit_bakim:0, bakim:0, police:0}; // Note: fix bakim typo
            if(!aracMap[pid].bakim) aracMap[pid].bakim = 0;
            aracMap[pid].bakim += parseFloat(r.toplam_tutar||0);
        });
        (policeler||[]).forEach(r => {
            const pid = r.arac_id; if(!aracMap[pid]) aracMap[pid] = {plaka:r.araclar?.plaka||pid, yakit:0, bakim:0, police:0};
            aracMap[pid].police += parseFloat(r.toplam_tutar||0);
        });

        const aracRows = Object.values(aracMap).sort((a,b) => (b.yakit+(b.bakim||0)+b.police) - (a.yakit+(a.bakim||0)+a.police));

        // Highlights: Top Vehicle
        if (aracRows.length > 0) {
            const topArac = aracRows[0];
            const hArac = document.getElementById('highlight-top-arac');
            const hAracVal = document.getElementById('highlight-top-arac-val');
            if (hArac) hArac.textContent = topArac.plaka;
            if (hAracVal) hAracVal.textContent = fmt(topArac.yakit + (topArac.bakim||0) + topArac.police);
        }
        const hActive = document.getElementById('highlight-active-count');
        if (hActive) hActive.textContent = aracRows.length;

        // Chart 2: Top 10 Vehicles Bar
        try {
            const ctx2 = document.getElementById('raporAracHarcamaChart')?.getContext('2d');
            if (ctx2) {
                if (window._raporAracChart) window._raporAracChart.destroy();
                const top10 = aracRows.slice(0, 10);
                window._raporAracChart = new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: top10.map(a => a.plaka),
                        datasets: [
                            { label: 'Yakit', data: top10.map(a => a.yakit), backgroundColor: '#ee8b35' },
                            { label: 'Bakim', data: top10.map(a => a.bakim||0), backgroundColor: '#42bbaa' },
                            { label: 'Police', data: top10.map(a => a.police), backgroundColor: '#a98bea' }
                        ]
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { size: 10 } } },
                            y: { stacked: true, grid: { display: false }, ticks: { color: '#fff', font: { size: 10, weight: 'bold' } } }
                        }
                    }
                });
            }
        } catch(e) { console.error('Chart 2 error:', e); }

        // --- Araç Bazlı Gider Tablosu ---
        const aracTbody = document.getElementById('rapor-arac-tbody');
        if (aracTbody) {
            if (aracRows.length === 0) {
                aracTbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Bu dönemde araç gideri bulunamadı.</td></tr>';
            } else {
                aracTbody.innerHTML = aracRows.map(a => {
                    const toplam = a.yakit + (a.bakim||0) + a.police;
                    return `<tr class="hover:bg-white/5 transition-colors">
                        <td class="p-3 font-bold">${a.plaka}</td>
                        <td class="p-3 text-right text-blue-400">${fmt(a.yakit)}</td>
                        <td class="p-3 text-right text-orange-400">${fmt(a.bakim||0)}</td>
                        <td class="p-3 text-right text-pink-400">${fmt(a.police)}</td>
                        <td class="p-3 text-right font-black text-white">${fmt(toplam)}</td>
                    </tr>`;
                }).join('');
            }
        }

        window._raporData = { ay, yakitlar, bakimlar, policeler, maaslar, finanslar };

        // Auto-load active tab data too
        const activeTab = document.querySelector('.rapor-tab-btn.bg-orange-500')?.id?.replace('rapor-tab-','');
        if (activeTab === 'personel') window.fetchRaporPersonel(ay);
        else if (activeTab === 'musteri') window.fetchRaporMusteri(ay);
        else if (activeTab === 'cari') window.fetchRaporCari();

    } catch(e) {
        console.error('[fetchRaporlar] Hata:', e);
    }
};

// ============================================================
// RAPORLAR - PERSONEL TAB
// ============================================================
window.fetchRaporPersonel = async function(ay) {
    const tbody = document.getElementById('rapor-personel-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-xs text-gray-500">Yükleniyor...</td></tr>';
    try {
        const {data: maaslar} = await window.supabaseClient.from('sofor_maas_bordro')
            .select('*, soforler(ad_soyad)').eq('donem', ay).order('net_maas', {ascending:false});
        const fmt = (n) => '₺' + (n||0).toLocaleString('tr-TR', {minimumFractionDigits:2});
        if (!maaslar || maaslar.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Bu dönem için personel maaş kaydı bulunamadı.</td></tr>';
            return;
        }
        tbody.innerHTML = maaslar.map(m => {
            const toplam = (parseFloat(m.net_maas)||0) - Math.abs(parseFloat(m.avans)||0) - (parseFloat(m.ceza)||0) - (parseFloat(m.haciz)||0);
            return `<tr class="hover:bg-white/5 transition-colors">
                <td class="p-3 font-bold">${m.soforler?.ad_soyad || 'Bilinmeyen'}</td>
                <td class="p-3 text-right text-amber-300">${fmt(m.net_maas)}</td>
                <td class="p-3 text-right text-red-400">${fmt(m.avans)}</td>
                <td class="p-3 text-right text-red-400">${fmt((parseFloat(m.ceza)||0)+(parseFloat(m.haciz)||0))}</td>
                <td class="p-3 text-right font-black ${toplam >= 0 ? 'text-green-400' : 'text-red-400'}">${fmt(toplam)}</td>
            </tr>`;
        }).join('');
        window._raporData = window._raporData || {};
        window._raporData.maasDetay = maaslar;
    } catch(e) { console.error('[fetchRaporPersonel]', e); }
};

// ============================================================
// RAPORLAR - MÜŞTERİ/SEFER TAB
// ============================================================
window.fetchRaporMusteri = async function(ay) {
    const tbody = document.getElementById('rapor-musteri-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-gray-500">Yükleniyor...</td></tr>';
    try {
        const {data: musteriler} = await window.supabaseClient.from('musteriler').select('id, ad');
        const {data: tanimlar} = await window.supabaseClient.from('musteri_arac_tanimlari')
            .select('musteri_id, tarife_turu, tek_fiyat, vardiya_fiyat');

        const fmt = (n) => '₺' + (n||0).toLocaleString('tr-TR', {minimumFractionDigits:2});
        if (!musteriler || musteriler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-gray-500 italic">Kayıtlı müşteri bulunamadı.</td></tr>';
            return;
        }

        const tanimMap = {};
        (tanimlar||[]).forEach(t => {
            if (!tanimMap[t.musteri_id]) tanimMap[t.musteri_id] = [];
            tanimMap[t.musteri_id].push(t);
        });

        const rows = musteriler.map(m => {
            const araclar = tanimMap[m.id] || [];
            const vardiyaAraclar = araclar.filter(t => t.tarife_turu?.toLowerCase().includes('vardiya'));
            const tekAraclar = araclar.filter(t => t.tarife_turu?.toLowerCase().includes('tek'));
            // Simple monthly estimate: 22 working days
            const aylikHakedis = vardiyaAraclar.reduce((s,t) => s + ((parseFloat(t.vardiya_fiyat)||0)*22), 0)
                + tekAraclar.reduce((s,t) => s + (parseFloat(t.tek_fiyat)||0), 0);
            return { ad: m.ad, vardiya: vardiyaAraclar.length, tek: tekAraclar.length, hakedis: aylikHakedis };
        }).filter(r => r.vardiya+r.tek > 0).sort((a,b) => b.hakedis - a.hakedis);

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-gray-500 italic">Bu dönemde araç tanımı bulunamadı.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => `<tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 font-bold">${r.ad}</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-bold rounded">${r.vardiya}</span></td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded">${r.tek}</span></td>
            <td class="p-3 text-right font-black text-orange-400">${fmt(r.hakedis)}</td>
        </tr>`).join('');
        window._raporData = window._raporData || {};
        window._raporData.musteriDetay = rows;
    } catch(e) { console.error('[fetchRaporMusteri]', e); }
};

// ============================================================
// RAPORLAR - CARİ BAKİYE TAB
// ============================================================
window.fetchRaporCari = async function() {
    const tbody = document.getElementById('rapor-cari-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-xs text-gray-500">Yükleniyor...</td></tr>';
    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) { tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-red-400">Bağlantı hatası</td></tr>'; return; }
        const {data: cariler} = await window.supabaseClient.from('cariler').select('id, unvan, tur').order('unvan');
        const {data: faturalar} = await window.supabaseClient.from('cari_faturalar').select('cari_id, toplam_tutar');
        const {data: odemeler} = await window.supabaseClient.from('cari_odemeler').select('cari_id, tutar');
        const fmt = (n) => '₺' + (n||0).toLocaleString('tr-TR', {minimumFractionDigits:2});

        const fatMap = {};
        (faturalar||[]).forEach(f => { fatMap[f.cari_id] = (fatMap[f.cari_id]||0) + parseFloat(f.toplam_tutar||0); });
        const odeMap = {};
        (odemeler||[]).forEach(o => { odeMap[o.cari_id] = (odeMap[o.cari_id]||0) + parseFloat(o.tutar||0); });

        const rows = (cariler||[]).map(c => ({
            ...c,
            borc: fatMap[c.id]||0,
            odenen: odeMap[c.id]||0,
            bakiye: (fatMap[c.id]||0) - (odeMap[c.id]||0)
        })).filter(c => c.borc > 0 || c.odenen > 0).sort((a,b) => b.bakiye - a.bakiye);

        if (rows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-12 text-center text-gray-500 italic">Cari hesap kaydı bulunamadı.</td></tr>';
            return;
        }
        tbody.innerHTML = rows.map(r => `<tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 font-bold">${r.unvan}</td>
            <td class="p-3"><span class="px-2 py-0.5 bg-gray-500/10 text-gray-400 text-[10px] uppercase font-bold rounded">${r.tur||'Cari'}</span></td>
            <td class="p-3 text-right text-red-400 font-bold">${fmt(r.borc)}</td>
            <td class="p-3 text-right text-green-400 font-bold">${fmt(r.odenen)}</td>
            <td class="p-3 text-right font-black ${r.bakiye > 0 ? 'text-orange-400' : 'text-green-400'}">${fmt(r.bakiye)}</td>
        </tr>`).join('');
        window._raporData = window._raporData || {};
        window._raporData.cariDetay = rows;
    } catch(e) { console.error('[fetchRaporCari]', e); }
};

// ============================================================
// RAPORLAR - EXCEL EXPORT
// ============================================================
window.exportRaporExcel = function(tab) {
    if (!window.XLSX) { alert('SheetJS kütüphanesi yüklenemedi.'); return; }
    const ay = document.getElementById('rapor-ay')?.value || 'rapor';
    const tableIds = {
        genel: 'rapor-genel-table', arac: 'rapor-arac-table',
        personel: 'rapor-personel-table', musteri: 'rapor-musteri-table', cari: 'rapor-cari-table'
    };
    const tabLabels = {genel:'Genel_Ozet', arac:'Arac_Gider', personel:'Personel_Maas', musteri:'Musteri_Sefer', cari:'Cari_Bakiye'};
    const tableId = tableIds[tab];
    const label = tabLabels[tab] || tab;
    if (!tableId) return;
    const table = document.getElementById(tableId);
    if (!table) { alert('Tablo bulunamadı.'); return; }
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, label);
        XLSX.writeFile(wb, `Filo_${label}_${ay}.xlsx`);
    } catch(e) { console.error(e); alert('Excel indirme hatası: ' + e.message); }
};

// ============================================================
// RAPORLAR - PDF EXPORT  
// ============================================================
window.exportRaporPDF = function(tab) {
    if (!window.jspdf) { alert('jsPDF kütüphanesi yüklenemedi.'); return; }
    const ay = document.getElementById('rapor-ay')?.value || 'rapor';
    const tableIds = {
        genel: 'rapor-genel-table', arac: 'rapor-arac-table',
        personel: 'rapor-personel-table', musteri: 'rapor-musteri-table', cari: 'rapor-cari-table'
    };
    const tabTitles = {
        genel: 'Genel Ozet Raporu', arac: 'Arac Bazli Gider Raporu',
        personel: 'Personel Maas Raporu', musteri: 'Musteri Sefer Raporu', cari: 'Cari Bakiye Raporu'
    };
    const tableId = tableIds[tab];
    if (!tableId) return;
    const table = document.getElementById(tableId);
    if (!table) { alert('Tablo yüklenmedi. Önce bir dönem seçin.'); return; }
    try {
        const {jsPDF} = window.jspdf;
        const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
        window.CompanyBranding.addPdfBranding(doc, {
            title: (tabTitles[tab] || tab) + ' Raporu',
            subtitle: 'Dönem: ' + ay + ' • Oluşturulma: ' + new Date().toLocaleDateString('tr-TR')
        });

        // Collect table data
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        const bodyRows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
        ).filter(row => row.some(cell => cell));

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                head: [headers],
                body: bodyRows,
                startY: 33,
                theme: 'striped',
                headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 7, cellPadding: 3 },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { left: 14, right: 14 }
            });
        } else {
            doc.text('Not: autoTable eklentisi yuklenemedi. Sadece baslik kaydedildi.', 14, 40);
        }
        doc.save(`Filo_${tabTitles[tab]?.replace(/\s+/g,'_')}_${ay}.pdf`);
    } catch(e) { console.error(e); alert('PDF olusturma hatasi: ' + e.message); }
};

// ============================================================
// RAPORLAR - PROFESSIONAL PRINT (HTML Based)
// ============================================================
window.handleRaporPrint = function(tab) {
    const printSection = document.getElementById('print-section');
    if (!printSection) return;
    const branding = window.CompanyBranding;

    const ay = document.getElementById('rapor-ay')?.value || 'rapor';
    const reportTitle = {
        genel: 'Genel Özet Raporu',
        arac: 'Araç Gider Raporu',
        personel: 'Personel Maaş Raporu',
        musteri: 'Müşteri Sefer Raporu',
        cari: 'Cari Bakiye Raporu'
    }[tab] || 'Sistem Raporu';

    let printHTML = `
        <div style="font-family: 'Inter', sans-serif; color: #111;">
            <style>${branding.getPrintStyles()}</style>
            ${branding.getPrintHeader({ title: reportTitle, subtitle: 'Dönem: ' + ay + ' • Tarih: ' + new Date().toLocaleString('tr-TR') })}
    `;

    if (tab === 'genel') {
        // Summary Cards for Print
        const kpis = [
            { label: 'Yakıt', val: document.getElementById('rapor-yakit')?.textContent || '0 TL', color: '#3b82f6' },
            { label: 'Bakım', val: document.getElementById('rapor-bakim')?.textContent || '0 TL', color: '#f97316' },
            { label: 'Sigorta', val: document.getElementById('rapor-police')?.textContent || '0 TL', color: '#ec4899' },
            { label: 'Maaş', val: document.getElementById('rapor-maas')?.textContent || '0 TL', color: '#eab308' },
            { label: 'Avans', val: document.getElementById('rapor-avans')?.textContent || '0 TL', color: '#a855f7' },
            { label: 'Cari Hakediş', val: document.getElementById('rapor-ciro')?.textContent || '0 TL', color: '#0891b2' }
        ];

        printHTML += `
            <div class="print-grid" style="margin-bottom: 30px;">
                ${kpis.map(k => `
                    <div class="print-card" style="border-left: 4px solid ${k.color};">
                        <div style="font-size: 10px; font-weight: 700; color: #666; text-transform: uppercase;">${k.label}</div>
                        <div style="font-size: 18px; font-weight: 800; color: #000; margin-top: 5px;">${k.val}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Highlights Section for Print -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 25px;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">En Çok Harcayan Araç</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${document.getElementById('highlight-top-arac')?.textContent || '-'}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${document.getElementById('highlight-top-arac-val')?.textContent || '0 TL'}</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">En Yüksek Gider Kalemi</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${document.getElementById('highlight-top-category')?.textContent || '-'}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">${document.getElementById('highlight-top-category-val')?.textContent || '0 TL'}</div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
                    <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Aktif Araç Sayısı</div>
                    <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${document.getElementById('highlight-active-count')?.textContent || '0'}</div>
                    <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">İşlem gören araçlar</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 20px; margin-bottom: 30px;">
                <!-- Tables -->
                <div class="print-card" style="margin-bottom: 0;">
                    <h3 style="font-size: 12px; font-weight: 700; margin: 0 0 12px 0; border-bottom: 1px solid #EEE; padding-bottom: 6px;">Dönem Karşılaştırması</h3>
                    <table id="print-table-genel">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Kalem</th>
                                <th style="text-align: center;">Tür</th>
                                <th style="text-align: right;">Seçilen Ay</th>
                                <th style="text-align: right;">Önceki Ay</th>
                                <th style="text-align: right;">Değişim</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Array.from(document.querySelectorAll('#rapor-gelir-gider-tbody tr')).map(tr => {
                                const cells = tr.querySelectorAll('td');
                                if (cells.length < 5) return '';
                                const isTotal = tr.classList.contains('font-black');
                                return `
                                    <tr style="${isTotal ? 'background: #f1f5f9; font-weight: 800;' : ''}">
                                        <td style="padding: 8px 6px;">${cells[0].textContent}</td>
                                        <td style="padding: 8px 6px; text-align: center;">${cells[1].textContent}</td>
                                        <td style="padding: 8px 6px; text-align: right;">${cells[2].textContent}</td>
                                        <td style="padding: 8px 6px; text-align: right;">${cells[3].textContent}</td>
                                        <td style="padding: 8px 6px; text-align: right;">${cells[4].textContent}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <!-- Charts -->
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="print-card" style="margin-bottom: 0; text-align: center;">
                        <div style="font-size: 10px; font-weight: 700; color: #666; margin-bottom: 10px; text-align: left; border-bottom: 1px solid #eee; padding-bottom: 5px;">Kategori Dağılımı</div>
                        <img src="${document.getElementById('raporGelirGiderChart')?.toDataURL('image/png')}" style="max-width: 100%; height: 160px; object-fit: contain;">
                    </div>
                </div>
            </div>

            <div class="print-card">
                <div style="font-size: 10px; font-weight: 700; color: #666; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">En Yüksek Harcamalı Araçlar (Top 10)</div>
                <img src="${document.getElementById('raporAracHarcamaChart')?.toDataURL('image/png')}" style="width: 100%; height: 300px; object-fit: contain;">
            </div>
        `;
    } else {
        // Generic table print for other tabs
        const sourceTable = document.getElementById({
            arac: 'rapor-arac-table',
            personel: 'rapor-personel-table',
            musteri: 'rapor-musteri-table',
            cari: 'rapor-cari-table'
        }[tab]);

        if (sourceTable) {
            printHTML += `
                <div class="print-card">
                    <table>
                        <thead>
                            ${sourceTable.querySelector('thead').innerHTML}
                        </thead>
                        <tbody>
                            ${sourceTable.querySelector('tbody').innerHTML}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    printHTML += `
            ${branding.getPrintFooter('Bu belge sistem tarafından otomatik oluşturulmuştur.')}
        </div>
    `;

    printSection.innerHTML = printHTML;
    window.print();
};

// ============================================================
// DASHBOARD - Aktif Musteri KPI + Activity Feed + Taseron KPI
// ============================================================
const _origFetchDashboardData = window.fetchDashboardData;
window.fetchDashboardData = async function() {
    // Call original first if it exists
    if (typeof _origFetchDashboardData === 'function') {
        try { await _origFetchDashboardData(); } catch(e) { console.warn('Original dashboard error:', e); }
    }

    // Extra KPIs
    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) return;

        const now = new Date();
        const ay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const firstDay = `${ay}-01`;
        const lastDayObj = new Date(now.getFullYear(), now.getMonth()+1, 0);
        const lastDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(lastDayObj.getDate()).padStart(2,'0')}`;

        // Aktif müşteri sayısı
        const {count: musteriCount} = await window.supabaseClient.from('musteriler').select('id', {count:'exact', head:true});
        const musteriEl = document.getElementById('kpi-musteri');
        if (musteriEl) musteriEl.textContent = musteriCount || 0;

        // Taşeron hakediş
        const {data: hakedisler} = await window.supabaseClient.from('taseron_hakedis')
            .select('net_hakedis').gte('sefer_tarihi', firstDay).lte('sefer_tarihi', lastDay);
        const totalHakedis = (hakedisler||[]).reduce((s,r) => s + parseFloat(r.net_hakedis||0), 0);
        const taseronEl = document.getElementById('kpi-taseron-hakedis');
        if (taseronEl) taseronEl.textContent = '₺' + totalHakedis.toLocaleString('tr-TR', {minimumFractionDigits:0});

        // Activity Feed
        await window.fetchSonAktiviteler();

    } catch(e) { console.error('[fetchDashboardData extra]', e); }
};

window.fetchSonAktiviteler = async function() {
    const tbody = document.getElementById('son-islemler-tbody');
    if (!tbody) return;
    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) return;

        const typeColors = {
            'Yakıt': 'bg-blue-500/10 text-blue-400',
            'Bakım': 'bg-orange-500/10 text-orange-400',
            'Maaş': 'bg-yellow-500/10 text-yellow-400',
            'Cari Fatura': 'bg-red-500/10 text-red-400',
            'Poliçe': 'bg-pink-500/10 text-pink-400'
        };

        const [yakitRes, bakimRes, maasRes, fatRes, policeRes] = await Promise.all([
            window.supabaseClient.from('yakit_takip').select('tarih, toplam_tutar, araclar(plaka)').order('tarih', {ascending:false}).limit(30),
            window.supabaseClient.from('arac_bakimlari').select('islem_tarihi, toplam_tutar, aciklama, araclar(plaka)').order('islem_tarihi', {ascending:false}).limit(30),
            window.supabaseClient.from('sofor_maas_bordro').select('donem, net_maas, soforler(ad_soyad)').order('created_at', {ascending:false}).limit(30),
            window.supabaseClient.from('cari_faturalar').select('fatura_tarihi, toplam_tutar, aciklama, cariler(unvan)').order('fatura_tarihi', {ascending:false}).limit(30),
            window.supabaseClient.from('arac_policeler').select('baslangic_tarihi, toplam_tutar, police_turu, araclar(plaka)').order('created_at', {ascending:false}).limit(20),
        ]);

        const activities = [];
        (yakitRes.data||[]).forEach(r => activities.push({tarih:r.tarih, tur:'Yakıt', detay:`${r.araclar?.plaka||'-'} - Yakıt`, tutar:r.toplam_tutar}));
        (bakimRes.data||[]).forEach(r => activities.push({tarih:r.islem_tarihi, tur:'Bakım', detay:`${r.araclar?.plaka||'-'} - ${(r.aciklama||'').substring(0,30)}`, tutar:r.toplam_tutar}));
        (maasRes.data||[]).forEach(r => activities.push({tarih:r.donem+'-01', tur:'Maaş', detay:`${r.soforler?.ad_soyad||'-'} Maaş`, tutar:r.net_maas}));
        (fatRes.data||[]).forEach(r => activities.push({tarih:r.fatura_tarihi, tur:'Cari Fatura', detay:`${r.cariler?.unvan||'-'} - ${(r.aciklama||'').substring(0,25)}`, tutar:r.toplam_tutar}));
        (policeRes.data||[]).forEach(r => activities.push({tarih:r.baslangic_tarihi, tur:'Poliçe', detay:`${r.araclar?.plaka||'-'} ${r.police_turu}`, tutar:r.toplam_tutar}));

        activities.sort((a,b) => new Date(b.tarih) - new Date(a.tarih));
        const top = activities.slice(0, 50);

        if (top.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-gray-500 italic">Henüz kayıt yok.</td></tr>';
            return;
        }

        const fmt = (n) => n != null ? '₺' + parseFloat(n).toLocaleString('tr-TR', {minimumFractionDigits:2}) : '-';
        tbody.innerHTML = top.map(a => {
            const colorClass = typeColors[a.tur] || 'bg-gray-500/10 text-gray-400';
            return `<tr class="hover:bg-white/5 transition-colors border-b border-white/5">
                <td class="py-3 px-2 text-xs text-gray-500 whitespace-nowrap">${a.tarih||'-'}</td>
                <td class="py-3 px-2"><span class="px-2 py-0.5 ${colorClass} text-[10px] uppercase font-bold rounded whitespace-nowrap">${a.tur}</span></td>
                <td class="py-3 px-2 text-xs text-gray-300 truncate max-w-xs" title="${a.detay}">${a.detay}</td>
                <td class="py-3 px-2 text-xs font-bold text-right text-white whitespace-nowrap">${fmt(a.tutar)}</td>
            </tr>`;
        }).join('');
    } catch(e) { console.error('[fetchSonAktiviteler]', e); }
};



// ============================================
// DASHBOARD DATA LOADING
// ============================================

window.fetchDashboard = async function() {

  
  // Connection check
  const conn = window.checkSupabaseConnection();
  if (!conn.ok) {
    console.error('[Dashboard] Connection failed:', conn.msg);
    if (window.showGlobalError) {
      window.showGlobalError('dashboard-container', conn.msg);
    }
    return;
  }

  try {
    // Parallel queries with Promise.allSettled (graceful degradation)
    const [
      araclarResult,
      soforlerResult,
      musterilerResult,
      evraklarResult,
      ciroResult,
      yakitResult
    ] = await Promise.allSettled([
      window.supabaseClient.from('araclar').select('id, mulkiyet_durumu', { count: 'exact', head: true }),
      window.supabaseClient.from('soforler').select('id', { count: 'exact', head: true }),
      window.supabaseClient.from('musteriler').select('id', { count: 'exact', head: true }),
      window.supabaseClient.from('arac_evrak')
        .select('id')
        .gte('bitis_tarihi', new Date().toISOString().split('T')[0])
        .lte('bitis_tarihi', new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0])
        .select('*', { count: 'exact', head: true }),
      window.supabaseClient.from('musteri_servis_puantaj')
        .select('gunluk_ucret')
        .gte('tarih', `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`),
      window.supabaseClient.from('yakit_kayit')
        .select('toplam_tutar')
        .gte('tarih', `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`)
    ]);

    // Extract data (handle errors gracefully)
    const araclar = araclarResult.status === 'fulfilled' ? araclarResult.value : { count: 0 };
    const soforler = soforlerResult.status === 'fulfilled' ? soforlerResult.value : { count: 0 };
    const musteriler = musterilerResult.status === 'fulfilled' ? musterilerResult.value : { count: 0 };
    const evraklar = evraklarResult.status === 'fulfilled' ? evraklarResult.value : { count: 0 };
    const ciroData = ciroResult.status === 'fulfilled' ? ciroResult.value.data : [];
    const yakitData = yakitResult.status === 'fulfilled' ? yakitResult.value.data : [];

    // Log any failed queries
    [araclarResult, soforlerResult, musterilerResult, evraklarResult, ciroResult, yakitResult].forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.warn(`[Dashboard] Query ${idx} failed:`, result.reason);
      }
    });

    // Calculate stats
    const stats = {
      arac: araclar.count || 0,
      sofor: soforler.count || 0,
      evrak: evraklar.count || 0,
      musteri: musteriler.count || 0,
      ciro: Array.isArray(ciroData) ? ciroData.reduce((sum, r) => sum + (parseFloat(r.gunluk_ucret) || 0), 0) : 0,
      gider: Array.isArray(yakitData) ? yakitData.reduce((sum, r) => sum + (parseFloat(r.toplam_tutar) || 0), 0) : 0,
    };



    // Update DOM (XSS safe - textContent only)
    const updates = {
      'stat-arac-count': stats.arac,
      'stat-sofor-count': stats.sofor,
      'stat-evrak-count': stats.evrak,
      'stat-musteri-count': stats.musteri,
      'stat-ciro': `${stats.ciro.toLocaleString('tr-TR')} ₺`,
      'stat-gider': `${stats.gider.toLocaleString('tr-TR')} ₺`,
    };

    let updatedCount = 0;
    for (let [id, value] of Object.entries(updates)) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
        updatedCount++;
      } else {
        console.warn(`[Dashboard] Element not found: #${id}`);
      }
    }



    // Update chart if Chart.js available
    if (window.Chart && typeof window.updateCiroGiderChart === 'function') {
      window.updateCiroGiderChart(stats.ciro, stats.gider);
    }

  } catch (error) {
    console.error('[Dashboard] ❌ Fatal error:', error);
    if (window.Toast && window.Toast.error) {
      window.Toast.error(`Dashboard yüklenemedi: ${error.message}`);
    } else {
      alert(`Dashboard hatası: ${error.message}`);
    }
  }
};

// Güvenli başlatma fonksiyonu: Sadece başarılı giriş sonrası çağrılır
window.initApp = function() {
  if (window.appInitialized) return;
  if (!window.__dashboardModuleReady) {
    clearTimeout(window.__pendingAppInitTimer);
    window.__pendingAppInitTimer = setTimeout(window.initApp, 25);
    return;
  }
  window.appInitialized = true;
  

  if (window.supabaseClient && window.fetchDashboard) {
     window.fetchDashboard();
  }
};



// ============================================
// PHASE 2 - OPERASYON TAKVİMİ (GANTT CHART)
// ============================================

window.fetchTakvim = async function() {
    const grid = document.getElementById('takvim-grid');
    const selector = document.getElementById('takvim-ay-secici');
    if (!grid || !selector) return;
    
    grid.innerHTML = '<div class="p-12 text-center text-gray-500 font-bold uppercase tracking-widest animate-pulse">Veriler yükleniyor...</div>';

    try {
        let selectedStr = selector.value;
        const now = new Date();
        
        if (!selectedStr) {
            selectedStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            let opts = '';
            for(let i=-6; i<=6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
                const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                const label = d.toLocaleDateString('tr-TR', {month:'long', year:'numeric'});
                opts += `<option value="${val}" ${i===0?'selected':''}>${label}</option>`;
            }
            selector.innerHTML = opts;
            selectedStr = selector.value;
        }

        const [y, m] = selectedStr.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        const startStr = `${selectedStr}-01`;
        const endStr = `${selectedStr}-${String(daysInMonth).padStart(2,'0')}`;

        const [aracRes, pushRes, musteriRes] = await Promise.all([
            window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu').order('plaka'),
            window.supabaseClient.from('musteri_servis_puantaj').select('arac_id, musteri_id, tarih, vardiya, tek').gte('tarih', startStr).lte('tarih', endStr),
            window.supabaseClient.from('musteriler').select('id, ad')
        ]);

        const araclar = window.sanitizeDataArray(aracRes.data || []);
        const puantaj = window.sanitizeDataArray(pushRes.data || []);
        const musteriler = window.sanitizeDataArray(musteriRes.data || []);

        const musteriMap = {};
        musteriler.forEach(ms => { musteriMap[ms.id] = ms.ad || 'İsimsiz Fabrika'; });
        const aracLookup = {};
        araclar.forEach(a => { aracLookup[a.id] = a; });

        // MATRIX: musteri_id -> arac_id -> day -> {v, t}
        const musteriMatrix = {};
        const calisanAraclar = new Set(); // Hangi aracın en az 1 sefere çıktığını tutalım

        puantaj.forEach(p => {
             const mId = p.musteri_id || 'diger';
             if (!p.tarih || !p.arac_id) return;
             const day = parseInt(p.tarih.split('-')[2], 10);
             
             if (!musteriMatrix[mId]) musteriMatrix[mId] = {};
             if (!musteriMatrix[mId][p.arac_id]) musteriMatrix[mId][p.arac_id] = {};
             if (!musteriMatrix[mId][p.arac_id][day]) musteriMatrix[mId][p.arac_id][day] = {v:0, t:0};
             
             musteriMatrix[mId][p.arac_id][day].v += (parseFloat(p.vardiya) || 0);
             musteriMatrix[mId][p.arac_id][day].t += (parseFloat(p.tek) || 0);
             calisanAraclar.add(p.arac_id);
        });

        let html = '<div class="flex border-b border-white/10 bg-[#0d0f11] sticky top-0 z-20 w-fit min-w-full shadow-2xl">';
        html += '<div class="w-40 flex-shrink-0 p-3 font-bold text-xs text-gray-500 uppercase tracking-widest sticky left-0 bg-[#0d0f11] z-30 border-r border-white/10">FABRİKA & PLAKA</div>';
        for (let i=1; i<=daysInMonth; i++) {
            html += `<div class="w-8 flex-shrink-0 p-2 text-center font-bold text-[10px] text-gray-500 border-r border-white/5 flex items-center justify-center">${i}</div>`;
        }
        html += '</div>';

        // MÜŞTERİ (FABRİKA) GRUPLARINI ÇİZ
        for (const [mid, aracMap] of Object.entries(musteriMatrix)) {
            const mUnvan = musteriMap[mid] || (mid === 'diger' ? 'Serbest / Diğer Seferler' : 'Kayıt Dışı Fabrika');
            
            // Fabrika Header Satırı
            html += `<div class="flex sticky left-0 w-fit min-w-full bg-[#1b120c] border-y border-orange-500/20 group">`;
            html += `<div class="sticky left-0 w-40 flex-shrink-0 px-3 py-1.5 font-black text-[10px] text-orange-400 uppercase tracking-widest bg-[#1b120c] z-10 border-r border-orange-500/20 overflow-hidden text-ellipsis whitespace-nowrap" title="${mUnvan}">
                        <i data-lucide="building-2" class="w-3 h-3 inline mr-1 opacity-70"></i>${mUnvan}
                    </div>`;
            // Boş hücreleri tamamla
            for (let i=1; i<=daysInMonth; i++) {
                html += `<div class="w-8 flex-shrink-0 border-r border-white/5 opacity-20"></div>`;
            }
            html += `</div>`;

            // Altındaki Araçları Çiz
            const sortedAracIds = Object.keys(aracMap).sort((a,b) => {
                const p1 = (aracLookup[a]?.plaka || '').toLowerCase();
                const p2 = (aracLookup[b]?.plaka || '').toLowerCase();
                return p1.localeCompare(p2);
            });

            sortedAracIds.forEach(aid => {
                const a = aracLookup[aid] || {plaka: 'Silinmiş Araç', mulkiyet_durumu: '-'};
                html += `<div class="flex border-b border-white/5 hover:bg-white/5 transition-colors w-fit min-w-full group">`;
                html += `<div class="w-40 flex-shrink-0 pl-6 pr-3 py-2 font-bold text-sm text-gray-300 sticky left-0 bg-[#0d0f11] z-10 border-r border-white/10 whitespace-nowrap overflow-hidden text-ellipsis group-hover:bg-[#15181c] transition-colors leading-tight">
                            ${a.plaka}
                            <div class="text-[9px] text-gray-600 block mt-0.5">${a.mulkiyet_durumu||'-'}</div>
                        </div>`;
                
                for (let i=1; i<=daysInMonth; i++) {
                    const dayData = aracMap[aid][i];
                    if (dayData) {
                        let bg = 'bg-transparent';
                        if (dayData.v > 0) bg = 'bg-blue-500/20 border-blue-500/50 text-blue-400';
                        else if (dayData.t > 0) bg = 'bg-orange-500/20 border-orange-500/50 text-orange-400';
                        
                        const tipText = `${a.plaka} | ${i} ${selectedStr} | ${mUnvan} | ${dayData.v>0?'Vardiya':'Tek Sefer'}`;
                        
                        html += `<div class="w-8 flex-shrink-0 border-r border-white/5 p-0.5 relative cursor-pointer group/cell" title="${tipText}">
                            <div class="w-full h-full rounded ${bg} border border-transparent hover:border-current flex items-center justify-center text-[10px] font-black transition-all">${dayData.v>0?'V':(dayData.t>0?'T':'')}</div>
                        </div>`;
                    } else {
                        html += `<div class="w-8 flex-shrink-0 border-r border-white/5 p-1 relative">
                            <div class="w-full h-full rounded-sm border border-transparent group-hover:border-white/5 transition-all cursor-pointer" title="Boşta"></div>
                        </div>`;
                    }
                }
                html += `</div>`;
            });
        }

        // HİÇ ÇALIŞMAYAN (YATAN) ARAÇLAR
        const yatanAraclar = araclar.filter(a => !calisanAraclar.has(a.id));
        if (yatanAraclar.length > 0) {
            html += `<div class="flex sticky left-0 w-fit min-w-full bg-[#1a1315] border-y border-red-500/20 group">`;
            html += `<div class="sticky left-0 w-40 flex-shrink-0 px-3 py-1.5 font-black text-[10px] text-red-500 uppercase tracking-widest bg-[#1a1315] z-10 border-r border-red-500/20" title="Tabloda bu ay hiç tur atmamış/boşta kalmış araçlar.">
                        <i data-lucide="parking-circle" class="w-3 h-3 inline mr-1 opacity-70"></i>PASİF & BOŞTA
                    </div>`;
            for (let i=1; i<=daysInMonth; i++) html += `<div class="w-8 flex-shrink-0 border-r border-white/5 opacity-20"></div>`;
            html += `</div>`;

            yatanAraclar.forEach(a => {
                html += `<div class="flex border-b border-white/5 hover:bg-white/5 transition-colors w-fit min-w-full group">`;
                html += `<div class="w-40 flex-shrink-0 pl-6 pr-3 py-2 font-bold text-sm text-gray-500 sticky left-0 bg-[#0d0f11] z-10 border-r border-white/10 whitespace-nowrap overflow-hidden group-hover:bg-[#15181c] transition-colors leading-tight">
                            <span class="opacity-50 line-through decoration-red-500/50">${a.plaka}</span>
                            <div class="text-[9px] text-gray-600 block mt-0.5">${a.mulkiyet_durumu||'-'}</div>
                        </div>`;
                for (let i=1; i<=daysInMonth; i++) {
                    html += `<div class="w-8 flex-shrink-0 border-r border-white/5 p-1 bg-red-500/5 transition-all"></div>`;
                }
                html += `</div>`;
            });
        }

        if (araclar.length === 0) {
            html += `<div class="p-8 text-center text-gray-500">Sistemde kayıtlı araç yok.</div>`;
        }

        grid.innerHTML = html;
        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error('[fetchTakvim]', e);
        grid.innerHTML = `<div class="p-8 text-center text-red-500">Takvim yüklenemedi: ${e.message}</div>`;
    }
};

window.filterTakvim = function(kw) {
    if(!kw) kw = '';
    kw = kw.toLowerCase().trim();
    const rows = document.querySelectorAll('#takvim-grid > .group');
    rows.forEach(r => {
        if (!kw) {
            r.classList.remove('hidden');
            r.classList.add('flex');
            return;
        }
        let textStr = r.innerText.toLowerCase();
        let tips = Array.from(r.querySelectorAll('[title]')).map(el => el.getAttribute('title').toLowerCase()).join(' ');
        if (textStr.includes(kw) || tips.includes(kw)) {
            r.classList.remove('hidden');
            r.classList.add('flex');
        } else {
            r.classList.remove('flex');
            r.classList.add('hidden');
        }
    });
};


// ============================================
// ŞOFÖR PDKS & MAAŞ YÖNETİMİ & VADE ALARMLARI
// ============================================
window.fetchSoforMaas = async function() {
    const tbody = document.getElementById("maaslar-tbody");
    if (!tbody) return;
    try {
        const { data: soforler, error } = await window.supabaseClient.from("soforler").select("*").order("ad_soyad", {ascending: true});
        if (error) throw error;
        const { data: kesintiler } = await window.supabaseClient.from("sofor_avans_kesinti").select("sofor_id, tutar");
        if (!soforler || soforler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-12 text-center text-gray-500 italic">Kayıtlı personel bulunamadı.</td></tr>';
            return;
        }
        const fmt = n => "₺" + parseFloat(n||0).toLocaleString("tr-TR", {minimumFractionDigits:2});
        let tc = 0, tn = 0;
        
        tbody.innerHTML = soforler.map(s => {
            let baslik = `<div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400/20 to-red-500/20 text-orange-500 font-bold flex items-center justify-center border border-orange-500/50">${s.ad_soyad.substring(0,2).toUpperCase()}</div><div><p class="font-bold text-white">${s.ad_soyad}</p><p class="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Kadro: Şoför</p></div></div>`;
            let sumKesinti = (kesintiler||[]).filter(k => k.sofor_id === s.id).reduce((sum, item) => sum + parseFloat(item.tutar||0), 0);
            tc += sumKesinti;
            let rm = s.maas_tipi === "Sabit" ? parseFloat(s.sabit_maas||0) : 0;
            let net = rm - sumKesinti;
            tn += net;
            let kHtml = sumKesinti > 0 ? `<div class="flex justify-end items-center gap-2"><span class="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded cursor-pointer" title="Detaylar için Avans Ekle butonuna tıklayın">- ${fmt(sumKesinti)}</span></div>` : `<span class="text-xs text-gray-500 block text-right">Yok</span>`;
            
            return `<tr class="hover:bg-white/5 transition-all group">
                <td class="p-4">${baslik}</td>
                <td class="p-4 text-xs font-bold text-gray-400">${s.telefon||"-"}</td>
                <td class="p-4 text-sm font-black text-gray-300 text-right">${fmt(rm)}</td>
                <td class="p-4">${kHtml}</td>
                <td class="p-4 text-lg font-black text-amber-300 text-right">${fmt(net)}</td>
                <td class="p-4 text-center">
                    <button onclick="window.openAvansKesinti('${s.id}', '${s.ad_soyad}')" class="px-4 py-2 bg-orange-500/10 hover:bg-orange-500 focus:ring-2 ring-orange-500 text-orange-500 hover:text-white border border-orange-500/50 rounded-lg text-[10px] uppercase tracking-widest font-black transition-all shadow-lg"> + Avans / Ceza </button>
                </td>
            </tr>`;
        }).join("");
        
        let elCount = document.getElementById("pdks-kpi-count"); if(elCount) elCount.textContent = soforler.length;
        let elKes = document.getElementById("pdks-kpi-kesinti"); if(elKes) elKes.textContent = fmt(tc);
        let elNet = document.getElementById("pdks-kpi-net"); if(elNet) elNet.textContent = fmt(tn);
        if(window.lucide) window.lucide.createIcons();
    } catch(err) {
        console.error("fetchSoforMaas error:", err);
    }
};

window.openAvansKesinti = async function(id, adSoyad) {
    document.getElementById("ak-sofor-ad").textContent = adSoyad;
    document.getElementById("ak-sofor-id").value = id;
    document.getElementById("ak-tarih").value = new Date().toISOString().split("T")[0];
    document.getElementById("ak-tur").value = "Avans";
    document.getElementById("ak-tutar").value = "";
    document.getElementById("ak-aciklama").value = "";
    const tbody = document.getElementById("ak-gecmis-tbody");
    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-xs text-gray-500">Yükleniyor...</td></tr>';
    document.getElementById("avans-kesinti-modal").classList.remove("hidden");
    document.getElementById("avans-kesinti-modal").classList.add("flex");
    try {
        const { data, error } = await window.supabaseClient.from("sofor_avans_kesinti").select("*").eq("sofor_id", id).order("tarih", {ascending: false});
        if(error) throw error;
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-xs text-gray-500">Bu personelin geçmiş verisi yok.</td></tr>';
            return;
        }
        const fmt = n => "₺" + parseFloat(n||0).toLocaleString("tr-TR", {minimumFractionDigits:2});
        tbody.innerHTML = data.map(r => `<tr class="border-b border-white/5 hover:bg-white/5">
                <td class="p-3">${r.tarih}</td>
                <td class="p-3"><span class="px-2 py-0.5 bg-white/10 rounded text-xs font-bold text-gray-300">${r.tur}</span></td>
                <td class="p-3 text-xs text-gray-400">${r.aciklama||"-"}</td>
                <td class="p-3 text-right font-black text-red-500">-${fmt(r.tutar)}</td>
                <td class="p-3 text-center">
                    <button onclick="window.silAvansKesinti('${r.id}', '${id}')" class="text-gray-500 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4 mx-auto"></i></button>
                </td>
            </tr>`).join("");
        if(window.lucide) window.lucide.createIcons();
    } catch(err) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-xs text-red-500">Veri çekilemedi!</td></tr>';
    }
};

window.saveAvansKesinti = async function() {
    const data = {
        sofor_id: document.getElementById("ak-sofor-id").value,
        tarih: document.getElementById("ak-tarih").value,
        tur: document.getElementById("ak-tur").value,
        tutar: parseFloat(document.getElementById("ak-tutar").value || 0),
        aciklama: document.getElementById("ak-aciklama").value
    };
    if(!data.sofor_id || !data.tarih || !data.tur || isNaN(data.tutar) || data.tutar <= 0) {
        if(window.Toast) window.Toast.warning("Lütfen geçerli bir tutar ve tarih giriniz.");
        return;
    }
    try {
        const { error } = await window.supabaseClient.from("sofor_avans_kesinti").insert([data]);
        if(error) throw error;
        if(window.Toast) window.Toast.success("Kesinti kaydedildi!");
        window.openAvansKesinti(data.sofor_id, document.getElementById("ak-sofor-ad").textContent);
        if(window.fetchSoforMaas) window.fetchSoforMaas();
        document.getElementById("ak-tutar").value = "";
        document.getElementById("ak-aciklama").value = "";
    } catch(err) {
        console.error(err);
        if(window.Toast) window.Toast.error("Kayıt hatası: " + err.message);
    }
};

window.silAvansKesinti = async function(id, soforId) {
    if(!confirm("Bu işlemi silmek istediğinize emin misiniz? Şoförün net maaşına rakam geri yüklenecektir.")) return;
    try {
        const { error } = await window.supabaseClient.from("sofor_avans_kesinti").delete().eq("id", id);
        if(error) throw error;
        if(window.Toast) window.Toast.success("İşlem kalıcı olarak silindi.");
        window.openAvansKesinti(soforId, document.getElementById("ak-sofor-ad").textContent);
        if(window.fetchSoforMaas) window.fetchSoforMaas();
    } catch(err) {
        console.error(err);
        if(window.Toast) window.Toast.error("Silinirken hata oluştu!");
    }
};

window.checkVadeAlarmlari = async function() {
    const container = document.getElementById("vade-alarmlari-container");
    if (!container) return;
    try {
        const { data: faturalar, error } = await window.supabaseClient.from("cari_faturalar").select("id, cari_id, fatura_tarihi, toplam_tutar, cariler(unvan)").order("fatura_tarihi", {ascending: true});
        if(error) throw error;
        if(!faturalar || faturalar.length === 0) return;
        const { data: odemeler } = await window.supabaseClient.from("cari_odemeler").select("cari_id, tutar");
        let cB = {};
        faturalar.forEach(f => {
            if(!cB[f.cari_id]) cB[f.cari_id] = {b:0, o:0, u: f.cariler?.unvan, last: f.fatura_tarihi};
            cB[f.cari_id].b += parseFloat(f.toplam_tutar||0);
        });
        (odemeler||[]).forEach(o => {
            if(cB[o.cari_id]) cB[o.cari_id].o += parseFloat(o.tutar||0);
        });
        let alerts = ""; const now = new Date();
        Object.keys(cB).forEach(cid => {
            const k = cB[cid].b - cB[cid].o;
            if(k > 10) {
                const invDate = new Date(cB[cid].last);
                const d = Math.floor(Math.abs(now - invDate) / (1000 * 60 * 60 * 24)); 
                if(d >= 10) {
                    alerts += `<div class="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl shadow-lg relative overflow-hidden group cursor-pointer" onclick="if(typeof window.switchModule !== 'undefined') window.switchModule('module-cari');">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                        <div class="flex items-center gap-4">
                            <div class="p-2 bg-red-500/20 text-red-500 rounded-lg"><i data-lucide="alert-triangle" class="w-5 h-5"></i></div>
                            <div>
                                <h4 class="text-sm font-bold text-red-400 uppercase tracking-widest">${cB[cid].u}</h4>
                                <p class="text-[11px] text-gray-400 font-bold">${d} gündür tahsilat bekleniyor. Ödenmemiş Bakiye Riski!</p>
                            </div>
                        </div>
                        <div class="font-black text-white text-lg tracking-tight">₺${k.toLocaleString("tr-TR", {minimumFractionDigits:2})}</div>
                        <div class="absolute inset-0 bg-red-500/5 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"></div>
                    </div>`;
                }
            }
        });
        container.innerHTML = alerts;
        if(window.lucide) window.lucide.createIcons();
    } catch(err) { console.error("Vade Alarm:", err); }
};

if(typeof window._origDdash === 'undefined') {
    window._origDdash = window.fetchDashboardData;
    window.fetchDashboardData = async function() {
        if(typeof window._origDdash === "function") await window._origDdash();
        if(typeof window.checkVadeAlarmlari === "function") await window.checkVadeAlarmlari();
    };
}




window.transferSelectedYakitlar = function(arac_id) {
    const cbs = document.querySelectorAll('.yakit-cb:checked');
    if (cbs.length === 0) return alert('Lütfen aktarılacak yakıt fişlerini seçin.');
    const ids = Array.from(cbs).map(cb => cb.value);
    window.transferYakit(ids, arac_id);
}

window.transferYakit = async function(yakitIds, currentAracId) {
    const { data: araclar, error } = await window.supabaseClient.from('araclar').select('id, plaka').order('plaka');
    if (error) return alert("Araçlar yüklenirken hata oluştu.");
    
    let optionsHtml = '';
    araclar.forEach(a => {
        if (a.id !== currentAracId) {
            optionsHtml += `<div class="transfer-option p-3 hover:bg-blue-600 cursor-pointer text-sm font-bold text-gray-300 hover:text-white transition-colors border-b border-gray-700/50 last:border-0" data-val="${a.id}">${a.plaka}</div>`;
        }
    });

    const overlay = document.createElement('div');
    overlay.id = 'yakit-transfer-overlay';
    overlay.className = 'fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4';
    overlay.innerHTML = `
        <div class="ios-modal-sheet bg-gray-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl animate-scaleIn">
            <div class="ios-modal-header">
                <h3 class="text-xl font-black text-white tracking-tight"><i data-lucide="arrow-right-left" class="w-5 h-5 inline-block mr-1 text-blue-400"></i> Yakıt Aktarımı</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-400 bg-white/5">✕</button>
            </div>
            <div class="ios-modal-body">
                <p class="text-xs text-gray-400 mb-6 leading-relaxed">Seçtiğiniz <strong>${yakitIds.length}</strong> adet yakıt fişi, seçeceğiniz yeni araca taşınacaktır. Bu işlem geri alınamaz.</p>
            
            <div class="relative w-full mb-6">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">HEDEF PLAKA ARAYIN</label>
                <div class="relative group">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <i data-lucide="search" class="w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors"></i>
                    </div>
                    <input type="text" id="transfer-search-input" placeholder="35 ABC 123" class="w-full bg-black/50 text-white pl-10 pr-3 py-3 rounded-xl border border-white/10 focus:outline-none focus:border-blue-500 text-sm font-bold placeholder-gray-600 transition-colors">
                </div>
                
                <div id="transfer-options-list" class="bg-black/80 border border-white/10 rounded-xl mt-2 max-h-48 overflow-y-auto custom-scrollbar shadow-2xl absolute w-full z-[101] hidden backdrop-blur-xl">
                    ${optionsHtml}
                </div>
                <input type="hidden" id="transfer-target-arac" value="">
                
                <!-- Seçilen Araç Göstergesi -->
                <div id="transfer-selected-display" class="mt-3 hidden p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center"><i data-lucide="check" class="w-4 h-4"></i></div>
                        <div>
                            <div class="text-[10px] text-blue-400/70 font-bold uppercase tracking-wider">SEÇİLEN ARAÇ</div>
                            <div class="text-sm font-black text-blue-400" id="transfer-selected-plaka">35 ABC 123</div>
                        </div>
                    </div>
                    <button id="transfer-clear-selection" class="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
            </div>

            </div>
            <div class="ios-modal-footer flex justify-end gap-3 pt-4 border-t border-white/5">
                <button onclick="this.closest('.fixed').remove()" class="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-all">Vazgeç</button>
                <button id="btn-onayla-transfer" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)]" disabled>
                    <i data-lucide="check-circle-2" class="w-4 h-4"></i> Seçili Araca Aktar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    if(window.lucide) window.lucide.createIcons();

    // DOM Elements
    const searchInput = document.getElementById('transfer-search-input');
    const optionsList = document.getElementById('transfer-options-list');
    const targetInput = document.getElementById('transfer-target-arac');
    const selectedDisplay = document.getElementById('transfer-selected-display');
    const selectedPlaka = document.getElementById('transfer-selected-plaka');
    const clearBtn = document.getElementById('transfer-clear-selection');
    const onaylaBtn = document.getElementById('btn-onayla-transfer');

    // Search Logic
    searchInput.addEventListener('focus', () => optionsList.classList.remove('hidden'));
    
    // Yere tıklayınca listeyi gizle
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !optionsList.contains(e.target)) {
            optionsList.classList.add('hidden');
        }
    });

    searchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        optionsList.classList.remove('hidden');
        document.querySelectorAll('.transfer-option').forEach(opt => {
            if (opt.innerText.toLowerCase().includes(val)) {
                opt.style.display = 'block';
            } else {
                opt.style.display = 'none';
            }
        });
    });

    // Option Click Logic
    document.querySelectorAll('.transfer-option').forEach(opt => {
        opt.addEventListener('click', () => {
            targetInput.value = opt.getAttribute('data-val');
            selectedPlaka.innerText = opt.innerText;
            
            searchInput.parentElement.classList.add('hidden');
            optionsList.classList.add('hidden');
            selectedDisplay.classList.remove('hidden');
            selectedDisplay.classList.add('flex');
            onaylaBtn.disabled = false;
        });
    });

    // Clear Selection
    clearBtn.addEventListener('click', () => {
        targetInput.value = '';
        searchInput.value = '';
        searchInput.parentElement.classList.remove('hidden');
        selectedDisplay.classList.add('hidden');
        selectedDisplay.classList.remove('flex');
        onaylaBtn.disabled = true;
        
        // Reset list
        document.querySelectorAll('.transfer-option').forEach(o => o.style.display = 'block');
        setTimeout(() => searchInput.focus(), 50);
    });

    // Onayla Logic
    onaylaBtn.onclick = async () => {
        const targetId = targetInput.value;
        if (!targetId) return;
        
        onaylaBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> İşleniyor...';
        onaylaBtn.disabled = true;
        if(window.lucide) window.lucide.createIcons();

        // Update multiple
        const { error: updErr } = await window.supabaseClient
            .from('yakit_takip')
            .update({ arac_id: targetId })
            .in('id', yakitIds);
            
        if (updErr) {
            alert("Hata: " + updErr.message);
            onaylaBtn.innerHTML = '<i data-lucide="check-circle-2" class="w-4 h-4"></i> Seçili Araca Aktar';
            onaylaBtn.disabled = false;
            if(window.lucide) window.lucide.createIcons();
        } else {
            overlay.remove();
            document.getElementById('cari-kart-modal-overlay')?.remove();
            if(typeof window.fetchTaseronFinans === 'function') await window.fetchTaseronFinans();
            if(typeof window.fetchFinansDashboard === 'function') window.fetchFinansDashboard();
            if(typeof window.openCariHakedisDetay === 'function') window.openCariHakedisDetay(currentAracId);
        }
    };
};

/* === YAKIT & KM TAKIP (MANUEL) === */
window.allYakitKmRecords = []; // Arama için tutuyoruz

window.fetchManuelYakitFisleri = async function() {
    const container = document.getElementById('yakit-km-container');
    if (!container) return;

    container.innerHTML = '<div class="bg-white/5 border border-white/10 rounded-2xl p-14 text-center text-gray-500 shadow-2xl">Kayıtlar yükleniyor...</div>';

    try {
        const { data: fisler, error } = await window.supabaseClient
            .from('manuel_yakit_fisleri')
            .select('*, araclar(plaka)')
            .order('tarih', { ascending: false })
            .order('olusturulma_tarihi', { ascending: false })
            .limit(200);

        if (error) {
            if (error.message && error.message.includes('relation "public.manuel_yakit_fisleri" does not exist')) {
                container.innerHTML = '<div class="bg-white/5 border border-white/10 rounded-2xl p-14 text-center text-amber-500 font-bold shadow-2xl">Lütfen "manuel_yakit_fisleri" tablosunu SQL Editor ile oluşturun. İlgili SQL betiği ana dizindedir.</div>';
                return;
            }
            throw error;
        }

        window.allYakitKmRecords = fisler || [];
        renderYakitKmTable(window.allYakitKmRecords);

    } catch (err) {
        console.error("fetchManuelYakitFisleri hatası:", err);
        container.innerHTML = '<div class="bg-white/5 border border-white/10 rounded-2xl p-14 text-center text-red-500 shadow-2xl">Veriler yüklenirken hata oluştu.</div>';
    }
};

function renderYakitKmTable(records) {
    const container = document.getElementById('yakit-km-container');
    if (!container) return;

    if (!records || records.length === 0) {
        container.innerHTML = '<div class="bg-white/5 border border-white/10 rounded-2xl p-14 text-center text-gray-500 italic shadow-2xl">Henüz yakıt / KM kaydı bulunmamaktadır.</div>';
        return;
    }

    // Plakaya göre grupla
    const grouped = {};
    records.forEach(r => {
        const plaka = r.araclar?.plaka || 'Bilinmiyor';
        if (!grouped[plaka]) {
            grouped[plaka] = { plaka, total_km: 0, total_tutar: 0, items: [] };
        }
        grouped[plaka].items.push(r);
        grouped[plaka].total_km += (parseInt(r.fark_km) || 0);
        grouped[plaka].total_tutar += (parseFloat(r.tutar) || 0);
    });

    // Grupları HTML'e çevir
    let html = '';
    Object.values(grouped).sort((a, b) => b.total_km - a.total_km).forEach(group => {
        
        let tableRows = '';
        group.items.forEach(r => {
            const tarih = r.tarih ? r.tarih.split('-').reverse().join('.') : '-';
            const sofor = r.sofor_adi || '-';
            const km = r.kilometre ? r.kilometre.toLocaleString('tr-TR') : '0';
            const fark = r.fark_km ? r.fark_km.toLocaleString('tr-TR') : '0';
            const tutar = r.tutar ? Number(r.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) : '0,00';
            
            tableRows += `
                <tr class="hover:bg-white/5 transition-colors group/row">
                    <td class="p-3 text-xs text-gray-300 font-medium">${tarih}</td>
                    <td class="p-3 text-xs text-gray-400">${sofor}</td>
                    <td class="p-3 text-xs font-black text-cyan-500 text-center">${km}</td>
                    <td class="p-3 text-xs font-bold text-orange-400 text-center">+${fark} KM</td>
                    <td class="p-3 text-xs font-black text-white text-right">₺${tutar}</td>
                    <td class="p-3 text-right">
                        <button onclick="window.deleteManuelYakitFisi('${r.id}')" class="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors" title="Sil">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
            <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative mb-6">
                <!-- Header -->
                <div class="bg-[#1a1f26] px-6 py-4 border-b border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-500">
                            <i data-lucide="truck" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-white tracking-wide">${group.plaka}</h3>
                            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">${group.items.length} Kayıt</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Toplam Menzil</p>
                            <p class="text-lg font-black text-orange-500">+${group.total_km.toLocaleString('tr-TR')} KM</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Toplam Tutar</p>
                            <p class="text-lg font-black text-white">₺${group.total_tutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <button onclick="window.printManuelYakitRaporu('${group.plaka}')" class="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all" title="Bu araca özel rapor yazdır">
                            <i data-lucide="printer" class="w-4 h-4"></i> Rapor
                        </button>
                    </div>
                </div>
                <!-- Table -->
                <div class="overflow-x-auto w-full custom-scrollbar">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="text-[10px] text-gray-500 uppercase tracking-widest border-b border-white/5 bg-black/20">
                                <th class="p-3 font-bold">Tarih</th>
                                <th class="p-3 font-bold">Şoför</th>
                                <th class="p-3 font-bold text-center">Girilen KM</th>
                                <th class="p-3 font-bold text-center">Fark (Menzil)</th>
                                <th class="p-3 font-bold text-right">Tutar (TL)</th>
                                <th class="p-3 font-bold text-right w-16">İşlem</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
}

window.filterYakitKm = function() {
    const searchInput = document.getElementById('yakit-km-search');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    
    const monthInput = document.getElementById('filter-yakit-km-ay');
    const monthQuery = monthInput ? monthInput.value : ''; // format: YYYY-MM

    let filtered = window.allYakitKmRecords;

    if (query) {
        filtered = filtered.filter(r => {
            const plaka = (r.araclar?.plaka || '').toLowerCase();
            const sofor = (r.sofor_adi || '').toLowerCase();
            return plaka.includes(query) || sofor.includes(query);
        });
    }

    if (monthQuery) {
        filtered = filtered.filter(r => {
            return r.tarih && r.tarih.startsWith(monthQuery);
        });
    }

    renderYakitKmTable(filtered);
};

window.deleteManuelYakitFisi = async function(id) {
    if (!confirm('Bu kayıt silinecek. Onaylıyor musunuz?')) return;
    try {
        const { error } = await window.supabaseClient.from('manuel_yakit_fisleri').delete().eq('id', id);
        if (error) throw error;
        if (typeof window.fetchManuelYakitFisleri === 'function') window.fetchManuelYakitFisleri();
    } catch (err) {
        console.error("deleteManuelYakitFisi error:", err);
        alert("Silinirken hata oluştu.");
    }
};

window.printManuelYakitRaporu = function(specificPlaka = null) {
    const branding = window.CompanyBranding;
    let recordsToPrint = window.allYakitKmRecords;
    if (!recordsToPrint || recordsToPrint.length === 0) {
        alert("Yazdırılacak veri bulunamadı. Lütfen önce tabloyu yükleyin.");
        return;
    }

    if (specificPlaka) {
        recordsToPrint = recordsToPrint.filter(r => (r.araclar?.plaka || 'Bilinmeyen Araç') === specificPlaka);
        if (recordsToPrint.length === 0) {
            alert("Bu plakaya ait yazdırılacak kayıt bulunamadı.");
            return;
        }
    }

    // Plakaya göre grupla ve topla
    const grouped = {};
    let grandTotalKm = 0;
    let grandTotalTutar = 0;

    recordsToPrint.forEach(r => {
        const plaka = r.araclar?.plaka || 'Bilinmeyen Araç';
        if (!grouped[plaka]) {
            grouped[plaka] = { plaka, total_km: 0, total_tutar: 0, count: 0 };
        }
        const fark = parseInt(r.fark_km) || 0;
        const tutar = parseFloat(r.tutar) || 0;
        
        grouped[plaka].total_km += fark;
        grouped[plaka].total_tutar += tutar;
        grouped[plaka].count += 1;

        grandTotalKm += fark;
        grandTotalTutar += tutar;
    });

    const sortedGroups = Object.values(grouped).sort((a, b) => b.total_km - a.total_km);

    let rowsHtml = '';
    sortedGroups.forEach(g => {
        rowsHtml += `
            <tr>
                <td>${g.plaka}</td>
                <td class="text-center">${g.count} Adet</td>
                <td class="text-center font-bold text-orange-600">${g.total_km.toLocaleString('tr-TR')} KM</td>
                <td class="text-right font-black">${g.total_tutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺</td>
            </tr>
        `;
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Yakıt & KM Takip Raporu</title>
                <style>
                    ${branding.getPrintStyles()}
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; line-height: 1.4; }
                    
                    .summary-box { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; }
                    .summary-item { text-align: center; flex: 1; }
                    .summary-item p { margin: 0 0 5px 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase; }
                    .summary-item h3 { margin: 0; font-size: 20px; color: #0f172a; }
                    .summary-item-border { border-right: 1px solid #e2e8f0; }
                    .text-orange-600 { color: #ea580c; }
                    
                    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
                    th { background: #f1f5f9; color: #475569; font-weight: bold; text-align: left; text-transform: uppercase; font-size: 11px; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .font-bold { font-weight: bold; }
                    .font-black { font-weight: 900; }
                    
                    .footer { text-align: center; font-size: 10px; color: #94a3b8; font-style: italic; margin-top: 50px; border-top: 1px dashed #e2e8f0; padding-top: 15px; }
                </style>
            </head>
            <body>
                ${branding.getPrintHeader({ title: 'Yakıt & KM Takip Özeti', subtitle: 'Plaka bazlı toplam harcama ve menzil raporu' })}
                
                <div class="summary-box">
                    <div class="summary-item summary-item-border">
                        <p>Toplam Kayıt</p>
                        <h3>${window.allYakitKmRecords.length} Adet</h3>
                    </div>
                    <div class="summary-item summary-item-border">
                        <p>Toplam Yapılan Yol</p>
                        <h3 class="text-orange-600">${grandTotalKm.toLocaleString('tr-TR')} KM</h3>
                    </div>
                    <div class="summary-item">
                        <p>Toplam Yakıt Tutarı</p>
                        <h3>${grandTotalTutar.toLocaleString('tr-TR', {minimumFractionDigits: 2})} ₺</h3>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Araç Plakası</th>
                            <th class="text-center">Kayıt Sayısı</th>
                            <th class="text-center">Toplam Yapılan Yol (Menzil)</th>
                            <th class="text-right">Toplam Harcama (TL)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                
                ${branding.getPrintFooter('Tarih: ' + new Date().toLocaleDateString('tr-TR'))}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
};
