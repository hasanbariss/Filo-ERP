/**
 * app-fixes.js â€” IDEOL Filo ERP
 * Sidebar collapse, mobile toggle, personel tabs, PDF font, searchable dropdowns, quick search
 * All code runs AFTER DOMContentLoaded to avoid conflicts with ui-manager.js
 */

'use strict';

// ============================================
// ICON FALLBACK SYSTEM
// ============================================

(function() {
  'use strict';
  
  // Inline SVG fallbacks for missing icons
  const iconFallbacks = {
    'dashboard': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    'car': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
    'users': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    'file-text': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    'calendar': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'clock': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'alert-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    'loader-2': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    'truck': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    'map-pin': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    'dollar-sign': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  };
  
  // Fix function
  window.fixLucideIcons = function() {
    let fixedCount = 0;
    document.querySelectorAll('[data-lucide]').forEach(el => {
      const iconName = el.getAttribute('data-lucide');
      
      // Skip if already rendered
      if (el.children.length > 0) return;
      
      // Apply fallback
      if (iconFallbacks[iconName]) {
        el.innerHTML = iconFallbacks[iconName];
        el.classList.add('lucide-fallback');
        fixedCount++;
      } else {
        // Generic circle fallback
        console.warn(`[Icon Fix] No fallback for: ${iconName}`);
        el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {

    }
  };
  

  
})();

document.addEventListener('DOMContentLoaded', function () {
    initMobileSidebar();
    initSidebarCollapse();
    initSearchableSelects();
    initQuickSearch();
    initPersonelModule();
    initMobilePreviewToggle();
    schedulePDFFontLoad();
    initGlobalHaptics();
});

// ============================================================
// HAPTIC FEEDBACK (PWA Native Feel)
// ============================================================
window.triggerHaptic = function(duration = 15) {
    if (navigator.vibrate) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            // Safari/iOS may not support vibrate initially, ignore errors
        }
    }
};

function initGlobalHaptics() {
    document.addEventListener('click', function(e) {
        // Trigger soft haptic on interactive elements
        const clickable = e.target.closest('button, a, .dashboard-card, .menu-item, .nav-item, tr');
        if (clickable && !clickable.disabled) {
            window.triggerHaptic(10);
        }
    });

    // Sync Bottom Nav Active State with mutation observer on main-modules
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (!target.classList.contains('hidden') && target.id.startsWith('module-')) {
                    syncBottomNav(target.id);
                }
            }
        });
    });

    document.querySelectorAll('.main-module').forEach(mod => {
        observer.observe(mod, { attributes: true });
    });
}

function syncBottomNav(moduleId) {
    const navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
    if (!navItems.length) return;
    
    navItems.forEach(btn => {
        btn.classList.remove('active');
        // Check if the button's onclick contains the module id
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(moduleId)) {
            btn.classList.add('active');
        }
    });
}

// ============================================================
// 1. MOBILE SIDEBAR (hamburger + overlay)
// ============================================================
function initMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    if (!sidebar || !hamburger) return;

    // Show hamburger on mobile via CSS, but ensure it exists
    hamburger.style.display = '';

    window._lastSidebarToggle = 0;

    window.toggleMobileSidebar = function () {
        const now = Date.now();
        if (now - window._lastSidebarToggle < 300) return;
        window._lastSidebarToggle = now;

        const isOpen = sidebar.classList.contains('mobile-open');
        if (isOpen) {
            closeMobileSidebar();
        } else {
            sidebar.classList.add('mobile-open');
            if (overlay) { overlay.style.display = 'block'; requestAnimationFrame(() => overlay.classList.add('visible')); }
        }
    };

    window.closeMobileSidebar = function () {
        const now = Date.now();
        if (now - window._lastSidebarToggle < 300) return;
        window._lastSidebarToggle = now;

        sidebar.classList.remove('mobile-open');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 300);
        }
    };

    if (overlay) overlay.addEventListener('click', window.closeMobileSidebar);

    // Close on nav click on mobile
    document.querySelectorAll('#main-nav-buttons .nav-link').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (window.innerWidth <= 768) window.closeMobileSidebar();
        });
    });
}

