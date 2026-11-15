const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-prueba";
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
// Avisos de WhatsApp: se anota qué aviso se mandó (el envío real se prueba aparte).
const avisos = [];
injectModule(require.resolve("../src/services/avisosPedidoService"), {
  notificarPedido: async () => {},
  avisosDisponibles: async () => false,
  notificarPresupuesto: async (p, clave) => avisos.push(clave),
  notificarReserva: async (r, clave) => avisos.push(clave),
});
const { horariosLibres, opcionesAgenda, fechaLocal } = require("../src/utils/agenda");
const { firmar } = require("../src/utils/linksPedido");
const pres = require("../src/controllers/presupuestosController");
const resv = require("../src/controllers/reservasController");
const { olvidarModulos } = require("../src/middleware/requiereModulo");
const { LEGADO } = require("../src/utils/modulos");
const sch = require("../src/schemas");

// Lunes a viernes 9–13; sábado y domingo cerrado. 0 = lunes.
const HORARIOS = [0, 1, 2, 3, 4, 5, 6].map((i) => (i < 5 ? { cerrado: false, franjas: [{ desde: "09:00", hasta: "13:00" }] } : { cerrado: true, franjas: [] }));
const LUNES = "2026-11-16";
const AHORA = new Date("2026-11-15T12:00:00-03:00"); // domingo al mediodía

// ── Agenda (pura) ──
test("agenda: turnos de 30 min cada 30 en la franja del día", () => {
  const l = horariosLibres({ fecha: LUNES, horariosConfig: HORARIOS, duracion: 30, ahora: AHORA });
  assert.equal(l.length, 8);
  assert.equal(l[0], new Date(`${LUNES}T09:00:00-03:00`).toISOString());
  assert.equal(l.at(-1), new Date(`${LUNES}T12:30:00-03:00`).toISOString());
});

test("agenda: un servicio de 90 min no se pasa del cierre", () => {
  const l = horariosLibres({ fecha: LUNES, horariosConfig: HORARIOS, duracion: 90, ahora: AHORA });
  assert.equal(l.at(-1), new Date(`${LUNES}T11:30:00-03:00`).toISOString());
});

test("agenda: saca turnos ocupados, bloqueos, días cerrados y lo que no llega a la anticipación", () => {
  const ocupados = [{ inicio: `${LUNES}T10:00:00-03:00`, fin: `${LUNES}T11:00:00-03:00` }];
  const bloqueos = [{ desde: `${LUNES}T12:00:00-03:00`, hasta: `${LUNES}T13:00:00-03:00` }];
  const l = horariosLibres({ fecha: LUNES, horariosConfig: HORARIOS, duracion: 30, ocupados, bloqueos, ahora: AHORA });
  const horas = l.map((x) => new Date(new Date(x).getTime() - 3 * 3600e3).toISOString().slice(11, 16));
  assert.deepEqual(horas, ["09:00", "09:30", "11:00", "11:30"]);
  assert.deepEqual(horariosLibres({ fecha: "2026-11-21", horariosConfig: HORARIOS, duracion: 30, ahora: AHORA }), []); // sábado
  // Con anticipación de 1 h, a las 9:10 del lunes ya no sirve 9:30 ni 10:00.
  const casi = horariosLibres({ fecha: LUNES, horariosConfig: HORARIOS, duracion: 30, ahora: new Date(`${LUNES}T09:10:00-03:00`) });
  assert.equal(casi[0], new Date(`${LUNES}T10:30:00-03:00`).toISOString());
  assert.deepEqual(horariosLibres({ fecha: LUNES, horariosConfig: null, duracion: 30, ahora: AHORA }), []);
  assert.deepEqual(horariosLibres({ fecha: "mañana", horariosConfig: HORARIOS, duracion: 30, ahora: AHORA }), []);
});

