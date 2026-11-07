// Menús de ejemplo (ficticios) para la comanda del inicio y la demo
// "Hacé de cliente un minuto": uno por rubro, cada uno con su color.
export type Demo = {
  rubro: string;
  nombre: string;
  tagline: string;
  accent: string;
  items: { name: string; desc: string; price: string }[];
};

export const DEMOS: Demo[] = [
  {
    rubro: "Hamburguesería",
    nombre: "Burger Club",
    tagline: "Smash burgers · Delivery",
    accent: "#f97316",
    items: [
      { name: "Doble Smash", desc: "Doble carne, cheddar, pickles", price: "$8.900" },
      { name: "Crispy Chicken", desc: "Pollo crocante, slaw, mayo", price: "$7.500" },
      { name: "Papas trufadas", desc: "Parmesano y aceite de trufa", price: "$4.200" },
    ],
  },
  {
    rubro: "Cafetería",
    nombre: "Café Aroma",
    tagline: "Especialidad · Brunch",
    accent: "#d4a373",
    items: [
      { name: "Flat White", desc: "Doble ristretto, leche texturizada", price: "$3.200" },
      { name: "Medialunas x3", desc: "De manteca, recién horneadas", price: "$2.400" },
      { name: "Cheesecake", desc: "Frutos rojos de estación", price: "$4.100" },
    ],
  },
  {
    rubro: "Heladería",
    nombre: "Gelato Mío",
    tagline: "Artesanal · Desde 1998",
    accent: "#ec4899",
    items: [
      { name: "Pote 1/4 kg", desc: "Hasta 3 sabores a elección", price: "$5.600" },
      { name: "Cucurucho doble", desc: "Bañado en chocolate", price: "$3.900" },
      { name: "Bombón helado", desc: "Dulce de leche granizado", price: "$2.800" },
    ],
  },
  {
    rubro: "Bar",
    nombre: "Neon Bar",
    tagline: "Coctelería · After office",
    accent: "#a78bfa",
    items: [
      { name: "Negroni", desc: "Gin, Campari, vermut rosso", price: "$6.500" },
      { name: "Old Fashioned", desc: "Bourbon, angostura, naranja", price: "$7.200" },
      { name: "Tabla de tapas", desc: "Quesos, aceitunas, jamón", price: "$9.800" },
    ],
  },
  {
    rubro: "Pizzería",
    nombre: "Forno Napoli",
    tagline: "Horno a leña · Take away",
    accent: "#ef4444",
    items: [
      { name: "Margherita", desc: "Fior di latte, albahaca fresca", price: "$9.500" },
      { name: "Empanadas x6", desc: "Carne cortada a cuchillo", price: "$7.800" },
      { name: "Malbec", desc: "Copa de la casa", price: "$3.500" },
    ],
  },
  {
    rubro: "Sushi",
    nombre: "Sushi Zen",
    tagline: "Nikkei · Delivery",
    accent: "#2dd4bf",
    items: [
      { name: "Combinado 30 pz", desc: "Salmón, langostino y palta", price: "$24.900" },
      { name: "Bento Zen", desc: "Gyozas, rolls y arroz yakimeshi", price: "$14.500" },
      { name: "Tiradito", desc: "Pesca blanca, leche de tigre", price: "$11.200" },
    ],
  },
];

