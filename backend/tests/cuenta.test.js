const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// getAuthScope usa la BD sólo para tokens viejos (sin cuenta_id). Mockeamos DB.
const dbPath = require.resolve("../src/config/database");
const db = createSupabaseMock();
injectModule(dbPath, db);

const { getAuthScope, getCuentaId } = require("../src/utils/cuenta");

beforeEach(() => {
  db.setHandler(() => ({ data: null, error: null }));
});

test("token nuevo: toma cuenta_id y es_plataforma del JWT sin tocar la BD", async () => {
  db.setHandler(() => {
    throw new Error("no debería consultar la BD");
  });
  const r = await getAuthScope({ user: { cuenta_id: 5, es_plataforma: true } });
  assert.deepEqual(r, { cuentaId: 5, esPlataforma: true });
});

test("es_plataforma se normaliza a booleano estricto", async () => {
  const r = await getAuthScope({ user: { cuenta_id: 2 } });
  assert.equal(r.esPlataforma, false);
});

test("token viejo (sin cuenta_id): resuelve por BD según el id", async () => {
  db.setHandler((q) => {
    assert.equal(q.table, "usuarios");
    assert.equal(q.filters.id, 42);
    return { data: { cuenta_id: 9, es_plataforma: true }, error: null };
  });
  const r = await getAuthScope({ user: { id: 42 } });
  assert.deepEqual(r, { cuentaId: 9, esPlataforma: true });
});

test("sin user ni id → cuentaId null", async () => {
  assert.deepEqual(await getAuthScope({}), {
    cuentaId: null,
    esPlataforma: false,
  });
});

test("getCuentaId devuelve sólo la cuenta", async () => {
  assert.equal(await getCuentaId({ user: { cuenta_id: 7 } }), 7);
});
