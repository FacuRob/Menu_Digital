const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// ── Inyección de dependencias ANTES de requerir el middleware ──
const dbPath = require.resolve("../src/config/database");
const cuentaPath = require.resolve("../src/utils/cuenta");

const db = createSupabaseMock();
let scope = { cuentaId: 1, esPlataforma: false }; // configurable por test

injectModule(dbPath, db);
injectModule(cuentaPath, {
  getAuthScope: async () => scope,
  getCuentaId: async () => scope.cuentaId,
});

const scopeNegocio = require("../src/middleware/scopeNegocio");

// Dataset: negocio 10 es de la cuenta 1; negocio 20 es de la cuenta 2.
const NEGOCIOS = [
  { id: 10, cuenta_id: 1 },
  { id: 20, cuenta_id: 2 },
];

// El handler modela ambas consultas de scopeNegocio: la explícita por id
// (con o sin filtro cuenta_id) y el fallback (primer negocio, ordenado).
beforeEach(() => {
  scope = { cuentaId: 1, esPlataforma: false };
  db.setHandler((q) => {
    if (q.table !== "negocios") return { data: null, error: null };
    let rows = NEGOCIOS.slice();
    if ("id" in q.filters) rows = rows.filter((n) => n.id === q.filters.id);
    if ("cuenta_id" in q.filters)
      rows = rows.filter((n) => n.cuenta_id === q.filters.cuenta_id);
    if (q.ordered) rows.sort((a, b) => a.id - b.id);
    const row = rows[0] || null;
    return { data: row ? { id: row.id } : null, error: null };
  });
});

// Helpers de req/res/next.
const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const run = async (req) => {
  const res = makeRes();
  let nextCalled = false;
  await scopeNegocio(req, res, () => (nextCalled = true));
  return { res, nextCalled };
};

test("cuenta 1 pide su propio negocio (10) → se lo asigna", async () => {
  const req = { headers: { "x-negocio-id": "10" } };
  const { res, nextCalled } = await run(req);
  assert.equal(nextCalled, true);
  assert.equal(req.negocioId, 10);
});

test("AISLAMIENTO: cuenta 1 pide negocio de la cuenta 2 (20) → NO se lo da, cae a su propio negocio", async () => {
  const req = { headers: { "x-negocio-id": "20" } };
  const { nextCalled } = await run(req);
  assert.equal(nextCalled, true);
  assert.notEqual(req.negocioId, 20); // nunca sirve otra cuenta
  assert.equal(req.negocioId, 10); // su negocio por defecto
});

test("sin header → primer negocio de su cuenta", async () => {
  const req = { headers: {} };
  const { nextCalled } = await run(req);
  assert.equal(nextCalled, true);
  assert.equal(req.negocioId, 10);
});

test("usuario sin cuenta y sin plataforma → 403", async () => {
  scope = { cuentaId: null, esPlataforma: false };
  const req = { headers: { "x-negocio-id": "10" } };
  const { res, nextCalled } = await run(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("usuario de PLATAFORMA puede pedir el negocio de cualquier cuenta (20)", async () => {
  scope = { cuentaId: 1, esPlataforma: true };
  const req = { headers: { "x-negocio-id": "20" } };
  const { nextCalled } = await run(req);
  assert.equal(nextCalled, true);
  assert.equal(req.negocioId, 20);
});

test("cuenta sin negocios y sin header → 403", async () => {
  scope = { cuentaId: 3, esPlataforma: false }; // cuenta 3 no tiene negocios
  const req = { headers: {} };
  const { res, nextCalled } = await run(req);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});
