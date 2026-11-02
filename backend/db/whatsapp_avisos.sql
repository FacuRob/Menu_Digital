-- Migración: WhatsApp (Fase 1 avisos + Fase 2 chats + Fase 3 IA). Idempotente: se puede correr más de una vez.
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

-- ── Fase 2: chats (mensajes entrantes y respuestas desde el panel) ──
-- 4) whatsapp_chats → una conversación por negocio y teléfono.
-- 5) whatsapp_mensajes pasa a guardar también los mensajes que escribe el
--    cliente (direccion = 'entrante') y el texto de cada mensaje.

CREATE TABLE IF NOT EXISTS whatsapp_chats (
    id                 BIGSERIAL PRIMARY KEY,
    negocio_id         INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    telefono           VARCHAR(30) NOT NULL,     -- normalizado: 54 + 10 dígitos
    nombre             VARCHAR(120),             -- nombre del perfil de WhatsApp o del pedido
    ultimo_texto       TEXT,
    ultimo_at          TIMESTAMPTZ,
    ultimo_entrante_at TIMESTAMPTZ,              -- abre la ventana de 24 h para responder
    no_leidos          INTEGER NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (negocio_id, telefono)
);

CREATE INDEX IF NOT EXISTS idx_wa_chats_negocio ON whatsapp_chats(negocio_id, ultimo_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_chats_telefono ON whatsapp_chats(telefono);

ALTER TABLE whatsapp_mensajes ADD COLUMN IF NOT EXISTS chat_id   BIGINT REFERENCES whatsapp_chats(id) ON DELETE CASCADE;
ALTER TABLE whatsapp_mensajes ADD COLUMN IF NOT EXISTS direccion VARCHAR(10) NOT NULL DEFAULT 'saliente'; -- saliente|entrante
ALTER TABLE whatsapp_mensajes ADD COLUMN IF NOT EXISTS texto     TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_mensajes_chat ON whatsapp_mensajes(chat_id, created_at);

ALTER TABLE whatsapp_chats ENABLE ROW LEVEL SECURITY;

-- ── Fase 3: asistente con IA que responde los chats ──
-- 6) whatsapp_ia → si el negocio activó el asistente y sus indicaciones extra.
-- 7) whatsapp_chats → la IA se pausa en un chat cuando responde una persona
--    o cuando la IA lo deriva (necesita_humano).
-- 8) whatsapp_mensajes.autor → quién escribió un mensaje saliente
--    (negocio | ia | aviso).

CREATE TABLE IF NOT EXISTS whatsapp_ia (
    negocio_id    INTEGER PRIMARY KEY REFERENCES negocios(id) ON DELETE CASCADE,
    activo        BOOLEAN NOT NULL DEFAULT false,
    instrucciones TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_chats    ADD COLUMN IF NOT EXISTS ia_pausada_hasta TIMESTAMPTZ;
ALTER TABLE whatsapp_chats    ADD COLUMN IF NOT EXISTS necesita_humano  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE whatsapp_mensajes ADD COLUMN IF NOT EXISTS autor            VARCHAR(10);

ALTER TABLE whatsapp_ia ENABLE ROW LEVEL SECURITY;
