-- ══════════════════════════════════════════════════════════════
-- Migración: presupuestos y reservas (Etapa 5)
-- Idempotente. Ejecutar en Supabase (SQL Editor).
-- Depende de: catalogo_universal.sql (servicios, adjuntos).
--
-- Cada proceso tiene su tabla y su historial: NO se mezclan con pedidos.
--   presupuestos + presupuesto_eventos
--   reservas + reserva_eventos (+ agenda_bloqueos para días no laborables)
-- Los horarios de atención son los de Configuración → Horarios
-- (configuracion.horarios_config). Las opciones de la agenda van en
-- configuracion.agenda.
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Presupuestos ─────────────────────────────────────────────
-- Estados: pendiente → en_revision → cotizado → aceptado → convertido
--          (rechazado y cancelado desde cualquier estado abierto)
CREATE TABLE IF NOT EXISTS presupuestos (
    id               SERIAL PRIMARY KEY,
    negocio_id       INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    producto_id      INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    servicio_id      INTEGER REFERENCES servicios(id) ON DELETE SET NULL,
    -- Foto de lo que pidió (por si después se borra el producto/servicio).
    referencia       VARCHAR(150),
    cliente_nombre   VARCHAR(120) NOT NULL,
    telefono         VARCHAR(40),
    email            VARCHAR(160),
    acepta_whatsapp  BOOLEAN NOT NULL DEFAULT false,
    descripcion      TEXT NOT NULL,
    cantidad         INTEGER NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 100000),
    medidas          VARCHAR(300),
    estado           VARCHAR(15) NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'en_revision', 'cotizado', 'aceptado',
                                       'rechazado', 'convertido', 'cancelado')),
    precio_cotizado  DECIMAL(12, 2),
    observaciones    TEXT,
    valido_hasta     DATE,
    pedido_id        INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_presupuestos_negocio ON presupuestos(negocio_id, estado);
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS presupuesto_eventos (
    id              SERIAL PRIMARY KEY,
    presupuesto_id  INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    negocio_id      INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    estado          VARCHAR(15) NOT NULL,
    autor           VARCHAR(20) NOT NULL,          -- cliente | negocio
    usuario_id      INTEGER,
    nota            TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pres_eventos ON presupuesto_eventos(presupuesto_id);
ALTER TABLE presupuesto_eventos ENABLE ROW LEVEL SECURITY;

-- ── Reservas ─────────────────────────────────────────────────
-- Estados: pendiente → confirmada → completada | ausente
--          (cancelada desde pendiente o confirmada)
CREATE TABLE IF NOT EXISTS reservas (
    id               SERIAL PRIMARY KEY,
    negocio_id       INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    servicio_id      INTEGER REFERENCES servicios(id) ON DELETE SET NULL,
    servicio_nombre  VARCHAR(150) NOT NULL,         -- foto del servicio
    cliente_nombre   VARCHAR(120) NOT NULL,
    telefono         VARCHAR(40),
    email            VARCHAR(160),
    acepta_whatsapp  BOOLEAN NOT NULL DEFAULT false,
    notas            TEXT,
    inicio           TIMESTAMPTZ NOT NULL,
    fin              TIMESTAMPTZ NOT NULL,
    estado           VARCHAR(12) NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'ausente')),
    origen           VARCHAR(10) NOT NULL DEFAULT 'cliente',   -- cliente | panel
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    CHECK (fin > inicio)
);
-- Dos turnos activos del mismo negocio no se pueden pisar, aunque lleguen
-- al mismo tiempo: lo garantiza la base.
DO $$ BEGIN
    ALTER TABLE reservas ADD CONSTRAINT reservas_sin_superposicion
        EXCLUDE USING gist (negocio_id WITH =, tstzrange(inicio, fin) WITH &&)
        WHERE (estado IN ('pendiente', 'confirmada'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_reservas_negocio ON reservas(negocio_id, inicio);
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reserva_eventos (
    id          SERIAL PRIMARY KEY,
    reserva_id  INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    negocio_id  INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    estado      VARCHAR(12) NOT NULL,
    autor       VARCHAR(20) NOT NULL,              -- cliente | negocio
    usuario_id  INTEGER,
    -- Reprogramación: horario anterior.
    inicio_anterior TIMESTAMPTZ,
    nota        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_res_eventos ON reserva_eventos(reserva_id);
ALTER TABLE reserva_eventos ENABLE ROW LEVEL SECURITY;

-- Días u horas sin atención (feriados, vacaciones).
CREATE TABLE IF NOT EXISTS agenda_bloqueos (
    id          SERIAL PRIMARY KEY,
    negocio_id  INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    desde       TIMESTAMPTZ NOT NULL,
    hasta       TIMESTAMPTZ NOT NULL,
    motivo      VARCHAR(120),
    created_at  TIMESTAMPTZ DEFAULT now(),
    CHECK (hasta > desde)
);
CREATE INDEX IF NOT EXISTS idx_bloqueos_negocio ON agenda_bloqueos(negocio_id, desde);
ALTER TABLE agenda_bloqueos ENABLE ROW LEVEL SECURITY;

-- Opciones de la agenda:
-- {"paso_min":30,"anticipacion_min":60,"dias_max":30,"confirmacion":"manual"}
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS agenda JSONB;

-- ── Permisos ─────────────────────────────────────────────────
-- presupuestos: ver y cambiar el estado (Admin y Staff).
-- cotizar: poner precio, enviar la cotización y pasarla a pedido (Admin).
-- reservas: ver y gestionar la agenda (Admin y Staff).
UPDATE roles_permisos SET permisos = permisos || '["presupuestos","reservas"]'::jsonb
WHERE rol IN ('manager', 'staff') AND NOT permisos ? 'presupuestos';
UPDATE roles_permisos SET permisos = permisos || '["cotizar"]'::jsonb
WHERE rol = 'manager' AND NOT permisos ? 'cotizar';
