-- Migración: seguimiento del delivery en el mapa. Idempotente.
-- Última ubicación que mandó el repartidor desde su link (/reparto/<id>).
-- Sin estas columnas todo funciona igual, pero el mapa del cliente no
-- muestra la moto.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS repartidor_lat DOUBLE PRECISION;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS repartidor_lng DOUBLE PRECISION;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS repartidor_at  TIMESTAMPTZ;
