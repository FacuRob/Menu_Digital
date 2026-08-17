const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");

// Verifica que el producto pertenezca al negocio del request.
// Devuelve el id del producto si es válido, o null.
const productoDelNegocio = async (productoId, negocioId) => {
  const { data } = await supabase
    .from("productos")
    .select("id")
    .eq("id", productoId)
    .eq("negocio_id", negocioId)
    .single();
  return data ? data.id : null;
};

// Verifica que el grupo pertenezca al negocio del request.
const grupoDelNegocio = async (grupoId, negocioId) => {
  const { data } = await supabase
    .from("variantes_grupo")
    .select("id, producto_id")
    .eq("id", grupoId)
    .eq("negocio_id", negocioId)
    .single();
  return data || null;
};

// Trae los grupos (con sus opciones) de un producto, ordenados.
const fetchGruposConOpciones = async (productoId) => {
  const { data: grupos, error } = await supabase
    .from("variantes_grupo")
    .select("*")
    .eq("producto_id", productoId)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  if (!grupos || grupos.length === 0) return [];

  const ids = grupos.map((g) => g.id);
  const { data: opciones, error: opErr } = await supabase
    .from("variantes_opcion")
    .select("*")
    .in("grupo_id", ids)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });
  if (opErr) throw opErr;

  return grupos.map((g) => ({
    ...g,
    opciones: (opciones || []).filter((o) => o.grupo_id === g.id),
  }));
};

// GET /api/variantes/producto/:productoId  (admin)
const getVariantesProducto = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const productoId = Number(req.params.productoId);
    if (!(await productoDelNegocio(productoId, negocioId))) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    const grupos = await fetchGruposConOpciones(productoId);
    res.json(grupos);
  } catch (error) {
    return respondError(res, error, "variantes");
  }
};

// POST /api/variantes/producto/:productoId  (admin) — crea un grupo + opciones
const createGrupo = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const productoId = Number(req.params.productoId);
    if (!(await productoDelNegocio(productoId, negocioId))) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    const { nombre, tipo, obligatorio, orden, opciones } = req.body;

    const { data: grupo, error } = await supabase
      .from("variantes_grupo")
      .insert([
        {
          producto_id: productoId,
          negocio_id: negocioId,
          nombre,
          tipo: tipo || "single",
          obligatorio: !!obligatorio,
          orden: orden || 0,
        },
      ])
      .select()
      .single();
    if (error) throw error;

    if (Array.isArray(opciones) && opciones.length > 0) {
      const rows = opciones.map((o, i) => ({
        grupo_id: grupo.id,
        nombre: o.nombre,
        precio_extra: o.precio_extra || 0,
        stock: o.stock ?? null,
        activo: o.activo !== undefined ? !!o.activo : true,
        orden: o.orden ?? i,
      }));
      const { error: opErr } = await supabase
        .from("variantes_opcion")
        .insert(rows);
      if (opErr) throw opErr;
    }

    const [creado] = await fetchGruposConOpciones(productoId).then((gs) =>
      gs.filter((g) => g.id === grupo.id),
    );
    res.status(201).json(creado || grupo);
  } catch (error) {
    return respondError(res, error, "variantes");
  }
};

// PUT /api/variantes/grupo/:grupoId  (admin) — actualiza grupo y reemplaza opciones
const updateGrupo = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const grupoId = Number(req.params.grupoId);
    const grupo = await grupoDelNegocio(grupoId, negocioId);
    if (!grupo) {
      return res.status(404).json({ message: "Grupo no encontrado" });
    }

    const { nombre, tipo, obligatorio, orden, opciones } = req.body;

    const patch = {};
    if (nombre !== undefined) patch.nombre = nombre;
    if (tipo !== undefined) patch.tipo = tipo;
    if (obligatorio !== undefined) patch.obligatorio = !!obligatorio;
    if (orden !== undefined) patch.orden = orden;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("variantes_grupo")
        .update(patch)
        .eq("id", grupoId)
        .eq("negocio_id", negocioId);
      if (error) throw error;
    }

    // Si vienen opciones, reemplazamos el set completo (delete + insert).
    if (Array.isArray(opciones)) {
      await supabase.from("variantes_opcion").delete().eq("grupo_id", grupoId);
      if (opciones.length > 0) {
        const rows = opciones.map((o, i) => ({
          grupo_id: grupoId,
          nombre: o.nombre,
          precio_extra: o.precio_extra || 0,
          stock: o.stock ?? null,
          activo: o.activo !== undefined ? !!o.activo : true,
          orden: o.orden ?? i,
        }));
        const { error: opErr } = await supabase
          .from("variantes_opcion")
          .insert(rows);
        if (opErr) throw opErr;
      }
    }

    const [actualizado] = await fetchGruposConOpciones(grupo.producto_id).then(
      (gs) => gs.filter((g) => g.id === grupoId),
    );
    res.json(actualizado);
  } catch (error) {
    return respondError(res, error, "variantes");
  }
};

// DELETE /api/variantes/grupo/:grupoId  (admin)
const deleteGrupo = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const grupoId = Number(req.params.grupoId);
    const grupo = await grupoDelNegocio(grupoId, negocioId);
    if (!grupo) {
      return res.status(404).json({ message: "Grupo no encontrado" });
    }
    // ON DELETE CASCADE borra las opciones.
    const { error } = await supabase
      .from("variantes_grupo")
      .delete()
      .eq("id", grupoId)
      .eq("negocio_id", negocioId);
    if (error) throw error;
    res.json({ message: "Grupo eliminado" });
  } catch (error) {
    return respondError(res, error, "variantes");
  }
};

module.exports = {
  getVariantesProducto,
  createGrupo,
  updateGrupo,
  deleteGrupo,
};
