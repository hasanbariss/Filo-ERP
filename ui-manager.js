function setGpsUrl(url) {
    document.getElementById('gps-url-input').value = url;
}
function loadGpsFrame() {
    const url = document.getElementById('gps-url-input').value.trim();
    if (!url) return;
    const placeholder = document.getElementById('gps-placeholder');
    const blocked = document.getElementById('gps-blocked');
    const loading = document.getElementById('gps-loading');
    const iframe = document.getElementById('gps-iframe');
    const link = document.getElementById('gps-open-link');

    placeholder.style.display = 'none';
    blocked.style.display = 'none';
    loading.style.display = 'flex';
    iframe.style.display = 'none';
    link.href = url;

    // Timeout ile engel kontrolü
    const timer = setTimeout(() => checkFrameBlocked(iframe, url), 4000);

    iframe.onload = function () {
        clearTimeout(timer);
        loading.style.display = 'none';
        try {
            // Cross-origin erişimi dene
            const _ = iframe.contentWindow.location.href;
            iframe.style.display = 'block';
        } catch (e) {
            // Cross-origin ama yüklendi = muhtemelen iframe izin verdi
            iframe.style.display = 'block';
        }
    };

    iframe.onerror = function () {
        clearTimeout(timer);
        showGpsBlocked();
    };

    iframe.src = url;
}
function checkFrameBlocked(iframe, url) {
    try {
        if (!iframe.contentDocument && !iframe.contentWindow.document) {
            showGpsBlocked();
        }
    } catch (e) {
        // cross-origin = normal, iframe yüklendi
    }
}
function showGpsBlocked() {
    document.getElementById('gps-loading').style.display = 'none';
    document.getElementById('gps-iframe').style.display = 'none';
    const b = document.getElementById('gps-blocked');
    b.style.display = 'flex';
}
/* === 1. ANA NAVİGASYON (SİDEBAR) MANTIĞI === */
const navButtons = document.querySelectorAll('#main-nav-buttons button');
const modules = document.querySelectorAll('.main-module');
const pageTitle = document.getElementById('page-title');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const moduleName = btn.innerText.trim();

        // Active button class sıfırla
        navButtons.forEach(b => b.classList.remove('active'));

        // Tıklananı aktif yap
        btn.classList.add('active');

        // Başlık Güncelle
        if (pageTitle) pageTitle.innerText = moduleName;

        // Modülleri Gizle ve Hedefi Göster
        modules.forEach(mod => {
            mod.classList.add('hidden');
            mod.classList.remove('block');
        });
        const targetMod = document.getElementById(targetId);
        if (targetMod) {
            targetMod.classList.add('block');
            targetMod.classList.remove('hidden');
        }

        // Modüle özgü veri yükle
        // Modüle özgü veri yükle
        if (targetId === 'module-teklifler' && typeof fetchTeklifler === 'function') {
            fetchTeklifler();
        } else if (targetId === 'module-dashboard' && typeof fetchDashboardData === 'function') {
            fetchDashboardData();
        } else if (targetId === 'module-musteri' && typeof fetchMusteriler === 'function') {
            fetchMusteriler();

        } else if (targetId === 'module-taseron' && typeof fetchTaseronlar === 'function') {
            fetchTaseronlar();
        } else if (targetId === 'module-filo') {
            if (typeof fetchAraclar === 'function') fetchAraclar();
        } else if (targetId === 'module-cari') {
            if (typeof fetchCariler === 'function') fetchCariler();
        } else if (targetId === 'module-finans') {
            if (typeof fetchFinansDashboard === 'function') fetchFinansDashboard();
            if (typeof fetchSoforMaasBordro === 'function') fetchSoforMaasBordro();
        } else if (targetId === 'module-raporlar') {
            if (typeof fetchRaporlar === 'function') fetchRaporlar();
        } else if (targetId === 'module-takvim') {
            if (typeof fetchTakvim === 'function') fetchTakvim();
        } else if (targetId === 'module-teklifler') {
            if (typeof fetchTeklifler === 'function') fetchTeklifler();
        } else if (targetId === 'module-personel') {
            const ayEl = document.getElementById('personel-ay');
            if (ayEl && !ayEl.value) {
                const now = new Date();
                ayEl.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
            }
            if (ayEl && ayEl.value) {
                ['filter-bordro-ay','filter-bordro-ay-p'].forEach(function(id) { const el = document.getElementById(id); if(el) el.value = ayEl.value; });
            }
            if (typeof fetchSoforMaasBordro === 'function') fetchSoforMaasBordro();
        }

        // Active tab stili resetlemeyi garantilemek için nav tetiklendiğinde ilgili modülün varsayılan tab'ini (varsa) active yapma
        if (targetId === 'module-cari') {
            const cariNav = document.getElementById('cari-tabs-nav');
            if (cariNav) {
                const firstBtn = cariNav.querySelector('button');
                if (firstBtn && firstBtn.id === 'tab-cariler') {
                    // Force UI update to match default visible content
                    if (typeof switchTab === 'function') switchTab('cari', 'cariler', firstBtn);
                }
            }
        }
    });
});

// Lucide Ikonlarını Başlat
window.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
    initCharts();
});

/* === GRAFİK SİSTEMİ (CHART.JS) === */
let mainChart, statusChart;

function initCharts() {
    const ctxMain = document.getElementById('mainChart');
    const ctxStatus = document.getElementById('statusChart');

    if (ctxMain) {
        mainChart = new Chart(ctxMain, {
            type: 'bar',
            data: {
                labels: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
                datasets: [{
                    label: 'Kilometre Performansı',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: '#FF6B00',
                    borderRadius: 8,
                    barThickness: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'gray' } },
                    x: { grid: { display: false }, ticks: { color: 'gray' } }
                }
            }
        });
    }

    if (ctxStatus) {
        statusChart = new Chart(ctxStatus, {
            type: 'doughnut',
            data: {
                labels: ['Geçerli', 'Yaklaşıyor', 'Süresi Dolan'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#00E699', '#FFB800', '#FF005C'],
                    borderWidth: 0,
                    cutout: '80%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }
}

/* === 1.B. FİLO ALT SÜRÜMÜ (ARAÇLAR / ŞOFÖRLER) === */
function switchFiloTab(tabName) {
    const aracBtn = document.getElementById('tab-btn-araclar');
    const soforBtn = document.getElementById('tab-btn-soforler');

    const aracSub = document.getElementById('sub-araclar');
    const soforSub = document.getElementById('sub-soforler');

    // Reset styles
    const inactiveClass = "px-6 py-2 text-sm font-semibold rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2";
    const activeClass = "px-6 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2";

    if (aracBtn) aracBtn.className = inactiveClass;
    if (soforBtn) soforBtn.className = inactiveClass;

    if (aracSub) { aracSub.classList.add('hidden'); aracSub.classList.remove('block'); }
    if (soforSub) { soforSub.classList.add('hidden'); soforSub.classList.remove('block'); }

    // Set active
    if (tabName === 'araclar' && aracBtn && aracSub) {
        aracBtn.className = activeClass;
        aracSub.classList.remove('hidden');
        aracSub.classList.add('block');
        if (typeof fetchAraclar === 'function') fetchAraclar();
    } else if (tabName === 'soforler' && soforBtn && soforSub) {
        soforBtn.className = activeClass;
        soforSub.classList.remove('hidden');
        soforSub.classList.add('block');
        if (typeof fetchSoforler === 'function') fetchSoforler();
    }
}

/* === 1.C. TAŞERON ALT SEKMELERİ === */
window.switchTaseronTab = function (tabName) {
    const tabs = ['liste', 'hakedis', 'sefer', 'evrak'];
    const inactiveClass = "px-6 py-2 text-sm font-semibold rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2";
    const activeClass = "px-6 py-2 text-sm font-semibold rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2";

    tabs.forEach(t => {
        const btn = document.getElementById(`taseron-tab-${t}`);
        const content = document.getElementById(`taseron-content-${t}`);
        if (btn) btn.className = inactiveClass;
        if (content) {
            content.classList.add('hidden');
            content.classList.remove('block');
        }
    });

    const activeBtn = document.getElementById(`taseron-tab-${tabName}`);
    const activeContent = document.getElementById(`taseron-content-${tabName}`);

    if (activeBtn) activeBtn.className = activeClass;
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('block');
    }

    // Tab'a özgü veri yükle
    if (tabName === 'liste' && typeof fetchTaseronlar === 'function') fetchTaseronlar();
    if (tabName === 'hakedis' && typeof fetchTaseronHakedis === 'function') fetchTaseronHakedis();
    if (tabName === 'sefer' && typeof fetchTaseronSeferler === 'function') fetchTaseronSeferler();

    if (window.lucide) window.lucide.createIcons();
};

/* === HELPER FUNCTIONS === */
window.formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount || 0);
};

window.formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('tr-TR').format(date);
    } catch { return dateStr; }
};

/* === 2. FİNANS ALT SEKMELERİ === */
// Genel sekme geçiş fonksiyonu
window.switchTab = function (modulePrefix, tabName, clickedButton) {

    // Find all buttons in the nav container
    const navContainer = document.getElementById(`${modulePrefix}-tabs-nav`);
    if (!navContainer) return;
    const tabButtons = navContainer.querySelectorAll('button');
    const tabContents = document.querySelectorAll(`#module-${modulePrefix} [id^="content-"]`);

    // Reset all buttons to inactive style
    tabButtons.forEach(btn => {
        btn.className = "px-5 py-2 text-sm font-bold rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-all";
    });

    // Hide all contents
    tabContents.forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('block');
    });

    // Set clicked button to active
    let activeClass = "px-5 py-2 text-sm font-bold rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all";
    if (modulePrefix === 'cari' || modulePrefix === 'finans') {
        activeClass = "px-5 py-2 text-sm font-bold rounded-lg bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition-all";
    }

    clickedButton.className = activeClass;

    // Show related content
    const activeContent = document.getElementById(`content-${tabName}`);
    if (activeContent) {
        activeContent.classList.remove('hidden');
        activeContent.classList.add('block');
    } else {
    }

    if (window.lucide) window.lucide.createIcons();

    if (modulePrefix === 'finans') {
        if (tabName === 'sofor-puantaj') fetchSoforMaasBordro();
        else if (tabName === 'sofor-finans') fetchSoforFinans();
        else if (tabName === 'sofor-maas') fetchSoforMaaslar();
        else if (tabName === 'taseron-finans') fetchTaseronFinans();
        else if (tabName === 'taseron-rapor') fetchTaseronAylikRapor();
        else if (tabName === 'yakit') fetchYakitlar();
        else if (tabName === 'aylik-odeme' && typeof fetchAylikOdemeOzeti === 'function') fetchAylikOdemeOzeti();
    } else if (modulePrefix === 'cari') {
        if (tabName === 'cariler') fetchCariler();
        else if (tabName === 'bakim') fetchBakimlar();
        else if (tabName === 'police') fetchPoliceler();
        else if (tabName === 'taksitler') fetchTaksitler();
        else if (tabName === 'maaslar') fetchMaaslar();
        else if (tabName === 'kredi-kartlari') fetchKrediKartlari();
    }
}

