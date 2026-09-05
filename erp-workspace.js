(function () {
  "use strict";
  const C = window.ERPWorkspaceCore;
  const $ = (id) => document.getElementById(id);
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const fmt = (v) =>
    v === null || v === undefined
      ? "Eksik veri"
      : Number(v).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  const money = (v) => (v == null ? "Eksik veri" : fmt(v) + " ₺");
  const today = () =>
    new Date(Date.now() + 10800000).toISOString().slice(0, 10);
  const titles = {
    factory: "Fabrika aylık dosyası",
    owner: "Araç sahibi hesap pusulası",
    vehicle: "Araç dosyası",
    changes: "Bu ay neden değişti?",
    package: "Araç sahibine hesap paketi",
    quote: "Teklif hesaplayıcısı",
    maintenance: "Birlikte yapılabilecek bakımlar",
    search: "Her yerden bul",
    prices: "Toplu fiyat önizlemesi",
    management: "Aylık yönetim dosyası",
    stock: "Parça ve sarf stokları",
    archive: "Kaydedilmiş dosyalar",
  };
  const descriptions = {
    factory: "Hizmet, dış muhasebe faturası ve tahsilatı birlikte inceleyin.",
    owner: "Doğrulanmış araç–sahip–cari eşleşmesiyle hesap hazırlayın.",
    vehicle: "Aracın servis, yakıt, bakım ve belgelerini tek dosyada görün.",
    changes: "Miktar ve fiyat değişiminin tutara etkisini karşılaştırın.",
    package: "Araç sahibine sunulacak dökümü ve mesajı hazırlayın.",
    quote: "Kendi maliyetlerinizle bağımsız bir teklif oluşturun.",
    maintenance: "Aynı servis ziyaretinde yapılacak işleri seçip yazdırın.",
    search: "Plaka, fabrika, personel, cari veya fatura bulun.",
    prices: "Tarifelere dokunmadan fiyat değişiminin etkisini görün.",
    management:
      "İhtiyacınız olan bölümlerle dönemin yönetim dosyasını hazırlayın.",
    stock: "Giriş, araca çıkış, raf ve ihtiyaç listesini takip edin.",
  };
  const S = {
    tab: "factory",
    data: {},
    entries: [],
    snapshots: [],
    report: null,
    request: 0,
    loaded: false,
    selectedVehicle: "",
    saved: null,
    buildKey: 0,
  };
  let repo;
  const table = (title, columns, rows, note = "") => ({
    title,
    columns,
    rows,
    note,
  });
  const vname = (id) =>
    S.data.araclar?.find((v) => v.id === id)?.plaka || "Eşleşmeyen araç";
  const cname = (id) =>
    S.data.musteriler?.find((v) => v.id === id)?.ad || "Eşleşmeyen fabrika";
  const entries = (kind, entity, month = $("ew-month").value) =>
    S.entries.filter(
      (e) =>
        e.kind === kind &&
        (!entity || e.entity === entity) &&
        e.period === month,
    );
  function owners() {
    const map = new Map();
    S.entries
      .filter((e) => e.kind === "owner")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .forEach((e) => map.set(e.entity, { id: e.entity, ...e.payload }));
    return [...map.values()];
  }
  function options(rows, label, empty = "Tümü") {
    return (
      '<option value="">' +
      esc(empty) +
      "</option>" +
      rows
        .map(
          (r) =>
            '<option value="' + esc(r.id) + '">' + esc(r[label]) + "</option>",
        )
        .join("")
    );
  }
  function field(label, name, type = "text", value = "", extra = "") {
    return (
      "<label>" +
      esc(label) +
      '<input name="' +
      name +
      '" type="' +
      type +
      '" value="' +
      esc(value) +
      '" ' +
      extra +
      "></label>"
    );
  }
  function select(label, name, html) {
    return (
      "<label>" +
      esc(label) +
      '<select name="' +
      name +
      '">' +
      html +
      "</select></label>"
    );
  }
  function check(label, name, value, checked = false) {
    return (
      '<label class="ew-check"><input type="checkbox" name="' +
      name +
      '" value="' +
      esc(value) +
      '" ' +
      (checked ? "checked" : "") +
      ">" +
      esc(label) +
      "</label>"
    );
  }
  function status(message) {
    $("ew-status").textContent = message;
  }
  function report(sections, notes = [], title = titles[S.tab]) {
    return {
      title,
      kind: S.tab,
      period: $("ew-month").value,
      createdAt: new Date().toISOString(),
      filters: {
        factory: $("ew-factory-wrap").hidden
          ? null
          : $("ew-factory").selectedOptions[0]?.textContent,
        ownership: $("ew-ownership-wrap").hidden
          ? null
          : $("ew-ownership").value || "Tümü",
        vehicle: $("ew-vehicle-wrap").hidden
          ? null
          : $("ew-vehicle").selectedOptions[0]?.textContent,
        owner: $("ew-owner-wrap").hidden
          ? null
          : $("ew-owner").selectedOptions[0]?.textContent,
        taxBasis: $("ew-service-basis")?.selectedOptions[0]?.textContent,
      },
      sections,
      notes,
      sources: {
        ...S.extraSources,
        ek_workspace_entries: S.entries.map((e) => e.id),
        ek_stock_movements: (S.movements || []).map((e) => e.id),
        ...Object.fromEntries(
          Object.entries(S.data)
            .filter(([, r]) => Array.isArray(r))
            .map(([k, r]) => [k, r.map((x) => x.id || x.referans_id)]),
        ),
      },
    };
  }
  function renderReport(r) {
    S.report = r;
    S.saved = null;
    S.snapshotId = crypto.randomUUID();
    $("ew-output-actions").hidden = false;
    $("ew-result").innerHTML = htmlReport(r);
  }
  function htmlReport(r) {
    return (
      '<header class="ew-report-head"><div><small>ÇALIŞMA DOSYASI</small><h2>' +
      esc(r.title) +
      "</h2><p>" +
      esc(r.period) +
      " · " +
      esc(new Date(r.createdAt).toLocaleString("tr-TR")) +
      '</p></div><div class="ew-stamp">İDEOL<small>Baris.Flow</small></div></header><p class="ew-report-scope">' +
      Object.values(r.filters || {})
        .filter(Boolean)
        .map(esc)
        .join(" · ") +
      "</p>" +
      r.notes.map((n) => '<p class="ew-note">' + esc(n) + "</p>").join("") +
      r.sections
        .map(
          (s) =>
            '<section class="ew-report-section"><h3>' +
            esc(s.title) +
            "</h3>" +
            (s.note ? "<p>" + esc(s.note) + "</p>" : "") +
            '<div class="ew-table-wrap"><table><thead><tr>' +
            s.columns.map((c) => "<th>" + esc(c) + "</th>").join("") +
            "</tr></thead><tbody>" +
            (s.rows.length
              ? s.rows
                  .map(
                    (row) =>
                      "<tr>" +
                      row.map((v) => "<td>" + esc(v) + "</td>").join("") +
                      "</tr>",
                  )
                  .join("")
              : '<tr><td colspan="' +
                s.columns.length +
                '">Bu kapsamda kayıt yok.</td></tr>') +
            "</tbody></table></div></section>",
        )
        .join("")
    );
  }
  function filterServices(rows) {
    return rows.filter(
      (r) =>
        (!$("ew-factory").value || r.customerId === $("ew-factory").value) &&
        ($("ew-vehicle-wrap").hidden ||
          !$("ew-vehicle").value ||
          r.vehicleId === $("ew-vehicle").value) &&
        (!$("ew-ownership").value || r.ownership === $("ew-ownership").value),
    );
  }
  function services(month = $("ew-month").value, legacy = false) {
    return C.services(
      S.data.musteri_servis_puantaj,
      S.data[legacy ? "musteri_arac_tanimlari" : "rapor_musteri_fiyatlari"],
      S.data.araclar,
      S.data.musteriler,
      month,
      { legacy, overrides: legacy },
    );
  }
  function serviceSections(rows) {
    const grouped = C.aggregate(rows, [
      "factory",
      "ownership",
      "vehicleClass",
      "region",
    ]);
    const totals = C.aggregate(rows, ["factory", "ownership"]);
    return [
      table(
        "Fabrika / sınıf / mülkiyet / bölge",
        ["Fabrika", "Mülkiyet", "Sınıf", "Bölge", ...C.labels, "Hizmet bedeli"],
        grouped.map((r) => [
          r.factory,
          r.ownership,
          r.vehicleClass,
          r.region,
          ...r.counts,
          r.missing ? "Eksik fiyat (" + r.missing + " grup)" : money(r.amount),
        ]),
      ),
      table(
        "Özmal ve taşeron toplamları",
        ["Fabrika", "Mülkiyet", "Hizmet bedeli"],
        totals
          .map((r) => [
            r.factory,
            r.ownership,
            r.missing ? "Eksik fiyat" : money(r.amount),
          ])
          .concat(
            C.aggregate(rows, ["factory"]).map((r) => [
              r.factory,
              "GENEL TOPLAM",
              r.missing ? "Eksik fiyat" : money(r.amount),
            ]),
          ),
      ),
    ];
  }
  function factorySections() {
    const rows = filterServices(services()),
      factory = $("ew-factory").value;
    const ids = new Set(
      factory ? [factory] : S.data.musteriler.map((c) => c.id),
    );
    const sales = entries("sale").filter((e) => ids.has(e.entity)),
      collections = entries("collection").filter((e) => ids.has(e.entity));
    const section = table(
      "Dış muhasebe / Excel kayıtları",
      [
        "Fabrika",
        "Hizmet (rapor tarifesi)",
        "Fatura matrahı",
        "KDV",
        "Tahsil edilecek fatura tutarı",
        "Bu döneme eşlenmiş tahsilat",
        "Fatura / tahsilat farkı",
        "Hizmet − fatura",
      ],
      [...ids].map((id) => {
        const s = sales.filter((e) => e.entity === id),
          p = collections.filter((e) => e.entity === id),
          srv = rows.filter((r) => r.customerId === id);
        const basis = $("ew-service-basis")?.value || "";
        const partial = Boolean(
          $("ew-ownership").value ||
          (!$("ew-vehicle-wrap").hidden && $("ew-vehicle").value),
        );
        const invoiceService = s.reduce(
          (a, e) =>
            a + e.payload.base + (basis === "inclusive" ? e.payload.vat : 0),
          0,
        );
        const difference =
          basis && !partial && s.length && !srv.some((r) => r.missing)
            ? money(C.sum(srv, "amount") - invoiceService)
            : "Kapsam doğrulanmalı";
        return [
          cname(id),
          srv.some((r) => r.missing)
            ? "Eksik fiyat"
            : money(C.sum(srv, "amount")),
          s.length
            ? money(s.reduce((a, e) => a + e.payload.base, 0))
            : "Henüz girilmedi",
          s.length ? money(s.reduce((a, e) => a + e.payload.vat, 0)) : "—",
          s.length ? money(s.reduce((a, e) => a + e.payload.total, 0)) : "—",
          p.length
            ? money(p.reduce((a, e) => a + e.payload.amount, 0))
            : "Tahsilat kaydı yok",
          s.length && p.length
            ? money(
                s.reduce((a, e) => a + e.payload.total, 0) -
                  p.reduce((a, e) => a + e.payload.amount, 0),
              )
            : "Doğrulama gerekli",
          difference,
        ];
      }),
    );
    return [
      ...serviceSections(rows),
      section,
      table(
        "Fatura ayrıntıları",
        [
          "Fabrika",
          "Belge no",
          "Tarih",
          "Matrah",
          "KDV",
          "Ödenecek",
          "Açıklama",
        ],
        sales.map((e) => [
          cname(e.entity),
          e.reference,
          e.payload.date,
          money(e.payload.base),
          money(e.payload.vat),
          money(e.payload.total),
          e.payload.note,
        ]),
      ),
      table(
        "Tahsilat ayrıntıları",
        ["Fabrika", "Referans", "Tarih", "Fatura no", "Tutar"],
        collections.map((e) => [
          cname(e.entity),
          e.reference,
          e.payload.date,
          e.payload.invoice || "Eşleştirilmedi",
          money(e.payload.amount),
        ]),
      ),
    ];
  }
  const factoryNotes = [
    "Hizmet bedeli yalnızca müşteri raporu tarifelerinden hesaplanır. Günlük ücret ve cari hakediş tarifeleri kullanılmaz.",
    "Fatura ve tahsilatlar bu çalışma alanına girilen dış muhasebe kayıtlarıdır. Kayıt bulunmaması sıfır borç veya sıfır tahsilat anlamına gelmez.",
    "Araç/mülkiyet filtresi hizmeti daraltır; fatura ve tahsilatlar fabrikanın tamamına aittir. Hizmetin KDV kapsamı doğrulanmadan fatura matrahıyla kesin fark hesaplanmaz.",
  ];
  function ownerSections(ownerId, month = $("ew-month").value) {
    const owner = owners().find((o) => o.id === ownerId);
    if (!owner)
      throw Error("Önce araç sahibi eşleştirmesi oluşturup sahibini seçin.");
    const ids = new Set(owner.vehicles);
    const rows = services(month, true).filter((r) => ids.has(r.vehicleId));
    const fuel = S.data.yakit_takip.filter(
      (r) => ids.has(r.arac_id) && String(r.tarih).startsWith(month),
    );
    let manual = [];
    const manualNotes = [];
    for (const id of ids) {
      let raw;
      try {
        raw = localStorage.getItem("cari_manuel_" + id + "_" + month);
        const lines = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(lines)) throw Error();
        manual.push(...lines);
        manualNotes.push([
          vname(id),
          raw
            ? lines.length + " yerel kalem okundu"
            : "Bu tarayıcıda kayıt yok; diğer cihazlar bilinmiyor",
        ]);
      } catch {
        manualNotes.push([vname(id), "Yerel kayıt okunamadı"]);
      }
    }
    const totals = C.ownerStatement(
      rows,
      fuel,
      manual,
      window.HakedisCalculations,
    );
    const payments = owner.cari
      ? S.data.cari_odemeler.filter(
          (p) => p.cari_id === owner.cari && String(p.tarih).startsWith(month),
        )
      : [];
    const adjustments = entries("owner_adjustment", ownerId, month);
    const delta = adjustments.reduce(
      (s, e) => s + (e.payload.type === "income" ? 1 : -1) * e.payload.amount,
      0,
    );
    const detail = owner.vehicles.map((id) => {
      const sr = rows.filter((r) => r.vehicleId === id),
        fl = fuel.filter((r) => r.arac_id === id);
      return [
        vname(id),
        money(C.sum(sr, "amount")),
        money(C.sum(fl, "toplam_tutar")),
        sr.some((r) => r.missing) ? "Fiyat eksik" : "Cari tarifesi",
      ];
    });
    return [
      table(
        owner.name + " · Dönem hesabı",
        ["Kalem", "Tutar"],
        [
          [
            "Hizmet brütü",
            totals.missing ? "Eksik fiyat" : money(totals.gross),
          ],
          ["KDV", money(totals.kdv)],
          ["Tevkifat (mevcut hesap yöntemi)", money(totals.tev)],
          ["Yakıt kesintisi (bir kez)", money(totals.yakit)],
          ["Yerel manuel gelir", money(totals.manualIncomeTotal)],
          ["Yerel manuel gider", money(totals.manualExpenseTotal)],
          ["Çalışma dosyası düzeltmeleri", money(delta)],
          [
            "Hesaplanan dönem neti",
            totals.missing ? "Eksik fiyat" : money(totals.net + delta),
          ],
          [
            "Eşlenen carinin dönem ödemeleri",
            owner.cari
              ? money(C.sum(payments, "tutar"))
              : "Cari eşleştirilmedi",
          ],
          [
            "Dönem neti − dönem ödemeleri (kesin bakiye değildir)",
            !totals.missing && owner.cari
              ? money(totals.net + delta - C.sum(payments, "tutar"))
              : "Doğrulama gerekli",
          ],
        ],
      ),
      table(
        "Araç / fabrika hizmetleri",
        ["Plaka", "Fabrika", "Bölge", ...C.labels, "Brüt"],
        rows.map((r) => [
          r.plate,
          r.factory,
          r.region,
          ...r.counts,
          money(r.amount),
        ]),
      ),
      table(
        "Araç dökümü",
        ["Plaka", "Hizmet brütü", "Yakıt kesintisi", "Kaynak"],
        detail,
      ),
      table(
        "Yakıt alımları",
        ["Plaka", "Tarih", "Litre", "Tutar"],
        fuel.map((r) => [
          vname(r.arac_id),
          r.tarih,
          fmt(r.litre),
          money(r.toplam_tutar),
        ]),
      ),
      table(
        "Cari ödeme kayıtları",
        ["Tarih", "Tutar", "Açıklama"],
        payments.map((r) => [r.tarih, money(r.tutar), r.aciklama]),
      ),
      table(
        "Ek kalemler / avanslar",
        ["Tür", "Referans", "Tutar", "Açıklama"],
        adjustments.map((e) => [
          e.payload.type === "income" ? "Ek hakediş" : "Kesinti / avans",
          e.reference,
          money(e.payload.amount),
          e.payload.note,
        ]),
      ),
      table(
        "Yerel kayıt kontrolü",
        ["Plaka", "Manuel kalem kaynağı"],
        manualNotes,
      ),
      table(
        "Yerel manuel kalemler",
        ["Başlık", "Tür", "Tutar", "KDV oranı"],
        manual.map((r) => [r.baslik, r.tip, money(r.tutar), fmt(r.kdv_oran)]),
      ),
    ];
  }
  const ownerNotes = [
    "Bu pusula cari puantaj tarifesi ve dönemsel adet düzeltmelerini okur. Ayrı taşeron sefer tablosu tekrar eklenmez; yakıt ikinci kez kesilmez.",
    "Cari ödemeleri önceki dönem borcuna ait olabilir. Açılış bakiyesi ve tüm manuel kayıtlar doğrulanmadığı için sonuç kesin cari bakiye değildir.",
    "Manuel hakediş kalemleri bu tarayıcıdan okunur; başka cihazdaki kayıtlar otomatik bulunamaz. Ek düzeltmeleri yalnızca daha önce kaydedilmemiş işlemler için kullanın.",
  ];
  function changesSections() {
    const b = C.monthBounds($("ew-month").value);
    const current = filterServices(services()),
      previous = filterServices(services(b.previous));
    const rows = C.changes(current, previous);
    const fuel = S.data.yakit_takip;
    const vehicles = S.data.araclar.filter(
      (v) =>
        (!$("ew-vehicle").value || v.id === $("ew-vehicle").value) &&
        (!$("ew-ownership").value ||
          v.mulkiyet_durumu === $("ew-ownership").value),
    );
    const expenses = [];
    for (const v of vehicles) {
      const values = ["yakit_takip", "arac_bakimlari", "arac_policeler"].map(
        (t, i) => {
          const field = ["tarih", "islem_tarihi", "baslangic_tarihi"][i];
          return [b.previous, $("ew-month").value].map((m) =>
            C.sum(
              S.data[t].filter(
                (r) => r.arac_id === v.id && String(r[field]).startsWith(m),
              ),
              "toplam_tutar",
            ),
          );
        },
      );
      if (values.some((x) => x.some(Boolean)))
        expenses.push([
          v.plaka,
          ...values.flatMap(([a, b]) => [money(a), money(b), money(b - a)]),
        ]);
    }
    const ownerChanges = owners().map((o) => {
      const old = ownerSections(o.id, b.previous)[0].rows,
        now = ownerSections(o.id, $("ew-month").value)[0].rows;
      return [
        o.name,
        old[0][1],
        now[0][1],
        old[3][1],
        now[3][1],
        old[7][1],
        now[7][1],
      ];
    });
    return [
      table(
        "Araç sahibi dönem karşılaştırması",
        [
          "Sahip",
          "Önceki brüt",
          "Güncel brüt",
          "Önceki yakıt",
          "Güncel yakıt",
          "Önceki net",
          "Güncel net",
        ],
        ownerChanges,
        "Cari tarifesiyle hesaplanan dönem hareketleridir. Fabrika filtresinden bağımsız, sahibin eşlenen tüm araçlarını kapsar.",
      ),
      table(
        "Hizmet bedeli neden değişti?",
        [
          "Fabrika",
          "Plaka",
          "Bölge",
          "Önceki",
          "Bu ay",
          "Miktar etkisi",
          "Fiyat etkisi",
          "Açıklama",
        ],
        rows.map((r) => [
          r.factory,
          r.plate,
          r.region,
          money(r.before),
          money(r.after),
          money(r.quantity),
          money(r.price),
          r.reason,
        ]),
      ),
      table(
        "Araç giderleri: önceki / bu ay / fark",
        [
          "Plaka",
          "Yakıt önce",
          "Yakıt şimdi",
          "Fark",
          "Bakım önce",
          "Bakım şimdi",
          "Fark",
          "Poliçe önce",
          "Poliçe şimdi",
          "Fark",
        ],
        expenses,
        "Yakıt satın alma tutarıdır; tüketim değildir. Poliçe toplamı başlangıç ayında gösterilir, aylık amortisman değildir. Fabrika filtresi araç giderlerini dağıtmaz.",
      ),
    ];
  }
  async function vehicleSections() {
    const id = $("ew-vehicle").value,
      v = S.data.araclar.find((v) => v.id === id);
    if (!v) throw Error("Bir araç seçin.");
    const [maintenance, policies, fuel, puantaj] = await Promise.all(
      [
        "arac_bakimlari",
        "arac_policeler",
        "yakit_takip",
        "musteri_servis_puantaj",
      ].map((t) => repo.read(t, (q) => q.eq("arac_id", id))),
    );
    S.extraSources = {
      vehicle_maintenance: maintenance.map((r) => r.id),
      vehicle_policies: policies.map((r) => r.id),
      vehicle_fuel: fuel.map((r) => r.id),
      vehicle_service: puantaj.map((r) => r.id),
    };
    const ref = S.data.arac_km_referanslari.find(
        (r) => r.arac_id === id && r.aktif,
      ),
      gps =
        ref && S.data.arac_gps_durumlari.find((r) => r.referans_id === ref.id);
    const driver = S.data.soforler.find((s) => s.id === v.sofor_id);
    return [
      table(
        "Araç özeti",
        ["Bilgi", "Değer"],
        [
          ["Plaka", v.plaka],
          ["Mülkiyet", v.mulkiyet_durumu],
          ["Şirket", v.sirket],
          ["Sahip", v.firma_adi],
          ["Sınıf", v.arac_sinifi || "Sınıflandırılmamış"],
          ["Şoför", driver?.ad_soyad || "Atanmamış"],
          ["Sistemdeki KM", fmt(v.guncel_km)],
          ["GPS kilometresi", gps ? fmt(gps.km) : "Referans / ölçüm yok"],
          ["GPS ölçüm anı", gps?.hesaplanan_an || "—"],
          ["GPS durumu", gps?.durum || "—"],
        ],
      ),
      table(
        "Araç belge tarihleri",
        ["Belge", "Bitiş"],
        [
          ["Muayene", v.muayene_bitis],
          ["Vize", v.vize_bitis],
          ["Egzoz", v.egzoz_bitis],
          ["Sigorta", v.sigorta_bitis || v.trafik_sigortasi_bitis],
          ["Kasko", v.kasko_bitis],
          ["Koltuk", v.koltuk_bitis],
        ].map(([k, d]) => [k, d || "Kayıt yok"]),
      ),
      ...serviceSections(services().filter((r) => r.vehicleId === id)),
      table(
        "Tüm bakım geçmişi",
        ["Tarih", "Tür", "KM", "Tutar", "Açıklama"],
        maintenance.map((r) => [
          r.islem_tarihi,
          r.islem_turu,
          fmt(r.km),
          money(r.toplam_tutar),
          r.aciklama,
        ]),
      ),
      table(
        "Poliçeler ve belgeler",
        ["Tür", "Başlangıç", "Bitiş", "Tutar", "Belge"],
        policies.map((r) => [
          r.police_turu,
          r.baslangic_tarihi,
          r.bitis_tarihi,
          money(r.toplam_tutar),
          r.dosya_url || "Belge eklenmemiş",
        ]),
      ),
      table(
        "Tüm yakıt geçmişi",
        ["Tarih", "Litre", "Alım tutarı"],
        fuel.map((r) => [r.tarih, fmt(r.litre), money(r.toplam_tutar)]),
      ),
      table(
        "Hizmet geçmişi",
        ["Tarih", "Fabrika", "Bölge", ...C.labels],
        puantaj.map((r) => [
          r.tarih,
          cname(r.musteri_id),
          r.bolge,
          ...C.types.map((t) => r[t] ?? 0),
        ]),
      ),
    ];
  }
  function maintenanceRows() {
    const id = $("ew-vehicle").value;
    if (!id) throw Error("Bir araç seçin.");
    const ref = S.data.arac_km_referanslari.find(
        (r) => r.arac_id === id && r.aktif,
      ),
      gps =
        ref && S.data.arac_gps_durumlari.find((r) => r.referans_id === ref.id);
    const fresh =
      gps?.durum === "ready" &&
      Date.now() - Date.parse(gps.hesaplanan_an) < 36 * 3600000;
    return S.data.arac_bakim_planlari
      .filter((p) => p.arac_id === id && p.aktif)
      .map((p) => {
        const last = (S.maintenanceHistory || [])
          .filter((r) => r.bakim_plan_id === p.id)
          .sort((a, b) =>
            String(b.islem_zamani || b.islem_tarihi).localeCompare(
              String(a.islem_zamani || a.islem_tarihi),
            ),
          )[0];
        const result = window.MaintenanceTracking.maintenanceStatus({
          currentKm: fresh ? C.num(gps.km) : null,
          serviceKm: last ? C.num(last.km) : C.num(p.ilk_bakim_km),
          serviceAt:
            last?.islem_zamani || last?.islem_tarihi || p.ilk_bakim_zamani,
          intervalKm: C.num(p.km_araligi),
          intervalDays: C.num(p.gun_araligi),
          asOf: new Date().toISOString(),
        });
        return { p, result };
      });
  }
  function stockSections(needOnly = false) {
    const rows = C.inventory(S.parts || [], S.movements || []).filter(
      (r) => !needOnly || r.need > 0,
    );
    return [
      table(
        needOnly ? "Satın alma ihtiyaç listesi" : "Stok envanteri",
        [
          "Kod",
          "Parça",
          "Raf",
          "Birim",
          "Stok",
          "Minimum",
          "İhtiyaç",
          "Uyumlu araçlar",
          "Model notu",
        ],
        rows.map((p) => [
          p.code,
          p.name,
          p.location,
          p.unit,
          fmt(p.qty),
          fmt(p.minimum),
          fmt(p.need),
          p.compatible_vehicles.map(vname).join(", "),
          p.model_notes,
        ]),
      ),
      ...(!needOnly
        ? [
            table(
              "Stok hareketleri",
              ["Tarih", "Parça", "Miktar", "Araç", "Açıklama"],
              (S.movements || []).map((m) => [
                m.occurred_on,
                S.parts.find((p) => p.id === m.part_id)?.name,
                fmt(m.quantity),
                m.vehicle_id ? vname(m.vehicle_id) : "Depo girişi",
                m.note,
              ]),
            ),
          ]
        : []),
    ];
  }
  async function build() {
    S.extraSources = {};
    const buildKey = ++S.buildKey;
    status("Dosya hazırlanıyor…");
    try {
      let r;
      const month = $("ew-month").value;
      switch (S.tab) {
        case "factory":
          r = report(factorySections(), factoryNotes);
          break;
        case "owner":
        case "package":
          r = report(ownerSections($("ew-owner").value), ownerNotes);
          break;
        case "vehicle":
          r = report(await vehicleSections(), [
            "Özet hizmet bedeli seçilen döneme aittir. Bakım, belge, yakıt ve hizmet geçmişi tüm kayıtları içerir.",
          ]);
          break;
        case "changes":
          r = report(changesSections(), [
            "Karşılaştırma: " + C.monthBounds(month).previous + " → " + month,
            "Yeni veya eksik tarifede neden tahmin edilmez.",
          ]);
          break;
        case "quote": {
          const input = Object.fromEntries(new FormData($("ew-quote-form")));
          const q = C.quote(input);
          r = report(
            [
              table(
                "Teklif karşılaştırması",
                ["Kalem", "Özmal", "Taşeron"],
                [
                  ["Aylık kilometre (boş km dahil)", fmt(q.km), fmt(q.km)],
                  [
                    "Yakıt maliyeti",
                    money(q.fuel),
                    "Günlük bedelin içinde kabul edildi",
                  ],
                  [
                    "Aylık maliyet / başabaş",
                    money(q.owned),
                    money(q.contractor),
                  ],
                  [
                    "Maliyet üzerine hedef artış",
                    fmt(input.profit) + "%",
                    fmt(input.profit) + "%",
                  ],
                  [
                    "Önerilen teklif (KDV hariç)",
                    money(q.ownedQuote),
                    money(q.contractorQuote),
                  ],
                ],
              ),
              table(
                "Senaryo girdileri",
                ["Girdi", "Değer"],
                Object.entries(input).map(([k, v]) => [
                  {
                    job: "İş / fabrika",
                    class: "Araç sınıfı",
                    services: "Vardiya / tek sefer",
                    days: "Çalışma günü",
                    dailyKm: "Günlük hizmet KM",
                    emptyKm: "Günlük boş KM",
                    liters100: "Tüketim varsayımı L/100 KM",
                    fuelPrice: "Yakıt litre fiyatı",
                    salary: "Aylık şoför maliyeti",
                    maintenanceKm: "KM başına bakım payı",
                    fixed: "Aylık diğer giderler",
                    contractorDaily: "Taşeron günlük bedeli",
                    profit: "Maliyet üzerine kazanç %",
                  }[k] || k,
                  v,
                ]),
              ),
            ],
            [
              "Tahmini senaryo. Girilmeyen maliyetler sıfır kabul edilmez. Taşeron günlük bedeli tüm giderleri kapsamalıdır; özmal sabit giderlerine sigorta, vergi ve amortisman payını dahil edin.",
            ],
          );
          r.inputs = input;
          break;
        }
        case "prices": {
          const mode = $("ew-price-mode").value,
            value = $("ew-price-value").value,
            cls = $("ew-price-class").value;
          const rows = C.scenario(
            filterServices(services()).filter(
              (r) => !cls || r.vehicleClass === cls,
            ),
            mode,
            value,
          );
          r = report(
            [
              table(
                "Tarife senaryosu",
                [
                  "Fabrika",
                  "Plaka",
                  "Sınıf",
                  "Mülkiyet",
                  ...C.labels.map((l) => l + " fiyatı"),
                  "Eski toplam",
                  "Yeni toplam",
                  "Fark",
                ],
                rows.map((r) => [
                  r.factory,
                  r.plate,
                  r.vehicleClass,
                  r.ownership,
                  ...r.rates.map(money),
                  money(r.before),
                  money(r.amount),
                  r.amount === null || r.before === null
                    ? "Eksik fiyat"
                    : money(r.amount - r.before),
                ]),
              ),
              table(
                "Senaryo toplamı",
                ["Önce", "Sonra", "Fark"],
                [
                  [
                    money(C.sum(rows, "before")),
                    money(C.sum(rows, "amount")),
                    money(C.sum(rows, "amount") - C.sum(rows, "before")),
                  ],
                ],
              ),
            ],
            [
              "SİMÜLASYON · " +
                (mode === "percent" ? "Yüzde " : "Birim fiyatlara TL ") +
                value +
                " değişim. Mevcut müşteri raporu ve cari fiyatları değişmez.",
              "Eksik fiyatlı satırlar varsa toplamlar kısmi toplamdır.",
            ],
          );
          r.inputs = { mode, value, vehicleClass: cls };
          break;
        }
        case "maintenance": {
          const selected = new Set(
            [...document.querySelectorAll("[name=ew-plan]:checked")].map(
              (el) => el.value,
            ),
          );
          const rows = maintenanceRows().filter(({ p }) => selected.has(p.id));
          if (!rows.length) throw Error("İş listesine en az bir bakım seçin.");
          r = report(
            [
              table(
                vname($("ew-vehicle").value) + " · Servis iş listesi",
                [
                  "Yapılacak iş",
                  "Konum",
                  "Kalan KM",
                  "Kalan gün",
                  "Servis notu",
                ],
                rows.map(({ p, result }) => [
                  p.tur,
                  p.konum,
                  fmt(result.remainingKm),
                  fmt(result.remainingDays),
                  $("ew-maint-note").value,
                ]),
              ),
            ],
            [
              "Planlanan işlerdir. Bu listeyi hazırlamak bakımı tamamlamaz, sayaç sıfırlamaz ve gider oluşturmaz.",
            ],
          );
          break;
        }
        case "management": {
          let sections = [];
          const selected = [
            ...document.querySelectorAll("[name=ew-section]:checked"),
          ].map((el) => el.value);
          if (!selected.length) throw Error("En az bir bölüm seçin.");
          const service = filterServices(services());
          sections.push(
            table(
              "Yönetici özeti",
              ["Gösterge", "Değer"],
              [
                [
                  "Dönem hizmet bedeli",
                  service.some((r) => r.missing)
                    ? "Eksik fiyat"
                    : money(C.sum(service, "amount")),
                ],
                [
                  "Fabrika sayısı",
                  new Set(service.map((r) => r.customerId)).size,
                ],
                [
                  "Hizmet veren araç",
                  new Set(service.map((r) => r.vehicleId)).size,
                ],
                ["Vardiya", service.reduce((s, r) => s + r.counts[0], 0)],
                ["Tek sefer", service.reduce((s, r) => s + r.counts[1], 0)],
                [
                  "Yakıt alımı",
                  money(
                    C.sum(
                      S.data.yakit_takip.filter((r) =>
                        String(r.tarih).startsWith(month),
                      ),
                      "toplam_tutar",
                    ),
                  ),
                ],
                [
                  "Bakım kaydı tutarı",
                  money(
                    C.sum(
                      S.data.arac_bakimlari.filter((r) =>
                        String(r.islem_tarihi).startsWith(month),
                      ),
                      "toplam_tutar",
                    ),
                  ),
                ],
              ],
              "Hizmet seçili filtrelere; yakıt ve bakım tutarları tüm filonun dönem kayıtlarına aittir. Kâr hesabı değildir.",
            ),
          );
          if (selected.includes("factory")) sections.push(...factorySections());
          if (selected.includes("owner"))
            for (const o of owners()) sections.push(...ownerSections(o.id));
          if (selected.includes("changes")) sections.push(...changesSections());
          if (selected.includes("vehicles")) {
            sections.push(
              table(
                "Araçlar / GPS güncel durumu",
                [
                  "Plaka",
                  "Mülkiyet",
                  "Sınıf",
                  "Kayıtlı KM",
                  "GPS KM",
                  "Ölçüm anı",
                  "Durum",
                ],
                S.data.araclar.map((v) => {
                  const ref = S.data.arac_km_referanslari.find(
                      (r) => r.arac_id === v.id && r.aktif,
                    ),
                    g =
                      ref &&
                      S.data.arac_gps_durumlari.find(
                        (r) => r.referans_id === ref.id,
                      );
                  return [
                    v.plaka,
                    v.mulkiyet_durumu,
                    v.arac_sinifi,
                    fmt(v.guncel_km),
                    fmt(g?.km),
                    g?.hesaplanan_an || "—",
                    g?.durum || "Ölçüm yok",
                  ];
                }),
              ),
            );
          }
          if (selected.includes("costs"))
            for (const [t, date] of [
              ["yakit_takip", "tarih"],
              ["arac_bakimlari", "islem_tarihi"],
              ["arac_policeler", "baslangic_tarihi"],
            ])
              sections.push(
                table(
                  {
                    yakit_takip: "Yakıt alımları",
                    arac_bakimlari: "Bakım kayıtları",
                    arac_policeler: "Başlayan poliçeler",
                  }[t],
                  ["Tarih", "Plaka", "Tutar", "Tür / açıklama"],
                  S.data[t]
                    .filter((r) => String(r[date]).startsWith(month))
                    .map((r) => [
                      r[date],
                      vname(r.arac_id),
                      money(r.toplam_tutar),
                      r.islem_turu || r.police_turu || fmt(r.litre) + " L",
                    ]),
                ),
              );
          if (selected.includes("stock")) sections.push(...stockSections(true));
          sections.push(
            table(
              "Eksik veri / kontrol",
              ["Konu", "Adet / açıklama"],
              [
                [
                  "Fiyatı eksik hizmet grubu",
                  services().filter((r) => r.missing).length,
                ],
                [
                  "Sınıflandırılmamış araç",
                  S.data.araclar.filter((v) => !v.arac_sinifi).length,
                ],
                [
                  "Sahip eşleştirmesi",
                  owners().length +
                    " tanım; isim benzerliğinden otomatik birleştirme yapılmaz",
                ],
                ["Dış muhasebe kapsamı", "Girilen kayıtlarla sınırlı"],
                [
                  "GPS tüketim analizi",
                  "Yakıt alımı tüketim değildir; depo başlangıç/bitiş ölçümü olmadan kesin tüketim verilmez",
                ],
              ],
            ),
            table(
              "Yönetim notları ve kararlar",
              ["Not"],
              [[$("ew-management-note").value || "Not eklenmedi"]],
            ),
          );
          r = report(sections, [
            ...factoryNotes,
            ...ownerNotes,
            "Yönetim dosyası seçili bölümlerin anlık görüntüsüdür; tüm giderler bulunmadan kâr olarak yorumlanmaz.",
          ]);
          break;
        }
        case "stock":
          r = report(stockSections($("ew-stock-needs").checked), [
            "Stok hareketleri bağımsızdır. Eski bakım/cari kayıtlarına otomatik işlem yapılmaz.",
          ]);
          break;
        default:
          return;
      }
      if (buildKey !== S.buildKey) return;
      renderReport(r);
      status(
        "Dosya hazır. Kaydederek bu sürümü koruyabilir veya PDF / Excel çıktısı alabilirsiniz.",
      );
    } catch (e) {
      status(e.message);
    }
  }
  function modal(title, content, onSave) {
    let d = $("ew-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "ew-dialog";
      d.className = "ew-dialog";
      document.body.append(d);
    }
    d.innerHTML =
      "<form><h2>" +
      esc(title) +
      '</h2><div class="ew-form-grid">' +
      content +
      '</div><p role="status"></p><footer><button type="button">Vazgeç</button><button type="submit">Kaydet</button></footer></form>';
    let busy = false;
    d.oncancel = (e) => {
      if (busy) e.preventDefault();
    };
    d.querySelector("button").onclick = () => d.close();
    d.querySelector("form").onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      d.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await onSave(new FormData(e.target));
        d.close();
        await load();
      } catch (error) {
        d.querySelector("[role=status]").textContent = error.message;
      } finally {
        busy = false;
        d.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
    d.showModal();
  }
  function addFinance(kind) {
    const isSale = kind === "sale";
    modal(
      isSale ? "Dış muhasebe satış faturası" : "Fabrika tahsilatı",
      select("Fabrika", "entity", options(S.data.musteriler, "ad", "Seçin")) +
        field(
          "Hizmet dönemi",
          "period",
          "month",
          $("ew-month").value,
          "required",
        ) +
        field(
          isSale ? "Fatura numarası" : "Benzersiz ödeme referansı",
          "reference",
          "text",
          "",
          "required",
        ) +
        field("İşlem tarihi", "date", "date", today(), "required") +
        (isSale
          ? field(
              "KDV hariç matrah",
              "base",
              "number",
              "",
              'min="0" step="0.01" required',
            ) +
            field(
              "KDV tutarı",
              "vat",
              "number",
              "",
              'min="0" step="0.01" required',
            ) +
            field(
              "Tevkifat vb. sonrası tahsil edilecek tutar",
              "total",
              "number",
              "",
              'min="0" step="0.01" required',
            )
          : field(
              "Tahsilat tutarı",
              "amount",
              "number",
              "",
              'min="0.01" step="0.01" required',
            ) + field("İlgili fatura numarası", "invoice")) +
        field("Açıklama", "note"),
      async (f) => {
        if (!f.get("entity")) throw Error("Fabrika seçin.");
        const payload = { date: f.get("date"), note: f.get("note") };
        for (const key of isSale ? ["base", "vat", "total"] : ["amount"])
          payload[key] = Number(f.get(key));
        if (!isSale) {
          payload.invoice = f.get("invoice");
          if (
            payload.invoice &&
            !S.entries.some(
              (e) =>
                e.kind === "sale" &&
                e.entity === f.get("entity") &&
                e.reference === payload.invoice,
            )
          )
            throw Error("Fatura numarası seçilen fabrikada bulunamadı.");
        }
        await repo.insert("ek_workspace_entries", {
          kind,
          entity: f.get("entity"),
          period: f.get("period"),
          reference: String(f.get("reference")).trim(),
          payload,
        });
      },
    );
  }
  function addOwner() {
    const existing = owners().find((o) => o.id === $("ew-owner").value);
    const id = existing?.id || crypto.randomUUID();
    modal(
      existing
        ? "Sahip eşleştirmesinin yeni sürümü"
        : "Araç sahibi eşleştirmesi",
      field(
        "Araç sahibinin adı / unvanı",
        "name",
        "text",
        existing?.name || "",
        "required",
      ) +
        select(
          "Ödemeleri okunacak cari",
          "cari",
          options(S.data.cariler, "unvan", "Henüz eşleşmedi"),
        ) +
        "<p>Araçları açıkça seçin. Sadece taşeron araçlar listelenir.</p>" +
        S.data.araclar
          .filter((v) => v.mulkiyet_durumu === "TAŞERON")
          .map((v) =>
            check(
              v.plaka + " · " + (v.firma_adi || "Sahip yazılmamış"),
              "vehicles",
              v.id,
              existing?.vehicles.includes(v.id),
            ),
          )
          .join(""),
      async (f) => {
        const vehicles = f.getAll("vehicles");
        if (!vehicles.length && !existing) throw Error("En az bir araç seçin.");
        const collision = owners().find(
          (o) => o.id !== id && o.vehicles.some((v) => vehicles.includes(v)),
        );
        if (collision)
          throw Error("Araç başka bir sahiple eşleşmiş: " + collision.name);
        await repo.insert("ek_workspace_entries", {
          kind: "owner",
          entity: id,
          period: $("ew-month").value,
          reference: crypto.randomUUID(),
          payload: {
            name: String(f.get("name")).trim(),
            cari: f.get("cari") || null,
            vehicles,
          },
        });
      },
    );
    if (existing)
      $("ew-dialog").querySelector("[name=cari]").value = existing.cari || "";
  }
  function addAdjustment() {
    const owner = $("ew-owner").value;
    if (!owner) return status("Önce araç sahibi seçin.");
    modal(
      "Yalnızca bu çalışma dosyasına ek kalem",
      select(
        "Tür",
        "type",
        '<option value="deduction">Kesinti / avans</option><option value="income">Ek hakediş</option>',
      ) +
        field("İşlem referansı", "reference", "text", "", "required") +
        field(
          "Tutar",
          "amount",
          "number",
          "",
          'min="0.01" step="0.01" required',
        ) +
        field(
          "Açıklama (daha önce düşülmediğini kontrol edin)",
          "note",
          "text",
          "",
          "required",
        ),
      async (f) =>
        repo.insert("ek_workspace_entries", {
          kind: "owner_adjustment",
          entity: owner,
          period: $("ew-month").value,
          reference: f.get("reference"),
          payload: {
            type: f.get("type"),
            amount: Number(f.get("amount")),
            note: f.get("note"),
          },
        }),
    );
  }
  function addPart() {
    modal(
      "Parça kartı",
      field("Parça kodu", "code", "text", "", "required") +
        field("Parça adı", "name", "text", "", "required") +
        field("Birim (adet / litre vb.)", "unit", "text", "adet", "required") +
        field("Raf / konum", "location") +
        field(
          "Minimum stok",
          "minimum",
          "number",
          "0",
          'min="0" step="0.01" required',
        ) +
        field("Uyumlu model / teknik not", "model_notes") +
        "<p>Doğrulanmış uyumlu araçlar (isteğe bağlı)</p>" +
        S.data.araclar.map((v) => check(v.plaka, "vehicles", v.id)).join(""),
      async (f) =>
        repo.insert("ek_stock_parts", {
          code: String(f.get("code")).trim(),
          name: String(f.get("name")).trim(),
          unit: f.get("unit"),
          location: f.get("location"),
          minimum: Number(f.get("minimum")),
          model_notes: f.get("model_notes"),
          compatible_vehicles: f.getAll("vehicles"),
        }),
    );
  }
  function stockMove() {
    const id = crypto.randomUUID();
    modal(
      "Stok giriş / araca çıkış",
      select("Parça", "part", options(S.parts, "name", "Seçin")) +
        select(
          "Hareket",
          "direction",
          '<option value="1">Depoya giriş</option><option value="-1">Araca çıkış</option>',
        ) +
        field(
          "Miktar",
          "quantity",
          "number",
          "",
          'min="0.001" step="0.001" required',
        ) +
        select(
          "Araç (çıkışta zorunlu)",
          "vehicle",
          options(S.data.araclar, "plaka", "Seçin"),
        ) +
        field("Tarih", "date", "date", today(), "required") +
        field("Belge / işlem açıklaması", "note", "text", "", "required"),
      async (f) => {
        if (!f.get("part")) throw Error("Parça seçin.");
        await repo.stock({
          p_id: id,
          p_part: f.get("part"),
          p_quantity: Number(f.get("quantity")) * Number(f.get("direction")),
          p_vehicle: f.get("vehicle") || null,
          p_note: f.get("note"),
          p_date: f.get("date"),
        });
      },
    );
  }
  async function importSales(file) {
    if (!file) return;
    try {
      if (!window.XLSX) throw Error("Excel okuyucu yüklenmedi.");
      const workbook = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });
      const rows = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { defval: "" },
      );
      if (!rows.length || rows.length > 500)
        throw Error("Dosya 1–500 satır içermeli.");
      const batch = rows.map((r, i) => {
        const matches = S.data.musteriler.filter(
          (c) => C.normalize(c.ad) === C.normalize(r.Fabrika),
        );
        if (matches.length !== 1)
          throw Error(
            i + 2 + ". satır: Fabrika tam adı tek kayıtla eşleşmeli.",
          );
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.Tarih) || !String(r.No).trim())
          throw Error(i + 2 + ". satır: Tarih YYYY-MM-DD ve No zorunlu.");
        if (
          !Number.isFinite(Date.parse(r.Tarih)) ||
          new Date(r.Tarih).toISOString().slice(0, 10) !== r.Tarih
        )
          throw Error(i + 2 + ". satır: Geçersiz tarih.");
        C.monthBounds(String(r.Donem));
        const values = ["Matrah", "KDV", "Toplam"].map((k) => C.num(r[k]));
        if (values.some((v) => v === null || v < 0))
          throw Error(i + 2 + ". satır: Tutarları sayısal girin.");
        return {
          kind: "sale",
          entity: matches[0].id,
          period: String(r.Donem),
          reference: String(r.No).trim(),
          payload: {
            date: r.Tarih,
            base: values[0],
            vat: values[1],
            total: values[2],
            note: String(r.Aciklama),
          },
        };
      });
      const keys = batch.map((r) => r.entity + "|" + r.reference);
      if (new Set(keys).size !== keys.length)
        throw Error("Dosyada tekrarlanan fatura numarası var.");
      const existing = S.entries.filter((e) => e.kind === "sale");
      const pending = batch.filter((r) => {
        const old = existing.find(
          (e) => e.entity === r.entity && e.reference === r.reference,
        );
        if (
          old &&
          JSON.stringify(old.payload) !== JSON.stringify(r.payload) &&
          !(
            old.payload.date === r.payload.date &&
            old.payload.base === r.payload.base &&
            old.payload.vat === r.payload.vat &&
            old.payload.total === r.payload.total &&
            old.period === r.period
          )
        )
          throw Error(
            r.reference + ": kayıtlı faturayla farklı tutar/dönem var.",
          );
        return !old;
      });
      modal(
        "Excel önizleme: " + pending.length + " yeni fatura",
        "<p>" +
          batch.length +
          " satır okundu; " +
          (batch.length - pending.length) +
          ' kayıt zaten mevcut. Yalnızca yeni kayıtlar eklenecek.</p><div class="ew-table-wrap"><table><tr><th>Fabrika</th><th>No</th><th>Dönem</th><th>Tutar</th></tr>' +
          pending
            .map(
              (r) =>
                "<tr><td>" +
                esc(cname(r.entity)) +
                "</td><td>" +
                esc(r.reference) +
                "</td><td>" +
                esc(r.period) +
                "</td><td>" +
                esc(money(r.payload.total)) +
                "</td></tr>",
            )
            .join("") +
          "</table></div>",
        async () => {
          for (const r of pending) {
            const current = await repo.read("ek_workspace_entries", (q) =>
              q
                .eq("kind", "sale")
                .eq("entity", r.entity)
                .eq("reference", r.reference),
            );
            if (current.length) {
              if (
                current[0].period !== r.period ||
                ["base", "vat", "total", "date"].some(
                  (k) => current[0].payload[k] !== r.payload[k],
                )
              )
                throw Error("Kayıt değişti: " + r.reference);
              continue;
            }
            await repo.insert("ek_workspace_entries", r);
          }
        },
      );
    } catch (e) {
      status(e.message);
    }
  }
  function extras() {
    const box = $("ew-tools");
    let html = "";
    if (S.tab === "factory")
      html =
        '<button data-action="sale">Fatura ekle</button><button data-action="collection">Tahsilat ekle</button><button data-action="template">Excel şablonu</button><label class="ew-upload">Excel içe aktar<input type="file" id="ew-import" accept=".xlsx,.csv,.xls"></label>';
    if (["owner", "package"].includes(S.tab))
      html =
        '<button data-action="owner">Sahip eşleştir / düzenle</button><button data-action="adjustment">Ek kalem / avans</button>';
    if (["factory", "management"].includes(S.tab))
      html +=
        '<label>Hizmet raporu fiyatlarının KDV kapsamı<select id="ew-service-basis"><option value="">Henüz doğrulanmadı</option><option value="exclusive">KDV hariç</option><option value="inclusive">KDV dahil</option></select></label>';
    if (S.tab === "quote") {
      const fields = [
        ["days", "Çalışma günü"],
        ["dailyKm", "Günlük hizmet KM"],
        ["emptyKm", "Günlük boş KM"],
        ["liters100", "Tüketim varsayımı L/100 KM"],
        ["fuelPrice", "Yakıt litre fiyatı"],
        ["salary", "Aylık şoför işveren maliyeti"],
        ["maintenanceKm", "KM başına bakım / lastik payı"],
        ["fixed", "Aylık diğer giderler / amortisman"],
        ["contractorDaily", "Taşeron tüm giderler dahil günlük bedel"],
        ["profit", "Maliyet üzerine kazanç %"],
      ];
      html =
        '<form id="ew-quote-form" class="ew-form-grid">' +
        field("İş / fabrika adı", "job") +
        field("Araç sınıfı", "class") +
        field("Günlük vardiya / tek sefer açıklaması", "services") +
        fields
          .map(([k, l]) =>
            field(l, k, "number", "", 'min="0" step="0.01" required'),
          )
          .join("") +
        "</form>";
    }
    if (S.tab === "prices")
      html =
        '<label>Değişim türü<select id="ew-price-mode"><option value="percent">Yüzde artış / azalış</option><option value="fixed">Birim fiyata TL ekle / çıkar</option></select></label><label>Değişim<input id="ew-price-value" type="number" step="0.01" value="10"></label><label>Sınıf<select id="ew-price-class">' +
        options(
          [
            ...new Set(
              S.data.araclar.map((v) => v.arac_sinifi || "SINIFLANDIRILMAMIŞ"),
            ),
          ].map((v) => ({ id: v, name: v })),
          "name",
        ) +
        "</select></label>";
    if (S.tab === "management")
      html +=
        '<div class="ew-sections">' +
        [
          ["factory", "Fabrikalar / faturalar"],
          ["owner", "Araç sahipleri"],
          ["changes", "Aylık değişimler"],
          ["vehicles", "Araçlar / GPS"],
          ["costs", "Yakıt / bakım / poliçeler"],
          ["stock", "Stok ihtiyaçları"],
        ]
          .map(([id, label]) => check(label, "ew-section", id, true))
          .join("") +
        '</div><label>Yönetim notları / kararlar<textarea id="ew-management-note" rows="3"></textarea></label>';
    if (S.tab === "stock")
      html =
        '<button data-action="part">Parça ekle</button><button data-action="movement">Giriş / araca çıkış</button>' +
        check("Yalnızca satın alma ihtiyaçları", "needs", "yes");
    if (S.tab === "search")
      html =
        '<label class="ew-search-label">Tüm kayıtlarda ara<input id="ew-search" type="search" placeholder="Plaka, kişi, fabrika, cari, fatura numarası…"></label><div id="ew-search-results"></div>';
    if (S.tab === "maintenance")
      html =
        '<div id="ew-plan-options">Araç seçerek bakım planlarını getirin.</div><label>Servise not<textarea id="ew-maint-note" rows="2"></textarea></label>';
    box.innerHTML = html;
    if (S.tab === "stock")
      box.querySelector("[name=needs]").id = "ew-stock-needs";
    if (S.tab === "search") {
      $("ew-search").addEventListener("input", search);
      showRecent();
    }
    if ($("ew-import"))
      $("ew-import").onchange = (e) => importSales(e.target.files[0]);
  }
  async function prepareMaintenance() {
    if (S.tab !== "maintenance") return;
    const id = $("ew-vehicle").value;
    if (!id) return;
    try {
      S.maintenanceHistory = await repo.read("arac_bakimlari", (q) =>
        q.eq("arac_id", id).not("bakim_plan_id", "is", null),
      );
      $("ew-plan-options").innerHTML =
        maintenanceRows()
          .map(({ p, result }) =>
            check(
              p.tur +
                " · " +
                p.konum +
                " · " +
                fmt(result.remainingKm) +
                " km / " +
                fmt(result.remainingDays) +
                " gün",
              "ew-plan",
              p.id,
              result.status === "due" ||
                (result.remainingKm !== null &&
                  result.remainingKm <= p.uyari_km) ||
                (result.remainingDays !== null &&
                  result.remainingDays <= p.uyari_gun),
            ),
          )
          .join("") || "Bu araçta aktif bakım planı yok.";
    } catch (e) {
      status(e.message);
    }
  }
  function showRecent() {
    let recent = [];
    try {
      recent = JSON.parse(sessionStorage.getItem("ew-recent-search") || "[]");
    } catch {}
    $("ew-search-results").innerHTML =
      "<p>Son aramalar: " +
      recent
        .map(
          (v) => '<button data-search="' + esc(v) + '">' + esc(v) + "</button>",
        )
        .join(" ") +
      "</p>";
  }
  let searchTimer;
  function search() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const value = $("ew-search")?.value || "",
        q = C.normalize(value);
      if (q.length < 2) {
        showRecent();
        return;
      }
      try {
        if (!S.searchInvoices)
          S.searchInvoices = await repo.read("cari_faturalar");
        if ($("ew-search")?.value !== value) return;
        const results = [];
        for (const [t, label, key] of [
          ["araclar", "Araç", "plaka"],
          ["musteriler", "Fabrika", "ad"],
          ["soforler", "Personel", "ad_soyad"],
          ["cariler", "Cari", "unvan"],
        ])
          for (const r of S.data[t])
            if (C.normalize(r[key]).includes(q))
              results.push({ type: t, label, name: r[key], id: r.id });
        for (const r of S.searchInvoices)
          if (C.normalize(r.fatura_no).includes(q))
            results.push({
              type: "invoice",
              label: "Alış faturası",
              name: r.fatura_no + " · " + money(r.toplam_tutar),
              id: r.id,
            });
        for (const r of S.entries.filter((e) => e.kind === "sale"))
          if (C.normalize(r.reference).includes(q))
            results.push({
              type: "sale",
              label: "Satış faturası",
              name: r.reference + " · " + cname(r.entity),
              id: r.id,
            });
        S.searchResults = results;
        $("ew-search-results").innerHTML =
          "<p>" +
          results.length +
          " sonuç</p>" +
          results
            .slice(0, 100)
            .map(
              (r, i) =>
                '<button class="ew-search-result" data-result="' +
                i +
                '"><small>' +
                esc(r.label) +
                "</small>" +
                esc(r.name) +
                "</button>",
            )
            .join("");
        renderReport(
          report(
            [
              table(
                "Arama: " + value,
                ["Tür", "Sonuç"],
                results.map((r) => [r.label, r.name]),
              ),
            ],
            [
              "Fatura araması tüm kayıtları kapsar; sonuçlar mevcut oturumla okunur.",
            ],
            "Arama sonuçları",
          ),
        );
      } catch (e) {
        status(e.message);
      }
    }, 250);
  }
  function selectTab(tab) {
    S.buildKey++;
    S.tab = tab;
    S.report = null;
    $("ew-result").innerHTML = "";
    $("ew-output-actions").hidden = true;
    $("ew-heading").textContent = titles[tab];
    $("ew-description").textContent =
      descriptions[tab] || "Önceki sürümleri açıp yeniden çıktı alın.";
    document
      .querySelectorAll("[data-ew-tab]")
      .forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.ewTab === tab)),
      );
    extras();
    $("ew-build").hidden = ["search", "archive"].includes(tab);
    $("ew-owner-wrap").hidden = !["owner", "package"].includes(tab);
    $("ew-vehicle-wrap").hidden = ![
      "vehicle",
      "maintenance",
      "changes",
      "factory",
      "prices",
    ].includes(tab);
    $("ew-factory-wrap").hidden = ![
      "factory",
      "changes",
      "prices",
      "management",
    ].includes(tab);
    $("ew-ownership-wrap").hidden = ![
      "factory",
      "changes",
      "prices",
      "management",
    ].includes(tab);
    if (tab === "archive") archive();
    if (tab === "maintenance") prepareMaintenance();
    status("");
  }
  function archive() {
    const rows = S.snapshots
      .filter((r) => r.period === $("ew-month").value)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    $("ew-result").innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              '<button class="ew-archive" data-snapshot="' +
              esc(r.id) +
              '"><strong>' +
              esc(r.title) +
              "</strong><span>" +
              esc(r.period) +
              " · " +
              esc(new Date(r.created_at).toLocaleString("tr-TR")) +
              "</span><small>" +
              esc(r.id.slice(0, 8)) +
              "</small></button>",
          )
          .join("")
      : "<p>Bu dönemde kaydedilmiş dosya yok.</p>";
  }
  async function load() {
    S.report = null;
    $("ew-result").innerHTML = "";
    $("ew-output-actions").hidden = true;
    S.buildKey++;
    const request = ++S.request;
    S.loaded = false;
    $("ew-build").disabled = true;
    status("Seçilen dönemin kaynakları yükleniyor…");
    try {
      repo = window.ERPWorkspaceData.create(window.supabaseClient);
      const bounds = C.monthBounds($("ew-month").value),
        previous = C.monthBounds(bounds.previous);
      const dated = {
        musteri_servis_puantaj: "tarih",
        yakit_takip: "tarih",
        arac_bakimlari: "islem_tarihi",
        arac_policeler: "baslangic_tarihi",
        cari_odemeler: "tarih",
      };
      const tables = [
        "araclar",
        "musteriler",
        "soforler",
        "cariler",
        "musteri_servis_puantaj",
        "rapor_musteri_fiyatlari",
        "musteri_arac_tanimlari",
        "yakit_takip",
        "arac_bakimlari",
        "arac_policeler",
        "cari_odemeler",
        "arac_bakim_planlari",
        "arac_km_referanslari",
        "arac_gps_durumlari",
      ];
      const results = await Promise.all(
        tables.map((t) =>
          repo.read(t, (q) =>
            dated[t]
              ? q.gte(dated[t], previous.start).lte(dated[t], bounds.end)
              : ["rapor_musteri_fiyatlari", "musteri_arac_tanimlari"].includes(
                    t,
                  )
                ? q.or(
                    "donem.eq." +
                      $("ew-month").value +
                      ",donem.eq." +
                      bounds.previous +
                      ",donem.is.null",
                  )
                : q,
          ),
        ),
      );
      const additions = await Promise.all(
        [
          "ek_workspace_entries",
          "ek_workspace_snapshots",
          "ek_stock_parts",
          "ek_stock_movements",
        ].map((t) => repo.read(t)),
      );
      if (request !== S.request) return;
      S.data = Object.fromEntries(tables.map((t, i) => [t, results[i]]));
      [S.entries, S.snapshots, S.parts, S.movements] = additions;
      for (const [id, rows, key] of [
        ["ew-factory", S.data.musteriler, "ad"],
        ["ew-vehicle", S.data.araclar, "plaka"],
        ["ew-owner", owners(), "name"],
      ]) {
        const el = $(id),
          old = el.value;
        el.innerHTML = options(
          rows,
          key,
          id === "ew-owner"
            ? "Sahip seçin"
            : id === "ew-vehicle"
              ? "Araç seçin"
              : "Tüm fabrikalar",
        );
        el.value = old;
      }
      if (S.selectedVehicle) {
        $("ew-vehicle").value = S.selectedVehicle;
        S.selectedVehicle = "";
      }
      S.loaded = true;
      selectTab(S.tab);
      if (S.tab === "search") $("ew-search").focus();
      status("Kaynaklar güncel. " + new Date().toLocaleTimeString("tr-TR"));
    } catch (e) {
      status(
        "Yükleme tamamlanamadı: " + e.message + ". Yenile ile tekrar deneyin.",
      );
      S.report = null;
      $("ew-output-actions").hidden = true;
    } finally {
      if (request === S.request) $("ew-build").disabled = !S.loaded;
    }
  }
  function print() {
    if (!S.report) return;
    const w = window.open("", "_blank");
    if (!w)
      return status(
        "Çıktı penceresi engellendi. Bu site için açılır pencereye izin verin.",
      );
    w.document.write(
      '<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>' +
        esc(S.report.title + " " + S.report.period) +
        "</title><style>body{font:11px Arial;color:#172333;margin:24px}h2{font-size:20px}h3{margin:24px 0 8px}table{width:100%;border-collapse:collapse;table-layout:auto}th,td{padding:7px 5px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}th{background:#f2f4f6}thead{display:table-header-group}tr{break-inside:avoid}.ew-report-head{display:flex;justify-content:space-between}.ew-stamp{font-size:24px;font-weight:bold}.ew-stamp small{display:block;font-size:10px;font-weight:normal}.ew-note{font-size:10px;color:#555}footer{margin-top:24px;font-size:9px}@page{size:A4 landscape;margin:12mm}@media print{button{display:none}}</style></head><body>" +
        htmlReport(S.report) +
        "<footer>İDEOL · Baris.Flow · " +
        esc(
          S.saved
            ? "Kayıtlı sürüm " + S.saved
            : "Kaydedilmemiş çalışma çıktısı",
        ) +
        '</footer><button onclick="window.print()">PDF olarak kaydet / Yazdır</button></body></html>',
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  }
  function excel() {
    if (!S.report) return;
    if (!window.XLSX) return status("Excel dışa aktarıcı yüklenemedi.");
    const wb = XLSX.utils.book_new();
    S.report.sections.forEach((s, i) => {
      const numericRows = s.rows.map((row) =>
        row.map((v) =>
          typeof v === "string" && /^-?[\d.,]+ ₺$/.test(v)
            ? Number(v.replace(" ₺", "").replace(/\./g, "").replace(",", "."))
            : v,
        ),
      );
      const data = [
        ["İDEOL", "Baris.Flow"],
        [S.report.title, S.report.period],
        [S.report.createdAt],
        [s.title],
        [s.note],
        ...S.report.notes.map((n) => [n]),
        [],
        s.columns,
        ...numericRows,
      ];
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.aoa_to_sheet(data),
        String(i + 1) +
          " " +
          s.title.slice(0, 25).replace(/[\\/?*\[\]:]/g, " "),
      );
    });
    XLSX.writeFile(
      wb,
      "IDEOL-" + S.report.kind + "-" + S.report.period + ".xlsx",
    );
  }
  async function action(name) {
    try {
      if (!S.loaded && !["reload"].includes(name))
        throw Error("Önce kaynakların yüklenmesini bekleyin.");
      if (name === "reload") return load();
      if (name === "sale" || name === "collection") return addFinance(name);
      if (name === "owner") return addOwner();
      if (name === "adjustment") return addAdjustment();
      if (name === "part") return addPart();
      if (name === "movement") return stockMove();
      if (name === "build") return build();
      if (name === "print") return print();
      if (name === "excel") return excel();
      if (name === "save") {
        if (!S.report) throw Error("Önce dosya hazırlayın.");
        if (S.saved)
          return status("Bu sürüm zaten kaydedildi: " + S.saved.slice(0, 8));
        const saved = await repo.insert("ek_workspace_snapshots", {
          id: S.snapshotId,
          title: S.report.title,
          kind: S.report.kind,
          period: S.report.period,
          payload: JSON.parse(JSON.stringify(S.report)),
        });
        S.saved = saved.id;
        S.snapshots.push(saved);
        status("Sürüm kaydedildi: " + saved.id.slice(0, 8));
      }
      if (name === "copy") {
        if (!S.report) throw Error("Önce hesap paketini hazırlayın.");
        const text = [
          "İDEOL · " + S.report.title,
          S.report.period,
          ...S.report.sections
            .slice(0, 1)
            .flatMap((s) => s.rows.map((r) => r.join(": "))),
          "Bu döküm dönem hareketlerini gösterir; kesin cari bakiye değildir.",
          "Baris.Flow",
        ].join("\n");
        await navigator.clipboard.writeText(text);
        status("Hesap özeti kopyalandı; paylaşımı siz yapabilirsiniz.");
      }
      if (name === "template") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.aoa_to_sheet([
            [
              "Fabrika",
              "Donem",
              "No",
              "Tarih",
              "Matrah",
              "KDV",
              "Toplam",
              "Aciklama",
            ],
          ]),
          "Faturalar",
        );
        XLSX.writeFile(wb, "IDEOL-satis-faturasi-sablonu.xlsx");
      }
    } catch (e) {
      status(e.message);
    }
  }
  function init() {
    const root = $("module-calisma-dosyalari");
    if (!root || root.dataset.ready) return;
    root.dataset.ready = "yes";
    root.innerHTML =
      '<div class="ew-shell"><header class="ew-top"><div><small>BARIS.FLOW DRIVE</small><h1>Çalışma dosyaları</h1><p>Hesapla, karşılaştır, dosyala.</p></div><button data-action="reload">Kaynakları yenile</button></header><nav class="ew-tabs" aria-label="Çalışma dosyası türü">' +
      Object.entries(titles)
        .map(
          ([id, label]) =>
            '<button data-ew-tab="' +
            id +
            '" aria-selected="false">' +
            esc(label) +
            "</button>",
        )
        .join("") +
      '</nav><div class="ew-heading"><h2 id="ew-heading"></h2><p id="ew-description"></p></div><div class="ew-filters"><label>Dönem<input id="ew-month" type="month" value="' +
      today().slice(0, 7) +
      '"></label><label id="ew-factory-wrap">Fabrika<select id="ew-factory"></select></label><label id="ew-ownership-wrap">Mülkiyet<select id="ew-ownership"><option value="">Tümü</option><option>ÖZMAL</option><option>TAŞERON</option></select></label><label id="ew-vehicle-wrap">Araç<select id="ew-vehicle"></select></label><label id="ew-owner-wrap">Araç sahibi<select id="ew-owner"></select></label></div><div id="ew-tools" class="ew-tools"></div><div class="ew-toolbar"><button id="ew-build" data-action="build">Dosyayı hazırla</button><div id="ew-output-actions" hidden><button data-action="save">Sürümü kaydet</button><button data-action="print">PDF / Yazdır</button><button data-action="excel">Excel</button><button data-action="copy">Özeti kopyala</button></div></div><p id="ew-status" role="status" aria-live="polite"></p><article id="ew-result"></article></div>';
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.ewTab && S.loaded) return selectTab(b.dataset.ewTab);
      if (b.dataset.action) {
        b.disabled = true;
        try {
          await action(b.dataset.action);
        } finally {
          b.disabled = b.dataset.action === "build" && !S.loaded;
        }
      }
      if (b.dataset.snapshot) {
        const saved = S.snapshots.find((r) => r.id === b.dataset.snapshot);
        renderReport(saved.payload);
        S.saved = saved.id;
        status(
          "Kayıtlı sürüm; kaynaklar sonradan değişse de bu dosya korunur.",
        );
      }
      if (b.dataset.search) {
        $("ew-search").value = b.dataset.search;
        search();
      }
      if (b.dataset.result) {
        const r = S.searchResults[Number(b.dataset.result)];
        let recent = [];
        try {
          recent = JSON.parse(
            sessionStorage.getItem("ew-recent-search") || "[]",
          );
          sessionStorage.setItem(
            "ew-recent-search",
            JSON.stringify(
              [...new Set([$("ew-search").value, ...recent])].slice(0, 8),
            ),
          );
        } catch {}
        if (r.type === "araclar") {
          $("ew-vehicle").value = r.id;
          selectTab("vehicle");
          build();
        } else if (r.type === "musteriler") {
          $("ew-factory").value = r.id;
          selectTab("factory");
          build();
        } else {
          const row =
            r.type === "invoice"
              ? S.searchInvoices.find((x) => x.id === r.id)
              : r.type === "sale"
                ? S.entries.find((x) => x.id === r.id)?.payload
                : S.data[r.type].find((x) => x.id === r.id);
          renderReport(
            report(
              [
                table(
                  r.label,
                  ["Alan", "Değer"],
                  Object.entries(row || {})
                    .filter(([k]) => !["created_by", "dosya_url"].includes(k))
                    .map(([k, v]) => [
                      k,
                      typeof v === "object" ? JSON.stringify(v) : v,
                    ]),
                ),
              ],
              [],
              r.name,
            ),
          );
        }
      }
    });
    $("ew-tools").addEventListener("input", (e) => {
      if (e.target.id === "ew-search") return;
      S.buildKey++;
      S.report = null;
      $("ew-result").innerHTML = "";
      $("ew-output-actions").hidden = true;
    });
    $("ew-month").onchange = load;
    $("ew-vehicle").onchange = () => {
      S.buildKey++;
      S.report = null;
      $("ew-result").innerHTML = "";
      $("ew-output-actions").hidden = true;
      prepareMaintenance();
    };
    ["ew-factory", "ew-ownership", "ew-owner"].forEach(
      (id) =>
        ($(id).onchange = () => {
          S.buildKey++;
          S.report = null;
          $("ew-output-actions").hidden = true;
          $("ew-result").innerHTML = "";
        }),
    );
  }
  window.loadERPWorkspace = function () {
    init();
    return load();
  };
  window.openERPGlobalSearch = function () {
    S.tab = "search";
    document.querySelector('[data-target="module-calisma-dosyalari"]')?.click();
  };
  window.openERPVehicle = function (id, tab = "vehicle") {
    S.selectedVehicle = id;
    S.tab = tab;
    document.querySelector('[data-target="module-calisma-dosyalari"]')?.click();
  };
  window.ERPWorkspace = { state: S, build, load, selectTab };
})();
