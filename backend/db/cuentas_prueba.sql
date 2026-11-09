-- ══════════════════════════════════════════════════════════════
-- Cuentas de PRUEBA: una por plan (Free / Básico / Estándar / Premium).
-- Ejecutar en Supabase (SQL Editor). Crea lo mismo que un alta real:
-- cuenta + negocio + configuración + usuario dueño (rol admin).
--
-- · Cambiá v_pass antes de correrlo (la misma contraseña para las 4).
-- · Se puede correr de nuevo: si el email ya existe, esa cuenta se saltea.
-- · Usuario para entrar al panel = el email.
-- · "Free" = prueba gratis de 15 días (lo que recibe un cliente nuevo; rige
--   con los límites del Estándar). Las pagas quedan "activo" por 30 días,
--   sin Mercado Pago (origen 'manual').
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_pass   text := 'CambiaEsta-2026';   -- ← CAMBIAR
  r        record;
  v_cuenta int;
  v_neg    int;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('Prueba Free',     'prueba.free@dinexflow.test',     'free',     'trial',  15, 'prueba-free'),
      ('Prueba Básico',   'prueba.basico@dinexflow.test',   'basic',    'activo', 30, 'prueba-basico'),
      ('Prueba Estándar', 'prueba.estandar@dinexflow.test', 'standard', 'activo', 30, 'prueba-estandar'),
      ('Prueba Premium',  'prueba.premium@dinexflow.test',  'premium',  'activo', 30, 'prueba-premium')
    ) AS t(nombre, email, plan, estado, dias, slug)
  LOOP
    IF EXISTS (SELECT 1 FROM cuentas WHERE email = r.email)
       OR EXISTS (SELECT 1 FROM usuarios WHERE email = r.email OR username = r.email) THEN
      RAISE NOTICE 'Ya existe %: se saltea', r.email;
      CONTINUE;
    END IF;

    -- Los límites (negocios / productos) los completa el trigger según tipo_plan.
    INSERT INTO cuentas (nombre, email, tipo_plan, ciclo_facturacion, estado_suscripcion, periodo_fin, origen)
    VALUES (r.nombre, r.email, r.plan, 'mensual', r.estado, now() + make_interval(days => r.dias), 'manual')
    RETURNING id INTO v_cuenta;

    INSERT INTO negocios (nombre, slug, activo, cuenta_id)
    VALUES (r.nombre, r.slug, true, v_cuenta)
    RETURNING id INTO v_neg;

    INSERT INTO configuracion (negocio_id, nombre, retiro_activo)
    VALUES (v_neg, r.nombre, true);

    -- Contraseña con bcrypt (pgcrypto): el login del backend la acepta igual.
    INSERT INTO usuarios (username, password, nombre, email, rol, activo, must_change_password, cuenta_id)
    VALUES (r.email, extensions.crypt(v_pass, extensions.gen_salt('bf', 10)),
            r.nombre, r.email, 'admin', true, false, v_cuenta);

    RAISE NOTICE 'Creada %: cuenta %, negocio %', r.email, v_cuenta, v_neg;
  END LOOP;
END $$;

-- ── Ver cómo quedaron ────────────────────────────────────────
SELECT c.id AS cuenta, c.nombre, c.tipo_plan, c.estado_suscripcion,
       c.limite_negocios, c.limite_productos, c.periodo_fin::date AS vence,
       u.username AS usuario
FROM cuentas c
JOIN usuarios u ON u.cuenta_id = c.id
WHERE c.email LIKE 'prueba.%@dinexflow.test'
ORDER BY c.id;

-- ── Borrarlas cuando termines (usuarios, negocios y configuración se
--    borran en cascada) ─────────────────────────────────────────
-- DELETE FROM cuentas WHERE email LIKE 'prueba.%@dinexflow.test';
