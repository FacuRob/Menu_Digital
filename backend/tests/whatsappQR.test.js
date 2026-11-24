const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
process.env.JWT_SECRET = "jwt-test";

const qr = require("../src/services/whatsappQR");
const cuentas = require("../src/services/whatsappCuentas");
const { enviarPlantilla, enviarTexto } = require("../src/services/whatsappService");
const chats = require("../src/services/chatsService");

let filasQR; // whatsapp_qr
let chatsTabla;
let llamadas;
let estadoEvo; // lo que Evolution dice de la conexión
const fetchOriginal = global.fetch;
const DIA = 24 * 60 * 60 * 1000;
const ahora = () => Math.floor(Date.now() / 1000);
const coincide = (f, filtros) => Object.entries(filtros).every(([k, v]) => String(f[k]) === String(v));

beforeEach(() => {
  qr.olvidar();
  cuentas.olvidar();
  filasQR = [];
  llamadas = [];
  estadoEvo = "connecting";
  chatsTabla = [];
  Object.assign(process.env, {
    EVOLUTION_API_URL: "https://evo.test/",
    EVOLUTION_API_KEY: "evo-key",
    WHATSAPP_TOKEN: "tok-plataforma",
    WHATSAPP_PHONE_NUMBER_ID: "999",
  });
  db.setHandler((q) => {
    if (q.table === "whatsapp_qr") {
      if (q.op === "upsert") {
        const prev = filasQR.find((f) => f.negocio_id === q.payload.negocio_id) || {};
        filasQR = filasQR.filter((f) => f.negocio_id !== q.payload.negocio_id).concat({ ...prev, ...q.payload });
        return { data: null, error: null };
      }
      if (q.op === "delete") { filasQR = filasQR.filter((f) => !coincide(f, q.filters)); return { data: null, error: null }; }
      return { data: filasQR.find((f) => coincide(f, q.filters)) || null, error: null };
    }
    if (q.table === "whatsapp_chats" && q.op === "select") {
      return { data: chatsTabla.find((c) => coincide(c, q.filters)) || null, error: null };
    }
    return { data: null, error: null };
  });
  global.fetch = async (url, init = {}) => {
    const u = new URL(url);
    llamadas.push({ url: String(url), path: u.pathname, method: init.method || "GET", apikey: init.headers?.apikey, body: init.body && JSON.parse(init.body) });
    const r = (o, ok = true, status = 200) => ({ ok, status, json: async () => o });
    if (u.pathname === "/instance/create") return r({ instance: { instanceName: "dinex-5" }, qrcode: { base64: "data:image/png;base64,AAA", pairingCode: init.body.includes("number") ? "ABCD1234" : null } });
    if (u.pathname.startsWith("/instance/connectionState/")) return r({ instance: { state: estadoEvo } });
    if (u.pathname.startsWith("/instance/connect/")) return r({ base64: "data:image/png;base64,BBB", pairingCode: null });
    if (u.pathname.startsWith("/instance/fetchInstances")) return r([{ name: "dinex-5", ownerJid: "5493815052050@s.whatsapp.net", profileName: "Bar Test" }]);
    if (u.pathname.startsWith("/message/sendText/")) return r({ key: { id: "EVO1", fromMe: true } });
    if (u.pathname.startsWith("/instance/")) return r({ status: "SUCCESS" });
    return r({ success: true });
  };
});
afterEach(() => { global.fetch = fetchOriginal; });

test("iniciar: borra la instancia vieja, crea una con webhook firmado y guarda 'vinculando'", async () => {
  const r = await qr.iniciar(5);
  assert.deepEqual(r, { qr: "data:image/png;base64,AAA", codigo: null });
  assert.equal(llamadas[0].path, "/instance/delete/dinex-5");
  const crear = llamadas.find((l) => l.path === "/instance/create");
  assert.equal(crear.apikey, "evo-key");
  assert.equal(crear.body.integration, "WHATSAPP-BAILEYS");
  assert.equal(crear.body.groupsIgnore, true);
  assert.equal(crear.body.webhook.headers["x-dinex-firma"], qr.firma("dinex-5"));
  assert.deepEqual(crear.body.webhook.events, ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]);
  assert.equal(filasQR[0].estado, "vinculando");
});

