-- Migración: venta por peso + historial de pedidos. Idempotente.
-- Correr en Supabase ANTES de publicar el backend nuevo.
--
-- 1) Un producto se vende por unidad (como hasta ahora) o por peso.
--    Por peso: `precio` es el precio del kilo y la cantidad va en kg
--    (0.350 = 350 g). El stock de esos productos también va en kg.
-- 2) Las cantidades de pedidos y el stock aceptan decimales (3 = gramos).
-- 3) Índice para listar pedidos por negocio y fecha (historial paginado).

-- ── Productos ────────────────────────────────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS unidad_venta VARCHAR(10) NOT NULL DEFAULT 'unidad';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'productos_unidad_venta_check'
  ) THEN
    ALTER TABLE productos
      ADD CONSTRAINT productos_unidad_venta_check CHECK (unidad_venta IN ('unidad', 'kg'));
  END IF;
END $$;

-- La función del menú se recrea abajo con los tipos nuevos.
DROP FUNCTION IF EXISTS get_productos_disponibles(INTEGER);

ALTER TABLE productos ALTER COLUMN stock TYPE NUMERIC(12, 3);

-- ── Ítems de pedido ──────────────────────────────────────────
ALTER TABLE pedido_items ALTER COLUMN cantidad TYPE NUMERIC(10, 3);
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS unidad VARCHAR(10) NOT NULL DEFAULT 'unidad';

-- ── Historial de pedidos ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_created ON pedidos (negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_estado ON pedidos (negocio_id, estado);

-- ── RPC del menú: igual que la de multirubro.sql + unidad_venta ──
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
    stock            NUMERIC,
    controlar_stock  BOOLEAN,
    unidad_venta     VARCHAR,
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
        p.stock, p.controlar_stock, p.unidad_venta, p.negocio_id, p.sku, p.atributos,
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
