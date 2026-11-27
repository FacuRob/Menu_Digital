const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

const chats = require("../src/services/chatsService");
const stt = require("../src/services/transcripcionService");

let tablas;
let pedidos; // requests salientes (url + init)
let respuestaStt;
const fetchOriginal = global.fetch;
const cumple = (fila, filtros) => Object.entries(filtros).every(([k, v]) => fila[k] === v);
const AUDIO = Buffer.from("OggS-audio-falso");

beforeEach(() => {
  pedidos = [];
  respuestaStt = { ok: true, json: { text: "  Hola, ¿tienen  milanesas? " } };
  tablas = { whatsapp_chats: [{ id: 1, negocio_id: 5, telefono: "543815052050", no_leidos: 0 }], whatsapp_mensajes: [] };
  process.env.WHATSAPP_TOKEN = "tok";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  process.env.TRANSCRIPCION_API_KEY = "gsk";
  let nextId = 100;
  db.setHandler((q) => {
    const filas = tablas[q.table] || [];
    if (q.op === "insert") {
      const nueva = { id: nextId++, ...q.payload[0] };
      filas.push(nueva);
      return { data: nueva, error: null };
    }
    if (q.op === "update") return { data: null, error: null };
    const res = filas.filter((f) => cumple(f, q.filters));
    return { data: q.limited ? res.slice(0, q.limited) : res[0] || null, error: null };
  });
  global.fetch = async (url, init = {}) => {
    const u = String(url);
    pedidos.push({ url: u, init });
    if (u.includes("/audio/transcriptions")) {
      return { ok: respuestaStt.ok, status: respuestaStt.ok ? 200 : 429, json: async () => respuestaStt.json };
    }
    if (u.includes("graph.facebook.com/v21.0/media-1")) {
      return { ok: true, json: async () => ({ url: "https://lookaside.fbsbx.com/audio-1", mime_type: "audio/ogg; codecs=opus", file_size: 900 }) };
    }
    if (u.includes("lookaside")) return { ok: true, arrayBuffer: async () => AUDIO };
    if (u.includes("getBase64FromMediaMessage")) {
      return { ok: true, json: async () => ({ base64: AUDIO.toString("base64"), mimetype: "audio/ogg; codecs=opus" }) };
    }
    return { ok: true, json: async () => ({}) };
  };
});

afterEach(() => {
  global.fetch = fetchOriginal;
  for (const k of ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "TRANSCRIPCION_API_KEY", "EVOLUTION_API_URL", "EVOLUTION_API_KEY"]) {
    delete process.env[k];
  }
});

const audioMeta = { from: "5493815052050", id: "wamid.A1", timestamp: "1761998400", type: "audio", audio: { id: "media-1" } };

test("audio de Meta: se baja con el token, se pasa a texto y queda guardado", async () => {
  const r = await chats.registrarEntrantes({ messages: [audioMeta] }, { negocioId: 5 });
  assert.strictEqual(r.length, 1);
  assert.strictEqual(tablas.whatsapp_mensajes[0].texto, "🎤 Audio: Hola, ¿tienen milanesas?");
  // Meta: info del archivo y descarga, las dos con el token.
  assert.strictEqual(pedidos[0].init.headers.Authorization, "Bearer tok");
  assert.strictEqual(pedidos[1].init.headers.Authorization, "Bearer tok");
  // Transcripción: Groq por defecto, en español, archivo .ogg.
  const stt = pedidos.find((p) => p.url.includes("/audio/transcriptions"));
  assert.strictEqual(stt.url, "https://api.groq.com/openai/v1/audio/transcriptions");
  assert.strictEqual(stt.init.headers.Authorization, "Bearer gsk");
  assert.strictEqual(stt.init.body.get("model"), "whisper-large-v3-turbo");
  assert.strictEqual(stt.init.body.get("language"), "es");
  assert.strictEqual(stt.init.body.get("file").name, "audio.ogg");
});

test("audio por QR (Evolution): se pide por el id del mensaje", async () => {
  process.env.EVOLUTION_API_URL = "https://evo.test";
  process.env.EVOLUTION_API_KEY = "evo-key";
  const texto = await stt.transcribirAudio({ id: "BAE5ABC", type: "audio" }, 5);
  assert.strictEqual(texto, "Hola, ¿tienen milanesas?");
  const evo = pedidos[0];
  assert.strictEqual(evo.url, "https://evo.test/chat/getBase64FromMediaMessage/dinex-5");
  assert.deepStrictEqual(JSON.parse(evo.init.body).message, { key: { id: "BAE5ABC" } });
  assert.strictEqual(evo.init.headers.apikey, "evo-key");
});

test("sin clave de transcripción: queda «🎤 Audio» y no se baja nada", async () => {
  delete process.env.TRANSCRIPCION_API_KEY;
  await chats.registrarEntrantes({ messages: [audioMeta] }, { negocioId: 5 });
  assert.strictEqual(tablas.whatsapp_mensajes[0].texto, "🎤 Audio");
  assert.strictEqual(pedidos.length, 0);
});

test("si la transcripción falla, el mensaje igual se guarda como «🎤 Audio»", async () => {
  respuestaStt = { ok: false, json: { error: { message: "Rate limit" } } };
  const warn = console.warn;
  console.warn = () => {};
  const r = await chats.registrarEntrantes({ messages: [audioMeta] }, { negocioId: 5 });
  console.warn = warn;
  assert.strictEqual(r.length, 1);
  assert.strictEqual(tablas.whatsapp_mensajes[0].texto, "🎤 Audio");
});

test("un texto común no pasa por la transcripción", async () => {
  await chats.registrarEntrantes(
    { messages: [{ from: "5493815052050", id: "wamid.T1", type: "text", text: { body: "hola" } }] },
    { negocioId: 5 },
  );
  assert.strictEqual(tablas.whatsapp_mensajes[0].texto, "hola");
  assert.strictEqual(pedidos.length, 0);
});

test("extension: según el tipo del audio", () => {
  assert.strictEqual(stt.extension("audio/ogg; codecs=opus"), "ogg");
  assert.strictEqual(stt.extension("audio/mpeg"), "mp3");
  assert.strictEqual(stt.extension("audio/mp4"), "m4a");
  assert.strictEqual(stt.extension(undefined), "ogg");
});
