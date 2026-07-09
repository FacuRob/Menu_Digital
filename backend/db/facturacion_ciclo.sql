-- ══════════════════════════════════════════════════════════════
-- Migración: ciclo de facturación de la suscripción (mensual|anual)
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: suscripciones.sql (tabla `cuentas`).
-- ══════════════════════════════════════════════════════════════
--
-- Necesario para calcular el MRR (ingreso recurrente mensual) del
-- panel de plataforma: una cuenta anual NO suma su precio completo al
-- MRR, suma precio_anual / 12.

ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS ciclo_facturacion
    VARCHAR(10) NOT NULL DEFAULT 'mensual';

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_ciclo_facturacion;
ALTER TABLE cuentas ADD CONSTRAINT chk_ciclo_facturacion
    CHECK (ciclo_facturacion IN ('mensual', 'anual'));
