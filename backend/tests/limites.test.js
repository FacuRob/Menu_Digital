const { test, afterEach } = require("node:test");
const assert = require("node:assert");
const { limitesEfectivos, planDeTrial } = require("../src/utils/suscripcion");

afterEach(() => {
  delete process.env.TRIAL_PLAN;
});

test("limitesEfectivos: en trial usa los límites de Standard (no los de Free)", () => {
  const cuenta = { estado_suscripcion: "trial", limite_negocios: 1, limite_productos: 10 };
  assert.deepEqual(limitesEfectivos(cuenta), { negocios: 10, productos: 100 });
});

test("limitesEfectivos: TRIAL_PLAN permite elegir otro plan de prueba", () => {
  process.env.TRIAL_PLAN = "basic";
  assert.equal(planDeTrial(), "basic");
  assert.deepEqual(limitesEfectivos({ estado_suscripcion: "trial" }), { negocios: 3, productos: 50 });
});

test("limitesEfectivos: TRIAL_PLAN inválido cae a standard", () => {
  process.env.TRIAL_PLAN = "inventado";
  assert.equal(planDeTrial(), "standard");
});

test("limitesEfectivos: cuenta paga usa los límites guardados de su plan", () => {
  const cuenta = { estado_suscripcion: "activo", limite_negocios: 3, limite_productos: 50 };
  assert.deepEqual(limitesEfectivos(cuenta), { negocios: 3, productos: 50 });
});

test("limitesEfectivos: sin datos cae a los límites de Free", () => {
  assert.deepEqual(limitesEfectivos({ estado_suscripcion: "vencido" }), { negocios: 1, productos: 10 });
});