test("iniciar con teléfono pide el código de 8 letras; teléfono inválido da 400", async () => {
  const r = await qr.iniciar(5, { telefono: "+54 9 381 505-2050" });
  assert.equal(r.codigo, "ABCD1234");
  assert.equal(llamadas.find((l) => l.path === "/instance/create").body.number, "5493815052050");
  await assert.rejects(qr.iniciar(5, { telefono: "123" }), (e) => e.status === 400);
});

test("estado: mientras vincula devuelve el QR vigente; al abrir guarda número y nombre", async () => {
  await qr.iniciar(5);
  let r = await qr.estado(5);
  assert.equal(r.cuenta.estado, "vinculando");
  assert.equal(r.qr, "data:image/png;base64,BBB");
  estadoEvo = "open";
  r = await qr.estado(5);
  assert.equal(r.cuenta.estado, "conectado");
  assert.equal(r.cuenta.telefono, "+54 9 3815052050");
  assert.equal(r.cuenta.nombre_visible, "Bar Test");
  assert.equal(r.qr, undefined);
});

test("con QR conectado, los avisos salen como texto desde Evolution (no por Meta)", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "conectado" }];
  const r = await enviarPlantilla("381 505-2050", { nombre: "pedido_recibido", parametros: ["Juan"], texto: "Hola Juan, recibimos tu pedido." }, 5);
  assert.deepEqual(r, { ok: true, id: "EVO1" });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].path, "/message/sendText/dinex-5");
  assert.deepEqual(llamadas[0].body, { number: "543815052050", text: "Hola Juan, recibimos tu pedido.", linkPreview: false });
  await enviarTexto("381 505-2050", "¿Algo más?", 5);
  assert.equal(llamadas[1].body.text, "¿Algo más?");
});

test("QR desconectado: no se manda desde el número de la plataforma", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "desconectado" }];
  const r = await enviarTexto("381 505-2050", "hola", 5);
  assert.equal(r.ok, false);
  assert.equal(llamadas.length, 0);
});

test("QR vinculando: se sigue usando el número de la plataforma", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "vinculando" }];
  await enviarTexto("381 505-2050", "hola", 5);
  assert.match(llamadas[0].url, /graph\.facebook\.com\/.*\/999\/messages/);
});

test("con QR se puede responder un chat aunque pasaron más de 24 h", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "conectado" }];
  chatsTabla = [{ id: 3, negocio_id: 5, telefono: "543815052050", ultimo_entrante_at: new Date(Date.now() - 3 * DIA).toISOString() }];
  const r = await chats.responder(5, 3, "Hola, ¿seguís interesado?");
  assert.equal(r.ok, true);
  assert.equal(llamadas.find((l) => l.path.startsWith("/message/sendText/")).body.text, "Hola, ¿seguís interesado?");
});