test("agenda: opciones con valores por defecto y límites", () => {
  assert.deepEqual(opcionesAgenda(null), { paso_min: 30, anticipacion_min: 60, dias_max: 30, confirmacion: "manual" });
  assert.equal(opcionesAgenda({ paso_min: 1 }).paso_min, 30);
  assert.equal(opcionesAgenda({ confirmacion: "automatica" }).confirmacion, "automatica");
  assert.equal(fechaLocal("2026-11-17T01:30:00Z"), "2026-11-16"); // 22:30 del lunes en Argentina
});

// ── Mock de base ──
const NEG = 9;
let negocio, ops, filas, rpcResp;
const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
beforeEach(() => {
  olvidarModulos(NEG);
  ops = [];
  rpcResp = null;
  negocio = { id: NEG, activo: true, modulos: { ...LEGADO, servicios: true, presupuestos: true, reservas: true } };
  filas = {
    presupuestos: { id: 3, negocio_id: NEG, estado: "cotizado", precio_cotizado: 15000, valido_hasta: null, cliente_nombre: "Ana", telefono: "381", descripcion: "Mueble", referencia: "Mesa", cantidad: 1, producto_id: null },
    reservas: { id: 5, negocio_id: NEG, estado: "confirmada", servicio_id: 2, servicio_nombre: "Corte", inicio: `${LUNES}T10:00:00-03:00`, fin: `${LUNES}T10:30:00-03:00` },
  };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload, inList: q.inList });
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "productos") return { data: q.filters.negocio_id === NEG ? { id: 1, nombre: "Mesa" } : null, error: null };
    if (q.table === "servicios") return { data: q.filters.negocio_id === NEG ? { id: 2, nombre: "Corte", duracion_min: 30, activo: true } : null, error: null };
    if (q.table === "configuracion") return { data: { negocio_id: NEG, horarios_config: HORARIOS, agenda: null, nombre: "Pelu" }, error: null };
    if (q.table === "rpc:crear_pedido") return rpcResp || { data: null, error: null };
    if (q.table === "presupuestos" || q.table === "reservas") {
      if (q.op === "insert") return { data: { id: 40, ...q.payload[0] }, error: null };
      if (q.op === "update") {
        const f = filas[q.table];
        if (q.filters.estado && f.estado !== q.filters.estado) return { data: null, error: null };
        return { data: { ...f, ...q.payload }, error: null };
      }
      if (q.op === "select" && q.filters.id) return { data: filas[q.table].negocio_id === (q.filters.negocio_id ?? NEG) ? filas[q.table] : null, error: null };
      return { data: [], error: null };
    }
    if (q.table === "adjuntos" && q.op === "update") return { data: [{ id: 1 }], error: null };
    return { data: [], error: null };
  });
});
const pub = (body, extra = {}) => ({ query: { negocio: String(NEG) }, headers: {}, body, ...extra });

// ── Presupuestos ──
test("presupuesto: el cliente lo pide y recibe su link firmado", async () => {
  const res = respuesta();
  await pres.crearPresupuesto(pub(sch.presupuestoSchema.parse({ cliente_nombre: "Ana", telefono: "381", descripcion: "Una mesa de 2 m", producto_id: 1, adjuntos: ["a".repeat(48)] })), res);
  assert.equal(res.code, 201);
  assert.match(res.body.link, /\/presupuesto\/40\?t=/);
  assert.ok(avisos.includes("presupuesto.recibido"));
  const ins = ops.find((o) => o.table === "presupuestos" && o.op === "insert").payload[0];
  assert.deepEqual([ins.negocio_id, ins.referencia], [NEG, "Mesa"]);
  const adj = ops.find((o) => o.table === "adjuntos");
  assert.deepEqual([adj.filters.negocio_id, adj.filters.usado, adj.payload.contexto], [NEG, false, "presupuesto"]);
});

