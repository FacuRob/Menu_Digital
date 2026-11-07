import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Gráficos del panel en SVG propio (sin librerías, ~pocos KB).
// Colores: --chart-* de tokens.css (cambian solos con el tema).
// Accesibles: resumen en texto para lectores, navegación con flechas en el
// gráfico de líneas y los datos en una tabla desplegable.

// Ancho real del contenedor (el SVG se dibuja a ese ancho, sin estirarse).
function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAncho(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho] as const;
}

// Tope "redondo" para el eje: 1, 2, 2.5, 5 × 10^n.
function topeLindo(max: number) {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= max) return m * exp;
  return 10 * exp;
}

const compacto = (locale: string) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

// Tabla con los mismos datos del gráfico (para lectores y para copiar).
export function DatosTabla({ resumen, cols, filas }: { resumen: string; cols: string[]; filas: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex min-h-9 cursor-pointer items-center font-semibold text-fg-2 hover:text-fg">{resumen}</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-[var(--r-sm)] border border-line">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-surface-2">
            <tr>
              {cols.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className="border-t border-line">
                {f.map((v, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-3 py-2 font-medium text-fg">
                      {v}
                    </th>
                  ) : (
                    <td key={j} className="pn-num px-3 py-2 text-fg-2">
                      {v}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Leyenda({ items }: { items: { color: string; label: string; dashed?: boolean; cuadro?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-3">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-2">
          {it.cuadro ? (
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: it.color }} />
          ) : (
            <span
              aria-hidden
              className="inline-block h-0 w-4"
              style={{ borderTop: `3px ${it.dashed ? "dashed" : "solid"} ${it.color}` }}
            />
          )}
          {it.label}
        </li>
      ))}
    </ul>
  );
}

// ── Línea con área: serie diaria contra el período anterior ──
export function GraficoLinea({
  puntos,
  formato,
  locale,
  etiqueta,
  color = "var(--chart-1)",
  alto = 230,
  ayuda = "",
  antes = "",
}: {
  puntos: { x: string; y: number; anterior?: number }[];
  formato: (n: number) => string;
  locale: string;
  etiqueta: string;
  color?: string;
  alto?: number;
  ayuda?: string;
  antes?: string;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);
  const gid = useId();
  const n = puntos.length;
  const izq = 52;
  const der = 8;
  const arr = 10;
  const abj = 26;
  const w = Math.max(ancho, 240);
  const h = alto;
  const max = topeLindo(Math.max(...puntos.map((p) => Math.max(p.y, p.anterior ?? 0)), 0));
  const X = (i: number) => izq + (n <= 1 ? 0 : (i / (n - 1)) * (w - izq - der));
  const Y = (v: number) => arr + (1 - v / max) * (h - arr - abj);
  const linea = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const actual = linea(puntos.map((p) => p.y));
  const conAnterior = puntos.some((p) => p.anterior !== undefined);
  const anterior = conAnterior ? linea(puntos.map((p) => p.anterior ?? 0)) : "";
  const area = n ? `${actual} L${X(n - 1).toFixed(1)},${Y(0)} L${X(0).toFixed(1)},${Y(0)} Z` : "";
  const fmtEje = compacto(locale);
  const fecha = (iso: string, larga = false) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(locale, larga ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
  // ~6 etiquetas en el eje X, según el ancho.
  const cadaX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - izq) / 70))));

  const mover = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || n === 0) return;
    const i = Math.round(((clientX - r.left - izq) / (w - izq - der)) * (n - 1));
    setActivo(Math.min(n - 1, Math.max(0, i)));
  };
  const teclado = (e: React.KeyboardEvent) => {
    if (!n) return;
    const pasos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n };
    if (!(e.key in pasos)) return;
    e.preventDefault();
    setActivo((a) => Math.min(n - 1, Math.max(0, (a ?? (pasos[e.key] > 0 ? -1 : n)) + pasos[e.key])));
  };
  const p = activo !== null ? puntos[activo] : null;

  return (
    <div
      ref={ref}
      className="relative rounded-[var(--r-sm)] outline-offset-4"
      tabIndex={0}
      role="group"
      aria-label={ayuda ? `${etiqueta}. ${ayuda}` : etiqueta}
      onKeyDown={teclado}
      onBlur={() => setActivo(null)}
      onPointerMove={(e) => mover(e.clientX)}
      onPointerDown={(e) => mover(e.clientX)}
      onPointerLeave={(e) => e.pointerType !== "touch" && setActivo(null)}
    >
      <span className="sr-only" aria-live="polite">
        {p && activo !== null ? `${fecha(p.x, true)}: ${formato(p.y)}` : ""}
      </span>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={etiqueta} className="block touch-pan-y">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={izq} x2={w - der} y1={Y(max * f)} y2={Y(max * f)} style={{ stroke: "var(--chart-grid)" }} />
            <text x={izq - 8} y={Y(max * f) + 4} textAnchor="end" className="pn-num" style={{ fill: "var(--chart-axis)", fontSize: 12 }}>
              {fmtEje.format(max * f)}
            </text>
          </g>
        ))}
        {puntos.map((pt, i) =>
          (i % cadaX === 0 && n - 1 - i >= cadaX / 2) || i === n - 1 ? (
            <text key={pt.x} x={X(i)} y={h - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} style={{ fill: "var(--chart-axis)", fontSize: 12 }}>
              {fecha(pt.x)}
            </text>
          ) : null,
        )}
        {conAnterior && <path d={anterior} fill="none" style={{ stroke: "var(--fg-3)", strokeWidth: 1.5, strokeDasharray: "4 4", opacity: 0.7 }} />}
        <path d={area} style={{ fill: `url(#${gid})` }} />
        <path d={actual} fill="none" style={{ stroke: color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }} />
        {p && activo !== null && (
          <g>
            <line x1={X(activo)} x2={X(activo)} y1={arr} y2={h - abj} style={{ stroke: "var(--line-strong)" }} />
            <circle cx={X(activo)} cy={Y(p.y)} r={5} style={{ fill: color, stroke: "var(--surface)", strokeWidth: 2 }} />
          </g>
        )}
      </svg>
      {p && activo !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]"
          style={{ left: Math.min(Math.max(X(activo) - 72, 0), w - 150) }}
        >
          <div className="font-semibold text-fg first-letter:uppercase">{fecha(p.x, true)}</div>
          <div className="pn-num text-fg-2">{formato(p.y)}</div>
          {p.anterior !== undefined && <div className="pn-num text-xs text-fg-3">{antes}: {formato(p.anterior)}</div>}
        </div>
      )}
    </div>
  );
}

