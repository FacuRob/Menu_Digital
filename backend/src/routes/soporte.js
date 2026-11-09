const express = require("express");
const multer = require("multer");
const c = require("../controllers/soporteController");
const { soporteLimiter, soporteCrearLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Capturas: en memoria, hasta 5 MB, sólo imágenes.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("tipo")),
}).single("imagen");

const subir = (req, res, next) =>
  upload(req, res, (err) =>
    err
      ? res.status(400).json({
          message:
            err.code === "LIMIT_FILE_SIZE"
              ? "La imagen pesa más de 5 MB."
              : "Solo se permiten imágenes (jpg, png, webp o gif).",
        })
      : next(),
  );

router.get("/", c.listar);
router.get("/resumen", c.resumen);
router.post("/", soporteCrearLimiter, soporteLimiter, c.crear);
router.post("/imagen", soporteLimiter, subir, c.subirImagen);
router.get("/:id", c.ver);
router.post("/:id/mensajes", soporteLimiter, c.responder);
router.patch("/:id", c.cambiarEstado);

module.exports = router;
