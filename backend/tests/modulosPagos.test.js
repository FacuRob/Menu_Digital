const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MP_ACCESS_TOKEN = "token-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const {
  montoProximoCobro,
  montoSuscripcionNueva,
  validarModulosNuevos,
  sumarModulo,
  quitarModulo,
  modulosAlCobrar,
} = require("../src/utils/modulosPagos");
const { incluye, funcionesDe } = require("../src/utils/suscripcion");
const { referencia, leerReferencia } = require("../src/utils/mercadoPago");
const { getCheckout, sumarModuloPago, quitarModuloPago } = require("../src/controllers/suscripcionController");

const FIN = "2030-01-01T00:00:00.000Z";
const activo = (extra = {}) => ({
  id: 7,
  tipo_plan: "basic",
  estado_suscripcion: "activo",
  mp_preapproval_id: "sub1",
  periodo_fin: FIN,
  modulos_pagos: {},
  ...extra,
});

// ── Reglas puras ──

test("monto: plan + módulos; el cupón descuenta sólo el plan; fundador manda", () => {
  assert.equal(montoProximoCobro(activo()), 22000);
  const conWa = activo({ modulos_pagos: { whatsapp: { cobrado: true } } });
  assert.equal(montoProximoCobro(conWa), 34000);
  assert.equal(montoProximoCobro({ ...conWa, descuento_pct: 50, descuento_meses_restantes: 1 }), 11000 + 12000);
  assert.equal(montoProximoCobro({ ...conWa, precio_plan_fijo: 20000 }), 32000);
  assert.equal(montoProximoCobro(activo({ tipo_plan: "standard", modulos_pagos: { whatsapp: {} } })), 44000); // incluido: no se cobra
});

test("Básico con los 3 módulos sale más que el Estándar", () => {
  assert.equal(montoSuscripcionNueva("basic", ["ia", "mapa", "whatsapp"]), 51000);
  assert.ok(montoSuscripcionNueva("basic", ["ia", "whatsapp"]) > montoSuscripcionNueva("standard"));
});

test("validarModulosNuevos: IA pide WhatsApp; no se suma lo incluido ni en Free", () => {
  assert.deepEqual(validarModulosNuevos("basic", ["whatsapp", "ia", "whatsapp"]).valor, ["ia", "whatsapp"]);
  assert.ok(validarModulosNuevos("basic", ["ia"]).error);
  assert.ok(validarModulosNuevos("standard", ["mapa"]).error);
  assert.ok(validarModulosNuevos("basic", ["inventado"]).error);
  assert.ok(validarModulosNuevos("basic", "whatsapp").error);
  assert.deepEqual(validarModulosNuevos("premium", undefined).valor, []);
});

test("incluye: Básico con módulo sí, sin módulo no; IA sin WhatsApp no; baja vencida no", () => {
  assert.equal(incluye(activo(), "whatsapp"), false);
  assert.equal(incluye(activo({ modulos_pagos: { whatsapp: {} } }), "whatsapp"), true);
  assert.equal(incluye(activo({ modulos_pagos: { ia: {} } }), "ia"), false);
  assert.equal(incluye(activo({ modulos_pagos: { whatsapp: { baja_en: "2020-01-01" } } }), "whatsapp"), false);
  assert.equal(incluye(activo({ modulos_pagos: { whatsapp: { baja_en: FIN } } }), "whatsapp"), true); // hasta el próximo cobro
  assert.deepEqual(funcionesDe(activo({ tipo_plan: "standard" })), { whatsapp: true, ia: true, mapa: true });
  assert.equal(incluye({ ...activo({ modulos_pagos: { mapa: {} } }), estado_suscripcion: "vencido" }, "mapa"), false);
});

test("sumar: nuevo sin cobrar; repetido → error; IA sin WhatsApp → error; arrepentirse de una baja la anula", () => {
  const r = sumarModulo(activo(), "mapa", Date.parse("2029-12-10"));
  assert.equal(r.modulos.mapa.cobrado, false);
  assert.equal(sumarModulo(activo({ modulos_pagos: r.modulos }), "mapa").code, "YA_ACTIVO");
  assert.equal(sumarModulo(activo(), "ia").code, "REQUIERE");
  assert.equal(sumarModulo(activo({ tipo_plan: "standard" }), "mapa").code, "NO_SUMABLE");
  const deBaja = activo({ modulos_pagos: { mapa: { cobrado: true, baja_en: FIN } } });
  assert.equal(sumarModulo(deBaja, "mapa").modulos.mapa.baja_en, null);
});

