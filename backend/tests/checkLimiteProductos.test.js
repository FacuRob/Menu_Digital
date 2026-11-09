const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const checkLimiteProductos = require("../src/middleware/checkLimiteProductos");

// Escenario: cuenta con N negocios (ids 1..N) y productos por negocio.
let plan;
let negocios;
let productos; // { [negocioId]: cantidad }

beforeEach(() => {
  plan = "standard";
  negocios = [1, 2, 3];
  productos = {};
});

db.setHandler((q) => {
  if (q.table === "negocios" && q.filters.id)
    return { data: { cuenta_id: 9, cuentas: { tipo_plan: plan, estado_suscripcion: "activo" } }, error: null };
  if (q.table === "negocios") return { data: negocios.map((id) => ({ id })), error: null };
  if (q.table === "productos" && q.filters.negocio_id) return { count: productos[q.filters.negocio_id] || 0, error: null };
  if (q.table === "productos" && q.inList)
    return { count: q.inList.vals.reduce((a, id) => a + (productos[id] || 0), 0), error: null };
  return { data: null, error: null };
});

const correr = async (negocio) => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  let paso = false;
  await checkLimiteProductos({ query: { negocio: String(negocio) }, headers: {} }, r, () => (paso = true));
  return { paso, ...r };
};

test("Estándar con 3 negocios: 60 por negocio", async () => {
  productos = { 1: 59 };
  assert.equal((await correr(1)).paso, true);
  productos = { 1: 60 };
  const r = await correr(1);
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.limite, 60);
});

test("Estándar con 2 negocios: 90 por negocio", async () => {
  negocios = [1, 2];
  productos = { 2: 89 };
  assert.equal((await correr(2)).paso, true);
  productos = { 2: 90 };
  assert.equal((await correr(2)).statusCode, 403);
});

test("Estándar con 1 negocio: 180", async () => {
  negocios = [1];
  productos = { 1: 179 };
  assert.equal((await correr(1)).paso, true);
  productos = { 1: 180 };
  assert.equal((await correr(1)).statusCode, 403);
});

test("Premium con 3 negocios: el primero 334, los otros 333", async () => {
  plan = "premium";
  productos = { 1: 333 };
  assert.equal((await correr(1)).paso, true);
  productos = { 2: 333 };
  assert.equal((await correr(2)).statusCode, 403);
});

test("el total de la cuenta también manda (cargó todo antes de crear los otros)", async () => {
  // 180 en el negocio 1 cuando era el único; ahora hay 3: el 2 tiene cupo
  // de 60 pero la cuenta ya usó los 180 del plan.
  productos = { 1: 180, 2: 0 };
  const r = await correr(2);
  assert.equal(r.statusCode, 403);
  assert.match(r.body.message, /180 productos de tu plan/);
});
