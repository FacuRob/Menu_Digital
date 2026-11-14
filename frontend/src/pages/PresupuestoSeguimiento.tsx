import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Cargando, Hoja, NoEncontrado } from "../components/HojaNegocio";
import { waNegocio } from "../lib/negocioPublico";
import { getErrorMessage, presupuestosPublico, type EstadoPresupuesto, type PresupuestoCliente } from "../services/api";
import { fmt } from "../lib/menuUi";

// Seguimiento del presupuesto (link firmado): /presupuesto/:id?t=…
// El cliente ve en qué está y, cuando hay cotización, la acepta o la rechaza.
const TEXTO: Record<EstadoPresupuesto, string> = {
  pendiente: "Recibimos tu pedido. El negocio lo va a revisar y te responde por acá.",
  en_revision: "El negocio está revisando tu pedido.",
  cotizado: "¡Ya tenés la cotización! Revisala y respondé.",
  aceptado: "Aceptaste la cotización. El negocio se va a poner en contacto para coordinar.",
  rechazado: "Este presupuesto quedó rechazado.",
  convertido: "Listo: tu pedido ya está en marcha.",
  cancelado: "Este presupuesto fue cancelado.",
};
const ETIQUETA: Record<EstadoPresupuesto, string> = {
  pendiente: "Recibido",
  en_revision: "En revisión",
  cotizado: "Cotización lista",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  convertido: "En marcha",
  cancelado: "Cancelado",
};

export default function PresupuestoSeguimiento() {
  const { id = "" } = useParams();
  const t = new URLSearchParams(window.location.search).get("t") || "";
  const [p, setP] = useState<PresupuestoCliente | null | "no">(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarRechazo, setConfirmarRechazo] = useState(false);
  const [confirmarAcepto, setConfirmarAcepto] = useState(false);

  useEffect(() => {
    presupuestosPublico.ver(id, t).then(setP).catch(() => setP("no"));
  }, [id, t]);

  if (!p) return <Cargando />;
  if (p === "no") return <NoEncontrado titulo="Presupuesto no encontrado" texto="Revisá que el link esté completo, tal como te llegó." />;

  const responder = async (decision: "aceptar" | "rechazar") => {
    setEnviando(true);
    setError("");
    try {
      const r = await presupuestosPublico.responder(id, t, decision);
      setP({ ...p, ...r });
      setConfirmarRechazo(false);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo enviar tu respuesta."));
    } finally {
      setEnviando(false);
    }
  };
  const wa = waNegocio(p.negocio, `Hola, te escribo por mi presupuesto #${p.id}.`);

  return (
    <Hoja negocio={p.negocio?.nombre} titulo={`Presupuesto #${p.id}`}>
      <div className="grid gap-5">
        <div>
          <p className="mn-label text-[var(--fg-2)]">Estado</p>
          <p className="mt-1 text-[1.25rem] font-bold">{ETIQUETA[p.estado]}</p>
          <p className="mt-1 text-[15px] text-[var(--fg-2)]" role="status">{TEXTO[p.estado]}</p>
        </div>

        <dl className="grid gap-3 rounded-[var(--r-sm)] bg-[var(--bg-2)] p-4 text-[14px]">
          {p.referencia && (
            <div>
              <dt className="mn-label text-[var(--fg-2)]">Sobre</dt>
              <dd className="mt-0.5 font-semibold">{p.referencia}</dd>
            </div>
          )}
          <div>
            <dt className="mn-label text-[var(--fg-2)]">Lo que pediste</dt>
            <dd className="mt-0.5 whitespace-pre-wrap">{p.descripcion}</dd>
          </div>
          <div>
            <dt className="mn-label text-[var(--fg-2)]">Cantidad</dt>
            <dd className="mt-0.5">{p.cantidad}{p.medidas ? ` · ${p.medidas}` : ""}</dd>
          </div>
        </dl>

        {p.precio_cotizado !== null && (
          <section aria-labelledby="cotiz" className="rounded-[var(--r-sm)] border-2 border-[var(--fg)] p-4">
            <h2 id="cotiz" className="mn-label">Cotización</h2>
            <p className="mn-num mt-1 text-[1.75rem] font-extrabold">{fmt(Number(p.precio_cotizado))}</p>
            {p.observaciones && <p className="mt-2 whitespace-pre-wrap text-[15px]">{p.observaciones}</p>}
            {p.valido_hasta && (
              <p className="mt-2 text-[13px] text-[var(--fg-2)]">
                {p.vencido ? "Venció el " : "Válida hasta el "}
                {new Date(`${p.valido_hasta}T12:00:00-03:00`).toLocaleDateString("es-AR")}
              </p>
            )}
          </section>
        )}

        {p.estado === "cotizado" && !p.vencido && (
          <div className="grid gap-2">
            {!confirmarAcepto ? (
              <button type="button" className="mn-btn w-full" disabled={enviando} onClick={() => setConfirmarAcepto(true)}>
                Aceptar por {fmt(Number(p.precio_cotizado))}
              </button>
            ) : (
              <div className="grid gap-2 rounded-[var(--r-sm)] bg-[var(--bg-2)] p-3" role="group" aria-label="Confirmar aceptación">
                <p className="text-[14px] font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
                  Vas a aceptar {fmt(Number(p.precio_cotizado))}. El negocio te contacta para coordinar.
                </p>
                <button type="button" className="mn-btn w-full" disabled={enviando} onClick={() => responder("aceptar")}>
                  Sí, acepto
                </button>
                <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => setConfirmarAcepto(false)}>
                  Volver
                </button>
              </div>
            )}
            {!confirmarRechazo ? (
              <button type="button" className="mn-btn mn-btn-borde w-full" disabled={enviando} onClick={() => setConfirmarRechazo(true)}>
                No me interesa
              </button>
            ) : (
              <div className="grid gap-2 rounded-[var(--r-sm)] bg-[var(--bg-2)] p-3" role="group" aria-label="Confirmar rechazo">
                <p className="text-[14px] font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>¿Rechazar la cotización? No se puede deshacer.</p>
                <button type="button" className="mn-btn mn-btn-borde w-full" disabled={enviando} onClick={() => responder("rechazar")}>
                  Sí, rechazar
                </button>
                <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => setConfirmarRechazo(false)}>
                  Volver
                </button>
              </div>
            )}
          </div>
        )}
        {p.estado === "cotizado" && p.vencido && <p className="text-[15px]">La cotización venció. Escribile al negocio para pedir una nueva.</p>}
        {error && <p role="alert" className="text-[14px] font-semibold text-[var(--err)]">{error}</p>}

        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mn-btn mn-btn-borde w-full">
            Escribir al negocio por WhatsApp
          </a>
        )}
        <p className="text-[13px] text-[var(--fg-2)]">Guardá este link para volver a ver tu presupuesto.</p>
        {p.negocio?.slug && (
          <a href={`/menu/${p.negocio.slug}`} className="text-[14px] font-semibold underline underline-offset-4">
            Ver el negocio
          </a>
        )}
      </div>
    </Hoja>
  );
}
