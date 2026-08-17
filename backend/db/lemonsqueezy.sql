-- ══════════════════════════════════════════════════════════════
-- Migración: Lemon Squeezy + Free trial con vencimiento
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: suscripciones.sql, facturacion_ciclo.sql, hotmart_usuarios.sql.
-- ══════════════════════════════════════════════════════════════
--
-- Modelo de estados de suscripción:
--   trial     → período de prueba gratuito. Acceso completo hasta periodo_fin.
--   activo    → suscripción paga vigente.
--   cancelado → cancelada pero con acceso hasta periodo_fin (fin del ciclo pago).
--   vencido   → sin acceso (trial terminado o pago vencido/impago).
--
-- `periodo_fin` marca cuándo termina el período actual (trial o ciclo pago).
-- La lógica de "vigencia" vive en el backend (utils/suscripcion.js).

-- ── Estados: agregar 'trial' y 'vencido' al CHECK ────────────
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_estado_suscripcion;
ALTER TABLE cuentas ADD CONSTRAINT chk_estado_suscripcion
    CHECK (estado_suscripcion IN ('trial', 'activo', 'cancelado', 'vencido'));

-- ── Fin del período actual (trial o ciclo pago) ─────────────
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS periodo_fin TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cuentas_periodo_fin ON cuentas(periodo_fin);

-- ── Nuevas cuentas arrancan en trial ────────────────────────
-- (No afecta a las cuentas existentes, solo a las que se creen de acá en más.)
-- Los 14 días son el fallback de BD; el backend usa FREE_TRIAL_DAYS del env
-- cuando crea la cuenta explícitamente. Mantené ambos valores alineados.
ALTER TABLE cuentas ALTER COLUMN estado_suscripcion SET DEFAULT 'trial';
ALTER TABLE cuentas ALTER COLUMN periodo_fin SET DEFAULT (now() + interval '14 days');

-- ── Columnas de Lemon Squeezy ───────────────────────────────
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS ls_customer_id     VARCHAR(60);
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS ls_subscription_id VARCHAR(60);
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS ls_variant_id      VARCHAR(60);
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS ls_status          VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_cuentas_ls_sub ON cuentas(ls_subscription_id);

-- ── Grandfathering de cuentas existentes ────────────────────
-- Las cuentas que ya existían (creadas antes de esta migración) quedan
-- 'activo' sin vencimiento para no bloquear a nadie retroactivamente.
UPDATE cuentas
   SET estado_suscripcion = 'activo'
 WHERE estado_suscripcion NOT IN ('trial', 'activo', 'cancelado', 'vencido');

-- La cuenta principal (id = 1) nunca vence.
UPDATE cuentas SET estado_suscripcion = 'activo', periodo_fin = NULL WHERE id = 1;
