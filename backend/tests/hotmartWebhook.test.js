const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// El webhook toca BD y email; para los tests de los GUARDAS de seguridad
// (que retornan antes de tocar nada) alcanza con mockear ambos.
const dbPath = require.resolve("../src/config/database");
const emailPath = require.resolve("../src/services/emailService");
const db = createSupabaseMock();
injectModule(dbPath, db);
injectModule(emailPath, {
  sendWelcomeEmail: async () => {},
  sendPasswordResetEmail: async () => {},
});

const { hotmartWebhook } = require("../src/controllers/hotmartController");

const makeRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const run = async (req) => {
  const res = makeRes();
  await hotmartWebhook(req, res);
  return res;
};

beforeEach(() => {
  process.env.HOTMART_HOTTOK = "token-secreto";
  process.env.HOTMART_PRODUCTS_BASIC = "100";
  db.setHandler(() => ({ data: null, error: null }));
});

test("rechaza (401) si el hottok es inválido", async () => {
  const res = await run({
    headers: { "x-hotmart-hottok": "equivocado" },
    body: { event: "PURCHASE_APPROVED" },
  });
  assert.equal(res.statusCode, 401);
});

test("rechaza (401) si falta el hottok", async () => {
  const res = await run({ headers: {}, body: {} });
  assert.equal(res.statusCode, 401);
});

test("rechaza (401) aunque HOTMART_HOTTOK no esté configurado en el server", async () => {
  delete process.env.HOTMART_HOTTOK;
  const res = await run({
    headers: { "x-hotmart-hottok": "cualquiera" },
    body: {},
  });
  assert.equal(res.statusCode, 401);
});

test("con hottok válido pero status NO aprobado → 200 e ignora", async () => {
  const res = await run({
    headers: { "x-hotmart-hottok": "token-secreto" },
    body: { data: { purchase: { status: "REFUNDED" } } },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /ignorado/i);
});

test("hottok válido, aprobado, pero product_id sin plan mapeado → 200 sin crear nada", async () => {
  db.setHandler(() => {
    throw new Error("no debería tocar la BD para un producto no mapeado");
  });
  const res = await run({
    headers: { "x-hotmart-hottok": "token-secreto" },
    body: {
      data: {
        purchase: { status: "approved" },
        buyer: { email: "a@b.com" },
        product: { id: 999 }, // no está en HOTMART_PRODUCTS_*
      },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /no mapeado/i);
});
