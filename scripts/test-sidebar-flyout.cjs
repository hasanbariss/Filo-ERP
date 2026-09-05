const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("fs"),
  path = require("path"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  let html = fs
    .readFileSync("filoyonetim.html", "utf8")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  await page.route("https://sidebar.test/**", (route) => {
    const file = new URL(route.request().url()).pathname.slice(1);
    if (!file) return route.fulfill({ contentType: "text/html", body: html });
    const pathname = path.join(process.cwd(), file);
    if (!fs.existsSync(pathname)) return route.abort();
    return route.fulfill({ path: pathname });
  });
  await page.goto("https://sidebar.test/");
  await page.addStyleTag({
    content:
      ".hidden{display:none!important}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}",
  });
  await page.evaluate(() => {
    document.getElementById("auth-overlay").remove();
    document.getElementById("auth-boot-screen").remove();
    document
      .querySelectorAll(".main-module")
      .forEach((m) => (m.style.display = "none"));
    document.querySelector(".bf-content").innerHTML =
      '<div style="padding:30px"><h1>Genel Bakış</h1><p>Filo ve finans yönetimi</p></div>';
    window.chosen = [];
    document.querySelectorAll("#main-nav-buttons [data-target]").forEach((b) =>
      b.addEventListener("click", () => {
        document
          .querySelectorAll("#main-nav-buttons .nav-link")
          .forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        chosen.push(b.dataset.target);
      }),
    );
  });
  try {
    await page.addScriptTag({
      url: "https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js",
    });
  } catch {}
  await page.addScriptTag({ path: process.cwd() + "/sidebar-flyout.js" });
  await page.evaluate(() => initSidebarFlyout());
  await page.waitForFunction(
    () =>
      Math.abs(
        document.getElementById("main-sidebar").getBoundingClientRect().width -
          76,
      ) < 0.1,
  );
  assert.equal(
    Math.round((await page.locator("#main-sidebar").boundingBox()).width),
    76,
  );
  const beforeFocus = await page.evaluate(() => document.activeElement.tagName);
  await page.getByRole("button", { name: "Filo", exact: true }).hover();
  await page.waitForSelector(".rail-panel-open");
  assert.equal(
    await page.evaluate(() => document.activeElement.tagName),
    beforeFocus,
    "Hover must not steal focus",
  );
  await page.locator("#bf-rail-panel-1 .nav-link").first().hover();
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".rail-panel-open").count(),
    1,
    "Panel stays open while crossing to links",
  );
  await page.locator(".bf-content").hover();
  await page.waitForFunction(() => !document.querySelector(".rail-panel-open"));
  const links = await page.locator("#main-nav-buttons .nav-link").count();
  assert.equal(links, 14);
  await page.getByRole("button", { name: "Filo", exact: true }).click();
  const panel = page.locator("#bf-rail-panel-1");
  assert.ok(await panel.isVisible());
  assert.equal(await page.locator(".rail-panel-open").count(), 1);
  assert.equal(
    await page.locator(":focus").getAttribute("data-target"),
    "module-filo",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".rail-panel-open").count(), 0);
  await page.getByRole("button", { name: "Finans", exact: true }).click();
  await page.locator("[data-target=module-calisma-dosyalari]").click();
  assert.equal(
    await page.evaluate(() => chosen.at(-1)),
    "module-calisma-dosyalari",
  );
  assert.equal(await page.locator(".rail-panel-open").count(), 0);
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  assert.ok(await page.locator("[data-target=module-takvim]").isVisible());
  await page.locator(".bf-content").click();
  assert.equal(await page.locator(".rail-panel-open").count(), 0);
  await page.locator("#sidebar-collapse-btn").click();
  await page.waitForFunction(
    () =>
      Math.abs(
        document.getElementById("main-sidebar").getBoundingClientRect().width -
          240,
      ) < 0.1,
  );
  assert.equal(
    Math.round((await page.locator("#main-sidebar").boundingBox()).width),
    240,
  );
  assert.ok(await page.locator("[data-target=module-filo]").isVisible());
  await page.locator("#sidebar-collapse-btn").click();
  await page.getByRole("button", { name: "Filo", exact: true }).click();
  await page.waitForFunction(() => {
    const p = document.querySelector(".rail-panel-open");
    return p && getComputedStyle(p).opacity === "1";
  });
  assert.ok(
    await page.locator(".rail-panel-open .nav-link span").first().isVisible(),
  );
  await page.screenshot({
    path: "/tmp/sidebar-flyout-light.png",
    fullPage: true,
  });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.screenshot({
    path: "/tmp/sidebar-flyout-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 820, height: 380 });
  await page.getByRole("button", { name: "Diğer", exact: true }).click();
  const box = await page.locator(".rail-panel-open").boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 381);
  assert.ok(box.x + box.width <= 820);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector(".rail-panel-open"));
  assert.equal(await page.locator(".rail-panel-open").count(), 0);
  assert.equal(await page.locator(".bf-nav-rail").isVisible(), false);
  await page.evaluate(() =>
    document.getElementById("main-sidebar").classList.add("mobile-open"),
  );
  assert.ok(await page.locator("[data-target=module-filo]").isVisible());
  assert.equal(await page.locator(".bf-flyout-heading:visible").count(), 0);
  assert.equal(
    await page.locator("#main-nav-buttons .nav-link").count(),
    links,
  );
  console.log(
    "Sidebar rail: navigation preservation, category flyouts, focus/Escape/outside close, expansion, light/dark and mobile preservation PASS",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
