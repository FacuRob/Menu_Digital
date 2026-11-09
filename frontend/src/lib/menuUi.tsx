import type { CSSProperties, ReactNode } from "react";
import { cld } from "./cloudinary";

// ── Paleta ───────────────────────────────────────────────────
// Los colores salen de variables CSS que setea el menú según la
// configuración del negocio (con fallback al naranja por defecto).
export const PRIMARY = "var(--mp, #ff5722)";
export const PRIMARY_SOFT = "var(--mp-soft, #fff3ef)";

const hexToRgb = (hex: string) => {
  let h = (hex || "").replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h || "ff5722", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

type Rgb = { r: number; g: number; b: number };
const TINTA: Rgb = { r: 17, g: 18, b: 22 };
const BLANCO: Rgb = { r: 255, g: 255, b: 255 };
const HUESO: Rgb = { r: 239, g: 237, b: 230 };
const NEGRO: Rgb = { r: 0, g: 0, b: 0 };

const scale = ({ r, g, b }: Rgb, f: number): Rgb => ({
  r: Math.round(r * f),
  g: Math.round(g * f),
  b: Math.round(b * f),
});
const css = ({ r, g, b }: Rgb) => `rgb(${r},${g},${b})`;

// Contraste WCAG entre dos colores.
const luminancia = ({ r, g, b }: Rgb) => {
  const l = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * l(r) + 0.7152 * l(g) + 0.0722 * l(b);
};
const contraste = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Variables CSS de la paleta a partir del color que eligió el local.
// Funciona con cualquier color del selector, no sólo con las sugeridas:
//   --mp-on  texto sobre el color (tinta o blanco, el que más contraste)
//   --mp-ink el color oscurecido hasta leerse como texto sobre hueso
export const paletteVars = (hex?: string | null): CSSProperties => {
  // Un valor raro (vacío, 8 dígitos, texto) vuelve al naranja por defecto.
  const color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || "") ? (hex as string) : "#ff5722";
  const rgb = hexToRgb(color);
  // Texto encima: el de más contraste entre tinta, blanco y negro (siempre ≥4,5:1).
  const on = [TINTA, BLANCO, NEGRO].reduce((a, b) => (contraste(rgb, b) > contraste(rgb, a) ? b : a));
  // Como texto: 4,5:1 contra el fondo más difícil donde aparece, su propio
  // color suave (--mp-soft, 12 %) apoyado sobre hueso.
  const suave: Rgb = {
    r: Math.round(HUESO.r + (rgb.r - HUESO.r) * 0.12),
    g: Math.round(HUESO.g + (rgb.g - HUESO.g) * 0.12),
    b: Math.round(HUESO.b + (rgb.b - HUESO.b) * 0.12),
  };
  let ink = rgb;
  for (let i = 0; i < 40 && contraste(ink, suave) < 4.5; i++) ink = scale(ink, 0.92);
  // Hover: oscurece (o aclara si es casi negro) sin que el texto encima baje de 4,5:1.
  const mezcla = (c: Rgb, k: number): Rgb => ({ r: Math.round(c.r + (255 - c.r) * k), g: Math.round(c.g + (255 - c.g) * k), b: Math.round(c.b + (255 - c.b) * k) });
  const hover = [luminancia(rgb) < 0.02 ? mezcla(rgb, 0.18) : scale(rgb, 0.88), mezcla(rgb, 0.12), rgb].find((c) => contraste(c, on) >= 4.5) || rgb;
  return {
    ["--mp" as string]: color,
    ["--mp-on" as string]: css(on),
    ["--mp-dark" as string]: css(hover),
    // Colores casi blancos: borde para que el botón no se pierda sobre blanco.
    ["--mp-edge" as string]: contraste(rgb, BLANCO) < 1.4 ? "rgba(17,18,22,0.35)" : "transparent",
    ["--mp-ink" as string]: css(ink),
    ["--mp-soft" as string]: `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`,
  } as CSSProperties;
};
export const PRIMARY_ON = "var(--mp-on, #111216)";
export const PRIMARY_INK = "var(--mp-ink, #b5370a)";

