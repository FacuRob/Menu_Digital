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
  const { isSuperAdmin, isAuthenticated } = useAuth();
  const [negocioId, setId] = useState<number>(getStored);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [moneda, setMoneda] = useState<string>("ARS");

  // Mantener el header del api sincronizado desde el arranque.
  useEffect(() => {
    localStorage.setItem("negocio_id", String(negocioId));
  }, [negocioId]);

  // Moneda del negocio activo (para formatear precios en el panel).
  useEffect(() => {
    if (!isAuthenticated) return;
    configuracionService
      .get()
      .then((cfg) => setMoneda(cfg.moneda || "ARS"))
      .catch(() => {});
  }, [isAuthenticated]);

  const refresh = async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await negociosService.getAll();
      setNegocios(data);
      // Si el negocio activo no pertenece a la cuenta, caer al primero
      // de la lista (no a un id fijo, que podría ser de otra cuenta).
      if (data.length && !data.some((n) => n.id === negocioId)) {
        setNegocioId(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && isSuperAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSuperAdmin]);

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
      value={{ negocioId, negocios, moneda, setNegocioId, refresh }}
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
