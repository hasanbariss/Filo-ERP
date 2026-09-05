const assert = require("node:assert/strict");
const fs = require("fs");
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
(async () => {
  const db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table public.araclar(id uuid primary key);grant usage on schema auth to authenticated;",
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20260905210000_independent_workspace.sql",
      "utf8",
    ),
  );
  const uid = "00000000-0000-0000-0000-000000000001",
    part = "00000000-0000-0000-0000-000000000002",
    vehicle = "00000000-0000-0000-0000-000000000003";
  await db.exec(
    `insert into araclar values('${vehicle}');set request.jwt.claim.sub='${uid}';set role authenticated;`,
  );
  await db.query(
    "insert into ek_stock_parts(id,code,name,unit,minimum) values($1,$2,$3,$4,2)",
    [part, "P01", "Yağ", "litre"],
  );
  const move = (id, qty) =>
    db.query("select ek_stock_move($1,$2,$3,$4,$5,current_date)", [
      id,
      part,
      qty,
      qty < 0 ? vehicle : null,
      "test",
    ]);
  const inId = "00000000-0000-0000-0000-000000000010";
  await move(inId, 10);
  await move(inId, 10);
  assert.equal(
    (await db.query("select sum(quantity) as qty from ek_stock_movements"))
      .rows[0].qty,
    "10",
  );
  await assert.rejects(() => move(inId, 11), /farklı/);
  await move("00000000-0000-0000-0000-000000000011", -6);
  await assert.rejects(
    () => move("00000000-0000-0000-0000-000000000012", -5),
    /Yetersiz/,
  );
  await assert.rejects(
    () =>
      db.query(
        "insert into ek_stock_movements(id,part_id,quantity,note,occurred_on) values(gen_random_uuid(),$1,100,'bypass',current_date)",
        [part],
      ),
    /permission|policy/,
  );
  await db.query(
    "insert into ek_workspace_snapshots(title,kind,period,payload) values('test','factory','2026-09','{}')",
  );
  await assert.rejects(
    () => db.exec("update ek_workspace_snapshots set title='changed'"),
    /permission/,
  );
  await assert.rejects(
    () => db.exec("delete from ek_workspace_snapshots"),
    /permission/,
  );
  await db.exec("reset role;set role anon;");
  await assert.rejects(
    () => db.exec("select * from ek_workspace_snapshots"),
    /permission/,
  );
  console.log(
    "SQL: authenticated access, anonymous denial, immutable snapshots, stock idempotency and negative-stock guard passed.",
  );
  await db.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
