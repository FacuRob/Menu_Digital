import type { CSSProperties } from "react";

// Identidad del SaaS. Un solo lugar para el nombre y los colores de marca.
export const BRAND_NAME = "DinexFlow";

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
