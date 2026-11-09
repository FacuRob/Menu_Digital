import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../lib/i18n";

// ⓘ con una explicación corta.
// Computadora: aparece un globito al pasar el mouse o al llegar con Tab.
// Celular (sin mouse): al tocarlo se abre una ventanita con el texto.
// El globito va con un portal a <body> para que no lo corten los bordes del
// modal ni de las tarjetas.
export function InfoTip({ texto, titulo }: { texto: string; titulo?: string }) {
  const { t } = useLang();
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipId = useId();
  const [pos, setPos] = useState<{ x: number; y: number; abajo: boolean } | null>(null);
  const [hoja, setHoja] = useState(false);

  const mostrar = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    // Arriba del ⓘ; si no hay lugar, abajo.
    const abajo = r.top < 90;
    setPos({ x: r.left + r.width / 2, y: abajo ? r.bottom + 8 : r.top - 8, abajo });
  };
  const ocultar = () => setPos(null);

  const sinMouse = () => window.matchMedia("(hover: none)").matches;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="dx-info"
        aria-label={`${t("infoMore")}: ${texto}`}
        aria-describedby={pos ? tipId : undefined}
        onMouseEnter={() => !sinMouse() && mostrar()}
        onMouseLeave={ocultar}
        onFocus={() => !sinMouse() && mostrar()}
        onBlur={ocultar}
        onClick={(e) => {
          // Dentro de un <label> no debe pasarle el foco al campo.
          e.preventDefault();
          if (sinMouse()) setHoja(true);
        }}
      >
        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M12 11v5.5" strokeLinecap="round" />
          <circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {pos &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="dx-info-tip"
            style={{
              left: Math.min(Math.max(pos.x, 136), window.innerWidth - 136),
              top: pos.y,
              transform: pos.abajo ? "translateX(-50%)" : "translate(-50%, -100%)",
            }}
          >
            {texto}
          </div>,
          document.body,
        )}

      {hoja && (
        <HojaInfo
          titulo={titulo}
          texto={texto}
          onClose={() => {
            setHoja(false);
            btnRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

// Ventanita del celular. Escape la cierra sin cerrar el modal de atrás.
function HojaInfo({ titulo, texto, onClose }: { titulo?: string; texto: string; onClose: () => void }) {
  const { t } = useLang();
  const okRef = useRef<HTMLButtonElement>(null);
  const tituloId = useId();
  const cerrar = useRef(onClose);
  useEffect(() => {
    cerrar.current = onClose;
  });
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cerrar.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return createPortal(
    <div className="dx-info-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? tituloId : undefined}
        aria-label={titulo ? undefined : t("infoMore")}
        className="dx-info-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo && (
          <h3 id={tituloId} style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>
            {titulo}
          </h3>
        )}
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--fg-2)" }}>{texto}</p>
        <button ref={okRef} type="button" className="dx-info-ok" onClick={onClose}>
          {t("infoOk")}
        </button>
      </div>
    </div>,
    document.body,
  );
}

// Campo con la pregunta arriba y, si hace falta, el ⓘ al lado.
export function Campo({ label, info, children }: { label: string; info?: string; children: ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="dx-pregunta">
        {label}
        {info && <InfoTip texto={info} titulo={label} />}
      </span>
      {children}
    </label>
  );
}
