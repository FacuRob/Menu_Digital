# Avisos de pedido por WhatsApp — Fase 1 (implementado)

Cuando un pedido cambia de estado, el cliente recibe un WhatsApp automático
("recibimos tu pedido", "se está preparando", "va en camino"…). Se usa la
**API oficial de WhatsApp de Meta (Cloud API)** con **un número de la
plataforma** para todos los locales (opción A del plan).

## Cómo funciona

1. En el menú, si el local tiene los avisos activos, al elegir **retiro** o
   **delivery** aparece la casilla **"Avisarme por WhatsApp cómo va mi pedido"**
   (el permiso del cliente que exige Meta). Los pedidos "en mesa" no piden
   teléfono, así que no reciben avisos.
2. El dueño activa los avisos en **Admin → WhatsApp** y elige cuáles mandar.
3. Al confirmar el pedido y cada vez que el admin cambia su estado, el backend
   envía la plantilla correspondiente. Nunca bloquea ni rompe la operación.
4. Meta avisa por webhook si el mensaje se **entregó**, se **leyó** o **falló**;
   se ve en el registro de la pantalla de WhatsApp.

### Estados del pedido

`pendiente → preparando → listo (retiro) | en_camino (delivery) → entregado`,
y `cancelado` en cualquier momento. En **Pedidos**, el botón después de
"Preparar" cambia según el tipo: **Enviar** (delivery), **Listo para retirar**
(retiro) o **Entregar** (mesa).

## Puesta en marcha (una sola vez)

### 1. Base de datos

Correr `backend/db/whatsapp_avisos.sql` en el SQL Editor de Supabase.
(Sin esta migración el sistema funciona igual, pero no envía avisos.)

### 2. Meta (lo hace el dueño de la plataforma)

