-- ══════════════════════════════════════════════════════════════
-- Migración: medios de pago de los pedidos (efectivo y transferencia).
-- Idempotente. Ejecutar en Supabase (SQL Editor) DESPUÉS de costo_envio.sql.
--
--   configuracion.pagos → { efectivo, transferencia, alias, cbu, titular, banco }
--                         Lo cambia sólo el dueño de la cuenta (rol 'admin').
--   pedidos.metodo_pago → 'efectivo' | 'transferencia' (null = sin medio de pago)
--   pedidos.paga_con    → efectivo: con cuánto paga (null = paga justo)
--   pedidos.estado_pago → 'pendiente' (efectivo, se cobra al entregar)
--                         'en_revision' (transferencia sin confirmar)
--                         'pagado' | 'rechazado' (lo marca el dueño o el Admin)
--   pedidos.transfirio  → quién hizo la transferencia (opcional)
--   pedidos.comprobante_id → comprobante adjunto (tabla adjuntos, privado)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS pagos JSONB;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS paga_con NUMERIC(12,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_pago TEXT;
-- Para qué se subió cada archivo: un comprobante no sirve como archivo de
-- personalización (y tiene su propio tope de subidas sin usar).
ALTER TABLE adjuntos ADD COLUMN IF NOT EXISTS uso TEXT NOT NULL DEFAULT 'personalizacion';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS transfirio TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante_id INTEGER REFERENCES adjuntos(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_metodo_pago_check') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_metodo_pago_check
            CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo', 'transferencia'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_estado_pago_check') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_pago_check
            CHECK (estado_pago IS NULL OR estado_pago IN ('pendiente', 'en_revision', 'pagado', 'rechazado'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_paga_con_check') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_paga_con_check CHECK (paga_con IS NULL OR paga_con > 0);
    END IF;
END $$;

-- crear_pedido (de costo_envio.sql) + metodo_pago, paga_con y estado_pago.
CREATE OR REPLACE FUNCTION crear_pedido(
    p_pedido          JSONB,
    p_items           JSONB,
    p_stock           JSONB DEFAULT '[]'::jsonb,
    p_stock_opciones  JSONB DEFAULT '[]'::jsonb,
    p_adjuntos        JSONB DEFAULT '[]'::jsonb
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_pedido pedidos%ROWTYPE;
    v_items  JSONB;
    v_n      INTEGER;
BEGIN
    INSERT INTO pedidos (negocio_id, mesa, cliente, nota, tipo_entrega,
                         direccion_entrega, telefono_cliente, total, estado, programado_para,
                         costo_envio, envio_cobro, metodo_pago, paga_con, estado_pago,
                         transfirio, comprobante_id)
    VALUES ((p_pedido->>'negocio_id')::INTEGER,
            p_pedido->>'mesa',
            p_pedido->>'cliente',
            p_pedido->>'nota',
            p_pedido->>'tipo_entrega',
            p_pedido->>'direccion_entrega',
            p_pedido->>'telefono_cliente',
            (p_pedido->>'total')::NUMERIC,
            'pendiente',
            NULLIF(p_pedido->>'programado_para', '')::TIMESTAMPTZ,
            COALESCE((p_pedido->>'costo_envio')::NUMERIC, 0),
            NULLIF(p_pedido->>'envio_cobro', ''),
            NULLIF(p_pedido->>'metodo_pago', ''),
            NULLIF(p_pedido->>'paga_con', '')::NUMERIC,
            NULLIF(p_pedido->>'estado_pago', ''),
            NULLIF(p_pedido->>'transfirio', ''),
            NULLIF(p_pedido->>'comprobante_id', '')::INTEGER)
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
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> (SELECT count(DISTINCT t) FROM jsonb_array_elements_text(p_adjuntos) AS t) THEN
        RAISE EXCEPTION 'ADJUNTO_NO_DISPONIBLE' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(pi) - 'costo_unit' ORDER BY pi.id), '[]'::jsonb)
    INTO v_items
    FROM pedido_items pi
    WHERE pi.pedido_id = v_pedido.id;

    RETURN jsonb_build_object('pedido', to_jsonb(v_pedido), 'items', v_items);
END;
$$;
REVOKE EXECUTE ON FUNCTION crear_pedido(JSONB, JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