test("presupuesto: sin módulo 403; producto de otro negocio 400; negocio sin id 404", async () => {
  negocio.modulos = { ...LEGADO };
  const r1 = respuesta();
  await pres.crearPresupuesto(pub({ cliente_nombre: "A", descripcion: "xxxxx", cantidad: 1 }), r1);
  assert.equal(r1.code, 403);
  olvidarModulos(NEG);
  negocio.modulos = { ...LEGADO, presupuestos: true };
  db.setHandler((q) => (q.table === "negocios" ? { data: negocio, error: null } : { data: null, error: null }));
  const r2 = respuesta();
  await pres.crearPresupuesto(pub({ cliente_nombre: "A", descripcion: "xxxxx", cantidad: 1, producto_id: 99 }), r2);
  assert.equal(r2.code, 400);
  const r3 = respuesta();
  await pres.crearPresupuesto({ query: {}, headers: {}, body: {} }, r3);
  assert.equal(r3.code, 404);
});

test("presupuesto público: firma inválida 404; antes de cotizar no muestra precio", async () => {
  const mal = respuesta();
  await pres.verPublico({ params: { id: "3" }, query: { t: "x".repeat(22) } }, mal);
  assert.equal(mal.code, 404);
  filas.presupuestos.estado = "en_revision";
  const ok = respuesta();
  await pres.verPublico({ params: { id: "3" }, query: { t: firmar("presupuesto", 3, NEG) } }, ok);
  assert.equal(ok.body.precio_cotizado, null);
  // La firma de un pedido no sirve para el presupuesto.
  const otro = respuesta();
  await pres.verPublico({ params: { id: "3" }, query: { t: firmar("ticket", 3, NEG) } }, otro);
  assert.equal(otro.code, 404);
});

test("presupuesto: el cliente acepta una cotización vigente; vencida no", async () => {
  const t = firmar("presupuesto", 3, NEG);
  const ok = respuesta();
  await pres.responderCliente({ params: { id: "3" }, query: { t }, body: { decision: "aceptar" } }, ok);
  assert.equal(ok.body.estado, "aceptado");
  filas.presupuestos.valido_hasta = "2020-01-01";
  const venc = respuesta();
  await pres.responderCliente({ params: { id: "3" }, query: { t }, body: { decision: "aceptar" } }, venc);
  assert.equal(venc.code, 409);
});

test("presupuesto: cotizar sólo desde estados abiertos y pasa a cotizado", async () => {
  filas.presupuestos.estado = "en_revision";
  const ok = respuesta();
  await pres.cotizar({ negocioId: NEG, params: { id: "3" }, user: { id: 1 }, body: { precio: 20000 } }, ok);
  assert.equal(ok.body.estado, "cotizado");
  assert.equal(ok.body.precio_cotizado, 20000);
  assert.equal(avisos.at(-1), "presupuesto.cotizado");
  filas.presupuestos.estado = "convertido";
  const no = respuesta();
  await pres.cotizar({ negocioId: NEG, params: { id: "3" }, user: { id: 1 }, body: { precio: 1 } }, no);
  assert.equal(no.code, 409);
});

test("presupuesto: aceptado → pedido con el precio cotizado (una sola vez)", async () => {
  filas.presupuestos.estado = "aceptado";
  rpcResp = { data: { pedido: { id: 77, negocio_id: NEG, total: 15000 }, items: [] }, error: null };
  const res = respuesta();
  await pres.convertir({ negocioId: NEG, params: { id: "3" }, user: { id: 1 } }, res);
  assert.equal(res.body.pedido.id, 77);
  const rpc = ops.find((o) => o.table === "rpc:crear_pedido").payload;
  assert.deepEqual([rpc.p_pedido.total, rpc.p_items[0].precio_unit, rpc.p_pedido.negocio_id], [15000, 15000, NEG]);
  filas.presupuestos.estado = "convertido";
  const otra = respuesta();
  await pres.convertir({ negocioId: NEG, params: { id: "3" }, user: { id: 1 } }, otra);
  assert.equal(otra.code, 409);
});

