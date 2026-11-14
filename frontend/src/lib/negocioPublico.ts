import { useEffect, useState } from "react";
import { configuracionService, negociosPublicoService, setNegocioActivo, type Configuracion } from "../services/api";
import { setMonedaMenu } from "./menuUi";

// Negocio de la URL /negocio/:slug/…: id, configuración y si existe.
export function useNegocioPublico(slug?: string) {
  const [estado, setEstado] = useState<{ id: number; config: Configuracion | null } | null | "no">(null);
  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    negociosPublicoService
      .getBySlug(slug)
      .then(async (n) => {
        setNegocioActivo(n.id);
        const config = await configuracionService.get(n.id).catch(() => null);
        setMonedaMenu(config?.moneda);
        if (vivo) setEstado({ id: n.id, config });
      })
      .catch(() => vivo && setEstado("no"));
    return () => {
      vivo = false;
    };
  }, [slug]);
  return estado;
}

// Link de WhatsApp al negocio.
export const waNegocio = (n?: { whatsapp?: string | null; telefono?: string | null } | null, texto = "") => {
  let num = (n?.whatsapp || n?.telefono || "").replace(/\D/g, "");
  if (!num) return null;
  if (!num.startsWith("54")) num = "549" + num;
  return `https://wa.me/${num}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
};
