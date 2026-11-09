import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authService, type Usuario } from "../services/api";
import { olvidarVerComo, saliendoDeVerComo, salirDeVerComo, verComoActivo } from "../lib/verComo";

interface AuthContextType {
  user: Usuario | null;
  token: string | null;
  permisos: string[];
  setSession: (token: string, user: Usuario) => void;
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
          // Venció "Ver como el cliente": se vuelve a la cuenta de Tech.
          if (saliendoDeVerComo()) return;
          if (verComoActivo()) return salirDeVerComo();
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

  // Otra pestaña cambió la sesión (entró o salió de "Ver como el cliente",
  // inició o cerró sesión): se recarga para no mezclar cuentas.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" && e.oldValue !== e.newValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Fija la sesión a partir de una respuesta de auth (login / signup / Google / 2FA).
  const setSession = (newToken: string, newUser: Usuario) => {
    olvidarVerComo();
    setUser(newUser);
    setToken(newToken);
    setPermisos(newUser.permisos || []);
    setMustChangePassword(newUser.must_change_password || false);
    localStorage.setItem("token", newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPermisos([]);
    setMustChangePassword(false);
    localStorage.removeItem("token");
    olvidarVerComo();
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
        setSession,
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
