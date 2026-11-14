// ══════════════════════════════════════════════════════════════
// Personalización de productos: valida lo que manda el cliente contra los
// campos del producto (producto_campos) y arma la foto que queda guardada
// en el detalle del pedido. Nada del cliente se guarda sin pasar por acá.
// ══════════════════════════════════════════════════════════════

const TIPOS = ["texto", "texto_largo", "numero", "opcion", "multiple", "color", "archivo"];
const TIPOS_ARCHIVO = ["imagen", "pdf", "3d"];
const LARGO_DEFECTO = { texto: 200, texto_largo: 1000 };
const HEX = /^#[0-9a-f]{6}$/i;

const vacio = (v) =>
  v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);

// Valida un valor contra su campo. Devuelve { valor } (normalizado) o { error }.
function validarCampo(campo, entrada, adjuntos) {
  const { tipo, etiqueta, opciones = [], validaciones: val = {} } = campo;
  const v = entrada?.valor;
  const err = (m) => ({ error: `${etiqueta}: ${m}` });

  if (tipo === "archivo") {
    const token = entrada?.adjunto;
    if (!token) return { valor: null };
    const adj = adjuntos[token];
    if (!adj) return err("el archivo ya no está disponible, subilo de nuevo.");
    const tipos = Array.isArray(val.tipos) && val.tipos.length ? val.tipos : TIPOS_ARCHIVO;
    if (!tipos.includes(adj.tipo)) return err("ese tipo de archivo no se acepta.");
    return { valor: null, adjunto: { id: adj.id, nombre: adj.nombre, token } };
  }
  if (vacio(v)) return { valor: null };

  if (tipo === "texto" || tipo === "texto_largo") {
    if (typeof v !== "string") return err("tiene que ser texto.");
    const max = Number(val.max_largo) || LARGO_DEFECTO[tipo];
    const s = v.trim();
    if (s.length > max) return err(`máximo ${max} caracteres.`);
    return { valor: s };
  }
  if (tipo === "numero") {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return err("tiene que ser un número.");
    if (val.min !== undefined && n < Number(val.min)) return err(`mínimo ${val.min}.`);
    if (val.max !== undefined && n > Number(val.max)) return err(`máximo ${val.max}.`);
    return { valor: n };
  }
  if (tipo === "opcion") {
    if (typeof v !== "string" || !opciones.includes(v)) return err("elegí una de las opciones.");
    return { valor: v };
  }
  if (tipo === "multiple") {
    const lista = Array.isArray(v) ? [...new Set(v)] : [];
    if (!lista.length || lista.some((x) => !opciones.includes(x))) return err("elegí entre las opciones.");
    if (val.max !== undefined && lista.length > Number(val.max)) return err(`elegí hasta ${val.max}.`);
    return { valor: lista };
  }
  if (tipo === "color") {
    if (typeof v !== "string") return err("elegí un color.");
    if (opciones.length ? !opciones.includes(v) : !HEX.test(v)) return err("elegí un color válido.");
    return { valor: v };
  }
  return err("campo desconocido.");
}

/**
 * campos: filas de producto_campos de ESE producto.
 * entrada: [{ campo_id, valor?, adjunto? }] que manda el cliente.
 * adjuntos: { token: fila de adjuntos } válidos (del negocio, sin usar).
 * → { snapshot: [...] | null, tokens: [...] } o { error }
 */
function validarPersonalizacion(campos, entrada, adjuntos = {}) {
  const lista = Array.isArray(entrada) ? entrada : [];
  const porId = new Map(campos.map((c) => [c.id, c]));
  if (lista.some((e) => !porId.has(e?.campo_id))) {
    return { error: "El producto cambió. Actualizá el menú y volvé a intentar." };
  }
  const snapshot = [];
  const tokens = [];
  for (const campo of [...campos].sort((a, b) => a.orden - b.orden || a.id - b.id)) {
    const r = validarCampo(campo, lista.find((e) => e.campo_id === campo.id), adjuntos);
    if (r.error) return { error: r.error };
    const tieneValor = r.adjunto || r.valor !== null;
    if (!tieneValor) {
      if (campo.obligatorio) return { error: `Completá "${campo.etiqueta}".` };
      continue;
    }
    const foto = { campo_id: campo.id, etiqueta: campo.etiqueta, tipo: campo.tipo, valor: r.valor };
    if (r.adjunto) {
      foto.adjunto = { id: r.adjunto.id, nombre: r.adjunto.nombre };
      tokens.push(r.adjunto.token);
    }
    snapshot.push(foto);
  }
  return { snapshot: snapshot.length ? snapshot : null, tokens };
}

module.exports = { TIPOS, TIPOS_ARCHIVO, validarPersonalizacion };
