// URL del panel admin (otro frontend). Se puede cambiar con VITE_ADMIN_URL
// (sin barra final). Si falta: el admin local en desarrollo y el admin
// publicado en producción (nunca una ruta relativa, que daría 404 acá).
const ADMIN_PROD = "https://menu-digital-admin.onrender.com";

const ADMIN_BASE = (
  (import.meta.env.VITE_ADMIN_URL as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:3001" : ADMIN_PROD)
).replace(/\/+$/, "");

export const ADMIN_LOGIN_URL = `${ADMIN_BASE}/admin/login`;
export const ADMIN_SIGNUP_URL = `${ADMIN_BASE}/admin/login?view=signup`;
