-- Varias fotos por producto (hasta 6), en orden. La primera es la principal
-- y se sigue guardando también en `imagen_url` (tarjeta del menú, carrito,
-- pedidos), así todo lo que ya usaba una sola foto sigue igual.
--
-- Idempotente: se puede correr más de una vez. Sin esta migración el sistema
-- sigue andando con una sola foto por producto.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagenes JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_imagenes_lista') THEN
    ALTER TABLE productos ADD CONSTRAINT productos_imagenes_lista
      CHECK (jsonb_typeof(imagenes) = 'array' AND jsonb_array_length(imagenes) <= 6);
  END IF;
END $$;

-- Los productos que ya tenían foto la pasan a tener como primera de la lista.
UPDATE productos
SET imagenes = jsonb_build_array(imagen_url)
WHERE imagen_url IS NOT NULL AND imagen_url <> '' AND imagenes = '[]'::jsonb;
