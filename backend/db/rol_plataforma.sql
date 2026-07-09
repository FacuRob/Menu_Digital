-- ══════════════════════════════════════════════════════════════
-- Migración: rol de plataforma (god-mode cross-cuenta) para el dueño
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: hotmart_usuarios.sql (usuarios.cuenta_id).
-- ══════════════════════════════════════════════════════════════
--
-- es_plataforma = true → el usuario ve/gestiona TODAS las cuentas
-- (bypass del aislamiento por cuenta_id). Reservalo SOLO para vos.
-- Un superadmin normal (cliente Hotmart) queda con es_plataforma = false
-- y sigue aislado a su propia cuenta.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_plataforma
    BOOLEAN NOT NULL DEFAULT false;

-- ── Marcá TU usuario como plataforma ─────────────────────────
-- Ajustá el WHERE a tu usuario real. Por defecto marca al usuario
-- original (id = 1) de la cuenta principal. Podés usar username o email:
--   UPDATE usuarios SET es_plataforma = true WHERE username = 'tu_usuario';
--   UPDATE usuarios SET es_plataforma = true WHERE email = 'roblesfacundo7@gmail.com';
UPDATE usuarios SET es_plataforma = true WHERE id = 1;
