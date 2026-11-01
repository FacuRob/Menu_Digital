const crypto = require("crypto");
const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { estaConfigurado, normalizarTelefono } = require("../services/whatsappService");
const {
  AVISOS,
  obtenerConfig,
  guardarConfig,
  enviarPrueba,
  registrarEstadosMeta,
} = require("../services/avisosPedidoService");

// ── Panel: configuración de avisos ─────────────────────────────
// GET /api/whatsapp/avisos
const getAvisos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const cfg = await obtenerConfig(negocioId);
    res.json({
      conectado: estaConfigurado(),
      activo: cfg.activo,
      estados: cfg.estados,
      avisos: AVISOS.map(({ estado, plantilla, texto }) => ({ estado, plantilla, texto })),
    });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// PUT /api/whatsapp/avisos   { activo?: boolean, estados?: { [estado]: boolean } }
const updateAvisos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { activo, estados } = req.body || {};
    if (activo !== undefined && typeof activo !== "boolean") {
      return res.status(400).json({ message: "Valor inválido" });
    }
    if (estados !== undefined && (typeof estados !== "object" || Array.isArray(estados))) {
      return res.status(400).json({ message: "Valor inválido" });
    }
    const cfg = await guardarConfig(negocioId, { activo, estados });
    res.json(cfg);
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// GET /api/whatsapp/mensajes  → últimos mensajes enviados del negocio
const getMensajes = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("whatsapp_mensajes")
      .select("id, pedido_id, telefono, aviso, estado, error, created_at")
      .eq("negocio_id", negocioId)
      .order("created_at", { ascending: false })
      .limit(50);
    // Sin migración todavía → lista vacía en vez de error.
    if (error) return res.json([]);
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// POST /api/whatsapp/prueba  { telefono }
const postPrueba = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const telefono = String(req.body?.telefono || "").trim();
    if (!normalizarTelefono(telefono)) {
      return res.status(400).json({ message: "Ingresá un teléfono válido (con código de área)." });
    }
    const r = await enviarPrueba(negocioId, telefono);
    if (!r.ok) return res.status(502).json({ message: r.error || "No se pudo enviar" });
    res.json({ message: "Mensaje de prueba enviado" });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// ── Webhook de Meta (público) ──────────────────────────────────
//   WHATSAPP_VERIFY_TOKEN  texto que inventás y cargás también en Meta
//   WHATSAPP_APP_SECRET    "App secret" de la app de Meta (firma X-Hub-Signature-256)

// GET /api/webhooks/whatsapp → verificación inicial que hace Meta.
const verificarWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && esperado && token === esperado) {
    return res.status(200).send(String(challenge ?? ""));
  }
  return res.sendStatus(403);
};

const firmaValida = (raw, header) => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header || !String(header).startsWith("sha256=")) return false;
  try {
    const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(digest, "hex");
    const b = Buffer.from(String(header).slice(7), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

// POST /api/webhooks/whatsapp → estados de los mensajes (enviado/entregado/
// leído/fallido). Los mensajes entrantes se usarán en la Fase 2 (chats).
const recibirWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!firmaValida(raw, req.headers["x-hub-signature-256"])) {
    return res.sendStatus(401);
  }
  let payload;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }
  // Meta espera un 200 rápido; se procesa después de responder.
  res.sendStatus(200);
  const statuses = (payload?.entry || [])
    .flatMap((e) => e?.changes || [])
    .flatMap((c) => c?.value?.statuses || []);
  if (statuses.length) {
    registrarEstadosMeta(statuses).catch((e) =>
      console.error("[WhatsApp] webhook:", e.message),
    );
  }
};

module.exports = {
  getAvisos,
  updateAvisos,
  getMensajes,
  postPrueba,
  verificarWebhook,
  recibirWebhook,
};
