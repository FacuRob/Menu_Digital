-- ══════════════════════════════════════════════════════════════
-- Migración: soporte (reportes de los clientes al dueño del sistema).
-- Idempotente. Ejecutar en Supabase (SQL Editor).
-- Depende de: suscripciones.sql (cuentas) y schema.sql (usuarios).
-- ══════════════════════════════════════════════════════════════
--
-- Un ticket por problema. Cada ticket es una conversación entre la cuenta
-- del cliente y el usuario Tech (es_plataforma). Las capturas se guardan en
-- Cloudinary; acá sólo queda su URL.

CREATE TABLE IF NOT EXISTS soporte_tickets (
    id               BIGSERIAL PRIMARY KEY,
    cuenta_id        INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
    usuario_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    tipo             TEXT NOT NULL CHECK (tipo IN ('error', 'pago', 'duda', 'sugerencia')),
    asunto           TEXT NOT NULL CHECK (char_length(asunto) BETWEEN 1 AND 120),
    estado           TEXT NOT NULL DEFAULT 'abierto'
                     CHECK (estado IN ('abierto', 'en_curso', 'resuelto')),
    -- "Sin leer" de cada lado: lo prende el mensaje del otro lado.
    sin_leer_tech    BOOLEAN NOT NULL DEFAULT true,
    sin_leer_cliente BOOLEAN NOT NULL DEFAULT false,
    ultimo_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soporte_tickets_cuenta
    ON soporte_tickets (cuenta_id, ultimo_at DESC);
CREATE INDEX IF NOT EXISTS idx_soporte_tickets_ultimo
    ON soporte_tickets (ultimo_at DESC);

CREATE TABLE IF NOT EXISTS soporte_mensajes (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   BIGINT NOT NULL REFERENCES soporte_tickets(id) ON DELETE CASCADE,
    usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    de_tech     BOOLEAN NOT NULL DEFAULT false,
    texto       TEXT CHECK (char_length(texto) <= 4000),
    imagen_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (texto IS NOT NULL OR imagen_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_soporte_mensajes_ticket
    ON soporte_mensajes (ticket_id, id);

-- El backend usa la service role (no le afecta). Con RLS prendido y sin
-- políticas, nadie puede leer estas tablas con la clave pública.
ALTER TABLE soporte_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE soporte_mensajes ENABLE ROW LEVEL SECURITY;
