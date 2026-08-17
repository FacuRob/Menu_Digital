import { useState, useMemo, useCallback } from "react";
import type { Producto } from "../services/api";

// Una opción de variante elegida por el cliente (talle, color, extra…).
export interface SelectedOption {
  grupo_id: number;
  grupo_nombre: string;
  opcion_id: number;
  nombre: string;
  precio_extra: number;
}

export interface CartLine {
  key: string; // producto + combinación de opciones (identifica la línea)
  producto: Producto;
  cantidad: number;
  opciones: SelectedOption[];
  unitPrice: number; // precio base + extras de las opciones
}
export type Cart = Record<string, CartLine>;

// Clave estable para una línea: mismo producto + mismas opciones = misma línea.
export function lineKey(productoId: number, opciones: SelectedOption[]): string {
  const ids = opciones
    .map((o) => o.opcion_id)
    .sort((a, b) => a - b)
    .join("-");
  return ids ? `${productoId}::${ids}` : `${productoId}`;
}

export function useCart() {
  const [cart, setCart] = useState<Cart>({});

  const add = useCallback(
    (producto: Producto, qty = 1, opciones: SelectedOption[] = []) => {
      const unitPrice =
        Number(producto.precio) +
        opciones.reduce((a, o) => a + Number(o.precio_extra || 0), 0);
      const key = lineKey(producto.id, opciones);
      setCart((c) => {
        const prev = c[key]?.cantidad ?? 0;
        return {
          ...c,
          [key]: { key, producto, cantidad: prev + qty, opciones, unitPrice },
        };
      });
    },
    [],
  );

  const setQty = useCallback((key: string, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) {
        delete next[key];
        return next;
      }
      if (!next[key]) return c;
      next[key] = { ...next[key], cantidad: qty };
      return next;
    });
  }, []);

  const remove = useCallback((key: string) => setQty(key, 0), [setQty]);
  const clear = useCallback(() => setCart({}), []);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const count = useMemo(
    () => lines.reduce((a, l) => a + l.cantidad, 0),
    [lines],
  );
  const total = useMemo(
    () => lines.reduce((a, l) => a + l.cantidad * l.unitPrice, 0),
    [lines],
  );

  return { cart, lines, count, total, add, setQty, remove, clear };
}

export type CartApi = ReturnType<typeof useCart>;
