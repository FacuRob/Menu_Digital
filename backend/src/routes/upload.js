const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { getNegocioId } = require("../utils/negocio");
const { esImagen } = require("../utils/imagen");

// Se monta en server.js detrás de authMiddleware + scopeNegocio: cada negocio
// sube a su propia carpeta y sólo puede borrar lo que está en ella.
const carpetaDe = (req) => `menu-digital/negocios/${getNegocioId(req)}`;

// Multer en memoria (no guarda en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) =>
    ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error("tipo")),
}).single("imagen");

const MSG_TIPO = "Solo se permiten imágenes (jpg, png, webp, gif)";
const subir = (req, res, next) =>
  upload(req, res, (err) =>
    err
      ? res.status(400).json({
          message: err.code === "LIMIT_FILE_SIZE" ? "La imagen pesa más de 5 MB." : MSG_TIPO,
        })
      : next(),
  );

// POST /api/upload — sube imagen y devuelve la URL de Cloudinary
router.post("/", subir, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }
    // El tipo declarado no alcanza: se revisa el contenido real.
    if (!esImagen(req.file.buffer)) {
      return res.status(400).json({ message: MSG_TIPO });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: carpetaDe(req), resource_type: "image" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("Error al subir imagen:", error);
    res.status(500).json({ message: "Error al subir la imagen" });
  }
});

// DELETE /api/upload — elimina una imagen de Cloudinary por public_id.
// Sólo las de la carpeta del negocio: las imágenes son públicas y su
// public_id se ve en la URL, así que no alcanza con conocerlo.
router.delete("/", async (req, res) => {
  try {
    const { public_id } = req.body || {};
    if (!public_id || typeof public_id !== "string") {
      return res.status(400).json({ message: "Se requiere el public_id" });
    }
    if (!public_id.startsWith(`${carpetaDe(req)}/`) || public_id.includes("..")) {
      return res.status(403).json({ message: "Esa imagen no es de este negocio" });
    }

    await cloudinary.uploader.destroy(public_id);
    res.json({ message: "Imagen eliminada de Cloudinary" });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    res.status(500).json({ message: "Error al eliminar la imagen" });
  }
});

module.exports = router;
