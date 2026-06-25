INSERT INTO roles_permisos (rol, permisos, descripcion) VALUES
(
    'superadmin',
    '"*"',
    'Acceso total al sistema. Puede gestionar usuarios y todos los modulos.'
),
(
    'editor',
    '["categorias","productos","configuracion","qr"]',
    'Puede gestionar categorias, productos, configuracion y codigo QR.'
),
(
    'visor',
    '["analiticas","pedidos"]',
    'Acceso de solo lectura a analiticas y pedidos.'
)
ON CONFLICT (rol) DO NOTHING;

-- ── Usuario superadmin inicial ───────────────────────────────
-- IMPORTANTE: Cambiar la contrasena en el primer login.
-- La contrasena '123456' esta hasheada con bcryptjs (salt 10).
-- Hash generado con: bcrypt.hashSync('123456', 10)

INSERT INTO usuarios (username, password, nombre, email, rol, activo, must_change_password)
VALUES (
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHuu',
    'Administrador',
    '',
    'superadmin',
    true,
    true
)
ON CONFLICT (username) DO NOTHING;