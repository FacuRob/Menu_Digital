const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_WEBHOOK_SECRET = "secreto-de-test";
process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { mercadoPagoWebhook } = require("../src/controllers/mercadoPagoController");
const { firmaValida } = require("../src/utils/mercadoPago");

// Suscripciones que "devuelve" la API de MP y llamadas que recibe.
let subs;
let mpCalls;
let ops;
let cuenta;

global.fetch = async (url, opts = {}) => {
  mpCalls.push({ url, method: opts.method || "GET", body: opts.body && JSON.parse(opts.body) });
  const cobroId = url.split("/authorized_payments/")[1];
  if (cobroId) return { ok: true, status: 200, json: async () => cobros[cobroId] || {} };
  const id = url.split("/preapproval/")[1];
  return { ok: true, status: 200, json: async () => subs[id] || {} };
};

// Cobros mensuales que "devuelve" la API de MP.
let cobros;

beforeEach(() => {
  mpCalls = [];
  ops = [];
  cuenta = { id: 7, mp_preapproval_id: null };
  cobros = {
    pay1: { id: "pay1", preapproval_id: "sub1", status: "processed", payment: { status: "approved" } },
  };
  subs = {
    sub1: {
      id: "sub1",
      status: "authorized",
      external_reference: "cuenta:7:plan:standard",
      auto_recurring: { transaction_amount: 41000 },
      next_payment_date: "2030-01-01T00:00:00Z",
    },
  };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") {
      const coincide =
        q.filters.id === cuenta.id ||
        (q.filters.mp_preapproval_id != null && q.filters.mp_preapproval_id === cuenta.mp_preapproval_id);
      return { data: coincide ? cuenta : null, error: null };
    }
    return { data: null, error: null };
  });
});

const firmar = (dataId, requestId = "req-1", ts = "1700000000") => {
  const v1 = crypto
    .createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
};

