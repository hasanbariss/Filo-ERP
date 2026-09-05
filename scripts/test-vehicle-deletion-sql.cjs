const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const fs = require("fs"),
  assert = require("node:assert/strict");
(async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table araclar(id uuid primary key,plaka text,mulkiyet_durumu text);create table ek_workspace_entries(payload jsonb);create table ek_workspace_snapshots(payload jsonb);create table ek_stock_parts(compatible_vehicles uuid[]);create table puantaj(id uuid primary key,arac_id uuid not null references araclar(id),tutar numeric);create table yakit(id uuid primary key,arac_id uuid references araclar(id),tutar numeric);create table arac_km_referanslari(id uuid primary key,arac_id uuid not null references araclar(id));create table arac_gps_mesafeleri(referans_id uuid references arac_km_referanslari(id),km numeric);create table arac_gps_durumlari(referans_id uuid references arac_km_referanslari(id));create table arac_bakim_planlari(id uuid primary key,arac_id uuid not null references araclar(id));create table arac_bakimlari(id uuid primary key,arac_id uuid references araclar(id),bakim_plan_id uuid references arac_bakim_planlari(id));`,
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20260906120000_review_vehicle_deletion.sql",
      "utf8",
    ),
  );
  const vid = "00000000-0000-0000-0000-000000000001",
    user = "00000000-0000-0000-0000-000000000002";
  await db.exec(
    `insert into araclar values('${vid}','35 TEST','ÖZMAL');insert into puantaj values(gen_random_uuid(),'${vid}',100);insert into yakit values(gen_random_uuid(),'${vid}',40);set request.jwt.claim.sub='${user}';set role authenticated;`,
  );
  const preview = async () =>
    (await db.query("select vehicle_delete_preview($1) as p", [vid])).rows[0].p;
  const exec = (p, choices, plate = "35 TEST") =>
    db.query("select vehicle_delete_execute($1,$2,$3,$4)", [
      vid,
      p.token,
      JSON.stringify(choices),
      plate,
    ]);
  let p = await preview();
  assert.equal(p.groups.find((g) => g.table === "puantaj").count, 1);
  assert.equal(p.groups.find((g) => g.table === "yakit").can_unlink, true);
  await assert.rejects(() => exec(p, {}), /korunuyor/);
  await assert.rejects(
    () =>
      exec(
        p,
        { "puantaj.arac_id": "delete", "yakit.arac_id": "unlink" },
        "WRONG",
      ),
    /eşleşmiyor/,
  );
  await db.exec("reset role;update yakit set tutar=41;set role authenticated;");
  await assert.rejects(
    () => exec(p, { "puantaj.arac_id": "delete", "yakit.arac_id": "unlink" }),
    /değişti/,
  );
  p = await preview();
  await db.exec(
    "reset role;create function stop_audit() returns trigger language plpgsql as $$ begin raise exception 'audit failed'; end $$;create trigger audit_stop before insert on vehicle_deletion_audit for each row execute function stop_audit();set role authenticated;",
  );
  await assert.rejects(
    () => exec(p, { "puantaj.arac_id": "delete", "yakit.arac_id": "unlink" }),
    /audit failed/,
  );
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*) as n from puantaj")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select arac_id from yakit")).rows[0].arac_id,
    vid,
  );
  await db.exec(
    "drop trigger audit_stop on vehicle_deletion_audit;set role authenticated;",
  );
  const page = (
    await db.query("select vehicle_delete_rows($1,$2,0) as p", [
      vid,
      "puantaj.arac_id",
    ])
  ).rows[0].p;
  assert.equal(page.total, 1);
  assert.equal(page.rows.length, 1);
  await assert.rejects(
    () =>
      db.query("select vehicle_delete_rows($1,$2,0)", [
        vid,
        "vehicle_deletion_audit.vehicle_id",
      ]),
    /bulunamadı/,
  );
  await exec(p, { "puantaj.arac_id": "delete", "yakit.arac_id": "unlink" });
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*) as n from araclar")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select count(*) as n from puantaj")).rows[0].n,
    0,
  );
  assert.equal(
    (await db.query("select arac_id from yakit")).rows[0].arac_id,
    null,
  );
  assert.equal(
    (await db.query("select count(*) as n from vehicle_deletion_audit")).rows[0]
      .n,
    1,
  );
  await db.exec(
    `insert into araclar values('${vid}','35 TEST','TAŞERON');insert into arac_km_referanslari values('${vid}','${vid}');insert into arac_gps_mesafeleri values('${vid}',50);insert into arac_bakim_planlari values('${vid}','${vid}');insert into arac_bakimlari values(gen_random_uuid(),'${vid}','${vid}');set role authenticated;`,
  );
  p = await preview();
  assert.equal(
    p.groups.find((g) => g.table === "arac_km_referanslari").extra[0].count,
    1,
  );
  await db.exec(
    "reset role;update arac_gps_mesafeleri set km=51;set role authenticated;",
  );
  await assert.rejects(() => exec(p, {}), /değişti/);
  p = await preview();
  await exec(p, {
    "arac_km_referanslari.arac_id": "delete",
    "arac_bakim_planlari.arac_id": "delete",
    "arac_bakimlari.arac_id": "unlink",
  });
  await db.exec("reset role");
  assert.equal(
    (await db.query("select count(*) as n from arac_gps_mesafeleri")).rows[0].n,
    0,
  );
  const kept = (await db.query("select * from arac_bakimlari")).rows[0];
  assert.equal(kept.arac_id, null);
  assert.equal(kept.bakim_plan_id, null);
  await db.exec("set role anon");
  await assert.rejects(() => preview(), /permission/);
  console.log(
    "SQL deletion review, keep blockers, unlink preservation, stale review and audit PASS",
  );
  await db.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
