// Slugs de negocio: la parte de la URL pública del menú (/menu/:slug).
// La columna negocios.slug es UNIQUE en la BD, así que antes de guardar uno
// hay que asegurarse de que no lo use otro negocio (de cualquier cuenta).

const slugify = (s, max = 60) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, max)
    .replace(/-$/, "");

// ¿El slug está libre? (`excludeId`: el propio negocio, al editarlo).
const slugDisponible = async (supabase, slug, { excludeId } = {}) => {
  const { data, error } = await supabase
    .from("negocios")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return !data || (excludeId != null && String(data.id) === String(excludeId));
};

// Devuelve un slug libre a partir de un texto: "pizzeria-roma",
// y si está tomado "pizzeria-roma-2", "pizzeria-roma-3", ...
const slugUnico = async (supabase, texto, { excludeId } = {}) => {
  const raiz = slugify(texto) || "negocio";
  for (let i = 1; i <= 50; i++) {
    const candidato = i === 1 ? raiz : `${raiz}-${i}`;
    if (await slugDisponible(supabase, candidato, { excludeId })) return candidato;
  }
  // Muy improbable: sufijo aleatorio corto.
  return `${raiz}-${Date.now().toString(36)}`;
};

// El link del menú sigue al nombre público del negocio (Configuración →
// nombre): "Bar la Esquina" → "bar-la-esquina"; si otro negocio ya lo usa,
// "bar-la-esquina-2". Sólo escribe si el slug cambia. Devuelve el slug final.
const sincronizarSlug = async (supabase, negocioId, nombre) => {
  if (!nombre || !String(nombre).trim()) return null;
  const { data: neg, error } = await supabase
    .from("negocios")
    .select("slug")
    .eq("id", negocioId)
    .maybeSingle();
  if (error) throw error;
  if (!neg) return null;

  const nuevo = await slugUnico(supabase, nombre, { excludeId: negocioId });
  if (nuevo === neg.slug) return neg.slug;

  const { error: upErr } = await supabase
    .from("negocios")
    .update({ slug: nuevo })
    .eq("id", negocioId);
  // Choque simultáneo con otro alta (UNIQUE): se conserva el slug actual.
  if (upErr) return neg.slug;
  return nuevo;
};

module.exports = { slugify, slugDisponible, slugUnico, sincronizarSlug };
