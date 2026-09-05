(function () {
  "use strict";
  const types = {
    success: { title: "İşlem tamamlandı", icon: "✓" },
    error: { title: "İşlem tamamlanamadı", icon: "!" },
    warning: { title: "Kontrol gerekiyor", icon: "!" },
    info: { title: "Bilgilendirme", icon: "i" },
  };
  const timers = new WeakMap();
  function stop(toast) {
    const state = timers.get(toast);
    if (state && state.timer !== null) {
      clearTimeout(state.timer);
      state.remaining = Math.max(
        0,
        state.remaining - (Date.now() - state.started),
      );
      state.timer = null;
    }
  }
  function start(toast) {
    const state = timers.get(toast);
    if (
      !state ||
      state.timer ||
      toast.matches(":hover") ||
      toast.contains(document.activeElement)
    )
      return;
    state.started = Date.now();
    state.timer = setTimeout(
      () => window.Toast._remove(toast),
      state.remaining,
    );
  }
  window.Toast = {
    show(message, type = "info", duration = 4000) {
      type = types[type] ? type : "info";
      message = String(message ?? "");
      duration =
        Number.isFinite(Number(duration)) && Number(duration) > 0
          ? Number(duration)
          : 4000;
      const container = this._getContainer();
      const duplicate = [...container.children].find(
        (t) =>
          t.dataset.message === message &&
          t.dataset.type === type &&
          !t.classList.contains("is-leaving"),
      );
      if (duplicate) {
        const count = Number(duplicate.dataset.count || 1) + 1;
        duplicate.dataset.count = count;
        duplicate.querySelector(".bf-toast-count").textContent = "×" + count;
        stop(duplicate);
        timers.set(duplicate, {
          remaining: duration,
          timer: null,
          started: Date.now(),
        });
        start(duplicate);
        return duplicate;
      }
      const toast = this._createToast(message, type);
      container.append(toast);
      // Bound stacked notifications without hiding the newest result.
      while (container.children.length > 4) {
        const oldest = container.firstElementChild;
        stop(oldest);
        oldest.remove();
      }
      timers.set(toast, {
        remaining: duration,
        timer: null,
        started: Date.now(),
      });
      start(toast);
      toast.addEventListener("mouseenter", () => stop(toast));
      toast.addEventListener("mouseleave", () => start(toast));
      toast.addEventListener("focusin", () => stop(toast));
      toast.addEventListener("focusout", () =>
        setTimeout(() => start(toast), 0),
      );
      return toast;
    },
    success(msg) {
      return this.show(msg, "success", 4000);
    },
    error(msg) {
      return this.show(msg, "error", 8000);
    },
    warning(msg) {
      return this.show(msg, "warning", 6000);
    },
    info(msg) {
      return this.show(msg, "info", 4000);
    },
    _remove(toast) {
      stop(toast);
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 180);
    },
    _getContainer() {
      let container = document.getElementById("toast-container");
      if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.setAttribute("aria-label", "Bildirimler");
        document.body.append(container);
      }
      return container;
    },
    _createToast(message, type) {
      const meta = types[type] || types.info;
      const toast = document.createElement("div");
      toast.className = "bf-toast";
      toast.dataset.type = type;
      toast.dataset.message = message;
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.setAttribute("aria-atomic", "true");
      const icon = document.createElement("span");
      icon.className = "bf-toast-icon";
      icon.textContent = meta.icon;
      icon.setAttribute("aria-hidden", "true");
      const body = document.createElement("div");
      body.className = "bf-toast-body";
      const heading = document.createElement("strong");
      heading.textContent = meta.title;
      const count = document.createElement("small");
      count.className = "bf-toast-count";
      heading.append(count);
      const text = document.createElement("p");
      text.textContent = message;
      body.append(heading, text);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "bf-toast-close";
      close.setAttribute("aria-label", "Bildirimi kapat");
      close.textContent = "×";
      close.onclick = () => this._remove(toast);
      toast.append(icon, body, close);
      return toast;
    },
  };
})();
