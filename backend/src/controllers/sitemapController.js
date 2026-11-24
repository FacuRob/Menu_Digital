// Sitemap de las páginas públicas de los locales (RUTA PÚBLICA), para Google.
// dinexflow.com.ar/robots.txt apunta acá. Entra cada negocio activo con slug,
// de una cuenta al día (pagando o en prueba), que no sea de Tech, y con algo
// para mostrar (un producto disponible o un servicio activo): una página
// vacía no le sirve a nadie en Google.
const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { estaVigente } = require("../utils/suscripcion");

// Fijo: es la dirección oficial que tiene que guardar Google (igual que el
// canonical de frontend/src/App.tsx), no la de onrender.com ni la local.
const SITIO = "https://dinexflow.com.ar";
const UNA_HORA = 60 * 60 * 1000;
let cache = { xml: null, hasta: 0 };
let enCurso = null;

const tieneAlgo = async (negocioId) => {
  const [prod, serv] = await Promise.all([
    supabase.from("productos").select("id").eq("negocio_id", negocioId).eq("disponible", true).limit(1),
    supabase.from("servicios").select("id").eq("negocio_id", negocioId).eq("activo", true).limit(1),
  ]);
  if (prod.error) throw prod.error;
  // Sin la tabla de servicios (migración vieja) cuenta sólo lo de productos.
  return (prod.data || []).length > 0 || (!serv.error && (serv.data || []).length > 0);
};

const armarXml = async () => {
  const { data: negocios, error } = await supabase
    .from("negocios")
    .select("id, slug, cuenta_id")
    .eq("activo", true)
    .not("slug", "is", null);
  if (error) throw error;
  if (!negocios?.length) return xml([]);

  const cuentaIds = [...new Set(negocios.map((n) => n.cuenta_id))];
  const [cuentasRes, techRes] = await Promise.all([
    supabase.from("cuentas").select("id, estado_suscripcion, periodo_fin").in("id", cuentaIds),
    supabase.from("usuarios").select("cuenta_id").eq("es_plataforma", true),
  ]);
  if (cuentasRes.error) throw cuentasRes.error;
  if (techRes.error) throw techRes.error;

  const tech = new Set((techRes.data || []).map((u) => u.cuenta_id));
  const alDia = new Set((cuentasRes.data || []).filter((c) => !tech.has(c.id) && estaVigente(c)).map((c) => c.id));
  const candidatos = negocios.filter((n) => n.slug && alDia.has(n.cuenta_id));
  const conAlgo = await Promise.all(candidatos.map((n) => tieneAlgo(n.id)));
  return xml(candidatos.filter((_, i) => conAlgo[i]).map((n) => `${SITIO}/negocio/${encodeURIComponent(n.slug)}`));
};

const xml = (urls) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url><loc>${u}</loc></url>\n`).join("") +
  "</urlset>\n";

const sitemapNegocios = async (req, res) => {
  try {
    if (!cache.xml || Date.now() > cache.hasta) {
      // Si llegan varios pedidos juntos, se arma una sola vez.
      enCurso ??= armarXml().finally(() => {
        enCurso = null;
      });
      cache = { xml: await enCurso, hasta: Date.now() + UNA_HORA };
    }
    res.set("Cache-Control", "public, max-age=3600");
    res.type("application/xml").send(cache.xml);
  } catch (error) {
    // Si falla la base, mejor la lista anterior que un error para Google.
    if (cache.xml) return res.type("application/xml").send(cache.xml);
    return respondError(res, error, "sitemap");
  }
};

// Sólo para las pruebas.
const _limpiarCache = () => {
  cache = { xml: null, hasta: 0 };
};

module.exports = { sitemapNegocios, _limpiarCache };
