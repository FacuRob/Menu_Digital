const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
process.env.JWT_SECRET = "jwt-test";

const { getTicketPublico } = require("../src/controllers/pedidosController");
const { firmar, firmaValida } = require("../src/utils/linksPedido");
const firmarTicket = (id, neg) => firmar("ticket", id, neg);
const ticketValido = (id, neg, t) => firmaValida("ticket", id, neg, t);

const PEDIDO = {
  id: 128, negocio_id: 5, cliente: "Juan", tipo_entrega: "retiro", mesa: null, total: 3000,
  estado: "entregado", created_at: "2026-11-09T12:00:00Z", entregado_at: null,
  telefono_cliente: "381", direccion_entrega: "Calle 1",
  pedido_items: [{ nombre: "Pizza", cantidad: 2, precio_unit: 1500, subtotal: 3000, costo_unit: 700 }],
};

beforeEach(() => {
  db.setHandler((q) => {
    if (q.table === "pedidos") return { data: PEDIDO, error: null };
    if (q.table === "configuracion") return { data: { nombre: "Bar Test" }, error: null };
    return { data: null, error: null };
  });
});

const llamar = async (id, t) => {
  const res = { code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  await getTicketPublico({ params: { id: String(id) }, query: { t } }, res);
  return res;
};

test("ticketLink: la firma depende del pedido y del negocio", () => {
  assert.equal(ticketValido(128, 5, firmarTicket(128, 5)), true);
  assert.equal(ticketValido(129, 5, firmarTicket(128, 5)), false);
  assert.equal(ticketValido(128, 6, firmarTicket(128, 5)), false);
  assert.equal(ticketValido(128, 5, ""), false);
});

test("getTicketPublico: con firma válida devuelve el ticket sin datos privados", async () => {
  const r = await llamar(128, firmarTicket(128, 5));
  assert.equal(r.code, 200);
  assert.equal(r.body.local.nombre, "Bar Test");
  assert.equal(r.body.items[0].nombre, "Pizza");
  assert.equal(r.body.items[0].costo_unit, undefined);
  assert.equal(r.body.negocio_id, undefined);
  assert.equal(r.body.telefono_cliente, undefined);
  assert.equal(r.body.direccion_entrega, undefined);
});

test("getTicketPublico: sin firma o con firma ajena responde 404", async () => {
  assert.equal((await llamar(128, "")).code, 404);
  assert.equal((await llamar(128, firmarTicket(129, 5))).code, 404);
  assert.equal((await llamar("abc", "x")).code, 404);
});

test("getTicketPublico: si el pedido no está entregado responde 404", async () => {
  db.setHandler((q) => ({ data: q.table === "pedidos" ? { ...PEDIDO, estado: "cancelado" } : null, error: null }));
  assert.equal((await llamar(128, firmarTicket(128, 5))).code, 404);
});
