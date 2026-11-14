const crypto = require("crypto");
const path = require("path");
const supabase = require("../config/database");
const cloudinary = require("../config/cloudinary");
const { respondError } = require("../utils/respondError");
const { esImagen } = require("../utils/imagen");
const { modulosNegocio } = require("../middleware/requiereModulo");

// ══════════════════════════════════════════════════════════════
// Adjuntos que sube el cliente (personalización; después presupuestos).
// - Se valida el contenido real, no la extensión ni el tipo declarado.
// - Se guardan en Cloudinary como "authenticated": no hay URL pública. El
//   panel pide un link firmado que vence a los pocos minutos.
// - Se reclaman con un token de un solo uso al crear el pedido.
// ══════════════════════════════════════════════════════════════

const MAX_MB = 10;
// Archivos sin usar por negocio en 24 h (frena a quien quiera llenar el
// almacenamiento de un negocio subiendo cosas que nunca pide).
const MAX_SIN_USAR = 50;
const EXT_3D = ["stl", "obj", "3mf"];

// imagen | pdf | 3d, o null si no se acepta.
function tipoDeArchivo(buf, nombre) {
  if (!Buffer.isBuffer(buf) || buf.length < 8) return null;
  if (esImagen(buf)) return "imagen";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  const ext = path.extname(nombre || "").slice(1).toLowerCase();
  if (!EXT_3D.includes(ext)) return null;
  // 3MF es un ZIP; STL y OBJ no tienen firma fija: alcanza con la extensión
  // (se guardan como archivo privado y nunca se ejecutan ni se muestran).
  if (ext === "3mf") return buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ? "3d" : null;
  return "3d";
}

// Nombre para mostrar: sin rutas ni caracteres de control, acotado.
const limpiarNombre = (n) =>
  path
    .basename(String(n || "archivo"))
    .replace(/[\u0000-\u001f\u007f<>"]/g, "")
    .slice(0, 160) || "archivo";

// Negocio del menú público: tiene que venir explícito (sin caer al 1).
const negocioPublico = (req) => {
  const n = parseInt(req.query?.negocio ?? req.headers?.["x-negocio-id"], 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// POST /api/adjuntos?negocio=<id> (público, multipart "archivo")
const subirAdjunto = async (req, res) => {
  try {
    const negocioId = negocioPublico(req);
    if (!negocioId) return res.status(400).json({ message: "Falta el negocio." });
    if (!req.file) return res.status(400).json({ message: "No se recibió ningún archivo." });

    const { data: neg, error: negErr } = await supabase
      .from("negocios")
      .select("id, activo")
      .eq("id", negocioId)
      .maybeSingle();
    if (negErr) throw negErr;
    if (!neg || neg.activo === false) return res.status(404).json({ message: "Negocio no encontrado." });
    if (!(await modulosNegocio(negocioId)).personalizados) {
      return res.status(403).json({ error: "MODULO_INACTIVO", message: "Este negocio no recibe archivos." });
    }

    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: cErr } = await supabase
      .from("adjuntos")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId)
      .eq("usado", false)
      .gte("created_at", desde);
    if (cErr) throw cErr;
    if ((count || 0) >= MAX_SIN_USAR) {
      return res.status(429).json({ message: "Este negocio recibió muchos archivos. Probá de nuevo más tarde." });
    }

    const nombre = limpiarNombre(req.file.originalname);
    const tipo = tipoDeArchivo(req.file.buffer, nombre);
    if (!tipo) {
      return res.status(400).json({ message: "Ese tipo de archivo no se acepta (imágenes, PDF, STL, OBJ o 3MF)." });
    }

    const resourceType = tipo === "imagen" ? "image" : "raw";
    // La extensión sale del tipo detectado, nunca del nombre que manda el
    // cliente (un PDF llamado "x.html" se guarda como .pdf).
    const ext = tipo === "pdf" ? "pdf" : tipo === "3d" ? path.extname(nombre).slice(1).toLowerCase() : "";
    const subido = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `menu-digital/adjuntos/${negocioId}`,
            resource_type: resourceType,
            type: "authenticated",
            // En "raw" la extensión va en el public_id (si no, se pierde).
            ...(resourceType === "raw" ? { public_id: `${crypto.randomUUID()}.${ext || "bin"}` } : {}),
          },
          (err, r) => (err ? reject(err) : resolve(r)),
        )
        .end(req.file.buffer);
    });

    const token = crypto.randomBytes(24).toString("hex");
    const { error } = await supabase.from("adjuntos").insert([
      {
        negocio_id: negocioId,
        token,
        public_id: subido.public_id,
        resource_type: resourceType,
        formato: subido.format || ext || null,
        tipo,
        nombre,
        bytes: req.file.size,
      },
    ]);
    if (error) {
      // Sin la fila nadie lo puede reclamar: se borra el archivo subido.
      cloudinary.uploader
        .destroy(subido.public_id, { resource_type: resourceType, type: "authenticated" })
        .catch(() => {});
      throw error;
    }
    res.status(201).json({ token, nombre, tipo });
  } catch (error) {
    return respondError(res, error, "adjuntos.subir");
  }
};

// GET /api/adjuntos/:id (panel) → { url, nombre } con un link que vence.
const verAdjunto = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Adjunto inválido." });
    const { data: adj, error } = await supabase
      .from("adjuntos")
      .select("*")
      .eq("id", id)
      .eq("negocio_id", req.negocioId)
      .maybeSingle();
    if (error) throw error;
    if (!adj) return res.status(404).json({ message: "Adjunto no encontrado." });

    const url = cloudinary.utils.private_download_url(
      adj.public_id,
      adj.resource_type === "raw" ? "" : adj.formato || "",
      {
        resource_type: adj.resource_type,
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 10 * 60,
        attachment: adj.tipo !== "imagen",
      },
    );
    res.json({ url, nombre: adj.nombre, tipo: adj.tipo });
  } catch (error) {
    return respondError(res, error, "adjuntos.ver");
  }
};

module.exports = { subirAdjunto, verAdjunto, tipoDeArchivo, MAX_MB };
