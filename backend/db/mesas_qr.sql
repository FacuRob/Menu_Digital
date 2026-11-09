-- Migración: versión de los QR de mesa. Idempotente.
-- La firma de cada QR de mesa incluye esta versión. "Regenerar QR de mesas"
-- en el panel la sube y así anula todos los QR impresos de ese local.
-- Sin esta columna los QR funcionan igual (versión 1), pero no se pueden regenerar.

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS mesas_qr_version INTEGER NOT NULL DEFAULT 1;
