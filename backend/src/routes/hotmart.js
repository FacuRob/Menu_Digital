const express = require("express");
const router = express.Router();
const { hotmartWebhook } = require("../controllers/hotmartController");

// Público (sin authMiddleware): Hotmart no manda JWT. La seguridad es el
// header X-HOTMART-HOTTOK validado dentro del controlador.
router.post("/", hotmartWebhook);

module.exports = router;
