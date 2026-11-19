const crypto = require("crypto");
const { PRECIOS_MENSUALES } = require("./planPrecios");

// Límites de un cupón (iguales a los CHECK de db/cupones.sql). Tope de 90 %:
// Mercado Pago no acepta suscripciones de $0.
const PCT_MIN = 1;
const PCT_MAX = 90;
const MESES_MAX = 24;
const CANTIDAD_MAX = 50;

// Sin letras ni números que se confunden al dictarlos (0/O, 1/I/L).
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generarCodigo = () => {
  const bytes = crypto.randomBytes(8);
  let s = "";
  for (const b of bytes) s += ALFABETO[b % ALFABETO.length];
  return `DINEX-${s}`;
};

// Mismo formato que se guarda: mayúsculas y sin espacios.
const normalizarCodigo = (codigo) => String(codigo || "").trim().toUpperCase().replace(/\s+/g, "");

// Precio mensual de un plan con el descuento de la cuenta aplicado.
const precioConDescuento = (plan, pct = 0) => {
  const precio = PRECIOS_MENSUALES[plan] || 0;
  const p = Number(pct) || 0;
  if (p <= 0) return precio;
  return Math.round((precio * (100 - p)) / 100);
};

// ¿La cuenta tiene un descuento vigente?
const tieneDescuento = (cuenta) =>
  Number(cuenta?.descuento_pct) > 0 && Number(cuenta?.descuento_meses_restantes) > 0;

module.exports = {
  PCT_MIN,
  PCT_MAX,
  MESES_MAX,
  CANTIDAD_MAX,
  generarCodigo,
  normalizarCodigo,
  precioConDescuento,
  tieneDescuento,
};
