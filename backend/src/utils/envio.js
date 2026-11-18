// ══════════════════════════════════════════════════════════════
// Costo del envío (solo delivery propio). Lo configura el dueño de la
// cuenta en configuracion.envio:
//   cobrar        → si el local cobra el envío
//   monto         → precio fijo del envío
//   gratis_desde  → con productos por este monto o más, el envío es gratis (null = nunca)
//   cobro         → "pedido": se paga junto con el pedido
//                   "efectivo": se paga en efectivo al repartidor
// Misma regla para el carrito del menú y para el backend que guarda el pedido.
// ══════════════════════════════════════════════════════════════
const MAX = 10_000_000;

const monto = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 100) / 100, MAX) : 0;
};

function normalizarEnvio(e) {
  const o = e && typeof e === "object" && !Array.isArray(e) ? e : {};
  return {
    cobrar: o.cobrar === true,
    monto: monto(o.monto),
    gratis_desde: monto(o.gratis_desde) || null,
    cobro: o.cobro === "efectivo" ? "efectivo" : "pedido",
  };
}

// Lo que manda el panel → { valor } o { error }.
function validarEnvio(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return { error: "Datos de envío inválidos." };
  const valor = normalizarEnvio(e);
  if (valor.cobrar && valor.monto <= 0) return { error: "Poné cuánto cuesta el envío." };
  if (e.gratis_desde !== null && e.gratis_desde !== undefined && e.gratis_desde !== "" && !valor.gratis_desde) {
    return { error: "El monto para el envío gratis no es válido." };
  }
  return { valor };
}

// Envío de un pedido según la configuración ACTUAL del local.
// → { costo, cobro } (cobro null si no se cobra) y `gratis` si aplicó el envío gratis.
function costoEnvio(cfg, tipoEntrega, subtotal) {
  const e = normalizarEnvio(cfg?.envio);
  if (tipoEntrega !== "delivery" || !e.cobrar || e.monto <= 0) return { costo: 0, cobro: null, gratis: false };
  if (e.gratis_desde && subtotal >= e.gratis_desde) return { costo: 0, cobro: null, gratis: true };
  return { costo: e.monto, cobro: e.cobro, gratis: false };
}

module.exports = { normalizarEnvio, validarEnvio, costoEnvio };
