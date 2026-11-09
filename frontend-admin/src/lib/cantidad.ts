// Cantidad de un ítem de pedido: unidades ("2×") o peso en kg ("350 g", "1,25 kg").
export const fmtPeso = (kg: number) =>
  kg < 1
    ? `${Math.round(kg * 1000)} g`
    : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(kg)} kg`;

export const fmtCantidad = (cantidad: number, unidad?: string | null) =>
  unidad === "kg" ? fmtPeso(Number(cantidad)) : `${Number(cantidad)}×`;
