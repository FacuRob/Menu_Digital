-- ══════════════════════════════════════════════════════════════
-- Migración: Mercado Pago (suscripción mensual en ARS) + planes 2026-11
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: suscripciones.sql, facturacion_ciclo.sql, lemonsqueezy.sql.
-- ══════════════════════════════════════════════════════════════
--
-- Cambios:
--   · Cobro por Mercado Pago (preapproval = suscripción con débito mensual).
--   · Solo plan mensual (se elimina el anual).
--   · Standard pasa de 100 a 120 productos por negocio.
--   · Prueba gratis de 15 días (antes 14).

-- ── Columnas de Mercado Pago ────────────────────────────────
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS mp_preapproval_id VARCHAR(64);
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS mp_status         VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_cuentas_mp_preapproval ON cuentas(mp_preapproval_id);

-- ── Solo mensual ────────────────────────────────────────────
UPDATE cuentas SET ciclo_facturacion = 'mensual' WHERE ciclo_facturacion <> 'mensual';
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_ciclo_facturacion;
ALTER TABLE cuentas ADD CONSTRAINT chk_ciclo_facturacion
    CHECK (ciclo_facturacion = 'mensual');

-- ── Standard: 120 productos por negocio ─────────────────────
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_limite_productos;
ALTER TABLE cuentas ADD CONSTRAINT chk_limite_productos
    CHECK (limite_productos IN (10, 50, 100, 120, 9999));

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
        WHEN 'standard' THEN 120
        WHEN 'premium'  THEN 9999
        ELSE 10
    END;
    NEW.suscripcion_actualizada_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger solo corre al cambiar tipo_plan: actualizar las cuentas Standard existentes.
UPDATE cuentas SET limite_productos = 120 WHERE tipo_plan = 'standard';

-- ── Prueba gratis: 15 días (fallback de BD; el backend usa FREE_TRIAL_DAYS) ──
ALTER TABLE cuentas ALTER COLUMN periodo_fin SET DEFAULT (now() + interval '15 days');
