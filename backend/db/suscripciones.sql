-- ══════════════════════════════════════════════════════════════
-- Migración: Suscripciones SaaS (cuentas + planes + límites)
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: multitenant_stock.sql (tabla `negocios`).
-- ══════════════════════════════════════════════════════════════
--
-- Modelo:
--   cuentas  = el SUSCRIPTOR que paga (dueño). Tiene el plan.
--   negocios = cada local/menú. Un negocio pertenece a UNA cuenta.
--
-- El plan define DOS límites:
--   limite_negocios  → cuántos negocios (multi-tenant) puede tener la cuenta.
--   limite_productos → cuántos productos por negocio.
--
--   plan      | limite_negocios | limite_productos
--   ----------|-----------------|-----------------
--   free      |        1        |        10
--   basic     |        3        |        50
--   standard  |       10        |       100
--   premium   |     9999        |      9999
-- ══════════════════════════════════════════════════════════════

-- ── Tabla: cuentas (suscriptores) ────────────────────────────
CREATE TABLE IF NOT EXISTS cuentas (
    id                 SERIAL PRIMARY KEY,
    nombre             VARCHAR(150) NOT NULL,
    email              VARCHAR(255),
    tipo_plan          VARCHAR(20) NOT NULL DEFAULT 'free',
    estado_suscripcion VARCHAR(20) NOT NULL DEFAULT 'activo',
    -- Límites derivados del plan (los mantiene el trigger de abajo).
    limite_negocios    INTEGER NOT NULL DEFAULT 1,
    limite_productos   INTEGER NOT NULL DEFAULT 10,
    suscripcion_actualizada_at TIMESTAMPTZ DEFAULT now(),
    created_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cuentas DISABLE ROW LEVEL SECURITY;

-- Validaciones (idempotentes).
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_tipo_plan;
ALTER TABLE cuentas ADD CONSTRAINT chk_tipo_plan
    CHECK (tipo_plan IN ('free', 'basic', 'standard', 'premium'));

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_estado_suscripcion;
ALTER TABLE cuentas ADD CONSTRAINT chk_estado_suscripcion
    CHECK (estado_suscripcion IN ('activo', 'cancelado'));

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_limite_negocios;
ALTER TABLE cuentas ADD CONSTRAINT chk_limite_negocios
    CHECK (limite_negocios IN (1, 3, 10, 9999));

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_limite_productos;
ALTER TABLE cuentas ADD CONSTRAINT chk_limite_productos
    CHECK (limite_productos IN (10, 50, 100, 9999));

CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON cuentas(estado_suscripcion);

-- ── Trigger: derivar límites desde tipo_plan ─────────────────
-- El backend sólo setea `tipo_plan`; los límites se calculan solos.
CREATE OR REPLACE FUNCTION set_limites_por_plan()
RETURNS TRIGGER AS $$
BEGIN
    NEW.limite_negocios := CASE NEW.tipo_plan
        WHEN 'free'     THEN 1
        WHEN 'basic'    THEN 3
        WHEN 'standard' THEN 10
        WHEN 'premium'  THEN 9999
        ELSE 1
    END;
    NEW.limite_productos := CASE NEW.tipo_plan
        WHEN 'free'     THEN 10
        WHEN 'basic'    THEN 50
        WHEN 'standard' THEN 100
        WHEN 'premium'  THEN 9999
        ELSE 10
    END;
    NEW.suscripcion_actualizada_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_limites_por_plan ON cuentas;
CREATE TRIGGER trg_set_limites_por_plan
    BEFORE INSERT OR UPDATE OF tipo_plan ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION set_limites_por_plan();

-- ── Cuenta inicial (dueña de todos los datos actuales) ───────
-- Se crea en 'premium' para NO romper deployments que ya tengan
-- varios negocios. Bajala de plan luego si corresponde.
INSERT INTO cuentas (id, nombre, tipo_plan)
VALUES (1, 'Cuenta principal', 'premium')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('cuentas', 'id'),
    GREATEST((SELECT MAX(id) FROM cuentas), 1)
);

-- ── negocios.cuenta_id → a qué cuenta pertenece cada negocio ─
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS cuenta_id
    INTEGER NOT NULL DEFAULT 1 REFERENCES cuentas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_negocios_cuenta ON negocios(cuenta_id);

-- Backfill defensivo: negocios existentes quedan bajo la cuenta 1.
UPDATE negocios SET cuenta_id = 1 WHERE cuenta_id IS NULL;
