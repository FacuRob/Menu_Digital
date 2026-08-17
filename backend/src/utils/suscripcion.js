// Lógica de vigencia de la suscripción / trial.
//
// Estados:
//   trial     → vigente si periodo_fin es futuro.
//   activo    → vigente siempre (los webhooks lo bajan a 'vencido' si el pago
//               falla; así un retraso del webhook no bloquea a quien paga).
//   cancelado → vigente hasta que termina el ciclo pagado (periodo_fin futuro).
//   vencido   → nunca vigente.

const MS_DIA = 24 * 60 * 60 * 1000;

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

module.exports = { estaVigente, diasRestantes, MS_DIA };