/* === 2.A Kredi Kartı İşlem Detay Modalı (YENİ) === */
window.showKartIslemleri = function (txDataStr, kartAdi) {
    const modal = document.getElementById('general-modal');
    const modalTitle = document.getElementById('modal-title');
    const dynamicBody = document.getElementById('modal-dynamic-body');

    modalTitle.textContent = kartAdi + ' - Kart İşlemleri';
    let content = '<div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">';

    try {
        const txList = JSON.parse(txDataStr);
        if (txList.length === 0) {
            content += '<p class="text-sm text-gray-400 italic">Bu karta ait henüz işlem bulunmamaktadır.</p>';
        } else {
            // Sort by date descending
            txList.sort((a, b) => new Date(b.islem_tarihi) - new Date(a.islem_tarihi));

            txList.forEach(tx => {
                const islemGunu = window.formatDate(tx.islem_tarihi);
                const desc = tx.aciklama || 'Belirtilmemiş Harcama';
                const ts = Number(tx.taksit_sayisi || 1);
                const tTutar = Number(tx.toplam_tutar || 0);
                const aylikTutar = (ts > 0) ? (tTutar / ts) : tTutar;
                const taksitBadge = (ts > 1)
                    ? `<span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-bold text-[10px] rounded ml-2">${ts} Taksit</span>`
                    : `<span class="px-2 py-0.5 bg-white/10 text-gray-400 font-bold text-[10px] rounded ml-2">Tek Çekim</span>`;

                content += `
                    <div class="p-4 bg-white/5 border border-white/10 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-white/10 transition-colors">
                        <div class="flex-1">
                            <div class="flex items-center mb-1">
                                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">${islemGunu}</span>
                                ${taksitBadge}
                            </div>
                            <p class="text-sm font-bold text-white">${desc}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                            <p class="text-sm font-bold text-orange-400 border-b border-orange-500/20 pb-1 mb-1">
                                Toplam: ${window.formatCurrency(tTutar)}
                            </p>
                            ${ts > 1 ? `<p class="text-[10px] text-gray-400">Aylık: <span class="text-white">${window.formatCurrency(aylikTutar)}/ay</span></p>` : ''}
                        </div>
                    </div>
                `;
            });
        }
    } catch (e) {
        content += `<p class="text-sm text-red-500">İşlemler yüklenirken hata oluştu.</p>`;
    }

    content += '</div>';
    dynamicBody.innerHTML = content;

    // Modify close button logic temporarily if needed, but default modal close will work.
    // In our generic modal, the 'Kaydet' button is always there.
    // For a view-only modal, we should probably hide the save button.
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) {
        saveBtn.style.display = 'none';

        // Restore save button when modal closes
        const closeBtn = document.querySelector('#general-modal [onclick="closeModal()"]');
        if (closeBtn) {
            const oldOnclick = closeBtn.onclick;
            closeBtn.onclick = function () {
                saveBtn.style.display = 'block';
                closeModal();
                closeBtn.onclick = oldOnclick; // restore original
            };
        }

        // Catch clicking outside modal as well
        const modalEl = document.getElementById('general-modal');
        const oldClick = modalEl.onclick;
        modalEl.onclick = function (e) {
            if (e.target === modalEl) {
                saveBtn.style.display = 'block';
                closeModal();
                modalEl.onclick = oldClick;
            }
        };
    }

    modal.classList.remove('hidden');
}

/* === 2.B. ÖDEME PLANI FİLTRELEME (PHASE 8) === */
window.filterTaksitler = function (category) {
    const btns = {
        'HEPSİ': 'taksit-btn-all',
        'Police': 'taksit-btn-police',
        'Bakim': 'taksit-btn-bakim'
    };

    // Reset button styles
    Object.values(btns).forEach(id => {
        const b = document.getElementById(id);
        if (b) {
            b.className = "px-4 py-1.5 text-xs font-bold rounded-lg text-gray-500 hover:text-white transition-all";
        }
    });

    // Set active button style
    const activeBtn = document.getElementById(btns[category]);
    if (activeBtn) {
        activeBtn.className = "px-4 py-1.5 text-xs font-bold rounded-lg bg-orange-500 text-white transition-all";
    }

    // Call fetch with filter
    if (typeof fetchTaksitler === 'function') {
        fetchTaksitler(category);
    }
}

