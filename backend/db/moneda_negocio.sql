-- ══════════════════════════════════════════════════════════════
-- Migración: moneda por negocio (para el menú público)
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: la tabla `configuracion`.
-- ══════════════════════════════════════════════════════════════
--
-- Cada negocio elige en qué moneda muestra los precios del menú.
-- No hay conversión: los precios se cargan y muestran en esta moneda.

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS moneda
    VARCHAR(3) NOT NULL DEFAULT 'ARS';
