import { useId, useRef, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import type { MesaPlano, PisoPlano, ZonaPlano } from "../services/api";
import { COLOR_ESTADO, nombreMesa, type EstadoMesa } from "../lib/planoMesas";

// Dibujo de un piso del local en SVG (medidas en metros).
//   - Vista (editable = false): cada mesa es un botón con su color de estado.
//   - Edición: se arrastran mesas y zonas, se agrandan desde la esquina y se
//     mueven con las flechas (Shift = de a 1 m). Suprimir borra lo elegido.

export type Seleccion = { tipo: "mesa" | "zona"; id: string } | null;

const PASO = 0.25;
const snap = (v: number) => Math.round(v / PASO) * PASO;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Props {
  piso: PisoPlano;
  editable?: boolean;
  // Vista
  estadoDe?: (mesa: string) => EstadoMesa;
  detalleDe?: (mesa: string) => string | undefined;
  etiquetaDe?: (mesa: string) => string;
  onMesa?: (mesa: string) => void;
  // Edición
  sel?: Seleccion;
  onSel?: (s: Seleccion) => void;
  onCambio?: (piso: PisoPlano) => void;
  onBorrar?: () => void;
  // Se soltó una mesa después de arrastrarla (para ver si quedó pegada a otra).
  onSoltarMesa?: (mesa: string) => void;
  ariaLabel: string;
}

type Arrastre = {
  sel: NonNullable<Seleccion>;
  modo: "mover" | "tamano";
  x0: number;
  y0: number;
  orig: { x: number; y: number; w: number; h: number };
  movida: boolean;
};

export default function PlanoMesas({
  piso,
  editable = false,
  estadoDe,
  detalleDe,
  etiquetaDe,
  onMesa,
  sel = null,
  onSel,
  onCambio,
  onBorrar,
  onSoltarMesa,
  ariaLabel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const gridId = `grilla${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { ancho, alto } = piso;

  // Punto del puntero en metros del plano.
  const punto = (e: { clientX: number; clientY: number }) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const buscar = (s: NonNullable<Seleccion>) =>
    s.tipo === "mesa" ? piso.mesas.find((m) => m.mesa === s.id) : piso.zonas.find((z) => z.id === s.id);

  // Aplica nuevas medidas a lo elegido, dentro del piso.
  const aplicar = (s: NonNullable<Seleccion>, r: { x: number; y: number; w: number; h: number }) => {
    const min = s.tipo === "mesa" ? 0.4 : 0.5;
    const w = clamp(r.w, min, ancho);
    const h = clamp(r.h, min, alto);
    const x = clamp(r.x, 0, ancho - w);
    const y = clamp(r.y, 0, alto - h);
    if (s.tipo === "mesa") {
      onCambio?.({ ...piso, mesas: piso.mesas.map((m) => (m.mesa === s.id ? { ...m, x, y, w, h } : m)) });
    } else {
      onCambio?.({ ...piso, zonas: piso.zonas.map((z) => (z.id === s.id ? { ...z, x, y, w, h } : z)) });
    }
  };

  const empezar = (e: RPointerEvent, s: NonNullable<Seleccion>, modo: Arrastre["modo"]) => {
    if (!editable) return;
    e.stopPropagation();
    const it = buscar(s);
    if (!it) return;
    onSel?.(s);
    const p = punto(e);
    arrastre.current = { sel: s, modo, x0: p.x, y0: p.y, orig: { x: it.x, y: it.y, w: it.w, h: it.h }, movida: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const mover = (e: RPointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    const p = punto(e);
    const dx = p.x - a.x0;
    const dy = p.y - a.y0;
    if (Math.abs(dx) >= PASO / 2 || Math.abs(dy) >= PASO / 2) a.movida = true;
    if (a.modo === "mover") aplicar(a.sel, { ...a.orig, x: snap(a.orig.x + dx), y: snap(a.orig.y + dy) });
    else aplicar(a.sel, { ...a.orig, w: snap(a.orig.w + dx), h: snap(a.orig.h + dy) });
  };

  const soltar = (e: RPointerEvent) => {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) svgRef.current.releasePointerCapture(e.pointerId);
    if (a.movida && a.modo === "mover" && a.sel.tipo === "mesa") onSoltarMesa?.(a.sel.id);
  };

  const teclaEdicion = (e: KeyboardEvent, s: NonNullable<Seleccion>) => {
    const it = buscar(s);
    if (!it) return;
    const d = e.shiftKey ? 1 : PASO;
    const mov: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    if (mov[e.key]) {
      e.preventDefault();
      onSel?.(s);
      aplicar(s, { ...it, x: it.x + mov[e.key][0], y: it.y + mov[e.key][1] });
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      onBorrar?.();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSel?.(s);
    }
  };

  const elegida = (tipo: "mesa" | "zona", id: string) => sel?.tipo === tipo && sel.id === id;

  // Manija para agrandar (esquina de abajo a la derecha de lo elegido).
  const manija = (s: NonNullable<Seleccion>, it: { x: number; y: number; w: number; h: number }) =>
    editable && elegida(s.tipo, s.id) ? (
      <rect
        x={it.x + it.w - 0.2}
        y={it.y + it.h - 0.2}
        width={0.4}
        height={0.4}
        rx={0.06}
        fill="var(--surface)"
        stroke="var(--focus)"
        strokeWidth={0.06}
        style={{ cursor: "nwse-resize" }}
        onPointerDown={(e) => empezar(e, s, "tamano")}
      />
    ) : null;

  const zona = (z: ZonaPlano) => {
    const ext = z.tipo === "exterior";
    const s = { tipo: "zona" as const, id: z.id };
    const forma = {
      fill: ext ? "color-mix(in srgb, var(--ok) 10%, transparent)" : "color-mix(in srgb, var(--fg) 4%, transparent)",
      stroke: elegida("zona", z.id) ? "var(--focus)" : ext ? "var(--ok)" : "var(--line-strong)",
      strokeWidth: elegida("zona", z.id) ? 0.07 : 0.05,
      strokeDasharray: ext ? "0.25 0.15" : undefined,
    };
    return (
      <g
        key={z.id}
        className={editable ? "pl-item" : undefined}
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : undefined}
        aria-label={editable ? `${z.nombre || (ext ? "Exterior" : "Interior")}` : undefined}
        aria-pressed={editable ? elegida("zona", z.id) : undefined}
        style={{ cursor: editable ? "move" : "default" }}
        onPointerDown={(e) => empezar(e, s, "mover")}
        onKeyDown={editable ? (e) => teclaEdicion(e, s) : undefined}
      >
        {z.forma === "circulo" ? (
          <ellipse className="pl-forma" cx={z.x + z.w / 2} cy={z.y + z.h / 2} rx={z.w / 2} ry={z.h / 2} {...forma} />
        ) : (
          <rect className="pl-forma" x={z.x} y={z.y} width={z.w} height={z.h} rx={0.12} {...forma} />
        )}
        {z.nombre && (
          <text
            x={z.forma === "circulo" ? z.x + z.w / 2 : z.x + 0.25}
            y={z.forma === "circulo" ? z.y + 0.55 : z.y + 0.5}
            textAnchor={z.forma === "circulo" ? "middle" : "start"}
            fontSize={0.38}
            fontWeight={600}
            fill={ext ? "var(--ok)" : "var(--fg-3)"}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {z.nombre}
          </text>
        )}
        {manija(s, z)}
      </g>
    );
  };

  const mesa = (m: MesaPlano) => {
    const estado = estadoDe?.(m.mesa);
    const c = estado ? COLOR_ESTADO[estado] : { fill: "var(--surface-3)", stroke: "var(--fg-3)", text: "var(--fg)" };
    const s = { tipo: "mesa" as const, id: m.mesa };
    const lado = Math.min(m.w, m.h);
    const nombre = nombreMesa(m);
    const detalle = !editable ? detalleDe?.(m.mesa) : undefined;
    const cx = m.x + m.w / 2;
    const cy = m.y + m.h / 2;
    const forma = {
      fill: c.fill,
      stroke: elegida("mesa", m.mesa) ? "var(--focus)" : c.stroke,
      strokeWidth: elegida("mesa", m.mesa) ? 0.09 : 0.06,
    };
    const accion = () => (editable ? onSel?.(s) : onMesa?.(m.mesa));
    return (
      <g
        key={m.mesa}
        className="pl-item"
        role="button"
        tabIndex={0}
        aria-label={etiquetaDe?.(m.mesa) ?? `Mesa ${nombre}`}
        aria-pressed={editable ? elegida("mesa", m.mesa) : undefined}
        style={{ cursor: editable ? "move" : "pointer" }}
        onPointerDown={(e) => empezar(e, s, "mover")}
        onClick={editable ? undefined : accion}
        onKeyDown={
          editable
            ? (e) => teclaEdicion(e, s)
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  accion();
                }
              }
        }
      >
        {m.forma === "redonda" ? (
          <ellipse className="pl-forma" cx={cx} cy={cy} rx={m.w / 2} ry={m.h / 2} {...forma} />
        ) : (
          <rect className="pl-forma" x={m.x} y={m.y} width={m.w} height={m.h} rx={0.14} {...forma} />
        )}
        <text
          x={cx}
          y={detalle ? cy - lado * 0.04 : cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(lado * (detalle ? 0.36 : 0.42), (m.w * 0.85) / (nombre.length * 0.62))}
          fontWeight={800}
          fill={c.text}
          style={{ pointerEvents: "none", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
        >
          {nombre}
        </text>
        {detalle && (
          <text
            x={cx}
            y={cy + lado * 0.3}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={Math.min(lado * 0.22, 0.3, (m.w * 0.88) / (detalle.length * 0.56))}
            fontWeight={600}
            fill={c.text}
            style={{ pointerEvents: "none", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
          >
            {detalle}
          </text>
        )}
        {manija(s, m)}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      role="group"
      aria-label={ariaLabel}
      viewBox={`-0.3 -0.3 ${ancho + 0.6} ${alto + 0.6}`}
      style={{ width: "100%", height: "auto", maxHeight: "72vh", display: "block", touchAction: editable ? "none" : "manipulation" }}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerDown={() => editable && onSel?.(null)}
    >
      <style>{`.pl-item{outline:none}.pl-item:focus-visible .pl-forma{stroke:var(--focus);stroke-width:.12}`}</style>
      <defs>
        <pattern id={gridId} width={1} height={1} patternUnits="userSpaceOnUse">
          <path d="M1 0H0V1" fill="none" stroke="var(--line)" strokeWidth={0.02} />
        </pattern>
      </defs>
      {/* El local: su contorno con las medidas del piso. */}
      <rect x={0} y={0} width={ancho} height={alto} rx={0.12} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={0.08} />
      {editable && <rect x={0} y={0} width={ancho} height={alto} fill={`url(#${gridId})`} style={{ pointerEvents: "none" }} />}
      {piso.zonas.map(zona)}
      {piso.mesas.map(mesa)}
    </svg>
  );
}
