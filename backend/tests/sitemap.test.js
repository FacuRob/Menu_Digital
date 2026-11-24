const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const { sitemapNegocios, _limpiarCache } = require("../src/controllers/sitemapController");

const res = () => {
  const r = { statusCode: 200, body: null, headers: {} };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  r.set = (k, v) => ((r.headers[k] = v), r);
  r.type = (t) => ((r.headers["Content-Type"] = t), r);
  r.send = (b) => ((r.body = b), r);
  return r;
};

const futuro = new Date(Date.now() + 5 * 86400000).toISOString();
const pasado = new Date(Date.now() - 5 * 86400000).toISOString();

// Cuenta 1: Tech. 2: activa. 3: prueba vigente. 4: vencida. 5: prueba terminada.
const datos = (q) => {
  if (q.table === "negocios")
    return {
      data: [
        { id: 10, slug: "bar-tech", cuenta_id: 1 },
        { id: 20, slug: "pizzeria", cuenta_id: 2 },
        { id: 21, slug: "vacio", cuenta_id: 2 },
        { id: 30, slug: "peluqueria", cuenta_id: 3 },
        { id: 40, slug: "vencido", cuenta_id: 4 },
        { id: 50, slug: "fin-prueba", cuenta_id: 5 },
      ],
      error: null,
    };
  if (q.table === "cuentas")
    return {
      data: [
        { id: 1, estado_suscripcion: "activo" },
        { id: 2, estado_suscripcion: "activo" },
        { id: 3, estado_suscripcion: "trial", periodo_fin: futuro },
        { id: 4, estado_suscripcion: "vencido" },
        { id: 5, estado_suscripcion: "trial", periodo_fin: pasado },
      ],
      error: null,
    };
  if (q.table === "usuarios") return { data: [{ cuenta_id: 1 }], error: null };
  // 20 y 10 tienen productos; 30 sólo servicios; 21 nada.
  if (q.table === "productos") return { data: [10, 20, 40, 50].includes(q.filters.negocio_id) ? [{ id: 1 }] : [], error: null };
  if (q.table === "servicios") return { data: q.filters.negocio_id === 30 ? [{ id: 1 }] : [], error: null };
  return { data: null, error: null };
};

beforeEach(() => {
  _limpiarCache();
  db.setHandler(datos);
});

test("sitemap: sólo locales de cuentas al día, sin Tech y con algo para mostrar", async () => {
  const r = res();
  await sitemapNegocios({}, r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers["Content-Type"], "application/xml");
  const locs = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ["https://dinexflow.com.ar/negocio/pizzeria", "https://dinexflow.com.ar/negocio/peluqueria"]);
});

test("sitemap: sin negocios devuelve un urlset vacío válido", async () => {
  db.setHandler(() => ({ data: [], error: null }));
  const r = res();
  await sitemapNegocios({}, r);
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /<urlset[^>]*>\n<\/urlset>/);
});

test("sitemap: si falla la base responde 500", async () => {
  db.setHandler(() => ({ data: null, error: { message: "caída" } }));
  const r = res();
  await sitemapNegocios({}, r);
  assert.equal(r.statusCode, 500);
});
