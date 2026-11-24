import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useNegocio } from "../context/NegocioContext";
import { asistenteService, getApiErrorMessage, type MensajeAsistente } from "../services/api";
import "../styles/dinexai.css";

// DinexAI: botón flotante (abajo a la derecha) que abre un chat con la IA.
// Responde dudas del admin mirando los datos reales del negocio activo.

const SUGERENCIAS = [
  "Cargué un producto, ¿por qué no se ve?",
  "¿Qué me falta configurar?",
  "¿Cómo comparto mi página con mis clientes?",
];

// La conversación sobrevive a cambiar de sección (no a cerrar la pestaña).
const claveChat = (negocioId: number) => `dinexai_chat_${negocioId}`;
const leerChat = (negocioId: number): MensajeAsistente[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(claveChat(negocioId)) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// **negrita** y saltos de línea; todo lo demás va como texto.
function Texto({ children }: { children: string }) {
  return (
    <>
      {children.split("\n").map((linea, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {linea.split(/(\*\*[^*]+\*\*)/g).map((parte, j): ReactNode =>
            parte.startsWith("**") && parte.endsWith("**") ? <strong key={j}>{parte.slice(2, -2)}</strong> : parte,
          )}
        </Fragment>
      ))}
    </>
  );
}

const IconoIA = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M10 2.5c.3 0 .55.2.62.48l.9 3.6a5 5 0 0 0 3.64 3.64l3.6.9a.64.64 0 0 1 0 1.24l-3.6.9a5 5 0 0 0-3.64 3.64l-.9 3.6a.64.64 0 0 1-1.24 0l-.9-3.6a5 5 0 0 0-3.64-3.64l-3.6-.9a.64.64 0 0 1 0-1.24l3.6-.9a5 5 0 0 0 3.64-3.64l.9-3.6A.64.64 0 0 1 10 2.5Z" />
    <path d="M18.5 1.5c.17 0 .31.11.35.27l.32 1.28c.16.63.65 1.12 1.28 1.28l1.28.32a.36.36 0 0 1 0 .7l-1.28.32c-.63.16-1.12.65-1.28 1.28l-.32 1.28a.36.36 0 0 1-.7 0l-.32-1.28a1.77 1.77 0 0 0-1.28-1.28l-1.28-.32a.36.36 0 0 1 0-.7l1.28-.32c.63-.16 1.12-.65 1.28-1.28l.32-1.28a.36.36 0 0 1 .35-.27Z" />
  </svg>
);

export default function DinexAI() {
  const { user } = useAuth();
  const { negocioId } = useNegocio();
  // null mientras se pregunta; false = falta la clave de OpenRouter.
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeAsistente[]>(() => leerChat(negocioId));
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  const nombre = (user?.nombre || "").split(" ")[0];

  useEffect(() => {
    let vivo = true;
    asistenteService
      .disponible()
      .then((d) => vivo && setDisponible(d))
      .catch(() => vivo && setDisponible(false));
    return () => {
      vivo = false;
    };
  }, []);

  // Cada negocio tiene su propia conversación.
  useEffect(() => {
    setMensajes(leerChat(negocioId));
    setError("");
  }, [negocioId]);

  useEffect(() => {
    try {
      sessionStorage.setItem(claveChat(negocioId), JSON.stringify(mensajes.slice(-30)));
    } catch {
      /* sin storage: la charla vive sólo mientras está abierta */
    }
  }, [mensajes, negocioId]);

  useEffect(() => {
    listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes, pensando, abierto]);

  useEffect(() => {
    if (!abierto) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  if (user?.solo_lectura) return null;

  // `previos`: historial sobre el que se pregunta (al reintentar, sin la
  // pregunta que falló, para no duplicarla).
  const enviar = async (pregunta: string, previos: MensajeAsistente[] = mensajes) => {
    const t = pregunta.trim();
    if (!t || pensando || disponible === false) return;
    const nuevos: MensajeAsistente[] = [...previos, { role: "user", content: t }];
    setMensajes(nuevos);
    setTexto("");
    setError("");
    setPensando(true);
    try {
      const respuesta = await asistenteService.preguntar(nuevos, nombre);
      setMensajes((m) => [...m, { role: "assistant", content: respuesta }]);
    } catch (e) {
      setError(getApiErrorMessage(e, "DinexAI no pudo responder ahora. Probá de nuevo."));
    } finally {
      setPensando(false);
      inputRef.current?.focus();
    }
  };

  const reintentar = () => {
    const ultima = mensajes[mensajes.length - 1];
    if (ultima?.role !== "user") return;
    void enviar(ultima.content, mensajes.slice(0, -1));
  };

  return (
    <>
      {abierto && (
        <section className="dx-panel" role="dialog" aria-label="DinexAI, asistente de tu cuenta">
          <header className="dx-head">
            <span className="dx-avatar">
              <IconoIA size={18} />
            </span>
            <div className="dx-head-txt">
              <strong>DinexAI</strong>
              <span>Mira los datos de tu cuenta para ayudarte</span>
            </div>
            {mensajes.length > 0 && (
              <button
                type="button"
                className="dx-icon-btn"
                onClick={() => {
                  setMensajes([]);
                  setError("");
                }}
                aria-label="Empezar una conversación nueva"
                title="Nueva conversación"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            )}
            <button type="button" className="dx-icon-btn" onClick={() => setAbierto(false)} aria-label="Cerrar DinexAI">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="dx-list" ref={listaRef} aria-live="polite">
            {disponible === false && (
              <div className="dx-error" role="status">
                DinexAI todavía no está activado en este servidor: falta configurar la clave de OpenRouter.
              </div>
            )}
            {mensajes.length === 0 && disponible !== false && (
              <div className="dx-hola">
                <p>
                  <strong>Hola{nombre ? `, ${nombre}` : ""}.</strong> Soy DinexAI. Preguntame lo que quieras sobre tu cuenta:
                  te digo qué pasa y dónde tocar para arreglarlo.
                </p>
                <div className="dx-sugs">
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" className="dx-sug" onClick={() => enviar(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`dx-msg ${m.role === "user" ? "is-user" : "is-ai"}`}>
                <Texto>{m.content}</Texto>
              </div>
            ))}
            {pensando && (
              <div className="dx-msg is-ai dx-typing" role="status">
                <span />
                <span />
                <span />
                <span className="sr-only">DinexAI está escribiendo</span>
              </div>
            )}
            {error && (
              <div className="dx-error" role="alert">
                {error}
                {mensajes[mensajes.length - 1]?.role === "user" && (
                  <button type="button" onClick={reintentar}>
                    Reintentar
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            className="dx-form"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar(texto);
            }}
          >
            <textarea
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar(texto);
                }
              }}
              rows={1}
              maxLength={1500}
              placeholder="Escribí tu duda…"
              disabled={disponible === false}
              aria-label="Tu pregunta para DinexAI"
            />
            <button type="submit" className="dx-send" disabled={!texto.trim() || pensando || disponible === false} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
          <p className="dx-legal">DinexAI puede equivocarse. No hace cambios en tu cuenta.</p>
        </section>
      )}

      <button
        ref={botonRef}
        type="button"
        className={`dx-fab${abierto ? " is-open" : ""}`}
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label={abierto ? "Cerrar DinexAI" : "Abrir DinexAI, el asistente de tu cuenta"}
        title="DinexAI"
      >
        {abierto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        ) : (
          <IconoIA />
        )}
      </button>
    </>
  );
}
