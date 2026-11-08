import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconAlert } from "../../lib/icons";
import { useIsMobile } from "../../lib/useIsMobile";
import {
  suscripcionService,
  getApiErrorMessage,
  type SuscripcionEstado,
  type PlanCatalogo,
} from "../../services/api";

// Estados → color + clave de traducción de la etiqueta.
const ESTADO_INFO: Record<
  string,
  { key: string; color: string; bg: string }
> = {
  trial: { key: "subStatusTrial", color: "var(--info)", bg: "var(--info-bg)" },
  activo: { key: "subStatusActive", color: "var(--ok)", bg: "var(--ok-bg)" },
  cancelado: { key: "subStatusCancelled", color: "var(--warn)", bg: "var(--warn-bg)" },
  vencido: { key: "subStatusExpired", color: "var(--err)", bg: "var(--err-bg)" },
};

// Beneficios por plan (claves de traducción). "Todo lo del plan anterior" va
// primero; después, los límites del backend y lo que suma cada plan.
const PERKS: Record<string, { incluye?: string; extras: string[] }> = {
  basic: { extras: ["subPerkQr", "subPerkVariantes", "subPerkCustom", "subPerkAnalytics", "subPerkDiscounts"] },
  standard: { incluye: "subPerkAllBasic", extras: ["subPerkStock"] },
  premium: { incluye: "subPerkAllStandard", extras: [] },
};

// Catálogo de respaldo (mismos precios que backend/src/utils/planPrecios.js).
const FALLBACK_PLANES: PlanCatalogo[] = [
  { code: "basic", precio_mensual: 20000, limites: { negocios: 3, productos: 50 } },
  { code: "standard", precio_mensual: 41000, limites: { negocios: 10, productos: 120 } },
  { code: "premium", precio_mensual: 65000, limites: { negocios: 9999, productos: 9999 } },
];

export default function Suscripcion() {
  const S = useStyles();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const { t, lang } = useLang();
  const [data, setData] = useState<SuscripcionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState<string>("");

  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const cardBg = "var(--surface)";
  const border = "var(--line)";
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
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: data?.moneda ?? "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  const fmtFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  const planNombre = (code: string) =>
    ({
      free: t("subPlanFree"),
      basic: t("subPlanBasic"),
      standard: t("subPlanStandard"),
      premium: t("subPlanPremium"),
    })[code] ?? code;

  const irACheckout = async (plan: PlanCatalogo["code"]) => {
    try {
      setRedirecting(plan);
      const { url } = await suscripcionService.checkout(plan);
      window.location.assign(url);
    } catch (e) {
      setError(getApiErrorMessage(e, t("subCheckoutError")));
      setRedirecting("");
      // El aviso está arriba de todo: sin esto, el botón parece no hacer nada.
      window.scrollTo({ top: 0, behavior: "smooth" });
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
  // Prueba o período vencido (aunque la BD todavía diga "trial") → se muestra como vencido.
  const info = data && !data.vigente ? ESTADO_INFO.vencido : ESTADO_INFO[estado] || ESTADO_INFO.trial;
  const dias = data?.dias_restantes ?? null;
  const esFree = data?.tipo_plan === "free" || estado === "trial";

  return (
    <AdminLayout title={t("navSuscripcion")}>
      <div style={{ width: "100%" }}>
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
              background: "var(--err-bg)",
              color: "var(--err)",
              border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
            }}
          >
            <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* ── Aviso de bloqueo: prueba terminada o suscripción vencida ── */}
        {data && !data.es_plataforma && !data.vigente && (
          <div
            role="alert"
            style={{
              marginBottom: 18,
              padding: "16px 18px",
              borderRadius: 12,
              background: "var(--err-bg)",
              border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
              color: "var(--err)",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <IconAlert size={20} style={{ flexShrink: 0, marginTop: 1 }} />
            {esFree ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t("subTrialEndedTitle")}</div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
                  {t("subTrialEndedBody", { n: data.trial_dias })}
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("subBlocked")}</div>
            )}
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
              gridTemplateColumns: isMobile ? "1fr" : "minmax(260px,1fr) auto",
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
                        ? !data.vigente
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
                    track={"var(--surface-3)"}
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

              {data.tipo_plan !== "free" && (
                <a
                  href={data.portal_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.btnGhost, marginTop: 16, textDecoration: "none", display: "inline-flex" }}
                >
                  {t("subManageMp")}
                </a>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline", justifyContent: "space-between", margin: "6px 2px 14px" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
            {data?.vigente ? t("subChangePlan") : t("subChoosePlan")}
          </h3>
          <span style={{ fontSize: 12.5, color: textMuted }}>{t("subPayNote")}</span>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          {(data?.planes ?? FALLBACK_PLANES).map((p) => {
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
                  border: `1.5px solid ${destacado ? "var(--info)" : border}`,
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
                      color: "var(--on-accent)",
                      background: "var(--accent)",
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
                    {money(p.precio_mensual)}
                  </span>
                  <span style={{ fontSize: 12.5, color: textMuted }}>/{t("subPerMonth")}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 18px", display: "grid", gap: 8, flex: 1, alignContent: "start" }}>
                  {[
                    ...(PERKS[p.code]?.incluye ? [t(PERKS[p.code].incluye!)] : []),
                    bizFeature,
                    prodFeature,
                    ...(PERKS[p.code]?.extras || []).map((k) => t(k)),
                  ].map((f, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: textMuted }}>
                      <span style={{ color: "var(--ok)", fontWeight: 800 }}>✓</span>
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
                color: fin_ ? "var(--surface)" : hoy_ ? accent : textPrimary,
                background: fin_
                  ? accent
                  : hoy_
                    ? isDark
                      ? "var(--line)"
                      : "var(--line)"
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
