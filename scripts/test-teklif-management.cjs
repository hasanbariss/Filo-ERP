'use strict';

const assert = require('node:assert/strict');
const teklif = require('../teklif-management.js');

const offers = [
    { id: 'A', cari_id: 'c1', secildi: false, secenekler: { durum: 'Taslak' } },
    { id: 'B', cari_id: 'c1', secildi: false, secenekler: { durum: 'Gönderildi' } },
    { id: 'C', cari_id: 'c1', secildi: false, secenekler: { durum: 'Taslak' } }
];

const firstApproval = teklif.transition(offers[1], 'Onaylandı', '2026-09-03T10:00:00.000Z');
assert.equal(firstApproval.shouldCreatePolicy, true);
const policies = [];
if (firstApproval.shouldCreatePolicy) policies.push({ teklif_id: offers[1].id, cari_id: offers[1].cari_id });
offers[1] = { ...offers[1], secildi: true, secenekler: firstApproval.options };
assert.equal(offers.filter(item => teklif.getStatus(item) === 'Onaylandı').length, 1);
assert.equal(teklif.getStatus(offers[0]), 'Taslak');
assert.equal(teklif.getStatus(offers[2]), 'Taslak');

const secondApproval = teklif.transition(offers[1], 'Onaylandı', '2026-09-03T10:01:00.000Z');
assert.equal(secondApproval.shouldCreatePolicy, false);
assert.equal(secondApproval.alreadyProcessed, true);
if (secondApproval.shouldCreatePolicy) policies.push({ teklif_id: offers[1].id, cari_id: offers[1].cari_id });
assert.deepEqual(policies, [{ teklif_id: 'B', cari_id: 'c1' }]);

const rejected = teklif.transition(offers[0], 'Reddedildi', '2026-09-03T10:02:00.000Z');
assert.equal(rejected.shouldCreatePolicy, false);
assert.equal(rejected.status, 'Reddedildi');

const cancelled = teklif.transition(offers[2], 'İptal', '2026-09-03T10:03:00.000Z');
assert.equal(cancelled.shouldCreatePolicy, false);
assert.equal(cancelled.status, 'İptal');

const totals = teklif.calculateTotals([
    { aciklama: 'Trafik poliçesi', miktar: 1, birim_fiyat: 1000, kdv_oran: 20 },
    { aciklama: 'Ek hizmet', miktar: 2, birim_fiyat: 100, kdv_oran: 10 }
]);
assert.equal(totals.araToplam, 1200);
assert.equal(totals.kdv, 220);
assert.equal(totals.genelToplam, 1420);

console.log('Teklif durum, idempotency ve kalem hesap fixture testleri başarılı.');
