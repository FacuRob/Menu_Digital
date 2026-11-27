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

// ── Mesas combinadas (6+7) ──
// Todos los números de una mesa del plano (la principal y las unidas).
export const numerosDe = (m: MesaPlano) => [m.mesa, ...(m.unidas || [])];
export const nombreMesa = (m: MesaPlano) => numerosDe(m).join("+");

// Dos mesas pegadas: se tocan (o se pisan) y comparten un borde, no sólo una esquina.
export const sePegan = (a: MesaPlano, b: MesaPlano) => {
  const gx = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w); // < 0: se cruzan en x
  const gy = Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
  return gx <= 0.05 && gy <= 0.05 && (gx < -0.2 || gy < -0.2);
};

const parecidos = (a: number, b: number) => Math.abs(a - b) < 0.15;

// Junta dos mesas en una: ocupa el lugar de las dos.
export const juntarMesas = (a: MesaPlano, b: MesaPlano): MesaPlano => {
  const nums = [...new Set([...numerosDe(a), ...numerosDe(b)])].sort((x, y) => Number(x) - Number(y));
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(a.x + a.w, b.x + b.w) - x;
  const h = Math.max(a.y + a.h, b.y + b.h) - y;
  const forma = parecidos(w, h) ? (a.forma === "redonda" && b.forma === "redonda" ? "redonda" : "cuadrada") : "rectangular";
  return { mesa: nums[0], unidas: nums.slice(1), forma, x, y, w, h };
};

// Separa una mesa combinada: reparte su lugar entre sus mesas, a lo largo.
export const separarMesa = (m: MesaPlano): MesaPlano[] => {
  const nums = numerosDe(m);
  const n = nums.length;
  const horizontal = m.w >= m.h;
  const largo = horizontal ? m.w : m.h;
  const ancho = horizontal ? m.h : m.w;
  const hueco = 0.5;
  const pieza = Math.max(0.4, Math.round(((largo - hueco * (n - 1)) / n) * 4) / 4);
  const forma = parecidos(pieza, ancho) ? "cuadrada" : "rectangular";
  return nums.map((mesa, i) => {
    const d = i * (pieza + hueco);
    return horizontal
      ? { mesa, forma, x: m.x + d, y: m.y, w: pieza, h: m.h }
      : { mesa, forma, x: m.x, y: m.y + d, w: m.w, h: pieza };
  });
};