// Paletas sugeridas para el panel de administración.
export const PALETAS = [
  { nombre: "Naranja", color: "#ff5722" },
  { nombre: "Rojo", color: "#e11d48" },
  { nombre: "Verde", color: "#16a34a" },
  { nombre: "Azul", color: "#2563eb" },
  { nombre: "Violeta", color: "#7c3aed" },
  { nombre: "Turquesa", color: "#0d9488" },
  { nombre: "Fucsia", color: "#db2777" },
  { nombre: "Ámbar", color: "#d97706" },
];

// ── Formato de moneda (según la moneda del negocio) ──────────
// Cada negocio elige su moneda; el menú se muestra en esa. El locale
// se elige por moneda para respetar separadores/símbolo locales.
const LOCALE_POR_MONEDA: Record<string, string> = {
  ARS: "es-AR",
  USD: "en-US",
  EUR: "es-ES",
  BRL: "pt-BR",
  MXN: "es-MX",
  CLP: "es-CL",
  COP: "es-CO",
  PEN: "es-PE",
  UYU: "es-UY",
  PYG: "es-PY",
  BOB: "es-BO",
  GTQ: "es-GT",
};

// Monedas sin decimales (no tiene sentido mostrar centavos).
const SIN_DECIMALES = new Set(["CLP", "COP", "PYG"]);

// Moneda activa del menú (la setea el menú al cargar la config del negocio).
let monedaActual = "ARS";
export const setMonedaMenu = (moneda?: string | null) => {
  if (moneda) monedaActual = moneda;
};

// Sin centavos cuando el monto es entero ($ 8.900, no $ 8.900,00).
export const fmt = (n: number) => {
  const decimales = SIN_DECIMALES.has(monedaActual) || Number.isInteger(Math.round((n || 0) * 100) / 100) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE_POR_MONEDA[monedaActual] || "es-AR", {
    style: "currency",
    currency: monedaActual,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n || 0);
};

