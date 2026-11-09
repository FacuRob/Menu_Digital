const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
// Plan con WhatsApp (Estándar/Premium): el mapa del repartidor está habilitado.
let planConWhatsapp = true;
injectModule(require.resolve("../src/utils/planNegocio"), {
  negocioConWhatsapp: async () => planConWhatsapp,
});
process.env.JWT_SECRET = "jwt-test";

const reparto = require("../src/controllers/repartoController");
const { firmar } = require("../src/utils/linksPedido");

let pedido;
let ops;

beforeEach(() => {
  planConWhatsapp = true;
  ops = [];
  pedido = {
    id: 50, negocio_id: 5, tipo_entrega: "delivery", estado: "preparando", cliente: "Juan Pérez",
    telefono_cliente: "3815052050", direccion_entrega: "San Martín 450", nota: null, total: 1000,
    repartidor_lat: null, repartidor_lng: null, repartidor_at: null, pedido_items: [],
  };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "pedidos" && q.op === "select") return { data: pedido, error: null };
    if (q.table === "pedidos" && q.op === "update") {
      // Simula el filtro por estado previo del update condicional.
      if (q.filters.estado && q.filters.estado !== pedido.estado) return { data: null, error: null };
      pedido = { ...pedido, ...q.payload };
      return { data: pedido, error: null };
    }
    if (q.table === "configuracion") return { data: { nombre: "Bar Test" }, error: null };
    return { data: null, error: null };
  });
});

const llamar = async (fn, { id = 50, t, body = {} } = {}) => {
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await fn({ params: { id: String(id) }, query: t !== undefined ? { t } : {}, body }, res);
  return res;
};
const tRep = () => firmar("reparto", 50, 5);
const tSeg = () => firmar("seguimiento", 50, 5);

test("reparto: si la cuenta bajó a Básico, los links viejos dejan de andar", async () => {
  planConWhatsapp = false;
  assert.equal((await llamar(reparto.getReparto, { t: tRep() })).code, 404);
  assert.equal((await llamar(reparto.getSeguimiento, { t: tSeg() })).code, 404);
});

test("reparto: el link del cliente no sirve para el repartidor (ni al revés)", async () => {
  assert.equal((await llamar(reparto.getReparto, { t: tSeg() })).code, 404);
  assert.equal((await llamar(reparto.getSeguimiento, { t: tRep() })).code, 404);
  assert.equal((await llamar(reparto.getReparto, { t: tRep() })).code, 200);
});

test("reparto: sólo pedidos delivery", async () => {
  pedido.tipo_entrega = "retiro";
  assert.equal((await llamar(reparto.getReparto, { t: tRep() })).code, 404);
});

test("salir → en_camino; ubicación se guarda; entregar → entregado", async () => {
  let r = await llamar(reparto.salir, { body: { t: tRep() } });
  assert.equal(r.body.estado, "en_camino");

  r = await llamar(reparto.ubicacion, { body: { t: tRep(), lat: -26.83, lng: -65.2 } });
  assert.equal(r.code, 200);
  assert.equal(pedido.repartidor_lat, -26.83);

  r = await llamar(reparto.getSeguimiento, { t: tSeg() });
  assert.deepEqual([r.body.ubicacion.lat, r.body.ubicacion.lng], [-26.83, -65.2]);
  assert.equal(r.body.cliente, "Juan"); // sólo el nombre
  assert.equal(r.body.telefono, undefined);

  r = await llamar(reparto.entregar, { body: { t: tRep() } });
  assert.equal(r.body.estado, "entregado");
  r = await llamar(reparto.getSeguimiento, { t: tSeg() });
  assert.equal(r.body.ubicacion, null);
  assert.match(r.body.ticket, /\/ticket\/50\?t=/);
});

test("ubicación: inválida → 400; fuera de 'en camino' → 409 sin guardar", async () => {
  assert.equal((await llamar(reparto.ubicacion, { body: { t: tRep(), lat: 999, lng: 0 } })).code, 400);
  const r = await llamar(reparto.ubicacion, { body: { t: tRep(), lat: 1, lng: 1 } });
  assert.equal(r.code, 409);
  assert.equal(ops.filter((o) => o.op === "update").length, 0);
});

test("no se puede salir con un pedido cancelado ni entregar uno que no salió", async () => {
  pedido.estado = "cancelado";
  assert.equal((await llamar(reparto.salir, { body: { t: tRep() } })).code, 409);
  pedido.estado = "preparando";
  assert.equal((await llamar(reparto.entregar, { body: { t: tRep() } })).code, 409);
});
