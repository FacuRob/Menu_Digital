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
    "https://dinexflow.com.ar",
);

export const MENU_PREVIEW_BASE = import.meta.env.DEV
  ? clean((import.meta.env.VITE_MENU_DEV_URL as string | undefined) || "http://localhost:3000")
  : MENU_PUBLIC_BASE;

// Ruta pública de un negocio: /menu/:slug para gastronomía (y si no se sabe
// el rubro), /negocio/:slug para el resto; ?negocio=<id> si no hay slug.
// Las dos rutas muestran la misma página.
export const menuPath = (slug: string | null | undefined, negocioId?: number | string | null, rubro?: string | null) =>
  slug
    ? `${rubro && rubro !== "gastronomia" ? "/negocio" : "/menu"}/${encodeURIComponent(slug)}`
    : negocioId
      ? `/menu?negocio=${encodeURIComponent(String(negocioId))}`
      : "/menu";
