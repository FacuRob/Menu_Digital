require("dotenv").config();

const express = require("express");
const cors = require("cors");

const categoriasRoutes = require("./routes/categorias");
const productosRoutes = require("./routes/productos");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const usuariosRoutes = require("./routes/usuarios");
const configuracionRoutes = require("./routes/configuracion");
const pedidosRoutes = require("./routes/pedidos");
const negociosRoutes = require("./routes/negocios");
const analiticasRoutes = require("./routes/analiticas");
const planRoutes = require("./routes/plan");
const hotmartRoutes = require("./routes/hotmart");
const plataformaRoutes = require("./routes/plataforma");
const authMiddleware = require("./middleware/authMiddleware");
const checkPermiso = require("./middleware/checkPermiso");
const scopeNegocio = require("./middleware/scopeNegocio");
const requirePlataforma = require("./middleware/requirePlataforma");

// Importar controllers directamente para rutas públicas
const {
  getProductosDisponibles,
} = require("./controllers/productosController");
const { getCategoriasActivas } = require("./controllers/categoriasController");
const { getConfiguracion } = require("./controllers/configuracionController");
const { createPedido } = require("./controllers/pedidosController");
const { keepAlive } = require("./controllers/keepAliveController");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // webhooks Hotmart 1.x (form)

app.get("/", (req, res) => {
  res.json({ message: "🚀 API del Menú Digital funcionando" });
});

// ============================================
// RUTAS PÚBLICAS — llamadas directas al controller
// ============================================
app.use("/api/auth", authRoutes);
app.get("/api/keep-alive", keepAlive);
app.get("/api/categorias/activas", getCategoriasActivas);
app.get("/api/productos/disponibles", getProductosDisponibles);
app.get("/api/configuracion", getConfiguracion);
app.post("/api/pedidos", createPedido);
app.use("/api/webhooks/hotmart", hotmartRoutes);

// ============================================
// RUTAS PROTEGIDAS
// ============================================
app.use("/api/upload", authMiddleware, checkPermiso("productos"), uploadRoutes);
app.use(
  "/api/categorias",
  authMiddleware,
  scopeNegocio,
  checkPermiso("categorias"),
  categoriasRoutes,
);
app.use(
  "/api/productos",
  authMiddleware,
  scopeNegocio,
  checkPermiso("productos"),
  productosRoutes,
);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/plan", authMiddleware, scopeNegocio, planRoutes);
app.use(
  "/api/configuracion",
  authMiddleware,
  scopeNegocio,
  checkPermiso("configuracion"),
  configuracionRoutes,
);
app.use(
  "/api/pedidos",
  authMiddleware,
  scopeNegocio,
  checkPermiso("pedidos"),
  pedidosRoutes,
);
app.use(
  "/api/negocios",
  authMiddleware,
  checkPermiso("negocios"),
  negociosRoutes,
);
app.use(
  "/api/analiticas",
  authMiddleware,
  scopeNegocio,
  checkPermiso("analiticas"),
  analiticasRoutes,
);

// Panel de plataforma (dueño del SaaS). Sin scopeNegocio: es cross-cuenta.
app.use(
  "/api/plataforma",
  authMiddleware,
  requirePlataforma,
  plataformaRoutes,
);

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
