-- ══════════════════════════════════════════════════════════════
-- Migración: vincular usuarios a cuentas + soporte Webhook Hotmart
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: suscripciones.sql (tabla `cuentas`).
-- ══════════════════════════════════════════════════════════════

-- ── usuarios.cuenta_id → a qué cuenta (suscriptor) pertenece ─
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cuenta_id
    INTEGER DEFAULT 1 REFERENCES cuentas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_usuarios_cuenta ON usuarios(cuenta_id);

-- Los usuarios existentes quedan bajo la cuenta principal.
UPDATE usuarios SET cuenta_id = 1 WHERE cuenta_id IS NULL;

-- ── Email único en cuentas → permite upsert por email ────────
-- (Postgres permite múltiples NULL, así que la cuenta 1 sin email no molesta.)
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS uq_cuentas_email;
ALTER TABLE cuentas ADD CONSTRAINT uq_cuentas_email UNIQUE (email);

-- ── Auditoría del origen de la cuenta ────────────────────────
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS origen VARCHAR(30) DEFAULT 'manual';
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS hotmart_transaction VARCHAR(120);
