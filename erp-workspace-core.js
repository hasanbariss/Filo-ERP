(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ERPWorkspaceCore = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const types = ["vardiya", "tek", "cikis_8", "giris_2030", "mesai"];
  const labels = ["Vardiya", "Tek", "8 çıkışı", "20:30 girişi", "Mesai"];
  const num = (v) =>
    v === null || v === undefined || String(v).trim() === ""
      ? null
      : Number.isFinite(Number(v))
        ? Number(v)
        : null;
  const sum = (rows, key) => rows.reduce((s, r) => s + (num(r[key]) ?? 0), 0);
  const normalize = (v) =>
    String(v ?? "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/\s+/g, " ")
      .trim();
  function monthBounds(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
      throw Error("Geçerli bir dönem seçin.");
    const [y, m] = month.split("-").map(Number);
    return {
      start: month + "-01",
      end: month + "-" + new Date(y, m, 0).getDate(),
      previous: new Date(Date.UTC(y, m - 2, 2)).toISOString().slice(0, 7),
    };
  }
  function tariff(defs, row, month) {
    const same = (d) =>
      d.musteri_id === row.musteri_id && d.arac_id === row.arac_id;
    const region = (d) => (d.bolge || "Manisa") === (row.bolge || "Manisa");
    return (
      defs.find((d) => same(d) && region(d) && d.donem === month) ||
      defs.find((d) => same(d) && region(d) && !d.donem) ||
      defs.find((d) => same(d) && d.donem === month) ||
      defs.find((d) => same(d) && !d.donem) ||
      null
    );
  }
  function services(
    rows,
    defs,
    vehicles,
    customers,
    month,
    { legacy = false, overrides = false } = {},
  ) {
    const groups = new Map();
    for (const r of rows) {
      if (!String(r.tarih).startsWith(month)) continue;
      const v = vehicles.find((v) => v.id === r.arac_id) || {},
        c = customers.find((c) => c.id === r.musteri_id) || {};
      const region =
        legacy && normalize(c.ad).includes("dikkan")
          ? "İzmir"
          : r.bolge || "Manisa";
      const key = JSON.stringify([r.musteri_id, r.arac_id, region]);
      let g = groups.get(key);
      if (!g) {
        const def = tariff(defs, { ...r, bolge: region }, month);
        g = {
          key,
          customerId: r.musteri_id,
          vehicleId: r.arac_id,
          factory: c.ad || "Eşleşmeyen fabrika",
          plate: v.plaka || "Eşleşmeyen araç",
          owner: v.firma_adi || "",
          ownership: v.mulkiyet_durumu || "BELİRSİZ",
          company: v.sirket || "",
          vehicleClass: v.arac_sinifi || "SINIFLANDIRILMAMIŞ",
          region,
          counts: types.map(() => 0),
          rates: types.map((t) => num(def?.[t + "_fiyat"])),
          definition: def,
          sourceIds: [],
        };
        groups.set(key, g);
      }
      types.forEach((t, i) => (g.counts[i] += num(r[t]) ?? 0));
      g.sourceIds.push(r.id);
    }
    return [...groups.values()].map((g) => {
      if (
        overrides &&
        g.definition?.donem === month &&
        (g.definition.bolge || "Manisa") === g.region
      )
        types.forEach((t, i) => {
          const override = num(g.definition["override_" + t]);
          if (override !== null) g.counts[i] = override;
        });
      g.missing = g.counts.some((q, i) => q !== 0 && g.rates[i] === null);
      g.amount = g.missing
        ? null
        : g.counts.reduce((s, q, i) => s + q * (g.rates[i] ?? 0), 0);
      return g;
    });
  }
  function aggregate(rows, keys) {
    const map = new Map();
    for (const r of rows) {
      const key = JSON.stringify(keys.map((k) => r[k]));
      const g = map.get(key) || {
        ...Object.fromEntries(keys.map((k) => [k, r[k]])),
        counts: types.map(() => 0),
        amount: 0,
        missing: 0,
      };
      r.counts.forEach((q, i) => (g.counts[i] += q));
      if (r.amount === null) g.missing++;
      else g.amount += r.amount;
      map.set(key, g);
    }
    return [...map.values()];
  }
  function changes(current, previous) {
    const keys = new Set([...current, ...previous].map((r) => r.key));
    return [...keys].map((key) => {
      const a = current.find((r) => r.key === key),
        b = previous.find((r) => r.key === key);
      let quantity = 0,
        price = 0,
        known = true;
      for (let i = 0; i < types.length; i++) {
        const qa = a?.counts[i] ?? 0,
          qb = b?.counts[i] ?? 0;
        const pa = a?.rates[i],
          pb = b?.rates[i];
        if (
          (qa && pa == null) ||
          (qb && pb == null) ||
          (qa !== qb && pb == null)
        ) {
          known = false;
          continue;
        }
        quantity += (qa - qb) * (pb ?? 0);
        price += qa * ((pa ?? pb ?? 0) - (pb ?? 0));
      }
      return {
        ...(a || b),
        before: b?.amount ?? (b ? null : 0),
        after: a?.amount ?? (a ? null : 0),
        quantity: known ? quantity : null,
        price: known ? price : null,
        reason: known
          ? "Miktar etkisi önceki fiyatla; fiyat etkisi güncel miktarla hesaplandı."
          : "Yeni/kapanan iş veya eksik önceki fiyat; neden ayrıştırılamadı.",
      };
    });
  }
  function scenario(rows, mode, value) {
    const n = num(value);
    if (n === null) throw Error("Geçerli değişim girin.");
    return rows.map((r) => {
      const rates = r.rates.map((p) =>
        p === null
          ? null
          : Math.round((mode === "percent" ? p * (1 + n / 100) : p + n) * 100) /
            100,
      );
      if (rates.some((p) => p !== null && p < 0))
        throw Error("Senaryo negatif fiyat üretiyor.");
      return {
        ...r,
        before: r.amount,
        rates,
        amount: r.missing
          ? null
          : r.counts.reduce((s, q, i) => s + q * (rates[i] ?? 0), 0),
      };
    });
  }
  function quote(input) {
    const required = [
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
    ];
    for (const k of required)
      if (num(input[k]) === null || num(input[k]) < 0)
        throw Error(
          "Eksik/geçersiz maliyet: " + k + " (yoksa açıkça 0 girin).",
        );
    if (+input.days <= 0) throw Error("Çalışma günü sıfır olamaz.");
    const km = (+input.dailyKm + +input.emptyKm) * input.days;
    const fuel = ((km * input.liters100) / 100) * input.fuelPrice;
    const owned =
      fuel + +input.salary + km * input.maintenanceKm + +input.fixed;
    const contractor = input.days * input.contractorDaily;
    return {
      km,
      fuel,
      owned,
      contractor,
      ownedQuote: owned * (1 + input.profit / 100),
      contractorQuote: contractor * (1 + input.profit / 100),
    };
  }
  function ownerStatement(service, fuel, manual, helper) {
    const missing = service.some((r) => r.missing);
    const gross = sum(service, "amount");
    const kdv = service.reduce(
      (s, r) =>
        s + ((r.amount ?? 0) * (num(r.definition?.kdv_oran) ?? 0)) / 100,
      0,
    );
    const tev = service.reduce(
      (s, r) =>
        s + ((r.amount ?? 0) * (num(r.definition?.tev_oran) ?? 0)) / 100,
      0,
    );
    return {
      ...helper.calculateTotals({
        serviceBrut: gross,
        serviceKdv: kdv,
        serviceTev: tev,
        yakit: sum(fuel, "toplam_tutar"),
        manualLines: manual,
      }),
      gross,
      missing,
    };
  }
  function inventory(parts, movements) {
    return parts.map((p) => {
      const qty = sum(
        movements.filter((m) => m.part_id === p.id),
        "quantity",
      );
      return { ...p, qty, need: Math.max(0, +p.minimum - qty) };
    });
  }
  return {
    types,
    labels,
    num,
    sum,
    normalize,
    monthBounds,
    tariff,
    services,
    aggregate,
    changes,
    scenario,
    quote,
    ownerStatement,
    inventory,
  };
});
