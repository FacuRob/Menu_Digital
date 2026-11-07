const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");

const MESES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// Resumen de ventas/ganancia del negocio (solo pedidos entregados).
const getResumen = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);

    // Pedidos entregados con sus items.
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("id, created_at, entregado_at, estado, pedido_items(cantidad, precio_unit, costo_unit, nombre, subtotal)")
      .eq("negocio_id", negocioId)
      .eq("estado", "entregado");

    if (error) throw error;

    // Buckets de los últimos 6 meses.
    const now = new Date();
    const meses = [];
    const idx = {};
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = {
        key,
        label: MESES_ABBR[d.getMonth()],
        ventas: 0,
        costo: 0,
        ganancia: 0,
        pedidos: 0,
      };
      meses.push(bucket);
      idx[key] = bucket;
    }

    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const topMap = {}; // nombre -> { ganancia, cantidad }

    for (const p of pedidos || []) {
      // Contar la venta en el mes en que se entregó. Fallback a created_at
      // para pedidos entregados antes de existir la columna entregado_at.
      const d = new Date(p.entregado_at || p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const bucket = idx[key];

      let pedidoVentas = 0;
      let pedidoCosto = 0;
      for (const it of p.pedido_items || []) {
        const ventas = Number(it.subtotal) || Number(it.precio_unit) * it.cantidad || 0;
        const costo = Number(it.costo_unit) * it.cantidad || 0;
        pedidoVentas += ventas;
        pedidoCosto += costo;

        // Top del mes actual.
        if (key === currentKey) {
          const nombre = it.nombre || "Producto";
          const t = (topMap[nombre] = topMap[nombre] || { ganancia: 0, cantidad: 0 });
          t.ganancia += ventas - costo;
          t.cantidad += it.cantidad;
        }
      }

      if (bucket) {
        bucket.ventas += pedidoVentas;
        bucket.costo += pedidoCosto;
        bucket.ganancia += pedidoVentas - pedidoCosto;
        bucket.pedidos += 1;
      }
    }

    // Redondear.
    for (const b of meses) {
      b.ventas = +b.ventas.toFixed(2);
      b.costo = +b.costo.toFixed(2);
      b.ganancia = +b.ganancia.toFixed(2);
    }

    const mesActual = idx[currentKey] || { ventas: 0, costo: 0, ganancia: 0, pedidos: 0 };

    const topProductos = Object.entries(topMap)
      .map(([nombre, v]) => ({ nombre, ganancia: +v.ganancia.toFixed(2), cantidad: v.cantidad }))
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 5);

    // Productos con stock bajo (controlan stock y stock <= 5).
    const { data: stockBajo } = await supabase
      .from("productos")
      .select("id, nombre, stock")
      .eq("negocio_id", negocioId)
      .eq("controlar_stock", true)
      .lte("stock", 5)
      .order("stock", { ascending: true });

    res.json({
      meses,
      mes_actual: {
        ventas: +mesActual.ventas.toFixed(2),
        costo: +mesActual.costo.toFixed(2),
        ganancia: +mesActual.ganancia.toFixed(2),
        pedidos: mesActual.pedidos,
      },
      top_productos: topProductos,
      stock_bajo: stockBajo || [],
    });
  } catch (error) {
    return respondError(res, error, "analiticas");
  }
};

// ── Historial mensual de ventas / costo / ganancia ──
// GET /analiticas/historial?desde=YYYY-MM&hasta=YYYY-MM&tipo=mesa|retiro|delivery
// Devuelve un bucket por cada mes del rango (incluidos los meses sin ventas),
// los totales del período y los productos más rentables del período.
const MES_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const MAX_MESES = 60;
const PAGINA = 1000;

const keyDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const getHistorial = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const now = new Date();

    // Rango por defecto: últimos 12 meses (incluye el actual).
    const defHasta = keyDe(now);
    const defDesde = keyDe(new Date(now.getFullYear(), now.getMonth() - 11, 1));
    let desde = MES_RE.test(req.query.desde || "") ? req.query.desde : defDesde;
    let hasta = MES_RE.test(req.query.hasta || "") ? req.query.hasta : defHasta;
    if (desde > hasta) [desde, hasta] = [hasta, desde];

    const [dy, dm] = desde.split("-").map(Number);
    const [hy, hm] = hasta.split("-").map(Number);
    let inicio = new Date(dy, dm - 1, 1);
    const fin = new Date(hy, hm, 1); // primer día del mes siguiente a "hasta"

    // Limitar el rango para no recorrer años enteros sin necesidad.
    const totalMeses = (hy - dy) * 12 + (hm - dm) + 1;
    if (totalMeses > MAX_MESES) {
      inicio = new Date(hy, hm - MAX_MESES, 1);
      desde = keyDe(inicio);
    }

    const tipo = ["mesa", "retiro", "delivery"].includes(req.query.tipo) ? req.query.tipo : null;

    // Buckets vacíos para cada mes del rango.
    const meses = [];
    const idx = {};
    for (let d = new Date(inicio); d < fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const key = keyDe(d);
      const b = { key, label: MESES_ABBR[d.getMonth()], anio: d.getFullYear(), ventas: 0, costo: 0, ganancia: 0, pedidos: 0 };
      meses.push(b);
      idx[key] = b;
    }

    // Traer pedidos entregados del rango, paginando (Supabase corta en 1000).
    // Se busca desde un mes antes por pedidos creados a fin de mes y
    // entregados al mes siguiente; el filtro fino se hace abajo.
    const buscarDesde = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1).toISOString();
    const pedidos = [];
    for (let from = 0; ; from += PAGINA) {
      let q = supabase
        .from("pedidos")
        .select("id, created_at, entregado_at, tipo_entrega, mesa, pedido_items(cantidad, precio_unit, costo_unit, nombre, subtotal)")
        .eq("negocio_id", negocioId)
        .eq("estado", "entregado")
        .gte("created_at", buscarDesde)
        .lt("created_at", fin.toISOString())
        .order("id", { ascending: true })
        .range(from, from + PAGINA - 1);
      const { data, error } = await q;
      if (error) throw error;
      pedidos.push(...(data || []));
      if (!data || data.length < PAGINA) break;
    }

    const topMap = {};
    for (const p of pedidos) {
      // Tipo de entrega efectivo (pedidos viejos sin tipo: mesa si tienen mesa).
      const tipoP = p.tipo_entrega || (p.mesa ? "mesa" : null);
      if (tipo && tipoP !== tipo) continue;

      const d = new Date(p.entregado_at || p.created_at);
      const b = idx[keyDe(d)];
      if (!b) continue;

      let pv = 0;
      let pc = 0;
      for (const it of p.pedido_items || []) {
        const ventas = Number(it.subtotal) || Number(it.precio_unit) * it.cantidad || 0;
        const costo = Number(it.costo_unit) * it.cantidad || 0;
        pv += ventas;
        pc += costo;
        const nombre = it.nombre || "Producto";
        const t = (topMap[nombre] = topMap[nombre] || { ventas: 0, ganancia: 0, cantidad: 0 });
        t.ventas += ventas;
        t.ganancia += ventas - costo;
        t.cantidad += Number(it.cantidad) || 0;
      }
      b.ventas += pv;
      b.costo += pc;
      b.ganancia += pv - pc;
      b.pedidos += 1;
    }

    const r2 = (n) => +n.toFixed(2);
    const totales = { ventas: 0, costo: 0, ganancia: 0, pedidos: 0 };
    for (const b of meses) {
      b.ventas = r2(b.ventas);
      b.costo = r2(b.costo);
      b.ganancia = r2(b.ganancia);
      totales.ventas += b.ventas;
      totales.costo += b.costo;
      totales.ganancia += b.ganancia;
      totales.pedidos += b.pedidos;
    }
    totales.ventas = r2(totales.ventas);
    totales.costo = r2(totales.costo);
    totales.ganancia = r2(totales.ganancia);

    const top_productos = Object.entries(topMap)
      .map(([nombre, v]) => ({ nombre, ventas: r2(v.ventas), ganancia: r2(v.ganancia), cantidad: v.cantidad }))
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 10);

    res.json({ desde, hasta, tipo, meses, totales, top_productos });
  } catch (error) {
    return respondError(res, error, "analiticas");
  }
};

module.exports = { getResumen, getHistorial };
