import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import AdminLayout from "../../components/AdminLayout";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { useLang, LOCALE } from "../../lib/i18n";
import { analiticasService, type Resumen, type ResumenMes } from "../../services/api";

const CARDS = [
  {
    permiso: "categorias",
    ruta: "/admin/categorias",
    labelKey: "navCategorias",
    descKey: "descCategorias",
    accent: "#3b82f6",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "productos",
    ruta: "/admin/productos",
    labelKey: "navProductos",
    descKey: "descProductos",
    accent: "#8b5cf6",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
        <path
          d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    permiso: "pedidos",
    ruta: "/admin/pedidos",
    labelKey: "navPedidos",
    descKey: "descPedidos",
    accent: "#10b981",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M6 2h12l1 4H5l1-4z" strokeLinejoin="round" />
        <path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6" />
        <path d="M9 11h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "qr",
    ruta: "/admin/qr",
    labelKey: "navQr",
    descKey: "descQr",
    accent: "#06b6d4",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <path
          d="M15 15h.01M15 18h3M18 15v3M21 15h.01M21 21h.01"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    permiso: "*",
    ruta: "/admin/usuarios",
    labelKey: "navUsuarios",
    descKey: "descUsuarios",
    accent: "#f59e0b",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path
          d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    permiso: "*",
    ruta: "/admin/negocios",
    labelKey: "navNegocios",
    descKey: "descNegocios",
    accent: "#6366f1",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M3 21h18" strokeLinecap="round" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    permiso: "plataforma",
    ruta: "/admin/plataforma",
    labelKey: "navPlataforma",
    descKey: "descPlataforma",
    accent: "#0ea5e9",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" strokeLinecap="round" />
      </svg>
    ),
  },
];

const arrowIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 14, height: 14 }}
  >
    <path
      d="M5 12h14M12 5l7 7-7 7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Dashboard() {
  const { hasPermiso, isPlataforma, user } = useAuth();
  const { isDark } = useTheme();
  const { moneda } = useNegocio();
  const { t, lang } = useLang();
  const fmt = (n: number) => fmtMoney(n, moneda);
  const navigate = useNavigate();
  const visible = CARDS.filter((c) =>
    c.permiso === "plataforma" ? isPlataforma : hasPermiso(c.permiso),
  );

  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";
  const cardShadow = isDark ? "none" : "0 1px 3px rgba(0,0,0,0.04)";

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const puedeVerAnaliticas = hasPermiso("analiticas");

  useEffect(() => {
    if (!puedeVerAnaliticas) return;
    analiticasService
      .getResumen()
      .then(setResumen)
      .catch((e) => console.error(e));
  }, [puedeVerAnaliticas]);

  return (
    <AdminLayout title="Dashboard">
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: isDark ? "#475569" : "#94a3b8", fontSize: 13, marginBottom: 4 }}>
          {new Date().toLocaleDateString(LOCALE[lang], {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h2
          style={{ color: isDark ? "#f1f5f9" : "#1e293b", fontSize: 22, fontWeight: 600, margin: 0 }}
        >
          {t("greeting", { name: user?.nombre || user?.username || "" })} 👋
        </h2>
        <p style={{ color: isDark ? "#475569" : "#64748b", fontSize: 13, margin: "4px 0 0" }}>
          {t("welcome")}
        </p>
      </div>

      {/* Analítica */}
      {resumen && (
        <div style={{ marginBottom: 28 }}>
          {/* Métricas del mes */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <Metric label={t("metricProfit")} value={fmt(resumen.mes_actual.ganancia)} accent="#10b981" isDark={isDark} big />
            <Metric label={t("metricSales")} value={fmt(resumen.mes_actual.ventas)} accent="#3b82f6" isDark={isDark} />
            <Metric label={t("metricCost")} value={fmt(resumen.mes_actual.costo)} accent="#f59e0b" isDark={isDark} />
            <Metric label={t("metricOrders")} value={String(resumen.mes_actual.pedidos)} accent="#8b5cf6" isDark={isDark} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {/* Gráfico 6 meses */}
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 18, boxShadow: cardShadow }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
                  {t("chartTitle")}
                </h3>
                <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
                  <Legend color="#93c5fd" label={t("legendSales")} />
                  <Legend color="#10b981" label={t("legendProfit")} />
                </div>
              </div>
              <BarChart meses={resumen.meses} isDark={isDark} moneda={moneda} />
            </div>

            {/* Top productos + stock bajo */}
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 18, boxShadow: cardShadow }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
                  {t("topProducts")}
                </h3>
                {resumen.top_productos.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: isDark ? "#475569" : "#94a3b8", margin: 0 }}>
                    {t("noSalesMonth")}
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {resumen.top_productos.map((t) => (
                      <div key={t.nombre} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ color: isDark ? "#cbd5e1" : "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.nombre}
                        </span>
                        <span style={{ color: isDark ? "#475569" : "#94a3b8", fontSize: 11 }}>×{t.cantidad}</span>
                        <span style={{ color: "#10b981", fontWeight: 700 }}>{fmt(t.ganancia)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {resumen.stock_bajo.length > 0 && (
                <div style={{ background: cardBg, border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: 18, boxShadow: cardShadow }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: 6 }}>
                    ⚠ {t("lowStock")}
                  </h3>
                  <div style={{ display: "grid", gap: 7 }}>
                    {resumen.stock_bajo.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: isDark ? "#cbd5e1" : "#334155" }}>{p.nombre}</span>
                        <span style={{ color: p.stock === 0 ? "#ef4444" : "#f59e0b", fontWeight: 700 }}>
                          {p.stock === 0 ? t("soldOut") : t("unitsShort", { n: p.stock })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accesos rápidos */}
      <h3 style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 13, fontWeight: 600, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {t("quickAccess")}
      </h3>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {visible.map((card) => (
          <button
            key={card.ruta}
            onClick={() => navigate(card.ruta)}
            style={{
              background: cardBg,
              border: `1px solid ${cardBorder}`,
              borderRadius: 14,
              padding: "20px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
              position: "relative",
              overflow: "hidden",
              boxShadow: cardShadow,
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = `${card.accent}55`;
              b.style.transform = "translateY(-2px)";
              b.style.boxShadow = `0 8px 30px ${card.accent}18`;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = cardBorder;
              b.style.transform = "translateY(0)";
              b.style.boxShadow = cardShadow;
            }}
          >
            {/* Accent dot top right */}
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: `${card.accent}15`,
                pointerEvents: "none",
              }}
            />

            {/* Icon */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${card.accent}18`,
                border: `1px solid ${card.accent}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.accent,
                marginBottom: 14,
              }}
            >
              {card.icon}
            </div>

            <div
              style={{
                color: isDark ? "#f1f5f9" : "#1e293b",
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              {t(card.labelKey)}
            </div>
            <div
              style={{
                color: isDark ? "#475569" : "#64748b",
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              {t(card.descKey)}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: card.accent,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {t("goTo", { label: t(card.labelKey) })} {arrowIcon}
            </div>
          </button>
        ))}
      </div>

      {/* Quick tip */}
      <div
        style={{
          marginTop: 24,
          padding: "14px 16px",
          borderRadius: 10,
          background: isDark ? "rgba(59,130,246,0.07)" : "rgba(59,130,246,0.06)",
          border: "1px solid rgba(59,130,246,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ color: "#3b82f6", fontSize: 18 }}>💡</div>
        <div style={{ color: isDark ? "#64748b" : "#475569", fontSize: 12 }}>
          {t("tip")}
        </div>
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
      <div style={{ fontSize: big ? 24 : 20, fontWeight: 800, color: accent }}>
        {value}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#94a3b8" }}>
      <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function Bar({ h, color, title }: { h: number; color: string; title: string }) {
  return (
    <div
      title={title}
      style={{
        width: 14,
        height: Math.max(2, h * 120),
        background: color,
        borderRadius: "4px 4px 0 0",
        transition: "height .3s",
      }}
    />
  );
}

function BarChart({ meses, isDark, moneda }: { meses: ResumenMes[]; isDark: boolean; moneda: string }) {
  const fmt = (n: number) => fmtMoney(n, moneda);
  const max = Math.max(
    1,
    ...meses.map((m) => Math.max(m.ventas, m.ganancia)),
  );
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
      {meses.map((m) => (
        <div
          key={m.key}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          <div
            style={{
              height: 120,
              width: "100%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <Bar h={m.ventas / max} color="#93c5fd" title={`Ventas ${fmt(m.ventas)}`} />
            <Bar h={m.ganancia / max} color="#10b981" title={`Ganancia ${fmt(m.ganancia)}`} />
          </div>
          <span style={{ fontSize: 11, color: isDark ? "#64748b" : "#94a3b8", textTransform: "capitalize" }}>
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}
