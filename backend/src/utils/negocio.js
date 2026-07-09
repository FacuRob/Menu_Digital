// Resuelve el negocio (tenant) del request.
// Rutas protegidas: scopeNegocio ya validó y fijó req.negocioId (el header
// se valida contra la cuenta del usuario). Menú público: query ?negocio= /
// ?negocio_id=. Por defecto, negocio 1 (compatibilidad con datos existentes).
const getNegocioId = (req) => {
  // Valor validado por scopeNegocio (rutas autenticadas) — tiene prioridad.
  if (Number.isInteger(req.negocioId) && req.negocioId > 0) {
    return req.negocioId;
  }
  const raw =
    req.query?.negocio_id ??
    req.query?.negocio ??
    req.headers?.["x-negocio-id"];
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

module.exports = { getNegocioId };
