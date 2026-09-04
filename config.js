// ============================================================
// FILO-ERP CONFIG.JS
// Supabase bağlantısı + güvenlik yardımcıları + utility fonksiyonlar
// ============================================================

// --- Supabase Bağlantı Bilgileri ---
// Public tarayıcı yapılandırması Vercel endpoint'inden çalışma anında gelir.
// Böylece proje bilgileri kaynak kodda ve GitHub'ın güncel dalında tutulmaz.
const runtimePublicConfig = window.__BARIS_FLOW_PUBLIC_CONFIG__ || {};
const processPublicConfig = (typeof process !== 'undefined' && process.env) ? process.env : {};

window.supabaseUrl = String(
    runtimePublicConfig.supabaseUrl || processPublicConfig.VITE_SUPABASE_URL || ''
).trim();
window.supabaseKey = String(
    runtimePublicConfig.supabaseAnonKey || processPublicConfig.VITE_SUPABASE_ANON_KEY || ''
).trim();

if (window.supabaseUrl && window.supabaseKey && window.supabase) {
    window.supabaseClient = window.supabase.createClient(window.supabaseUrl, window.supabaseKey);
} else {
    window.supabaseClient = null;
    document.addEventListener('DOMContentLoaded', function () {
        const errorBox = document.getElementById('auth-error');
        const loginButton = document.getElementById('auth-login-btn');
        if (errorBox) {
            errorBox.textContent = 'Güvenli bağlantı yapılandırması yüklenemedi. Lütfen sayfayı yenileyin.';
            errorBox.classList.remove('hidden');
        }
        if (loginButton) loginButton.disabled = true;
    });
}

// --- Debug Mode ---
// Localhost'ta true, production'da false (console.log kapatılır)
window.DEBUG_MODE = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '';

if (!window.DEBUG_MODE) {
    const noop = function() {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    // console.warn ve console.error açık kalır
}

// Custom logger (her yerden kullanılabilir)
window.log = function() {
    if (window.DEBUG_MODE) {
        console.log.apply(console, ['[FILO-ERP]'].concat(Array.prototype.slice.call(arguments)));
    }
};

// --- XSS Güvenlik Yardımcısı ---
// DOMPurify yüklüyse onu kullan, yoksa basit escape fallback
window.sanitizeHTML = function(dirty) {
    if (!dirty) return '';
    if (typeof dirty !== 'string') dirty = String(dirty);
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br', 'svg', 'circle', 'path'],
            ALLOWED_ATTR: ['class', 'style', 'data-lucide', 'fill', 'viewBox', 'cx', 'cy', 'r', 'stroke', 'stroke-width', 'd']
        });
    }
    // DOMPurify yüklü değilse basit HTML escape (fallback)
    return dirty
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
// Objelerin ve array'lerin içindeki string girdilerini XSS'e karşı temizle (Deep Sanitize)
window.sanitizeDataArray = function(data) {
    if (!data) return data;
    if (typeof data === 'string') return window.sanitizeHTML(data);
    if (Array.isArray(data)) {
        return data.map(item => window.sanitizeDataArray(item));
    }
    if (typeof data === 'object' && data !== null) {
        let cleanObj = {};
        for (let key in data) {
            cleanObj[key] = window.sanitizeDataArray(data[key]);
        }
        return cleanObj;
    }
    return data;
};// --- SQL LIKE Escape ---
// Supabase .filter() veya .ilike() içinde kullanıcı input'u geçerken
window.escapeSQLLike = function(str) {
    return String(str).replace(/[%_\\]/g, '\\$&');
};

// --- Debounce (Arama/Input için) ---
// Fonksiyonu belirtilen ms bekledikten sonra bir kez çalıştırır
window.debounce = function(func, wait) {
    var timeout;
    return function() {
        var context = this;
        var args = arguments;
        var later = function() {
            clearTimeout(timeout);
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// --- Throttle (Scroll/Resize için) ---
// Fonksiyonu belirtilen ms aralıklarla en fazla 1 kez çalıştırır
window.throttle = function(func, limit) {
    var inThrottle;
    return function() {
        if (!inThrottle) {
            func.apply(this, arguments);
            inThrottle = true;
            setTimeout(function() { inThrottle = false; }, limit);
        }
    };
};

// --- Image Optimization (Supabase Storage Transform) ---
// Supabase Storage görsel URL'ini WebP + boyut optimize eder
window.getOptimizedImageUrl = function(url, width) {
    if (!url || typeof url !== 'string') return url;
    if (!url.includes('supabase.co')) return url;
    width = width || 400;
    var transformUrl = url.replace(
        '/storage/v1/object/public/',
        '/storage/v1/render/image/public/'
    );
    return transformUrl + '?width=' + width + '&quality=80&format=webp';
};

/* === EXCEL GÖRÜNÜMÜ JS === */
let excelCurrentData = [];
