import { useState, useMemo, useCallback } from "react";
import type { Producto } from "../services/api";

export interface CartLine {
  producto: Producto;
  cantidad: number;
}
export type Cart = Record<number, CartLine>;

export function useCart() {
  const [cart, setCart] = useState<Cart>({});

  const add = useCallback((producto: Producto, qty = 1) => {
    setCart((c) => {
      const prev = c[producto.id]?.cantidad ?? 0;
      return { ...c, [producto.id]: { producto, cantidad: prev + qty } };
    });
  }, []);

  const setQty = useCallback((id: number, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) {
        delete next[id];
        return next;
      }
      if (!next[id]) return c;
      next[id] = { ...next[id], cantidad: qty };
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => setQty(id, 0), [setQty]);
  const clear = useCallback(() => setCart({}), []);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const count = useMemo(
    () => lines.reduce((a, l) => a + l.cantidad, 0),
    [lines],
  );
  const total = useMemo(
    () => lines.reduce((a, l) => a + l.cantidad * Number(l.producto.precio), 0),
    [lines],
  );

  return { cart, lines, count, total, add, setQty, remove, clear };
}

export type CartApi = ReturnType<typeof useCart>;
