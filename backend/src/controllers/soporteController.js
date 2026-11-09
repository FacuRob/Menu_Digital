const supabase = require("../config/database");
const cloudinary = require("../config/cloudinary");
const { respondError } = require("../utils/respondError");
const { getAuthScope } = require("../utils/cuenta");
const { sendSoporteAviso } = require("../services/emailService");

// ══════════════════════════════════════════════════════════════
// Soporte: los clientes reportan problemas (con capturas) y el usuario
// Tech (es_plataforma) los responde. El cliente sólo ve los tickets de su
// cuenta; Tech ve los de todas.
// ══════════════════════════════════════════════════════════════

const TIPOS = ["error", "pago", "duda", "sugerencia"];
const ESTADOS = ["abierto", "en_curso", "resuelto"];
const CARPETA = "menu-digital/soporte";

// Sólo se aceptan capturas subidas por /api/soporte/imagen (nada de links
// externos dentro del panel de Tech).
// Formato exacto de lo que devuelve Cloudinary; sin la variable, no acepta nada.
const esImagenNuestra = (url) => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !/^[\w-]+$/.test(cloud) || typeof url !== "string" || url.length > 500) return false;
  return new RegExp(
    `^https://res\\.cloudinary\\.com/${cloud}/image/upload/(v\\d+/)?${CARPETA}/[\\w-]+\\.(png|jpe?g|webp|gif)$`,
  ).test(url);
};

// Texto + imagen de un mensaje. Devuelve { error } si no sirve.
const leerMensaje = (body = {}) => {
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  const imagen = body.imagen_url || null;
  if (texto.length > 4000) return { error: "El mensaje es demasiado largo (máximo 4000 caracteres)." };
  if (imagen && !esImagenNuestra(imagen)) return { error: "La imagen no es válida. Volvé a adjuntarla." };
  if (!texto && !imagen) return { error: "Escribí un mensaje o adjuntá una captura." };
  return { texto: texto || null, imagen_url: imagen };
};

// Ticket si el usuario puede verlo; null si no existe o es de otra cuenta.
const ticketVisible = async (id, scope) => {
  if (!/^\d+$/.test(String(id))) return null;
  const { data, error } = await supabase
    .from("soporte_tickets")
    .select("*, cuentas(nombre, email), usuarios(nombre, username)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  if (!scope.esPlataforma && data.cuenta_id !== scope.cuentaId) return null;
  return data;
};

// Forma que ve el panel: "sin_leer" según de qué lado está quien mira.
const paraPanel = (t, esPlataforma) => ({
  id: t.id,
  cuenta_id: t.cuenta_id,
  cuenta_nombre: t.cuentas?.nombre || null,
  cuenta_email: esPlataforma ? t.cuentas?.email || null : undefined,
  autor: t.usuarios?.nombre || t.usuarios?.username || null,
  tipo: t.tipo,
  asunto: t.asunto,
  estado: t.estado,
  sin_leer: esPlataforma ? t.sin_leer_tech : t.sin_leer_cliente,
  ultimo_at: t.ultimo_at,
  created_at: t.created_at,
});

// GET /api/soporte?estado=abiertos|resueltos|todos
const listar = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    if (!scope.esPlataforma && !scope.cuentaId) return res.json({ tech: false, tickets: [] });
    let q = supabase
      .from("soporte_tickets")
      .select("*, cuentas(nombre, email), usuarios(nombre, username)")
      .order("ultimo_at", { ascending: false })
      .limit(200);
    if (!scope.esPlataforma) q = q.eq("cuenta_id", scope.cuentaId);
    if (req.query.estado === "abiertos") q = q.neq("estado", "resuelto");
    if (req.query.estado === "resueltos") q = q.eq("estado", "resuelto");
    const { data, error } = await q;
    if (error) throw error;
    res.json({ tech: scope.esPlataforma, tickets: (data || []).map((t) => paraPanel(t, scope.esPlataforma)) });
  } catch (error) {
    return respondError(res, error, "soporte.listar");
  }
};

