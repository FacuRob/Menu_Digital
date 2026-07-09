const supabase = require("../config/database");

// Ping liviano a Supabase para evitar que el proyecto free se pause por inactividad.
// Hace un conteo "head" (no trae filas, solo el total) sobre una tabla base.
const keepAlive = async (req, res) => {
  try {
    const { count, error } = await supabase
      .from("negocios")
      .select("*", { count: "exact", head: true });

    if (error) throw error;

    res.json({
      status: "ok",
      message: "Supabase activo",
      negocios: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  }
};

module.exports = { keepAlive };
