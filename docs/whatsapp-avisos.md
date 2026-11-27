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
`pedido_entregado_ticket` lleva `{{4}}` = link al ticket (ejemplo:
`https://dinexflow.com.ar/ticket/128?t=abc123`) y
`pedido_en_camino_mapa` lleva `{{4}}` = link al mapa (ejemplo:
`https://dinexflow.com.ar/seguimiento/128?t=abc123`).
El link abre `/ticket/<id>` en el menú público; va firmado, así que no se
pueden ver tickets ajenos cambiando el número.

| Nombre | Cuerpo |
|---|---|
| `pedido_recibido` | Hola {{1}}, {{2}} recibió tu pedido #{{3}}. Te vamos a avisar por acá cuando cambie de estado. |
| `pedido_en_preparacion` | Hola {{1}}, tu pedido #{{3}} de {{2}} ya se está preparando. |
| `pedido_en_camino_mapa` | Hola {{1}}, tu pedido #{{3}} de {{2}} ya salió y va en camino. Seguilo en el mapa: {{4}} ¡Ya llega! |
| `pedido_listo_retirar` | Hola {{1}}, tu pedido #{{3}} de {{2}} está listo para retirar. |
| `pedido_entregado_ticket` | ¡Gracias {{1}}! Tu pedido #{{3}} de {{2}} fue entregado. Mirá tu ticket acá: {{4}} ¡Que lo disfrutes! |
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
- Un mensaje entrante se asigna al negocio con el que ese teléfono ya habló (aviso o chat) o al de su último pedido. Si es un número nuevo, va al negocio de `WHATSAPP_NEGOCIO_DEFECTO` (id); sin esa variable, se descarta.
- Regla de Meta: solo se puede responder hasta **24 h** después del último mensaje del cliente. Pasado ese plazo, el panel bloquea el envío.
- Base de datos: correr de nuevo `backend/db/whatsapp_avisos.sql` (es idempotente; agrega `whatsapp_chats` y columnas nuevas en `whatsapp_mensajes`).

## Fase 3: asistente con IA