// ============================================================
// 2. SIDEBAR COLLAPSE (desktop toggle button)
// ============================================================
function initSidebarCollapse() {
    const sidebar = document.getElementById('main-sidebar');
    const main = document.querySelector('main');
    if (!sidebar) return;

    // Inject collapse toggle button into sidebar top
    const collapseBtn = document.createElement('button');
    collapseBtn.id = 'sidebar-collapse-btn';
    collapseBtn.title = 'MenÃ¼yÃ¼ Kapat/AÃ§';
    collapseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    collapseBtn.style.cssText = 'position:fixed;top:1.25rem;left:246px;width:28px;height:28px;border-radius:50%;background:hsl(var(--bg-card));border:1px solid hsl(var(--border-strong));display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:9999;color:hsl(var(--text-secondary));transition:all 0.3s ease;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
    document.body.appendChild(collapseBtn);

    function checkWidth() {
        if(window.innerWidth <= 768) collapseBtn.style.display = 'none';
        else collapseBtn.style.display = 'flex';
    }
    window.addEventListener('resize', checkWidth);
    checkWidth();

    let collapsed = false;
    collapseBtn.addEventListener('click', function () {
        collapsed = !collapsed;
        if (collapsed) {
            sidebar.style.width = '0px';
            sidebar.style.padding = '0';
            sidebar.style.overflow = 'hidden';
            if (main) main.style.marginLeft = '0';
            collapseBtn.style.left = '12px';
            collapseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
        } else {
            sidebar.style.width = '';
            sidebar.style.padding = '';
            sidebar.style.overflow = '';
            if (main) main.style.marginLeft = '';
            collapseBtn.style.left = '246px';
            collapseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        }
    });
}

// ============================================================
// 3. MOBILE PREVIEW TOGGLE (desktop)
// ============================================================
function initMobilePreviewToggle() {
    window.toggleMobilePreview = function () {
        const isPreview = document.body.classList.toggle('mobile-preview-mode');
        const label = document.getElementById('mobile-preview-label');
        const sidebar = document.getElementById('main-sidebar');
        const main = document.querySelector('main');

        if (isPreview) {
            // Add a close banner
            let banner = document.getElementById('mobile-preview-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'mobile-preview-banner';
                banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#f97316,#ea580c);color:white;text-align:center;padding:6px 16px;font-size:0.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:12px;';
                banner.innerHTML = '<span>ðŸ“± Mobil Ã–nizleme Modu (390px)</span><button onclick="window.toggleMobilePreview()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:2px 10px;border-radius:6px;cursor:pointer;font-size:0.7rem;font-weight:700;">âœ• Kapat</button>';
                document.body.prepend(banner);
            }
            banner.style.display = 'flex';
            if (label) label.textContent = 'MasaÃ¼stÃ¼';
            if (sidebar) sidebar.classList.remove('mobile-open');
        } else {
            const banner = document.getElementById('mobile-preview-banner');
            if (banner) banner.style.display = 'none';
            if (label) label.textContent = 'Mobil Ã–nizleme';
        }
    };
}

