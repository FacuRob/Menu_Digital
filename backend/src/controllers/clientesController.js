// ══════════════════════════════════════════════════════════════
// Clientes del negocio: no hay tabla propia, se arman al vuelo con los
// pedidos, presupuestos y turnos (los mismos datos que ya están en el
// panel). Un cliente = mismo teléfono (o, sin teléfono, mismo email).
// Los pedidos sin teléfono (en mesa, mostrador) no identifican a nadie y
// no cuentan.
// ══════════════════════════════════════════════════════════════
const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");

// Filas que se leen por fuente (las más recientes).
const MAX_FILAS = 2000;

// Teléfono → últimos 10 dígitos (así "+54 9 381…" y "381…" son el mismo).
const digitos = (t) => String(t || "").replace(/\D/g, "").slice(-10);

function claveDe(telefono, email) {
  const d = digitos(telefono);
  if (d.length >= 8) return `t:${d}`;
  const e = String(email || "").trim().toLowerCase();
  return e ? `e:${e}` : null;
}

// Lee una fuente (una fila de más para saber si se cortó). Si la tabla no
// existe todavía (migración sin correr) o falla, cuenta como vacía para no
// tirar abajo toda la pantalla → { filas, cortado, fallo }.
async function leer(tabla, campos, negocioId) {
  const { data, error } = await supabase
    .from(tabla)
    .select(campos)
    .eq("negocio_id", negocioId)
    .order("created_at", { ascending: false })
    .limit(MAX_FILAS + 1);
  if (error) {
    console.error(`[clientes] ${tabla}:`, error.message);
    return { filas: [], cortado: false, fallo: true };
  }
  const filas = data || [];
  return { filas: filas.slice(0, MAX_FILAS), cortado: filas.length > MAX_FILAS, fallo: false };
}

// Junta las tres fuentes en una lista por cliente, el más reciente primero.
function agrupar({ pedidos = [], presupuestos = [], reservas = [] }) {
  const mapa = new Map();
  const sumar = (nombre, telefono, email, fecha, cambio) => {
    const clave = claveDe(telefono, email);
    if (!clave) return;
    let c = mapa.get(clave);
    if (!c) {
      c = { clave, nombre: null, telefono: null, email: null, pedidos: 0, total: 0, presupuestos: 0, turnos: 0, ultimo: null };
      mapa.set(clave, c);
    }
    // Nombre y datos de contacto: los del registro más reciente.
    if (!c.ultimo || (fecha && fecha > c.ultimo)) {
      c.ultimo = fecha || c.ultimo;
      if (nombre) c.nombre = String(nombre).trim();
      if (telefono) c.telefono = String(telefono).trim();
      if (email) c.email = String(email).trim();
    }
    if (!c.nombre && nombre) c.nombre = String(nombre).trim();
    if (!c.telefono && telefono) c.telefono = String(telefono).trim();
    if (!c.email && email) c.email = String(email).trim();
    cambio(c);
  };
  for (const p of pedidos) {
    sumar(p.cliente, p.telefono_cliente, null, p.created_at, (c) => {
      // Los cancelados cuentan como pedido, pero no suman al total gastado.
      c.pedidos += 1;
      if (p.estado !== "cancelado") c.total += Number(p.total) || 0;
    });
  }
  for (const p of presupuestos) sumar(p.cliente_nombre, p.telefono, p.email, p.created_at, (c) => (c.presupuestos += 1));
  for (const r of reservas) sumar(r.cliente_nombre, r.telefono, r.email, r.created_at, (c) => (c.turnos += 1));
  return [...mapa.values()]
    .map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 }))
    .sort((a, b) => String(b.ultimo || "").localeCompare(String(a.ultimo || "")));
}

const listar = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const fuentes = await Promise.all([
      leer("pedidos", "cliente, telefono_cliente, total, estado, created_at", negocioId),
      leer("presupuestos", "cliente_nombre, telefono, email, created_at", negocioId),
      leer("reservas", "cliente_nombre, telefono, email, created_at", negocioId),
    ]);
    if (fuentes.every((f) => f.fallo)) throw new Error("No se pudieron leer los clientes");
    const [pedidos, presupuestos, reservas] = fuentes.map((f) => f.filas);
    // Datos personales: que no queden guardados en cachés intermedias.
    res.set("Cache-Control", "no-store");
    res.json({ clientes: agrupar({ pedidos, presupuestos, reservas }), truncado: fuentes.some((f) => f.cortado) });
  } catch (error) {
    return respondError(res, error, "clientes.listar");
  }
};

module.exports = { listar, agrupar, claveDe };
