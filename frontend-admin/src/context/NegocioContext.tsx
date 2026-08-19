import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  negociosService,
  configuracionService,
  type Negocio,
} from "../services/api";
import { useAuth } from "./AuthContext";

interface NegocioContextType {
  negocioId: number;
  negocios: Negocio[];
  moneda: string;
  slug: string | null;
  setNegocioId: (id: number) => void;
  refresh: () => Promise<void>;
}

const NegocioContext = createContext<NegocioContextType | undefined>(undefined);

const getStored = () => {
  const raw = localStorage.getItem("negocio_id");
  const n = parseInt(raw || "1", 10);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

export const NegocioProvider = ({ children }: { children: ReactNode }) => {
  const { isSuperAdmin, hasPermiso, isAuthenticated } = useAuth();
  // Quién puede ver/cambiar de sucursal: el dueño (SuperAdmin) y el Admin
  // (manager), que también gestiona negocios.
  const puedeNegocios = isSuperAdmin || hasPermiso("negocios");
  const [negocioId, setId] = useState<number>(getStored);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [moneda, setMoneda] = useState<string>("ARS");
  const [slug, setSlug] = useState<string | null>(null);

  // Mantener el header del api sincronizado desde el arranque.
  useEffect(() => {
    localStorage.setItem("negocio_id", String(negocioId));
  }, [negocioId]);

  // Moneda del negocio activo (para formatear precios en el panel).
  useEffect(() => {
    if (!isAuthenticated) return;
    configuracionService
      .get()
      .then((cfg) => {
        setMoneda(cfg.moneda || "ARS");
        setSlug(cfg.slug || null);
      })
      .catch(() => {});
  }, [isAuthenticated, negocioId]);

  const refresh = async () => {
    if (!puedeNegocios) return;
    try {
      const data = await negociosService.getAll();
      setNegocios(data);
      // Si el negocio activo no pertenece a la cuenta (p. ej. id stale en
      // localStorage tras registrarse), caer al primero de la lista. Es una
      // AUTOCORRECCIÓN de arranque: sólo se ajusta el estado, SIN recargar la
      // página (el reload se reserva para cuando el usuario cambia de sucursal
      // a propósito; recargar acá rompería flujos como el onboarding).
      if (data.length && !data.some((n) => n.id === negocioId)) {
        localStorage.setItem("negocio_id", String(data[0].id));
        setId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && puedeNegocios) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, puedeNegocios]);

  // Cambiar de negocio recarga la app para que todo re-consulte con el nuevo header.
  const setNegocioId = (id: number) => {
    localStorage.setItem("negocio_id", String(id));
    if (id !== negocioId) {
      setId(id);
      window.location.reload();
    }
  };

  return (
    <NegocioContext.Provider
      value={{ negocioId, negocios, moneda, slug, setNegocioId, refresh }}
    >
      {children}
    </NegocioContext.Provider>
  );
};

export const useNegocio = () => {
  const ctx = useContext(NegocioContext);
  if (!ctx) throw new Error("useNegocio debe usarse dentro de NegocioProvider");
  return ctx;
};
