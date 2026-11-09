const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.CLOUDINARY_CLOUD_NAME = "demo";
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const avisos = [];
injectModule(require.resolve("../src/services/emailService"), {
  sendSoporteAviso: async (a) => avisos.push(a),
});

const soporte = require("../src/controllers/soporteController");

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => ((r.statusCode = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const cliente = (cuenta_id = 7) => ({ id: 50, cuenta_id, es_plataforma: false });
const tech = { id: 1, cuenta_id: 1, es_plataforma: true };
const IMG = "https://res.cloudinary.com/demo/image/upload/v1/menu-digital/soporte/abc.png";

const ticket = (extra = {}) => ({
  id: 9, cuenta_id: 7, tipo: "error", asunto: "No carga", estado: "abierto",
  sin_leer_tech: true, sin_leer_cliente: false, cuentas: { nombre: "Bar" }, ...extra,
});

beforeEach(() => {
  avisos.length = 0;
  db.setHandler(() => ({ data: null, error: null }));
});

test("imagen: sólo capturas subidas a la carpeta de soporte", () => {
  assert.equal(soporte.esImagenNuestra(IMG), true);
  assert.equal(soporte.esImagenNuestra("https://evil.com/menu-digital/soporte/x.png"), false);
  assert.equal(soporte.esImagenNuestra("https://res.cloudinary.com/otro/image/upload/menu-digital/soporte/x.png"), false);
  assert.equal(soporte.esImagenNuestra("https://res.cloudinary.com/demo/image/upload/menu-digital/productos/x.png"), false);
  assert.equal(soporte.esImagenNuestra("https://res.cloudinary.com/demo/image/upload/otra.png?x=/menu-digital/soporte/a.png"), false);
  delete process.env.CLOUDINARY_CLOUD_NAME;
  assert.equal(soporte.esImagenNuestra(IMG), false);
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
});

test("listar: el cliente sólo pide los de su cuenta; Tech pide todos", async () => {
  const consultas = [];
  db.setHandler((q) => (consultas.push(q), { data: [ticket()], error: null }));
  const r1 = res();
  await soporte.listar({ user: cliente(), query: {} }, r1);
  assert.equal(consultas[0].filters.cuenta_id, 7);
  assert.equal(r1.body.tickets[0].sin_leer, false);

  consultas.length = 0;
  const r2 = res();
  await soporte.listar({ user: tech, query: { estado: "abiertos" } }, r2);
  assert.equal(consultas[0].filters.cuenta_id, undefined);
  assert.equal(consultas[0].neqs.estado, "resuelto");
  assert.equal(r2.body.tech, true);
  assert.equal(r2.body.tickets[0].sin_leer, true);
});

test("ver: un cliente no puede abrir el reporte de otra cuenta", async () => {
  db.setHandler(() => ({ data: ticket({ cuenta_id: 99 }), error: null }));
  const r = res();
  await soporte.ver({ user: cliente(7), params: { id: "9" } }, r);
  assert.equal(r.statusCode, 404);
});

test("crear: valida tipo, título y que haya texto o captura", async () => {
  const r1 = res();
  await soporte.crear({ user: cliente(), body: { tipo: "otro", asunto: "x", texto: "y" } }, r1);
  assert.equal(r1.statusCode, 400);
  const r2 = res();
  await soporte.crear({ user: cliente(), body: { tipo: "error", asunto: "x" } }, r2);
  assert.equal(r2.statusCode, 400);
  const r3 = res();
  await soporte.crear({ user: cliente(), body: { tipo: "error", asunto: "x", imagen_url: "https://evil.com/a.png" } }, r3);
  assert.equal(r3.statusCode, 400);
});

test("crear: guarda ticket + primer mensaje y avisa a Tech", async () => {
  process.env.SOPORTE_EMAIL = "yo@ejemplo.com";
  const inserts = [];
  db.setHandler((q) => {
    if (q.op === "insert") inserts.push(q);
    if (q.table === "soporte_tickets") return { data: ticket(), error: null };
    return { data: null, error: null };
  });
  const r = res();
  await soporte.crear({ user: cliente(), body: { tipo: "error", asunto: " No carga ", texto: "Mirá", imagen_url: IMG } }, r);
  assert.equal(r.statusCode, 201);
  assert.equal(inserts[0].payload.cuenta_id, 7);
  assert.equal(inserts[0].payload.asunto, "No carga");
  assert.equal(inserts[1].payload.imagen_url, IMG);
  assert.equal(inserts[1].payload.de_tech, false);
  assert.equal(avisos.length, 1);
  delete process.env.SOPORTE_EMAIL;
});

test("responder: Tech contesta → en curso y el cliente lo ve sin leer", async () => {
  const updates = [];
  db.setHandler((q) => {
    if (q.op === "update") updates.push(q.payload);
    if (q.op === "update" && q.filters.estado) return { data: [{ id: 9 }], error: null };
    if (q.table === "soporte_mensajes") return { data: { id: 1, created_at: "2026-11-09T10:00:00Z" }, error: null };
    return { data: ticket(), error: null };
  });
  const r = res();
  await soporte.responder({ user: tech, params: { id: "9" }, body: { texto: "Ya lo miro" } }, r);
  assert.equal(r.statusCode, 201);
  assert.equal(updates[0].sin_leer_cliente, true);
  assert.equal(updates[1].estado, "en_curso");
  assert.equal(r.body.estado, "en_curso");
});

test("responder: el cliente escribe en uno resuelto → se reabre", async () => {
  const updates = [];
  db.setHandler((q) => {
    if (q.op === "update") updates.push(q.payload);
    if (q.op === "update" && q.filters.estado) return { data: [{ id: 9 }], error: null };
    if (q.table === "soporte_mensajes") return { data: { id: 2, created_at: "2026-11-09T10:00:00Z" }, error: null };
    return { data: ticket({ estado: "resuelto" }), error: null };
  });
  const r = res();
  await soporte.responder({ user: cliente(), params: { id: "9" }, body: { texto: "Sigue fallando" } }, r);
  assert.equal(updates[0].sin_leer_tech, true);
  assert.equal(updates[1].estado, "abierto");
});

test("cambiarEstado: sólo Tech", async () => {
  const r = res();
  await soporte.cambiarEstado({ user: cliente(), params: { id: "9" }, body: { estado: "resuelto" } }, r);
  assert.equal(r.statusCode, 403);
  db.setHandler(() => ({ data: ticket(), error: null }));
  const r2 = res();
  await soporte.cambiarEstado({ user: tech, params: { id: "9" }, body: { estado: "resuelto" } }, r2);
  assert.equal(r2.body.estado, "resuelto");
});

test("responder: si otro cambió el estado en el medio, no se pisa", async () => {
  db.setHandler((q) => {
    if (q.op === "update" && q.filters.estado) return { data: [], error: null };
    if (q.table === "soporte_mensajes") return { data: { id: 3, created_at: "2026-11-09T10:00:00Z" }, error: null };
    return { data: ticket(), error: null };
  });
  const r = res();
  await soporte.responder({ user: tech, params: { id: "9" }, body: { texto: "Hola" } }, r);
  assert.equal(r.body.estado, "abierto");
});

test("otra cuenta: no puede responder ni cambiar el estado", async () => {
  const escrituras = [];
  db.setHandler((q) => {
    if (q.op !== "select") escrituras.push(q);
    return { data: ticket({ cuenta_id: 99 }), error: null };
  });
  const r1 = res();
  await soporte.responder({ user: cliente(7), params: { id: "9" }, body: { texto: "hola" } }, r1);
  assert.equal(r1.statusCode, 404);
  const r2 = res();
  await soporte.cambiarEstado({ user: cliente(7), params: { id: "9" }, body: { estado: "resuelto" } }, r2);
  assert.equal(r2.statusCode, 403);
  assert.equal(escrituras.length, 0);
});

test("ver: marca leído sólo si no llegó nada nuevo", async () => {
  const updates = [];
  db.setHandler((q) => {
    if (q.op === "update") updates.push(q);
    if (q.table === "soporte_mensajes") return { data: [], error: null };
    return { data: ticket({ ultimo_at: "2026-11-09T10:00:00Z" }), error: null };
  });
  await soporte.ver({ user: tech, params: { id: "9" } }, res());
  assert.equal(updates[0].filters.ultimo_at, "2026-11-09T10:00:00Z");
});

test("usuario sin cuenta: lista vacía y 0 sin leer (sin consultar)", async () => {
  let consultas = 0;
  db.setHandler(() => (consultas++, { data: null, error: null }));
  const r1 = res();
  await soporte.listar({ user: { id: 5, cuenta_id: null, es_plataforma: false }, query: {} }, r1);
  const r2 = res();
  await soporte.resumen({ user: { id: 5, cuenta_id: null, es_plataforma: false } }, r2);
  assert.deepEqual(r1.body.tickets, []);
  assert.equal(r2.body.sin_leer, 0);
});

test("cambiarEstado: mismo estado no vuelve a avisar al cliente", async () => {
  const updates = [];
  db.setHandler((q) => (q.op === "update" && updates.push(q), { data: ticket({ estado: "resuelto" }), error: null }));
  const r = res();
  await soporte.cambiarEstado({ user: tech, params: { id: "9" }, body: { estado: "resuelto" } }, r);
  assert.equal(updates.length, 0);
});
