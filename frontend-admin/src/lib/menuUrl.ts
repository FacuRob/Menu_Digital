// URLs del menú público (el otro frontend).
//
// MENU_PUBLIC_BASE  → la URL real que ven los clientes (QR, "copiar link").
//                     VITE_MENU_URL; si falta, la de Render.
// MENU_PREVIEW_BASE → la que se carga en la vista previa del panel
//                     (/menu/:slug). En desarrollo apunta al menú local
//                     (VITE_MENU_DEV_URL o http://localhost:3000) para ver
//                     los cambios sin desplegar.
const clean = (u: string) => u.replace(/\/+$/, "");

export const MENU_PUBLIC_BASE = clean(
  (import.meta.env.VITE_MENU_URL as string | undefined) ||
    "https://menu-digital-frontend-qxjm.onrender.com",
);

export const MENU_PREVIEW_BASE = import.meta.env.DEV
  ? clean((import.meta.env.VITE_MENU_DEV_URL as string | undefined) || "http://localhost:3000")
  : MENU_PUBLIC_BASE;

// Ruta del menú de un negocio: /menu/:slug (o ?negocio=<id> si no hay slug).
export const menuPath = (slug: string | null | undefined, negocioId?: number | string | null) =>
  slug
    ? `/menu/${encodeURIComponent(slug)}`
    : negocioId
      ? `/menu?negocio=${encodeURIComponent(String(negocioId))}`
      : "/menu";
