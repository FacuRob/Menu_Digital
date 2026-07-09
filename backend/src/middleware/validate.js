// Middleware genérico de validación con zod.
// Valida (y sanea/coacciona) req.body contra el schema; ante un error
// devuelve 400 con el primer mensaje. Reemplaza req.body por los datos
// parseados (claves desconocidas descartadas) para que los controllers
// operen sobre datos ya validados.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const msg = result.error.issues?.[0]?.message || "Datos inválidos";
    return res.status(400).json({ message: msg });
  }
  req.body = result.data;
  next();
};

module.exports = { validate };
