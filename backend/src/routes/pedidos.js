const express = require("express");
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
  updatePagoPedido,
  deletePedido,
} = require("../controllers/pedidosController");
const { getLinkReparto } = require("../controllers/repartoController");
const { requiereMapa } = require("../middleware/requiereWhatsapp");
const noSoloLectura = require("../middleware/noSoloLectura");

// Rutas para el administrador (protegidas por el middleware al montarlas)
router.get("/", getPedidos);
router.get("/:id", getPedidoById);
// Mapa del repartidor: plan Estándar o Premium.
router.get("/:id/link-reparto", noSoloLectura, requiereMapa, getLinkReparto);
router.put("/:id/estado", updateEstadoPedido);
// Transferencias: "Llegó la plata" / "No llegó" (dueño y Admin).
router.put("/:id/pago", updatePagoPedido);
router.delete("/:id", deletePedido);

module.exports = router;
