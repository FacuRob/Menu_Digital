-- ══════════════════════════════════════════════════════════════
-- Migración: modalidades de atención y entrega (Etapa 6)
-- Idempotente. Ejecutar en Supabase (SQL Editor).
-- Depende de: catalogo_universal.sql (función crear_pedido).
--
-- Se conservan mesa, retiro y delivery tal cual (sus columnas de siempre en
-- configuracion). Lo nuevo va en configuracion.modalidades:
--   {"mostrador":true,"envio":true,"retiro_programado":true,"entrega_programada":true}
-- y pedidos.tipo_entrega suma dos valores:
--   mostrador → pide y lo retira en el momento (sin teléfono)
--   envio     → envío por correo o transporte (dirección completa)
-- pedidos.programado_para: para cuándo lo quiere (retiro o entrega programada).
-- ══════════════════════════════════════════════════════════════

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS modalidades JSONB;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS programado_para TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_pedidos_programado ON pedidos(negocio_id, programado_para)
    WHERE programado_para IS NOT NULL;

-- crear_pedido: igual que en catalogo_universal.sql, más programado_para.
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
                         direccion_entrega, telefono_cliente, total, estado, programado_para)
    VALUES ((p_pedido->>'negocio_id')::INTEGER,
            p_pedido->>'mesa',
            p_pedido->>'cliente',
            p_pedido->>'nota',
            p_pedido->>'tipo_entrega',
            p_pedido->>'direccion_entrega',
            p_pedido->>'telefono_cliente',
            (p_pedido->>'total')::NUMERIC,
            'pendiente',
            NULLIF(p_pedido->>'programado_para', '')::TIMESTAMPTZ)
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

REVOKE EXECUTE ON FUNCTION crear_pedido(JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
