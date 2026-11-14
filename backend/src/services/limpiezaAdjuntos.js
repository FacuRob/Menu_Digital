const cron = require("node-cron");
const supabase = require("../config/database");
const cloudinary = require("../config/cloudinary");

// Archivos que subieron clientes y nunca se usaron en un pedido (abandonaron
// el carrito, o alguien subió cosas de más). Pasadas 24 h ya no se pueden
// reclamar: se borran de Cloudinary y de la tabla. Corre una vez por hora.

const HORAS = 24;
const LOTE = 100;

async function limpiarAdjuntos() {
  const antes = new Date(Date.now() - HORAS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("adjuntos")
    .select("id, public_id, resource_type")
    .eq("usado", false)
    .lt("created_at", antes)
    .limit(LOTE);
  // Sin la tabla (migración pendiente) no hay nada que limpiar.
  if (error || !data?.length) return 0;

  const borrados = [];
  for (const a of data) {
    try {
      await cloudinary.uploader.destroy(a.public_id, { resource_type: a.resource_type, type: "authenticated" });
      borrados.push(a.id);
    } catch (e) {
      console.error("[Adjuntos] no se pudo borrar de Cloudinary:", a.public_id, e.message);
    }
  }
  if (borrados.length) {
    const { error: delErr } = await supabase.from("adjuntos").delete().in("id", borrados).eq("usado", false);
    if (delErr) console.error("[Adjuntos] no se pudieron borrar las filas:", delErr.message);
  }
  return borrados.length;
}

function startLimpiezaAdjuntos() {
  cron.schedule("17 * * * *", () => {
    limpiarAdjuntos()
      .then((n) => n && console.log(`[Adjuntos] ${n} archivos sin usar borrados`))
      .catch((e) => console.error("[Adjuntos] limpieza:", e.message));
  });
}

module.exports = { limpiarAdjuntos, startLimpiezaAdjuntos };
