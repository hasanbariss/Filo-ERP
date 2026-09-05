(function () {
  "use strict";
  // Presentation only: reuse existing records and actions, never persist data.
  window.renderFleetIndicators = function (vehicle) {
    const km = (value) =>
      value != null &&
      value !== "" &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0
        ? Number(value).toLocaleString("tr-TR") + " km"
        : "Bilgi yok";
    let insurance = "Tarih yok",
      state = "";
    if (vehicle.sigorta_bitis) {
      const end = new Date(
        String(vehicle.sigorta_bitis).slice(0, 10) + "T00:00:00",
      );
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isFinite(end.getTime())) {
        const days = Math.round((end - today) / 86400000);
        insurance =
          days < 0
            ? "Süresi doldu"
            : days === 0
              ? "Bugün bitiyor"
              : days + " gün kaldı";
        state = days < 0 ? "is-critical" : days <= 30 ? "is-attention" : "";
      }
    }
    return (
      '<div class="fleet-glance" aria-label="Araç göstergeleri"><div><span>Kilometre</span><strong>' +
      km(vehicle.guncel_km) +
      "</strong></div><div><span>Son yağ bakımı</span><strong>" +
      km(vehicle.son_yag_km) +
      '</strong></div><div class="' +
      state +
      '"><span>Sigorta</span><strong>' +
      insurance +
      "</strong></div></div>"
    );
  };
  window.prepareVehicleDrawerTabs = function (body) {
    if (!body || body.querySelector(".detail-tabs")) return;
    const general = [
      body.firstElementChild,
      body.firstElementChild?.nextElementSibling,
    ];
    const history = [
      body.querySelector("#arac-pl-section"),
      body.querySelector("#arac-cari-section")?.parentElement,
    ];
    if ([...general, ...history].some((node) => !node)) return;
    const bar = document.createElement("div");
    bar.className = "detail-tabs";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Araç detay bölümleri");
    const panels = [general, history].map((nodes, index) => {
      const panel = document.createElement("section");
      panel.id = "vehicle-drawer-panel-" + index;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", "vehicle-drawer-tab-" + index);
      panel.className = "detail-tab-panel";
      panel.tabIndex = 0;
      nodes[0].before(panel);
      nodes.forEach((node) => panel.append(node));
      return panel;
    });
    function select(index) {
      panels.forEach((panel, i) => {
        panel.hidden = i !== index;
        bar.children[i].setAttribute("aria-selected", String(i === index));
        bar.children[i].tabIndex = i === index ? 0 : -1;
      });
    }
    ["Genel bilgiler", "Finans ve geçmiş"].forEach((name, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = name;
      button.id = "vehicle-drawer-tab-" + index;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", panels[index].id);
      button.onclick = () => select(index);
      button.onkeydown = (event) => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const target =
            event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
          select(target);
          bar.children[target].focus();
        }
      };
      bar.append(button);
    });
    body.prepend(bar);
    select(0);
  };
  window.prepareHakedisPanel = function (overlay) {
    if (overlay.querySelector(".hakedis-section-nav")) return;
    const body = overlay.querySelector(".cari-card-body");
    const nav = document.createElement("nav");
    nav.className = "hakedis-section-nav";
    nav.setAttribute("aria-label", "Hakediş bölümleri");
    const sections = [
      [".cari-service-section", "Seferler"],
      [".cari-fuel-section", "Yakıt"],
      [".cari-auto-expense-section", "Bakım / Sigorta"],
      [".cari-manual-section", "Ek kalemler"],
    ];
    sections.forEach(([selector, label]) => {
      const section = body.querySelector(selector);
      if (!section) return;
      const number = String(nav.children.length + 1).padStart(2, "0");
      section.dataset.sectionNumber = number;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = number + "  " + label;
      button.onclick = () => {
        body.scrollTo({
          top:
            body.scrollTop +
            section.getBoundingClientRect().top -
            body.getBoundingClientRect().top -
            20,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
        section.tabIndex = -1;
        section.focus({ preventScroll: true });
      };
      nav.append(button);
    });
    body.before(nav);
  };
  window.prepareDetailDrawer = function (overlay, close) {
    if (!overlay || overlay.dataset.drawerReady) return;
    overlay.dataset.drawerReady = "true";
    const sheet = overlay.querySelector(
      ".ios-modal-sheet, .cari-detail-sheet, .cari-card-sheet",
    );
    if (!sheet) return;
    const previousFocus = document.activeElement;
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute(
      "aria-label",
      overlay.id === "arac-detay-overlay"
        ? "Araç detayları"
        : overlay.id === "sofor-detay-overlay"
          ? "Şoför detayları"
          : overlay.id === "cari-kart-modal-overlay"
            ? "Hakediş cari kartı"
            : "Cari hesap detayları",
    );
    sheet.tabIndex = -1;
    const closeButton = sheet.querySelector("button");
    if (overlay.id === "arac-detay-overlay")
      closeButton?.setAttribute("aria-label", "Araç detayını kapat");
    sheet.focus({ preventScroll: true });
    const keyboard = (event) => {
      // Other dialogs opened from this sheet retain their own keyboard handling.
      if (!sheet.contains(document.activeElement)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key === "Tab") {
        const items = [
          ...sheet.querySelectorAll(
            'button, a[href], input, select, textarea, [tabindex="0"]',
          ),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        if (!items.length) {
          event.preventDefault();
          return;
        }
        const first = items[0],
          last = items.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === sheet)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === sheet)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    sheet.addEventListener("keydown", keyboard);
    const observer = new MutationObserver(() => {
      if (overlay.isConnected && !overlay.classList.contains("hidden")) return;
      observer.disconnect();
      sheet.removeEventListener("keydown", keyboard);
      delete overlay.dataset.drawerReady;
      if (
        previousFocus?.isConnected &&
        (document.activeElement === document.body ||
          sheet.contains(document.activeElement))
      )
        previousFocus.focus({ preventScroll: true });
    });
    observer.observe(document.body, { childList: true });
    observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  };
})();
