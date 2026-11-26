import type { useLang } from "./i18n";

type T = ReturnType<typeof useLang>["t"];

// Nombre del plan para mostrar ("free" → "Prueba gratis"). Con `efectivo`
// (el plan que rige en la prueba) queda "Prueba gratis (Estándar)".
export function planNombre(t: T, code: string | null | undefined, efectivo?: string | null): string {
  const nombres: Record<string, string> = {
    free: t("subPlanFree"),
    basic: t("subPlanBasic"),
    standard: t("subPlanStandard"),
    premium: t("subPlanPremium"),
  };
  const base = code ? nombres[code] ?? code : "";
  return code === "free" && efectivo && efectivo !== "free" && nombres[efectivo] ? `${base} (${nombres[efectivo]})` : base;
}
