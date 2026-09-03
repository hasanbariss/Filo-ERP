'use strict';

const DEFAULT_BASE_URL = 'https://mobilws.infomobil.com.tr/mobilws/services';
const TOKEN_CACHE_MS = 30 * 60 * 1000;
const MAX_VEHICLES_PER_REQUEST = 12;
let cachedToken = null;
let cachedMobiles = null;

function send(response, status, payload) {
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(payload);
}

function normalizePlate(value) {
    return String(value || '').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '');
}

function plateCandidates(alias) {
    const raw = String(alias || '').trim();
    return [...new Set([raw, raw.split('_')[0], raw.split('/')[0], raw.split(' - ')[0]].map(normalizePlate).filter(Boolean))];
}

function config() {
    return {
        baseUrl: String(process.env.INFOMOBIL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
        username: String(process.env.INFOMOBIL_USERNAME || '').trim(),
        password: String(process.env.INFOMOBIL_PASSWORD || '').trim(),
        supabaseUrl: String(process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
        supabaseAnonKey: String(process.env.anon_key || process.env.VITE_SUPABASE_ANON_KEY || '').trim()
    };
}

async function requestJson(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || 20000);
    try {
        const response = await fetch(url, {
            cache: 'no-store',
            headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
            signal: controller.signal
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error('InfoMobil servisi ' + response.status + ' koduyla yanıt verdi.');
        return payload;
    } finally {
        clearTimeout(timeout);
    }
}

async function validateUser(request, settings) {
    const authorization = String(request.headers.authorization || request.headers.Authorization || '');
    if (!authorization.startsWith('Bearer ') || !settings.supabaseUrl || !settings.supabaseAnonKey) return false;
    const response = await fetch(settings.supabaseUrl + '/auth/v1/user', {
        headers: { apikey: settings.supabaseAnonKey, Authorization: authorization },
        signal: AbortSignal.timeout(10000)
    }).catch(() => null);
    return Boolean(response && response.ok);
}

async function getToken(settings, forceRefresh) {
    if (!forceRefresh && cachedToken && cachedToken.account === settings.username && cachedToken.expiresAt > Date.now()) return cachedToken.value;
    let lastError = null;
    for (const path of ['/register', '/']) {
        const url = new URL(settings.baseUrl + path);
        url.searchParams.set('username', settings.username);
        url.searchParams.set('password', settings.password);
        url.searchParams.set('language', 'TR');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(url, {
                method: 'POST',
                cache: 'no-store',
                headers: { Accept: 'application/json', 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
                signal: controller.signal
            });
            const payload = await response.json().catch(() => null);
            const token = payload && typeof payload.token === 'string' ? payload.token.trim() : '';
            if (response.ok && token) {
                cachedToken = { value: token, account: settings.username, expiresAt: Date.now() + TOKEN_CACHE_MS };
                return token;
            }
            lastError = new Error(payload && payload.errorDesc ? payload.errorDesc : 'InfoMobil oturumu açılamadı.');
        } catch (error) {
            lastError = error;
        } finally {
            clearTimeout(timeout);
        }
    }
    throw lastError || new Error('InfoMobil kullanıcı bilgileri doğrulanamadı.');
}

async function getMobiles(settings, forceRefresh) {
    if (!forceRefresh && cachedMobiles && cachedMobiles.expiresAt > Date.now()) return cachedMobiles.value;
    const token = await getToken(settings, forceRefresh);
    const url = new URL(settings.baseUrl + '/mobiles');
    url.searchParams.set('token', token);
    url.searchParams.set('orderParam', 'ALIAS');
    url.searchParams.set('ordering', 'ASC');
    url.searchParams.set('requestTime', String(Date.now()));
    const payload = await requestJson(url, 15000);
    if (!payload || !Array.isArray(payload.mobile)) {
        if (!forceRefresh) {
            cachedToken = null;
            return getMobiles(settings, true);
        }
        throw new Error('InfoMobil araç listesi alınamadı.');
    }
    cachedMobiles = { value: payload.mobile, expiresAt: Date.now() + 5 * 60 * 1000 };
    return cachedMobiles.value;
}

function distanceValue(payload) {
    const raw = payload && typeof payload === 'object' ? payload.distanceKm ?? payload.distance ?? payload.value : payload;
    const value = typeof raw === 'number' ? raw : Number(String(raw == null ? '' : raw).replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) throw new Error('InfoMobil kilometre yanıtı geçersiz.');
    return value;
}

async function getDistance(settings, mobileId, startTime, endTime, forceRefresh) {
    const token = await getToken(settings, forceRefresh);
    const url = new URL(settings.baseUrl + '/sumdistancewithinrange');
    url.searchParams.set('token', token);
    url.searchParams.set('mobiles', mobileId);
    url.searchParams.set('startTime', startTime);
    url.searchParams.set('endTime', endTime);
    url.searchParams.set('requestTime', String(Date.now()));
    try {
        const payload = await requestJson(url, 20000);
        if (payload && typeof payload === 'object' && Number(payload.status) < 0) throw new Error(payload.errorDesc || 'InfoMobil isteği reddedildi.');
        return distanceValue(payload);
    } catch (error) {
        if (!forceRefresh) {
            cachedToken = null;
            return getDistance(settings, mobileId, startTime, endTime, true);
        }
        throw error;
    }
}

function validRange(range) {
    if (!range || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(range.start)) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(String(range.end))) return false;
    const start = Date.parse(String(range.start).replace(' ', 'T') + ':00+03:00');
    const end = Date.parse(String(range.end).replace(' ', 'T') + ':00+03:00');
    return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 32 * 86400000;
}

async function mapWithConcurrency(items, concurrency, task) {
    const output = new Array(items.length);
    let cursor = 0;
    async function worker() {
        while (cursor < items.length) {
            const index = cursor++;
            output[index] = await task(items[index], index);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return output;
}

async function handler(request, response) {
    if (request.method !== 'POST') return send(response, 405, { error: 'Yalnızca POST desteklenir.' });
    const settings = config();
    if (!await validateUser(request, settings)) return send(response, 401, { error: 'Geçerli oturum gerekli.' });
    if (!settings.username || !settings.password) return send(response, 503, { error: 'InfoMobil sunucu ayarları eksik.' });

    const body = request.body && typeof request.body === 'object' ? request.body : {};
    const plates = Array.isArray(body.plates) ? [...new Set(body.plates.map(normalizePlate).filter(Boolean))].slice(0, 200) : [];
    const current = body.current;
    const previous = body.previous;
    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    if (!plates.length || !validRange(current) || !validRange(previous)) return send(response, 400, { error: 'Plaka veya tarih aralığı geçersiz.' });

    try {
        const mobiles = await getMobiles(settings, false);
        const wanted = new Set(plates);
        const matched = [];
        const matchedPlates = new Set();
        for (const mobile of mobiles) {
            const plate = plateCandidates(mobile && mobile.alias).find(candidate => wanted.has(candidate) && !matchedPlates.has(candidate));
            if (!plate || mobile.mobile == null) continue;
            matchedPlates.add(plate);
            matched.push({ plate, mobileId: String(mobile.mobile), alias: String(mobile.alias || '') });
        }
        const batch = matched.slice(offset, offset + MAX_VEHICLES_PER_REQUEST);
        const results = await mapWithConcurrency(batch, 4, async item => {
            try {
                const distances = await Promise.all([
                    getDistance(settings, item.mobileId, current.start, current.end, false),
                    getDistance(settings, item.mobileId, previous.start, previous.end, false)
                ]);
                return { ...item, currentKm: distances[0], previousKm: distances[1], status: 'ready' };
            } catch (error) {
                return { ...item, currentKm: null, previousKm: null, status: 'error', error: 'Dönem kilometresi alınamadı.' };
            }
        });
        return send(response, 200, {
            results,
            matched: matched.length,
            unmatched: plates.filter(plate => !matchedPlates.has(plate)),
            nextOffset: offset + batch.length < matched.length ? offset + batch.length : null
        });
    } catch (error) {
        console.error('[INFOMOBIL]', error instanceof Error ? error.message : 'Bilinmeyen hata');
        return send(response, 502, { error: 'InfoMobil servisine ulaşılamadı.' });
    }
}

module.exports = handler;
module.exports._internals = { normalizePlate, plateCandidates, distanceValue, validRange };
