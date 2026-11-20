const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const cloudinary = require("../config/cloudinary");
const { getNegocioId } = require("../utils/negocio");
const { modulosNegocio } = require("../middleware/requiereModulo");
const { registrar } = require("../utils/registroCambios");
const { camposPorProducto } = require("./camposController");

const extractPublicId = (url) => {
  try {
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    return matches ? matches[1] : null;
  } catch {
    return null;
  }
};

// Fotos del producto en orden: `imagenes` si la hay; si no, la de `imagen_url`
// (productos de antes o base sin la migración).
const fotosDe = (p) => {
  const lista = Array.isArray(p?.imagenes) ? p.imagenes.filter((u) => typeof u === "string" && u) : [];
  if (lista.length) return lista;
  return p?.imagen_url ? [p.imagen_url] : [];
};

// Lista que manda el panel: `imagenes` o, de un panel viejo, sólo `imagen_url`.
// Sin repetidas y hasta 6.
const fotosDelBody = (body) => {
  const lista = Array.isArray(body.imagenes) ? body.imagenes : body.imagen_url ? [body.imagen_url] : [];
  return [...new Set(lista.map((u) => String(u).trim()).filter(Boolean))].slice(0, 6);
};

// Sólo borra fotos de la carpeta de ESTE negocio (la misma regla que
// DELETE /api/upload): una URL ajena puesta a mano no se puede borrar.
// Las fotos de antes de esa carpeta quedan en Cloudinary.
const FALTA_MIGRACION_FOTOS =
  "Para guardar más de una foto por producto falta actualizar la base (db/producto_imagenes.sql). Por ahora dejá una sola.";

const borrarDeCloudinary = (urls, negocioId) => {
  const carpeta = `menu-digital/negocios/${negocioId}/`;
  for (const url of urls) {
    if (!url.includes("cloudinary.com")) continue;
    const publicId = extractPublicId(url);
    if (!publicId || !publicId.startsWith(carpeta) || publicId.includes("..")) continue;
    cloudinary.uploader
      .destroy(publicId)
      .catch((err) => console.error("No se pudo eliminar imagen de Cloudinary:", err));
  }
};

const getProductos = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: true });

    if (error) throw error;

    const result = data.map((p) => ({
      ...p,
      categoria_nombre: p.categorias?.nombre ?? null,
      categorias: undefined,
    }));

    res.json(result);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

// Público: productos disponibles del negocio (oculta sin stock si controlar_stock).
const getProductosDisponibles = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const modulos = await modulosNegocio(negocioId);
    if (!modulos.productos) return res.json([]);
    const { data, error } = await supabase.rpc("get_productos_disponibles", {
      p_negocio_id: negocioId,
    });

    if (error) throw error;
    if (!Array.isArray(data)) return res.json(data);
    // Fotos extra: consulta aparte (la función de la base no las trae). Si la
    // columna todavía no existe, cada producto queda con su foto de siempre.
    const { data: fotos } = data.length
      ? await supabase
          .from("productos")
          .select("id, imagenes")
          .eq("negocio_id", negocioId)
          .in("id", data.map((p) => p.id))
      : { data: [] };
    const fotosPorId = new Map((fotos || []).map((f) => [f.id, f.imagenes]));
    let lista = data.map((p) => ({ ...p, imagenes: fotosDe({ ...p, imagenes: fotosPorId.get(p.id) }) }));
    if (modulos.personalizados) {
      const campos = await camposPorProducto(negocioId);
      lista = lista.map((p) => ({ ...p, campos: campos[p.id] || [] }));
    }
    res.json(lista);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