test("presupuesto: si falla crear el pedido, vuelve a aceptado", async () => {
  filas.presupuestos.estado = "aceptado";
  rpcResp = { data: null, error: { code: "XX000", message: "falló" } };
  const res = respuesta();
  await pres.convertir({ negocioId: NEG, params: { id: "3" }, user: { id: 1 } }, res);
  assert.equal(res.code, 500);
  const vuelta = ops.filter((o) => o.table === "presupuestos" && o.op === "update").pop();
  assert.equal(vuelta.payload.estado, "aceptado");
});

test("presupuesto: otro negocio no lo ve", async () => {
  const res = respuesta();
  await pres.ver({ negocioId: 123, params: { id: "3" } }, res);
  assert.equal(res.code, 404);
});

// ── Reservas ──
const INICIO = new Date(`${LUNES}T09:30:00-03:00`).toISOString();
test("reserva: horario libre → se crea pendiente con link; ocupado → 409", async () => {
  const realNow = Date.now;
  Date.now = () => AHORA.getTime();
  try {
    const ok = respuesta();
    await resv.crearReserva(pub(sch.reservaSchema.parse({ servicio_id: 2, inicio: INICIO, cliente_nombre: "Ana", telefono: "381" })), ok);
    assert.equal(ok.code, 201);
    assert.equal(ok.body.estado, "pendiente");
    assert.match(ok.body.link, /\/reserva\/40\?t=/);
    const ins = ops.find((o) => o.table === "reservas" && o.op === "insert").payload[0];
    assert.deepEqual([ins.negocio_id, ins.servicio_nombre, ins.fin], [NEG, "Corte", new Date(`${LUNES}T10:00:00-03:00`).toISOString()]);

    const fuera = respuesta();
    await resv.crearReserva(pub({ servicio_id: 2, inicio: new Date(`${LUNES}T08:00:00-03:00`).toISOString(), cliente_nombre: "B", telefono: "1" }), fuera);
    assert.equal(fuera.code, 409);
  } finally {
    Date.now = realNow;
  }
});

test("reserva: si la base detecta superposición (carrera), 409", async () => {
  const realNow = Date.now;
  Date.now = () => AHORA.getTime();
  const base = db;
  db.setHandler((q) => {
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "servicios") return { data: { id: 2, nombre: "Corte", duracion_min: 30, activo: true }, error: null };
    if (q.table === "configuracion") return { data: { horarios_config: HORARIOS }, error: null };
    if (q.table === "reservas" && q.op === "insert") return { data: null, error: { code: "23P01", message: "exclusion" } };
    return { data: [], error: null };
  });
  try {
    const res = respuesta();
    await resv.crearReserva(pub({ servicio_id: 2, inicio: INICIO, cliente_nombre: "Ana", telefono: "381" }), res);
    assert.equal(res.code, 409);
  } finally {
    Date.now = realNow;
    void base;
  }
});

test("reserva: el cliente no cancela fuera de término", async () => {
  const realNow = Date.now;
  Date.now = () => new Date(`${LUNES}T09:30:00-03:00`).getTime(); // 30 min antes (anticipación 60)
  try {
    const res = respuesta();
    await resv.cancelarCliente({ params: { id: "5" }, query: { t: firmar("reserva", 5, NEG) } }, res);
    assert.equal(res.code, 409);
  } finally {
    Date.now = realNow;
  }
});

test("reserva (panel): transiciones válidas y conflicto si cambió en el medio", async () => {
  const no = respuesta();
  await resv.cambiarEstado({ negocioId: NEG, params: { id: "5" }, user: { id: 1 }, body: { estado: "confirmada" } }, no);
  assert.equal(no.code, 409); // ya está confirmada
  const ok = respuesta();
  await resv.cambiarEstado({ negocioId: NEG, params: { id: "5" }, user: { id: 1 }, body: { estado: "completada" } }, ok);
  assert.equal(ok.body.estado, "completada");
});

