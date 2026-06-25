-- ============================================
-- CATEGORÍAS
-- ============================================
INSERT INTO categorias (nombre, orden, activo) VALUES
('Entradas & Picadas',     1,  true),
('Papas',                  2,  true),
('Ensaladas',              3,  true),
('Pizzas',                 4,  true),
('Burgers Clásicas',       5,  true),
('Burgers Homenajes',      6,  true),
('Quesadillas & Burritos', 7,  true),
('Postres',                8,  true),
('Cervezas',               9,  true),
('Tragos Clásicos',        10, true),
('Mojitos',                11, true),
('Frozen',                 12, true),
('Gin Tonic',              13, true),
('Sin Alcohol',            14, true);

-- ============================================
-- PRODUCTOS — Entradas & Picadas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Tequeños', 'Roll de masa crujiente relleno de muzzarella y panceta', 8500, null, id, true, 1 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Chicken Fingers', 'Pechuguitas de pollo rebozadas y fritas', 9800, null, id, true, 2 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Nachos', 'Porción de nachos con cheddar y salsa 4 quesos. Acompañados con dips de barbacoa, guacamole y pico de gallo', 10500, null, id, true, 3 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Bocaditos de Muzzarella', 'Bocaditos de muzzarella rebozados y fritos', 8900, null, id, true, 4 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Langostinos Crunch', 'Langostinos rebozados y fritos. Acompañados de salsa tártara', 12500, null, id, true, 5 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Rabas', 'Aros de calamar rebozados, acompañados con mayo del día', 9200, null, id, true, 6 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Porter Reloaded', 'Nachos con cheddar, chicken fingers, tequeños, bocaditos de muzzarella, rabas, papas con salsa 4 quesos y aros de cebolla. Para compartir', 28000, null, id, true, 7 FROM categorias WHERE nombre = 'Entradas & Picadas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Knishe & Boio', 'Knishe: bocaditos de masa casera al horno rellenos de papa y cebolla. Boio: comida tradicional judía de masa casera, relleno de acelga y espinaca, con queso gratinado', 9500, null, id, true, 8 FROM categorias WHERE nombre = 'Entradas & Picadas';

-- ============================================
-- PRODUCTOS — Papas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Papas Fritas', 'Sin TACC', 6500, null, id, true, 1 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Papas Bravas', 'Con chili mayo. Sin TACC. HOT!', 7200, null, id, true, 2 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Argenta', 'Jamón, muzzarella, huevo frito y cebolla verde', 9800, null, id, true, 3 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Yankee', 'Cheddar, panceta y cebolla verde', 9200, null, id, true, 4 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cerveceras', 'Salsa 4 quesos, panceta y cebolla verde', 9500, null, id, true, 5 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Chicken Fries', 'Con bocaditos de chicken fingers y dressing porter', 10500, null, id, true, 6 FROM categorias WHERE nombre = 'Papas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cheeses Burger Fries', 'Con lluvia de burger, barbacoa y cheddar', 11000, null, id, true, 7 FROM categorias WHERE nombre = 'Papas';

-- ============================================
-- PRODUCTOS — Ensaladas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mediterránea', 'Mix de hojas verdes, jamón crudo, bocaditos de muzzarella rebozados, olivas verdes, pecans caramelizadas y reducción de aceto', 12500, null, id, true, 1 FROM categorias WHERE nombre = 'Ensaladas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caesar', 'Mix de hojas verdes, escamas de parmesano, croutons, pollo grillado y aderezo caesar', 11800, null, id, true, 2 FROM categorias WHERE nombre = 'Ensaladas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cobb Salad', 'Mix de hojas verdes, pollo, panceta, palta, queso azul, huevo y tomate cherry', 13200, null, id, true, 3 FROM categorias WHERE nombre = 'Ensaladas';

-- ============================================
-- PRODUCTOS — Pizzas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Especial', 'Jamón cocido, morrones asados y olivas verdes. Con salsa de tomate y muzzarella. Incluye dip de salsa Porter', 10500, null, id, true, 1 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Prosciutto', 'Jamón crudo, rúcula y parmesano. Con salsa de tomate y muzzarella', 11500, null, id, true, 2 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Porter', 'Ternera y palta. Con salsa de tomate y muzzarella', 10800, null, id, true, 3 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Ternera', 'Ternera, pimientos asados, huevo duro y olivas negras. Con salsa de tomate y muzzarella', 11200, null, id, true, 4 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT '4 Quesos', 'Muzzarella, pategras, sardo y azul', 10200, null, id, true, 5 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Muzza', 'Olivas verdes y orégano. Con salsa de tomate y muzzarella', 9200, null, id, true, 6 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Napolitana', 'Muzzarella, tomate, olivas verdes, orégano', 9800, null, id, true, 7 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caprese', 'Tomate cherry, albahaca y pesto', 10200, null, id, true, 8 FROM categorias WHERE nombre = 'Pizzas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Lo de Roque', 'Queso azul, panceta, cebolla morada y orégano', 11500, null, id, true, 9 FROM categorias WHERE nombre = 'Pizzas';

