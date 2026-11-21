// Número de pedido que se muestra (propio de cada negocio: 1, 2, 3…).
// El `id` es interno; ver db/numero_pedido.sql.
const supabase = require("../config/database");

const numeroDe = (p) => (p ? p.numero ?? p.id : null);

// Agrega `pedido_numero` a filas que traen `pedido_id` (mensajes, presupuestos).
// Si falta la migración o falla la consulta, usa el id.
async function conNumeroPedido(filas) {
  const lista = Array.isArray(filas) ? filas : [filas];
  const ids = [...new Set(lista.map((f) => f?.pedido_id).filter(Boolean))];
  const mapa = new Map();
  if (ids.length) {
    try {
      const { data } = await supabase.from("pedidos").select("id, numero").in("id", ids);
      for (const p of data || []) mapa.set(p.id, numeroDe(p));
    } catch {
      /* sin numero: queda el id */
    }
  }
  const out = lista.map((f) =>
    f && f.pedido_id ? { ...f, pedido_numero: mapa.get(f.pedido_id) ?? f.pedido_id } : f,
  );
  return Array.isArray(filas) ? out : out[0];
}

module.exports = { numeroDe, conNumeroPedido };
