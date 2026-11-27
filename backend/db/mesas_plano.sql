-- Migración: gestión de mesas (plano del local + mesas ocupadas). Idempotente.
--
-- mesas_plano: dibujo del local que arma el dueño en "Mesas" (pisos, zonas
-- interior/exterior y dónde va cada mesa). NULL = sin plano (el panel muestra
-- las mesas en una grilla).
--
-- mesas_estado: una fila por mesa ocupada. Se crea cuando el cliente escanea
-- el QR de la mesa (o cuando pide) y se borra al cerrar o liberar la mesa.
-- Sin esta tabla el panel igual muestra ocupadas las mesas con pedidos en curso.

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS mesas_plano JSONB;

CREATE TABLE IF NOT EXISTS mesas_estado (
  negocio_id    INTEGER     NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
  mesa          TEXT        NOT NULL,
  ocupada_desde TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (negocio_id, mesa)
);

-- Sólo el backend (service role) la usa.
ALTER TABLE mesas_estado ENABLE ROW LEVEL SECURITY;
