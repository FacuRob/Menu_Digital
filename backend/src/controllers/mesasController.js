const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { mesaValida, normalizarMesa } = require("../utils/mesaQr");
const { normalizarPlano } = require("../utils/planoMesas");
const { registrar } = require("../utils/registroCambios");

// Gestión de mesas (gastronomía).
//
// Una mesa está OCUPADA si tiene fila en mesas_estado (se crea cuando el
// cliente escanea el QR de la mesa o pide) o, sin fila, si tiene pedidos en
// curso. Se libera al cerrarla desde el panel (con o sin ticket): sus pedidos
// en curso pasan a "entregado" y se borra la fila.

const EN_CURSO = ["pendiente", "preparando", "listo", "en_camino"];
const DIA_MS = 24 * 60 * 60 * 1000;

// Falta db/mesas_plano.sql: la tabla o la columna no existen todavía.
const faltaMigracion = (error) =>
  !!error && (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code) || /mesas_(estado|plano)/.test(error.message || ""));

const leerConfig = async (negocioId) => {
  const { data, error } = await supabase.from("configuracion").select("*").eq("negocio_id", negocioId).maybeSingle();
  if (error) throw error;
  return data;
};

const sinCosto = (items) => (items || []).map(({ costo_unit, ...it }) => it);

// Junta las filas de mesas_estado con los pedidos de mesa recientes.
// Devuelve sólo las mesas ocupadas.
const armarOcupadas = (filas, pedidos) => {
  const porMesa = new Map();
  for (const p of pedidos) {
    const m = String(p.mesa);
    if (!porMesa.has(m)) porMesa.set(m, []);
    porMesa.get(m).push(p);
  }
  const ocupadas = new Map();
  for (const f of filas) {
    const desde = Date.parse(f.ocupada_desde);
    const lista = (porMesa.get(String(f.mesa)) || []).filter((p) => Date.parse(p.created_at) >= desde);
    ocupadas.set(String(f.mesa), { mesa: String(f.mesa), ocupada_desde: f.ocupada_desde, pedidos: lista });
  }
  // Sin fila (mesa ocupada antes de la migración, o el aviso del QR falló):
  // cuenta si tiene pedidos en curso.
  for (const [m, lista] of porMesa) {
    if (ocupadas.has(m)) continue;
    const abiertos = lista.filter((p) => EN_CURSO.includes(p.estado));
    if (!abiertos.length) continue;
    const desde = abiertos.reduce((a, p) => (p.created_at < a ? p.created_at : a), abiertos[0].created_at);
    ocupadas.set(m, { mesa: m, ocupada_desde: desde, pedidos: lista.filter((p) => p.created_at >= desde) });
  }
  return [...ocupadas.values()].map((o) => {
    const pedidos = o.pedidos.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return {
      ...o,
      pedidos,
      en_curso: pedidos.filter((p) => EN_CURSO.includes(p.estado)).length,
      total: pedidos.reduce((a, p) => a + Number(p.total || 0) + Number(p.costo_envio || 0), 0),
    };
  });
};

// ── GET /api/mesas → configuración, plano y mesas ocupadas ──
const getMesas = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const cfg = await leerConfig(negocioId);
    const activo = !!cfg?.mesas_activo;
    const cantidad = activo ? Math.min(500, Math.max(0, Number(cfg.mesas_cantidad) || 0)) : 0;

    let filas = [];
    let migracion = true;
    const est = await supabase.from("mesas_estado").select("mesa, ocupada_desde").eq("negocio_id", negocioId);
    if (est.error) {
      if (!faltaMigracion(est.error)) throw est.error;
      migracion = false;
    } else filas = est.data || [];

    // Pedidos de mesa desde el día anterior (o desde la mesa ocupada más vieja).
    let desde = Date.now() - DIA_MS;
    for (const f of filas) desde = Math.min(desde, Date.parse(f.ocupada_desde) || desde);
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("*, pedido_items(*)")
      .eq("negocio_id", negocioId)
      .not("mesa", "is", null)
      .neq("estado", "cancelado")
      .gte("created_at", new Date(desde).toISOString())
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) throw error;

    const lista = (pedidos || []).map(({ pedido_items, ...p }) => ({ ...p, items: sinCosto(pedido_items) }));
    res.json({
      activo,
      cantidad,
      plano: cfg?.mesas_plano ?? null,
      migracion,
      ocupadas: armarOcupadas(filas, lista),
    });
  } catch (error) {
    return respondError(res, error, "mesas");
  }
};