// ============================================================
// 4. PERSONEL MODULE TAB SWITCH
// ============================================================
function initPersonelModule() {
    window.switchPersonelTab = function (tab) {
        ['puantaj', 'bordro', 'avans'].forEach(function (t) {
            const btn = document.getElementById('per-tab-' + t);
            const content = document.getElementById('per-content-' + t);
            if (btn) {
                if (t === tab) {
                    btn.classList.add('bg-orange-500', 'text-white', 'shadow-lg');
                    btn.classList.remove('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
                } else {
                    btn.classList.remove('bg-orange-500', 'text-white', 'shadow-lg');
                    btn.classList.add('text-gray-400', 'hover:text-white', 'hover:bg-white/5');
                }
            }
            if (content) { content.classList.toggle('hidden', t !== tab); content.classList.toggle('block', t === tab); }
        });

        if (tab === 'puantaj') {
            syncPersonelAyInputs();
            if (typeof fetchSoforMaasBordro === 'function') fetchSoforMaasBordro();
            setTimeout(mirrorPuantajToPersonel, 1500);
        } else if (tab === 'bordro') {
            syncPersonelAyInputs();
            if (typeof fetchSoforMaaslar === 'function') fetchSoforMaaslar();
            setTimeout(mirrorBordroToPersonel, 1500);
        } else if (tab === 'avans') {
            if (typeof fetchSoforFinans === 'function') fetchSoforFinans();
            setTimeout(mirrorAvansToPersonel, 1500);
        }
    };

    window.syncPersonelAy = function () {
        const ay = document.getElementById('personel-ay');
        if (!ay || !ay.value) return;
        syncPersonelAyInputs(ay.value);
        if (typeof fetchSoforMaasBordro === 'function') fetchSoforMaasBordro();
    };
}

function syncPersonelAyInputs(val) {
    const ay = val || document.getElementById('personel-ay')?.value;
    if (!ay) return;
    ['filter-bordro-ay', 'filter-bordro-ay-p', 'filter-maas-ay', 'filter-maas-ay-p'].forEach(function (id) {
        const el = document.getElementById(id); if (el) el.value = ay;
    });
}

function mirrorPuantajToPersonel() {
    const src = document.getElementById('puantaj-cards-grid');
    const dst = document.getElementById('puantaj-cards-grid-p');
    if (src && dst) dst.innerHTML = src.innerHTML;
    mirrorEl('total-net-maas', 'per-total-net-maas');
    mirrorEl('total-net-maas', 'per-kpi-maas');
    mirrorEl('total-avans', 'per-total-avans');
    mirrorEl('total-avans', 'per-kpi-avans');
    mirrorEl('total-ideol-banka', 'per-total-banka');
    mirrorEl('total-ideol-banka', 'per-kpi-banka');
    mirrorEl('total-elden', 'per-total-elden');
    mirrorEl('total-elden', 'per-kpi-elden');
}

function mirrorBordroToPersonel() {
    const src = document.getElementById('sofor-maas-tbody');
    const dst = document.getElementById('per-sofor-maas-tbody');
    if (src && dst) dst.innerHTML = src.innerHTML;
}

function mirrorAvansToPersonel() {
    const src = document.getElementById('sofor-finans-tbody');
    const dst = document.getElementById('per-sofor-finans-tbody');
    if (src && dst) dst.innerHTML = src.innerHTML;
}

function mirrorEl(srcId, dstId) {
    const s = document.getElementById(srcId);
    const d = document.getElementById(dstId);
    if (s && d) d.textContent = s.textContent;
}

// ============================================================
// 5. SEARCHABLE DROPDOWN (custom select)
// ============================================================
function initSearchableSelects() {
    // Convert all <select> elements in modals and forms to searchable dropdowns
    function wrapSelect(select) {
        if (select.dataset.searchable === 'done') return;
        select.dataset.searchable = 'done';
        select.style.display = 'none';

        const wrapper = document.createElement('div');
        wrapper.className = 'searchable-select-wrapper relative';
        wrapper.style.cssText = 'position:relative;';

        const displayBtn = document.createElement('button');
        displayBtn.type = 'button';
        displayBtn.className = 'searchable-select-btn w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm font-medium transition-all text-left';
        displayBtn.style.cssText = 'background:hsl(var(--bg-card-hover));border-color:hsl(var(--border-strong));color:hsl(var(--text-primary));min-height:40px;';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'searchable-select-label flex-1 mr-2 truncate';
        labelSpan.style.color = 'hsl(var(--text-dim))';

        const chevron = document.createElement('span');
        chevron.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
        chevron.style.flexShrink = '0';

        displayBtn.appendChild(labelSpan);
        displayBtn.appendChild(chevron);

        const dropdown = document.createElement('div');
        dropdown.className = 'searchable-select-dropdown hidden';
        dropdown.style.cssText = 'position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;background:hsl(var(--bg-card));border:1px solid hsl(var(--border-strong));border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);overflow:hidden;';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Ara...';
        searchInput.className = 'w-full px-3 py-2 text-sm border-b';
        searchInput.style.cssText = 'background:hsl(var(--bg-card-hover));border-color:hsl(var(--border-dim));color:hsl(var(--text-primary));outline:none;';

        const optionsList = document.createElement('div');
        optionsList.style.cssText = 'max-height:200px;overflow-y:auto;';

        dropdown.appendChild(searchInput);
        dropdown.appendChild(optionsList);
        wrapper.appendChild(displayBtn);
        wrapper.appendChild(dropdown);
        select.parentNode.insertBefore(wrapper, select);

        function renderOptions(filter) {
            optionsList.innerHTML = '';
            Array.from(select.options).forEach(function (opt) {
                if (filter && !opt.text.toLowerCase().includes(filter.toLowerCase()) && !opt.value.toLowerCase().includes(filter.toLowerCase())) return;
                const item = document.createElement('div');
                item.className = 'searchable-select-option px-3 py-2 cursor-pointer text-sm transition-colors';
                item.style.cssText = 'color:hsl(var(--text-primary));';
                item.textContent = opt.text || 'â€”';
                item.dataset.value = opt.value;
                item.addEventListener('mouseenter', function () { item.style.background = 'hsl(var(--bg-card-hover))'; });
                item.addEventListener('mouseleave', function () { item.style.background = ''; });
                item.addEventListener('click', function () {
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    labelSpan.textContent = opt.text || 'â€”';
                    labelSpan.style.color = 'hsl(var(--text-primary))';
                    dropdown.classList.add('hidden');
                    searchInput.value = '';
                    renderOptions('');
                });
                if (opt.value === select.value && select.value) item.style.fontWeight = '700';
                optionsList.appendChild(item);
            });
        }

        function syncLabel() {
            const selected = select.options[select.selectedIndex];
            if (selected && selected.value) {
                labelSpan.textContent = selected.text;
                labelSpan.style.color = 'hsl(var(--text-primary))';
            } else {
                labelSpan.textContent = select.options[0]?.text || 'SeÃ§in...';
                labelSpan.style.color = 'hsl(var(--text-dim))';
            }
        }

        syncLabel();
        renderOptions('');

        displayBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isHidden = dropdown.classList.contains('hidden');
            document.querySelectorAll('.searchable-select-dropdown').forEach(d => d.classList.add('hidden'));
            if (isHidden) {
                dropdown.classList.remove('hidden');
                searchInput.focus();
                renderOptions('');
            }
        });

        searchInput.addEventListener('input', function () { renderOptions(this.value); });
        searchInput.addEventListener('click', function (e) { e.stopPropagation(); });

        document.addEventListener('click', function () { dropdown.classList.add('hidden'); });

        // Observe select changes (e.g., dynamically updated options)
        const mo = new MutationObserver(function () { syncLabel(); renderOptions(searchInput.value); });
        mo.observe(select, { childList: true });

        select.addEventListener('change', syncLabel);
    }

    // Wrap selects inside modals
    function wrapModals() {
        document.querySelectorAll('#general-modal select, .modal-content select').forEach(function (sel) {
            if (sel.size > 1 || sel.multiple) return; // skip multi-select
            wrapSelect(sel);
        });
    }

    // Watch for modal opens
    const modalEl = document.getElementById('general-modal');
    if (modalEl) {
        const mo2 = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.type === 'attributes' && m.attributeName === 'class') {
                    if (!modalEl.classList.contains('hidden')) {
                        setTimeout(wrapModals, 100);
                    }
                }
            });
        });
        mo2.observe(modalEl, { attributes: true });
    }

    // Also wrap any existing selects on page
    wrapModals();
}

