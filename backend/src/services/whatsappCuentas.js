// Número de WhatsApp propio de cada local (Embedded Signup v4 de Meta).
//
// El local toca "Conectar mi WhatsApp" en el panel, inicia sesión en Meta y
// elige su número (si ya usa la app WhatsApp Business, sigue usándola:
// "coexistencia"). El panel nos manda el `code` y los ids; acá se cambia el
// code por un token del negocio, se suscribe la app a su cuenta, se registra
// el número (salvo coexistencia) y se crean las plantillas de los avisos.
//
// Variables (Render):
//   META_APP_ID               id de la app de Meta (DinexFlow)
//   WHATSAPP_APP_SECRET       ya existe (firma del webhook); también se usa acá
//   WHATSAPP_ES_CONFIG_ID     configuración de "Facebook Login for Business"
//   META_SDK_VERSION          opcional, versión del SDK del panel (default v27.0)
//   WHATSAPP_CUENTAS_KEY      opcional, clave para cifrar los tokens (default: deriva de JWT_SECRET)
const crypto = require("crypto");
const supabase = require("../config/database");

const API = () => `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`;

// ── Cifrado del token (AES-256-GCM) ──
const clave = () =>
  crypto
    .createHash("sha256")
    .update(`${process.env.WHATSAPP_CUENTAS_KEY || process.env.JWT_SECRET}:whatsapp-cuentas`)
    .digest();

const cifrar = (texto) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", clave(), iv);
  const enc = Buffer.concat([c.update(String(texto), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
};

const descifrar = (guardado) => {
  const [iv, tag, enc] = String(guardado).split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", clave(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
};

// ── Lectura (con caché corta: se consulta en cada envío y en cada webhook) ──
const TTL_MS = 60 * 1000;
const TTL_VACIO_MS = 10 * 1000; // "sin número propio": se revisa más seguido
const cache = new Map(); // "n:<negocioId>" | "p:<phoneNumberId>" → { valor, expira }

const olvidar = () => cache.clear();

// Tabla todavía sin crear (migración pendiente): equivale a "sin número propio".
const sinTabla = (e) => e?.code === "42P01" || e?.code === "PGRST205" || /does not exist|schema cache/i.test(e?.message || "");

// Devuelve la fila conectada, null si no hay, o undefined si la BD falló
// (en ese caso no se adivina: quien llama decide no enviar).
async function leer(clave, consulta) {
  const hit = cache.get(clave);
  if (hit && hit.expira > Date.now()) return hit.valor;
  try {
    const { data, error } = await consulta();
    if (error && !sinTabla(error)) throw error;
    const valor = !error && data && data.estado === "conectado" ? data : null;
    cache.set(clave, { valor, expira: Date.now() + (valor ? TTL_MS : TTL_VACIO_MS) });
    return valor;
  } catch (e) {
    console.error("[WhatsApp] No se pudo leer whatsapp_cuentas:", e.message);
    return undefined;
  }
}

const cuentaDeNegocio = (negocioId) =>
  negocioId
    ? leer(`n:${negocioId}`, () =>
        supabase.from("whatsapp_cuentas").select("*").eq("negocio_id", negocioId).maybeSingle(),
      )
    : Promise.resolve(null);

const cuentaDePhoneId = (phoneNumberId) =>
  phoneNumberId
    ? leer(`p:${phoneNumberId}`, () =>
        supabase.from("whatsapp_cuentas").select("*").eq("phone_number_id", String(phoneNumberId)).maybeSingle(),
      )
    : Promise.resolve(null);

// Token y número con que se envía para un local: el suyo o, si no conectó
// uno, el de la plataforma.
// Si el local tiene número propio y algo falla (BD, descifrado), NO se usa
// el de la plataforma: el aviso saldría desde otro número y sin sus plantillas.
async function credencialesDe(negocioId) {
  const c = await cuentaDeNegocio(negocioId);
  if (c === undefined) return null;
  if (c) {
    try {
      return { token: descifrar(c.token_cifrado), phoneNumberId: c.phone_number_id, propia: true };
    } catch {
      console.error(`[WhatsApp] No se pudo descifrar el token del negocio ${negocioId} (¿cambió JWT_SECRET?)`);
      return null;
    }
  }
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId, propia: false } : null;
}

// ── Llamadas a Meta ──
async function graph(ruta, { token, method = "GET", body, query } = {}) {
  const url = new URL(`${API()}/${ruta}`);
  for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, v);
  const resp = await fetch(url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e = new Error(json?.error?.error_user_msg || json?.error?.message || `HTTP ${resp.status}`);
    e.meta = json?.error;
    throw e;
  }
  return json;
}

