const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), { notificarPedido: async () => {}, avisosDisponibles: async () => false });
injectModule(require.resolve("../src/utils/registroCambios"), { registrar: () => {} });
const { validarPagos, mediosActivos, montosDePago, validarPago } = require("../src/utils/pagos");
const { createPedido, updatePagoPedido } = require("../src/controllers/pedidosController");
const { getConfiguracion, updatePagos } = require("../src/controllers/configuracionController");
const { olvidarModulos } = require("../src/middleware/requiereModulo");
const { LEGADO } = require("../src/utils/modulos");

const PAGOS = { efectivo: true, transferencia: true, alias: "bar.esquina.mp", cbu: "", titular: "Ana Pérez", banco: "Mercado Pago", comprobante: "opcional" };

// ── Reglas puras ──
test("validarPagos: alias, CBU de 22 números y titular para transferir", () => {
  assert.ok(validarPagos({ transferencia: true, titular: "Ana" }).error); // sin alias ni CBU
  assert.ok(validarPagos({ transferencia: true, alias: "bar.esquina" }).error); // sin titular
  assert.ok(validarPagos({ alias: "a b" }).error);
  assert.ok(validarPagos({ cbu: "123" }).error);
  assert.equal(validarPagos({ transferencia: true, cbu: "0000003100012345678901", titular: "Ana" }).valor.cbu.length, 22);
  assert.deepEqual(validarPagos(PAGOS).valor, PAGOS);
});

test("mediosActivos: transferencia sólo con alias o CBU", () => {
  assert.deepEqual(mediosActivos({ pagos: PAGOS }), ["efectivo", "transferencia"]);
  assert.deepEqual(mediosActivos({ pagos: { transferencia: true } }), []);
  assert.deepEqual(mediosActivos({}), []);
});

test("montosDePago: transferencia con envío en efectivo separa lo que cobra el repartidor", () => {
  assert.deepEqual(montosDePago("transferencia", 4000, { costo: 1000, cobro: "efectivo" }), { transferir: 4000, efectivo: 1000 });
  assert.deepEqual(montosDePago("transferencia", 4000, { costo: 1000, cobro: "pedido" }), { transferir: 5000, efectivo: 0 });
  assert.deepEqual(montosDePago("efectivo", 4000, { costo: 1000, cobro: "efectivo" }), { transferir: 0, efectivo: 5000 });
  assert.deepEqual(montosDePago(null, 4000, { costo: 0 }), { transferir: 0, efectivo: 4000 });
});

test("validarPago: efectivo con vuelto, monto menor → error; mesa y sin medios no piden pago", () => {
  const cfg = { pagos: PAGOS };
  const envio = { costo: 1000, cobro: "pedido" };
  assert.deepEqual(validarPago({ cfg, tipoEntrega: "delivery", metodo: "efectivo", pagaCon: 10000, total: 4000, envio }).valor,
    { metodo_pago: "efectivo", paga_con: 10000, estado_pago: "pendiente" });
  assert.ok(validarPago({ cfg, tipoEntrega: "delivery", metodo: "efectivo", pagaCon: 4500, total: 4000, envio }).error);
  assert.equal(validarPago({ cfg, tipoEntrega: "retiro", metodo: "efectivo", total: 4000 }).valor.paga_con, null); // paga justo
  assert.equal(validarPago({ cfg, tipoEntrega: "retiro", metodo: "transferencia", total: 4000 }).valor.estado_pago, "en_revision");
  assert.ok(validarPago({ cfg, tipoEntrega: "retiro", metodo: null, total: 4000 }).error);
  assert.ok(validarPago({ cfg: { pagos: { efectivo: true } }, tipoEntrega: "retiro", metodo: "transferencia", total: 4000 }).error);
  assert.equal(validarPago({ cfg, tipoEntrega: "mesa", metodo: null, total: 4000 }).valor, null);
  assert.equal(validarPago({ cfg: {}, tipoEntrega: "retiro", metodo: "efectivo", total: 4000 }).valor, null);
});

