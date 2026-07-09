const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { planPorProducto } = require("../src/utils/hotmartPlans");

beforeEach(() => {
  process.env.HOTMART_PRODUCTS_BASIC = "100,101";
  process.env.HOTMART_PRODUCTS_STANDARD = "200";
  process.env.HOTMART_PRODUCTS_PREMIUM = "300";
  process.env.HOTMART_PRODUCTS_PREMIUM_ANNUAL = "399";
});

test("planPorProducto: mapea basic/standard/premium", () => {
  assert.equal(planPorProducto("101").plan, "basic");
  assert.equal(planPorProducto("200").plan, "standard");
  assert.equal(planPorProducto(300).plan, "premium"); // acepta number
});

test("planPorProducto: id no mapeado → plan null", () => {
  assert.equal(planPorProducto("999").plan, null);
});

test("planPorProducto: sin id → plan null, ciclo mensual", () => {
  assert.deepEqual(planPorProducto(null), { plan: null, ciclo: "mensual" });
});

test("planPorProducto: id en lista ANNUAL → ciclo anual", () => {
  const r = planPorProducto("399");
  assert.equal(r.plan, "premium");
  assert.equal(r.ciclo, "anual");
});
