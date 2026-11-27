const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
let conWhatsapp = () => true;
injectModule(require.resolve("../src/utils/planNegocio"), {
  negocioConWhatsapp: async (id) => conWhatsapp(id),
  negocioIncluye: async (id) => conWhatsapp(id),
});

const ia = require("../src/services/iaService");
const chats = require("../src/services/chatsService");
const cuentas = require("../src/services/whatsappCuentas");
const qr = require("../src/services/whatsappQR");

let tablas;
let llamadas;
let enviados;
let respuestaModelo;
const fetchOriginal = global.fetch;
const cumple = (fila, filtros) => Object.entries(filtros).every(([k, v]) => fila[k] === v);
const ahora = () => new Date().toISOString();

beforeEach(() => {
  conWhatsapp = () => true;
  llamadas = [];
  enviados = [];
  respuestaModelo = { content: "Eso lo atiende TP 😊 [NEGOCIO 1]" };
  process.env.WHATSAPP_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  process.env.OPENROUTER_API_KEY = "or-key";
  tablas = {
    whatsapp_chats: [
      { id: 1, negocio_id: 5, telefono: "543815052050", no_leidos: 0, ultimo_entrante_at: ahora(), ultimo_at: ahora() },
    ],
    whatsapp_mensajes: [{ id: 1, chat_id: 1, direccion: "entrante", texto: "¿Tienen fundas de celular?", created_at: ahora() }],
    whatsapp_ia: [{ negocio_id: 5, activo: true }, { negocio_id: 6, activo: true }],
    whatsapp_cuentas: [],
    whatsapp_qr: [],
    negocios: [
      { id: 5, cuenta_id: 1, slug: "labtinos", nombre: "Labtinos" },
      { id: 6, cuenta_id: 1, slug: "tp", nombre: "TP" },
      { id: 8, cuenta_id: 1, slug: "viejo", nombre: "Viejo", activo: false },
      { id: 7, cuenta_id: 2, slug: "ajeno", nombre: "Ajeno" },
    ],
    configuracion: [
      { negocio_id: 5, nombre: "Labtinos", moneda: "ARS" },
      { negocio_id: 6, nombre: "TP", descripcion: "Accesorios para celulares" },
    ],
    categorias: [],
    productos: [],
    pedidos: [],
  };
  let nextId = 100;
  db.setHandler((q) => {
    let filas = tablas[q.table] || [];
    if (q.op === "insert") {
      const nueva = { id: nextId++, created_at: ahora(), ...q.payload[0] };
      filas.push(nueva);
      return { data: nueva, error: null };
    }
    if (q.op === "update") {
      filas.filter((f) => cumple(f, q.filters)).forEach((f) => Object.assign(f, q.payload));
      return { data: null, error: null };
    }
    let res = filas.filter((f) => cumple(f, q.filters));
    if (q.inList) res = res.filter((f) => q.inList.vals.includes(f[q.inList.col]));
    if (q.table === "whatsapp_mensajes" && q.ordered) res = [...res].reverse();
    if (q.table === "whatsapp_chats" && q.ordered) res = [...res].sort((a, b) => String(b.ultimo_at).localeCompare(String(a.ultimo_at)));
    if (q.limited || q.ordered || q.inList) return { data: q.limited ? res.slice(0, q.limited) : res, error: null };
    return { data: res[0] || null, error: null };
  });
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).includes("openrouter")) {
      llamadas.push(body);
      return { ok: true, json: async () => ({ choices: [{ message: respuestaModelo }] }) };
    }
    enviados.push(body);
    return { ok: true, json: async () => ({ messages: [{ id: `wamid.${enviados.length}` }] }) };
  };
  cuentas.olvidar();
  qr.olvidar();
});

afterEach(() => {
  global.fetch = fetchOriginal;
  for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "OPENROUTER_API_KEY"]) delete process.env[k];
  cuentas.olvidar();
  qr.olvidar();
});

test("prompt: lista los otros negocios activos de la misma cuenta (no los ajenos)", async () => {
  await ia.responderConIA(1);
  const system = llamadas[0].messages[0].content;
  assert.match(system, /OTROS NEGOCIOS DE LA CASA \(mismo dueño; vos sólo atendés Labtinos\)\n- TP: Accesorios para celulares \[negocio 1\]/);
  assert.doesNotMatch(system, /Ajeno|Viejo/);
  assert.match(system, /15\. Otros negocios:/);
  assert.match(system, /también podés comunicarlo con TP/);
});

test("los dos usan el número de DinexFlow: botón «Hablar con TP» y al tocarlo el chat pasa a TP", async () => {
  await ia.responderConIA(1);
  const env = enviados[0];
  assert.strictEqual(env.type, "interactive");
  assert.strictEqual(env.interactive.body.text, "Eso lo atiende TP 😊");
  assert.deepStrictEqual(env.interactive.action.buttons, [{ type: "reply", reply: { id: "neg:6", title: "Hablar con TP" } }]);

  // El cliente toca el botón (llega al número de DinexFlow).
  const r = await chats.registrarEntrantes({
    messages: [{
      from: "5493815052050", id: "wamid.TAP", type: "interactive",
      interactive: { type: "button_reply", button_reply: { id: "neg:6", title: "Hablar con TP" } },
    }],
  });
  assert.strictEqual(r[0].chat.negocio_id, 6);
  assert.strictEqual(tablas.whatsapp_mensajes.at(-1).texto, "Hola 👋 (me pasaron desde otro local de la casa)");
});

test("un botón con el id de un negocio de otra cuenta no mueve el chat", async () => {
  const r = await chats.registrarEntrantes({
    messages: [{
      from: "5493815052050", id: "wamid.TRUCHO", type: "interactive",
      interactive: { type: "button_reply", button_reply: { id: "neg:7", title: "Hablar con Ajeno" } },
    }],
  });
  assert.strictEqual(r[0].chat.negocio_id, 5);
});

test("TP tiene su propio número: botón con link a su WhatsApp", async () => {
  tablas.whatsapp_cuentas.push({
    negocio_id: 6, phone_number_id: "999", telefono: "+54 9 381 444-5555", token_cifrado: cuentas.cifrar("tok-tp"), estado: "conectado",
  });
  await ia.responderConIA(1);
  const env = enviados[0];
  assert.strictEqual(env.interactive.type, "cta_url");
  assert.deepStrictEqual(env.interactive.action, {
    name: "cta_url",
    parameters: { display_text: "Escribir a TP", url: "https://wa.me/5493814445555?text=Hola%20TP" },
  });
  assert.match(tablas.whatsapp_mensajes.at(-1).texto, /🔘 Escribir a TP$/);
});

test("TP sin WhatsApp en su plan: link a su carta", async () => {
  conWhatsapp = (id) => id !== 6;
  await ia.responderConIA(1);
  // Primera respuesta: el link va en el texto, con los botones de siempre.
  assert.strictEqual(enviados[0].interactive.body.text, "Eso lo atiende TP 😊\n\n👉 TP: https://dinexflow.com.ar/negocio/tp");
  assert.strictEqual(enviados[0].interactive.action.buttons[0].reply.title, "Ver menú");
});

test("separarNegocio: número fuera de la lista se ignora y la marca no se ve", () => {
  const r = ia.separarNegocio("Ok [NEGOCIO 4]", [{ id: 6, nombre: "TP" }]);
  assert.deepStrictEqual(r, { texto: "Ok", otro: null });
});