// GET /api/soporte/resumen → cuántos tickets tienen novedades sin leer.
const resumen = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    if (!scope.esPlataforma && !scope.cuentaId) return res.json({ sin_leer: 0 });
    let q = supabase.from("soporte_tickets").select("id", { count: "exact", head: true });
    q = scope.esPlataforma
      ? q.eq("sin_leer_tech", true)
      : q.eq("cuenta_id", scope.cuentaId).eq("sin_leer_cliente", true);
    const { count, error } = await q;
    if (error) throw error;
    res.json({ sin_leer: count || 0 });
  } catch (error) {
    return respondError(res, error, "soporte.resumen");
  }
};

// POST /api/soporte  { tipo, asunto, texto, imagen_url }
const crear = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    if (!scope.cuentaId) return res.status(403).json({ message: "Tu usuario no tiene una cuenta asociada." });
    const tipo = req.body?.tipo;
    const asunto = typeof req.body?.asunto === "string" ? req.body.asunto.trim() : "";
    if (!TIPOS.includes(tipo)) return res.status(400).json({ message: "Elegí qué tipo de reporte es." });
    if (!asunto || asunto.length > 120) {
      return res.status(400).json({ message: "Poné un título corto (hasta 120 caracteres)." });
    }
    const msg = leerMensaje(req.body);
    if (msg.error) return res.status(400).json({ message: msg.error });

    const { data: ticket, error } = await supabase
      .from("soporte_tickets")
      .insert({ cuenta_id: scope.cuentaId, usuario_id: req.user.id, tipo, asunto })
      .select("*, cuentas(nombre, email), usuarios(nombre, username)")
      .single();
    if (error) throw error;

    const { error: errMsg } = await supabase.from("soporte_mensajes").insert({
      ticket_id: ticket.id,
      usuario_id: req.user.id,
      de_tech: false,
      texto: msg.texto,
      imagen_url: msg.imagen_url,
    });
    if (errMsg) {
      await supabase.from("soporte_tickets").delete().eq("id", ticket.id);
      throw errMsg;
    }

    avisarATech(ticket, msg.texto);
    res.status(201).json(paraPanel(ticket, scope.esPlataforma));
  } catch (error) {
    return respondError(res, error, "soporte.crear");
  }
};

// Email al dueño cuando entra un reporte nuevo (si SOPORTE_EMAIL está cargado).
// No frena la respuesta: si falla, sólo queda en el log.
const avisarATech = (ticket, texto) => {
  const to = process.env.SOPORTE_EMAIL;
  if (!to) return;
  const base = (process.env.ADMIN_URL || "").replace(/\/$/, "");
  sendSoporteAviso({
    to,
    cuenta: ticket.cuentas?.nombre || `Cuenta #${ticket.cuenta_id}`,
    tipo: ticket.tipo,
    asunto: ticket.asunto,
    texto: texto || "(sólo una captura)",
    url: base ? `${base}/admin/soporte?ticket=${ticket.id}` : null,
  }).catch((e) => console.error("[soporte] aviso por email:", e.message));
};

// GET /api/soporte/:id → ticket + mensajes. Marca como leído de ese lado.
const ver = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    const ticket = await ticketVisible(req.params.id, scope);
    if (!ticket) return res.status(404).json({ message: "No encontramos ese reporte." });

    const { data: mensajes, error } = await supabase
      .from("soporte_mensajes")
      .select("id, de_tech, texto, imagen_url, created_at, usuarios(nombre, username)")
      .eq("ticket_id", ticket.id)
      .order("id", { ascending: true });
    if (error) throw error;

    const campo = scope.esPlataforma ? "sin_leer_tech" : "sin_leer_cliente";
    // Sólo si no llegó nada nuevo mientras tanto (si no, se perdería el aviso).
    if (ticket[campo]) {
      const { error: errLeido } = await supabase
        .from("soporte_tickets")
        .update({ [campo]: false })
        .eq("id", ticket.id)
        .eq("ultimo_at", ticket.ultimo_at);
      if (errLeido) console.error("[soporte] marcar leído:", errLeido.message);
      else ticket[campo] = false;
    }

    res.json({
      tech: scope.esPlataforma,
      ticket: paraPanel(ticket, scope.esPlataforma),
      mensajes: (mensajes || []).map((m) => ({
        id: m.id,
        de_tech: m.de_tech,
        texto: m.texto,
        imagen_url: m.imagen_url,
        created_at: m.created_at,
        autor: m.de_tech ? "Soporte" : m.usuarios?.nombre || m.usuarios?.username || null,
      })),
    });
  } catch (error) {
    return respondError(res, error, "soporte.ver");
  }
};

