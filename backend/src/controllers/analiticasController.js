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
      .select("id, created_at, estado, pedido_items(cantidad, precio_unit, costo_unit, nombre, subtotal)")
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
      const d = new Date(p.created_at);
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

module.exports = { getResumen };
