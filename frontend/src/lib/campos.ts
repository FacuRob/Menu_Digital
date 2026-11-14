import type { CampoProducto } from "../services/api";
import type { ValorCampo } from "../components/CamposCliente";

// Etiquetas de los campos obligatorios sin completar (vacío = está todo).
export const faltanCampos = (campos: CampoProducto[], valores: Record<number, ValorCampo>) =>
  campos
    .filter((c) => {
      if (!c.obligatorio) return false;
      const v = valores[c.id];
      if (!v) return true;
      if (c.tipo === "archivo") return !v.adjunto;
      return v.valor === undefined || v.valor === null || v.valor === "" || (Array.isArray(v.valor) && v.valor.length === 0);
    })
    .map((c) => c.etiqueta);
