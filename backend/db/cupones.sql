-- ══════════════════════════════════════════════════════════════
-- Migración: cupones de descuento para la suscripción
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: mercadopago.sql.
-- ══════════════════════════════════════════════════════════════
--
-- El Tech genera cupones (X % durante N meses). El dueño de una cuenta lo
-- canjea en Suscripción: el cupón queda usado (por esa cuenta) y la cuenta
-- paga con descuento los próximos N cobros mensuales.

CREATE TABLE IF NOT EXISTS cupones (
    id                   SERIAL PRIMARY KEY,
    codigo               VARCHAR(32) NOT NULL UNIQUE,
    porcentaje           INTEGER NOT NULL CHECK (porcentaje BETWEEN 1 AND 90),
    meses                INTEGER NOT NULL CHECK (meses BETWEEN 1 AND 24),
    creado_por           INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    usado_por_cuenta_id  INTEGER REFERENCES cuentas(id) ON DELETE SET NULL,
    usado_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cupones_usado ON cupones(usado_por_cuenta_id);

-- Descuento vigente de la cuenta. descuento_meses_restantes baja con cada
-- cobro mensual aprobado; en 0 el precio vuelve al normal.
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS descuento_pct              INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS descuento_meses_restantes  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS cupon_id                   INTEGER REFERENCES cupones(id) ON DELETE SET NULL;
-- Último cobro mensual procesado (MP puede repetir el aviso: no descontar dos veces).
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS mp_ultimo_cobro_id         VARCHAR(64);

-- Solo el backend (service role) accede a la tabla.
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
