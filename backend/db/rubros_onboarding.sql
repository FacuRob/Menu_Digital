-- ══════════════════════════════════════════════════════════════
-- Migración: catálogo central de rubros + onboarding retomable
-- Idempotente. Ejecutar en Supabase (SQL Editor) ANTES de publicar el código
-- de la Etapa 2: el panel lee las categorías y especialidades de acá.
-- Depende de: multirubro.sql (negocios.tipo_rubro).
-- ══════════════════════════════════════════════════════════════
--
-- Rubro = categoría + especialidad (ej. Gastronomía → Pizzería). Se
-- administran acá, no en el código: para sumar una especialidad alcanza
-- con un INSERT en rubros_especialidades.
--
-- familia: el tipo_rubro de siempre (gastronomia | retail | servicios |
-- generico). El menú público lo sigue usando para íconos y vocabulario, así
-- que todo lo que ya existe se comporta igual.
--
-- sugerencias: qué se preselecciona en el onboarding (pasos 4 y 5). Son solo
-- sugerencias: la persona puede elegir cualquier combinación.
--   ofrece:    productos | personalizados | servicios
--   funciones: venta_directa | pedidos | retiro | envios | presencial |
--              virtual | reservas | presupuestos
-- Una especialidad con sugerencias NULL usa las de su categoría.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rubros_categorias (
    codigo      VARCHAR(40) PRIMARY KEY,
    nombre      VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200),
    familia     VARCHAR(30) NOT NULL DEFAULT 'generico'
                CHECK (familia IN ('gastronomia', 'retail', 'servicios', 'generico')),
    icono       VARCHAR(40),
    sugerencias JSONB NOT NULL DEFAULT '{}'::jsonb,
    orden       INTEGER NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS rubros_especialidades (
    codigo      VARCHAR(60) PRIMARY KEY,
    categoria   VARCHAR(40) NOT NULL REFERENCES rubros_categorias(codigo) ON UPDATE CASCADE,
    nombre      VARCHAR(80) NOT NULL,
    sugerencias JSONB,
    orden       INTEGER NOT NULL DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_rubros_esp_categoria ON rubros_especialidades(categoria);

-- Solo el backend (service role) los lee y escribe.
ALTER TABLE rubros_categorias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubros_especialidades ENABLE ROW LEVEL SECURITY;

-- ── Categorías ───────────────────────────────────────────────
INSERT INTO rubros_categorias (codigo, nombre, descripcion, familia, icono, orden, sugerencias) VALUES
('gastronomia',            'Gastronomía',                          'Restaurantes, bares, cafeterías, delivery de comida.',  'gastronomia', 'utensils', 1,
  '{"ofrece":["productos"],"funciones":["pedidos","retiro","envios","presencial"]}'),
('comercios',              'Comercios y tiendas',                  'Ropa, electrónica, almacenes, librerías y más.',        'retail',      'bag',      2,
  '{"ofrece":["productos"],"funciones":["venta_directa","retiro","envios"]}'),
('fabricacion',            'Fabricación y productos personalizados','Impresión 3D, sublimación, carpintería, por encargo.',  'retail',      'box',      3,
  '{"ofrece":["productos","personalizados"],"funciones":["pedidos","presupuestos","retiro","envios"]}'),
('belleza',                'Belleza y cuidado personal',           'Peluquerías, barberías, estética, uñas, spa.',          'servicios',   'sparkle',  4,
  '{"ofrece":["servicios"],"funciones":["reservas","presencial"]}'),
('salud',                  'Salud y bienestar',                    'Nutrición, psicología, kinesiología, consultorios.',    'servicios',   'heart',    5,
  '{"ofrece":["servicios"],"funciones":["reservas","presencial","virtual"]}'),
('servicios_profesionales','Servicios profesionales',              'Contadores, abogados, diseño, fotografía, consultoría.','servicios',   'briefcase',6,
  '{"ofrece":["servicios"],"funciones":["presupuestos","virtual","presencial"]}'),
('hogar',                  'Hogar, mantenimiento y construcción',  'Electricistas, plomeros, pintores, limpieza.',          'servicios',   'tools',    7,
  '{"ofrece":["servicios"],"funciones":["presupuestos","presencial"]}'),
('automotor',              'Automotor',                            'Talleres, gomerías, lavaderos, detailing.',             'servicios',   'car',      8,
  '{"ofrece":["servicios"],"funciones":["reservas","presupuestos","presencial"]}'),
('educacion',              'Educación y entretenimiento',          'Academias, idiomas, clases, gimnasios, danza.',         'servicios',   'book',     9,
  '{"ofrece":["servicios"],"funciones":["reservas","presencial","virtual"]}'),
('turismo',                'Turismo y alojamiento',                'Hoteles, cabañas, excursiones, agencias.',              'servicios',   'map',      10,
  '{"ofrece":["servicios"],"funciones":["reservas","presupuestos"]}'),
('otros',                  'Otros',                                'Cualquier otro tipo de negocio.',                       'generico',    'grid',     11,
  '{"ofrece":["productos"],"funciones":["venta_directa"]}')
ON CONFLICT (codigo) DO NOTHING;

-- ── Especialidades ───────────────────────────────────────────
INSERT INTO rubros_especialidades (codigo, categoria, nombre, orden, sugerencias) VALUES
-- Gastronomía
('restaurante',     'gastronomia', 'Restaurante',      1, NULL),
('bar',             'gastronomia', 'Bar',              2, NULL),
('cafeteria',       'gastronomia', 'Cafetería',        3, NULL),
('heladeria',       'gastronomia', 'Heladería',        4, '{"ofrece":["productos"],"funciones":["pedidos","retiro","envios"]}'),
('panaderia',       'gastronomia', 'Panadería',        5, '{"ofrece":["productos"],"funciones":["pedidos","retiro","envios"]}'),
('pizzeria',        'gastronomia', 'Pizzería',         6, NULL),
('hamburgueseria',  'gastronomia', 'Hamburguesería',   7, NULL),
('rotiseria',       'gastronomia', 'Rotisería',        8, '{"ofrece":["productos"],"funciones":["pedidos","retiro","envios"]}'),
('parrilla',        'gastronomia', 'Parrilla',         9, NULL),
('catering',        'gastronomia', 'Catering',         10, '{"ofrece":["productos","servicios"],"funciones":["pedidos","presupuestos","envios"]}'),
('food_truck',      'gastronomia', 'Food truck',       11, '{"ofrece":["productos"],"funciones":["pedidos","retiro"]}'),
-- Comercios
('ropa',            'comercios', 'Ropa',               1, NULL),
('calzado',         'comercios', 'Calzado',            2, NULL),
('perfumeria',      'comercios', 'Perfumería',         3, NULL),
('electronica',     'comercios', 'Electrónica',        4, NULL),
('informatica',     'comercios', 'Informática',        5, NULL),
('telefonia',       'comercios', 'Telefonía',          6, NULL),
('muebles',         'comercios', 'Muebles',            7, NULL),
('libreria',        'comercios', 'Librería',           8, NULL),
('jugueteria',      'comercios', 'Juguetería',         9, NULL),
('ferreteria',      'comercios', 'Ferretería',         10, NULL),
('supermercado',    'comercios', 'Supermercado',       11, '{"ofrece":["productos"],"funciones":["pedidos","retiro","envios"]}'),
('kiosco',          'comercios', 'Kiosco',             12, '{"ofrece":["productos"],"funciones":["pedidos","retiro"]}'),
('pet_shop',        'comercios', 'Pet shop',           13, NULL),
-- Fabricación
('impresion_3d',    'fabricacion', 'Impresión 3D',               1, NULL),
('sublimacion',     'fabricacion', 'Sublimación',                2, NULL),
('estampados',      'fabricacion', 'Estampados',                 3, NULL),
('artesanal',       'fabricacion', 'Fabricación artesanal',      4, NULL),
('carpinteria',     'fabricacion', 'Carpintería',                5, NULL),
('muebles_medida',  'fabricacion', 'Muebles a medida',           6, '{"ofrece":["personalizados"],"funciones":["presupuestos","envios"]}'),
('corte_grabado',   'fabricacion', 'Corte y grabado',            7, NULL),
('personalizados',  'fabricacion', 'Productos personalizados',   8, NULL),
('por_encargo',     'fabricacion', 'Fabricación por encargo',    9, '{"ofrece":["personalizados"],"funciones":["presupuestos","retiro","envios"]}'),
-- Belleza
('peluqueria',      'belleza', 'Peluquería',       1, NULL),
('barberia',        'belleza', 'Barbería',         2, NULL),
('estetica',        'belleza', 'Estética',         3, NULL),
('unas',            'belleza', 'Uñas',             4, NULL),
('maquillaje',      'belleza', 'Maquillaje',       5, NULL),
('depilacion',      'belleza', 'Depilación',       6, NULL),
('spa',             'belleza', 'Spa',              7, NULL),
('masajes',         'belleza', 'Masajes',          8, NULL),
-- Salud
('nutricion',       'salud', 'Nutricionista',      1, NULL),
('psicologia',      'salud', 'Psicología',         2, NULL),
('kinesiologia',    'salud', 'Kinesiología',       3, '{"ofrece":["servicios"],"funciones":["reservas","presencial"]}'),
('consultorio',     'salud', 'Consultorio',        4, NULL),
('rehabilitacion',  'salud', 'Rehabilitación',     5, '{"ofrece":["servicios"],"funciones":["reservas","presencial"]}'),
-- Servicios profesionales
('contador',        'servicios_profesionales', 'Contador',              1, NULL),
('abogado',         'servicios_profesionales', 'Abogado',               2, NULL),
('diseno',          'servicios_profesionales', 'Diseño',                3, NULL),
('fotografia',      'servicios_profesionales', 'Fotografía',            4, '{"ofrece":["servicios"],"funciones":["reservas","presupuestos","presencial"]}'),
('arquitectura',    'servicios_profesionales', 'Arquitectura',          5, NULL),
('consultoria',     'servicios_profesionales', 'Consultoría',           6, NULL),
('tecnico_it',      'servicios_profesionales', 'Técnico informático',   7, NULL),
-- Hogar
('electricista',    'hogar', 'Electricista',       1, NULL),
('plomero',         'hogar', 'Plomero',            2, NULL),
('albanil',         'hogar', 'Albañil',            3, NULL),
('pintor',          'hogar', 'Pintor',             4, NULL),
('carpintero',      'hogar', 'Carpintero',         5, NULL),
('jardinero',       'hogar', 'Jardinero',          6, NULL),
('limpieza',        'hogar', 'Limpieza',           7, '{"ofrece":["servicios"],"funciones":["reservas","presupuestos","presencial"]}'),
('mantenimiento',   'hogar', 'Mantenimiento',      8, NULL),
-- Automotor
('taller',          'automotor', 'Taller mecánico',   1, NULL),
('gomeria',         'automotor', 'Gomería',           2, NULL),
('lavadero',        'automotor', 'Lavadero',          3, '{"ofrece":["servicios"],"funciones":["reservas","presencial"]}'),
('detailing',       'automotor', 'Detailing',         4, NULL),
('chapa_pintura',   'automotor', 'Chapa y pintura',   5, '{"ofrece":["servicios"],"funciones":["presupuestos","presencial"]}'),
-- Educación
('academia',        'educacion', 'Academia',              1, NULL),
('instituto',       'educacion', 'Instituto',             2, NULL),
('idiomas',         'educacion', 'Idiomas',               3, NULL),
('clases',          'educacion', 'Clases particulares',   4, NULL),
('gimnasio',        'educacion', 'Gimnasio',              5, '{"ofrece":["servicios"],"funciones":["reservas","presencial"]}'),
('baile',           'educacion', 'Academia de baile',     6, NULL),
-- Turismo
('hotel',           'turismo', 'Hotel',            1, NULL),
('cabanas',         'turismo', 'Cabañas',          2, NULL),
('alojamiento',     'turismo', 'Alojamiento',      3, NULL),
('excursiones',     'turismo', 'Excursiones',      4, NULL),
('agencia',         'turismo', 'Agencia de viajes',5, '{"ofrece":["servicios"],"funciones":["presupuestos","virtual"]}'),
-- Otros
('otro',            'otros', 'Otro',               1, NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ── negocios: rubro y progreso del onboarding ────────────────
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS rubro_categoria VARCHAR(40)
    REFERENCES rubros_categorias(codigo) ON UPDATE CASCADE;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS rubro_especialidad VARCHAR(60)
    REFERENCES rubros_especialidades(codigo) ON UPDATE CASCADE;
-- onboarding: {"paso": 2..8, "completado": bool, "ofrece": [...], "funciones": [...]}
-- NULL = negocio anterior a este cambio (se considera ya configurado).
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS onboarding JSONB;

-- Negocios existentes: categoría según su tipo_rubro (sin especialidad).
-- No cambia nada de lo que ven: tipo_rubro queda igual.
UPDATE negocios SET rubro_categoria = CASE tipo_rubro
        WHEN 'gastronomia' THEN 'gastronomia'
        WHEN 'retail'      THEN 'comercios'
        WHEN 'servicios'   THEN 'servicios_profesionales'
        ELSE 'otros'
    END
WHERE rubro_categoria IS NULL;

-- ── configuracion: ciudad y provincia (paso 2 del onboarding) ─
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS ciudad    VARCHAR(100);
ALTER TABLE configuracion ADD COLUMN IF NOT EXISTS provincia VARCHAR(60);
