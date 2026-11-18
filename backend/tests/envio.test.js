const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), { notificarPedido: async () => {}, avisosDisponibles: async () => false });
injectModule(require.resolve("../src/utils/registroCambios"), { registrar: () => {} });
const { normalizarEnvio, validarEnvio, costoEnvio } = require("../src/utils/envio");
const { createPedido } = require("../src/controllers/pedidosController");
const { getConfiguracion, updateEnvio } = require("../src/controllers/configuracionController");
const { olvidarModulos } = require("../src/middleware/requiereModulo");
const { LEGADO } = require("../src/utils/modulos");

const ENVIO = { cobrar: true, monto: 1000, gratis_desde: 10000, cobro: "efectivo" };

// ── Reglas puras ──
test("costoEnvio: sólo delivery, con monto, y gratis desde el mínimo", () => {
  const cfg = { envio: ENVIO };
  assert.deepEqual(costoEnvio(cfg, "delivery", 4000), { costo: 1000, cobro: "efectivo", gratis: false });
  assert.deepEqual(costoEnvio(cfg, "delivery", 10000), { costo: 0, cobro: null, gratis: true });
  assert.equal(costoEnvio(cfg, "retiro", 4000).costo, 0);
  assert.equal(costoEnvio(cfg, "envio", 4000).costo, 0); // por correo: no
  assert.equal(costoEnvio({ envio: { ...ENVIO, cobrar: false } }, "delivery", 4000).costo, 0);
  assert.equal(costoEnvio({}, "delivery", 4000).costo, 0); // sin configurar (o sin migración)
});

test("normalizar y validar envío", () => {
  assert.deepEqual(normalizarEnvio(null), { cobrar: false, monto: 0, gratis_desde: null, cobro: "pedido" });
  assert.deepEqual(normalizarEnvio({ cobrar: "si", monto: "1500.555", cobro: "otro" }), { cobrar: false, monto: 1500.56, gratis_desde: null, cobro: "pedido" });
  assert.ok(validarEnvio({ cobrar: true, monto: 0 }).error);
  assert.ok(validarEnvio({ cobrar: true, monto: 1000, gratis_desde: -5 }).error);
  assert.ok(validarEnvio([]).error);
  assert.deepEqual(validarEnvio({ cobrar: true, monto: 1000, gratis_desde: "" }).valor.gratis_desde, null);
  assert.deepEqual(validarEnvio({ cobrar: false, monto: 0 }).valor.cobrar, false);
});

// ── Pedido ──
let cfg, ops, rpcConEnvio;
beforeEach(() => {
  olvidarModulos(3);
  ops = [];
  rpcConEnvio = true;
  cfg = { negocio_id: 3, retiro_activo: true, delivery_activo: true, envio: ENVIO };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload });
    if (q.table === "negocios") return { data: { id: 3, modulos: { ...LEGADO } }, error: null };
    if (q.table === "configuracion" && q.op === "upsert") return { data: { envio: q.payload.envio }, error: null };
    if (q.table === "configuracion") return { data: cfg, error: null };
    if (q.table === "productos" && q.op === "select") return { data: [{ id: 1, nombre: "Papas", precio: 4000, costo: 0, disponible: true }], error: null };
    if (q.table === "rpc:crear_pedido") {
      const { costo_envio, envio_cobro, ...resto } = q.payload.p_pedido;
      return { data: { pedido: { id: 8, ...(rpcConEnvio ? q.payload.p_pedido : { ...resto, costo_envio: 0 }) }, items: [] }, error: null };
    }
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
const DELIVERY = { tipo_entrega: "delivery", direccion_entrega: "Mitre 123", telefono_cliente: "381" };
const enviado = () => ops.find((o) => o.table === "rpc:crear_pedido")?.payload.p_pedido;

test("pedido delivery: suma el envío de la configuración, no el que manda el cliente", async () => {
  const r = await pedir({ ...DELIVERY, costo_envio: 1 });
  assert.equal(r.code, 201);
  assert.equal(enviado().total, 4000); // total = sólo productos
  assert.equal(enviado().costo_envio, 1000);
  assert.equal(enviado().envio_cobro, "efectivo");
  assert.equal(r.body.costo_envio, 1000);
});

test("pedido delivery: con envío gratis o en retiro, no manda las columnas", async () => {
  await pedir({ ...DELIVERY, items: [{ producto_id: 1, cantidad: 3 }] }); // $12.000 ≥ $10.000
  assert.equal("costo_envio" in enviado(), false);
  ops = [];
  await pedir({ tipo_entrega: "retiro", telefono_cliente: "381" });
  assert.equal("costo_envio" in enviado(), false);
});

test("pedido delivery: con crear_pedido viejo, completa el envío aparte", async () => {
  rpcConEnvio = false;
  const r = await pedir(DELIVERY);
  const upd = ops.find((o) => o.table === "pedidos" && o.op === "update");
  assert.deepEqual(upd.payload, { costo_envio: 1000, envio_cobro: "efectivo" });
  assert.equal(r.body.costo_envio, 1000);
});

// ── Configuración ──
const guardar = async (rol, body) => {
  const res = respuesta();
  await updateEnvio({ negocioId: 3, user: { id: 1, rol }, body }, res);
  return res;
};

test("updateEnvio: sólo el dueño (rol admin); Admin y Staff → 403", async () => {
  assert.equal((await guardar("manager", ENVIO)).code, 403);
  assert.equal((await guardar("staff", ENVIO)).code, 403);
  assert.equal(ops.some((o) => o.op === "upsert"), false);
  const ok = await guardar("admin", ENVIO);
  assert.equal(ok.code, 200);
  assert.deepEqual(ok.body.envio, ENVIO);
  assert.equal((await guardar("admin", { cobrar: true, monto: 0 })).code, 400);
});

test("configuración pública: trae el envío normalizado", async () => {
  const r = respuesta();
  await getConfiguracion({ headers: { "x-negocio-id": "3" }, query: {} }, r);
  assert.deepEqual(r.body.envio, ENVIO);
});
