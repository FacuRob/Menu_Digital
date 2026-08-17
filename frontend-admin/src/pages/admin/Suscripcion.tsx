import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconAlert } from "../../lib/icons";
import {
  suscripcionService,
  getApiErrorMessage,
  type SuscripcionEstado,
  type CicloFacturacion,
  type PlanCatalogo,
} from "../../services/api";

// Estados → color + clave de traducción de la etiqueta.
const ESTADO_INFO: Record<
  string,
  { key: string; color: string; bg: string }
> = {
  trial: { key: "subStatusTrial", color: "#2563eb", bg: "rgba(37,99,235,0.12)" },
  activo: { key: "subStatusActive", color: "#059669", bg: "rgba(16,185,129,0.14)" },
  cancelado: { key: "subStatusCancelled", color: "#d97706", bg: "rgba(217,119,6,0.14)" },
  vencido: { key: "subStatusExpired", color: "#dc2626", bg: "rgba(239,68,68,0.14)" },
};

// Perks por plan (claves de traducción; además de los límites del backend).
const PERK_KEYS: Record<string, string[]> = {
  basic: ["subPerkVariantes", "subPerkWhatsapp", "subPerkCustom"],
  standard: ["subPerkAllBasic", "subPerkAnalytics", "subPerkStock"],
  premium: ["subPerkAllStandard", "subPerkUnlimBiz", "subPerkPriority"],
};

// Catálogo de respaldo: si el backend no responde, la vista igual muestra planes.
const FALLBACK_PLANES: PlanCatalogo[] = [
  { code: "basic", precio_mensual: 9.99, precio_anual: 99, limites: { negocios: 3, productos: 50 } },
  { code: "standard", precio_mensual: 19.99, precio_anual: 199, limites: { negocios: 10, productos: 100 } },
  { code: "premium", precio_mensual: 39.99, precio_anual: 399, limites: { negocios: 9999, productos: 9999 } },
];

