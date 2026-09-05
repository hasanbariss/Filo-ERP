(function () {
  "use strict";
  const names = {
    arac_bakimlari: "Bakım ve parça kayıtları",
    arac_cikis_checklist: "Araç çıkış kontrolleri",
    arac_policeler: "Sigorta ve poliçeler",
    bakim_kayitlari: "Eski bakım kayıtları",
    is_emirleri: "İş emirleri",
    manuel_yakit_fisleri: "Manuel yakıt fişleri",
    musteri_arac_tanimlari: "Cari hakediş tarifeleri / fabrika atamaları",
    rapor_musteri_fiyatlari: "Müşteri raporu fiyatları",
    musteri_servis_puantaj: "Fabrika servis puantajı",
    sigorta_teklifleri: "Sigorta teklifleri",
    sofor_maas_bordro: "Şoför bordroları",
    sofor_puantaj: "Şoför puantajları",
    taseron_hakedis: "Taşeron sefer hakedişleri",
    yakit_takip: "Yakıt alımları",
    arac_km_referanslari: "GPS kilometre referansları",
    arac_bakim_planlari: "Bakım planları",
    arac_yakit_referanslari: "Yakıt tahmini referansı",
    arac_gps_mesafeleri: "GPS mesafe geçmişi",
    arac_gps_durumlari: "GPS durum kayıtları",
    ek_stock_movements: "Stok hareketleri",
    workspace_history: "Bağımsız çalışma dosyası kayıtları",
    saved_snapshots: "Kaydedilmiş rapor sürümleri",
    stock_compatibility: "Stok kartındaki araç uyumlulukları",
    arac_rotalari: "Araç rota kayıtları",
  };
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
  const label = (g) => names[g.table] || g.table;
  const money = (v) =>
    Number(v).toLocaleString("tr-TR", { style: "currency", currency: "TRY" });
  function sample(row, lookup = {}) {
    const date =
      row.tarih ||
      row.islem_tarihi ||
      row.sefer_tarihi ||
      row.baslangic_tarihi ||
      row.olcum_zamani ||
      row.donem ||
      "";
    const text =
      row.aciklama ||
      row.islem_turu ||
      row.tur ||
      row.guzergah ||
      row.bolge ||
      row.fatura_no ||
      row.police_turu ||
      "";
    const amount =
      row.toplam_tutar ?? row.net_hakedis ?? row.tutar ?? row.anlasilan_tutar;
    return (
      [
        date,
        lookup[row.musteri_id] ||
          (row.musteri_id ? "Fabrika: " + row.musteri_id : ""),
        lookup[row.cari_id] || "",
        lookup[row.sofor_id] || "",
        row.vardiya_fiyat != null
          ? "Vardiya fiyatı: " + money(row.vardiya_fiyat)
          : "",
        row.tek_fiyat != null ? "Tek fiyatı: " + money(row.tek_fiyat) : "",
        String(text).slice(0, 200),
        amount != null ? money(amount) : "",
        row.litre != null ? row.litre + " L" : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Kayıt: " + (row.id || row.arac_id || "")
    );
  }
  async function rpc(name, args) {
    const r = await window.supabaseClient.rpc(name, args);
    if (r.error) throw Error(r.error.message);
    return r.data;
  }
  window.reviewVehicleDeletion = async function (vehicleId, refreshName) {
    let dialog = document.getElementById("vehicle-delete-dialog");
    if (dialog?.open) return;
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "vehicle-delete-dialog";
      dialog.className = "vehicle-delete-dialog";
      document.body.append(dialog);
    }
    let data,
      choices = {},
      busy = false,
      submitting = false,
      reviewed = false,
      closed = false;
    const lookup = {};
    dialog.innerHTML =
      '<header><div><small>ARAÇ SİLME</small><h2>Bağlantılar kontrol ediliyor</h2></div><button type="button" data-close aria-label="Kapat">×</button></header><div class="vd-body"><p role="status">Bağlı kayıtlar yükleniyor…</p></div>';
    dialog.showModal();
    const dismiss = () => {
      if (!submitting) {
        closed = true;
        dialog.close();
      }
    };
    dialog.oncancel = (e) => {
      if (submitting) e.preventDefault();
      else closed = true;
    };
    dialog.querySelector("[data-close]").onclick = dismiss;
    function render() {
      const groups = data.groups.filter((g) => g.count > 0);
      dialog.innerHTML =
        "<header><div><small>ARAÇ SİLME · " +
        esc(data.vehicle.mulkiyet_durumu) +
        "</small><h2>" +
        esc(data.vehicle.plaka) +
        '</h2></div><button type="button" data-close aria-label="Kapat">×</button></header><div class="vd-body"><p>Her bağlantı için ne yapılacağını seçin. Varsayılan olarak hiçbir geçmiş kayıt silinmez.</p><div class="vd-preserved">Şoförün, fabrikanın ve cari hesabın kendisi; cari faturalar/ödemeler, kart hareketleri ve yüklenmiş dosyalar korunur. Silinen işlem kayıtları ilgili raporların toplamlarını değiştirir.</div><div class="vd-groups">' +
        (groups.length
          ? groups
              .map(
                (g) =>
                  '<section class="vd-group"><div><strong>' +
                  esc(label(g)) +
                  "</strong><span>" +
                  g.count.toLocaleString("tr-TR") +
                  ' kayıt</span></div><label>Bu kayıtlara ne yapılsın?<select data-choice="' +
                  esc(g.key) +
                  '"><option value="keep">Kayıtları koru' +
                  (g.required ? " — araç silinmesini engeller" : "") +
                  "</option>" +
                  (g.can_unlink
                    ? '<option value="unlink">Kayıtları koru, araç bağlantısını kaldır</option>'
                    : "") +
                  (g.can_delete
                    ? '<option value="delete">Bu kayıtları sil</option>'
                    : "") +
                  "</select></label>" +
                  (g.blocked
                    ? '<p class="vd-warning">Ek alt bağlantı / otomatik işlem var. Bu grubu doğrudan silmek yerine bağlantıyı kaldırın veya ilgili modülde inceleyin.</p>'
                    : "") +
                  (g.extra || [])
                    .map(
                      (x) =>
                        '<p class="vd-extra">' +
                        esc(names[x.table] || x.table) +
                        ": " +
                        x.count +
                        " kayıt — " +
                        (x.effect === "delete"
                          ? "bu grup silinirse bunlar da silinir."
                          : x.effect === "unlink_plan"
                            ? "plan silinirse bakım kayıtlarının plan bağlantısı kaldırılır; bakım kaydının silinmesi kendi seçimine bağlıdır."
                            : "alt bağlantı nedeniyle otomatik silme kapalı.") +
                        "</p>",
                    )
                    .join("") +
                  ((g.samples || []).length
                    ? "<details><summary>Bağlı kayıtları göster (ilk " +
                      g.samples.length +
                      ")</summary><ul>" +
                      g.samples
                        .map((r) => "<li>" + esc(sample(r, lookup)) + "</li>")
                        .join("") +
                      '</ul><div class="vd-pages"><button type="button" data-page="' +
                      esc(g.key) +
                      '" data-offset="0">Tüm kayıtları sayfala</button></div></details>'
                    : "") +
                  "</section>",
              )
              .join("")
          : "<p>Aracı engelleyen bağlı kayıt bulunmadı.</p>") +
        '</div><div id="vd-summary"></div><p class="vd-warning">Araç bağlantısı kaldırılan kayıtların eski ekranlarında plaka boş görünebilir. Yüklenmiş belge dosyaları depodan silinmez. Silme özeti ayrıca saklanır.</p><label class="vd-plate">Onaylamak için plakayı aynen yazın<input id="vd-plate" autocomplete="off" placeholder="' +
        esc(data.vehicle.plaka) +
        '"></label><label class="vd-ack"><input id="vd-ack" type="checkbox"> Silinecek ve korunacak kayıtların özetini kontrol ettim.</label><p id="vd-status" role="status"></p></div><footer><button type="button" data-close>Vazgeç</button><button type="button" id="vd-refresh">Bağlantıları yenile</button><button type="button" id="vd-delete" class="vd-danger" disabled>Seçimleri uygula ve aracı sil</button></footer>';
      dialog
        .querySelectorAll("[data-close]")
        .forEach((b) => (b.onclick = dismiss));
      dialog.querySelectorAll("[data-choice]").forEach((s) => {
        s.value = choices[s.dataset.choice] || "keep";
        s.onchange = () => {
          choices[s.dataset.choice] = s.value;
          dialog.querySelector("#vd-ack").checked = false;
          update();
        };
      });
      dialog.querySelector(".vd-groups").onclick = async (event) => {
        const button = event.target.closest("[data-page]");
        if (!button) return;
        button.disabled = true;
        const key = button.dataset.page,
          offset = Number(button.dataset.offset);
        try {
          const page = await rpc("vehicle_delete_rows", {
            p_vehicle: vehicleId,
            p_key: key,
            p_offset: offset,
          });
          if (closed) return;
          const details = button.closest("details");
          details.querySelector("ul").innerHTML = page.rows
            .map((row) => "<li>" + esc(sample(row, lookup)) + "</li>")
            .join("");
          details.querySelector(".vd-pages").innerHTML =
            "<span>" +
            (offset + 1) +
            "–" +
            Math.min(offset + 25, page.total) +
            " / " +
            page.total +
            "</span>" +
            (offset > 0
              ? '<button type="button" data-page="' +
                esc(key) +
                '" data-offset="' +
                Math.max(0, offset - 25) +
                '">Önceki</button>'
              : "") +
            (offset + 25 < page.total
              ? '<button type="button" data-page="' +
                esc(key) +
                '" data-offset="' +
                (offset + 25) +
                '">Sonraki</button>'
              : "");
        } catch (e) {
          dialog.querySelector("#vd-status").textContent = e.message;
        } finally {
          button.disabled = false;
        }
      };
      dialog.querySelector("#vd-plate").oninput = update;
      dialog.querySelector("#vd-ack").onchange = update;
      dialog.querySelector("#vd-refresh").onclick = load;
      dialog.querySelector("#vd-delete").onclick = async () => {
        if (busy || !reviewed) return;
        busy = true;
        submitting = true;
        dialog
          .querySelectorAll("button,input,select")
          .forEach((el) => (el.disabled = true));
        try {
          const result = await rpc("vehicle_delete_execute", {
            p_vehicle: vehicleId,
            p_token: data.token,
            p_choices: choices,
            p_plate: dialog.querySelector("#vd-plate").value.trim(),
          });
          if (!result.deleted) throw Error("Silme sonucu doğrulanamadı.");
          closed = true;
          dialog.close();
          window.Toast?.success(
            result.plate + " silindi. Seçtiğiniz kayıt işlemleri tamamlandı.",
          );
          if (typeof window[refreshName] === "function")
            await Promise.resolve()
              .then(() => window[refreshName]())
              .catch(() =>
                window.Toast?.warning(
                  "Araç silindi; listeyi yenilemek için sayfayı yenileyin.",
                ),
              );
        } catch (e) {
          dialog.querySelector("#vd-status").textContent =
            e.message +
            " Sonuç doğrulanamadı; bağlantıları yenileyip tekrar kontrol edin.";
          dialog.querySelector("#vd-ack").checked = false;
        } finally {
          busy = false;
          submitting = false;
          dialog
            .querySelectorAll("button,input,select")
            .forEach((el) => (el.disabled = false));
          update();
        }
      };
      update();
    }
    function update() {
      if (closed || !data) return;
      const lines = [["Araç kartı", "Silinecek"]];
      let blocked = false;
      for (const g of data.groups.filter((g) => g.count > 0)) {
        const mode = choices[g.key] || "keep";
        if (mode === "keep" && g.required) blocked = true;
        lines.push([
          label(g) + " · " + g.count + " kayıt",
          mode === "delete"
            ? "Silinecek"
            : mode === "unlink"
              ? "Korunacak; araç bağlantısı kaldırılacak"
              : "Korunacak",
        ]);
        if (mode === "delete")
          for (const x of g.extra || [])
            lines.push([
              (names[x.table] || x.table) + " · " + x.count + " kayıt",
              x.effect === "delete"
                ? "Silinecek"
                : "Bakım kaydı korunursa plan bağlantısı kaldırılacak",
            ]);
      }
      dialog.querySelector("#vd-summary").innerHTML =
        "<h3>İşlem özeti</h3>" +
        lines
          .map(
            ([a, b]) =>
              "<div><span>" +
              esc(a) +
              "</span><strong>" +
              esc(b) +
              "</strong></div>",
          )
          .join("") +
        (blocked
          ? '<p class="vd-warning">Bağlı zorunlu kayıtlar korunurken araç silinemez. İlgili satırlarda farklı bir seçim yapın veya vazgeçin.</p>'
          : "");
      reviewed =
        !blocked &&
        dialog.querySelector("#vd-ack").checked &&
        dialog.querySelector("#vd-plate").value.trim() ===
          data.vehicle.plaka.trim();
      dialog.querySelector("#vd-delete").disabled = busy || !reviewed;
    }
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const result = await rpc("vehicle_delete_preview", {
          p_vehicle: vehicleId,
        });
        if (closed) return;
        data = result;
        choices = {};
        render();
      } catch (e) {
        if (!closed) {
          dialog.querySelector(".vd-body").innerHTML =
            '<p role="alert">' +
            esc(e.message) +
            '</p><button id="vd-retry" type="button">Tekrar dene</button>';
          dialog.querySelector("#vd-retry").onclick = load;
        }
      } finally {
        busy = false;
      }
    }
    if (window.supabaseClient.from) {
      await Promise.allSettled(
        [
          ["musteriler", "ad"],
          ["cariler", "unvan"],
          ["soforler", "ad_soyad"],
        ].map(async ([table, field]) => {
          const r = await window.supabaseClient
            .from(table)
            .select("id," + field)
            .range(0, 999)
            .abortSignal(AbortSignal.timeout(5000));
          if (r.error) throw r.error;
          (r.data || []).forEach((row) => (lookup[row.id] = row[field]));
        }),
      );
      // Unavailable labels fall back to source identifiers; counts still come from the database.
    }
    if (!closed) await load();
  };
})();
