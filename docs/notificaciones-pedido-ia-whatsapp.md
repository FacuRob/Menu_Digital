# Notificaciones de pedido al cliente (IA + WhatsApp)

> **Estado: NO implementado (revertido).** Este documento guarda el diseño y el
> código completo para retomarlo a futuro. Fecha del análisis: julio 2026.

## Objetivo

Cuando el administrador cambia el estado de un pedido, avisarle automáticamente al
cliente por WhatsApp con un mensaje **corto, entusiasta y personalizado** redactado
por IA (nombre del cliente + tipo de pedido + nuevo estado).

## Hallazgos clave del análisis (leer antes de re-implementar)

1. **Los estados reales NO se llaman `en_preparacion`/`listo`.** En la tabla `pedidos`
   y en `pedidosController.js` son: `pendiente | preparando | entregado | cancelado`.
   Mapeo: `preparando` = "en preparación", `entregado` = "listo/entregado".
   El endpoint de cambio ya existe: `PUT /api/pedidos/:id/estado` → `updateEstadoPedido`.

2. **El teléfono del cliente sí se guarda (`pedidos.telefono_cliente`); el email NO.**
   El menú del cliente solo pide nombre y teléfono. Para sumar canal Email habría que
   agregar columna `email_cliente` + campo en el carrito (`Menu.tsx`) y usar Resend
   (ya integrado en `emailService.js`).

3. **El "número del WhatsApp del admin"** vive en `configuracion.whatsapp`. Sería el
   número **emisor**; el cliente (`telefono_cliente`) es el **receptor**.

## Decisión de tecnología: WhatsApp Cloud API (Meta), NO Baileys/WPPConnect

| | Cloud API (Meta) | Baileys / WPPConnect |
|---|---|---|
| Costo (fees) | ~gratis para este flujo* | gratis |
| Corre en Render free | ✅ sí (HTTP sin estado) | ❌ no (socket 24/7 + sesión en disco; Render free duerme y borra) |
| Riesgo de ban del número | nulo (oficial) | alto (no oficial, ToS) |
| Multi-tenant | limpio | 1 socket por local, pesado |

\* Precios Meta (desde jul 2025): mensajes de **servicio** (dentro de la ventana de 24 h
que abre el cliente al escribir, ej. botón "Enviar por WPS") son **gratis e ilimitados**;
plantillas *utility* dentro de ventana también gratis; plantillas fuera de ventana se
cobran centavos. **Confirmar pricing vigente en Meta antes de asumir costos.**

### ⚠️ Límite de la Cloud API que condiciona todo el diseño

Fuera de la ventana de 24 h desde el último mensaje del cliente, la Cloud API **solo
permite plantillas preaprobadas**, no texto libre. Como el cliente pide por web:

- Pedido con **"Enviar por WPS"** → el cliente te escribe → ventana abierta → el texto
  libre de la IA **se entrega** ✅.
- Pedido con **"Confirmar pedido"** solamente (nunca te escribió) → Meta **rechaza** el
  texto libre → hay que usar una **plantilla** preaprobada.

El diseño maneja esto: intenta texto libre y, si falla, cae a plantilla (si está configurada).

## Arquitectura propuesta

- Sin dependencias npm nuevas (`fetch` nativo de Node 18+; el backend usa Express 5).
- Servicios desacoplados: el orquestador solo llama `enviarTexto()`/`enviarPlantilla()`,
  así se puede cambiar el proveedor (ej. a Baileys) enchufando otro adaptador.
- Disparo **fire-and-forget** desde el controller: nunca bloquea ni rompe la respuesta al admin.

```
pedidosController.updateEstadoPedido
        │ (si el estado cambió y ∈ preparando/entregado/cancelado)
        ▼
notificacionPedidoService.notificarCambioEstado(pedido)
        ├── iaService.generarMensajeEstado()      → OpenRouter (texto del mensaje)
        └── whatsappService.enviarTexto()          → WhatsApp Cloud API
                └── fallback: enviarPlantilla()     (fuera de ventana de 24 h)
```

## Variables de entorno (`backend/.env` + Render)

```
# IA (OpenRouter)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-flash-1.5
OPENROUTER_SITE_URL=https://menudigital.app

# WhatsApp Cloud API (Meta)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v21.0
WHATSAPP_DEFAULT_CC=54
WHATSAPP_TEMPLATE_ESTADO=
WHATSAPP_TEMPLATE_IDIOMA=es_AR
```

## Alta en Meta (una sola vez)

1. Meta for Developers → app tipo *Business* → agregar producto **WhatsApp**.
2. *API Setup*: copiar **Phone number ID** (`WHATSAPP_PHONE_NUMBER_ID`) y registrar el número del local.
3. Crear un **System User** con permiso `whatsapp_business_messaging` y generar token permanente (`WHATSAPP_TOKEN`). El token de prueba dura 24 h.
4. *(Opcional)* Crear plantilla *utility* aprobada con params `{{1}}` nombre, `{{2}}` tipo, `{{3}}` estado → `WHATSAPP_TEMPLATE_ESTADO`.

