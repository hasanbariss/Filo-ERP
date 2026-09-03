(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.TeklifManagement = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const STATUSES = Object.freeze({
        draft: 'Taslak',
        sent: 'Gönderildi',
        approved: 'Onaylandı',
        rejected: 'Reddedildi',
        cancelled: 'İptal'
    });

    const numberOrZero = value => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    function canonicalStatus(value) {
        const normalized = String(value || '').trim().toLocaleLowerCase('tr-TR');
        if (['onaylandı', 'onaylandi', 'seçildi', 'secildi', 'approved'].includes(normalized)) return STATUSES.approved;
        if (['gönderildi', 'gonderildi', 'sent'].includes(normalized)) return STATUSES.sent;
        if (['reddedildi', 'rejected'].includes(normalized)) return STATUSES.rejected;
        if (['iptal', 'iptal edildi', 'cancelled', 'canceled'].includes(normalized)) return STATUSES.cancelled;
        return STATUSES.draft;
    }

    function getStatus(offer) {
        if (offer && offer.secildi) return STATUSES.approved;
        return canonicalStatus(offer && offer.secenekler && offer.secenekler.durum);
    }

    function canApprove(offer) {
        const status = getStatus(offer);
        return status === STATUSES.draft || status === STATUSES.sent;
    }

    function normalizeLine(line) {
        const miktar = Math.max(0, numberOrZero(line && line.miktar));
        const birimFiyat = Math.max(0, numberOrZero(line && line.birim_fiyat));
        const kdvOran = Math.max(0, numberOrZero(line && line.kdv_oran));
        const araToplam = miktar * birimFiyat;
        const kdvTutar = araToplam * (kdvOran / 100);
        return {
            aciklama: String(line && line.aciklama || '').trim(),
            miktar,
            birim_fiyat: birimFiyat,
            kdv_oran: kdvOran,
            ara_toplam: araToplam,
            kdv_tutar: kdvTutar,
            toplam: araToplam + kdvTutar
        };
    }

    function calculateTotals(lines) {
        const normalizedLines = (Array.isArray(lines) ? lines : []).map(normalizeLine);
        return normalizedLines.reduce((totals, line) => {
            totals.araToplam += line.ara_toplam;
            totals.kdv += line.kdv_tutar;
            totals.genelToplam += line.toplam;
            return totals;
        }, { araToplam: 0, kdv: 0, genelToplam: 0, lines: normalizedLines });
    }

    function transition(offer, nextStatus, at) {
        const status = canonicalStatus(nextStatus);
        const currentStatus = getStatus(offer);
        const shouldCreatePolicy = status === STATUSES.approved && canApprove(offer);
        const options = { ...((offer && offer.secenekler) || {}) };
        const history = Array.isArray(options.gecmis) ? [...options.gecmis] : [];
        if (currentStatus !== status) history.push({ durum: status, tarih: at || new Date().toISOString() });
        options.durum = status;
        options.son_islem = history.length ? history[history.length - 1].tarih : (at || null);
        options.gecmis = history;
        return {
            status,
            options,
            shouldCreatePolicy,
            alreadyProcessed: status === STATUSES.approved && !shouldCreatePolicy
        };
    }

    function displayNumber(offer) {
        const explicit = offer && offer.secenekler && offer.secenekler.teklif_no;
        if (explicit) return String(explicit);
        const date = String(offer && (offer.olusturulma_tarihi || offer.baslangic_tarihi) || '').slice(0, 10).replaceAll('-', '');
        const suffix = String(offer && offer.id || '').replaceAll('-', '').slice(0, 6).toUpperCase();
        return `TKL-${date || 'KAYIT'}-${suffix || '000000'}`;
    }

    return { STATUSES, canonicalStatus, getStatus, canApprove, normalizeLine, calculateTotals, transition, displayNumber };
}));
