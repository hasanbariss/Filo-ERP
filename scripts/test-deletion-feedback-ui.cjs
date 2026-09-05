const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.setContent(
    '<html><body class="bf-app" style="background:#f5f7f9"><button id="outside">Filo</button></body></html>',
  );
  await page.addStyleTag({ path: process.cwd() + "/feedback-ui.css" });
  for (const file of ["toast-manager.js", "vehicle-deletion.js"])
    await page.addScriptTag({ path: process.cwd() + "/" + file });
  await page.evaluate(() => {
    window.calls = [];
    window.refreshed = 0;
    window.fetchAraclar = () => refreshed++;
    window.fail = false;
    window.supabaseClient = {
      rpc(name, args) {
        calls.push({ name, args });
        if (name === "vehicle_delete_rows")
          return Promise.resolve({
            data: {
              rows: [
                {
                  id: "x",
                  tarih: "2026-09-01",
                  aciklama: "<img src=x onerror=alert(1)>",
                  toplam_tutar: 100,
                },
              ],
              total: 30,
              offset: args.p_offset,
            },
          });
        if (name === "vehicle_delete_execute")
          return Promise.resolve(
            fail
              ? { error: { message: "Bağlı kayıtlar değişti" } }
              : { data: { deleted: true, plate: "35 TEST" } },
          );
        return Promise.resolve({
          data: {
            vehicle: { id: "v", plaka: "35 TEST", mulkiyet_durumu: "ÖZMAL" },
            token: "snapshot",
            groups: [
              {
                key: "musteri_servis_puantaj.arac_id",
                table: "musteri_servis_puantaj",
                count: 30,
                required: true,
                can_unlink: false,
                can_delete: true,
                extra: [],
                samples: [
                  {
                    id: "p",
                    tarih: "2026-09-01",
                    aciklama: "<img src=x onerror=alert(1)>",
                    toplam_tutar: 100,
                  },
                ],
              },
              {
                key: "yakit_takip.arac_id",
                table: "yakit_takip",
                count: 1,
                required: true,
                can_unlink: true,
                can_delete: true,
                extra: [],
                samples: [],
              },
              {
                key: "ek_stock_movements.vehicle_id",
                table: "ek_stock_movements",
                count: 2,
                required: false,
                can_unlink: false,
                can_delete: false,
                extra: [],
                samples: [],
              },
            ],
          },
        });
      },
    };
  });
  await page.evaluate(() => reviewVehicleDeletion("v", "fetchAraclar"));
  assert.equal(await page.locator("#vd-delete").isDisabled(), true);
  assert.match(
    await page.locator("#vd-summary").innerText(),
    /korunurken araç silinemez/,
  );
  await page.locator("[data-close]").first().click();
  assert.equal(
    await page.evaluate(() =>
      calls.some((x) => x.name === "vehicle_delete_execute"),
    ),
    false,
  );
  await page.evaluate(() => reviewVehicleDeletion("v", "fetchAraclar"));
  await page.locator("summary").click();
  await page.locator("[data-page]").click();
  assert.match(await page.locator(".vd-pages").innerText(), /1–25 \/ 30/);
  assert.equal(await page.locator("#vehicle-delete-dialog img").count(), 0);
  await page.selectOption(
    '[data-choice="musteri_servis_puantaj.arac_id"]',
    "delete",
  );
  await page.selectOption('[data-choice="yakit_takip.arac_id"]', "unlink");
  await page.fill("#vd-plate", "WRONG");
  await page.check("#vd-ack");
  assert.equal(await page.locator("#vd-delete").isDisabled(), true);
  await page.fill("#vd-plate", "35 TEST");
  assert.equal(await page.locator("#vd-delete").isDisabled(), false);
  await page.evaluate(() => (fail = true));
  await page.click("#vd-delete");
  await page.waitForFunction(() =>
    document.getElementById("vd-status").textContent.includes("değişti"),
  );
  assert.equal(await page.locator("#vd-ack").isChecked(), false);
  await page.evaluate(() => (fail = false));
  await page.check("#vd-ack");
  await page.screenshot({
    path: "/tmp/vehicle-deletion-light.png",
    fullPage: true,
  });
  await page.click("#vd-delete");
  await page.waitForFunction(
    () => !document.getElementById("vehicle-delete-dialog").open,
  );
  assert.equal(await page.evaluate(() => refreshed), 1);
  const call = await page.evaluate(() =>
    calls.filter((c) => c.name === "vehicle_delete_execute").at(-1),
  );
  assert.deepEqual(call.args.p_choices, {
    "musteri_servis_puantaj.arac_id": "delete",
    "yakit_takip.arac_id": "unlink",
  });
  await page.evaluate(() => {
    document.getElementById("toast-container")?.remove();
    Toast.show("Kontrol <img src=x>", "info", 500);
  });
  await page.locator(".bf-toast").hover();
  await page.waitForTimeout(650);
  assert.equal(await page.locator(".bf-toast").count(), 1);
  assert.equal(await page.locator(".bf-toast img").count(), 0);
  await page.evaluate(() => Toast.show("Kontrol <img src=x>", "info", 500));
  assert.equal(await page.locator(".bf-toast").count(), 1);
  assert.equal(await page.locator(".bf-toast-count").innerText(), "×2");
  await page.locator("#outside").hover();
  await page.waitForFunction(() => !document.querySelector(".bf-toast"));
  await page.evaluate(() => {
    Toast.success("Araç kaydı güncellendi.");
    Toast.warning("Bağlı kayıtları kontrol edin.");
    Toast.error("İşlem kaydedilemedi.");
  });
  assert.equal(await page.locator("[role=alert]").count(), 1);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".bf-toast")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
  await page.screenshot({ path: "/tmp/feedback-light.png", fullPage: true });
  const bg = await page
    .locator(".bf-toast")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  assert.notEqual(
    await page
      .locator(".bf-toast")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    bg,
  );
  await page.screenshot({ path: "/tmp/feedback-dark.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => reviewVehicleDeletion("v", "fetchAraclar"));
  const box = await page.locator("#vehicle-delete-dialog").boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 391);
  console.log(
    "Deletion UI confirmation, cancel, pagination, stale review, selected actions and responsive/themed toast behavior PASS",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
