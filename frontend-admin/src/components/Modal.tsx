import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../lib/i18n";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal del panel: título (con ícono opcional) y botón de cerrar.
// Se cierra con Escape o con la ✕. No se cierra al tocar afuera, para no
// perder lo que se estaba escribiendo en un formulario.
// Accesible: el foco queda adentro (Tab da la vuelta), vuelve al botón que
// lo abrió al cerrarse y el título nombra al diálogo.
// El contenido (cuerpo y pie) lo arma cada pantalla con modalBody/modalFooter
// de sharedStyles. Colores: tokens de src/styles/tokens.css.
export default function Modal({
  title,
  subtitle,
  icon,
  onClose,
  maxWidth = 480,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  maxWidth?: number;
  children: ReactNode;
}) {
  const { t } = useLang();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const tituloId = useId();
  const subId = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Trampa de foco: Tab no sale del modal.
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (!items.length) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // La página de atrás no se desplaza mientras el modal está abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco en el primer campo (en computadora; en el celular abriría el
    // teclado de golpe). Si no hay campos, en el diálogo.
    const campo =
      window.matchMedia("(pointer: fine)").matches &&
      panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]):not([readonly]), select, textarea",
      );
    (campo || panelRef.current)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      anterior?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="dx-modal-overlay">
      <div
        ref={panelRef}
        className="dx-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={subtitle ? subId : undefined}
        tabIndex={-1}
        style={{ maxWidth, outline: "none" }}
      >
        <div className="dx-modal-head">
          {icon && (
            <span className="dx-modal-icon" aria-hidden>
              {icon}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id={tituloId}
              className="pn-title"
              style={{ margin: 0, color: "var(--fg)", fontSize: 18, lineHeight: 1.25 }}
            >
              {title}
            </h2>
            {subtitle && (
              <p id={subId} style={{ margin: "3px 0 0", color: "var(--fg-3)", fontSize: 13, lineHeight: 1.45 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button type="button" className="dx-modal-close" onClick={onClose} aria-label={t("dlgClose")}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
