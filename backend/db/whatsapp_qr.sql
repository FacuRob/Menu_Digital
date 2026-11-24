-- Migración: WhatsApp común conectado con código QR (Evolution API). Idempotente.
-- El local lo conecta desde el panel (WhatsApp → "Conectar con código QR").
-- Es la alternativa al número propio de Meta (whatsapp_cuentas): un local
-- usa uno u otro, no los dos.

CREATE TABLE IF NOT EXISTS whatsapp_qr (
  negocio_id      INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  instancia       VARCHAR(60) NOT NULL UNIQUE,   -- nombre de la instancia en Evolution
  telefono        VARCHAR(40),                   -- número vinculado, ej. "5493815052050"
  nombre_visible  VARCHAR(120),                  -- nombre del perfil de WhatsApp
  estado          VARCHAR(20) NOT NULL DEFAULT 'vinculando', -- vinculando | conectado | desconectado
  conectado_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_qr ENABLE ROW LEVEL SECURITY;
