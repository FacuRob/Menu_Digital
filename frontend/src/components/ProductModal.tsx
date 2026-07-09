import { useState } from "react";
import type { Producto } from "../services/api";
import {
  PRIMARY,
  PRIMARY_DARK,
  PRIMARY_SHADOW,
  fmt,
  neto,
  ProductImage,
} from "../lib/menuUi";
import { useLang } from "../lib/i18n";

export default function ProductModal({
  producto,
  onClose,
  onAdd,
}: {
  producto: Producto;
  onClose: () => void;
  onAdd: (producto: Producto, cantidad: number) => void;
}) {
  const { t } = useLang();
  const [cantidad, setCantidad] = useState(1);
  const precio = Number(producto.precio);

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
            {fmt(precio)}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12.5,
              fontStyle: "italic",
              color: "#9ca3af",
            }}
          >
            {t("taxFree", { v: fmt(neto(precio)) })}
          </div>

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
              onAdd(producto, cantidad);
              onClose();
            }}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 999,
              border: "none",
              background: PRIMARY,
              color: "#fff",
              fontSize: 15.5,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: `0 8px 22px ${PRIMARY_SHADOW}`,
              transition: "background .15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = PRIMARY_DARK)
            }
            onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
          >
            {t("addToOrder")} · {fmt(precio * cantidad)}
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
