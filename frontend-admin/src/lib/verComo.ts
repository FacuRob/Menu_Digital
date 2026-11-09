// "Ver como el cliente" (sólo Tech): se cambia el token por uno de solo
// lectura de esa cuenta y se guarda el propio para volver. Se recarga la
// página entera para que ningún dato de la sesión anterior quede en pantalla.

const CLAVE = "ver_como";

export interface VerComo {
  nombre: string;
  hasta: number; // ms: cuándo vence el token de solo lectura
  token: string; // el de Tech, para volver
  negocio: string | null; // el negocio que Tech tenía elegido
}

const leerToken = (t: string): { exp?: number } => {
  try {
    return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
};

export function verComoActivo(): VerComo | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) || "null");
    return v && typeof v.token === "string" ? v : null;
  } catch {
    return null;
  }
}

// false si no se pudo (por ejemplo, otra pestaña ya está viendo una cuenta).
export function entrarComo(token: string, nombre: string): boolean {
  const propio = localStorage.getItem("token");
  if (!propio || verComoActivo()) return false;
  const exp = leerToken(token).exp;
  const v: VerComo = {
    nombre,
    hasta: exp ? exp * 1000 : Date.now() + 30 * 60 * 1000,
    token: propio,
    negocio: localStorage.getItem("negocio_id"),
  };
  localStorage.setItem(CLAVE, JSON.stringify(v));
  localStorage.setItem("token", token);
  localStorage.removeItem("negocio_id");
  window.location.assign("/admin/dashboard");
  return true;
}

// Mientras la página se recarga para volver, nadie más toca la sesión
// (si no, el aviso de token vencido borraría el token recién restaurado).
let saliendo = false;
export const saliendoDeVerComo = () => saliendo;

export function salirDeVerComo() {
  const v = verComoActivo();
  localStorage.removeItem(CLAVE);
  if (!v) return;
  saliendo = true;
  // Si el token propio también venció mientras tanto, se vuelve a entrar.
  const exp = leerToken(v.token).exp;
  if (exp && exp * 1000 < Date.now()) {
    localStorage.removeItem("token");
    window.location.assign("/admin/login");
    return;
  }
  localStorage.setItem("token", v.token);
  if (v.negocio) localStorage.setItem("negocio_id", v.negocio);
  else localStorage.removeItem("negocio_id");
  window.location.assign("/admin/plataforma");
}

// Al cerrar sesión se olvida también la sesión de Tech guardada.
export function olvidarVerComo() {
  localStorage.removeItem(CLAVE);
}
