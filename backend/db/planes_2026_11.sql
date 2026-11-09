-- ════════════════════════════════════════════════════════════
-- Migración: planes nuevos (2026-11-09)
--   · Básico:   1 negocio,  50 productos.
--   · Estándar: 3 negocios, 180 productos repartidos entre los negocios
--               (180 con 1, 90 con 2, 60 con 3), WhatsApp (avisos, chats),
--               bot con IA y mapa del repartidor.
--   · Premium:  5 negocios, 1000 productos repartidos entre los negocios
--               (1000, 500, 334/333, 250, 200), todo lo del Estándar.
--
-- Desde ahora `limite_productos` guarda el TOTAL de la cuenta; el reparto
-- por negocio lo calcula el backend (cupoPorNegocio).
--   · Prueba gratis (15 días): igual que el Estándar (lo decide el backend).
--
-- El backend ya aplica estos límites según tipo_plan aunque esta migración
-- no se haya corrido; acá se dejan guardados igual en `cuentas` para que la
-- base diga lo mismo. Las cuentas que ya superan el límite conservan lo que
-- tienen, pero no pueden crear más. Se puede correr más de una vez.
-- ════════════════════════════════════════════════════════════

-- Premium pasa a 5 negocios: el CHECK viejo sólo aceptaba 1, 3, 10 y 9999.
ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_limite_negocios;
ALTER TABLE cuentas ADD CONSTRAINT chk_limite_negocios
    CHECK (limite_negocios IN (1, 3, 5, 10, 9999));

ALTER TABLE cuentas DROP CONSTRAINT IF EXISTS chk_limite_productos;
ALTER TABLE cuentas ADD CONSTRAINT chk_limite_productos
    CHECK (limite_productos IN (10, 50, 60, 100, 120, 180, 200, 1000, 9999));

CREATE OR REPLACE FUNCTION set_limites_por_plan()
RETURNS TRIGGER AS $$
BEGIN
    NEW.limite_negocios := CASE NEW.tipo_plan
        WHEN 'free'     THEN 1
        WHEN 'basic'    THEN 1
        WHEN 'standard' THEN 3
        WHEN 'premium'  THEN 5
        ELSE 1
    END;
    NEW.limite_productos := CASE NEW.tipo_plan
        WHEN 'free'     THEN 10
        WHEN 'basic'    THEN 50
        WHEN 'standard' THEN 180
        WHEN 'premium'  THEN 1000
        ELSE 10
    END;
    NEW.suscripcion_actualizada_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- El trigger solo corre al cambiar tipo_plan: actualizar las cuentas existentes.
UPDATE cuentas SET
    limite_negocios = CASE tipo_plan
        WHEN 'basic' THEN 1 WHEN 'standard' THEN 3 WHEN 'premium' THEN 5 ELSE 1 END,
    limite_productos = CASE tipo_plan
        WHEN 'basic' THEN 50 WHEN 'standard' THEN 180 WHEN 'premium' THEN 1000 ELSE 10 END;

-- Para revisar: cuentas que hoy superan su nuevo límite de productos (total).
-- SELECT c.id, c.nombre, c.tipo_plan, count(p.id) AS productos
-- FROM cuentas c JOIN negocios n ON n.cuenta_id = c.id JOIN productos p ON p.negocio_id = n.id
-- GROUP BY c.id HAVING count(p.id) > c.limite_productos;

-- Para revisar: cuentas que hoy superan su nuevo límite de negocios.
-- SELECT c.id, c.nombre, c.tipo_plan, count(n.id) AS negocios
-- FROM cuentas c JOIN negocios n ON n.cuenta_id = c.id
-- GROUP BY c.id HAVING count(n.id) > c.limite_negocios;
