'use strict';

const assert = require('node:assert/strict');
const calc = require('../hakedis-calculations.js');

const base = { musteri_id: 'm1', arac_id: 'a1', bolge: 'Manisa', donem: null, vardiya_fiyat: 100, override_vardiya: 99 };
const september = { musteri_id: 'm1', arac_id: 'a1', bolge: 'Manisa', donem: '2026-09', vardiya_fiyat: 110, override_vardiya: 7 };
const definitions = [base, september];

const augustDef = calc.selectPriceDefinition(definitions, { musteriId: 'm1', aracId: 'a1', bolge: 'Manisa', donem: '2026-08' });
const septemberDef = calc.selectPriceDefinition(definitions, { musteriId: 'm1', aracId: 'a1', bolge: 'Manisa', donem: '2026-09' });
const octoberDef = calc.selectPriceDefinition(definitions, { musteriId: 'm1', aracId: 'a1', bolge: 'Manisa', donem: '2026-10' });
const septemberAgain = calc.selectPriceDefinition(definitions, { musteriId: 'm1', aracId: 'a1', bolge: 'Manisa', donem: '2026-09' });

assert.equal(calc.periodOverride(augustDef, 'override_vardiya', { bolge: 'Manisa', donem: '2026-08', fallback: 5 }), 5);
assert.equal(calc.periodOverride(septemberDef, 'override_vardiya', { bolge: 'Manisa', donem: '2026-09', fallback: 6 }), 7);
assert.equal(calc.periodOverride(octoberDef, 'override_vardiya', { bolge: 'Manisa', donem: '2026-10', fallback: 8 }), 8);
assert.equal(calc.periodOverride(septemberAgain, 'override_vardiya', { bolge: 'Manisa', donem: '2026-09', fallback: 6 }), 7);
assert.equal(calc.periodOverride(septemberDef, 'override_vardiya', { bolge: 'İzmir', donem: '2026-09', fallback: 4 }), 4);
assert.equal(augustDef.vardiya_fiyat, 100);
assert.equal(septemberDef.vardiya_fiyat, 110);
assert.equal(octoberDef.vardiya_fiyat, 100);

const excluded = calc.normalizeManualLine({ tutar: 100, kdv_oran: 20, kdv_dahil: false, tev_oran: 0 });
assert.deepEqual(excluded, { matrah: 100, kdv: 20, tev: 0, toplam: 120 });

const included = calc.normalizeManualLine({ tutar: 120, kdv_oran: 20, kdv_dahil: true, tev_oran: 0 });
assert.equal(included.matrah, 100);
assert.equal(included.kdv, 20);
assert.equal(included.toplam, 120);

const withheld = calc.normalizeManualLine({ tutar: 100, kdv_oran: 20, kdv_dahil: false, tev_oran: 5 });
assert.deepEqual(withheld, { matrah: 100, kdv: 20, tev: 5, toplam: 115 });

const mixed = calc.calculateTotals({
    serviceBrut: 1000,
    serviceKdv: 200,
    serviceTev: 50,
    yakit: 100,
    manualLines: [{ tip: 'gider', tutar: 120, kdv_oran: 20, kdv_dahil: true, tev_oran: 5 }]
});
assert.equal(mixed.matrah, 900);
assert.equal(mixed.kdv, 180);
assert.equal(mixed.tev, 45);
assert.equal(mixed.net, 935);

console.log('Hakediş dönem izolasyonu ve vergi hesap fixture testleri başarılı.');
