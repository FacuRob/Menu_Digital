-- ══════════════════════════════════════════════════════════════
-- Migración: Configuración del local + Sistema de pedidos por mesa
-- Ejecutar en Supabase (SQL Editor) o psql.
-- ══════════════════════════════════════════════════════════════

-- ── Tabla: configuracion ─────────────────────────────────────
-- Guarda los datos personalizables del local (una sola fila, id = 1).
CREATE TABLE IF NOT EXISTS configuracion (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL DEFAULT 'Mi Restaurante',
    descripcion TEXT,
    direccion   VARCHAR(255),
    telefono    VARCHAR(50),
    whatsapp    VARCHAR(50),
    email       VARCHAR(255),
    horarios    VARCHAR(255),
    logo_url    VARCHAR(500),
    portada_url VARCHAR(500),
    -- Opciones de servicio (multirubro)
    mesas_activo    BOOLEAN NOT NULL DEFAULT false,
    mesas_cantidad  INTEGER NOT NULL DEFAULT 0,
    delivery_activo BOOLEAN NOT NULL DEFAULT false,
    retiro_activo   BOOLEAN NOT NULL DEFAULT true,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE configuracion DISABLE ROW LEVEL SECURITY;

-- Columnas nuevas para bases ya existentes (idempotente).
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS mesas_activo    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS mesas_cantidad  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS delivery_activo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS retiro_activo   BOOLEAN NOT NULL DEFAULT true;

-- Fila inicial con los datos actuales del local.
INSERT INTO configuracion
    (id, nombre, descripcion, direccion, telefono, whatsapp, email, horarios)
VALUES
    (1, 'GRILLMAN', '100% Carne al fuego', 'San Lorenzo 1242',
     '3814665263', '3814665263', 'grillmantuc@gmail.com', '20:00 a 01:00 hs')
ON CONFLICT (id) DO NOTHING;

-- ── Tabla: pedidos ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos (
    id         SERIAL PRIMARY KEY,
    mesa       VARCHAR(50),
    cliente    VARCHAR(150),
    nota       TEXT,
    total      DECIMAL(10, 2) NOT NULL DEFAULT 0,
    estado     VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    -- estado: pendiente | preparando | entregado | cancelado
    tipo_entrega      VARCHAR(20),  -- mesa | retiro | delivery
    direccion_entrega TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa   ON pedidos(mesa);

ALTER TABLE pedidos DISABLE ROW LEVEL SECURITY;

-- Columnas nuevas para bases ya existentes (idempotente).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_entrega      VARCHAR(20);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS direccion_entrega TEXT;

-- Zona horaria: convertir timestamps existentes a TIMESTAMPTZ asumiendo UTC.
-- Así la hora se muestra correcta según la zona de cada quien la mire.
ALTER TABLE pedidos ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE pedidos ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';

-- ── Tabla: pedido_items ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedido_items (
    id          SERIAL PRIMARY KEY,
    pedido_id   INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    nombre      VARCHAR(150) NOT NULL,
    precio_unit DECIMAL(10, 2) NOT NULL DEFAULT 0,
    cantidad    INTEGER NOT NULL DEFAULT 1,
    subtotal    DECIMAL(10, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);

ALTER TABLE pedido_items DISABLE ROW LEVEL SECURITY;
