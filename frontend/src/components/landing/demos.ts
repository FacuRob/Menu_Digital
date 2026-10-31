// Menús de ejemplo para el carrusel del hero: uno por rubro, cada uno con su
// propio color, para mostrar que el menú se adapta a cualquier negocio.
export type Demo = {
  rubro: string;
  nombre: string;
  tagline: string;
  emoji: string;
  accent: string;
  bg: string;
  cats: string[];
  items: { emoji: string; name: string; desc: string; price: string; tag?: string }[];
};

export const DEMOS: Demo[] = [
  {
    rubro: "Hamburguesería",
    nombre: "Burger Club",
    tagline: "Smash burgers · Delivery",
    emoji: "🍔",
    accent: "#f97316",
    bg: "linear-gradient(160deg,#431407,#1c0a03)",
    cats: ["Burgers", "Combos", "Papas", "Bebidas"],
    items: [
      { emoji: "🍔", name: "Doble Smash", desc: "Doble carne, cheddar, pickles", price: "$8.900", tag: "Top" },
      { emoji: "🍗", name: "Crispy Chicken", desc: "Pollo crocante, slaw, mayo", price: "$7.500" },
      { emoji: "🍟", name: "Papas trufadas", desc: "Parmesano y aceite de trufa", price: "$4.200" },
    ],
  },
  {
    rubro: "Cafetería",
    nombre: "Café Aroma",
    tagline: "Especialidad · Brunch",
    emoji: "☕",
    accent: "#d4a373",
    bg: "linear-gradient(160deg,#3b2414,#160d07)",
    cats: ["Cafés", "Brunch", "Dulces", "Jugos"],
    items: [
      { emoji: "☕", name: "Flat White", desc: "Doble ristretto, leche texturizada", price: "$3.200", tag: "Nuevo" },
      { emoji: "🥐", name: "Medialunas x3", desc: "De manteca, recién horneadas", price: "$2.400" },
      { emoji: "🍰", name: "Cheesecake", desc: "Frutos rojos de estación", price: "$4.100" },
    ],
  },
  {
    rubro: "Heladería",
    nombre: "Gelato Mío",
    tagline: "Artesanal · Desde 1998",
    emoji: "🍦",
    accent: "#ec4899",
    bg: "linear-gradient(160deg,#500724,#1f0310)",
    cats: ["Potes", "Cucuruchos", "Postres", "Tortas"],
    items: [
      { emoji: "🍨", name: "Pote 1/4 kg", desc: "Hasta 3 sabores a elección", price: "$5.600", tag: "Top" },
      { emoji: "🍦", name: "Cucurucho doble", desc: "Bañado en chocolate", price: "$3.900" },
      { emoji: "🧁", name: "Bombón helado", desc: "Dulce de leche granizado", price: "$2.800" },
    ],
  },
  {
    rubro: "Bar",
    nombre: "Neon Bar",
    tagline: "Coctelería · After office",
    emoji: "🍸",
    accent: "#a78bfa",
    bg: "linear-gradient(160deg,#2e1065,#0f0520)",
    cats: ["Cócteles", "Cervezas", "Tapas", "Sin alcohol"],
    items: [
      { emoji: "🍸", name: "Negroni", desc: "Gin, Campari, vermut rosso", price: "$6.500", tag: "2x1" },
      { emoji: "🥃", name: "Old Fashioned", desc: "Bourbon, angostura, naranja", price: "$7.200" },
      { emoji: "🫒", name: "Tabla de tapas", desc: "Quesos, aceitunas, jamón", price: "$9.800" },
    ],
  },
  {
    rubro: "Pizzería",
    nombre: "Forno Napoli",
    tagline: "Horno a leña · Take away",
    emoji: "🍕",
    accent: "#ef4444",
    bg: "linear-gradient(160deg,#450a0a,#1a0404)",
    cats: ["Pizzas", "Empanadas", "Postres", "Vinos"],
    items: [
      { emoji: "🍕", name: "Margherita", desc: "Fior di latte, albahaca fresca", price: "$9.500", tag: "Top" },
      { emoji: "🥟", name: "Empanadas x6", desc: "Carne cortada a cuchillo", price: "$7.800" },
      { emoji: "🍷", name: "Malbec", desc: "Copa de la casa", price: "$3.500" },
    ],
  },
  {
    rubro: "Sushi",
    nombre: "Sushi Zen",
    tagline: "Nikkei · Delivery",
    emoji: "🍣",
    accent: "#2dd4bf",
    bg: "linear-gradient(160deg,#042f2e,#021312)",
    cats: ["Rolls", "Combinados", "Calientes", "Bebidas"],
    items: [
      { emoji: "🍣", name: "Combinado 30 pz", desc: "Salmón, langostino y palta", price: "$24.900", tag: "Top" },
      { emoji: "🍱", name: "Bento Zen", desc: "Gyozas, rolls y arroz yakimeshi", price: "$14.500" },
      { emoji: "🥢", name: "Tiradito", desc: "Pesca blanca, leche de tigre", price: "$11.200" },
    ],
  },
];

