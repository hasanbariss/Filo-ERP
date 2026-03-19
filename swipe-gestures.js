// ============================================================
// SWIPE-GESTURES.JS
// Mobil modül geçişi + pull-to-refresh
// ============================================================
(function () {
    'use strict';

    // --- Modül sırası (swipe navigation için) ---
    var MODULE_ORDER = [
        'module-dashboard',
        'module-puantaj',
        'module-musteri',
        'module-taseron',
        'module-arac',
        'module-finans',
        'module-yakit',
        'module-bakim'
    ];

    var SWIPE_THRESHOLD = 75;    // px cinsinden minimum yatay swipe
    var VERTICAL_LIMIT = 60;     // px - bu kadar dikey hareket varsa yatay swipe sayılmaz

    var touchStartX = 0;
    var touchStartY = 0;
    var isSwiping = false;

    function getCurrentModuleIndex() {
        for (var i = 0; i < MODULE_ORDER.length; i++) {
            var el = document.getElementById(MODULE_ORDER[i]);
            if (el && !el.classList.contains('hidden')) return i;
        }
        return 0;
    }

    function navigateTo(index) {
        if (index < 0 || index >= MODULE_ORDER.length) return;
        var moduleId = MODULE_ORDER[index];
        if (typeof window.showModule === 'function') {
            window.showModule(moduleId);
        }
        // Haptic feedback (desteklenen cihazlarda)
        if (window.navigator.vibrate) {
            window.navigator.vibrate(15);
        }
    }

    // Dokunulmaması gereken elementler
    function isScrollableTarget(el) {
        if (!el) return false;
        var tag = el.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
            tag === 'BUTTON' || tag === 'A') return true;
        if (el.closest('table, .overflow-x-auto, .overflow-y-auto, .scrollable, [data-no-swipe]')) return true;
        return false;
    }

    document.addEventListener('touchstart', function (e) {
        if (isScrollableTarget(e.target)) { isSwiping = false; return; }
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isSwiping = true;
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!isSwiping) return;
        isSwiping = false;

        var dx = e.changedTouches[0].screenX - touchStartX;
        var dy = Math.abs(e.changedTouches[0].screenY - touchStartY);

        // Dikey hareket fazlaysa → scroll, swipe sayma
        if (dy > VERTICAL_LIMIT) return;
        // Yatay hareket yeterliyse → modül geçişi
        if (Math.abs(dx) < SWIPE_THRESHOLD) return;

        var current = getCurrentModuleIndex();
        if (dx < 0) {
            // Sola swipe → sonraki modül
            navigateTo(current + 1);
        } else {
            // Sağa swipe → önceki modül
            navigateTo(current - 1);
        }
    }, { passive: true });

    // --- Pull-to-Refresh ---
    var pullStartY = 0;
    var pulling = false;
    var PULL_THRESHOLD = 90;
    var MAX_INDICATOR_MOVE = 100;

    var indicator = (function () {
        var div = document.createElement('div');
        div.id = 'pull-refresh-indicator';
        div.setAttribute('aria-hidden', 'true');
        div.style.cssText = [
            'position:fixed',
            'top:-56px',
            'left:50%',
            'transform:translateX(-50%)',
            'width:40px',
            'height:40px',
            'background:rgba(59,130,246,.92)',
            'border-radius:50%',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'z-index:10001',
            'transition:top .25s cubic-bezier(.4,0,.2,1),opacity .25s',
            'box-shadow:0 4px 20px rgba(59,130,246,.4)',
            'opacity:0',
            'pointer-events:none'
        ].join(';');
        div.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
        document.body.appendChild(div);
        return div;
    })();

    var refreshTimeout = null;

    document.addEventListener('touchstart', function (e) {
        if (window.scrollY === 0 && !isScrollableTarget(e.target)) {
            pullStartY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
        if (!pulling || window.scrollY > 0) return;
        var dist = e.touches[0].clientY - pullStartY;
        if (dist <= 0) return;

        var progress = Math.min(dist / PULL_THRESHOLD, 1);
        var move = Math.min(dist * 0.45, MAX_INDICATOR_MOVE / 2);

        indicator.style.top = move + 'px';
        indicator.style.opacity = String(progress);
        indicator.querySelector('svg').style.transform = 'rotate(' + (progress * 270) + 'deg)';
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!pulling) return;
        pulling = false;

        var dist = e.changedTouches[0].clientY - pullStartY;

        if (dist >= PULL_THRESHOLD && window.scrollY === 0) {
            // Yeterince çekildiyse refresh tetikle
            indicator.style.top = '16px';
            indicator.style.opacity = '1';

            if (window.navigator.vibrate) window.navigator.vibrate(25);

            // Aktif modülü belirle ve refresh et
            var current = document.querySelector('[id^="module-"]:not(.hidden)');
            var moduleId = current ? current.id : null;

            var refreshFn = null;
            if (moduleId === 'module-dashboard' && window.fetchDashboard) refreshFn = window.fetchDashboard;
            else if (moduleId === 'module-arac' && window.fetchAraclar) refreshFn = window.fetchAraclar;
            else if (moduleId === 'module-puantaj' && window.fetchSoforPuantaj) refreshFn = window.fetchSoforPuantaj;
            else if (moduleId === 'module-musteri' && window.fetchMusteriler) refreshFn = window.fetchMusteriler;
            else if (moduleId === 'module-finans' && window.fetchSoforFinans) refreshFn = window.fetchSoforFinans;
            else if (moduleId === 'module-yakit' && window.fetchYakitlar) refreshFn = window.fetchYakitlar;
            else if (moduleId === 'module-bakim' && window.fetchBakimlar) refreshFn = window.fetchBakimlar;

            var hideIndicator = function () {
                indicator.style.top = '-56px';
                indicator.style.opacity = '0';
            };

            if (refreshFn) {
                Promise.resolve(refreshFn()).then(function () {
                    if (window.Toast) window.Toast.success('Veriler güncellendi');
                    setTimeout(hideIndicator, 600);
                }).catch(function () {
                    setTimeout(hideIndicator, 400);
                });
            } else {
                setTimeout(hideIndicator, 600);
            }
        } else {
            // Yeterince çekilmediyse indicator'ı geri al
            indicator.style.top = '-56px';
            indicator.style.opacity = '0';
        }
    }, { passive: true });

    window.log && window.log('[Swipe] Swipe gestures + pull-to-refresh aktif');

})();
