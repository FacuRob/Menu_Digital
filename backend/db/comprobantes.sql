-- ══════════════════════════════════════════════════════════════
-- Migración: comprobantes de pago de la suscripción
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: mercadopago.sql, cupones.sql.
-- ══════════════════════════════════════════════════════════════
--
-- Un comprobante por cada cobro mensual aprobado en Mercado Pago. El id da
-- la numeración correlativa; mp_cobro_id UNIQUE evita emitir dos veces el
-- mismo cobro aunque MP repita el aviso.

CREATE TABLE IF NOT EXISTS comprobantes (
    id               SERIAL PRIMARY KEY,
    cuenta_id        INTEGER REFERENCES cuentas(id) ON DELETE SET NULL,
    mp_cobro_id      VARCHAR(64) NOT NULL UNIQUE,
    mp_pago_id       VARCHAR(64),
    plan             VARCHAR(20) NOT NULL,
    precio_lista     INTEGER NOT NULL,
    descuento_pct    INTEGER NOT NULL DEFAULT 0,
    total            INTEGER NOT NULL,
    moneda           VARCHAR(3) NOT NULL DEFAULT 'ARS',
    periodo_desde    TIMESTAMPTZ,
    periodo_hasta    TIMESTAMPTZ,
    cliente_nombre   VARCHAR(255),
    cliente_email    VARCHAR(255),
    enviado_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comprobantes_cuenta ON comprobantes(cuenta_id);

-- Solo el backend (service role) accede a la tabla.
ALTER TABLE comprobantes ENABLE ROW LEVEL SECURITY;