---

## Código completo

### `backend/src/services/iaService.js`

```js
// OpenRouter — redacta el mensaje. Devuelve SÓLO el texto. Fallback si falla.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODELO = process.env.OPENROUTER_MODEL || "google/gemini-flash-1.5";

const ESTADO_TEXTO = {
  preparando: "en preparación (el local ya está cocinando/armando el pedido)",
  entregado: "listo y entregado",
  cancelado: "cancelado",
};
const TIPO_TEXTO = {
  mesa: "para servir en la mesa",
  retiro: "para retirar en el local",
  delivery: "con envío a domicilio",
};

const SYSTEM_PROMPT = `Sos el asistente de atención de un restaurante en Argentina.
Tu tarea es redactar UN (1) mensaje de WhatsApp corto para avisarle a un cliente
que su pedido cambió de estado.

Reglas estrictas:
- Respondé ÚNICAMENTE con el texto del mensaje, sin comillas, sin markdown, sin encabezados ni explicaciones.
- Máximo 2 oraciones (unos 280 caracteres).
- Tono entusiasta, cálido y cercano; tratá al cliente de "vos" (español rioplatense).
- Usá el nombre del cliente si te lo dan.
- Mencioná el tipo de pedido (mesa / retiro / delivery) de forma natural.
- Podés usar 1 emoji como mucho.
- Si el estado es "cancelado", cambiá el tono a uno empático y disculpándote, ofreciendo contactar al local.
- No inventes datos que no te dieron (ni precios, ni horarios, ni links).`;

function buildUserPrompt({ nombre, tipoEntrega, estado, negocioNombre }) {
  const datos = [
    `Local: ${negocioNombre || "el restaurante"}`,
    `Nombre del cliente: ${nombre || "(sin nombre)"}`,
    `Tipo de pedido: ${TIPO_TEXTO[tipoEntrega] || tipoEntrega || "pedido"}`,
    `Nuevo estado: ${ESTADO_TEXTO[estado] || estado}`,
  ].join("\n");
  return `Redactá el mensaje para este pedido:\n${datos}`;
}

function fallbackMensaje({ nombre, tipoEntrega, estado, negocioNombre }) {
  const hola = nombre ? `¡Hola ${nombre}!` : "¡Hola!";
  const local = negocioNombre ? ` de ${negocioNombre}` : "";
  const tipo = TIPO_TEXTO[tipoEntrega] ? ` (${TIPO_TEXTO[tipoEntrega]})` : "";
  if (estado === "preparando")
    return `${hola} 👨‍🍳 Ya empezamos a preparar tu pedido${tipo}${local}. ¡Gracias por elegirnos!`;
  if (estado === "entregado")
    return `${hola} 🎉 ¡Tu pedido${tipo}${local} ya está listo! Que lo disfrutes.`;
  if (estado === "cancelado")
    return `${hola} Lamentamos avisarte que tu pedido${local} fue cancelado. Si tenés dudas, escribinos y lo resolvemos.`;
  return `${hola} El estado de tu pedido${local} se actualizó a: ${estado}.`;
}

async function generarMensajeEstado(datos) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbackMensaje(datos);
  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://menudigital.app",
        "X-Title": "Menu Digital",
      },
      body: JSON.stringify({
        model: MODELO,
        temperature: 0.8,
        max_tokens: 160,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(datos) },
        ],
      }),
    });
    if (!resp.ok) {
      console.error(`[IA] OpenRouter ${resp.status}: ${await resp.text().catch(() => "")}`);
      return fallbackMensaje(datos);
    }
    const json = await resp.json();
    const texto = json?.choices?.[0]?.message?.content?.trim();
    if (!texto) return fallbackMensaje(datos);
    return texto.replace(/^["'`]+|["'`]+$/g, "").replace(/\n{2,}/g, "\n").trim();
  } catch (err) {
    console.error("[IA] Error OpenRouter:", err.message);
    return fallbackMensaje(datos);
  }
}

module.exports = { generarMensajeEstado };
```

### `backend/src/services/whatsappService.js`

```js
// WhatsApp Cloud API (Meta). HTTP puro, sin QR ni socket. Ideal Render free.
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

function normalizarTelefono(raw) {
  if (!raw) return null;
  let num = String(raw).replace(/\D/g, "");
  if (!num) return null;
  const cc = process.env.WHATSAPP_DEFAULT_CC || "54";
  if (num.startsWith(cc)) return num;
  num = num.replace(/^0/, "");
  if (cc === "54") return `549${num}`; // AR: móviles llevan 9 tras el 54
  return `${cc}${num}`;
}

