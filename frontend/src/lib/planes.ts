// Planes y módulos que se muestran en la landing y en /precios.
// Los precios tienen que coincidir con backend/src/utils/planPrecios.js (el
// panel y Mercado Pago cobran desde ahí). Sólo hay cobro mensual.

export const TRIAL_DIAS = 15;

export type CodigoPlan = "basic" | "standard" | "premium";
export type CodigoModulo = "whatsapp" | "ia" | "mapa";

export type Plan = {
  code: CodigoPlan;
  name: string;
  desc: string;
  mensual: number;
  // "Todo lo del X, más:" (vacío en el Básico).
  base?: string;
  perks: string[];
  estilo: "claro" | "aji" | "tinta";
};

export const PLANES: Plan[] = [
  {
    code: "basic",
    name: "Básico",
    desc: "Para arrancar con tu negocio y vender online.",
    mensual: 22000,
    perks: [
      "1 negocio y hasta 50 productos",
      "Tu página con QR y link",
      "Pedidos para retirar, delivery y en la mesa",
      "Talles, colores y productos a medida",
      "Servicios, presupuestos y turnos",
      "Clientes y estadísticas",
      "Usuarios para tu equipo",
    ],
    estilo: "claro",
  },
  {
    code: "standard",
    name: "Estándar",
    desc: "Para atender por WhatsApp sin estar pegado al celular.",
    mensual: 44000,
    base: "Todo lo del Básico, más:",
    perks: [
      "Hasta 3 negocios y 180 productos",
      "Control de stock",
      "WhatsApp: avisos automáticos y chats",
      "Asistente con IA que responde por vos",
      "El repartidor en el mapa",
    ],
    estilo: "aji",
  },
  {
    code: "premium",
    name: "Premium",
    desc: "Para varios locales y una carta grande.",
    mensual: 72000,
    base: "Todo lo del Estándar, más:",
    perks: ["Hasta 5 negocios", "Hasta 1.000 productos"],
    estilo: "tinta",
  },
];

export type Modulo = {
  codigo: CodigoModulo;
  nombre: string;
  precio: number;
  desc: string;
  requiere?: CodigoModulo;
};

// Se suman al Básico; en Estándar y Premium vienen incluidos.
export const MODULOS: Modulo[] = [
  {
    codigo: "whatsapp",
    nombre: "WhatsApp",
    precio: 12000,
    desc: "Tus clientes reciben el aviso de cada pedido y vos chateás con ellos desde el panel.",
  },
  {
    codigo: "ia",
    nombre: "Asistente con IA",
    precio: 11000,
    desc: "Contesta precios, horarios y pedidos por WhatsApp mientras atendés el local. Si no sabe, te pasa la charla.",
    requiere: "whatsapp",
  },
  {
    codigo: "mapa",
    nombre: "Mapa del repartidor",
    precio: 6000,
    desc: "Vos y tu cliente ven dónde está el pedido, sin llamar para preguntar.",
  },
];

// "Asistente con IA (con WhatsApp)": para que nadie sume sólo la IA a la cuenta.
export const nombreConRequisito = (m: Modulo) =>
  m.requiere ? `${m.nombre} (con ${MODULOS.find((x) => x.codigo === m.requiere)!.nombre})` : m.nombre;

export const precioPlan = (code: CodigoPlan) => PLANES.find((p) => p.code === code)!.mensual;

export const pesos = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 0 });