- Se activa por negocio en **WhatsApp → Asistente con IA**, con indicaciones extra opcionales del local.
- Responde solo con los datos del local: menú disponible, precios, horarios, entregas y los pedidos de ese cliente. No toma pedidos: manda el link del menú.
- Si no puede resolver algo (cancelaciones, reclamos, pagos, alergias, pedido de hablar con una persona), **deriva el chat**: lo marca "Atender" en el panel y deja de responder ahí.
- Cuando una persona responde desde el panel, la IA se pausa en ese chat por 12 h (`IA_PAUSA_HORAS`). También se puede pausar o reactivar a mano desde el chat.
- Si la IA no puede responder (modelos caídos o saturados, respuesta vacía), le manda al cliente "en un ratito te responden por acá" y marca el chat como "necesita persona" en el panel. La IA queda pausada en ese chat hasta que alguien lo atienda.
- **Audios:** si está `TRANSCRIPCION_API_KEY` (clave gratis de Groq, https://console.groq.com/keys), los audios del cliente se pasan a texto con Whisper y se guardan como "🎤 Audio: …" (los lee la IA y el local en Chats). Funciona por Meta y por QR. Opcionales: `TRANSCRIPCION_URL` (default `https://api.groq.com/openai/v1`, sirve cualquier API compatible con OpenAI) y `TRANSCRIPCION_MODEL` (default `whisper-large-v3-turbo`). Sin la clave, o si falla, queda "🎤 Audio" y la IA le pide al cliente que lo escriba.
- **Fotos:** si el negocio tiene el asistente con IA prendido, un modelo con visión describe la foto que manda el cliente y se guarda como "📷 Foto: …" (o "📷 <texto del cliente> (la foto muestra: …)"). Por Meta y por QR. Usa los modelos de `OPENROUTER_MODEL` (OpenRouter saltea los que no ven fotos) o los de `IA_MODELO_FOTOS` si está. Cada foto gasta una llamada más del cupo de OpenRouter. Un comprobante de pago se deriva a una persona: la IA no confirma pagos.
- Espera unos segundos (`IA_ESPERA_MS`, default 4000) para juntar varios mensajes seguidos del cliente.
- Variables en Render: `OPENROUTER_API_KEY` (obligatoria), `OPENROUTER_MODEL` (default `anthropic/claude-haiku-5.5`; acepta hasta 3 separados por coma como respaldo), `OPENROUTER_MODEL_RESPALDO` (opcional: un modelo pago barato que se usa solo si fallan todos los anteriores; necesita crédito en OpenRouter), `NEGOCIO_TZ` (default `America/Argentina/Buenos_Aires`).
- Base de datos: volver a correr `backend/db/whatsapp_avisos.sql` (agrega `whatsapp_ia` y columnas nuevas).

## Seguimiento del delivery en el mapa

- En **Pedidos**, los pedidos delivery tienen el botón **Repartidor**: comparte por WhatsApp un link firmado (`/reparto/<id>`).
- El repartidor lo abre en el celular (sin app): ve dirección, teléfono y detalle, y usa **Salí con el pedido** (pasa a *En camino*, avisa al cliente y empieza a mandar su ubicación cada ~10 s) y **Entregué** (pasa a *Entregado* y manda el ticket).
- El cliente recibe en el aviso de "en camino" el link `/seguimiento/<id>` con el mapa (OpenStreetMap), que se actualiza solo.
- Límite: el repartidor tiene que dejar la página abierta; si la cierra o el celular bloquea el navegador, deja de mandar la ubicación (al volver a abrirla sigue).
- Base de datos: correr `backend/db/seguimiento_delivery.sql`.

## Número propio de cada local (Embedded Signup v4 + coexistencia)

Cada local conecta su WhatsApp Business desde **Panel → WhatsApp → "Conectar mi WhatsApp"**. Si ya usa la app WhatsApp Business en el celular, la sigue usando (coexistencia): los mensajes se ven en los dos lados. Mientras un local no conecte su número, sus avisos salen por el número de la plataforma (`WHATSAPP_PHONE_NUMBER_ID`).

Al conectar, el backend (`backend/src/services/whatsappCuentas.js`):
1. cambia el `code` del popup por un token del negocio (vence a los 30 s),
2. suscribe la app a la cuenta del local (`subscribed_apps`),
3. registra el número en la Cloud API (**no** en coexistencia),
4. crea las 6 plantillas de los avisos en la cuenta del local (Meta las revisa),
5. guarda el token cifrado en `whatsapp_cuentas`.

Los mensajes que llegan se asignan al local por el número al que llegaron (`metadata.phone_number_id`). Lo que el dueño escribe desde el celular llega como `smb_message_echoes`: se guarda en el chat y pausa la IA, igual que responder desde el panel.

### Puesta en marcha (una sola vez, en Meta)
1. Verificación del negocio aprobada (Centro de seguridad).
2. Ser **Tech Provider**: developers.facebook.com → app DinexFlow → WhatsApp → completar el onboarding de Tech Provider.
3. **Facebook Login for Business → Configuraciones → Crear**: variación *Embedded Signup* (v4), producto WhatsApp, permisos `whatsapp_business_management` y `whatsapp_business_messaging`. Copiar el **Configuration ID**.
4. En Facebook Login for Business → Configuración: agregar `admin.dinexflow.com.ar` en *Allowed domains* y `https://admin.dinexflow.com.ar/` en *Valid OAuth redirect URIs*; activar *Login with the JavaScript SDK*.
5. **App Review**: pedir *Advanced access* para `whatsapp_business_management` y `whatsapp_business_messaging` (hasta entonces sólo pueden conectar admins/testers de la app). Límite inicial: 10 locales nuevos cada 7 días.
6. Webhook de la app: además de `messages`, suscribirse a `account_update`, `smb_message_echoes`, `history` y `smb_app_state_sync`.
7. Base de datos: correr `backend/db/whatsapp_cuentas.sql`.

### Variables en Render (backend)
```
META_APP_ID=              # id de la app de Meta
WHATSAPP_ES_CONFIG_ID=    # Configuration ID del paso 3
META_SDK_VERSION=v27.0    # opcional
WHATSAPP_CUENTAS_KEY=     # opcional (32+ caracteres al azar); si no, deriva de JWT_SECRET
```
`WHATSAPP_APP_SECRET` (ya existe) también se usa para el alta.

### Cobro de los mensajes
Como Tech Provider, cada local paga sus mensajes: después de conectar tiene que cargar una tarjeta en **WhatsApp Manager → Métodos de pago** de su cuenta. Sin eso, los avisos fallan.

### Límites de la coexistencia
- 20 mensajes por segundo por número (sobra para avisos).
- No se sincronizan grupos, mensajes temporales, ver una vez, ubicación en vivo ni listas de difusión.
- El historial y los contactos del celular se pueden sincronizar sólo dentro de las 24 h de conectar (no implementado: el panel arranca con los chats nuevos).

## Avisos de presupuestos y turnos (Etapa 9)

Se mandan sólo si el negocio usa el módulo (Presupuestos o Reservas y turnos), tiene los avisos prendidos en Panel → WhatsApp y el cliente marcó la casilla en el formulario (viene **desmarcada**). Las claves llevan prefijo (`presupuesto.*`, `reserva.*`); las de pedido no cambiaron. Vienen **apagados**: el local los prende en Panel → WhatsApp cuando Meta ya aprobó las plantillas.

Plantillas (categoría **Utility**, idioma **es_AR**). En un número propio se crean solas al conectar o con "Volver a crear las que faltan", y sólo las de los módulos que usa el local. Para el **número de la plataforma** hay que crearlas a mano en el WhatsApp Manager de DinexFlow:

| Plantilla | Cuándo | Texto |
|---|---|---|
| `presupuesto_recibido` | El cliente pide el presupuesto | Hola {{1}}, {{2}} recibió tu pedido de presupuesto #{{3}}. Podés seguirlo acá: {{4}} Te avisamos cuando esté la cotización. |
| `presupuesto_cotizado` | El negocio guarda la cotización | Hola {{1}}, {{2}} ya cotizó tu presupuesto #{{3}}. Miralo acá: {{4}} Desde ese link lo aceptás o lo rechazás. |
| `turno_confirmado` | El negocio confirma (o confirmación automática) | Hola {{1}}, tu turno de {{4}} en {{2}} quedó confirmado para el {{3}}. Si necesitás cancelarlo o cambiarlo: {{5}} ¡Te esperamos! |
| `turno_reprogramado` | El negocio cambia el horario | Hola {{1}}, {{2}} cambió tu turno de {{4}} para el {{3}}. Si no te queda bien, cambialo acá: {{5}} ¡Gracias! |
| `turno_cancelado` | El negocio cancela | Hola {{1}}, lamentamos avisarte que {{2}} canceló tu turno de {{4}} del {{3}}. Más info: {{5}} Disculpá las molestias. |

{{1}} cliente · {{2}} local · {{3}} número de presupuesto o día y hora del turno ("lunes 16/11 a las 18:30") · {{4}} link del presupuesto o servicio del turno · {{5}} link del turno. Hasta que Meta las apruebe, esos avisos quedan como "fallido" en el registro (no rompen nada).

No incluido todavía: recordatorio automático el día antes del turno (necesita una tarea programada).
