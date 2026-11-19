const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { getCheckout, getEstado } = require("../src/controllers/suscripcionController");

let ops;
let cuenta;
let usuario;
let mpBodies;

global.fetch = async (url, opts = {}) => {
  mpBodies.push(opts.body && JSON.parse(opts.body));
  return { ok: true, status: 200, json: async () => ({ init_point: "https://mp.test/pagar" }) };
};

beforeEach(() => {
  ops = [];
  mpBodies = [];
  cuenta = { id: 7, tipo_plan: "free", estado_suscripcion: "trial", periodo_fin: null, mp_email: null, descuento_pct: 0, descuento_meses_restantes: 0 };
  usuario = { email: "dinex@ejemplo.test" };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") return { data: cuenta, error: null };
    if (q.table === "usuarios") return { data: usuario, error: null };
    return { data: null, error: null };
  });
});

const res = () => ({
  code: 200,
  body: null,
  status(c) {
    this.code = c;
    return this;
  },
  json(b) {
    this.body = b;
    return this;
  },
});

const checkout = async (body = {}) => {
  const r = res();
  await getCheckout({ params: { plan: "standard" }, body, user: { id: 1, cuenta_id: 7 } }, r);
  return r;
};

const emailGuardado = () => ops.find((o) => o.table === "cuentas" && o.op === "update")?.payload?.mp_email;

test("checkout: paga con el email de Mercado Pago que escribió el cliente y lo recuerda", async () => {
  const r = await checkout({ email: " Pagos@MP.test " });
  assert.equal(r.body.url, "https://mp.test/pagar");
  assert.equal(mpBodies[0].payer_email, "pagos@mp.test");
  assert.equal(emailGuardado(), "pagos@mp.test");
});

test("checkout sin email: usa el último de Mercado Pago y si no, el del usuario", async () => {
  cuenta.mp_email = "guardado@mp.test";
  await checkout();
  assert.equal(mpBodies[0].payer_email, "guardado@mp.test");
  assert.equal(emailGuardado(), undefined); // no cambió: no se reescribe

  cuenta.mp_email = null;
  mpBodies = [];
  await checkout();
  assert.equal(mpBodies[0].payer_email, "dinex@ejemplo.test");
});

test("checkout: email inválido → 400 sin llamar a Mercado Pago", async () => {
  const r = await checkout({ email: "no-es-email" });
  assert.equal(r.code, 400);
  assert.equal(mpBodies.length, 0);
});

test("checkout: sin ningún email → 400", async () => {
  usuario = null;
  const r = await checkout();
  assert.equal(r.code, 400);
});

test("estado: precarga el email de Mercado Pago (guardado o el del usuario)", async () => {
  const r = res();
  await getEstado({ user: { id: 1, cuenta_id: 7 } }, r);
  assert.equal(r.body.mp_email, "dinex@ejemplo.test");
  cuenta.mp_email = "guardado@mp.test";
  const r2 = res();
  await getEstado({ user: { id: 1, cuenta_id: 7 } }, r2);
  assert.equal(r2.body.mp_email, "guardado@mp.test");
});
