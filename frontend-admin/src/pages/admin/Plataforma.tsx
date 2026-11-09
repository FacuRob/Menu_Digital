import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useLang, LOCALE, type Lang } from "../../lib/i18n";
import {
  plataformaService,
  getApiErrorMessage,
  type Cuenta,
  type PlataformaResumen,
  type TipoPlan,
} from "../../services/api";
import { entrarComo } from "../../lib/verComo";

const planColor: Record<TipoPlan, string> = {
  free: "var(--fg-3)",
  basic: "var(--info)",
  standard: "var(--violet)",
  premium: "var(--warn)",
};

const fmtFecha = (s?: string, lang: Lang = "es") =>
  s
    ? new Date(s).toLocaleDateString(LOCALE[lang], {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const fmtMoney = (n: number, moneda = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 0,
  }).format(n || 0);

export default function Plataforma() {
  const { t, lang } = useLang();
  const [resumen, setResumen] = useState<PlataformaResumen | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState<number | null>(null);

  // "Ver como el cliente": abre el panel de esa cuenta en solo lectura.
  const verComo = async (c: Cuenta) => {
    setEntrando(c.id);
    setError(null);
    try {
      const r = await plataformaService.verComo(c.id);
      if (!entrarComo(r.token, r.cuenta.nombre || c.nombre)) {
        setError("Ya estás viendo otra cuenta (quizás en otra pestaña). Volvé a tu cuenta primero.");
        setEntrando(null);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudo abrir el panel de esa cuenta."));
      setEntrando(null);
    }
  };

  useEffect(() => {
    // Cargamos resumen y cuentas por separado: si uno falla, el otro igual
    // se muestra, y el banner reporta el mensaje real del backend.
    let active = true;
    (async () => {
      const [resR, cueR] = await Promise.allSettled([
        plataformaService.getResumen(),
        plataformaService.getCuentas(),
      ]);
      if (!active) return;
      if (resR.status === "fulfilled") setResumen(resR.value);
      if (cueR.status === "fulfilled") setCuentas(cueR.value);
      const fail = [resR, cueR].find((r) => r.status === "rejected");
      if (fail && fail.status === "rejected") {
        setError(
          getApiErrorMessage(fail.reason, t("pfLoadError")),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardBg = "var(--surface)";
  const cardBorder = "var(--line)";
  const cardShadow = "var(--shadow-1)";
  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";

  return (
    <AdminLayout title={t("navPlataforma")}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 600, margin: 0 }}>
          {t("pfHeading")}
        </h2>
        <p style={{ color: "var(--fg-3)", fontSize: 13, margin: "4px 0 0" }}>
          {t("pfSubtitle")}
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--err-bg)",
            border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
            color: "var(--err)",
            fontSize: 13,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      {/* Métricas */}
      {resumen && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <Metric label={t("pfMrr", { cur: resumen.moneda })} value={fmtMoney(resumen.mrr, resumen.moneda)} accent="var(--ok)" big />
          <Metric label={t("pfTotalAccounts")} value={String(resumen.total_cuentas)} accent="var(--info)" />
          <Metric label={t("pfActive")} value={String(resumen.activas)} accent="var(--ok)" />
          <Metric label={t("pfCancelled")} value={String(resumen.canceladas)} accent="var(--err)" />
          <Metric label={t("pfPaid")} value={String(resumen.por_pago)} accent="var(--warn)" />
          <Metric label={t("pfTotalBiz")} value={String(resumen.total_negocios)} accent="var(--violet)" />
        </div>
      )}

      {/* Distribución por plan */}
      {resumen && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {(Object.keys(resumen.por_plan) as TipoPlan[]).map((plan) => {
            const facturacion =
              plan === "free"
                ? 0
                : resumen.mrr_por_plan[plan as "basic" | "standard" | "premium"];
            return (
              <div
                key={plan}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: cardShadow,
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: planColor[plan] }} />
                <span style={{ fontSize: 12.5, color: textPrimary, textTransform: "capitalize" }}>{plan}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: planColor[plan] }}>
                  {resumen.por_plan[plan]}
                </span>
                {facturacion > 0 && (
                  <span style={{ fontSize: 11.5, color: textMuted, borderLeft: `1px solid ${cardBorder}`, paddingLeft: 8 }}>
                    {fmtMoney(facturacion, resumen.moneda)}/{t("subPerMonth")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla de cuentas */}
      <div
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 14,
          boxShadow: cardShadow,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${cardBorder}` }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: textPrimary }}>
            {t("pfAccountsTitle")}
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: textMuted }}>{t("subLoading")}</div>
        ) : cuentas.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: textMuted }}>
            {t("pfNoAccounts")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {[
                    { label: t("pfColAccount"), left: true },
                    { label: "Panel", left: false },
                    { label: t("colEmail"), left: true },
                    { label: t("pfColPlan"), left: false },
                    { label: t("colStatus"), left: false },
                    { label: t("pfColOrigin"), left: false },
                    { label: t("navNegocios"), left: false },
                    { label: t("navUsuarios"), left: false },
                    { label: t("navProductos"), left: false },
                    { label: t("pfColSignup"), left: false },
                  ].map((h) => (
                    <th
                      scope="col"
                      key={h.label}
                      style={{
                        textAlign: h.left ? "left" : "center",
                        padding: "10px 14px",
                        color: textMuted,
                        fontWeight: 600,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: `1px solid ${cardBorder}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "11px 14px", color: textPrimary, fontWeight: 600, borderBottom: `1px solid ${cardBorder}`, whiteSpace: "nowrap" }}>
                      {c.nombre}
                      <span style={{ color: textMuted, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>#{c.id}</span>
                    </td>
                    <td style={{ padding: "6px 14px", textAlign: "center", borderBottom: `1px solid ${cardBorder}` }}>
                      <button
                        type="button"
                        onClick={() => verComo(c)}
                        disabled={entrando !== null}
                        aria-label={`Ver como cliente: ${c.nombre} (solo lectura)`}
                        aria-busy={entrando === c.id}
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
                      >
                        {entrando === c.id ? "Abriendo…" : "Ver como cliente"}
                      </button>
                    </td>
                    <td style={{ padding: "11px 14px", color: "var(--fg-2)", borderBottom: `1px solid ${cardBorder}`, whiteSpace: "nowrap" }}>
                      {c.email || "—"}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", borderBottom: `1px solid ${cardBorder}` }}>
                      <span
                        style={{
                          padding: "3px 9px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                          color: planColor[c.tipo_plan],
                          background: `color-mix(in srgb, ${planColor[c.tipo_plan]} 9%, transparent)`,
                        }}
                      >
                        {c.tipo_plan}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", borderBottom: `1px solid ${cardBorder}` }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: c.estado_suscripcion === "activo" ? "var(--ok)" : "var(--err)",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: c.estado_suscripcion === "activo" ? "var(--ok)" : "var(--err)",
                          }}
                        />
                        {c.estado_suscripcion}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: "var(--fg-2)", borderBottom: `1px solid ${cardBorder}`, textTransform: "capitalize" }}>
                      {c.origen || t("pfOriginManual")}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: textPrimary, borderBottom: `1px solid ${cardBorder}` }}>
                      {c.negocios_count}
                      <span style={{ color: textMuted, fontSize: 11 }}> / {c.limite_negocios >= 9999 ? "∞" : c.limite_negocios}</span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: textPrimary, borderBottom: `1px solid ${cardBorder}` }}>
                      {c.usuarios_count}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: textPrimary, borderBottom: `1px solid ${cardBorder}` }}>
                      {c.productos_count}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: textMuted, borderBottom: `1px solid ${cardBorder}`, whiteSpace: "nowrap" }}>
                      {fmtFecha(c.created_at, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Metric({
  label,
  value,
  accent,
  big,
}: {
  label: string;
  value: string;
  accent: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: `1px solid ${"var(--line)"}`,
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}
