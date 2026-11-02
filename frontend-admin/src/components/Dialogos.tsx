import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../lib/i18n";
import { DialogosContext, type DialogosApi as Api } from "../lib/dialogos";

// Dibuja los diálogos de confirmar/avisar (ver lib/dialogos.ts).

type Tipo = "info" | "error" | "peligro";

interface Pedido {
  tipo: Tipo;
  titulo?: string;
  mensaje: string;
  confirmarTexto?: string;
  conCancelar: boolean;
  resolver: (ok: boolean) => void;
}

export function DialogosProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const confirmar = useCallback<Api["confirmar"]>(
    (o) =>
      new Promise((resolver) =>
        setPedido({
          tipo: o.peligro ? "peligro" : "info",
          titulo: o.titulo,
          mensaje: o.mensaje,
          confirmarTexto: o.confirmarTexto,
          conCancelar: true,
          resolver,
        }),
      ),
    [],
  );

  const avisar = useCallback<Api["avisar"]>(
    (o) =>
      new Promise((resolver) =>
        setPedido({
          tipo: o.tipo || "info",
          titulo: o.titulo,
          mensaje: o.mensaje,
          conCancelar: false,
          resolver: () => resolver(),
        }),
      ),
    [],
  );

  const cerrar = (ok: boolean) => {
    pedido?.resolver(ok);
    setPedido(null);
  };

  return (
    <DialogosContext.Provider value={{ confirmar, avisar }}>
      {children}
      {pedido && <Dialogo pedido={pedido} onCerrar={cerrar} />}
    </DialogosContext.Provider>
  );
}

const COLOR: Record<Tipo, string> = { info: "#6366f1", error: "#ef4444", peligro: "#ef4444" };

function Dialogo({ pedido, onCerrar }: { pedido: Pedido; onCerrar: (ok: boolean) => void }) {
  const { isDark } = useTheme();
  const { t } = useLang();
  const okRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => {
    cerrarRef.current = onCerrar;
  });

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrarRef.current(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const color = COLOR[pedido.tipo];
  const titulo =
    pedido.titulo ||
    (pedido.conCancelar
      ? t("dlgConfirmTitle")
      : pedido.tipo === "error"
        ? t("dlgErrorTitle")
        : t("dlgNoticeTitle"));
  const okTexto =
    pedido.confirmarTexto ||
    (!pedido.conCancelar ? t("dlgOk") : pedido.tipo === "peligro" ? t("dlgDelete") : t("dlgConfirm"));

  return createPortal(
    <div className="dx-modal-overlay" data-theme={isDark ? "dark" : "light"} style={{ zIndex: 1200 }}>
      <div
        className="dx-modal dx-dialog"
        role="alertdialog"
        aria-modal="true"
        style={{
          maxWidth: 400,
          background: isDark ? "#1a1d27" : "#ffffff",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
          ["--dx-accent" as string]: color,
        }}
      >
        <div style={{ padding: "26px 24px 8px", textAlign: "center" }}>
          <div
            style={{
              width: 52,
              height: 52,
              margin: "0 auto 14px",
              borderRadius: 16,
              display: "grid",
              placeItems: "center",
              color,
              background: `${color}1f`,
              border: `1px solid ${color}33`,
            }}
          >
            {pedido.tipo === "info" ? (
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            )}
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: isDark ? "#f1f5f9" : "#0f172a" }}>{titulo}</h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: isDark ? "#94a3b8" : "#64748b",
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
            }}
          >
            {pedido.mensaje}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, padding: "18px 24px 22px" }}>
          {pedido.conCancelar && (
            <button type="button" className="dx-btn dx-btn-ghost" onClick={() => onCerrar(false)}>
              {t("actionCancel")}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            className="dx-btn dx-btn-solid"
            onClick={() => onCerrar(true)}
            style={{ background: pedido.tipo === "peligro" ? "#ef4444" : "linear-gradient(135deg,#6366f1,#3b82f6)" }}
          >
            {okTexto}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
