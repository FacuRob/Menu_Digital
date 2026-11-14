import { useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Cargando, Hoja, NoEncontrado } from "../components/HojaNegocio";
import { useNegocioPublico } from "../lib/negocioPublico";
import { getErrorMessage, reservasPublico, serviciosService, type Servicio } from "../services/api";
import { diaCortoAR, fechaAR, horaAR, sumarDias } from "../lib/fechas";

// Reservar un turno: /negocio/:slug/reservar[?servicio=…]
// 1) servicio, 2) día, 3) horario libre, 4) datos.
const DIAS = 14;

export default function Reservar() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const neg = useNegocioPublico(slug);
  const uid = useId();
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [servicioId, setServicioId] = useState<number | null>(() => parseInt(new URLSearchParams(window.location.search).get("servicio") || "", 10) || null);
  const [fecha, setFecha] = useState(fechaAR());
  const [horarios, setHorarios] = useState<string[] | null>(null);
  const [inicio, setInicio] = useState("");
  const [f, setF] = useState({ nombre: "", telefono: "", email: "", notas: "", wa: true });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Si el día elegido no tiene horarios, se salta solo al siguiente (una vez
  // por servicio, hasta 7 días): así no se arranca en "no quedan horarios".
  const [saltos, setSaltos] = useState(0);
  useEffect(() => {
    if (horarios?.length === 0 && saltos < 7 && !inicio) {
      setSaltos((n) => n + 1);
      setFecha((d) => sumarDias(d, 1));
      setHorarios(null);
    }
  }, [horarios, saltos, inicio]);

  useEffect(() => {
    if (!neg || neg === "no") return;
    serviciosService
      .getDisponibles(neg.id)
      .then((l) => {
        setServicios(l);
        setServicioId((id) => (id && l.some((x) => x.id === id) ? id : l.length === 1 ? l[0].id : null));
      })
      .catch(() => setServicios([]));
  }, [neg]);

  useEffect(() => {
    if (!neg || neg === "no" || !servicioId) return;
    let vivo = true;
    reservasPublico
      .horarios(neg.id, servicioId, fecha)
      .then((h) => vivo && setHorarios(h))
      .catch(() => vivo && setHorarios([]));
    return () => {
      vivo = false;
    };
  }, [neg, servicioId, fecha]);

  if (!neg || (neg !== "no" && !servicios)) return <Cargando />;
  if (neg === "no") return <NoEncontrado titulo="Negocio no encontrado" texto="Revisá que el link esté completo." />;

  const servicio = servicios!.find((x) => x.id === servicioId) || null;
  const elegirDia = (d: string) => {
    setSaltos(7); // el cliente eligió: no se salta más
    setFecha(d);
    setHorarios(null);
    setInicio("");
  };

  const enviar = async () => {
    setError("");
    if (!servicioId) return setError("Elegí un servicio.");
    if (!inicio) return setError("Elegí un horario.");
    if (!f.nombre.trim()) return setError("Poné tu nombre.");
    if (!f.telefono.trim() && !f.email.trim()) return setError("Dejá un teléfono o un email.");
    setEnviando(true);
    try {
      const r = await reservasPublico.reservar(neg.id, {
        servicio_id: servicioId,
        inicio,
        cliente_nombre: f.nombre.trim(),
        telefono: f.telefono.trim() || null,
        email: f.email.trim() || null,
        notas: f.notas.trim() || null,
        acepta_whatsapp: f.wa && !!f.telefono.trim(),
      });
      const url = new URL(r.link!);
      navigate(`${url.pathname}${url.search}`);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo reservar. Probá de nuevo."));
      // El horario se pudo ocupar: se vuelven a pedir (los datos quedan).
      setInicio("");
      document.getElementById(campo("horarios"))?.scrollIntoView({ block: "center" });
      reservasPublico.horarios(neg.id, servicioId, fecha).then(setHorarios).catch(() => {});
    } finally {
      setEnviando(false);
    }
  };

  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(fechaAR(), i));
  const campo = (k: string) => `${uid}-${k}`;

  return (
    <Hoja negocio={neg.config?.nombre} config={neg.config} titulo="Reservá tu turno" volver={`/negocio/${slug}`}>
      {servicios!.length === 0 ? (
        <p className="text-[15px]">Este negocio todavía no tiene servicios para reservar online.</p>
      ) : (
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <fieldset className="min-w-0">
            <legend className="mn-field-label">1. Servicio</legend>
            <div className="mt-2 grid gap-2">
              {servicios!.map((s) => (
                <label key={s.id} className="mn-opcion" aria-checked={servicioId === s.id}>
                  <input type="radio" name={campo("sv")} className="sr-only" checked={servicioId === s.id}
                    onChange={() => {
                      setServicioId(s.id);
                      setHorarios(null);
                      setInicio("");
                      setSaltos(0);
                    }} />
                  <span className="mn-marca" aria-hidden>{servicioId === s.id && <span className="h-2 w-2 rounded-full bg-current" />}</span>
                  <span className="flex-1 text-[15px] font-semibold">{s.nombre}</span>
                  {s.duracion_min && <span className="text-[13px] text-[var(--fg-2)]">{s.duracion_min} min</span>}
                </label>
              ))}
            </div>
          </fieldset>

          {servicio && (
            <fieldset className="min-w-0">
              <legend className="mn-field-label">2. Día</legend>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                {dias.map((d) => (
                  <label key={d} className="mn-chip mn-cat shrink-0 cursor-pointer capitalize" aria-pressed={fecha === d}>
                    <input type="radio" name={campo("dia")} className="sr-only" checked={fecha === d} onChange={() => elegirDia(d)} />
                    {d === fechaAR() ? "Hoy" : diaCortoAR(d)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {servicio && (
            <fieldset className="min-w-0">
              <legend className="mn-field-label" id={campo("horarios")}>3. Horario</legend>
              {!horarios && <p role="status" className="mt-2 text-[14px] text-[var(--fg-2)]">Buscando horarios…</p>}
              <p role="status" className="mt-2 text-[14px] text-[var(--fg-2)]">
                {horarios?.length === 0 ? "No quedan horarios este día. Probá otro." : horarios ? `${horarios.length} horarios libres` : ""}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {horarios?.map((h) => (
                  <label key={h} className="mn-opcion justify-center !gap-0" aria-checked={inicio === h}>
                    <input type="radio" name={campo("hora")} className="sr-only" checked={inicio === h}
                      onChange={() => {
                        setInicio(h);
                        requestAnimationFrame(() => document.getElementById(campo("nom"))?.scrollIntoView({ block: "center", behavior: "smooth" }));
                      }} />
                    <span className="mn-num text-[15px] font-semibold">{horaAR(h)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {(inicio || f.nombre) && (
            <fieldset className="grid min-w-0 gap-4 border-t border-[var(--line)] pt-5">
              <legend className="mn-field-label">4. Tus datos</legend>
              <label htmlFor={campo("nom")} className="block">
                <span className="mn-field-label">Nombre</span>
                <input id={campo("nom")} className="mn-field" maxLength={120} required autoComplete="name" value={f.nombre}
                  onChange={(e) => setF({ ...f, nombre: e.target.value })} />
              </label>
              <label htmlFor={campo("tel")} className="block">
                <span className="mn-field-label">Teléfono</span>
                <input id={campo("tel")} className="mn-field" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" value={f.telefono}
                  onChange={(e) => setF({ ...f, telefono: e.target.value })} />
              </label>
              <label htmlFor={campo("mail")} className="block">
                <span className="mn-field-label">Email (si no dejás teléfono)</span>
                <input id={campo("mail")} className="mn-field" type="email" maxLength={160} autoComplete="email" value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })} />
              </label>
              <label htmlFor={campo("not")} className="block">
                <span className="mn-field-label">Algo que debamos saber (opcional)</span>
                <textarea id={campo("not")} className="mn-field" rows={2} maxLength={500} value={f.notas}
                  onChange={(e) => setF({ ...f, notas: e.target.value })} />
              </label>
              {f.telefono.trim() && (
                <label className="mn-opcion items-start" aria-checked={f.wa}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={f.wa} onChange={(e) => setF({ ...f, wa: e.target.checked })} />
                  <span className="text-[15px]">Quiero recibir avisos del turno por WhatsApp</span>
                </label>
              )}
            </fieldset>
          )}

          {error && <p role="alert" className="text-[14px] font-semibold text-[var(--err)]">{error}</p>}
          {(inicio || f.nombre) && (
            <button type="submit" className="mn-btn w-full" disabled={enviando} aria-busy={enviando}>
              {enviando ? "Reservando…" : inicio ? `Reservar ${diaCortoAR(fecha)} a las ${horaAR(inicio)}` : "Elegí un horario"}
            </button>
          )}
        </form>
      )}
    </Hoja>
  );
}
