// Precios mensuales de los planes del SaaS, en pesos argentinos.
// Única fuente de verdad del backend: los usa el catálogo del panel, el cobro
// por Mercado Pago y el MRR de plataforma. La landing tiene su copia en
// frontend/src/pages/Landing.tsx (mantener alineadas).
const MONEDA = "ARS";

const PRECIOS_MENSUALES = {
  free: 0,
  basic: 20000,
  standard: 41000,
  premium: 65000,
};

const preciosPorPlan = () => ({ moneda: MONEDA, mensual: { ...PRECIOS_MENSUALES } });

// Aporte mensual de UNA cuenta al MRR según su plan.
const mrrDeCuenta = (plan) => PRECIOS_MENSUALES[plan] || 0;

module.exports = { preciosPorPlan, mrrDeCuenta, PRECIOS_MENSUALES, MONEDA };
