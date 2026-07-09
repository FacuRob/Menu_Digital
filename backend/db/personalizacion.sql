-- ══════════════════════════════════════════════════════════════
-- Migración: color, horarios estructurados y teléfono del cliente
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- ══════════════════════════════════════════════════════════════

-- Color primario del menú (paleta elegida por el dueño).
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS color_primario VARCHAR(20) DEFAULT '#ff5722';

-- Horarios estructurados por día (JSON).
-- Formato: [{ "cerrado": false, "franjas": [{"desde":"09:00","hasta":"13:00"}, ...] }, ... x7]
-- Índice 0 = Lunes ... 6 = Domingo.
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS horarios_config JSONB;

-- Teléfono del cliente para pedidos de retiro/delivery.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS telefono_cliente VARCHAR(50);
