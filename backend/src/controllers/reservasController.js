const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const { getNegocioId } = require("../utils/negocio");
const { modulosNegocio } = require("../middleware/requiereModulo");
const { firmaValida, linkPedido } = require("../utils/linksPedido");
const { horariosLibres, opcionesAgenda, fechaLocal } = require("../utils/agenda");
const { negocioPublico } = require("./presupuestosController");
const { notificarReserva } = require("../services/avisosPedidoService");
// Aviso por WhatsApp en segundo plano: nunca demora ni rompe la respuesta.
const avisar = (fn, obj, clave) => Promise.resolve().then(() => fn(obj, clave)).catch((e) => console.error("[Avisos] fallo en segundo plano:", e.message));


// ══════════════════════════════════════════════════════════════
// Reservas (turnos). Proceso propio: no se mezcla con pedidos.
//   pendiente → confirmada → completada | ausente
//   cancelada desde pendiente o confirmada
// La base impide dos turnos activos superpuestos (EXCLUDE en reservas):
// si dos clientes eligen el mismo horario a la vez, el segundo recibe 409.
// ══════════════════════════════════════════════════════════════

const ACTIVAS = ["pendiente", "confirmada"];
const MIN = 60 * 1000;
const SOLAPADO = "23P01"; // exclusion_violation
const MAX_ACTIVAS = 3;

const registrar = (r, estado, autor, extra = {}) =>
  supabase
    .from("reserva_eventos")
    .insert([{ reserva_id: r.id, negocio_id: r.negocio_id, estado, autor, ...extra }])
    .then(({ error }) => error && console.error("[Reservas] historial:", error.message));

async function servicioDe(negocioId, servicioId) {
  const { data, error } = await supabase
    .from("servicios")
    .select("id, nombre, duracion_min, activo")
    .eq("id", servicioId)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  if (error) throw error;
  return data && data.activo !== false ? data : null;
}

// "YYYY-MM-DD" que existe de verdad (no 2026-02-30).
const fechaValida = (f) =>
  /^\d{4}-\d{2}-\d{2}$/.test(f || "") && !Number.isNaN(new Date(`${f}T12:00:00-03:00`).getTime()) &&
  fechaLocal(new Date(`${f}T12:00:00-03:00`)) === f;

// Horarios del negocio + opciones + turnos activos y bloqueos de ese día.
async function datosDelDia(negocioId, fecha, excluirReserva) {
  const desde = new Date(`${fecha}T00:00:00-03:00`).toISOString();
  const hasta = new Date(new Date(desde).getTime() + 24 * 60 * MIN).toISOString();
  const [cfg, res, blo] = await Promise.all([
    supabase.from("configuracion").select("*").eq("negocio_id", negocioId).maybeSingle(),
    supabase.from("reservas").select("id, inicio, fin").eq("negocio_id", negocioId).in("estado", ACTIVAS).lt("inicio", hasta).gt("fin", desde),
    supabase.from("agenda_bloqueos").select("desde, hasta").eq("negocio_id", negocioId).lt("desde", hasta).gt("hasta", desde),
  ]);
  for (const r of [cfg, res, blo]) if (r.error) throw r.error;
  return {
    horariosConfig: cfg.data?.horarios_config || null,
    agenda: cfg.data?.agenda || null,
    ocupados: (res.data || []).filter((r) => r.id !== excluirReserva),
    bloqueos: blo.data || [],
  };
}

// ¿Este inicio está libre para este servicio? → { inicio, fin } o null.
async function validarHorario(negocioId, servicio, inicioISO, excluirReserva, { panel = false } = {}) {
  const inicio = new Date(inicioISO);
  if (Number.isNaN(inicio.getTime())) return null;
  const fecha = fechaLocal(inicio);
  const dia = await datosDelDia(negocioId, fecha, excluirReserva);
  // El negocio puede cargar o mover turnos para ya mismo (sin anticipación).
  const agenda = panel ? { ...(dia.agenda || {}), anticipacion_min: 0 } : dia.agenda;
  const libres = horariosLibres({ fecha, duracion: servicio.duracion_min, ...dia, agenda });
  if (!libres.includes(inicio.toISOString())) return null;
  const dur = servicio.duracion_min || opcionesAgenda(dia.agenda).paso_min;
  return { inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + dur * MIN).toISOString(), agenda: dia.agenda };
}