1. [business.facebook.com](https://business.facebook.com): crear la cuenta de
   Meta Business (y, para producción, verificar la empresa).
2. [developers.facebook.com](https://developers.facebook.com) → **Crear app** →
   tipo *Business* → agregar el producto **WhatsApp**.
3. **API Setup**: agregar y verificar el número que va a enviar los mensajes.
   Copiar el **Phone number ID**.
4. **Business settings → System users**: crear un usuario de sistema con
   permiso `whatsapp_business_messaging` y generar un **token permanente**
   (el token de prueba de la app dura 24 h).
5. **App settings → Basic**: copiar el **App secret**.
6. **WhatsApp → Message templates**: crear las 6 plantillas de abajo.
7. **WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://<backend-en-render>/api/webhooks/whatsapp`
   - Verify token: el mismo texto que pongas en `WHATSAPP_VERIFY_TOKEN`
   - Suscribirse al campo **messages**.

### 3. Variables de entorno del backend (Render)

```
WHATSAPP_TOKEN=            # token permanente del System User
WHATSAPP_PHONE_NUMBER_ID=  # Phone number ID
WHATSAPP_APP_SECRET=       # App secret (firma del webhook)
WHATSAPP_VERIFY_TOKEN=     # texto inventado, igual al cargado en Meta
WHATSAPP_TEMPLATE_IDIOMA=es_AR   # opcional (default es_AR)
WHATSAPP_DEFAULT_CC=54           # opcional (default 54, Argentina)
WHATSAPP_API_VERSION=v21.0       # opcional
```

## Plantillas a crear en Meta

Categoría **Utility**, idioma **Spanish (ARG) — es_AR**. El **nombre** y el
**cuerpo** tienen que ser exactamente estos. Variables:
`{{1}}` nombre del cliente · `{{2}}` nombre del local · `{{3}}` número de pedido.
Meta pide un ejemplo para cada variable: `Juan`, `Bar la Esquina`, `128`.

| Nombre | Cuerpo |
|---|---|
| `pedido_recibido` | Hola {{1}}, {{2}} recibió tu pedido #{{3}}. Te vamos a avisar por acá cuando cambie de estado. |
| `pedido_en_preparacion` | Hola {{1}}, tu pedido #{{3}} de {{2}} ya se está preparando. |
| `pedido_en_camino` | Hola {{1}}, tu pedido #{{3}} de {{2}} ya salió y va en camino. |
| `pedido_listo_retirar` | Hola {{1}}, tu pedido #{{3}} de {{2}} está listo para retirar. |
| `pedido_entregado` | ¡Gracias {{1}}! Tu pedido #{{3}} de {{2}} fue entregado. ¡Que lo disfrutes! |
| `pedido_cancelado` | Hola {{1}}, lamentamos avisarte que tu pedido #{{3}} de {{2}} fue cancelado. Si tenés dudas, respondé este mensaje. |

Los textos viven en `backend/src/services/avisosPedidoService.js` (`AVISOS`):
si se cambia uno, hay que cambiar también la plantilla en Meta.

## Probarlo

1. Admin → **WhatsApp** → activar "Enviar avisos automáticos".
2. "Mensaje de prueba": poner tu número → te llega el aviso de pedido recibido.
3. Hacer un pedido de retiro/delivery desde el menú marcando la casilla y
   cambiarle el estado desde **Pedidos**.
4. En el registro de la pantalla de WhatsApp aparece cada envío con su estado.

## Costos (confirmar en Meta)

Las plantillas *utility* se cobran por mensaje entregado (centavos de dólar;
depende del país). Los mensajes dentro de las 24 h en que el cliente te
escribió son gratis.

## Lo que viene (fases siguientes)

- **Fase 2 — Chats en el admin:** el webhook ya está montado; falta guardar
  los mensajes entrantes y la pantalla de conversaciones.
- **Fase 3 — Chatbot con IA:** respuestas automáticas y sugeridas.
- **Opción B — número propio por local:** `whatsappService.credenciales()`
  es el único punto a cambiar para usar las credenciales de cada negocio.

## Fase 2: chats en el panel

- Pantalla **Chats** (`/admin/chats`, permiso `pedidos`): lista de conversaciones y respuesta con texto libre.
- Los mensajes del cliente llegan por el mismo webhook (`/api/webhooks/whatsapp`, campo `messages` en Meta).
- Un mensaje entrante se asigna al negocio con el que ese teléfono ya habló (aviso o chat) o al de su último pedido. Si no hay ninguno, se descarta.
- Regla de Meta: solo se puede responder hasta **24 h** después del último mensaje del cliente. Pasado ese plazo, el panel bloquea el envío.
- Base de datos: correr de nuevo `backend/db/whatsapp_avisos.sql` (es idempotente; agrega `whatsapp_chats` y columnas nuevas en `whatsapp_mensajes`).

## Fase 3: asistente con IA

- Se activa por negocio en **WhatsApp → Asistente con IA**, con indicaciones extra opcionales del local.
- Responde solo con los datos del local: menú disponible, precios, horarios, entregas y los pedidos de ese cliente. No toma pedidos: manda el link del menú.
- Si no puede resolver algo (cancelaciones, reclamos, pagos, alergias, pedido de hablar con una persona), **deriva el chat**: lo marca "Atender" en el panel y deja de responder ahí.
- Cuando una persona responde desde el panel, la IA se pausa en ese chat por 12 h (`IA_PAUSA_HORAS`). También se puede pausar o reactivar a mano desde el chat.
- Espera unos segundos (`IA_ESPERA_MS`, default 4000) para juntar varios mensajes seguidos del cliente.
- Variables en Render: `OPENROUTER_API_KEY` (obligatoria), `OPENROUTER_MODEL` (default `anthropic/claude-haiku-5.5`), `NEGOCIO_TZ` (default `America/Argentina/Buenos_Aires`).
- Base de datos: volver a correr `backend/db/whatsapp_avisos.sql` (agrega `whatsapp_ia` y columnas nuevas).
