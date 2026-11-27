// Volver a pagar un plan cancelado que todavía no venció (ej. ClickLab:
// Estándar cancelado pagado hasta el 20/12 que suma la IA): paga hoy sólo el
// módulo y el débito de plan + módulo arranca al vencimiento.
const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_WEBHOOK_SECRET = "secreto-de-test";
process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/emailService"), { sendComprobantePago: async () => {} });

const { reactivar, confirmarPagoModulos, getEstado } = require("../src/controllers/suscripcionController");
const { mercadoPagoWebhook } = require("../src/controllers/mercadoPagoController");
const { puedeReactivar, modulosAPagarAhora, leerReferenciaPagoModulos } = require("../src/utils/modulosPagos");
const { incluye } = require("../src/utils/suscripcion");

const en = (dias) => new Date(Date.now() + dias * 864e5).toISOString();
const FIN = en(23);

let cuenta;
let ops;
let mpCalls;
let pagos;
let subs;

const cancelada = (extra = {}) => ({
  id: 29,
  tipo_plan: "standard",
  estado_suscripcion: "cancelado",
  mp_preapproval_id: "vieja",
  periodo_fin: FIN,
  precio_plan_fijo: 41000,
  modulos_pagos: {},
  modulos_version: 0,
  mp_email: "click@lab.test",
  descuento_pct: 0,
  descuento_meses_restantes: 0,
  ...extra,
});

global.fetch = async (url, opts = {}) => {
  const body = opts.body && JSON.parse(opts.body);
  mpCalls.push({ url, method: opts.method || "GET", body });
  if (url.endsWith("/checkout/preferences")) {
    return { ok: true, status: 201, json: async () => ({ id: "pref1", init_point: "https://mp.test/pagar" }) };
  }
  if (url.endsWith("/preapproval") && opts.method === "POST") {
    return { ok: true, status: 201, json: async () => ({ id: "nueva", init_point: "https://mp.test/debito" }) };
  }
  const pagoId = url.split("/v1/payments/")[1];
  if (pagoId) return { ok: true, status: 200, json: async () => pagos[pagoId] || {} };
  const subId = url.split("/preapproval/")[1];
  return { ok: true, status: 200, json: async () => subs[subId] || {} };
};

beforeEach(() => {
  cuenta = cancelada();
  ops = [];
  mpCalls = [];
  pagos = {
    111: { id: 111, status: "approved", transaction_amount: 22000, external_reference: "cuenta:29:pagomod:ia" },
  };
  subs = {};
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload, filters: { ...q.filters } });
    if (q.table === "cuentas" && q.op === "select") return { data: cuenta, error: null };
    if (q.table === "cuentas" && q.op === "update") {
      cuenta = { ...cuenta, ...q.payload };
      return { data: [{ id: cuenta.id }], error: null };
    }
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
const pedirReactivar = async (modulos) => {
  const r = res();
  await reactivar({ body: { modulos }, user: { id: 1, cuenta_id: 29 } }, r);
  return r;
};

// ── Reglas ──

test("puedeReactivar: sólo cancelada con días por usar", () => {
  assert.equal(puedeReactivar(cancelada()), true);
  assert.equal(puedeReactivar(cancelada({ periodo_fin: en(-1) })), false);
  assert.equal(puedeReactivar(cancelada({ estado_suscripcion: "activo" })), false);
  assert.equal(puedeReactivar(cancelada({ tipo_plan: "free" })), false);
});

test("modulosAPagarAhora: los que ya usa hasta el vencimiento no se vuelven a pagar", () => {
  const conIa = cancelada({ modulos_pagos: { ia: { cobrado: true, baja_en: FIN } } });
  assert.deepEqual(modulosAPagarAhora(conIa, ["ia"]), []);
  assert.deepEqual(modulosAPagarAhora(cancelada(), ["ia"]), ["ia"]);
  assert.deepEqual(leerReferenciaPagoModulos("cuenta:29:pagomod:ia.whatsapp"), { cuentaId: 29, modulos: ["ia", "whatsapp"] });
  assert.equal(leerReferenciaPagoModulos("cuenta:29:pagomod:inventado"), null);
});

// ── Paso 1: pago único del módulo ──

test("Estándar cancelado + IA: hoy paga sólo $22.000 (pago único)", async () => {
  const r = await pedirReactivar(["ia"]);
  assert.equal(r.code, 200);
  assert.equal(r.body.paso, "pago");
  assert.equal(r.body.monto, 22000);
  const pref = mpCalls.find((c) => c.url.endsWith("/checkout/preferences"));
  assert.equal(pref.body.items[0].unit_price, 22000);
  assert.equal(pref.body.external_reference, "cuenta:29:pagomod:ia");
  assert.match(pref.body.back_urls.success, /paso=debito&mods=ia/);
  assert.equal(mpCalls.some((c) => c.url.endsWith("/preapproval")), false); // todavía no hay débito
});

