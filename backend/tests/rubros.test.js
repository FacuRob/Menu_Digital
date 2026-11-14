const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), { avisosDisponibles: async () => false });
const { resolverRubro, catalogoRubros, limpiarCache } = require("../src/utils/rubros");
const { getOnboarding, updateOnboarding } = require("../src/controllers/onboardingController");
const { updateConfiguracion } = require("../src/controllers/configuracionController");
const { onboardingSchema } = require("../src/schemas");

const CATS = [
  { codigo: "gastronomia", nombre: "Gastronomía", familia: "gastronomia", sugerencias: { ofrece: ["productos"] }, orden: 1 },
  { codigo: "belleza", nombre: "Belleza", familia: "servicios", sugerencias: { ofrece: ["servicios"] }, orden: 2 },
];
const ESPS = [
  { codigo: "pizzeria", categoria: "gastronomia", nombre: "Pizzería", sugerencias: null, orden: 1 },
  { codigo: "peluqueria", categoria: "belleza", nombre: "Peluquería", sugerencias: { funciones: ["reservas"] }, orden: 1 },
];

let ops, negocio;
beforeEach(() => {
  limpiarCache();
  ops = [];
  negocio = { id: 5, nombre: "Lo de Ana", slug: "lo-de-ana", activo: false, tipo_rubro: "gastronomia", onboarding: { paso: 3, completado: false, ofrece: ["productos"] } };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "rubros_categorias") return { data: CATS, error: null };
    if (q.table === "rubros_especialidades") return { data: ESPS, error: null };
    if (q.table === "negocios" && q.op === "select") return { data: negocio, error: null };
    if (q.table === "negocios" && q.op === "update") return { data: { ...negocio, ...q.payload }, error: null };
    if (q.table === "configuracion") return { data: { negocio_id: 5, nombre: "Lo de Ana" }, error: null };
    return { data: null, error: null };
  });
});

const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

test("catálogo: arma categorías con sus especialidades y hereda sugerencias", async () => {
  const { categorias } = await catalogoRubros();
  assert.deepEqual(categorias.map((c) => c.codigo), ["gastronomia", "belleza"]);
  const pizzeria = categorias[0].especialidades[0];
  assert.deepEqual(pizzeria.sugerencias, { ofrece: ["productos"] }); // de la categoría
  assert.deepEqual(categorias[1].especialidades[0].sugerencias, { funciones: ["reservas"] });
  assert.equal("orden" in categorias[0], false);
});

test("resolverRubro: especialidad → completa categoría y familia", async () => {
  const r = await resolverRubro({ rubro_especialidad: "peluqueria" });
  assert.deepEqual(r.patch, { rubro_categoria: "belleza", rubro_especialidad: "peluqueria", tipo_rubro: "servicios" });
});

test("resolverRubro: sólo categoría → sin especialidad", async () => {
  const r = await resolverRubro({ rubro_categoria: "gastronomia", rubro_especialidad: null });
  assert.deepEqual(r.patch, { rubro_categoria: "gastronomia", rubro_especialidad: null, tipo_rubro: "gastronomia" });
});

test("resolverRubro: rechaza lo que no existe o no cuadra", async () => {
  assert.ok((await resolverRubro({ rubro_categoria: "inventada" })).error);
  assert.ok((await resolverRubro({ rubro_especialidad: "inventada" })).error);
  assert.ok((await resolverRubro({ rubro_categoria: "gastronomia", rubro_especialidad: "peluqueria" })).error);
  assert.ok((await resolverRubro({ tipo_rubro: "comida" })).error);
});

test("resolverRubro: compatibilidad con tipo_rubro solo, y nada si no viene rubro", async () => {
  assert.deepEqual((await resolverRubro({ tipo_rubro: "retail" })).patch, { tipo_rubro: "retail" });
  assert.deepEqual((await resolverRubro({})).patch, {});
  assert.equal(ops.length, 0); // sin consultar la base
});

test("onboarding: GET devuelve el progreso; un negocio viejo devuelve null", async () => {
  const r1 = respuesta();
  await getOnboarding({ negocioId: 5 }, r1);
  assert.equal(r1.body.onboarding.paso, 3);
  assert.equal(r1.body.slug, "lo-de-ana");
  assert.equal("cuenta_id" in r1.body, false);

  delete negocio.onboarding;
  const r2 = respuesta();
  await getOnboarding({ negocioId: 5 }, r2);
  assert.equal(r2.body.onboarding, null);
});

test("onboarding: PUT mezcla con lo guardado y sólo toca ese negocio", async () => {
  const res = respuesta();
  await updateOnboarding({ negocioId: 5, body: { paso: 5, funciones: ["pedidos"] } }, res);
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal(upd.filters.id, 5);
  assert.equal(upd.payload.onboarding.paso, 5);
  assert.deepEqual(upd.payload.onboarding.ofrece, ["productos"]); // se conserva
  assert.deepEqual(upd.payload.onboarding.funciones, ["pedidos"]);
  assert.equal("activo" in upd.payload, false);
});

test("onboarding: completar publica el negocio", async () => {
  await updateOnboarding({ negocioId: 5, body: { completado: true } }, respuesta());
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal(upd.payload.activo, true);
  assert.equal(upd.payload.onboarding.completado, true);
});

test("onboardingSchema: acepta lo válido y rechaza valores fuera de la lista", () => {
  assert.equal(onboardingSchema.safeParse({ paso: 4, ofrece: ["servicios"] }).success, true);
  assert.equal(onboardingSchema.safeParse({ paso: 1 }).success, false);
  assert.equal(onboardingSchema.safeParse({ paso: 9 }).success, false);
  assert.equal(onboardingSchema.safeParse({ funciones: ["teletransporte"] }).success, false);
});

test("configuración: guarda la especialidad en negocios y deriva tipo_rubro", async () => {
  const res = respuesta();
  await updateConfiguracion({ negocioId: 5, body: { nombre: "Lo de Ana", rubro_especialidad: "peluqueria", ciudad: "Tafí Viejo" } }, res);
  assert.equal(res.code, 200);
  const neg = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.deepEqual(neg.payload, { rubro_categoria: "belleza", rubro_especialidad: "peluqueria", tipo_rubro: "servicios" });
  const cfg = ops.find((o) => o.table === "configuracion" && o.op === "upsert");
  assert.equal(cfg.payload.ciudad, "Tafí Viejo");
  assert.equal(res.body.rubro_especialidad, "peluqueria");
});

test("configuración: especialidad inexistente → 400 sin guardar nada", async () => {
  const res = respuesta();
  await updateConfiguracion({ negocioId: 5, body: { rubro_especialidad: "inventada" } }, res);
  assert.equal(res.code, 400);
  assert.equal(ops.some((o) => o.op === "update" || o.op === "upsert"), false);
});
