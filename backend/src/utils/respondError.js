// Responde un 500 genérico SIN filtrar detalles internos al cliente
// (mensajes de Postgres, estructura de tablas, stack traces, etc.).
// El error real se loguea en el servidor para poder diagnosticar.
const respondError = (res, error, context = "") => {
  console.error(`[error]${context ? " " + context : ""}:`, error);
  return res
    .status(500)
    .json({ message: "Ocurrió un error procesando la solicitud" });
};

module.exports = { respondError };
