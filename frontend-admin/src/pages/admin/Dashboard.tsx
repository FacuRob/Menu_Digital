import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import HistorialGanancias from "../../components/HistorialGanancias";
import { Card, Delta, EmptyState, Segmented } from "../../components/ui";
import { DatosTabla, GraficoBarras, GraficoLinea, Leyenda, MapaCalor, Ranking, Reparto } from "../../components/charts";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconCheck } from "../../lib/icons";
import { MENU_PUBLIC_BASE, menuPath } from "../../lib/menuUrl";
import {
  analiticasService,
  configuracionService,
  pedidosService,
  type Actividad,
  type Resumen,
  type TipoEntrega,
} from "../../services/api";

// ── Íconos ──
const ic = (d: ReactNode, size = 20) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);
const I = {
  eye: ic(
    <>
      <path d="M2.5 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.5 7c-1.2 4.1-5 7-9.5 7s-8.3-2.9-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    18,
  ),
  qr: ic(
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h.01M15 18h3M18 15v3M21 15h.01M21 21h.01" />
    </>,
    18,
  ),
  plus: ic(<path d="M12 5v14M5 12h14" />, 18),
  link: ic(
    <>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
    </>,
    16,
  ),
  arrow: ic(<path d="M5 12h14M13 6l6 6-6 6" />, 16),
  receipt: ic(
    <>
      <path d="M6 2h12l1 4H5l1-4z" />
      <path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6M9 11h6M9 15h4" />
    </>,
  ),
  chart: ic(<path d="M3 20h18M6 16l4-5 3 3 5-7" />),
  clock: ic(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  warn: ic(<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01" />, 18),
};

// Estados de pedido: un solo mapa, con colores de los tokens.
const ESTADO: Record<string, { key: string; color: string; bg: string }> = {
  pendiente: { key: "pedStatePendiente", color: "var(--warn)", bg: "var(--warn-bg)" },
  preparando: { key: "pedStatePreparando", color: "var(--info)", bg: "var(--info-bg)" },
  listo: { key: "pedStateListo", color: "var(--info)", bg: "var(--info-bg)" },
  en_camino: { key: "pedStateEnCamino", color: "var(--info)", bg: "var(--info-bg)" },
  entregado: { key: "pedStateEntregado", color: "var(--ok)", bg: "var(--ok-bg)" },
  cancelado: { key: "pedStateCancelado", color: "var(--err)", bg: "var(--err-bg)" },
};

const TIPO: Record<TipoEntrega, { key: string; color: string }> = {
  mesa: { key: "pedTable", color: "var(--chart-1)" },
  delivery: { key: "pedDelivery", color: "var(--chart-2)" },
  retiro: { key: "pedPickup", color: "var(--chart-3)" },
};

type Dias = 7 | 30 | 90;

const pct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

function hace(iso: string, locale: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

// Nombres cortos de lunes a domingo en el idioma del panel.
const diasSemana = (locale: string) =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i, 12)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }).replace(".", ""),
  );

