const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const ia = require("../src/services/iaService");
const chats = require("../src/services/chatsService");

let tablas;
let llamadas; // requests a OpenRouter
let enviados; // requests a WhatsApp
let respuestaModelo;
const fetchOriginal = global.fetch;
const HORA = 60 * 60 * 1000;

const cumple = (fila, filtros) => Object.entries(filtros).every(([k, v]) => fila[k] === v);

beforeEach(() => {
  llamadas = [];
  enviados = [];
  respuestaModelo = { content: "¡Hola! Abrimos a las 20 hs. 🍔" };
  process.env.WHATSAPP_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  process.env.OPENROUTER_API_KEY = "or-key";
  tablas = {
    whatsapp_chats: [
      {
        id: 1, negocio_id: 5, telefono: "543815052050", nombre: "Juan", no_leidos: 1,
        necesita_humano: false, ia_pausada_hasta: null,
        ultimo_entrante_at: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    whatsapp_mensajes: [
      { id: 1, chat_id: 1, direccion: "entrante", texto: "¿A qué hora abren?", created_at: new Date().toISOString() },
    ],
    whatsapp_ia: [{ negocio_id: 5, activo: true, instrucciones: "Los martes hay 2x1 en pizzas." }],
    configuracion: [
      {
        negocio_id: 5, nombre: "Bar la Esquina", direccion: "Las Piedras 2192", moneda: "ARS",
        retiro_activo: true, delivery_activo: true, horarios: "Todos los días de 20 a 00",
      },
    ],
    negocios: [{ id: 5, slug: "bar-la-esquina" }],
    categorias: [{ id: 10, negocio_id: 5, nombre: "Burgers", activo: true }],
    productos: [
      { negocio_id: 5, categoria_id: 10, nombre: "Cheese", precio: 9800, disponible: true },
      { negocio_id: 5, categoria_id: 10, nombre: "Doble bacon", precio: 12500, disponible: false },
      { negocio_id: 5, categoria_id: 10, nombre: "Veggie", precio: 9000, disponible: true, controlar_stock: true, stock: 0 },
    ],
    pedidos: [
      { id: 18, negocio_id: 5, estado: "preparando", tipo_entrega: "retiro", total: 9800, telefono_cliente: "381 505-2050" },
      { id: 19, negocio_id: 5, estado: "pendiente", tipo_entrega: "retiro", total: 100, telefono_cliente: "011 4444-5555" },
    ],
  };
  let nextId = 100;
  db.setHandler((q) => {
    const filas = tablas[q.table] || [];
    if (q.op === "insert") {
      const nueva = { id: nextId++, created_at: new Date().toISOString(), ...q.payload[0] };
      filas.push(nueva);
      return { data: nueva, error: null };
    }
    if (q.op === "update") {
      filas.filter((f) => cumple(f, q.filters)).forEach((f) => Object.assign(f, q.payload));
      return { data: null, error: null };
    }
    if (q.op === "upsert") {
      const i = filas.findIndex((f) => f.negocio_id === q.payload.negocio_id);
      if (i >= 0) filas[i] = { ...filas[i], ...q.payload };
      else filas.push(q.payload);
      return { data: null, error: null };
    }
    let res = filas.filter((f) => cumple(f, q.filters));
    // El historial se pide del más nuevo al más viejo.
    if (q.table === "whatsapp_mensajes" && q.ordered) res = [...res].reverse();
    if (q.limited || q.ordered) return { data: q.limited ? res.slice(0, q.limited) : res, error: null };
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
});

afterEach(() => {
  global.fetch = fetchOriginal;
  delete process.env.WHATSAPP_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.OPENROUTER_API_KEY;
});

test("responderConIA: contesta con los datos del local y lo registra como IA", async () => {
  const r = await ia.responderConIA(1);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(llamadas.length, 1);
  assert.strictEqual(llamadas[0].model, "anthropic/claude-haiku-5.5");
  const system = llamadas[0].messages[0].content;
  assert.match(system, /Bar la Esquina/);
  assert.match(system, /Cheese/);
  assert.doesNotMatch(system, /Doble bacon/); // no disponible
  assert.doesNotMatch(system, /Veggie/); // sin stock
  assert.match(system, /Pedido #18/); // pedido de este cliente
  assert.doesNotMatch(system, /Pedido #19/); // pedido de otro cliente
  assert.match(system, /2x1 en pizzas/); // indicaciones del dueño
  assert.match(system, /menu\/bar-la-esquina/);
  assert.deepStrictEqual(llamadas[0].messages[1], { role: "user", content: "¿A qué hora abren?" });
  // Se envió por WhatsApp y quedó registrado.
  assert.strictEqual(enviados[0].text.body, "¡Hola! Abrimos a las 20 hs. 🍔");
  const msg = tablas.whatsapp_mensajes.at(-1);
  assert.strictEqual(msg.autor, "ia");
  assert.strictEqual(msg.direccion, "saliente");
});

test("responderConIA: deriva a una persona y pausa la IA en ese chat", async () => {
  respuestaModelo = {
    content: "",
    tool_calls: [
      {
        function: {
          name: "derivar_a_humano",
          arguments: JSON.stringify({ motivo: "Quiere cancelar", mensaje_al_cliente: "Ya le aviso al local 🙌" }),
        },
      },
    ],
  };
  const log = console.log;
  console.log = () => {};
  const r = await ia.responderConIA(1);
  console.log = log;
  assert.strictEqual(r.derivado, true);
  assert.strictEqual(tablas.whatsapp_chats[0].necesita_humano, true);
  assert.strictEqual(enviados[0].text.body, "Ya le aviso al local 🙌");
  // El siguiente mensaje ya no lo responde la IA.
  tablas.whatsapp_mensajes.push({ id: 2, chat_id: 1, direccion: "entrante", texto: "?", created_at: new Date().toISOString() });
  const r2 = await ia.responderConIA(1);
  assert.strictEqual(r2.motivo, "pausada");
  assert.strictEqual(llamadas.length, 1);
});

test("responderConIA: no responde si el negocio no la activó o falta la clave", async () => {
  tablas.whatsapp_ia[0].activo = false;
  assert.strictEqual((await ia.responderConIA(1)).motivo, "desactivada");
  tablas.whatsapp_ia[0].activo = true;
  delete process.env.OPENROUTER_API_KEY;
  assert.strictEqual((await ia.responderConIA(1)).motivo, "sin_clave");
  assert.strictEqual(llamadas.length, 0);
});

test("responderConIA: no responde si lo último del chat ya es del local", async () => {
  tablas.whatsapp_mensajes.push({ id: 2, chat_id: 1, direccion: "saliente", texto: "Hola", created_at: new Date().toISOString() });
  assert.strictEqual((await ia.responderConIA(1)).motivo, "nada_que_responder");
  assert.strictEqual(llamadas.length, 0);
});

test("responder desde el panel pausa la IA en ese chat", async () => {
  await chats.responder(5, 1, "Te atiendo yo");
  const chat = tablas.whatsapp_chats[0];
  assert.ok(new Date(chat.ia_pausada_hasta).getTime() > Date.now() + 11 * HORA);
  assert.strictEqual(chats.iaPausada(chat), true);
  assert.strictEqual(tablas.whatsapp_mensajes.at(-1).autor, "negocio");
});

test("cambiarIAChat: pausa manual y reactivación", async () => {
  const pausado = await chats.cambiarIAChat(5, 1, false);
  assert.strictEqual(pausado.ia_pausada, true);
  tablas.whatsapp_chats[0].necesita_humano = true;
  const activo = await chats.cambiarIAChat(5, 1, true);
  assert.strictEqual(activo.ia_pausada, false);
  assert.strictEqual(tablas.whatsapp_chats[0].necesita_humano, false);
  assert.strictEqual(await chats.cambiarIAChat(6, 1, true), null); // otro negocio
});

test("guardarConfigIA: recorta las indicaciones y conserva lo no enviado", async () => {
  const r = await ia.guardarConfigIA(5, { instrucciones: "  x".padEnd(3000, "y") });
  assert.strictEqual(r.activo, true);
  assert.strictEqual(r.instrucciones.length, 2000);
});

test("abiertoAhora: franjas que cruzan la medianoche", () => {
  process.env.NEGOCIO_TZ = "UTC";
  const todos = Array.from({ length: 7 }, () => ({ cerrado: false, franjas: [{ desde: "20:00", hasta: "02:00" }] }));
  assert.strictEqual(ia.abiertoAhora(todos, new Date("2026-11-04T21:00:00Z")), true);
  assert.strictEqual(ia.abiertoAhora(todos, new Date("2026-11-04T01:00:00Z")), true);
  assert.strictEqual(ia.abiertoAhora(todos, new Date("2026-11-04T15:00:00Z")), false);
  assert.strictEqual(ia.abiertoAhora(null), null);
  delete process.env.NEGOCIO_TZ;
});