test("traducir: texto entrante, @lid con número alternativo, eco del celular", () => {
  const t = qr.traducir({
    event: "messages.upsert",
    instance: "dinex-5",
    data: { key: { remoteJid: "5493815052050@s.whatsapp.net", fromMe: false, id: "M1" }, pushName: "Juan", message: { conversation: "¿Abren hoy?" }, messageTimestamp: ahora() },
  });
  assert.equal(t.tipo, "entrante");
  assert.deepEqual(t.value.messages[0], { id: "M1", timestamp: String(ahora()), type: "text", text: { body: "¿Abren hoy?" }, from: "5493815052050" });
  assert.equal(t.value.contacts[0].profile.name, "Juan");

  const lid = qr.traducir({
    event: "messages.upsert",
    data: { key: { remoteJid: "123456789@lid", remoteJidAlt: "5493815052050@s.whatsapp.net", id: "M2" }, message: { imageMessage: { caption: "esta" } }, messageTimestamp: ahora() },
  });
  assert.equal(lid.value.messages[0].from, "5493815052050");
  assert.equal(lid.value.messages[0].type, "image");

  const eco = qr.traducir({
    event: "messages.upsert",
    data: { key: { remoteJid: "5493815052050@s.whatsapp.net", fromMe: true, id: "M3" }, message: { conversation: "Sí, hasta las 23" }, messageTimestamp: ahora() },
  });
  assert.equal(eco.tipo, "eco");

  // Mensaje temporal (envuelto) y timestamp como Long.
  const temp = qr.traducir({
    event: "messages.upsert",
    data: { key: { remoteJid: "5493815052050@s.whatsapp.net", id: "M4" }, message: { ephemeralMessage: { message: { extendedTextMessage: { text: "¿tienen sin TACC?" } } } }, messageTimestamp: { low: ahora(), high: 0 } },
  });
  assert.equal(temp.value.messages[0].text.body, "¿tienen sin TACC?");
  assert.equal(eco.value.message_echoes[0].to, "5493815052050");
});

test("traducir ignora grupos, mensajes viejos y mensajes de sistema", () => {
  const msg = (key, extra = {}) => ({ event: "messages.upsert", data: { key: { id: "X", ...key }, message: { conversation: "hola" }, messageTimestamp: ahora(), ...extra } });
  assert.equal(qr.traducir(msg({ remoteJid: "1203630@g.us" })), null);
  assert.equal(qr.traducir(msg({ remoteJid: "status@broadcast" })), null);
  // Historial que manda WhatsApp al vincular (anterior a la conexión).
  const desde = new Date(Date.now() - 60 * 1000 + 5000).toISOString();
  assert.equal(qr.traducir(msg({ remoteJid: "54938@s.whatsapp.net" }, { messageTimestamp: ahora() - 3600 }), { desde }), null);
  assert.equal(qr.traducir(msg({ remoteJid: "54938@s.whatsapp.net" }, { messageTimestamp: ahora() - 7 * 3600 })), null);
  assert.equal(qr.traducir(msg({ remoteJid: "54938@s.whatsapp.net" }, { message: { protocolMessage: {} } })), null);
  assert.deepEqual(qr.traducir({ event: "connection.update", data: { state: "open", wuid: "549@s.whatsapp.net" } }), { tipo: "conexion", state: "open", wuid: "549@s.whatsapp.net", profileName: undefined });
});

test("reconectando un WhatsApp que ya se usaba: no se manda desde la plataforma", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "vinculando", conectado_at: new Date().toISOString() }];
  const r = await enviarTexto("381 505-2050", "hola", 5);
  assert.equal(r.ok, false);
  assert.equal(llamadas.length, 0);
});

test("desconectar: si Evolution no responde, no se borra la fila", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "conectado" }];
  global.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: "caído" }) });
  await assert.rejects(qr.desconectar(5));
  assert.equal(filasQR.length, 1);
});

test("firma: una instancia no puede firmar por otra", () => {
  assert.equal(qr.firmaValida("dinex-5", qr.firma("dinex-5")), true);
  assert.equal(qr.firmaValida("dinex-6", qr.firma("dinex-5")), false);
  assert.equal(qr.firmaValida("dinex-5", undefined), false);
});

test("desconectar: cierra la sesión, borra la instancia y la fila", async () => {
  filasQR = [{ negocio_id: 5, instancia: "dinex-5", estado: "conectado" }];
  await qr.desconectar(5);
  assert.deepEqual(llamadas.map((l) => `${l.method} ${l.path}`), ["DELETE /instance/logout/dinex-5", "DELETE /instance/delete/dinex-5"]);
  assert.equal(filasQR.length, 0);
});
