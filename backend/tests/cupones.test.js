const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { crearCupones, canjearCupon, eliminarCupon } = require("../src/controllers/cuponesController");
const { precioConDescuento, normalizarCodigo } = require("../src/utils/cupones");

let ops;
let cuenta;
let cupon; // el cupón "DINEX-ABC" en la BD
let mpCalls;
let mpFalla;

global.fetch = async (url, opts = {}) => {
  mpCalls.push({ url, method: opts.method || "GET", body: opts.body && JSON.parse(opts.body) });
  if (mpFalla) return { ok: false, status: 500, json: async () => ({ message: "falla" }) };
  return { ok: true, status: 200, json: async () => ({}) };
};

beforeEach(() => {
  ops = [];
  mpCalls = [];
  mpFalla = false;
  cuenta = { id: 7, tipo_plan: "standard", estado_suscripcion: "trial", mp_preapproval_id: null, descuento_pct: 0, descuento_meses_restantes: 0 };
  cupon = { id: 3, codigo: "DINEX-ABC", porcentaje: 20, meses: 2, usado_por_cuenta_id: null };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, iss: q.iss, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") return { data: cuenta, error: null };
    if (q.table === "cupones" && q.op === "update" && q.iss) {
      // Canje atómico: solo si el código existe y nadie lo usó.
      const libre = q.filters.codigo === cupon.codigo && cupon.usado_por_cuenta_id == null;
      return { data: libre ? cupon : null, error: null };
    }
    if (q.table === "cupones" && q.op === "insert") return { data: q.payload, error: null };
    if (q.table === "cupones" && q.op === "delete") return { data: [], error: null };
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

const canjear = async (codigo) => {
  const r = res();
  await canjearCupon({ body: { codigo }, user: { id: 1, cuenta_id: 7 } }, r);
  return r;
};

const update = (table) => ops.find((o) => o.table === table && o.op === "update");

test("precio con descuento: redondea y sin cupón queda el precio del plan", () => {
  assert.equal(precioConDescuento("standard", 20), 32800);
  assert.equal(precioConDescuento("basic", 0), 20000);
  assert.equal(normalizarCodigo(" dinex-abc "), "DINEX-ABC");
});

test("generar: crea la cantidad pedida con código único", async () => {
  const r = res();
  await crearCupones({ body: { porcentaje: 15, meses: 3, cantidad: 3 }, user: { id: 1 } }, r);
  assert.equal(r.code, 201);
  assert.equal(r.body.length, 3);
  assert.equal(new Set(r.body.map((c) => c.codigo)).size, 3);
  assert.ok(r.body.every((c) => c.porcentaje === 15 && c.meses === 3 && /^DINEX-/.test(c.codigo)));
});

test("generar: rechaza porcentaje fuera de rango", async () => {
  const r = res();
  await crearCupones({ body: { porcentaje: 100, meses: 1, cantidad: 1 }, user: { id: 1 } }, r);
  assert.equal(r.code, 400);
});

test("canjear: marca el cupón como usado por la cuenta y guarda el descuento", async () => {
  const r = await canjear("dinex-abc");
  assert.equal(r.code, 200);
  const uc = update("cupones");
  assert.equal(uc.payload.usado_por_cuenta_id, 7);
  assert.ok(uc.payload.usado_at);
  const ucu = update("cuentas");
  assert.deepEqual(ucu.payload, { descuento_pct: 20, descuento_meses_restantes: 2, cupon_id: 3 });
  assert.equal(mpCalls.length, 0); // en prueba gratis no hay suscripción en MP
});

test("canjear: cupón ya usado o inexistente → 404", async () => {
  cupon.usado_por_cuenta_id = 99;
  assert.equal((await canjear("DINEX-ABC")).code, 404);
  assert.equal((await canjear("DINEX-NOEXISTE")).code, 404);
  assert.equal(update("cuentas"), undefined);
});

test("canjear: con un descuento activo no se puede sumar otro", async () => {
  cuenta.descuento_pct = 10;
  cuenta.descuento_meses_restantes = 1;
  const r = await canjear("DINEX-ABC");
  assert.equal(r.code, 409);
  assert.equal(update("cupones"), undefined);
});

test("canjear con suscripción activa: baja el monto en Mercado Pago", async () => {
  cuenta.estado_suscripcion = "activo";
  cuenta.mp_preapproval_id = "sub1";
  await canjear("DINEX-ABC");
  const put = mpCalls.find((c) => c.method === "PUT");
  assert.ok(put.url.endsWith("/preapproval/sub1"));
  assert.equal(put.body.auto_recurring.transaction_amount, 32800);
});

test("canjear: si Mercado Pago falla, se deshace el canje", async () => {
  cuenta.estado_suscripcion = "activo";
  cuenta.mp_preapproval_id = "sub1";
  mpFalla = true;
  const r = await canjear("DINEX-ABC");
  assert.equal(r.code, 502);
  const cuponUpdates = ops.filter((o) => o.table === "cupones" && o.op === "update");
  assert.equal(cuponUpdates.at(-1).payload.usado_por_cuenta_id, null);
  const cuentaUpdates = ops.filter((o) => o.table === "cuentas" && o.op === "update");
  assert.equal(cuentaUpdates.at(-1).payload.descuento_pct, 0);
});

test("eliminar: solo cupones sin usar", async () => {
  const r = res();
  await eliminarCupon({ params: { id: "3" } }, r);
  assert.equal(r.code, 404);
  const del = ops.find((o) => o.op === "delete");
  assert.deepEqual(del.iss, { usado_por_cuenta_id: null });
});
