const express = require("express");
const {
  getAvisos,
  updateAvisos,
  getMensajes,
  postPrueba,
  getChats,
  getMensajesChat,
  postMensajeChat,
} = require("../controllers/whatsappController");

// Configuración de avisos. Montado en server.js con authMiddleware +
// scopeNegocio + checkSuscripcion + checkPermiso("configuracion").
const router = express.Router();
router.get("/avisos", getAvisos);
router.put("/avisos", updateAvisos);
router.get("/mensajes", getMensajes);
router.post("/prueba", postPrueba);

// Chats con clientes. Se monta aparte con checkPermiso("pedidos"): lo usa
// quien atiende los pedidos, no solo quien configura.
const chatsRouter = express.Router();
chatsRouter.get("/", getChats);
chatsRouter.get("/:id/mensajes", getMensajesChat);
chatsRouter.post("/:id/mensajes", postMensajeChat);

module.exports = router;
module.exports.chatsRouter = chatsRouter;