const publico = (r) => ({
  id: r.id,
  estado: r.estado,
  servicio_nombre: r.servicio_nombre,
  servicio_id: r.servicio_id,
  inicio: r.inicio,
  fin: r.fin,
  cliente_nombre: r.cliente_nombre,
});

// ── Público ──────────────────────────────────────────────────

// GET /api/reservas/disponibilidad?negocio=&servicio=&fecha=YYYY-MM-DD
const disponibilidad = async (req, res) => {
  try {
    const negocioId = await negocioPublico(req);
    if (!negocioId || !(await modulosNegocio(negocioId)).reservas) return res.json({ horarios: [] });
    const servicio = await servicioDe(negocioId, parseInt(req.query.servicio, 10));
    if (!servicio) return res.status(404).json({ message: "Servicio no encontrado." });
    const fecha = String(req.query.fecha || "");
    if (!fechaValida(fecha)) return res.json({ horarios: [] });
    // Al reprogramar desde su link, el cliente no choca con su propio turno.
    let excluir;
    const rid = parseInt(req.query.excluir, 10);
    if (Number.isInteger(rid) && firmaValida("reserva", rid, negocioId, req.query.t)) excluir = rid;
    const dia = await datosDelDia(negocioId, fecha, excluir);
    res.json({ horarios: horariosLibres({ fecha, duracion: servicio.duracion_min, ...dia }), duracion: servicio.duracion_min || null });
  } catch (error) {
    return respondError(res, error, "reservas.disponibilidad");
  }
};

// POST /api/reservas?negocio=  (body validado con zod)
const crearReserva = async (req, res) => {
  try {
    const negocioId = await negocioPublico(req);
    if (!negocioId) return res.status(404).json({ message: "Negocio no encontrado." });
    if (!(await modulosNegocio(negocioId)).reservas) {
      return res.status(403).json({ error: "MODULO_INACTIVO", message: "Este negocio no toma turnos online." });
    }
    const b = req.body;
    const servicio = await servicioDe(negocioId, b.servicio_id);
    if (!servicio) return res.status(400).json({ message: "Ese servicio ya no está disponible." });
    const h = await validarHorario(negocioId, servicio, b.inicio);
    if (!h) return res.status(409).json({ message: "Ese horario ya no está libre. Elegí otro." });

    // Nadie acapara la agenda: hasta MAX_ACTIVAS turnos futuros por contacto.
    const contacto = b.telefono ? ["telefono", b.telefono] : ["email", b.email];
    const { count, error: cErr } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId)
      .eq(contacto[0], contacto[1])
      .in("estado", ACTIVAS)
      .gte("inicio", new Date(Date.now()).toISOString());
    if (cErr) throw cErr;
    if ((count || 0) >= MAX_ACTIVAS) {
      return res.status(429).json({ message: "Ya tenés varios turnos pedidos. Para otro, escribile al negocio." });
    }

    const { data: r, error } = await supabase
      .from("reservas")
      .insert([
        {
          negocio_id: negocioId,
          servicio_id: servicio.id,
          servicio_nombre: servicio.nombre,
          cliente_nombre: b.cliente_nombre,
          telefono: b.telefono || null,
          email: b.email || null,
          acepta_whatsapp: b.acepta_whatsapp === true && !!b.telefono,
          notas: b.notas || null,
          inicio: h.inicio,
          fin: h.fin,
          estado: opcionesAgenda(h.agenda).confirmacion === "automatica" ? "confirmada" : "pendiente",
          origen: "cliente",
        },
      ])
      .select()
      .single();
    if (error?.code === SOLAPADO) return res.status(409).json({ message: "Ese horario se acaba de ocupar. Elegí otro." });
    if (error) throw error;
    await registrar(r, r.estado, "cliente");
    // Con confirmación automática, el turno ya queda confirmado: se avisa.
    if (r.estado === "confirmada") avisar(notificarReserva, r, "reserva.confirmada");
    res.status(201).json({ ...publico(r), link: linkPedido("reserva", r) });
  } catch (error) {
    return respondError(res, error, "reservas.crear");
  }
};

