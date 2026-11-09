// Para GET que cambian algo o entregan un link con el que se puede cambiar
// algo (link de pago, link del repartidor). Con "Ver como el cliente" no van.
const noSoloLectura = (req, res, next) =>
  req.user?.solo_lectura === true
    ? res.status(403).json({
        error: "SOLO_LECTURA",
        message: "Estás viendo esta cuenta en modo solo lectura: no se pueden hacer cambios.",
      })
    : next();

module.exports = noSoloLectura;
