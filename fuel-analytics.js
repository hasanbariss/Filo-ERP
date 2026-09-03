(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.FuelAnalytics = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function number(value) {
        var parsed = typeof value === 'number' ? value : Number(String(value == null ? '' : value).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function normalizePlate(value) {
        return String(value || '').toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9ÇĞİÖŞÜ]/g, '');
    }

    function isoDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function todayIstanbul() {
        var parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        var get = function (type) { return parts.find(function (part) { return part.type === type; }).value; };
        return get('year') + '-' + get('month') + '-' + get('day');
    }

    function parseAnchor(value) {
        var safe = /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : todayIstanbul();
        return new Date(safe + 'T12:00:00Z');
    }

    function periodBounds(type, anchorValue) {
        var anchor = parseAnchor(anchorValue);
        var start = new Date(anchor);
        var end = new Date(anchor);
        if (type === 'week') {
            var day = start.getUTCDay();
            start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
            end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 6);
        } else {
            start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
            end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
        }
        return {
            type: type === 'week' ? 'week' : 'month',
            start: isoDate(start),
            end: isoDate(end),
            infoStart: isoDate(start) + ' 00:00',
            infoEnd: isoDate(end) + ' 23:59'
        };
    }

    function previousBounds(bounds) {
        var start = parseAnchor(bounds.start);
        var end = parseAnchor(bounds.end);
        if (bounds.type === 'week') {
            start.setUTCDate(start.getUTCDate() - 7);
            end.setUTCDate(end.getUTCDate() - 7);
        } else {
            start = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1, 12));
            end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12));
        }
        return {
            type: bounds.type,
            start: isoDate(start),
            end: isoDate(end),
            infoStart: isoDate(start) + ' 00:00',
            infoEnd: isoDate(end) + ' 23:59'
        };
    }

    function metrics(liters, cost, km) {
        var totalLiters = number(liters);
        var totalCost = number(cost);
        var totalKm = number(km);
        if (totalKm <= 0) return { litersPer100Km: null, costPerKm: null };
        return {
            litersPer100Km: totalLiters >= 0 ? (totalLiters / totalKm) * 100 : null,
            costPerKm: totalCost >= 0 ? totalCost / totalKm : null
        };
    }

    function summarizeFuelRows(rows) {
        var safeRows = Array.isArray(rows) ? rows : [];
        var liters = safeRows.reduce(function (sum, row) { return sum + number(row && row.litre); }, 0);
        var cost = safeRows.reduce(function (sum, row) { return sum + number(row && row.toplam_tutar); }, 0);
        return { liters: liters, cost: cost, count: safeRows.length, averageUnitPrice: liters > 0 ? cost / liters : null };
    }

    function fingerprint(row) {
        return [
            String(row && (row.arac_id || row.vehicleId) || ''),
            String(row && (row.tarih || row.date) || '').slice(0, 10),
            number(row && (row.litre || row.liters)).toFixed(3),
            number(row && (row.toplam_tutar || row.cost)).toFixed(2),
            number(row && (row.birim_fiyat || row.unitPrice)).toFixed(3)
        ].join('|');
    }

    function validateFuelRow(row) {
        var errors = [];
        if (!row || !row.arac_id) errors.push('Plaka mevcut araçlarla eşleşmedi.');
        var dateValue = String(row && row.tarih || '');
        var dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        var parsedDate = dateMatch ? new Date(dateValue + 'T12:00:00Z') : null;
        if (!dateMatch || !parsedDate || Number.isNaN(parsedDate.getTime()) || isoDate(parsedDate) !== dateValue) errors.push('Tarih geçersiz.');
        if (number(row && row.litre) <= 0) errors.push('Litre sıfırdan büyük olmalı.');
        if (number(row && row.toplam_tutar) <= 0) errors.push('Toplam tutar sıfırdan büyük olmalı.');
        if (number(row && row.birim_fiyat) <= 0) errors.push('Litre fiyatı sıfırdan büyük olmalı.');
        return errors;
    }

    function planImport(rows, existingRows) {
        var fileFingerprints = new Set();
        var databaseFingerprints = new Set((existingRows || []).map(fingerprint));
        var result = { valid: [], invalid: [], fileDuplicates: [], databaseDuplicates: [] };
        (rows || []).forEach(function (row) {
            var errors = validateFuelRow(row);
            if (errors.length) return result.invalid.push({ row: row, errors: errors });
            var key = fingerprint(row);
            if (fileFingerprints.has(key)) return result.fileDuplicates.push(row);
            fileFingerprints.add(key);
            if (databaseFingerprints.has(key)) return result.databaseDuplicates.push(row);
            result.valid.push(row);
        });
        return result;
    }

    function similarFuelRecords(rows, candidate) {
        return (rows || []).filter(function (row) {
            return String(row.arac_id || '') === String(candidate && candidate.arac_id || '') &&
                String(row.tarih || '').slice(0, 10) === String(candidate && candidate.tarih || '').slice(0, 10) &&
                Math.abs(number(row.litre) - number(candidate && candidate.litre)) <= 0.01 &&
                Math.abs(number(row.toplam_tutar) - number(candidate && candidate.toplam_tutar)) <= 0.01;
        });
    }

    function percentChange(current, previous) {
        var now = number(current);
        var before = number(previous);
        return before > 0 ? ((now - before) / before) * 100 : null;
    }

    function aggregateByVehicle(fuelRows, vehicles, mileageByPlate, previousFuelRows, previousMileageByPlate) {
        var vehicleById = new Map((vehicles || []).map(function (vehicle) { return [String(vehicle.id), vehicle]; }));
        var grouped = new Map();
        (vehicles || []).forEach(function (vehicle) {
            var plate = vehicle && vehicle.plaka ? vehicle.plaka : 'Eşleşmemiş';
            var normalized = normalizePlate(plate) || 'ESLESMEMIS';
            grouped.set(normalized, { plate: plate, vehicleId: vehicle && vehicle.id, current: [], previous: [] });
        });
        function add(rows, key) {
            (rows || []).forEach(function (row) {
                var vehicle = vehicleById.get(String(row.arac_id));
                var plate = vehicle && vehicle.plaka ? vehicle.plaka : (row.araclar && row.araclar.plaka) || 'Eşleşmemiş';
                var normalized = normalizePlate(plate) || 'ESLESMEMIS';
                var current = grouped.get(normalized) || { plate: plate, vehicleId: vehicle && vehicle.id, current: [], previous: [] };
                current[key].push(row);
                grouped.set(normalized, current);
            });
        }
        add(fuelRows, 'current');
        add(previousFuelRows, 'previous');
        return Array.from(grouped.entries()).map(function (entry) {
            var normalized = entry[0];
            var group = entry[1];
            var current = summarizeFuelRows(group.current);
            var previous = summarizeFuelRows(group.previous);
            var km = number(mileageByPlate && mileageByPlate[normalized]);
            var previousKm = number(previousMileageByPlate && previousMileageByPlate[normalized]);
            var currentMetrics = current.count > 0 ? metrics(current.liters, current.cost, km) : { litersPer100Km: null, costPerKm: null };
            var previousMetrics = previous.count > 0 ? metrics(previous.liters, previous.cost, previousKm) : { litersPer100Km: null, costPerKm: null };
            return {
                plate: group.plate,
                normalizedPlate: normalized,
                vehicleId: group.vehicleId || null,
                km: km,
                liters: current.liters,
                cost: current.cost,
                averageUnitPrice: current.averageUnitPrice,
                receiptCount: current.count,
                litersPer100Km: currentMetrics.litersPer100Km,
                costPerKm: currentMetrics.costPerKm,
                kmChangePercent: km > 0 && previousKm > 0 ? percentChange(km, previousKm) : null,
                consumptionChangePercent: currentMetrics.litersPer100Km !== null && previousMetrics.litersPer100Km !== null
                    ? percentChange(currentMetrics.litersPer100Km, previousMetrics.litersPer100Km) : null
            };
        }).sort(function (a, b) { return b.cost - a.cost; });
    }

    return {
        normalizePlate: normalizePlate,
        periodBounds: periodBounds,
        previousBounds: previousBounds,
        todayIstanbul: todayIstanbul,
        metrics: metrics,
        summarizeFuelRows: summarizeFuelRows,
        fingerprint: fingerprint,
        validateFuelRow: validateFuelRow,
        planImport: planImport,
        similarFuelRecords: similarFuelRecords,
        percentChange: percentChange,
        aggregateByVehicle: aggregateByVehicle
    };
});
