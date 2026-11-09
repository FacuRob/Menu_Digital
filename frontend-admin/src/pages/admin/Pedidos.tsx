import { useEffect, useState, useCallback, useMemo } from "react";
import type { ComponentType } from "react";
import AdminLayout from "../../components/AdminLayout";
import {
  IconReceipt,
  IconUtensils,
  IconTruck,
  IconBag,
  IconPin,
  IconPhone,
  IconNote,
} from "../../lib/icons";
import {
  pedidosService,
  configuracionService,
  type Pedido,
  type Configuracion,
  type TipoEntrega,
} from "../../services/api";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { useLang } from "../../lib/i18n";
import TicketModal from "../../components/TicketModal";
import { Segmented } from "../../components/ui";
import { useDialogos } from "../../lib/dialogos";
import { fmtCantidad } from "../../lib/cantidad";

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
  Icon: ComponentType<{ size?: number }>;
  color: string;
}[] = [
  { key: "todos", labelKey: "pedAll", Icon: IconReceipt, color: "var(--fg-3)" },
  { key: "mesa", labelKey: "pedTable", Icon: IconUtensils, color: "var(--info)" },
  { key: "delivery", labelKey: "pedDelivery", Icon: IconTruck, color: "var(--accent-ink)" },
  { key: "retiro", labelKey: "pedPickup", Icon: IconBag, color: "var(--ok)" },
];

// Icono según el tipo de entrega de un pedido.
const IconoEntrega = ({ tipo, size = 16 }: { tipo?: string | null; size?: number }) => {
  if (tipo === "delivery") return <IconTruck size={size} />;
  if (tipo === "retiro") return <IconBag size={size} />;
  return <IconUtensils size={size} />;
};

const ESTADOS: {
  key: Pedido["estado"] | "todos";
  labelKey: string;
  color: string;
}[] = [
  { key: "todos", labelKey: "pedAll", color: "var(--fg-3)" },
  { key: "pendiente", labelKey: "pedPending", color: "var(--warn)" },
  { key: "preparando", labelKey: "pedPreparing", color: "var(--info)" },
  { key: "listo", labelKey: "pedReadyTab", color: "var(--violet)" },
  { key: "en_camino", labelKey: "pedOnTheWayTab", color: "var(--teal)" },
  { key: "entregado", labelKey: "pedDelivered", color: "var(--ok)" },
  { key: "cancelado", labelKey: "pedCancelled", color: "var(--err)" },
];

// "En curso" se actualiza sola; "Historial" (entregados y cancelados) se
// pide por período y de a páginas, para no bajar miles de pedidos de golpe.
type Vista = "curso" | "historial";
const ESTADOS_DE: Record<Vista, typeof ESTADOS> = {
  curso: ESTADOS.filter((e) => ["todos", "pendiente", "preparando", "listo", "en_camino"].includes(e.key)),
  historial: ESTADOS.filter((e) => ["todos", "entregado", "cancelado"].includes(e.key)),
};

type Periodo = "hoy" | "ayer" | "7" | "30" | "rango";
const PERIODOS: { key: Periodo; labelKey: string }[] = [
  { key: "hoy", labelKey: "pedToday" },
  { key: "ayer", labelKey: "pedYesterday" },
  { key: "7", labelKey: "ped7d" },
  { key: "30", labelKey: "ped30d" },
  { key: "rango", labelKey: "pedRange" },
];
const POR_PAGINA = 50;
const DIA = 86_400_000;

// Período → fechas [desde, hasta) en la hora local de quien mira.
const rangoPeriodo = (p: Periodo, desde: string, hasta: string) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const h = +hoy;
  if (p === "hoy") return { desde: new Date(h), hasta: new Date(h + DIA) };
  if (p === "ayer") return { desde: new Date(h - DIA), hasta: new Date(h) };
  if (p === "7") return { desde: new Date(h - 6 * DIA), hasta: new Date(h + DIA) };
  if (p === "30") return { desde: new Date(h - 29 * DIA), hasta: new Date(h + DIA) };
  return {
    desde: desde ? new Date(`${desde}T00:00`) : null,
    hasta: hasta ? new Date(+new Date(`${hasta}T00:00`) + DIA) : null,
  };
};

const estadoColor: Record<Pedido["estado"], string> = {
  pendiente: "var(--warn)",
  preparando: "var(--info)",
  listo: "var(--violet)",
  en_camino: "var(--teal)",
  entregado: "var(--ok)",
  cancelado: "var(--err)",
};

