import { useState, useMemo } from "react";
import type { Producto, VarianteGrupo } from "../services/api";
import type { SelectedOption } from "../hooks/useCart";
import {
  PRIMARY,
  PRIMARY_DARK,
  PRIMARY_SHADOW,
  PRIMARY_ON,
  PRIMARY_SOFT,
  fmt,
  neto,
  ProductImage,
} from "../lib/menuUi";
import { useLang } from "../lib/i18n";

// Estado de selección: grupo_id → set de opcion_id elegidas.
type Sel = Record<number, number[]>;

export default function ProductModal({
  producto,
  onClose,
  onAdd,
}: {
  producto: Producto;
  onClose: () => void;
  onAdd: (
    producto: Producto,
    cantidad: number,
    opciones: SelectedOption[],
  ) => void;
}) {
  const { t } = useLang();
  const [cantidad, setCantidad] = useState(1);
  const grupos = useMemo<VarianteGrupo[]>(
    () => (Array.isArray(producto.variantes) ? producto.variantes : []),
    [producto],
  );

  // Preselección: grupos single obligatorios arrancan con su primera opción.
  const [sel, setSel] = useState<Sel>(() => {
    const init: Sel = {};
    for (const g of Array.isArray(producto.variantes) ? producto.variantes : []) {
      if (g.tipo === "single" && g.obligatorio && g.opciones[0]) {
        init[g.id] = [g.opciones[0].id];
      } else {
        init[g.id] = [];
      }
    }
    return init;
  });

  const toggle = (g: VarianteGrupo, opcionId: number) => {
    setSel((prev) => {
      const cur = prev[g.id] || [];
      if (g.tipo === "single") {
        return { ...prev, [g.id]: [opcionId] };
      }
      // multi: alterna
      return {
        ...prev,
        [g.id]: cur.includes(opcionId)
          ? cur.filter((id) => id !== opcionId)
          : [...cur, opcionId],
      };
    });
  };

  // Opciones elegidas, aplanadas.
  const elegidas = useMemo<SelectedOption[]>(() => {
    const out: SelectedOption[] = [];
    for (const g of grupos) {
      for (const opId of sel[g.id] || []) {
        const op = g.opciones.find((o) => o.id === opId);
        if (op) {
          out.push({
            grupo_id: g.id,
            grupo_nombre: g.nombre,
            opcion_id: op.id,
            nombre: op.nombre,
            precio_extra: Number(op.precio_extra || 0),
          });
        }
      }
    }
    return out;
  }, [grupos, sel]);

  // Faltan grupos obligatorios sin elegir → no se puede agregar.
  const faltanObligatorios = grupos.some(
    (g) => g.obligatorio && (sel[g.id]?.length ?? 0) === 0,
  );

  const base = Number(producto.precio);
  const extra = elegidas.reduce((a, o) => a + o.precio_extra, 0);
  const unit = base + extra;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        animation: "fadeIn .18s ease",
        fontFamily: "Inter,system-ui,sans-serif",
      }}
    >
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="mn-scroll self-end rounded-t-[28px] sm:m-4 sm:self-center sm:rounded-[28px]"
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "linear-gradient(180deg, var(--mp-bg1, #2a0f06), #0b0b0b 70%)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
          animation: "popIn .22s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Imagen */}
        <div style={{ position: "relative", height: 280, background: "#111" }}>
          <ProductImage
            url={producto.imagen_url}
            alt={producto.nombre}
            w={880}
            h={600}
            fill
            style={{ width: "100%", height: "100%" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 55%, var(--mp-bg1, #2a0f06))", pointerEvents: "none" }} />
          <button
            onClick={onClose}
            aria-label={t("back")}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding: "22px 22px 24px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: 23,
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.4px",
            }}
          >
            {producto.nombre}
          </h2>

          {producto.descripcion && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 14,
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.55,
              }}
            >
              {producto.descripcion}
            </p>
          )}

          <div
            style={{
              marginTop: 14,
              fontSize: 22,
              fontWeight: 800,
              color: PRIMARY,
            }}
          >
            {fmt(base)}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            {t("taxFree", { v: fmt(neto(base)) })}
          </div>

          {/* Grupos de variantes */}
          {grupos.map((g) => (
            <div key={g.id} style={{ marginTop: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>
                  {g.nombre}
                </span>
                {g.obligatorio && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: PRIMARY,
                      background: PRIMARY_SOFT,
                      padding: "2px 8px",
                      borderRadius: 999,
                      textTransform: "uppercase",
                      letterSpacing: ".03em",
                    }}
                  >
                    {t("required")}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {g.opciones.map((op) => {
                  const checked = (sel[g.id] || []).includes(op.id);
                  return (
                    <button
                      key={op.id}
                      onClick={() => toggle(g, op.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "11px 13px",
                        borderRadius: 12,
                        border: `1.5px solid ${checked ? PRIMARY : "rgba(255,255,255,0.1)"}`,
                        background: checked ? PRIMARY_SOFT : "rgba(255,255,255,0.04)",
                        transition: "all .15s",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: g.tipo === "single" ? "50%" : 6,
                          border: `2px solid ${checked ? PRIMARY : "rgba(255,255,255,0.3)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {checked && (
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: g.tipo === "single" ? "50%" : 3,
                              background: PRIMARY,
                            }}
                          />
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "rgba(255,255,255,0.88)",
                          flex: 1,
                        }}
                      >
                        {op.nombre}
                      </span>
                      {Number(op.precio_extra) > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                          +{fmt(Number(op.precio_extra))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.08)",
              margin: "18px 0",
            }}
          />

          {/* Selector de cantidad */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
              {t("quantity")}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "1.5px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                padding: 3,
              }}
            >
              <StepBtn
                label="−"
                onClick={() => setCantidad((q) => Math.max(1, q - 1))}
              />
              <span
                style={{
                  minWidth: 32,
                  textAlign: "center",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                }}
              >
                {cantidad}
              </span>
              <StepBtn label="+" onClick={() => setCantidad((q) => q + 1)} />
            </div>
          </div>

          {/* Agregar al pedido */}
          <button
            onClick={() => {
              if (faltanObligatorios) return;
              onAdd(producto, cantidad, elegidas);
              onClose();
            }}
            disabled={faltanObligatorios}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 999,
              border: "none",
              background: PRIMARY,
              color: PRIMARY_ON,
              fontSize: 15.5,
              fontWeight: 700,
              cursor: faltanObligatorios ? "default" : "pointer",
              opacity: faltanObligatorios ? 0.55 : 1,
              boxShadow: `0 8px 22px ${PRIMARY_SHADOW}`,
              transition: "background .15s",
            }}
            onMouseEnter={(e) =>
              !faltanObligatorios &&
              (e.currentTarget.style.background = PRIMARY_DARK)
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            {faltanObligatorios
              ? t("chooseRequired")
              : `${t("addToOrder")} · ${fmt(unit * cantidad)}`}
          </button>

          {/* Volver al menú */}
          <button
            onClick={onClose}
            style={{
              width: "100%",
              marginTop: 10,
              padding: "13px",
              borderRadius: 999,
              border: "1.5px solid rgba(255,255,255,0.12)",
              background: "transparent",
              color: "rgba(255,255,255,0.65)",
              fontSize: 14.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("backToMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        border: "none",
        background: "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 20,
        fontWeight: 700,
        lineHeight: 1,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label}
    </button>
  );
}
