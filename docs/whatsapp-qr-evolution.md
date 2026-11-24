# WhatsApp común con código QR (Evolution API)

Alternativa al número propio de Meta. El local conecta **el WhatsApp que ya usa** escaneando un QR desde *Dispositivos vinculados* (como WhatsApp Web), o con un código de 8 letras si abrió el panel en el mismo celular. Los avisos de pedidos, los chats y el asistente con IA (OpenRouter) salen desde su número.

- Panel → WhatsApp → tarjeta **"Usá tu WhatsApp de siempre"** (`frontend-admin/src/components/WhatsappQR.tsx`).
- Backend: `backend/src/services/whatsappQR.js`, rutas `GET/POST/DELETE /api/whatsapp/qr`, webhook `POST /api/webhooks/evolution`.
- Un local usa **uno u otro**: número de Meta **o** WhatsApp común. Si conectó uno, el otro no se ofrece.
- Si la conexión con Meta no está habilitada (hoy), el panel muestra solo la opción QR.

## Cómo funciona

| Tema | Meta (número propio) | WhatsApp común (QR) |
|---|---|---|
| Avisos | Plantillas aprobadas por Meta | El mismo texto, como mensaje normal |
| Responder chats | Solo dentro de 24 h | Siempre |
| Costo por mensaje | Lo cobra Meta | No tiene |
| Servidor extra | No | Sí: Evolution API siempre prendido |

- Cada local = una instancia de Evolution llamada `dinex-<negocioId>`.
- El webhook de cada instancia lleva el header `x-dinex-firma` (HMAC del nombre de la instancia con `EVOLUTION_WEBHOOK_SECRET` o `JWT_SECRET`). Sin firma válida → 401.
- Se ignoran grupos, estados, reacciones (no disparan la IA) y el historial que WhatsApp manda al vincular (mensajes anteriores a `conectado_at`, o de más de 6 h).
- Se entienden los mensajes temporales / "ver una vez" / editados (Baileys los envuelve).
- Lo que el dueño escribe desde el celular se guarda **solo si ya hay un chat con ese cliente** y pausa la IA en ese chat. Lo que le escribe a su familia o amigos no se guarda.
- Los ecos de lo que mandamos nosotros (avisos, IA) se reconocen por id en memoria y en la base: no pausan la IA.
- Si se desconecta (cerró la sesión desde el celular) o está volviendo a vincular un WhatsApp que ya usaba, **no** se manda desde el número de DinexFlow: el panel le pide que lo vuelva a conectar.
- Sin `EVOLUTION_WEBHOOK_SECRET` ni `JWT_SECRET` no se acepta ningún aviso (401).

## Para activarlo

