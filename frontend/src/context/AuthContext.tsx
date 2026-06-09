import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authService, type Usuario } from "../services/api";

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  permisos: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermiso: (permiso: string) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [permisos, setPermisos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        try {
          const response = await authService.verify();
          setUser(response.user);
          setPermisos(response.user.permisos || []);
          setToken(savedToken);
        } catch (error) {
          console.error("Token inválido:", error);
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
          setPermisos([]);
        }
      }
      setIsLoading(false);
    };

    verifyToken();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authService.login(username, password);
    setUser(response.user);
    setToken(response.token);
    setPermisos(response.user.permisos || []);
    localStorage.setItem("token", response.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPermisos([]);
    localStorage.removeItem("token");
  };

  // Verifica si el usuario tiene un permiso específico
  // El superadmin con "*" siempre retorna true
  const hasPermiso = (permiso: string): boolean => {
    if (permisos.includes("*")) return true;
    return permisos.includes(permiso);
  };

  const isSuperAdmin = permisos.includes("*");

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        permisos,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading,
        hasPermiso,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
