// Otros negocios de la misma cuenta (p. ej. "Labtinos" y "TP" del mismo
// dueño). Si el cliente le escribe a uno y pregunta por el otro, la IA le
// ofrece un botón para comunicarse con el otro:
//   - el otro tiene su propio número  → botón con link a wa.me/<número>
//   - los dos usan el número de DinexFlow → botón "Hablar con …"; al tocarlo
//     el chat pasa al otro negocio (mismo número, otro local)
//   - el otro no tiene WhatsApp activo → link a su carta
// Nunca se ofrecen negocios de otra cuenta.
const supabase = require("../config/database");
const { credencialesDe } = require("./whatsappCuentas");
const { negocioIncluye } = require("../utils/planNegocio");

const MAX_OTROS = 9;
const MENU_URL = () => (process.env.VITE_MENU_URL || "https://dinexflow.com.ar").replace(/\/+$/, "");
const ID_BOTON = /^neg:(\d+)$/;

// Negocios activos de la cuenta, sin `negocioId`. → [{ id, nombre, descripcion, rubro, slug }]
async function otrosNegociosDe(negocio) {
  if (!negocio?.cuenta_id) return [];
  try {
    const { data: negs, error } = await supabase
      .from("negocios")
      .select("*")
      .eq("cuenta_id", negocio.cuenta_id)
      .order("id", { ascending: true });
    if (error || !Array.isArray(negs)) return [];
    const otros = negs.filter((n) => n.id !== negocio.id && n.activo !== false).slice(0, MAX_OTROS);
    if (!otros.length) return [];
    const { data: cfgs } = await supabase
      .from("configuracion")
      .select("negocio_id, nombre, descripcion")
      .in("negocio_id", otros.map((n) => n.id));
    const cfg = new Map((Array.isArray(cfgs) ? cfgs : []).map((c) => [c.negocio_id, c]));
    return otros.map((n) => ({
      id: n.id,
      nombre: cfg.get(n.id)?.nombre || n.nombre || `Negocio ${n.id}`,
      descripcion: cfg.get(n.id)?.descripcion || "",
      rubro: n.tipo_rubro || null,
      slug: n.slug || null,
    }));
  } catch {
    return [];
  }
}

// Por dónde escribe un negocio: { propio, numero } o null (sin WhatsApp).
async function canalDe(negocioId) {
  const cred = await credencialesDe(negocioId);
  if (!cred) return null;
  if (!cred.propia) return { propio: false, numero: null };
  const tabla = cred.via === "qr" ? "whatsapp_qr" : "whatsapp_cuentas";
  const { data } = await supabase.from(tabla).select("telefono").eq("negocio_id", negocioId).maybeSingle();
  return { propio: true, numero: String(data?.telefono || "").replace(/\D/g, "") || null };
}

const etiqueta = (prefijo, nombre) => `${prefijo} ${nombre}`.slice(0, 20).trim();

// Qué botón mandarle al cliente del chat (negocio `desdeId`) para ir a `otro`.
//   { tipo: "whatsapp", texto, url } | { tipo: "cambiar", texto, id } | { tipo: "carta", url } | null
async function accionHacia(desdeId, otro) {
  const conWhatsapp = await negocioIncluye(otro.id, "whatsapp").catch(() => false);
  const [aca, alla] = conWhatsapp ? await Promise.all([canalDe(desdeId), canalDe(otro.id)]) : [null, null];
  if (alla?.propio && alla.numero && alla.numero !== aca?.numero) {
    const saludo = encodeURIComponent(`Hola ${otro.nombre}`);
    return { tipo: "whatsapp", texto: etiqueta("Escribir a", otro.nombre), url: `https://wa.me/${alla.numero}?text=${saludo}` };
  }
  if (alla && !alla.propio && aca && !aca.propio) {
    return { tipo: "cambiar", texto: etiqueta("Hablar con", otro.nombre), id: `neg:${otro.id}` };
  }
  return otro.slug ? { tipo: "carta", url: `${MENU_URL()}/negocio/${otro.slug}` } : null;
}

// El cliente tocó "Hablar con …" (mensaje que llegó al número de DinexFlow):
// id del negocio al que pasa el chat, o null si no corresponde.
async function destinoDelBoton(m, desdeId) {
  const id = Number(ID_BOTON.exec(String(m?.interactive?.button_reply?.id || ""))?.[1]);
  if (!id || !desdeId || id === Number(desdeId)) return null;
  try {
    const { data } = await supabase.from("negocios").select("*").in("id", [Number(desdeId), id]);
    const lista = Array.isArray(data) ? data : [];
    const desde = lista.find((n) => n.id === Number(desdeId));
    const hacia = lista.find((n) => n.id === id);
    if (!desde?.cuenta_id || !hacia || hacia.activo === false || hacia.cuenta_id !== desde.cuenta_id) return null;
    // Sólo si el otro también atiende por el número de DinexFlow.
    const canal = await canalDe(id);
    return canal && !canal.propio ? id : null;
  } catch {
    return null;
  }
}

module.exports = { otrosNegociosDe, canalDe, accionHacia, destinoDelBoton };