// Datos que el panel necesita para abrir el alta de Meta (null = no configurado).
const configAlta = () =>
  process.env.META_APP_ID && process.env.WHATSAPP_ES_CONFIG_ID && process.env.WHATSAPP_APP_SECRET
    ? {
        appId: process.env.META_APP_ID,
        configId: process.env.WHATSAPP_ES_CONFIG_ID,
        sdkVersion: process.env.META_SDK_VERSION || "v27.0",
      }
    : null;

const soloDigitos = (s) => /^\d{1,30}$/.test(String(s || ""));

// Plantillas de los avisos en la cuenta del local (las de la plataforma no
// sirven: cada cuenta de WhatsApp tiene las suyas). Ejemplos para Meta.
const EJEMPLOS = ["Juan", "Bar la Esquina", "128", "https://dinexflow.com.ar/ticket/128?t=abc123"];

async function crearPlantillas(cuenta, avisos, token = descifrar(cuenta.token_cifrado)) {
  const resultado = [];
  for (const a of avisos) {
    const vars = (a.texto.match(/\{\{\d+\}\}/g) || []).length;
    try {
      await graph(`${cuenta.waba_id}/message_templates`, {
        token,
        method: "POST",
        body: {
          name: a.plantilla,
          language: "es_AR",
          category: "UTILITY",
          components: [{ type: "BODY", text: a.texto, example: { body_text: [(a.ejemplos || EJEMPLOS).slice(0, vars)] } }],
        },
      });
      resultado.push({ nombre: a.plantilla, ok: true });
    } catch (e) {
      // Ya existe (otra conexión anterior): no es un error.
      const existe = /already exists|ya existe/i.test(e.message) || e.meta?.error_subcode === 2388024;
      resultado.push({ nombre: a.plantilla, ok: existe, error: existe ? undefined : e.message });
    }
  }
  return resultado;
}

// Estado de las plantillas en Meta: [{ nombre, estado }] (APPROVED, PENDING, REJECTED…).
async function estadoPlantillas(cuenta) {
  const r = await graph(`${cuenta.waba_id}/message_templates`, {
    token: descifrar(cuenta.token_cifrado),
    query: { fields: "name,status,language", limit: "100" },
  });
  return (r.data || []).map((t) => ({ nombre: t.name, estado: t.status, idioma: t.language }));
}