// POST /api/soporte/:id/mensajes  { texto, imagen_url }
const responder = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    const ticket = await ticketVisible(req.params.id, scope);
    if (!ticket) return res.status(404).json({ message: "No encontramos ese reporte." });
    const msg = leerMensaje(req.body);
    if (msg.error) return res.status(400).json({ message: msg.error });

    const deTech = scope.esPlataforma;
    const { data: m, error } = await supabase
      .from("soporte_mensajes")
      .insert({ ticket_id: ticket.id, usuario_id: req.user.id, de_tech: deTech, texto: msg.texto, imagen_url: msg.imagen_url })
      .select("id, de_tech, texto, imagen_url, created_at, usuarios(nombre, username)")
      .single();
    if (error) throw error;
    const { usuarios: u, ...mensaje } = m;

    const { error: errT } = await supabase
      .from("soporte_tickets")
      .update({ ultimo_at: m.created_at, [deTech ? "sin_leer_cliente" : "sin_leer_tech"]: true })
      .eq("id", ticket.id);
    if (errT) throw errT;

    // Tech contesta → "en curso". El cliente escribe en uno resuelto → se reabre.
    // Sólo si nadie cambió el estado en el medio (no se pisa un "resuelto" recién puesto).
    let estado = ticket.estado;
    const siguiente =
      deTech && estado === "abierto" ? "en_curso" : !deTech && estado === "resuelto" ? "abierto" : null;
    if (siguiente) {
      const { data: cambio } = await supabase
        .from("soporte_tickets")
        .update({ estado: siguiente })
        .eq("id", ticket.id)
        .eq("estado", estado)
        .select("id");
      if (cambio?.length) estado = siguiente;
    }

    res.status(201).json({
      mensaje: { ...mensaje, autor: deTech ? "Soporte" : u?.nombre || u?.username || null },
      estado,
    });
  } catch (error) {
    return respondError(res, error, "soporte.responder");
  }
};

// PATCH /api/soporte/:id  { estado } — sólo Tech.
const cambiarEstado = async (req, res) => {
  try {
    const scope = await getAuthScope(req);
    if (!scope.esPlataforma) return res.status(403).json({ message: "Sólo el equipo de soporte cambia el estado." });
    const estado = req.body?.estado;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ message: "Estado inválido." });
    const ticket = await ticketVisible(req.params.id, scope);
    if (!ticket) return res.status(404).json({ message: "No encontramos ese reporte." });
    if (ticket.estado === estado) return res.json({ id: ticket.id, estado });
    const { error } = await supabase
      .from("soporte_tickets")
      .update({ estado, sin_leer_cliente: true })
      .eq("id", ticket.id);
    if (error) throw error;
    res.json({ id: ticket.id, estado });
  } catch (error) {
    return respondError(res, error, "soporte.estado");
  }
};

// POST /api/soporte/imagen (multipart, campo "imagen") → { url }
const subirImagen = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No se recibió ninguna imagen." });
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: CARPETA, resource_type: "image" }, (err, r) => (err ? reject(err) : resolve(r)))
        .end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    return respondError(res, error, "soporte.imagen");
  }
};

module.exports = { listar, resumen, crear, ver, responder, cambiarEstado, subirImagen, esImagenNuestra };
