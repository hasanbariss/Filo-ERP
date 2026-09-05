const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.route("https://workspace.test/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="background:#0b1422;margin:30px"><div id="module-calisma-dosyalari"></div></body>',
    }),
  );
  await page.goto("https://workspace.test");
  await page.addStyleTag({ path: process.cwd() + "/erp-workspace.css" });
  await page.evaluate(() => {
    const db = {
      araclar: [
        {
          id: "v",
          plaka: "35 TEST 01",
          firma_adi: "Test Sahibi",
          mulkiyet_durumu: "TAŞERON",
          arac_sinifi: "16+1",
          guncel_km: 40000,
        },
        { id: "own", plaka: "35 OWN 01", mulkiyet_durumu: "ÖZMAL" },
      ],
      musteriler: [
        { id: "c", ad: "Test Fabrika <img src=x onerror=alert(1)>" },
      ],
      soforler: [],
      cariler: [{ id: "cari", unvan: "Test Sahibi" }],
      musteri_servis_puantaj: [
        {
          id: "p",
          musteri_id: "c",
          arac_id: "v",
          tarih: "2026-09-01",
          vardiya: 2,
          tek: 1,
          gunluk_ucret: 999999,
        },
        {
          id: "p2",
          musteri_id: "c",
          arac_id: "own",
          tarih: "2026-09-01",
          vardiya: 1,
        },
      ],
      rapor_musteri_fiyatlari: [
        {
          id: "d",
          musteri_id: "c",
          arac_id: "v",
          vardiya_fiyat: 100,
          tek_fiyat: 50,
        },
        { id: "e", musteri_id: "c", arac_id: "own", vardiya_fiyat: 500 },
      ],
      musteri_arac_tanimlari: [
        {
          id: "d",
          musteri_id: "c",
          arac_id: "v",
          vardiya_fiyat: 50,
          tek_fiyat: 20,
        },
      ],
      yakit_takip: [
        {
          id: "f",
          arac_id: "v",
          tarih: "2026-09-02",
          litre: 1,
          toplam_tutar: 40,
        },
      ],
      arac_bakimlari: [],
      arac_policeler: [],
      cari_odemeler: [],
      arac_bakim_planlari: [
        {
          id: "plan",
          arac_id: "v",
          tur: "Yağ Değişimi",
          konum: "Motor",
          aktif: true,
          km_araligi: 10000,
          ilk_bakim_km: 30000,
          uyari_km: 1000,
        },
      ],
      arac_km_referanslari: [],
      arac_gps_durumlari: [],
      ek_workspace_entries: [
        {
          id: "o",
          kind: "owner",
          entity: "owner",
          period: "2026-09",
          created_at: "2026-09-01",
          payload: { name: "Test Sahibi", vehicles: ["v"], cari: "cari" },
        },
      ],
      ek_workspace_snapshots: [],
      ek_stock_parts: [],
      ek_stock_movements: [],
      cari_faturalar: [],
    };
    window.testDB = db;
    window.writes = [];
    window.supabaseClient = {
      from(table) {
        let rows = [...(db[table] || [])],
          payload;
        const q = {
          select() {
            return q;
          },
          order() {
            return q;
          },
          gte(k, v) {
            rows = rows.filter((r) => r[k] >= v);
            return q;
          },
          lte(k, v) {
            rows = rows.filter((r) => r[k] <= v);
            return q;
          },
          eq(k, v) {
            rows = rows.filter((r) => r[k] === v);
            return q;
          },
          not(k, op, v) {
            rows = rows.filter((r) => r[k] !== v);
            return q;
          },
          or() {
            return q;
          },
          range(a, b) {
            rows = rows.slice(a, b + 1);
            return q;
          },
          insert(p) {
            if (!table.startsWith("ek_")) throw Error("LEGACY WRITE");
            payload = p;
            return q;
          },
          single() {
            return q;
          },
          then(resolve) {
            if (payload) {
              const r = {
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                ...payload,
              };
              db[table].push(r);
              window.writes.push({ table, payload: r });
              return Promise.resolve({ data: r }).then(resolve);
            }
            return Promise.resolve({ data: structuredClone(rows) }).then(
              resolve,
            );
          },
        };
        return q;
      },
    };
  });
  for (const file of [
    "hakedis-calculations.js",
    "maintenance-tracking.js",
    "erp-workspace-core.js",
    "erp-workspace-data.js",
    "erp-workspace.js",
  ])
    await page.addScriptTag({ path: process.cwd() + "/" + file });
  await page.evaluate(() => window.loadERPWorkspace());
  await page.evaluate(async () => {
    document.getElementById("ew-month").value = "2026-09";
    await ERPWorkspace.load();
  });
  await page.waitForFunction(() => ERPWorkspace.state.loaded);
  await page.click("#ew-build");
  await page.waitForFunction(() => !!ERPWorkspace.state.report);
  assert.match(await page.locator("#ew-result").innerText(), /750 ₺/);
  assert.equal(await page.locator("#ew-result img").count(), 0);
  await page.click("[data-action=save]");
  await page.waitForFunction(() => !!ERPWorkspace.state.saved);
  const saved = await page.evaluate(() =>
    structuredClone(testDB.ek_workspace_snapshots[0]),
  );
  assert.equal(saved.payload.period, "2026-09");
  await page.click("[data-ew-tab=owner]");
  await page.selectOption("#ew-owner", "owner");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-result").innerText(), /80 ₺/);
  assert.equal(await page.evaluate(() => writes.length), 1);
  await page.click("[data-ew-tab=prices]");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-result").innerText(), /825 ₺/);
  assert.equal(
    await page.evaluate(() => testDB.rapor_musteri_fiyatlari[0].vardiya_fiyat),
    100,
  );
  await page.click("[data-ew-tab=quote]");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-status").innerText(), /Eksik/);
  for (const key of [
    "days",
    "dailyKm",
    "emptyKm",
    "liters100",
    "fuelPrice",
    "salary",
    "maintenanceKm",
    "fixed",
    "contractorDaily",
    "profit",
  ])
    await page.fill("[name=" + key + "]", key === "days" ? "20" : "10");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-result").innerText(), /Önerilen teklif/);
  await page.click("[data-ew-tab=maintenance]");
  await page.selectOption("#ew-vehicle", "v");
  await page.waitForSelector("[name=ew-plan]");
  await page.check("[name=ew-plan]");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-result").innerText(), /Yağ Değişimi/);
  assert.equal(await page.evaluate(() => testDB.arac_bakimlari.length), 0);
  await page.click("[data-ew-tab=vehicle]");
  await page.click("#ew-build");
  await page.waitForFunction(
    () => ERPWorkspace.state.report?.kind === "vehicle",
  );
  assert.match(await page.locator("#ew-result").innerText(), /35 TEST 01/);
  await page.click("[data-ew-tab=management]");
  await page.click("#ew-build");
  assert.match(await page.locator("#ew-result").innerText(), /750 ₺/);
  assert.match(await page.locator("#ew-result").innerText(), /Eksik veri/);
  await page.click("[data-ew-tab=search]");
  await page.fill("#ew-search", "35 TEST");
  await page.waitForSelector("[data-result]");
  assert.match(
    await page.locator("#ew-search-results").innerText(),
    /35 TEST 01/,
  );
  await page.click("[data-ew-tab=archive]");
  await page.click("[data-snapshot]");
  assert.equal(
    await page.evaluate(
      () => ERPWorkspace.state.report.sections[0].rows.length,
    ),
    2,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/erp-workspace-mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.click("[data-ew-tab=stock]");
  await page.click("[data-action=part]");
  const box = await page.locator("#ew-dialog").boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391);
  await page.fill("[name=code]", "TEST");
  await page.fill("[name=name]", "Test parça");
  await page.click("#ew-dialog button[type=submit]");
  await page.waitForFunction(() => !document.getElementById("ew-dialog").open);
  assert.equal(await page.evaluate(() => testDB.ek_stock_parts.length), 1);
  await page.click("[data-ew-tab=factory]");
  await page.click("#ew-build");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/tmp/erp-workspace-desktop.png",
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(() => JSON.stringify(testDB.ek_workspace_snapshots[0])),
    JSON.stringify(saved),
  );
  await page.addScriptTag({
    path: process.cwd() + "/node_modules/xlsx/dist/xlsx.full.min.js",
  });
  const downloadPromise = page.waitForEvent("download");
  await page.click("[data-action=excel]");
  const download = await downloadPromise;
  const XLSX = require("xlsx");
  const workbook = XLSX.readFile(await download.path());
  const exportRows = XLSX.utils.sheet_to_json(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1 },
  );
  assert.ok(
    exportRows.some((r) => r.includes("İDEOL") && r.includes("Baris.Flow")),
  );
  assert.ok(
    exportRows.some((r) => r.includes(250)),
    "Excel currency values must be numeric",
  );
  await page.context().addInitScript(() => {
    window.print = () => {};
  });
  const popupPromise = page.waitForEvent("popup");
  await page.click("[data-action=print]");
  const popup = await popupPromise;
  await popup.waitForSelector(".ew-report-head");
  assert.match(await popup.locator("body").innerText(), /İDEOL/);
  assert.match(await popup.locator("body").innerText(), /Baris.Flow/);
  assert.match(await popup.locator("body").innerText(), /2026-09/);
  assert.equal(await popup.locator("img").count(), 0);
  await popup.emulateMedia({ media: "print" });
  await popup.screenshot({
    path: "/tmp/erp-workspace-print.png",
    fullPage: true,
  });
  await popup.close();
  console.log(
    "Workspace UI: all reports, snapshot isolation, missing inputs, legacy write isolation, escaped output and mobile layout passed.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
