import { useEffect, useState, useCallback, useMemo } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useTheme } from "../../context/ThemeContext";
import {
  pedidosService,
  type Pedido,
  type TipoEntrega,
} from "../../services/api";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { useLang } from "../../lib/i18n";

// Formatea la fecha del servidor respetando la zona horaria del que mira.
// Postgres guarda en UTC; si el string no trae zona, la asumimos UTC.
const formatFechaHora = (s?: string) => {
  if (!s) return "";
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const TIPOS: {
  key: "todos" | TipoEntrega;
  labelKey: string;
  icon: string;
  color: string;
}[] = [
  { key: "todos", labelKey: "pedAll", icon: "🧾", color: "#64748b" },
  { key: "mesa", labelKey: "pedTable", icon: "🍽️", color: "#8b5cf6" },
  { key: "delivery", labelKey: "pedDelivery", icon: "🛵", color: "#0ea5e9" },
  { key: "retiro", labelKey: "pedPickup", icon: "🛍️", color: "#f59e0b" },
];

const ESTADOS: {
  key: Pedido["estado"] | "todos";
  labelKey: string;
  color: string;
}[] = [
  { key: "todos", labelKey: "pedAll", color: "#64748b" },
  { key: "pendiente", labelKey: "pedPending", color: "#f59e0b" },
  { key: "preparando", labelKey: "pedPreparing", color: "#3b82f6" },
  { key: "entregado", labelKey: "pedDelivered", color: "#10b981" },
  { key: "cancelado", labelKey: "pedCancelled", color: "#ef4444" },
];

const estadoColor: Record<Pedido["estado"], string> = {
  pendiente: "#f59e0b",
  preparando: "#3b82f6",
  entregado: "#10b981",
  cancelado: "#ef4444",
};

export default function Pedidos() {
  const { isDark } = useTheme();
  const { moneda } = useNegocio();
  const { t } = useLang();
  const fmt = (n: number) => fmtMoney(n, moneda);
  const estadoLabel = (e: Pedido["estado"]) =>
    t(
      {
        pendiente: "pedStatePendiente",
        preparando: "pedStatePreparando",
        entregado: "pedStateEntregado",
        cancelado: "pedStateCancelado",
      }[e],
    );
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtro, setFiltro] = useState<Pedido["estado"] | "todos">("todos");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | TipoEntrega>("todos");
  const [mesa, setMesa] = useState("");
  const [loading, setLoading] = useState(true);

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const textMuted = isDark ? "#475569" : "#94a3b8";
  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  const load = useCallback(async () => {
    try {
      const params: { estado?: string; mesa?: string } = {};
      if (filtro !== "todos") params.estado = filtro;
      if (mesa.trim()) params.mesa = mesa.trim();
      const data = await pedidosService.getAll(params);
      setPedidos(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtro, mesa]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const cambiarEstado = async (id: number, estado: Pedido["estado"]) => {
    try {
      await pedidosService.updateEstado(id, estado);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  // El estado se filtra en el backend; el tipo, en el cliente.
  const visibles = useMemo(
    () =>
      tipoFiltro === "todos"
        ? pedidos
        : pedidos.filter((p) => p.tipo_entrega === tipoFiltro),
    [pedidos, tipoFiltro],
  );

  const tipoCount = (key: "todos" | TipoEntrega) =>
    key === "todos"
      ? pedidos.length
      : pedidos.filter((p) => p.tipo_entrega === key).length;

  return (
    <AdminLayout title={t("navPedidos")}>
      {/* Filtros */}
      <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
        {/* Grupo: Tipo de pedido */}
        <div>
          <GroupLabel color={textMuted}>{t("pedTypeOrder")}</GroupLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIPOS.map((tp) => {
              const active = tipoFiltro === tp.key;
              return (
                <button
                  key={tp.key}
                  onClick={() => setTipoFiltro(tp.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1px solid ${active ? tp.color : cardBorder}`,
                    background: active ? `${tp.color}18` : cardBg,
                    color: active ? tp.color : textSecondary,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  <span>{tp.icon}</span>
                  {t(tp.labelKey)}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: active ? tp.color : cardBorder,
                      color: active ? "#fff" : textMuted,
                    }}
                  >
                    {tipoCount(tp.key)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grupo: Estado + mesa + refrescar */}
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <GroupLabel color={textMuted}>{t("colStatus")}</GroupLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ESTADOS.map((e) => {
                const active = filtro === e.key;
                return (
                  <button
                    key={e.key}
                    onClick={() => setFiltro(e.key)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 999,
                      border: active ? "none" : `1px solid ${cardBorder}`,
                      background: active ? e.color : "transparent",
                      color: active ? "#fff" : textSecondary,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {t(e.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            value={mesa}
            onChange={(e) => setMesa(e.target.value)}
            placeholder={t("pedFilterTable")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
              color: textPrimary,
              fontSize: 13,
              outline: "none",
              width: 150,
            }}
          />
          <button
            onClick={load}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
              color: textSecondary,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ↻ {t("pedRefresh")}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: textMuted }}>{t("pedLoading")}</p>
      ) : visibles.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: textMuted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧾</div>
          <p style={{ fontSize: 15 }}>{t("pedEmpty")}</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          }}
        >
          {visibles.map((p) => (
            <div
              key={p.id}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: textPrimary, display: "flex", alignItems: "center", gap: 7 }}>
                    <span>
                      {p.tipo_entrega === "delivery"
                        ? "🛵"
                        : p.tipo_entrega === "retiro"
                          ? "🛍️"
                          : "🍽️"}
                    </span>
                    {p.tipo_entrega === "delivery"
                      ? t("pedDelivery")
                      : p.tipo_entrega === "retiro"
                        ? t("pedPickupInLocal")
                        : p.mesa
                          ? t("pedTableN", { n: p.mesa })
                          : t("pedOrder")}
                  </div>
                  <div style={{ fontSize: 11.5, color: textMuted }}>
                    #{p.id}
                    {p.cliente ? ` · ${p.cliente}` : ""}
                    {p.created_at ? ` · ${formatFechaHora(p.created_at)}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: `${estadoColor[p.estado]}22`,
                    color: estadoColor[p.estado],
                    border: `1px solid ${estadoColor[p.estado]}44`,
                  }}
                >
                  {estadoLabel(p.estado)}
                </span>
              </div>

              {/* Items */}
              <div
                style={{
                  display: "grid",
                  gap: 5,
                  padding: "10px 0",
                  borderTop: `1px solid ${cardBorder}`,
                  borderBottom: `1px solid ${cardBorder}`,
                }}
              >
                {(p.items || []).map((it) => (
                  <div
                    key={it.id ?? `${it.nombre}-${it.cantidad}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 13,
                      color: textSecondary,
                    }}
                  >
                    <span>
                      <strong style={{ color: textPrimary }}>{it.cantidad}×</strong>{" "}
                      {it.nombre}
                    </span>
                    <span>{fmt(Number(it.subtotal))}</span>
                  </div>
                ))}
              </div>

              {/* Dirección de delivery */}
              {p.tipo_entrega === "delivery" && p.direccion_entrega && (
                <div style={{ fontSize: 12.5, color: textSecondary, marginTop: 8, display: "flex", gap: 6 }}>
                  <span>📍</span>
                  <span>{p.direccion_entrega}</span>
                </div>
              )}

              {/* Teléfono del cliente (retiro/delivery) */}
              {p.telefono_cliente && (
                <div style={{ fontSize: 12.5, marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <span>📞</span>
                  <a href={`tel:${p.telefono_cliente}`} style={{ color: textSecondary, textDecoration: "none" }}>
                    {p.telefono_cliente}
                  </a>
                  <a
                    href={`https://wa.me/${(p.telefono_cliente || "").replace(/\D/g, "").replace(/^0/, "").replace(/^(?!54)/, "549")}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#25d366", fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}
                  >
                    WhatsApp
                  </a>
                </div>
              )}

              {/* Nota */}
              {p.nota && (
                <div
                  style={{
                    fontSize: 12,
                    color: textMuted,
                    fontStyle: "italic",
                    marginTop: 8,
                  }}
                >
                  📝 {p.nota}
                </div>
              )}

              {/* Total */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  margin: "12px 0 10px",
                }}
              >
                <span style={{ fontSize: 12, color: textMuted }}>{t("totalLabel")}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: textPrimary }}>
                  {fmt(Number(p.total))}
                </span>
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.estado === "pendiente" && (
                  <EstadoBtn color="#3b82f6" onClick={() => cambiarEstado(p.id, "preparando")}>
                    {t("pedPrepare")}
                  </EstadoBtn>
                )}
                {p.estado === "preparando" && (
                  <EstadoBtn color="#10b981" onClick={() => cambiarEstado(p.id, "entregado")}>
                    {t("pedDeliver")}
                  </EstadoBtn>
                )}
                {(p.estado === "pendiente" || p.estado === "preparando") && (
                  <EstadoBtn color="#ef4444" ghost onClick={() => cambiarEstado(p.id, "cancelado")}>
                    {t("actionCancel")}
                  </EstadoBtn>
                )}
                {(p.estado === "entregado" || p.estado === "cancelado") && (
                  <EstadoBtn color="#64748b" ghost onClick={() => cambiarEstado(p.id, "pendiente")}>
                    {t("pedReopen")}
                  </EstadoBtn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function GroupLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function EstadoBtn({
  children,
  color,
  ghost,
  onClick,
}: {
  children: React.ReactNode;
  color: string;
  ghost?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 90,
        padding: "8px 12px",
        borderRadius: 8,
        border: ghost ? `1px solid ${color}55` : "none",
        background: ghost ? "transparent" : color,
        color: ghost ? color : "#fff",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
