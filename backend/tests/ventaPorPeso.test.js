const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// ── Inyección de dependencias ANTES de requerir el controller ──
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), {
  notificarPedido: async () => {},
});
const { createPedido, deletePedido } = require("../src/controllers/pedidosController");

const PRODUCTOS = [
  { id: 1, nombre: "Jamón crudo", precio: 12000, costo: 6000, stock: 2, controlar_stock: true, unidad_venta: "kg" },
  { id: 2, nombre: "Gaseosa", precio: 2000, costo: 800, stock: 0, controlar_stock: false, unidad_venta: "unidad" },
];

let ops;
let estadoPedido;
beforeEach(() => {
  ops = [];
  estadoPedido = "cancelado";
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "productos" && q.op === "select") return { data: PRODUCTOS, error: null };
    if (q.table === "pedidos" && q.op === "insert") return { data: { id: 50, ...q.payload[0] }, error: null };
    if (q.table === "pedido_items" && q.op === "insert") return { data: q.payload, error: null };
    if (q.table === "pedidos" && q.op === "select") return { data: { id: 7, estado: estadoPedido }, error: null };
    return { data: null, error: null };
  });
});

const respuesta = () => {
  const res = { code: 200, body: null };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

test("createPedido: un producto por kg cobra precio × kg y guarda la unidad", async () => {
  const res = respuesta();
  await createPedido(
    { negocioId: 1, body: { items: [{ producto_id: 1, cantidad: 0.35 }, { producto_id: 2, cantidad: 2 }] } },
    res,
  );
  assert.equal(res.code, 201);
  const items = ops.find((o) => o.table === "pedido_items" && o.op === "insert").payload;
  assert.deepEqual(
    items.map((i) => [i.nombre, i.cantidad, i.subtotal, i.unidad]),
    [
      ["Jamón crudo", 0.35, 4200, "kg"],
      ["Gaseosa", 2, 4000, "unidad"], // todas las filas llevan `unidad`
    ],
  );
  const pedido = ops.find((o) => o.table === "pedidos" && o.op === "insert").payload[0];
  assert.equal(pedido.total, 8200);
});

test("createPedido: el stock por kg baja en gramos (2 kg − 350 g = 1,65 kg)", async () => {
  await createPedido({ negocioId: 1, body: { items: [{ producto_id: 1, cantidad: 0.35 }] } }, respuesta());
  const upd = ops.find((o) => o.table === "productos" && o.op === "update");
  assert.equal(upd.payload.stock, 1.65);
});

test("createPedido: por kg aplica mínimo de 100 g; por unidad redondea a entero", async () => {
  await createPedido(
    { negocioId: 1, body: { items: [{ producto_id: 1, cantidad: 0.01 }, { producto_id: 2, cantidad: 1.7 }] } },
    respuesta(),
  );
  const items = ops.find((o) => o.table === "pedido_items" && o.op === "insert").payload;
  assert.equal(items[0].cantidad, 0.1);
  assert.equal(items[1].cantidad, 1);
});

test("createPedido: sin productos por kg no manda la columna `unidad`", async () => {
  await createPedido({ negocioId: 1, body: { items: [{ producto_id: 2, cantidad: 1 }] } }, respuesta());
  const items = ops.find((o) => o.table === "pedido_items" && o.op === "insert").payload;
  assert.equal("unidad" in items[0], false);
});

test("deletePedido: sólo elimina pedidos cancelados", async () => {
  estadoPedido = "entregado";
  const r1 = respuesta();
  await deletePedido({ negocioId: 1, params: { id: "7" } }, r1);
  assert.equal(r1.code, 400);
  assert.equal(ops.some((o) => o.op === "delete"), false);

  estadoPedido = "cancelado";
  const r2 = respuesta();
  await deletePedido({ negocioId: 1, params: { id: "7" } }, r2);
  assert.equal(r2.code, 200);
  assert.equal(ops.some((o) => o.op === "delete" && o.table === "pedidos"), true);
});
