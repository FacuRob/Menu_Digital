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
const TRIAL_DIAS = Math.max(0, parseInt(process.env.FREE_TRIAL_DAYS, 10) || 15);

// Límites por plan. `productos` es el TOTAL de la cuenta, repartido en partes
// iguales entre los negocios que tenga (ver cupoPorNegocio): Estándar 180 con
// 1 negocio, 90 con 2, 60 con 3; Premium 1000, 500, 334/333, 250, 200.
// `whatsapp`: avisos y chats de WhatsApp, bot con IA y seguimiento del
// repartidor en el mapa. Deben coincidir con el trigger set_limites_por_plan
// de la BD (db/planes_2026_11.sql) y con los textos de la landing y el panel.
const LIMITES_POR_PLAN = {
  free: { negocios: 1, productos: 10, whatsapp: false },
  basic: { negocios: 1, productos: 50, whatsapp: false },
  standard: { negocios: 3, productos: 180, whatsapp: true },
  premium: { negocios: 5, productos: 1000, whatsapp: true },
};

// Plan cuyos límites se aplican durante la prueba gratis (TRIAL_PLAN, por
// defecto "standard"): la prueba muestra el producto completo, como promete
// la landing. Al pagar, rigen los límites del plan comprado.
const planDeTrial = () => {
  const p = String(process.env.TRIAL_PLAN || "standard").toLowerCase();
  return LIMITES_POR_PLAN[p] ? p : "standard";
};

// Plan que rige HOY: en prueba gratis, el plan de prueba; si no, el de la cuenta.
const planEfectivo = (cuenta) => {
  if (cuenta?.estado_suscripcion === "trial") return planDeTrial();
  return LIMITES_POR_PLAN[cuenta?.tipo_plan] ? cuenta.tipo_plan : null;
};

// Límites que valen HOY para la cuenta. Salen de la tabla de arriba según el
// plan (así un cambio de límites rige al publicar, sin esperar la migración);
// sólo si el plan es desconocido se usan los guardados en la cuenta.
const limitesEfectivos = (cuenta) => {
  const l = LIMITES_POR_PLAN[planEfectivo(cuenta)];
  if (l) return { negocios: l.negocios, productos: l.productos };
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

// Cupo de productos de UN negocio: el total del plan dividido por la cantidad
// de negocios de la cuenta. Si no da exacto, los primeros negocios (por orden
// de creación, `posicion` desde 0) se llevan uno más: 1000 entre 3 → 334,
// 333, 333. Así la suma da justo el total.
const cupoPorNegocio = (total, cantidadNegocios, posicion = 0) => {
  const n = Math.max(1, cantidadNegocios || 1);
  return Math.floor(total / n) + (Math.max(0, posicion) < total % n ? 1 : 0);
};

// ¿La cuenta puede usar WhatsApp (avisos, chats, IA, mapa del repartidor)?
// Estándar y Premium (y la prueba gratis), con la suscripción vigente.
const incluyeWhatsapp = (cuenta) =>
  !!LIMITES_POR_PLAN[planEfectivo(cuenta)]?.whatsapp && estaVigente(cuenta);

module.exports = {
  estaVigente,
  planEfectivo,
  incluyeWhatsapp,
  cupoPorNegocio,
  diasRestantes,
  MS_DIA,
  TRIAL_DIAS,
  LIMITES_POR_PLAN,
  planDeTrial,
  limitesEfectivos,
};