-- ============================================
-- PRODUCTOS — Burgers Clásicas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Frida', 'Doble medallón, doble cheddar, panceta, guacamole, crispy onions, papas pay y barbacoa. Ganadora concurso La Hamburguesa de tus Sueños 2da edición', 17500, null, id, true, 1 FROM categorias WHERE nombre = 'Burgers Clásicas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Argentina', 'Doble medallón, muzzarella, jamón, huevo frito, lechuga, tomate y mayonesa de chimichurri', 16800, null, id, true, 2 FROM categorias WHERE nombre = 'Burgers Clásicas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Americana', 'Doble medallón, panceta, doble cheddar, barbacoa y aro de cebolla', 17200, null, id, true, 3 FROM categorias WHERE nombre = 'Burgers Clásicas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cheese Burger 3.0', 'Triple medallón, triple cheddar, cebolla y barbacoa', 19500, null, id, true, 4 FROM categorias WHERE nombre = 'Burgers Clásicas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Francesa', 'Doble medallón, doble muzzarella, queso azul, cebolla caramelizada, champiñones y honey mustard', 17800, null, id, true, 5 FROM categorias WHERE nombre = 'Burgers Clásicas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Burger Porter', 'Doble medallón de carne, bocaditos de muzzarella, tomate deshidratado, rúcula y barbacoa. NEW!', 18200, null, id, true, 6 FROM categorias WHERE nombre = 'Burgers Clásicas';

-- ============================================
-- PRODUCTOS — Burgers Homenajes
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Stacker', 'Burger doble medallón, cheddar, panceta y salsa stacker', 16500, null, id, true, 1 FROM categorias WHERE nombre = 'Burgers Homenajes';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Whopper', 'Burger doble medallón, pepinillos, cebolla, tomate, lechuga, mayonesa y ketchup', 16800, null, id, true, 2 FROM categorias WHERE nombre = 'Burgers Homenajes';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cuarto de Libra', 'Burger doble medallón, doble cheddar, pepinillos, cebolla, ketchup y mostaza', 17200, null, id, true, 3 FROM categorias WHERE nombre = 'Burgers Homenajes';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Big Mac', 'Burger con doble medallón, cheddar, cebolla, pepinillos, lechuga y salsa Big Mac', 17000, null, id, true, 4 FROM categorias WHERE nombre = 'Burgers Homenajes';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Philly Cheese Steak Americano', 'Carne, cheddar, bacon y cebolla de verdeo. NEW!', 18500, null, id, true, 5 FROM categorias WHERE nombre = 'Burgers Homenajes';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Philly Cheese Steak Cervecero', 'Carne, salsa cuatro quesos, bacon y cebolla de verdeo. NEW!', 18500, null, id, true, 6 FROM categorias WHERE nombre = 'Burgers Homenajes';

-- ============================================
-- PRODUCTOS — Quesadillas & Burritos
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Quesadilla Chingonas', 'Tortillas de trigo rellenas de muzzarella y cheddar, tomate, palta, panceta y pollo', 13500, null, id, true, 1 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Quesadilla Caprese', 'Tortillas de trigo rellenas de muzzarella, tomate y rúcula', 12800, null, id, true, 2 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Quesadilla Ternera', 'Tortillas de trigo con queso sardo, muzzarella, ternera y pimientos asados', 13800, null, id, true, 3 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Tacos (Carne / Pollo / Mixtos)', '4 tortillas de trigo, vegetales salteados, carne, pollo o mixtos. Con crema ácida, palta, cheddar, mayonesa del día, pico de gallo y salsa picante', 14500, null, id, true, 4 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Burrito de Carne o Pollo', 'Carne o pollo, tomate, pimiento rojo, pimiento verde, cebolla, zanahoria, palta, mayo del día. Con salsa brava y papas fritas', 15500, null, id, true, 5 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Burrito Cheese Burger', 'Burger, papas fritas, cheddar, palta, panceta, mayonesa del día y barbacoa', 16500, null, id, true, 6 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Burrito Caesar', 'Tortilla, pollo, croutons, lechuga, rúcula, queso parmesano y salsa caesar', 15800, null, id, true, 7 FROM categorias WHERE nombre = 'Quesadillas & Burritos';