export default function Pedidos() {
  const { moneda } = useNegocio();
  const { t } = useLang();
  const fmt = (n: number) => fmtMoney(n, moneda);
  const estadoLabel = (e: Pedido["estado"]) =>
    t(
      {
        pendiente: "pedStatePendiente",
        preparando: "pedStatePreparando",
        listo: "pedStateListo",
        en_camino: "pedStateEnCamino",
        entregado: "pedStateEntregado",
        cancelado: "pedStateCancelado",
      }[e],
    );
  const { confirmar } = useDialogos();
  const [vista, setVista] = useState<Vista>("curso");
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [rangoDesde, setRangoDesde] = useState("");
  const [rangoHasta, setRangoHasta] = useState("");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [filtro, setFiltro] = useState<Pedido["estado"] | "todos">("todos");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | TipoEntrega>("todos");
  const [mesa, setMesa] = useState("");
  const [loading, setLoading] = useState(true);
  // Datos del local para el comprobante + pedido a facturar (abre el modal).
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [ticketPedido, setTicketPedido] = useState<Pedido | null>(null);

  const textPrimary = "var(--fg)";
  const textSecondary = "var(--fg-2)";
  const textMuted = "var(--fg-3)";
  const cardBg = "var(--surface)";
  const cardBorder = "var(--line)";

  // Filtros comunes (estado y mesa) + el período del historial.
  const params = useCallback(() => {
    const base = {
      vista,
      ...(filtro !== "todos" ? { estado: filtro } : {}),
      ...(mesa.trim() ? { mesa: mesa.trim() } : {}),
    };
    if (vista === "curso") return base;
    const r = rangoPeriodo(periodo, rangoDesde, rangoHasta);
    return {
      ...base,
      ...(r.desde ? { desde: r.desde.toISOString() } : {}),
      ...(r.hasta ? { hasta: r.hasta.toISOString() } : {}),
    };
  }, [vista, filtro, mesa, periodo, rangoDesde, rangoHasta]);

  const load = useCallback(async () => {
    try {
      if (vista === "curso") {
        const data = await pedidosService.getAll(params());
        setPedidos(data);
        setTotal(data.length);
      } else {
        const r = await pedidosService.getPagina({ ...params(), limit: POR_PAGINA, offset: 0 });
        setPedidos(r.pedidos);
        setTotal(r.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [vista, params]);

  // Sólo "En curso" se refresca cada 15 s; el historial no cambia solo.
  useEffect(() => {
    load();
    if (vista !== "curso") return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, vista]);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    setFiltro("todos");
    setPedidos([]);
    setLoading(true);
  };

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const r = await pedidosService.getPagina({ ...params(), limit: POR_PAGINA, offset: pedidos.length });
      setPedidos((prev) => [...prev, ...r.pedidos.filter((p) => !prev.some((x) => x.id === p.id))]);
      setTotal(r.total);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoMas(false);
    }
  };

  // Sólo cancelados: los entregados son ventas y alimentan el Dashboard.
  const eliminar = async (p: Pedido) => {
    if (!(await confirmar({ mensaje: t("pedConfirmDelete", { id: p.id }), peligro: true }))) return;
    try {
      await pedidosService.delete(p.id);
      setPedidos((prev) => prev.filter((x) => x.id !== p.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      console.error(e);
    }
  };

  // Datos del local (nombre, dirección, teléfono) para el comprobante.
  useEffect(() => {
    configuracionService
      .get()
      .then(setConfig)
      .catch((e) => console.error(e));
  }, []);

  const cambiarEstado = async (id: number, estado: Pedido["estado"]) => {
    try {
      await pedidosService.updateEstado(id, estado);
      load();
    } catch (e) {
      console.error(e);
    }
  };

  // Entregar un pedido y ofrecer generar el ticket. Se pasa el pedido tal cual
  // (ya trae items/total) para facturar sin esperar la recarga.
  const entregar = async (p: Pedido) => {
    await cambiarEstado(p.id, "entregado");
    setTicketPedido({ ...p, estado: "entregado" });
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
        <div>
          <Segmented
            label={t("navPedidos")}
            value={vista}
            options={[
              { value: "curso", label: t("pedTabActive") },
              { value: "historial", label: t("pedTabHistory") },
            ]}
            onChange={cambiarVista}
          />
        </div>

        {/* Historial: período */}
        {vista === "historial" && (
          <div>
            <GroupLabel color={textMuted}>{t("pedPeriod")}</GroupLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {PERIODOS.map((pp) => {
                const active = periodo === pp.key;
                return (
                  <button
                    key={pp.key}
                    type="button"
                    className="tap"
                    aria-pressed={active}
                    onClick={() => setPeriodo(pp.key)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 999,
                      border: active ? "none" : `1px solid ${cardBorder}`,
                      background: active ? "var(--fg)" : "transparent",
                      color: active ? "var(--surface)" : textSecondary,
                      fontSize: 12.5,
                      fontWeight: active ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {t(pp.labelKey)}
                  </button>
                );
              })}
              {periodo === "rango" && (
                <>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: textSecondary }}>
                    {t("pedFrom")}
                    <input
                      type="date"
                      className="tap"
                      value={rangoDesde}
                      max={rangoHasta || undefined}
                      onChange={(e) => setRangoDesde(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: cardBg, color: textPrimary, fontSize: 13 }}
                    />
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: textSecondary }}>
                    {t("pedTo")}
                    <input
                      type="date"
                      className="tap"
                      value={rangoHasta}
                      min={rangoDesde || undefined}
                      onChange={(e) => setRangoHasta(e.target.value)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${cardBorder}`, background: cardBg, color: textPrimary, fontSize: 13 }}
                    />
                  </label>
                </>
              )}
            </div>
          </div>
        )}

        {/* Grupo: Tipo de pedido */}
        <div>
          <GroupLabel color={textMuted}>{t("pedTypeOrder")}</GroupLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TIPOS.map((tp) => {
              const active = tipoFiltro === tp.key;
              return (
                <button
                  key={tp.key}
                  type="button"
                  className="tap"
                  aria-pressed={active}
                  onClick={() => setTipoFiltro(tp.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1px solid ${active ? tp.color : cardBorder}`,
                    background: active ? `color-mix(in srgb, ${tp.color} 9%, transparent)` : cardBg,
                    color: active ? tp.color : textSecondary,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex" }}><tp.Icon size={16} /></span>
                  {t(tp.labelKey)}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "1px 7px",
                      borderRadius: 999,
                      background: active ? tp.color : cardBorder,
                      color: active ? "var(--surface)" : textMuted,
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
          <div style={{ flex: "1 1 240px", minWidth: 0 }}>
            <GroupLabel color={textMuted}>{t("colStatus")}</GroupLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ESTADOS_DE[vista].map((e) => {
                const active = filtro === e.key;
                return (
                  <button
                    key={e.key}
                    type="button"
                    className="tap"
                    aria-pressed={active}
                    onClick={() => setFiltro(e.key)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 999,
                      border: active ? "none" : `1px solid ${cardBorder}`,
                      background: active ? e.color : "transparent",
                      color: active ? "var(--surface)" : textSecondary,
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
            aria-label={t("pedFilterTable")}
            className="tap"
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${cardBorder}`,
              background: cardBg,
              color: textPrimary,
              fontSize: 13,
              width: 150,
            }}
          />
          <button
            type="button"
            className="tap"
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
          <div style={{ marginBottom: 10, display: "flex", justifyContent: "center", color: "var(--fg-3)" }}>
            <IconReceipt size={40} />
          </div>
          <p style={{ fontSize: 15 }}>{t("pedEmpty")}</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill,minmax(min(300px,100%),1fr))",
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
                    <span style={{ display: "flex" }}>
                      <IconoEntrega tipo={p.tipo_entrega} size={17} />
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
                    background: `color-mix(in srgb, ${estadoColor[p.estado]} 13%, transparent)`,
                    color: estadoColor[p.estado],
                    border: `1px solid color-mix(in srgb, ${estadoColor[p.estado]} 27%, transparent)`,
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
                      <strong style={{ color: textPrimary }}>{fmtCantidad(it.cantidad, it.unidad)}</strong>{" "}
                      {it.nombre}
                    </span>
                    <span>{fmt(Number(it.subtotal))}</span>
                  </div>
                ))}
              </div>

              {/* Dirección de delivery */}
              {p.tipo_entrega === "delivery" && p.direccion_entrega && (
                <div style={{ fontSize: 12.5, color: textSecondary, marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ display: "flex", flexShrink: 0 }}><IconPin size={14} /></span>
                  <span>{p.direccion_entrega}</span>
                </div>
              )}

              {/* Teléfono del cliente (retiro/delivery) */}
              {p.telefono_cliente && (
                <div style={{ fontSize: 12.5, marginTop: 8, display: "flex", gap: 8, alignItems: "center", color: textSecondary }}>
                  <span style={{ display: "flex", flexShrink: 0 }}><IconPhone size={14} /></span>
                  <a href={`tel:${p.telefono_cliente}`} style={{ color: textSecondary, textDecoration: "none" }}>
                    {p.telefono_cliente}
                  </a>
                  <a
                    href={`https://wa.me/${(p.telefono_cliente || "").replace(/\D/g, "").replace(/^0/, "").replace(/^(?!54)/, "549")}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--ok)", fontSize: 11.5, fontWeight: 600, textDecoration: "none" }}
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
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", flexShrink: 0 }}><IconNote size={13} /></span>
                  {p.nota}
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
                  <EstadoBtn color="var(--info)" onClick={() => cambiarEstado(p.id, "preparando")}>
                    {t("pedPrepare")}
                  </EstadoBtn>
                )}
                {/* Preparando → según el tipo: delivery sale "en camino", retiro
                    queda "listo para retirar"; mesa se entrega directo. */}
                {p.estado === "preparando" && p.tipo_entrega === "delivery" && (
                  <EstadoBtn color="var(--teal)" onClick={() => cambiarEstado(p.id, "en_camino")}>
                    🛵 {t("pedSend")}
                  </EstadoBtn>
                )}
                {p.estado === "preparando" && p.tipo_entrega === "retiro" && (
                  <EstadoBtn color="var(--violet)" onClick={() => cambiarEstado(p.id, "listo")}>
                    {t("pedMarkReady")}
                  </EstadoBtn>
                )}
                {(p.estado === "listo" ||
                  p.estado === "en_camino" ||
                  (p.estado === "preparando" &&
                    p.tipo_entrega !== "delivery" &&
                    p.tipo_entrega !== "retiro")) && (
                  <EstadoBtn color="var(--ok)" onClick={() => entregar(p)}>
                    {t("pedDeliver")}
                  </EstadoBtn>
                )}
                {(p.estado === "pendiente" ||
                  p.estado === "preparando" ||
                  p.estado === "listo" ||
                  p.estado === "en_camino") && (
                  <EstadoBtn color="var(--err)" ghost onClick={() => cambiarEstado(p.id, "cancelado")}>
                    {t("actionCancel")}
                  </EstadoBtn>
                )}
                {p.estado === "entregado" && (
                  <EstadoBtn color="var(--violet)" ghost onClick={() => setTicketPedido(p)}>
                    🧾 {t("ticketReprint")}
                  </EstadoBtn>
                )}
                {(p.estado === "entregado" || p.estado === "cancelado") && (
                  <EstadoBtn color="var(--fg-3)" ghost onClick={() => cambiarEstado(p.id, "pendiente")}>
                    {t("pedReopen")}
                  </EstadoBtn>
                )}
                {p.estado === "cancelado" && (
                  <EstadoBtn color="var(--err)" ghost onClick={() => eliminar(p)}>
                    {t("pedDelete")}
                  </EstadoBtn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Historial: cuántos se ven y "Cargar más" */}
      {vista === "historial" && !loading && pedidos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 20 }}>
          <span style={{ fontSize: 12.5, color: textMuted }}>
            {t("pedShowing", { n: pedidos.length, total })}
          </span>
          {pedidos.length < total && (
            <button
              type="button"
              className="tap"
              onClick={cargarMas}
              disabled={cargandoMas}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: `1px solid ${cardBorder}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 13,
                fontWeight: 600,
                cursor: cargandoMas ? "default" : "pointer",
              }}
            >
              {cargandoMas ? t("pedLoading") : t("pedLoadMore")}
            </button>
          )}
        </div>
      )}

      {/* Modal de facturación al entregar / reimprimir */}
      <TicketModal
        pedido={ticketPedido}
        config={config}
        onClose={() => setTicketPedido(null)}
      />
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
      type="button"
      className="tap"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 90,
        padding: "8px 12px",
        borderRadius: 8,
        border: ghost ? `1px solid color-mix(in srgb, ${color} 33%, transparent)` : "none",
        background: ghost ? "transparent" : color,
        color: ghost ? color : "var(--surface)",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
