'use strict';

const assert = require('node:assert/strict');
const report = require('../report-analytics.js');
const hakedis = require('../hakedis-calculations.js');

assert.deepEqual(report.periodBounds('2026-08'), {
    value: '2026-08', start: '2026-08-01', end: '2026-08-31', label: 'Ağustos 2026',
    previousValue: '2026-07', previousStart: '2026-07-01', previousEnd: '2026-07-31', previousLabel: 'Temmuz 2026'
});
assert.equal(report.periodBounds('2026-01').previousValue, '2025-12');
assert.equal(report.percentChange(115, 100), 15);
assert.equal(report.percentChange(80, 100), -20);
assert.equal(report.percentChange(100, 0), null);

const current = {
    fuel: [{ litre: 100, toplam_tutar: 5000 }],
    maintenance: [{ toplam_tutar: 1000 }],
    policies: [{ toplam_tutar: 2000 }],
    payroll: [{ net_maas: 10000 }],
    finance: [{ islem_turu: 'AVANS', tutar: -500 }],
    contractorAccrual: [{ net_hakedis: 12000 }],
    serviceAccrual: [{ gunluk_ucret: 8000, vardiya: 3, tek: 2 }],
    cardTransactions: [{ toplam_tutar: 750 }]
};
const summary = report.summarize(current);
assert.equal(summary.fuelCost, 5000);
assert.equal(summary.fuelLiters, 100);
assert.equal(summary.accrual, 20000);
assert.equal(summary.contractorAccrual, 12000);
assert.equal(summary.serviceAccrual, 8000);
assert.equal(summary.operations, 5);
assert.equal(summary.cardSpend, 750);
assert.equal(summary.totalExpense, 18500);
assert.equal(summary.operatingDifference, 1500);

const vehicleRows = report.groupVehicles(
    { fuel: [{ arac_id:'a1', toplam_tutar:5000, araclar:null }], maintenance:[], policies:[] },
    { fuel: [{ arac_id:'a1', toplam_tutar:4000, araclar:null }], maintenance:[], policies:[] },
    [{ id:'a1', plaka:'34 ABC 123' }]
);
assert.equal(vehicleRows[0].plate, '34 ABC 123');
assert.equal(vehicleRows[0].current.total, 5000);
assert.equal(vehicleRows[0].previous.total, 4000);
assert.equal(vehicleRows[0].change, 25);

const payrollRows = report.groupPayroll(
    [{ sofor_id:'s1', net_maas:10000, avans:1000, ceza:500, haciz:0, soforler:{ad_soyad:'Test Şoför'} }],
    [{ sofor_id:'s1', net_maas:9000, avans:0, ceza:0, haciz:0, soforler:{ad_soyad:'Test Şoför'} }]
);
assert.equal(payrollRows[0].currentPayment, 8500);
assert.equal(payrollRows[0].previousPayment, 9000);

const customerRows = report.groupCustomers(
    [{ id:'m1', ad:'Fabrika A' }],
    [{ musteri_id:'m1', vardiya:2, tek:1, gunluk_ucret:3000 }],
    [{ musteri_id:'m1', vardiya:1, tek:1, gunluk_ucret:2500 }]
);
assert.equal(customerRows[0].current.accrual, 3000);
assert.equal(customerRows[0].change, 20);

const serviceDefinitions = [
    { id:'global', musteri_id:'m1', arac_id:'a1', bolge:'Manisa', donem:null, vardiya_fiyat:900, tek_fiyat:500 },
    { id:'august', musteri_id:'m1', arac_id:'a1', bolge:'Manisa', donem:'2026-08', vardiya_fiyat:1000, tek_fiyat:600 }
];
const serviceRows = report.groupCustomerServices(
    [{ id:'m1', ad:'Fabrika A' }],
    [{ id:'a1', plaka:'45 ABC 123', arac_sinifi:'27+1' }],
    [{ musteri_id:'m1', arac_id:'a1', bolge:'Manisa', vardiya:2, tek:1 }],
    [{ musteri_id:'m1', arac_id:'a1', bolge:'Manisa', vardiya:1, tek:1 }],
    serviceDefinitions, '2026-08', '2026-07', hakedis.selectPriceDefinition
);
assert.equal(serviceRows[0].current.accrual, 2600, 'seçili dönem fiyatı araç gelirinde kullanılmalı');
assert.equal(serviceRows[0].previous.accrual, 1400, 'önceki dönem global fallback fiyatını kullanmalı');
assert.equal(serviceRows[0].details[0].vehicleClass, '27+1');

const profitableVehicles = report.mergeVehicleRevenue(vehicleRows, serviceRows, [{ id:'a1', plaka:'45 ABC 123', arac_sinifi:'27+1' }]);
const profitableA1 = profitableVehicles.find(row => row.id === 'a1');
assert.equal(profitableA1.current.revenue, 2600);
assert.equal(profitableA1.current.net, -2400);

const cariRows = report.groupCaris(
    [{ id:'c1', unvan:'Servis A', tur:'Tamirci' }],
    [{ cari_id:'c1', toplam_tutar:2000 }], [{ cari_id:'c1', tutar:500 }],
    [{ cari_id:'c1', toplam_tutar:1000 }], [{ cari_id:'c1', tutar:250 }]
);
assert.equal(cariRows[0].currentNet, 1500);
assert.equal(cariRows[0].previousNet, 750);
assert.equal(cariRows[0].change, 100);

console.log('Rapor dönem, özet, araç, personel, müşteri ve cari karşılaştırma testleri başarılı.');
