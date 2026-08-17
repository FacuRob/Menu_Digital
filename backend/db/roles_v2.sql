-- ══════════════════════════════════════════════════════════════
-- Migración: Realineación de roles → Admin / Staff (+ SuperAdmin)
-- Idempotente. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: schema.sql (roles_permisos, usuarios), rol_plataforma.sql
--             (usuarios.es_plataforma).
-- ══════════════════════════════════════════════════════════════
--
-- Nuevo modelo de roles (jerárquico):
--   SuperAdmin  = dueño de la PLATAFORMA. NO es un rol de la tabla: es el
--                 flag usuarios.es_plataforma = true (cross-cuenta, god-mode).
--                 Su rol de tabla es 'admin' + es_plataforma=true.
--   admin       = dueño del NEGOCIO (cliente SaaS). Control total de su cuenta.
--   staff       = personal/empleado. Catálogo, stock y pedidos; SIN pagos,
--                 facturación, borrar tienda ni reportes financieros.
--
-- Mapeo desde el modelo viejo:
--   rol 'superadmin'  → 'admin'
--   rol 'editor'      → 'staff'
--   rol 'visor'       → 'staff'
--
-- IMPORTANTE: las filas viejas ('superadmin','editor','visor') NO se borran.
-- Se mantienen para que los JWT ya emitidos (válidos 24 h) sigan resolviendo
-- permisos hasta que expiren / el usuario vuelva a loguear. Podés limpiarlas
-- luego con el bloque comentado del final.

-- ── Nuevos roles ─────────────────────────────────────────────
INSERT INTO roles_permisos (rol, permisos, descripcion) VALUES
(
    'admin',
    '"*"',
    'Dueño del negocio. Control total de su tienda, catálogo, pagos y personal.'
),
(
    'staff',
    '["productos","categorias","pedidos","stock"]',
    'Personal del negocio. Gestiona catálogo, stock y pedidos. Sin pagos, facturación ni reportes financieros.'
)
ON CONFLICT (rol) DO UPDATE
    SET permisos = EXCLUDED.permisos,
        descripcion = EXCLUDED.descripcion;

-- ── Backfill de usuarios existentes ──────────────────────────
-- El orden importa por la FK usuarios.rol → roles_permisos(rol): los roles
-- nuevos ya existen (arriba), así que estos UPDATE no fallan.
UPDATE usuarios SET rol = 'admin' WHERE rol = 'superadmin';
UPDATE usuarios SET rol = 'staff' WHERE rol IN ('editor', 'visor');

-- ── (Opcional) Limpieza de roles legacy ──────────────────────
-- Ejecutar SÓLO cuando estés seguro de que no quedan tokens viejos vivos
-- (p. ej. > 24 h después de esta migración) y ningún usuario los referencia.
-- DELETE FROM roles_permisos WHERE rol IN ('superadmin', 'editor', 'visor');
