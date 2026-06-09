// dotenv PRIMERO, antes de cualquier otro require
require("dotenv").config();

const express = require("express");
const cors = require("cors");

// Importar rutas
const categoriasRoutes = require("./routes/categorias");
const productosRoutes = require("./routes/productos");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const usuariosRoutes = require("./routes/usuarios");
const authMiddleware = require("./middleware/authMiddleware");
const checkPermiso = require("./middleware/checkPermiso");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.json({ message: "🚀 API del Menú Digital funcionando" });
});

// ============================================
// RUTAS PÚBLICAS (sin autenticación)
// ============================================
app.use("/api/auth", authRoutes);
app.use("/api/categorias/activas", categoriasRoutes);
app.use("/api/productos/disponibles", productosRoutes);

// ============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ============================================

// Upload — cualquier usuario autenticado con permiso de editor+
app.use("/api/upload", authMiddleware, checkPermiso("productos"), uploadRoutes);

// Categorías — requiere permiso 'categorias'
app.use(
  "/api/categorias",
  authMiddleware,
  checkPermiso("categorias"),
  categoriasRoutes,
);

// Productos — requiere permiso 'productos'
app.use(
  "/api/productos",
  authMiddleware,
  checkPermiso("productos"),
  productosRoutes,
);

// Usuarios — solo superadmin (manejado dentro de la ruta)
app.use("/api/usuarios", usuariosRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
