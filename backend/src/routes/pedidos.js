const express = require("express");
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
} = require("../controllers/pedidosController");

// Rutas para el administrador (protegidas por el middleware al montarlas)
router.get("/", getPedidos);
router.get("/:id", getPedidoById);
router.put("/:id/estado", updateEstadoPedido);

module.exports = router;
