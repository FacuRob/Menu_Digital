-- Migración: fecha de entrega dedicada para pedidos.
-- Permite que las analíticas cuenten la venta en el mes en que se
-- entregó el pedido (no en el que se creó). Idempotente.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMPTZ;

-- Para pedidos ya entregados sin timestamp, usar updated_at como mejor
-- aproximación disponible (evita que queden fuera de las métricas).
UPDATE pedidos
   SET entregado_at = updated_at
 WHERE estado = 'entregado'
   AND entregado_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pedidos_entregado_at ON pedidos(entregado_at);
