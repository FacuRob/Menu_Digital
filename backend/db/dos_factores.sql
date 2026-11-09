-- ══════════════════════════════════════════════════════════════
-- Migración: verificación en dos pasos (2FA con app de autenticación)
-- Idempotente. Ejecutar en Supabase (SQL Editor) ANTES de publicar el código.
-- ══════════════════════════════════════════════════════════════
--
--   totp_secreto      → secreto TOTP cifrado (AES-256-GCM, ver utils/dosFactores.js)
--   totp_activo       → si el usuario tiene el 2FA encendido
--   totp_respaldo     → hashes SHA-256 de los códigos de respaldo sin usar
--   totp_ultimo_paso  → último paso de 30 s usado (evita reusar un código)

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_secreto     TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_activo      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_respaldo    JSONB;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS totp_ultimo_paso BIGINT;