export default function Suscripcion() {
  const S = useStyles();
  const { isDark } = useTheme();
  const { t, lang } = useLang();
  const [data, setData] = useState<SuscripcionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ciclo, setCiclo] = useState<CicloFacturacion>("mensual");
  const [redirecting, setRedirecting] = useState<string>("");

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#94a3b8" : "#64748b";
  const cardBg = isDark ? "#13151c" : "#ffffff";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const locale = LOCALE[lang] || "es-AR";

  useEffect(() => {
    (async () => {
      try {
        setData(await suscripcionService.get());
      } catch (e) {
        setError(getApiErrorMessage(e, t("subLoadError")));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = (n: number) =>
    `${(data?.moneda ?? "USD") === "USD" ? "US$" : ""}${n.toFixed(2)}`;

  const fmtFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  const planNombre = (code: string) =>
    code === "free"
      ? t("subPlanFree")
      : code.charAt(0).toUpperCase() + code.slice(1);

  const irACheckout = async (plan: PlanCatalogo["code"]) => {
    try {
      setRedirecting(plan);
      const { url } = await suscripcionService.checkout(plan, ciclo);
      window.location.assign(url);
    } catch (e) {
      setError(getApiErrorMessage(e, t("subCheckoutError")));
      setRedirecting("");
    }
  };

  const gestionar = async () => {
    try {
      setRedirecting("portal");
      const { url } = await suscripcionService.portal();
      window.location.assign(url);
    } catch (e) {
      setError(getApiErrorMessage(e, t("subPortalError")));
      setRedirecting("");
    }
  };

  if (loading) {
    return (
      <AdminLayout title={t("navSuscripcion")}>
        <p style={{ color: textMuted }}>{t("subLoading")}</p>
      </AdminLayout>
    );
  }

  const estado = data?.estado_suscripcion || "trial";
  const info = ESTADO_INFO[estado] || ESTADO_INFO.trial;
  const dias = data?.dias_restantes ?? null;
  const esFree = data?.tipo_plan === "free" || estado === "trial";

  return (
    <AdminLayout title={t("navSuscripcion")}>
      <div style={{ maxWidth: 940 }}>
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: "rgba(239,68,68,0.1)",
              color: "#dc2626",
              border: "1px solid rgba(239,68,68,0.25)",
            }}
          >
            <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* ── Estado actual ── */}
        {data && !data.es_plataforma && (
          <div
            style={{
              ...S.card,
              padding: 22,
              marginBottom: 18,
              display: "grid",
              gap: 20,
              gridTemplateColumns: "minmax(260px,1fr) auto",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: textPrimary }}>
                  {t("subPlanHeading", { plan: planNombre(data.tipo_plan) })}
                </h2>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    color: info.color,
                    background: info.bg,
                  }}
                >
                  {t(info.key)}
                </span>
              </div>

              {/* Timeline de días restantes (trial / Free y cancelado) */}
              {data.periodo_fin && estado !== "activo" && (
                <div style={{ marginTop: 16 }}>
                  {esFree && (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
                      {dias && dias > 0 ? (
                        <span>
                          {t(dias === 1 ? "subFreeRemaining1" : "subFreeRemaining", { n: dias })}
                        </span>
                      ) : (
                        t("subFreeEnded")
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      color: textMuted,
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      {dias === 0
                        ? estado === "vencido"
                          ? t("subExpiredShort")
                          : t("subDueToday")
                        : t(dias === 1 ? "subDayLeft" : "subDaysLeft", { n: dias ?? 0 })}
                    </span>
                    <span>{t("subDueOn", { date: fmtFecha(data.periodo_fin) })}</span>
                  </div>
                  <TimelineBar
                    diasRestantes={dias ?? 0}
                    total={estado === "trial" ? data.trial_dias : 30}
                    color={info.color}
                    track={isDark ? "#0f1117" : "#eef2f7"}
                  />
                </div>
              )}
              {estado === "activo" && (
                <p style={{ margin: "12px 0 0", fontSize: 13.5, color: textMuted }}>
                  {data.periodo_fin
                    ? t("subActiveNext", { date: fmtFecha(data.periodo_fin) })
                    : t("subActive")}
                </p>
              )}

              {/* Aviso de bloqueo */}
              {!data.vigente && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#dc2626",
                    fontSize: 12.5,
                  }}
                >
                  {t("subBlocked")}
                </div>
              )}

              {data.tipo_plan !== "free" && (
                <button
                  onClick={gestionar}
                  disabled={redirecting === "portal"}
                  style={{
                    ...S.btnGhost,
                    marginTop: 16,
                    opacity: redirecting === "portal" ? 0.6 : 1,
                  }}
                >
                  {redirecting === "portal" ? t("subOpening") : t("subManage")}
                </button>
              )}
            </div>

            {/* Calendario del mes de vencimiento */}
            {data.periodo_fin && (
              <MiniCalendario
                fin={data.periodo_fin}
                locale={locale}
                isDark={isDark}
                accent={info.color}
                border={border}
                textPrimary={textPrimary}
                textMuted={textMuted}
                cardBg={cardBg}
                dueLabel={t("subDueLabel")}
                todayLabel={t("subTodayLabel")}
              />
            )}
          </div>
        )}

        {data?.es_plataforma && (
          <div style={{ ...S.card, padding: 22, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textPrimary }}>
              {t("subPlatformTitle")}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: textMuted }}>
              {t("subPlatformDesc")}
            </p>
          </div>
        )}

        {/* ── Planes ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 2px 14px" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
            {data?.vigente ? t("subChangePlan") : t("subChoosePlan")}
          </h3>
          {/* Toggle mensual/anual */}
          <div style={{ display: "flex", background: isDark ? "#0f1117" : "#eef2f7", borderRadius: 10, padding: 3 }}>
            {(["mensual", "anual"] as CicloFacturacion[]).map((c) => (
              <button
                key={c}
                onClick={() => setCiclo(c)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: ciclo === c ? "#3b82f6" : "transparent",
                  color: ciclo === c ? "#fff" : textMuted,
                }}
              >
                {c === "mensual" ? t("subMonthly") : t("subAnnual")}
                {c === "anual" && (
                  <span style={{ marginLeft: 6, fontSize: 10.5, opacity: 0.9 }}>{t("subTwoFree")}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          {(data?.planes ?? FALLBACK_PLANES).map((p) => {
            const precio = ciclo === "anual" ? p.precio_anual : p.precio_mensual;
            const esActual = data?.tipo_plan === p.code;
            const destacado = p.code === "standard";
            const bizFeature =
              p.limites.negocios >= 9999
                ? t("subUnlimBiz")
                : t(p.limites.negocios === 1 ? "subUpToBiz1" : "subUpToBiz", { n: p.limites.negocios });
            const prodFeature =
              p.limites.productos >= 9999
                ? t("subUnlimProds")
                : t("subProdsPer", { n: p.limites.productos });
            return (
              <div
                key={p.code}
                style={{
                  ...S.card,
                  padding: 20,
                  border: `1.5px solid ${destacado ? "#3b82f6" : border}`,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {destacado && (
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      left: 16,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: "#3b82f6",
                      padding: "2px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {t("subRecommended")}
                  </span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
                  {planNombre(p.code)}
                </div>
                <div style={{ margin: "8px 0 2px", display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: textPrimary }}>
                    {money(precio)}
                  </span>
                  <span style={{ fontSize: 12.5, color: textMuted }}>
                    /{ciclo === "anual" ? t("subPerYear") : t("subPerMonth")}
                  </span>
                </div>
                {ciclo === "anual" && p.precio_mensual > 0 && (
                  <div style={{ fontSize: 11.5, color: "#059669" }}>
                    {t("subEquiv", { v: money(p.precio_anual / 12) })}
                  </div>
                )}

                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 18px", display: "grid", gap: 8, flex: 1 }}>
                  {[bizFeature, prodFeature, ...(PERK_KEYS[p.code] || []).map((k) => t(k))].map((f, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: textMuted }}>
                      <span style={{ color: "#10b981", fontWeight: 800 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => irACheckout(p.code)}
                  disabled={esActual || redirecting === p.code}
                  style={{
                    ...(destacado ? S.btnPrimary : S.btnGhost),
                    width: "100%",
                    justifyContent: "center",
                    opacity: esActual ? 0.5 : redirecting === p.code ? 0.7 : 1,
                    cursor: esActual ? "default" : "pointer",
                  }}
                >
                  {esActual
                    ? t("subCurrentPlan")
                    : redirecting === p.code
                      ? t("subOpening")
                      : t("subChoose")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}

// ── Barra de progreso del período ──
function TimelineBar({
  diasRestantes,
  total,
  color,
  track,
}: {
  diasRestantes: number;
  total: number;
  color: string;
  track: string;
}) {
  const pct = Math.max(0, Math.min(100, (diasRestantes / Math.max(1, total)) * 100));
  return (
    <div style={{ height: 10, borderRadius: 999, background: track, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
          transition: "width .3s",
        }}
      />
    </div>
  );
}

// ── Calendario mensual que resalta hoy y la fecha de vencimiento ──
function MiniCalendario({
  fin,
  locale,
  isDark,
  accent,
  border,
  textPrimary,
  textMuted,
  cardBg,
  dueLabel,
  todayLabel,
}: {
  fin: string;
  locale: string;
  isDark: boolean;
  accent: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  dueLabel: string;
  todayLabel: string;
}) {
  const finDate = useMemo(() => new Date(fin), [fin]);
  const year = finDate.getFullYear();
  const month = finDate.getMonth();
  const hoy = new Date();

  // Encabezado de días (Lun..Dom) localizado. 1/1/2024 fue lunes.
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" }),
      ),
    [locale],
  );
  const titulo = useMemo(
    () => finDate.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    [finDate, locale],
  );

  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const esHoy = (d: number) =>
    d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
  const esFin = (d: number) => d === finDate.getDate();

  return (
    <div
      style={{
        width: 232,
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: textPrimary, marginBottom: 8, textTransform: "capitalize" }}>
        {titulo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {weekdays.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: textMuted, padding: "2px 0", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fin_ = esFin(d);
          const hoy_ = esHoy(d);
          return (
            <div
              key={i}
              title={fin_ ? dueLabel : hoy_ ? todayLabel : undefined}
              style={{
                textAlign: "center",
                fontSize: 11.5,
                padding: "5px 0",
                borderRadius: 7,
                fontWeight: fin_ || hoy_ ? 700 : 400,
                color: fin_ ? "#fff" : hoy_ ? accent : textPrimary,
                background: fin_
                  ? accent
                  : hoy_
                    ? isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(0,0,0,0.05)"
                    : "transparent",
                border: hoy_ && !fin_ ? `1px solid ${accent}` : "1px solid transparent",
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
