-- ══════════════════════════════════════════════════════════════
-- Migración: Multi-rubro (desacople de "comida")
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: schema.sql (productos, categorias) y multitenant_stock.sql (negocios).
-- ══════════════════════════════════════════════════════════════
--
-- Objetivo: que un negocio pueda vender cualquier rubro (gastronomía,
-- retail/ropa, servicios, genérico). El cambio es ADITIVO y
-- RETROCOMPATIBLE: los negocios gastronómicos existentes siguen
-- funcionando igual (tipo_rubro default 'gastronomia').
--
-- Modelo de variantes (reemplaza el concepto acoplado de "ingredientes"):
--   variantes_grupo   = un eje de elección del producto ("Talle", "Color",
--                       "Extras", "Punto de cocción"). tipo single|multi.
--   variantes_opcion  = cada opción del grupo ("M", "Rojo", "Bacon +queso"),
--                       con precio_extra y stock opcional.
-- ══════════════════════════════════════════════════════════════

-- ── negocios: rubro + campos configurables por tenant ────────
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS tipo_rubro
    VARCHAR(30) NOT NULL DEFAULT 'gastronomia';

ALTER TABLE negocios DROP CONSTRAINT IF EXISTS chk_tipo_rubro;
ALTER TABLE negocios ADD CONSTRAINT chk_tipo_rubro
    CHECK (tipo_rubro IN ('gastronomia', 'retail', 'servicios', 'generico'));

-- config_campos: qué campos/labels muestra el panel para este negocio.
-- Ej: {"mostrar_stock": true, "mostrar_variantes": true, "label_producto": "Artículo"}
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS config_campos
    JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── productos: campos genéricos por rubro ────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
-- atributos: campos libres según rubro (marca, material, duración, etc.)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS atributos
    JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_productos_sku ON productos(negocio_id, sku);

-- ── Tabla: variantes_grupo ───────────────────────────────────
CREATE TABLE IF NOT EXISTS variantes_grupo (
    id          SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    negocio_id  INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre      VARCHAR(80) NOT NULL,
    tipo        VARCHAR(10) NOT NULL DEFAULT 'single',
    obligatorio BOOLEAN NOT NULL DEFAULT false,
    orden       INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE variantes_grupo DROP CONSTRAINT IF EXISTS chk_variante_tipo;
ALTER TABLE variantes_grupo ADD CONSTRAINT chk_variante_tipo
    CHECK (tipo IN ('single', 'multi'));

CREATE INDEX IF NOT EXISTS idx_vgrupo_producto ON variantes_grupo(producto_id);
CREATE INDEX IF NOT EXISTS idx_vgrupo_negocio  ON variantes_grupo(negocio_id);
ALTER TABLE variantes_grupo DISABLE ROW LEVEL SECURITY;

-- ── Tabla: variantes_opcion ──────────────────────────────────
CREATE TABLE IF NOT EXISTS variantes_opcion (
    id           SERIAL PRIMARY KEY,
    grupo_id     INTEGER NOT NULL REFERENCES variantes_grupo(id) ON DELETE CASCADE,
    nombre       VARCHAR(80) NOT NULL,
    precio_extra DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock        INTEGER,               -- NULL = no controla stock por opción
    activo       BOOLEAN NOT NULL DEFAULT true,
    orden        INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vopcion_grupo ON variantes_opcion(grupo_id);
ALTER TABLE variantes_opcion DISABLE ROW LEVEL SECURITY;

-- ── RPC get_productos_disponibles: incluir variantes + atributos ─
-- Reemplaza la versión de multitenant_stock.sql agregando `sku`,
-- `atributos` y `variantes` (grupos con sus opciones activas, anidadas).
DROP FUNCTION IF EXISTS get_productos_disponibles();
DROP FUNCTION IF EXISTS get_productos_disponibles(INTEGER);

CREATE OR REPLACE FUNCTION get_productos_disponibles(p_negocio_id INTEGER DEFAULT 1)
RETURNS TABLE (
    id               INTEGER,
    nombre           VARCHAR,
    descripcion      TEXT,
    precio           DECIMAL,
    imagen_url       VARCHAR,
    categoria_id     INTEGER,
    categoria_nombre VARCHAR,
    disponible       BOOLEAN,
    orden            INTEGER,
    stock            INTEGER,
    controlar_stock  BOOLEAN,
    negocio_id       INTEGER,
    sku              VARCHAR,
    atributos        JSONB,
    variantes        JSONB,
    created_at       TIMESTAMP,
    updated_at       TIMESTAMP
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id, p.nombre, p.descripcion, p.precio, p.imagen_url,
        p.categoria_id, c.nombre AS categoria_nombre, p.disponible, p.orden,
        p.stock, p.controlar_stock, p.negocio_id, p.sku, p.atributos,
        COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', g.id,
                    'nombre', g.nombre,
                    'tipo', g.tipo,
                    'obligatorio', g.obligatorio,
                    'orden', g.orden,
                    'opciones', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', o.id,
                                'nombre', o.nombre,
                                'precio_extra', o.precio_extra,
                                'stock', o.stock
                            ) ORDER BY o.orden, o.id
                        )
                        FROM variantes_opcion o
                        WHERE o.grupo_id = g.id
                          AND o.activo = true
                          AND (o.stock IS NULL OR o.stock > 0)
                    ), '[]'::jsonb)
                ) ORDER BY g.orden, g.id
            )
            FROM variantes_grupo g
            WHERE g.producto_id = p.id
        ), '[]'::jsonb) AS variantes,
        p.created_at, p.updated_at
    FROM productos p
    INNER JOIN categorias c ON p.categoria_id = c.id
    WHERE p.disponible = true
      AND c.activo = true
      AND p.negocio_id = p_negocio_id
      AND (p.controlar_stock = false OR p.stock > 0)
    ORDER BY c.orden ASC, p.orden ASC;
$$;
