-- ══════════════════════════════════════════════════════════════
-- Etapa 9 — Registro de cambios (auditoría). Idempotente.
-- Acciones importantes del panel que no tienen historial propio:
-- módulos, usuarios, productos borrados y "Ver como el cliente" de Soporte
-- (presupuestos y turnos ya guardan sus eventos en sus propias tablas).
-- Lo escribe sólo el backend (service role): RLS sin políticas.
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS registro_cambios (
  id          BIGSERIAL PRIMARY KEY,
  cuenta_id   INTEGER,
  negocio_id  INTEGER,
  usuario_id  INTEGER,
  tech_id     INTEGER,          -- Soporte DinexFlow mirando la cuenta
  accion      VARCHAR(40)  NOT NULL,
  entidad     VARCHAR(40)  NOT NULL,
  entidad_id  VARCHAR(40),
  detalle     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registro_cambios_cuenta ON registro_cambios (cuenta_id, created_at DESC);
ALTER TABLE registro_cambios ENABLE ROW LEVEL SECURITY;