// Productos con stock bajo/agotado (controlan stock y stock <= umbral).
const getStockBajo = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const { data, error } = await supabase
      .from("productos")
      .select("id, nombre, stock, controlar_stock")
      .eq("negocio_id", negocioId)
      .eq("controlar_stock", true)
      .lte("stock", 5)
      .order("stock", { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

const getProductosByCategoria = async (req, res) => {
  try {
    const { categoriaId } = req.params;
    const negocioId = getNegocioId(req);

    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .eq("categoria_id", categoriaId)
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: true });

    if (error) throw error;

    const result = data.map((p) => ({
      ...p,
      categoria_nombre: p.categorias?.nombre ?? null,
      categorias: undefined,
    }));

    res.json(result);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);

    const { data, error } = await supabase
      .from("productos")
      .select(`*, categorias ( nombre )`)
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json({
      ...data,
      categoria_nombre: data.categorias?.nombre ?? null,
      categorias: undefined,
    });
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

const createProducto = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const {
      nombre,
      descripcion,
      precio,
      costo,
      categoria_id,
      disponible,
      orden,
      stock,
      controlar_stock,
      sku,
      atributos,
      unidad_venta,
    } = req.body;
    const fotos = fotosDelBody(req.body);

    const { data, error } = await supabase
      .from("productos")
      .insert([
        {
          nombre,
          descripcion,
          precio,
          costo: costo || 0,
          imagen_url: fotos[0] || null,
          // Sólo con 2+ fotos: así el alta no falla si la migración aún no corrió.
          ...(fotos.length > 1 ? { imagenes: fotos } : {}),
          categoria_id,
          disponible: disponible !== undefined ? disponible : true,
          orden: orden || 0,
          stock: stock || 0,
          controlar_stock: !!controlar_stock,
          sku: sku || null,
          atributos: atributos || {},
          // Sólo si viene: así el alta no falla si la migración aún no corrió.
          ...(unidad_venta ? { unidad_venta } : {}),
          negocio_id: negocioId,
        },
      ])
      .select()
      .single();

    if (error && fotos.length > 1 && /imagenes/.test(error.message || "")) {
      return res.status(409).json({ message: FALTA_MIGRACION_FOTOS });
    }
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);
    const {
      nombre,
      descripcion,
      precio,
      costo,
      imagen_url,
      categoria_id,
      disponible,
      orden,
      stock,
      controlar_stock,
      sku,
      atributos,
      unidad_venta,
    } = req.body;

    // "*": si la columna `imagenes` todavía no existe, no falla.
    const { data: current } = await supabase
      .from("productos")
      .select("*")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .single();

    if (!current) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Fotos que quedan:
    // - con `imagenes`: esa lista (panel nuevo);
    // - sólo `imagen_url` (panel viejo): cambia la principal y se conservan las extra;
    // - nada de fotos (un cambio parcial como "disponible"): quedan todas.
    const antes = fotosDe(current);
    const fotos = Array.isArray(req.body.imagenes)
      ? fotosDelBody(req.body)
      : imagen_url === undefined
        ? antes
        : fotosDelBody({ imagenes: [...(imagen_url ? [imagen_url] : []), ...antes.slice(1)] });
    const conLista = "imagenes" in current;
    if (!conLista && fotos.length > 1) {
      return res.status(409).json({ message: FALTA_MIGRACION_FOTOS });
    }

    const { data, error } = await supabase
      .from("productos")
      .update({
        nombre,
        descripcion,
        precio,
        costo: costo ?? 0,
        imagen_url: fotos[0] || null,
        ...(conLista ? { imagenes: fotos } : {}),
        categoria_id,
        disponible,
        orden,
        stock: stock ?? 0,
        controlar_stock: !!controlar_stock,
        ...(sku !== undefined ? { sku: sku || null } : {}),
        ...(atributos !== undefined ? { atributos: atributos || {} } : {}),
        ...(unidad_venta !== undefined ? { unidad_venta } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    // Recién con el cambio guardado se borran de Cloudinary las que se sacaron.
    borrarDeCloudinary(antes.filter((u) => !fotos.includes(u)), negocioId);
    res.json(data);
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const negocioId = getNegocioId(req);

    const { data, error } = await supabase
      .from("productos")
      .delete()
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    borrarDeCloudinary(fotosDe(data), negocioId);

    registrar(req, "borrar", "producto", data.id, { nombre: data.nombre });
    res.json({ message: "Producto eliminado exitosamente" });
  } catch (error) {
    return respondError(res, error, "productos");
  }
};

module.exports = {
  getProductos,
  getProductosDisponibles,
  getStockBajo,
  getProductosByCategoria,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
};
