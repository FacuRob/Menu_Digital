CREATE OR REPLACE FUNCTION get_productos_disponibles()
RETURNS TABLE (
    id              INTEGER,
    nombre          VARCHAR,
    descripcion     TEXT,
    precio          DECIMAL,
    imagen_url      VARCHAR,
    categoria_id    INTEGER,
    categoria_nombre VARCHAR,
    disponible      BOOLEAN,
    orden           INTEGER,
    created_at      TIMESTAMP,
    updated_at      TIMESTAMP
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        p.id,
        p.nombre,
        p.descripcion,
        p.precio,
        p.imagen_url,
        p.categoria_id,
        c.nombre AS categoria_nombre,
        p.disponible,
        p.orden,
        p.created_at,
        p.updated_at
    FROM productos p
    INNER JOIN categorias c ON p.categoria_id = c.id
    WHERE p.disponible = true
      AND c.activo    = true
    ORDER BY c.orden ASC, p.orden ASC;
$$;