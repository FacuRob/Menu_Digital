import { useCallback, useEffect, useRef, useState, type ReactNode, useId } from "react";
import { createPortal } from "react-dom";
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

// Color del aviso según el tipo (tokens de src/styles/tokens.css).
const COLOR: Record<Tipo, string> = { info: "var(--info)", error: "var(--err)", peligro: "var(--err)" };
const FONDO: Record<Tipo, string> = { info: "var(--info-bg)", error: "var(--err-bg)", peligro: "var(--err-bg)" };

function Dialogo({ pedido, onCerrar }: { pedido: Pedido; onCerrar: (ok: boolean) => void }) {
  const { t } = useLang();
  const okRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const mensajeId = useId();
  const cerrarRef = useRef(onCerrar);
  useEffect(() => {
    cerrarRef.current = onCerrar;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    okRef.current?.focus();
    // En captura y sin propagar: si el diálogo está sobre un Modal con un
    // formulario, Escape cierra sólo el diálogo (no se pierde lo escrito).
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        cerrarRef.current(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      e.stopImmediatePropagation();
      const items = [...panelRef.current.querySelectorAll<HTMLElement>("button")];
      if (!items.length) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      anterior?.focus?.();
    };
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
    <div className="dx-modal-overlay" style={{ zIndex: 1200 }}>
      <div
        ref={panelRef}
        className="dx-modal dx-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={mensajeId}
        style={{ maxWidth: 400, ["--dx-accent" as string]: color }}
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
              background: FONDO[pedido.tipo],
            }}
            aria-hidden
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
          <h2 id={tituloId} className="pn-title" style={{ margin: 0, fontSize: 19, color: "var(--fg)" }}>
            {titulo}
          </h2>
          <p
            id={mensajeId}
            style={{
              margin: "8px 0 0",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--fg-2)",
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
            style={
              pedido.tipo === "peligro" ? { background: "var(--err)", color: "var(--surface)" } : { background: "var(--accent)" }
            }
          >
            {okTexto}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
