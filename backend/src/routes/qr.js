const express = require("express");
const router = express.Router();
const supabase = require("../config/database");
const { getNegocioId } = require("../utils/negocio");
const { respondError } = require("../utils/respondError");
const { firmarMesa } = require("../utils/mesaQr");

// Configuración de mesas del negocio. "*" para no fallar si la columna
// mesas_qr_version aún no existe (migración db/mesas_qr.sql).
const leerConfig = async (negocioId) => {
  const { data, error } = await supabase
    .from("configuracion")
    .select("*")
    .eq("negocio_id", negocioId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const firmas = (negocioId, cfg) => {
  const cantidad = cfg?.mesas_activo ? Math.min(500, Math.max(0, Number(cfg.mesas_cantidad) || 0)) : 0;
  const version = cfg?.mesas_qr_version ?? 1;
  return Array.from({ length: cantidad }, (_, i) => {
    const mesa = String(i + 1);
    return { mesa, t: firmarMesa(negocioId, mesa, version) };
  });
};

// GET /api/qr/mesas → firmas de las mesas del negocio, para armar los QR.
// Si el negocio no atiende en mesa, devuelve la lista vacía.
router.get("/mesas", async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    res.json({ mesas: firmas(negocioId, await leerConfig(negocioId)) });
  } catch (error) {
    return respondError(res, error, "qr");
  }
});

// POST /api/qr/regenerar → anula TODOS los QR de mesa impresos de este
// negocio (sube la versión de la firma) y devuelve las firmas nuevas.
router.post("/regenerar", async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const cfg = await leerConfig(negocioId);
    if (!cfg) return res.status(404).json({ message: "Primero guardá la configuración del menú." });
    if (cfg.mesas_qr_version === undefined) {
      return res
        .status(409)
        .json({ message: "Falta correr la migración backend/db/mesas_qr.sql en la base." });
    }
    const version = (Number(cfg.mesas_qr_version) || 1) + 1;
    const { error } = await supabase
      .from("configuracion")
      .update({ mesas_qr_version: version })
      .eq("negocio_id", negocioId);
    if (error) throw error;
    res.json({ mesas: firmas(negocioId, { ...cfg, mesas_qr_version: version }) });
  } catch (error) {
    return respondError(res, error, "qr");
  }
});

module.exports = router;
