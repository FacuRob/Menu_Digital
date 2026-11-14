import { useId, useRef } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useLang } from "../lib/i18n";
import { iconoRubro, useRubros } from "../lib/rubros";
import type { RubroElegido } from "../services/api";

// Elegir categoría + especialidad del catálogo central de rubros. Lo usan el
// onboarding (tema "acceso", tarjetas grandes con descripción) y los modales
// de Negocios y Configuración (tema "panel", compacto).
type Tema = "acceso" | "panel";

const COLORES: Record<Tema, { on: string; onBg: string; onFg: string; borde: string; bg: string; fg: string; muted: string }> = {
  acceso: { on: "var(--tinta)", onBg: "var(--hueso)", onFg: "var(--tinta)", borde: "color-mix(in srgb, var(--tinta) 12%, transparent)", bg: "transparent", fg: "var(--tinta)", muted: "var(--gris)" },
  panel: { on: "var(--info)", onBg: "var(--info-bg)", onFg: "var(--info)", borde: "var(--line-strong)", bg: "var(--surface-2)", fg: "var(--fg)", muted: "var(--fg-3)" },
};

export default function RubroSelector({
  value,
  onChange,
  tema = "panel",
  etiquetaId,
}: {
  value: RubroElegido;
  onChange: (v: RubroElegido) => void;
  tema?: Tema;
  // id del título visible que nombra al selector (si no, se usa aria-label).
  etiquetaId?: string;
}) {
  const espId = useId();
  const { t } = useLang();
  const { categorias, error } = useRubros();
  const c = COLORES[tema];
  const amplio = tema === "acceso";
  const espRef = useRef<HTMLDivElement>(null);

  if (error) return <p role="alert" style={{ color: "var(--err)", fontSize: 14 }}>{t("rubrosError")}</p>;
  if (!categorias) return <p role="status" style={{ color: c.muted, fontSize: 14 }}>{t("subLoading")}</p>;

  const cat = categorias.find((x) => x.codigo === value.rubro_categoria) || null;
  const elegirCategoria = (codigo: string) => {
    onChange({ rubro_categoria: codigo, rubro_especialidad: codigo === value.rubro_categoria ? value.rubro_especialidad : null });
    // En la vista amplia (onboarding) las especialidades quedan debajo de
    // todas las tarjetas: se acercan para que se vean (sobre todo en celular).
    if (amplio) requestAnimationFrame(() => espRef.current?.scrollIntoView({ block: "nearest" }));
  };

  // Flechas para moverse entre categorías (patrón radiogroup).
  const teclas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!paso) return;
    e.preventDefault();
    const sig = categorias[(i + paso + categorias.length) % categorias.length];
    elegirCategoria(sig.codigo);
    const grupo = e.currentTarget.parentElement;
    requestAnimationFrame(() => grupo?.querySelector<HTMLButtonElement>(`[data-cat="${sig.codigo}"]`)?.focus());
  };

  const tarjeta = (activo: boolean): CSSProperties => ({
    display: "flex",
    alignItems: amplio ? "flex-start" : "center",
    gap: amplio ? 12 : 8,
    padding: amplio ? "12px 14px" : "10px 12px",
    minHeight: 44,
    borderRadius: amplio ? 16 : 10,
    cursor: "pointer",
    textAlign: "left",
    background: activo ? c.onBg : c.bg,
    border: `${amplio ? 2 : 1.5}px solid ${activo ? c.on : c.borde}`,
    color: activo ? c.onFg : c.fg,
    fontSize: amplio ? 15 : 13,
    fontWeight: activo ? 700 : 500,
  });

  const chip = (activo: boolean): CSSProperties => ({
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: amplio ? 15 : 13,
    fontWeight: 600,
    border: `${amplio ? 2 : 1.5}px solid ${activo ? c.on : c.borde}`,
    background: activo ? c.on : c.bg,
    color: activo ? (tema === "acceso" ? "#fff" : "var(--surface)") : c.fg,
  });

  return (
    <div>
      <div
        role="radiogroup"
        aria-labelledby={etiquetaId}
        aria-label={etiquetaId ? undefined : t("rubroCategoria")}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${amplio ? 230 : 150}px, 1fr))`,
          gap: 8,
        }}
      >
        {categorias.map((x, i) => {
          const activo = x.codigo === value.rubro_categoria;
          const Icon = iconoRubro(x.icono);
          return (
            <button
              key={x.codigo}
              type="button"
              role="radio"
              aria-checked={activo}
              // Sin selección, la primera tarjeta recibe el foco con Tab.
              tabIndex={activo || (!cat && i === 0) ? 0 : -1}
              data-cat={x.codigo}
              onClick={() => elegirCategoria(x.codigo)}
              onKeyDown={(e) => teclas(e, i)}
              style={tarjeta(activo)}
            >
              <span aria-hidden style={{ flexShrink: 0, marginTop: amplio ? 2 : 0 }}>
                <Icon size={amplio ? 20 : 18} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block" }}>{x.nombre}</span>
                {amplio && x.descripcion && (
                  <span style={{ display: "block", marginTop: 2, fontSize: 13, fontWeight: 400, lineHeight: 1.35, color: c.muted }}>
                    {x.descripcion}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {cat && cat.especialidades.length > 0 && (
        <div ref={espRef} style={{ marginTop: amplio ? 20 : 14, scrollMarginBottom: 96 }}>
          <p id={espId} style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: c.muted }}>
            {t("rubroEspecialidad")}
          </p>
          <div role="group" aria-labelledby={espId} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {cat.especialidades.map((e) => {
              const activo = e.codigo === value.rubro_especialidad;
              return (
                <button
                  key={e.codigo}
                  type="button"
                  aria-pressed={activo}
                  // Tocar la elegida la deja sin especialidad (es opcional).
                  onClick={() => onChange({ rubro_categoria: cat.codigo, rubro_especialidad: activo ? null : e.codigo })}
                  style={chip(activo)}
                >
                  {e.nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
