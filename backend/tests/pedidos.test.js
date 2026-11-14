const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// Pruebas de createPedido: precios desde la base, variantes validadas en el
// servidor, costo oculto y stock. El mock respeta el negocio y la lista de ids.
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
let avisos;
injectModule(require.resolve("../src/services/avisosPedidoService"), {
  notificarPedido: async (p, e) => avisos.push([p.id, e]),
});
const { createPedido } = require("../src/controllers/pedidosController");

const NEG = 1;
let productos, grupos, ops, fallaItems;
beforeEach(() => {
  ops = [];
  avisos = [];
  fallaItems = false;
  productos = [
    { id: 1, negocio_id: NEG, nombre: "Hamburguesa", precio: 5000, costo: 2000, stock: 3, controlar_stock: true, disponible: true },
    { id: 2, negocio_id: NEG, nombre: "Gaseosa", precio: 1500, costo: 600, stock: 0, controlar_stock: false, disponible: true },
    { id: 3, negocio_id: NEG, nombre: "Pausado", precio: 100, costo: 0, stock: 0, controlar_stock: false, disponible: false },
    { id: 9, negocio_id: 2, nombre: "De otro negocio", precio: 1, costo: 0, stock: 0, controlar_stock: false, disponible: true },
  ];
  grupos = [
    {
      id: 10, negocio_id: NEG, producto_id: 1, nombre: "Punto", tipo: "single", obligatorio: true,
      variantes_opcion: [
        { id: 100, nombre: "Jugosa", precio_extra: 0, activo: true, stock: null },
        { id: 101, nombre: "Cocida", precio_extra: 0, activo: true, stock: null },
      ],
    },
    {
      id: 11, negocio_id: NEG, producto_id: 1, nombre: "Extras", tipo: "multi", obligatorio: false,
      variantes_opcion: [
        { id: 110, nombre: "Bacon", precio_extra: 800, activo: true, stock: 5 },
        { id: 111, nombre: "Huevo", precio_extra: 500, activo: false, stock: null },
        { id: 112, nombre: "Cheddar", precio_extra: 400, activo: true, stock: 0 },
      ],
    },
    {
      id: 20, negocio_id: 2, producto_id: 9, nombre: "Ajeno", tipo: "multi", obligatorio: false,
      variantes_opcion: [{ id: 900, nombre: "Ajena", precio_extra: 1, activo: true, stock: null }],
    },
  ];
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    const delNegocio = (rows) =>
      rows.filter((r) => r.negocio_id === q.filters.negocio_id && (!q.inList || q.inList.vals.includes(r[q.inList.col])));
    if (q.table === "configuracion") return { data: null, error: null };
    if (q.table === "productos" && q.op === "select") return { data: delNegocio(productos), error: null };
    if (q.table === "variantes_grupo") return { data: delNegocio(grupos), error: null };
    if (q.table === "pedidos" && q.op === "insert") return { data: { id: 77, ...q.payload[0] }, error: null };
    if (q.table === "pedido_items" && q.op === "insert") {
      return fallaItems ? { data: null, error: new Error("insert falló") } : { data: q.payload, error: null };
    }
    return { data: null, error: null };
  });
});

