import type { Configuracion, TipoEntrega } from "../services/api";
import type { Envio } from "./envio";

// Medios de pago: la misma regla que backend/src/utils/pagos.js (el backend
// vuelve a validar todo; esto es para mostrar antes de confirmar).
export type MetodoPago = "efectivo" | "transferencia";

export function mediosActivos(config: Configuracion | null, tipo: TipoEntrega | null): MetodoPago[] {
  const p = config?.pagos;
  if (!p || !tipo || tipo === "mesa") return [];
  const m: MetodoPago[] = [];
  if (p.efectivo) m.push("efectivo");
  if (p.transferencia && (p.alias || p.cbu)) m.push("transferencia");
  return m;
}

// Cuánto se transfiere y cuánto se paga en efectivo al recibir.
export function montosDePago(metodo: MetodoPago | null, total: number, envio: Pick<Envio, "costo" | "cobro">) {
  const r = (n: number) => Math.round(n * 100) / 100;
  if (metodo === "transferencia") {
    const enEfectivo = envio.cobro === "efectivo" ? envio.costo : 0;
    return { transferir: r(total + envio.costo - enEfectivo), efectivo: enEfectivo };
  }
  return { transferir: 0, efectivo: r(total + envio.costo) };
}
