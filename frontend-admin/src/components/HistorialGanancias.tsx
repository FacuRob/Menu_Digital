// Historial mensual de ventas, costo y ganancia (solo pedidos entregados).
// Permite elegir el rango de meses y el tipo de entrega, ver un gráfico por
// mes, una tabla ordenable con totales y exportar a CSV. Tocar un mes del
// gráfico o de la tabla muestra el detalle (productos más rentables) de ese mes.

import { useEffect, useState } from "react";
import { useNegocio } from "../context/NegocioContext";
import { useLang, LOCALE } from "../lib/i18n";
import { fmtMoney } from "../lib/money";
import {
  analiticasService,
  type Historial,
  type HistorialMes,
  type TipoEntrega,
} from "../services/api";

// ── Helpers de meses (claves "YYYY-MM") ─────────────────────
const keyDe = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
const hoyKey = () => {
  const n = new Date();
  return keyDe(n.getFullYear(), n.getMonth());
};
const sumarMeses = (key: string, delta: number) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return keyDe(d.getFullYear(), d.getMonth());
};

type Preset = "6" | "12" | "year" | "lastYear" | "custom";

const rangoPreset = (p: Exclude<Preset, "custom">): [string, string] => {
  const hoy = hoyKey();
  const y = new Date().getFullYear();
  if (p === "6") return [sumarMeses(hoy, -5), hoy];
  if (p === "12") return [sumarMeses(hoy, -11), hoy];
  if (p === "year") return [`${y}-01`, hoy];
  return [`${y - 1}-01`, `${y - 1}-12`];
};

type SortKey = "key" | "pedidos" | "ventas" | "costo" | "ganancia" | "margen" | "ticket";

const margen = (m: { ventas: number; ganancia: number }) =>
  m.ventas > 0 ? (m.ganancia / m.ventas) * 100 : 0;
const ticketProm = (m: { ventas: number; pedidos: number }) =>
  m.pedidos > 0 ? m.ventas / m.pedidos : 0;

// Clases sobre los tokens del panel (claro y oscuro salen solos).
function usePalette() {
  return {
    card: "bg-surface border border-line shadow-[var(--shadow-1)]",
    title: "text-fg",
    text: "text-fg-2",
    muted: "text-fg-3",
    soft: "bg-surface-2",
    divider: "border-line",
    field: "bg-surface border border-line-strong text-fg",
    grid: "var(--chart-grid)",
  };
}