async function delLink(req) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return null;
  const { data, error } = await supabase.from("reservas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || !firmaValida("reserva", data.id, data.negocio_id, req.query?.t)) return null;
  return data;
}

// El cliente puede cancelar o reprogramar hasta la anticipación mínima.
const aTiempo = (r, agenda) => new Date(r.inicio).getTime() - Date.now() >= opcionesAgenda(agenda).anticipacion_min * MIN;
const agendaDe = async (negocioId) => {
  const [{ data }, { data: neg }] = await Promise.all([
    supabase.from("configuracion").select("*").eq("negocio_id", negocioId).maybeSingle(),
    supabase.from("negocios").select("slug").eq("id", negocioId).maybeSingle(),
  ]);
  return {
    agenda: data?.agenda || null,
    negocio: data ? { nombre: data.nombre, whatsapp: data.whatsapp, telefono: data.telefono, slug: neg?.slug || null } : null,
  };
};

// GET /api/reservas/:id/publico?t=
const verPublico = async (req, res) => {
  try {
    const r = await delLink(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    const { agenda, negocio } = await agendaDe(r.negocio_id);
    // negocio_id: para pedir horarios libres al reprogramar.
    res.json({ ...publico(r), negocio_id: r.negocio_id, modificable: ACTIVAS.includes(r.estado) && aTiempo(r, agenda), negocio });
  } catch (error) {
    return respondError(res, error, "reservas.ver");
  }
};

// POST /api/reservas/:id/cancelar?t=
const cancelarCliente = async (req, res) => {
  try {
    const r = await delLink(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    const { agenda } = await agendaDe(r.negocio_id);
    if (!ACTIVAS.includes(r.estado) || !aTiempo(r, agenda)) {
      return res.status(409).json({ message: "Este turno ya no se puede cancelar desde acá. Escribile al negocio." });
    }
    const hecho = await pasar(r, r.estado, { estado: "cancelada" });
    if (!hecho) return res.status(409).json({ message: "El turno cambió. Recargá." });
    await registrar(r, "cancelada", "cliente");
    res.json(publico(hecho));
  } catch (error) {
    return respondError(res, error, "reservas.cancelar");
  }
};

// Reprogramar: mismo servicio, otro horario libre. Queda el anterior en el historial.
async function reprogramar(r, nuevoInicio, autor, usuarioId, opciones) {
  const servicio = (r.servicio_id && (await servicioDe(r.negocio_id, r.servicio_id))) || { nombre: r.servicio_nombre, duracion_min: Math.round((new Date(r.fin) - new Date(r.inicio)) / MIN) };
  const h = await validarHorario(r.negocio_id, servicio, nuevoInicio, r.id, opciones);
  if (!h) return { status: 409, message: "Ese horario no está libre. Elegí otro." };
  const { data, error } = await supabase
    .from("reservas")
    .update({ inicio: h.inicio, fin: h.fin, updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .eq("negocio_id", r.negocio_id)
    .in("estado", ACTIVAS)
    .select()
    .maybeSingle();
  if (error?.code === SOLAPADO) return { status: 409, message: "Ese horario se acaba de ocupar. Elegí otro." };
  if (error) throw error;
  if (!data) return { status: 409, message: "El turno cambió. Recargá." };
  await registrar(r, data.estado, autor, { usuario_id: usuarioId ?? null, inicio_anterior: r.inicio, nota: "Reprogramado" });
  return { data };
}

// POST /api/reservas/:id/reprogramar?t=  { inicio }
const reprogramarCliente = async (req, res) => {
  try {
    const r = await delLink(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    const { agenda } = await agendaDe(r.negocio_id);
    if (!ACTIVAS.includes(r.estado) || !aTiempo(r, agenda)) {
      return res.status(409).json({ message: "Este turno ya no se puede cambiar desde acá. Escribile al negocio." });
    }
    const out = await reprogramar(r, req.body.inicio, "cliente");
    if (out.status) return res.status(out.status).json({ message: out.message });
    res.json(publico(out.data));
  } catch (error) {
    return respondError(res, error, "reservas.reprogramar");
  }
};

// Cambio de estado atómico (sólo si sigue como se leyó).
async function pasar(r, desde, cambios) {
  const { data, error } = await supabase
    .from("reservas")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", r.id)
    .eq("negocio_id", r.negocio_id)
    .eq("estado", desde)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Panel ────────────────────────────────────────────────────

const delNegocio = async (req) => {
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .eq("id", parseInt(req.params.id, 10))
    .eq("negocio_id", getNegocioId(req))
    .maybeSingle();
  if (error) throw error;
  return data;
};

// GET /api/reservas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (hasta incluido)
const listar = async (req, res) => {
  try {
    const hoy = fechaLocal(new Date(Date.now()));
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || "") ? req.query.desde : hoy;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || "") ? req.query.hasta : desde;
    const fin = new Date(new Date(`${hasta}T00:00:00-03:00`).getTime() + 24 * 60 * MIN).toISOString();
    const { data, error } = await supabase
      .from("reservas")
      .select("*")
      .eq("negocio_id", getNegocioId(req))
      .gte("inicio", new Date(`${desde}T00:00:00-03:00`).toISOString())
      .lt("inicio", fin)
      .order("inicio", { ascending: true })
      .limit(500);
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "reservas.listar");
  }
};

// GET /api/reservas/:id → con historial y link del cliente.
const ver = async (req, res) => {
  try {
    const r = await delNegocio(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    const { data: ev } = await supabase
      .from("reserva_eventos")
      .select("estado, autor, nota, inicio_anterior, created_at")
      .eq("reserva_id", r.id)
      .eq("negocio_id", r.negocio_id)
      .order("created_at");
    res.json({ ...r, eventos: ev || [], link: linkPedido("reserva", r) });
  } catch (error) {
    return respondError(res, error, "reservas.ver");
  }
};

// PATCH /api/reservas/:id/estado  { estado }
const TRANSICIONES = {
  pendiente: ["confirmada", "cancelada"],
  confirmada: ["completada", "ausente", "cancelada"],
};
const cambiarEstado = async (req, res) => {
  try {
    const r = await delNegocio(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    const { estado } = req.body;
    if (!(TRANSICIONES[r.estado] || []).includes(estado)) {
      return res.status(409).json({ message: "Ese cambio no se puede hacer en el estado actual." });
    }
    const hecho = await pasar(r, r.estado, { estado });
    if (!hecho) return res.status(409).json({ message: "El turno cambió. Recargá." });
    await registrar(r, estado, "negocio", { usuario_id: req.user?.id ?? null });
    // El negocio confirmó o canceló: se le avisa al cliente (si aceptó).
    if (estado === "confirmada") avisar(notificarReserva, hecho, "reserva.confirmada");
    if (estado === "cancelada") avisar(notificarReserva, hecho, "reserva.cancelada");
    res.json(hecho);
  } catch (error) {
    return respondError(res, error, "reservas.estado");
  }
};

// POST /api/reservas/:id/reprogramar  { inicio }
const reprogramarPanel = async (req, res) => {
  try {
    const r = await delNegocio(req);
    if (!r) return res.status(404).json({ message: "Turno no encontrado." });
    if (!ACTIVAS.includes(r.estado)) return res.status(409).json({ message: "Sólo se reprograma un turno pendiente o confirmado." });
    const out = await reprogramar(r, req.body.inicio, "negocio", req.user?.id, { panel: true });
    if (out.status) return res.status(out.status).json({ message: out.message });
    avisar(notificarReserva, out.data, "reserva.reprogramada");
    res.json(out.data);
  } catch (error) {
    return respondError(res, error, "reservas.reprogramar");
  }
};

// POST /api/reservas/manual  (turno que carga el negocio; queda confirmado)
const crearManual = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const b = req.body;
    const servicio = await servicioDe(negocioId, b.servicio_id);
    if (!servicio) return res.status(400).json({ message: "Elegí un servicio activo." });
    const h = await validarHorario(negocioId, servicio, b.inicio, undefined, { panel: true });
    if (!h) return res.status(409).json({ message: "Ese horario no está libre." });
    const { data: r, error } = await supabase
      .from("reservas")
      .insert([
        {
          negocio_id: negocioId,
          servicio_id: servicio.id,
          servicio_nombre: servicio.nombre,
          cliente_nombre: b.cliente_nombre,
          telefono: b.telefono || null,
          email: b.email || null,
          notas: b.notas || null,
          inicio: h.inicio,
          fin: h.fin,
          estado: "confirmada",
          origen: "panel",
        },
      ])
      .select()
      .single();
    if (error?.code === SOLAPADO) return res.status(409).json({ message: "Ese horario se acaba de ocupar." });
    if (error) throw error;
    await registrar(r, "confirmada", "negocio", { usuario_id: req.user?.id ?? null });
    res.status(201).json(r);
  } catch (error) {
    return respondError(res, error, "reservas.manual");
  }
};

// GET /api/reservas/horarios?servicio=&fecha= (panel: mismos huecos que ve el cliente)
const horariosPanel = async (req, res) => {
  try {
    const negocioId = getNegocioId(req);
    const servicio = await servicioDe(negocioId, parseInt(req.query.servicio, 10));
    if (!servicio) return res.status(404).json({ message: "Servicio no encontrado." });
    const fecha = String(req.query.fecha || "");
    if (!fechaValida(fecha)) return res.json({ horarios: [] });
    const excluir = parseInt(req.query.excluir, 10) || undefined;
    const dia = await datosDelDia(negocioId, fecha, excluir);
    // El negocio puede cargar turnos para ya mismo (sin anticipación mínima).
    const agenda = { ...(dia.agenda || {}), anticipacion_min: 0 };
    res.json({ horarios: horariosLibres({ fecha, duracion: servicio.duracion_min, ...dia, agenda }) });
  } catch (error) {
    return respondError(res, error, "reservas.horarios");
  }
};

// ── Bloqueos (feriados, vacaciones) ──
const listarBloqueos = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agenda_bloqueos")
      .select("*")
      .eq("negocio_id", getNegocioId(req))
      .gte("hasta", new Date().toISOString())
      .order("desde");
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    return respondError(res, error, "reservas.bloqueos");
  }
};
const crearBloqueo = async (req, res) => {
  try {
    const { desde, hasta, motivo } = req.body;
    const { data, error } = await supabase
      .from("agenda_bloqueos")
      .insert([{ negocio_id: getNegocioId(req), desde, hasta, motivo: motivo || null }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    return respondError(res, error, "reservas.bloqueos");
  }
};
const borrarBloqueo = async (req, res) => {
  try {
    const { error } = await supabase
      .from("agenda_bloqueos")
      .delete()
      .eq("id", parseInt(req.params.id, 10))
      .eq("negocio_id", getNegocioId(req));
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    return respondError(res, error, "reservas.bloqueos");
  }
};

// GET /api/reservas/resumen → turnos por confirmar desde hoy y el primero.
const resumen = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("reservas")
      .select("inicio")
      .eq("negocio_id", getNegocioId(req))
      .eq("estado", "pendiente")
      .gte("inicio", new Date().toISOString())
      .order("inicio", { ascending: true })
      .limit(200);
    if (error) throw error;
    res.json({ por_confirmar: (data || []).length, primera: data?.[0] ? fechaLocal(data[0].inicio) : null });
  } catch (error) {
    return respondError(res, error, "reservas.resumen");
  }
};

module.exports = {
  resumen,
  disponibilidad,
  crearReserva,
  verPublico,
  cancelarCliente,
  reprogramarCliente,
  listar,
  ver,
  cambiarEstado,
  reprogramarPanel,
  crearManual,
  horariosPanel,
  listarBloqueos,
  crearBloqueo,
  borrarBloqueo,
};