test("quitar: cobrado → hasta el próximo cobro; sin cobrar → un mes más; WhatsApp con IA → error", () => {
  const c = activo({ modulos_pagos: { whatsapp: { cobrado: true }, mapa: { cobrado: false } } });
  assert.equal(quitarModulo(c, "whatsapp").baja_en, FIN);
  assert.equal(quitarModulo(c, "mapa").baja_en, "2030-02-01T00:00:00.000Z");
  const conIa = activo({ modulos_pagos: { whatsapp: { cobrado: true }, ia: { cobrado: true } } });
  assert.equal(quitarModulo(conIa, "whatsapp").code, "DEPENDE");
  assert.equal(quitarModulo(c, "ia").code, "NO_ACTIVO");
  // Quitado y ya cobrado: el próximo cobro no lo incluye.
  assert.equal(montoProximoCobro({ ...c, modulos_pagos: quitarModulo(c, "whatsapp").modulos }), 22000 + 6000);
});

test("modulosAlCobrar: marca cobrados los sumados antes del cobro y borra los vencidos", () => {
  const ahora = Date.parse("2030-01-01T10:00:00Z");
  const r = modulosAlCobrar(
    {
      whatsapp: { desde: "2029-12-20T00:00:00Z", cobrado: false },
      mapa: { desde: "2030-01-01T12:00:00Z", cobrado: false },
      ia: { desde: "2029-10-01T00:00:00Z", cobrado: true, baja_en: "2030-01-01T00:00:00Z" },
    },
    "2030-01-01T09:00:00Z",
    ahora,
  );
  assert.deepEqual(Object.keys(r).sort(), ["mapa", "whatsapp"]);
  assert.equal(r.whatsapp.cobrado, true);
  assert.equal(r.mapa.cobrado, false); // se sumó después del cobro
});

test("referencia de MP con módulos: ida y vuelta; la vieja sigue andando", () => {
  assert.equal(referencia(7, "basic", ["whatsapp", "ia"]), "cuenta:7:plan:basic:mod:ia.whatsapp");
  assert.deepEqual(leerReferencia("cuenta:7:plan:basic:mod:ia.whatsapp"), { cuentaId: 7, plan: "basic", modulos: ["ia", "whatsapp"] });
  assert.deepEqual(leerReferencia("cuenta:7:plan:standard"), { cuentaId: 7, plan: "standard", modulos: [] });
  assert.equal(leerReferencia("cuenta:7:plan:basic:mod:"), null);
});

// ── Rutas ──

let cuenta;
let ops;
let mpCalls;
let mpFalla;
let conflicto;

global.fetch = async (url, opts = {}) => {
  mpCalls.push({ url, method: opts.method || "GET", body: opts.body && JSON.parse(opts.body) });
  if (mpFalla) return { ok: false, status: 500, json: async () => ({ message: "error" }) };
  return { ok: true, status: 200, json: async () => ({ init_point: "https://mp.test/pagar" }) };
};