test("el cupón no descuenta el pago único del módulo", async () => {
  cuenta = cancelada({ descuento_pct: 50, descuento_meses_restantes: 2 });
  const r = await pedirReactivar(["ia"]);
  assert.equal(r.body.monto, 22000);
});

test("pago aprobado (webhook): usa la IA hasta el vencimiento", async () => {
  const v1 = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET).update("id:111;request-id:r1;ts:1;").digest("hex");
  const r = res();
  await mercadoPagoWebhook(
    { headers: { "x-signature": `ts=1,v1=${v1}`, "x-request-id": "r1" }, query: { "data.id": "111", type: "payment" }, body: { type: "payment" } },
    r,
  );
  assert.equal(r.code, 200);
  assert.equal(cuenta.modulos_pagos.ia.baja_en, new Date(FIN).toISOString());
  assert.equal(incluye(cuenta, "ia"), true);
  assert.equal(cuenta.estado_suscripcion, "cancelado"); // sigue sin débito
});

test("pago con otro monto o de otra cuenta: no se aplica", async () => {
  pagos[111].transaction_amount = 1000;
  let r = res();
  await confirmarPagoModulos({ params: { id: "111" }, user: { cuenta_id: 29 } }, r);
  assert.equal(r.code, 409);
  pagos[111].transaction_amount = 22000;
  r = res();
  await confirmarPagoModulos({ params: { id: "111" }, user: { cuenta_id: 30 } }, r);
  assert.equal(r.code, 409);
  assert.equal(ops.some((o) => o.op === "update"), false);
});

test("confirmar el pago al volver y otra vez: se aplica una sola vez", async () => {
  let r = res();
  await confirmarPagoModulos({ params: { id: "111" }, user: { cuenta_id: 29 } }, r);
  assert.equal(r.code, 200);
  r = res();
  await confirmarPagoModulos({ params: { id: "111" }, user: { cuenta_id: 29 } }, r);
  assert.equal(r.body.message, "Ya aplicado");
  assert.equal(ops.filter((o) => o.op === "update").length, 1);
});

// ── Paso 2: débito desde el vencimiento ──

test("con la IA ya pagada: débito de $68.000 que arranca al vencimiento", async () => {
  cuenta = cancelada({ modulos_pagos: { ia: { cobrado: true, baja_en: FIN } } });
  const r = await pedirReactivar(["ia"]);
  assert.equal(r.body.paso, "debito");
  assert.equal(r.body.monto, 68000);
  const post = mpCalls.find((c) => c.url.endsWith("/preapproval"));
  assert.equal(post.body.auto_recurring.transaction_amount, 68000);
  assert.equal(post.body.auto_recurring.start_date, new Date(FIN).toISOString());
  assert.ok(post.body.auto_recurring.end_date > post.body.auto_recurring.start_date); // MP la exige
  assert.equal(post.body.external_reference, "cuenta:29:plan:standard:mod:ia");
});

test("sin módulos: débito del plan solo, desde el vencimiento", async () => {
  const r = await pedirReactivar([]);
  assert.equal(r.body.paso, "debito");
  assert.equal(r.body.monto, 46000);
});

test("cuenta activa o vencida: no se reactiva (409)", async () => {
  cuenta = cancelada({ estado_suscripcion: "activo" });
  assert.equal((await pedirReactivar(["ia"])).code, 409);
  cuenta = cancelada({ periodo_fin: en(-2) });
  assert.equal((await pedirReactivar(["ia"])).code, 409);
  assert.equal(mpCalls.length, 0);
});

test("débito autorizado: no pierde días (periodo_fin queda en el vencimiento)", async () => {
  cuenta = cancelada({ modulos_pagos: { ia: { cobrado: true, baja_en: FIN } } });
  subs.nueva = {
    id: "nueva",
    status: "authorized",
    external_reference: "cuenta:29:plan:standard:mod:ia",
    auto_recurring: { transaction_amount: 68000, start_date: FIN },
    next_payment_date: en(2), // aunque MP informe otra fecha, no se acorta
  };
  const v1 = crypto.createHmac("sha256", process.env.MP_WEBHOOK_SECRET).update("id:nueva;request-id:r2;ts:1;").digest("hex");
  const r = res();
  await mercadoPagoWebhook(
    { headers: { "x-signature": `ts=1,v1=${v1}`, "x-request-id": "r2" }, query: { "data.id": "nueva", type: "subscription_preapproval" }, body: {} },
    r,
  );
  assert.equal(r.code, 200);
  assert.equal(cuenta.estado_suscripcion, "activo");
  assert.equal(cuenta.periodo_fin, FIN);
  assert.equal(cuenta.modulos_pagos.ia.baja_en, null); // ahora va en el débito
});

test("getEstado avisa que se puede reactivar", async () => {
  const r = res();
  await getEstado({ user: { id: 1, cuenta_id: 29 } }, r);
  assert.equal(r.body.puede_reactivar, true);
});