export default function HistorialGanancias() {
  const P = usePalette();
  const { t, lang } = useLang();
  const { moneda, negocioId } = useNegocio();
  const fmt = (n: number) => fmtMoney(n, moneda);
  const locale = LOCALE[lang];

  const [preset, setPreset] = useState<Preset>("12");
  const [[desde, hasta], setRango] = useState<[string, string]>(rangoPreset("12"));
  const [tipo, setTipo] = useState<TipoEntrega | "">("");
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "key", asc: false });
  const [mesSel, setMesSel] = useState<string | null>(null);

  // Cada respuesta guarda la consulta que la generó: así "cargando" se deriva
  // comparando con la consulta actual, sin setState dentro de los efectos.
  const consulta = `${negocioId}|${desde}|${hasta}|${tipo}`;
  const [res, setRes] = useState<{ q: string; data: Historial | null; error: boolean } | null>(null);
  const consultaDet = mesSel ? `${negocioId}|${mesSel}|${tipo}` : "";
  const [det, setDet] = useState<{ q: string; data: Historial | null } | null>(null);

  // Datos del rango elegido.
  useEffect(() => {
    let vivo = true;
    analiticasService
      .getHistorial({ desde, hasta, tipo })
      .then((d) => vivo && setRes({ q: consulta, data: d, error: false }))
      .catch(() => vivo && setRes((r) => ({ q: consulta, data: r?.data ?? null, error: true })));
    return () => {
      vivo = false;
    };
  }, [consulta, desde, hasta, tipo]);

  // Detalle (top productos) del mes seleccionado.
  useEffect(() => {
    if (!mesSel) return;
    let vivo = true;
    analiticasService
      .getHistorial({ desde: mesSel, hasta: mesSel, tipo })
      .then((d) => vivo && setDet({ q: consultaDet, data: d }))
      .catch(() => vivo && setDet({ q: consultaDet, data: null }));
    return () => {
      vivo = false;
    };
  }, [consultaDet, mesSel, tipo]);

  const data = res?.data ?? null;
  const loading = res?.q !== consulta;
  const error = !loading && !!res?.error;
  const detalle = det?.q === consultaDet ? det.data : null;

  const nombreMes = (key: string, largo = true) => {
    const [y, m] = key.split("-").map(Number);
    const txt = new Date(y, m - 1, 1).toLocaleDateString(locale, {
      month: largo ? "long" : "short",
      year: "numeric",
    });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  };

  const elegirPreset = (p: Preset) => {
    setPreset(p);
    setMesSel(null);
    if (p !== "custom") setRango(rangoPreset(p));
  };

  const cambiarRango = (nuevoDesde: string, nuevoHasta: string) => {
    setPreset("custom");
    setMesSel(null);
    setRango(nuevoDesde > nuevoHasta ? [nuevoHasta, nuevoDesde] : [nuevoDesde, nuevoHasta]);
  };

  const meses = data?.meses || [];
  const totales = data?.totales || { ventas: 0, costo: 0, ganancia: 0, pedidos: 0 };
  const conVentas = meses.filter((m) => m.pedidos > 0);
  const mejor = conVentas.reduce<HistorialMes | null>(
    (a, m) => (!a || m.ganancia > a.ganancia ? m : a),
    null,
  );
  const promedio = meses.length ? totales.ganancia / meses.length : 0;

  const filas = (() => {
    const val = (m: HistorialMes): number | string => {
      switch (sort.key) {
        case "key": return m.key;
        case "margen": return margen(m);
        case "ticket": return ticketProm(m);
        default: return m[sort.key];
      }
    };
    return [...meses].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.asc ? c : -c;
    });
  })();

  // Variación de ganancia contra el mes anterior (en orden cronológico).
  const variacion = (() => {
    const out: Record<string, number | null> = {};
    meses.forEach((m, i) => {
      const prev = meses[i - 1];
      out[m.key] = prev && prev.ganancia !== 0
        ? ((m.ganancia - prev.ganancia) / Math.abs(prev.ganancia)) * 100
        : null;
    });
    return out;
  })();

  const ordenar = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: false }));

  const exportarCSV = () => {
    const num = (n: number) => n.toFixed(2);
    const cab = [
      t("histMonth"), t("histOrders"), t("histSales"), t("histCost"),
      t("histProfit"), t("histMargin"), t("histAvgTicket"),
    ];
    const lineas = [...meses].map((m) => [
      m.key, m.pedidos, num(m.ventas), num(m.costo), num(m.ganancia),
      num(margen(m)), num(ticketProm(m)),
    ]);
    lineas.push([
      t("histTotal"), totales.pedidos, num(totales.ventas), num(totales.costo),
      num(totales.ganancia), num(margen(totales)), num(ticketProm(totales)),
    ]);
    const csv = [cab, ...lineas]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ganancias_${desde}_a_${hasta}${tipo ? `_${tipo}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 8 }, (_, i) => anioActual - i);

  const presets: { id: Preset; label: string }[] = [
    { id: "6", label: t("histPreset6") },
    { id: "12", label: t("histPreset12") },
    { id: "year", label: t("histPresetYear") },
    { id: "lastYear", label: t("histPresetLastYear") },
    { id: "custom", label: t("histPresetCustom") },
  ];

  const tipos: { id: TipoEntrega | ""; label: string }[] = [
    { id: "", label: t("histTypeAll") },
    { id: "mesa", label: t("pedTable") },
    { id: "retiro", label: t("pedPickupInLocal") },
    { id: "delivery", label: t("pedDelivery") },
  ];

  const selectCls = `h-9 cursor-pointer rounded-lg px-2.5 text-sm outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--focus)_30%,transparent)] ${P.field}`;

  const monthPicker = (label: string, value: string, onChange: (v: string) => void) => {
    const [y, m] = value.split("-").map(Number);
    return (
      <label className="flex flex-col gap-1">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${P.muted}`}>{label}</span>
        <span className="flex gap-1.5">
          <select className={selectCls} value={m - 1} onChange={(e) => onChange(keyDe(y, Number(e.target.value)))}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i} className="capitalize">
                {new Date(2000, i, 1).toLocaleDateString(locale, { month: "long" })}
              </option>
            ))}
          </select>
          <select className={selectCls} value={y} onChange={(e) => onChange(keyDe(Number(e.target.value), m - 1))}>
            {(anios.includes(y) ? anios : [y, ...anios]).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </span>
      </label>
    );
  };

  const sortTh = (k: SortKey, children: string, right = true) => (
    <th key={k} className={`whitespace-nowrap px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => ordenar(k)}
        className={`inline-flex cursor-pointer items-center gap-1 hover:text-fg ${sort.key === k ? "text-fg font-bold" : ""}`}
      >
        {children}
        <span className="text-[10px]">{sort.key === k ? (sort.asc ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  const maxBar = Math.max(1, ...meses.map((m) => Math.max(m.ventas, Math.abs(m.ganancia))));
  const H = 170;

  return (
    <section className={`dash-in rounded-2xl p-5 ${P.card}`}>
      {/* Encabezado + exportar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={`text-[15px] font-semibold ${P.title}`}><span aria-hidden>📅</span> {t("histTitle")}</h3>
          <p className={`mt-0.5 text-xs ${P.muted}`}>{t("histDesc")}</p>
        </div>
        <button
          type="button"
          onClick={exportarCSV}
          disabled={!data || loading}
          className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            "bg-surface-3 text-fg hover:bg-surface-2"
          }`}
        >
          ⬇ {t("histExport")}
        </button>
      </div>

      {/* Filtros */}
      <div className={`mb-5 flex flex-col gap-3 rounded-xl p-3 ${P.soft}`}>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => elegirPreset(p.id)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                preset === p.id
                  ? "bg-surface-inv text-fg-inv"
                  : "bg-surface text-fg-2 ring-1 ring-[var(--line-strong)] hover:bg-surface-2"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {monthPicker(t("histFrom"), desde, (v) => cambiarRango(v, hasta))}
          {monthPicker(t("histTo"), hasta, (v) => cambiarRango(desde, v))}
          <label className="flex flex-col gap-1">
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${P.muted}`}>{t("histType")}</span>
            <select className={selectCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoEntrega | "")}>
              {tipos.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <div className={`rounded-xl py-10 text-center text-sm ${P.soft} text-err`}>{t("histError")}</div>
      ) : loading && !data ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((k) => <div key={k} className={`h-20 animate-pulse rounded-xl ${P.soft}`} />)}
          </div>
          <div className={`h-48 animate-pulse rounded-xl ${P.soft}`} />
        </div>
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* Totales del período */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label={t("histProfitTotal")} value={fmt(totales.ganancia)} accent="var(--chart-3)" strong />
            <Tile label={t("histSales")} value={fmt(totales.ventas)} accent="var(--chart-1)" />
            <Tile label={t("histCost")} value={fmt(totales.costo)} accent="var(--chart-4)" />
            <Tile label={t("histMargin")} value={`${margen(totales).toFixed(1)}%`} accent="var(--chart-5)" />
            <Tile label={t("histOrders")} value={String(totales.pedidos)} accent="var(--fg-3)" />
            <Tile label={t("histAvgTicket")} value={fmt(ticketProm(totales))} accent="var(--fg-3)" />
            <Tile label={t("histAvgMonthly")} value={fmt(promedio)} accent="var(--fg-3)" />
            <Tile
              label={t("histBestMonth")}
              value={mejor ? nombreMes(mejor.key) : "—"}
              sub={mejor ? fmt(mejor.ganancia) : undefined}
              accent="var(--chart-3)"
            />
          </div>

          {conVentas.length === 0 ? (
            <div className={`flex flex-col items-center gap-2 rounded-xl py-10 text-center text-sm ${P.soft} ${P.muted}`}>
              <span className="text-3xl" aria-hidden>📭</span>
              {t("histNoData")}
            </div>
          ) : (
            <>
              {/* Gráfico por mes */}
              <div className="overflow-x-auto pb-1">
                <div style={{ minWidth: Math.max(meses.length * 44, 280) }}>
                  <div className="relative flex items-end gap-1.5 sm:gap-3" style={{ height: H }}>
                    <div className="pointer-events-none absolute inset-0">
                      {[0, 0.5, 1].map((f) => (
                        <div key={f} className="absolute inset-x-0 h-px" style={{ top: H * f, background: P.grid }} />
                      ))}
                    </div>
                    {meses.map((m) => {
                      const activo = mesSel === m.key;
                      const atenuado = mesSel !== null && !activo;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          title={`${nombreMes(m.key)} · ${t("histProfit")}: ${fmt(m.ganancia)} · ${t("histSales")}: ${fmt(m.ventas)}`}
                          onClick={() => setMesSel(activo ? null : m.key)}
                          className={`relative flex h-full flex-1 cursor-pointer items-end justify-center gap-0.5 rounded-lg transition-opacity sm:gap-1 ${
                            activo ? P.soft : ""
                          }`}
                          style={{ opacity: atenuado ? 0.4 : 1 }}
                        >
                          <span
                            className="dash-bar w-2.5 rounded-t sm:w-4"
                            style={{ height: Math.max(2, (m.ventas / maxBar) * (H - 6)), background: "var(--chart-1)" }}
                          />
                          <span
                            className="dash-bar w-2.5 rounded-t sm:w-4"
                            style={{
                              height: Math.max(2, (Math.abs(m.ganancia) / maxBar) * (H - 6)),
                              background: m.ganancia < 0 ? "var(--err)" : "var(--chart-3)",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex gap-1.5 sm:gap-3">
                    {meses.map((m) => (
                      <span
                        key={m.key}
                        className={`flex-1 text-center text-[11px] leading-tight capitalize ${mesSel === m.key ? "font-bold text-fg" : P.muted}`}
                      >
                        {m.label}
                        <span className="block text-[10px] opacity-70">{String(m.anio).slice(2)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className={`-mt-2 flex flex-wrap gap-4 text-xs ${P.muted}`}>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1)]" />{t("histSales")}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-3)]" />{t("histProfit")}</span>
                <span>{t("histClickHint")}</span>
              </div>

              {/* Detalle del mes elegido */}
              {mesSel && (
                <div className={`rounded-xl border p-4 border-line bg-surface-2`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className={`text-sm font-semibold ${P.title}`}>
                      {t("histDetailOf", { mes: nombreMes(mesSel) })}
                    </h4>
                    <button type="button" onClick={() => setMesSel(null)} className={`cursor-pointer text-xs font-semibold ${P.muted} hover:text-fg`}>
                      ✕ {t("histClose")}
                    </button>
                  </div>
                  {!detalle ? (
                    <div className={`h-16 animate-pulse rounded-lg ${P.soft}`} />
                  ) : (
                    <>
                      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Mini label={t("histProfit")} value={fmt(detalle.totales.ganancia)} color="var(--ok)" />
                        <Mini label={t("histSales")} value={fmt(detalle.totales.ventas)} />
                        <Mini label={t("histCost")} value={fmt(detalle.totales.costo)} />
                        <Mini label={t("histOrders")} value={String(detalle.totales.pedidos)} />
                      </div>
                      <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${P.muted}`}>{t("histTopProducts")}</div>
                      {detalle.top_productos.length === 0 ? (
                        <div className={`text-sm ${P.muted}`}>{t("histNoData")}</div>
                      ) : (
                        <ul className={`divide-y text-sm ${P.divider}`}>
                          {detalle.top_productos.map((p, i) => (
                            <li key={p.nombre} className="flex items-center gap-2 py-1.5">
                              <span className={`w-5 text-xs ${P.muted}`}>{i + 1}</span>
                              <span className={`min-w-0 flex-1 truncate ${P.text}`}>{p.nombre}</span>
                              <span className={`text-xs ${P.muted}`}>×{p.cantidad}</span>
                              <span className={`hidden w-28 text-right text-xs sm:inline ${P.muted}`}>{fmt(p.ventas)}</span>
                              <span className="w-28 text-right font-bold text-ok">{fmt(p.ganancia)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tabla por mes */}
              <div className={`overflow-x-auto rounded-xl border ${P.divider}`}>
                <table className="w-full min-w-[720px] text-sm">
                  <thead className={`text-xs ${P.muted} ${P.soft}`}>
                    <tr>
                      {sortTh("key", t("histMonth"), false)}
                      {sortTh("pedidos", t("histOrders"))}
                      {sortTh("ventas", t("histSales"))}
                      {sortTh("costo", t("histCost"))}
                      {sortTh("ganancia", t("histProfit"))}
                      {sortTh("margen", t("histMargin"))}
                      {sortTh("ticket", t("histAvgTicket"))}
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{t("histVsPrev")}</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${P.divider}`}>
                    {filas.map((m) => {
                      const v = variacion[m.key];
                      const activo = mesSel === m.key;
                      return (
                        <tr
                          key={m.key}
                          onClick={() => setMesSel(activo ? null : m.key)}
                          className={`cursor-pointer transition-colors ${
                            activo ? "bg-accent-soft" : "hover:bg-surface-2"
                          } ${m.pedidos === 0 ? "opacity-50" : ""}`}
                        >
                          <td className={`whitespace-nowrap px-3 py-2.5 font-medium ${P.title}`}>
                            {nombreMes(m.key)}
                            {mejor?.key === m.key && <span className="ml-1.5" title={t("histBestMonth")}><span aria-hidden>🏆</span><span className="sr-only">{t("histBestMonth")}</span></span>}
                          </td>
                          <td className={`px-3 py-2.5 text-right ${P.text}`}>{m.pedidos}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.text}`}>{fmt(m.ventas)}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.text}`}>{fmt(m.costo)}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right font-bold ${m.ganancia < 0 ? "text-err" : "text-ok"}`}>
                            {fmt(m.ganancia)}
                          </td>
                          <td className={`px-3 py-2.5 text-right ${P.text}`}>{m.pedidos ? `${margen(m).toFixed(1)}%` : "—"}</td>
                          <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.text}`}>{m.pedidos ? fmt(ticketProm(m)) : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-xs font-bold">
                            {v === null ? (
                              <span className={P.muted}>—</span>
                            ) : (
                              <span style={{ color: v >= 0 ? "var(--ok)" : "var(--err)" }}>
                                {v >= 0 ? "↑" : "↓"} {Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className={`border-t-2 font-bold ${P.divider} ${P.soft}`}>
                    <tr>
                      <td className={`px-3 py-2.5 ${P.title}`}>{t("histTotal")}</td>
                      <td className={`px-3 py-2.5 text-right ${P.title}`}>{totales.pedidos}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.title}`}>{fmt(totales.ventas)}</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.title}`}>{fmt(totales.costo)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-ok">{fmt(totales.ganancia)}</td>
                      <td className={`px-3 py-2.5 text-right ${P.title}`}>{margen(totales).toFixed(1)}%</td>
                      <td className={`whitespace-nowrap px-3 py-2.5 text-right ${P.title}`}>{fmt(ticketProm(totales))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Tile({ label, value, sub, accent, strong }: { label: string; value: string; sub?: string; accent: string; strong?: boolean }) {
  const P = usePalette();
  return (
    <div
      className={`relative overflow-hidden rounded-xl px-3.5 py-3 ${P.soft} ${strong ? "col-span-2 lg:col-span-1" : ""}`}
      style={strong ? { boxShadow: `inset 0 0 0 1px ${accent}55` } : undefined}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} />
      <div className={`text-[11px] ${P.muted}`}>{label}</div>
      <div className={`mt-0.5 truncate font-extrabold ${strong ? "text-xl" : "text-base"}`} style={strong ? { color: accent } : undefined}>
        <span className={strong ? "" : P.title}>{value}</span>
      </div>
      {sub && <div className="text-xs font-semibold text-ok">{sub}</div>}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  const P = usePalette();
  return (
    <div className={`rounded-lg px-3 py-2 bg-surface`}>
      <div className={`text-[11px] ${P.muted}`}>{label}</div>
      <div className={`truncate text-sm font-bold ${color ? "" : P.title}`} style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
