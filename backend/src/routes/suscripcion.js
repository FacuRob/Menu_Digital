const express = require("express");
const router = express.Router();
const checkPermiso = require("../middleware/checkPermiso");
const {
  getEstado,
  getCheckout,
  getPortal,
} = require("../controllers/suscripcionController");

// Todas requieren estar logueado (se monta authMiddleware en server.js).
// NO llevan checkSuscripcion: un usuario vencido debe poder ver su estado
// y comprar/gestionar su plan desde acá.
//
// Ver el estado es libre (cualquier miembro puede ver el plan/banner).
// COMPRAR o gestionar la licencia es responsabilidad del dueño (SuperAdmin):
// se exige el permiso "suscripcion", que sólo cubre el "*" del rol 'admin'.
// El "Admin" (manager) y el staff quedan fuera.
router.get("/", getEstado);
router.get("/portal", checkPermiso("suscripcion"), getPortal);
router.get("/checkout/:plan", checkPermiso("suscripcion"), getCheckout);

module.exports = router;
