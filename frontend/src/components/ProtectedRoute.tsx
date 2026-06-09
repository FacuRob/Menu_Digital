import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permiso?: string; // Si se pasa, verifica que el usuario tenga ese permiso
}

const ProtectedRoute = ({ children, permiso }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasPermiso } = useAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Si se requiere un permiso específico y no lo tiene → 403
  if (permiso && !hasPermiso(permiso)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center bg-white rounded-2xl shadow-lg p-10 max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Acceso denegado
          </h2>
          <p className="text-gray-500">
            No tenés permisos para acceder a esta sección. Contactá al
            administrador.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
