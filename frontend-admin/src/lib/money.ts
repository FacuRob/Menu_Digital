// Formato de moneda del panel admin, según la moneda del negocio activo.
// La moneda la provee NegocioContext (leída de la configuración del negocio).
const LOCALE_POR_MONEDA: Record<string, string> = {
  ARS: "es-AR",
  USD: "en-US",
  EUR: "es-ES",
  BRL: "pt-BR",
  MXN: "es-MX",
  CLP: "es-CL",
  COP: "es-CO",
  PEN: "es-PE",
  UYU: "es-UY",
  PYG: "es-PY",
  BOB: "es-BO",
  GTQ: "es-GT",
};

const SIN_DECIMALES = new Set(["CLP", "COP", "PYG"]);

export const fmtMoney = (n: number, moneda = "ARS") => {
  const decimales = SIN_DECIMALES.has(moneda) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE_POR_MONEDA[moneda] || "es-AR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(n || 0);
};
