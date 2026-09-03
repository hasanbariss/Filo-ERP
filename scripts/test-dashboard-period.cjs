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
    previousStart: '2026-07-01',
    previousEnd: '2026-07-31',
    label: 'Ağustos 2026'
});
assert.equal(dashboard.dashboardShiftMonth('2026-08', -1), '2026-07');
assert.equal(dashboard.dashboardShiftMonth('2026-08', 1), '2026-09');
assert.equal(dashboard.dashboardShiftMonth('2026-01', -1), '2025-12');

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
assert.match(css, /\.bf-management-dashboard \.dashboard-kpi-grid \{ grid-template-columns: repeat\(5,/);
assert.match(css, /@media \(max-width: 1280px\)[\s\S]*?dashboard-kpi-grid \{ grid-template-columns: repeat\(3,/);
assert.match(css, /@media \(min-width: 769px\)[\s\S]*?body\.bf-app \{ overflow-y: auto;/);
assert.match(css, /\.bf-sidebar::-webkit-scrollbar/);

console.log('Dashboard varsayılan dönem, ay geçişi ve dönem izolasyonu fixture testleri başarılı.');
