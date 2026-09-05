(function (root) {
  "use strict";
  const sources = {
    araclar:
      "id,plaka,firma_adi,mulkiyet_durumu,sirket,arac_sinifi,sofor_id,guncel_km,marka_model,muayene_bitis,vize_bitis,egzoz_bitis,sigorta_bitis,kasko_bitis,trafik_sigortasi_bitis,koltuk_bitis",
    musteriler: "id,ad",
    soforler: "id,ad_soyad",
    cariler: "id,unvan,tur",
    musteri_servis_puantaj: "*",
    rapor_musteri_fiyatlari: "*",
    musteri_arac_tanimlari: "*",
    yakit_takip: "*",
    arac_bakimlari: "*",
    arac_policeler: "*",
    cari_faturalar: "*",
    cari_odemeler: "*",
    taseron_hakedis: "*",
    arac_bakim_planlari: "*",
    arac_km_referanslari: "*",
    arac_gps_durumlari: "*",
    arac_gps_mesafeleri: "*",
  };
  const extra = [
    "ek_workspace_entries",
    "ek_workspace_snapshots",
    "ek_stock_parts",
    "ek_stock_movements",
  ];
  function create(client) {
    async function read(table, filter = (q) => q) {
      if (!sources[table] && !extra.includes(table))
        throw Error("İzin verilmeyen kaynak.");
      const rows = [];
      for (let n = 0; ; n += 1000) {
        let q = client.from(table).select(sources[table] || "*");
        q = filter(q);
        q =
          table === "arac_gps_mesafeleri"
            ? q.order("referans_id").order("baslangic")
            : q.order(table === "arac_gps_durumlari" ? "referans_id" : "id");
        const r = await q.range(n, n + 999);
        if (r.error) throw Error(table + ": " + r.error.message);
        rows.push(...r.data);
        if (r.data.length < 1000) return rows;
      }
    }
    async function insert(table, payload) {
      if (
        ![
          "ek_workspace_entries",
          "ek_workspace_snapshots",
          "ek_stock_parts",
        ].includes(table)
      )
        throw Error("Eski kayıtlara yazılamaz.");
      const r = await client.from(table).insert(payload).select().single();
      if (r.error) throw Error(r.error.message);
      return r.data;
    }
    async function stock(payload) {
      const r = await client.rpc("ek_stock_move", payload);
      if (r.error) throw Error(r.error.message);
      return r.data;
    }
    return { read, insert, stock };
  }
  root.ERPWorkspaceData = { create, sources };
  if (typeof module === "object" && module.exports)
    module.exports = root.ERPWorkspaceData;
})(typeof window !== "undefined" ? window : globalThis);
