import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permiso?: string;
}

const ProtectedRoute = ({ children, permiso }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermiso, mustChangePassword } =
    useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#0f1117",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #3b82f6",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

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

  if (permiso && !hasPermiso(permiso)) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "#0f1117",
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >
        <div
          style={{
            textAlign: "center",
            background: "#1a1d27",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "40px 48px",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2
            style={{
              color: "#f1f5f9",
              fontSize: 18,
              fontWeight: 600,
              margin: "0 0 8px",
            }}
          >
            Acceso denegado
          </h2>
          <p style={{ color: "#475569", fontSize: 14, margin: 0 }}>
            No tenés permisos para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
