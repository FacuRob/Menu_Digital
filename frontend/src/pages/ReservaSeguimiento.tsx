import { useEffect, useId, useState } from "react";
import { useParams } from "react-router-dom";
import { Cargando, Hoja, NoEncontrado } from "../components/HojaNegocio";
import { waNegocio } from "../lib/negocioPublico";
import { getErrorMessage, reservasPublico, type EstadoReserva, type ReservaCliente } from "../services/api";
import { diaCortoAR, fechaAR, fechaLargaAR, horaAR, sumarDias } from "../lib/fechas";

// Gestión del turno (link firmado): /reserva/:id?t=…
// El cliente lo ve y, si falta tiempo, lo cancela o cambia el horario.
const ETIQUETA: Record<EstadoReserva, string> = {
  pendiente: "Pedido: falta que el negocio lo confirme",
  confirmada: "Confirmado",
  cancelada: "Cancelado",
  completada: "Atendido",
  ausente: "No asististe",
};

const QUE_SIGUE: Record<EstadoReserva, string> = {
  pendiente: "El negocio lo tiene que confirmar. Si dejaste tu WhatsApp, te avisa por ahí.",
  confirmada: "Te esperamos. Si no podés ir, cancelalo o cambialo desde acá.",
  cancelada: "Este turno quedó libre.",
  completada: "¡Gracias por venir!",
  ausente: "El negocio marcó que no asististe.",
};

export default function ReservaSeguimiento() {
  const { id = "" } = useParams();
  const t = new URLSearchParams(window.location.search).get("t") || "";
  const uid = useId();
  const [r, setR] = useState<(ReservaCliente & { negocio_id?: number }) | null | "no">(null);
  const [modo, setModo] = useState<"ver" | "cambiar" | "cancelar">("ver");
  const [fecha, setFecha] = useState(fechaAR());
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [inicio, setInicio] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    reservasPublico.ver(id, t).then(setR).catch(() => setR("no"));
  }, [id, t]);

  const negocioId = r && r !== "no" ? r.negocio_id : undefined;
  useEffect(() => {
    if (modo !== "cambiar" || !r || r === "no" || !negocioId) return;
    let vivo = true;
    reservasPublico
      .horariosDe(r, negocioId, fecha, t)
      .then((h) => vivo && setHorarios(h))
      .catch(() => vivo && setHorarios([]));
    return () => {
      vivo = false;
    };
  }, [modo, fecha, r, negocioId, t]);

  if (!r) return <Cargando />;
  if (r === "no") return <NoEncontrado titulo="Turno no encontrado" texto="Revisá que el link esté completo, tal como te llegó." />;

  const hacer = async (fn: () => Promise<ReservaCliente>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      const nuevo = await fn();
      setR({ ...r, ...nuevo });
      setModo("ver");
      setMsg({ ok: true, texto: ok });
    } catch (e) {
      setMsg({ ok: false, texto: getErrorMessage(e, "No se pudo hacer el cambio.") });
    } finally {
      setOcupado(false);
    }
  };
  const wa = waNegocio(r.negocio, `Hola, te escribo por mi turno del ${fechaLargaAR(r.inicio)}.`);
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(fechaAR(), i));

  return (
    <Hoja negocio={r.negocio?.nombre} titulo="Tu turno">
      <div className="grid gap-5">
        <div>
          <p className="text-[1.25rem] font-bold first-letter:uppercase">{fechaLargaAR(r.inicio)}</p>
          <p className="mt-1 text-[15px]">{r.servicio_nombre} · a nombre de {r.cliente_nombre}</p>
          <p className="mt-2 inline-block rounded-full bg-[var(--bg-2)] px-3 py-1 text-[13px] font-bold">{ETIQUETA[r.estado]}</p>
          <p className="mt-2 text-[15px] text-[var(--fg-2)]">{QUE_SIGUE[r.estado]}</p>
        </div>
        <p role="status" tabIndex={-1} ref={(el) => { if (el && msg) el.focus(); }} className={`text-[14px] font-semibold ${msg?.ok === false ? "text-[var(--err)]" : ""}`}>{msg?.texto || ""}</p>

        {r.modificable && modo === "ver" && (
          <div className="grid gap-2">
            <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => { setModo("cambiar"); setHorarios(null); setInicio(""); }}>
              Cambiar el horario
            </button>
            <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => setModo("cancelar")}>
              Cancelar el turno
            </button>
          </div>
        )}

        {modo === "cancelar" && (
          <div className="grid gap-2 rounded-[var(--r-sm)] bg-[var(--bg-2)] p-3" role="group" aria-label="Confirmar cancelación">
            <p className="text-[14px] font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>¿Cancelar el turno? Queda libre para otra persona.</p>
            <button type="button" className="mn-btn w-full" disabled={ocupado} onClick={() => hacer(() => reservasPublico.cancelar(id, t), "Tu turno quedó cancelado.")}>
              Sí, cancelar
            </button>
            <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => setModo("ver")}>Volver</button>
          </div>
        )}

        {modo === "cambiar" && (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); if (inicio) hacer(() => reservasPublico.reprogramar(id, t, inicio), "Listo: cambiaste el horario."); }}>
            <fieldset className="min-w-0">
              <legend className="mn-field-label">Nuevo día</legend>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                {dias.map((d) => (
                  <label key={d} className="mn-chip mn-cat shrink-0 cursor-pointer capitalize" aria-pressed={fecha === d}>
                    <input type="radio" name={`${uid}-dia`} className="sr-only" checked={fecha === d} onChange={() => { setFecha(d); setHorarios(null); setInicio(""); }} />
                    {d === fechaAR() ? "Hoy" : diaCortoAR(d)}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="min-w-0">
              <legend className="mn-field-label">Nuevo horario</legend>
              {!horarios && <p role="status" className="mt-2 text-[14px] text-[var(--fg-2)]">Buscando horarios…</p>}
              {horarios?.length === 0 && <p className="mt-2 text-[14px] text-[var(--fg-2)]">No quedan horarios este día.</p>}
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {horarios?.map((h) => (
                  <label key={h} className="mn-opcion justify-center !gap-0" aria-checked={inicio === h}>
                    <input type="radio" name={`${uid}-hora`} className="sr-only" checked={inicio === h} onChange={() => setInicio(h)} />
                    <span className="mn-num text-[15px] font-semibold">{horaAR(h)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="mn-btn w-full" disabled={!inicio || ocupado}>Confirmar el cambio</button>
            <button type="button" className="mn-btn mn-btn-borde w-full" onClick={() => setModo("ver")}>Volver</button>
          </form>
        )}

        {!r.modificable && (r.estado === "pendiente" || r.estado === "confirmada") && (
          <p className="text-[14px] text-[var(--fg-2)]">Falta poco para el turno: para cambiarlo, escribile al negocio.</p>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="mn-btn mn-btn-borde w-full">
            Escribir al negocio por WhatsApp
          </a>
        )}
        {["cancelada", "completada", "ausente"].includes(r.estado) && r.negocio?.slug && (
          <a href={`/negocio/${r.negocio.slug}/reservar`} className="mn-btn w-full">Reservar otro turno</a>
        )}
        <p className="text-[13px] text-[var(--fg-2)]">Guardá este link para volver a ver o cambiar tu turno.</p>
      </div>
    </Hoja>
  );
}
