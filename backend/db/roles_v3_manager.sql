-- ══════════════════════════════════════════════════════════════
-- Migración: rol intermedio "Admin" (clave DB: manager)
-- Idempotente y ADITIVA. Ejecutar en Supabase (SQL Editor) o psql.
-- Depende de: schema.sql (roles_permisos), roles_v2.sql (admin/staff),
--             rol_plataforma.sql (usuarios.es_plataforma).
-- ══════════════════════════════════════════════════════════════
--
-- Jerarquía visible (label) → clave interna (rol / flag):
--   HiperAdmin  = usuarios.es_plataforma = true  (god-mode, SOLO manual).
--                 Único con acceso a /admin/plataforma.
--   SuperAdmin  = rol 'admin'   → dueño de la cuenta. permisos "*".
--                 Se crea en el registro (signup/google). Compra la licencia.
--   Admin       = rol 'manager' → segundo jefe. Gestiona el negocio y crea
--                 SOLO personal (staff). SIN suscripción ni plataforma.
--   Staff       = rol 'staff'   → personal / mozo. Catálogo, stock y pedidos.
--
-- IMPORTANTE: no se borra ni se modifica ningún rol existente. Sólo se agrega
-- 'manager'. Los dueños actuales (rol 'admin', permisos "*") siguen igual.

INSERT INTO roles_permisos (rol, permisos, descripcion) VALUES
(
    'manager',
    '["categorias","productos","pedidos","stock","qr","configuracion","negocios","usuarios","analiticas"]',
    'Segundo jefe del negocio. Gestiona el catálogo, pedidos, config del menú, sucursales y crea personal (staff). Sin suscripción ni panel de plataforma.'
)
ON CONFLICT (rol) DO UPDATE
    SET permisos = EXCLUDED.permisos,
        descripcion = EXCLUDED.descripcion;
