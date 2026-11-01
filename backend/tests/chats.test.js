const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const chats = require("../src/services/chatsService");
const { recibirWebhook } = require("../src/controllers/whatsappController");

// "Base de datos" en memoria para estos tests.
let tablas;
let enviados;
const fetchOriginal = global.fetch;
const HORA = 60 * 60 * 1000;

const cumple = (fila, filtros) => Object.entries(filtros).every(([k, v]) => fila[k] === v);

beforeEach(() => {
  enviados = [];
  tablas = { whatsapp_chats: [], whatsapp_mensajes: [], pedidos: [] };
  process.env.WHATSAPP_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  let nextId = 100;
  db.setHandler((q) => {
    const filas = tablas[q.table] || [];
    if (q.op === "insert") {
      const nueva = { id: nextId++, no_leidos: 0, ...q.payload[0] };
      filas.push(nueva);
      return { data: nueva, error: null };
    }
    if (q.op === "update") {
      filas.filter((f) => cumple(f, q.filters)).forEach((f) => Object.assign(f, q.payload));
      return { data: null, error: null };
    }
    const res = filas.filter((f) => cumple(f, q.filters));
    // maybeSingle()/single() → un objeto; listas (limit) → array.
    return { data: q.limited ? res.slice(0, q.limited) : res[0] || null, error: null };
  });
  global.fetch = async (url, init) => {
    enviados.push({ url, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({ messages: [{ id: `wamid.${enviados.length}` }] }) };
  };
});

afterEach(() => {
  global.fetch = fetchOriginal;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_APP_SECRET;
});

const entrante = (extra = {}) => ({
  contacts: [{ wa_id: "5493815052050", profile: { name: "Juan Pérez" } }],
  messages: [
    { from: "5493815052050", id: "wamid.IN1", timestamp: "1761998400", type: "text", text: { body: "Hola, ¿falta mucho?" } },
  ],
  ...extra,
});

test("textoDeMensaje: texto, botones y adjuntos", () => {
  assert.strictEqual(chats.textoDeMensaje({ type: "text", text: { body: "hola" } }), "hola");
  assert.strictEqual(chats.textoDeMensaje({ type: "button", button: { text: "Sí" } }), "Sí");
  assert.strictEqual(chats.textoDeMensaje({ type: "image" }), "📷 Imagen");
  assert.strictEqual(chats.textoDeMensaje({ type: "image", image: { caption: "mirá" } }), "📷 mirá");
  assert.strictEqual(chats.textoDeMensaje({ type: "audio" }), "🎤 Audio");
  assert.strictEqual(chats.textoDeMensaje({ type: "raro" }), "Mensaje (raro)");
});

test("ventanaAbierta: 24 h desde el último mensaje del cliente", () => {
  const ahora = Date.now();
  assert.strictEqual(chats.ventanaAbierta({ ultimo_entrante_at: new Date(ahora - 2 * HORA).toISOString() }, ahora), true);
  assert.strictEqual(chats.ventanaAbierta({ ultimo_entrante_at: new Date(ahora - 25 * HORA).toISOString() }, ahora), false);
  assert.strictEqual(chats.ventanaAbierta({ ultimo_entrante_at: null }, ahora), false);
});

test("registrarEntrantes: va al chat que ya existe (549… se normaliza a 54…)", async () => {
  tablas.whatsapp_chats.push({ id: 1, negocio_id: 5, telefono: "543815052050", nombre: "Juan", no_leidos: 2 });
  const r = await chats.registrarEntrantes(entrante());
  assert.strictEqual(r.length, 1);
  const msg = tablas.whatsapp_mensajes[0];
  assert.strictEqual(msg.chat_id, 1);
  assert.strictEqual(msg.negocio_id, 5);
  assert.strictEqual(msg.direccion, "entrante");
  assert.strictEqual(msg.texto, "Hola, ¿falta mucho?");
  const chat = tablas.whatsapp_chats[0];
  assert.strictEqual(chat.no_leidos, 3);
  assert.strictEqual(chat.ultimo_texto, "Hola, ¿falta mucho?");
  assert.ok(chat.ultimo_entrante_at);
});

test("registrarEntrantes: sin chat previo, usa el negocio del último pedido con ese teléfono", async () => {
  tablas.pedidos.push({ negocio_id: 9, cliente: "Juancito", telefono_cliente: "381 505-2050" });
  await chats.registrarEntrantes(entrante());
  assert.strictEqual(tablas.whatsapp_chats.length, 1);
  assert.strictEqual(tablas.whatsapp_chats[0].negocio_id, 9);
  assert.strictEqual(tablas.whatsapp_chats[0].nombre, "Juan Pérez"); // el del perfil de WhatsApp
  assert.strictEqual(tablas.whatsapp_mensajes[0].negocio_id, 9);
});

test("registrarEntrantes: un mensaje repetido (mismo wamid) no se guarda dos veces", async () => {
  tablas.whatsapp_chats.push({ id: 1, negocio_id: 5, telefono: "543815052050", no_leidos: 0 });
  await chats.registrarEntrantes(entrante());
  await chats.registrarEntrantes(entrante());
  assert.strictEqual(tablas.whatsapp_mensajes.length, 1);
});

test("registrarEntrantes: teléfono sin negocio → se descarta", async () => {
  const warn = console.warn;
  console.warn = () => {};
  const r = await chats.registrarEntrantes(entrante());
  console.warn = warn;
  assert.strictEqual(r.length, 0);
  assert.strictEqual(tablas.whatsapp_mensajes.length, 0);
});

test("responder: dentro de las 24 h manda texto libre y lo registra", async () => {
  tablas.whatsapp_chats.push({
    id: 1, negocio_id: 5, telefono: "543815052050",
    ultimo_entrante_at: new Date(Date.now() - HORA).toISOString(),
  });
  const r = await chats.responder(5, "1", "  Sale en 10 minutos  ");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(enviados.length, 1);
  assert.deepStrictEqual(enviados[0].body.text, { body: "Sale en 10 minutos", preview_url: false });
  assert.strictEqual(enviados[0].body.to, "543815052050");
  const msg = tablas.whatsapp_mensajes[0];
  assert.strictEqual(msg.direccion, "saliente");
  assert.strictEqual(msg.estado, "enviado");
  assert.strictEqual(msg.meta_id, "wamid.1");
  assert.strictEqual(tablas.whatsapp_chats[0].ultimo_texto, "Sale en 10 minutos");
});

test("responder: pasadas las 24 h → 409 y no se envía nada", async () => {
  tablas.whatsapp_chats.push({
    id: 1, negocio_id: 5, telefono: "543815052050",
    ultimo_entrante_at: new Date(Date.now() - 30 * HORA).toISOString(),
  });
  const r = await chats.responder(5, 1, "hola");
  assert.strictEqual(r.status, 409);
  assert.strictEqual(enviados.length, 0);
});

test("responder: el chat de otro negocio no se puede usar (404)", async () => {
  tablas.whatsapp_chats.push({ id: 1, negocio_id: 7, telefono: "543815052050", ultimo_entrante_at: new Date().toISOString() });
  const r = await chats.responder(5, 1, "hola");
  assert.strictEqual(r.status, 404);
  assert.strictEqual(enviados.length, 0);
});

test("responder: mensaje vacío → 400", async () => {
  const r = await chats.responder(5, 1, "   ");
  assert.strictEqual(r.status, 400);
});

test("mensajesDelChat: marca el chat como leído", async () => {
  tablas.whatsapp_chats.push({ id: 1, negocio_id: 5, telefono: "543815052050", no_leidos: 4 });
  const r = await chats.mensajesDelChat(5, 1);
  assert.strictEqual(r.chat.no_leidos, 0);
  assert.strictEqual(tablas.whatsapp_chats[0].no_leidos, 0);
  assert.strictEqual(await chats.mensajesDelChat(6, 1), null);
});

test("webhook: los mensajes entrantes se guardan en el chat", async () => {
  process.env.WHATSAPP_APP_SECRET = "secreto";
  tablas.whatsapp_chats.push({ id: 1, negocio_id: 5, telefono: "543815052050", no_leidos: 0 });
  const raw = Buffer.from(JSON.stringify({ entry: [{ changes: [{ value: entrante() }] }] }));
  const firma = "sha256=" + crypto.createHmac("sha256", "secreto").update(raw).digest("hex");
  let status;
  const res = { sendStatus: (s) => { status = s; return res; } };
  await recibirWebhook({ body: raw, headers: { "x-hub-signature-256": firma } }, res);
  assert.strictEqual(status, 200);
  for (let i = 0; i < 20 && !tablas.whatsapp_mensajes.length; i++) {
    await new Promise((r) => setImmediate(r));
  }
  assert.strictEqual(tablas.whatsapp_mensajes.length, 1);
  assert.strictEqual(tablas.whatsapp_mensajes[0].chat_id, 1);
});