beforeEach(() => {
  ops = [];
  mpCalls = [];
  mpFalla = false;
  conflicto = false;
  cuenta = activo();
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") return { data: cuenta, error: null };
    if (q.table === "cuentas" && q.op === "update") return { data: conflicto ? [] : [{ id: 7 }], error: null };
    if (q.table === "negocios") return { data: [{ id: 3 }], error: null };
    if (q.table === "usuarios") return { data: { email: "dinex@ejemplo.test" }, error: null };
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
const pedir = async (fn, codigo) => {
  const r = res();
  await fn({ params: { codigo }, user: { id: 1, cuenta_id: 7 } }, r);
  return r;
};
const updateCuenta = () => ops.find((o) => o.table === "cuentas" && o.op === "update");

test("sumar módulo: sube el monto en MP y lo guarda", async () => {
  const r = await pedir(sumarModuloPago, "whatsapp");
  assert.equal(r.code, 200);
  assert.equal(r.body.monto_proximo_cobro, 34000);
  assert.equal(r.body.funciones.whatsapp, true);
  const put = mpCalls.find((c) => c.method === "PUT");
  assert.ok(put.url.endsWith("/preapproval/sub1"));
  assert.equal(put.body.auto_recurring.transaction_amount, 34000);
  assert.ok(updateCuenta().payload.modulos_pagos.whatsapp);
});

test("sumar módulo: si MP falla no se guarda nada", async () => {
  mpFalla = true;
  const r = await pedir(sumarModuloPago, "whatsapp");
  assert.equal(r.code, 502);
  assert.equal(updateCuenta(), undefined);
});

test("sumar módulo: en la prueba gratis o sin migración, no", async () => {
  cuenta = { ...activo(), estado_suscripcion: "trial", mp_preapproval_id: null };
  assert.equal((await pedir(sumarModuloPago, "whatsapp")).code, 409);
  cuenta = activo();
  delete cuenta.modulos_pagos;
  assert.equal((await pedir(sumarModuloPago, "whatsapp")).code, 503);
  assert.equal(mpCalls.length, 0);
});

test("sumar módulo inválido → 400; incluido en el plan → 409", async () => {
  assert.equal((await pedir(sumarModuloPago, "teletransporte")).code, 400);
  cuenta = activo({ tipo_plan: "premium" });
  assert.equal((await pedir(sumarModuloPago, "mapa")).code, 409);
});

test("quitar módulo cobrado: baja el monto y queda hasta el próximo cobro", async () => {
  cuenta = activo({ modulos_pagos: { whatsapp: { desde: "2029-11-01", cobrado: true, baja_en: null } } });
  const r = await pedir(quitarModuloPago, "whatsapp");
  assert.equal(r.code, 200);
  assert.equal(r.body.baja_en, FIN);
  assert.equal(r.body.funciones.whatsapp, true); // lo sigue usando
  assert.equal(mpCalls.find((c) => c.method === "PUT").body.auto_recurring.transaction_amount, 22000);
});

test("quitar módulo sin cobrar: no cambia el monto (se cobra una vez)", async () => {
  cuenta = activo({ modulos_pagos: { mapa: { desde: "2029-12-20", cobrado: false, baja_en: null } } });
  const r = await pedir(quitarModuloPago, "mapa");
  assert.equal(r.code, 200);
  assert.equal(r.body.monto_proximo_cobro, 28000);
  assert.equal(mpCalls.length, 0);
});

test("checkout con módulos: monto y referencia los incluyen", async () => {
  cuenta = { id: 7, tipo_plan: "free", estado_suscripcion: "trial", periodo_fin: null, modulos_pagos: {} };
  const r = res();
  await getCheckout({ params: { plan: "basic" }, body: { email: "a@b.test", modulos: ["whatsapp", "mapa"] }, user: { id: 1, cuenta_id: 7 } }, r);
  assert.equal(r.code, 200);
  const post = mpCalls.find((c) => c.method === "POST");
  assert.equal(post.body.auto_recurring.transaction_amount, 40000);
  assert.equal(post.body.external_reference, "cuenta:7:plan:basic:mod:mapa.whatsapp");
});

test("checkout con IA sin WhatsApp → 400 sin llamar a MP", async () => {
  const r = res();
  await getCheckout({ params: { plan: "basic" }, body: { email: "a@b.test", modulos: ["ia"] }, user: { id: 1, cuenta_id: 7 } }, r);
  assert.equal(r.code, 400);
  assert.equal(mpCalls.length, 0);
});

test("sumar módulo: si otro cambio ganó (versión distinta) vuelve el monto en MP y responde 409", async () => {
  conflicto = true;
  cuenta = activo({ modulos_version: 3 });
  const r = await pedir(sumarModuloPago, "mapa");
  assert.equal(r.code, 409);
  const puts = mpCalls.filter((c) => c.method === "PUT").map((c) => c.body.auto_recurring.transaction_amount);
  assert.deepEqual(puts, [28000, 22000]);
  const u = ops.find((o) => o.table === "cuentas" && o.op === "update");
  assert.equal(u.payload.modulos_version, 4);
});

test("quitar sin cobrar el 31: la baja cae el último día del mes siguiente", () => {
  const c = activo({ periodo_fin: "2030-01-31T00:00:00.000Z", modulos_pagos: { mapa: { cobrado: false } } });
  assert.equal(quitarModulo(c, "mapa").baja_en, "2030-02-28T00:00:00.000Z");
  // MP cobra el 28/2: ya no entra en el cobro de marzo.
  assert.equal(montoProximoCobro({ ...c, periodo_fin: "2030-02-28T00:00:00.000Z", modulos_pagos: quitarModulo(c, "mapa").modulos }), 22000);
});

test("quitar WhatsApp cuando la IA (sin cobrar) ya tiene baja: dura lo mismo que la IA", () => {
  const c = activo({
    modulos_pagos: { whatsapp: { cobrado: true }, ia: { cobrado: false, baja_en: "2030-02-01T00:00:00.000Z" } },
  });
  assert.equal(quitarModulo(c, "whatsapp").baja_en, "2030-02-01T00:00:00.000Z");
});

test("checkout con módulos sin la migración → 503", async () => {
  cuenta = { id: 7, tipo_plan: "free", estado_suscripcion: "trial" };
  const r = res();
  await getCheckout({ params: { plan: "basic" }, body: { email: "a@b.test", modulos: ["mapa"] }, user: { id: 1, cuenta_id: 7 } }, r);
  assert.equal(r.code, 503);
  assert.equal(mpCalls.length, 0);
});
