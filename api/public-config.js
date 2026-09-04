'use strict';

module.exports = function publicConfig(request, response) {
    const supabaseUrl = String(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = String(process.env.anon_key || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
    const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl);
    const validAnonKey = supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.length >= 80;

    response.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (!validUrl || !validAnonKey) {
        return response.status(503).send('window.__BARIS_FLOW_PUBLIC_CONFIG__ = null;');
    }

    const payload = JSON.stringify({ supabaseUrl, supabaseAnonKey }).replace(/</g, '\\u003c');
    return response.status(200).send('window.__BARIS_FLOW_PUBLIC_CONFIG__ = ' + payload + ';');
};
