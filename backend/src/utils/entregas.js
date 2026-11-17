// ══════════════════════════════════════════════════════════════
// Modalidades de atención y entrega de un negocio. Una sola regla para el
// checkout del menú (vía GET /api/configuracion) y para el backend que
// valida el pedido: lo que no está activo no se ofrece ni se acepta.
//
// Tipos de pedido (pedidos.tipo_entrega):
//   mesa       → QR de la mesa (configuracion.mesas_activo)
//   retiro     → retira en el local (configuracion.retiro_activo)
//   delivery   → delivery propio (configuracion.delivery_activo)
//   mostrador  → pide y lo retira en el momento (modalidades.mostrador)
//   envio      → envío por correo o transporte (modalidades.envio)
// Programar para más tarde: modalidades.retiro_programado (retiro) y
// modalidades.entrega_programada (delivery y envío).
// ══════════════════════════════════════════════════════════════
const { franjasDelDia, fechaLocal, diaSemana } = require("./agenda");

const MODALIDADES = ["mostrador", "envio", "retiro_programado", "entrega_programada"];
const TIPOS = ["mesa", "retiro", "delivery", "mostrador", "envio"];

const normalizarModalidades = (m) =>
  Object.fromEntries(MODALIDADES.map((k) => [k, !!(m && typeof m === "object" && m[k] === true)]));

// Qué tipos acepta hoy el negocio. Sin el módulo de entregas, ninguno
// (pedido en mostrador sin tipo, como siempre).
function tiposActivos(cfg, modulos) {
  if (!cfg || modulos?.entregas === false) return Object.fromEntries(TIPOS.map((t) => [t, false]));
  const m = normalizarModalidades(cfg.modalidades);
  return {
    mesa: !!cfg.mesas_activo && Number(cfg.mesas_cantidad) > 0,
    retiro: !!cfg.retiro_activo,
    delivery: !!cfg.delivery_activo,
    mostrador: m.mostrador,
    envio: m.envio,
  };
}

// ¿Se puede programar este tipo de pedido?
function programable(cfg, tipo) {
  const m = normalizarModalidades(cfg?.modalidades);
  if (tipo === "retiro") return m.retiro_programado;
  if (tipo === "delivery" || tipo === "envio") return m.entrega_programada;
  return false;
}

const MIN = 60 * 1000;
const ANTICIPACION_MIN = 30;
const DIAS_MAX = 30;

// Valida la fecha y hora elegida: futura (con 30 min de margen), dentro de
// los próximos 30 días y, si el negocio cargó horarios, dentro de una franja.
// → { valor: ISO } o { error }
// ¿Cae en la parte después de las 0 h de una franja nocturna del día
// anterior (por ejemplo 20:00–02:00)?
function trasMedianoche(d, horarios) {
  const hora = new Date(d.getTime() - 3 * 60 * MIN).toISOString().slice(11, 16);
  const ayer = horarios[diaSemana(fechaLocal(d.getTime() - 24 * 60 * MIN))];
  if (!ayer || ayer.cerrado || !Array.isArray(ayer.franjas)) return false;
  return ayer.franjas.some((f) => typeof f?.desde === "string" && typeof f?.hasta === "string" && f.hasta <= f.desde && hora <= f.hasta);
}

function validarProgramado(iso, cfg, ahora = new Date(Date.now())) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { error: "La fecha elegida no es válida." };
  if (d.getTime() < ahora.getTime() + ANTICIPACION_MIN * MIN) {
    return { error: `Elegí un horario con al menos ${ANTICIPACION_MIN} minutos de anticipación.` };
  }
  if (d.getTime() > ahora.getTime() + DIAS_MAX * 24 * 60 * MIN) {
    return { error: `Se puede programar hasta ${DIAS_MAX} días adelante.` };
  }
  // Sin horarios cargados (null o []) no se restringe, igual que el menú.
  if (Array.isArray(cfg?.horarios_config) && cfg.horarios_config.length > 0) {
    const franjas = franjasDelDia(fechaLocal(d), cfg.horarios_config);
    if (!franjas.some((f) => d >= f.desde && d <= f.hasta) && !trasMedianoche(d, cfg.horarios_config)) {
      return { error: "En ese horario el local está cerrado. Elegí otro." };
    }
  }
  return { valor: d.toISOString() };
}

module.exports = { MODALIDADES, TIPOS, normalizarModalidades, tiposActivos, programable, validarProgramado };
