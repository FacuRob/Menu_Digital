const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
process.env.JWT_SECRET = "jwt-test";

const cuentas = require("../src/services/whatsappCuentas");
const { enviarTexto } = require("../src/services/whatsappService");
const chats = require("../src/services/chatsService");
const { AVISOS } = require("../src/services/avisosPedidoService");

let filas; // whatsapp_cuentas
let mensajes;
let llamadas;
let enApp; // lo que Meta dice de is_on_biz_app
let chatsGuardados;
const fetchOriginal = global.fetch;

beforeEach(() => {
  cuentas.olvidar();
  filas = [];
  mensajes = [];
  chatsGuardados = [];
  llamadas = [];
  enApp = true;
  Object.assign(process.env, {
    META_APP_ID: "app1", WHATSAPP_ES_CONFIG_ID: "cfg1", WHATSAPP_APP_SECRET: "sec",
    WHATSAPP_TOKEN: "tok-plataforma", WHATSAPP_PHONE_NUMBER_ID: "999",
  });
  db.setHandler((q) => {
    if (q.table === "whatsapp_cuentas") {
      if (q.op === "upsert") { filas = filas.filter((f) => f.negocio_id !== q.payload.negocio_id).concat(q.payload); return { data: null, error: null }; }
      if (q.op === "delete") { filas = filas.filter((f) => !Object.entries(q.filters).every(([k, v]) => String(f[k]) === String(v))); return { data: null, error: null }; }
      if (q.op === "update") { filas.forEach((f) => Object.entries(q.filters).every(([k, v]) => String(f[k]) === String(v)) && Object.assign(f, q.payload)); return { data: null, error: null }; }
      const f = filas.find((x) => Object.entries(q.filters).every(([k, v]) => String(x[k]) === String(v)));
      return { data: f || null, error: null };
    }
    if (q.table === "whatsapp_chats" && q.op === "select") return { data: chatsGuardados.find((c) => String(c.telefono) === String(q.filters.telefono)) || null, error: null };
    if (q.table === "whatsapp_chats" && q.op === "insert") { const c = { id: 7, negocio_id: q.payload[0].negocio_id, telefono: q.payload[0].telefono }; chatsGuardados.push(c); return { data: c, error: null }; }
    if (q.table === "whatsapp_mensajes" && q.op === "insert") { mensajes.push(q.payload[0]); return { data: q.payload[0], error: null }; }
    return { data: null, error: null };
  });
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    llamadas.push({ path: u.pathname.replace(/^\/v[\d.]+\//, ""), method: init.method || "GET", auth: init.headers?.Authorization, body: init.body && JSON.parse(init.body), query: Object.fromEntries(u.searchParams) });
    const r = (o) => ({ ok: true, json: async () => o });
    if (u.pathname.endsWith("oauth/access_token")) return r({ access_token: "tok-local", token_type: "bearer" });
    if (u.pathname.endsWith("/messages")) return r({ messages: [{ id: "wamid.1" }] });
    if (u.pathname.endsWith("/phone_numbers")) return r({ data: [{ id: "555", display_phone_number: "+54 9 381 505-2050", verified_name: "Bar Test" }] });
    if (u.pathname.endsWith("/555")) return r({ is_on_biz_app: enApp, platform_type: "CLOUD_API" });
    return r({ success: true });
  };
});
afterEach(() => { global.fetch = fetchOriginal; });

test("conectar (coexistencia): cambia el code, suscribe, NO registra, guarda cifrado y crea plantillas", async () => {
  const r = await cuentas.conectar(5, { code: "c0de", waba_id: "444", phone_number_id: "555", coexistencia: true }, AVISOS);
  const rutas = llamadas.map((l) => `${l.method} ${l.path}`);
  assert.equal(rutas[0], "GET oauth/access_token");
  assert.equal(llamadas[0].query.client_secret, "sec");
  assert.ok(rutas.includes("POST 444/subscribed_apps"));
  assert.ok(!rutas.some((x) => x.endsWith("/register")));
  assert.equal(llamadas.filter((l) => l.path === "444/message_templates").length, AVISOS.length);
  const tpl = llamadas.find((l) => l.path === "444/message_templates" && l.body.name === "pedido_entregado_ticket").body;
  assert.equal(tpl.category, "UTILITY");
  assert.equal(tpl.components[0].example.body_text[0].length, 4);
  assert.equal(filas[0].telefono, "+54 9 381 505-2050");
  assert.notEqual(filas[0].token_cifrado, "tok-local");
  assert.equal(cuentas.descifrar(filas[0].token_cifrado), "tok-local");
  assert.equal(r.cuenta.token_cifrado, undefined);
});

test("conectar (número nuevo): registra el número aunque el navegador diga coexistencia", async () => {
  enApp = false;
  await cuentas.conectar(5, { code: "c", waba_id: "444", phone_number_id: "555", coexistencia: true }, []);
  const reg = llamadas.find((l) => l.path === "555/register");
  assert.match(reg.body.pin, /^\d{6}$/);
});

test("conectar: un número de otro local se rechaza", async () => {
  filas.push({ negocio_id: 9, phone_number_id: "555", estado: "conectado" });
  await assert.rejects(cuentas.conectar(5, { code: "c", waba_id: "444", phone_number_id: "555" }, []), /otro local/);
});

test("envíos: con número propio usa el del local; sin él, el de la plataforma", async () => {
  filas.push({ negocio_id: 5, waba_id: "444", phone_number_id: "555", token_cifrado: cuentas.cifrar("tok-local"), estado: "conectado" });
  await enviarTexto("3815052050", "hola", 5);
  await enviarTexto("3815052050", "hola", 6);
  assert.equal(llamadas[0].path, "555/messages");
  assert.equal(llamadas[0].auth, "Bearer tok-local");
  assert.equal(llamadas[1].path, "999/messages");
  assert.equal(llamadas[1].auth, "Bearer tok-plataforma");
});

test("cuenta desconectada: vuelve al número de la plataforma", async () => {
  filas.push({ negocio_id: 5, waba_id: "444", phone_number_id: "555", token_cifrado: cuentas.cifrar("tok-local"), estado: "conectado" });
  await cuentas.marcarDesconectadaPorWaba("444");
  await enviarTexto("3815052050", "hola", 5);
  assert.equal(llamadas.at(-1).path, "999/messages");
});

test("entrantes al número propio van a ese local; ecos del celular quedan como respuesta del local", async () => {
  const g = await chats.registrarEntrantes(
    { messages: [{ id: "wamid.in", from: "5493815052050", type: "text", text: { body: "hola" } }] },
    { negocioId: 5 },
  );
  assert.equal(g.length, 1);
  assert.equal(mensajes[0].negocio_id, 5);
  await chats.registrarEcos({ message_echoes: [{ id: "wamid.eco", to: "5493815052050", type: "text", text: { body: "ya sale" } }] }, 5);
  const eco = mensajes.at(-1);
  assert.deepEqual([eco.direccion, eco.autor, eco.texto], ["saliente", "negocio", "ya sale"]);
  // Lo que el dueño le escribe a alguien que no es cliente (sin chat) no se guarda.
  const antes = mensajes.length;
  await chats.registrarEcos({ message_echoes: [{ id: "wamid.eco2", to: "5493819998877", type: "text", text: { body: "hola ma" } }] }, 5);
  assert.equal(mensajes.length, antes);
});

test("conectar: un número que no es de esa cuenta de Meta se rechaza y no se guarda", async () => {
  await assert.rejects(cuentas.conectar(5, { code: "c", waba_id: "444", phone_number_id: "777" }, []), /no pertenece/);
  await assert.rejects(cuentas.conectar(5, { code: "c", waba_id: "444", phone_number_id: "999" }, []), /no se puede/);
  assert.equal(filas.length, 0);
});

test("desconectar borra la fila (y el token): el número queda libre", async () => {
  filas.push({ negocio_id: 9, waba_id: "444", phone_number_id: "555", token_cifrado: "x", estado: "conectado" });
  await cuentas.desconectar(9);
  assert.equal(filas.length, 0);
  await cuentas.conectar(5, { code: "c", waba_id: "444", phone_number_id: "555" }, []);
  assert.equal(filas[0].negocio_id, 5);
});

test("si la BD falla y el local tiene número propio, no se envía por la plataforma", async () => {
  db.setHandler(() => ({ data: null, error: { code: "08006", message: "connection failure" } }));
  const r = await enviarTexto("3815052050", "hola", 5);
  assert.equal(r.ok, false);
  assert.equal(llamadas.length, 0);
});
