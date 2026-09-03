'use strict';

const assert = require('node:assert/strict');
const fuel = require('../fuel-analytics.js');
const infoMobile = require('../api/infomobil.js')._internals;

assert.deepEqual(fuel.periodBounds('week', '2026-09-03'), {
    type: 'week', start: '2026-08-31', end: '2026-09-06', infoStart: '2026-08-31 00:00', infoEnd: '2026-09-06 23:59'
});
assert.deepEqual(fuel.periodBounds('month', '2026-09-03'), {
    type: 'month', start: '2026-09-01', end: '2026-09-30', infoStart: '2026-09-01 00:00', infoEnd: '2026-09-30 23:59'
});
assert.equal(fuel.metrics(50, 2500, 500).litersPer100Km, 10);
assert.equal(fuel.metrics(50, 2500, 500).costPerKm, 5);
assert.deepEqual(fuel.metrics(50, 2500, 0), { litersPer100Km: null, costPerKm: null });
assert.equal(fuel.fingerprint({ arac_id: 'a1', tarih: '2026-09-03', litre: 50, toplam_tutar: 2500, birim_fiyat: 50 }), 'a1|2026-09-03|50.000|2500.00|50.000');
assert.equal(infoMobile.normalizePlate('34 abc 123'), '34ABC123');
assert.ok(infoMobile.plateCandidates('34 ABC 123_DRIVER').includes('34ABC123'));
assert.equal(infoMobile.distanceValue('76,19'), 76.19);
assert.equal(infoMobile.validRange({ start: '2026-09-01 00:00', end: '2026-09-30 23:59' }), true);
assert.equal(infoMobile.validRange({ start: '2026-01-01 00:00', end: '2026-09-30 23:59' }), false);

const rows = fuel.aggregateByVehicle(
    [{ arac_id: 'a1', tarih: '2026-09-03', litre: 50, toplam_tutar: 2500, birim_fiyat: 50 }],
    [{ id: 'a1', plaka: '34 ABC 123' }, { id: 'a2', plaka: '35 TEST 01' }],
    { '34ABC123': 500, '35TEST01': 250 },
    [{ arac_id: 'a1', tarih: '2026-08-03', litre: 45, toplam_tutar: 2250, birim_fiyat: 50 }],
    { '34ABC123': 500 }
);
assert.equal(rows.length, 2);
assert.equal(rows.find(row => row.vehicleId === 'a1').litersPer100Km, 10);
assert.equal(rows.find(row => row.vehicleId === 'a2').costPerKm, 0);

console.log('InfoMobil dönem, plaka, kilometre ve yakıt analiz fixture testleri başarılı.');
