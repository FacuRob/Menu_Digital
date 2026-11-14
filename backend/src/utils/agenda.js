// ══════════════════════════════════════════════════════════════
// Agenda de turnos: qué horarios quedan libres un día para un servicio.
// Pura (sin base): recibe los horarios del negocio, las reservas activas y
// los bloqueos, y devuelve los inicios posibles. Hora de Argentina (UTC−3,
// sin horario de verano), igual que el resto del sistema.
// ══════════════════════════════════════════════════════════════

const OFFSET = "-03:00";
const MIN = 60 * 1000;

const DEFAULTS = { paso_min: 30, anticipacion_min: 60, dias_max: 30, confirmacion: "manual" };

// Opciones de la agenda con valores por defecto y límites razonables.
function opcionesAgenda(agenda) {
  const a = { ...DEFAULTS, ...(agenda && typeof agenda === "object" ? agenda : {}) };
  const entre = (v, min, max, def) => (Number.isInteger(v) && v >= min && v <= max ? v : def);
  return {
    paso_min: entre(a.paso_min, 5, 240, DEFAULTS.paso_min),
    anticipacion_min: entre(a.anticipacion_min, 0, 7 * 24 * 60, DEFAULTS.anticipacion_min),
    dias_max: entre(a.dias_max, 1, 365, DEFAULTS.dias_max),
    confirmacion: a.confirmacion === "automatica" ? "automatica" : "manual",
  };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// "2026-11-20" + "09:30" → Date (hora de Argentina).
const aFecha = (fecha, hora) => new Date(`${fecha}T${hora}:00${OFFSET}`);

// Día de la semana del negocio: 0 = lunes … 6 = domingo (como horarios_config).
const diaSemana = (fecha) => (new Date(`${fecha}T12:00:00${OFFSET}`).getUTCDay() + 6) % 7;

// Franjas de atención de ese día: [{ desde: Date, hasta: Date }].
function franjasDelDia(fecha, horariosConfig) {
  const dia = Array.isArray(horariosConfig) ? horariosConfig[diaSemana(fecha)] : null;
  if (!dia || dia.cerrado || !Array.isArray(dia.franjas)) return [];
  return dia.franjas
    .filter((f) => HORA.test(f?.desde) && HORA.test(f?.hasta))
    .map((f) => {
      const desde = aFecha(fecha, f.desde);
      // Franja que pasa la medianoche (20:00–02:00): para turnos se corta a las 24.
      let hasta = aFecha(fecha, f.hasta);
      if (hasta <= desde) hasta = new Date(aFecha(fecha, "00:00").getTime() + 24 * 60 * MIN);
      return { desde, hasta };
    });
}

const seSuperpone = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

/**
 * Inicios libres (ISO) de un día.
 *  fecha: "YYYY-MM-DD"; duracion: minutos del servicio.
 *  ocupados / bloqueos: [{ inicio|desde, fin|hasta }] (ISO o Date).
 */
function horariosLibres({ fecha, horariosConfig, agenda, duracion, ocupados = [], bloqueos = [], ahora = new Date() }) {
  if (!FECHA.test(fecha)) return [];
  const op = opcionesAgenda(agenda);
  const dur = Number.isInteger(duracion) && duracion > 0 ? duracion : op.paso_min;
  const minimo = ahora.getTime() + op.anticipacion_min * MIN;
  const maximo = ahora.getTime() + op.dias_max * 24 * 60 * MIN;
  const tomados = [
    ...ocupados.map((o) => [new Date(o.inicio).getTime(), new Date(o.fin).getTime()]),
    ...bloqueos.map((b) => [new Date(b.desde).getTime(), new Date(b.hasta).getTime()]),
  ];
  const libres = [];
  for (const { desde, hasta } of franjasDelDia(fecha, horariosConfig)) {
    for (let t = desde.getTime(); t + dur * MIN <= hasta.getTime(); t += op.paso_min * MIN) {
      const fin = t + dur * MIN;
      if (t < minimo || t > maximo) continue;
      if (tomados.some(([a, b]) => seSuperpone(t, fin, a, b))) continue;
      libres.push(new Date(t).toISOString());
    }
  }
  return libres;
}

// Fecha del negocio ("YYYY-MM-DD") de un instante.
const fechaLocal = (d) => new Date(new Date(d).getTime() - 3 * 60 * MIN).toISOString().slice(0, 10);

module.exports = { opcionesAgenda, horariosLibres, franjasDelDia, fechaLocal, diaSemana };
