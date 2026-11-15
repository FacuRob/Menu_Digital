const crypto = require("crypto");
const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { estaConfigurado, normalizarTelefono } = require("../services/whatsappService");
const { modulosNegocio } = require("../middleware/requiereModulo");
const {
  avisosDelNegocio,
  obtenerConfig,
  guardarConfig,
  enviarPrueba,
  registrarEstadosMeta,
} = require("../services/avisosPedidoService");
const chats = require("../services/chatsService");
const cuentas = require("../services/whatsappCuentas");
const ia = require("../services/iaService");

// ── Panel: configuración de avisos ─────────────────────────────
// GET /api/whatsapp/avisos
const getAvisos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const cfg = await obtenerConfig(negocioId);
    const propia = await cuentas.cuentaDeNegocio(negocioId);
    res.json({
      conectado: await estaConfigurado(negocioId),
      numero_propio: !!propia,
      activo: cfg.activo,
      estados: cfg.estados,
      // Sólo los que corresponden a sus módulos (pedidos siempre).
      avisos: avisosDelNegocio(await modulosNegocio(negocioId)).map(({ estado, plantilla, texto, ejemplos }) => ({ estado, plantilla, texto, ejemplos })),
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
      .eq("direccion", "saliente")
      .not("aviso", "is", null)
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
    const r = await enviarPrueba(negocioId, telefono, await modulosNegocio(negocioId));
    if (!r.ok) return res.status(502).json({ message: r.error || "No se pudo enviar" });
    res.json({ message: "Mensaje de prueba enviado" });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// ── Panel: número propio del local ─────────────────────────────
// GET /api/whatsapp/cuenta
const getCuenta = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const c = await cuentas.cuentaDeNegocio(negocioId);
    const avisos = avisosDelNegocio(await modulosNegocio(negocioId));
    let plantillas = null;
    if (c) {
      plantillas = await cuentas
        .estadoPlantillas(c)
        .then((todas) => {
          const nuestras = new Map(todas.filter((t) => t.idioma === "es_AR").map((t) => [t.nombre, t.estado]));
          return avisos.map((a) => ({ nombre: a.plantilla, estado: nuestras.get(a.plantilla) || "FALTA" }));
        })
        .catch((e) => {
          console.error("[WhatsApp] No se pudieron leer las plantillas:", e.message);
          return null;
        });
    }
    res.json({
      cuenta: cuentas.publica(c),
      plantillas,
      alta: cuentas.configAlta(),
      plataforma: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// POST /api/whatsapp/cuenta  { code, waba_id, phone_number_id, coexistencia }
const postCuenta = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const r = await cuentas.conectar(negocioId, req.body || {}, avisosDelNegocio(await modulosNegocio(negocioId)));
    res.json(r);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("[WhatsApp] Error al conectar el número:", error.message);
    return res.status(502).json({ message: `Meta respondió: ${error.message}` });
  }
};

// POST /api/whatsapp/cuenta/plantillas → vuelve a crear las que falten
const postPlantillas = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const c = await cuentas.cuentaDeNegocio(negocioId);
    if (!c) return res.status(404).json({ message: "No hay un número conectado." });
    res.json({ plantillas: await cuentas.crearPlantillas(c, avisosDelNegocio(await modulosNegocio(negocioId))) });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// DELETE /api/whatsapp/cuenta → deja de usar el número propio
const deleteCuenta = async (req, res) => {
  try {
    await cuentas.desconectar(getNegocioId(req));
    res.json({ ok: true });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// ── Panel: chats (Fase 2) ──────────────────────────────────────
// GET /api/whatsapp/chats
const getChats = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const [lista, cfgIA] = await Promise.all([chats.listarChats(negocioId), ia.obtenerConfigIA(negocioId)]);
    res.json({ conectado: await estaConfigurado(negocioId), ia_activa: ia.iaConfigurada() && cfgIA.activo, chats: lista });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// GET /api/whatsapp/chats/resumen → { no_leidos, atender } (aviso del menú)
const getResumenChats = async (req, res) => {
  try {
    res.json(await chats.resumenChats(getNegocioId(req)));
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// GET /api/whatsapp/chats/:id/mensajes
const getMensajesChat = async (req, res) => {
  try {
    const r = await chats.mensajesDelChat(getNegocioId(req), req.params.id, {
      marcarLeido: req.user?.solo_lectura !== true,
    });
    if (!r) return res.status(404).json({ message: "Chat no encontrado." });
    res.json(r);
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// POST /api/whatsapp/chats/:id/mensajes  { texto }
const postMensajeChat = async (req, res) => {
  try {
    const r = await chats.responder(getNegocioId(req), req.params.id, req.body?.texto);
    if (!r.ok) return res.status(r.status || 500).json({ message: r.error, mensaje: r.mensaje || null });
    res.status(201).json(r.mensaje);
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// PATCH /api/whatsapp/chats/:id/ia  { activa: boolean } → pausa/reactiva la IA en un chat
const patchIAChat = async (req, res) => {
  try {
    if (typeof req.body?.activa !== "boolean") return res.status(400).json({ message: "Valor inválido" });
    const chat = await chats.cambiarIAChat(getNegocioId(req), req.params.id, req.body.activa);
    if (!chat) return res.status(404).json({ message: "Chat no encontrado." });
    res.json(chat);
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// ── Panel: asistente con IA (Fase 3) ───────────────────────────
// GET /api/whatsapp/ia
const getIA = async (req, res) => {
  try {
    const cfg = await ia.obtenerConfigIA(getNegocioId(req));
    res.json({ configurada: ia.iaConfigurada(), ...cfg });
  } catch (error) {
    return respondError(res, error, "whatsapp");
  }
};

// PUT /api/whatsapp/ia  { activo?: boolean, instrucciones?: string }
const updateIA = async (req, res) => {
  try {
    const { activo, instrucciones } = req.body || {};
    if (activo !== undefined && typeof activo !== "boolean") return res.status(400).json({ message: "Valor inválido" });
    if (instrucciones !== undefined && typeof instrucciones !== "string") {
      return res.status(400).json({ message: "Valor inválido" });
    }
    res.json(await ia.guardarConfigIA(getNegocioId(req), { activo, instrucciones }));
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
  const secret = (process.env.WHATSAPP_APP_SECRET || "").trim();
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
// leído/fallido) y mensajes que escriben los clientes (chats).
const recibirWebhook = async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  if (!firmaValida(raw, req.headers["x-hub-signature-256"])) {
    // Visible en los logs: casi siempre es WHATSAPP_APP_SECRET mal copiado.
    console.warn(
      process.env.WHATSAPP_APP_SECRET
        ? "[WhatsApp] webhook rechazado: la firma no coincide (revisar WHATSAPP_APP_SECRET)"
        : "[WhatsApp] webhook rechazado: falta WHATSAPP_APP_SECRET",
    );
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
  const cambios = (payload?.entry || []).flatMap((e) => e?.changes || []).filter((c) => c?.value);
  const values = cambios.map((c) => c.value);
  for (const { field, value: v } of cambios) {
    // El local quitó el acceso desde Meta o desde la app.
    if (field === "account_update" && ["PARTNER_REMOVED", "ACCOUNT_OFFBOARDED"].includes(v.event)) {
      cuentas.marcarDesconectadaPorWaba(v.waba_info?.waba_id).catch(() => {});
      continue;
    }
    // ¿Llegó al número propio de un local? Entonces el mensaje es de ese local.
    const phoneId = v.metadata?.phone_number_id;
    const propia = await cuentas.cuentaDePhoneId(phoneId);
    // Llegó a un número que no es el de la plataforma ni de un local conectado
    // (p. ej. uno que se desconectó): no se adivina el local, se descarta.
    const dePlataforma = !phoneId || String(phoneId) === String(process.env.WHATSAPP_PHONE_NUMBER_ID || "");
    if (!propia && !dePlataforma && (v.messages?.length || field === "smb_message_echoes")) {
      console.warn(`[WhatsApp] Mensaje a un número sin local conectado (${phoneId}): se descarta.`);
      continue;
    }
    if (field === "smb_message_echoes") {
      if (propia) chats.registrarEcos(v, propia.negocio_id).catch((e) => console.error("[WhatsApp] ecos:", e.message));
      continue;
    }
    if (v.messages?.length) {
      chats
        .registrarEntrantes(v, { negocioId: propia?.negocio_id })
        // Fase 3: la IA responde (si el negocio la activó y el chat no está pausado).
        .then((guardados) => guardados.forEach((g) => ia.programarRespuesta(g.chat.id)))
        .catch((e) => console.error("[WhatsApp] entrantes:", e.message));
    }
  }
  const statuses = values.flatMap((v) => v.statuses || []);
  const entrantes = values.reduce((n, v) => n + (v.messages?.length || 0), 0);
  console.log(`[WhatsApp] webhook OK: ${entrantes} mensaje(s), ${statuses.length} estado(s)`);
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
  getChats,
  getMensajesChat,
  getResumenChats,
  postMensajeChat,
  patchIAChat,
  getIA,
  updateIA,
  verificarWebhook,
  recibirWebhook,
  getCuenta,
  postCuenta,
  postPlantillas,
  deleteCuenta,
};