// ── Venta por peso ──────────────────────────────────────────
// Productos por kg: el cliente elige de a 100 g, con mínimo 100 g.
export const PASO_KG = 0.1;
export const esPorPeso = (p: { unidad_venta?: string | null }) => p.unidad_venta === "kg";
export const redondearKg = (kg: number) => Math.round(kg * 1000) / 1000;
// 0.35 → "350 g"; 1.25 → "1,25 kg".
export const fmtPeso = (kg: number) =>
  kg < 1
    ? `${Math.round(kg * 1000)} g`
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(kg)} kg`;

// Precio neto sin IVA (21%) — usado en el modal.
export const neto = (n: number) => (n || 0) / 1.21;

// Rubro del negocio (multi-rubro). Decide el SET de iconos del menú.
export type TipoRubro = "gastronomia" | "retail" | "servicios" | "generico";

// ── Ícono de categoría (line icons, color primario) ──────────
// Elige el set de iconos según el `rubro` del negocio y, dentro del set,
// mapea por palabra clave del nombre de la categoría. Con fallback por rubro.
// Gastronomía es el comportamiento histórico (retrocompatible).
export function CategoriaIcon({
  nombre,
  rubro,
  size = 26,
  style,
}: {
  nombre: string;
  rubro?: TipoRubro | string | null;
  size?: number;
  style?: CSSProperties;
}) {
  const n = (nombre || "").toLowerCase();
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style,
  };

  const has = (...keys: string[]) => keys.some((k) => n.includes(k));

  // ── Retail / tienda ────────────────────────────────────────
  if (rubro === "retail") {
    // Calzado
    if (has("calzado", "zapato", "zapatilla", "bota", "sneaker"))
      return (
        <svg {...common}>
          <path d="M2 16h13l4 2h3v2H2v-4Z" />
          <path d="M2 16v-4l4-1 2 2 3-1 2 2 2 1" />
        </svg>
      );
    // Ropa / indumentaria
    if (has("ropa", "remera", "camisa", "pantal", "vestido", "buzo", "campera", "indument", "moda"))
      return (
        <svg {...common}>
          <path d="M8 3 4 6l2 3 2-1v10h8V8l2 1 2-3-4-3-2 2H10L8 3Z" />
        </svg>
      );
    // Accesorios / joyas / relojes
    if (has("accesorio", "joya", "reloj", "bijou", "anillo", "collar"))
      return (
        <svg {...common}>
          <path d="M12 3 4 9l8 12 8-12-8-6Z" />
          <path d="M8 9h8M12 3 8 9M12 3l4 6" />
        </svg>
      );
    // Tecnología / electro
    if (has("tecno", "electro", "celular", "compu", "notebook", "audio"))
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M2 20h20" />
        </svg>
      );
    // Hogar / deco
    if (has("hogar", "deco", "mueble", "bazar"))
      return (
        <svg {...common}>
          <path d="M3 11 12 4l9 7" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );
    // Default retail → etiqueta de precio
    return (
      <svg {...common}>
        <path d="M3 12V4h8l9 9-8 8-9-9Z" />
        <circle cx="7.5" cy="7.5" r="1.3" />
      </svg>
    );
  }

  // ── Servicios ──────────────────────────────────────────────
  if (rubro === "servicios") {
    // Peluquería / corte / barbería
    if (has("corte", "cabello", "pelu", "barb", "peinad"))
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <path d="M8 7.5 20 18M8 16.5 20 6" />
        </svg>
      );
    // Uñas / manicura / estética
    if (has("uña", "uñas", "manicur", "estetic", "belleza", "spa", "facial"))
      return (
        <svg {...common}>
          <path d="M9 3c-1.5 2-2 5-2 9s.5 7 2 9M15 3c1.5 2 2 5 2 9s-.5 7-2 9" />
          <path d="M9 12h6" />
        </svg>
      );
    // Masajes / salud / bienestar
    if (has("masaj", "salud", "terap", "consult", "kinesi"))
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2" />
          <path d="M5 11c3 2 11 2 14 0M12 7v6M8 21l4-6 4 6" />
        </svg>
      );
    // Clases / cursos / turnos → calendario
    if (has("clase", "curso", "turno", "reserva", "cita", "sesion", "sesión"))
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18M8 2v4M16 2v4" />
        </svg>
      );
    // Default servicios → estrella de servicio / brillo
    return (
      <svg {...common}>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  // ── Genérico ───────────────────────────────────────────────
  if (rubro === "generico") {
    if (has("pack", "combo", "caja", "kit"))
      return (
        <svg {...common}>
          <path d="M3 8 12 3l9 5v8l-9 5-9-5V8Z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      );
    // Default genérico → etiqueta neutra
    return (
      <svg {...common}>
        <path d="M4 7a1 1 0 0 1 1-1h9l6 6-8 8-6-6V7Z" />
        <circle cx="8" cy="10" r="1.3" />
      </svg>
    );
  }

  // ══ Gastronomía (default histórico) ══════════════════════════
  // Parrilla / cortes / carne → llama
  if (has("parrilla", "corte", "carne", "asado", "bife", "provoleta"))
    return (
      <svg {...common}>
        <path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1.5-4C10 8 12 6 12 3Z" />
        <path d="M12 21a2 2 0 0 0 2-2c0-1.2-1-2-2-3-1 1-2 1.8-2 3a2 2 0 0 0 2 2Z" />
      </svg>
    );

  // Hamburguesa
  if (has("hamburgues", "burger"))
    return (
      <svg {...common}>
        <path d="M4 10a8 8 0 0 1 16 0Z" />
        <path d="M3 14h18" />
        <path d="M5 18h14a2 2 0 0 0 2-2H3a2 2 0 0 0 2 2Z" />
      </svg>
    );

  // Sandwiches / combos con pan
  if (has("sandwich", "sándwich", "pan", "lomito"))
    return (
      <svg {...common}>
        <path d="M3 12a9 9 0 0 1 18 0Z" />
        <path d="M4 12h16l-1.2 5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 12Z" />
      </svg>
    );

  // Cerveza
  if (has("cerveza", "birra", "beer"))
    return (
      <svg {...common}>
        <path d="M5 8v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
        <path d="M15 10h2a3 3 0 0 1 0 6h-2" />
        <path d="M6 8c1 0 1.5-.6 3-.6s2 .6 3 .6" />
        <path d="M9 12v6M12 12v6" />
      </svg>
    );

  // Vino
  if (has("vino", "wine"))
    return (
      <svg {...common}>
        <path d="M8 22h8" />
        <path d="M12 15v7" />
        <path d="M7 4h10c-.3 3-1 6-5 7-4-1-4.7-4-5-7Z" />
      </svg>
    );

  // Bebidas / gaseosa
  if (has("bebida", "gaseosa", "agua", "trago", "refresco"))
    return (
      <svg {...common}>
        <path d="M7 8h10l-1 12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 8Z" />
        <path d="M6 8h12" />
        <path d="M10 8V4h4v4" />
      </svg>
    );

  // Postre
  if (has("postre", "helado", "dulce", "torta", "flan"))
    return (
      <svg {...common}>
        <path d="M12 22l-4-10h8l-4 10Z" />
        <path d="M8 12a4 4 0 1 1 8 0" />
      </svg>
    );

  // Combos
  if (has("combo"))
    return (
      <svg {...common}>
        <path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4Z" />
        <path d="M4 6h16" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    );

  // Agregados
  if (has("agregado", "extra", "adicional"))
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );

  // Default → cubiertos (entradas, acompañamiento, etc.)
  return (
    <svg {...common}>
      <path d="M8 3v6a2 2 0 0 1-4 0V3" />
      <path d="M6 9v12" />
      <path d="M18 3v18" />
      <path d="M18 3c-1.6 0-2.6 1.7-2.6 4S16.4 11 18 11" />
    </svg>
  );
}

// ── Imagen de producto con fallback por defecto ──────────────
export function ProductImage({
  url,
  alt,
  style,
  w,
  h,
  fill,
}: {
  url?: string | null;
  alt: string;
  style?: CSSProperties;
  w?: number;
  h?: number;
  fill?: boolean;
}) {
  if (url) {
    return (
      <img
        src={cld(url, { w, h, fill }) || url}
        alt={alt}
        loading="lazy"
        style={{ objectFit: "cover", ...style }}
        onError={(e) => {
          const img = e.currentTarget;
          img.style.display = "none";
          const parent = img.parentElement;
          if (parent) parent.setAttribute("data-fallback", "1");
        }}
      />
    );
  }
  return <DefaultFoodImage style={style} />;
}

export function DefaultFoodImage({ style }: { style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-2, #e4e1d8)",
        color: "var(--fg-2, #5b5d66)",
        ...style,
      }}
    >
      <svg
        width="34%"
        height="34%"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.55, maxWidth: 56, maxHeight: 56 }}
      >
        <path d="M8 3v6a2 2 0 0 1-4 0V3" />
        <path d="M6 9v12" />
        <path d="M18 3v18" />
        <path d="M18 3c-1.6 0-2.6 1.7-2.6 4S16.4 11 18 11" />
      </svg>
    </div>
  );
}

// Íconos de línea (contacto y modos de entrega), mismo trazo que las categorías.
const contactIcons: Record<string, ReactNode> = {
  pin: (
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  mesa: (
    <>
      <path d="M8 3v6a2 2 0 0 1-4 0V3M6 9v12" />
      <path d="M18 3v18M18 3c-1.6 0-2.6 1.7-2.6 4S16.4 11 18 11" />
    </>
  ),
  bolsa: (
    <>
      <path d="M5 8h14l-1 13H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  moto: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M9 17h6l-2-6h-3M15 11h2l1 3M13 7h3" />
    </>
  ),
};

export const CIcon = ({ icon, size = 15 }: { icon: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    {contactIcons[icon]}
  </svg>
);
