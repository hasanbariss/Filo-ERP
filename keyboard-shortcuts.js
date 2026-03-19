// ============================================================
// KEYBOARD-SHORTCUTS.JS
// Klavye kısayolları - Desktop UX iyileştirmesi
// ============================================================
(function () {
    'use strict';

    // Kısayol tanımları: { 'modifier+key': handlerFn }
    var shortcuts = {};

    function registerShortcuts() {
        shortcuts = {
            // Global
            'Escape': function () {
                // Tüm açık modalleri kapat
                document.querySelectorAll('.modal:not(.hidden), [id$="-modal"]:not(.hidden)').forEach(function (m) {
                    m.classList.add('hidden');
                });
                // Confirm dialog varsa kapat
                var confirmDialog = document.getElementById('confirm-dialog');
                if (confirmDialog && !confirmDialog.classList.contains('hidden')) {
                    confirmDialog.classList.add('hidden');
                }
            },

            'ctrl+b': function () {
                // Sidebar toggle
                var btn = document.getElementById('hamburger-btn') ||
                    document.querySelector('[data-action="toggle-sidebar"]');
                if (btn) btn.click();
            },

            'ctrl+k': function () {
                // Quick search focus (varsa)
                var searchInput = document.querySelector('input[type="search"], input[placeholder*="Ara"], input[placeholder*="ara"]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            },

            // Modül geçişleri (Alt + 1-9)
            'alt+1': function () { switchModule('module-dashboard'); },
            'alt+2': function () { switchModule('module-puantaj'); },
            'alt+3': function () { switchModule('module-musteri'); },
            'alt+4': function () { switchModule('module-taseron'); },
            'alt+5': function () { switchModule('module-arac'); },
            'alt+6': function () { switchModule('module-finans'); },
            'alt+7': function () { switchModule('module-yakit'); },
            'alt+8': function () { switchModule('module-bakim'); },


            // Yardım (Ctrl + /)
            'ctrl+/': function () {
                if (window.Toast) {
                    window.Toast.info(
                        'Ctrl+B: Sidebar  |  Ctrl+K: Arama  |  Esc: Modal kapat  |  Alt+1-9: Modül geçişi',
                        'info',
                        7000
                    );
                }
            }
        };
    }

    function switchModule(moduleId) {
        if (typeof window.showModule === 'function') {
            window.showModule(moduleId);
        } else {
            // Fallback: Nav item'ı bul ve tıkla
            var navItem = document.querySelector('[data-module="' + moduleId + '"], [onclick*="' + moduleId + '"]');
            if (navItem) navItem.click();
        }
    }

    function getKeyCombo(e) {
        var parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');

        var key = e.key;
        // Normalize key names
        if (key === 'Escape') key = 'Escape';
        else if (key === '/') key = '/';
        else key = key.toLowerCase();

        if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
            parts.push(key);
        }

        return parts.join('+');
    }

    document.addEventListener('keydown', function (e) {
        // Input/textarea içindeyse çoğu kısayolu atla (Escape hariç)
        var tag = e.target.tagName;
        var isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
            e.target.isContentEditable;

        var combo = getKeyCombo(e);

        // Escape her zaman çalışır
        if (combo === 'Escape') {
            var handler = shortcuts['Escape'];
            if (handler) { e.preventDefault(); handler(); }
            return;
        }

        // Input içinde modifier gereken kısayollar çalışır (ctrl/alt kombolar)
        if (isInput && !e.ctrlKey && !e.metaKey && !e.altKey) return;

        var fn = shortcuts[combo];
        if (fn) {
            e.preventDefault();
            fn();
        }
    });

    // Modüller yüklendikten sonra shortcut'ları kaydet
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', registerShortcuts);
    } else {
        registerShortcuts();
    }

    window.log && window.log('[Keyboard] Kısayollar aktif. Ctrl+/ ile listele.');

})();