/* === 2.C. CARİ DETAY & EKSTRE (PHASE 8) === */
window.openCariDetail = function (cariId) {
    const modal = document.getElementById('cari-detail-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Fetch data
    if (typeof fetchCariDetails === 'function') {
        fetchCariDetails(cariId);
    }
    if (window.lucide) window.lucide.createIcons();
};

window.closeCariDetail = function () {
    const modal = document.getElementById('cari-detail-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
};

window.printCariEkstre = function () {
    const unvan = document.getElementById('cari-detail-unvan').innerText;
    const printWindow = window.open('', '_blank');
    const content = document.querySelector('#cari-detail-modal .p-8').cloneNode(true);

    // Remove scroll limits for print
    content.style.maxHeight = 'none';
    content.style.overflow = 'visible';

    printWindow.document.write(`
        <html>
            <head>
                <title>Cari Ekstre - ${unvan}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Outfit', sans-serif; background: white; color: black; padding: 40px; }
                    .bg-white\\/5 { background: #f9fafb !important; border: 1px solid #e5e7eb !important; }
                    .text-white { color: #111827 !important; }
                    .text-gray-400, .text-gray-500 { color: #6b7280 !important; }
                    .border-white\\/5, .border-white\\/10 { border-color: #e5e7eb !important; }
                    tr { border-bottom: 1px solid #f3f4f6; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1 class="text-2xl font-black mb-8 border-b pb-4">Cari Hesap Ekstresi</h1>
                ${content.innerHTML}
                <div class="mt-12 text-xs text-gray-500 text-center italic">Bu rapor IDEOL Filo Yönetim Sistemi tarafından oluşturulmuştur.</div>
            </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

// Başlangıçta ilk sekmeyi aktif et
document.addEventListener('DOMContentLoaded', () => {
    // Set bordro month filter to current month
    const bordroAy = document.getElementById('filter-bordro-ay');
    if (bordroAy && !bordroAy.value) {
        const now = new Date();
        bordroAy.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Set taseron rapor month filter
    const taseronRaporAy = document.getElementById('filter-taseron-rapor-ay');
    if (taseronRaporAy && !taseronRaporAy.value) {
        const now = new Date();
        taseronRaporAy.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const initialFinansTab = document.querySelector('#finans-tabs-nav button');
    if (initialFinansTab) {
        initialFinansTab.click();
    }
    const initialCariTab = document.querySelector('#cari-tabs-nav button');
    if (initialCariTab) {
        initialCariTab.click();
    }
});

/* === 3. MODAL (PENCERE) KONTROLLERİ === */
const modal = document.getElementById('general-modal');
const modalTitle = document.getElementById('modal-title');

window.openModal = function (title, id = null, extra = null) {
    modalTitle.textContent = title;
    const dynamicBody = document.getElementById('modal-dynamic-body');
    let content = '';

    if (title === 'Yeni Araç Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Mevcut araç tablosuna yeni bir araç kaydı eklemek için lütfen aşağıdaki alanları eksiksiz doldurunuz.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Plaka</label>
                            <input type="text" id="arac-plaka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Plaka Giriniz">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Marka Model</label>
                                <input type="text" id="arac-marka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Marka Model Giriniz">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Çalıştığı Şirket</label>
                                <select id="arac-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Belirtilmemiş">Belirtilmemiş</option>
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="DİKKAN">DİKKAN</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Mülkiyet Durumu</label>
                                <select id="arac-mulkiyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="ÖZMAL">ÖZMAL</option>
                                    <option value="TAŞERON">TAŞERON</option>
                                    <option value="KİRALIK">KİRALIK</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge Türü</label>
                                <select id="arac-belge" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Yok">Yok</option>
                                    <option value="D2">D2 Belgesi</option>
                                    <option value="D4S">D4S Belgesi</option>
                                    <option value="U-ETDS">U-ETDS Sistemi</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Şoför Ekle') {
        content = `
                    <div class="space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="user" class="w-4 h-4 text-blue-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-blue-500">Kişisel Bilgiler</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ad Soyad *</label>
                                <input type="text" id="sofor-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="İsim Soyisim">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Çalıştığı Şirket</label>
                                <select id="sofor-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="DİKKAN">DİKKAN</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">TC Kimlik No</label>
                                <input type="text" id="sofor-tc" maxlength="11" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="11 haneli">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Doğum Tarihi</label>
                                <input type="date" id="sofor-dogum" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="sofor-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="05XX XXX XX XX">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum Kişisi</label>
                                <input type="text" id="sofor-acil-kisi" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="İsim Soyisim">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum Telefonu</label>
                                <input type="text" id="sofor-acil-telefon" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="05XX XXX XX XX">
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="file-text" class="w-4 h-4 text-orange-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-orange-500">Belgeler & Ehliyet</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ehliyet Sınıfı</label>
                                <select id="sofor-ehliyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="">Seçiniz...</option>
                                    <option value="B">B Sınıfı</option>
                                    <option value="C">C Sınıfı</option>
                                    <option value="CE">CE Sınıfı</option>
                                    <option value="D">D Sınıfı</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">SRC Belgesi</label>
                                <select id="sofor-src" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Yok">Yok</option>
                                    <option value="SRC-1">SRC-1</option>
                                    <option value="SRC-2">SRC-2</option>
                                    <option value="SRC-3">SRC-3</option>
                                    <option value="SRC-4">SRC-4</option>
                                    <option value="SRC-5">SRC-5</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge / Sözleşme URL</label>
                            <input type="text" id="sofor-belge-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="https://...">
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="banknote" class="w-4 h-4 text-green-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-green-500">Maaş & Sigorta</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Aylık Maaş (₺)</label>
                                <input type="number" id="sofor-aylik-maas" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="35000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Günlük Yevmiye (₺)</label>
                                <input type="number" id="sofor-ucret" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta</label>
                                <select id="sofor-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SGK">SGK</option>
                                    <option value="Bağkur">Bağkur</option>
                                    <option value="Yok">Yok</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşe Başlama</label>
                                <input type="date" id="sofor-ise-baslama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">IBAN</label>
                            <input type="text" id="sofor-iban" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono" placeholder="TR00 0000 0000 0000 0000 0000 00">
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Teklif Ekle') {
        // Dinamik araç ve cari listesi bekleyelim
        content = `
            <p class="text-xs text-gray-400 mb-5">Farklı firmalardan alınan teklifleri karşılaştırmak için kaydedin.</p>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Araç *</label>
                        <select id="teklif-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"><option value="">Yükleniyor...</option></select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Poliçe Türü *</label>
                        <select id="teklif-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                            <option value="Trafik">Trafik Sigortası</option>
                            <option value="Kasko">Kasko</option>
                            <option value="Koltuk Sigortası">Koltuk Sigortası</option>
                            <option value="Diğer">Diğer</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sigorta Firması (Cari) *</label>
                    <select id="teklif-firma" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                        <option value="">— Cari Yükleniyor —</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fiyat (₺) *</label>
                        <input type="number" id="teklif-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all" placeholder="0.00">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Taksit Sayısı</label>
                        <select id="teklif-taksit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                            <option value="1">Peşin (Tek Çekim)</option>
                            <option value="2">2 Taksit</option>
                            <option value="3">3 Taksit</option>
                            <option value="4">4 Taksit</option>
                            <option value="6">6 Taksit</option>
                            <option value="9">9 Taksit</option>
                            <option value="12">12 Taksit</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        setTimeout(async () => {
            loadSelectOptions('teklif-arac', 'araclar', 'id', 'plaka');
            // Sigortacı carilerini yükle
            const firmaSelect = document.getElementById('teklif-firma');
            if (firmaSelect && window.supabaseClient && window.supabaseUrl !== 'YOUR_SUPABASE_URL') {
                const { data: cariler } = await window.supabaseClient
                    .from('cariler').select('id, unvan').order('unvan');
                firmaSelect.innerHTML = '<option value="">— Sigorta Firması Seç —</option>';
                (cariler || []).forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.unvan;
                    firmaSelect.appendChild(opt);
                });
            }
        }, 50);
    } else if (title === 'Yeni Puantaj Gir') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Şoförün günlük çalışma, izin veya rapor durumunu sisteme işleyiniz.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Şoför Seçin</label>
                                <select id="puantaj-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçin</label>
                                <select id="puantaj-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarih</label>
                            <input type="date" id="puantaj-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Durum</label>
                            <select id="puantaj-durum" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                <option value="ÇALIŞTI">ÇALIŞTI</option>
                                <option value="İZİNLİ">İZİNLİ</option>
                                <option value="RAPORLU">RAPORLU</option>
                                <option value="DEVAMSIZ">DEVAMSIZ</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Harcırah (₺)</label>
                            <input type="number" step="0.01" id="puantaj-harcirah" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('puantaj-sofor', 'soforler', 'id', 'ad_soyad');
            loadSelectOptions('puantaj-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Yeni Finans İşlemi') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Şoför bazlı finansal işlem (maaş, avans, kesinti vb.) girişi yapın.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Şoför Seçin</label>
                            <select id="finans-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşlem Türü</label>
                            <select id="finans-tur" onchange="if(window.handleFinansTurChange) window.handleFinansTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                <option value="MAAŞ">MAAŞ (+)</option>
                                <option value="PRİM/HARCIRAH">PRİM/HARCIRAH (+)</option>
                                <option value="AVANS">AVANS (-)</option>
                                <option value="KESİNTİ (Ceza/Hasar)">KESİNTİ (Ceza/Hasar) (-)</option>
                            </select>
                        </div>
                        
                        <!-- DİNAMİK ALANLAR (Geri Ödeme Şekli, Ceza No vb.) -->
                        <div id="finans-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tutar (₺)</label>
                            <input type="number" step="0.01" id="finans-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Açıklama</label>
                            <input type="text" id="finans-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="İşlem Açıklaması">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('finans-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'Yeni Sefer Hakedişi Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Taşeron araçlar için yeni sefer hakedişi kaydı oluşturun.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçin</label>
                            <select id="taseron-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sefer Tarihi</label>
                            <input type="date" id="taseron-tarih" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Güzergah</label>
                            <input type="text" id="taseron-guzergah" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Rota Bilgisi">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Anlaşılan Tutar</label>
                                <input type="number" step="0.01" id="taseron-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="10000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Yakıt Kesintisi</label>
                                <input type="number" step="0.01" id="taseron-yakit" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('taseron-arac', 'araclar', 'id', 'plaka', 'mulkiyet_durumu', ['TAŞERON']), 50);
    } else if (title === 'Yeni Taşeron Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Sisteme yeni bir dış tedarikçi (taşeron) aracı ve sahibi kaydedin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Plakası *</label>
                                <input type="text" id="taseron-yeni-plaka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="34 ABC 123">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Firma / Sahip Adı *</label>
                                <input type="text" id="taseron-yeni-firma" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Lojistik A.Ş.">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Marka / Model</label>
                                <input type="text" id="taseron-yeni-marka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Mercedes Axor">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kira Bedeli (₺)</label>
                                <input type="number" id="taseron-yeni-kira" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Görevli Şoför</label>
                            <select id="taseron-yeni-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('taseron-yeni-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'Yeni Müşteri Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Kurumsal müşteri ve iş ortağı bilgilerini detaylı olarak kaydedin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Müşteri / Kurum Adı</label>
                                <input type="text" id="musteri-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Kurum Adı">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vergi No / Daire</label>
                                <input type="text" id="musteri-vergi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0000000000">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Yetkili Kişi</label>
                                <input type="text" id="musteri-yetkili" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ad Soyad">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="musteri-tel" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="05XX XXX XX XX">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Adres</label>
                            <textarea id="musteri-adres" rows="2" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tam Adres"></textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vade (Gün)</label>
                                <input type="number" id="musteri-vade" value="30" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Logo/Evrak URL</label>
                                <input type="text" id="musteri-logo" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="https://...">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Servis Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Müşteriye verilen günlük veya vardiyalı servis hizmetini kayıt altına alın.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Müşteri Seçin</label>
                                <select id="servis-musteri" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kullanan Araç</label>
                                <select id="servis-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarih</label>
                                <input type="date" id="servis-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vardiya / Yön</label>
                                <select id="servis-vardiya" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SABAH">SABAH</option>
                                    <option value="AKŞAM">AKŞAM</option>
                                    <option value="GECE">GECE</option>
                                    <option value="EKSTRA">EKSTRA</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Günlük Fatura Tutarı (₺)</label>
                            <input type="number" step="0.01" id="servis-fatura" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('servis-musteri', 'musteriler', 'id', 'ad');
            loadSelectOptions('servis-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Araç Şoför Ata') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Seçili araca atamak istediğiniz aktif şoförü listeden seçiniz.</p>
                    <input type="hidden" id="atama-arac-id" value="">
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Şoför Seçin</label>
                            <select id="atama-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('atama-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'Şoför Güncelle') {
        content = `
                    <div class="space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="user" class="w-4 h-4 text-blue-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-blue-500">Kişisel Bilgiler</p>
                        </div>
                        <input type="hidden" id="edit-sofor-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ad Soyad *</label>
                                <input type="text" id="edit-sofor-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Çalıştığı Şirket</label>
                                <select id="edit-sofor-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">TC Kimlik No</label>
                                <input type="text" id="edit-sofor-tc" maxlength="11" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Doğum Tarihi</label>
                                <input type="date" id="edit-sofor-dogum" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="edit-sofor-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum Kişisi</label>
                                <input type="text" id="edit-sofor-acil-kisi" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="İsim Soyisim">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum Telefonu</label>
                                <input type="text" id="edit-sofor-acil-telefon" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="05XX XXX XX XX">
                            </div>
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="file-text" class="w-4 h-4 text-orange-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-orange-500">Belgeler & Ehliyet</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ehliyet Sınıfı</label>
                                <select id="edit-sofor-ehliyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="">Seçiniz...</option>
                                    <option value="B">B Sınıfı</option>
                                    <option value="C">C Sınıfı</option>
                                    <option value="CE">CE Sınıfı</option>
                                    <option value="D">D Sınıfı</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">SRC Belgesi</label>
                                <select id="edit-sofor-src" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Yok">Yok</option>
                                    <option value="SRC-1">SRC-1</option>
                                    <option value="SRC-2">SRC-2</option>
                                    <option value="SRC-3">SRC-3</option>
                                    <option value="SRC-4">SRC-4</option>
                                    <option value="SRC-5">SRC-5</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge / Sözleşme URL</label>
                            <input type="text" id="edit-sofor-belge-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="banknote" class="w-4 h-4 text-green-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-green-500">Maaş & Sigorta</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Aylık Maaş (₺)</label>
                                <input type="number" id="edit-sofor-aylik-maas" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Günlük Yevmiye (₺)</label>
                                <input type="number" id="edit-sofor-ucret" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta</label>
                                <select id="edit-sofor-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SGK">SGK</option>
                                    <option value="Bağkur">Bağkur</option>
                                    <option value="Yok">Yok</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşe Başlama</label>
                                <input type="date" id="edit-sofor-ise-baslama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Araç Evrak Güncelle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Aracın kritik evrak (vize, sigorta, kasko) tarihlerini ve belgelerini güncelleyin.</p>
                    <input type="hidden" id="evrak-arac-id" value="">
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vize Bitiş</label>
                                <input type="date" id="evrak-vize" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vize Belgesi (URL)</label>
                                <input type="text" id="evrak-vize-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta Bitiş</label>
                                <input type="date" id="evrak-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta Belgesi (URL)</label>
                                <input type="text" id="evrak-sigorta-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kasko Bitiş</label>
                                <input type="date" id="evrak-kasko" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kasko Belgesi (URL)</label>
                                <input type="text" id="evrak-kasko-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Koltuk Sig. Bitiş</label>
                                <input type="date" id="evrak-koltuk" class="w-full bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Koltuk Sig. Belgesi (URL)</label>
                                <input type="text" id="evrak-koltuk-url" class="w-full bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Müşteriye Araç Tanımla') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Müşteriye özel araç ve tarife tanımlarını yaparak otomatik faturalandırma altyapısını kurun.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Müşteri / Fabrika Seçin</label>
                            <select id="tanim-musteri" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tanımlanacak Araç</label>
                            <select id="tanim-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarife Türü</label>
                            <select id="tanim-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                <option value="Vardiya">Vardiya</option>
                                <option value="Tek">Tek (Sabah veya Akşam)</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tam / Vardiya Fiyatı (₺)</label>
                                <input type="number" step="0.01" id="tanim-vardiya-fiyat" placeholder="Örn: 1500" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tek Sefer Fiyatı (₺)</label>
                                <input type="number" step="0.01" id="tanim-tek-fiyat" placeholder="Örn: 800" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('tanim-musteri', 'musteriler', 'id', 'ad');
            loadSelectOptions('tanim-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Yeni Yakıt Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Araç yakıt alımlarını takip ederek işletme maliyetlerini optimize edin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarih</label>
                                <input type="date" id="yakit-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçin</label>
                                <select id="yakit-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Alınan Litre</label>
                                <input type="number" step="0.01" id="yakit-litre" oninput="hesaplaYakit()" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Birim Fiyat (₺)</label>
                                <input type="number" step="0.01" id="yakit-fiyat" oninput="hesaplaYakit()" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Anlık Kilometre (KM)</label>
                                <input type="number" id="yakit-km" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono" placeholder="Örn: 125000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (₺)</label>
                                <input type="number" step="0.01" id="yakit-tutar" class="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none transition-all font-bold" readonly>
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('yakit-arac', 'araclar', 'id', 'plaka'), 50);
    } else if (title === 'Yeni Cari Hesap') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Tedarikçi, servis veya acente bilgilerinizi sisteme kaydederek ödeme takibini başlatın.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unvan / Firma Adı</label>
                            <input type="text" id="cari-unvan" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Firma tam adı">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Türü</label>
                                <select id="cari-tur" onchange="if(window.handleCariTurChange) window.handleCariTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Tedarikçi">Tedarikçi</option>
                                    <option value="Tamirci">Tamirci / Servis</option>
                                    <option value="Sigorta Acentesi">Sigorta Acentesi</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İletişim No</label>
                                <input type="text" id="cari-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0212 ...">
                            </div>
                        </div>
                        
                        <!-- DİNAMİK ALANLAR (Acente Levha No, Uzmanlık vb.) -->
                        <div id="cari-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                    </div>
                `;
    } else if (title === 'Yeni Bakım/Parça Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Araç bakım ve onarım işlemlerini detaylandırarak teknik geçmiş oluşturun.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşlem Tarihi</label>
                                <input type="date" id="bakim-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçin</label>
                                <select id="bakim-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşlem Türü</label>
                                <select id="bakim-tur" onchange="if(window.handleBakimTurChange) window.handleBakimTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Bakım/İşçilik">Bakım / İşçilik</option>
                                    <option value="Yedek Parça">Yedek Parça</option>
                                    <option value="Hasar Onarım">Hasar Onarım</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tedarikçi/Tamirci</label>
                                <select id="bakim-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>

                        <!-- DİNAMİK ALANLAR (Parça Adı/Kodu, Hasar Dosya No) -->
                        <div id="bakim-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="col-span-2">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Açıklama</label>
                                <input type="text" id="bakim-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: 10.000 Bakımı, Yağ Değişimi">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Anlık KM</label>
                                <input type="number" id="bakim-km" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono" placeholder="Örn: 125000">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (₺)</label>
                                <input type="number" step="0.01" id="bakim-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge Yükle</label>
                                <input type="file" id="bakim-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ödeme Türü</label>
                                <select id="bakim-odeme-turu" onchange="if(window.handleOdemeTuruChange) window.handleOdemeTuruChange(this.value, 'bakim')" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="VADELİ (Cariye Yaz)">VADELİ (Cariye Yaz)</option>
                                    <option value="KREDİ KARTI">KREDİ KARTI İLE ÖDENDİ</option>
                                    <option value="CARİ HESABI">CARİ HESABINDAN ÖDENDİ</option>
                                    <option value="NAKİT / HAVALE">NAKİT / HAVALE İLE ÖDENDİ</option>
                                </select>
                            </div>
                            <div id="bakim-kredi-karti-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kredi Kartı</label>
                                <select id="bakim-kredi-karti" class="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div id="bakim-cari-hesap-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Hesap Seç</label>
                                <select id="bakim-odeme-cari" class="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-400 focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>

                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('bakim-arac', 'araclar', 'id', 'plaka');
            loadSelectOptions('bakim-cari', 'cariler', 'id', 'unvan', 'tur', ['Tedarikçi', 'Tamirci', 'Servis', 'Tedarikçi/Tamirci']);
            loadSelectOptions('bakim-kredi-karti', 'kredi_kartlari', 'id', 'kart_adi');
            loadSelectOptions('bakim-odeme-cari', 'cariler', 'id', 'unvan');
        }, 50);
    } else if (title === 'Yeni Poliçe Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Trafik sigortası, kasko ve diğer poliçe girişlerini yaparak risk yönetimi sağlayın.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçin</label>
                                <select id="police-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Acente (Cari)</label>
                                <select id="police-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Başlangıç</label>
                                <input type="date" id="police-baslangic" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bitiş</label>
                                <input type="date" id="police-bitis" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Poliçe Türü</label>
                                <select id="police-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Trafik">Trafik Sigortası</option>
                                    <option value="Kasko">Kasko</option>
                                    <option value="İhtiyari Mali Mesuliyet">İMM</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit</label>
                                <input type="number" id="police-taksit" value="1" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (₺)</label>
                                <input type="number" step="0.01" id="police-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge Yükle</label>
                                <input type="file" id="police-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ödeme Türü</label>
                                <select id="police-odeme-turu" onchange="if(window.handleOdemeTuruChange) window.handleOdemeTuruChange(this.value, 'police')" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="VADELİ (Cariye Yaz)">VADELİ (Cariye Yaz)</option>
                                    <option value="KREDİ KARTI">KREDİ KARTI İLE ÖDENDİ</option>
                                    <option value="CARİ HESABI">CARİ HESABINDAN ÖDENDİ</option>
                                    <option value="NAKİT / HAVALE">NAKİT / HAVALE İLE ÖDENDİ</option>
                                </select>
                            </div>
                            <div id="police-kredi-karti-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kredi Kartı</label>
                                <select id="police-kredi-karti" class="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div id="police-cari-hesap-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Hesap Seç</label>
                                <select id="police-odeme-cari" class="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-400 focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('police-arac', 'araclar', 'id', 'plaka');
            loadSelectOptions('police-cari', 'cariler', 'id', 'unvan', 'tur', ['Sigorta Acentesi', 'Acente', 'Sigorta']);
            loadSelectOptions('police-kredi-karti', 'kredi_kartlari', 'id', 'kart_adi');
            loadSelectOptions('police-odeme-cari', 'cariler', 'id', 'unvan');
        }, 50);
    } else if (title === 'Poliçe Düzenle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Poliçenizdeki bilgileri güncelleyin ve ödeme yaptığınız kredi kartını/notu belirtin.</p>
                    <div class="space-y-6">
                        <input type="hidden" id="edit-police-id" value="">
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Başlangıç</label>
                                <input type="date" id="edit-police-baslangic" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bitiş</label>
                                <input type="date" id="edit-police-bitis" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (₺)</label>
                                <input type="number" step="0.01" id="edit-police-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit</label>
                                <input type="number" id="edit-police-taksit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Hangi Kartla Kesildi? / Not</label>
                            <input type="text" id="edit-police-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: Garanti Bonus kartımla 6 taksit çektim.">
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Fatura Kaydı') {
        content = `
                    <p class="text-sm text-gray-500 mb-6">Cari hesaba ait genel bir fatura veya belge kaydedin.</p>
                    <input type="hidden" id="fatura-cari-id" value="">
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fatura Tarihi</label>
                                <input type="date" id="fatura-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fatura No</label>
                                <input type="text" id="fatura-no" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fatura Türü</label>
                            <select id="fatura-tur" onchange="if(window.handleFaturaTurChange) window.handleFaturaTurChange(this.value)" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                                <option value="Genel Gider">Genel Gider (Ofis vb.)</option>
                                <option value="Yakıt">Yakıt (Araç Bazlı)</option>
                                <option value="OGS/HGS">OGS/HGS Geçişi</option>
                                <option value="Sigorta/Kasko">Sigorta/Kasko Ödemesi</option>
                            </select>
                        </div>
                        
                        <!-- DİNAMİK ALANLAR (Litre, İhlal vb.) -->
                        <div id="fatura-dinamik-alanlar" class="hidden bg-black/10 p-4 rounded border border-gray-200 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Açıklama</label>
                            <input type="text" id="fatura-aciklama" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors" placeholder="Örn: Kırtasiye Gideri, Ofis Kirası vb.">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Toplam Tutar (₺)</label>
                            <input type="number" step="0.01" id="fatura-tutar" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dosya/Fatura Linki (Opsiyonel)</label>
                            <input type="text" id="fatura-dosya" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors" placeholder="https://Link.com/fatura.pdf">
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Ödeme Kaydı') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Tedarikçiye yapılan ödemeyi (çek, nakit, havale) kaydederek bakiyesini güncelleyin.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ödeme Yapılan Cari</label>
                            <select id="odeme-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ödeme Tarihi</label>
                                <input type="date" id="odeme-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ödeme Türü</label>
                                <select id="odeme-tur" onchange="if(window.handleOdemeTurChange) window.handleOdemeTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Banka/Havale">Banka / Havale</option>
                                    <option value="Nakit">Nakit</option>
                                    <option value="Çek/Senet">Çek / Senet</option>
                                    <option value="Kredi Kartı">Kredi Kartı</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- DİNAMİK ALANLAR (Çek No, Dekont No vb.) -->
                        <div id="odeme-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tutar (₺)</label>
                            <input type="number" step="0.01" id="odeme-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Açıklama</label>
                            <input type="text" id="odeme-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: X Ayı Taksit Ödemesi">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('odeme-cari', 'cariler', 'id', 'unvan'), 50);
    } else if (title === 'Yeni Teklif Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Sigorta şirketlerinden aldığınız teklifleri tüm poliçe detaylarıyla karşılaştırmak için kaydedin.</p>
                    <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        
                        <!-- 1. TEMEL BİLGİLER -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="file-text" class="w-4 h-4"></i> Genel Bilgiler
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Poliçe Türü *</label>
                                    <div class="flex gap-4">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="teklif_turu" value="Trafik" class="w-4 h-4 text-orange-500 bg-black/30 border-white/20 focus:ring-orange-500" checked>
                                            <span class="text-sm font-semibold text-white">Trafik Sigortası</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="teklif_turu" value="Kasko" class="w-4 h-4 text-orange-500 bg-black/30 border-white/20 focus:ring-orange-500">
                                            <span class="text-sm font-semibold text-white">Kasko</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç Seçimi *</label>
                                    <select id="teklif-arac" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta Firması (Cari) *</label>
                                    <select id="teklif-firma" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Başlangıç Tarihi</label>
                                    <input type="date" id="teklif-baslangic" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Bitiş Tarihi</label>
                                    <input type="date" id="teklif-bitis" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                                </div>
                            </div>
                        </div>

                        <!-- 2. FİNANS VE TAKSİT -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="credit-card" class="w-4 h-4"></i> Ödeme Planı
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Toplam Poliçe Tutarı (₺) *</label>
                                    <input type="number" step="0.01" id="teklif-tutar" class="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 font-bold focus:outline-none focus:border-orange-500 transition-all" placeholder="0.00">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit Sayısı</label>
                                    <select id="teklif-taksit-sayisi" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                        <option value="1">Peşin (Tek Çekim)</option>
                                        <option value="2">2 Taksit</option>
                                        <option value="3">3 Taksit</option>
                                        <option value="4">4 Taksit</option>
                                        <option value="5">5 Taksit</option>
                                        <option value="6">6 Taksit</option>
                                        <option value="9">9 Taksit</option>
                                        <option value="12">12 Taksit</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Aylık Taksit (₺)</label>
                                    <input type="number" step="0.01" id="teklif-taksit-tutar" class="w-full bg-black/30 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-400 font-bold focus:outline-none focus:border-blue-500 transition-all" placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <!-- 3. KAPSAM VE TEMİNATLAR -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="shield-check" class="w-4 h-4"></i> Poliçe Ekstra Teminatları
                            </h3>
                            
                            <div class="space-y-3">
                                <!-- İMM -->
                                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full md:w-auto">
                                        <input type="checkbox" id="teklif-imm" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-200">İhtiyari Mali Mesuliyet (İMM)</span>
                                            <span class="text-[10px] text-gray-500">Karşı tarafa verilecek zararlar</span>
                                        </div>
                                    </label>
                                    <div class="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5 w-full md:w-auto">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">Limit:</span>
                                        <select id="teklif-imm-limit" class="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none w-full min-w-[120px]">
                                            <option value="1.000.000">1 Milyon ₺</option>
                                            <option value="3.000.000" selected>3 Milyon ₺</option>
                                            <option value="5.000.000">5 Milyon ₺</option>
                                            <option value="Limitsiz">Limitsiz</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- İkame Araç -->
                                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full md:w-auto">
                                        <input type="checkbox" id="teklif-ikame" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <span class="text-sm font-bold text-gray-200">İkame Araç Hizmeti</span>
                                    </label>
                                    <div class="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5 w-full md:w-auto">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">Süre:</span>
                                        <select id="teklif-ikame-sure" class="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none w-full min-w-[120px]">
                                            <option value="7 Gün">7 Gün</option>
                                            <option value="15 Gün" selected>15 Gün</option>
                                            <option value="30 Gün">30 Gün</option>
                                            <option value="Sınırsız">Sınırsız</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Orijinal Cam Row -->
                                <div class="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full">
                                        <input type="checkbox" id="teklif-cam" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-200">Orijinal Cam (Muafiyetsiz)</span>
                                            <span class="text-[10px] text-gray-500">Logolu kırılmaz parça değişimi</span>
                                        </div>
                                    </label>
                                </div>
                                
                                <!-- Yol Yardım -->
                                <div class="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full">
                                        <input type="checkbox" id="teklif-yolyardim" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <span class="text-sm font-bold text-gray-200">Genişletilmiş Yol Yardım Paketi</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(async () => {
            loadSelectOptions('teklif-arac', 'araclar', 'id', 'plaka');
            // Sigortacı carilerini yükle
            const firmaSelect = document.getElementById('teklif-firma');
            if (firmaSelect && window.supabaseClient && window.supabaseUrl !== 'YOUR_SUPABASE_URL') {
                const { data: cariler } = await window.supabaseClient
                    .from('cariler')
                    .select('id, unvan, tur')
                    .order('unvan');
                firmaSelect.innerHTML = '<option value="">— Sigorta Firması Seç —</option>';
                const sigortacilar = (cariler || []).filter(c => {
                    const isTurSigorta = c.tur && c.tur.toLowerCase().includes('sigorta');
                    const isAdSigorta = c.unvan && c.unvan.toLowerCase().includes('sigorta');
                    return isTurSigorta || isAdSigorta;
                });
                sigortacilar.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.unvan;
                    firmaSelect.appendChild(opt);
                });
            }
        }, 50);
    } else if (title === 'Yeni Maaş Kaydı') {
        const now = new Date();
        const donem = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        content = `
                    <p class="text-sm text-gray-400 mb-6">Şoför aylık maaş ödemesini kaydedin. Elden tutar banka kesintileri çıkarıldıktan sonra hesaplanır.</p>
                    <div class="space-y-5">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Şoför</label>
                                <select id="maas-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Araç (Plaka)</label>
                                <select id="maas-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Dönem</label>
                                <input type="month" id="maas-donem" value="${donem}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Çalışma Günü</label>
                                <input type="number" id="maas-gun" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0" min="0" max="31">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Net Maaş (₺)</label>
                                <input type="number" step="0.01" id="maas-net" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium text-blue-400 font-bold" placeholder="0.00">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Avans (₺)</label>
                                <input type="number" step="0.01" id="maas-avans" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Ceza (₺)</label>
                                <input type="number" step="0.01" id="maas-ceza" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Haciz (₺)</label>
                                <input type="number" step="0.01" id="maas-haciz" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">M.K Banka (₺)</label>
                                <input type="number" step="0.01" id="maas-mk-banka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-green-400 uppercase tracking-widest mb-2">İDEOL Banka (₺)</label>
                            <input type="number" step="0.01" id="maas-ideol-banka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Açıklama</label>
                            <input type="text" id="maas-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="Opsiyonel açıklama...">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('maas-sofor', 'soforler', 'id', 'ad_soyad');
            loadSelectOptions('maas-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Cari Güncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-cari-id" value="">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unvan / Firma Adı</label>
                            <input type="text" id="edit-cari-unvan" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Türü</label>
                                <select id="edit-cari-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Tedarikçi">Tedarikçi</option>
                                    <option value="Tamirci">Tamirci / Servis</option>
                                    <option value="Sigorta Acentesi">Sigorta Acentesi</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İletişim No</label>
                                <input type="text" id="edit-cari-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Müşteri Güncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-musteri-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Müşteri/Firma Adı</label>
                                <input type="text" id="edit-musteri-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vergi No / TC</label>
                                <input type="text" id="edit-musteri-vergi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Yetkili Kişi</label>
                                <input type="text" id="edit-musteri-yetkili" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="edit-musteri-tel" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Adres</label>
                            <textarea id="edit-musteri-adres" rows="2" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></textarea>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vade (Gün)</label>
                                <input type="number" id="edit-musteri-vade" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Logo/Evrak URL</label>
                                <input type="text" id="edit-musteri-logo" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Araç Güncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-arac-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Plaka</label>
                                <input type="text" id="edit-arac-plaka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium uppercase">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Çalıştığı Şirket</label>
                                <select id="edit-arac-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Belirtilmemiş">Belirtilmemiş</option>
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="DİKKAN">DİKKAN</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Marka & Model</label>
                                <input type="text" id="edit-arac-marka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Firma / Araç Sahibi</label>
                                <input type="text" id="edit-arac-firma" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Taşeron / Bireysel İsim">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Mülkiyet Durumu</label>
                                <select id="edit-arac-mulkiyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="ÖZMAL">ÖZMAL</option>
                                    <option value="TAŞERON">TAŞERON</option>
                                    <option value="KİRALIK">KİRALIK</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge Türü</label>
                                <select id="edit-arac-belge" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Yok">Yok</option>
                                    <option value="D2">D2 Belgesi</option>
                                    <option value="D4S">D4S Belgesi</option>
                                    <option value="U-ETDS">U-ETDS Sistemi</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Kredi Kartı') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Şirket kredi kartını hesap takibi için sisteme kaydediniz.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Adı / Banka</label>
                                <input type="text" id="kredi-kart-adi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: Garanti Bonus">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Sahibi / Şirket</label>
                                <input type="text" id="kredi-kart-sahibi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: IDEOL A.Ş.">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Numarası (Son 4 Hane vs)</label>
                                <input type="text" id="kredi-kart-no" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: **** 1234">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Limiti (₺)</label>
                                <input type="number" step="0.01" id="kredi-kart-limit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Kart İşlemi') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Kredi kartınızla yaptığınız harcama ve taksit planını kaydediniz.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşlem Yapılan Kart</label>
                            <select id="kredi-kart-secim" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">İşlem Tarihi</label>
                                <input type="date" id="kart-islem-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit Sayısı</label>
                                <select id="kart-islem-taksit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="1">Tek Çekim</option>
                                    <option value="2">2 Taksit</option>
                                    <option value="3">3 Taksit</option>
                                    <option value="4">4 Taksit</option>
                                    <option value="5">5 Taksit</option>
                                    <option value="6">6 Taksit</option>
                                    <option value="9">9 Taksit</option>
                                    <option value="12">12 Taksit</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Açıklama / Kurum</label>
                            <input type="text" id="kart-islem-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Örn: Araç Kaskosu">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Harcama (₺)</label>
                            <input type="number" step="0.01" id="kart-islem-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium text-orange-400 font-bold" placeholder="0.00">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('kredi-kart-secim', 'kredi_kartlari', 'id', 'kart_adi'), 50);
    } else if (title === 'Yeni Evrak Ekle') {
        if (typeof window.getEvrakFormHTML === 'function') {
            window.getEvrakFormHTML().then(html => {
                dynamicBody.innerHTML = html;
                modal.classList.remove('hidden');
            });
            return; // Since it's async, we handle render inside and return early
        } else {
            content = '<p class="text-red-500 text-sm">Evrak modülü yüklenemedi.</p>';
        }
    } else if (title === 'Yeni İş Emri') {
        if (typeof window.getIsEmriFormHTML === 'function') {
            window.getIsEmriFormHTML().then(html => {
                dynamicBody.innerHTML = html;
                modal.classList.remove('hidden');
                if (window.lucide) window.lucide.createIcons();
            });
            return;
        } else {
            content = '<p class="text-red-500 text-sm">İş emirleri modülü yüklenemedi.</p>';
        }
    } else if (title === 'Yeni Araç Çıkış Formu') {
        if (typeof window.getChecklistFormHTML === 'function') {
            window.getChecklistFormHTML().then(html => {
                dynamicBody.innerHTML = html;
                modal.classList.remove('hidden');
            });
            return;
        } else {
            content = '<p class="text-red-500 text-sm">Checklist modülü yüklenemedi.</p>';
        }
    }

    dynamicBody.innerHTML = content;
    modal.classList.remove('hidden');

    // Pre-fill fields if ID or EXTRA provided
    if (title === 'Yeni Puantaj Gir' && id) {
        setTimeout(() => {
            const selectSofor = document.getElementById('puantaj-sofor');
            const inputTarih = document.getElementById('puantaj-tarih');
            if (selectSofor) selectSofor.value = id;
            if (inputTarih && extra) inputTarih.value = extra;
        }, 100);
    }

    if (title === 'Yeni Teklif Ekle') {
        setTimeout(async () => {
            const sel = document.getElementById('teklif-arac');
            if (!sel || window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
            const { data } = await window.supabaseClient.from('araclar').select('id, plaka').order('plaka');
            sel.innerHTML = '<option value="">Araç Seçin...</option>';
            (data || []).forEach(a => {
                const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.plaka; sel.appendChild(opt);
            });
        }, 100);
    }

    if (id) {
        setTimeout(() => {
            if (title === 'Araç Şoför Ata') {
                document.getElementById('atama-arac-id').value = id;
            } else if (title === 'Araç Evrak Güncelle') {
                document.getElementById('evrak-arac-id').value = id;
                window.supabaseClient.from('araclar').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('evrak-vize').value = data.vize_bitis || '';
                        document.getElementById('evrak-vize-url').value = data.vize_dosya_url || '';
                        document.getElementById('evrak-sigorta').value = data.sigorta_bitis || '';
                        document.getElementById('evrak-sigorta-url').value = data.sigorta_dosya_url || '';
                        document.getElementById('evrak-kasko').value = data.kasko_bitis || '';
                        document.getElementById('evrak-kasko-url').value = data.kasko_dosya_url || '';
                    }
                });
            } else if (title === 'Yeni Fatura Kaydı') {
                document.getElementById('fatura-cari-id').value = id;
            } else if (title === 'Yeni Poliçe Kaydı') {
                // Araç plakasını otomatik seç (dropdown yüklendikten sonra)
                setTimeout(() => {
                    const policeArac = document.getElementById('police-arac');
                    if (policeArac) policeArac.value = id;
                }, 200);
            } else if (title === 'Şoför Güncelle') {
                const sId = id;
                window.supabaseClient.from('soforler').select('*').eq('id', sId).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-sofor-id').value = data.id;
                        document.getElementById('edit-sofor-ad').value = data.ad_soyad;
                        document.getElementById('edit-sofor-tc').value = data.tc_no || '';
                        document.getElementById('edit-sofor-dogum').value = data.dogum_tarihi || '';
                        document.getElementById('edit-sofor-telefon').value = data.telefon || '';
                        document.getElementById('edit-sofor-ehliyet').value = data.ehliyet_sinifi || '';
                        document.getElementById('edit-sofor-src').value = data.src_belgesi || 'Yok';
                        document.getElementById('edit-sofor-belge-url').value = data.belge_url || '';
                        document.getElementById('edit-sofor-aylik-maas').value = data.aylik_maas || 0;
                        document.getElementById('edit-sofor-ucret').value = data.gunluk_ucret || 0;
                        document.getElementById('edit-sofor-sigorta').value = data.sigorta_durumu || 'SGK';
                        document.getElementById('edit-sofor-ise-baslama').value = data.ise_baslama_tarihi || '';
                        document.getElementById('edit-sofor-sirket').value = data.sirket || 'IDEOL';
                    }
                });
            } else if (title === 'Cari Güncelle') {
                window.supabaseClient.from('cariler').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-cari-id').value = data.id;
                        document.getElementById('edit-cari-unvan').value = data.unvan || '';
                        document.getElementById('edit-cari-tur').value = data.tur || 'Tedarikçi';
                        document.getElementById('edit-cari-telefon').value = data.telefon || '';
                    }
                });
            } else if (title === 'Müşteri Güncelle') {
                window.supabaseClient.from('musteriler').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-musteri-id').value = data.id;
                        document.getElementById('edit-musteri-ad').value = data.ad || '';
                        document.getElementById('edit-musteri-vergi').value = data.vergi_no || '';
                        document.getElementById('edit-musteri-yetkili').value = data.yetkili_kisi || '';
                        document.getElementById('edit-musteri-tel').value = data.telefon || '';
                        document.getElementById('edit-musteri-adres').value = data.adres || '';
                        document.getElementById('edit-musteri-vade').value = data.vade_gun || 30;
                        document.getElementById('edit-musteri-logo').value = data.logo_url || '';
                    }
                });
            } else if (title === 'Poliçe Düzenle') {
                window.supabaseClient.from('arac_policeler').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-police-id').value = data.id;
                        document.getElementById('edit-police-baslangic').value = data.baslangic_tarihi || '';
                        document.getElementById('edit-police-bitis').value = data.bitis_tarihi || '';
                        document.getElementById('edit-police-tutar').value = data.toplam_tutar || 0;
                        document.getElementById('edit-police-taksit').value = data.taksit_sayisi || 1;
                        document.getElementById('edit-police-aciklama').value = data.aciklama || '';
                    }
                });
            } else if (title === 'Araç Güncelle') {
                window.supabaseClient.from('araclar').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-arac-id').value = data.id;
                        document.getElementById('edit-arac-plaka').value = data.plaka || '';
                        document.getElementById('edit-arac-marka').value = data.marka_model || '';
                        document.getElementById('edit-arac-mulkiyet').value = data.mulkiyet_durumu || 'ÖZMAL';
                        document.getElementById('edit-arac-sirket').value = data.sirket || 'Belirtilmemiş';
                        const firmaInput = document.getElementById('edit-arac-firma');
                        if(firmaInput) firmaInput.value = data.firma_adi || '';
                    }
                });
            }
        }, 10);
    }
}
// filterCol: sütun adı, filterVals: string[] — birden fazla değerle in() filtresi uygular
async function loadSelectOptions(selectId, table, valueField, textField, filterCol = null, filterVals = null) {
    const sel = document.getElementById(selectId);
    if (!sel || window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
    let query = window.supabaseClient.from(table).select('*').order(textField, { ascending: true });
    if (filterCol && filterVals && filterVals.length > 0) {
        query = query.in(filterCol, filterVals);
    }
    const { data, error } = await query;
    if (error) { console.error(error); return; }
    sel.innerHTML = '<option value="">Seçiniz...</option>';
    data.forEach(item => {
        sel.innerHTML += `<option value="${item[valueField]}">${item[textField]}</option>`;
    });
}
window.closeModal = function () {
    modal.classList.add('hidden');
}

// Özel Onay Modalı Fonksiyonu
window.showConfirm = function (message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!modal || !msgEl || !confirmBtn || !cancelBtn) {
        // Modal yoksa native confirm'e düş
        if (confirm(message)) onConfirm();
        return;
    }

    msgEl.innerText = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const handleOk = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        confirmBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        onConfirm();
    };

    const handleCancel = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        confirmBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);

    };

    confirmBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
}
// === DARK MODE ===
function applyTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon-dark').classList.remove('hidden');
        document.getElementById('theme-icon-light').classList.add('hidden');
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-icon-dark').classList.add('hidden');
        document.getElementById('theme-icon-light').classList.remove('hidden');
    }
}

window.toggleDarkMode = function () {
    const isDark = !document.documentElement.classList.contains('dark');
    localStorage.setItem('ideol-theme', isDark ? 'dark' : 'light');
    applyTheme(isDark);
};

window.addEventListener('DOMContentLoaded', () => {
    // Tema tercihi
    const saved = localStorage.getItem('ideol-theme');
    const prefDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefDark);

    const searchInput = document.getElementById('top-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const activeModule = document.querySelector('.main-module.block');
            if (!activeModule) return;

            const rows = activeModule.querySelectorAll('tbody tr, div[id*="-grid"] > div');
            rows.forEach(row => {
                const text = row.innerText.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        });
    }

    const monthInput = document.getElementById('excel-ay-sec');
    if (monthInput) monthInput.value = new Date().toISOString().slice(0, 7);

    fetchDashboard();
    fetchAraclar();
    fetchSoforler();
    fetchSoforPuantaj();
    fetchSoforFinans();
    fetchSoforMaaslar();
    fetchFinansDashboard();
    fetchTaseronFinans();
    fetchMusteriler();
    fetchMusteriServis();
    fetchCariler();
    fetchBakimlar();
    fetchPoliceler();
    if (typeof fetchYakitlar === 'function') fetchYakitlar();
    if (typeof fetchRaporlar === 'function') fetchRaporlar();
});
async function fetchDashboard() {
    if (window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
    try {
        // Paralel sorgular
        const [
            { count: aracCount },
            { count: soforCount },
            { count: cariCount },
            { data: araclar }
        ] = await Promise.all([
            window.supabaseClient.from('araclar').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('soforler').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('cariler').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('araclar').select('vize_bitis, sigorta_bitis, kasko_bitis')
        ]);

        // KPI: Araç sayısı
        const elArac = document.getElementById('kpi-arac');
        if (elArac) elArac.textContent = aracCount ?? '—';

        // KPI: Şoför sayısı
        const elSofor = document.getElementById('kpi-sofor');
        if (elSofor) elSofor.textContent = soforCount ?? '—';

        // KPI: Cari hesap sayısı
        const elCari = document.getElementById('kpi-cari');
        if (elCari) elCari.textContent = cariCount ?? '—';

        // KPI: 15 gün içinde süresi dolacak evraklar
        if (araclar) {
            const today = new Date();
            const sooner = new Date(today);
            sooner.setDate(sooner.getDate() + 15);
            let uyariSayisi = 0;
            araclar.forEach(a => {
                ['vize_bitis', 'sigorta_bitis', 'kasko_bitis'].forEach(field => {
                    if (a[field]) {
                        const d = new Date(a[field]);
                        if (d <= sooner) uyariSayisi++;
                    }
                });
            });
            const elEvrak = document.getElementById('kpi-evrak');
            if (elEvrak) elEvrak.textContent = uyariSayisi;
        }
    } catch (e) {
        console.error('Dashboard fetch hatası:', e);
    }
}

// DİNAMİK FORM ALANLARI YÖNETİMİ
window.handleOdemeTurChange = function (tur) {
    const container = document.getElementById('odeme-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'Çek/Senet') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Çek/Senet No</label>
                    <input type="text" id="odeme-cek-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="12345678">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vade Tarihi</label>
                    <input type="date" id="odeme-vade" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Banka/Havale') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dekont / İşlem Referans No</label>
                <input type="text" id="odeme-dekont-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="TR123...">
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Kredi Kartı') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kart Son 4 Hanesi / Slip No</label>
                    <input type="text" id="odeme-kart-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="**** 1234">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fiş/Fatura Alındı mı?</label>
                    <div class="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="odeme-fis-kart" class="w-4 h-4 text-green-500 bg-black/30 border-white/20 rounded focus:ring-green-500">
                        <input type="text" id="odeme-fis-no-kart" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Fiş/Fatura No">
                    </div>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Nakit') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Fiş / Fatura Alındı mı?</label>
                <div class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="odeme-fis-nakit" class="w-4 h-4 text-green-500 bg-black/30 border-white/20 rounded focus:ring-green-500">
                    <input type="text" id="odeme-fis-no-nakit" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Fiş/Fatura No (Opsiyonel)">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

window.handleBakimTurChange = function (tur) {
    const container = document.getElementById('bakim-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'Yedek Parça') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Parça Adı / Kodu</label>
                    <input type="text" id="bakim-parca-adi" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Örn: Yağ Filtresi 01H">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Adet</label>
                    <input type="number" id="bakim-parca-adet" value="1" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Hasar Onarım') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hasar / Sigorta Dosya No</label>
                <input type="text" id="bakim-dosya-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Sigorta Şirketi Hasar Dosya No">
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

window.handleCariTurChange = function (tur) {
    const container = document.getElementById('cari-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'Tamirci') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Servis Yetki Belge No</label>
                    <input type="text" id="cari-tamirci-belge" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="TSE1234...">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Uzmanlık Alanı</label>
                    <input type="text" id="cari-tamirci-uzmanlik" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Mekanik, Elektrik, Boya...">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Sigorta Acentesi') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Acente Levha / Sicil No</label>
                <input type="text" id="cari-sigorta-levha" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="T000123...">
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Tedarikçi') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tedarik Grubu</label>
                <input type="text" id="cari-tedarikci-grup" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Örn: Lastik, Filtre, Yağ...">
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

window.handleFaturaTurChange = function (tur) {
    const container = document.getElementById('fatura-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'Yakıt') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Alınan Litre</label>
                    <input type="number" step="0.01" id="fatura-yakit-litre" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="0.00 L">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plaka (İsteğe Bağlı)</label>
                    <input type="text" id="fatura-yakit-plaka" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="34 ABC 123">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'OGS/HGS') {
        container.innerHTML = `
            <div class="flex items-center gap-4 mb-3 mt-1">
                <input type="checkbox" id="fatura-ogs-ihlal" class="w-4 h-4 text-danger bg-white border-gray-300 rounded focus:ring-danger">
                <label for="fatura-ogs-ihlal" class="text-sm font-semibold text-gray-600">İhlalli Geçiş mi?</label>
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Geçiş Yapılan Güzergah/Köprü</label>
                <input type="text" id="fatura-ogs-guzergah" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="Örn: FSM, Avrasya, Anadolu Otoyolu...">
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Genel Gider') {
        container.innerHTML = `
            <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Gider/Evrak Referans No</label>
                <input type="text" id="fatura-genel-ref" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="OF12B...">
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};

window.handleFinansTurChange = function (tur) {
    const container = document.getElementById('finans-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'AVANS') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Geri Ödeme Şekli</label>
                <select id="finans-avans-odeme" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                    <option value="Maaştan Kesilecek">Maaştan Kesilecek</option>
                    <option value="Elden Ödenecek">Ay İçi Elden Ödenecek</option>
                    <option value="Primden Karşılanacak">Primden Karşılanacak</option>
                </select>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'KESİNTİ (Ceza/Hasar)') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kesinti Sebebi</label>
                    <select id="finans-kesinti-sebep" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                        <option value="Trafik Cezası">Trafik Cezası</option>
                        <option value="Araç Hasarı">Araç Hasarı / Kaza</option>
                        <option value="Diğer Kesinti">Diğer (İhlal, Kayıp Parça)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ceza / Tutanak No</label>
                    <input type="text" id="finans-kesinti-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="MA123456...">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'PRİM/HARCIRAH') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">İlgili Hak Ediş Dönemi (Ay/Yıl)</label>
                <input type="month" id="finans-prim-donem" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
};
/* === PRINT FUNCTIONS === */
window.printTaseronRapor = function () {
    const month = document.getElementById('filter-taseron-rapor-ay')?.value || '';
    const tableHtml = document.querySelector('#content-taseron-rapor .overflow-x-auto').innerHTML;

    const win = window.open('', '', 'height=700,width=900');
    win.document.write(`
        <html>
            <head>
                <title>Taşeron Ay Sonu Raporu - ${month}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #111; }
                    .header-container { position: relative; margin-bottom: 25px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                    .header-title { text-align: center; }
                    .header-title h1 { margin: 0; font-size: 1.5rem; color: #111; }
                    .header-title p { margin: 5px 0 0; color: #444; }
                    .ideol-logo { position: absolute; top: 0; right: 0; font-size: 1.25rem; font-weight: 900; color: #ea580c; font-style: italic; letter-spacing: 1.5px; border-bottom: 2px solid #ea580c; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                    th { background-color: #f8fafc; color: #111; font-weight: bold; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .text-orange-400 { color: #ea580c !important; font-weight: bold; }
                    .text-red-500 { color: #dc2626 !important; font-weight: bold; }
                    .text-green-400 { color: #16a34a !important; font-weight: bold; }
                    tfoot { font-weight: bold; background: #f1f5f9; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="ideol-logo">IDEOL TURİZM</div>
                    <div class="header-title">
                        <h1>Taşeron Ay Sonu Hesap Özeti</h1>
                        <p>Dönem: ${month}</p>
                    </div>
                </div>
                ${tableHtml}
            </body>
        </html>
    `);
    win.document.close();
    win.setTimeout(() => { win.print(); win.close(); }, 500);
};

window.printCariKart = function(plaka, month) {
    const overlay = document.getElementById('cari-kart-modal-overlay');
    if (!overlay) return;

    // We collect the clean data to print
    const rows = overlay.querySelectorAll('.musteri-calc-row');
    let detailRowsHtml = '';
    rows.forEach(row => {
        const title = row.querySelector('.text-sm.font-bold.text-white')?.innerText || '';
        const vdAdet = row.querySelector('.text-\\[10px\\].text-orange-400')?.innerText || '';
        const tkAdet = row.querySelectorAll('.text-\\[10px\\].text-blue-400')[0]?.innerText || '';
        
        const vdFiyat = row.querySelector('.calc-vardiya-fiyat')?.value || '0';
        const tkFiyat = row.querySelector('.calc-tek-fiyat')?.value || '0';
        const kdvOran = row.querySelector('.calc-kdv-oran')?.value || '0';
        const tevOran = row.querySelector('.calc-tev-oran')?.value || '0';
        
        const rowBrut = row.querySelector('.row-brut-tutar')?.innerText || '₺0,00';
        const rowKdv = row.querySelector('.row-kdv-tutar')?.innerText || '+₺0,00';
        const rowTev = row.querySelector('.row-tev-tutar')?.innerText || '-₺0,00';

        detailRowsHtml += `
            <div class="calc-section">
                <h3>${title}</h3>
                <table class="detail-table">
                    <tr>
                        <th>Vardiya Sefer (${vdAdet})</th>
                        <th>Tek Sefer (${tkAdet})</th>
                        <th>KDV %</th>
                        <th>TEV %</th>
                    </tr>
                    <tr>
                        <td>₺${vdFiyat}</td>
                        <td>₺${tkFiyat}</td>
                        <td>%${kdvOran}</td>
                        <td>%${tevOran}</td>
                    </tr>
                </table>
                <div class="row-totals">
                    <p>Brüt Tutar: <strong>${rowBrut}</strong></p>
                    <p class="text-green-400">+ KDV (%${kdvOran}): <strong>${rowKdv}</strong></p>
                    <p class="text-red-500">- TEV (%${tevOran}): <strong>${rowTev}</strong></p>
                </div>
            </div>
        `;
    });

    const netTotal = overlay.querySelector('#modal-net-total')?.innerText || '₺0,00';
    const brutTotal = overlay.querySelector('#modal-brut-total')?.innerText || '₺0,00';
    const kdvTotal = overlay.querySelector('#modal-kdv-total')?.innerText || '+₺0,00';
    const tevTotal = overlay.querySelector('#modal-tev-total')?.innerText || '-₺0,00';
    
    const yakitTotalVal = overlay.querySelector('#modal-yakit-total')?.innerText || '-₺0,00';
    
    // YAKIT ROWS
    let yakitHtml = '<p style="color:#666; font-size:12px; margin-top:5px;">Hiç yakıt alımı bulunmuyor.</p>';
    const yakitDivs = overlay.querySelectorAll('.max-h-48 > div');
    if (yakitDivs.length > 0) {
        yakitHtml = '<table class="yakit-table"><tr><th>Tarih</th><th>Açıklama</th><th class="text-right">Tutar</th></tr>';
        yakitDivs.forEach(yd => {
            const tarih = yd.querySelector('.text-xs.font-bold')?.innerText || '';
            const desc = yd.querySelector('.text-\\[10px\\].text-gray-400') ? yd.querySelector('.text-\\[10px\\].text-gray-400').innerText : '';
            const val = yd.querySelector('.text-sm.font-black.text-orange-400')?.innerText || '';
            yakitHtml += `<tr><td>${tarih}</td><td>${desc}</td><td class="text-right text-orange-400 font-bold">${val}</td></tr>`;
        });
        yakitHtml += '</table>';
    }

    const win = window.open('', '', 'height=800,width=900');
    win.document.write(`
        <html>
            <head>
                <title>Cari Hesap Dökümü - ${plaka}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #111; line-height: 1.4; }
                    .header-container { position: relative; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
                    .header-title { text-align: center; }
                    .header-title h1 { margin: 0; font-size: 1.5rem; color: #111; }
                    .header-title p { margin: 5px 0 0; color: #444; }
                    .ideol-logo { position: absolute; top: 0; right: 0; font-size: 1.25rem; font-weight: 900; color: #ea580c; font-style: italic; letter-spacing: 1.5px; border-bottom: 2px solid #ea580c; }
                    
                    .section-title { font-size: 14px; font-weight: bold; color: #555; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 25px; margin-bottom: 10px; }
                    .calc-section { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 15px; background: #fafafa; }
                    .calc-section h3 { margin: 0 0 10px 0; font-size: 15px; color: #333; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
                    
                    .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
                    .detail-table th, .detail-table td { border: 1px solid #cbd5e1; padding: 6px; text-align: center; }
                    .detail-table th { background: #f1f5f9; color: #475569; font-weight: bold; }
                    .row-totals { text-align: right; font-size: 13px; line-height: 1.6; }
                    .row-totals p { margin: 2px 0; }
                    
                    .yakit-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 5px; }
                    .yakit-table th, .yakit-table td { border-bottom: 1px solid #eee; padding: 6px 4px; text-align: left; }
                    .yakit-table th { color: #64748b; font-weight: bold; }
                    
                    .grand-totals { margin-top: 30px; border-top: 2px solid #111; padding-top: 15px; float: right; width: 350px; }
                    .grand-totals div { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                    .net-hakedis { font-size: 20px !important; font-weight: 900; color: #16a34a; border-top: 1px dashed #ccc; padding-top: 10px; margin-top: 10px; }
                    
                    .text-right { text-align: right; }
                    .text-orange-400 { color: #ea580c; }
                    .text-red-500 { color: #dc2626; }
                    .text-green-400 { color: #16a34a; }
                    .clearfix::after { content: ""; clear: both; display: table; }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <div class="ideol-logo">IDEOL TURİZM</div>
                    <div class="header-title">
                        <h1>Cari Kart: ${plaka}</h1>
                        <p>${month} Dönemi Servis ve Yakıt Hesap Dökümü</p>
                    </div>
                </div>
                
                <div class="section-title">Hizmet Fiyatlandırma</div>
                ${detailRowsHtml}
                
                <div class="section-title">Yakıt Kesintileri</div>
                ${yakitHtml}
                
                <div class="grand-totals">
                    <div><span>Toplam Brüt Kazanç</span> <strong>${brutTotal}</strong></div>
                    <div class="text-green-400"><span>+ Toplam KDV</span> <strong>${kdvTotal}</strong></div>
                    <div class="text-red-500"><span>- Toplam TEV (Stopaj)</span> <strong>${tevTotal}</strong></div>
                    <div class="text-orange-400"><span>- Toplam Yakıt Kesintisi</span> <strong>${yakitTotalVal}</strong></div>
                    <div class="net-hakedis"><span>NET HAKEDİŞ</span> <span>${netTotal}</span></div>
                </div>
                <div class="clearfix"></div>
            </body>
        </html>
    `);
    win.document.close();
    win.setTimeout(() => { win.print(); win.close(); }, 500);
};


/* === 9. HARİTA & ROTA MANTIĞI === */
window.mainMap = null;
let mapMarkers = [];

window.initMap = async function () {


    // Harita konteynerinin görünür olduğundan emin olalım
    const mapContainer = document.getElementById('factory-map');
    if (!mapContainer) {
        console.error("[MAP] factory-map konteyneri bulunamadı!");
        return;
    }

    // Harita boyutlarını Leaflet'e tekrar hesaplattıralım (Hidden modülden çıktığı için)
    if (!window.mainMap) {
        // İlk kez oluşturuluyor
        window.mainMap = L.map('factory-map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([39.9334, 32.8597], 6); // Türkiye merkezi

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mainMap);

        // İlk yüklemede boyut hatasını önlemek için
        setTimeout(() => mainMap.invalidateSize(), 300);
    } else {
        // Zaten varsa sadece boyutu düzelt ve merkezle
        setTimeout(() => {
            mainMap.invalidateSize();
        }, 100);
    }

    // Mevcut markerları temizle
    mapMarkers.forEach(m => mainMap.removeLayer(m));
    mapMarkers = [];

    try {
        const { data: musteriler, error } = await window.supabaseClient.from('musteriler').select('*');
        if (error) throw error;

        if (!musteriler || musteriler.length === 0) return;

        musteriler.forEach(m => {
            // Demo amaçlı koordinat simülasyonu
            const lat = m.lat || (39.5 + (Math.random() - 0.5) * 5);
            const lng = m.lng || (32.0 + (Math.random() - 0.5) * 8);

            const marker = L.marker([lat, lng]).addTo(mainMap);
            marker.bindPopup(`
                <div class="p-2 min-w-[150px]">
                    <h4 class="font-bold text-orange-500 mb-1 leading-tight">${m.unvan}</h4>
                    <p class="text-[10px] text-gray-500 mb-3 uppercase tracking-wider">${m.sehir || 'Şehir Belirtilmemiş'}</p>
                    <p class="text-xs text-gray-400 mb-4 line-clamp-2">${m.adres || 'Adres bilgisi yok'}</p>
                    <button onclick="window.showRoute([${lat}, ${lng}])" 
                        class="w-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] py-2 rounded-lg font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                        <i data-lucide="navigation" class="w-3 h-3"></i> Rota Çiz
                    </button>
                </div>
            `);
            mapMarkers.push(marker);
        });

        // Haritayı markerlara göre sığdır
        if (mapMarkers.length > 0) {
            const group = new L.featureGroup(mapMarkers);
            mainMap.fitBounds(group.getBounds().pad(0.1));
        }

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Harita yükleme hatası:", e);
    }
};

window.showRoute = function (destCoords) {
    const startCoords = [41.0082, 28.9784]; // Örn: Merkez (İstanbul)

    if (window.currentRouteLine) mainMap.removeLayer(window.currentRouteLine);

    window.currentRouteLine = L.polyline([startCoords, destCoords], {
        color: '#f97316',
        weight: 4,
        dashArray: '10, 15',
        lineCap: 'round',
        opacity: 0.8
    }).addTo(mainMap);

    mainMap.fitBounds(window.currentRouteLine.getBounds().pad(0.3));

    L.popup()
        .setLatLng(destCoords)
        .setContent('<div class="text-xs font-bold text-orange-500 p-1">Rota Planlandı!</div>')
        .openOn(window.mainMap);
};

window.handleOdemeTuruChange = function (value, prefix) {
    const ccContainer = document.getElementById(`${prefix}-kredi-karti-container`);
    const cariContainer = document.getElementById(`${prefix}-cari-hesap-container`);

    if (ccContainer) ccContainer.classList.toggle('hidden', value !== 'KREDİ KARTI');
    if (cariContainer) cariContainer.classList.toggle('hidden', value !== 'CARİ HESABI');
};

window.filterAraclar = function (filter) {
    // Tüm filtre butonlarını sıfırla
    ['hepsi', 'ozmal', 'taseron', 'kiralik', 'd2', 'd4s', 'ideol', 'mk', 'dikkan'].forEach(key => {
        const btn = document.getElementById(`filter-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'bg-emerald-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
            // Orijinal renkleri geri ver
            if (key === 'd2') btn.classList.add('text-blue-400');
            else if (key === 'd4s') btn.classList.add('text-purple-400');
            else if (key === 'ideol') btn.classList.add('text-orange-400');
            else if (key === 'dikkan') btn.classList.add('text-emerald-400');
            else if (key === 'mk') btn.classList.add('text-red-400');
            else btn.classList.add('text-gray-400');
        }
    });

    // Aktif olanı vurgula
    const keyMap = { 'hepsi': 'hepsi', 'ÖZMAL': 'ozmal', 'TAŞERON': 'taseron', 'KİRALIK': 'kiralik', 'D2': 'd2', 'D4S': 'd4s' };
    const activeKey = keyMap[filter] || 'hepsi';
    const activeBtn = document.getElementById(`filter-btn-${activeKey}`);
    if (activeBtn) {
        if (activeKey === 'd2') {
            activeBtn.classList.add('bg-blue-500', 'text-white');
            activeBtn.classList.remove('text-blue-400', 'hover:bg-white/10', 'hover:bg-blue-500/20');
        } else if (activeKey === 'd4s') {
            activeBtn.classList.add('bg-purple-500', 'text-white');
            activeBtn.classList.remove('text-purple-400', 'hover:bg-white/10', 'hover:bg-purple-500/20');
        } else {
            activeBtn.classList.add('bg-orange-500', 'text-white');
            activeBtn.classList.remove('text-gray-400', 'hover:bg-white/10');
        }
    }
    // Veriyi çek
    if (typeof fetchAraclar === 'function') fetchAraclar(filter, 'hepsi');
};

window.filterAraclarBySirket = function (sirket) {
    // Tüm araç filtrelerini temizle
    ['hepsi', 'ozmal', 'taseron', 'kiralik', 'd2', 'd4s', 'ideol', 'mk', 'dikkan'].forEach(key => {
        const btn = document.getElementById(`filter-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'bg-emerald-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
        }
    });

    const activeKey = sirket === 'IDEOL' ? 'ideol' : (sirket === 'DİKKAN' ? 'dikkan' : (sirket === 'M.K.' ? 'mk' : 'hepsi'));
    const btn = document.getElementById(`filter-btn-${activeKey}`);
    if (btn) {
        btn.classList.add(sirket === 'IDEOL' ? 'bg-orange-500' : (sirket === 'DİKKAN' ? 'bg-emerald-500' : 'bg-red-500'), 'text-white');
        btn.classList.remove('hover:bg-white/10');
    }

    if (typeof fetchAraclar === 'function') fetchAraclar('hepsi', sirket);
};

window.filterSoforler = function (sirket) {
    ['hepsi', 'ideol', 'mk', 'dikkan'].forEach(key => {
        const btn = document.getElementById(`filter-sofor-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-emerald-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
        }
    });

    const activeKey = sirket === 'IDEOL' ? 'ideol' : (sirket === 'DİKKAN' ? 'dikkan' : (sirket === 'M.K.' ? 'mk' : 'hepsi'));
    const btn = document.getElementById(`filter-sofor-btn-${activeKey}`);
    if (btn) {
        const bgClass = sirket === 'IDEOL' ? 'bg-orange-500' : (sirket === 'DİKKAN' ? 'bg-emerald-500' : (sirket === 'M.K.' ? 'bg-red-500' : 'bg-blue-500'));
        btn.classList.add(bgClass, 'text-white');
        btn.classList.remove('hover:bg-white/10');
    }

    if (typeof fetchSoforler === 'function') fetchSoforler(sirket);
};

window.toggleViewMode = function (module, mode, colorClass) {
    const gridBtn = document.getElementById(`btn-${module}-grid`);
    const listBtn = document.getElementById(`btn-${module}-list`);
    const gridContainer = document.getElementById(`${module}-cards-grid`);
    const listContainer = document.getElementById(`${module}-list-container`);

    if (!gridContainer || !listContainer) return;

    if (mode === 'grid') {
        gridBtn.classList.add(colorClass, 'text-white');
        gridBtn.classList.remove('bg-white/5', 'text-gray-400', 'hover:bg-white/10');
        listBtn.classList.add('bg-white/5', 'text-gray-400', 'hover:bg-white/10');
        listBtn.classList.remove(colorClass, 'text-white');

        gridContainer.classList.remove('hidden');
        listContainer.classList.add('hidden');
    } else {
        listBtn.classList.add(colorClass, 'text-white');
        listBtn.classList.remove('bg-white/5', 'text-gray-400', 'hover:bg-white/10');
        gridBtn.classList.add('bg-white/5', 'text-gray-400', 'hover:bg-white/10');
        gridBtn.classList.remove(colorClass, 'text-white');

        listContainer.classList.remove('hidden');
        gridContainer.classList.add('hidden');
    }
};
