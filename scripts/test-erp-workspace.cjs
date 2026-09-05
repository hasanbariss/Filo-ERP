const assert = require("node:assert/strict");
const C = require("../erp-workspace-core.js");
const D = require("../erp-workspace-data.js");
const H = require("../hakedis-calculations.js");
const vehicles = [{ id: "v", plaka: "35 ABC", mulkiyet_durumu: "TAŞERON" }],
  customers = [{ id: "c", ad: "Test" }];
const source = [
  {
    id: "p",
    musteri_id: "c",
    arac_id: "v",
    tarih: "2026-09-02",
    vardiya: 2,
    tek: 1,
    gunluk_ucret: 999999,
  },
];
const defs = [
  { id: "d", musteri_id: "c", arac_id: "v", vardiya_fiyat: 100, tek_fiyat: 50 },
];
const rows = C.services(source, defs, vehicles, customers, "2026-09");
assert.equal(rows[0].amount, 250);
assert.equal(rows[0].vehicleClass, "SINIFLANDIRILMAMIŞ");
assert.equal(
  C.services(source, [], vehicles, customers, "2026-09")[0].amount,
  null,
);
assert.equal(C.scenario(rows, "percent", 10)[0].amount, 275);
assert.equal(rows[0].amount, 250);
assert.throws(() => C.scenario(rows, "fixed", -101));
const next = C.services(
  [{ ...source[0], vardiya: 3 }],
  defs,
  vehicles,
  customers,
  "2026-09",
);
const change = C.changes(next, rows)[0];
assert.equal(change.quantity, 100);
assert.equal(change.price, 0);
const higher = C.services(
  source,
  [{ ...defs[0], vardiya_fiyat: 150 }],
  vehicles,
  customers,
  "2026-09",
);
assert.equal(C.changes(higher, rows)[0].price, 100);
assert.equal(C.changes(rows, [])[0].quantity, null);
const owned = C.ownerStatement(rows, [{ toplam_tutar: 40 }], [], H);
assert.equal(owned.net, 210);
const overridden = C.services(
  source,
  [{ ...defs[0], donem: "2026-09", bolge: "Manisa", override_vardiya: 5 }],
  vehicles,
  customers,
  "2026-09",
  { legacy: true, overrides: true },
);
assert.equal(overridden[0].amount, 550);
assert.equal(rows[0].amount, 250);
assert.throws(() => C.quote({ days: 20 }));
assert.equal(
  C.quote({
    days: 20,
    dailyKm: 100,
    emptyKm: 10,
    liters100: 10,
    fuelPrice: 40,
    salary: 20000,
    maintenanceKm: 1,
    fixed: 1000,
    contractorDaily: 2000,
    profit: 10,
  }).owned,
  32000,
);
assert.equal(
  C.inventory(
    [{ id: "a", minimum: 5 }],
    [
      { part_id: "a", quantity: 10 },
      { part_id: "a", quantity: -8 },
    ],
  )[0].need,
  3,
);
assert.throws(() => C.monthBounds("2026-13"));
assert.equal(C.monthBounds("2026-01").previous, "2025-12");
(async () => {
  let calls = 0;
  const db = D.create({
    from() {
      calls++;
      throw Error("unexpected");
    },
  });
  await assert.rejects(
    () => db.insert("musteri_arac_tanimlari", {}),
    /Eski kayıtlara/,
  );
  await assert.rejects(() => db.insert("arac_bakimlari", {}), /Eski kayıtlara/);
  assert.equal(calls, 0);
  console.log(
    "Workspace calculations, missing data, tariff isolation and mutation guard passed.",
  );
})();
