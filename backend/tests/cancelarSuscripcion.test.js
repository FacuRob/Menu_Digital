const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { cancelar } = require("../src/controllers/suscripcionController");

let ops;
let cuenta;
let mp; // { calls, ok }

global.fetch = async (url, opts = {}) => {
  mp.calls.push({ url, method: opts.method, body: opts.body && JSON.parse(opts.body) });
  if (!mp.ok) return { ok: false, status: 400, json: async () => ({ message: "error de MP" }) };
  return { ok: true, status: 200, json: async () => ({ id: "pre-1", status: "cancelled", next_payment_date: "2026-12-20T00:00:00Z" }) };
};

beforeEach(() => {
  ops = [];
  mp = { calls: [], ok: true };
  cuenta = { id: 29, estado_suscripcion: "activo", mp_preapproval_id: "pre-1", periodo_fin: "2026-12-20T01:21:13Z" };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") return { data: cuenta, error: null };
    return { data: null, error: null };
  });
});

const run = async (user = { id: 1, cuenta_id: 29 }) => {
  const r = { code: 200, body: null };
  r.status = (c) => ((r.code = c), r);
  r.json = (b) => ((r.body = b), r);
  await cancelar({ user }, r);
  return r;
};
const update = () => ops.find((o) => o.table === "cuentas" && o.op === "update")?.payload;

test("cancelar: da de baja en Mercado Pago y conserva el mes pagado", async () => {
  const r = await run();
  assert.equal(r.code, 200);
  assert.match(mp.calls[0].url, /\/preapproval\/pre-1$/);
  assert.equal(mp.calls[0].method, "PUT");
  assert.equal(mp.calls[0].body.status, "cancelled");
  assert.equal(update().estado_suscripcion, "cancelado");
  assert.equal(update().periodo_fin, "2026-12-20T01:21:13Z");
});

test("cancelar: sin suscripción activa → 409 y no llama a Mercado Pago", async () => {
  for (const c of [{ ...cuenta, estado_suscripcion: "trial" }, { ...cuenta, mp_preapproval_id: null }]) {
    cuenta = c;
    mp.calls = [];
    const r = await run();
    assert.equal(r.code, 409);
    assert.equal(mp.calls.length, 0);
  }
  assert.equal(update(), undefined);
});

test("cancelar: si Mercado Pago falla → 502 y la cuenta sigue activa", async () => {
  mp.ok = false;
  const r = await run();
  assert.equal(r.code, 502);
  assert.equal(update(), undefined);
});