-- ============================================
-- PRODUCTOS — Postres
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Volcán de Chocolate', 'Con helado de americana', 8500, null, id, true, 1 FROM categorias WHERE nombre = 'Postres';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Volcán de Dulce de Leche', 'Con corazón de chocolate blanco. Acompañado con helado de americana', 8500, null, id, true, 2 FROM categorias WHERE nombre = 'Postres';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Tiramisú', 'Clásico italiano a base de vainillas embebidas en café, mousse de mascarpone y espolvoreado con cacao', 9200, null, id, true, 3 FROM categorias WHERE nombre = 'Postres';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Suspiro Limeño', 'Delicioso postre peruano, bajo merengue italiano al oporto con helado de americana', 9000, null, id, true, 4 FROM categorias WHERE nombre = 'Postres';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Brownie con Helado', 'Brownie casero con helado de americana', 7800, null, id, true, 5 FROM categorias WHERE nombre = 'Postres';

-- ============================================
-- PRODUCTOS — Cervezas
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Golden (Pinta)', 'Cerveza Golden de canilla. 5% alc. 18 IBUs', 7200, null, id, true, 1 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Golden (½ Pinta)', 'Cerveza Golden de canilla. 5% alc. 18 IBUs', 4200, null, id, true, 2 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Honey (Pinta)', 'Cerveza Honey de canilla. 7% alc. 18 IBUs', 7800, null, id, true, 3 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'IPA (Pinta)', 'Cerveza IPA de canilla. 6.5% alc. 41 IBUs. Amargor alto', 8200, null, id, true, 4 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Orange Pale Ale (Pinta)', 'Cerveza Orange Pale Ale de canilla. 5% alc. 25 IBUs', 7500, null, id, true, 5 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Scottish (Pinta)', 'Cerveza Scottish de canilla. 5.5% alc. 22 IBUs', 7500, null, id, true, 6 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Porter (Pinta)', 'Cerveza Porter de canilla. 6% alc. 24 IBUs', 7800, null, id, true, 7 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Recarga Botellón 1.9L', 'Para llevar. Consultá estilos especiales del día', 22000, null, id, true, 8 FROM categorias WHERE nombre = 'Cervezas';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cerveza Sin TACC', 'Millet American Amber Ale / Golden. Sin gluten', 8500, null, id, true, 9 FROM categorias WHERE nombre = 'Cervezas';

-- ============================================
-- PRODUCTOS — Tragos Clásicos
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Aperol Spritz', 'Aperol, soda, espumante', 9500, null, id, true, 1 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Fernet Branca', 'Perfect Service. Con cola', 8200, null, id, true, 2 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mint Tonic', 'Branca menta ricetta italiana y tónica', 8500, null, id, true, 3 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Amore Milano', 'Whisky Johnnie Walker Red Label, campari, jugo de pomelo y almíbar', 10500, null, id, true, 4 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Expreso Martini', 'Vodka Servona, licor de cafe Borguetti, café expresso y almíbar', 11200, null, id, true, 5 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Jaguar', 'Vodka Sernova Berries, licor de durazno, jugo de limón, jugo de naranja, almíbar y pulpa de frutilla', 11500, null, id, true, 6 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Campari Orange', 'Campari y naranja', 8800, null, id, true, 7 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Campari Tonic', 'Campari, agua tónica', 8800, null, id, true, 8 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Carpano Orange', 'Carpano, soda y rodaja de naranja', 9200, null, id, true, 9 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Tinto de Verano', 'Vino tinto, Sprite y naranja', 8500, null, id, true, 10 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gancia Batido', 'Gancia, jugo de limón, almíbar y hielo', 8200, null, id, true, 11 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Negroni', 'Campari, gin y vermú Carpano rosso', 11500, null, id, true, 12 FROM categorias WHERE nombre = 'Tragos Clásicos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cynar Julep', 'Cynar, menta, azúcar, jugo de pomelo', 10500, null, id, true, 13 FROM categorias WHERE nombre = 'Tragos Clásicos';