const llamar = async (dataId, headers = firmar(dataId), type = "subscription_preapproval") => {
  const res = {
    code: null,
    body: null,
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  await mercadoPagoWebhook(
    { headers, query: { "data.id": dataId, type }, body: { type, data: { id: dataId } } },
    res,
  );
  return res;
};

const updates = () => ops.filter((o) => o.table === "cuentas" && o.op === "update");

test("firma: rechaza firma inválida o sin secreto", async () => {
  const res = await llamar("sub1", { "x-signature": "ts=1,v1=abcd", "x-request-id": "r" });
  assert.equal(res.code, 401);
  assert.equal(updates().length, 0);
  assert.equal(firmaValida({ xSignature: null, xRequestId: "r", dataId: "sub1" }), false);
});

test("pago autorizado: activa la cuenta con el plan y el próximo cobro", async () => {
  const res = await llamar("sub1");
  assert.equal(res.code, 200);
  const [u] = updates();
  assert.equal(u.filters.id, 7);
  assert.equal(u.payload.tipo_plan, "standard");
  assert.equal(u.payload.estado_suscripcion, "activo");
  assert.equal(u.payload.mp_preapproval_id, "sub1");
  assert.equal(u.payload.periodo_fin, "2030-01-01T00:00:00Z");
});

test("cambio de plan: cancela la suscripción anterior en MP", async () => {
  cuenta.mp_preapproval_id = "sub0";
  await llamar("sub1");
  const cancel = mpCalls.find((c) => c.method === "PUT");
  assert.ok(cancel.url.endsWith("/preapproval/sub0"));
  assert.deepEqual(cancel.body, { status: "cancelled" });
});

test("checkout abandonado: una baja de otra suscripción no toca la cuenta", async () => {
  subs.sub1.status = "cancelled";
  const res = await llamar("sub1");
  assert.equal(res.code, 200);
  assert.equal(updates().length, 0);
});

test("baja de la suscripción vigente: queda cancelada sin tocar el plan", async () => {
  cuenta.mp_preapproval_id = "sub1";
  subs.sub1.status = "cancelled";
  await llamar("sub1");
  const [u] = updates();
  assert.equal(u.payload.estado_suscripcion, "cancelado");
  assert.equal(u.payload.tipo_plan, undefined);
});

test("monto distinto al del plan: no activa", async () => {
  subs.sub1.auto_recurring.transaction_amount = 1;
  await llamar("sub1");
  assert.equal(updates().length, 0);
});

test("pendiente de pago: no cambia nada", async () => {
  subs.sub1.status = "pending";
  await llamar("sub1");
  assert.equal(updates().length, 0);
});

const cobrar = (id) => llamar(id, firmar(id), "subscription_authorized_payment");

test("cobro mensual aprobado: sigue activa y periodo_fin pasa al próximo cobro", async () => {
  cuenta.mp_preapproval_id = "sub1";
  subs.sub1.next_payment_date = "2030-02-01T00:00:00Z";
  const res = await cobrar("pay1");
  assert.equal(res.code, 200);
  const [u] = updates();
  assert.equal(u.filters.id, 7);
  assert.equal(u.payload.estado_suscripcion, "activo");
  assert.equal(u.payload.periodo_fin, "2030-02-01T00:00:00Z");
});

test("cobro rechazado en reintento: no toca la cuenta", async () => {
  cuenta.mp_preapproval_id = "sub1";
  cobros.pay1 = { ...cobros.pay1, status: "recycling", payment: { status: "rejected" } };
  await cobrar("pay1");
  assert.equal(updates().length, 0);
});

test("cobro cancelado sin aprobar (sin más reintentos): queda vencida", async () => {
  cuenta.mp_preapproval_id = "sub1";
  cobros.pay1 = { ...cobros.pay1, status: "cancelled", payment: { status: "rejected" } };
  await cobrar("pay1");
  const [u] = updates();
  assert.equal(u.payload.estado_suscripcion, "vencido");
});

test("cobro de otra suscripción: no toca la cuenta", async () => {
  cuenta.mp_preapproval_id = "sub0";
  await cobrar("pay1");
  assert.equal(updates().length, 0);
});

test("suscripción con el monto del cupón vigente: se activa", async () => {
  cuenta.descuento_pct = 20;
  cuenta.descuento_meses_restantes = 2;
  subs.sub1.auto_recurring.transaction_amount = 32800;
  await llamar("sub1");
  assert.equal(updates()[0].payload.estado_suscripcion, "activo");
});

test("monto con descuento sin cupón en la cuenta: no activa", async () => {
  subs.sub1.auto_recurring.transaction_amount = 32800;
  await llamar("sub1");
  assert.equal(updates().length, 0);
});

test("cobro con cupón: consume un mes y no toca el monto en MP", async () => {
  Object.assign(cuenta, { mp_preapproval_id: "sub1", tipo_plan: "standard", descuento_pct: 20, descuento_meses_restantes: 2 });
  await cobrar("pay1");
  const [u] = updates();
  assert.equal(u.payload.descuento_meses_restantes, 1);
  assert.equal(u.payload.mp_ultimo_cobro_id, "pay1");
  assert.equal(mpCalls.some((c) => c.method === "PUT"), false);
});

test("último mes del cupón: vuelve al precio normal en MP", async () => {
  Object.assign(cuenta, { mp_preapproval_id: "sub1", tipo_plan: "standard", descuento_pct: 20, descuento_meses_restantes: 1 });
  await cobrar("pay1");
  const [u] = updates();
  assert.equal(u.payload.descuento_meses_restantes, 0);
  assert.equal(u.payload.descuento_pct, 0);
  const put = mpCalls.find((c) => c.method === "PUT");
  assert.ok(put.url.endsWith("/preapproval/sub1"));
  assert.equal(put.body.auto_recurring.transaction_amount, 41000);
});

test("aviso repetido del mismo cobro: no descuenta otro mes", async () => {
  Object.assign(cuenta, { mp_preapproval_id: "sub1", mp_ultimo_cobro_id: "pay1", descuento_pct: 20, descuento_meses_restantes: 2 });
  await cobrar("pay1");
  const [u] = updates();
  assert.equal(u.payload.descuento_meses_restantes, undefined);
});

test("cobro con firma inválida: 401", async () => {
  const res = await llamar("pay1", { "x-signature": "ts=1,v1=abcd", "x-request-id": "r" }, "subscription_authorized_payment");
  assert.equal(res.code, 401);
});
