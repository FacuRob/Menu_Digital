const crypto = require("crypto");

// Comparación de strings en tiempo constante (evita timing attacks).
// Hashea ambos lados a SHA-256 para que largos distintos no rompan
// timingSafeEqual ni filtren la longitud del secreto.
const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

module.exports = { safeEqual };
