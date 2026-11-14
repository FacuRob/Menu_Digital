const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), { notificarPedido: async () => {}, avisosDisponibles: async () => false });
const { tiposActivos, programable, validarProgramado, normalizarModalidades } = require("../src/utils/entregas");
const { createPedido } = require("../src/controllers/pedidosController");
const { getConfiguracion } = require("../src/controllers/configuracionController");
const { olvidarModulos } = require("../src/middleware/requiereModulo");
const { LEGADO } = require("../src/utils/modulos");

const HORARIOS = [0, 1, 2, 3, 4, 5, 6].map(() => ({ cerrado: false, franjas: [{ desde: "09:00", hasta: "21:00" }] }));
const BASE = { negocio_id: 3, retiro_activo: true, delivery_activo: true, mesas_activo: false, mesas_cantidad: 0, horarios_config: HORARIOS };

// ── Reglas puras ──
test("tipos activos: los de siempre + mostrador y envío según modalidades; sin entregas, ninguno", () => {
  assert.deepEqual(tiposActivos(BASE, LEGADO), { mesa: false, retiro: true, delivery: true, mostrador: false, envio: false });
  const cfg = { ...BASE, modalidades: { mostrador: true, envio: true } };
  assert.deepEqual(tiposActivos(cfg, LEGADO), { mesa: false, retiro: true, delivery: true, mostrador: true, envio: true });
  assert.equal(Object.values(tiposActivos(cfg, { ...LEGADO, entregas: false })).some(Boolean), false);
});

test("programable: retiro con retiro_programado; delivery y envío con entrega_programada", () => {
  const cfg = { modalidades: { retiro_programado: true } };
  assert.equal(programable(cfg, "retiro"), true);
  assert.equal(programable(cfg, "delivery"), false);
  assert.equal(programable({ modalidades: { entrega_programada: true } }, "envio"), true);
  assert.equal(programable(cfg, "mesa"), false);
  assert.deepEqual(normalizarModalidades({ mostrador: "si", envio: true, otra: true }), { mostrador: false, envio: true, retiro_programado: false, entrega_programada: false });
});

test("validarProgramado: anticipación, máximo de días y horario de atención", () => {
  const ahora = new Date("2026-11-16T10:00:00-03:00");
  assert.ok(validarProgramado("2026-11-16T10:10:00-03:00", BASE, ahora).error); // menos de 30 min
  assert.ok(validarProgramado("2027-01-30T12:00:00-03:00", BASE, ahora).error); // más de 30 días
  assert.ok(validarProgramado("2026-11-16T23:00:00-03:00", BASE, ahora).error); // cerrado
  assert.equal(validarProgramado("2026-11-16T20:00:00-03:00", BASE, ahora).valor, new Date("2026-11-16T23:00:00Z").toISOString());
  assert.ok(validarProgramado("nunca", BASE, ahora).error);
});

test("validarProgramado: franja que pasa la medianoche y horarios vacíos", () => {
  const ahora = new Date("2026-11-16T10:00:00-03:00");
  const noche = [0, 1, 2, 3, 4, 5, 6].map(() => ({ cerrado: false, franjas: [{ desde: "20:00", hasta: "02:00" }] }));
  assert.ok(validarProgramado("2026-11-17T01:00:00-03:00", { horarios_config: noche }, ahora).valor);
  assert.ok(validarProgramado("2026-11-17T03:00:00-03:00", { horarios_config: noche }, ahora).error);
  assert.ok(validarProgramado("2026-11-17T03:00:00-03:00", { horarios_config: [] }, ahora).valor);
});

// ── Pedido ──
let cfg, ops, negocio;
beforeEach(() => {
  olvidarModulos(3);
  ops = [];
  negocio = { id: 3, modulos: { ...LEGADO } };
  cfg = { ...BASE, modalidades: { mostrador: true, envio: true, retiro_programado: true, entrega_programada: false } };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "configuracion") return { data: cfg, error: null };
    if (q.table === "productos" && q.op === "select") return { data: [{ id: 1, nombre: "Café", precio: 1000, costo: 0, disponible: true }], error: null };
    if (q.table === "rpc:crear_pedido") return { data: { pedido: { id: 8, ...q.payload.p_pedido }, items: [] }, error: null };
    return { data: [], error: null };
  });
});
const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const pedir = async (extra) => {
  const res = respuesta();
  await createPedido({ negocioId: 3, body: { items: [{ producto_id: 1, cantidad: 1 }], cliente: "Ana", ...extra } }, res);
  return res;
};
const enviado = () => ops.find((o) => o.table === "rpc:crear_pedido")?.payload.p_pedido;

test("pedido: mostrador y envío se aceptan si están activos", async () => {
  assert.equal((await pedir({ tipo_entrega: "mostrador" })).code, 201);
  assert.equal(enviado().tipo_entrega, "mostrador");
  ops = [];
  assert.equal((await pedir({ tipo_entrega: "envio", direccion_entrega: "Av. Mitre 123, Tucumán, CP 4000", telefono_cliente: "381" })).code, 201);
});

test("pedido: envío sin dirección completa → 400; modalidad apagada → 400", async () => {
  assert.equal((await pedir({ tipo_entrega: "envio", direccion_entrega: "Mitre", telefono_cliente: "381" })).code, 400);
  assert.equal((await pedir({ tipo_entrega: "envio", direccion_entrega: "Av. Mitre 123, Tucumán, CP 4000" })).code, 400);
  cfg.modalidades = { mostrador: false };
  assert.equal((await pedir({ tipo_entrega: "mostrador" })).code, 400);
});

test("pedido: retiro programado válido se guarda; programar delivery sin permiso → 400", async () => {
  const realNow = Date.now;
  Date.now = () => new Date("2026-11-16T10:00:00-03:00").getTime();
  try {
    const ok = await pedir({ tipo_entrega: "retiro", telefono_cliente: "381", programado_para: "2026-11-16T18:00:00-03:00" });
    assert.equal(ok.code, 201);
    assert.equal(enviado().programado_para, new Date("2026-11-16T21:00:00Z").toISOString());
    const no = await pedir({ tipo_entrega: "delivery", direccion_entrega: "Mitre 1", telefono_cliente: "381", programado_para: "2026-11-16T18:00:00-03:00" });
    assert.equal(no.code, 400);
  } finally {
    Date.now = realNow;
  }
});

test("pedido sin programar: no manda la columna (anda sin la migración)", async () => {
  await pedir({ tipo_entrega: "retiro", telefono_cliente: "381" });
  assert.equal("programado_para" in enviado(), false);
});

test("configuración pública: modalidades normalizadas; sin entregas, todas apagadas", async () => {
  const r1 = respuesta();
  await getConfiguracion({ headers: { "x-negocio-id": "3" }, query: {} }, r1);
  assert.equal(r1.body.modalidades.mostrador, true);
  olvidarModulos(3);
  negocio.modulos = { ...LEGADO, entregas: false };
  const r2 = respuesta();
  await getConfiguracion({ headers: { "x-negocio-id": "3" }, query: {} }, r2);
  assert.equal(Object.values(r2.body.modalidades).some(Boolean), false);
});
