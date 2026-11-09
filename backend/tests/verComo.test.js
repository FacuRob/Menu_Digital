const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.JWT_SECRET = "test-secret";
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const authMiddleware = require("../src/middleware/authMiddleware");
const noSoloLectura = require("../src/middleware/noSoloLectura");
const { verComoCliente } = require("../src/controllers/plataformaController");

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const firmar = (extra) => jwt.sign({ id: 5, cuenta_id: 7, rol: "admin", ...extra }, "test-secret");
const pasar = (token, method, url) => {
  const r = res();
  let paso = false;
  const req = { method, originalUrl: url, header: () => `Bearer ${token}` };
  authMiddleware(req, r, () => (paso = true));
  return { paso, r, req };
};

beforeEach(() => db.setHandler(() => ({ data: null, error: null })));

test("solo lectura: deja mirar y bloquea cualquier cambio", () => {
  const t = firmar({ solo_lectura: true });
  assert.equal(pasar(t, "GET", "/api/productos").paso, true);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    const { paso, r } = pasar(t, m, "/api/productos/1");
    assert.equal(paso, false, m);
    assert.equal(r.statusCode, 403);
    assert.equal(r.body.error, "SOLO_LECTURA");
  }
});

test("noSoloLectura: corta los GET con efectos (link de pago, link del repartidor)", () => {
  const r = res();
  let paso = false;
  noSoloLectura({ user: { solo_lectura: true } }, r, () => (paso = true));
  assert.equal(paso, false);
  assert.equal(r.statusCode, 403);
  noSoloLectura({ user: { id: 1 } }, res(), () => (paso = true));
  assert.equal(paso, true);
});

test("noSoloLectura está puesto en el checkout y en el link del repartidor", () => {
  const usa = (archivo, ruta) => {
    const stack = require(archivo).stack.find((l) => l.route?.path === ruta);
    return stack.route.stack.some((s) => s.handle === noSoloLectura);
  };
  assert.ok(usa("../src/routes/suscripcion", "/checkout/:plan"));
  assert.ok(usa("../src/routes/pedidos", "/:id/link-reparto"));
});

test("token normal: sin cambios de comportamiento", () => {
  assert.equal(pasar(firmar({}), "POST", "/api/productos").paso, true);
});

test("verComo: entra como el dueño de la cuenta, con token de solo lectura y 30 min", async () => {
  db.setHandler((q) => {
    if (q.table === "cuentas") return { data: { id: 7, nombre: "La Esquina" }, error: null };
    if (q.filters.es_plataforma === true) return { data: { id: 1 }, error: null };
    return {
      data: [
        { id: 3, username: "tech2", rol: "admin", es_plataforma: true },
        { id: 8, username: "mozo", rol: "staff", es_plataforma: false },
        { id: 9, username: "duenio", rol: "admin", es_plataforma: false },
      ],
      error: null,
    };
  });
  const r = res();
  await verComoCliente({ params: { id: "7" }, user: { id: 1 } }, r);
  const d = jwt.verify(r.body.token, "test-secret");
  assert.equal(d.id, 9);
  assert.equal(d.cuenta_id, 7);
  assert.equal(d.solo_lectura, true);
  assert.equal(d.es_plataforma, false);
  assert.equal(d.tech_id, 1);
  assert.ok(d.exp - d.iat <= 30 * 60);
  assert.equal(r.body.cuenta.nombre, "La Esquina");
});

test("verComo: si ya no es Tech en la base → 403", async () => {
  db.setHandler(() => ({ data: null, error: null }));
  const r = res();
  await verComoCliente({ params: { id: "7" }, user: { id: 1 } }, r);
  assert.equal(r.statusCode, 403);
});

test("verComo: cuenta sin usuarios activos o inexistente → 404", async () => {
  db.setHandler((q) =>
    q.filters.es_plataforma === true
      ? { data: { id: 1 }, error: null }
      : q.table === "cuentas"
        ? { data: { id: 7 }, error: null }
        : { data: [], error: null },
  );
  const r1 = res();
  await verComoCliente({ params: { id: "7" }, user: { id: 1 } }, r1);
  assert.equal(r1.statusCode, 404);
  db.setHandler((q) => (q.filters.es_plataforma === true ? { data: { id: 1 }, error: null } : { data: null, error: null }));
  const r2 = res();
  await verComoCliente({ params: { id: "99" }, user: { id: 1 } }, r2);
  assert.equal(r2.statusCode, 404);
});