// ── PUT /api/mesas/plano { plano } → guarda el dibujo (plano: null lo borra) ──
// Sólo el dueño (SuperAdmin). Si el plano tiene mesas con número más alto que
// las configuradas, sube la cantidad de mesas (los QR existentes no cambian).
const guardarPlano = async (req, res) => {
  try {
    if (req.user?.rol !== "admin") {
      return res.status(403).json({ message: "Sólo el dueño de la cuenta puede dibujar el local." });
    }
    const negocioId = getNegocioId(req);
    const cfg = await leerConfig(negocioId);
    if (!cfg) return res.status(404).json({ message: "Primero guardá la configuración del local." });

    let patch;
    if (req.body?.plano === null) {
      patch = { mesas_plano: null };
    } else {
      const { plano, mayorMesa, error: invalido } = normalizarPlano(req.body?.plano);
      if (invalido) return res.status(400).json({ message: invalido });
      patch = { mesas_plano: plano };
      if (mayorMesa > (Number(cfg.mesas_cantidad) || 0)) patch.mesas_cantidad = mayorMesa;
      if (mayorMesa > 0 && !cfg.mesas_activo) patch.mesas_activo = true;
    }

    const { error } = await supabase
      .from("configuracion")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("negocio_id", negocioId);
    if (faltaMigracion(error)) {
      return res.status(503).json({ message: "Falta activar el plano de mesas en la base (db/mesas_plano.sql)." });
    }
    if (error) throw error;
    registrar(req, "mesas_plano", "negocio", negocioId, patch.mesas_plano ? { pisos: patch.mesas_plano.pisos.length } : { borrado: true });
    res.json({
      plano: patch.mesas_plano,
      activo: patch.mesas_activo ?? !!cfg.mesas_activo,
      cantidad: patch.mesas_cantidad ?? Number(cfg.mesas_cantidad || 0),
    });
  } catch (error) {
    return respondError(res, error, "mesas");
  }
};

// ── POST /api/mesas/:mesa/liberar → cierra la mesa ──
// Los pedidos en curso de la mesa pasan a "entregado" (cuentan en el
// Dashboard) y la mesa queda libre.
const liberarMesa = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const mesa = normalizarMesa(req.params.mesa);
    if (!mesa) return res.status(400).json({ message: "Mesa inválida" });

    const ahora = new Date().toISOString();
    const { data: cerrados, error } = await supabase
      .from("pedidos")
      .update({ estado: "entregado", entregado_at: ahora, updated_at: ahora })
      .eq("negocio_id", negocioId)
      .eq("mesa", mesa)
      .in("estado", EN_CURSO)
      .select("id");
    if (error) throw error;

    const del = await supabase.from("mesas_estado").delete().eq("negocio_id", negocioId).eq("mesa", mesa);
    if (del.error && !faltaMigracion(del.error)) throw del.error;

    res.json({ ok: true, pedidos_cerrados: (cerrados || []).length });
  } catch (error) {
    return respondError(res, error, "mesas");
  }
};

// ── POST /api/mesas/ocupar { mesa, t } (público) ──
// El menú lo llama al abrirse con el QR firmado de una mesa.
const ocuparMesa = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const mesa = normalizarMesa(req.body?.mesa);
    const cfg = await leerConfig(negocioId);
    const n = Number(mesa);
    const existe = !!cfg?.mesas_activo && Number.isInteger(n) && n >= 1 && n <= Number(cfg.mesas_cantidad || 0);
    if (!existe || !mesaValida(negocioId, mesa, req.body?.t, cfg.mesas_qr_version ?? 1)) {
      return res.status(400).json({ message: "QR de mesa inválido." });
    }
    await marcarOcupada(negocioId, mesa);
    res.status(204).end();
  } catch (error) {
    return respondError(res, error, "mesas");
  }
};

// Marca la mesa ocupada si no lo estaba (no pisa la hora original).
// Nunca tira: si falta la migración o falla, el pedido sigue igual.
const marcarOcupada = async (negocioId, mesa, desde) => {
  const fila = { negocio_id: negocioId, mesa: String(mesa), ...(desde ? { ocupada_desde: desde } : {}) };
  const { error } = await supabase
    .from("mesas_estado")
    .upsert(fila, { onConflict: "negocio_id,mesa", ignoreDuplicates: true });
  if (error && !faltaMigracion(error)) console.error("[Mesas] no se pudo marcar ocupada:", error.message);
};

module.exports = { getMesas, guardarPlano, liberarMesa, ocuparMesa, marcarOcupada, armarOcupadas };
