-- Migración: número de WhatsApp propio de cada local. Idempotente.
-- El local lo conecta desde el panel (WhatsApp → "Conectar mi WhatsApp",
-- Embedded Signup de Meta). Sin fila, el local usa el número de la plataforma.

CREATE TABLE IF NOT EXISTS whatsapp_cuentas (
  negocio_id       INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
  waba_id          VARCHAR(40) NOT NULL,
  phone_number_id  VARCHAR(40) NOT NULL UNIQUE,
  telefono         VARCHAR(40),            -- número visible, ej. "+54 9 381 505-2050"
  nombre_visible   VARCHAR(120),           -- nombre verificado en WhatsApp
  token_cifrado    TEXT NOT NULL,          -- token del negocio (AES-256-GCM)
  coexistencia     BOOLEAN NOT NULL DEFAULT false, -- también usa la app WhatsApp Business
  estado           VARCHAR(20) NOT NULL DEFAULT 'conectado', -- conectado | desconectado
  conectado_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_cuentas ENABLE ROW LEVEL SECURITY;
