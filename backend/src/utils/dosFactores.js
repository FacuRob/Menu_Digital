// Doble factor (2FA) con códigos TOTP de una app de autenticación
// (Google Authenticator, Microsoft Authenticator, etc.) — RFC 6238, solo stdlib.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const PASO_SEG = 30;
const DIGITOS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const base32 = (buf) => {
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
};

const desdeBase32 = (s) => {
  let bits = "";
  for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    bits += B32.indexOf(c).toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
};

const generarSecreto = () => base32(crypto.randomBytes(20));

const codigoEnPaso = (secreto, paso) => {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(paso));
  const h = crypto.createHmac("sha1", desdeBase32(secreto)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = (h.readUInt32BE(o) & 0x7fffffff) % 10 ** DIGITOS;
  return String(n).padStart(DIGITOS, "0");
};

const pasoActual = (ms = Date.now()) => Math.floor(ms / 1000 / PASO_SEG);

// Devuelve el paso del código si es válido (tolera ±1 paso de desfasaje del
// reloj), o null. Rechaza pasos <= ultimoPaso: un código no se usa dos veces.
const verificarCodigo = (secreto, codigo, ultimoPaso = null, ms = Date.now()) => {
  const c = String(codigo || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const actual = pasoActual(ms);
  for (const p of [actual - 1, actual, actual + 1]) {
    if (ultimoPaso !== null && p <= ultimoPaso) continue;
    const a = Buffer.from(codigoEnPaso(secreto, p));
    if (crypto.timingSafeEqual(a, Buffer.from(c))) return p;
  }
  return null;
};

const otpauthUrl = (secreto, cuenta) =>
  `otpauth://totp/${encodeURIComponent(`DinexFlow:${cuenta}`)}?secret=${secreto}&issuer=DinexFlow&digits=${DIGITOS}&period=${PASO_SEG}`;

// El secreto se guarda cifrado (AES-256-GCM): una filtración de la base sola
// no alcanza para generar códigos.
// shortcut: la clave deriva de JWT_SECRET si no hay TOTP_KEY; si se rota
// JWT_SECRET, los usuarios con 2FA entran con un código de respaldo y lo reactivan.
const clave = () =>
  crypto.createHash("sha256").update(`${process.env.TOTP_KEY || process.env.JWT_SECRET}:totp`).digest();

const cifrar = (texto) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const enc = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

const descifrar = (guardado) => {
  const [iv, tag, enc] = String(guardado).split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
};

// Códigos de respaldo: se muestran una sola vez; se guarda solo su hash.
const hashRespaldo = (c) =>
  crypto.createHash("sha256").update(String(c).toLowerCase().replace(/[^a-z0-9]/g, "")).digest("hex");

const generarRespaldo = (n = 8) =>
  Array.from({ length: n }, () => {
    const h = crypto.randomBytes(5).toString("hex");
    return `${h.slice(0, 5)}-${h.slice(5)}`;
  });

// Ticket corto entre "contraseña correcta" y "código correcto". Se firma con
// otra clave para que authMiddleware nunca lo acepte como sesión.
const secretoDesafio = () => `${process.env.JWT_SECRET}:2fa`;

const crearDesafio = (usuarioId) =>
  jwt.sign({ id: usuarioId, proposito: "2fa" }, secretoDesafio(), { expiresIn: "5m" });

const leerDesafio = (desafio) => {
  try {
    const d = jwt.verify(desafio, secretoDesafio());
    return d.proposito === "2fa" ? d.id : null;
  } catch {
    return null;
  }
};

module.exports = {
  generarSecreto,
  codigoEnPaso,
  pasoActual,
  verificarCodigo,
  otpauthUrl,
  cifrar,
  descifrar,
  hashRespaldo,
  generarRespaldo,
  crearDesafio,
  leerDesafio,
};
