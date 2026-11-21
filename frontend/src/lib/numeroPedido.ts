// Número de pedido que ve la gente: propio de cada negocio (N° 0001, 0002…).
// El `id` es interno (links firmados y API); ver backend/db/numero_pedido.sql.
export const numeroPedido = (p: { id: number; numero?: number | null }) =>
  `N° ${String(p.numero ?? p.id).padStart(4, "0")}`;
