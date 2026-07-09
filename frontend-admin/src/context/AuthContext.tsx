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
  isPlataforma: boolean;
  mustChangePassword: boolean;
  setMustChangePassword: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [permisos, setPermisos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        try {
          const response = await authService.verify();
          setUser(response.user);
          setPermisos(response.user.permisos || []);
          setToken(savedToken);
          setMustChangePassword(response.user.must_change_password || false);
        } catch {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
          setPermisos([]);
          setMustChangePassword(false);
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
    setMustChangePassword(response.user.must_change_password || false);
    localStorage.setItem("token", response.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPermisos([]);
    setMustChangePassword(false);
    localStorage.removeItem("token");
  };

  const hasPermiso = (permiso: string): boolean => {
    if (permisos.includes("*")) return true;
    return permisos.includes(permiso);
  };

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
        isSuperAdmin: permisos.includes("*"),
        isPlataforma: user?.es_plataforma === true,
        mustChangePassword,
        setMustChangePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