// ============================================================
// 6. QUICK SEARCH â€” navigate to module with results
// ============================================================
function initQuickSearch() {
    const searchInput = document.getElementById('top-search');
    if (!searchInput) return;

    let dropdownEl = null;

    const searchableData = [
        { mod: 'module-filo', label: 'Ã–zmal Filo', icon: 'truck', keywords: ['arac', 'plaka', 'filo', 'ozmal', 'servis'] },
        { mod: 'module-taseron', label: 'TaÅŸeron', icon: 'users-2', keywords: ['taseron', 'sefer', 'hakedis'] },
        { mod: 'module-musteri', label: 'MÃ¼ÅŸteri', icon: 'users', keywords: ['musteri', 'fabrika', 'portfoy'] },
        { mod: 'module-cari', label: 'Cari', icon: 'building-2', keywords: ['cari', 'fatura', 'borc', 'odeme'] },
        { mod: 'module-finans', label: 'Finans', icon: 'banknote', keywords: ['finans', 'yakit', 'taseron', 'aylik'] },
        { mod: 'module-personel', label: 'Personel', icon: 'user-cog', keywords: ['personel', 'maas', 'puantaj', 'avans', 'sofor', 'bordro', 'kesinti'] },
        { mod: 'module-raporlar', label: 'Raporlar', icon: 'bar-chart-3', keywords: ['rapor', 'analiz', 'pdf', 'excel', 'gelir', 'gider'] },
        { mod: 'module-teklifler', label: 'Teklifler', icon: 'file-text', keywords: ['teklif', 'sigorta', 'kasko', 'karsilastirma'] },

    ];

    function getModules() {
        return Array.from(document.querySelectorAll('.main-module'));
    }

    function navigateToModule(modId) {
        const btn = document.querySelector('[data-target="' + modId + '"]');
        if (btn) btn.click();
        setTimeout(function () { dropdownEl && dropdownEl.remove(); dropdownEl = null; }, 100);
    }

    function buildDropdown(query) {
        if (dropdownEl) dropdownEl.remove();
        if (!query || query.length < 1) return;

        const q = query.toLowerCase().replace(/ÅŸ/g,'s').replace(/ÄŸ/g,'g').replace(/Ã¼/g,'u').replace(/Ã¶/g,'o').replace(/Ä±/g,'i').replace(/Ã§/g,'c').replace(/Ä°/g,'i');

        const results = searchableData.filter(function (item) {
            return item.label.toLowerCase().includes(query.toLowerCase()) ||
                item.keywords.some(function (kw) { return kw.includes(q) || q.includes(kw.substring(0, 4)); });
        });

        if (results.length === 0) return;

        dropdownEl = document.createElement('div');
        dropdownEl.id = 'search-dropdown';
        dropdownEl.style.cssText = 'position:absolute;top:calc(100% + 8px);left:0;right:0;background:hsl(var(--bg-card));border:1px solid hsl(var(--border-strong));border-radius:14px;box-shadow:0 16px 48px rgba(0,0,0,0.5);z-index:9998;overflow:hidden;min-width:260px;';

        const header = document.createElement('div');
        header.style.cssText = 'padding:8px 12px 4px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:hsl(var(--text-dim));';
        header.textContent = 'ModÃ¼ller';
        dropdownEl.appendChild(header);

        results.forEach(function (item) {
            const row = document.createElement('button');
            row.type = 'button';
            row.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;font-size:0.85rem;font-weight:600;color:hsl(var(--text-primary));border:none;cursor:pointer;background:transparent;transition:background 0.15s;';
            row.innerHTML = '<span style="padding:6px;background:hsl(var(--accent-orange),0.12);border-radius:8px;color:hsl(var(--accent-orange));"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><use href="#lucide-' + item.icon + '"/></svg></span><span>' + item.label + '</span><span style="margin-left:auto;font-size:0.65rem;text-transform:uppercase;letter-spacing:0.05em;color:hsl(var(--text-dim));padding:2px 6px;background:hsl(var(--bg-card-hover));border-radius:4px;">ModÃ¼le Git â†’</span>';
            row.addEventListener('mouseenter', function () { row.style.background = 'hsl(var(--bg-card-hover))'; });
            row.addEventListener('mouseleave', function () { row.style.background = ''; });
            row.addEventListener('click', function () { navigateToModule(item.mod); searchInput.value = ''; });
            dropdownEl.appendChild(row);
        });

        const wrapper = searchInput.closest('.relative') || searchInput.parentElement;
        wrapper.style.position = 'relative';
        wrapper.appendChild(dropdownEl);
    }

    searchInput.addEventListener('input', function () { buildDropdown(this.value.trim()); });
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; } this.value = ''; }
    });
    document.addEventListener('click', function (e) {
        if (dropdownEl && !dropdownEl.contains(e.target) && e.target !== searchInput) { dropdownEl.remove(); dropdownEl = null; }
    });
}

