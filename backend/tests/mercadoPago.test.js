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
  const id = url.split("/preapproval/")[1];
  return { ok: true, status: 200, json: async () => subs[id] || {} };
};

beforeEach(() => {
  mpCalls = [];
  ops = [];
  cuenta = { id: 7, mp_preapproval_id: null };
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
      return { data: q.filters.id === cuenta.id ? cuenta : null, error: null };
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

const llamar = async (dataId, headers = firmar(dataId)) => {
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
    { headers, query: { "data.id": dataId, type: "subscription_preapproval" }, body: { type: "subscription_preapproval", data: { id: dataId } } },
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
