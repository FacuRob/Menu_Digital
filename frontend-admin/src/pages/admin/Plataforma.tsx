import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { useLang } from "../../lib/i18n";
import {
  plataformaService,
  getApiErrorMessage,
  type CuentaRiesgo,
  type PlataformaResumen,
  type TipoPlan,
} from "../../services/api";
import RiesgoPanel from "../../components/RiesgoPanel";
import { planColor, fmtMoney, useVerComo } from "../../lib/plataforma";

// Plataforma · Resumen: lo que hay que mirar de un vistazo. La lista
// completa de cuentas está en Plataforma · Cuentas y los cupones aparte.
export default function Plataforma() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<PlataformaResumen | null>(null);
  const [riesgo, setRiesgo] = useState<CuentaRiesgo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { entrando, verComo } = useVerComo(setError);

  useEffect(() => {
    let active = true;
    (async () => {
      const [resR, riesR] = await Promise.allSettled([plataformaService.getResumen(), plataformaService.getRiesgo()]);
      if (!active) return;
      if (resR.status === "fulfilled") setResumen(resR.value);
      if (riesR.status === "fulfilled") setRiesgo(riesR.value);
      const fail = [resR, riesR].find((r) => r.status === "rejected");
      if (fail && fail.status === "rejected") setError(getApiErrorMessage(fail.reason, t("pfLoadError")));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminLayout title={`${t("navPlataforma")} · ${t("pfNavResumen")}`}>
      {error && (
        <div
          role="alert"
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
            marginBottom: 14,
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
          {(Object.keys(resumen.por_plan) as TipoPlan[]).map((plan) => {
            const facturacion = plan === "free" ? 0 : resumen.mrr_por_plan[plan as "basic" | "standard" | "premium"];
            return (
              <div
                key={plan}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 999,
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  boxShadow: "var(--shadow-1)",
                }}
              >
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: planColor[plan] }} />
                <span style={{ fontSize: 12.5, color: "var(--fg)", textTransform: "capitalize" }}>{plan}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: planColor[plan] }}>{resumen.por_plan[plan]}</span>
                {facturacion > 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--fg-3)", borderLeft: "1px solid var(--line)", paddingLeft: 8 }}>
                    {fmtMoney(facturacion, resumen.moneda)}/{t("subPerMonth")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <RiesgoPanel
        cuentas={riesgo}
        loading={loading}
        entrando={entrando}
        onVerComo={verComo}
        onVerTodas={() => navigate("/admin/plataforma/cuentas?f=riesgo")}
      />
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
