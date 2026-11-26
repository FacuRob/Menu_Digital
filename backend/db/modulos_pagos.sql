-- ════════════════════════════════════════════════════════════
-- Migración: módulos que se suman al plan + precios nuevos (2026-11-26)
--
-- Precios nuevos por mes: Básico $22.000, Estándar $44.000, Premium $72.000.
-- Módulos para sumar al Básico (en Estándar y Premium vienen incluidos):
--   WhatsApp $12.000 · Asistente con IA $11.000 (pide WhatsApp) · Mapa del
--   repartidor $6.000. Los precios viven en backend/src/utils/planPrecios.js.
--
--   · modulos_pagos: módulos sumados por la cuenta, p. ej.
--       {"whatsapp": {"desde": "2026-11-26T12:00:00Z", "cobrado": true, "baja_en": null}}
--     desde   = cuándo se sumó.
--     cobrado = ya entró en al menos un cobro de Mercado Pago.
--     baja_en = se pidió quitar: se usa hasta esa fecha (null = sigue).
--   · precio_plan_fijo: "precio de fundador". Quien ya pagaba antes de este
--     cambio sigue pagando lo mismo mientras no cambie de plan. null = precio
--     de lista.
--
-- CORRER ANTES DE PUBLICAR el backend: sin precio_plan_fijo, el primer
-- cambio de monto en Mercado Pago le cobraría el precio nuevo a quien ya
-- pagaba. Se puede correr más de una vez.
-- ════════════════════════════════════════════════════════════

ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS modulos_pagos JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS precio_plan_fijo INTEGER;
-- Sube en cada cambio de modulos_pagos: el backend guarda sólo si nadie lo
-- cambió desde que lo leyó (el webhook de cobro y "Sumar/Quitar" no se pisan).
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS modulos_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_precio_plan_fijo;
ALTER TABLE cuentas ADD CONSTRAINT chk_precio_plan_fijo
    CHECK (precio_plan_fijo IS NULL OR precio_plan_fijo > 0);

-- Precio de fundador: toda cuenta con una suscripción de Mercado Pago
-- conserva el precio de antes (también vencidas o pausadas: si MP la
-- reactiva, sigue con el mismo monto).
UPDATE cuentas
SET precio_plan_fijo = CASE tipo_plan
        WHEN 'basic' THEN 20000
        WHEN 'standard' THEN 41000
        WHEN 'premium' THEN 65000
    END
WHERE precio_plan_fijo IS NULL
  AND mp_preapproval_id IS NOT NULL
  AND tipo_plan IN ('basic', 'standard', 'premium');

-- Para revisar quiénes quedaron con precio de fundador:
-- SELECT id, nombre, tipo_plan, estado_suscripcion, precio_plan_fijo
-- FROM cuentas WHERE precio_plan_fijo IS NOT NULL ORDER BY id;
