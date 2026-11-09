const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const { getGrupoPublico } = require("../src/controllers/negociosController");

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};

beforeEach(() => db.setHandler(() => ({ data: null, error: null })));

test("grupo: devuelve el nombre de la cuenta y sus negocios activos", async () => {
  const consultas = [];
  db.setHandler((q) => {
    consultas.push(q);
    if (q.table === "negocios" && q.filters.slug) return { data: { cuenta_id: 7 }, error: null };
    if (q.table === "negocios")
      return { data: [{ id: 3, nombre: "Bar", slug: "bar" }, { id: 4, nombre: "Pizzas", slug: "pizzas" }], error: null };
    if (q.table === "cuentas") return { data: { nombre: "Grupo Dinex" }, error: null };
    return { data: null, error: null };
  });
  const r = res();
  await getGrupoPublico({ params: { slug: "bar" } }, r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.nombre, "Grupo Dinex");
  assert.equal(r.body.negocios.length, 2);
  // La lista se filtra por la cuenta del slug y sólo negocios activos.
  const lista = consultas.find((q) => q.table === "negocios" && q.filters.cuenta_id);
  assert.deepEqual(lista.filters, { cuenta_id: 7, activo: true });
});

test("grupo: 404 si el slug no existe", async () => {
  const r = res();
  await getGrupoPublico({ params: { slug: "no-existe" } }, r);
  assert.equal(r.statusCode, 404);
});

test("grupo: 404 si la cuenta no tiene negocios activos", async () => {
  db.setHandler((q) =>
    q.filters.slug ? { data: { cuenta_id: 7 }, error: null } : { data: [], error: null },
  );
  const r = res();
  await getGrupoPublico({ params: { slug: "bar" } }, r);
  assert.equal(r.statusCode, 404);
});