// ── Pedido ──
let cfg, ops, rol;
beforeEach(() => {
  olvidarModulos(3);
  ops = [];
  rol = "admin";
  cfg = { negocio_id: 3, retiro_activo: true, delivery_activo: true, pagos: PAGOS, envio: { cobrar: true, monto: 1000, cobro: "efectivo" } };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, payload: q.payload, filters: q.filters });
    if (q.table === "negocios") return { data: { id: 3, modulos: { ...LEGADO } }, error: null };
    if (q.table === "adjuntos") {
      const a = q.filters.uso === "comprobante" && { comp1: { id: 50, token: "comp1", tipo: "imagen" }, modelo: { id: 51, token: "modelo", tipo: "3d" } }[q.filters.token];
      return { data: a || null, error: null };
    }
    if (q.table === "configuracion" && q.op === "upsert") return { data: { pagos: q.payload.pagos }, error: null };
    if (q.table === "configuracion") return { data: cfg, error: null };
    if (q.table === "productos" && q.op === "select") return { data: [{ id: 1, nombre: "Papas", precio: 4000, costo: 0, disponible: true }], error: null };
    if (q.table === "rpc:crear_pedido") return { data: { pedido: { id: 8, ...q.payload.p_pedido }, items: [] }, error: null };
    if (q.table === "pedidos" && q.op === "update") {
      return q.filters.metodo_pago === "transferencia" && q.filters.id === 8
        ? { data: { id: 8, ...q.payload }, error: null }
        : { data: null, error: null };
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
  await createPedido({ negocioId: 3, body: { items: [{ producto_id: 1, cantidad: 1 }], cliente: "Ana", tipo_entrega: "retiro", telefono_cliente: "381", ...extra } }, res);
  return res;
};
const enviado = () => ops.find((o) => o.table === "rpc:crear_pedido")?.payload.p_pedido;

test("pedido: transferencia queda en revisión; efectivo guarda con cuánto paga", async () => {
  assert.equal((await pedir({ metodo_pago: "transferencia" })).code, 201);
  assert.equal(enviado().estado_pago, "en_revision");
  ops = [];
  const r = await pedir({ tipo_entrega: "delivery", direccion_entrega: "Mitre 1", metodo_pago: "efectivo", paga_con: 10000 });
  assert.equal(r.code, 201);
  assert.equal(enviado().paga_con, 10000);
  assert.equal(enviado().costo_envio, 1000);
});

test("pedido: sin medio de pago o con monto menor al total (con envío) → 400", async () => {
  assert.equal((await pedir({})).code, 400);
  assert.equal((await pedir({ tipo_entrega: "delivery", direccion_entrega: "Mitre 1", metodo_pago: "efectivo", paga_con: 4500 })).code, 400);
});

test("pedido: local sin medios de pago no manda las columnas", async () => {
  cfg.pagos = null;
  assert.equal((await pedir({ metodo_pago: "efectivo" })).code, 201);
  assert.equal("metodo_pago" in enviado(), false);
});

test("comprobante: se guarda con quién transfirió; obligatorio sin archivo → 400; 3D o vencido → 400", async () => {
  const r = await pedir({ metodo_pago: "transferencia", transfirio: " Dante ", comprobante: "comp1" });
  assert.equal(r.code, 201);
  assert.equal(enviado().comprobante_id, 50);
  assert.equal(enviado().transfirio, "Dante");
  assert.deepEqual(ops.find((o) => o.table === "rpc:crear_pedido").payload.p_adjuntos, ["comp1"]);
  assert.equal((await pedir({ metodo_pago: "transferencia", comprobante: "modelo" })).code, 400);
  assert.equal((await pedir({ metodo_pago: "transferencia", comprobante: "viejo" })).code, 400);
  cfg.pagos = { ...PAGOS, comprobante: "obligatorio" };
  assert.equal((await pedir({ metodo_pago: "transferencia" })).code, 400);
  cfg.pagos = { ...PAGOS, comprobante: "no" };
  ops = [];
  await pedir({ metodo_pago: "transferencia", comprobante: "comp1" });
  assert.equal("comprobante_id" in enviado(), false);
});

// ── Confirmar transferencia ──
const confirmar = async (rolUsuario, estado_pago, id = "8") => {
  const res = respuesta();
  await updatePagoPedido({ negocioId: 3, params: { id }, user: { id: 1, rol: rolUsuario }, body: { estado_pago } }, res);
  return res;
};

test("updatePagoPedido: dueño y Admin sí, Staff no; sólo transferencias", async () => {
  assert.equal((await confirmar("staff", "pagado")).code, 403);
  assert.equal((await confirmar("admin", "pagado")).body.estado_pago, "pagado");
  assert.equal((await confirmar("manager", "rechazado")).body.estado_pago, "rechazado");
  assert.equal((await confirmar("admin", "otra")).code, 400);
  assert.equal((await confirmar("admin", "pagado", "9")).code, 404);
});

// ── Configuración ──
test("updatePagos: sólo el dueño; menú público oculta la cuenta si no hay transferencia", async () => {
  const res = respuesta();
  await updatePagos({ negocioId: 3, user: { id: 1, rol: "manager" }, body: PAGOS }, res);
  assert.equal(res.code, 403);
  const ok = respuesta();
  await updatePagos({ negocioId: 3, user: { id: 1, rol: "admin" }, body: PAGOS }, ok);
  assert.deepEqual(ok.body.pagos, PAGOS);

  cfg.pagos = { ...PAGOS, transferencia: false };
  const pub = respuesta();
  await getConfiguracion({ headers: { "x-negocio-id": "3" }, query: {} }, pub);
  assert.equal(pub.body.pagos.alias, "");
  assert.equal(pub.body.pagos.efectivo, true);
});
