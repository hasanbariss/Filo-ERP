const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) =>
    r.request().url().startsWith("https://cdn.tailwindcss.com")
      ? r.continue()
      : r.abort(),
  );
  await page.setContent(
    fs
      .readFileSync("filoyonetim.html", "utf8")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<link\b[^>]*>/gi, ""),
  );
  for (const file of [
    "style.css",
    "design-system.css",
    "web-premium.css",
    "web-executive.css",
    "ui-final-pass.css",
    "ios-mobile.css",
    "feedback-ui.css",
    "interface-polish.css",
    "hakedis-panel.css",
  ])
    if (fs.existsSync(file))
      await page.addStyleTag({
        content: fs.readFileSync(file, "utf8").replace(/@import[^;]+;/g, ""),
      });
  await page.addScriptTag(
    process.env.TAILWIND_SCRIPT
      ? { path: process.env.TAILWIND_SCRIPT }
      : { url: "https://cdn.tailwindcss.com" },
  );
  await page.evaluate(() => {
    document.getElementById("auth-overlay")?.remove();
    document.getElementById("auth-boot-screen")?.remove();
  });
  await page.addScriptTag({ path: process.cwd() + "/interface-polish.js" });
  const source = fs.readFileSync("data-services.js", "utf8");
  await page.addScriptTag({
    content: source.slice(
      source.indexOf("window.openAracDetay ="),
      source.indexOf("window.openSoforDetay ="),
    ),
  });
  const driverStart = source.indexOf("window.openSoforDetay =");
  const driverEnd = source.indexOf("\n};", driverStart) + 3;
  await page.addScriptTag({ content: source.slice(driverStart, driverEnd) });
  const ui = fs.readFileSync("ui-manager.js", "utf8");
  await page.addScriptTag({
    content: ui.slice(
      ui.indexOf("window.openCariDetail ="),
      ui.indexOf("window.openKrediKartiDetay ="),
    ),
  });
  await page.evaluate(() => {
    window.loadAracPL = () => {};
    window.loadAracCariKarti = () => {};
    window.fetchCariDetails = () => {};
    window.supabaseClient = {
      from(table) {
        const q = {
          select() {
            return q;
          },
          eq() {
            return q;
          },
          single() {
            return Promise.resolve({
              data:
                table === "araclar"
                  ? {
                      id: "v",
                      plaka: "35 İDEOL 01",
                      guncel_km: 124500,
                      son_yag_km: 120000,
                      marka_model: "Mercedes Sprinter",
                      mulkiyet_durumu: "ÖZMAL",
                      arac_sinifi: "16+1",
                    }
                  : { id: "s", ad_soyad: "Test Şoför", sigorta_durumu: "SGK" },
            });
          },
          maybeSingle() {
            return q.single();
          },
        };
        return q;
      },
    };
  });
  for (const [fn, id, sheet] of [
    ["openAracDetay", "arac-detay-overlay", ".ios-modal-sheet"],
    ["openSoforDetay", "sofor-detay-overlay", ".ios-modal-sheet"],
    ["openCariDetail", "cari-detail-modal", ".cari-detail-sheet"],
  ]) {
    await page.evaluate((fn) => window[fn]("v"), fn);
    if (fn === "openAracDetay") {
      assert.equal(
        await page.locator("#vehicle-drawer-panel-1").isVisible(),
        false,
      );
      await page.getByRole("tab", { name: "Finans ve geçmiş" }).click();
      assert.equal(
        await page.locator("#vehicle-drawer-panel-1").isVisible(),
        true,
      );
      await page.keyboard.press("ArrowLeft");
      assert.equal(
        await page.locator("#vehicle-drawer-panel-0").isVisible(),
        true,
      );
    }
    const box = await page.locator("#" + id + " " + sheet).boundingBox();
    assert.ok(Math.abs(box.x + box.width - 1440) < 3, fn + " right aligned");
    assert.ok(box.height >= 940, fn + " full height");
    await page.keyboard.press("Tab");
    assert.ok(
      await page
        .locator("#" + id)
        .evaluate((el) => el.contains(document.activeElement)),
    );
    await page.keyboard.press("Escape");
    assert.ok(
      (await page.locator("#" + id).count()) === 0 ||
        (await page
          .locator("#" + id)
          .evaluate((el) => el.classList.contains("hidden"))),
    );
  }
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "glance-test";
    host.innerHTML = renderFleetIndicators({
      guncel_km: 124500,
      son_yag_km: 120000,
      sigorta_bitis: "2020-01-01",
    });
    document.body.append(host);
  });
  assert.match(await page.locator("#glance-test").innerText(), /124.500 km/);
  assert.match(
    await page.locator("#glance-test .is-critical").innerText(),
    /Süresi doldu/,
  );
  assert.match(
    await page.evaluate(() => renderFleetIndicators({})),
    /Bilgi yok/,
  );
  await page.evaluate(() => openAracDetay("v"));
  await page.screenshot({
    path: "/tmp/ideol-drawer-desktop.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => openAracDetay("v"));
  const mobile = await page
    .locator("#arac-detay-overlay .ios-modal-sheet")
    .boundingBox();
  assert.ok(mobile.width <= 390 && mobile.x >= 0);
  await page.screenshot({
    path: "/tmp/ideol-drawer-mobile.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.addScriptTag({ path: process.cwd() + "/hakedis-calculations.js" });
  await page.addScriptTag({
    content: source.slice(
      source.indexOf("window.openCariHakedisDetay ="),
      source.indexOf("window.saveHakedisFiyatlar ="),
    ),
  });
  await page.evaluate(() => {
    window._taseronCariAy = "2026-09";
    window._taseronCariData = {
      v: {
        plaka: "35 TEST",
        musteriDetay: {
          f: {
            musteri_ad: "İdeol Fabrika",
            vardiya: 10,
            tek: 2,
            vardiya_fiyat: 1000,
            tek_fiyat: 500,
            kdv_oran: 0,
            tev_oran: 0,
          },
        },
        mulkiyet_durumu: "TAŞERON",
      },
    };
    window.supabaseClient = {
      from() {
        const q = {
          select() {
            return q;
          },
          eq() {
            return q;
          },
          gte() {
            return q;
          },
          lte() {
            return q;
          },
          order() {
            return q;
          },
          then(resolve) {
            return Promise.resolve({ data: [] }).then(resolve);
          },
        };
        return q;
      },
    };
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => openCariHakedisDetay("v"));
    const drawer = page.locator("#cari-kart-modal-overlay .cari-card-sheet");
    assert.equal(
      await drawer.count(),
      1,
      await page.locator("#cari-kart-modal-overlay").innerText(),
    );
    assert.equal(await page.locator(".hakedis-section-nav button").count(), 3);
    assert.match(await page.locator("#modal-net-total").innerText(), /11.000/);
    await page.locator(".calc-vardiya-fiyat").fill("1200");
    assert.match(await page.locator("#modal-net-total").innerText(), /13.000/);
    await page.locator(".hakedis-section-nav button").last().click();
    assert.ok(
      await page
        .locator(".cari-manual-section")
        .evaluate((el) => el === document.activeElement),
    );
    await page.locator(".hakedis-section-nav button").first().click();
    const rect = await drawer.boundingBox();
    assert.ok(Math.abs(rect.x + rect.width - width) < 2);
    assert.ok(rect.height >= 895);
    if (width >= 1024) {
      const bodyBox = await page
        .locator("#cari-kart-modal-overlay .cari-card-body")
        .boundingBox();
      const summaryBox = await page
        .locator("#cari-kart-modal-overlay .cari-card-summary")
        .boundingBox();
      assert.ok(
        bodyBox.width > width * 0.65,
        "Calculations use most of the desktop width",
      );
      assert.ok(
        bodyBox.height > 900 * 0.75,
        "Summary does not consume calculation height",
      );
      assert.ok(
        summaryBox.x >= bodyBox.x + bodyBox.width - 2,
        "Summary is beside calculations",
      );
    }
    assert.ok(await page.locator("#modal-net-total").isVisible());
    assert.ok(await page.locator(".cari-card-action.is-save").isVisible());
    await page.screenshot({
      path: "/tmp/hakedis-drawer-" + width + ".png",
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#cari-kart-modal-overlay").count(), 0);
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "Production styles: vehicle/driver/account drawers, keyboard close, mobile width and truthful card indicators PASS",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