1. **Supabase:** correr `backend/db/whatsapp_qr.sql`.
2. **Servidor de Evolution API** (imagen `evoapicloud/evolution-api:v2.3.8`) en Render **Free**, en un **workspace aparte** (por ejemplo "Evolution"). En el workspace de DinexFlow no entra: el plan Free da 750 h/mes por workspace y el backend prendido todo el mes ya usa ~730; con dos servicios se agotan y Render suspende **los dos**. No se duerme porque el backend de DinexFlow le pega cada 14 min (`pingEvolution` en `backend/src/services/keepAlive.js`, usa `EVOLUTION_API_URL`). Si algún día se queda corto (512 MB de RAM del plan Free), pasarlo a Starter.
   - New → Web Service → **Existing Image** → `docker.io/evoapicloud/evolution-api:v2.3.8`, plan Free, región Oregon (igual que el backend). Health check path: `/`.
   Variables:
   ```
   SERVER_URL=https://<url-que-da-render>.onrender.com
   AUTHENTICATION_API_KEY=<Generate en Render>
   DATABASE_PROVIDER=postgresql
   DATABASE_CONNECTION_URI=<Session pooler de Supabase>?schema=evolution_api
   DATABASE_CONNECTION_CLIENT_NAME=evolution_dinexflow
   DATABASE_SAVE_DATA_INSTANCE=true
   DATABASE_SAVE_DATA_NEW_MESSAGE=true
   DATABASE_SAVE_MESSAGE_UPDATE=false
   DATABASE_SAVE_DATA_CONTACTS=false
   DATABASE_SAVE_DATA_CHATS=false
   DATABASE_SAVE_DATA_LABELS=false
   DATABASE_SAVE_DATA_HISTORIC=false
   CACHE_REDIS_ENABLED=false
   CACHE_LOCAL_ENABLED=true
   DEL_INSTANCE=false
   SERVER_DISABLE_MANAGER=true
   SERVER_DISABLE_DOCS=true
   CONFIG_SESSION_PHONE_CLIENT=DinexFlow
   CONFIG_SESSION_PHONE_NAME=Chrome
   QRCODE_COLOR=#000000
   LANGUAGE=es
   ```
   - `CONFIG_SESSION_PHONE_CLIENT=DinexFlow`: así aparece en "Dispositivos vinculados" del celular del local (en vez de "Evolution API").
   - `QRCODE_COLOR=#000000`: QR negro sobre blanco, el que mejor escanean los celulares viejos.
   - Base: el mismo proyecto de Supabase, esquema aparte `evolution_api` (Evolution crea sus tablas solo al arrancar, no toca las de DinexFlow). Usar la cadena **Session pooler** (Connect → Session pooler, `aws-…pooler.supabase.com:5432`): la conexión directa `db.<ref>.supabase.co` es solo IPv6 y Render no llega. No usar el Transaction pooler (6543): las migraciones de Prisma fallan. Si la contraseña tiene caracteres raros (`@ # / ?`), codificarlos o cambiarla por una sin símbolos.
   - Los `DATABASE_SAVE_*` en false: no guarda contactos, chats ni historial del WhatsApp de cada local (privacidad y espacio en el plan gratis de Supabase, 500 MB).
   - Ojo: al arrancar, el script de Evolution imprime la `DATABASE_URL` en los logs de Render (solo los ve el dueño del workspace).
3. **Render (backend de DinexFlow):**
   ```
   EVOLUTION_API_URL=https://<url-del-servidor-evolution>
   EVOLUTION_API_KEY=<la misma AUTHENTICATION_API_KEY>
   ```
   Opcionales: `EVOLUTION_WEBHOOK_URL` (URL pública del backend; por defecto `BACKEND_URL` o `https://backend-menu-digital.onrender.com`) y `EVOLUTION_WEBHOOK_SECRET`.
   Ojo: si cambia `JWT_SECRET` (y no hay `EVOLUTION_WEBHOOK_SECRET`), cambian las firmas: los locales tienen que volver a conectar.
4. El asistente con IA no necesita nada nuevo: usa `OPENROUTER_API_KEY` como siempre.

## Límites a tener en cuenta

- No es la API oficial de Meta. WhatsApp puede cerrar la sesión de un número que manda mucho a gente que no lo conoce. Para el uso de un comercio (responder a sus clientes y avisar el estado de un pedido que el cliente hizo) el riesgo es bajo. **No usar para envíos masivos.** A propósito, el panel no muestra advertencias de este tipo (el público es gente grande y no técnica): el sistema solo manda avisos de pedidos que el cliente hizo y respuestas.
- El asistente le contesta a cualquiera que escriba a ese número; si el dueño lo usa también para lo personal, puede pausarlo por chat (el panel lo avisa).
- Sin estados de entrega (entregado/leído): los avisos quedan "enviado".
- Si un local baja al plan Básico, la instancia sigue viva en Evolution (el panel no le deja entrar a WhatsApp). Borrar un negocio borra la fila pero no la instancia. Pendiente: limpieza periódica de instancias huérfanas.
- El mismo número vinculado en dos negocios recibe los mensajes en los dos (WhatsApp permite hasta 4 dispositivos).
- Recomendado: índice único `(negocio_id, meta_id)` en `whatsapp_mensajes` (revisar antes que no haya duplicados).
- Pruebas: `backend/tests/whatsappQR.test.js`.
