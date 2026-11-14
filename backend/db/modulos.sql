-- ══════════════════════════════════════════════════════════════
-- Migración: módulos por negocio (Etapa 3)
-- Idempotente. Ejecutar en Supabase (SQL Editor).
-- Depende de: rubros_onboarding.sql (columna negocios.onboarding).
-- El código funciona aunque no corra (sin la columna, todos los negocios
-- tienen el perfil de siempre), pero sin ella no se pueden guardar módulos.
-- ══════════════════════════════════════════════════════════════
--
-- modulos: {"catalogo":true,"productos":true,"pedidos":true,...}
-- El registro de módulos y sus dependencias vive en backend/src/utils/modulos.js.
-- NULL = el perfil de siempre (catálogo, productos, pedidos, carrito,
-- entregas y estadísticas). Igual se completa explícito para los negocios
-- existentes, así queda a la vista qué usa cada uno.

ALTER TABLE negocios ADD COLUMN IF NOT EXISTS modulos JSONB;

UPDATE negocios
SET modulos = '{"catalogo":true,"productos":true,"personalizados":false,"servicios":false,"pedidos":true,"carrito":true,"entregas":true,"presupuestos":false,"reservas":false,"clientes":false,"estadisticas":true}'::jsonb
WHERE modulos IS NULL
  -- Los que están haciendo el onboarding nuevo toman sus módulos de ahí.
  AND (onboarding IS NULL OR (onboarding->>'completado')::boolean IS TRUE);
