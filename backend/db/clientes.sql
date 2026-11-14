-- ══════════════════════════════════════════════════════════════
-- Etapa 8 — Clientes (panel). Idempotente.
-- No hay tabla de clientes: el panel los arma con pedidos, presupuestos y
-- turnos (GET /api/clientes). Sólo se agrega el permiso.
-- Correr después de presupuestos_reservas.sql.
-- ══════════════════════════════════════════════════════════════

-- clientes: ver la lista de clientes con sus datos de contacto (Admin).
-- Staff no: son datos personales y no los necesita para atender.
UPDATE roles_permisos SET permisos = permisos || '["clientes"]'::jsonb
WHERE rol = 'manager' AND NOT permisos ? 'clientes';
