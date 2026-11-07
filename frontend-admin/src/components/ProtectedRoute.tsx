import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { IconLock } from "../lib/icons";
import LoadingScreen from "./LoadingScreen";
import { useLang } from "../lib/i18n";
import { useTituloPagina } from "./tituloPagina";

// Aviso dentro del panel cuando falta el permiso (el menú sigue a mano).
function SinPermiso() {
  const { t } = useLang();
  useTituloPagina(t("accessDenied"));
  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: 16 }}>
      <div
        role="alert"
        style={{
          textAlign: "center",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          padding: "36px 32px",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 14px",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            color: "var(--err)",
            background: "var(--err-bg)",
          }}
          aria-hidden
        >
          <IconLock size={26} />
        </div>
        <h2 className="pn-title" style={{ color: "var(--fg)", fontSize: 20, margin: "0 0 8px" }}>
          {t("accessDenied")}
        </h2>
        <p style={{ color: "var(--fg-2)", fontSize: 15, margin: 0 }}>{t("accessDeniedDesc")}</p>
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  permiso?: string;
  plataforma?: boolean;
}

const ProtectedRoute = ({ children, permiso, plataforma }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermiso, isPlataforma, mustChangePassword } =
    useAuth();
  const location = useLocation();

  // Verificando la sesión guardada (al abrir o recargar el panel).
  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Si debe cambiar contraseña y NO está ya en esa ruta → redirigir
  // Evita el loop infinito cuando ya está en /admin/cambiar-password
  if (mustChangePassword && location.pathname !== "/admin/cambiar-password") {
    return <Navigate to="/admin/cambiar-password" replace />;
  }

  // Si ya cambió la contraseña y está en esa ruta → mandar al dashboard
  if (!mustChangePassword && location.pathname === "/admin/cambiar-password") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if ((permiso && !hasPermiso(permiso)) || (plataforma && !isPlataforma)) {
    return <SinPermiso />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
