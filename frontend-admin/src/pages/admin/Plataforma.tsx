import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import AdminLayout from "../../components/AdminLayout";
import {
  plataformaService,
  getApiErrorMessage,
  type Cuenta,
  type PlataformaResumen,
  type TipoPlan,
} from "../../services/api";

const planColor: Record<TipoPlan, string> = {
  free: "#6b7280",
  basic: "#3b82f6",
  standard: "#8b5cf6",
  premium: "#f59e0b",
};

const fmtFecha = (s?: string) =>
  s
    ? new Date(s).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const fmtMoney = (n: number, moneda = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: moneda,
    maximumFractionDigits: 2,
  }).format(n || 0);

export default function Plataforma() {
  const { isDark } = useTheme();
  const [resumen, setResumen] = useState<PlataformaResumen | null>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          getApiErrorMessage(
            fail.reason,
            "No se pudieron cargar los datos de plataforma.",
          ),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const cardShadow = isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)";
  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#475569" : "#94a3b8";

  return (
    <AdminLayout title="Plataforma">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: textPrimary, fontSize: 22, fontWeight: 600, margin: 0 }}>
          Panel de plataforma 🛰️
        </h2>
        <p style={{ color: isDark ? "#475569" : "#64748b", fontSize: 13, margin: "4px 0 0" }}>
          Todas las cuentas suscriptas al SaaS (compras de Hotmart y altas manuales).
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
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
          <Metric label={`Ganancia mensual · MRR (${resumen.moneda})`} value={fmtMoney(resumen.mrr, resumen.moneda)} accent="#10b981" isDark={isDark} big />
          <Metric label="Cuentas totales" value={String(resumen.total_cuentas)} accent="#3b82f6" isDark={isDark} />
          <Metric label="Activas" value={String(resumen.activas)} accent="#10b981" isDark={isDark} />
          <Metric label="Canceladas" value={String(resumen.canceladas)} accent="#ef4444" isDark={isDark} />
          <Metric label="Altas por Hotmart" value={String(resumen.por_hotmart)} accent="#f59e0b" isDark={isDark} />
          <Metric label="Negocios totales" value={String(resumen.total_negocios)} accent="#8b5cf6" isDark={isDark} />
        </div>
      )}

      {/* Aviso si no hay precios configurados → MRR sería $0 */}
      {resumen &&
        resumen.precios.mensual.basic === 0 &&
        resumen.precios.mensual.standard === 0 &&
        resumen.precios.mensual.premium === 0 &&
        resumen.precios.anual.basic === 0 &&
        resumen.precios.anual.standard === 0 &&
        resumen.precios.anual.premium === 0 && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.25)",
              color: "#f59e0b",
              fontSize: 12.5,
              marginBottom: 20,
            }}
          >
            ⚠ Configurá el precio de cada plan (variables{" "}
            <code>PLAN_PRECIO_*_MONTHLY</code> y <code>PLAN_PRECIO_*_ANNUAL</code>{" "}
            en el backend) para que el MRR muestre tu ganancia real.
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
                    {fmtMoney(facturacion, resumen.moneda)}/mes
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
            Cuentas suscriptas
          </h3>
        </div>

        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: textMuted }}>Cargando…</div>
        ) : cuentas.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: textMuted }}>
            Todavía no hay cuentas registradas.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Cuenta", "Email", "Plan", "Ciclo", "Estado", "Origen", "Negocios", "Usuarios", "Productos", "Alta"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Cuenta" || h === "Email" ? "left" : "center",
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
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "11px 14px", color: textPrimary, fontWeight: 600, borderBottom: `1px solid ${cardBorder}`, whiteSpace: "nowrap" }}>
                      {c.nombre}
                      <span style={{ color: textMuted, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>#{c.id}</span>
                    </td>
                    <td style={{ padding: "11px 14px", color: isDark ? "#cbd5e1" : "#334155", borderBottom: `1px solid ${cardBorder}`, whiteSpace: "nowrap" }}>
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
                          background: `${planColor[c.tipo_plan]}18`,
                        }}
                      >
                        {c.tipo_plan}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: isDark ? "#cbd5e1" : "#334155", borderBottom: `1px solid ${cardBorder}`, textTransform: "capitalize" }}>
                      {c.ciclo_facturacion || "mensual"}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", borderBottom: `1px solid ${cardBorder}` }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          color: c.estado_suscripcion === "activo" ? "#10b981" : "#ef4444",
                        }}
                      >
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: c.estado_suscripcion === "activo" ? "#10b981" : "#ef4444",
                          }}
                        />
                        {c.estado_suscripcion}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "center", color: isDark ? "#cbd5e1" : "#334155", borderBottom: `1px solid ${cardBorder}`, textTransform: "capitalize" }}>
                      {c.origen || "manual"}
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
                      {fmtFecha(c.created_at)}
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
  isDark,
  big,
}: {
  label: string;
  value: string;
  accent: string;
  isDark: boolean;
  big?: boolean;
}) {
  return (
    <div
      style={{
        background: isDark ? "#1a1d27" : "#fff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 12, color: isDark ? "#64748b" : "#94a3b8", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}
