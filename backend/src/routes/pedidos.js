const express = require("express");
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
  deletePedido,
} = require("../controllers/pedidosController");
const { getLinkReparto } = require("../controllers/repartoController");
const requiereWhatsapp = require("../middleware/requiereWhatsapp");
const noSoloLectura = require("../middleware/noSoloLectura");

// Rutas para el administrador (protegidas por el middleware al montarlas)
router.get("/", getPedidos);
router.get("/:id", getPedidoById);
// Mapa del repartidor: plan Estándar o Premium.
router.get("/:id/link-reparto", noSoloLectura, requiereWhatsapp, getLinkReparto);
router.put("/:id/estado", updateEstadoPedido);
router.delete("/:id", deletePedido);

module.exports = router;
