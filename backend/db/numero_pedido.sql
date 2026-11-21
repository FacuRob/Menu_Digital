-- Migración: número de pedido propio de cada negocio (1, 2, 3…).
-- El `id` de pedidos es global (lo comparten todos los negocios) y queda
-- sólo para uso interno: links firmados, API y logs. Lo que ven el negocio,
-- el cliente, WhatsApp y la IA es `numero`. Idempotente.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero INTEGER;

-- Último número usado por negocio. Lo toca sólo el trigger (RLS sin
-- políticas: la API pública no lo ve).
CREATE TABLE IF NOT EXISTS pedidos_contador (
    negocio_id INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
    ultimo     INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE pedidos_contador ENABLE ROW LEVEL SECURITY;

-- Renumera los pedidos existentes por fecha dentro de cada negocio.
WITH orden AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY negocio_id ORDER BY created_at, id) AS n
      FROM pedidos
)
UPDATE pedidos p
   SET numero = orden.n
  FROM orden
 WHERE p.id = orden.id
   AND p.numero IS DISTINCT FROM orden.n
   AND NOT EXISTS (SELECT 1 FROM pedidos_contador); -- sólo la primera vez

-- El contador arranca en el último número de cada negocio.
INSERT INTO pedidos_contador (negocio_id, ultimo)
SELECT negocio_id, MAX(numero) FROM pedidos WHERE numero IS NOT NULL GROUP BY negocio_id
ON CONFLICT (negocio_id) DO UPDATE SET ultimo = GREATEST(pedidos_contador.ultimo, EXCLUDED.ultimo);

-- Cada pedido nuevo toma el siguiente número de su negocio. El upsert es
-- atómico: dos pedidos simultáneos nunca reciben el mismo número.
CREATE OR REPLACE FUNCTION asignar_numero_pedido() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero IS NULL AND NEW.negocio_id IS NOT NULL THEN
        INSERT INTO pedidos_contador (negocio_id, ultimo)
        VALUES (NEW.negocio_id, 1)
        ON CONFLICT (negocio_id) DO UPDATE SET ultimo = pedidos_contador.ultimo + 1
        RETURNING ultimo INTO NEW.numero;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_numero_pedido ON pedidos;
CREATE TRIGGER trg_numero_pedido
    BEFORE INSERT ON pedidos
    FOR EACH ROW EXECUTE FUNCTION asignar_numero_pedido();

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_negocio_numero ON pedidos (negocio_id, numero);
