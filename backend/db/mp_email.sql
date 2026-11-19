-- ══════════════════════════════════════════════════════════════
-- Migración: email de Mercado Pago de la cuenta
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: mercadopago.sql.
-- ══════════════════════════════════════════════════════════════
--
-- El cliente puede pagar con una cuenta de Mercado Pago cuyo email no es el
-- de su usuario de DinexFlow. Se guarda el último usado para precargarlo.

ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS mp_email VARCHAR(255);
