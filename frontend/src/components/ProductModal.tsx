import { useState, useMemo } from "react";
import type { Producto, VarianteGrupo } from "../services/api";
import type { SelectedOption } from "../hooks/useCart";
import {
  PRIMARY,
  PRIMARY_DARK,
  PRIMARY_SHADOW,
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
        background: "rgba(15,10,8,0.6)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "fadeIn .18s ease",
      }}
    >
      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes popIn{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 22,
          boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
          animation: "popIn .22s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {/* Imagen */}
        <div style={{ position: "relative", height: 300, background: "#111" }}>
          <ProductImage
            url={producto.imagen_url}
            alt={producto.nombre}
            w={880}
            h={600}
            fill
            style={{ width: "100%", height: "100%" }}
          />
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
              background: "#fff",
              color: "#1c1917",
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
              color: "#1c1917",
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
                color: "#6b7280",
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
              color: "#9ca3af",
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
                <span style={{ fontSize: 14.5, fontWeight: 700, color: "#1c1917" }}>
                  {g.nombre}
                </span>
                {g.obligatorio && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: PRIMARY,
                      background: "rgba(0,0,0,.04)",
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
                        border: `1.5px solid ${checked ? PRIMARY : "#ececec"}`,
                        background: checked ? "rgba(0,0,0,.02)" : "#fff",
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
                          border: `2px solid ${checked ? PRIMARY : "#d1cbc7"}`,
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
                          color: "#374151",
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
              background: "#f1f0ee",
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
            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
              {t("quantity")}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "1.5px solid #eee",
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
                  color: "#1c1917",
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
              color: "#fff",
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
              border: "1.5px solid #eee",
              background: "#fff",
              color: "#6b7280",
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
        background: "#f6f5f4",
        color: "#1c1917",
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
