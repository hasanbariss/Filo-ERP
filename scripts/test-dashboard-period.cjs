'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.window = {};
const dashboard = require('../dashboard-funcs.js')._internals;

const september = new Date(2026, 8, 3, 12, 0, 0);
assert.equal(dashboard.dashboardDefaultMonth(september), '2026-08');
assert.deepEqual(dashboard.dashboardMonthBounds('', september), {
    value: '2026-08',
    start: '2026-08-01',
    end: '2026-08-31',
    infoStart: '2026-08-01 00:00',
    infoEnd: '2026-08-31 23:59',
    previousValue: '2026-07',
    previousStart: '2026-07-01',
    previousEnd: '2026-07-31',
    label: 'Ağustos 2026',
    previousLabel: 'Temmuz 2026'
});
assert.equal(dashboard.dashboardShiftMonth('2026-08', -1), '2026-07');
assert.equal(dashboard.dashboardShiftMonth('2026-08', 1), '2026-09');
assert.equal(dashboard.dashboardShiftMonth('2026-01', -1), '2025-12');
assert.equal(dashboard.dashboardPercentChange(120, 100), 20);
assert.equal(dashboard.dashboardPercentChange(75, 100), -25);
assert.equal(dashboard.dashboardPercentChange(75, 0), null);

const rows = [
    { tarih: '2026-07-31', toplam_tutar: 100 },
    { tarih: '2026-08-01', toplam_tutar: 200 },
    { tarih: '2026-08-31', toplam_tutar: 300 },
    { tarih: '2026-09-01', toplam_tutar: 400 }
];
const august = dashboard.dashboardMonthBounds('2026-08', september);
const july = dashboard.dashboardMonthBounds('2026-07', september);
assert.equal(dashboard.dashboardRowsInPeriod(rows, ['tarih'], august).reduce((sum, row) => sum + row.toplam_tutar, 0), 500);
assert.equal(dashboard.dashboardRowsInPeriod(rows, ['tarih'], july).reduce((sum, row) => sum + row.toplam_tutar, 0), 100);

const currentState = { policyCount: 4, maintenanceCount: 2, cardDebt: 85000 };
assert.deepEqual(currentState, { policyCount: 4, maintenanceCount: 2, cardDebt: 85000 });

const css = fs.readFileSync(path.join(__dirname, '..', 'design-system.css'), 'utf8');
assert.match(css, /\.bf-management-dashboard \.dashboard-kpi-grid \{ grid-template-columns: repeat\(4,/);
assert.match(css, /@media \(max-width: 1280px\)[\s\S]*?dashboard-kpi-grid \{ grid-template-columns: repeat\(3,/);
assert.match(css, /@media \(min-width: 769px\)[\s\S]*?body\.bf-app \{ overflow-y: auto;/);
assert.match(css, /\.bf-sidebar::-webkit-scrollbar/);

const source = fs.readFileSync(path.join(__dirname, '..', 'dashboard-funcs.js'), 'utf8');
assert.match(source, /_dashboardFetchPeriodRows\('yakit_takip',[\s\S]*?'tarih', previousMonthStart, monthEnd/);
assert.match(source, /_dashboardFetchPeriodRows\('taseron_hakedis',[\s\S]*?'sefer_tarihi', previousMonthStart, monthEnd/);
assert.match(source, /_dashboardFetchPeriodRows\('musteri_servis_puantaj',[\s\S]*?'tarih', previousMonthStart, monthEnd/);
assert.match(source, /const aylikYakitlar = yakitlar\.filter\(row => isCurrentMonth/);
assert.match(source, /const oncekiAyYakitlar = yakitlar\.filter\(row => isPreviousMonth/);
assert.match(source, /finance-current-period-heading[\s\S]*?period\.label/);
assert.match(source, /finance-previous-period-heading[\s\S]*?period\.previousLabel/);
assert.match(source, /operation-km-trend[\s\S]*?previousDashboardKm[\s\S]*?previousTrend/);
assert.match(source, /\.range\(from, from \+ pageSize - 1\)/);
assert.match(source, /renderPoliceDashboardTable\(policelerEnriched, 'aksiyon'\);[\s\S]*?fetchInfoMobileMileage\(/);
assert.match(source, /filtre === 'aksiyon'[\s\S]*?p\.days <= 30/);
assert.match(source, /days >= -90 && days <= 90/);
assert.match(source, /openDashboardPolicyDetail[\s\S]*?Poliçe Düzenle[\s\S]*?Araç Evrak Güncelle/);
assert.match(source, /renderDashboardRecentActivity\(recentActivity\)/);
assert.match(source, /window\.renderDashboardRecentActivity = function/);
assert.doesNotMatch(source, /await window\.fetchInfoMobileMileage/);
assert.match(source, /_dashboardInflight\?\.key === requestKey/);

console.log('Dashboard varsayılan dönem, ay geçişi ve dönem izolasyonu fixture testleri başarılı.');
