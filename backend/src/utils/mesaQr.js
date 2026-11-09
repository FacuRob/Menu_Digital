const crypto = require("crypto");
const { safeEqual } = require("./safeEqual");

// QR por mesa firmado. La URL lleva ?mesa=5&t=<firma>; la firma es un HMAC
// de (negocio, versión, mesa) con una clave que sólo tiene el backend. Así el
// cliente no puede cambiar mesa=5 por mesa=7 a mano: la firma deja de coincidir.
//
// La versión (configuracion.mesas_qr_version) permite anular los QR de un
// local sin tocar los de los demás: "Regenerar QR de mesas" la incrementa.
//
// La clave sale de MESA_QR_SECRET. Si no está, se deriva de JWT_SECRET, pero
// entonces rotar JWT_SECRET invalida los QR impresos: conviene definir
// MESA_QR_SECRET (32+ caracteres al azar) y no cambiarla.
const clave = () => {
  const propia = process.env.MESA_QR_SECRET;
  if (propia) return propia;
  if (!process.env.JWT_SECRET) throw new Error("Falta MESA_QR_SECRET (o JWT_SECRET)");
  return `${process.env.JWT_SECRET}:mesa-qr`;
};

// Aviso al arrancar si la clave no es la recomendada.
const avisarClaveMesas = () => {
  const propia = process.env.MESA_QR_SECRET;
  if (!propia) {
    console.warn("[QR mesas] Falta MESA_QR_SECRET: se usa una clave derivada de JWT_SECRET. Definila para poder rotar JWT_SECRET sin invalidar los QR impresos.");
  } else if (propia.length < 32) {
    console.warn("[QR mesas] MESA_QR_SECRET es corta: usá 32 caracteres al azar o más.");
  }
};

// Mesa normalizada: texto corto sin espacios alrededor ("5").
const normalizarMesa = (mesa) => String(mesa ?? "").trim().slice(0, 50);

const firmarMesa = (negocioId, mesa, version = 1) =>
  crypto
    .createHmac("sha256", clave())
    .update(`mesa:${Number(negocioId)}:${Number(version) || 1}:${normalizarMesa(mesa)}`)
    .digest("base64url")
    .slice(0, 22); // 132 bits: corto para el QR e imposible de adivinar

const mesaValida = (negocioId, mesa, token, version = 1) => {
  const m = normalizarMesa(mesa);
  if (!m || typeof token !== "string" || !token) return false;
  return safeEqual(token, firmarMesa(negocioId, m, version));
};

module.exports = { firmarMesa, mesaValida, normalizarMesa, avisarClaveMesas };
