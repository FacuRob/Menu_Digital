import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import AdminLayout from "../../components/AdminLayout";
import { useNegocio } from "../../context/NegocioContext";
import { fmtMoney } from "../../lib/money";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconInfo, IconCheck } from "../../lib/icons";
import { MENU_PUBLIC_BASE, menuPath } from "../../lib/menuUrl";
import {
  analiticasService,
  configuracionService,
  pedidosService,
  type Pedido,
  type Resumen,
  type ResumenMes,
} from "../../services/api";

// ── Íconos ──────────────────────────────────────────────────
const ic = (d: ReactNode, size = 22) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ width: size, height: size }}
  >
    {d}
  </svg>
);

const QR_PATHS = (
  <>
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
    <path d="M15 15h.01M15 18h3M18 15v3M21 15h.01M21 21h.01" />
  </>
);

const I = {
  categorias: ic(<path d="M4 6h16M4 12h16M4 18h10" />),
  productos: ic(
    <>
      <path d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </>,
  ),
  pedidos: ic(
    <>
      <path d="M6 2h12l1 4H5l1-4z" />
      <path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6" />
      <path d="M9 11h6" />
    </>,
  ),
  qr: ic(QR_PATHS),
  qrSmall: ic(QR_PATHS, 18),
  usuarios: ic(
    <>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </>,
  ),
  negocios: ic(
    <>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </>,
  ),
  plataforma: ic(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
    </>,
  ),
  money: ic(
    <>
      <path d="M12 2v20" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </>,
  ),
  trend: ic(
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>,
  ),
  cost: ic(
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>,
  ),
  eye: ic(
    <>
      <path d="M2.5 12C3.7 8 7.5 5 12 5s8.3 3 9.5 7c-1.2 4-5 7-9.5 7s-8.3-3-9.5-7z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    18,
  ),
  plus: ic(<path d="M12 5v14M5 12h14" />, 18),
  link: ic(
    <>
      <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" />
      <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
    </>,
    16,
  ),
  arrow: ic(<path d="M5 12h14M12 5l7 7-7 7" />, 14),
  warn: ic(
    <>
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>,
    18,
  ),
};

const CARDS = [
  { permiso: "categorias", ruta: "/admin/categorias", labelKey: "navCategorias", descKey: "descCategorias", accent: "#3b82f6", icon: I.categorias },
  { permiso: "productos", ruta: "/admin/productos", labelKey: "navProductos", descKey: "descProductos", accent: "#8b5cf6", icon: I.productos },
  { permiso: "pedidos", ruta: "/admin/pedidos", labelKey: "navPedidos", descKey: "descPedidos", accent: "#10b981", icon: I.pedidos },
  { permiso: "qr", ruta: "/admin/qr", labelKey: "navQr", descKey: "descQr", accent: "#06b6d4", icon: I.qr },
  { permiso: "*", ruta: "/admin/usuarios", labelKey: "navUsuarios", descKey: "descUsuarios", accent: "#f59e0b", icon: I.usuarios },
  { permiso: "*", ruta: "/admin/negocios", labelKey: "navNegocios", descKey: "descNegocios", accent: "#6366f1", icon: I.negocios },
  { permiso: "plataforma", ruta: "/admin/plataforma", labelKey: "navPlataforma", descKey: "descPlataforma", accent: "#0ea5e9", icon: I.plataforma },
];

const ESTADO: Record<Pedido["estado"], { key: string; color: string }> = {
  pendiente: { key: "pedStatePendiente", color: "#f59e0b" },
  preparando: { key: "pedStatePreparando", color: "#0ea5e9" },
  listo: { key: "pedStateListo", color: "#8b5cf6" },
  en_camino: { key: "pedStateEnCamino", color: "#06b6d4" },
  entregado: { key: "pedStateEntregado", color: "#10b981" },
  cancelado: { key: "pedStateCancelado", color: "#ef4444" },
};

// ── Helpers ─────────────────────────────────────────────────

