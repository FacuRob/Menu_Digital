// URL del panel admin (otro frontend). En producción definir VITE_ADMIN_URL
// (sin barra final). En desarrollo, si falta, se usa el admin local.
const ADMIN_BASE = (
  (import.meta.env.VITE_ADMIN_URL as string | undefined) ||
  (import.meta.env.DEV ? "http://localhost:3001" : "")
).replace(/\/+$/, "");

export const ADMIN_LOGIN_URL = `${ADMIN_BASE}/admin/login`;
export const ADMIN_SIGNUP_URL = `${ADMIN_BASE}/admin/login?view=signup`;
