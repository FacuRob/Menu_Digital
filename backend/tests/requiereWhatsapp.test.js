const { test } = require("node:test");
const assert = require("node:assert");
const { injectModule } = require("./helpers/supabaseMock");

let conWhatsapp = true;
injectModule(require.resolve("../src/utils/planNegocio"), {
  negocioConWhatsapp: async () => conWhatsapp,
});
const requiereWhatsapp = require("../src/middleware/requiereWhatsapp");

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};

test("requiereWhatsapp: con plan Estándar/Premium deja pasar", async () => {
  conWhatsapp = true;
  let paso = false;
  await requiereWhatsapp({ negocioId: 3 }, res(), () => (paso = true));
  assert.equal(paso, true);
});

test("requiereWhatsapp: con plan Básico corta con 403 PLAN_SIN_WHATSAPP", async () => {
  conWhatsapp = false;
  let paso = false;
  const r = res();
  await requiereWhatsapp({ negocioId: 3 }, r, () => (paso = true));
  assert.equal(paso, false);
  assert.equal(r.statusCode, 403);
  assert.equal(r.body.error, "PLAN_SIN_WHATSAPP");
});
