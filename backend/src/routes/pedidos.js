const express = require("express");
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  updateEstadoPedido,
  deletePedido,
} = require("../controllers/pedidosController");

// Rutas para el administrador (protegidas por el middleware al montarlas)
router.get("/", getPedidos);
router.get("/:id", getPedidoById);
router.put("/:id/estado", updateEstadoPedido);
router.delete("/:id", deletePedido);

module.exports = router;
