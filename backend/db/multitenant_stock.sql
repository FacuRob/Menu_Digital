-- ══════════════════════════════════════════════════════════════
-- Migración: Multi-negocio + Control de stock + Costo/Ganancia
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- ══════════════════════════════════════════════════════════════

-- ── Tabla: negocios (tenants) ────────────────────────────────
CREATE TABLE IF NOT EXISTS negocios (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(150) NOT NULL,
    slug       VARCHAR(80) UNIQUE,
    activo     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE negocios DISABLE ROW LEVEL SECURITY;

-- Negocio inicial (donde quedan todos los datos actuales).
INSERT INTO negocios (id, nombre, slug)
VALUES (1, 'Mi Negocio', 'negocio-1')
ON CONFLICT (id) DO NOTHING;

-- Mantener la secuencia del serial por encima del id insertado a mano.
SELECT setval(
    pg_get_serial_sequence('negocios', 'id'),
    GREATEST((SELECT MAX(id) FROM negocios), 1)
);

-- ── negocio_id en las tablas del dominio ─────────────────────
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS negocio_id INTEGER NOT NULL DEFAULT 1 REFERENCES negocios(id) ON DELETE CASCADE;
ALTER TABLE categorias    ADD COLUMN IF NOT EXISTS negocio_id INTEGER NOT NULL DEFAULT 1 REFERENCES negocios(id) ON DELETE CASCADE;
ALTER TABLE productos     ADD COLUMN IF NOT EXISTS negocio_id INTEGER NOT NULL DEFAULT 1 REFERENCES negocios(id) ON DELETE CASCADE;
ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS negocio_id INTEGER NOT NULL DEFAULT 1 REFERENCES negocios(id) ON DELETE CASCADE;

-- Una configuración por negocio.
CREATE UNIQUE INDEX IF NOT EXISTS ux_configuracion_negocio ON configuracion(negocio_id);

CREATE INDEX IF NOT EXISTS idx_categorias_negocio ON categorias(negocio_id);
CREATE INDEX IF NOT EXISTS idx_productos_negocio  ON productos(negocio_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_negocio    ON pedidos(negocio_id);

-- ── Stock y costo en productos ───────────────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo           DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock           INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS controlar_stock BOOLEAN NOT NULL DEFAULT false;

-- ── Costo unitario "congelado" al momento del pedido ─────────
-- Permite calcular la ganancia histórica aunque el costo cambie luego.
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS costo_unit DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- ── RPC de productos disponibles: por negocio + con stock ────
-- Reemplaza la versión anterior. Oculta productos sin stock cuando
-- controlar_stock = true.
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
    created_at       TIMESTAMP,
    updated_at       TIMESTAMP
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id, p.nombre, p.descripcion, p.precio, p.imagen_url,
        p.categoria_id, c.nombre AS categoria_nombre, p.disponible, p.orden,
        p.stock, p.controlar_stock, p.negocio_id, p.created_at, p.updated_at
    FROM productos p
    INNER JOIN categorias c ON p.categoria_id = c.id
    WHERE p.disponible = true
      AND c.activo = true
      AND p.negocio_id = p_negocio_id
      AND (p.controlar_stock = false OR p.stock > 0)
    ORDER BY c.orden ASC, p.orden ASC;
$$;