async function enviarPayload(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId)
    return { ok: false, error: "WhatsApp Cloud API no configurado" };
  const url = `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok)
      return { ok: false, error: json?.error?.message || `HTTP ${resp.status}`, raw: json };
    return { ok: true, id: json?.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Texto libre: sólo válido dentro de la ventana de 24 h.
async function enviarTexto(telefono, texto) {
  const to = normalizarTelefono(telefono);
  if (!to) return { ok: false, error: "Teléfono inválido" };
  return enviarPayload({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { preview_url: false, body: texto },
  });
}

// Plantilla preaprobada: vía válida fuera de la ventana de 24 h.
async function enviarPlantilla(telefono, { nombre, idioma = "es_AR", parametros = [] }) {
  const to = normalizarTelefono(telefono);
  if (!to) return { ok: false, error: "Teléfono inválido" };
  return enviarPayload({
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: nombre,
      language: { code: idioma },
      components: [
        { type: "body", parameters: parametros.map((p) => ({ type: "text", text: String(p) })) },
      ],
    },
  });
}

module.exports = { enviarTexto, enviarPlantilla, normalizarTelefono };
```

### `backend/src/services/notificacionPedidoService.js`

```js
// Orquestador: IA + WhatsApp. Blindado, nunca lanza (fire-and-forget).
const supabase = require("../config/database");
const { generarMensajeEstado } = require("./iaService");
const { enviarTexto, enviarPlantilla } = require("./whatsappService");

const ESTADOS_NOTIFICABLES = ["preparando", "entregado", "cancelado"];

async function getNombreNegocio(negocioId) {
  try {
    const { data } = await supabase
      .from("configuracion").select("nombre").eq("negocio_id", negocioId).single();
    return data?.nombre || null;
  } catch { return null; }
}

async function notificarCambioEstado(pedido) {
  try {
    if (!pedido || !ESTADOS_NOTIFICABLES.includes(pedido.estado)) return;
    if (!pedido.telefono_cliente) {
      console.log(`[Notif] Pedido #${pedido.id}: sin teléfono.`);
      return;
    }
    const negocioNombre = await getNombreNegocio(pedido.negocio_id);
    const datos = {
      nombre: pedido.cliente,
      tipoEntrega: pedido.tipo_entrega,
      estado: pedido.estado,
      negocioNombre,
    };
    const texto = await generarMensajeEstado(datos);
    const resTexto = await enviarTexto(pedido.telefono_cliente, texto);
    if (resTexto.ok) {
      console.log(`[Notif] Pedido #${pedido.id}: WhatsApp enviado (${resTexto.id}).`);
      return;
    }
    // Fallback a plantilla (fuera de ventana de 24 h) si está configurada.
    const plantilla = process.env.WHATSAPP_TEMPLATE_ESTADO;
    if (plantilla) {
      const estadoTxt = { preparando: "en preparación", entregado: "listo", cancelado: "cancelado" }[pedido.estado] || pedido.estado;
      const resTpl = await enviarPlantilla(pedido.telefono_cliente, {
        nombre: plantilla,
        idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA || "es_AR",
        parametros: [pedido.cliente || "cliente", pedido.tipo_entrega || "pedido", estadoTxt],
      });
      if (resTpl.ok) {
        console.log(`[Notif] Pedido #${pedido.id}: WhatsApp por plantilla (${resTpl.id}).`);
        return;
      }
      console.error(`[Notif] Pedido #${pedido.id}: plantilla falló: ${resTpl.error}`);
    }
    console.error(`[Notif] Pedido #${pedido.id}: no enviado: ${resTexto.error}`);
  } catch (err) {
    console.error("[Notif] Error inesperado:", err.message);
  }
}

module.exports = { notificarCambioEstado, ESTADOS_NOTIFICABLES };
```

### Enganche en `backend/src/controllers/pedidosController.js`

Import al inicio:

```js
const { notificarCambioEstado } = require("../services/notificacionPedidoService");
```

Dentro de `updateEstadoPedido`, tras validar el estado y **antes** del update, leer el
estado previo; tras el update exitoso, disparar la notificación si cambió:

```js
// Estado previo (evita reenvíos si el admin toca el mismo botón dos veces).
const { data: previo } = await supabase
  .from("pedidos").select("estado")
  .eq("id", id).eq("negocio_id", negocioId).single();

// ... (el update existente que devuelve `data`) ...

if (previo?.estado !== estado) {
  notificarCambioEstado(data).catch((e) =>
    console.error("[Notif] fallo en background:", e.message));
}
```

## Cómo probarlo (cuando se implemente)

- Con las env cargadas, cambiar un pedido a `preparando` en el panel → en logs:
  `[Notif] Pedido #X: WhatsApp enviado (...)`.
- Con `WHATSAPP_TOKEN` u `OPENROUTER_API_KEY` vacíos el sistema **no rompe**: loguea y
  sigue. Sin OpenRouter usa los mensajes de respaldo (`fallbackMensaje`).

## Extensiones futuras

- **Canal Email (Resend):** con el mismo `texto` de la IA, un `sendEstadoPedidoEmail` en
  `emailService.js`. Requiere `pedidos.email_cliente` + campo en `Menu.tsx`.
- **Baileys/WPPConnect:** solo si se mueve el backend a un host 24/7 (Railway/VPS/Render
  pago). Implementar un adaptador con la misma firma `enviarTexto()` y un selector
  `WHATSAPP_PROVIDER=cloud|baileys`.
