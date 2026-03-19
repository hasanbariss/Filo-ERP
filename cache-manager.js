// ============================================================
// CACHE-MANAGER.JS
// Supabase query sonuçlarını in-memory cache'ler
// Tekrar eden sorguları önler, quota'yı korur
// ============================================================
(function () {
    'use strict';

    var CACHE_DURATION_MS = 5 * 60 * 1000; // 5 dakika
    var _cache = new Map();

    window.CacheManager = {
        /**
         * Cache'ten değer oku. Yoksa veya süresi dolmuşsa null döner.
         */
        get: function (key) {
            var item = _cache.get(key);
            if (!item) return null;
            if (Date.now() - item.timestamp > CACHE_DURATION_MS) {
                _cache.delete(key);
                window.log && window.log('[Cache] EXPIRED:', key);
                return null;
            }
            window.log && window.log('[Cache] HIT:', key);
            return item.data;
        },

        /**
         * Cache'e değer yaz.
         */
        set: function (key, data) {
            _cache.set(key, { data: data, timestamp: Date.now() });
            window.log && window.log('[Cache] SET:', key);
        },

        /**
         * Belirli bir pattern içeren tüm cache key'lerini temizle.
         * Örnek: invalidate('araclar') → 'araclar:all', 'araclar:özmal' vs. hepsini siler
         */
        invalidate: function (pattern) {
            var deleted = 0;
            _cache.forEach(function (val, key) {
                if (key.indexOf(pattern) !== -1) {
                    _cache.delete(key);
                    deleted++;
                    window.log && window.log('[Cache] INVALIDATE:', key);
                }
            });
            return deleted;
        },

        /**
         * Tüm cache'i temizle.
         */
        clear: function () {
            var count = _cache.size;
            _cache.clear();
            window.log && window.log('[Cache] CLEAR: ' + count + ' entry temizlendi');
        },

        /**
         * Cache istatistiklerini göster (debug için).
         */
        stats: function () {
            var now = Date.now();
            var active = 0;
            _cache.forEach(function (item) {
                if (now - item.timestamp <= CACHE_DURATION_MS) active++;
            });
            return { total: _cache.size, active: active, expired: _cache.size - active };
        }
    };

    /**
     * Wrapper: Cache'de varsa döndür, yoksa queryFn'i çalıştır ve cache'le.
     * Kullanım:
     *   const data = await window.cachedQuery('araclar:all', () =>
     *     supabaseClient.from('araclar').select('*').then(r => r.data)
     *   );
     */
    window.cachedQuery = async function (cacheKey, queryFn) {
        var cached = window.CacheManager.get(cacheKey);
        if (cached !== null) return cached;

        try {
            var result = await queryFn();
            if (result !== null && result !== undefined) {
                window.CacheManager.set(cacheKey, result);
            }
            return result;
        } catch (err) {
            console.warn('[Cache] Query hatası (' + cacheKey + '):', err);
            throw err;
        }
    };

    window.log && window.log('[Cache] Cache Manager hazır');

})();
