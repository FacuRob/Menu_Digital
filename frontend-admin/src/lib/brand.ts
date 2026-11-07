import type { CSSProperties } from "react";
import logoMark from "../assets/logo-mark.svg";

// Identidad del SaaS. Un solo lugar para el nombre, los colores y el logo.
export const BRAND_NAME = "DinexFlow";

// Logo de la marca (el mismo de la landing): globo de chat con QR sobre ají.
// SVG liviano; los originales viejos quedan en assets/Imagen.
export const BRAND_LOGO = logoMark;

// Colores de marca ("Hora pico"): ají y su versión tostada.
export const BRAND_C1 = "#ff5b24";
export const BRAND_C2 = "#e8470f";
export const BRAND_GRADIENT = `linear-gradient(135deg, ${BRAND_C1}, ${BRAND_C2})`;

// Wordmark: tinta (o hueso en oscuro), ensanchado, sin degradado.
export const brandTextStyle: CSSProperties = {
  color: "var(--fg)",
  fontStretch: "112%",
};
