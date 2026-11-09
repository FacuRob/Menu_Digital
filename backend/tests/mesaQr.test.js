const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MESA_QR_SECRET = "clave-de-prueba";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), {
  notificarPedido: async () => {},
});
const { firmarMesa, mesaValida } = require("../src/utils/mesaQr");
const { createPedido } = require("../src/controllers/pedidosController");

// ── Firma ──
test("firmarMesa: misma mesa y negocio → misma firma; cambia con la mesa o el negocio", () => {
  const t5 = firmarMesa(1, "5");
  assert.equal(t5, firmarMesa(1, "5"));
  assert.equal(t5, firmarMesa(1, " 5 ")); // espacios no cambian la mesa
  assert.notEqual(t5, firmarMesa(1, "7"));
  assert.notEqual(t5, firmarMesa(2, "5"));
  assert.ok(/^[A-Za-z0-9_-]{22}$/.test(t5));
});

test("mesaValida: rechaza firma de otra mesa, de otro negocio, vacía o inventada", () => {
  const t5 = firmarMesa(1, "5");
  assert.equal(mesaValida(1, "5", t5), true);
  assert.equal(mesaValida(1, "7", t5), false); // cambió mesa=5 por mesa=7
  assert.equal(mesaValida(2, "5", t5), false); // QR de otro negocio
  assert.equal(mesaValida(1, "5", ""), false);
  assert.equal(mesaValida(1, "5", null), false);
  assert.equal(mesaValida(1, "", t5), false);
  assert.equal(mesaValida(1, "5", "x".repeat(22)), false);
});

test("firmarMesa: cambia si cambia la clave secreta", () => {
  const antes = firmarMesa(1, "5");
  process.env.MESA_QR_SECRET = "otra-clave";
  assert.notEqual(firmarMesa(1, "5"), antes);
  process.env.MESA_QR_SECRET = "clave-de-prueba";
});

// ── createPedido ──
let ops;
let cfg; // fila de configuracion del local (null = sin configurar)
beforeEach(() => {
  ops = [];
  cfg = { mesas_activo: true, mesas_cantidad: 10, retiro_activo: true, delivery_activo: false, mesas_qr_version: 1 };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "configuracion") return { data: cfg, error: null };
    if (q.table === "productos" && q.op === "select") {
      return { data: [{ id: 1, nombre: "Café", precio: 2000, costo: 500, stock: 0, controlar_stock: false }], error: null };
    }
    if (q.table === "pedidos" && q.op === "insert") return { data: { id: 9, ...q.payload[0] }, error: null };
    if (q.table === "pedido_items" && q.op === "insert") return { data: q.payload, error: null };
    return { data: null, error: null };
  });
});

const respuesta = () => {
  const res = { code: 200, body: null };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const pedir = async (body) => {
  const res = respuesta();
  await createPedido({ negocioId: 1, body: { items: [{ producto_id: 1, cantidad: 1 }], ...body } }, res);
  const insert = ops.find((o) => o.table === "pedidos" && o.op === "insert");
  return { res, pedido: insert?.payload[0] };
};

test("createPedido: 'En mesa' con la firma correcta guarda esa mesa", async () => {
  const { res, pedido } = await pedir({ tipo_entrega: "mesa", mesa: "5", mesa_token: firmarMesa(1, "5") });
  assert.equal(res.code, 201);
  assert.equal(pedido.mesa, "5");
});

test("createPedido: 'En mesa' sin firma (QR general o URL armada a mano) se rechaza", async () => {
  const { res, pedido } = await pedir({ tipo_entrega: "mesa", mesa: "5" });
  assert.equal(res.code, 400);
  assert.equal(pedido, undefined); // no se insertó nada
});

test("createPedido: cambiar la mesa de la URL invalida la firma", async () => {
  const { res } = await pedir({ tipo_entrega: "mesa", mesa: "7", mesa_token: firmarMesa(1, "5") });
  assert.equal(res.code, 400);
});

test("createPedido: retiro o delivery descartan cualquier mesa que venga", async () => {
  const { res, pedido } = await pedir({ tipo_entrega: "retiro", mesa: "5", telefono_cliente: "381" });
  assert.equal(res.code, 201);
  assert.equal(pedido.mesa, null);
});

test("firmarMesa: la versión cambia la firma (Regenerar QR anula los impresos)", () => {
  assert.notEqual(firmarMesa(1, "5", 1), firmarMesa(1, "5", 2));
  assert.equal(mesaValida(1, "5", firmarMesa(1, "5", 1), 2), false);
});

test("createPedido: QR de una versión vieja (regenerado) se rechaza", async () => {
  cfg.mesas_qr_version = 2;
  const { res } = await pedir({ tipo_entrega: "mesa", mesa: "5", mesa_token: firmarMesa(1, "5", 1) });
  assert.equal(res.code, 400);
});

test("createPedido: mesa que ya no existe (bajaron la cantidad) se rechaza", async () => {
  cfg.mesas_cantidad = 4;
  const { res } = await pedir({ tipo_entrega: "mesa", mesa: "5", mesa_token: firmarMesa(1, "5") });
  assert.equal(res.code, 400);
});

test("createPedido: con 'en mesa' desactivado, ni un QR válido sirve", async () => {
  cfg.mesas_activo = false;
  const { res } = await pedir({ tipo_entrega: "mesa", mesa: "5", mesa_token: firmarMesa(1, "5") });
  assert.equal(res.code, 400);
});

test("createPedido: un tipo de entrega apagado en el local se rechaza", async () => {
  const { res } = await pedir({ tipo_entrega: "delivery", direccion_entrega: "X", telefono_cliente: "1" });
  assert.equal(res.code, 400);
});

test("createPedido: sin tipo de entrega, si el local ofrece alguno, se rechaza", async () => {
  const { res, pedido } = await pedir({});
  assert.equal(res.code, 400);
  assert.equal(pedido, undefined);
});

test("createPedido: local que sólo atiende en mesa + QR general → pide escanear el QR", async () => {
  cfg.retiro_activo = false;
  const { res } = await pedir({});
  assert.equal(res.code, 400);
  assert.match(res.body.message, /QR de tu mesa/);
});

test("createPedido: local sin ningún tipo de entrega acepta el pedido sin tipo", async () => {
  cfg = { mesas_activo: false, mesas_cantidad: 0, retiro_activo: false, delivery_activo: false };
  const { res, pedido } = await pedir({});
  assert.equal(res.code, 201);
  assert.equal(pedido.mesa, null);
});
