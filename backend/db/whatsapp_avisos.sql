-- Migración: avisos de pedido por WhatsApp (Fase 1). Idempotente.
--
-- 1) pedidos.acepta_whatsapp → el cliente marcó "avisarme por WhatsApp" (opt-in
--    que exige Meta para mensajes iniciados por el negocio).
-- 2) whatsapp_avisos         → configuración de avisos por negocio.
-- 3) whatsapp_mensajes       → registro de cada mensaje enviado y su estado
--    (enviado / entregado / leído / fallido), que actualiza el webhook de Meta.
--
-- Estados de pedido: la columna pedidos.estado es VARCHAR sin CHECK, así que
-- los nuevos estados 'listo' (para retirar) y 'en_camino' (delivery) no
-- requieren cambios de esquema.

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS acepta_whatsapp BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS whatsapp_avisos (
    negocio_id  INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
    activo      BOOLEAN NOT NULL DEFAULT false,
    -- { "pendiente": true, "preparando": true, "en_camino": true, ... }
    estados     JSONB   NOT NULL DEFAULT '{}'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_mensajes (
    id          BIGSERIAL PRIMARY KEY,
    negocio_id  INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    pedido_id   INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
    telefono    VARCHAR(30) NOT NULL,
    aviso       VARCHAR(30),           -- estado del pedido que disparó el aviso (o 'prueba')
    plantilla   VARCHAR(80),
    estado      VARCHAR(20) NOT NULL DEFAULT 'enviado', -- enviado|entregado|leido|fallido
    error       TEXT,
    meta_id     VARCHAR(120),          -- id del mensaje en WhatsApp (wamid…)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_mensajes_negocio ON whatsapp_mensajes(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_mensajes_meta_id ON whatsapp_mensajes(meta_id);

-- El backend usa la service role key (no pasa por RLS), igual que el resto
-- de las tablas. Se habilita RLS sin políticas para que nadie más las lea.
ALTER TABLE whatsapp_avisos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_mensajes ENABLE ROW LEVEL SECURITY;
