const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), {
  notificarPedido: async () => {},
  avisosDisponibles: async () => false,
});
const { normalizar, desdeOnboarding, LEGADO } = require("../src/utils/modulos");
const { requiereModulo, olvidarModulos } = require("../src/middleware/requiereModulo");
const { createPedido } = require("../src/controllers/pedidosController");
const { getConfiguracion, updateConfiguracion } = require("../src/controllers/configuracionController");
const { getProductosDisponibles } = require("../src/controllers/productosController");
const { updateOnboarding } = require("../src/controllers/onboardingController");

const NEG = 4;
let negocio, cfg, ops;
beforeEach(() => {
  olvidarModulos(NEG);
  ops = [];
  negocio = { id: NEG, tipo_rubro: "servicios", modulos: null, onboarding: null };
  cfg = { negocio_id: NEG, nombre: "Peluquería Ana", mesas_activo: true, mesas_cantidad: 5, retiro_activo: true, delivery_activo: true };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "negocios" && q.op === "select") return { data: negocio, error: null };
    if (q.table === "negocios" && q.op === "update") return { data: { ...negocio, ...q.payload }, error: null };
    if (q.table === "configuracion") return { data: cfg, error: null };
    if (q.table === "productos" && q.op === "select") return { data: [{ id: 1, nombre: "Café", precio: 1000, costo: 0, disponible: true }], error: null };
    if (q.table === "pedidos" && q.op === "insert") return { data: { id: 9, ...q.payload[0] }, error: null };
    if (q.table === "pedido_items" && q.op === "insert") return { data: q.payload, error: null };
    return { data: [], error: null };
  });
});

const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const PELUQUERIA = { ...LEGADO, productos: false, pedidos: false, entregas: false, servicios: true, reservas: true };

test("normalizar: sin datos → el perfil de siempre (restaurante igual que hoy)", () => {
  assert.deepEqual(normalizar(null), LEGADO);
  assert.equal(LEGADO.pedidos && LEGADO.productos && LEGADO.entregas && LEGADO.estadisticas, true);
});

test("normalizar: respeta dependencias, catálogo fijo y carrito = pedidos", () => {
  const m = normalizar({ productos: false, pedidos: true, entregas: true, catalogo: false, carrito: true, inventado: true });
  assert.equal(m.catalogo, true);
  assert.equal(m.pedidos, false); // sin productos no hay pedidos
  assert.equal(m.entregas, false); // ni entregas
  assert.equal(m.carrito, false);
  assert.equal("inventado" in m, false);
  assert.equal(normalizar({ pedidos: "si" }).pedidos, true); // no booleano → valor por defecto
});

test("desdeOnboarding: peluquería, impresión 3D y restaurante", () => {
  const pelu = desdeOnboarding({ ofrece: ["servicios"], funciones: ["reservas", "presencial"] }, "servicios");
  assert.deepEqual([pelu.productos, pelu.pedidos, pelu.entregas, pelu.servicios, pelu.reservas], [false, false, false, true, true]);

  const p3d = desdeOnboarding({ ofrece: ["productos", "personalizados"], funciones: ["pedidos", "presupuestos", "envios"] }, "retail");
  assert.deepEqual([p3d.productos, p3d.personalizados, p3d.pedidos, p3d.entregas, p3d.presupuestos], [true, true, true, true, true]);

  const resto = desdeOnboarding({ ofrece: ["productos"], funciones: ["pedidos", "presencial"] }, "gastronomia");
  assert.equal(resto.entregas, true); // en gastronomía, "presencial" es la mesa
});

test("requiereModulo: deja pasar si está activo, 403 MODULO_INACTIVO si no", async () => {
  let pasó = false;
  await requiereModulo("pedidos")({ negocioId: NEG }, respuesta(), () => (pasó = true));
  assert.equal(pasó, true);

  olvidarModulos(NEG);
  negocio.modulos = PELUQUERIA;
  const res = respuesta();
  pasó = false;
  await requiereModulo("pedidos")({ negocioId: NEG }, res, () => (pasó = true));
  assert.equal(pasó, false);
  assert.equal(res.code, 403);
  assert.equal(res.body.error, "MODULO_INACTIVO");
});

test("requiereModulo: si la base falla, deja pasar", async () => {
  db.setHandler(() => ({ data: null, error: new Error("caída") }));
  let pasó = false;
  await requiereModulo("pedidos")({ negocioId: NEG }, respuesta(), () => (pasó = true));
  assert.equal(pasó, true);
});

test("pedido público: sin el módulo de pedidos se rechaza sin guardar nada", async () => {
  negocio.modulos = PELUQUERIA;
  const res = respuesta();
  await createPedido({ negocioId: NEG, body: { items: [{ producto_id: 1, cantidad: 1 }], tipo_entrega: "retiro" } }, res);
  assert.equal(res.code, 403);
  assert.equal(ops.some((o) => o.op === "insert"), false);
});

