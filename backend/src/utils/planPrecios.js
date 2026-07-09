// Precios de los planes del SaaS (en USD), para calcular la ganancia
// recurrente (MRR) del panel de plataforma. Configurable por env.
//
//   PLAN_PRECIO_BASIC_MONTHLY=7.99      PLAN_PRECIO_BASIC_ANNUAL=79.90
//   PLAN_PRECIO_STANDARD_MONTHLY=14.99  PLAN_PRECIO_STANDARD_ANNUAL=149.90
//   PLAN_PRECIO_PREMIUM_MONTHLY=24.99   PLAN_PRECIO_PREMIUM_ANNUAL=249.90
//
// `free` siempre vale 0. Si una var no está seteada, ese precio cuenta 0.
const MONEDA = "USD";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const preciosPorPlan = () => ({
  moneda: MONEDA,
  mensual: {
    free: 0,
    basic: num(process.env.PLAN_PRECIO_BASIC_MONTHLY),
    standard: num(process.env.PLAN_PRECIO_STANDARD_MONTHLY),
    premium: num(process.env.PLAN_PRECIO_PREMIUM_MONTHLY),
  },
  anual: {
    free: 0,
    basic: num(process.env.PLAN_PRECIO_BASIC_ANNUAL),
    standard: num(process.env.PLAN_PRECIO_STANDARD_ANNUAL),
    premium: num(process.env.PLAN_PRECIO_PREMIUM_ANNUAL),
  },
});

// Aporte mensual de UNA cuenta al MRR según su plan y ciclo.
// Anual → se prorratea dividiendo por 12.
const mrrDeCuenta = (precios, plan, ciclo) => {
  if (ciclo === "anual") return (precios.anual[plan] || 0) / 12;
  return precios.mensual[plan] || 0;
};

module.exports = { preciosPorPlan, mrrDeCuenta, MONEDA };
