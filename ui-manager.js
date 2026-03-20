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

    // Timeout ile engel kontrolÃ¼
    const timer = setTimeout(() => checkFrameBlocked(iframe, url), 4000);

    iframe.onload = function () {
        clearTimeout(timer);
        loading.style.display = 'none';
        try {
            // Cross-origin eriÅŸimi dene
            const _ = iframe.contentWindow.location.href;
            iframe.style.display = 'block';
        } catch (e) {
            // Cross-origin ama yÃ¼klendi = muhtemelen iframe izin verdi
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
        // cross-origin = normal, iframe yÃ¼klendi
    }
}
function showGpsBlocked() {
    document.getElementById('gps-loading').style.display = 'none';
    document.getElementById('gps-iframe').style.display = 'none';
    const b = document.getElementById('gps-blocked');
    b.style.display = 'flex';
}
/* === 1. ANA NAVÄ°GASYON (SÄ°DEBAR) MANTIÄžI === */
const navButtons = document.querySelectorAll('#main-nav-buttons button');
const modules = document.querySelectorAll('.main-module');
const pageTitle = document.getElementById('page-title');

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const moduleName = btn.innerText.trim();

        // Active button class sÄ±fÄ±rla
        navButtons.forEach(b => b.classList.remove('active'));

        // TÄ±klananÄ± aktif yap
        btn.classList.add('active');

        // BaÅŸlÄ±k GÃ¼ncelle
        if (pageTitle) pageTitle.innerText = moduleName;

        // ModÃ¼lleri Gizle ve Hedefi GÃ¶ster
        modules.forEach(mod => {
            mod.classList.add('hidden');
            mod.classList.remove('block');
        });
        const targetMod = document.getElementById(targetId);
        if (targetMod) {
            targetMod.classList.add('block');
            targetMod.classList.remove('hidden');
        }

        // ModÃ¼le Ã¶zgÃ¼ veri yÃ¼kle
        // ModÃ¼le Ã¶zgÃ¼ veri yÃ¼kle
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

        // Active tab stili resetlemeyi garantilemek iÃ§in nav tetiklendiÄŸinde ilgili modÃ¼lÃ¼n varsayÄ±lan tab'ini (varsa) active yapma
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

// Lucide IkonlarÄ±nÄ± BaÅŸlat
window.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        window.lucide.createIcons();
    }
    initCharts();
});

/* === GRAFÄ°K SÄ°STEMÄ° (CHART.JS) === */
let mainChart, statusChart;

