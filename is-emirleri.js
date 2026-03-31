// ============================================================
// İŞ EMİRLERİ MODÜLÜ — Tek Sorumluluk: Bakım & Checklist Yönetimi
// ============================================================

(function () {
    'use strict';

    const IS_TURLERI = ['Bakım', 'Onarım', 'Yedek Parça', 'Kontrol', 'Hasar', 'Yıkama/Temizlik', 'Diğer'];
    const ONCELIKLER = ['DÜŞÜK', 'NORMAL', 'ACİL'];
    const DURUMLAR = ['AÇIK', 'DEVAM EDİYOR', 'TAMAMLANDI', 'İPTAL'];

    const ONCELIK_STILI = {
        'DÜŞÜK': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
        'NORMAL': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'ACİL': 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
    };

    const DURUM_STILI = {
        'AÇIK': { bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-gray-400', label: 'AÇIK' },
        'DEVAM EDİYOR': { bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-400', label: 'DEVAM' },
        'TAMAMLANDI': { bg: 'bg-green-500/5', border: 'border-green-500/20', dot: 'bg-green-400', label: 'TAMAM' },
        'İPTAL': { bg: 'bg-gray-500/5', border: 'border-gray-600/20', dot: 'bg-gray-600', label: 'İPTAL' },
    };

    // ----- VERİ ÇEKİMİ -----
    window.fetchIsEmirleri = async function () {
        const conn = window.checkSupabaseConnection?.();
        if (conn && !conn.ok) { window.Toast?.error(conn.msg); return []; }

        const { data, error } = await window.supabaseClient
            .from('is_emirleri')
            .select('*, araclar(plaka, marka_model), soforler(ad_soyad)')
            .order('created_at', { ascending: false });

        if (error) { window.Toast?.error('İş emirleri yüklenemedi: ' + error.message); return []; }
        return data || [];
    };

    window.fetchChecklistler = async function (arac_id) {
        const q = window.supabaseClient.from('arac_cikis_checklist').select('*').order('tarih', { ascending: false });
        if (arac_id) q.eq('arac_id', arac_id);
        const { data, error } = await q.limit(50);
        if (error) { window.Toast?.error('Checklist yüklenemedi: ' + error.message); return []; }
        return data || [];
    };

    // ----- MODÜL RENDER -----
    window.renderIsEmirleriModulu = async function () {
        const container = document.getElementById('module-is-emirleri');
        if (!container) return;

        container.innerHTML = `
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
                <h2 class="text-3xl font-black tracking-tight text-white mb-1">İş Emirleri</h2>
                <p class="text-sm font-medium text-gray-400">Bakım, onarım ve araç çıkış kontrol listelerini yönetin.</p>
            </div>
            <div class="flex items-center gap-3 flex-wrap">
                <!-- Sekme: İş Emirleri / Checklist -->
                <div class="flex p-1 bg-white/5 rounded-xl border border-white/10 gap-1">
                    <button id="ie-tab-emirler" onclick="window.isEmriTabDegistir('emirler')" class="px-4 py-2 text-sm font-bold rounded-lg bg-orange-500 text-white transition-all flex items-center gap-2">
                        <i data-lucide="clipboard-list" class="w-4 h-4"></i> İş Emirleri
                    </button>
                    <button id="ie-tab-checklist" onclick="window.isEmriTabDegistir('checklist')" class="px-4 py-2 text-sm font-bold rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2">
                        <i data-lucide="check-square" class="w-4 h-4"></i> Araç Çıkış
                    </button>
                </div>
                <button id="ie-yeni-btn" onclick="window.openModal('Yeni İş Emri')"
                    class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20">
                    <i data-lucide="plus-circle" class="w-4 h-4"></i> <span id="ie-yeni-btn-txt">Yeni İş Emri</span>
                </button>
            </div>
        </div>

        <!-- KPI Satırı -->
        <div id="ie-kpi-row" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"></div>

        <!-- İş Emirleri Kanban -->
        <div id="ie-emirler-panel">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6" id="ie-kanban-grid">
                ${['AÇIK', 'DEVAM EDİYOR', 'TAMAMLANDI'].map(durum => {
                    const s = DURUM_STILI[durum];
                    return `<div class="flex flex-col gap-3">
                        <div class="flex items-center gap-2 px-1 mb-1">
                            <span class="w-2.5 h-2.5 rounded-full ${s.dot}"></span>
                            <span class="text-xs font-black uppercase tracking-widest text-gray-400">${s.label}</span>
                            <span id="ie-count-${durum.replace(' ', '_')}" class="ml-auto text-xs font-bold text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">0</span>
                        </div>
                        <div id="ie-col-${durum.replace(/ /g, '_')}" class="flex flex-col gap-3 min-h-[200px]">
                            <div class="flex flex-col items-center justify-center gap-2 py-10 text-gray-600">
                                <i data-lucide="loader-2" class="animate-spin w-5 h-5"></i>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <!-- Checklist Paneli -->
        <div id="ie-checklist-panel" class="hidden">
            <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-gray-400">Son 50 araç çıkış kontrolü</p>
                <select id="ie-cl-arac-filter" onchange="window.checklistFiltrele(this.value)" class="bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-2 outline-none">
                    <option value="">Tüm Araçlar</option>
                </select>
            </div>
            <div id="ie-checklist-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="col-span-full py-12 text-center text-gray-600"><i data-lucide="loader-2" class="animate-spin w-6 h-6 mx-auto"></i></div>
            </div>
        </div>`;

        if (window.lucide) window.lucide.createIcons();
        await window.isEmirleriListeyiYenile();
    };

    // ----- SEKME -----
    window._ieAktifTab = 'emirler';

    window.isEmriTabDegistir = async function (tab) {
        window._ieAktifTab = tab;
        const emirlerPanel = document.getElementById('ie-emirler-panel');
        const checklistPanel = document.getElementById('ie-checklist-panel');
        const emirlerBtn = document.getElementById('ie-tab-emirler');
        const checklistBtn = document.getElementById('ie-tab-checklist');
        const yeniBtn = document.getElementById('ie-yeni-btn');
        const yeniTxt = document.getElementById('ie-yeni-btn-txt');

        const aktif = 'px-4 py-2 text-sm font-bold rounded-lg bg-orange-500 text-white transition-all flex items-center gap-2';
        const pasif = 'px-4 py-2 text-sm font-bold rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2';

        if (tab === 'emirler') {
            emirlerPanel?.classList.remove('hidden');
            checklistPanel?.classList.add('hidden');
            if (emirlerBtn) emirlerBtn.className = aktif;
            if (checklistBtn) checklistBtn.className = pasif;
            if (yeniTxt) yeniTxt.textContent = 'Yeni İş Emri';
            if (yeniBtn) yeniBtn.setAttribute('onclick', "window.openModal('Yeni İş Emri')");
        } else {
            emirlerPanel?.classList.add('hidden');
            checklistPanel?.classList.remove('hidden');
            if (checklistBtn) checklistBtn.className = aktif;
            if (emirlerBtn) emirlerBtn.className = pasif;
            if (yeniTxt) yeniTxt.textContent = 'Yeni Çıkış Formu';
            if (yeniBtn) yeniBtn.setAttribute('onclick', "window.openModal('Yeni Araç Çıkış Formu')");
            await window.checklistListeyiYenile();
        }
    };

    // ----- KANBAN RENDER -----
    window._isEmirleriListesi = [];

    window.isEmirleriListeyiYenile = async function () {
        window._isEmirleriListesi = await window.fetchIsEmirleri();
        window.isEmirleriKanbanRender();
        window.isEmriKpiRender();
    };

    window.isEmriKpiRender = function () {
        const liste = window._isEmirleriListesi;
        const acik = liste.filter(e => e.durum === 'AÇIK').length;
        const devam = liste.filter(e => e.durum === 'DEVAM EDİYOR').length;
        const tamam = liste.filter(e => e.durum === 'TAMAMLANDI').length;
        const acil = liste.filter(e => e.oncelik === 'ACİL' && e.durum !== 'TAMAMLANDI' && e.durum !== 'İPTAL').length;

        const kpiRow = document.getElementById('ie-kpi-row');
        if (!kpiRow) return;
        kpiRow.innerHTML = `
            <div class="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-gray-500/10 rounded-lg"><i data-lucide="clipboard" class="w-4 h-4 text-gray-400"></i></div><span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Açık</span></div>
                <div class="text-2xl font-black">${acik}</div><div class="text-xs text-gray-500">Bekleyen iş emri</div>
            </div>
            <div class="bg-white/5 border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-blue-500/10 rounded-lg"><i data-lucide="play-circle" class="w-4 h-4 text-blue-400"></i></div><span class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Devam</span></div>
                <div class="text-2xl font-black text-blue-400">${devam}</div><div class="text-xs text-blue-400/70">İşlem görüyor</div>
            </div>
            <div class="bg-white/5 border border-green-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-green-500/10 rounded-lg"><i data-lucide="check-circle-2" class="w-4 h-4 text-green-400"></i></div><span class="text-[10px] font-bold text-green-400 uppercase tracking-widest">Tamamlanan</span></div>
                <div class="text-2xl font-black text-green-400">${tamam}</div><div class="text-xs text-green-400/70">Bu ay kapatıldı</div>
            </div>
            <div class="bg-white/5 border border-red-500/20 rounded-2xl p-4 flex flex-col gap-1">
                <div class="flex justify-between items-start"><div class="p-2 bg-red-500/10 rounded-lg"><i data-lucide="siren" class="w-4 h-4 text-red-400"></i></div><span class="text-[10px] font-bold text-red-400 uppercase tracking-widest">Acil</span></div>
                <div class="text-2xl font-black text-red-400">${acil}</div><div class="text-xs text-red-400/70">Öncelikli iş emri</div>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
    };

    window.isEmirleriKanbanRender = function () {
        const liste = window._isEmirleriListesi;
        const kolonlar = ['AÇIK', 'DEVAM_EDİYOR', 'TAMAMLANDI'];
        const durumEsle = { 'AÇIK': 'AÇIK', 'DEVAM_EDİYOR': 'DEVAM EDİYOR', 'TAMAMLANDI': 'TAMAMLANDI' };

        kolonlar.forEach(kolonKey => {
            const durum = durumEsle[kolonKey];
            const col = document.getElementById(`ie-col-${kolonKey}`);
            const countEl = document.getElementById(`ie-count-${kolonKey}`);
            if (!col) return;

            const kolondakiler = liste.filter(e => e.durum === durum);
            if (countEl) countEl.textContent = kolondakiler.length;

            if (kolondakiler.length === 0) {
                col.innerHTML = `<div class="flex flex-col items-center justify-center gap-2 py-10 border-2 border-dashed border-white/5 rounded-2xl text-gray-700">
                    <i data-lucide="inbox" class="w-8 h-8"></i>
                    <p class="text-xs font-bold uppercase tracking-widest">Boş</p>
                </div>`;
            } else {
                col.innerHTML = kolondakiler.map(emir => isEmriKartHTML(emir)).join('');
            }
        });

        if (window.lucide) window.lucide.createIcons();
    };

    function isEmriKartHTML(emir) {
        const s = DURUM_STILI[emir.durum] || DURUM_STILI['AÇIK'];
        const onc = ONCELIK_STILI[emir.oncelik] || ONCELIK_STILI['NORMAL'];

        const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
        let deadlineBadge = '';
        if (emir.deadline_tarihi) {
            const dl = new Date(emir.deadline_tarihi);
            const fark = Math.ceil((dl - bugun) / 86400000);
            if (fark < 0) deadlineBadge = `<span class="text-[10px] font-bold text-red-400">⏰ ${Math.abs(fark)}g Gecikti</span>`;
            else if (fark <= 3) deadlineBadge = `<span class="text-[10px] font-bold text-yellow-400">⏰ ${fark}g Kaldı</span>`;
            else deadlineBadge = `<span class="text-[10px] text-gray-500">${dl.toLocaleDateString('tr-TR')}</span>`;
        }

        const plaka = emir.araclar?.plaka || '—';
        const sofor = emir.soforler?.ad_soyad || '';

        const durumSecenekleri = DURUMLAR.filter(d => d !== emir.durum && d !== 'İPTAL')
            .map(d => `<button onclick="window.isEmriDurumGuncelle('${emir.id}', '${d}')" class="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-white/10 transition-all">${d}</button>`)
            .join('');

        return `<div class="group relative ${s.bg} border ${s.border} rounded-2xl p-4 shadow-lg hover:shadow-xl transition-all">
            <!-- Öncelik + İş Türü -->
            <div class="flex items-center justify-between mb-3">
                <span class="px-2 py-0.5 border rounded-full text-[10px] font-black uppercase tracking-widest ${onc}">${emir.oncelik}</span>
                <span class="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">${emir.is_turu}</span>
            </div>
            <!-- Başlık -->
            <h4 class="font-bold text-white text-sm mb-1 leading-snug">${emir.baslik}</h4>
            <!-- Araç -->
            <div class="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2">
                <i data-lucide="truck" class="w-3 h-3 text-orange-400 flex-shrink-0"></i>
                <span class="font-semibold text-orange-300">${plaka}</span>
                ${sofor ? `<span class="text-gray-600">·</span><span>${sofor}</span>` : ''}
            </div>
            <!-- Atanan + Deadline -->
            <div class="flex items-center justify-between">
                <span class="text-[10px] text-gray-600">${emir.atanan_kisi ? `👤 ${emir.atanan_kisi}` : ''}</span>
                ${deadlineBadge}
            </div>
            <!-- Açıklama -->
            ${emir.aciklama ? `<p class="text-[11px] text-gray-500 mt-2 line-clamp-2">${emir.aciklama}</p>` : ''}
            <!-- Dosya linki -->
            ${emir.dosya_url ? `<a href="${emir.dosya_url}" target="_blank" class="mt-2 flex items-center gap-1 text-[10px] text-blue-400 hover:underline"><i data-lucide="paperclip" class="w-3 h-3"></i>Ek Dosya</a>` : ''}
            <!-- İşlem butonları hover'da -->
            <div class="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 flex-wrap">
                ${emir.durum === 'AÇIK' ? `<button onclick="window.isEmriDurumGuncelle('${emir.id}', 'DEVAM EDİYOR')" class="flex-1 text-center px-2 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-bold rounded-lg transition-all">▶ Başlat</button>` : ''}
                ${emir.durum === 'DEVAM EDİYOR' ? `<button onclick="window.isEmriDurumGuncelle('${emir.id}', 'TAMAMLANDI')" class="flex-1 text-center px-2 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-[10px] font-bold rounded-lg transition-all">✓ Tamamla</button>` : ''}
                ${emir.durum !== 'TAMAMLANDI' && emir.durum !== 'İPTAL' ? `<button onclick="window.isEmriDurumGuncelle('${emir.id}', 'İPTAL')" class="px-2 py-1.5 bg-gray-500/20 hover:bg-red-500/20 text-gray-500 hover:text-red-400 text-[10px] font-bold rounded-lg transition-all" title="İptal">✕</button>` : ''}
                <button onclick="window.deleteIsEmri('${emir.id}')" class="px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500/50 hover:text-red-400 text-[10px] rounded-lg transition-all opacity-0 group-hover:opacity-100" title="Sil"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
            </div>
        </div>`;
    }

    // ----- DURUM GÜNCELLE -----
    window.isEmriDurumGuncelle = async function (id, yeniDurum) {
        const payload = { durum: yeniDurum };
        if (yeniDurum === 'TAMAMLANDI') payload.tamamlanma_tarihi = new Date().toISOString().split('T')[0];

        const { error } = await window.supabaseClient.from('is_emirleri').update(payload).eq('id', id);
        if (error) { window.Toast?.error('Durum güncellenemedi: ' + error.message); return; }
        window.Toast?.success(`İş emri: ${yeniDurum}`);
        window.isEmirleriListeyiYenile();
    };

    // ----- SİL -----
    window.deleteIsEmri = async function (id) {
        if (!confirm('Bu iş emri silinecek. Emin misiniz?')) return;
        const { error } = await window.supabaseClient.from('is_emirleri').delete().eq('id', id);
        if (error) { window.Toast?.error('Silinemedi: ' + error.message); return; }
        window.Toast?.success('İş emri silindi.');
        window.isEmirleriListeyiYenile();
    };

    // ----- İŞ EMRİ FORM HTML -----
    window.getIsEmriFormHTML = async function () {
        const { data: araclar } = await window.supabaseClient.from('araclar').select('id, plaka').eq('mulkiyet_durumu', 'ÖZMAL').order('plaka');
        const { data: soforler } = await window.supabaseClient.from('soforler').select('id, ad_soyad').order('ad_soyad');

        return `
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">İş Emri Başlığı</label>
                <input type="text" id="ie-baslik" placeholder="Ör: 34 ABC 123 - Fren Balataları" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Araç</label>
                    <select id="ie-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        <option value="">— Araç Seç —</option>
                        ${(araclar || []).map(a => `<option value="${a.id}">${a.plaka}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Şoför / Teknisyen</label>
                    <select id="ie-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        <option value="">— Seçiniz —</option>
                        ${(soforler || []).map(s => `<option value="${s.id}">${s.ad_soyad}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">İş Türü</label>
                    <select id="ie-is-turu" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        ${IS_TURLERI.map(t => `<option value="${t}">${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Öncelik</label>
                    <select id="ie-oncelik" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        ${ONCELIKLER.map(o => `<option value="${o}" ${o === 'NORMAL' ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Deadline</label>
                    <input type="date" id="ie-deadline" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Atanan Kişi (İsteğe Bağlı)</label>
                <input type="text" id="ie-atanan" placeholder="Servis, teknisyen adı..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Açıklama</label>
                <textarea id="ie-aciklama" rows="2" placeholder="Yapılacak iş detayları..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all resize-none"></textarea>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ek Dosya (Hasar Fotoğrafı, Fatura vb.)</label>
                <input type="file" id="ie-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-orange-500/20 file:text-orange-400">
            </div>
        </div>`;
    };

    // ----- İŞ EMRİ KAYDET -----
    window.saveIsEmri = async function () {
        const baslik = document.getElementById('ie-baslik')?.value?.trim();
        const arac_id = document.getElementById('ie-arac')?.value || null;
        const sofor_id = document.getElementById('ie-sofor')?.value || null;
        const is_turu = document.getElementById('ie-is-turu')?.value;
        const oncelik = document.getElementById('ie-oncelik')?.value || 'NORMAL';
        const deadline_tarihi = document.getElementById('ie-deadline')?.value || null;
        const atanan_kisi = document.getElementById('ie-atanan')?.value?.trim() || null;
        const aciklama = document.getElementById('ie-aciklama')?.value?.trim() || null;

        if (!baslik) throw new Error('Başlık zorunludur.');

        const dosyaInput = document.getElementById('ie-dosya');
        let dosya_url = null;
        if (dosyaInput?.files?.length > 0) {
            dosya_url = await window.uploadDosya(dosyaInput.files[0], 'is-emirleri');
        }

        const { error } = await window.supabaseClient.from('is_emirleri').insert([{
            baslik, arac_id, sofor_id: sofor_id || null, is_turu, oncelik,
            deadline_tarihi, atanan_kisi, aciklama, dosya_url, durum: 'AÇIK'
        }]);
        if (error) throw error;

        if (typeof window.isEmirleriListeyiYenile === 'function') window.isEmirleriListeyiYenile();
    };

    // ----- ARAÇ ÇIKIŞ CHECKLİST -----
    window.checklistListeyiYenile = async function (arac_id = null) {
        const liste = await window.fetchChecklistler(arac_id);
        const listEl = document.getElementById('ie-checklist-list');
        if (!listEl) return;

        // Araç dropdown doldur
        const filterSel = document.getElementById('ie-cl-arac-filter');
        if (filterSel && filterSel.options.length <= 1) {
            const { data: araclar } = await window.supabaseClient.from('araclar').select('id, plaka').order('plaka');
            (araclar || []).forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id; opt.textContent = a.plaka;
                filterSel.appendChild(opt);
            });
        }

        if (liste.length === 0) {
            listEl.innerHTML = `<div class="col-span-full py-16 text-center text-gray-600 flex flex-col items-center gap-3">
                <i data-lucide="clipboard-x" class="w-10 h-10"></i><p class="font-bold text-sm">Henüz çıkış formu yok</p>
                <p class="text-xs">Araç çıkışında kontrol formu doldurun.</p></div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        listEl.innerHTML = liste.map(cl => {
            const kontroller = [
                { key: 'lastik_ok', etiket: 'Lastik' },
                { key: 'yakit_ok', etiket: 'Yakıt' },
                { key: 'fren_ok', etiket: 'Fren' },
                { key: 'yon_lambasi_ok', etiket: 'Yön Lambası' },
                { key: 'cam_ok', etiket: 'Cam' },
            ];
            const gecenler = kontroller.filter(k => cl[k.key]).length;
            const toplamPuan = `${gecenler}/${kontroller.length}`;
            const pRenk = gecenler === kontroller.length ? 'text-green-400' : gecenler >= 3 ? 'text-yellow-400' : 'text-red-400';

            return `<div class="bg-white/5 border ${cl.hasar_var ? 'border-red-500/30' : 'border-white/10'} rounded-2xl p-4">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <div class="text-sm font-bold text-white">${new Date(cl.tarih).toLocaleDateString('tr-TR')}</div>
                        <div class="text-xs text-gray-500">${cl.km_giris ? `${cl.km_giris.toLocaleString('tr-TR')} km` : '—'}</div>
                    </div>
                    <span class="text-lg font-black ${pRenk}">${toplamPuan}</span>
                </div>
                <div class="flex flex-wrap gap-1.5 mb-2">
                    ${kontroller.map(k => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${cl[k.key] ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${cl[k.key] ? '✓' : '✗'} ${k.etiket}</span>`).join('')}
                </div>
                ${cl.hasar_var ? `<div class="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400"><span class="font-bold">⚠ Hasar:</span> ${cl.hasar_aciklama || 'Belirtilmedi'}</div>` : ''}
                ${cl.hasar_foto_url ? `<a href="${cl.hasar_foto_url}" target="_blank" class="mt-2 flex items-center gap-1 text-[11px] text-blue-400 hover:underline"><i data-lucide="image" class="w-3 h-3"></i>Hasar Fotoğrafı</a>` : ''}
                ${cl.notlar ? `<p class="text-[11px] text-gray-500 mt-2 line-clamp-2">${cl.notlar}</p>` : ''}
            </div>`;
        }).join('');

        if (window.lucide) window.lucide.createIcons();
    };

    window.checklistFiltrele = function (arac_id) {
        window.checklistListeyiYenile(arac_id || null);
    };

    // ----- ARAÇ ÇIKIŞ FORM HTML -----
    window.getChecklistFormHTML = async function () {
        const { data: araclar } = await window.supabaseClient.from('araclar').select('id, plaka').order('plaka');
        const { data: soforler } = await window.supabaseClient.from('soforler').select('id, ad_soyad').order('ad_soyad');

        return `
        <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Araç</label>
                    <select id="cl-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        <option value="">— Araç Seç —</option>
                        ${(araclar || []).map(a => `<option value="${a.id}">${a.plaka}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Şoför</label>
                    <select id="cl-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                        <option value="">— Şoför Seç —</option>
                        ${(soforler || []).map(s => `<option value="${s.id}">${s.ad_soyad}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tarih</label>
                    <input type="date" id="cl-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Anlık KM</label>
                    <input type="number" id="cl-km" placeholder="123456" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all">
                </div>
            </div>
            <!-- Kontroller -->
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Araç Kontrolleri</label>
                <div class="grid grid-cols-2 gap-2">
                    ${[
                        { id: 'cl-lastik', label: '🛞 Lastik Durumu', icon: '' },
                        { id: 'cl-yakit', label: '⛽ Yakıt Seviyesi', icon: '' },
                        { id: 'cl-fren', label: '🔴 Fren Sistemi', icon: '' },
                        { id: 'cl-yon', label: '💡 Yön Lambaları', icon: '' },
                        { id: 'cl-cam', label: '🪟 Cam / Ayna', icon: '' },
                    ].map(k => `<label class="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all group">
                        <input type="checkbox" id="${k.id}" class="w-4 h-4 accent-orange-500 cursor-pointer">
                        <span class="text-sm font-medium text-gray-300 group-hover:text-white transition-all">${k.label}</span>
                    </label>`).join('')}
                </div>
            </div>
            <!-- Hasar -->
            <div>
                <label class="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl cursor-pointer hover:bg-red-500/15 transition-all">
                    <input type="checkbox" id="cl-hasar" onchange="window.clHasarToggle()" class="w-4 h-4 accent-red-500 cursor-pointer">
                    <span class="text-sm font-medium text-red-400">⚠ Araçta Hasar Var</span>
                </label>
                <div id="cl-hasar-alani" class="hidden mt-3 space-y-3">
                    <textarea id="cl-hasar-aciklama" rows="2" placeholder="Hasarı tarif edin..." class="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-red-500 transition-all resize-none"></textarea>
                    <input type="file" id="cl-hasar-foto" accept=".jpg,.jpeg,.png" class="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none transition-all file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-500/20 file:text-red-400">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Ek Notlar</label>
                <textarea id="cl-notlar" rows="2" placeholder="Eklemek istediğiniz bir şey..." class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-orange-500 transition-all resize-none"></textarea>
            </div>
        </div>`;
    };

    window.clHasarToggle = function () {
        const checked = document.getElementById('cl-hasar')?.checked;
        const alan = document.getElementById('cl-hasar-alani');
        if (alan) alan.classList.toggle('hidden', !checked);
    };

    // ----- CHECKLİST KAYDET -----
    window.saveChecklist = async function () {
        const arac_id = document.getElementById('cl-arac')?.value;
        const sofor_id = document.getElementById('cl-sofor')?.value || null;
        const tarih = document.getElementById('cl-tarih')?.value;
        const km_giris = parseInt(document.getElementById('cl-km')?.value) || null;
        const lastik_ok = document.getElementById('cl-lastik')?.checked || false;
        const yakit_ok = document.getElementById('cl-yakit')?.checked || false;
        const fren_ok = document.getElementById('cl-fren')?.checked || false;
        const yon_lambasi_ok = document.getElementById('cl-yon')?.checked || false;
        const cam_ok = document.getElementById('cl-cam')?.checked || false;
        const hasar_var = document.getElementById('cl-hasar')?.checked || false;
        const hasar_aciklama = document.getElementById('cl-hasar-aciklama')?.value || null;
        const notlar = document.getElementById('cl-notlar')?.value?.trim() || null;

        if (!arac_id) throw new Error('Araç seçimi zorunludur.');
        if (!tarih) throw new Error('Tarih zorunludur.');

        let hasar_foto_url = null;
        if (hasar_var) {
            const fotoInput = document.getElementById('cl-hasar-foto');
            if (fotoInput?.files?.length > 0) {
                hasar_foto_url = await window.uploadDosya(fotoInput.files[0], 'checklist-fotolar');
            }
        }

        const { error } = await window.supabaseClient.from('arac_cikis_checklist').insert([{
            arac_id, sofor_id, tarih, km_giris,
            lastik_ok, yakit_ok, fren_ok, yon_lambasi_ok, cam_ok,
            hasar_var, hasar_aciklama, hasar_foto_url, notlar
        }]);
        if (error) throw error;

        // KM güncelle
        if (km_giris && arac_id) {
            const { data: arac } = await window.supabaseClient.from('araclar').select('guncel_km').eq('id', arac_id).single();
            if (!arac || km_giris > (arac.guncel_km || 0)) {
                await window.supabaseClient.from('araclar').update({ guncel_km: km_giris }).eq('id', arac_id);
            }
        }

        if (typeof window.checklistListeyiYenile === 'function') window.checklistListeyiYenile();
    };

    // ----- MODULE INIT -----
    document.addEventListener('DOMContentLoaded', function () {
        const observer = new MutationObserver(() => {
            const modul = document.getElementById('module-is-emirleri');
            if (modul && !modul.classList.contains('hidden') && !modul.dataset.loaded) {
                modul.dataset.loaded = '1';
                window.renderIsEmirleriModulu();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });

    window.initIsEmirleriModule = function () {
        const modul = document.getElementById('module-is-emirleri');
        if (modul && !modul.classList.contains('hidden') && !modul.dataset.loaded) {
            modul.dataset.loaded = '1';
            window.renderIsEmirleriModulu();
        }
    };

})();
