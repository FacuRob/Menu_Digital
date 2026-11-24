const express = require("express");
const {
  getAvisos,
  updateAvisos,
  getMensajes,
  postPrueba,
  getChats,
  getMensajesChat,
  getResumenChats,
  postMensajeChat,
  patchIAChat,
  getIA,
  updateIA,
  getCuenta,
  postCuenta,
  postPlantillas,
  deleteCuenta,
  getQR,
  postQR,
  deleteQR,
} = require("../controllers/whatsappController");

// Configuración de avisos. Montado en server.js con authMiddleware +
// scopeNegocio + checkSuscripcion + checkPermiso("configuracion").
const router = express.Router();
router.get("/avisos", getAvisos);
router.put("/avisos", updateAvisos);
router.get("/mensajes", getMensajes);
router.post("/prueba", postPrueba);
router.get("/ia", getIA);
router.put("/ia", updateIA);
// Número propio del local (Embedded Signup de Meta).
router.get("/cuenta", getCuenta);
router.post("/cuenta", postCuenta);
router.post("/cuenta/plantillas", postPlantillas);
router.delete("/cuenta", deleteCuenta);
// WhatsApp común con código QR (Evolution API).
router.get("/qr", getQR);
router.post("/qr", postQR);
router.delete("/qr", deleteQR);

// Chats con clientes. Se monta aparte con checkPermiso("pedidos"): lo usa
// quien atiende los pedidos, no solo quien configura.
const chatsRouter = express.Router();
chatsRouter.get("/", getChats);
chatsRouter.get("/resumen", getResumenChats);
chatsRouter.get("/:id/mensajes", getMensajesChat);
chatsRouter.post("/:id/mensajes", postMensajeChat);
chatsRouter.patch("/:id/ia", patchIAChat);

module.exports = router;
module.exports.chatsRouter = chatsRouter;
