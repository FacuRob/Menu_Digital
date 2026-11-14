import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import Modal from "../../components/Modal";
import { EmptyState } from "../../components/ui";
import { useStyles } from "../../components/sharedStyles";
import { useDialogos } from "../../lib/dialogos";
import { useLang } from "../../lib/i18n";
import { diaLargoAR, fechaAR, fechaHoraAR, horaAR, sumarDias, waLink } from "../../lib/fechas";
import { IconPlus } from "../../lib/icons";
import {
  configuracionService,
  getApiErrorMessage,
  reservasService,
  serviciosService,
  type AgendaOpciones,
  type Bloqueo,
  type EstadoReserva,
  type Reserva,
  type Servicio,
} from "../../services/api";

// Agenda de turnos del día. Los horarios de atención son los de
// Configuración → Horarios; acá se ven y gestionan los turnos.

const COLOR: Record<EstadoReserva, string> = {
  pendiente: "var(--warn)",
  confirmada: "var(--ok)",
  cancelada: "var(--fg-3)",
  completada: "var(--info)",
  ausente: "var(--err)",
};
const AGENDA_DEF: AgendaOpciones = { paso_min: 30, anticipacion_min: 60, dias_max: 30, confirmacion: "manual" };

export default function Turnos() {
  const { t } = useLang();
  const s = useStyles();
  const { confirmar } = useDialogos();
  const uid = useId();
  const [fecha, setFecha] = useState(fechaAR());
  const [turnos, setTurnos] = useState<Reserva[] | null>(null);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  // Alta manual / reprogramar: mismo formulario de elegir horario.
  const [form, setForm] = useState<null | { reprogramar?: Reserva; servicio_id: number; fecha: string; inicio: string; cliente: string; telefono: string }>(null);
  const [libres, setLibres] = useState<string[] | null>(null);
  const [formError, setFormError] = useState("");
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [bloq, setBloq] = useState({ fecha: fechaAR(), desde: "", hasta: "", motivo: "" });
  const [agenda, setAgenda] = useState<AgendaOpciones>(AGENDA_DEF);
  const [ajustes, setAjustes] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // Turnos por confirmar en otros días (para no perderlos).
  const [porConfirmar, setPorConfirmar] = useState<{ por_confirmar: number; primera: string | null } | null>(null);
  useEffect(() => {
    reservasService.resumen().then(setPorConfirmar).catch(() => {});
  }, [turnos]);

  const cargar = useCallback(() => {
    reservasService
      .listar(fecha, fecha)
      .then((l) => {
        setTurnos(l);
        setError("");
      })
      .catch((e) => setError(getApiErrorMessage(e, t("turErrCargar"))));
  }, [fecha, t]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    serviciosService.getAll().then((l) => setServicios(l.filter((x) => x.activo))).catch(() => {});
    reservasService.bloqueos().then(setBloqueos).catch(() => {});
    configuracionService.get().then((c) => setAgenda({ ...AGENDA_DEF, ...(c.agenda || {}) })).catch(() => {});
  }, []);

  // Horarios libres para el formulario.
  useEffect(() => {
    if (!form?.servicio_id || !form.fecha) return;
    let vivo = true;
    reservasService
      .horarios(form.servicio_id, form.fecha, form.reprogramar?.id)
      .then((h) => vivo && setLibres(h))
      .catch(() => vivo && setLibres([]));
    return () => {
      vivo = false;
    };
  }, [form?.servicio_id, form?.fecha, form?.reprogramar?.id]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    if (ocupado) return;
    setMsg("");
    setOcupado(true);
    try {
      await fn();
      setMsg(ok);
      cargar();
      window.dispatchEvent(new Event("agenda-cambio"));
    } catch (e) {
      setMsg(getApiErrorMessage(e, t("turErrAccion")));
    } finally {
      setOcupado(false);
    }
  };

  const guardarForm = async () => {
    if (!form) return;
    if (!form.inicio) return setFormError(t("turFaltaHorario"));
    if (!form.reprogramar && !form.cliente.trim()) return setFormError(t("turFaltaCliente"));
    setFormError("");
    try {
      if (form.reprogramar) await reservasService.reprogramar(form.reprogramar.id, form.inicio);
      else
        await reservasService.manual({
          servicio_id: form.servicio_id,
          inicio: form.inicio,
          cliente_nombre: form.cliente.trim(),
          telefono: form.telefono.trim() || null,
        });
      setForm(null);
      setFecha(form.fecha);
      cargar();
      setMsg(form.reprogramar ? t("turReprogramado") : t("turCreado"));
    } catch (e) {
      setFormError(getApiErrorMessage(e, t("turErrAccion")));
      // El horario pudo ocuparse: se vuelven a pedir los libres.
      reservasService.horarios(form.servicio_id, form.fecha, form.reprogramar?.id).then(setLibres).catch(() => {});
    }
  };

  const agregarBloqueo = async () => {
    if (!bloq.fecha) return setMsg(t("turBloqueoFecha"));
    if (bloq.desde && bloq.hasta && bloq.hasta <= bloq.desde) return setMsg(t("turBloqueoOrden"));
    const desde = new Date(`${bloq.fecha}T${bloq.desde || "00:00"}:00-03:00`);
    const hasta = bloq.hasta ? new Date(`${bloq.fecha}T${bloq.hasta}:00-03:00`) : new Date(`${sumarDias(bloq.fecha, 1)}T00:00:00-03:00`);
    try {
      await reservasService.crearBloqueo({ desde: desde.toISOString(), hasta: hasta.toISOString(), motivo: bloq.motivo || null });
      setBloqueos(await reservasService.bloqueos());
      setBloq({ ...bloq, desde: "", hasta: "", motivo: "" });
      setMsg(t("turBloqueoOk"));
    } catch (e) {
      setMsg(getApiErrorMessage(e, t("turErrAccion")));
    }
  };

  const guardarAgenda = async () => {
    if (agenda.paso_min < 5 || agenda.paso_min > 240) return setMsg(t("turPasoInvalido"));
    if (agenda.dias_max < 1 || agenda.dias_max > 365) return setMsg(t("turDiasInvalido"));
    if (agenda.anticipacion_min < 0) return setMsg(t("turAnticipacionInvalida"));
    try {
      await configuracionService.update({ agenda });
      setMsg(t("turAgendaGuardada"));
    } catch (e) {
      setMsg(getApiErrorMessage(e, t("turErrAccion")));
    }
  };

  const nuevo = () => {
    if (!servicios.length) return setMsg(t("turSinServicios"));
    setLibres(null);
    setFormError("");
    setForm({ servicio_id: servicios[0].id, fecha, inicio: "", cliente: "", telefono: "" });
  };

  const botonDia = (n: number, txt: string) => (
    <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => setFecha(sumarDias(fecha, n))}>{txt}</button>
  );

  return (
    <AdminLayout title={t("navTurnos")}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{diaLargoAR(fecha)}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14 }}>
            {t("turSub")} <Link to="/admin/configuracion" style={{ color: "var(--info)" }}>{t("turHorariosLink")}</Link>
          </p>
        </div>
        {botonDia(-1, "←")}
        <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => setFecha(fechaAR())}>{t("turHoy")}</button>
        {botonDia(1, "→")}
        <label htmlFor={`${uid}-dia`} className="sr-only">{t("turIrAFecha")}</label>
        <input id={`${uid}-dia`} type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} style={{ ...s.input, width: "auto", minHeight: 44 }} />
        <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} onClick={nuevo}>
          <IconPlus size={14} /> {t("turNuevo")}
        </button>
      </div>

      {!!porConfirmar?.por_confirmar && porConfirmar.primera && porConfirmar.primera !== fecha && (
        <p style={{ margin: "0 0 10px", padding: "10px 12px", borderRadius: 10, background: "var(--warn-bg, var(--surface-2))", color: "var(--fg)", fontWeight: 600 }}>
          {t("turPorConfirmar", { n: porConfirmar.por_confirmar })}{" "}
          <button type="button" style={{ ...s.btnGhost, minHeight: 44, marginLeft: 6 }} onClick={() => setFecha(porConfirmar.primera!)}>
            {t("turIrAlPrimero")}
          </button>
        </p>
      )}
      <p role="status" style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--fg)" }}>{msg}</p>
      {error && <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{error}</p>}
      {!turnos && !error && <p role="status" style={{ color: "var(--fg-3)" }}>{t("subLoading")}</p>}
      {turnos?.length === 0 && <EmptyState title={t("turVacio")} desc={t("turVacioDesc")} />}

      {!!turnos?.length && (
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {turnos.map((r) => (
            <li key={r.id} style={{ ...s.card, padding: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 18, color: "var(--fg)", minWidth: 110 }}>{horaAR(r.inicio)}–{horaAR(r.fin)}</strong>
              <span style={{ flex: "1 1 200px", color: "var(--fg)" }}>
                <strong>{r.cliente_nombre}</strong> · {r.servicio_nombre}
                {r.notas && <span style={{ display: "block", fontSize: 13, color: "var(--fg-2)" }}>{r.notas}</span>}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COLOR[r.estado] }}>{t(`turEst_${r.estado}`)}</span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {r.estado === "pendiente" && (
                  <button type="button" disabled={ocupado} style={{ ...s.btnPrimary, minHeight: 44 }} onClick={() => accion(() => reservasService.estado(r.id, "confirmada"), t("turConfirmado"))}>
                    {t("turConfirmar")}
                  </button>
                )}
                {r.estado === "confirmada" && (
                  <>
                    <button type="button" disabled={ocupado} style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => accion(() => reservasService.estado(r.id, "completada"), t("turEst_completada"))}>
                      {t("turVino")}
                    </button>
                    <button type="button" disabled={ocupado} style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => accion(() => reservasService.estado(r.id, "ausente"), t("turEst_ausente"))}>
                      {t("turNoVino")}
                    </button>
                  </>
                )}
                {(r.estado === "pendiente" || r.estado === "confirmada") && (
                  <>
                    <button type="button" style={{ ...s.btnGhost, minHeight: 44 }}
                      onClick={() => {
                        setLibres(null);
                        setFormError("");
                        setForm({ reprogramar: r, servicio_id: r.servicio_id || 0, fecha: fechaAR(r.inicio), inicio: "", cliente: r.cliente_nombre, telefono: r.telefono || "" });
                      }}>
                      {t("turReprogramar")}
                    </button>
                    <button type="button" style={{ ...s.btnGhost, minHeight: 44, color: "var(--err)" }}
                      onClick={async () => {
                        if (await confirmar({ mensaje: t("turConfirmCancelar", { n: r.cliente_nombre }), peligro: true }))
                          accion(() => reservasService.estado(r.id, "cancelada"), t("turEst_cancelada"));
                      }}>
                      {t("turCancelar")}
                    </button>
                  </>
                )}
                {r.telefono && (
                  <a href={waLink(r.telefono, t("turWa", { n: r.cliente_nombre, f: fechaHoraAR(r.inicio) }))} target="_blank" rel="noopener noreferrer"
                    style={{ ...s.btnGhost, minHeight: 44, textDecoration: "none" }} aria-label={`${t("turEscribir")}: ${r.cliente_nombre}`}>
                    {t("turEscribir")}
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Días sin atención y opciones */}
      <section style={{ ...s.card, padding: 14, marginTop: 20, display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--fg)" }}>{t("turBloqueos")}</h3>
        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)" }}>{t("turBloqueosSub")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div>
            <label htmlFor={`${uid}-bf`} style={s.label}>{t("turFecha")}</label>
            <input id={`${uid}-bf`} type="date" style={s.input} value={bloq.fecha} onChange={(e) => setBloq({ ...bloq, fecha: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-bd`} style={s.label}>{t("turDesde")}</label>
            <input id={`${uid}-bd`} type="time" style={s.input} value={bloq.desde} onChange={(e) => setBloq({ ...bloq, desde: e.target.value })} />
          </div>
          <div>
            <label htmlFor={`${uid}-bh`} style={s.label}>{t("turHasta")}</label>
            <input id={`${uid}-bh`} type="time" style={s.input} value={bloq.hasta} onChange={(e) => setBloq({ ...bloq, hasta: e.target.value })} />
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <label htmlFor={`${uid}-bm`} style={s.label}>{t("turMotivo")}</label>
            <input id={`${uid}-bm`} style={s.input} maxLength={120} value={bloq.motivo} placeholder={t("turMotivoPh")} onChange={(e) => setBloq({ ...bloq, motivo: e.target.value })} />
          </div>
          <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={agregarBloqueo}>{t("turAgregarBloqueo")}</button>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-2)" }}>{t("turBloqueoAyuda")}</p>
        {bloqueos.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            {bloqueos.map((b) => (
              <li key={b.id} style={{ color: "var(--fg)", fontSize: 14 }}>
                {fechaHoraAR(b.desde)} → {fechaHoraAR(b.hasta)} {b.motivo && `· ${b.motivo}`}{" "}
                <button type="button" style={{ ...s.btnDanger, minHeight: 44, padding: "0 6px" }}
                  onClick={async () => {
                    if (!(await confirmar({ mensaje: t("turConfirmBorrarBloqueo") }))) return;
                    try {
                      await reservasService.borrarBloqueo(b.id);
                    } catch (e) {
                      setMsg(getApiErrorMessage(e, t("turErrAccion")));
                    }
                    setBloqueos(await reservasService.bloqueos().catch(() => []));
                  }}>
                  {t("actionDelete")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" aria-expanded={ajustes} style={{ ...s.btnGhost, minHeight: 44, justifySelf: "start" }} onClick={() => setAjustes((v) => !v)}>
          {t("turOpciones")}
        </button>
        {ajustes && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", alignItems: "end" }}>
            {([
              ["paso_min", "turPaso"],
              ["anticipacion_min", "turAnticipacion"],
              ["dias_max", "turDiasMax"],
            ] as const).map(([k, key]) => (
              <div key={k}>
                <label htmlFor={`${uid}-${k}`} style={s.label}>{t(key)}</label>
                <input id={`${uid}-${k}`} type="number" min={k === "anticipacion_min" ? 0 : k === "paso_min" ? 5 : 1} style={s.input}
                  value={agenda[k]} onChange={(e) => setAgenda({ ...agenda, [k]: parseInt(e.target.value, 10) || 0 })} />
              </div>
            ))}
            <div>
              <label htmlFor={`${uid}-conf`} style={s.label}>{t("turConfirmacion")}</label>
              <select id={`${uid}-conf`} style={{ ...s.input, cursor: "pointer" }} value={agenda.confirmacion}
                onChange={(e) => setAgenda({ ...agenda, confirmacion: e.target.value as AgendaOpciones["confirmacion"] })}>
                <option value="manual">{t("turConfManual")}</option>
                <option value="automatica">{t("turConfAuto")}</option>
              </select>
            </div>
            <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} onClick={guardarAgenda}>{t("actionSave")}</button>
          </div>
        )}
      </section>

      {form && (
        <Modal title={form.reprogramar ? t("turReprogramarTit") : t("turNuevo")} subtitle={form.reprogramar?.cliente_nombre} onClose={() => setForm(null)} maxWidth={560}>
          <form
            style={{ ...s.modalBody, display: "grid", gap: 12 }}
            onSubmit={(e) => {
              e.preventDefault();
              guardarForm();
            }}
          >
            {!form.reprogramar && (
              <div>
                <label htmlFor={`${uid}-sv`} style={s.label}>{t("turServicio")}</label>
                <select id={`${uid}-sv`} style={{ ...s.input, cursor: "pointer" }} value={form.servicio_id}
                  onChange={(e) => {
                    setLibres(null);
                    setForm({ ...form, servicio_id: Number(e.target.value), inicio: "" });
                  }}>
                  {servicios.map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.duracion_min ? ` (${x.duracion_min} min)` : ""}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor={`${uid}-ff`} style={s.label}>{t("turFecha")}</label>
              <input id={`${uid}-ff`} type="date" style={s.input} value={form.fecha} min={fechaAR()}
                onChange={(e) => {
                  setLibres(null);
                  setForm({ ...form, fecha: e.target.value, inicio: "" });
                }} />
            </div>
            <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
              <legend style={s.label}>{t("turHorario")}</legend>
              {!form.servicio_id && <p style={{ margin: 0, color: "var(--fg-2)" }}>{t("turSinServicio")}</p>}
              {!!form.servicio_id && !libres && <p role="status" style={{ margin: 0, color: "var(--fg-3)" }}>{t("subLoading")}</p>}
              {libres?.length === 0 && <p style={{ margin: 0, color: "var(--fg-2)" }}>{t("turSinHorarios")}</p>}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {libres?.map((h) => {
                  const on = form.inicio === h;
                  return (
                    <label key={h} style={{ ...(on ? s.btnPrimary : s.btnGhost), minHeight: 44, cursor: "pointer" }}>
                      <input type="radio" name={`${uid}-hora`} className="sr-only" checked={on} onChange={() => setForm({ ...form, inicio: h })} />
                      {horaAR(h)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {!form.reprogramar && (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                <div>
                  <label htmlFor={`${uid}-cl`} style={s.label}>{t("turCliente")}</label>
                  <input id={`${uid}-cl`} style={s.input} maxLength={120} value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
                </div>
                <div>
                  <label htmlFor={`${uid}-tel`} style={s.label}>{t("turTelefono")}</label>
                  <input id={`${uid}-tel`} type="tel" style={s.input} maxLength={40} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
                </div>
              </div>
            )}
            {formError && <p role="alert" style={{ margin: 0, color: "var(--err)", fontWeight: 600 }}>{formError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => setForm(null)}>{t("actionCancel")}</button>
              <button type="submit" style={{ ...s.btnPrimary, minHeight: 44 }}>{t("actionSave")}</button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
