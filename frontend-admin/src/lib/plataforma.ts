import { useState } from "react";
import { LOCALE, useLang, type Lang } from "./i18n";
import { plataformaService, getApiErrorMessage, type CuentaRiesgo, type TipoPlan } from "../services/api";
import { entrarComo } from "./verComo";

// Piezas compartidas por las páginas del panel Tech (Resumen, Cuentas, Cupones).

export const planColor: Record<TipoPlan, string> = {
  free: "var(--fg-3)",
  basic: "var(--info)",
  standard: "var(--violet)",
  premium: "var(--warn)",
};

export const fmtFecha = (s?: string, lang: Lang = "es") =>
  s ? new Date(s).toLocaleDateString(LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const fmtMoney = (n: number, moneda = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n || 0);

// "Ver como el cliente": abre el panel de esa cuenta en solo lectura.
export function useVerComo(onError: (msg: string) => void) {
  const [entrando, setEntrando] = useState<number | null>(null);
  const verComo = async (c: { id: number; nombre: string }) => {
    setEntrando(c.id);
    try {
      const r = await plataformaService.verComo(c.id);
      if (!entrarComo(r.token, r.cuenta.nombre || c.nombre)) {
        onError("Ya estás viendo otra cuenta (quizás en otra pestaña). Volvé a tu cuenta primero.");
        setEntrando(null);
      }
    } catch (e) {
      onError(getApiErrorMessage(e, "No se pudo abrir el panel de esa cuenta."));
      setEntrando(null);
    }
  };
  return { entrando, verComo };
}

// Texto de cada motivo de riesgo (lo usa también Plataforma · Cuentas).
export function useMotivoTexto() {
  const { t } = useLang();
  return (m: CuentaRiesgo["motivos"][number]) => {
    switch (m.tipo) {
      case "vencida":
        return t("pfRiskVencida");
      case "cancelada":
        return m.dias ? t("pfRiskCanceladaDias", { n: m.dias }) : t("pfRiskCancelada");
      case "prueba_vencida":
        return t("pfRiskPruebaVencida");
      case "prueba_por_vencer":
        return m.dias ? t("pfRiskPruebaPorVencer", { n: m.dias }) : t("pfRiskPruebaHoy");
      case "sin_configurar":
        return t("pfRiskSinConfigurar");
      case "sin_pedidos":
        return t("pfRiskSinPedidos", { n: m.dias ?? 14 });
    }
  };
}
