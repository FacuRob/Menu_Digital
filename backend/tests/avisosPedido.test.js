const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

// ── Inyección de dependencias ANTES de requerir los módulos ──
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const { normalizarTelefono } = require("../src/services/whatsappService");
const {
  notificarPedido,
  registrarEstadosMeta,
  obtenerConfig,
} = require("../src/services/avisosPedidoService");
const { recibirWebhook, verificarWebhook } = require("../src/controllers/whatsappController");

let ops;
let configNegocio; // fila de whatsapp_avisos (o null)
let enviados; // requests a la API de Meta
const fetchOriginal = global.fetch;

beforeEach(() => {
  ops = [];
  enviados = [];
  configNegocio = { activo: true, estados: {} };
  process.env.WHATSAPP_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "whatsapp_avisos") return { data: configNegocio, error: null };
    if (q.table === "configuracion") return { data: { nombre: "Bar Test" }, error: null };
    if (q.table === "whatsapp_mensajes" && q.op === "select") {
      return { data: { id: 1, estado: "entregado" }, error: null };
    }
    return { data: null, error: null };
  });
  global.fetch = async (url, init) => {
    enviados.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ messages: [{ id: "wamid.X" }] }) };
  };
});

afterEach(() => {
  global.fetch = fetchOriginal;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
});

const pedido = (extra = {}) => ({
  id: 128,
  negocio_id: 5,
  cliente: "Juan",
  telefono_cliente: "381 505-2050",
  acepta_whatsapp: true,
  estado: "preparando",
  ...extra,
});

test("normalizarTelefono: formatos argentinos comunes (54 + 10 dígitos, sin el 9)", () => {
  assert.equal(normalizarTelefono("381 505-2050"), "543815052050");
  assert.equal(normalizarTelefono("+54 381 5052050"), "543815052050");
  assert.equal(normalizarTelefono("+5493815052050"), "543815052050");
  assert.equal(normalizarTelefono("9 381 505-2050"), "543815052050");
  assert.equal(normalizarTelefono("0381 15 505-2050"), "543815052050");
  assert.equal(normalizarTelefono("11 2345-6789"), "541123456789");
  assert.equal(normalizarTelefono("123"), null);
  assert.equal(normalizarTelefono(""), null);
});

test("notificarPedido: envía la plantilla del estado con nombre, local y número", async () => {
  const r = await notificarPedido(pedido(), "preparando");
  assert.equal(r.ok, true);
  assert.equal(enviados.length, 1);
  const tpl = enviados[0].body.template;
  assert.equal(enviados[0].body.to, "543815052050");
  assert.equal(tpl.name, "pedido_en_preparacion");
  assert.deepEqual(
    tpl.components[0].parameters.map((p) => p.text),
    ["Juan", "Bar Test", "128"],
  );
  // Queda registrado.
  const log = ops.find((o) => o.table === "whatsapp_mensajes" && o.op === "insert");
  assert.equal(log.payload[0].estado, "enviado");
  assert.equal(log.payload[0].meta_id, "wamid.X");
});

test("notificarPedido: sin consentimiento del cliente no envía nada", async () => {
  const r = await notificarPedido(pedido({ acepta_whatsapp: false }), "preparando");
  assert.equal(r.motivo, "sin_consentimiento");
  assert.equal(enviados.length, 0);
});

test("notificarPedido: si el local apagó los avisos no envía", async () => {
  configNegocio = { activo: false, estados: {} };
  const r = await notificarPedido(pedido(), "preparando");
  assert.equal(r.motivo, "desactivado");
  assert.equal(enviados.length, 0);
});

test("notificarPedido: 'entregado' viene apagado por defecto", async () => {
  const r = await notificarPedido(pedido(), "entregado");
  assert.equal(r.motivo, "desactivado");
});

test("notificarPedido: sin WhatsApp configurado no intenta enviar", async () => {
  delete process.env.WHATSAPP_TOKEN;
  const r = await notificarPedido(pedido(), "preparando");
  assert.equal(r.motivo, "no_configurado");
  assert.equal(enviados.length, 0);
});

test("notificarPedido: si Meta rechaza, queda registrado como fallido y no lanza", async () => {
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "Template not found" } }) });
  const r = await notificarPedido(pedido(), "preparando");
  assert.equal(r.ok, false);
  const log = ops.find((o) => o.table === "whatsapp_mensajes" && o.op === "insert");
  assert.equal(log.payload[0].estado, "fallido");
  assert.match(log.payload[0].error, /Template not found/);
});

test("obtenerConfig: si la tabla no existe, avisos apagados (no rompe)", async () => {
  db.setHandler(() => ({ data: null, error: { message: "relation does not exist" } }));
  const cfg = await obtenerConfig(5);
  assert.equal(cfg.activo, false);
  assert.equal(cfg.estados.pendiente, true);
});

test("registrarEstadosMeta: avanza a 'leido' pero no retrocede a 'enviado'", async () => {
  await registrarEstadosMeta([{ id: "wamid.X", status: "read" }]);
  let upd = ops.filter((o) => o.table === "whatsapp_mensajes" && o.op === "update");
  assert.equal(upd.length, 1);
  assert.equal(upd[0].payload.estado, "leido");

  ops = [];
  await registrarEstadosMeta([{ id: "wamid.X", status: "sent" }]);
  upd = ops.filter((o) => o.op === "update");
  assert.equal(upd.length, 0);
});

// ── Webhook ──
const resMock = () => ({
  code: null,
  sent: null,
  status(c) {
    this.code = c;
    return this;
  },
  send(b) {
    this.sent = b;
    return this;
  },
  sendStatus(c) {
    this.code = c;
    return this;
  },
});

test("webhook: verificación con el token correcto devuelve el challenge", () => {
  process.env.WHATSAPP_VERIFY_TOKEN = "mi-token";
  const res = resMock();
  verificarWebhook(
    { query: { "hub.mode": "subscribe", "hub.verify_token": "mi-token", "hub.challenge": "42" } },
    res,
  );
  assert.equal(res.code, 200);
  assert.equal(res.sent, "42");
  const res2 = resMock();
  verificarWebhook({ query: { "hub.mode": "subscribe", "hub.verify_token": "otro" } }, res2);
  assert.equal(res2.code, 403);
});

test("webhook: rechaza firmas inválidas y acepta las válidas", async () => {
  process.env.WHATSAPP_APP_SECRET = "app-secret";
  const raw = Buffer.from(JSON.stringify({ entry: [] }));
  const malo = resMock();
  await recibirWebhook({ body: raw, headers: { "x-hub-signature-256": "sha256=00" } }, malo);
  assert.equal(malo.code, 401);

  const sig = crypto.createHmac("sha256", "app-secret").update(raw).digest("hex");
  const bueno = resMock();
  await recibirWebhook({ body: raw, headers: { "x-hub-signature-256": `sha256=${sig}` } }, bueno);
  assert.equal(bueno.code, 200);
});
