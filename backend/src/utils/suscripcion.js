// Lógica de vigencia de la suscripción / trial.
//
// Estados:
//   trial     → vigente si periodo_fin es futuro.
//   activo    → vigente siempre (los webhooks lo bajan a 'vencido' si el pago
//               falla; así un retraso del webhook no bloquea a quien paga).
//   cancelado → vigente hasta que termina el ciclo pagado (periodo_fin futuro).
//   vencido   → nunca vigente.

const MS_DIA = 24 * 60 * 60 * 1000;

// Días de prueba gratis para cuentas nuevas.
const TRIAL_DIAS = Math.max(0, parseInt(process.env.FREE_TRIAL_DAYS, 10) || 14);

// Límites por plan. Deben coincidir con el trigger set_limites_por_plan de la BD
// (db/suscripciones.sql), que es quien los guarda en la tabla `cuentas`.
const LIMITES_POR_PLAN = {
  free: { negocios: 1, productos: 10 },
  basic: { negocios: 3, productos: 50 },
  standard: { negocios: 10, productos: 100 },
  premium: { negocios: 9999, productos: 9999 },
};

// Plan cuyos límites se aplican durante la prueba gratis (TRIAL_PLAN, por
// defecto "standard"): la prueba muestra el producto completo, como promete
// la landing. Al pagar, rigen los límites del plan comprado.
const planDeTrial = () => {
  const p = String(process.env.TRIAL_PLAN || "standard").toLowerCase();
  return LIMITES_POR_PLAN[p] ? p : "standard";
};

// Límites que valen HOY para la cuenta: en trial, los del plan de prueba;
// si no, los guardados en la cuenta (derivados de su plan por el trigger).
const limitesEfectivos = (cuenta) => {
  if (cuenta?.estado_suscripcion === "trial") {
    const l = LIMITES_POR_PLAN[planDeTrial()];
    return { negocios: l.negocios, productos: l.productos };
  }
  return {
    negocios: cuenta?.limite_negocios ?? LIMITES_POR_PLAN.free.negocios,
    productos: cuenta?.limite_productos ?? LIMITES_POR_PLAN.free.productos,
  };
};

const esFuturo = (fecha) => {
  if (!fecha) return false;
  const t = new Date(fecha).getTime();
  return Number.isFinite(t) && t > Date.now();
};

// ¿La cuenta puede usar el panel?
const estaVigente = (cuenta) => {
  if (!cuenta) return false;
  switch (cuenta.estado_suscripcion) {
    case "activo":
      return true;
    case "trial":
    case "cancelado":
      return esFuturo(cuenta.periodo_fin);
    case "vencido":
    default:
      return false;
  }
};

// Días restantes hasta periodo_fin (>=0). null si no hay fecha.
const diasRestantes = (periodoFin) => {
  if (!periodoFin) return null;
  const t = new Date(periodoFin).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / MS_DIA));
};

module.exports = {
  estaVigente,
  diasRestantes,
  MS_DIA,
  TRIAL_DIAS,
  LIMITES_POR_PLAN,
  planDeTrial,
  limitesEfectivos,
};
