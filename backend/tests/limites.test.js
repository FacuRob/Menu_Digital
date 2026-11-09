const { test, afterEach } = require("node:test");
const assert = require("node:assert");
const {
  limitesEfectivos,
  planDeTrial,
  planEfectivo,
  incluyeWhatsapp,
  cupoPorNegocio,
} = require("../src/utils/suscripcion");

afterEach(() => {
  delete process.env.TRIAL_PLAN;
});

const futuro = () => new Date(Date.now() + 86400000).toISOString();

test("limitesEfectivos: en trial usa los límites de Estándar (no los de Free)", () => {
  const cuenta = { estado_suscripcion: "trial", tipo_plan: "free", limite_negocios: 1, limite_productos: 10 };
  assert.deepEqual(limitesEfectivos(cuenta), { negocios: 3, productos: 180 });
});

test("limitesEfectivos: TRIAL_PLAN permite elegir otro plan de prueba", () => {
  process.env.TRIAL_PLAN = "basic";
  assert.equal(planDeTrial(), "basic");
  assert.deepEqual(limitesEfectivos({ estado_suscripcion: "trial" }), { negocios: 1, productos: 50 });
});

test("limitesEfectivos: TRIAL_PLAN inválido cae a standard", () => {
  process.env.TRIAL_PLAN = "inventado";
  assert.equal(planDeTrial(), "standard");
});

test("limitesEfectivos: planes pagos (productos = total de la cuenta)", () => {
  const de = (tipo_plan) => limitesEfectivos({ estado_suscripcion: "activo", tipo_plan });
  assert.deepEqual(de("basic"), { negocios: 1, productos: 50 });
  assert.deepEqual(de("standard"), { negocios: 3, productos: 180 });
  assert.deepEqual(de("premium"), { negocios: 5, productos: 1000 });
});

test("cupoPorNegocio: Estándar 180 → 180, 90, 60", () => {
  assert.equal(cupoPorNegocio(180, 1, 0), 180);
  assert.deepEqual([0, 1].map((i) => cupoPorNegocio(180, 2, i)), [90, 90]);
  assert.deepEqual([0, 1, 2].map((i) => cupoPorNegocio(180, 3, i)), [60, 60, 60]);
});

test("cupoPorNegocio: Premium 1000 → 1000, 500, 334/333/333, 250, 200", () => {
  const reparto = (n) => Array.from({ length: n }, (_, i) => cupoPorNegocio(1000, n, i));
  assert.deepEqual(reparto(1), [1000]);
  assert.deepEqual(reparto(2), [500, 500]);
  assert.deepEqual(reparto(3), [334, 333, 333]);
  assert.deepEqual(reparto(4), [250, 250, 250, 250]);
  assert.deepEqual(reparto(5), [200, 200, 200, 200, 200]);
  // La suma siempre da el total.
  for (let n = 1; n <= 5; n++) assert.equal(reparto(n).reduce((a, b) => a + b, 0), 1000);
});

test("limitesEfectivos: el plan manda aunque la BD tenga límites viejos", () => {
  const cuenta = { estado_suscripcion: "activo", tipo_plan: "standard", limite_negocios: 10, limite_productos: 120 };
  assert.deepEqual(limitesEfectivos(cuenta), { negocios: 3, productos: 180 });
});

test("limitesEfectivos: plan desconocido usa lo guardado; sin datos, Free", () => {
  assert.deepEqual(
    limitesEfectivos({ estado_suscripcion: "activo", tipo_plan: "raro", limite_negocios: 2, limite_productos: 20 }),
    { negocios: 2, productos: 20 },
  );
  assert.deepEqual(limitesEfectivos({ estado_suscripcion: "vencido" }), { negocios: 1, productos: 10 });
});

test("planEfectivo: en trial el de prueba; si no, el de la cuenta", () => {
  assert.equal(planEfectivo({ estado_suscripcion: "trial", tipo_plan: "free" }), "standard");
  assert.equal(planEfectivo({ estado_suscripcion: "activo", tipo_plan: "basic" }), "basic");
});

test("incluyeWhatsapp: Estándar, Premium y la prueba gratis sí; Básico y Free no", () => {
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "activo", tipo_plan: "standard" }), true);
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "activo", tipo_plan: "premium" }), true);
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "trial", tipo_plan: "free", periodo_fin: futuro() }), true);
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "activo", tipo_plan: "basic" }), false);
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "activo", tipo_plan: "free" }), false);
});

test("incluyeWhatsapp: con la suscripción vencida, no", () => {
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "vencido", tipo_plan: "premium" }), false);
  assert.equal(incluyeWhatsapp({ estado_suscripcion: "trial", periodo_fin: "2020-01-01" }), false);
  assert.equal(incluyeWhatsapp(null), false);
});