const respuesta = () => {
  const res = { code: 200, body: null };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const pedir = async (items, extra = {}) => {
  const res = respuesta();
  await createPedido({ negocioId: NEG, body: { items, ...extra } }, res);
  return res;
};
const insertado = (tabla) => ops.find((o) => o.table === tabla && o.op === "insert")?.payload;
const huboPedido = () => !!insertado("pedidos");

test("precio, nombre y total salen de la base, no del cliente", async () => {
  const res = await pedir([{ producto_id: 2, cantidad: 2, precio: 1, nombre: "Gratis" }]);
  assert.equal(res.code, 201);
  const [it] = insertado("pedido_items");
  assert.equal(it.nombre, "Gaseosa");
  assert.equal(it.precio_unit, 1500);
  assert.equal(it.subtotal, 3000);
  assert.equal(insertado("pedidos")[0].total, 3000);
});

test("la respuesta no incluye el costo (sí se guarda para analíticas)", async () => {
  const res = await pedir([{ producto_id: 2, cantidad: 1 }]);
  assert.equal(insertado("pedido_items")[0].costo_unit, 600);
  assert.equal("costo_unit" in res.body.items[0], false);
});

test("ítem sin producto_id (precio inventado) se rechaza", async () => {
  const res = await pedir([{ nombre: "Lo que yo quiera", precio: 1, cantidad: 1 }]);
  assert.equal(res.code, 400);
  assert.equal(huboPedido(), false);
});

test("producto de otro negocio se rechaza", async () => {
  const res = await pedir([{ producto_id: 9, cantidad: 1, precio: 1 }]);
  assert.equal(res.code, 400);
  assert.equal(huboPedido(), false);
});

test("producto pausado (no disponible) se rechaza", async () => {
  const res = await pedir([{ producto_id: 3, cantidad: 1 }]);
  assert.equal(res.code, 400);
  assert.equal(huboPedido(), false);
});

test("variantes: suma el precio extra real y lo agrega al nombre", async () => {
  const res = await pedir([{ producto_id: 1, cantidad: 1, opciones: [100, 110] }]);
  assert.equal(res.code, 201);
  const [it] = insertado("pedido_items");
  assert.equal(it.precio_unit, 5800);
  assert.equal(it.nombre, "Hamburguesa (Jugosa, Bacon)");
});

test("variantes: falta el grupo obligatorio → 400", async () => {
  const res = await pedir([{ producto_id: 1, cantidad: 1, opciones: [110] }]);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /Punto/);
  assert.equal(huboPedido(), false);
});

test("variantes: dos opciones en un grupo de una sola → 400", async () => {
  const res = await pedir([{ producto_id: 1, cantidad: 1, opciones: [100, 101] }]);
  assert.equal(res.code, 400);
  assert.equal(huboPedido(), false);
});

test("variantes: opción inactiva, sin stock, de otro producto o de otro negocio → 400", async () => {
  for (const extra of [111, 112, 900]) {
    ops = [];
    const res = await pedir([{ producto_id: 1, cantidad: 1, opciones: [100, extra] }]);
    assert.equal(res.code, 400, `opción ${extra}`);
    assert.equal(huboPedido(), false);
  }
  // Opción válida, pero puesta en un producto sin variantes.
  const res = await pedir([{ producto_id: 2, cantidad: 1, opciones: [100] }]);
  assert.equal(res.code, 400);
});

test("variantes: una opción repetida se cobra una sola vez", async () => {
  await pedir([{ producto_id: 1, cantidad: 1, opciones: [100, 110, 110] }]);
  assert.equal(insertado("pedido_items")[0].precio_unit, 5800);
});

test("stock: suma las líneas del mismo producto y no baja de 0", async () => {
  await pedir([
    { producto_id: 1, cantidad: 2, opciones: [100] },
    { producto_id: 1, cantidad: 2, opciones: [101] },
  ]);
  const upd = ops.filter((o) => o.table === "productos" && o.op === "update");
  assert.equal(upd.length, 1);
  assert.equal(upd[0].payload.stock, 0); // 3 − 4 → 0
  // La gaseosa no controla stock: no se toca.
  assert.equal(upd.some((o) => o.filters.id === 2), false);
});

test("stock por opción: descuenta la opción que lo controla", async () => {
  await pedir([{ producto_id: 1, cantidad: 2, opciones: [100, 110] }]);
  const upd = ops.filter((o) => o.table === "variantes_opcion" && o.op === "update");
  assert.deepEqual(upd.map((o) => [o.filters.id, o.payload.stock]), [[110, 3]]);
});

test("nombre largo con opciones se recorta a 150 (largo de la columna)", async () => {
  productos[1].nombre = "x".repeat(200);
  await pedir([{ producto_id: 2, cantidad: 1 }]);
  assert.equal(insertado("pedido_items")[0].nombre.length, 150);
});

test("si fallan los ítems, se borra el pedido recién creado", async () => {
  fallaItems = true;
  const res = await pedir([{ producto_id: 2, cantidad: 1 }]);
  assert.equal(res.code, 500);
  assert.ok(ops.some((o) => o.table === "pedidos" && o.op === "delete" && o.filters.id === 77));
});

test("aviso de WhatsApp sólo con consentimiento y teléfono", async () => {
  await pedir([{ producto_id: 2, cantidad: 1 }], { telefono_cliente: "3815052050" });
  assert.deepEqual(avisos, []);
  await pedir([{ producto_id: 2, cantidad: 1 }], { telefono_cliente: "3815052050", acepta_whatsapp: true });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(avisos, [[77, "pendiente"]]);
});
