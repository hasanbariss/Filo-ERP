(function () {
  "use strict";
  window.initSidebarFlyout = function () {
    const sidebar = document.getElementById("main-sidebar");
    const nav = document.getElementById("main-nav-buttons");
    if (!sidebar || !nav || sidebar.dataset.flyoutReady) return;
    sidebar.dataset.flyoutReady = "true";
    document.body.classList.add("sidebar-rail-enabled");
    const desktop = window.matchMedia("(min-width: 769px)");
    const groups = [
      {
        label: "Ana Sayfa",
        icon: "house",
        panel: nav.querySelector(".nav-section"),
      },
      {
        label: "Filo",
        icon: "truck",
        panel: nav.querySelector('[aria-labelledby="nav-fleet-label"]'),
      },
      {
        label: "Finans",
        icon: "wallet-cards",
        panel: nav.querySelector('[aria-labelledby="nav-finance-label"]'),
      },
      {
        label: "Diğer",
        icon: "grid-2x2",
        panel: nav.querySelector(".bf-sidebar-more"),
      },
    ];
    const rail = document.createElement("div");
    rail.className = "bf-nav-rail";
    rail.setAttribute("aria-label", "Menü kategorileri");
    nav.prepend(rail);
    let opened = null;
    function close(restoreFocus = false) {
      if (!opened) return;
      const previous = opened;
      previous.panel.classList.remove("rail-panel-open");
      previous.button.setAttribute("aria-expanded", "false");
      opened = null;
      if (restoreFocus) previous.button.focus();
    }
    function position() {
      if (!opened) return;
      const panel = opened.panel;
      const y = opened.button.getBoundingClientRect().top;
      panel.style.top =
        Math.max(
          12,
          Math.min(y, window.innerHeight - panel.offsetHeight - 12),
        ) + "px";
    }
    function activate() {
      groups.forEach((group) => {
        const active = Boolean(group.panel.querySelector(".nav-link.active"));
        group.button.classList.toggle("active", active);
        if (group === groups[0]) {
          if (active) group.button.setAttribute("aria-current", "page");
          else group.button.removeAttribute("aria-current");
        }
      });
    }
    groups.forEach((group, index) => {
      group.panel.classList.add("bf-rail-panel");
      group.panel.id ||= "bf-rail-panel-" + index;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bf-rail-item";
      button.innerHTML =
        '<i data-lucide="' +
        group.icon +
        '" aria-hidden="true"></i><span>' +
        group.label +
        "</span>";
      rail.append(button);
      group.button = button;
      if (index === 0) {
        button.onclick = () => {
          close();
          group.panel.querySelector("[data-target]").click();
        };
        return;
      }
      button.setAttribute("aria-controls", group.panel.id);
      button.setAttribute("aria-expanded", "false");
      const heading = document.createElement("div");
      heading.className = "bf-flyout-heading";
      const title = document.createElement("h2");
      title.textContent =
        group.label === "Diğer" ? "Diğer modüller" : group.label;
      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.setAttribute("aria-label", "Alt menüyü kapat");
      dismiss.textContent = "×";
      dismiss.onclick = () => close(true);
      heading.append(title, dismiss);
      // Inside details content keeps its native disclosure intact on mobile.
      (group.panel.matches("details")
        ? group.panel.querySelector("div")
        : group.panel
      ).prepend(heading);
      button.onclick = () => {
        if (opened === group) return close(true);
        close();
        opened = group;
        if (group.panel.matches("details")) group.panel.open = true;
        group.panel.classList.add("rail-panel-open");
        button.setAttribute("aria-expanded", "true");
        position();
        group.panel.querySelector(".nav-link")?.focus();
      };
    });
    const toggle = document.createElement("button");
    toggle.id = "sidebar-collapse-btn";
    toggle.type = "button";
    toggle.className = "bf-rail-toggle";
    toggle.setAttribute("aria-controls", "main-nav-buttons");
    toggle.innerHTML = '<i data-lucide="menu" aria-hidden="true"></i>';
    sidebar.querySelector(".bf-sidebar-brand").prepend(toggle);
    let expanded = false;
    try {
      expanded =
        localStorage.getItem("baris-flow-sidebar-expanded-v1") === "true";
    } catch (_) {}
    function layout() {
      close();
      const full = desktop.matches && expanded;
      document.body.classList.toggle("sidebar-menu-expanded", full);
      toggle.setAttribute("aria-expanded", String(full));
      toggle.setAttribute(
        "aria-label",
        full ? "Menüyü daralt" : "Tüm menüyü genişlet",
      );
      toggle.title = toggle.getAttribute("aria-label");
    }
    toggle.onclick = () => {
      expanded = !expanded;
      try {
        localStorage.setItem(
          "baris-flow-sidebar-expanded-v1",
          String(expanded),
        );
      } catch (_) {}
      layout();
    };
    nav.addEventListener("click", (event) => {
      if (!event.target.closest(".nav-link[data-target]")) return;
      close();
      activate();
    });
    document.addEventListener("pointerdown", (event) => {
      if (
        opened &&
        !opened.panel.contains(event.target) &&
        !rail.contains(event.target)
      )
        close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && opened) {
        event.preventDefault();
        close(true);
      }
    });
    document.addEventListener("focusin", (event) => {
      if (
        opened &&
        !opened.panel.contains(event.target) &&
        !rail.contains(event.target)
      )
        close();
    });
    window.addEventListener("resize", position);
    rail.addEventListener("scroll", position, { passive: true });
    desktop.addEventListener("change", layout);
    const activeObserver = new MutationObserver(activate);
    nav
      .querySelectorAll(".nav-link")
      .forEach((link) =>
        activeObserver.observe(link, {
          attributes: true,
          attributeFilter: ["class"],
        }),
      );
    layout();
    activate();
    window.lucide?.createIcons();
  };
})();
