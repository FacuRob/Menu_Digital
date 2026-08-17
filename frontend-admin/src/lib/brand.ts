import type { CSSProperties } from "react";
import logoIcon from "../assets/Imagen/Logo.png";
import logoLockup from "../assets/Imagen/Logo-Titulo.png";

// Identidad del SaaS. Un solo lugar para el nombre, los colores y el logo.
export const BRAND_NAME = "DinexFlow";

// Logos de marca (con fondo transparente).
//   BRAND_LOGO       → solo el ícono (para badges/favicon).
//   BRAND_LOGO_FULL  → ícono + nombre (lockup para pantallas de marca).
export const BRAND_LOGO = logoIcon;
export const BRAND_LOGO_FULL = logoLockup;

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
