import type { Categoria, Configuracion, Producto, VarianteGrupo } from "../services/api";

// Menú de ejemplo de /menu (sin slug ni ?negocio). Todo vive acá: la página
// no llama a la API y el carrito no envía el pedido a ningún lado.

const foto = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=400&q=70`;

const abierto = { cerrado: false, franjas: [{ desde: "12:00", hasta: "00:00" }] };

export const DEMO_CONFIG: Configuracion = {
  id: 0,
  nombre: "La Esquina",
  descripcion: "Hamburguesas, pizzas y algo para compartir. Este es un menú de ejemplo.",
  direccion: "Av. Corrientes 1234, CABA",
  telefono: null,
  whatsapp: null,
  email: null,
  horarios: null,
  logo_url: null,
  portada_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70",
  mesas_activo: true,
  mesas_cantidad: 12,
  delivery_activo: true,
  retiro_activo: true,
  color_primario: "#f97316",
  horarios_config: Array.from({ length: 7 }, () => abierto),
  moneda: "ARS",
  tipo_rubro: "gastronomia",
};

export const DEMO_CATEGORIAS: Categoria[] = [
  { id: 1, nombre: "Hamburguesas", orden: 1, activo: true },
  { id: 2, nombre: "Pizzas", orden: 2, activo: true },
  { id: 3, nombre: "Para compartir", orden: 3, activo: true },
  { id: 4, nombre: "Bebidas", orden: 4, activo: true },
  { id: 5, nombre: "Postres", orden: 5, activo: true },
];

const extrasBurger: VarianteGrupo[] = [
  {
    id: 1,
    nombre: "Tamaño",
    tipo: "single",
    obligatorio: true,
    orden: 1,
    opciones: [
      { id: 1, nombre: "Simple", precio_extra: 0 },
      { id: 2, nombre: "Doble", precio_extra: 2500 },
      { id: 3, nombre: "Triple", precio_extra: 4500 },
    ],
  },
  {
    id: 2,
    nombre: "Extras",
    tipo: "multi",
    obligatorio: false,
    orden: 2,
    opciones: [
      { id: 4, nombre: "Panceta", precio_extra: 1200 },
      { id: 5, nombre: "Huevo frito", precio_extra: 800 },
      { id: 6, nombre: "Cheddar extra", precio_extra: 900 },
    ],
  },
];

const tamanoPizza: VarianteGrupo[] = [
  {
    id: 3,
    nombre: "Tamaño",
    tipo: "single",
    obligatorio: true,
    orden: 1,
    opciones: [
      { id: 7, nombre: "Chica (4 porciones)", precio_extra: 0 },
      { id: 8, nombre: "Grande (8 porciones)", precio_extra: 4000 },
    ],
  },
];

let nextId = 1;
const p = (
  categoria_id: number,
  nombre: string,
  descripcion: string,
  precio: number,
  imagen: string | null,
  variantes?: VarianteGrupo[],
): Producto => ({
  id: nextId,
  orden: nextId++,
  nombre,
  descripcion,
  precio,
  imagen_url: imagen && foto(imagen),
  categoria_id,
  disponible: true,
  variantes,
});

export const DEMO_PRODUCTOS: Producto[] = [
  p(1, "Clásica de la casa", "Medallón de 150 g, cheddar, lechuga, tomate y salsa de la casa.", 8900, "1568901346375-23c9450c58cd", extrasBurger),
  p(1, "Smash con cheddar", "Doble carne aplastada, cheddar fundido, pickles y cebolla.", 9800, "1550547660-d9450f859349", extrasBurger),
  p(1, "Veggie", "Medallón de lentejas y quinoa, palta, rúcula y mayo de ajo.", 8500, "1520072959219-c595dc870360"),
  p(2, "Muzzarella", "Salsa de tomate, muzzarella y orégano. Horno a leña.", 9500, "1513104890138-7c749659a591", tamanoPizza),
  p(2, "Napolitana", "Muzzarella, rodajas de tomate, ajo y albahaca fresca.", 10500, "1574071318508-1cdbab80d002", tamanoPizza),
  p(3, "Papas con cheddar", "Papas fritas con cheddar, panceta y verdeo.", 6200, "1573080496219-bb080dd4f877"),
  p(3, "Ensalada César", "Lechuga, pollo grillado, croutons, parmesano y aderezo César.", 7400, "1512621776951-a57141f2eefd"),
  p(4, "Limonada", "Limón, menta y jengibre. 500 ml.", 3200, null),
  p(4, "Cerveza artesanal", "IPA o rubia, pinta de 500 ml.", 4500, "1608270586620-248524c67de9"),
  p(4, "Café", "Espresso, cortado o con leche.", 2400, "1509042239860-f550ce710b93"),
  p(5, "Cheesecake", "Base de galletita y frutos rojos de estación.", 5200, "1533134242443-d4fd215305ad"),
  p(5, "Brownie con helado", "Brownie tibio con una bocha de helado de crema.", 5600, "1606313564200-e75d5e30476c"),
  // Por peso: precio del kilo; el cliente elige de a 100 g.
  { ...p(5, "Helado artesanal", "Dulce de leche, chocolate, frutilla o limón. Precio por kilo.", 14000, "1563805042-7684c019e1cb"), unidad_venta: "kg" },
];