-- ============================================
-- PRODUCTOS — Mojitos
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mojito Cubano', 'Ron blanco, almíbar, limón, menta y soda', 9500, null, id, true, 1 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mojito Love', 'Ron blanco, almíbar, limón, menta, soda, jugo de arándanos y frutos rojos', 10200, null, id, true, 2 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mojito Malibu', 'Ron blanco, ron de coco, almíbar, limón, menta, soda', 10200, null, id, true, 3 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Mojito Carioca', 'Ron blanco, almíbar, menta, soda y maracuyá', 10200, null, id, true, 4 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Cuba Libre', 'Ron con cola', 7800, null, id, true, 5 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caipiroska', 'Vodka Sernova, limón, azúcar', 9200, null, id, true, 6 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caipirinha', 'Cachaça, limón, azúcar', 9200, null, id, true, 7 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caipi Tropical', 'Vodka Sernova, maracuyá, limón, azúcar', 9500, null, id, true, 8 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Suspiro', 'Vodka Sernova, suspiro limeño, merengue italiano y azúcar', 11200, null, id, true, 9 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Sex on the Beach', 'Vodka Sernova, licor de durazno, naranja y granadina. Opción: Tequila Sunrise', 10500, null, id, true, 10 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Primera Junta', 'Vodka Sernova, mango, mix de cítricos, almíbar de yerba mate, licor de naranja', 11500, null, id, true, 11 FROM categorias WHERE nombre = 'Mojitos';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Malibu Punch', 'Ron blanco, ron de coco, almíbar, maracuyá, jugo de limón y naranja', 10800, null, id, true, 12 FROM categorias WHERE nombre = 'Mojitos';

-- ============================================
-- PRODUCTOS — Frozen
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Margarita Frozen', 'Tequila, triple sec, jugo de limón', 10800, null, id, true, 1 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Lemon Champ Frozen', 'Espumante, azúcar, helado de limón', 10500, null, id, true, 2 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Daiquiri Frozen', 'Ron blanco, limón, azúcar, frutos de estación. Frutilla, durazno, ananá, frutos rojos, maracuyá', 10500, null, id, true, 3 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Baileys Frozen', 'Baileys, licor de café Borguetti, helado de americana, azúcar', 11500, null, id, true, 4 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Baileys Tentación', 'Baileys, Ron Dorado, helado de dulce de leche, alfajor y azúcar', 12500, null, id, true, 5 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Caribean Ra', 'Vodka Sernova, mango, Ron, helado de americana, maracuyá, azúcar', 11800, null, id, true, 6 FROM categorias WHERE nombre = 'Frozen';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Piña Colada', 'Ron blanco, leche de coco, ananá, azúcar', 10800, null, id, true, 7 FROM categorias WHERE nombre = 'Frozen';

-- ============================================
-- PRODUCTOS — Gin Tonic
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Tonic Clásico', 'Gin Jardín Escondido, limón y tónica. Opciones: Monkey 47, Tanqueray, Beefeater, Hendrick''s, Bombay, Bulldog', 11500, null, id, true, 1 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Tonic Naranja & Canela', 'Gin Jardín Escondido, naranja, canela y tónica', 12200, null, id, true, 2 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Tonic Arándanos', 'Gin Jardín Escondido, arándanos y tónica', 12200, null, id, true, 3 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Tonic Maracuyá', 'Gin Jardín Escondido, maracuyá y tónica', 12200, null, id, true, 4 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Tonic Pepino', 'Gin Jardín Escondido, pepino y tónica', 11800, null, id, true, 5 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Frutos Rojos', 'Gin pink, frutos rojos y tónica', 12500, null, id, true, 6 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gin Frambuesa & Menta', 'Gin pink, frambuesa, menta y tónica', 12500, null, id, true, 7 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Do It', 'Gin, jugo de manzana, jugo de limón, almíbar, jengibre y menta', 12800, null, id, true, 8 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Tom Collins', 'Gin, limón, soda y azúcar', 11200, null, id, true, 9 FROM categorias WHERE nombre = 'Gin Tonic';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Basil Smash', 'Gin, jugo de limón, albahaca, azúcar y soda', 12800, null, id, true, 10 FROM categorias WHERE nombre = 'Gin Tonic';

-- ============================================
-- PRODUCTOS — Sin Alcohol
-- ============================================
INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Limonada Clásica', 'Limón fresco, azúcar, agua con o sin gas', 6500, null, id, true, 1 FROM categorias WHERE nombre = 'Sin Alcohol';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Limonada de Frutilla', 'Limón fresco, frutilla, azúcar, agua con o sin gas', 7200, null, id, true, 2 FROM categorias WHERE nombre = 'Sin Alcohol';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Limonada de Maracuyá', 'Limón fresco, maracuyá, azúcar, agua con o sin gas', 7200, null, id, true, 3 FROM categorias WHERE nombre = 'Sin Alcohol';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Agua Mineral', 'Con o sin gas', 3500, null, id, true, 4 FROM categorias WHERE nombre = 'Sin Alcohol';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Gaseosas', 'Coca-Cola, Sprite, Fanta, Schweppes Tónica', 4200, null, id, true, 5 FROM categorias WHERE nombre = 'Sin Alcohol';

INSERT INTO productos (nombre, descripcion, precio, imagen_url, categoria_id, disponible, orden)
SELECT 'Jugo de Naranja Natural', 'Exprimido al momento', 6800, null, id, true, 6 FROM categorias WHERE nombre = 'Sin Alcohol';