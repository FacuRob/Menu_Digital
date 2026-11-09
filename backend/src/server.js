require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const categoriasRoutes = require("./routes/categorias");
const productosRoutes = require("./routes/productos");
const variantesRoutes = require("./routes/variantes");
const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const usuariosRoutes = require("./routes/usuarios");
const configuracionRoutes = require("./routes/configuracion");
const pedidosRoutes = require("./routes/pedidos");
const negociosRoutes = require("./routes/negocios");
const analiticasRoutes = require("./routes/analiticas");
const planRoutes = require("./routes/plan");
const plataformaRoutes = require("./routes/plataforma");
const suscripcionRoutes = require("./routes/suscripcion");
const soporteRoutes = require("./routes/soporte");
const authMiddleware = require("./middleware/authMiddleware");
const checkPermiso = require("./middleware/checkPermiso");
const scopeNegocio = require("./middleware/scopeNegocio");
const requirePlataforma = require("./middleware/requirePlataforma");
const requiereWhatsapp = require("./middleware/requiereWhatsapp");
const checkSuscripcion = require("./middleware/checkSuscripcion");
const { mercadoPagoWebhook } = require("./controllers/mercadoPagoController");
const whatsappRoutes = require("./routes/whatsapp");
const qrRoutes = require("./routes/qr");
const { avisarClaveMesas } = require("./utils/mesaQr");
const { respondError } = require("./utils/respondError");
const {
  verificarWebhook: verificarWebhookWhatsapp,
  recibirWebhook: recibirWebhookWhatsapp,
} = require("./controllers/whatsappController");

// Importar controllers directamente para rutas públicas
const {
  getProductosDisponibles,
} = require("./controllers/productosController");
const { getCategoriasActivas } = require("./controllers/categoriasController");
const { getConfiguracion } = require("./controllers/configuracionController");
const { createPedido, getTicketPublico } = require("./controllers/pedidosController");
const {
  getNegocioPublicoBySlug,
  getGrupoPublico,
} = require("./controllers/negociosController");
const { keepAlive } = require("./controllers/keepAliveController");
const { startKeepAlive } = require("./services/keepAlive");
const { pedidosLimiter, repartoLimiter } = require("./middleware/rateLimiters");
const reparto = require("./controllers/repartoController");
const { validate } = require("./middleware/validate");
const { createPedidoSchema } = require("./schemas");

const app = express();
const PORT = process.env.PORT || 5000;

// Detrás del proxy de Render/hosting: necesario para que el rate-limit y los
// logs vean la IP real del cliente (X-Forwarded-For) y no la del proxy.
app.set("trust proxy", 1);

// Cabeceras de seguridad (HSTS, noSniff, frameguard, etc.).
app.use(helmet());

// CORS con whitelist. Se configuran los orígenes permitidos vía la env
// ALLOWED_ORIGINS (lista separada por comas). Se agregan como fallback los
// orígenes de VITE_MENU_URL y ADMIN_URL si están definidos.
// Si no hay ninguno configurado, se permite todo (compatibilidad) — en
// producción DEBE definirse ALLOWED_ORIGINS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
[process.env.VITE_MENU_URL, process.env.ADMIN_URL].forEach((u) => {
  if (!u) return;
  try {
    allowedOrigins.push(new URL(u).origin);
  } catch {
    /* URL inválida en env: se ignora */
  }
});

const corsOptions = {
  origin(origin, cb) {
    // Permitir peticiones sin Origin (curl, apps móviles, healthchecks).
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error("Origen no permitido por CORS"));
  },
};

app.use(cors(corsOptions));

// ── Webhook Mercado Pago (suscripciones) ──
// La firma (x-signature) se calcula sobre data.id, no sobre el body.
app.post("/api/webhooks/mercadopago", express.json(), mercadoPagoWebhook);

// ── Webhook WhatsApp (Meta) — también con body CRUDO para la firma ──
app.get("/api/webhooks/whatsapp", verificarWebhookWhatsapp);
app.post(
  "/api/webhooks/whatsapp",
  express.raw({ type: "*/*" }),
  recibirWebhookWhatsapp,
);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // soporte de bodies form-urlencoded

app.get("/", (req, res) => {
  res.json({ message: "🚀 API del Menú Digital funcionando" });
});

// Liveness liviano (sin tocar la DB). Lo usa el self-ping del keep-alive para
// resetear el idle-timer de Render sin generar carga en Supabase.
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "menu-digital-backend", ts: new Date().toISOString() });
});

