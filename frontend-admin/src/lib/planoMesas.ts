import type { MesaPlano, PlanoMesas } from "../services/api";

// Estado de una mesa en la pantalla Mesas.
export type EstadoMesa = "libre" | "ocupada" | "pedido";

// Color de cada estado (tokens del panel).
export const COLOR_ESTADO: Record<EstadoMesa, { fill: string; stroke: string; text: string }> = {
  libre: { fill: "color-mix(in srgb, var(--ok) 12%, var(--surface))", stroke: "var(--ok)", text: "var(--fg)" },
  ocupada: { fill: "var(--warn-bg)", stroke: "var(--warn)", text: "var(--fg)" },
  pedido: { fill: "var(--accent)", stroke: "var(--accent-ink)", text: "var(--on-accent)" },
};

export const nuevoId = (pref: string) => `${pref}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Plano inicial: un piso con las mesas que ya tiene el local, en fila.
export const planoInicial = (cantidad: number, nombrePiso: string): PlanoMesas => {
  const n = Math.max(cantidad, 4);
  const ancho = 16;
  const cols = 7;
  const filas = Math.ceil(n / cols);
  const alto = Math.max(10, filas * 2 + 1);
  const mesas: MesaPlano[] = Array.from({ length: n }, (_, i) => ({
    mesa: String(i + 1),
    forma: "cuadrada",
    x: 1 + (i % cols) * 2,
    y: 1 + Math.floor(i / cols) * 2,
    w: 1,
    h: 1,
  }));
  return { pisos: [{ id: nuevoId("p"), nombre: nombrePiso, ancho, alto, zonas: [], mesas }] };
};
