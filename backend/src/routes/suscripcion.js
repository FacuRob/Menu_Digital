const express = require("express");
const router = express.Router();
const checkPermiso = require("../middleware/checkPermiso");
const noSoloLectura = require("../middleware/noSoloLectura");
const { getEstado, getCheckout } = require("../controllers/suscripcionController");
const { canjearCupon } = require("../controllers/cuponesController");

// Todas requieren estar logueado (se monta authMiddleware en server.js).
// NO llevan checkSuscripcion: un usuario vencido debe poder ver su estado
// y comprar/gestionar su plan desde acá.
//
// Ver el estado es libre (cualquier miembro puede ver el plan/banner).
// COMPRAR o gestionar la licencia es responsabilidad del dueño (SuperAdmin):
// se exige el permiso "suscripcion", que sólo cubre el "*" del rol 'admin'.
// El "Admin" (manager) y el staff quedan fuera.
router.get("/", getEstado);
router.get("/checkout/:plan", noSoloLectura, checkPermiso("suscripcion"), getCheckout);
router.post("/cupon", noSoloLectura, checkPermiso("suscripcion"), canjearCupon);

module.exports = router;
