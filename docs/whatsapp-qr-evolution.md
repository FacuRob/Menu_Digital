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
2. **Servidor de Evolution API** (imagen `evoapicloud/evolution-api`, v2.3.8). Tiene que estar **siempre prendido**: el plan gratis de Render se duerme y la sesión de WhatsApp se corta. Opciones: Render Starter (Docker), Railway o un VPS chico.
   Variables mínimas:
   ```
   SERVER_URL=https://<url-del-servidor-evolution>
   AUTHENTICATION_API_KEY=<clave larga al azar>
   DATABASE_PROVIDER=postgresql
   DATABASE_CONNECTION_URI=postgresql://...:5432/postgres?schema=evolution_api
   CACHE_REDIS_ENABLED=false
   CACHE_LOCAL_ENABLED=true
   CONFIG_SESSION_PHONE_CLIENT=DinexFlow
   CONFIG_SESSION_PHONE_NAME=Chrome
   QRCODE_COLOR=#000000
   LANGUAGE=es
   ```
   - `CONFIG_SESSION_PHONE_CLIENT=DinexFlow`: así aparece en "Dispositivos vinculados" del celular del local (en vez de "Evolution API").
   - `QRCODE_COLOR=#000000`: QR negro sobre blanco, el que mejor escanean los celulares viejos.
   - La base puede ser la misma de Supabase en otro esquema (`?schema=evolution_api`), con la conexión directa (puerto 5432), no la del pooler.
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