// Alta completa. Devuelve la fila guardada (sin token) y el resultado de las plantillas.
async function conectar(negocioId, { code, waba_id, phone_number_id, coexistencia }, avisos) {
  const cfg = configAlta();
  if (!cfg) throw Object.assign(new Error("La conexión con Meta no está configurada en el servidor."), { status: 503 });
  if (!code || !soloDigitos(waba_id) || !soloDigitos(phone_number_id)) {
    throw Object.assign(new Error("Faltan datos de Meta. Probá conectar de nuevo."), { status: 400 });
  }
  if (String(phone_number_id) === String(process.env.WHATSAPP_PHONE_NUMBER_ID || "")) {
    throw Object.assign(new Error("Ese número no se puede conectar."), { status: 409 });
  }

  // ¿Ese número ya está en otro local?
  const { data: otro } = await supabase
    .from("whatsapp_cuentas")
    .select("negocio_id")
    .eq("phone_number_id", String(phone_number_id))
    .maybeSingle();
  if (otro && Number(otro.negocio_id) !== Number(negocioId)) {
    throw Object.assign(new Error("Ese número ya está conectado a otro local."), { status: 409 });
  }

  // 1) code → token del negocio (vence a los 30 s: se hace primero).
  const { access_token: token } = await graph("oauth/access_token", {
    query: { client_id: cfg.appId, client_secret: process.env.WHATSAPP_APP_SECRET, code: String(code) },
  });
  // 2) Los ids vienen del navegador: se confirma con Meta (y con el token de
  //    ese negocio) que el número es de esa cuenta. Si no, nadie podría
  //    "reclamar" el número de otro local.
  const numeros = await graph(`${waba_id}/phone_numbers`, {
    token,
    query: { fields: "id,display_phone_number,verified_name", limit: "100" },
  });
  const info = (numeros.data || []).find((n) => String(n.id) === String(phone_number_id));
  if (!info) throw Object.assign(new Error("Ese número no pertenece a la cuenta que elegiste en Meta."), { status: 403 });
  // ¿Lo usa también la app WhatsApp Business? Lo dice Meta, no el navegador.
  const detalle = await graph(String(phone_number_id), { token, query: { fields: "is_on_biz_app,platform_type" } }).catch(() => ({}));
  const enApp = typeof detalle.is_on_biz_app === "boolean" ? detalle.is_on_biz_app : !!coexistencia;
  // 3) La app recibe los webhooks de esa cuenta.
  await graph(`${waba_id}/subscribed_apps`, { token, method: "POST" });
  // 4) Registrar el número en la Cloud API (NO en coexistencia: ya está en la app).
  if (!enApp) {
    await graph(`${phone_number_id}/register`, {
      token,
      method: "POST",
      body: { messaging_product: "whatsapp", pin: String(crypto.randomInt(100000, 1000000)) },
    });
  }
  const fila = {
    negocio_id: negocioId,
    waba_id: String(waba_id),
    phone_number_id: String(phone_number_id),
    telefono: info.display_phone_number || null,
    nombre_visible: info.verified_name || null,
    token_cifrado: cifrar(token),
    coexistencia: enApp,
    estado: "conectado",
    conectado_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("whatsapp_cuentas").upsert(fila, { onConflict: "negocio_id" });
  if (error) throw error;
  olvidar();

  // 5) Plantillas de los avisos (Meta las revisa; suele tardar minutos).
  const plantillas = await crearPlantillas(fila, avisos, token);
  return { cuenta: publica(fila), plantillas };
}

// Se borra la fila (y con ella el token): el número queda libre para volver
// a conectarse, en este u otro local.
async function desconectar(negocioId) {
  const { error } = await supabase.from("whatsapp_cuentas").delete().eq("negocio_id", negocioId);
  if (error) throw error;
  olvidar();
}

// Meta avisó que el local quitó el acceso (webhook account_update).
async function marcarDesconectadaPorWaba(wabaId) {
  if (!wabaId) return;
  await supabase.from("whatsapp_cuentas").delete().eq("waba_id", String(wabaId));
  olvidar();
}

// Lo que se puede mostrar en el panel (nunca el token).
const publica = (c) =>
  c && {
    telefono: c.telefono,
    nombre_visible: c.nombre_visible,
    coexistencia: !!c.coexistencia,
    conectado_at: c.conectado_at,
  };

module.exports = {
  cifrar,
  descifrar,
  cuentaDeNegocio,
  cuentaDePhoneId,
  credencialesDe,
  configAlta,
  conectar,
  desconectar,
  marcarDesconectadaPorWaba,
  crearPlantillas,
  estadoPlantillas,
  publica,
  olvidar,
};
