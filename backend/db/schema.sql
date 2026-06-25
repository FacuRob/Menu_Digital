-- ── Tabla: categorias ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
    id         SERIAL PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL,
    orden      INTEGER NOT NULL DEFAULT 0,
    activo     BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE categorias DISABLE ROW LEVEL SECURITY;

-- ── Tabla: productos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
    id           SERIAL PRIMARY KEY,
    nombre       VARCHAR(150) NOT NULL,
    descripcion  TEXT,
    precio       DECIMAL(10,2) NOT NULL DEFAULT 0,
    imagen_url   VARCHAR(500),
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
    disponible   BOOLEAN NOT NULL DEFAULT true,
    orden        INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_disponible ON productos(disponible);

ALTER TABLE productos DISABLE ROW LEVEL SECURITY;

-- ── Tabla: roles_permisos ────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles_permisos (
    rol         VARCHAR(50) PRIMARY KEY,
    permisos    JSONB NOT NULL DEFAULT '[]',
    descripcion VARCHAR(255)
);

ALTER TABLE roles_permisos DISABLE ROW LEVEL SECURITY;

-- ── Tabla: usuarios ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id                   SERIAL PRIMARY KEY,
    username             VARCHAR(50) NOT NULL UNIQUE,
    password             VARCHAR(255) NOT NULL,
    nombre               VARCHAR(100),
    email                VARCHAR(255),
    rol                  VARCHAR(50) NOT NULL DEFAULT 'editor' REFERENCES roles_permisos(rol),
    activo               BOOLEAN NOT NULL DEFAULT true,
    must_change_password BOOLEAN NOT NULL DEFAULT false,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol      ON usuarios(rol);

ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- ── Tabla: password_reset_tokens ─────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token      VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token   ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_usuario ON password_reset_tokens(usuario_id);

ALTER TABLE password_reset_tokens DISABLE ROW LEVEL SECURITY;