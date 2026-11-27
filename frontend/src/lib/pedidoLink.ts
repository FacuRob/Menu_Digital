// Pedido armado por el asistente de WhatsApp: el link de la carta lleva
// ?pedido=12x2,15x1 (id del producto x cantidad) y el menú lo carga en el
// carrito al abrir. Mismo formato que arma el backend (iaService).
export interface LineaPedidoLink {
  id: number;
  cantidad: number;
}

const MAX_LINEAS = 10;
const MAX_CANTIDAD = 20;

export function leerPedidoLink(search: string): LineaPedidoLink[] {
  const raw = new URLSearchParams(search).get("pedido") || "";
  const lineas: LineaPedidoLink[] = [];
  for (const parte of raw.split(",").slice(0, MAX_LINEAS)) {
    const m = /^(\d{1,9})(?:x(\d{1,2}))?$/.exec(parte.trim());
    if (!m) continue;
    const id = Number(m[1]);
    const cantidad = Math.min(Math.max(Number(m[2] || 1), 1), MAX_CANTIDAD);
    if (!lineas.some((l) => l.id === id)) lineas.push({ id, cantidad });
  }
  return lineas;
}

// La URL sin ?pedido (así recargar la página no lo vuelve a sumar).
export function sinPedidoLink(loc: { pathname: string; search: string; hash: string }): string {
  const qs = new URLSearchParams(loc.search);
  qs.delete("pedido");
  const resto = qs.toString();
  return `${loc.pathname}${resto ? `?${resto}` : ""}${loc.hash}`;
}
