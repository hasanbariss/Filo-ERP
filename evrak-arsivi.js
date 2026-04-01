// ============================================================
// EVRAK ARŞİVİ MODÜLÜ — Tek Sorumluluk: Evrak Yaşam Döngüsü
// ============================================================

(function () {
    'use strict';

    const EVRAK_TURLERI_ARAC = ['Ruhsat', 'Muayene Vizesi', 'Trafik Sigortası', 'Kasko', 'Koltuk Sigortası', 'D2 Belgesi', 'D4S Belgesi', 'OGS/HGS', 'Diğer'];
    const EVRAK_TURLERI_SOFOR = ['Ehliyet', 'SRC Belgesi', 'Psikoteknik', 'Mesleki Yeterlilik', 'SGK Kaydı', 'Sağlık Raporu', 'Diğer'];

    // ----- DURUM HESAPLAMA -----
    function evrakDurumBilgi(bitis_tarihi) {
        if (!bitis_tarihi) return { renk: 'gray', etiket: 'Tarihsiz', gunKalan: null };
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);
        const bitis = new Date(bitis_tarihi);
        const fark = Math.ceil((bitis - bugun) / (1000 * 60 * 60 * 24));
        if (fark < 0) return { renk: 'red', etiket: `${Math.abs(fark)}g Geçti`, gunKalan: fark };
        if (fark <= 30) return { renk: 'red', etiket: `${fark}g Kaldı`, gunKalan: fark };
        if (fark <= 90) return { renk: 'yellow', etiket: `${fark}g Kaldı`, gunKalan: fark };
        return { renk: 'green', etiket: 'Geçerli', gunKalan: fark };
    }

    function durumBadgeHTML(bitis_tarihi) {
        const { renk, etiket } = evrakDurumBilgi(bitis_tarihi);
        const renkler = {
            red: 'bg-red-500/20 text-red-400 border-red-500/30',
            yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            green: 'bg-green-500/20 text-green-400 border-green-500/30',
            gray: 'bg-white/10 text-gray-400 border-white/10',
        };
        return `<span class="px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${renkler[renk]}">${etiket}</span>`;
    }

    // ----- VERİ ÇEKİMİ -----
    window.fetchEvraklar = async function (filter = {}) {
        const conn = window.checkSupabaseConnection?.();
        if (conn && !conn.ok) { window.Toast?.error(conn.msg); return; }

        let query = window.supabaseClient.from('evraklar').select('*').order('bitis_tarihi', { ascending: true });
        if (filter.ilgili_id) query = query.eq('ilgili_id', filter.ilgili_id);
        if (filter.ilgili_tur) query = query.eq('ilgili_tur', filter.ilgili_tur);
        if (filter.arama) query = query.ilike('evrak_turu', `%${filter.arama}%`);

        const { data, error } = await query;
        if (error) { window.Toast?.error('Evraklar yüklenemedi: ' + error.message); return []; }
        return data || [];
    };

    // ----- MODÜL RENDER -----
    window.renderEvraklarModulu = async function () {
        const container = document.getElementById('module-evrak-arsivi');
        if (!container) return;

        container.innerHTML = `
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight text-white mb-1">Evrak Arşivi</h2>
                <p class="text-sm font-medium text-gray-400">Tüm araç ve şoför evraklarını tek noktadan yönetin. Süresi yaklaşanları anında görün.</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
                <div class="relative">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"></i>
                    <input type="text" id="evrak-arama" placeholder="Evrak türü ara..." oninput="window.evrakAramaYap(this.value)"
                        class="bg-white/5 border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:border-orange-500 transition-all w-56">
                </div>
                <div class="flex items-center bg-black/30 p-1 rounded-xl border border-white/5 gap-1">
                    <button id="evrak-filter-hepsi" onclick="window.evrakFiltrele('hepsi')" class="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-orange-500 text-white transition-all">Hepsi</button>
                    <button id="evrak-filter-arac" onclick="window.evrakFiltrele('ARAÇ')" class="px-3 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 hover:bg-white/10 transition-all">Araç</button>
                    <button id="evrak-filter-sofor" onclick="window.evrakFiltrele('ŞOFÖR')" class="px-3 py-1.5 text-[11px] font-bold rounded-lg text-gray-400 hover:bg-white/10 transition-all">Şoför</button>
                    <div class="w-px h-4 bg-white/10 mx-1"></div>
                    <button id="evrak-filter-kritik" onclick="window.evrakFiltrele('KRİTİK')" class="px-3 py-1.5 text-[11px] font-bold rounded-lg text-red-400 hover:bg-red-500/20 transition-all">⚠ Kritik</button>
                </div>
                <button onclick="window.openModal('Yeni Evrak Ekle')"
                    class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> Yeni Evrak
                </button>
            </div>
        </div>

        <!-- Özet KPI Kartları -->
        <div id="evrak-kpi-row" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>

        <!-- Kritik Alarmlar -->
        <div id="evrak-kritik-banner" class="hidden mb-6"></div>

        <!-- Evrak Tablosu -->
        <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div class="overflow-x-auto smooth-scrollbar">
                <table class="w-full text-left min-w-max">
                    <thead>
                        <tr class="bg-white/5 text-[10px] uppercase tracking-widest text-gray-400 border-b border-white/10">
                            <th class="p-4 font-bold">Evrak Türü</th>
                            <th class="p-4 font-bold">İlgili</th>
                            <th class="p-4 font-bold">Başlangıç</th>
                            <th class="p-4 font-bold">Bitiş</th>
                            <th class="p-4 font-bold">Durum</th>
                            <th class="p-4 font-bold">Notlar</th>
                            <th class="p-4 font-bold text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody id="evrak-tbody" class="divide-y divide-white/5">
                        <tr><td colspan="7" class="py-12 text-center text-gray-500"><div class="flex flex-col items-center gap-2"><i data-lucide="loader-2" class="animate-spin w-6 h-6"></i>Evraklar yükleniyor...</div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;

        if (window.lucide) window.lucide.createIcons();
        await window.evrakListeyiYenile();
    };

    // ----- ANA LİSTE YENİLE -----
    window._evrakTumListe = [];
    window._evrakAktifFilter = 'hepsi';
    window._evrakAktifArama = '';

    window.evrakListeyiYenile = async function () {
        window._evrakTumListe = await window.fetchEvraklar();
        window.evrakUIGuncelle();
    };

    window.evrakFiltrele = function (filtre) {
        window._evrakAktifFilter = filtre;
        // Buton aktif stili
        ['hepsi', 'arac', 'sofor', 'kritik'].forEach(f => {
            const btn = document.getElementById('evrak-filter-' + f);
            if (btn) btn.className = btn.className.replace('bg-orange-500 text-white', 'text-gray-400 hover:bg-white/10');
        });
        const aktifId = { 'hepsi': 'evrak-filter-hepsi', 'ARAÇ': 'evrak-filter-arac', 'ŞOFÖR': 'evrak-filter-sofor', 'KRİTİK': 'evrak-filter-kritik' }[filtre];
        if (aktifId) {
            const btn = document.getElementById(aktifId);
            if (btn) btn.className = btn.className.replace('text-gray-400 hover:bg-white/10', 'bg-orange-500 text-white');
        }
        window.evrakUIGuncelle();
    };

    window.evrakAramaYap = function (deger) {
        window._evrakAktifArama = deger.toLowerCase();
        window.evrakUIGuncelle();
    };

    window.evrakUIGuncelle = async function () {
        const bugun = new Date();
        bugun.setHours(0, 0, 0, 0);

        let liste = window._evrakTumListe || [];

        // Filtre
        if (window._evrakAktifFilter === 'ARAÇ') liste = liste.filter(e => e.ilgili_tur === 'ARAÇ');
        else if (window._evrakAktifFilter === 'ŞOFÖR') liste = liste.filter(e => e.ilgili_tur === 'ŞOFÖR');
        else if (window._evrakAktifFilter === 'KRİTİK') {
            liste = liste.filter(e => {
                if (!e.bitis_tarihi) return false;
                const fark = Math.ceil((new Date(e.bitis_tarihi) - bugun) / 86400000);
                return fark <= 30;
            });
        }

        // Arama
        if (window._evrakAktifArama) {
            liste = liste.filter(e =>
                e.evrak_turu?.toLowerCase().includes(window._evrakAktifArama) ||
                e.notlar?.toLowerCase().includes(window._evrakAktifArama)
            );
        }

        // KPI
        const tumListe = window._evrakTumListe;
        const kritik = tumListe.filter(e => { if (!e.bitis_tarihi) return false; return Math.ceil((new Date(e.bitis_tarihi) - bugun) / 86400000) <= 30; });
        const yaklasan = tumListe.filter(e => { if (!e.bitis_tarihi) return false; const f = Math.ceil((new Date(e.bitis_tarihi) - bugun) / 86400000); return f > 30 && f <= 90; });
        const gecerli = tumListe.filter(e => { if (!e.bitis_tarihi) return false; return Math.ceil((new Date(e.bitis_tarihi) - bugun) / 86400000) > 90; });

        const kpiRow = document.getElementById('evrak-kpi-row');
        if (kpiRow) {
            kpiRow.innerHTML = `
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-blue-500/10 rounded-lg text-blue-500"><i data-lucide="files" class="w-4 h-4"></i></div><span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Toplam</span></div>
                <div class="text-2xl font-black">${tumListe.length}</div><div class="text-xs text-gray-500">Kayıtlı evrak</div>
            </div>
            <div class="bg-white/5 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-red-500/10 rounded-lg text-red-500"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div><span class="text-[10px] font-bold text-red-400 uppercase tracking-widest">Kritik</span></div>
                <div class="text-2xl font-black text-red-400">${kritik.length}</div><div class="text-xs text-red-400/70">30 gün veya geçmiş</div>
            </div>
            <div class="bg-white/5 border border-yellow-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><i data-lucide="clock" class="w-4 h-4"></i></div><span class="text-[10px] font-bold text-yellow-400 uppercase tracking-widest">Yaklaşan</span></div>
                <div class="text-2xl font-black text-yellow-400">${yaklasan.length}</div><div class="text-xs text-yellow-400/70">30–90 gün içinde</div>
            </div>
            <div class="bg-white/5 border border-green-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-green-500/10 rounded-lg text-green-500"><i data-lucide="shield-check" class="w-4 h-4"></i></div><span class="text-[10px] font-bold text-green-400 uppercase tracking-widest">Geçerli</span></div>
                <div class="text-2xl font-black text-green-400">${gecerli.length}</div><div class="text-xs text-green-400/70">90+ gün kalmış</div>
            </div>`;
        }

        // Kritik Banner
        const banner = document.getElementById('evrak-kritik-banner');
        if (banner) {
            if (kritik.length > 0) {
                banner.className = 'mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3';
                banner.innerHTML = `<div class="p-2 bg-red-500/20 rounded-lg flex-shrink-0"><i data-lucide="siren" class="w-5 h-5 text-red-400"></i></div>
                <div><p class="text-sm font-bold text-red-400">${kritik.length} evrak kritik durumda!</p><p class="text-xs text-red-400/70">Süresi dolmuş veya 30 gün içinde dolacak evraklar var. Lütfen yenileyin.</p></div>
                <button onclick="window.evrakFiltrele('KRİTİK')" class="ml-auto px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all">Göster</button>`;
            } else {
                banner.className = 'hidden mb-6';
            }
        }

        // Tablo body
        const tbody = document.getElementById('evrak-tbody');
        if (!tbody) return;

        if (liste.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-16 text-center text-gray-500">
                <div class="flex flex-col items-center gap-3">
                    <i data-lucide="folder-open" class="w-10 h-10 text-gray-600"></i>
                    <p class="font-bold">Evrak bulunamadı</p>
                    <p class="text-xs">Bu filtre için kayıtlı evrak yok.</p>
                </div></td></tr>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        // Araç/şoför isimlerini çek (batch)
        const aracIds = [...new Set(liste.filter(e => e.ilgili_tur === 'ARAÇ').map(e => e.ilgili_id))];
        const soforIds = [...new Set(liste.filter(e => e.ilgili_tur === 'ŞOFÖR').map(e => e.ilgili_id))];

        let aracMap = {}, soforMap = {};
        if (aracIds.length > 0) {
            const { data } = await window.supabaseClient.from('araclar').select('id, plaka, marka_model').in('id', aracIds);
            (data || []).forEach(a => { aracMap[a.id] = a; });
        }
        if (soforIds.length > 0) {
            const { data } = await window.supabaseClient.from('soforler').select('id, ad_soyad').in('id', soforIds);
            (data || []).forEach(s => { soforMap[s.id] = s; });
        }

        tbody.innerHTML = liste.map(evrak => {
            const { renk, etiket } = evrakDurumBilgi(evrak.bitis_tarihi);
            const renkler = {
                red: 'bg-red-500/20 text-red-400 border-red-500/30',
                yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                green: 'bg-green-500/20 text-green-400 border-green-500/30',
                gray: 'bg-white/10 text-gray-400 border-white/10',
            };
            const ilgiliAd = evrak.ilgili_tur === 'ARAÇ'
                ? (aracMap[evrak.ilgili_id] ? `🚛 ${aracMap[evrak.ilgili_id].plaka}` : '—')
                : (soforMap[evrak.ilgili_id]?.ad_soyad ? `👤 ${soforMap[evrak.ilgili_id].ad_soyad}` : '—');

            const turBadge = evrak.ilgili_tur === 'ARAÇ'
                ? '<span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold">ARAÇ</span>'
                : '<span class="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px] font-bold">ŞOFÖR</span>';

            return `<tr class="hover:bg-white/3 transition-all group">
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-${renk === 'gray' ? 'gray' : renk}-500 flex-shrink-0 ${renk === 'red' ? 'animate-pulse' : ''}"></div>
                        <span class="font-semibold text-sm text-white">${evrak.evrak_turu}</span>
                        ${turBadge}
                    </div>
                </td>
                <td class="p-4 text-sm text-gray-300">${ilgiliAd}</td>
                <td class="p-4 text-sm text-gray-400">${evrak.baslangic_tarihi ? new Date(evrak.baslangic_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                <td class="p-4 text-sm font-semibold ${renk === 'red' ? 'text-red-400' : renk === 'yellow' ? 'text-yellow-400' : 'text-gray-300'}">${evrak.bitis_tarihi ? new Date(evrak.bitis_tarihi).toLocaleDateString('tr-TR') : '—'}</td>
                <td class="p-4"><span class="px-2 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wide ${renkler[renk]}">${etiket}</span></td>
                <td class="p-4 text-xs text-gray-500 max-w-[180px] truncate">${evrak.notlar || '—'}</td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        ${evrak.dosya_url ? `<a href="${evrak.dosya_url}" target="_blank" class="p-1.5 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded-lg transition-all" title="Dosyayı Aç"><i data-lucide="external-link" class="w-4 h-4"></i></a>` : ''}
                        <button onclick="window.evrakYenileFormAc('${evrak.id}', '${evrak.evrak_turu}', '${evrak.ilgili_id}', '${evrak.ilgili_tur}')" class="p-1.5 bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400 rounded-lg transition-all" title="Yenile"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
                        <button onclick="window.deleteEvrak('${evrak.id}')" class="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg transition-all" title="Sil"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    };

    // ----- MODAL FORM HTML -----
    window.getEvrakFormHTML = async function () {
        // Araç ve şoför listelerini çek
        const { data: araclar } = await window.supabaseClient.from('araclar').select('id, plaka').order('plaka');
        const { data: soforler } = await window.supabaseClient.from('soforler').select('id, ad_soyad').order('ad_soyad');

        const aracOptions = (araclar || []).map(a => `<option value="${a.id}">${a.plaka}</option>`).join('');
        const soforOptions = (soforler || []).map(s => `<option value="${s.id}">${s.ad_soyad}</option>`).join('');

        return `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">İlgili Tür</label>
                    <select id="evrak-ilgili-tur" onchange="window.evrakTurDegisti()"
                        class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        <option value="ARAÇ">Araç</option>
                        <option value="ŞOFÖR">Şoför</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Araç / Şoför</label>
                    <select id="evrak-ilgili-id" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        ${aracOptions}
                    </select>
                    <select id="evrak-ilgili-id-sofor" class="hidden w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        ${soforOptions}
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Evrak Türü</label>
                <select id="evrak-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                    <optgroup label="Araç Evrakları">
                        ${EVRAK_TURLERI_ARAC.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </optgroup>
                    <optgroup label="Şoför Evrakları">
                        ${EVRAK_TURLERI_SOFOR.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </optgroup>
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Başlangıç Tarihi</label>
                    <input type="date" id="evrak-baslangic" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Bitiş Tarihi</label>
                    <input type="date" id="evrak-bitis" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Dosya Yükle (PDF / Görsel)</label>
                <div class="relative">
                    <input type="file" id="evrak-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-500/20 file:text-orange-400">
                </div>
                <p class="text-[10px] text-gray-600 mt-1">Maks. 5MB. PDF veya görsel (JPG/PNG).</p>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notlar (İsteğe Bağlı)</label>
                <textarea id="evrak-notlar" rows="2" placeholder="Poliçe no, acente adı vb..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all resize-none"></textarea>
            </div>
        </div>`;
    };

    window.evrakTurDegisti = function () {
        const tur = document.getElementById('evrak-ilgili-tur')?.value;
        const aracSel = document.getElementById('evrak-ilgili-id');
        const soforSel = document.getElementById('evrak-ilgili-id-sofor');
        if (tur === 'ARAÇ') { aracSel?.classList.remove('hidden'); soforSel?.classList.add('hidden'); }
        else { aracSel?.classList.add('hidden'); soforSel?.classList.remove('hidden'); }
    };

    // ----- KAYDET -----
    window.saveEvrak = async function () {
        const ilgili_tur = document.getElementById('evrak-ilgili-tur')?.value;
        const ilgili_id = ilgili_tur === 'ARAÇ'
            ? document.getElementById('evrak-ilgili-id')?.value
            : document.getElementById('evrak-ilgili-id-sofor')?.value;
        const evrak_turu = document.getElementById('evrak-tur')?.value;
        const baslangic_tarihi = document.getElementById('evrak-baslangic')?.value || null;
        const bitis_tarihi = document.getElementById('evrak-bitis')?.value || null;
        const notlar = document.getElementById('evrak-notlar')?.value || null;

        if (!ilgili_id) throw new Error('Araç veya şoför seçimi zorunludur.');
        if (!evrak_turu) throw new Error('Evrak türü zorunludur.');

        // Dosya yükleme
        const dosyaInput = document.getElementById('evrak-dosya');
        let dosya_url = null;
        if (dosyaInput?.files?.length > 0) {
            dosya_url = await window.uploadDosya(dosyaInput.files[0], 'evraklar');
        }

        const { error } = await window.supabaseClient.from('evraklar').insert([{
            ilgili_tur, ilgili_id, evrak_turu, baslangic_tarihi, bitis_tarihi, dosya_url, notlar
        }]);
        if (error) throw error;

        if (typeof window.evrakListeyiYenile === 'function') window.evrakListeyiYenile();
    };

    // ----- YENİLEME FORM -----
    window.evrakYenileFormAc = function (evrak_id, evrak_turu, ilgili_id, ilgili_tur) {
        // Mevcut modal sistemi kullanarak güncelleme formu açılır
        // openModal("Evrak Güncelle") → saveDataAndClose() içinde handle edilecek
        const titleEl = document.getElementById('modal-title');
        const bodyEl = document.getElementById('modal-dynamic-body');
        const modal = document.getElementById('modal-overlay');
        if (!modal || !titleEl || !bodyEl) return;

        titleEl.textContent = 'Evrak Güncelle';
        bodyEl.innerHTML = `
        <input type="hidden" id="evrak-guncelle-id" value="${evrak_id}">
        <input type="hidden" id="evrak-guncelle-ilgili-id" value="${ilgili_id}">
        <input type="hidden" id="evrak-guncelle-ilgili-tur" value="${ilgili_tur}">
        <div class="space-y-4">
            <p class="text-sm text-gray-400 bg-white/5 rounded-xl p-3"><span class="text-orange-400 font-bold">${evrak_turu}</span> evrakı güncelleniyor.</p>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Yeni Başlangıç</label>
                    <input type="date" id="evrak-yeni-baslangic" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Yeni Bitiş</label>
                    <input type="date" id="evrak-yeni-bitis" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Yeni Dosya (İsteğe Bağlı)</label>
                <input type="file" id="evrak-yeni-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-500/20 file:text-orange-400">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Notlar</label>
                <textarea id="evrak-yeni-notlar" rows="2" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all resize-none"></textarea>
            </div>
            <button onclick="window.evrakGuncelle()" class="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                <i data-lucide="save" class="w-4 h-4"></i> Güncelle & Kaydet
            </button>
        </div>`;
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    };

    window.evrakGuncelle = async function () {
        const id = document.getElementById('evrak-guncelle-id')?.value;
        const baslangic_tarihi = document.getElementById('evrak-yeni-baslangic')?.value || null;
        const bitis_tarihi = document.getElementById('evrak-yeni-bitis')?.value || null;
        const notlar = document.getElementById('evrak-yeni-notlar')?.value || null;

        if (!id) { window.Toast?.error('Evrak ID bulunamadı.'); return; }

        const dosyaInput = document.getElementById('evrak-yeni-dosya');
        let updatePayload = { baslangic_tarihi, bitis_tarihi, notlar };
        if (dosyaInput?.files?.length > 0) {
            const url = await window.uploadDosya(dosyaInput.files[0], 'evraklar');
            if (url) updatePayload.dosya_url = url;
        }

        const { error } = await window.supabaseClient.from('evraklar').update(updatePayload).eq('id', id);
        if (error) { window.Toast?.error('Güncelleme başarısız: ' + error.message); return; }

        window.Toast?.success('Evrak güncellendi!');
        if (typeof window.closeModal === 'function') window.closeModal();
        window.evrakListeyiYenile();
    };

    // ----- SİL -----
    window.deleteEvrak = async function (id) {
        if (!confirm('Bu evrak kaydı silinecek. Emin misiniz?')) return;
        const { error } = await window.supabaseClient.from('evraklar').delete().eq('id', id);
        if (error) { window.Toast?.error('Silinemedi: ' + error.message); return; }
        window.Toast?.success('Evrak silindi.');
        window.evrakListeyiYenile();
    };

    // ----- saveDataAndClose ENTEGRASYONU -----
    // Bu fonksiyon mevcut saveDataAndClose'un 'Yeni Evrak Ekle' case'ini yakalar
    window._evrakFormSaveHandler = async function (formTitle) {
        if (formTitle !== 'Yeni Evrak Ekle') return false;
        await window.saveEvrak();
        return true;
    };

    // Mevcut dispatch sistemine hook et (app-fixes.js benzeri yaklaşım)
    const _origSaveAndClose = window.saveDataAndClose;
    if (typeof _origSaveAndClose === 'function') {
        // saveDataAndClose zaten tanımlı ise hook yapma — data-services.js içindeki
        // switch-case'e ekleme yöntemi kullanılacak
    }

    // ----- MODULE INIT -----
    // Sidebar modülüne tıklanınca tetiklenir
    document.addEventListener('DOMContentLoaded', function () {
        // Modül nav button click → render tetikle
        const observer = new MutationObserver(() => {
            const modul = document.getElementById('module-evrak-arsivi');
            if (modul && !modul.classList.contains('hidden') && !modul.dataset.loaded) {
                modul.dataset.loaded = '1';
                window.renderEvraklarModulu();
            }
        });
        const mainArea = document.getElementById('main-content-area') || document.body;
        observer.observe(mainArea, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });

    // Modül header'ı değişikleri için fallback (nav sistemi setInterval ile de çağırabilir)
    window.initEvrakModule = function () {
        const modul = document.getElementById('module-evrak-arsivi');
        if (modul && !modul.classList.contains('hidden') && !modul.dataset.loaded) {
            modul.dataset.loaded = '1';
            window.renderEvraklarModulu();
        }
    };

})();
