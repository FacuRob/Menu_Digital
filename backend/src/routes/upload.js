const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const authMiddleware = require("../middleware/authMiddleware");

// Multer en memoria (no guarda en disco)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB máximo
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes (jpg, png, webp, gif)"));
    }
  },
});

// POST /api/upload — sube imagen y devuelve la URL de Cloudinary
router.post("/", authMiddleware, upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ningún archivo" });
    }

    // Subir desde buffer a Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "menu-digital/productos",
          resource_type: "image",
          // Sin transformation para que quede a tamaño original
          // Cloudinary auto-optimiza si se configura en el dashboard
        },
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
    res
      .status(500)
      .json({ message: "Error al subir la imagen", error: error.message });
  }
});

// DELETE /api/upload — elimina una imagen de Cloudinary por public_id
router.delete("/", authMiddleware, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) {
      return res.status(400).json({ message: "Se requiere el public_id" });
    }

    await cloudinary.uploader.destroy(public_id);
    res.json({ message: "Imagen eliminada de Cloudinary" });
  } catch (error) {
    console.error("Error al eliminar imagen:", error);
    res
      .status(500)
      .json({ message: "Error al eliminar la imagen", error: error.message });
  }
});

module.exports = router;