// ============================================================
// 7. PDF TURKCE FONT FIX
// ============================================================
window._pdfFontLoaded = false;
window._pdfFontBase64 = null;

window.loadPDFFont = async function () {
    if (window._pdfFontLoaded) return;
    try {
        const url = 'https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNb4j5Ba_2c7A.ttf';
        const resp = await fetch(url);
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.byteLength; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        window._pdfFontBase64 = btoa(binary);
        window._pdfFontLoaded = true;

    } catch (e) {
        console.warn('[PDF] Font yuklenemedi, fallback kullaniliyor:', e.message);
        window._pdfFontLoaded = true;
    }
};

function schedulePDFFontLoad() {
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () { window.loadPDFFont(); });
    } else {
        setTimeout(function () { window.loadPDFFont(); }, 2000);
    }
}

window.exportRaporPDF = async function (tab) {
    if (!window.jspdf) { alert('jsPDF yuklenemedi.'); return; }
    await window.loadPDFFont();

    const ay = document.getElementById('rapor-ay')?.value || 'rapor';
    const tableIds = { genel: 'rapor-genel-table', arac: 'rapor-arac-table', personel: 'rapor-personel-table', musteri: 'rapor-musteri-table', cari: 'rapor-cari-table' };
    const tabTitles = { genel: 'Genel Ozet', arac: 'Arac Gider', personel: 'Personel Maas', musteri: 'Musteri Sefer', cari: 'Cari Bakiye' };

    const table = document.getElementById(tableIds[tab]);
    if (!table) { alert('Tablo yuklenmedi. Once bir donem secin.'); return; }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        if (window._pdfFontBase64) {
            doc.addFileToVFS('NotoSans.ttf', window._pdfFontBase64);
            doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
        }

        const fontName = window._pdfFontBase64 ? 'NotoSans' : 'helvetica';
        doc.setFont(fontName);
        doc.setFontSize(14);
        doc.text('FILO ERP - ' + (tabTitles[tab] || tab) + ' Raporu', 14, 15);
        doc.setFontSize(9);
        doc.text('Donem: ' + ay, 14, 22);
        doc.text('Olusturulma: ' + new Date().toLocaleDateString('tr-TR'), 14, 28);

        const headers = Array.from(table.querySelectorAll('thead th')).map(function (th) { return th.textContent.trim(); });
        const bodyRows = Array.from(table.querySelectorAll('tbody tr')).map(function (tr) {
            return Array.from(tr.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); });
        }).filter(function (row) { return row.some(function (c) { return c; }); });

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                head: [headers],
                body: bodyRows,
                startY: 33,
                theme: 'striped',
                styles: { font: fontName, fontSize: 7, cellPadding: 3 },
                headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold', fontSize: 8, font: fontName },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { left: 14, right: 14 }
            });
        }

        doc.save('Filo_' + (tabTitles[tab] || tab) + '_' + ay + '.pdf');
    } catch (e) {
        console.error(e);
        alert('PDF hatasi: ' + e.message);
    }
};

// ============================================================
// 8. FIX: Modal null error â€” musteri-arac-tanim
// ============================================================
// Patch openMusteriAracTanim to safely handle pre-selection
document.addEventListener('DOMContentLoaded', function () {
    const _origOpen = window.openMusteriAracTanim;
    if (typeof _origOpen === 'function') {
        window.openMusteriAracTanim = function (musteriId, musteriAdi) {
            _origOpen.call(this, musteriId, musteriAdi);
            // After modal opens, ensure selects are wrapped
            setTimeout(function () {
                const modal = document.getElementById('general-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    modal.querySelectorAll('select').forEach(function (sel) {
                        if (sel.dataset.searchable !== 'done') {
                            if (sel.size <= 1 && !sel.multiple) {
                                // Re-trigger searchable
                                sel.dataset.searchable = '';
                                if (typeof initSearchableSelects === 'function') {
                                    sel.style.display = '';
                                    initSearchableSelects();
                                }
                            }
                        }
                    });
                }
            }, 200);
        };
    }
});