test("pedido público: sin entregas, sólo en mostrador (sin tipo)", async () => {
  negocio.modulos = { ...LEGADO, entregas: false };
  const r1 = respuesta();
  await createPedido({ negocioId: NEG, body: { items: [{ producto_id: 1, cantidad: 1 }], tipo_entrega: "retiro" } }, r1);
  assert.equal(r1.code, 400);
  const r2 = respuesta();
  await createPedido({ negocioId: NEG, body: { items: [{ producto_id: 1, cantidad: 1 }] } }, r2);
  assert.equal(r2.code, 201);
});

test("configuración pública: sin entregas no ofrece retiro/delivery/mesa; el panel ve lo guardado", async () => {
  negocio.modulos = { ...LEGADO, entregas: false };
  const pub = respuesta();
  await getConfiguracion({ headers: { "x-negocio-id": String(NEG) }, query: {} }, pub);
  assert.deepEqual([pub.body.retiro_activo, pub.body.delivery_activo, pub.body.mesas_activo], [false, false, false]);
  assert.equal(pub.body.modulos.entregas, false);

  const panel = respuesta();
  await getConfiguracion({ negocioId: NEG }, panel);
  assert.deepEqual([panel.body.retiro_activo, panel.body.delivery_activo], [true, true]);
});

test("catálogo público: sin productos devuelve vacío", async () => {
  negocio.modulos = PELUQUERIA;
  const res = respuesta();
  await getProductosDisponibles({ headers: { "x-negocio-id": String(NEG) }, query: {} }, res);
  assert.deepEqual(res.body, []);
});

test("guardar módulos: se normalizan y quedan en negocios", async () => {
  const res = respuesta();
  await updateConfiguracion({ negocioId: NEG, body: { modulos: { productos: false, pedidos: true, estadisticas: false } } }, res);
  assert.equal(res.code, 200);
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal(upd.filters.id, NEG);
  assert.equal(upd.payload.modulos.pedidos, false);
  assert.equal(upd.payload.modulos.estadisticas, false);
  assert.equal(res.body.modulos.productos, false);
});

test("guardar módulos: un valor que no es objeto → 400", async () => {
  const res = respuesta();
  await updateConfiguracion({ negocioId: NEG, body: { modulos: ["pedidos"] } }, res);
  assert.equal(res.code, 400);
});

test("onboarding: lo elegido define los módulos mientras no terminó", async () => {
  negocio.onboarding = { paso: 4, completado: false, ofrece: ["servicios"] };
  await updateOnboarding({ negocioId: NEG, body: { funciones: ["reservas"] } }, respuesta());
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal(upd.payload.modulos.servicios, true);
  assert.equal(upd.payload.modulos.pedidos, false);
});

test("onboarding: ya terminado, no toca los módulos", async () => {
  negocio.onboarding = { paso: 8, completado: true };
  await updateOnboarding({ negocioId: NEG, body: { funciones: ["reservas"] } }, respuesta());
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal("modulos" in upd.payload, false);
});

test("desdeOnboarding: elegir sólo retiro o envíos también activa pedidos", () => {
  const m = desdeOnboarding({ ofrece: ["productos"], funciones: ["retiro"] }, "retail");
  assert.deepEqual([m.pedidos, m.entregas], [true, true]);
});

test("onboarding: un negocio anterior (onboarding NULL) no pierde sus módulos", async () => {
  negocio.onboarding = null;
  negocio.modulos = { ...LEGADO };
  await updateOnboarding({ negocioId: NEG, body: { ofrece: ["servicios"] } }, respuesta());
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal("modulos" in upd.payload, false);
});

test("guardar módulos: lo que no viene se conserva como estaba", async () => {
  negocio.modulos = { ...LEGADO, estadisticas: false };
  await updateConfiguracion({ negocioId: NEG, body: { modulos: { entregas: false } } }, respuesta());
  const upd = ops.find((o) => o.table === "negocios" && o.op === "update");
  assert.equal(upd.payload.modulos.estadisticas, false);
  assert.equal(upd.payload.modulos.entregas, false);
  assert.equal(upd.payload.modulos.pedidos, true);
});

test("pedido público: sin entregas y sin fila de configuración, igual rechaza un tipo de entrega", async () => {
  negocio.modulos = { ...LEGADO, entregas: false };
  cfg = null;
  const res = respuesta();
  await createPedido({ negocioId: NEG, body: { items: [{ producto_id: 1, cantidad: 1 }], tipo_entrega: "delivery" } }, res);
  assert.equal(res.code, 400);
});
