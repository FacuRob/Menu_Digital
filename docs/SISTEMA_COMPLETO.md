# DinexFlow — Documentación completa del sistema

> Estado al **14/11/2026**. Describe todo lo construido hasta hoy: qué es, cómo está armado, qué hace cada parte, los flujos de punta a punta, la base de datos, la seguridad, el despliegue y lo que queda pendiente.

---

## Índice

1. [Qué es DinexFlow](#1-qué-es-dinexflow)
2. [Arquitectura general](#2-arquitectura-general)
3. [Dominios y servicios en producción](#3-dominios-y-servicios-en-producción)
4. [Modelo de datos](#4-modelo-de-datos)
5. [Cuentas, roles y permisos](#5-cuentas-roles-y-permisos)
6. [Planes, prueba gratis y límites](#6-planes-prueba-gratis-y-límites)
7. [Cobro con Mercado Pago](#7-cobro-con-mercado-pago)
8. [Sitio público (landing y menú)](#8-sitio-público-landing-y-menú)
9. [Panel de administración](#9-panel-de-administración)
10. [Pedidos: ciclo de vida completo](#10-pedidos-ciclo-de-vida-completo)
11. [QR general y QR por mesa firmado](#11-qr-general-y-qr-por-mesa-firmado)
12. [Delivery con mapa, ticket por link](#12-delivery-con-mapa-ticket-por-link)
13. [WhatsApp: avisos, chats, bot con IA y número propio](#13-whatsapp-avisos-chats-bot-con-ia-y-número-propio)
14. [Soporte (clientes → Tech)](#14-soporte-clientes--tech)
15. [Plataforma (Tech) y "Ver como el cliente"](#15-plataforma-tech-y-ver-como-el-cliente)
16. [Autenticación, 2FA y "Mi cuenta"](#16-autenticación-2fa-y-mi-cuenta)
17. [Emails](#17-emails)
18. [Analíticas y Dashboard](#18-analíticas-y-dashboard)
19. [Referencia de la API](#19-referencia-de-la-api)
20. [Seguridad](#20-seguridad)
21. [Variables de entorno](#21-variables-de-entorno)
22. [Migraciones SQL](#22-migraciones-sql)
23. [Despliegue, keep-alive y CI](#23-despliegue-keep-alive-y-ci)
24. [Pruebas automáticas y cómo probar en local](#24-pruebas-automáticas-y-cómo-probar-en-local)
25. [Interruptores de idioma y moneda](#25-interruptores-de-idioma-y-moneda)
26. [Pendientes y limitaciones conocidas](#26-pendientes-y-limitaciones-conocidas)
27. [Historial de hitos](#27-historial-de-hitos)

---

## 1. Qué es DinexFlow

**DinexFlow** es un SaaS argentino de **menú digital con QR y pedidos**, multi-negocio, pensado para locales gastronómicos chicos y medianos (restaurantes, bares, cafeterías, hamburgueserías, pizzerías, heladerías, food trucks). También admite otros rubros (comercio, servicios, genérico).

- **El dueño** carga su carta en un panel, imprime un QR y gestiona pedidos, stock, ventas, equipo y WhatsApp desde ahí.
- **El cliente del local** escanea el QR, ve el menú en el navegador (sin instalar nada), arma el pedido y lo envía. El pedido queda guardado en el panel y, si quiere, también sale armado por WhatsApp al local.
- **Sin comisiones por pedido**: el local paga una suscripción mensual en pesos.
- **Tono**: español rioplatense, de vos. Todo el sistema está hoy en **español y en pesos (ARS)**.

**Propuesta:** menú con QR + pedido ordenado que llega al local sin intermediarios, administrado desde un panel con pedidos, stock y analíticas, para varios locales en una misma cuenta.

**Regla de producto:** nada inventado. No hay testimonios, logos de clientes ni métricas falsas; los menús de ejemplo se rotulan como ejemplo.

---

## 2. Arquitectura general

El repositorio tiene tres aplicaciones:

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API REST | Node.js + Express 5, Supabase (Postgres) vía `@supabase/supabase-js`, JWT, bcrypt, zod, multer, Cloudinary, Resend, node-cron, helmet, express-rate-limit |
| `frontend/` | Sitio público: landing, menú, ticket, reparto, seguimiento | React 19 + Vite + Tailwind v4, GSAP + Lenis (animaciones de la landing), Leaflet + OpenStreetMap (mapa) |
| `frontend-admin/` | Panel de administración | React 19 + Vite + Tailwind v4, React Router, contextos de sesión, negocio y tema (claro/oscuro) |

Servicios externos:

| Servicio | Uso |
|---|---|
| **Supabase** | Base de datos Postgres (el backend usa la service role key; RLS prendido sin políticas en tablas nuevas) |
| **Render** | Hosting del backend (Web Service) y de los dos frontends (Static Sites) |
| **Cloudinary** | Imágenes de productos, logos, portadas (`menu-digital/productos`) y capturas de soporte (`menu-digital/soporte`) |
| **Mercado Pago** | Suscripciones mensuales (preapproval) + webhook firmado |
| **Meta / WhatsApp Cloud API** | Avisos de pedido (plantillas), chats, número propio por local (Embedded Signup v4) |
| **OpenRouter** | Modelo de IA del bot de WhatsApp (por defecto `anthropic/claude-haiku-5.5`, con respaldo) |
| **Resend** | Emails transaccionales desde `no-reply@dinexflow.com.ar` |
| **Google Identity Services** | "Continuar con Google" |
| **Cloudflare** | DNS de `dinexflow.com.ar` |
| **GitHub Actions** | Llamada diaria de keep-alive |

```
Cliente (celular)                       Dueño / equipo
   │ escanea QR                            │
   ▼                                       ▼
frontend (dinexflow.com.ar)         frontend-admin (admin.dinexflow.com.ar)
   │  /menu/:slug, /ticket, /reparto…      │  /admin/*
   └──────────────┬────────────────────────┘
                  ▼
        backend (backend-menu-digital.onrender.com)
          │        │          │          │         │
      Supabase  Cloudinary  Mercado P.  Meta WA   OpenRouter / Resend
```

### Organización del backend

- `src/server.js`: arma Express, CORS, helmet, webhooks (con body crudo cuando hace falta), rutas públicas y protegidas, manejador final de errores y el keep-alive.
- `src/routes/`: un router por módulo.
- `src/controllers/`: lógica de cada módulo.
- `src/middleware/`: autenticación, aislamiento por negocio, permisos, suscripción, límites de plan, WhatsApp, solo lectura, rate limits, validación.
- `src/services/`: WhatsApp (envío, cuentas, chats, avisos), IA, email, keep-alive.
- `src/utils/`: suscripción y límites, precios, links firmados, QR de mesa, 2FA, Mercado Pago, actividad del Dashboard, slugs, errores.
- `src/schemas/index.js`: esquemas zod de entrada.
- `db/`: migraciones SQL para correr en Supabase.
- `tests/`: pruebas con `node --test`.

### Organización del panel

- `App.tsx`: rutas `/admin/*` con `ProtectedRoute` (por permiso o por Tech).
- `components/AdminLayout.tsx`: estructura fija del panel (menú lateral, barra superior, barra inferior en el celular, avisos, contadores, cartel de "Ver como el cliente").
- `context/`: `AuthContext` (sesión), `NegocioContext` (negocio activo, moneda, si el plan incluye WhatsApp), `ThemeContext` (claro/oscuro).
- `services/api.ts`: cliente HTTP (manda `Authorization` y `X-Negocio-Id`, redirige a Suscripción ante un 402, vuelve de "Ver como" ante un 401).
- `lib/`: impresión de tickets, dinero, cantidades por peso, secciones de modales, "Ver como", textos.

---

## 3. Dominios y servicios en producción

| Qué | URL |
|---|---|
| Landing + menú público | `https://dinexflow.com.ar` (`www` redirige) |
| Panel | `https://admin.dinexflow.com.ar/admin/login` |
| Alta directa | `https://admin.dinexflow.com.ar/admin/login?view=signup` |
| Backend | `https://backend-menu-digital.onrender.com` |

- Dominio registrado en NIC Argentina (vence 08/11/2027), DNS en Cloudflare (plan Free).
- Registros CNAME en Cloudflare siempre **DNS only** (sin proxy), o Render no emite el certificado.
- Las URLs viejas `*.onrender.com` siguen funcionando (las permite la CSP) para que los QR impresos antes del dominio no se rompan.

---

## 4. Modelo de datos

Jerarquía multi-tenant: **cuenta → negocios → (configuración, categorías, productos, pedidos, WhatsApp…)**. Los usuarios pertenecen a una cuenta.

### Tablas

| Tabla | Para qué | Campos clave |
|---|---|---|
| `cuentas` | El cliente del SaaS (quien paga) | `tipo_plan` (free/basic/standard/premium), `estado_suscripcion` (trial/activo/cancelado/vencido), `periodo_fin`, `limite_negocios`, `limite_productos`, `ciclo_facturacion`, `origen` (signup/google/…), `mp_preapproval_id`, `mp_status` (+ columnas históricas de Hotmart y Lemon Squeezy) |
| `usuarios` | Personas que entran al panel | `username`, `password` (bcrypt), `nombre`, `email`, `rol`, `activo`, `must_change_password`, `cuenta_id`, `es_plataforma` (Tech), `totp_activo`, `totp_secreto` (cifrado), `totp_respaldo`, `totp_ultimo_paso` |
| `roles_permisos` | Permisos por rol | `rol`, `permisos` (JSON), `descripcion` |
| `password_reset_tokens` | Recuperación de contraseña | token de 64 hex, `expires_at` (1 h), `used` |
| `negocios` | Cada local de una cuenta | `cuenta_id`, `nombre`, `slug` (único global), `activo`, `tipo_rubro` (gastronomia/retail/servicios/generico), `config_campos` |
| `configuracion` | Datos y opciones del menú de un negocio (1 por negocio) | `nombre`, `descripcion`, `direccion`, `telefono`, `whatsapp`, `email`, `horarios` (texto), `horarios_config` (por día), `logo_url`, `portada_url`, `color_primario`, `moneda`, `mesas_activo`, `mesas_cantidad`, `mesas_qr_version`, `retiro_activo`, `delivery_activo` |
| `categorias` | Secciones del menú | `negocio_id`, `nombre`, `orden`, `activo` |
| `productos` | Ítems del menú | `negocio_id`, `categoria_id`, `nombre`, `descripcion`, `precio`, `costo`, `imagen_url`, `disponible`, `orden`, `controlar_stock`, `stock`, `unidad_venta` (unidad/kg), `sku`, `atributos` (JSONB) |
| `variantes_grupo` | Ejes de elección de un producto (Tamaño, Extras…) | `producto_id`, `negocio_id`, `nombre`, `tipo` (single/multi), `obligatorio`, `orden` |
| `variantes_opcion` | Opciones de un grupo | `grupo_id`, `nombre`, `precio_extra`, `stock`, `activo`, `orden` |
| `pedidos` | Pedidos | `negocio_id`, `mesa`, `cliente`, `nota`, `tipo_entrega` (mesa/retiro/delivery), `direccion_entrega`, `telefono_cliente`, `acepta_whatsapp`, `total`, `estado`, `entregado_at`, `repartidor_lat`, `repartidor_lng`, `repartidor_at` |
| `pedido_items` | Líneas del pedido | `pedido_id`, `producto_id`, `nombre` (con opciones), `precio_unit`, `costo_unit`, `cantidad`, `subtotal`, `unidad` |
| `whatsapp_avisos` | Qué avisos activó cada negocio | `negocio_id`, `activo`, `estados` |
| `whatsapp_mensajes` | Registro de todo lo enviado/recibido | `negocio_id`, `pedido_id`, `chat_id`, `direccion`, `autor` (cliente/negocio/ia), `texto`, estado de Meta |
| `whatsapp_chats` | Conversaciones por teléfono y negocio | último mensaje, no leídos, ventana de 24 h, IA activa/pausada, "necesita humano" |
| `whatsapp_ia` | Configuración del bot por negocio | `activo`, `instrucciones` del dueño |
| `whatsapp_cuentas` | Número propio de WhatsApp de un local | `negocio_id`, `waba_id`, `phone_number_id`, `token_cifrado`, `coexistencia`, estado |
| `soporte_tickets` | Reportes de clientes a Tech | `cuenta_id`, `usuario_id`, `tipo`, `asunto`, `estado` (abierto/en_curso/resuelto), marcas de lectura de cada lado |
| `soporte_mensajes` | Mensajes de cada reporte | `ticket_id`, autor, `texto`, `imagen_url` |

Un trigger de la base (`set_limites_por_plan`) recalcula `limite_negocios` y `limite_productos` al cambiar `tipo_plan`, aunque el backend siempre toma los límites de su propia tabla (ver sección 6).

### Borrado en cascada

Borrar un negocio borra su menú, configuración y pedidos. Borrar una cuenta borra usuarios, negocios y configuración.

---

## 5. Cuentas, roles y permisos

### Roles

| Nombre visible | Clave en la base | Permisos | Quién lo crea |
|---|---|---|---|
| **Tech** | flag `es_plataforma = true` (no es un rol) | Todo, en todas las cuentas; panel de Plataforma; bandeja de Soporte | Solo a mano en la base |
| **SuperAdmin** (dueño) | `admin` | `*` (todo en su cuenta, incluido pagar la suscripción) | Nace al registrarse |
| **Admin** (segundo jefe) | `manager` | categorías, productos, pedidos, stock, qr, configuración, negocios, usuarios, analíticas | El dueño |
| **Staff** | `staff` | productos, categorías, pedidos, stock | El dueño o un Admin |

Reglas de jerarquía (controladas en `usuariosController`):
- El dueño crea y gestiona Admin y Staff. El Admin solo crea y gestiona Staff.
- Nadie crea otro dueño por la API.
- Nadie cambia su propio rol.
- Nadie edita ni borra a un dueño ajeno.
- Las filas viejas de roles (`superadmin`, `editor`, `visor`) se conservan para que los tokens anteriores sigan resolviendo; los usuarios se migraron a `staff`.

### Cómo se aplican

1. `authMiddleware` valida el JWT (dura 24 h).
2. `scopeNegocio` toma el header `X-Negocio-Id`, verifica que el negocio sea de la cuenta del usuario y lo fija en `req.negocioId`. Si no es suyo, usa el primer negocio de su cuenta (nunca sirve datos de otra cuenta). Tech puede operar cualquier negocio.
3. `checkPermiso(x)` busca los permisos del rol en `roles_permisos`.
4. En el panel, `ProtectedRoute` oculta las pantallas sin permiso y el menú muestra solo lo permitido.

### Multi-negocio

- El negocio activo se elige en el panel (lo pueden cambiar el dueño y el Admin). Cambiar de negocio recarga la app para que todo se vuelva a pedir con el nuevo header.
- Cada negocio tiene su `slug` único entre todas las cuentas (`pizzeria-roma`, y si está tomado `pizzeria-roma-2`…). El slug se arma con el nombre del negocio y se sincroniza al cambiarlo.

---

## 6. Planes, prueba gratis y límites

Única fuente de precios: `backend/src/utils/planPrecios.js` (con copia en `frontend/src/pages/Landing.tsx` y un catálogo de respaldo en `Suscripcion.tsx`). Única fuente de límites: `LIMITES_POR_PLAN` en `backend/src/utils/suscripcion.js`.

| Plan | Precio mensual | Negocios | Productos (total de la cuenta) | WhatsApp, chats, IA y mapa |
|---|---|---|---|---|
| Free (interno) | $0 | 1 | 10 | No |
| **Básico** | $20.000 | 1 | 50 | No |
| **Estándar** (destacado) | $41.000 | 3 | 180 | Sí |
| **Premium** | $65.000 | 5 | 1.000 | Sí |

- **Sin plan anual.** Pago mensual en ARS con Mercado Pago. Se cancela o cambia cuando quiera.
- **Prueba gratis de 15 días** (`FREE_TRIAL_DAYS`), sin tarjeta, con todo lo del **Pro** (`TRIAL_PLAN`, por defecto `premium`).
- Todos los planes incluyen carta con QR, variantes, personalización y analíticas.

### Reparto de productos entre negocios

El total del plan se reparte en partes iguales entre los negocios de la cuenta; si no da exacto, los primeros negocios (por orden de creación) se llevan uno más:

- Estándar: 180 con 1 negocio, 90 con 2, 60 con 3.
- Premium: 1000, 500, 334/333/333, 250, 200.

Además se controla el total de la cuenta, para que no se cargue todo en un negocio y después se creen otros.

### Vigencia de la suscripción

| Estado | ¿Puede usar el panel? |
|---|---|
| `trial` | Sí, mientras `periodo_fin` sea futuro |
| `activo` | Siempre (si el pago falla, el webhook lo baja) |
| `cancelado` | Sí, hasta el final del mes pagado |
| `vencido` | No |

### Dónde se bloquea

- `checkSuscripcion`: si la cuenta no está vigente, todas las rutas de datos del panel responden **402 `SUSCRIPCION_VENCIDA`** y el panel lleva a **Suscripción** ("Terminaron tus días de prueba"). No se aplica a `/api/plan`, `/api/suscripcion`, `/api/soporte` ni a las rutas públicas. Tech nunca se bloquea. Si la consulta falla, deja pasar.
- `checkLimiteNegocios`: al crear un negocio (403 `LIMITE_NEGOCIOS_ALCANZADO`).
- `checkLimiteProductos`: al crear un producto (403 `LIMITE_PRODUCTOS_ALCANZADO`).
- `requiereWhatsapp`: rutas de WhatsApp, chats y link del repartidor (403 `PLAN_SIN_WHATSAPP`). También se chequea en los avisos, en la IA y en los links públicos de reparto y seguimiento (con caché de 1 minuto por negocio).
- Las cuentas que ya superan un límite conservan lo que tienen, pero no pueden crear más.
- En el panel: etiqueta "Estándar" en Chats y WhatsApp para el plan Básico, aviso para mejorar el plan y sin botón de repartidor. Productos y Negocios muestran el uso "X / Y" (`GET /api/plan`) y bloquean el alta al llegar al límite.

---

## 7. Cobro con Mercado Pago

### Flujo de compra

1. En **Suscripción**, el dueño (permiso `suscripcion`, solo rol `admin`) elige un plan.
2. El panel pide `GET /api/suscripcion/checkout/:plan`. El backend crea una suscripción **preapproval** en Mercado Pago:
   - `reason`: "DinexFlow · Plan X"
   - `external_reference`: `cuenta:<id>:plan:<code>` (así se vincula a la cuenta, no por email)
   - `payer_email`: el email del usuario (obligatorio; si no tiene, se le pide cargarlo)
   - monto mensual en ARS según `planPrecios.js`
   - `back_url`: `/admin/suscripcion` del panel
3. El panel redirige al `init_point` de Mercado Pago; el cliente paga.
4. Mercado Pago avisa al webhook `POST /api/webhooks/mercadopago`.

### Webhook

1. Valida la firma `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con `MP_WEBHOOK_SECRET`). Si no coincide: 401.
2. Solo procesa `subscription_preapproval` / `preapproval`.
3. **No confía en el cuerpo**: consulta la suscripción a la API de Mercado Pago con el token propio.
4. Lee la referencia; si no es de DinexFlow, la ignora.
5. Verifica que el monto cobrado sea exactamente el del plan.
6. Traduce el estado: `authorized` → activo, `cancelled` → cancelado, `paused` → vencido, `pending` → no cambia nada.
7. Una baja o pausa solo cuenta si es de la suscripción vigente (se ignoran checkouts abandonados o suscripciones reemplazadas).
8. Si queda activo: guarda `tipo_plan`, `ciclo_facturacion = mensual`, `periodo_fin = next_payment_date`.
9. **Cambio de plan**: si había otra suscripción, la cancela en Mercado Pago para no cobrar dos veces.
10. Ante un error responde 500 para que Mercado Pago reintente.

- Para ver o cancelar sus suscripciones, el cliente va al portal de Mercado Pago (`mercadopago.com.ar/subscriptions`), enlazado desde el panel.
- La pantalla de Suscripción muestra el estado, días restantes, barra de progreso del período, un calendario con hoy y el vencimiento, y las tarjetas de planes con sus beneficios.

---

## 8. Sitio público (landing y menú)

Rutas de `frontend/`:

| Ruta | Página |
|---|---|
| `/` | Landing |
| `/privacidad` | Política de privacidad |
| `/menu` | Menú de ejemplo (sin API) |
| `/menu?negocio=<id>` | Menú real por id (QR viejos de negocios sin slug) |
| `/menu/:slug` | Menú de un negocio |
| `/menu/:slug/todos` | Menú general (todos los negocios de la cuenta) |
| `/ticket/:id?t=…` | Ticket del pedido entregado |
| `/reparto/:id?t=…` | Página del repartidor |
| `/seguimiento/:id?t=…` | Mapa del delivery para el cliente |

### 8.1 Landing

Página con animaciones al hacer scroll (respeta "reducir movimiento"). Secciones:

1. **Inicio**: una ficha QR que se abre hasta llenar la pantalla (el QR lleva al menú de ejemplo).
2. **Manifiesto**: texto que se enciende palabra por palabra.
3. **Escena fija "del QR al WhatsApp"**: un teléfono que avanza en tres pasos (escanear, elegir, enviar).
4. **Funciones**: se resalta la que cruza el centro de la pantalla.
5. **Rubros**: dos filas que se deslizan en sentidos opuestos.
6. **Probalo**: acceso al menú de ejemplo ("O probalo acá").
7. **Precios**: Básico, Estándar y Premium en pesos.
8. **Preguntas frecuentes**.
9. **Cierre** con botón "Probar gratis" y pie con la marca.

Los botones "Ingresar" y "Probar gratis" llevan al panel (`VITE_ADMIN_URL`).

### 8.2 Menú de ejemplo (`/menu`)

Local ficticio "La Esquina": 5 categorías y 12 productos con fotos y variantes (`frontend/src/lib/menuDemo.ts`). No llama a la API; el carrito funciona, pero no guarda el pedido ni abre WhatsApp.

### 8.3 Menú de un negocio (`/menu/:slug`)

Carga:
1. Resuelve el slug (`GET /api/negocios/publico/:slug`). Si no existe o está inactivo: "no encontrado".
2. Pide configuración, categorías activas y productos disponibles del negocio.

Pantalla:
- **Cabecera**: nombre, logo y portada del local, estado **Abierto / Cerrado** según los horarios por día (soporta franjas que pasan la medianoche, por ejemplo 20:00–02:00), modos de entrega disponibles y contacto (teléfono, WhatsApp, dirección).
- **Barra fija**: buscador + pastillas de categorías con desplazamiento automático y resaltado de la categoría visible (scroll-spy).
- **Productos**: tarjetas con imagen, nombre, descripción y precio. Se ocultan los no disponibles y los que controlan stock y están en cero. Si el producto tiene variantes o se vende por peso, abre el detalle; si no, se agrega directo.
- **Pie** con datos y horarios. Botón "ir arriba".
- **Barra de pedido** con cantidad y total cuando hay productos.
- El título de la pestaña lleva el nombre del local.
- La identidad del local (logo, portada y su color elegido en el panel) se aplica al menú con contraste calculado automáticamente para que el texto siempre sea legible.

### 8.4 Detalle de producto

- Imagen, descripción y precio.
- **Variantes**: grupos de una opción (single) o varias (multi), obligatorios u opcionales, con precio extra. Los obligatorios de una opción arrancan con la primera elegida; si falta un obligatorio, no se puede agregar.
- **Venta por peso**: el precio es por kilo; se elige de a 100 g (mínimo 100 g), arranca en 250 g, con atajos de 250 g / 500 g / 1 kg.
- Selector de cantidad (unidades o gramos).

### 8.5 Carrito y envío del pedido

- Mismo producto con las mismas opciones = misma línea. Una línea por peso cuenta como un producto.
- Por peso se ajusta de a 100 g; bajar de 100 g quita la línea.
- **Paso 1 – Datos**: nombre (obligatorio) y nota opcional.
- **Paso 2 – Entrega**, según lo que el local tenga activo:
  - **En mesa**: solo si se escaneó un **QR de mesa firmado**; la mesa es fija y no se puede cambiar.
  - **Retiro**: pide teléfono.
  - **Delivery**: pide dirección y teléfono.
  - Con el QR general no se ofrece "en mesa". Si el local solo atiende en mesa, se pide escanear el QR de la mesa.
  - Si el local no ofrece ningún tipo, el pedido es "de mostrador".
- **Casilla "Avisarme por WhatsApp"**: aparece solo si el local tiene los avisos activos y el plan los incluye.
- **Dos formas de enviar**:
  - **Confirmar pedido**: lo guarda en el sistema.
  - **Enviar por WhatsApp**: lo guarda y además abre WhatsApp con el pedido armado al número del local (`Nuevo pedido — <local>`, cliente, teléfono, entrega, líneas con opciones, total y nota).
- Si el backend rechaza la mesa (firma vieja, mesa que ya no existe), se deja de ofrecer "en mesa" y el cliente elige otra opción. Siempre se muestra el motivo real del error.
- Al terminar: pantalla "Pedido enviado" y el carrito se vacía.

### 8.6 Menú general (`/menu/:slug/todos`)

- Para cuentas con 2 o más negocios: cabecera con el nombre de la cuenta, barra para saltar entre negocios y una sección por negocio con sus categorías (cada uno con su estado y entregas).
- Si un negocio falla al cargar, se omite y el resto se muestra.
- **El carrito es de un negocio a la vez**: si se agrega algo de otro negocio, pregunta si vaciar el pedido. El pedido se crea en el negocio de los productos del carrito.

---

## 9. Panel de administración

Rutas bajo `/admin`. Estructura: menú lateral (abierto en pantallas anchas, solo íconos en medianas, se recuerda la preferencia), barra superior, y en el celular una barra inferior con lo de todos los días y el resto en "Más". Tema claro y oscuro. Pantalla de carga solo al entrar.

**Avisos del panel**: pedidos nuevos (por negocio, para no dar falsos avisos al cambiar de local), chats para atender (con sonido), stock bajo y reportes de soporte con novedades. Contadores junto a "Chats" y "Soporte", y número en la pestaña del navegador: "(2) Pedidos · DinexFlow".

### 9.1 Acceso

- **Login** (`/admin/login`): usuario o email + contraseña, "Continuar con Google", "Olvidé mi contraseña". En escritorio, un panel se desliza entre "Ingresar" y "Crear cuenta"; en el celular, pestañas. `?view=signup` abre directo el registro.
- **Registro**: nombre del negocio, email y contraseña (mínimo 8). Crea la cuenta en prueba gratis + su primer negocio + su configuración (con retiro activo) + el usuario dueño.
- **Segundo paso (2FA)**: si el usuario lo activó, pide el código de la app o uno de respaldo.
- **Restablecer contraseña** (`/admin/reset-password?token=…`).
- **Cambiar contraseña obligatoria** (`/admin/cambiar-password`) cuando se usa una contraseña temporal.

### 9.2 Onboarding (`/admin/onboarding`)

Para cuentas recién creadas (registro o Google). Dos pasos:
1. **Rubro**: Gastronomía, Comercio, Servicios o Genérico (define íconos del menú y el vocabulario del panel). Se guarda al avanzar.
2. **Ajuste inicial** del negocio (datos básicos), con la configuración actual precargada. Se puede omitir.

### 9.3 Dashboard

- Período elegible: **7, 30 o 90 días** (se recuerda).
- Tarjetas de hoy: pedidos, pendientes ahora y ventas.
- Ventas y ganancia por día, con comparación contra el período anterior.
- Totales del período: ventas, ganancia, pedidos y ticket promedio.
- Pedidos por tipo de entrega (mesa, retiro, delivery).
- **Horas pico** (día de la semana × hora, en hora de Argentina) y el momento más fuerte de la semana.
- Pedidos por estado y últimos pedidos.
- **Historial de ganancias**: rango de meses y tipo de entrega, gráfico por mes, tabla ordenable con totales, variación contra el mes anterior, detalle con los productos más rentables de cada mes y exportación a CSV.
- Quien no tiene permiso de analíticas (Staff) solo ve los últimos pedidos.
- Las ventas cuentan solo pedidos **entregados**, en el día en que se entregaron.

### 9.4 Pedidos

- Pestaña **En curso** (pendiente, preparando, listo, en camino): se actualiza cada 15 s.
- Pestaña **Historial** (entregados y cancelados): Hoy / Ayer / 7 días / 30 días / Rango, de a 50 con "Cargar más".
- Filtros por estado, mesa y tipo de entrega.
- Botones para avanzar el estado. Si el pedido cambió mientras tanto (por ejemplo, el repartidor lo marcó), el backend responde 409 y la lista se recarga.
- Al **entregar**, ofrece generar el **ticket** e imprimirlo en **térmica 80 mm** o **común A4/carta** (el comprobante no muestra costos ni ganancia). Avisa si el navegador bloqueó la ventana.
- **📍 Repartidor** (delivery en pendiente, preparando o en camino; planes con WhatsApp): comparte por WhatsApp el link firmado del repartidor.
- Solo los **cancelados** se pueden eliminar (los entregados alimentan el Dashboard).

### 9.5 Chats (plan Estándar/Premium)

Bandeja de conversaciones de WhatsApp con clientes (ver sección 13): lista con no leídos y "necesita atención", conversación, respuesta (Enter envía, Shift+Enter salto de línea), pausar o reactivar la IA por chat. Polling liviano mientras la pestaña está visible.

### 9.6 Productos

- Vista en tabla o en tarjetas (en el celular, tarjetas por defecto; se recuerda).
- Filtros: activos/inactivos, categoría, stock (bajo/agotado) y búsqueda. Badge con la cantidad por agotarse.
- Interruptor de "disponible" directo desde la lista.
- Badge de stock que parpadea si está bajo (≤ 5) o agotado.
- Uso del plan "X / Y" y bloqueo del alta al llegar al límite.
- **Modal de producto** (nuevo/editar) con secciones a la izquierda (fila deslizable en el celular) y punto en las secciones con cambios sin guardar:
  - **Datos**: nombre, descripción, categoría.
  - **Precio y venta**: "¿A qué precio lo vendés?", "¿Cuánto te cuesta a vos? (opcional)", venta por unidad o por peso (kg). Muestra "Ganás $X por unidad/kilo" o "Perdés…".
  - **Imagen**: subida a Cloudinary (jpg, png, webp, gif, hasta 5 MB).
  - **Stock y visibilidad**: "Llevar la cuenta del stock" (el campo de stock aparece solo si está prendido), disponible, posición en el menú.
  - **Detalles/atributos**: pares clave/valor libres por rubro (marca, material, duración…) y SKU.
  - **Opciones**: grupos de variantes y sus valores. Si se crea un producto con "Personalizable" prendido, el formulario queda abierto para cargar los grupos.
- Si falta un campo obligatorio en una sección oculta, abre esa sección y muestra el aviso.
- Ayudas ⓘ en los campos (globito con mouse o Tab; en el celular, ventanita con "Entendido").

### 9.7 Categorías

Lista en tabla o tarjetas, activar/desactivar desde la lista, modal con secciones **Datos** y **Orden y estado** (posición en el menú).

### 9.8 Código QR

- Elegir **QR de**: cada negocio o "Todos los negocios (menú general)" (con 2+ negocios).
- Elegir **General** o una **mesa** (si el local atiende en mesa). El QR de mesa lleva la firma.
- QR grande para imprimir nítido (la tarjeta del QR queda clara en ambos temas para escanearse mejor).
- **Regenerar QR de mesas**: anula todos los QR de mesa impresos de ese local (hay que reimprimirlos).

### 9.9 WhatsApp (plan Estándar/Premium; permiso configuración)

- **Número propio**: "Conectar mi WhatsApp" (alta de Meta), estado del número y de las plantillas, reintentar plantillas, desconectar.
- **Avisos de pedido**: interruptor general y un interruptor por estado (recibido, en preparación, en camino, listo para retirar, entregado, cancelado). Guardado optimista.
- **Mensaje de prueba** a un teléfono.
- **Últimos mensajes enviados** con su estado (enviado, entregado, leído, fallido).
- **Asistente con IA**: interruptor e indicaciones propias del local.

### 9.10 Configuración del menú

Modal con secciones y punto en las que tienen cambios; los cambios no se aplican hasta guardar, y "Cancelar" revierte:
- **Datos**: nombre, dirección, teléfono, WhatsApp, email, descripción.
- **Rubro**.
- **Imágenes**: logo y portada.
- **Color** del local.
- **Moneda** (oculta mientras `MULTI_MONEDA = false`).
- **Servicio**: en mesa (y cantidad de mesas), retiro, delivery.
- **Horarios**: texto libre o por día con franjas.

### 9.11 Usuarios

Alta, edición, cambio de contraseña y baja del equipo respetando la jerarquía de roles. Muestra la descripción y los permisos de cada rol.

### 9.12 Negocios

Lista de negocios de la cuenta con uso del plan, link público de cada uno, alta (nombre y rubro), edición (nombre, link/slug, activo) y borrado (en cascada).

### 9.13 Suscripción

Ver sección 7.

### 9.14 Soporte

Ver sección 14. Disponible para todos, aun con el plan vencido.

### 9.15 Plataforma (solo Tech)

Ver sección 15.

### 9.16 Mi cuenta

Modal con secciones **Perfil** (nombre visible, usuario), **Email** (pide la contraseña actual), **Contraseña** (para quien entra con Google y no la conoce, manda el link de "Olvidé mi contraseña") y **Seguridad** (2FA). Cada guardado devuelve un token nuevo con los datos al día.

### 9.17 Vista previa del menú

`/menu` y `/menu/:slug` dentro del panel muestran el menú público en un iframe (botón "Ver menú").

---

## 10. Pedidos: ciclo de vida completo

### Estados

```
pendiente → preparando → listo (retiro) ───────────┐
                       → en_camino (delivery) ─────┼→ entregado
cancelado: desde cualquier estado                  ┘
```

### Creación (`POST /api/pedidos`, público)

1. Rate limit: 20 pedidos cada 5 min por IP. Validación zod (hasta 100 ítems).
2. Lee la configuración **actual** del local: rechaza un tipo de entrega que no esté activo; sin tipo, solo vale si el local no ofrece ninguno.
3. "En mesa": exige mesa existente (1…`mesas_cantidad`) y **firma válida** con la versión actual del QR.
4. **Recalcula todo desde la base**: precio, costo y unidad de cada producto (del mismo negocio) y el precio extra de cada opción de variante (que pertenezca al negocio). Nunca confía en precios del cliente.
5. Por peso: cantidad en kg con gramos (0,1 a 99 kg); por unidad: entero ≥ 1. El nombre de la línea incluye las opciones elegidas.
6. Inserta el pedido (estado `pendiente`) y sus ítems.
7. Descuenta stock de los productos que lo controlan (sin bajar de 0).
8. Si el cliente aceptó avisos y dejó teléfono, guarda el consentimiento y manda "Recibimos tu pedido" en segundo plano.
9. Responde el pedido **sin costos** (el costo es privado del negocio).

### Cambio de estado (panel)

- Solo estados válidos. Registra `entregado_at` al entregar (y lo limpia si deja de estarlo).
- **Atómico**: actualiza solo si el estado sigue siendo el que se leyó; si no, 409.
- Si el estado cambió de verdad, dispara el aviso de WhatsApp correspondiente en segundo plano.

### Borrado

Solo pedidos cancelados.

---

## 11. QR general y QR por mesa firmado

- **QR general**: `https://dinexflow.com.ar/menu/<slug>`. Permite retiro y delivery, nunca "en mesa".
- **QR de mesa**: `…/menu/<slug>?mesa=N&t=<firma>`. La firma es un HMAC-SHA256 de `mesa:<negocio>:<versión>:<mesa>` con `MESA_QR_SECRET`, recortado a 22 caracteres (132 bits). El cliente no puede cambiar la mesa a mano.
- **Versión**: `configuracion.mesas_qr_version`. "Regenerar QR de mesas" la sube y anula todos los QR de mesa impresos de ese local, sin tocar los de otros.
- **QR del menú general**: `…/menu/<slug del primer negocio>/todos`.
- Si falta `MESA_QR_SECRET`, la clave se deriva de `JWT_SECRET` (el backend avisa al arrancar): rotar `JWT_SECRET` invalidaría los QR impresos.

---

## 12. Delivery con mapa, ticket por link

### Links firmados (`backend/src/utils/linksPedido.js`)

Tres tipos, cada uno con su firma (HMAC de tipo + pedido + negocio): el link del cliente no sirve como el del repartidor ni para otro pedido.

| Tipo | URL | Quién lo usa |
|---|---|---|
| `ticket` | `/ticket/<id>?t=…` | Cliente, al entregarse |
| `seguimiento` | `/seguimiento/<id>?t=…` | Cliente, mientras va en camino |
| `reparto` | `/reparto/<id>?t=…` | Repartidor |

### Flujo del delivery

1. **Panel → Pedidos → 📍 Repartidor**: comparte por WhatsApp el link del repartidor.
2. **Repartidor** (sin app, solo la página abierta):
   - Ve dirección con "Cómo llegar", llamar/WhatsApp al cliente, ítems y total a cobrar.
   - **Salí con el pedido** → estado `en_camino` y empieza a mandar su GPS cada ~8 s (mantiene la pantalla encendida).
   - **Entregué** (doble toque, para evitar errores) → estado `entregado`.
   - Cuando el pedido se cierra, el link ya no muestra teléfono, dirección ni nota.
3. **Cliente**: recibe por WhatsApp el aviso "va en camino" con el link de seguimiento. Mapa con Leaflet + OpenStreetMap, se actualiza cada 10 s; solo muestra ubicaciones enviadas desde la última salida. Al entregar, muestra "Ver mi ticket".
4. Al entregar, el cliente recibe el aviso con el **link del ticket**.

Reglas:
- Solo pedidos delivery y negocios con plan que incluye el mapa (si la cuenta baja de plan, los links viejos dejan de andar).
- Rate limit: 200 solicitudes cada 5 min.
- Cambios de estado atómicos: si el panel y el repartidor cambian a la vez, no se pisan ni se avisa dos veces.

### Ticket público

`GET /api/tickets/:id?t=…` responde solo si el pedido está **entregado** y la firma es válida. Muestra ítems, total, tipo de entrega, fechas y datos del local; **nunca** teléfono, dirección ni costos.

---

## 13. WhatsApp: avisos, chats, bot con IA y número propio

Disponible en los planes **Estándar** y **Premium** (y en la prueba gratis). Usa la **WhatsApp Cloud API oficial** de Meta (HTTP, sin QR ni sockets).

### 13.1 Avisos de pedido (Fase 1)

Plantillas aprobadas por Meta (categoría Utilidad, idioma es_AR). Parámetros: `{{1}}` cliente, `{{2}}` local, `{{3}}` número de pedido, `{{4}}` link.

| Estado | Plantilla | Mensaje |
|---|---|---|
| pendiente | `pedido_recibido` | "Hola {{1}}, {{2}} recibió tu pedido #{{3}}. Te vamos a avisar por acá cuando cambie de estado." |
| preparando | `pedido_en_preparacion` | "Hola {{1}}, tu pedido #{{3}} de {{2}} ya se está preparando." |
| en_camino | `pedido_en_camino_mapa` | "…ya salió y va en camino. Seguilo en el mapa: {{4}} ¡Ya llega!" |
| listo | `pedido_listo_retirar` | "…está listo para retirar." |
| entregado | `pedido_entregado_ticket` | "¡Gracias {{1}}! … fue entregado. Mirá tu ticket acá: {{4}} ¡Que lo disfrutes!" |
| cancelado | `pedido_cancelado` | "…lamentamos avisarte que tu pedido … fue cancelado. Si tenés dudas, respondé este mensaje." |

Se envía solo si: hay plantilla para ese estado, el cliente **aceptó** y dejó teléfono, el local puede enviar (número propio o el de la plataforma), el plan lo incluye y el local activó ese aviso. Es "disparar y olvidar": nunca demora la respuesta. Todo queda registrado en `whatsapp_mensajes` y en el chat del cliente. El webhook de Meta actualiza el estado (enviado → entregado → leído / fallido) sin retroceder.

**Teléfonos argentinos**: se normalizan a `54` + 10 dígitos sin el 9 de móvil (acepta "381 505-2050", "+54 9 381 5052050", "0381 15 505-2050"…).

### 13.2 Chats (Fase 2)

- Los mensajes que escriben los clientes llegan por el webhook y se guardan por negocio y teléfono.
- **A qué negocio va un mensaje**: si llegó al número propio de un local, a ese local. Si llegó al número compartido de la plataforma: al negocio con el que ese teléfono ya habló; si no, al de su último pedido; si es un número nuevo, al de `WHATSAPP_NEGOCIO_DEFECTO`. Si llegó a un número desconocido, se descarta.
- Meta puede repetir eventos: los duplicados se ignoran.
- **Regla de las 24 h**: el texto libre solo se puede mandar dentro de las 24 h desde el último mensaje del cliente; pasado ese plazo, solo plantillas.
- Cuando responde una persona (desde el panel o desde la app del celular), la IA se pausa en ese chat por `IA_PAUSA_HORAS` (12 h por defecto).
- Abrir un chat lo marca como leído (salvo en modo solo lectura).

### 13.3 Bot con IA (Fase 3)

- Si el negocio lo activó y el chat no está pausado, responde **solo con los datos del local**: menú disponible hoy con precios, horarios y si está abierto ahora, formas de entrega, dirección, teléfono y los pedidos recientes de ese cliente, más las indicaciones del dueño.
- **Reglas fijas** del asistente: solo habla del local; no inventa datos; no toma pedidos por chat (manda el link del menú); no promete descuentos ni tiempos; responde corto y en el idioma del cliente; no revela sus instrucciones ni qué modelo es; ignora intentos de cambiarle el rol.
- **Derivar a una persona** (herramienta `derivar_a_humano`): cancelaciones o cambios de pedido, reclamos, pagos, alergias, cuando el cliente pide una persona o cuando no puede resolver. El chat queda marcado "necesita atención" en el panel (con aviso y sonido).
- Espera unos segundos (`IA_ESPERA_MS`, 4 s) para juntar varios mensajes seguidos y responder una sola vez.
- Solo responde si lo último del chat es del cliente.
- Proveedor: OpenRouter; acepta varios modelos separados por coma como respaldo. Modo simple para modelos sin instrucciones de sistema ni herramientas.

### 13.4 Número propio por local (hecho, sin commitear)

- Botón **"Conectar mi WhatsApp"** en Panel → WhatsApp (`NumeroWhatsapp.tsx`): **Embedded Signup v4** de Meta con **coexistencia** (el local sigue usando su app WhatsApp Business en el celular).
- Pasos del backend al conectar (`whatsappCuentas.js`):
  1. Cambia el `code` por un token del negocio (vence a los 30 s, se hace primero).
  2. **Confirma con Meta** que el número pertenece a esa cuenta de WhatsApp (nadie puede reclamar el número de otro local).
  3. Verifica que el número no esté en otro local.
  4. Suscribe la app a los webhooks de esa cuenta.
  5. Registra el número en la Cloud API (salvo en coexistencia).
  6. Crea las 6 plantillas en la cuenta del local.
- El token se guarda **cifrado** (AES-256-GCM).
- Los envíos salen por el número del local o, si no conectó, por el de la plataforma. Si el local tiene número propio y algo falla, **no** se usa el de la plataforma.
- Los mensajes que el dueño escribe desde el celular (`smb_message_echoes`) se guardan en el chat y pausan la IA.
- Si el local quita el acceso desde Meta (`account_update`), se marca desconectado. Desconectar borra la fila (y el token).
- Cada local paga sus mensajes con su tarjeta en su WhatsApp Manager (DinexFlow como Tech Provider).

### 13.5 Webhook de Meta

- `GET /api/webhooks/whatsapp`: verificación con `WHATSAPP_VERIFY_TOKEN`.
- `POST /api/webhooks/whatsapp`: body crudo para validar `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`; responde 200 rápido y procesa después (estados, mensajes entrantes, ecos, cambios de cuenta) y, si corresponde, programa la respuesta de la IA.

---

## 14. Soporte (clientes → Tech)

- Ítem **Soporte** en el menú para todos los usuarios, **sin** chequeo de suscripción ni de permiso (alguien vencido tiene que poder reportar un problema de pago).
- El cliente crea un **reporte**: tipo (Error, Pago, Duda, Sugerencia), título (hasta 120 caracteres), texto y captura opcional (también se pega con Ctrl+V; hasta 5 MB; se sube a Cloudinary en `menu-digital/soporte`). Solo se aceptan URLs de captura con ese formato exacto de la cloud propia.
- Cada reporte es una conversación entre el cliente y Tech.
- **Estados**: Abierto / En curso / Resuelto. Tech contesta → "en curso". El cliente escribe en uno resuelto → se reabre. Solo Tech cambia el estado. No se pisa un cambio hecho en el medio.
- El cliente ve solo los reportes de su cuenta; Tech ve los de todas.
- Marcas de "sin leer" de cada lado y contador en el menú (punto en "Más" del celular).
- Email a `SOPORTE_EMAIL` por cada reporte nuevo (opcional, sin frenar la respuesta).
- Límites: 10 reportes nuevos por hora por usuario; 60 escrituras cada 15 min.

---

## 15. Plataforma (Tech) y "Ver como el cliente"

### Panel de Plataforma

Solo para `es_plataforma`. Muestra:
- **Resumen**: total de cuentas, por plan, por estado, cuentas que pagan por pasarela vs. cargadas a mano, total de negocios, **MRR** (solo suscripciones activas) y MRR por plan.
- **Cuentas**: cada cuenta con plan, estado, vencimiento y uso (negocios, usuarios, productos).

### Ver como el cliente

- Botón **"Ver como cliente"** en cada cuenta: abre su panel como su dueño (rol admin; si no hay, el primer usuario activo; nunca otro Tech) en **solo lectura** durante **30 minutos**.
- El backend confirma en la base que quien lo pide sigue siendo Tech y firma un JWT con `solo_lectura: true` y `tech_id`.
- `authMiddleware` rechaza todo lo que no sea GET con ese token (403 `SOLO_LECTURA`). Los GET que cambian algo o entregan un link para cambiar algo llevan `noSoloLectura` (checkout de Mercado Pago y link del repartidor). **Regla: todo GET nuevo de ese tipo debe llevar `noSoloLectura`.**
- Abrir chats o reportes en este modo no los marca como leídos.
- En el panel: cartel fijo arriba con la hora de cierre y "Volver a mi cuenta". El token de Tech se guarda en `localStorage.ver_como`; al vencer (o con un 401) vuelve solo. Iniciar sesión borra el modo; las otras pestañas se recargan si cambia el token.
- El QR de mesas se sigue viendo.
- `backend/db/cuentas_prueba.sql`: 4 cuentas de prueba (Free, Básico, Estándar, Premium; emails `prueba.*@dinexflow.test`) con el DELETE para borrarlas.

---

## 16. Autenticación, 2FA y "Mi cuenta"

### Sesión

- JWT firmado con `JWT_SECRET`, válido 24 h. Lleva `id`, `username`, `rol`, `cuenta_id`, `es_plataforma`, `must_change_password` (y en "Ver como", `solo_lectura` y `tech_id`).
- Contraseñas con bcrypt.
- `GET /api/auth/verify` devuelve el usuario con sus permisos.
- Rate limit de autenticación: 10 intentos cada 15 min por IP.

### Registro y Google

- **Registro**: valida que el email no exista en usuarios ni cuentas; crea cuenta (trial de 15 días), negocio con slug único, configuración inicial y usuario dueño. El usuario de acceso es el email (o una versión corta si supera 50 caracteres).
- **Google**: verifica el ID token contra Google (audiencia = `GOOGLE_CLIENT_ID`, email verificado). Si el email ya existe, entra a esa cuenta; si no, crea una cuenta nueva en trial con contraseña aleatoria. Necesita `GOOGLE_CLIENT_ID` (backend) y `VITE_GOOGLE_CLIENT_ID` (panel).
- Las cuentas nuevas reciben `nuevo: true` y van al onboarding.

### Recuperar contraseña

1. `forgot-password` responde siempre lo mismo (no revela si el usuario existe).
2. Genera un token de un solo uso (64 hex, 1 h), invalida los anteriores y lo manda **al email del propio usuario**.
3. No cambia la contraseña hasta que se usa el link (`reset-password`), que consume el token.

### Verificación en dos pasos (2FA)

- Opcional por usuario desde **Mi cuenta → Seguridad**. Códigos **TOTP** (RFC 6238, 6 dígitos, 30 s) de Google/Microsoft Authenticator, implementado sin dependencias.
- Activación: QR + código para confirmar; se entregan **8 códigos de respaldo** de un solo uso (se guardan solo sus hashes).
- El secreto se guarda cifrado con AES-256-GCM (clave de `TOTP_KEY` o, si no hay, derivada de `JWT_SECRET`).
- Login con 2FA: la contraseña (o Google) devuelve un **desafío** JWT de 5 minutos firmado con otra clave (nunca sirve como sesión); `POST /api/auth/2fa/verificar` lo cambia por la sesión.
- Tolera ±1 paso de desfase del reloj y no acepta dos veces el mismo código.
- Desactivar pide un código.

---

## 17. Emails

- Proveedor **Resend**, dominio verificado (región São Paulo) y remitente `DinexFlow <no-reply@dinexflow.com.ar>` (`EMAIL_FROM`).
- Tres plantillas con la marca (`backend/src/services/emailService.js`, función `plantilla()`): **recuperar contraseña**, **bienvenida** y **reporte de soporte nuevo**. Logo en PNG servido desde `https://dinexflow.com.ar/email-logo.png` (Gmail no muestra SVG). Sin emojis. Texto escapado.

---

## 18. Analíticas y Dashboard

Endpoints (`/api/analiticas`, permiso `analiticas`):

| Endpoint | Qué devuelve |
|---|---|
| `GET /resumen` | Ventas, costo y ganancia de los últimos 6 meses (por mes de entrega), top productos del mes actual y productos con stock bajo (≤ 5) |
| `GET /historial?desde=YYYY-MM&hasta=YYYY-MM&tipo=` | Un bucket por mes del rango (incluye meses sin ventas), totales y productos más rentables. Por defecto, últimos 12 meses; pagina de a 1000 |
| `GET /actividad?dias=7\|30\|90` | Serie diaria de ventas y ganancia, serie del período anterior alineada, totales, ticket promedio, pedidos por tipo, estados, horas pico (día × hora), resumen de hoy y últimos pedidos |

- Fechas en hora de Argentina (UTC-3).
- Ventas = pedidos **entregados**, contados el día de entrega (`entregado_at`; si no existe, `created_at`).
- La demanda (tipo, horas, estados) cuenta todo lo pedido menos cancelados.
- Ganancia = ventas − (costo unitario × cantidad) de cada ítem.

---

## 19. Referencia de la API

### Públicas

| Método y ruta | Descripción |
|---|---|
| `GET /` · `GET /api/health` | Estado de la API (health no toca la base) |
| `GET /api/keep-alive` | Consulta liviana a la base |
| `GET /api/negocios/publico/:slug` | Resuelve el negocio por slug |
| `GET /api/negocios/publico/:slug/grupo` | Cuenta + negocios activos (menú general) |
| `GET /api/configuracion` | Configuración del negocio (header `X-Negocio-Id`) e indica si ofrece avisos por WhatsApp |
| `GET /api/categorias/activas` | Categorías activas |
| `GET /api/productos/disponibles` | Productos disponibles (oculta sin stock si lo controlan) |
| `POST /api/pedidos` | Crear pedido |
| `GET /api/tickets/:id?t=` | Ticket público |
| `GET /api/reparto/:id` · `POST …/salir` · `POST …/ubicacion` · `POST …/entregar` | Página del repartidor |
| `GET /api/seguimiento/:id` | Mapa del cliente |
| `POST /api/webhooks/mercadopago` | Webhook de Mercado Pago |
| `GET/POST /api/webhooks/whatsapp` | Webhook de Meta |

### Autenticación (`/api/auth`)

`POST /login`, `POST /signup`, `POST /google`, `POST /forgot-password`, `POST /reset-password`, `POST /register` (solo dueño), `GET /verify`, `POST /change-password`, `PUT /profile`, `PUT /email`, `POST /2fa/verificar`, `POST /2fa/iniciar`, `POST /2fa/activar`, `POST /2fa/desactivar`.

### Protegidas

| Prefijo | Middlewares | Rutas |
|---|---|---|
| `/api/upload` | auth, suscripción, permiso productos | `POST /` (imagen), `DELETE /` (por `public_id`) |
| `/api/categorias` | auth, negocio, suscripción, permiso | `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/api/productos` | auth, negocio, suscripción, permiso | `GET /`, `GET /stock-bajo`, `GET /categoria/:id`, `GET /:id`, `POST /` (+ límite), `PUT /:id`, `DELETE /:id` |
| `/api/variantes` | auth, negocio, suscripción, permiso productos | `GET /producto/:id`, `POST /producto/:id`, `PUT /grupo/:id`, `DELETE /grupo/:id` |
| `/api/usuarios` | auth, permiso usuarios | `GET /`, `GET /roles`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /:id/password`, `DELETE /:id` |
| `/api/plan` | auth, negocio | `GET /` (plan, uso y si incluye WhatsApp) |
| `/api/suscripcion` | auth | `GET /` (estado + catálogo), `GET /checkout/:plan` |
| `/api/configuracion` | auth, negocio, suscripción, permiso | `PUT /` |
| `/api/panel/configuracion` | auth, negocio | `GET` (lectura del panel con el negocio validado) |
| `/api/qr` | auth, negocio, suscripción, permiso qr | `GET /mesas`, `POST /regenerar` |
| `/api/pedidos` | auth, negocio, suscripción, permiso | `GET /` (filtros `estado`, `mesa`, `vista=curso\|historial`, `desde`, `hasta`, `limit`, `offset`), `GET /:id`, `GET /:id/link-reparto`, `PUT /:id/estado`, `DELETE /:id` |
| `/api/negocios` | auth, suscripción, permiso | `GET /`, `POST /` (+ límite), `PUT /:id`, `DELETE /:id` |
| `/api/analiticas` | auth, negocio, suscripción, permiso | `GET /resumen`, `GET /historial`, `GET /actividad` |
| `/api/whatsapp/chats` | auth, negocio, suscripción, WhatsApp, permiso pedidos | `GET /`, `GET /resumen`, `GET /:id/mensajes`, `POST /:id/mensajes`, `PATCH /:id/ia` |
| `/api/whatsapp` | auth, negocio, suscripción, WhatsApp, permiso configuración | `GET/PUT /avisos`, `GET /mensajes`, `POST /prueba`, `GET/PUT /ia`, `GET/POST/DELETE /cuenta`, `POST /cuenta/plantillas` |
| `/api/plataforma` | auth, Tech | `GET /cuentas`, `GET /resumen`, `POST /cuentas/:id/ver` |
| `/api/soporte` | auth | `GET /`, `GET /resumen`, `POST /`, `POST /imagen`, `GET /:id`, `POST /:id/mensajes`, `PATCH /:id` |

### Códigos de error tipados

| Código | HTTP | Cuándo |
|---|---|---|
| `SUSCRIPCION_VENCIDA` | 402 | Prueba o suscripción vencida |
| `SUSCRIPCION_CANCELADA` | 403 | Crear negocio/producto con la suscripción cancelada |
| `LIMITE_NEGOCIOS_ALCANZADO` | 403 | Límite de negocios del plan |
| `LIMITE_PRODUCTOS_ALCANZADO` | 403 | Límite de productos del negocio o de la cuenta |
| `PLAN_SIN_WHATSAPP` | 403 | Función de Estándar/Premium en Básico |
| `SOLO_LECTURA` | 403 | Cambio intentado en "Ver como el cliente" |

Errores internos: `respondError` devuelve un mensaje corto sin stack. JSON mal formado: 400.

---

## 20. Seguridad

- **Aislamiento entre cuentas**: `scopeNegocio` en todas las rutas por negocio; cada consulta filtra por `negocio_id` o `cuenta_id`. Tech es la única excepción.
- **Precios recalculados en el servidor** en cada pedido (productos y variantes del mismo negocio).
- **Costos privados**: nunca viajan en respuestas de pedidos ni en tickets.
- **Firmas HMAC** con comparación en tiempo constante: QR de mesa, links de ticket, seguimiento y reparto, webhooks de Mercado Pago y Meta.
- **Cifrado AES-256-GCM** de secretos 2FA y tokens de WhatsApp de cada local.
- **Rate limits**: autenticación, pedidos, reparto, soporte.
- **Validación zod** de las entradas (descarta claves desconocidas).
- **helmet** en el backend; **CORS** con lista de orígenes (`ALLOWED_ORIGINS` + `VITE_MENU_URL` + `ADMIN_URL`). Ojo: al cargar `ADMIN_URL` se activa la lista, y hay que cargar también `VITE_MENU_URL` o el menú público deja de andar.
- **CSP y cabeceras** en los dos frontends (`render.yaml`): el menú solo se puede embeber desde el panel; el panel no se puede embeber (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), HSTS, `nosniff`, `no-referrer`; geolocalización permitida solo en el menú (página del repartidor); el panel permite el SDK de Facebook para "Conectar mi WhatsApp".
- **Recuperación de contraseña** sin enumeración de usuarios y siempre al email propio.
- **Solo lectura** para el acceso de soporte a cuentas de clientes.
- **Uploads**: solo imágenes, hasta 5 MB, en memoria.
- `trust proxy` para que los límites vean la IP real detrás de Render.

---

## 21. Variables de entorno

### Backend

| Variable | Uso |
|---|---|
| `PORT` | Puerto (default 5000) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de datos |
| `JWT_SECRET` | Firma de sesiones y base de otras claves derivadas |
| `NODE_ENV` | `production` en Render |
| `ALLOWED_ORIGINS`, `ADMIN_URL`, `VITE_MENU_URL` | CORS, links de emails y links públicos |
| `MESA_QR_SECRET` | Firma de QR de mesa (32+ caracteres, no rotar) |
| `TOTP_KEY` | Cifrado de secretos 2FA (opcional) |
| `FREE_TRIAL_DAYS`, `TRIAL_PLAN` | Prueba gratis (15, premium = Pro) |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Mercado Pago |
| `GOOGLE_CLIENT_ID` | Login con Google |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Imágenes |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SOPORTE_EMAIL` | Emails |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_DEFAULT_CC`, `WHATSAPP_TEMPLATE_IDIOMA` | Envío por el número de la plataforma |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | Webhook de Meta |
| `WHATSAPP_NEGOCIO_DEFECTO` | Negocio para números nuevos en el número compartido |
| `META_APP_ID`, `WHATSAPP_ES_CONFIG_ID`, `META_SDK_VERSION`, `WHATSAPP_CUENTAS_KEY` | Número propio por local |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `IA_ESPERA_MS`, `IA_PAUSA_HORAS`, `NEGOCIO_TZ` | Bot con IA |
| `KEEP_ALIVE_CRON`, `SELF_URL`, `RENDER_EXTERNAL_URL` | Keep-alive |

### Frontends

| Variable | Dónde | Uso |
|---|---|---|
| `VITE_API_URL` | ambos | URL del backend (`https://backend-menu-digital.onrender.com`) |
| `VITE_ADMIN_URL` | menú | Botones de la landing hacia el panel |
| `VITE_MENU_URL` | panel | "Ver menú" y QR |
| `VITE_GOOGLE_CLIENT_ID` | panel | Botón de Google |

---

## 22. Migraciones SQL

En `backend/db/`, para correr en Supabase (el código tolera la mayoría sin correr, con funciones apagadas):

| Archivo | Qué agrega |
|---|---|
| `schema.sql`, `rpc.sql` | Base inicial |
| `multitenant_stock.sql` | Cuentas, negocios, stock |
| `roles.sql`, `roles_v2.sql`, `roles_v3_manager.sql`, `rol_plataforma.sql` | Roles, permisos y Tech |
| `suscripciones.sql`, `facturacion_ciclo.sql` | Estado de suscripción y ciclo |
| `hotmart_usuarios.sql`, `lemonsqueezy.sql` | Pasarelas anteriores (históricas) |
| `mercadopago.sql` | Columnas de Mercado Pago |
| `planes_2026_11.sql` | Planes actuales y trigger de límites (incluye consulta para ver cuentas que superan el límite) |
| `config_pedidos.sql`, `personalizacion.sql`, `moneda_negocio.sql`, `menu_porter.sql` | Opciones de entrega, personalización, moneda |
| `multirubro.sql` | Rubros, atributos y variantes |
| `pedido_entregado_at.sql` | Fecha de entrega |
| `venta_por_peso.sql` | `unidad_venta` y `unidad` |
| `mesas_qr.sql` | Versión de QR de mesa |
| `seguimiento_delivery.sql` | Ubicación del repartidor |
| `whatsapp_avisos.sql` | Avisos, mensajes, chats e IA |
| `whatsapp_cuentas.sql` | Número propio por local |
| `dos_factores.sql` | 2FA (**correr antes de publicar** el código de 2FA) |
| `soporte.sql` | Soporte |
| `cuentas_prueba.sql` | 4 cuentas de prueba |

---

## 23. Despliegue, keep-alive y CI

- **Render** (`render.yaml`): backend Node (`npm start`), menú y panel como sitios estáticos con reescritura a `index.html` y cabeceras de seguridad. Publica solo al subir a `main`.
- Si cambia `VITE_API_URL` u otra variable `VITE_*`, hay que hacer "Clear build cache & deploy".
- **Keep-alive interno** (`services/keepAlive.js`): cada 14 min consulta la base y se llama a sí mismo, para que Render Free no se duerma (15 min) y Supabase no se pause (~7 días).
- **GitHub Actions** (`.github/workflows/keep-alive.yml`): llamada diaria a `/api/keep-alive` (secreto `KEEPALIVE_URL`) para despertar el servicio si se durmió.
- Commits en esta PC salen como `facundolabtinos`.

---

## 24. Pruebas automáticas y cómo probar en local

### Tests del backend (`npm test`, `node --test`)

Cubren: actividad del Dashboard, avisos de pedido, chats, límites de productos y de planes, cuentas, 2FA, menú general, IA, Mercado Pago, QR de mesa, aislamiento por negocio, reparto, requisito de WhatsApp, comparación segura, esquemas, slugs, soporte, suscripción, ticket, venta por peso, "Ver como el cliente" y número propio de WhatsApp.

### Probar sin tocar la base real

- Backend falso en el scratchpad + panel/menú con `vite --mode mock` y `frontend-admin/.env.mock.local` / `frontend/.env.mock.local` (`VITE_API_URL=http://localhost:5055`; en el panel también `VITE_MENU_URL`). Sesión con un token inventado en `localStorage`.
- En el mock, el Dashboard se rompe si `/api/analiticas/*` devuelve `[]`.
- Emails: script que reemplaza `resend` en `require.cache`, escribe el HTML y se sirve con `py -m http.server` (entrada `email-preview` en `.claude/launch.json`).
- `nodemon` no vigila el `.env`: después de cambiarlo, reiniciar el backend.

---

## 25. Interruptores de idioma y moneda

- `MULTI_IDIOMA = false` en `frontend/src/lib/i18n.tsx` y `frontend-admin/src/lib/i18n.tsx`: idioma fijo español, sin selector (los textos en inglés y portugués siguen cargados).
- `MULTI_MONEDA = false` en `frontend-admin/src/lib/money.ts`: sin selector de moneda; el onboarding guarda ARS.
- Para reactivar, poner `true`: no se borró nada. Un negocio que ya tuviera otra moneda guardada la sigue mostrando.

---

## 26. Pendientes y limitaciones conocidas

### Para activar en producción

- **Número propio de WhatsApp** (código hecho, **sin commitear**): en Meta, ser Tech Provider, configurar Facebook Login for Business (Configuration ID), Advanced access de `whatsapp_business_management` y `whatsapp_business_messaging`, y suscribir webhooks `account_update`, `smb_message_echoes`, `history`, `smb_app_state_sync`. En Render: `META_APP_ID`, `WHATSAPP_ES_CONFIG_ID`. En Supabase: `backend/db/whatsapp_cuentas.sql`. Detalle en `docs/whatsapp-avisos.md`.
- **WhatsApp real de la plataforma**: hoy se usa "Test WhatsApp Account" (solo llega a números de prueba). Falta número propio, recrear las plantillas en esa cuenta, forma de pago y cambiar `WHATSAPP_PHONE_NUMBER_ID`.
- **Verificación del negocio en Meta**: enviada; Meta pide fotos de al menos 1500×1000.
- Plantilla `pedido_en_camino_mapa` aprobada en Meta (hasta entonces el aviso "en camino" no sale); `pedido_entregado_ticket` enviada a revisión.
- Confirmar corridas en Supabase: `venta_por_peso.sql`, `mesas_qr.sql`, `seguimiento_delivery.sql`, `planes_2026_11.sql`, `soporte.sql`.
- Definir `MESA_QR_SECRET` en Render y reimprimir los QR de mesa anteriores al QR firmado.
- Confirmar `NODE_ENV=production` en Render.

### Mejoras técnicas

- Webhook de Mercado Pago: responder 200 si la suscripción no existe (hoy da 500 y MP reintenta).
- Si alguien paga dos veces, el sistema cancela la suscripción vieja, pero el primer cobro duplicado hay que devolverlo a mano.
- Los middlewares `scopeNegocio`, `checkPermiso`, `requirePlataforma` y `checkLimite*` devuelven `error.message` en los 500: pasarlos a `respondError`.
- "Top productos por unidades" del Dashboard suma kg y unidades juntos.
- El menú general usa la identidad visual del primer negocio para todo.
- "Control de stock" figura como Estándar y Premium pero no se bloquea por plan; analíticas no se limitan por plan (es a propósito).
- Accesibilidad menor: `aria-controls` entre pestaña y panel en los modales; los botones "Editar" de categorías miden menos de 44 px en el celular.
- "Ver como el cliente": falta registro persistente de quién entró a qué cuenta (hoy solo en los logs de Render) y los botones de guardar siguen visibles en solo lectura (al tocarlos sale el aviso).
- Repartidor: si cierra la página o se bloquea el celular, deja de mandar la ubicación.

### Próximas herramientas de Tech propuestas

Manejar cuentas (suspender, alargar prueba, regalar plan), pagos de Mercado Pago, aviso general, estado del sistema, clientes a cuidar e historial de acciones.

---

## 27. Historial de hitos

| Fecha | Hito |
|---|---|
| 07/11/2026 | Rediseño de la landing con animaciones de scroll; panel admin auditado y rediseñado (claro/oscuro, menú nuevo, Dashboard con gráficos) |
| 08/11/2026 | Paso a Argentina: precios en pesos, sin plan anual, cobro con Mercado Pago (probado de punta a punta y en producción) |
| 08/11/2026 | Verificación en dos pasos (2FA) |
| 08/11/2026 | Menú de ejemplo en `/menu`; menú público rediseñado |
| 08/11/2026 | Venta por peso e historial de pedidos |
| 08/11/2026 | QR por mesa firmado |
| 09/11/2026 | WhatsApp con token permanente; ticket por link; seguimiento del delivery en mapa |
| 09/11/2026 | Todo en español y en pesos (interruptores de idioma y moneda) |
| 09/11/2026 | QR general (menú con todos los negocios) |
| 09/11/2026 | Planes nuevos (50 / 180 / 1.000 productos repartidos, WhatsApp solo en Estándar y Premium) |
| 09/11/2026 | Modales nuevos de Categoría y Producto con preguntas simples y ayudas ⓘ |
| 09/11/2026 | Soporte (clientes → Tech) |
| 09/11/2026 | "Ver como el cliente" en solo lectura |
| 09/11/2026 | Dominio propio `dinexflow.com.ar` y emails desde `no-reply@dinexflow.com.ar` con plantillas de la marca |
| 10/11/2026 | Delivery con mapa probado en producción; verificación del negocio en Meta enviada; número propio de WhatsApp por local (sin commitear) |