// Anima un número de 0 al valor (para las métricas).
function useCountUp(value: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

const pctChange = (cur: number, prev: number | undefined) =>
  prev === undefined || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

const isToday = (iso?: string) => {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

function timeAgo(iso: string | undefined, locale: string) {
  if (!iso) return "";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

// Paleta según tema.
function usePalette() {
  const { isDark } = useTheme();
  return {
    isDark,
    card: isDark
      ? "bg-[#151924] border border-white/[0.07]"
      : "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
    title: isDark ? "text-slate-100" : "text-slate-900",
    text: isDark ? "text-slate-300" : "text-slate-600",
    muted: isDark ? "text-slate-500" : "text-slate-400",
    soft: isDark ? "bg-white/[0.04]" : "bg-slate-50",
    divider: isDark ? "border-white/[0.06]" : "border-slate-100",
    grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
  };
}

const delay = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });

// ── Página ──────────────────────────────────────────────────
export default function Dashboard() {
  const { hasPermiso, isPlataforma, user } = useAuth();
  const { moneda, negocioId, slug, negocios } = useNegocio();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const P = usePalette();
  const fmt = (n: number) => fmtMoney(n, moneda);

  const visible = CARDS.filter((c) => (c.permiso === "plataforma" ? isPlataforma : hasPermiso(c.permiso)));
  const puedeVerAnaliticas = hasPermiso("analiticas");
  const puedeVerPedidos = hasPermiso("pedidos");

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [cfg, setCfg] = useState<{ nombre: string; logo: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!puedeVerAnaliticas) return;
    analiticasService.getResumen().then(setResumen).catch((e) => console.error(e));
  }, [puedeVerAnaliticas, negocioId]);

  useEffect(() => {
    if (!puedeVerPedidos) return;
    pedidosService.getAll().then(setPedidos).catch(() => setPedidos([]));
  }, [puedeVerPedidos, negocioId]);

  useEffect(() => {
    configuracionService
      .get()
      .then((c) => setCfg({ nombre: c.nombre, logo: c.logo_url }))
      .catch(() => {});
  }, [negocioId]);

  const bizName = cfg?.nombre || negocios.find((n) => n.id === negocioId)?.nombre || "";
  const publicUrl = `${MENU_PUBLIC_BASE}${menuPath(slug, negocioId)}`;

  const hour = new Date().getHours();
  const name = user?.nombre || user?.username || "";
  const greetKey = hour < 12 ? "dashMorning" : hour < 20 ? "dashAfternoon" : "dashEvening";

  const hoy = useMemo(() => {
    if (!pedidos) return null;
    const delDia = pedidos.filter((p) => isToday(p.created_at) && p.estado !== "cancelado");
    return {
      count: delDia.length,
      pendientes: pedidos.filter((p) => ["pendiente", "preparando", "listo", "en_camino"].includes(p.estado)).length,
    };
  }, [pedidos]);

  const recientes = (pedidos || []).slice(0, 6);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t("mpPublicLink"), publicUrl);
    }
  };

  // Mes actual vs. anterior para los "deltas" de las métricas.
  const prev: ResumenMes | undefined = resumen?.meses[resumen.meses.length - 2];
  const serie = (k: keyof Pick<ResumenMes, "ventas" | "ganancia" | "costo" | "pedidos">) =>
    resumen?.meses.map((m) => m[k]) || [];

  return (
    <AdminLayout title="Dashboard">
      <div className="mx-auto max-w-[1400px] space-y-5 pb-6">
        {/* ── Hero ── */}
        <section className="dash-in relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-500 via-teal-600 to-indigo-700 p-6 text-white shadow-[0_20px_60px_-25px_rgba(8,145,178,0.6)] sm:p-8">
          <div className="auth-grid-bg pointer-events-none absolute inset-0 opacity-60" />
          <div
            className="auth-blob auth-glow pointer-events-none absolute -left-32 -top-40 h-[26rem] w-[26rem]"
            style={{ ["--glow" as string]: "rgba(103,232,249,0.40)" }}
          />
          <div
            className="auth-blob auth-glow pointer-events-none absolute -bottom-44 right-[20%] h-[26rem] w-[26rem]"
            style={{ ["--glow" as string]: "rgba(252,211,77,0.30)", animationDelay: "-8s" }}
          />

          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium capitalize ring-1 ring-white/20">
                {new Date().toLocaleDateString(LOCALE[lang], { weekday: "long", day: "numeric", month: "long" })}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{t(greetKey, { name })} 👋</h1>
              <p className="mt-2 max-w-xl text-[15px] text-white/80">
                {bizName ? t("dashHeroDesc", { biz: bizName }) : t("dashHeroDescNoBiz")}
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => window.open(menuPath(slug, negocioId), "_blank", "noopener")}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg transition-transform hover:-translate-y-0.5"
                >
                  {I.eye} {t("navVerMenu")}
                </button>
                {hasPermiso("qr") && (
                  <button
                    type="button"
                    onClick={() => navigate("/admin/qr")}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/25 transition-colors hover:bg-white/25"
                  >
                    {I.qrSmall} {t("dashShareQr")}
                  </button>
                )}
                {hasPermiso("productos") && (
                  <button
                    type="button"
                    onClick={() => navigate("/admin/productos")}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/25 transition-colors hover:bg-white/25"
                  >
                    {I.plus} {t("dashNewProduct")}
                  </button>
                )}
              </div>
            </div>

            {/* Tarjeta del negocio */}
            <div className="w-full rounded-2xl bg-slate-950/30 p-4 ring-1 ring-white/20 lg:w-[320px]">
              <div className="flex items-center gap-3">
                {cfg?.logo ? (
                  <img src={cfg.logo} alt="" className="h-12 w-12 rounded-xl bg-white object-cover" />
                ) : (
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/20 text-xl font-bold">
                    {(bizName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{bizName || "—"}</div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-200">
                    <span className="relative flex h-2 w-2">
                      <span className="auth-ping absolute inset-0 rounded-full bg-emerald-300" />
                      <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
                    </span>
                    {t("dashMenuOnline")}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={copy}
                title={publicUrl}
                className="mt-3 flex w-full cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left text-xs ring-1 ring-white/15 transition-colors hover:bg-white/20"
              >
                <span className="shrink-0 text-white/70">{copied ? <IconCheck size={15} /> : I.link}</span>
                <span className="min-w-0 flex-1 truncate text-white/85">{publicUrl.replace(/^https?:\/\//, "")}</span>
                <span className="shrink-0 font-semibold">{copied ? t("dashCopied") : t("dashCopyLink")}</span>
              </button>

              {hoy && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <div className="text-xl font-bold">{hoy.count}</div>
                    <div className="text-[11px] text-white/70">{t("dashOrdersToday")}</div>
                  </div>
                  <div className="rounded-xl bg-white/10 px-3 py-2">
                    <div className="text-xl font-bold text-amber-200">{hoy.pendientes}</div>
                    <div className="text-[11px] text-white/70">{t("dashPendingNow")}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Métricas ── */}
        {resumen && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric i={1} label={t("metricProfit")} value={resumen.mes_actual.ganancia} format={fmt} accent="#10b981" icon={I.money} delta={pctChange(resumen.mes_actual.ganancia, prev?.ganancia)} serie={serie("ganancia")} highlight />
            <Metric i={2} label={t("metricSales")} value={resumen.mes_actual.ventas} format={fmt} accent="#06b6d4" icon={I.trend} delta={pctChange(resumen.mes_actual.ventas, prev?.ventas)} serie={serie("ventas")} />
            <Metric i={3} label={t("metricCost")} value={resumen.mes_actual.costo} format={fmt} accent="#f59e0b" icon={I.cost} delta={pctChange(resumen.mes_actual.costo, prev?.costo)} serie={serie("costo")} inverse />
            <Metric i={4} label={t("metricOrders")} value={resumen.mes_actual.pedidos} format={(n) => String(Math.round(n))} accent="#8b5cf6" icon={I.pedidos} delta={pctChange(resumen.mes_actual.pedidos, prev?.pedidos)} serie={serie("pedidos")} />
          </section>
        )}

        {/* ── Gráfico + top productos ── */}
        {resumen && (
          <section className="grid gap-4 xl:grid-cols-3">
            <div className={`dash-in rounded-2xl p-5 xl:col-span-2 ${P.card}`} style={delay(5)}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h3 className={`text-[15px] font-semibold ${P.title}`}>{t("chartTitle")}</h3>
                <div className="flex gap-4 text-xs">
                  <Legend color="#22d3ee" label={t("legendSales")} />
                  <Legend color="#10b981" label={t("legendProfit")} />
                </div>
              </div>
              <BarChart meses={resumen.meses} fmt={fmt} />
            </div>

            <div className={`dash-in rounded-2xl p-5 ${P.card}`} style={delay(6)}>
              <h3 className={`mb-4 text-[15px] font-semibold ${P.title}`}>🏆 {t("topProducts")}</h3>
              <TopProducts items={resumen.top_productos} fmt={fmt} />
            </div>
          </section>
        )}

        {/* ── Pedidos recientes + stock ── */}
        {(puedeVerPedidos || resumen) && (
          <section className="grid gap-4 xl:grid-cols-3">
            {puedeVerPedidos && (
              <div className={`dash-in rounded-2xl p-5 ${resumen ? "xl:col-span-2" : "xl:col-span-3"} ${P.card}`} style={delay(7)}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-[15px] font-semibold ${P.title}`}>{t("dashRecentOrders")}</h3>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/pedidos")}
                    className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-cyan-500 hover:text-cyan-400"
                  >
                    {t("dashSeeAll")} {I.arrow}
                  </button>
                </div>
                {pedidos === null ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((k) => (
                      <div key={k} className={`h-12 animate-pulse rounded-xl ${P.soft}`} />
                    ))}
                  </div>
                ) : recientes.length === 0 ? (
                  <div className={`flex flex-col items-center gap-2 rounded-xl py-8 text-center text-sm ${P.soft} ${P.muted}`}>
                    <span className="text-3xl">🧾</span>
                    {t("dashNoOrders")}
                  </div>
                ) : (
                  <ul className={`divide-y ${P.divider}`}>
                    {recientes.map((p) => {
                      const e = ESTADO[p.estado] || ESTADO.pendiente;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => navigate("/admin/pedidos")}
                            className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${P.isDark ? "hover:bg-white/[0.03]" : "hover:bg-slate-50"}`}
                          >
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold"
                              style={{ background: `${e.color}1f`, color: e.color }}
                            >
                              #{p.id}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className={`truncate text-sm font-medium ${P.title}`}>
                                {p.mesa ? t("pedTableN", { n: p.mesa }) : p.cliente || t("dashTakeaway")}
                              </div>
                              <div className={`truncate text-xs ${P.muted}`}>
                                {timeAgo(p.created_at, LOCALE[lang])}
                              </div>
                            </div>
                            <span
                              className="hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline"
                              style={{ background: `${e.color}1a`, color: e.color }}
                            >
                              {t(e.key)}
                            </span>
                            <span className={`w-24 text-right text-sm font-bold ${P.title}`}>{fmt(p.total)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {resumen && (
              <div
                className={`dash-in rounded-2xl p-5 ${puedeVerPedidos ? "" : "xl:col-span-3"} ${P.card} ${
                  resumen.stock_bajo.length ? "!border-red-500/30" : ""
                }`}
                style={delay(8)}
              >
                {resumen.stock_bajo.length > 0 ? (
                  <>
                    <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-red-500">
                      {I.warn} {t("lowStock")}
                    </h3>
                    <ul className="space-y-2">
                      {resumen.stock_bajo.map((p) => (
                        <li key={p.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${P.soft}`}>
                          <span className={`truncate ${P.text}`}>{p.nombre}</span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold"
                            style={
                              p.stock === 0
                                ? { background: "#ef44441a", color: "#ef4444" }
                                : { background: "#f59e0b1a", color: "#f59e0b" }
                            }
                          >
                            {p.stock === 0 ? t("soldOut") : t("unitsShort", { n: p.stock })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <IconCheck size={24} />
                    </span>
                    <div className={`font-semibold ${P.title}`}>{t("dashAllGood")}</div>
                    <div className={`text-sm ${P.muted}`}>{t("dashStockOk")}</div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Accesos rápidos ── */}
        <section>
          <h3 className={`mb-3 text-xs font-semibold uppercase tracking-[0.1em] ${P.muted}`}>{t("quickAccess")}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((card, i) => (
              <button
                key={card.ruta}
                type="button"
                onClick={() => navigate(card.ruta)}
                className={`dash-in group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl p-4 text-left transition-all duration-300 hover:-translate-y-0.5 ${P.card}`}
                style={delay(9 + i)}
              >
                <span
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-50 transition-opacity group-hover:opacity-100"
                  style={{ background: `radial-gradient(closest-side, ${card.accent}aa, transparent)` }}
                />
                <span
                  className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110"
                  style={{ background: `${card.accent}1c`, color: card.accent, boxShadow: `inset 0 0 0 1px ${card.accent}33` }}
                >
                  {card.icon}
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className={`block font-semibold ${P.title}`}>{t(card.labelKey)}</span>
                  <span className={`block truncate text-xs ${P.muted}`}>{t(card.descKey)}</span>
                </span>
                <span
                  className="relative -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                  style={{ color: card.accent }}
                >
                  {I.arrow}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Tip ── */}
        <div
          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs ${
            P.isDark ? "border-cyan-400/15 bg-cyan-400/[0.05] text-slate-400" : "border-cyan-500/20 bg-cyan-50 text-slate-600"
          }`}
        >
          <span className="text-cyan-500">
            <IconInfo size={18} />
          </span>
          {t("tip")}
        </div>
      </div>
    </AdminLayout>
  );
}

// ── Métrica con delta y sparkline ───────────────────────────
function Metric({
  i,
  label,
  value,
  format,
  accent,
  icon,
  delta,
  serie,
  highlight,
  inverse,
}: {
  i: number;
  label: string;
  value: number;
  format: (n: number) => string;
  accent: string;
  icon: ReactNode;
  delta: number | null;
  serie: number[];
  highlight?: boolean;
  inverse?: boolean;
}) {
  const P = usePalette();
  const { t } = useLang();
  const v = useCountUp(value);
  const up = (delta ?? 0) >= 0;
  const good = inverse ? !up : up;

  return (
    <div className={`dash-in relative overflow-hidden rounded-2xl p-5 ${P.card}`} style={delay(i)}>
      {highlight && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, #22d3ee)` }} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`text-[13px] ${P.muted}`}>{label}</div>
          <div className={`mt-1.5 truncate text-2xl font-extrabold tracking-tight ${P.title}`}>{format(v)}</div>
        </div>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${accent}1c`, color: accent }}
        >
          {icon}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-xs">
          {delta === null ? (
            <span className={P.muted}>{t("dashNoPrev")}</span>
          ) : (
            <>
              <span
                className="mr-1.5 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold"
                style={good ? { background: "#10b9811a", color: "#10b981" } : { background: "#ef44441a", color: "#ef4444" }}
              >
                {up ? "↑" : "↓"} {Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0)}%
              </span>
              <span className={P.muted}>{t("dashVsPrev")}</span>
            </>
          )}
        </div>
        <Sparkline data={serie} color={accent} />
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const w = 84;
  const h = 30;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * w, h - 2 - ((d - min) / (max - min || 1)) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `sg-${color.slice(1)}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="dash-draw" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3} fill={color} />
    </svg>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const P = usePalette();
  return (
    <span className={`inline-flex items-center gap-1.5 ${P.muted}`}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── Gráfico de barras con tooltip ───────────────────────────
function BarChart({ meses, fmt }: { meses: ResumenMes[]; fmt: (n: number) => string }) {
  const P = usePalette();
  const { t } = useLang();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...meses.map((m) => Math.max(m.ventas, m.ganancia)));
  const H = 200;
  const last = meses.length - 1;

  return (
    <div className="relative">
      {/* Líneas guía */}
      <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: H }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ top: H * f }}>
            <span className="h-px flex-1" style={{ background: P.grid }} />
          </div>
        ))}
      </div>

      <div className="relative flex items-end gap-2 sm:gap-4" style={{ height: H }}>
        {meses.map((m, i) => {
          const active = hover === i;
          return (
            <div
              key={m.key}
              className="relative flex h-full flex-1 cursor-default items-end justify-center gap-1 sm:gap-1.5"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {active && (
                <div className={`absolute inset-y-0 -inset-x-1 rounded-xl ${P.soft}`} />
              )}
              <div
                className="dash-bar relative w-3 rounded-t-md sm:w-5"
                style={{
                  height: Math.max(3, (m.ventas / max) * H),
                  background: "linear-gradient(180deg,#67e8f9,#06b6d4)",
                  opacity: hover === null || active ? 1 : 0.45,
                  animationDelay: `${i * 80}ms`,
                  transition: "opacity .2s",
                }}
              />
              <div
                className="dash-bar relative w-3 rounded-t-md sm:w-5"
                style={{
                  height: Math.max(3, (m.ganancia / max) * H),
                  background: "linear-gradient(180deg,#6ee7b7,#059669)",
                  opacity: hover === null || active ? 1 : 0.45,
                  animationDelay: `${i * 80 + 40}ms`,
                  transition: "opacity .2s",
                }}
              />

              {active && (
                <div
                  className={`absolute bottom-full z-10 mb-2 w-44 rounded-xl px-3 py-2.5 text-xs shadow-xl ${
                    P.isDark ? "border border-white/10 bg-slate-900" : "border border-slate-200 bg-white"
                  } ${i >= last - 1 ? "right-0" : i <= 0 ? "left-0" : "left-1/2 -translate-x-1/2"}`}
                >
                  <div className={`mb-1.5 font-semibold capitalize ${P.title}`}>{m.label}</div>
                  <Row color="#06b6d4" label={t("legendSales")} value={fmt(m.ventas)} />
                  <Row color="#10b981" label={t("legendProfit")} value={fmt(m.ganancia)} />
                  <div className={`mt-1 ${P.muted}`}>{t("dashOrdersN", { n: m.pedidos })}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 sm:gap-4">
        {meses.map((m, i) => (
          <span
            key={m.key}
            className={`flex-1 text-center text-xs capitalize ${i === last ? "font-semibold text-cyan-500" : P.muted}`}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  const P = usePalette();
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className={`inline-flex items-center gap-1.5 ${P.muted}`}>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className={`font-semibold ${P.title}`}>{value}</span>
    </div>
  );
}

// ── Ranking de productos ────────────────────────────────────
function TopProducts({
  items,
  fmt,
}: {
  items: { nombre: string; ganancia: number; cantidad: number }[];
  fmt: (n: number) => string;
}) {
  const P = usePalette();
  const { t } = useLang();
  if (items.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-2 rounded-xl py-10 text-center text-sm ${P.soft} ${P.muted}`}>
        <span className="text-3xl">📈</span>
        {t("noSalesMonth")}
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.ganancia), 1);
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <ul className="space-y-3.5">
      {items.map((it, i) => (
        <li key={it.nombre}>
          <div className="mb-1.5 flex items-center gap-2 text-sm">
            <span className="w-5 text-center">{medal[i] || <span className={`text-xs ${P.muted}`}>{i + 1}</span>}</span>
            <span className={`min-w-0 flex-1 truncate ${P.text}`}>{it.nombre}</span>
            <span className={`text-xs ${P.muted}`}>×{it.cantidad}</span>
            <span className="font-bold text-emerald-500">{fmt(it.ganancia)}</span>
          </div>
          <div className={`ml-7 h-1.5 overflow-hidden rounded-full ${P.soft}`}>
            <div
              className="dash-grow-x h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
              style={{ width: `${(it.ganancia / max) * 100}%`, animationDelay: `${300 + i * 90}ms` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
