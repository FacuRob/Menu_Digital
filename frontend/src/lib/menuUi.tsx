import type { CSSProperties } from "react";

// ── Paleta ───────────────────────────────────────────────────
// Los colores salen de variables CSS que setea el menú según la
// configuración del negocio (con fallback al naranja por defecto).
export const PRIMARY = "var(--mp, #ff5722)";
export const PRIMARY_DARK = "var(--mp-dark, #e64a19)";
export const PRIMARY_SOFT = "var(--mp-soft, #fff3ef)";
export const PRIMARY_SHADOW = "var(--mp-shadow, rgba(255,87,34,.4))";

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

const darken = (hex: string, amt = 0.15) => {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.round(c * (1 - amt)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// Devuelve las variables CSS de la paleta a partir de un color primario.
export const paletteVars = (hex?: string | null): CSSProperties => {
  const color = hex || "#ff5722";
  const { r, g, b } = hexToRgb(color);
  return {
    ["--mp" as string]: color,
    ["--mp-dark" as string]: darken(color, 0.15),
    ["--mp-soft" as string]: `rgba(${r},${g},${b},0.10)`,
    ["--mp-shadow" as string]: `rgba(${r},${g},${b},0.4)`,
  } as CSSProperties;
};

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

export const fmt = (n: number) => {
  const decimales = SIN_DECIMALES.has(monedaActual) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE_POR_MONEDA[monedaActual] || "es-AR", {
    style: "currency",
    currency: monedaActual,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n || 0);
};

// Precio neto sin IVA (21%) — usado en el modal.
export const neto = (n: number) => (n || 0) / 1.21;

// ── Ícono de categoría (line icons naranjas) ─────────────────
// Mapea por palabra clave del nombre; con fallback a cubiertos.
export function CategoriaIcon({
  nombre,
  size = 26,
  style,
}: {
  nombre: string;
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
}: {
  url?: string | null;
  alt: string;
  style?: CSSProperties;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={alt}
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
        background: "linear-gradient(135deg,#fbe9e2,#f6d9cd)",
        color: PRIMARY,
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