function initCharts() {
    const ctxMain = document.getElementById('mainChart');
    const ctxStatus = document.getElementById('statusChart');

    if (ctxMain) {
        mainChart = new Chart(ctxMain, {
            type: 'bar',
            data: {
                labels: ['Oca', 'Åžub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'AÄŸu', 'Eyl', 'Eki', 'Kas', 'Ara'],
                datasets: [{
                    label: 'Kilometre PerformansÄ±',
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
                labels: ['GeÃ§erli', 'YaklaÅŸÄ±yor', 'SÃ¼resi Dolan'],
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

/* === 1.B. FÄ°LO ALT SÃœRÃœMÃœ (ARAÃ‡LAR / ÅžOFÃ–RLER) === */
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

/* === 1.C. TAÅžERON ALT SEKMELERÄ° === */
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

    // Tab'a Ã¶zgÃ¼ veri yÃ¼kle
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

/* === 2. FÄ°NANS ALT SEKMELERÄ° === */
// Genel sekme geÃ§iÅŸ fonksiyonu
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

/* === 2.A Kredi KartÄ± Ä°ÅŸlem Detay ModalÄ± (YENÄ°) === */
window.showKartIslemleri = function (txDataStr, kartAdi) {
    const modal = document.getElementById('general-modal');
    const modalTitle = document.getElementById('modal-title');
    const dynamicBody = document.getElementById('modal-dynamic-body');

    modalTitle.textContent = kartAdi + ' - Kart Ä°ÅŸlemleri';
    let content = '<div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">';

    try {
        const txList = JSON.parse(txDataStr);
        if (txList.length === 0) {
            content += '<p class="text-sm text-gray-400 italic">Bu karta ait henÃ¼z iÅŸlem bulunmamaktadÄ±r.</p>';
        } else {
            // Sort by date descending
            txList.sort((a, b) => new Date(b.islem_tarihi) - new Date(a.islem_tarihi));

            txList.forEach(tx => {
                const islemGunu = window.formatDate(tx.islem_tarihi);
                const desc = tx.aciklama || 'BelirtilmemiÅŸ Harcama';
                const ts = Number(tx.taksit_sayisi || 1);
                const tTutar = Number(tx.toplam_tutar || 0);
                const aylikTutar = (ts > 0) ? (tTutar / ts) : tTutar;
                const taksitBadge = (ts > 1)
                    ? `<span class="px-2 py-0.5 bg-blue-500/20 text-blue-400 font-bold text-[10px] rounded ml-2">${ts} Taksit</span>`
                    : `<span class="px-2 py-0.5 bg-white/10 text-gray-400 font-bold text-[10px] rounded ml-2">Tek Ã‡ekim</span>`;

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
                            ${ts > 1 ? `<p class="text-[10px] text-gray-400">AylÄ±k: <span class="text-white">${window.formatCurrency(aylikTutar)}/ay</span></p>` : ''}
                        </div>
                    </div>
                `;
            });
        }
    } catch (e) {
        content += `<p class="text-sm text-red-500">Ä°ÅŸlemler yÃ¼klenirken hata oluÅŸtu.</p>`;
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

/* === 2.B. Ã–DEME PLANI FÄ°LTRELEME (PHASE 8) === */
window.filterTaksitler = function (category) {
    const btns = {
        'HEPSÄ°': 'taksit-btn-all',
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

/* === 2.C. CARÄ° DETAY & EKSTRE (PHASE 8) === */
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
                <div class="mt-12 text-xs text-gray-500 text-center italic">Bu rapor IDEOL Filo YÃ¶netim Sistemi tarafÄ±ndan oluÅŸturulmuÅŸtur.</div>
            </body>
        </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};

// BaÅŸlangÄ±Ã§ta ilk sekmeyi aktif et
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

/* === 3. MODAL (PENCERE) KONTROLLERÄ° === */
const modal = document.getElementById('general-modal');
const modalTitle = document.getElementById('modal-title');

window.openModal = function (title, id = null, extra = null) {
    modalTitle.textContent = title;
    const dynamicBody = document.getElementById('modal-dynamic-body');
    let content = '';

    if (title === 'Yeni AraÃ§ Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Mevcut araÃ§ tablosuna yeni bir araÃ§ kaydÄ± eklemek iÃ§in lÃ¼tfen aÅŸaÄŸÄ±daki alanlarÄ± eksiksiz doldurunuz.</p>
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã‡alÄ±ÅŸtÄ±ÄŸÄ± Åžirket</label>
                                <select id="arac-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="BelirtilmemiÅŸ">BelirtilmemiÅŸ</option>
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼lkiyet Durumu</label>
                                <select id="arac-mulkiyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Ã–ZMAL">Ã–ZMAL</option>
                                    <option value="TAÅžERON">TAÅžERON</option>
                                    <option value="KÄ°RALIK">KÄ°RALIK</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge TÃ¼rÃ¼</label>
                                <select id="arac-belge" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Yok">Yok</option>
                                    <option value="D2">D2 Belgesi</option>
                                    <option value="D4S">D4S Belgesi</option>
                                    <option value="U-ETDS">U-ETDS Sistemi</option>
                                    <option value="DiÄŸer">DiÄŸer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni ÅžofÃ¶r Ekle') {
        content = `
                    <div class="space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="user" class="w-4 h-4 text-blue-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-blue-500">KiÅŸisel Bilgiler</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ad Soyad *</label>
                                <input type="text" id="sofor-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ä°sim Soyisim">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã‡alÄ±ÅŸtÄ±ÄŸÄ± Åžirket</label>
                                <select id="sofor-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="IDEOL">IDEOL</option>
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DoÄŸum Tarihi</label>
                                <input type="date" id="sofor-dogum" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="sofor-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="05XX XXX XX XX">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum KiÅŸisi</label>
                                <input type="text" id="sofor-acil-kisi" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="Ä°sim Soyisim">
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ehliyet SÄ±nÄ±fÄ±</label>
                                <select id="sofor-ehliyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="">SeÃ§iniz...</option>
                                    <option value="B">B SÄ±nÄ±fÄ±</option>
                                    <option value="C">C SÄ±nÄ±fÄ±</option>
                                    <option value="CE">CE SÄ±nÄ±fÄ±</option>
                                    <option value="D">D SÄ±nÄ±fÄ±</option>
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
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge / SÃ¶zleÅŸme URL</label>
                            <input type="text" id="sofor-belge-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="https://...">
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="banknote" class="w-4 h-4 text-green-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-green-500">MaaÅŸ & Sigorta</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AylÄ±k MaaÅŸ (â‚º)</label>
                                <input type="number" id="sofor-aylik-maas" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="35000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">GÃ¼nlÃ¼k Yevmiye (â‚º)</label>
                                <input type="number" id="sofor-ucret" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta</label>
                                <select id="sofor-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SGK">SGK</option>
                                    <option value="BaÄŸkur">BaÄŸkur</option>
                                    <option value="Yok">Yok</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸe BaÅŸlama</label>
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
        // Dinamik araÃ§ ve cari listesi bekleyelim
        content = `
            <p class="text-xs text-gray-400 mb-5">FarklÄ± firmalardan alÄ±nan teklifleri karÅŸÄ±laÅŸtÄ±rmak iÃ§in kaydedin.</p>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">AraÃ§ *</label>
                        <select id="teklif-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"><option value="">YÃ¼kleniyor...</option></select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">PoliÃ§e TÃ¼rÃ¼ *</label>
                        <select id="teklif-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                            <option value="Trafik">Trafik SigortasÄ±</option>
                            <option value="Kasko">Kasko</option>
                            <option value="Koltuk SigortasÄ±">Koltuk SigortasÄ±</option>
                            <option value="DiÄŸer">DiÄŸer</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sigorta FirmasÄ± (Cari) *</label>
                    <select id="teklif-firma" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                        <option value="">â€” Cari YÃ¼kleniyor â€”</option>
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Fiyat (â‚º) *</label>
                        <input type="number" id="teklif-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all" placeholder="0.00">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Taksit SayÄ±sÄ±</label>
                        <select id="teklif-taksit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orange-500 transition-all">
                            <option value="1">PeÅŸin (Tek Ã‡ekim)</option>
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
            // SigortacÄ± carilerini yÃ¼kle
            const firmaSelect = document.getElementById('teklif-firma');
            if (firmaSelect && window.supabaseClient && window.supabaseUrl !== 'YOUR_SUPABASE_URL') {
                const { data: cariler } = await window.supabaseClient
                    .from('cariler').select('id, unvan').order('unvan');
                firmaSelect.innerHTML = '<option value="">â€” Sigorta FirmasÄ± SeÃ§ â€”</option>';
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
                    <p class="text-sm text-gray-400 mb-8">ÅžofÃ¶rÃ¼n gÃ¼nlÃ¼k Ã§alÄ±ÅŸma, izin veya rapor durumunu sisteme iÅŸleyiniz.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ÅžofÃ¶r SeÃ§in</label>
                                <select id="puantaj-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§in</label>
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
                                <option value="Ã‡ALIÅžTI">Ã‡ALIÅžTI</option>
                                <option value="Ä°ZÄ°NLÄ°">Ä°ZÄ°NLÄ°</option>
                                <option value="RAPORLU">RAPORLU</option>
                                <option value="DEVAMSIZ">DEVAMSIZ</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">HarcÄ±rah (â‚º)</label>
                            <input type="number" step="0.01" id="puantaj-harcirah" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('puantaj-sofor', 'soforler', 'id', 'ad_soyad');
            loadSelectOptions('puantaj-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Yeni Finans Ä°ÅŸlemi') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">ÅžofÃ¶r bazlÄ± finansal iÅŸlem (maaÅŸ, avans, kesinti vb.) giriÅŸi yapÄ±n.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ÅžofÃ¶r SeÃ§in</label>
                            <select id="finans-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸlem TÃ¼rÃ¼</label>
                            <select id="finans-tur" onchange="if(window.handleFinansTurChange) window.handleFinansTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                <option value="MAAÅž">MAAÅž (+)</option>
                                <option value="PRÄ°M/HARCIRAH">PRÄ°M/HARCIRAH (+)</option>
                                <option value="AVANS">AVANS (-)</option>
                                <option value="KESÄ°NTÄ° (Ceza/Hasar)">KESÄ°NTÄ° (Ceza/Hasar) (-)</option>
                            </select>
                        </div>
                        
                        <!-- DÄ°NAMÄ°K ALANLAR (Geri Ã–deme Åžekli, Ceza No vb.) -->
                        <div id="finans-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tutar (â‚º)</label>
                            <input type="number" step="0.01" id="finans-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AÃ§Ä±klama</label>
                            <input type="text" id="finans-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ä°ÅŸlem AÃ§Ä±klamasÄ±">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('finans-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'Yeni Sefer HakediÅŸi Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">TaÅŸeron araÃ§lar iÃ§in yeni sefer hakediÅŸi kaydÄ± oluÅŸturun.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§in</label>
                            <select id="taseron-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sefer Tarihi</label>
                            <input type="date" id="taseron-tarih" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">GÃ¼zergah</label>
                            <input type="text" id="taseron-guzergah" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Rota Bilgisi">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AnlaÅŸÄ±lan Tutar</label>
                                <input type="number" step="0.01" id="taseron-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="10000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">YakÄ±t Kesintisi</label>
                                <input type="number" step="0.01" id="taseron-yakit" value="0" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('taseron-arac', 'araclar', 'id', 'plaka', 'mulkiyet_durumu', ['TAÅžERON']), 50);
    } else if (title === 'Yeni TaÅŸeron KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Sisteme yeni bir dÄ±ÅŸ tedarikÃ§i (taÅŸeron) aracÄ± ve sahibi kaydedin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ PlakasÄ± *</label>
                                <input type="text" id="taseron-yeni-plaka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="34 ABC 123">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Firma / Sahip AdÄ± *</label>
                                <input type="text" id="taseron-yeni-firma" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Lojistik A.Åž.">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Marka / Model</label>
                                <input type="text" id="taseron-yeni-marka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Mercedes Axor">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kira Bedeli (â‚º)</label>
                                <input type="number" id="taseron-yeni-kira" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">GÃ¶revli ÅžofÃ¶r</label>
                            <select id="taseron-yeni-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('taseron-yeni-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'Yeni MÃ¼ÅŸteri Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Kurumsal mÃ¼ÅŸteri ve iÅŸ ortaÄŸÄ± bilgilerini detaylÄ± olarak kaydedin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼ÅŸteri / Kurum AdÄ±</label>
                                <input type="text" id="musteri-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Kurum AdÄ±">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vergi No / Daire</label>
                                <input type="text" id="musteri-vergi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0000000000">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Yetkili KiÅŸi</label>
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vade (GÃ¼n)</label>
                                <input type="number" id="musteri-vade" value="30" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Logo/Evrak URL</label>
                                <input type="text" id="musteri-logo" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="https://...">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Servis KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">MÃ¼ÅŸteriye verilen gÃ¼nlÃ¼k veya vardiyalÄ± servis hizmetini kayÄ±t altÄ±na alÄ±n.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼ÅŸteri SeÃ§in</label>
                                <select id="servis-musteri" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kullanan AraÃ§</label>
                                <select id="servis-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarih</label>
                                <input type="date" id="servis-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vardiya / YÃ¶n</label>
                                <select id="servis-vardiya" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SABAH">SABAH</option>
                                    <option value="AKÅžAM">AKÅžAM</option>
                                    <option value="GECE">GECE</option>
                                    <option value="EKSTRA">EKSTRA</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">GÃ¼nlÃ¼k Fatura TutarÄ± (â‚º)</label>
                            <input type="number" step="0.01" id="servis-fatura" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Tutar">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('servis-musteri', 'musteriler', 'id', 'ad');
            loadSelectOptions('servis-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'AraÃ§ ÅžofÃ¶r Ata') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">SeÃ§ili araca atamak istediÄŸiniz aktif ÅŸofÃ¶rÃ¼ listeden seÃ§iniz.</p>
                    <input type="hidden" id="atama-arac-id" value="">
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ÅžofÃ¶r SeÃ§in</label>
                            <select id="atama-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('atama-sofor', 'soforler', 'id', 'ad_soyad'), 50);
    } else if (title === 'ÅžofÃ¶r GÃ¼ncelle') {
        content = `
                    <div class="space-y-6">
                        <div class="flex items-center gap-2 mb-2">
                            <i data-lucide="user" class="w-4 h-4 text-blue-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-blue-500">KiÅŸisel Bilgiler</p>
                        </div>
                        <input type="hidden" id="edit-sofor-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ad Soyad *</label>
                                <input type="text" id="edit-sofor-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã‡alÄ±ÅŸtÄ±ÄŸÄ± Åžirket</label>
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DoÄŸum Tarihi</label>
                                <input type="date" id="edit-sofor-dogum" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Telefon</label>
                                <input type="text" id="edit-sofor-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">Acil Durum KiÅŸisi</label>
                                <input type="text" id="edit-sofor-acil-kisi" class="w-full bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-all font-medium" placeholder="Ä°sim Soyisim">
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ehliyet SÄ±nÄ±fÄ±</label>
                                <select id="edit-sofor-ehliyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="">SeÃ§iniz...</option>
                                    <option value="B">B SÄ±nÄ±fÄ±</option>
                                    <option value="C">C SÄ±nÄ±fÄ±</option>
                                    <option value="CE">CE SÄ±nÄ±fÄ±</option>
                                    <option value="D">D SÄ±nÄ±fÄ±</option>
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
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge / SÃ¶zleÅŸme URL</label>
                            <input type="text" id="edit-sofor-belge-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>

                        <div class="flex items-center gap-2 mt-4 mb-2">
                            <i data-lucide="banknote" class="w-4 h-4 text-green-500"></i>
                            <p class="text-xs font-bold uppercase tracking-widest text-green-500">MaaÅŸ & Sigorta</p>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AylÄ±k MaaÅŸ (â‚º)</label>
                                <input type="number" id="edit-sofor-aylik-maas" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">GÃ¼nlÃ¼k Yevmiye (â‚º)</label>
                                <input type="number" id="edit-sofor-ucret" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta</label>
                                <select id="edit-sofor-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="SGK">SGK</option>
                                    <option value="BaÄŸkur">BaÄŸkur</option>
                                    <option value="Yok">Yok</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸe BaÅŸlama</label>
                                <input type="date" id="edit-sofor-ise-baslama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'AraÃ§ Evrak GÃ¼ncelle') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">AracÄ±n kritik evrak (vize, sigorta, kasko) tarihlerini ve belgelerini gÃ¼ncelleyin.</p>
                    <input type="hidden" id="evrak-arac-id" value="">
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vize BitiÅŸ</label>
                                <input type="date" id="evrak-vize" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vize Belgesi (URL)</label>
                                <input type="text" id="evrak-vize-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 border-b border-white/5 pb-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta BitiÅŸ</label>
                                <input type="date" id="evrak-sigorta" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta Belgesi (URL)</label>
                                <input type="text" id="evrak-sigorta-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kasko BitiÅŸ</label>
                                <input type="date" id="evrak-kasko" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kasko Belgesi (URL)</label>
                                <input type="text" id="evrak-kasko-url" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Koltuk Sig. BitiÅŸ</label>
                                <input type="date" id="evrak-koltuk" class="w-full bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-white text-sm">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Koltuk Sig. Belgesi (URL)</label>
                                <input type="text" id="evrak-koltuk-url" class="w-full bg-white/5 border border-purple-500/20 rounded-xl px-3 py-2 text-white text-sm" placeholder="https://...">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'MÃ¼ÅŸteriye AraÃ§ TanÄ±mla') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">MÃ¼ÅŸteriye Ã¶zel araÃ§ ve tarife tanÄ±mlarÄ±nÄ± yaparak otomatik faturalandÄ±rma altyapÄ±sÄ±nÄ± kurun.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼ÅŸteri / Fabrika SeÃ§in</label>
                            <select id="tanim-musteri" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">TanÄ±mlanacak AraÃ§</label>
                            <select id="tanim-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarife TÃ¼rÃ¼</label>
                            <select id="tanim-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                <option value="Vardiya">Vardiya</option>
                                <option value="Tek">Tek (Sabah veya AkÅŸam)</option>
                            </select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tam / Vardiya FiyatÄ± (â‚º)</label>
                                <input type="number" step="0.01" id="tanim-vardiya-fiyat" placeholder="Ã–rn: 1500" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tek Sefer FiyatÄ± (â‚º)</label>
                                <input type="number" step="0.01" id="tanim-tek-fiyat" placeholder="Ã–rn: 800" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('tanim-musteri', 'musteriler', 'id', 'ad');
            loadSelectOptions('tanim-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Yeni YakÄ±t KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">AraÃ§ yakÄ±t alÄ±mlarÄ±nÄ± takip ederek iÅŸletme maliyetlerini optimize edin.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tarih</label>
                                <input type="date" id="yakit-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§in</label>
                                <select id="yakit-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AlÄ±nan Litre</label>
                                <input type="number" step="0.01" id="yakit-litre" oninput="hesaplaYakit()" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Birim Fiyat (â‚º)</label>
                                <input type="number" step="0.01" id="yakit-fiyat" oninput="hesaplaYakit()" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AnlÄ±k Kilometre (KM)</label>
                                <input type="number" id="yakit-km" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono" placeholder="Ã–rn: 125000">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (â‚º)</label>
                                <input type="number" step="0.01" id="yakit-tutar" class="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none transition-all font-bold" readonly>
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('yakit-arac', 'araclar', 'id', 'plaka'), 50);
    } else if (title === 'Yeni Cari Hesap') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">TedarikÃ§i, servis veya acente bilgilerinizi sisteme kaydederek Ã¶deme takibini baÅŸlatÄ±n.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unvan / Firma AdÄ±</label>
                            <input type="text" id="cari-unvan" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Firma tam adÄ±">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari TÃ¼rÃ¼</label>
                                <select id="cari-tur" onchange="if(window.handleCariTurChange) window.handleCariTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="TedarikÃ§i">TedarikÃ§i</option>
                                    <option value="Tamirci">Tamirci / Servis</option>
                                    <option value="Sigorta Acentesi">Sigorta Acentesi</option>
                                    <option value="DiÄŸer">DiÄŸer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°letiÅŸim No</label>
                                <input type="text" id="cari-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0212 ...">
                            </div>
                        </div>
                        
                        <!-- DÄ°NAMÄ°K ALANLAR (Acente Levha No, UzmanlÄ±k vb.) -->
                        <div id="cari-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                    </div>
                `;
    } else if (title === 'Yeni BakÄ±m/ParÃ§a KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">AraÃ§ bakÄ±m ve onarÄ±m iÅŸlemlerini detaylandÄ±rarak teknik geÃ§miÅŸ oluÅŸturun.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸlem Tarihi</label>
                                <input type="date" id="bakim-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§in</label>
                                <select id="bakim-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸlem TÃ¼rÃ¼</label>
                                <select id="bakim-tur" onchange="if(window.handleBakimTurChange) window.handleBakimTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="BakÄ±m/Ä°ÅŸÃ§ilik">BakÄ±m / Ä°ÅŸÃ§ilik</option>
                                    <option value="Yedek ParÃ§a">Yedek ParÃ§a</option>
                                    <option value="Hasar OnarÄ±m">Hasar OnarÄ±m</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">TedarikÃ§i/Tamirci</label>
                                <select id="bakim-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>

                        <!-- DÄ°NAMÄ°K ALANLAR (ParÃ§a AdÄ±/Kodu, Hasar Dosya No) -->
                        <div id="bakim-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div class="col-span-2">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AÃ§Ä±klama</label>
                                <input type="text" id="bakim-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: 10.000 BakÄ±mÄ±, YaÄŸ DeÄŸiÅŸimi">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AnlÄ±k KM</label>
                                <input type="number" id="bakim-km" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium font-mono" placeholder="Ã–rn: 125000">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (â‚º)</label>
                                <input type="number" step="0.01" id="bakim-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge YÃ¼kle</label>
                                <input type="file" id="bakim-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã–deme TÃ¼rÃ¼</label>
                                <select id="bakim-odeme-turu" onchange="if(window.handleOdemeTuruChange) window.handleOdemeTuruChange(this.value, 'bakim')" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="VADELÄ° (Cariye Yaz)">VADELÄ° (Cariye Yaz)</option>
                                    <option value="KREDÄ° KARTI">KREDÄ° KARTI Ä°LE Ã–DENDÄ°</option>
                                    <option value="CARÄ° HESABI">CARÄ° HESABINDAN Ã–DENDÄ°</option>
                                    <option value="NAKÄ°T / HAVALE">NAKÄ°T / HAVALE Ä°LE Ã–DENDÄ°</option>
                                </select>
                            </div>
                            <div id="bakim-kredi-karti-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kredi KartÄ±</label>
                                <select id="bakim-kredi-karti" class="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div id="bakim-cari-hesap-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Hesap SeÃ§</label>
                                <select id="bakim-odeme-cari" class="w-full bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-400 focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>

                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('bakim-arac', 'araclar', 'id', 'plaka');
            loadSelectOptions('bakim-cari', 'cariler', 'id', 'unvan', 'tur', ['TedarikÃ§i', 'Tamirci', 'Servis', 'TedarikÃ§i/Tamirci']);
            loadSelectOptions('bakim-kredi-karti', 'kredi_kartlari', 'id', 'kart_adi');
            loadSelectOptions('bakim-odeme-cari', 'cariler', 'id', 'unvan');
        }, 50);
    } else if (title === 'Yeni PoliÃ§e KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">Trafik sigortasÄ±, kasko ve diÄŸer poliÃ§e giriÅŸlerini yaparak risk yÃ¶netimi saÄŸlayÄ±n.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§in</label>
                                <select id="police-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Acente (Cari)</label>
                                <select id="police-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">BaÅŸlangÄ±Ã§</label>
                                <input type="date" id="police-baslangic" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">BitiÅŸ</label>
                                <input type="date" id="police-bitis" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">PoliÃ§e TÃ¼rÃ¼</label>
                                <select id="police-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Trafik">Trafik SigortasÄ±</option>
                                    <option value="Kasko">Kasko</option>
                                    <option value="Ä°htiyari Mali Mesuliyet">Ä°MM</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit</label>
                                <input type="number" id="police-taksit" value="1" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Tutar (â‚º)</label>
                                <input type="number" step="0.01" id="police-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge YÃ¼kle</label>
                                <input type="file" id="police-dosya" accept=".pdf,.jpg,.jpeg,.png" class="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-orange-500/20 file:text-orange-400 hover:file:bg-orange-500/30 transition-all cursor-pointer">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-500/5 border border-gray-500/10">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã–deme TÃ¼rÃ¼</label>
                                <select id="police-odeme-turu" onchange="if(window.handleOdemeTuruChange) window.handleOdemeTuruChange(this.value, 'police')" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="VADELÄ° (Cariye Yaz)">VADELÄ° (Cariye Yaz)</option>
                                    <option value="KREDÄ° KARTI">KREDÄ° KARTI Ä°LE Ã–DENDÄ°</option>
                                    <option value="CARÄ° HESABI">CARÄ° HESABINDAN Ã–DENDÄ°</option>
                                    <option value="NAKÄ°T / HAVALE">NAKÄ°T / HAVALE Ä°LE Ã–DENDÄ°</option>
                                </select>
                            </div>
                            <div id="police-kredi-karti-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kredi KartÄ±</label>
                                <select id="police-kredi-karti" class="w-full bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div id="police-cari-hesap-container" class="hidden">
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari Hesap SeÃ§</label>
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
    } else if (title === 'Yeni Fatura KaydÄ±') {
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
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fatura TÃ¼rÃ¼</label>
                            <select id="fatura-tur" onchange="if(window.handleFaturaTurChange) window.handleFaturaTurChange(this.value)" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                                <option value="Genel Gider">Genel Gider (Ofis vb.)</option>
                                <option value="YakÄ±t">YakÄ±t (AraÃ§ BazlÄ±)</option>
                                <option value="OGS/HGS">OGS/HGS GeÃ§iÅŸi</option>
                                <option value="Sigorta/Kasko">Sigorta/Kasko Ã–demesi</option>
                            </select>
                        </div>
                        
                        <!-- DÄ°NAMÄ°K ALANLAR (Litre, Ä°hlal vb.) -->
                        <div id="fatura-dinamik-alanlar" class="hidden bg-black/10 p-4 rounded border border-gray-200 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AÃ§Ä±klama</label>
                            <input type="text" id="fatura-aciklama" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors" placeholder="Ã–rn: KÄ±rtasiye Gideri, Ofis KirasÄ± vb.">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Toplam Tutar (â‚º)</label>
                            <input type="number" step="0.01" id="fatura-tutar" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dosya/Fatura Linki (Opsiyonel)</label>
                            <input type="text" id="fatura-dosya" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors" placeholder="https://Link.com/fatura.pdf">
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Ã–deme KaydÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-8">TedarikÃ§iye yapÄ±lan Ã¶demeyi (Ã§ek, nakit, havale) kaydederek bakiyesini gÃ¼ncelleyin.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã–deme YapÄ±lan Cari</label>
                            <select id="odeme-cari" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã–deme Tarihi</label>
                                <input type="date" id="odeme-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã–deme TÃ¼rÃ¼</label>
                                <select id="odeme-tur" onchange="if(window.handleOdemeTurChange) window.handleOdemeTurChange(this.value)" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="Banka/Havale">Banka / Havale</option>
                                    <option value="Nakit">Nakit</option>
                                    <option value="Ã‡ek/Senet">Ã‡ek / Senet</option>
                                    <option value="Kredi KartÄ±">Kredi KartÄ±</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- DÄ°NAMÄ°K ALANLAR (Ã‡ek No, Dekont No vb.) -->
                        <div id="odeme-dinamik-alanlar" class="hidden bg-black/20 p-4 rounded-xl border border-white/5 space-y-4">
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Tutar (â‚º)</label>
                            <input type="number" step="0.01" id="odeme-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AÃ§Ä±klama</label>
                            <input type="text" id="odeme-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: X AyÄ± Taksit Ã–demesi">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('odeme-cari', 'cariler', 'id', 'unvan'), 50);
    } else if (title === 'Yeni Teklif Ekle') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Sigorta ÅŸirketlerinden aldÄ±ÄŸÄ±nÄ±z teklifleri tÃ¼m poliÃ§e detaylarÄ±yla karÅŸÄ±laÅŸtÄ±rmak iÃ§in kaydedin.</p>
                    <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                        
                        <!-- 1. TEMEL BÄ°LGÄ°LER -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="file-text" class="w-4 h-4"></i> Genel Bilgiler
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">PoliÃ§e TÃ¼rÃ¼ *</label>
                                    <div class="flex gap-4">
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="teklif_turu" value="Trafik" class="w-4 h-4 text-orange-500 bg-black/30 border-white/20 focus:ring-orange-500" checked>
                                            <span class="text-sm font-semibold text-white">Trafik SigortasÄ±</span>
                                        </label>
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="teklif_turu" value="Kasko" class="w-4 h-4 text-orange-500 bg-black/30 border-white/20 focus:ring-orange-500">
                                            <span class="text-sm font-semibold text-white">Kasko</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ SeÃ§imi *</label>
                                    <select id="teklif-arac" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Sigorta FirmasÄ± (Cari) *</label>
                                    <select id="teklif-firma" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">BaÅŸlangÄ±Ã§ Tarihi</label>
                                    <input type="date" id="teklif-baslangic" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">BitiÅŸ Tarihi</label>
                                    <input type="date" id="teklif-bitis" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                                </div>
                            </div>
                        </div>

                        <!-- 2. FÄ°NANS VE TAKSÄ°T -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="credit-card" class="w-4 h-4"></i> Ã–deme PlanÄ±
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Toplam PoliÃ§e TutarÄ± (â‚º) *</label>
                                    <input type="number" step="0.01" id="teklif-tutar" class="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-orange-400 font-bold focus:outline-none focus:border-orange-500 transition-all" placeholder="0.00">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit SayÄ±sÄ±</label>
                                    <select id="teklif-taksit-sayisi" class="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                        <option value="1">PeÅŸin (Tek Ã‡ekim)</option>
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
                                    <label class="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">AylÄ±k Taksit (â‚º)</label>
                                    <input type="number" step="0.01" id="teklif-taksit-tutar" class="w-full bg-black/30 border border-blue-500/30 rounded-xl px-4 py-3 text-blue-400 font-bold focus:outline-none focus:border-blue-500 transition-all" placeholder="0.00">
                                </div>
                            </div>
                        </div>

                        <!-- 3. KAPSAM VE TEMÄ°NATLAR -->
                        <div class="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 class="text-xs font-bold text-green-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <i data-lucide="shield-check" class="w-4 h-4"></i> PoliÃ§e Ekstra TeminatlarÄ±
                            </h3>
                            
                            <div class="space-y-3">
                                <!-- Ä°MM -->
                                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full md:w-auto">
                                        <input type="checkbox" id="teklif-imm" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-200">Ä°htiyari Mali Mesuliyet (Ä°MM)</span>
                                            <span class="text-[10px] text-gray-500">KarÅŸÄ± tarafa verilecek zararlar</span>
                                        </div>
                                    </label>
                                    <div class="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5 w-full md:w-auto">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">Limit:</span>
                                        <select id="teklif-imm-limit" class="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none w-full min-w-[120px]">
                                            <option value="1.000.000">1 Milyon â‚º</option>
                                            <option value="3.000.000" selected>3 Milyon â‚º</option>
                                            <option value="5.000.000">5 Milyon â‚º</option>
                                            <option value="Limitsiz">Limitsiz</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- Ä°kame AraÃ§ -->
                                <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full md:w-auto">
                                        <input type="checkbox" id="teklif-ikame" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <span class="text-sm font-bold text-gray-200">Ä°kame AraÃ§ Hizmeti</span>
                                    </label>
                                    <div class="flex items-center gap-2 bg-black/30 px-3 py-2 rounded-lg border border-white/5 w-full md:w-auto">
                                        <span class="text-[10px] text-gray-500 uppercase font-bold">SÃ¼re:</span>
                                        <select id="teklif-ikame-sure" class="bg-transparent text-xs text-gray-300 font-semibold focus:outline-none w-full min-w-[120px]">
                                            <option value="7 GÃ¼n">7 GÃ¼n</option>
                                            <option value="15 GÃ¼n" selected>15 GÃ¼n</option>
                                            <option value="30 GÃ¼n">30 GÃ¼n</option>
                                            <option value="SÄ±nÄ±rsÄ±z">SÄ±nÄ±rsÄ±z</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- Orijinal Cam Row -->
                                <div class="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full">
                                        <input type="checkbox" id="teklif-cam" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-bold text-gray-200">Orijinal Cam (Muafiyetsiz)</span>
                                            <span class="text-[10px] text-gray-500">Logolu kÄ±rÄ±lmaz parÃ§a deÄŸiÅŸimi</span>
                                        </div>
                                    </label>
                                </div>
                                
                                <!-- Yol YardÄ±m -->
                                <div class="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <label class="flex items-center gap-3 cursor-pointer w-full">
                                        <input type="checkbox" id="teklif-yolyardim" class="w-5 h-5 rounded border-white/20 bg-black/20 text-green-500 focus:ring-green-500 focus:ring-offset-gray-900">
                                        <span class="text-sm font-bold text-gray-200">GeniÅŸletilmiÅŸ Yol YardÄ±m Paketi</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
        setTimeout(async () => {
            loadSelectOptions('teklif-arac', 'araclar', 'id', 'plaka');
            // SigortacÄ± carilerini yÃ¼kle
            const firmaSelect = document.getElementById('teklif-firma');
            if (firmaSelect && window.supabaseClient && window.supabaseUrl !== 'YOUR_SUPABASE_URL') {
                const { data: cariler } = await window.supabaseClient
                    .from('cariler')
                    .select('id, unvan, tur')
                    .order('unvan');
                firmaSelect.innerHTML = '<option value="">â€” Sigorta FirmasÄ± SeÃ§ â€”</option>';
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
    } else if (title === 'Yeni MaaÅŸ KaydÄ±') {
        const now = new Date();
        const donem = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        content = `
                    <p class="text-sm text-gray-400 mb-6">ÅžofÃ¶r aylÄ±k maaÅŸ Ã¶demesini kaydedin. Elden tutar banka kesintileri Ã§Ä±karÄ±ldÄ±ktan sonra hesaplanÄ±r.</p>
                    <div class="space-y-5">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ÅžofÃ¶r</label>
                                <select id="maas-sofor" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AraÃ§ (Plaka)</label>
                                <select id="maas-arac" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium"></select>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DÃ¶nem</label>
                                <input type="month" id="maas-donem" value="${donem}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã‡alÄ±ÅŸma GÃ¼nÃ¼</label>
                                <input type="number" id="maas-gun" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0" min="0" max="31">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Net MaaÅŸ (â‚º)</label>
                                <input type="number" step="0.01" id="maas-net" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium text-blue-400 font-bold" placeholder="0.00">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-orange-400 uppercase tracking-widest mb-2">Avans (â‚º)</label>
                                <input type="number" step="0.01" id="maas-avans" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Ceza (â‚º)</label>
                                <input type="number" step="0.01" id="maas-ceza" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Haciz (â‚º)</label>
                                <input type="number" step="0.01" id="maas-haciz" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">M.K Banka (â‚º)</label>
                                <input type="number" step="0.01" id="maas-mk-banka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Ä°DEOL Banka (â‚º)</label>
                            <input type="number" step="0.01" id="maas-ideol-banka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="0.00">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AÃ§Ä±klama</label>
                            <input type="text" id="maas-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-all font-medium" placeholder="Opsiyonel aÃ§Ä±klama...">
                        </div>
                    </div>
                `;
        setTimeout(() => {
            loadSelectOptions('maas-sofor', 'soforler', 'id', 'ad_soyad');
            loadSelectOptions('maas-arac', 'araclar', 'id', 'plaka');
        }, 50);
    } else if (title === 'Cari GÃ¼ncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-cari-id" value="">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Unvan / Firma AdÄ±</label>
                            <input type="text" id="edit-cari-unvan" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Cari TÃ¼rÃ¼</label>
                                <select id="edit-cari-tur" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="TedarikÃ§i">TedarikÃ§i</option>
                                    <option value="Tamirci">Tamirci / Servis</option>
                                    <option value="Sigorta Acentesi">Sigorta Acentesi</option>
                                    <option value="DiÄŸer">DiÄŸer</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°letiÅŸim No</label>
                                <input type="text" id="edit-cari-telefon" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'MÃ¼ÅŸteri GÃ¼ncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-musteri-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼ÅŸteri/Firma AdÄ±</label>
                                <input type="text" id="edit-musteri-ad" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vergi No / TC</label>
                                <input type="text" id="edit-musteri-vergi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Yetkili KiÅŸi</label>
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
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Vade (GÃ¼n)</label>
                                <input type="number" id="edit-musteri-vade" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Logo/Evrak URL</label>
                                <input type="text" id="edit-musteri-logo" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'AraÃ§ GÃ¼ncelle') {
        content = `
                    <div class="space-y-6">
                        <input type="hidden" id="edit-arac-id" value="">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Plaka</label>
                                <input type="text" id="edit-arac-plaka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium uppercase">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ã‡alÄ±ÅŸtÄ±ÄŸÄ± Åžirket</label>
                                <select id="edit-arac-sirket" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="BelirtilmemiÅŸ">BelirtilmemiÅŸ</option>
                                    <option value="IDEOL">IDEOL</option>
                                    <option value="M.K.">M.K.</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Marka & Model</label>
                            <input type="text" id="edit-arac-marka" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">MÃ¼lkiyet Durumu</label>
                                <select id="edit-arac-mulkiyet" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Ã–ZMAL">Ã–ZMAL</option>
                                    <option value="TAÅžERON">TAÅžERON</option>
                                    <option value="KÄ°RALIK">KÄ°RALIK</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Belge TÃ¼rÃ¼</label>
                                <select id="edit-arac-belge" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium appearance-none">
                                    <option value="Yok">Yok</option>
                                    <option value="D2">D2 Belgesi</option>
                                    <option value="D4S">D4S Belgesi</option>
                                    <option value="U-ETDS">U-ETDS Sistemi</option>
                                    <option value="DiÄŸer">DiÄŸer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Kredi KartÄ±') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Åžirket kredi kartÄ±nÄ± hesap takibi iÃ§in sisteme kaydediniz.</p>
                    <div class="space-y-6">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart AdÄ± / Banka</label>
                                <input type="text" id="kredi-kart-adi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: Garanti Bonus">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Sahibi / Åžirket</label>
                                <input type="text" id="kredi-kart-sahibi" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: IDEOL A.Åž.">
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart NumarasÄ± (Son 4 Hane vs)</label>
                                <input type="text" id="kredi-kart-no" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: **** 1234">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Kart Limiti (â‚º)</label>
                                <input type="number" step="0.01" id="kredi-kart-limit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="0.00">
                            </div>
                        </div>
                    </div>
                `;
    } else if (title === 'Yeni Kart Ä°ÅŸlemi') {
        content = `
                    <p class="text-sm text-gray-400 mb-6">Kredi kartÄ±nÄ±zla yaptÄ±ÄŸÄ±nÄ±z harcama ve taksit planÄ±nÄ± kaydediniz.</p>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸlem YapÄ±lan Kart</label>
                            <select id="kredi-kart-secim" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium"></select>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Ä°ÅŸlem Tarihi</label>
                                <input type="date" id="kart-islem-tarih" value="${new Date().toISOString().split('T')[0]}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Taksit SayÄ±sÄ±</label>
                                <select id="kart-islem-taksit" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium">
                                    <option value="1">Tek Ã‡ekim</option>
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
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">AÃ§Ä±klama / Kurum</label>
                            <input type="text" id="kart-islem-aciklama" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium" placeholder="Ã–rn: AraÃ§ Kaskosu">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Toplam Harcama (â‚º)</label>
                            <input type="number" step="0.01" id="kart-islem-tutar" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-all font-medium text-orange-400 font-bold" placeholder="0.00">
                        </div>
                    </div>
                `;
        setTimeout(() => loadSelectOptions('kredi-kart-secim', 'kredi_kartlari', 'id', 'kart_adi'), 50);
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
            sel.innerHTML = '<option value="">AraÃ§ SeÃ§in...</option>';
            (data || []).forEach(a => {
                const opt = document.createElement('option'); opt.value = a.id; opt.textContent = a.plaka; sel.appendChild(opt);
            });
        }, 100);
    }

    if (id) {
        setTimeout(() => {
            if (title === 'AraÃ§ ÅžofÃ¶r Ata') {
                document.getElementById('atama-arac-id').value = id;
            } else if (title === 'AraÃ§ Evrak GÃ¼ncelle') {
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
            } else if (title === 'Yeni Fatura KaydÄ±') {
                document.getElementById('fatura-cari-id').value = id;
            } else if (title === 'Yeni PoliÃ§e KaydÄ±') {
                // AraÃ§ plakasÄ±nÄ± otomatik seÃ§ (dropdown yÃ¼klendikten sonra)
                setTimeout(() => {
                    const policeArac = document.getElementById('police-arac');
                    if (policeArac) policeArac.value = id;
                }, 200);
            } else if (title === 'ÅžofÃ¶r GÃ¼ncelle') {
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
            } else if (title === 'Cari GÃ¼ncelle') {
                window.supabaseClient.from('cariler').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-cari-id').value = data.id;
                        document.getElementById('edit-cari-unvan').value = data.unvan || '';
                        document.getElementById('edit-cari-tur').value = data.tur || 'TedarikÃ§i';
                        document.getElementById('edit-cari-telefon').value = data.telefon || '';
                    }
                });
            } else if (title === 'MÃ¼ÅŸteri GÃ¼ncelle') {
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
            } else if (title === 'AraÃ§ GÃ¼ncelle') {
                window.supabaseClient.from('araclar').select('*').eq('id', id).single().then(({ data }) => {
                    if (data) {
                        document.getElementById('edit-arac-id').value = data.id;
                        document.getElementById('edit-arac-plaka').value = data.plaka || '';
                        document.getElementById('edit-arac-marka').value = data.marka_model || '';
                        document.getElementById('edit-arac-mulkiyet').value = data.mulkiyet_durumu || 'Ã–ZMAL';
                        document.getElementById('edit-arac-sirket').value = data.sirket || 'BelirtilmemiÅŸ';
                    }
                });
            }
        }, 10);
    }
}
// filterCol: sÃ¼tun adÄ±, filterVals: string[] â€” birden fazla deÄŸerle in() filtresi uygular
async function loadSelectOptions(selectId, table, valueField, textField, filterCol = null, filterVals = null) {
    const sel = document.getElementById(selectId);
    if (!sel || window.supabaseUrl === 'YOUR_SUPABASE_URL') return;
    let query = window.supabaseClient.from(table).select('*').order(textField, { ascending: true });
    if (filterCol && filterVals && filterVals.length > 0) {
        query = query.in(filterCol, filterVals);
    }
    const { data, error } = await query;
    if (error) { console.error(error); return; }
    sel.innerHTML = '<option value="">SeÃ§iniz...</option>';
    data.forEach(item => {
        sel.innerHTML += `<option value="${item[valueField]}">${item[textField]}</option>`;
    });
}
window.closeModal = function () {
    modal.classList.add('hidden');
}

// Ã–zel Onay ModalÄ± Fonksiyonu
window.showConfirm = function (message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');

    if (!modal || !msgEl || !confirmBtn || !cancelBtn) {
        // Modal yoksa native confirm'e dÃ¼ÅŸ
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

        // KPI: AraÃ§ sayÄ±sÄ±
        const elArac = document.getElementById('kpi-arac');
        if (elArac) elArac.textContent = aracCount ?? 'â€”';

        // KPI: ÅžofÃ¶r sayÄ±sÄ±
        const elSofor = document.getElementById('kpi-sofor');
        if (elSofor) elSofor.textContent = soforCount ?? 'â€”';

        // KPI: Cari hesap sayÄ±sÄ±
        const elCari = document.getElementById('kpi-cari');
        if (elCari) elCari.textContent = cariCount ?? 'â€”';

        // KPI: 15 gÃ¼n iÃ§inde sÃ¼resi dolacak evraklar
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
        console.error('Dashboard fetch hatasÄ±:', e);
    }
}

// DÄ°NAMÄ°K FORM ALANLARI YÃ–NETÄ°MÄ°
window.handleOdemeTurChange = function (tur) {
    const container = document.getElementById('odeme-dinamik-alanlar');
    if (!container) return;

    container.innerHTML = '';

    if (tur === 'Ã‡ek/Senet') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ã‡ek/Senet No</label>
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
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dekont / Ä°ÅŸlem Referans No</label>
                <input type="text" id="odeme-dekont-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="TR123...">
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Kredi KartÄ±') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kart Son 4 Hanesi / Slip No</label>
                    <input type="text" id="odeme-kart-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="**** 1234">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">FiÅŸ/Fatura AlÄ±ndÄ± mÄ±?</label>
                    <div class="flex items-center gap-2 mt-2">
                        <input type="checkbox" id="odeme-fis-kart" class="w-4 h-4 text-green-500 bg-black/30 border-white/20 rounded focus:ring-green-500">
                        <input type="text" id="odeme-fis-no-kart" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="FiÅŸ/Fatura No">
                    </div>
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Nakit') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">FiÅŸ / Fatura AlÄ±ndÄ± mÄ±?</label>
                <div class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="odeme-fis-nakit" class="w-4 h-4 text-green-500 bg-black/30 border-white/20 rounded focus:ring-green-500">
                    <input type="text" id="odeme-fis-no-nakit" class="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="FiÅŸ/Fatura No (Opsiyonel)">
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

    if (tur === 'Yedek ParÃ§a') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">ParÃ§a AdÄ± / Kodu</label>
                    <input type="text" id="bakim-parca-adi" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Ã–rn: YaÄŸ Filtresi 01H">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Adet</label>
                    <input type="number" id="bakim-parca-adet" value="1" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'Hasar OnarÄ±m') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hasar / Sigorta Dosya No</label>
                <input type="text" id="bakim-dosya-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Sigorta Åžirketi Hasar Dosya No">
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
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">UzmanlÄ±k AlanÄ±</label>
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
    } else if (tur === 'TedarikÃ§i') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tedarik Grubu</label>
                <input type="text" id="cari-tedarikci-grup" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="Ã–rn: Lastik, Filtre, YaÄŸ...">
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

    if (tur === 'YakÄ±t') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">AlÄ±nan Litre</label>
                    <input type="number" step="0.01" id="fatura-yakit-litre" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="0.00 L">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plaka (Ä°steÄŸe BaÄŸlÄ±)</label>
                    <input type="text" id="fatura-yakit-plaka" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="34 ABC 123">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'OGS/HGS') {
        container.innerHTML = `
            <div class="flex items-center gap-4 mb-3 mt-1">
                <input type="checkbox" id="fatura-ogs-ihlal" class="w-4 h-4 text-danger bg-white border-gray-300 rounded focus:ring-danger">
                <label for="fatura-ogs-ihlal" class="text-sm font-semibold text-gray-600">Ä°hlalli GeÃ§iÅŸ mi?</label>
            </div>
            <div>
                <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">GeÃ§iÅŸ YapÄ±lan GÃ¼zergah/KÃ¶prÃ¼</label>
                <input type="text" id="fatura-ogs-guzergah" class="w-full border-gray-300 border px-3 py-2 text-primary focus:outline-none focus:border-danger focus:ring-1 focus:ring-danger transition-colors text-sm" placeholder="Ã–rn: FSM, Avrasya, Anadolu Otoyolu...">
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
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Geri Ã–deme Åžekli</label>
                <select id="finans-avans-odeme" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                    <option value="MaaÅŸtan Kesilecek">MaaÅŸtan Kesilecek</option>
                    <option value="Elden Ã–denecek">Ay Ä°Ã§i Elden Ã–denecek</option>
                    <option value="Primden KarÅŸÄ±lanacak">Primden KarÅŸÄ±lanacak</option>
                </select>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'KESÄ°NTÄ° (Ceza/Hasar)') {
        container.innerHTML = `
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kesinti Sebebi</label>
                    <select id="finans-kesinti-sebep" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm">
                        <option value="Trafik CezasÄ±">Trafik CezasÄ±</option>
                        <option value="AraÃ§ HasarÄ±">AraÃ§ HasarÄ± / Kaza</option>
                        <option value="DiÄŸer Kesinti">DiÄŸer (Ä°hlal, KayÄ±p ParÃ§a)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ceza / Tutanak No</label>
                    <input type="text" id="finans-kesinti-no" class="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm" placeholder="MA123456...">
                </div>
            </div>
        `;
        container.classList.remove('hidden');
    } else if (tur === 'PRÄ°M/HARCIRAH') {
        container.innerHTML = `
            <div>
                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Ä°lgili Hak EdiÅŸ DÃ¶nemi (Ay/YÄ±l)</label>
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
                <title>TaÅŸeron Ay Sonu Raporu - ${month}</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { bg-color: #f2f2f2; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .premium-table { width: 100%; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .text-orange-400 { color: #f97316; }
                    .text-red-500 { color: #ef4444; }
                    .text-green-400 { color: #22c55e; }
                    tfoot { font-bold: true; background: #fafafa; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TaÅŸeron Ay Sonu Hesap Ã–zeti</h1>
                    <p>DÃ¶nem: ${month}</p>
                </div>
                ${tableHtml}
            </body>
        </html>
    `);
    win.document.close();
    win.print();
};

/* === 9. HARÄ°TA & ROTA MANTIÄžI === */
window.mainMap = null;
let mapMarkers = [];

window.initMap = async function () {


    // Harita konteynerinin gÃ¶rÃ¼nÃ¼r olduÄŸundan emin olalÄ±m
    const mapContainer = document.getElementById('factory-map');
    if (!mapContainer) {
        console.error("[MAP] factory-map konteyneri bulunamadÄ±!");
        return;
    }

    // Harita boyutlarÄ±nÄ± Leaflet'e tekrar hesaplattÄ±ralÄ±m (Hidden modÃ¼lden Ã§Ä±ktÄ±ÄŸÄ± iÃ§in)
    if (!window.mainMap) {
        // Ä°lk kez oluÅŸturuluyor
        window.mainMap = L.map('factory-map', {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([39.9334, 32.8597], 6); // TÃ¼rkiye merkezi

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(mainMap);

        // Ä°lk yÃ¼klemede boyut hatasÄ±nÄ± Ã¶nlemek iÃ§in
        setTimeout(() => mainMap.invalidateSize(), 300);
    } else {
        // Zaten varsa sadece boyutu dÃ¼zelt ve merkezle
        setTimeout(() => {
            mainMap.invalidateSize();
        }, 100);
    }

    // Mevcut markerlarÄ± temizle
    mapMarkers.forEach(m => mainMap.removeLayer(m));
    mapMarkers = [];

    try {
        const { data: musteriler, error } = await window.supabaseClient.from('musteriler').select('*');
        if (error) throw error;

        if (!musteriler || musteriler.length === 0) return;

        musteriler.forEach(m => {
            // Demo amaÃ§lÄ± koordinat simÃ¼lasyonu
            const lat = m.lat || (39.5 + (Math.random() - 0.5) * 5);
            const lng = m.lng || (32.0 + (Math.random() - 0.5) * 8);

            const marker = L.marker([lat, lng]).addTo(mainMap);
            marker.bindPopup(`
                <div class="p-2 min-w-[150px]">
                    <h4 class="font-bold text-orange-500 mb-1 leading-tight">${m.unvan}</h4>
                    <p class="text-[10px] text-gray-500 mb-3 uppercase tracking-wider">${m.sehir || 'Åžehir BelirtilmemiÅŸ'}</p>
                    <p class="text-xs text-gray-400 mb-4 line-clamp-2">${m.adres || 'Adres bilgisi yok'}</p>
                    <button onclick="window.showRoute([${lat}, ${lng}])" 
                        class="w-full bg-orange-500 hover:bg-orange-600 text-white text-[10px] py-2 rounded-lg font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                        <i data-lucide="navigation" class="w-3 h-3"></i> Rota Ã‡iz
                    </button>
                </div>
            `);
            mapMarkers.push(marker);
        });

        // HaritayÄ± markerlara gÃ¶re sÄ±ÄŸdÄ±r
        if (mapMarkers.length > 0) {
            const group = new L.featureGroup(mapMarkers);
            mainMap.fitBounds(group.getBounds().pad(0.1));
        }

        if (window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Harita yÃ¼kleme hatasÄ±:", e);
    }
};

window.showRoute = function (destCoords) {
    const startCoords = [41.0082, 28.9784]; // Ã–rn: Merkez (Ä°stanbul)

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
        .setContent('<div class="text-xs font-bold text-orange-500 p-1">Rota PlanlandÄ±!</div>')
        .openOn(window.mainMap);
};

window.handleOdemeTuruChange = function (value, prefix) {
    const ccContainer = document.getElementById(`${prefix}-kredi-karti-container`);
    const cariContainer = document.getElementById(`${prefix}-cari-hesap-container`);

    if (ccContainer) ccContainer.classList.toggle('hidden', value !== 'KREDÄ° KARTI');
    if (cariContainer) cariContainer.classList.toggle('hidden', value !== 'CARÄ° HESABI');
};

window.filterAraclar = function (filter) {
    // TÃ¼m filtre butonlarÄ±nÄ± sÄ±fÄ±rla
    ['hepsi', 'ozmal', 'taseron', 'kiralik', 'd2', 'd4s', 'ideol', 'mk'].forEach(key => {
        const btn = document.getElementById(`filter-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
            // Orijinal renkleri geri ver
            if (key === 'd2') btn.classList.add('text-blue-400');
            else if (key === 'd4s') btn.classList.add('text-purple-400');
            else if (key === 'ideol') btn.classList.add('text-orange-400');
            else if (key === 'mk') btn.classList.add('text-red-400');
            else btn.classList.add('text-gray-400');
        }
    });

    // Aktif olanÄ± vurgula
    const keyMap = { 'hepsi': 'hepsi', 'Ã–ZMAL': 'ozmal', 'TAÅžERON': 'taseron', 'KÄ°RALIK': 'kiralik', 'D2': 'd2', 'D4S': 'd4s' };
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
    // Veriyi Ã§ek
    if (typeof fetchAraclar === 'function') fetchAraclar(filter, 'hepsi');
};

window.filterAraclarBySirket = function (sirket) {
    // TÃ¼m araÃ§ filtrelerini temizle
    ['hepsi', 'ozmal', 'taseron', 'kiralik', 'd2', 'd4s', 'ideol', 'mk'].forEach(key => {
        const btn = document.getElementById(`filter-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-purple-500', 'bg-red-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
        }
    });

    const activeKey = sirket === 'IDEOL' ? 'ideol' : (sirket === 'M.K.' ? 'mk' : 'hepsi');
    const btn = document.getElementById(`filter-btn-${activeKey}`);
    if (btn) {
        btn.classList.add(sirket === 'IDEOL' ? 'bg-orange-500' : 'bg-red-500', 'text-white');
        btn.classList.remove('hover:bg-white/10');
    }

    if (typeof fetchAraclar === 'function') fetchAraclar('hepsi', sirket);
};

window.filterSoforler = function (sirket) {
    ['hepsi', 'ideol', 'mk'].forEach(key => {
        const btn = document.getElementById(`filter-sofor-btn-${key}`);
        if (btn) {
            btn.classList.remove('bg-blue-500', 'bg-orange-500', 'bg-red-500', 'text-white');
            btn.classList.add('hover:bg-white/10');
        }
    });

    const activeKey = sirket === 'IDEOL' ? 'ideol' : (sirket === 'M.K.' ? 'mk' : 'hepsi');
    const btn = document.getElementById(`filter-sofor-btn-${activeKey}`);
    if (btn) {
        const bgClass = sirket === 'IDEOL' ? 'bg-orange-500' : (sirket === 'M.K.' ? 'bg-red-500' : 'bg-blue-500');
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
