require("dotenv").config();

const express = require("express");
const cors = require("cors");

const categoriasRoutes = require("./routes/categorias");
const productosRoutes = require("./routes/productos");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const usuariosRoutes = require("./routes/usuarios");
const authMiddleware = require("./middleware/authMiddleware");
const checkPermiso = require("./middleware/checkPermiso");

// Importar controllers directamente para rutas públicas
const {
  getProductosDisponibles,
} = require("./controllers/productosController");
const { getCategoriasActivas } = require("./controllers/categoriasController");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "🚀 API del Menú Digital funcionando" });
});

// ============================================
// RUTAS PÚBLICAS — llamadas directas al controller
// ============================================
app.use("/api/auth", authRoutes);
app.get("/api/categorias/activas", getCategoriasActivas);
app.get("/api/productos/disponibles", getProductosDisponibles);

// ============================================
// RUTAS PROTEGIDAS
// ============================================
app.use("/api/upload", authMiddleware, checkPermiso("productos"), uploadRoutes);
app.use(
  "/api/categorias",
  authMiddleware,
  checkPermiso("categorias"),
  categoriasRoutes,
);
app.use(
  "/api/productos",
  authMiddleware,
  checkPermiso("productos"),
  productosRoutes,
);
app.use("/api/usuarios", usuariosRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
