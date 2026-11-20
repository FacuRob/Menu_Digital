// Nombre visible de cada rol (clave de la base → nombre de negocio).
// El "Tech" (es_plataforma) es un flag, no un rol: se resuelve aparte.
export const ROL_LABEL: Record<string, string> = {
  admin: "SuperAdmin",
  manager: "Admin",
  staff: "Empleado",
  // Roles viejos, por si queda algún usuario sin migrar.
  superadmin: "SuperAdmin",
  editor: "Empleado",
  visor: "Empleado",
};

// Color de cada rol (tokens). Uno por nivel, igual en todo el panel.
export const ROL_TONO: Record<string, string> = {
  admin: "var(--info)",
  manager: "var(--teal)",
  staff: "var(--violet)",
  superadmin: "var(--info)",
  editor: "var(--violet)",
  visor: "var(--violet)",
};

export const rolLabel = (rol?: string) => (rol ? ROL_LABEL[rol] || rol : "");
