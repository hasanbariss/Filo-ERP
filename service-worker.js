// ============================================================
// SERVICE-WORKER.JS
// PWA offline destek + statik asset caching
// ============================================================

var CACHE_NAME = 'filo-erp-v1.0.0';

var STATIC_ASSETS = [
    '/filoyonetim.html',
    '/style.css',
    '/config.js',
    '/data-services.js',
    '/ui-manager.js',
    '/app-fixes.js',
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

    // Supabase API → Network First (cache fallback için offline destek)
    if (url.hostname.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request.clone())
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
                    return caches.match(event.request).then(function (cached) {
                        return cached || new Response(
                            JSON.stringify({ error: 'Offline - cached data not available' }),
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                    });
                })
        );
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

    // Kendi statik dosyaları → Cache First (en hızlı)
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) return cached;
            return fetch(event.request).then(function (response) {
                if (response && response.status === 200) {
                    var cloned = response.clone();
                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, cloned);
                    });
                }
                return response;
            });
        })
    );
});
