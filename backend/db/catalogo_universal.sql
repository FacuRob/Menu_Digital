-- ══════════════════════════════════════════════════════════════
-- Migración: catálogo universal (Etapa 4)
-- Idempotente. Ejecutar en Supabase (SQL Editor).
-- Depende de: venta_por_peso.sql (pedido_items.unidad), modulos.sql.
--
-- 1. producto_campos: campos que completa el cliente (personalización).
-- 2. pedido_items.opciones / personalizacion: foto histórica de lo comprado.
-- 3. adjuntos: archivos que sube el cliente (privados en Cloudinary).
-- 4. servicios: entidad aparte de productos.
-- 5. crear_pedido(): pedido + ítems + stock + adjuntos en una transacción.
--
-- El código funciona aunque no corra (sin personalización ni servicios, y el
-- pedido se guarda como hasta ahora).
-- ══════════════════════════════════════════════════════════════

-- ── 1. Campos de personalización por producto ────────────────
-- tipo: texto | texto_largo | numero | opcion | multiple | color | archivo
-- opciones: ["Rojo","Azul"] (opcion, multiple, color)
-- validaciones: {"max_largo":40,"min":1,"max":10,"tipos":["imagen","pdf","3d"]}
CREATE TABLE IF NOT EXISTS producto_campos (
    id           SERIAL PRIMARY KEY,
    producto_id  INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    negocio_id   INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    tipo         VARCHAR(20) NOT NULL
                 CHECK (tipo IN ('texto', 'texto_largo', 'numero', 'opcion', 'multiple', 'color', 'archivo')),
    etiqueta     VARCHAR(80) NOT NULL,
    ayuda        VARCHAR(200),
    opciones     JSONB NOT NULL DEFAULT '[]'::jsonb,
    obligatorio  BOOLEAN NOT NULL DEFAULT false,
    orden        INTEGER NOT NULL DEFAULT 0,
    validaciones JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pcampos_producto ON producto_campos(producto_id);
CREATE INDEX IF NOT EXISTS idx_pcampos_negocio  ON producto_campos(negocio_id);
ALTER TABLE producto_campos ENABLE ROW LEVEL SECURITY;

-- ── 2. Foto histórica en el detalle del pedido ───────────────
-- opciones:        [{"grupo":"Talle","opcion":"M","precio_extra":0}]
-- personalizacion: [{"campo_id":3,"etiqueta":"Nombre","tipo":"texto","valor":"Ana"}]
--                  (archivo: "adjunto": {"id":12,"nombre":"logo.png"})
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS opciones        JSONB;
ALTER TABLE pedido_items ADD COLUMN IF NOT EXISTS personalizacion JSONB;

-- ── 3. Adjuntos del cliente ──────────────────────────────────
-- Se suben antes del pedido y se reclaman con su token (un solo uso).
-- Quedan en Cloudinary como "authenticated": sin URL pública.
CREATE TABLE IF NOT EXISTS adjuntos (
    id            SERIAL PRIMARY KEY,
    negocio_id    INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    token         VARCHAR(64) NOT NULL UNIQUE,
    public_id     VARCHAR(300) NOT NULL,
    resource_type VARCHAR(10) NOT NULL,
    formato       VARCHAR(20),
    tipo          VARCHAR(10) NOT NULL,   -- imagen | pdf | 3d
    nombre        VARCHAR(160),
    bytes         INTEGER,
    contexto      VARCHAR(20),            -- pedido (después: presupuesto)
    ref_id        INTEGER,
    usado         BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adjuntos_negocio ON adjuntos(negocio_id);
ALTER TABLE adjuntos ENABLE ROW LEVEL SECURITY;

-- ── 4. Servicios ─────────────────────────────────────────────
-- tipo_precio: fijo (precio) | desde (precio mínimo) | variable (a consultar)
-- modalidades: ["presencial","domicilio","virtual"]
CREATE TABLE IF NOT EXISTS servicios (
    id                   SERIAL PRIMARY KEY,
    negocio_id           INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    nombre               VARCHAR(150) NOT NULL,
    descripcion          TEXT,
    imagen_url           VARCHAR(500),
    categoria            VARCHAR(80),
    tipo_precio          VARCHAR(10) NOT NULL DEFAULT 'fijo'
                         CHECK (tipo_precio IN ('fijo', 'desde', 'variable')),
    precio               DECIMAL(12, 2),
    duracion_min         INTEGER CHECK (duracion_min IS NULL OR duracion_min BETWEEN 5 AND 1440),
    modalidades          JSONB NOT NULL DEFAULT '["presencial"]'::jsonb,
    requiere_turno       BOOLEAN NOT NULL DEFAULT false,
    requiere_presupuesto BOOLEAN NOT NULL DEFAULT false,
    activo               BOOLEAN NOT NULL DEFAULT true,
    orden                INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_servicios_negocio ON servicios(negocio_id);
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;

-- Permiso nuevo "servicios" para Admin (manager) y Staff (el dueño tiene "*").
UPDATE roles_permisos SET permisos = permisos || '["servicios"]'::jsonb
WHERE rol IN ('manager', 'staff') AND NOT permisos ? 'servicios';

-- ── 5. Pedido atómico ────────────────────────────────────────
-- Todo o nada: si algo falla, no queda un pedido sin ítems ni stock
-- descontado de más. El stock baja en la base (stock = stock - n), así dos
-- pedidos simultáneos no se pisan. Los precios ya vienen calculados por el
-- backend desde la base (nunca del cliente).
CREATE OR REPLACE FUNCTION crear_pedido(
    p_pedido          JSONB,
    p_items           JSONB,
    p_stock           JSONB DEFAULT '[]'::jsonb,   -- [{"id":1,"cantidad":2}]
    p_stock_opciones  JSONB DEFAULT '[]'::jsonb,   -- [{"id":9,"cantidad":1}]
    p_adjuntos        JSONB DEFAULT '[]'::jsonb    -- ["token1","token2"]
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_pedido pedidos%ROWTYPE;
    v_items  JSONB;
    v_n      INTEGER;
BEGIN
    INSERT INTO pedidos (negocio_id, mesa, cliente, nota, tipo_entrega,
                         direccion_entrega, telefono_cliente, total, estado)
    VALUES ((p_pedido->>'negocio_id')::INTEGER,
            p_pedido->>'mesa',
            p_pedido->>'cliente',
            p_pedido->>'nota',
            p_pedido->>'tipo_entrega',
            p_pedido->>'direccion_entrega',
            p_pedido->>'telefono_cliente',
            (p_pedido->>'total')::NUMERIC,
            'pendiente')
    RETURNING * INTO v_pedido;

    INSERT INTO pedido_items (pedido_id, producto_id, nombre, precio_unit, costo_unit,
                              cantidad, subtotal, unidad, opciones, personalizacion)
    SELECT v_pedido.id,
           (i->>'producto_id')::INTEGER,
           i->>'nombre',
           (i->>'precio_unit')::NUMERIC,
           COALESCE((i->>'costo_unit')::NUMERIC, 0),
           (i->>'cantidad')::NUMERIC,
           (i->>'subtotal')::NUMERIC,
           COALESCE(i->>'unidad', 'unidad'),
           NULLIF(i->'opciones', 'null'::jsonb),
           NULLIF(i->'personalizacion', 'null'::jsonb)
    FROM jsonb_array_elements(p_items) AS i;

    UPDATE productos p
    SET stock = GREATEST(0, p.stock - (s->>'cantidad')::NUMERIC), updated_at = now()
    FROM jsonb_array_elements(p_stock) AS s
    WHERE p.id = (s->>'id')::INTEGER
      AND p.negocio_id = v_pedido.negocio_id
      AND p.controlar_stock;

    UPDATE variantes_opcion o
    SET stock = GREATEST(0, o.stock - (s->>'cantidad')::INTEGER)
    FROM jsonb_array_elements(p_stock_opciones) AS s, variantes_grupo g
    WHERE o.id = (s->>'id')::INTEGER
      AND g.id = o.grupo_id
      AND g.negocio_id = v_pedido.negocio_id
      AND o.stock IS NOT NULL;

    UPDATE adjuntos
    SET usado = true, contexto = 'pedido', ref_id = v_pedido.id
    WHERE negocio_id = v_pedido.negocio_id
      AND NOT usado
      AND token IN (SELECT jsonb_array_elements_text(p_adjuntos));
    -- Cada archivo se usa una sola vez: si otro pedido lo tomó en el medio,
    -- se deshace todo (el backend responde 400).
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> (SELECT count(DISTINCT t) FROM jsonb_array_elements_text(p_adjuntos) AS t) THEN
        RAISE EXCEPTION 'ADJUNTO_NO_DISPONIBLE' USING ERRCODE = 'P0001';
    END IF;

    -- El costo es privado del negocio: no vuelve en la respuesta.
    SELECT COALESCE(jsonb_agg(to_jsonb(pi) - 'costo_unit' ORDER BY pi.id), '[]'::jsonb)
    INTO v_items
    FROM pedido_items pi
    WHERE pi.pedido_id = v_pedido.id;

    RETURN jsonb_build_object('pedido', to_jsonb(v_pedido), 'items', v_items);
END;
$$;

-- Sólo el backend (service role) la ejecuta.
REVOKE EXECUTE ON FUNCTION crear_pedido(JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;

-- Para que la API de Supabase vea la función nueva sin esperar.
NOTIFY pgrst, 'reload schema';
