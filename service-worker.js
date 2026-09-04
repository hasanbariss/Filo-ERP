// ============================================================
// SERVICE-WORKER.JS
// PWA offline destek + statik asset caching
// ============================================================

var CACHE_NAME = 'filo-erp-v1.0.30';

var STATIC_ASSETS = [
    '/filoyonetim.html',
    '/style.css',
    '/design-system.css?v=2.0.10',
    '/config.js',
    '/company-branding.js',
    '/hakedis-calculations.js',
    '/teklif-management.js',
    '/fuel-analytics.js?v=2.0.1',
    '/data-services.js?v=2.0.3',
    '/ui-manager.js?v=2.0.4',
    '/fuel-analytics-ui.js?v=2.0.3',
    '/import-calendar.js',
    '/operasyon-merkezi.js',
    '/app-fixes.js?v=2.0.1',
    '/ios-mobile.js?v=2.0.1',
    '/dashboard-funcs.js?v=2.0.4',
    '/cache-manager.js',
    '/toast-manager.js',
    '/manifest.json'
];

// --- Install: Statik dosyaları cache'le ---
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('[SW] Statik dosyalar cache\'leniyor...');
            // addAll yerine tek tek ekle, bir dosya hata verse tümü başarısız olmasın
            return Promise.allSettled(
                STATIC_ASSETS.map(function (url) {
                    return cache.add(url).catch(function (err) {
                        console.warn('[SW] Cache eklenemedi:', url, err);
                    });
                })
            );
        })
    );
    self.skipWaiting();
});

// --- Activate: Eski cache'leri temizle ---
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames
                    .filter(function (name) { return name !== CACHE_NAME; })
                    .map(function (name) {
                        console.log('[SW] Eski cache siliniyor:', name);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// --- Fetch: Strateji belirle ---
self.addEventListener('fetch', function (event) {
    var url;
    try { url = new URL(event.request.url); } catch (e) { return; }

    // POST / non-GET istekler → her zaman network
    if (event.request.method !== 'GET') return;

    // Supabase API → Doğrudan Network (Asla cache'lenmez, canlı data şart)
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Runtime config ve diğer sunucu fonksiyonları hiçbir zaman cache'lenmez.
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request, { cache: 'no-store' }));
        return;
    }

    // CDN kaynakları (jsdelivr, unpkg vb.) → Network First
    if (url.hostname.includes('jsdelivr') || url.hostname.includes('unpkg') ||
        url.hostname.includes('cdn') || url.hostname.includes('sentry')) {
        event.respondWith(
            fetch(event.request).catch(function () {
                return caches.match(event.request);
            })
        );
        return;
    }

    // Kendi statik dosyaları → Network First, hiç yoksa Cache
    event.respondWith(
        fetch(event.request)
            .then(function (response) {
                if (response && response.status === 200) {
                    var cloned = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, cloned);
                    });
                }
                return response;
            })
            .catch(function () {
                return caches.match(event.request);
            })
    );
});
