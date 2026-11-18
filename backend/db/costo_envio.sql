-- ══════════════════════════════════════════════════════════════
-- Migración: costo del envío (delivery propio).
-- Idempotente. Ejecutar en Supabase (SQL Editor) DESPUÉS de modalidades.sql.
--
--   configuracion.envio  → { cobrar, monto, gratis_desde, cobro: "pedido" | "efectivo" }
--                          Lo cambia sólo el dueño de la cuenta (rol 'admin').
--   pedidos.costo_envio  → envío cobrado en ese pedido (foto del momento).
--   pedidos.envio_cobro  → "pedido" (junto con el pedido) o "efectivo" (al repartidor).
--
-- pedidos.total sigue siendo SOLO los productos (Dashboard y clientes no
-- cambian). Lo que paga el cliente = total + costo_envio.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS envio JSONB;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_cobro TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_envio_cobro_check') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_envio_cobro_check
            CHECK (envio_cobro IS NULL OR envio_cobro IN ('pedido', 'efectivo'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_costo_envio_check') THEN
        ALTER TABLE pedidos ADD CONSTRAINT pedidos_costo_envio_check CHECK (costo_envio >= 0);
    END IF;
END $$;

-- crear_pedido (de modalidades.sql) + costo_envio y envio_cobro.
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
                         costo_envio, envio_cobro)
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
            NULLIF(p_pedido->>'envio_cobro', ''))
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
