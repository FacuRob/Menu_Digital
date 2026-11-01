import type { CSSProperties } from "react";
import logoIcon from "../assets/Imagen/logo-icon.jpg";

// Identidad del SaaS. Un solo lugar para el nombre, los colores y el logo.
export const BRAND_NAME = "DinexFlow";

// Ícono de marca: cuadrado, ya recortado, sobre fondo blanco (6 KB).
// Mostrarlo con bordes redondeados. Los originales en alta (Logo.png y
// Logo-Titulo.png, ~70 KB c/u) quedan en assets/Imagen para material
// gráfico, pero no se usan en la app para que cargue rápido.
export const BRAND_LOGO = logoIcon;

// Dos colores de marca → degradado (indigo → cyan).
export const BRAND_C1 = "#6366f1";
export const BRAND_C2 = "#06b6d4";
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_C1}, ${BRAND_C2})`;

// Estilo para el wordmark con texto en degradado.
export const brandTextStyle: CSSProperties = {
  backgroundImage: BRAND_GRADIENT,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
};