// ============================================
// RUTAS PÚBLICAS — llamadas directas al controller
// ============================================
app.use("/api/auth", authRoutes);
app.get("/api/keep-alive", keepAlive);
app.get("/api/categorias/activas", getCategoriasActivas);
app.get("/api/productos/disponibles", getProductosDisponibles);
app.get("/api/configuracion", getConfiguracion);
// Lectura del panel: misma data, pero con el negocio validado contra la cuenta
// (la ruta pública confía en X-Negocio-Id, que puede quedar viejo en el navegador).
app.get("/api/panel/configuracion", authMiddleware, scopeNegocio, getConfiguracion);
// Resolver el negocio del menú público por su slug (/menu/:slug).
app.get("/api/negocios/publico/:slug", getNegocioPublicoBySlug);
// Menú general: todos los negocios activos de la cuenta (/menu/:slug/todos).
app.get("/api/negocios/publico/:slug/grupo", getGrupoPublico);
app.post("/api/pedidos", pedidosLimiter, validate(createPedidoSchema), createPedido);
// Ticket de un pedido (link firmado que llega por WhatsApp).
app.get("/api/tickets/:id", getTicketPublico);
// Seguimiento del delivery (links firmados del repartidor y del cliente).
app.get("/api/reparto/:id", repartoLimiter, reparto.getReparto);
app.post("/api/reparto/:id/salir", repartoLimiter, reparto.salir);
app.post("/api/reparto/:id/ubicacion", repartoLimiter, reparto.ubicacion);
app.post("/api/reparto/:id/entregar", repartoLimiter, reparto.entregar);
app.get("/api/seguimiento/:id", repartoLimiter, reparto.getSeguimiento);

// ============================================
// RUTAS PROTEGIDAS
// ============================================
app.use(
  "/api/upload",
  authMiddleware,
  checkSuscripcion,
  checkPermiso("productos"),
  uploadRoutes,
);
app.use(
  "/api/categorias",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("categorias"),
  categoriasRoutes,
);
app.use(
  "/api/productos",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("productos"),
  productosRoutes,
);
app.use(
  "/api/variantes",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("productos"),
  variantesRoutes,
);
app.use("/api/usuarios", usuariosRoutes);
// /api/plan y /api/suscripcion NO llevan checkSuscripcion: el usuario vencido
// tiene que poder ver su estado y comprar un plan.
app.use("/api/plan", authMiddleware, scopeNegocio, planRoutes);
app.use("/api/suscripcion", authMiddleware, suscripcionRoutes);
app.use(
  "/api/configuracion",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("configuracion"),
  configuracionRoutes,
);
// Firmas de los QR por mesa (pantalla "Código QR" del panel).
app.use("/api/qr", authMiddleware, scopeNegocio, checkSuscripcion, checkPermiso("qr"), qrRoutes);
app.use(
  "/api/pedidos",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("pedidos"),
  pedidosRoutes,
);
app.use(
  "/api/negocios",
  authMiddleware,
  checkSuscripcion,
  checkPermiso("negocios"),
  negociosRoutes,
);
app.use(
  "/api/analiticas",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  checkPermiso("analiticas"),
  analiticasRoutes,
);

// Chats de WhatsApp con clientes (quien atiende pedidos). Va antes que
// /api/whatsapp para no pasar por el permiso de configuración.
app.use(
  "/api/whatsapp/chats",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  requiereWhatsapp,
  checkPermiso("pedidos"),
  whatsappRoutes.chatsRouter,
);

// Avisos de pedido por WhatsApp (configuración del negocio).
app.use(
  "/api/whatsapp",
  authMiddleware,
  scopeNegocio,
  checkSuscripcion,
  requiereWhatsapp,
  checkPermiso("configuracion"),
  whatsappRoutes,
);

// Panel de plataforma (dueño del SaaS). Sin scopeNegocio: es cross-cuenta.
app.use(
  "/api/plataforma",
  authMiddleware,
  requirePlataforma,
  plataformaRoutes,
);

// Soporte: todos los usuarios pueden reportar (sin permiso ni suscripción:
// alguien con el plan vencido tiene que poder avisar de un problema de pago).
app.use("/api/soporte", authMiddleware, soporteRoutes);

// Errores que no atrapó ninguna ruta (p. ej. JSON mal formado en el pedido
// público): respuesta corta, sin stack ni rutas de archivos.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ message: "El cuerpo de la solicitud no es un JSON válido." });
  }
  if (err?.status && err.status < 500) {
    return res.status(err.status).json({ message: "Solicitud inválida." });
  }
  return respondError(res, err, "express");
});

app.listen(PORT, () => {
  avisarClaveMesas();
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  // Keep-alive interno: mantiene despiertos Render y Supabase mientras el
  // proceso está vivo (ping a la DB + auto-llamada HTTP cada 14 min).
  startKeepAlive();
});
