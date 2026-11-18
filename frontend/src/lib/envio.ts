import type { Configuracion, TipoEntrega } from "../services/api";

// Costo del envío: la misma regla que backend/src/utils/envio.js (el backend
// recalcula siempre; esto es sólo para mostrarlo antes de confirmar).
export type Envio = { costo: number; cobro: "pedido" | "efectivo" | null; gratis: boolean; faltaParaGratis: number };

export function calcularEnvio(config: Configuracion | null, tipo: TipoEntrega | null, subtotal: number): Envio {
  const e = config?.envio;
  const nada: Envio = { costo: 0, cobro: null, gratis: false, faltaParaGratis: 0 };
  if (tipo !== "delivery" || !e?.cobrar || !(Number(e.monto) > 0)) return nada;
  const desde = Number(e.gratis_desde) || 0;
  // Mismo redondeo que el backend (total a 2 decimales).
  subtotal = Math.round(subtotal * 100) / 100;
  if (desde > 0 && subtotal >= desde) return { ...nada, gratis: true };
  return {
    costo: Number(e.monto),
    cobro: e.cobro === "efectivo" ? "efectivo" : "pedido",
    gratis: false,
    faltaParaGratis: desde > 0 ? Math.round((desde - subtotal) * 100) / 100 : 0,
  };
}
