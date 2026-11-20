const { test } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

injectModule(require.resolve("../src/config/database"), createSupabaseMock());
const { calcularResumen } = require("../src/controllers/plataformaController");

const CUENTAS = [
  { id: 1, tipo_plan: "premium", estado_suscripcion: "activo" }, // Tech
  { id: 27, tipo_plan: "free", estado_suscripcion: "trial" },
  { id: 29, tipo_plan: "standard", estado_suscripcion: "activo", descuento_pct: 90, descuento_meses_restantes: 1, mp_preapproval_id: "x" },
  { id: 30, tipo_plan: "basic", estado_suscripcion: "activo", descuento_pct: 50, descuento_meses_restantes: 0 },
];
const NEGOCIOS = [{ id: 1, cuenta_id: 1 }, { id: 2, cuenta_id: 27 }, { id: 3, cuenta_id: 29 }];

test("resumen: la cuenta de Tech no suma y el MRR usa el precio con descuento", () => {
  const r = calcularResumen(CUENTAS, NEGOCIOS, new Set([1]));
  assert.equal(r.total_cuentas, 3);
  assert.equal(r.activas, 2);
  assert.equal(r.por_plan.premium, 0);
  assert.equal(r.total_negocios, 2);
  assert.equal(r.mrr_por_plan.premium, 0);
  assert.equal(r.mrr_por_plan.standard, 4100); // 41.000 con 90 %
  assert.equal(r.mrr_por_plan.basic, 20000); // descuento ya terminado → precio lleno
  assert.equal(r.mrr, 24100);
});