// ── Página ──────────────────────────────────────────────────
export default function Dashboard() {
  const { hasPermiso, user } = useAuth();
  const { moneda, negocioId, slug, negocios } = useNegocio();
  const { t, lang } = useLang();
  const locale = LOCALE[lang];
  const fmt = useCallback((n: number) => fmtMoney(n, moneda), [moneda]);
  const verAnaliticas = hasPermiso("analiticas");
  const verPedidos = hasPermiso("pedidos");

  const [dias, setDias] = useState<Dias>(() => {
    try {
      const g = Number(localStorage.getItem("dash_dias"));
      return g === 7 || g === 90 ? g : 30;
    } catch {
      return 30;
    }
  });
  const [act, setAct] = useState<Actividad | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [errAct, setErrAct] = useState(false);
  const [errRes, setErrRes] = useState(false);
  const error = errAct || errRes;
  const [recientesSinAnaliticas, setRecientesSinAnaliticas] = useState<Actividad["recientes"] | null>(null);
  const [cfg, setCfg] = useState<{ nombre: string; logo: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [orden, setOrden] = useState<"ganancia" | "cantidad">("ganancia");
  const [reintento, setReintento] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem("dash_dias", String(dias));
    } catch {
      /* sin storage */
    }
  }, [dias]);

  // Actividad del período (liviana: no baja todos los pedidos).
  useEffect(() => {
    if (!verAnaliticas) return;
    let vivo = true;
    analiticasService
      .getActividad(dias)
      .then((r) => {
        if (!vivo) return;
        setAct(r);
        setErrAct(false);
      })
      .catch(() => vivo && setErrAct(true));
    return () => {
      vivo = false;
    };
  }, [verAnaliticas, negocioId, dias, reintento]);

  useEffect(() => {
    if (!verAnaliticas) return;
    let vivo = true;
    analiticasService
      .getResumen()
      .then((r) => {
        if (!vivo) return;
        setResumen(r);
        setErrRes(false);
      })
      .catch(() => {
        if (!vivo) return;
        setErrRes(true);
        // Sin datos: las tarjetas muestran "vacío" en vez de cargar para siempre.
        setResumen((r) => r ?? { meses: [], mes_actual: { ventas: 0, costo: 0, ganancia: 0, pedidos: 0 }, top_productos: [], stock_bajo: [] });
      });
    return () => {
      vivo = false;
    };
  }, [verAnaliticas, negocioId, reintento]);

  // Sin permiso de analíticas (ej.: mozo): sólo los últimos pedidos.
  useEffect(() => {
    if (verAnaliticas || !verPedidos) return;
    pedidosService
      .getAll()
      .then((ps) =>
        setRecientesSinAnaliticas(
          [...ps]
            .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
            .slice(0, 6)
            .map((p) => ({
            id: p.id,
            total: p.total,
            estado: p.estado,
            tipo_entrega: p.tipo_entrega ?? (p.mesa ? "mesa" : null),
            mesa: p.mesa,
            created_at: p.created_at || "",
            items: (p.items || []).reduce((n, it) => n + it.cantidad, 0),
          })),
        ),
      )
      .catch(() => setRecientesSinAnaliticas([]));
  }, [verAnaliticas, verPedidos, negocioId]);

  useEffect(() => {
    configuracionService
      .get()
      .then((c) => setCfg({ nombre: c.nombre, logo: c.logo_url }))
      .catch(() => {});
  }, [negocioId]);

  const bizName = cfg?.nombre || negocios.find((n) => n.id === negocioId)?.nombre || "";
  const publicUrl = `${MENU_PUBLIC_BASE}${menuPath(slug, negocioId)}`;
  const hora = new Date().getHours();
  const nombre = (user?.nombre || user?.username || "").split(" ")[0];
  const saludo = hora < 12 ? "dashMorning" : hora < 20 ? "dashAfternoon" : "dashEvening";
  const recientes = verAnaliticas ? act?.recientes ?? null : recientesSinAnaliticas;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt(t("mpPublicLink"), publicUrl);
    }
  };

  const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const dSem = useMemo(() => diasSemana(locale), [locale]);

  // Momento más fuerte de la semana (celda con más pedidos).
  const pico = useMemo(() => {
    if (!act) return null;
    let best = { d: 0, h: 0, v: 0 };
    act.horas.forEach((fila, d) => fila.forEach((v, h) => v > best.v && (best = { d, h, v })));
    return best.v ? best : null;
  }, [act]);

  const top = useMemo(() => {
    const lista = [...(resumen?.top_productos || [])];
    lista.sort((a, b) => (orden === "ganancia" ? b.ganancia - a.ganancia : b.cantidad - a.cantidad));
    return lista.slice(0, 5).map((p) => ({ label: p.nombre, valor: orden === "ganancia" ? p.ganancia : p.cantidad }));
  }, [resumen, orden]);

  const vsPrev = t("dshVsPrevN", { n: dias });
  const conVentas = !!act && act.totales.pedidos > 0;
  const pedidosTipo = act ? act.por_tipo.reduce((s, x) => s + x.pedidos, 0) : 0;

  return (
    <AdminLayout title={t("navDashboard")}>
      <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-4">
        {/* ── Encabezado: saludo, acciones y el negocio de hoy ── */}
        <section className="grid gap-5 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <p className="text-sm font-medium capitalize text-fg-3">
              {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h2 className="pn-title mt-1 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight text-fg">{t(saludo, { name: nombre })}</h2>
            <p className="mt-1.5 text-fg-2">{bizName ? t("dashHeroDesc", { biz: bizName }) : t("dashHeroDescNoBiz")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={menuPath(slug, negocioId)}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-sm)] border border-line-strong bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
            >
              {I.eye} {t("navVerMenu")}
            </a>
            {hasPermiso("qr") && (
              <Link
                to="/admin/qr"
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-sm)] border border-line-strong bg-surface px-4 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
              >
                {I.qr} {t("dashShareQr")}
              </Link>
            )}
            {hasPermiso("productos") && (
              <Link
                to="/admin/productos"
                className="inline-flex min-h-11 items-center gap-2 rounded-[var(--r-sm)] bg-accent px-4 text-sm font-bold text-on-accent transition-colors hover:bg-accent-hover"
              >
                {I.plus} {t("dashNewProduct")}
              </Link>
            )}
          </div>
        </section>

        {/* Tarjeta del local: link del menú y lo de hoy */}
        <section className="grid gap-4 rounded-[var(--r-lg)] bg-spot p-5 text-on-spot sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            {cfg?.logo ? (
              <img src={cfg.logo} alt="" className="h-14 w-14 shrink-0 rounded-[var(--r-sm)] bg-white object-cover" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[var(--r-sm)] bg-accent text-xl font-extrabold text-on-accent" aria-hidden>
                {(bizName || "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="pn-title truncate text-lg">{bizName || "—"}</p>
              <p className="flex items-center gap-1.5 text-sm opacity-80">
                <span className="h-2 w-2 rounded-full bg-[var(--ok)]" aria-hidden />
                {t("dashMenuOnline")}
              </p>
              <button
                type="button"
                onClick={copiar}
                className="mt-2 flex w-full max-w-md cursor-pointer items-center gap-2 rounded-[var(--r-sm)] border border-white/15 px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
                aria-label={`${t("dashCopyLink")}: ${publicUrl}`}
              >
                <span className="shrink-0 opacity-70">{copiado ? <IconCheck size={16} /> : I.link}</span>
                <span className="min-w-0 flex-1 truncate opacity-85">{publicUrl.replace(/^https?:\/\//, "")}</span>
                <span className="shrink-0 font-semibold" aria-live="polite">
                  {copiado ? t("dashCopied") : t("dashCopyLink")}
                </span>
              </button>
            </div>
          </div>
          {verAnaliticas && (
            <dl className="grid grid-cols-3 gap-2">
              {[
                { v: act ? String(act.hoy.pedidos) : "—", l: t("dashOrdersToday") },
                { v: act ? String(act.hoy.pendientes) : "—", l: t("dashPendingNow"), destacado: !!act?.hoy.pendientes },
                { v: act ? fmt(act.hoy.ventas) : "—", l: t("dshSalesToday") },
              ].map((x) => (
                <div key={x.l} className="flex flex-col-reverse rounded-[var(--r-sm)] bg-white/[0.07] px-3 py-3">
                  <dt className="mt-0.5 text-xs opacity-75">{x.l}</dt>
                  <dd className={`pn-title pn-num truncate text-xl ${x.destacado ? "text-accent" : ""}`}>{x.v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] bg-err-bg px-4 py-3 text-err">
            <span className="flex items-center gap-2 font-medium">
              {I.warn} {t("dshLoadError")}
            </span>
            <button
              type="button"
              onClick={() => setReintento((n) => n + 1)}
              className="min-h-10 cursor-pointer rounded-[var(--r-sm)] border border-current px-4 text-sm font-semibold"
            >
              {t("dshRetry")}
            </button>
          </div>
        )}

        {verAnaliticas && (
          <>
            {/* ── Período + métricas ── */}
            <section aria-labelledby="dsh-periodo" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="dsh-periodo" className="pn-title text-lg text-fg">
                  {t("dshPeriod")}
                  {act && (
                    <span className="ml-2 text-sm font-medium text-fg-3" style={{ fontStretch: "100%" }}>
                      {fechaCorta(act.desde)} – {fechaCorta(act.hasta)}
                    </span>
                  )}
                </h2>
                <Segmented
                  label={t("dshPeriod")}
                  value={dias}
                  onChange={setDias}
                  options={[7, 30, 90].map((n) => ({ value: n as Dias, label: t("dshDays", { n }) }))}
                />
              </div>
              <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Kpi label={t("dshSales")} valor={act ? fmt(act.totales.ventas) : null} delta={act && pct(act.totales.ventas, act.anterior.ventas)} vs={vsPrev} sinPrev={t("dshNoPrevData")} acento />
                <Kpi label={t("dshProfit")} valor={act ? fmt(act.totales.ganancia) : null} delta={act && pct(act.totales.ganancia, act.anterior.ganancia)} vs={vsPrev} sinPrev={t("dshNoPrevData")} />
                <Kpi label={t("dshOrders")} valor={act ? String(act.totales.pedidos) : null} delta={act && pct(act.totales.pedidos, act.anterior.pedidos)} vs={vsPrev} sinPrev={t("dshNoPrevData")} />
                <Kpi
                  label={t("dshTicket")}
                  valor={act ? fmt(act.totales.ticket) : null}
                  delta={act && act.anterior.pedidos ? pct(act.totales.ticket, act.anterior.ventas / act.anterior.pedidos) : null}
                  vs={vsPrev}
                  sinPrev={act?.estados.cancelado ? t("dshCancelled", { n: act.estados.cancelado }) : t("dshNoPrevData")}
                />
              </dl>
            </section>

            {/* ── Ventas por día + cómo te piden ── */}
            <section className="grid gap-5 xl:grid-cols-3">
              <Card
                className="xl:col-span-2"
                title={t("dshDaily")}
                desc={t("dshDailyDesc")}
                action={
                  <Leyenda
                    items={[
                      { color: "var(--chart-1)", label: t("dshThisPeriod") },
                      ...(act?.anterior.pedidos ? [{ color: "var(--fg-3)", label: t("dshPrevPeriod"), dashed: true }] : []),
                    ]}
                  />
                }
              >
                {!act ? (
                  <div className="h-[230px] animate-pulse rounded-[var(--r-sm)] bg-surface-2" />
                ) : !conVentas && !act.anterior.pedidos ? (
                  <EmptyState icon={I.chart} title={t("dshNoSales")} desc={t("dshNoSalesDesc")} />
                ) : (
                  <>
                    <GraficoLinea
                      puntos={act.serie.map((d, i) => ({ x: d.fecha, y: d.ventas, anterior: act.anterior.pedidos ? act.serie_anterior[i] : undefined }))}
                      formato={fmt}
                      locale={locale}
                      etiqueta={`${t("dshDaily")}: ${fmt(act.totales.ventas)}`}
                      ayuda={t("dshArrowsHelp")}
                      antes={t("dshBefore")}
                    />
                    <DatosTabla
                      resumen={t("dshShowData")}
                      cols={[t("dshDate"), t("dshSales"), t("dshProfit"), t("dshOrders")]}
                      filas={act.serie.map((d) => [fechaCorta(d.fecha), fmt(d.ventas), fmt(d.ganancia), d.pedidos])}
                    />
                  </>
                )}
              </Card>

              <Card title={t("dshByType")} desc={t("dshByTypeDesc")}>
                {!act ? (
                  <div className="h-40 animate-pulse rounded-[var(--r-sm)] bg-surface-2" />
                ) : pedidosTipo === 0 ? (
                  <EmptyState icon={I.receipt} title={t("dshNoOrdersPeriod")} />
                ) : (
                  <Reparto
                    etiqueta={act.por_tipo.map((x) => `${t(TIPO[x.tipo].key)}: ${x.pedidos}`).join(", ")}
                    partes={act.por_tipo.map((x) => ({
                      label: t(TIPO[x.tipo].key),
                      valor: x.pedidos,
                      color: TIPO[x.tipo].color,
                      detalle: fmt(x.ventas),
                    }))}
                  />
                )}
              </Card>
            </section>

            {/* ── Horas pico + productos ── */}
            <section className="grid gap-5 xl:grid-cols-3">
              <Card className="xl:col-span-2" title={t("dshPeak")} desc={t("dshPeakDesc")}>
                {!act ? (
                  <div className="h-48 animate-pulse rounded-[var(--r-sm)] bg-surface-2" />
                ) : (
                  <>
                    <p className="mb-4 font-medium text-fg">
                      {pico
                        ? t("dshPeakBest", { dia: dSem[pico.d], h: pico.h, h2: pico.h + 1 })
                        : t("dshPeakNone")}
                    </p>
                    <MapaCalor
                      matriz={act.horas}
                      dias={dSem}
                      etiqueta={pico ? t("dshPeakBest", { dia: dSem[pico.d], h: pico.h, h2: pico.h + 1 }) : t("dshPeakNone")}
                      unidad={(n) => t("dshNOrders", { n })}
                    />
                  </>
                )}
              </Card>

              <Card
                title={t("topProducts")}
                action={
                  <Segmented
                    label={t("dshTopBy")}
                    value={orden}
                    onChange={setOrden}
                    options={[
                      { value: "ganancia", label: t("dshTopProfit") },
                      { value: "cantidad", label: t("dshTopUnits") },
                    ]}
                  />
                }
              >
                {!resumen ? (
                  <div className="h-48 animate-pulse rounded-[var(--r-sm)] bg-surface-2" />
                ) : top.length === 0 ? (
                  <EmptyState icon={I.chart} title={t("dshNoSales")} />
                ) : (
                  <Ranking items={top} formato={orden === "ganancia" ? fmt : (n) => t("dshUnitsN", { n })} />
                )}
              </Card>
            </section>
          </>
        )}

        {/* ── Últimos pedidos + stock ── */}
        {(verPedidos || resumen) && (
          <section className="grid gap-5 xl:grid-cols-3">
            {verPedidos && (
              <Card
                className={resumen ? "xl:col-span-2" : "xl:col-span-3"}
                title={t("dashRecentOrders")}
                action={
                  <Link to="/admin/pedidos" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-fg underline-offset-4 hover:underline">
                    {t("dashSeeAll")} {I.arrow}
                  </Link>
                }
              >
                {recientes === null ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((k) => (
                      <div key={k} className="h-14 animate-pulse rounded-[var(--r-sm)] bg-surface-2" />
                    ))}
                  </div>
                ) : recientes.length === 0 ? (
                  <EmptyState icon={I.receipt} title={t("dashNoOrders")} />
                ) : (
                  <ul className="-mx-2 divide-y divide-[var(--line)]">
                    {recientes.map((p) => {
                      const e = ESTADO[p.estado] || ESTADO.pendiente;
                      return (
                        <li key={p.id}>
                          <Link
                            to="/admin/pedidos"
                            className="flex min-h-14 items-center gap-3 rounded-[var(--r-sm)] px-2 py-2.5 transition-colors hover:bg-surface-2"
                          >
                            <span className="pn-num grid h-10 min-w-10 shrink-0 place-items-center rounded-[var(--r-sm)] bg-surface-3 px-1.5 text-xs font-bold text-fg-2">
                              #{p.id}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-fg">
                                {p.mesa ? t("pedTableN", { n: p.mesa }) : p.tipo_entrega ? t(TIPO[p.tipo_entrega].key) : t("dashTakeaway")}
                              </span>
                              <span className="block truncate text-sm text-fg-3">{p.created_at ? hace(p.created_at, locale) : ""}</span>
                            </span>
                            <span className="hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline" style={{ background: e.bg, color: e.color }}>
                              {t(e.key)}
                            </span>
                            <span className="pn-num w-24 text-right font-bold text-fg">{fmt(p.total)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            )}

            {resumen && (
              <Card
                className={verPedidos ? "" : "xl:col-span-3"}
                title={resumen.stock_bajo.length ? t("lowStock") : undefined}
                action={
                  resumen.stock_bajo.length ? (
                    <Link to="/admin/productos" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-fg underline-offset-4 hover:underline">
                      {t("dashSeeAll")} {I.arrow}
                    </Link>
                  ) : undefined
                }
              >
                {resumen.stock_bajo.length > 0 ? (
                  <ul className="space-y-2">
                    {resumen.stock_bajo.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded-[var(--r-sm)] bg-surface-2 px-3 py-2.5">
                        <span className="truncate text-fg-2">{p.nombre}</span>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold"
                          style={p.stock === 0 ? { background: "var(--err-bg)", color: "var(--err)" } : { background: "var(--warn-bg)", color: "var(--warn)" }}
                        >
                          {p.stock === 0 ? t("soldOut") : t("unitsShort", { n: p.stock })}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-ok-bg text-ok" aria-hidden>
                      <IconCheck size={24} />
                    </span>
                    <p className="font-semibold text-fg">{t("dashAllGood")}</p>
                    <p className="text-sm text-fg-3">{t("dashStockOk")}</p>
                  </div>
                )}
              </Card>
            )}
          </section>
        )}

        {/* ── Por mes ── */}
        {resumen && (
          <Card
            title={t("dshMonthly")}
            action={
              <Leyenda
                items={[
                  { color: "var(--chart-1)", label: t("legendSales"), cuadro: true },
                  { color: "var(--chart-3)", label: t("legendProfit"), cuadro: true },
                ]}
              />
            }
          >
            <GraficoBarras
              grupos={resumen.meses.map((m) => ({ label: m.label, valores: [m.ventas, m.ganancia] }))}
              series={[
                { label: t("legendSales"), color: "var(--chart-1)" },
                { label: t("legendProfit"), color: "var(--chart-3)" },
              ]}
              formato={fmt}
              locale={locale}
              etiqueta={resumen.meses.map((m) => `${m.label}: ${fmt(m.ventas)}`).join(", ")}
            />
            <DatosTabla
              resumen={t("dshShowData")}
              cols={[t("dshMonth"), t("legendSales"), t("legendProfit"), t("dshOrders")]}
              filas={resumen.meses.map((m) => [m.label, fmt(m.ventas), fmt(m.ganancia), m.pedidos])}
            />
          </Card>
        )}

        {verAnaliticas && <HistorialGanancias />}
      </div>
    </AdminLayout>
  );
}

function Kpi({
  label,
  valor,
  delta,
  vs,
  sinPrev,
  acento,
}: {
  label: string;
  valor: string | null;
  delta: number | null | undefined;
  vs: string;
  sinPrev: string;
  acento?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--r-md)] border border-line bg-surface p-4 sm:p-5">
      {acento && <span className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden />}
      <dt className="text-sm font-medium text-fg-3">{label}</dt>
      <dd className="pn-title pn-num mt-1.5 truncate text-[clamp(1.25rem,2.4vw,1.75rem)] text-fg">
        {valor ?? <span className="inline-block h-7 w-24 animate-pulse rounded bg-surface-2 align-middle" />}
      </dd>
      <dd className="mt-2">{valor !== null && <Delta value={delta ?? null} label={delta === null || delta === undefined ? sinPrev : vs} />}</dd>
    </div>
  );
}