test("reserva (panel): reprogramar deja el horario anterior en el historial", async () => {
  const realNow = Date.now;
  Date.now = () => AHORA.getTime();
  try {
    const res = respuesta();
    await resv.reprogramarPanel({ negocioId: NEG, params: { id: "5" }, user: { id: 1 }, body: { inicio: new Date(`${LUNES}T11:00:00-03:00`).toISOString() } }, res);
    assert.equal(res.code, 200);
    const ev = ops.find((o) => o.table === "reserva_eventos").payload[0];
    assert.equal(ev.inicio_anterior, filas.reservas.inicio);
    assert.equal(avisos.at(-1), "reserva.reprogramada");
  } finally {
    Date.now = realNow;
  }
});

test("esquemas: presupuesto sin contacto, reserva sin fecha válida y bloqueo al revés se rechazan", () => {
  assert.equal(sch.presupuestoSchema.safeParse({ cliente_nombre: "A", descripcion: "una mesa" }).success, false);
  assert.equal(sch.reservaSchema.safeParse({ servicio_id: 1, inicio: "mañana", cliente_nombre: "A", telefono: "1" }).success, false);
  assert.equal(sch.bloqueoSchema.safeParse({ desde: "2026-11-20T10:00:00-03:00", hasta: "2026-11-20T09:00:00-03:00" }).success, false);
  assert.equal(sch.cotizacionSchema.safeParse({ precio: 100, valido_hasta: "2026-12-01" }).success, true);
});

test("presupuesto: sin el módulo de pedidos no se pasa a pedido", async () => {
  negocio.modulos = { ...LEGADO, pedidos: false, entregas: false, presupuestos: true };
  filas.presupuestos.estado = "aceptado";
  const res = respuesta();
  await pres.convertir({ negocioId: NEG, params: { id: "3" }, user: { id: 1 } }, res);
  assert.equal(res.code, 403);
  assert.equal(ops.some((o) => o.table === "presupuestos" && o.op === "update"), false);
});

// ── Correcciones de la revisión ──
test("rutas: reprogramar del panel no queda tapada por la pública", () => {
  const src = require("fs").readFileSync(require.resolve("../src/server.js"), "utf8");
  assert.match(src, /app\.post\("\/api\/reservas\/:id\/reagendar", \.\.\.resMw/);
  assert.equal((src.match(/"\/api\/reservas\/:id\/reprogramar"/g) || []).length, 1); // sólo la pública
});

test("reserva: más de 3 turnos activos del mismo teléfono → 429", async () => {
  const realNow = Date.now;
  Date.now = () => AHORA.getTime();
  db.setHandler((q) => {
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "servicios") return { data: { id: 2, nombre: "Corte", duracion_min: 30, activo: true }, error: null };
    if (q.table === "configuracion") return { data: { horarios_config: HORARIOS }, error: null };
    if (q.table === "reservas" && q.selectOpts?.head) return { data: null, count: 3, error: null };
    return { data: [], error: null };
  });
  try {
    const res = respuesta();
    await resv.crearReserva(pub({ servicio_id: 2, inicio: INICIO, cliente_nombre: "Ana", telefono: "381" }), res);
    assert.equal(res.code, 429);
  } finally {
    Date.now = realNow;
  }
});

test("disponibilidad: fecha imposible → sin horarios (no 500)", async () => {
  const res = respuesta();
  await resv.disponibilidad({ query: { negocio: String(NEG), servicio: "2", fecha: "2026-02-30" }, headers: {} }, res);
  assert.deepEqual(res.body, { horarios: [] });
});

test("alta manual: el contacto es opcional; cotizar con validez vencida → 400", async () => {
  assert.equal(sch.reservaManualSchema.safeParse({ servicio_id: 1, inicio: INICIO, cliente_nombre: "Mostrador" }).success, true);
  filas.presupuestos.estado = "en_revision";
  const res = respuesta();
  await pres.cotizar({ negocioId: NEG, params: { id: "3" }, user: { id: 1 }, body: { precio: 10, valido_hasta: "2020-01-01" } }, res);
  assert.equal(res.code, 400);
});