// ── Barras agrupadas por mes (ventas y ganancia) ──
export function GraficoBarras({
  grupos,
  series,
  formato,
  locale,
  etiqueta,
  alto = 220,
}: {
  grupos: { label: string; valores: number[] }[];
  series: { label: string; color: string }[];
  formato: (n: number) => string;
  locale: string;
  etiqueta: string;
  alto?: number;
}) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);
  const izq = 52;
  const abj = 26;
  const arr = 10;
  const w = Math.max(ancho, 240);
  const h = alto;
  const max = topeLindo(Math.max(0, ...grupos.flatMap((g) => g.valores)));
  const Y = (v: number) => arr + (1 - Math.max(0, v) / max) * (h - arr - abj);
  const paso = (w - izq) / Math.max(1, grupos.length);
  const anchoBarra = Math.min(22, (paso * 0.7) / series.length);
  const fmtEje = compacto(locale);
  const g = activo !== null ? grupos[activo] : null;

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setActivo(null)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={etiqueta} className="block">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={izq} x2={w} y1={Y(max * f)} y2={Y(max * f)} style={{ stroke: "var(--chart-grid)" }} />
            <text x={izq - 8} y={Y(max * f) + 4} textAnchor="end" className="pn-num" style={{ fill: "var(--chart-axis)", fontSize: 12 }}>
              {fmtEje.format(max * f)}
            </text>
          </g>
        ))}
        {grupos.map((gr, i) => {
          const cx = izq + paso * i + paso / 2;
          const x0 = cx - (anchoBarra * series.length) / 2;
          return (
            <g key={gr.label + i} onPointerEnter={() => setActivo(i)}>
              <rect x={izq + paso * i} y={arr} width={paso} height={h - arr - abj} fill="transparent" />
              {activo === i && <rect x={izq + paso * i + 2} y={arr} width={paso - 4} height={h - arr - abj} rx={8} style={{ fill: "var(--surface-2)" }} />}
              {gr.valores.map((v, j) => (
                <rect
                  key={j}
                  x={x0 + j * anchoBarra}
                  y={Y(v)}
                  width={anchoBarra - 3}
                  height={Math.max(v > 0 ? 2 : 0, Y(0) - Y(v))}
                  rx={4}
                  style={{ fill: series[j].color }}
                />
              ))}
              <text x={cx} y={h - 6} textAnchor="middle" style={{ fill: "var(--chart-axis)", fontSize: 12 }} className="capitalize">
                {gr.label}
              </text>
            </g>
          );
        })}
      </svg>
      {g && activo !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2 text-sm shadow-[var(--shadow-pop)]"
          style={{ left: Math.min(Math.max(izq + paso * activo + paso / 2 - 70, 0), w - 160) }}
        >
          <div className="font-semibold capitalize text-fg">{g.label}</div>
          {series.map((s, j) => (
            <div key={s.label} className="pn-num flex items-center gap-2 text-fg-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}: {formato(g.valores[j])}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reparto en una barra al 100 % (ej.: mesa / delivery / retiro) ──
export function Reparto({
  partes,
  formato,
  etiqueta,
}: {
  partes: { label: string; valor: number; color: string; detalle?: string }[];
  formato?: (n: number) => string;
  etiqueta: string;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const pct = (v: number) => (total ? (v / total) * 100 : 0);
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-3" role="img" aria-label={etiqueta}>
        {partes.map((p) =>
          p.valor > 0 ? (
            <span key={p.label} className="h-full border-r-2 border-surface last:border-r-0" style={{ width: `${pct(p.valor)}%`, background: p.color }} />
          ) : null,
        )}
      </div>
      <ul className="mt-5 space-y-3">
        {partes.map((p) => (
          <li key={p.label} className="flex items-center gap-3">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg">{p.label}</span>
              {p.detalle && <span className="block text-sm text-fg-3">{p.detalle}</span>}
            </span>
            <span className="pn-num text-right">
              <span className="block font-bold text-fg">{formato ? formato(p.valor) : p.valor}</span>
              <span className="block text-sm text-fg-3">{pct(p.valor).toFixed(0)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Ranking en barras horizontales ──
export function Ranking({ items, formato }: { items: { label: string; valor: number }[]; formato: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  return (
    <ol className="space-y-3.5">
      {items.map((it, i) => (
        <li key={it.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-fg">
              <span className="pn-num mr-2 text-fg-3">{i + 1}.</span>
              {it.label}
            </span>
            <span className="pn-num shrink-0 font-semibold text-fg-2">{formato(it.valor)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${(it.valor / max) * 100}%`, background: i === 0 ? "var(--chart-2)" : "var(--chart-1)" }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Mapa de calor: día de la semana × hora ──
export function MapaCalor({
  matriz,
  dias,
  etiqueta,
  unidad,
}: {
  matriz: number[][]; // [día (lunes = 0)][hora 0-23]
  dias: string[]; // nombres cortos de lunes a domingo
  etiqueta: string;
  unidad: (n: number) => string;
}) {
  const max = Math.max(1, ...matriz.flat());
  // Sólo las horas con algún pedido (más una a cada lado), mínimo 8 a 24.
  const conDatos = matriz[0].map((_, h) => matriz.some((d) => d[h] > 0));
  let desde = conDatos.indexOf(true);
  let hasta = conDatos.lastIndexOf(true);
  if (desde === -1) {
    desde = 8;
    hasta = 23;
  }
  desde = Math.max(0, Math.min(desde - 1, 8));
  hasta = Math.min(23, Math.max(hasta + 1, 23));
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  return (
    <div role="region" aria-label={etiqueta} tabIndex={0} className="overflow-x-auto rounded-[var(--r-sm)]">
      <div
        className="grid min-w-[520px] gap-1"
        style={{ gridTemplateColumns: `2.75rem repeat(${horas.length}, minmax(0, 1fr))` }}
      >
        <span />
        {horas.map((h) => (
          <span key={h} className="pn-num text-center text-xs text-fg-3">
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
        {matriz.map((fila, d) => (
          <div key={d} className="contents">
            <span className="self-center text-xs font-semibold capitalize text-fg-3">{dias[d]}</span>
            {horas.map((h) => {
              const v = fila[h];
              const f = v / max;
              return (
                <span
                  key={h}
                  title={`${dias[d]} ${h}:00 · ${unidad(v)}`}
                  className="aspect-square rounded-[5px]"
                  style={{
                    background: v
                      ? `color-mix(in srgb, var(--chart-2) ${Math.round(30 + f * 70)}%, var(--surface-2))`
                      : "var(--surface-2)",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
