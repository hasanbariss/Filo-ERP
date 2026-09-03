(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.HakedisCalculations = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const numberOrZero = value => {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const normalizedRegion = value => value || 'Manisa';

    function selectPriceDefinition(definitions, { musteriId, aracId, bolge, donem }) {
        const rows = Array.isArray(definitions) ? definitions : [];
        const region = normalizedRegion(bolge);
        const samePair = row => row.musteri_id === musteriId && row.arac_id === aracId;
        const sameRegion = row => normalizedRegion(row.bolge) === region;
        const isGlobal = row => !row.donem;

        return rows.find(row => samePair(row) && sameRegion(row) && row.donem === donem)
            || rows.find(row => samePair(row) && sameRegion(row) && isGlobal(row))
            || rows.find(row => samePair(row) && row.donem === donem)
            || rows.find(row => samePair(row) && isGlobal(row))
            || null;
    }

    function periodOverride(definition, field, { bolge, donem, fallback }) {
        if (!definition) return fallback;
        const isExactPeriod = definition.donem === donem;
        const isExactRegion = normalizedRegion(definition.bolge) === normalizedRegion(bolge);
        const value = definition[field];
        return isExactPeriod && isExactRegion && value !== null && value !== undefined
            ? numberOrZero(value)
            : fallback;
    }

    function normalizeManualLine(line) {
        const tutar = Math.max(0, numberOrZero(line && line.tutar));
        const kdvOran = Math.max(0, numberOrZero(line && line.kdv_oran));
        const tevOran = Math.max(0, numberOrZero(line && line.tev_oran));
        const kdvDahil = Boolean(line && line.kdv_dahil);
        const divisor = 1 + (kdvOran / 100);
        const matrah = kdvDahil && divisor > 0 ? tutar / divisor : tutar;
        const kdv = kdvDahil ? tutar - matrah : matrah * (kdvOran / 100);
        // Existing hakediş behavior applies TEV directly to the taxable base.
        const tev = matrah * (tevOran / 100);
        return { matrah, kdv, tev, toplam: matrah + kdv - tev };
    }

    function calculateTotals({ serviceBrut = 0, serviceKdv = 0, serviceTev = 0, yakit = 0, autoGider = 0, manualLines = [] } = {}) {
        let manualMatrah = 0;
        let manualKdv = 0;
        let manualTev = 0;
        let manualIncomeTotal = 0;
        let manualExpenseTotal = 0;

        (Array.isArray(manualLines) ? manualLines : []).forEach(line => {
            const values = normalizeManualLine(line);
            const isExpense = line && line.tip === 'gider';
            const sign = isExpense ? -1 : 1;
            manualMatrah += sign * values.matrah;
            manualKdv += sign * values.kdv;
            manualTev += sign * values.tev;
            if (isExpense) manualExpenseTotal += values.toplam;
            else manualIncomeTotal += values.toplam;
        });

        const matrah = numberOrZero(serviceBrut) + manualMatrah;
        const kdv = numberOrZero(serviceKdv) + manualKdv;
        const tev = numberOrZero(serviceTev) + manualTev;
        const net = matrah + kdv - tev - numberOrZero(yakit) - numberOrZero(autoGider);

        return {
            matrah,
            kdv,
            tev,
            yakit: numberOrZero(yakit),
            autoGider: numberOrZero(autoGider),
            manualMatrah,
            manualKdv,
            manualTev,
            manualIncomeTotal,
            manualExpenseTotal,
            net
        };
    }

    return { selectPriceDefinition, periodOverride, normalizeManualLine, calculateTotals };
}));
