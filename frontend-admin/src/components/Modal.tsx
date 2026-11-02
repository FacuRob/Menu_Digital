import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../lib/i18n";

// Modal del panel: fondo desenfocado, tarjeta con entrada suave, franja de
// color de marca arriba, título (con ícono opcional) y botón de cerrar.
// Se cierra con Escape o con la ✕. No se cierra al tocar afuera, para no
// perder lo que se estaba escribiendo en un formulario.
// El contenido (cuerpo y pie) lo arma cada pantalla con modalBody/modalFooter
// de sharedStyles.
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
  const { isDark } = useTheme();
  const { t } = useLang();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    // La página de atrás no se desplaza mientras el modal está abierto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco en el primer campo (en computadora; en el celular abriría el
    // teclado de golpe).
    if (window.matchMedia("(pointer: fine)").matches) {
      const campo = panelRef.current?.querySelector<HTMLElement>(
        "input:not([type=hidden]):not([disabled]):not([readonly]), select, textarea",
      );
      campo?.focus();
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const textPrimary = isDark ? "#f1f5f9" : "#0f172a";
  const textMuted = isDark ? "#94a3b8" : "#64748b";

  return createPortal(
    <div className="dx-modal-overlay" data-theme={isDark ? "dark" : "light"}>
      <div
        ref={panelRef}
        className="dx-modal"
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth,
          background: isDark ? "#1a1d27" : "#ffffff",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)"}`,
        }}
      >
        <div className="dx-modal-head">
          {icon && <span className="dx-modal-icon">{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, color: textPrimary, fontSize: 16.5, fontWeight: 700, lineHeight: 1.3 }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: "3px 0 0", color: textMuted, fontSize: 12.5, lineHeight: 1.45 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            className="dx-modal-close"
            onClick={onClose}
            aria-label={t("dlgClose")}
            title={t("dlgClose")}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
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
