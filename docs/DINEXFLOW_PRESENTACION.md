# DinexFlow — Presentación completa del sistema

> Estado al **17/11/2026 (noche)**, `main` = `a8de7ce`. Todo lo que tiene DinexFlow hoy, en producción: qué es, para quién, qué hace cada parte, todas las rutas y slugs, la base de datos, los módulos multirrubro, envíos y medios de pago, WhatsApp, seguridad, despliegue y lo que falta.
>
> **Novedades desde la versión de la mañana del 17/11:** landing multirrubro ("Tu negocio es Dinex"), número real de WhatsApp de DinexFlow, costo del envío del delivery con envío gratis (§9.1) y medios de pago: efectivo con vuelto y transferencia con comprobante (§9.2).
>
> Reemplaza a `docs/SISTEMA_COMPLETO.md` del 14/11, que es anterior a la evolución multirrubro.

---

## Índice

1. [Qué es DinexFlow](#1-qué-es-dinexflow)
2. [Para quién: rubros y especialidades](#2-para-quién-rubros-y-especialidades)
3. [Arquitectura](#3-arquitectura)
4. [Dominios, URLs y slugs](#4-dominios-urls-y-slugs)
5. [Módulos por negocio](#5-módulos-por-negocio)
6. [Onboarding de 8 pasos](#6-onboarding-de-8-pasos)
7. [Página pública del negocio](#7-página-pública-del-negocio)
8. [Catálogo: productos, variantes, personalización y servicios](#8-catálogo-productos-variantes-personalización-y-servicios)
9. [Pedidos, entregas, envío y pagos](#9-pedidos-entregas-envío-y-pagos)
10. [Presupuestos](#10-presupuestos)
11. [Turnos (reservas y agenda)](#11-turnos-reservas-y-agenda)
12. [Clientes](#12-clientes)
13. [QR general y QR de mesa](#13-qr-general-y-qr-de-mesa)
14. [Delivery con mapa y ticket](#14-delivery-con-mapa-y-ticket)
15. [WhatsApp: avisos, chats, IA y número propio](#15-whatsapp-avisos-chats-ia-y-número-propio)
16. [Panel de administración](#16-panel-de-administración)
17. [Cuentas, roles y permisos](#17-cuentas-roles-y-permisos)
18. [Planes, prueba gratis y cobro](#18-planes-prueba-gratis-y-cobro)
19. [Registro de cambios (auditoría)](#19-registro-de-cambios-auditoría)
20. [Analíticas](#20-analíticas)
21. [Soporte, Plataforma y "Ver como el cliente"](#21-soporte-plataforma-y-ver-como-el-cliente)
22. [Autenticación, 2FA y emails](#22-autenticación-2fa-y-emails)
23. [Base de datos](#23-base-de-datos)
24. [Referencia de la API](#24-referencia-de-la-api)
25. [Seguridad](#25-seguridad)
26. [Variables de entorno](#26-variables-de-entorno)
27. [Migraciones SQL](#27-migraciones-sql)
28. [Despliegue, ramas y commits](#28-despliegue-ramas-y-commits)
29. [Pruebas](#29-pruebas)
30. [Estado de WhatsApp en Meta](#30-estado-de-whatsapp-en-meta)
31. [Pendientes, decisiones y límites conocidos](#31-pendientes-decisiones-y-límites-conocidos)
32. [Historial de hitos](#32-historial-de-hitos)

---

## 1. Qué es DinexFlow

**DinexFlow** es un SaaS argentino para que cualquier negocio tenga su **página propia con catálogo, pedidos, presupuestos y turnos**, administrada desde un panel, con avisos por WhatsApp. Nació como menú digital con QR para gastronomía y hoy es **multirrubro**: restaurantes, tiendas, fabricantes de productos personalizados, peluquerías, consultorios, profesionales, talleres, academias, alojamientos y más.

- **El dueño** arma su página desde un panel: productos o servicios, precios, fotos, horarios, formas de entrega, turnos y presupuestos. Imprime su QR o comparte su link.
- **El cliente** entra desde el celular (sin instalar nada), compra, pide un presupuesto o saca un turno. Le puede llegar cada novedad por WhatsApp.
- **Sin comisiones por venta**: suscripción mensual en pesos (Mercado Pago). El cliente le paga **directo al local** (efectivo o transferencia a su cuenta); DinexFlow no toca esa plata.
- **Eslogan**: "Tu negocio es Dinex."
- **Tono**: español rioplatense, de vos. Todo el sistema está en **español y en pesos (ARS)**.
- **Regla de producto**: nada inventado (sin testimonios, logos ni métricas falsas; los ejemplos se rotulan como ejemplo).

**Cada negocio activa solo lo que usa** (módulos): un restaurante ve exactamente lo de siempre; una peluquería ve servicios y turnos; una imprenta 3D ve productos personalizados y presupuestos.

---

## 2. Para quién: rubros y especialidades

Catálogo central en la base (`rubros_categorias` + `rubros_especialidades`), leído por `GET /api/rubros`. **11 categorías y 78 especialidades.** Agregar una especialidad nueva es un `INSERT`.

Cada categoría tiene una **familia** (`tipo_rubro`), que define íconos, vocabulario de la página pública y la URL que se comparte:

| Familia (`tipo_rubro`) | Vocabulario en la página | Link que comparte el panel |
|---|---|---|
| `gastronomia` | "menú" (como siempre) | `/menu/<slug>` |
| `retail` | "catálogo" | `/negocio/<slug>` |
| `servicios` | "servicios", "página" | `/negocio/<slug>` |
| `generico` | "catálogo" | `/negocio/<slug>` |

### Categorías (slug → nombre, familia, sugerencias del onboarding)

| Slug | Nombre | Familia | Ofrece | Funciones sugeridas |
|---|---|---|---|---|
| `gastronomia` | Gastronomía | gastronomia | productos | pedidos, retiro, envíos, presencial |
| `comercios` | Comercios y tiendas | retail | productos | venta directa, retiro, envíos |
| `fabricacion` | Fabricación y productos personalizados | retail | productos, personalizados | pedidos, presupuestos, retiro, envíos |
| `belleza` | Belleza y cuidado personal | servicios | servicios | reservas, presencial |
| `salud` | Salud y bienestar | servicios | servicios | reservas, presencial, virtual |
| `servicios_profesionales` | Servicios profesionales | servicios | servicios | presupuestos, virtual, presencial |
| `hogar` | Hogar, mantenimiento y construcción | servicios | servicios | presupuestos, presencial |
| `automotor` | Automotor | servicios | servicios | reservas, presupuestos, presencial |
| `educacion` | Educación y entretenimiento | servicios | servicios | reservas, presencial, virtual |
| `turismo` | Turismo y alojamiento | servicios | servicios | reservas, presupuestos |
| `otros` | Otros | generico | productos | venta directa |

### Especialidades (slug → nombre), por categoría

- **`gastronomia`**: `restaurante` Restaurante · `bar` Bar · `cafeteria` Cafetería · `heladeria` Heladería · `panaderia` Panadería · `pizzeria` Pizzería · `hamburgueseria` Hamburguesería · `rotiseria` Rotisería · `parrilla` Parrilla · `catering` Catering · `food_truck` Food truck
- **`comercios`**: `ropa` Ropa · `calzado` Calzado · `perfumeria` Perfumería · `electronica` Electrónica · `informatica` Informática · `telefonia` Telefonía · `muebles` Muebles · `libreria` Librería · `jugueteria` Juguetería · `ferreteria` Ferretería · `supermercado` Supermercado · `kiosco` Kiosco · `pet_shop` Pet shop
- **`fabricacion`**: `impresion_3d` Impresión 3D · `sublimacion` Sublimación · `estampados` Estampados · `artesanal` Fabricación artesanal · `carpinteria` Carpintería · `muebles_medida` Muebles a medida · `corte_grabado` Corte y grabado · `personalizados` Productos personalizados · `por_encargo` Fabricación por encargo
- **`belleza`**: `peluqueria` Peluquería · `barberia` Barbería · `estetica` Estética · `unas` Uñas · `maquillaje` Maquillaje · `depilacion` Depilación · `spa` Spa · `masajes` Masajes
- **`salud`**: `nutricion` Nutricionista · `psicologia` Psicología · `kinesiologia` Kinesiología · `consultorio` Consultorio · `rehabilitacion` Rehabilitación
- **`servicios_profesionales`**: `contador` Contador · `abogado` Abogado · `diseno` Diseño · `fotografia` Fotografía · `arquitectura` Arquitectura · `consultoria` Consultoría · `tecnico_it` Técnico informático
- **`hogar`**: `electricista` Electricista · `plomero` Plomero · `albanil` Albañil · `pintor` Pintor · `carpintero` Carpintero · `jardinero` Jardinero · `limpieza` Limpieza · `mantenimiento` Mantenimiento
- **`automotor`**: `taller` Taller mecánico · `gomeria` Gomería · `lavadero` Lavadero · `detailing` Detailing · `chapa_pintura` Chapa y pintura
- **`educacion`**: `academia` Academia · `instituto` Instituto · `idiomas` Idiomas · `clases` Clases particulares · `gimnasio` Gimnasio · `baile` Academia de baile
- **`turismo`**: `hotel` Hotel · `cabanas` Cabañas · `alojamiento` Alojamiento · `excursiones` Excursiones · `agencia` Agencia de viajes
- **`otros`**: `otro` Otro

En el negocio se guardan `rubro_categoria` y `rubro_especialidad`; `tipo_rubro` (la familia) se deriva de la categoría y se conserva por compatibilidad (con su CHECK original).

---

## 3. Arquitectura

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `backend/` | API REST | Node.js + Express 5, Supabase (Postgres) con `@supabase/supabase-js`, JWT, bcrypt, zod, multer, Cloudinary, Resend, node-cron, helmet, express-rate-limit |
| `frontend/` | Sitio público: landing, página del negocio, presupuestos, turnos, ticket, reparto, seguimiento | React 19 + Vite + Tailwind v4, React Router, GSAP + Lenis (landing), Leaflet + OpenStreetMap |
| `frontend-admin/` | Panel de administración | React 19 + Vite + Tailwind v4, React Router, contextos de sesión, negocio (con módulos y rubro) y tema |

| Servicio externo | Uso |
|---|---|
| **Supabase** | Postgres. El backend usa la service role key; las tablas nuevas tienen RLS prendido sin políticas |
| **Render** | Backend (Web Service) y los dos frontends (Static Sites). Despliega al subir a `main` |
| **Cloudinary** | Imágenes públicas (productos, logos, portadas, soporte) y **archivos privados de clientes** (`authenticated`, se ven con URL firmada) |
| **Mercado Pago** | Suscripciones mensuales (preapproval) + webhook firmado |
| **Meta / WhatsApp Cloud API** | Avisos (plantillas), chats, IA, número propio por local (Embedded Signup) |
| **OpenRouter** | Modelo de IA del asistente de WhatsApp |
| **Resend** | Emails desde `no-reply@dinexflow.com.ar` |
| **Google Identity Services** | "Continuar con Google" |
| **Cloudflare** | DNS de `dinexflow.com.ar` |
| **GitHub Actions** | Keep-alive diario |

```
Cliente (celular)                              Dueño / equipo
  │ QR o link                                       │
  ▼                                                 ▼
frontend  (dinexflow.com.ar)                frontend-admin (admin.dinexflow.com.ar)
  /menu/:slug · /negocio/:slug · /reserva …    /admin/*
  └──────────────────┬──────────────────────────────┘
                     ▼
          backend (backend-menu-digital.onrender.com)
   Supabase · Cloudinary · Mercado Pago · Meta WhatsApp · OpenRouter · Resend
```

**Backend**: `src/server.js` (rutas y middlewares), `src/routes/`, `src/controllers/`, `src/middleware/` (auth, `scopeNegocio`, `checkPermiso`, `checkSuscripcion`, `requiereModulo`, `requiereWhatsapp`, límites, solo lectura, rate limits, validación), `src/services/` (WhatsApp, avisos, chats, IA, cuentas de WhatsApp, email, keep-alive, limpieza de adjuntos), `src/utils/` (módulos, rubros, entregas, **envío**, **pagos**, agenda, personalización, links firmados, QR, 2FA, suscripción, actividad, estadísticas de agenda, registro de cambios), `src/schemas/index.js` (zod), `db/` (migraciones), `scripts/` (por ejemplo `crearPlantillasPlataforma.js`), `tests/`.

Reglas que comparten el menú y el backend (misma lógica en los dos lados): `utils/entregas.js`, `utils/envio.js` (copia en `frontend/src/lib/envio.ts`) y `utils/pagos.js` (copia en `frontend/src/lib/pagos.ts`). El backend siempre recalcula; el menú solo muestra.

**Panel**: `App.tsx` (rutas con `ProtectedRoute` por permiso y por módulo), `components/AdminLayout.tsx` (menú, avisos, contadores), `context/NegocioContext.tsx` (negocio activo, moneda, slug, **rubro**, **módulos** con `tieneModulo` y `usaModulo`), `services/api.ts`, `lib/`.

---

## 4. Dominios, URLs y slugs

### Dominios

| Qué | URL |
|---|---|
| Landing y páginas públicas | `https://dinexflow.com.ar` (`www` redirige) |
| Panel | `https://admin.dinexflow.com.ar/admin/login` |
| Alta directa | `https://admin.dinexflow.com.ar/admin/login?view=signup` |
| Backend | `https://backend-menu-digital.onrender.com` |
| URLs viejas de Render | `menu-digital-frontend-qxjm.onrender.com`, `menu-digital-admin.onrender.com` (siguen andando para QR impresos antes del dominio) |

Dominio en NIC Argentina (vence 08/11/2027), DNS en Cloudflare Free, CNAME siempre **DNS only**.

### Slug del negocio

- Cada negocio tiene un `slug` **único entre todas las cuentas**, armado con su nombre (`pizzeria-roma`; si está tomado, `pizzeria-roma-2`). Se actualiza al cambiar el nombre.
- Se resuelve con `GET /api/negocios/publico/:slug` (si no existe o está inactivo: "Página no encontrada").
- Negocio conocido en producción: **Bar la Esquina** → slug `bar-la-esquina` (negocio id 1, de prueba, gastronomía). Los slugs de todos los negocios de una cuenta se ven en **Panel → Negocios**.

### Rutas públicas (`frontend/`)

| Ruta | Página |
|---|---|
| `/` | Landing |
| `/privacidad` | Política de privacidad |
| `/menu` | Menú de ejemplo ("La Esquina", sin API) |
| `/menu?negocio=<id>` | Página por id (QR viejos de negocios sin slug) |
| `/menu/<slug>` | Página del negocio (la de siempre; la usan los QR impresos) |
| `/menu/<slug>?mesa=N&t=<firma>` | Página con QR de mesa firmado |
| `/menu/<slug>/todos` | Menú general (todos los negocios de la cuenta) |
| `/negocio/<slug>` | **Página canónica multirrubro**: la misma página que `/menu/<slug>`, con vocabulario del rubro |
| `/negocio/<slug>/presupuesto` | Pedir un presupuesto (`?producto=<id>` o `?servicio=<id>` opcional) |
| `/negocio/<slug>/reservar` | Sacar un turno (`?servicio=<id>` opcional) |
| `/presupuesto/<id>?t=<firma>` | El cliente sigue su presupuesto, acepta o rechaza la cotización |
| `/reserva/<id>?t=<firma>` | El cliente ve, cancela o cambia su turno |
| `/ticket/<id>?t=<firma>` | Ticket de un pedido entregado |
| `/reparto/<id>?t=<firma>` | Página del repartidor |
| `/seguimiento/<id>?t=<firma>` | Mapa del delivery para el cliente |

### Rutas del panel (`frontend-admin/`)

`/admin/login` · `/admin/reset-password` · `/admin/cambiar-password` · `/admin/onboarding` · `/admin/dashboard` · `/admin/pedidos` · `/admin/chats` · `/admin/productos` · `/admin/categorias` · `/admin/servicios` · `/admin/presupuestos` · `/admin/turnos` · `/admin/clientes` · `/admin/qr` · `/admin/whatsapp` · `/admin/configuracion` · `/admin/usuarios` · `/admin/negocios` · `/admin/suscripcion` · `/admin/soporte` · `/admin/plataforma` · vista previa `/menu` y `/menu/:slug`.

---

## 5. Módulos por negocio

Guardados en `negocios.modulos` (JSONB). Registro único en `backend/src/utils/modulos.js`; lista pública en `GET /api/modulos`.

| Código | Nombre | Qué hace | Depende de |
|---|---|---|---|
| `catalogo` | Catálogo | La página pública (siempre prendido) | — |
| `productos` | Productos | Productos con precio, fotos, opciones y stock | catalogo |
| `personalizados` | Productos personalizados | Campos que completa el cliente (texto, medidas, archivos) | productos |
| `servicios` | Servicios | Servicios con precio, duración y modalidad | catalogo |
| `pedidos` | Pedidos | Carrito y pedidos que llegan al panel | productos |
| `carrito` | Carrito | (oculto) igual a pedidos | pedidos |
| `entregas` | Entregas | Retiro, delivery, mesa, mostrador, envío | pedidos |
| `presupuestos` | Presupuestos | Cotizaciones a pedido del cliente | catalogo |
| `reservas` | Reservas y turnos | Agenda sin superposición | catalogo |
| `clientes` | Clientes | Lista de clientes con su historial | catalogo |
| `estadisticas` | Estadísticas | Ventas, ganancia y horas pico en el Dashboard | — |

- **`modulos = NULL` = perfil de siempre** (`LEGADO`): catálogo, productos, pedidos, carrito, entregas y estadísticas prendidos; el resto apagado. Así **un restaurante existente funciona exactamente igual que antes**.
- Dependencias en cadena: apagar Pedidos apaga Entregas; prender Personalizados prende Productos.
- Backend: middleware `requiereModulo(codigo)` (caché de 60 s por proceso) responde **403 `MODULO_INACTIVO`**.
- Panel: el menú lateral muestra solo lo del negocio; una ruta de un módulo apagado muestra "Módulo apagado" con link a Configuración.
- Apagar un módulo **no borra nada**: vuelve al prenderlo.
- Se cambian en **Configuración → Módulos** y se definen al completar el onboarding.

---

## 6. Onboarding de 8 pasos

`/admin/onboarding`, **retomable** (`negocios.onboarding` guarda el paso), con aviso en el Dashboard mientras no se termina ("Terminá de configurar tu negocio").

1. **Crear la cuenta** (registro o Google): se hace al darse de alta.
2. **"Contanos de tu negocio"**: datos que ven los clientes (solo el nombre es obligatorio).
3. **"¿A qué se dedica tu negocio?"**: categoría y, si quiere, especialidad (catálogo central).
4. **"¿Qué ofrece tu negocio?"**: productos, productos personalizados, servicios.
5. **"¿Cómo trabaja tu negocio?"**: pedidos, venta directa, presupuestos, reservas, retiro, envíos, presencial, virtual.
6. **"Cómo se ve tu negocio"**: logo, portada y color.
7. **"Cargá tus primeros productos"**: primer producto o servicio.
8. **"Así lo van a ver tus clientes"**: vista previa de la página pública y publicar.

API: `GET /api/onboarding`, `PUT /api/onboarding`. Mientras no se completa, los pasos 4 y 5 definen los módulos (`desdeOnboarding`); al completarlo, se ajustan en Configuración → Módulos.

---

## 7. Página pública del negocio

### 7.0 Landing (`/`)

Página de venta de DinexFlow, ya **multirrubro** (`frontend/src/pages/Landing.tsx`, publicada en `752fa35`). Mismo estilo "Hora pico" (paleta, Archivo + Bodoni, escenas con GSAP + Lenis; respeta "reducir movimiento").

- **Título animado**: "Tu ___ es Dinex." La palabra rota (negocio → local → tienda → taller → estudio → empresa → negocio) en unos 4,5 s y **se queda quieta** (WCAG 2.2.2). "Dinex" en naranja (`aji-deep`) con un subrayado que se dibuja.
- Manifiesto, pasos, funciones (catálogo, pedidos, servicios, turnos, presupuestos, productos a medida, clientes), rubros, precios, preguntas frecuentes y cierre, con textos para cualquier negocio. Título, descripción y `og` del `index.html` también multirrubro.
- **No** promociona todavía el número propio de WhatsApp por local (falta que Meta lo habilite).
- Botones "Ingresar" y "Probar gratis" (15 días) llevan al panel (`VITE_ADMIN_URL`). El QR y "O probalo acá" llevan al menú de ejemplo `/menu`.

### 7.1 Página del negocio

Misma página en `/menu/<slug>` y `/negocio/<slug>`; se arma según los módulos:

- **Cabecera**: nombre, logo, portada, estado Abierto/Cerrado según horarios (franjas que pasan la medianoche incluidas), chips de formas de entrega, contacto y WhatsApp.
- **Buscador + categorías** fijas con scroll-spy.
- **Productos** (si hay módulo): tarjetas; los no disponibles o sin stock se ocultan.
- **Servicios** (si hay módulo): precio (fijo, "desde" o "a consultar"), duración, modalidad; botones "Reservar turno" y/o "Pedir presupuesto" o "Consultar por WhatsApp".
- **¿Querés sacar turno?** → "Ver horarios disponibles" (si hay reservas y servicios con turno).
- **¿Necesitás algo a medida?** → "Pedir presupuesto" (si hay presupuestos).
- **Carrito** solo si el negocio toma pedidos; si no, "Consultar por WhatsApp".
- **Vocabulario por rubro**: en `/negocio/<slug>` los textos neutros hasta conocer el rubro; tienda = "catálogo", servicios = "servicios/página", gastronomía = "menú" como siempre.
- **SEO**: título de la pestaña y `meta description` con los datos del negocio.
- Identidad visual del local (logo, portada, color con contraste automático).

---

## 8. Catálogo: productos, variantes, personalización y servicios

### Productos

Nombre, descripción, categoría, precio, costo (privado), foto, disponible, orden, control de stock, **venta por peso** (precio por kg, de a 100 g, mínimo 100 g, atajos 250 g / 500 g / 1 kg), SKU y atributos libres por rubro.

### Variantes (talles, colores, tamaños, extras)

Grupos de una opción (`single`) o varias (`multi`), obligatorios u opcionales, con precio extra y **stock por opción**. Una opción con stock en 0 aparece **"Sin stock"** y no se puede elegir; la preselección salta a la primera con stock. El backend valida grupo obligatorio, mismo producto, opción activa y una sola opción en `single`.

### Personalización (módulo `personalizados`)

Campos que completa el cliente por producto (`producto_campos`):

| Tipo | Ejemplo |
|---|---|
| `texto` / `texto_largo` | "Texto de la taza" (con largo máximo) |
| `numero` | Medidas (mín./máx.) |
| `opcion` / `multiple` | Elegir de una lista |
| `color` | Color elegido |
| `archivo` | Foto, PDF o modelo 3D del cliente |

- **Archivos del cliente** (`adjuntos`): imagen, PDF o 3D (`stl`, `obj`, `3mf`), hasta **10 MB**, validados por contenido (magic bytes), privados en Cloudinary (`authenticated`); el panel los abre con **URL firmada** ("Ver archivo"). Token de un solo uso, tope de **50 sin usar por negocio**, y una tarea cada hora (minuto 17) borra los no usados de más de 24 h.
- El pedido guarda una **foto histórica** de lo elegido (`pedido_items.opciones` y `personalizacion`): si el negocio renombra o borra un campo, el pedido viejo sigue mostrando lo que compró el cliente.

### Servicios (módulo `servicios`)

Tabla `servicios`: nombre, descripción, imagen, categoría, **tipo de precio** (`fijo`, `desde`, `variable`), precio, **duración** (5 a 1440 min), **modalidades** (`presencial`, `domicilio`, `virtual`, `visita`), `requiere_turno`, `requiere_presupuesto`, activo y orden. Pantalla **Panel → Servicios**.

---

## 9. Pedidos, entregas, envío y pagos

### Tipos de entrega (`pedidos.tipo_entrega`)

| Tipo | Se activa con | Qué pide |
|---|---|---|
| `mesa` | Mesas activas + **QR de mesa firmado** | Nada (la mesa viene del QR) |
| `retiro` | `retiro_activo` | Teléfono |
| `delivery` | `delivery_activo` | Dirección y teléfono |
| `mostrador` | `modalidades.mostrador` | Nada (pide y retira en el momento) |
| `envio` | `modalidades.envio` | Dirección completa (calle, número, ciudad, CP) y teléfono |

**Pedidos programados** (`pedidos.programado_para`): `modalidades.retiro_programado` (retiro) y `modalidades.entrega_programada` (delivery y envío). Reglas: al menos **30 min** de anticipación, hasta **30 días**, dentro de los horarios del local (franjas nocturnas incluidas; sin horarios no se restringe), siempre en **hora de Argentina**. El checkout muestra "¿Para cuándo?" (Lo antes posible / Programarlo).

Las modalidades se prenden en **Configuración → Opciones de servicio** (4 interruptores). **Una sola regla** (`utils/entregas.js`) decide qué ofrece el checkout y qué acepta el backend.

### Ciclo de vida

```
pendiente → preparando → listo (retiro / mostrador) ─────────┐
                       → en_camino (delivery / envío) ───────┼→ entregado
cancelado: desde cualquier estado                            ┘
```

### Creación (`POST /api/pedidos`, pública)

1. Rate limit 20 cada 5 min por IP; validación zod (hasta 100 ítems).
2. Tipo de entrega según la configuración **actual** y los módulos.
3. Mesa: existente y con firma válida de la versión vigente del QR.
4. **Recalcula todo desde la base**: precio, costo, unidad, extras de variantes y personalización validada. Nunca usa precios del cliente; rechaza productos de otro negocio o pausados.
5. **Calcula el costo del envío** con la configuración actual del local (nunca usa el que manda el cliente) — ver 9.1.
6. **Valida el medio de pago** elegido — ver 9.2.
7. Guarda pedido, ítems, stock (por producto y por opción), adjuntos y comprobante en **una sola transacción** (función `crear_pedido`). Si la función no existe, usa el camino anterior.
8. Si el cliente aceptó, aviso por WhatsApp en segundo plano.
9. Responde sin costos.

En el panel: pestañas En curso (actualiza cada 15 s) e Historial; filtros por estado, mesa y tipo (los tipos nuevos aparecen solo si hay pedidos de ese tipo); "📦 Despachar" para envíos, "Listo para retirar" para retiro y mostrador; etiqueta **"Para el 16/11, 18:30"** si está programado; desglose de productos + envío; estado del pago; ticket térmico 80 mm o A4; solo se borran cancelados.

### 9.1 Costo del envío (delivery propio)

Publicado en `b2c1ee2`. Solo para pedidos **`delivery`** (no para `envio` por correo ni para retiro/mesa/mostrador).

- **Configuración** (`configuracion.envio`), en **Configuración → Envío**:

| Campo | Qué es |
|---|---|
| `cobrar` | Si el local cobra el envío |
| `monto` | Precio fijo del envío |
| `gratis_desde` | Con productos por este monto o más, el envío es gratis (vacío = nunca) |
| `cobro` | `pedido` (se paga junto con el pedido) o `efectivo` (se paga en efectivo al repartidor) |

- **Solo el dueño** (rol `admin`) lo cambia, con `PUT /api/configuracion/envio`. Admin (manager) y Staff lo ven deshabilitado.
- Regla única en `backend/src/utils/envio.js` (`costoEnvio`), con copia en `frontend/src/lib/envio.ts` para el carrito.
- El pedido guarda `pedidos.costo_envio` y `pedidos.envio_cobro`. **`pedidos.total` sigue siendo solo productos**, así el Dashboard, Clientes y analíticas no cambian. Lo que paga el cliente = `total + costo_envio`.
- Se muestra en el carrito (con "te faltan $X para el envío gratis"), en el mensaje de WhatsApp, en Panel → Pedidos, en el ticket impreso, en el ticket público y en la página del repartidor.
- Ejemplo en producción: Bar la Esquina cobra $1.000, gratis desde $15.000, junto con el pedido.

### 9.2 Medios de pago: efectivo y transferencia

Publicado en `a8de7ce`. **Falta correr `backend/db/medios_pago.sql` en Supabase** para poder activarlos (hasta entonces los pedidos siguen como antes, sin pago). Todos los planes. Mercado Pago por negocio (QR/link) queda para más adelante.

- **Configuración** (`configuracion.pagos`), en **Configuración → Pagos**, **solo el dueño** (`PUT /api/configuracion/pagos`):

| Campo | Qué es |
|---|---|
| `efectivo` | Acepta efectivo al recibir |
| `transferencia` | Acepta transferencia |
| `alias`, `cbu`, `titular`, `banco` | Datos que ve el cliente para transferir (alias de 6 a 20 caracteres; CBU/CVU de 22 números; con transferencia, alias o CBU y titular son obligatorios) |
| `comprobante` | `no` · `opcional` · `obligatorio`: si el cliente adjunta el comprobante |

- El menú público **no recibe** los datos de la cuenta si la transferencia está apagada.
- **No aplica** a pedidos en mesa (se paga en el local) ni a pedidos sin tipo de entrega. Sin medios activos, el pedido se toma como siempre.
- **Efectivo**: el cliente puede decir **con cuánto paga**; el backend exige que alcance para productos + envío y el panel/repartidor ven el **vuelto**. Sin monto = paga justo. Queda `estado_pago = pendiente`.
- **Transferencia**: el cliente ve alias/CBU, titular y banco (con botón para copiar), puede poner **quién transfirió** (`pedidos.transfirio`) y subir el **comprobante** (foto o PDF) por `POST /api/adjuntos?uso=comprobante`: archivo privado en Cloudinary, `adjuntos.uso = 'comprobante'`, tope propio de 50 sin usar por negocio. Se guarda en `pedidos.comprobante_id`. Queda `estado_pago = en_revision`.
- **Confirmar el pago**: dueño y Admin (manager) con `PUT /api/pedidos/:id/pago` → "Llegó la plata" (`pagado`) o "No llegó" (`rechazado`), con confirmación. Staff no. El panel muestra "Transfirió: X" y "Ver comprobante" (link firmado). Se puede empezar a preparar antes de que se confirme (con aviso).
- **Transferencia + envío en efectivo al repartidor**: se transfieren solo los productos y el repartidor cobra el envío (`montosDePago`, igual en back y front).
- **Repartidor**: ve "Cobrar en efectivo $X", el vuelto a llevar, el estado de la transferencia y "No cobres nada" si ya está todo pago.
- Datos del pedido: `metodo_pago` (`efectivo` | `transferencia`), `paga_con`, `estado_pago` (`pendiente` | `en_revision` | `pagado` | `rechazado`), `transfirio`, `comprobante_id`.
- Regla única en `backend/src/utils/pagos.js` (copia en `frontend/src/lib/pagos.ts`).

---

## 10. Presupuestos

Módulo `presupuestos`. El cliente pide una cotización; el negocio responde con un precio; el cliente acepta o rechaza; uno aceptado se convierte en pedido.

- **Pedir** (`/negocio/<slug>/presupuesto`, opcional `?producto=` o `?servicio=`): descripción, cantidad, medidas, archivos de referencia, nombre, teléfono o email, casilla de avisos por WhatsApp (desmarcada).
- **Estados**: `pendiente` → `en_revision` → `cotizado` → `aceptado` → `convertido`; también `rechazado` y `cancelado`. Cada cambio queda en `presupuesto_eventos` (quién, cuándo, nota).
- **Cotizar** (permiso `cotizar`): precio, observaciones y validez (no puede ser anterior a hoy).
- **El cliente** ve su presupuesto con link firmado (`/presupuesto/<id>?t=…`) y responde "Aceptar por $X" / "No me interesa" (si no venció).
- **Pasar a pedido**: crea el pedido con el precio cotizado (una sola vez; si falla, vuelve a aceptado). Necesita el módulo Pedidos.
- **Panel → Presupuestos**: bandeja Abiertos/Cerrados, detalle con adjuntos, "próximo paso", escribir por WhatsApp, copiar link.
- Aviso en el menú del panel: "N presupuestos esperan una respuesta".

---

## 11. Turnos (reservas y agenda)

Módulo `reservas`.

- **Sacar turno** (`/negocio/<slug>/reservar`): 1) servicio, 2) día (hasta `dias_max`), 3) horario libre, 4) datos (nombre, teléfono o email, notas, casilla de avisos desmarcada).
- **Horarios libres**: salen de los horarios del negocio, la duración del servicio, los turnos activos y los días sin atención; respetan la anticipación.
- **Sin superposición garantizada por la base**: `EXCLUDE USING gist` con `btree_gist` sobre turnos `pendiente`/`confirmada`. Dos clientes al mismo horario: el segundo recibe 409. Probado en producción.
- **Estados**: `pendiente`, `confirmada`, `cancelada`, `completada`, `ausente`. Historial en `reserva_eventos`.
- **Opciones de la agenda** (`configuracion.agenda`): `paso_min` (30), `anticipacion_min` (60), `dias_max` (30), `confirmacion` (`manual` o `automatica`).
- **Límite**: máximo 3 turnos activos por teléfono o email (429).
- **El cliente** con su link (`/reserva/<id>?t=…`) ve el turno, lo cancela (con anticipación) o lo cambia de horario.
- **Panel → Turnos**: agenda por día, alta manual (queda confirmada), confirmar, completar, marcar ausente, cancelar, **reagendar** (`/reservas/:id/reagendar`), días sin atención (`agenda_bloqueos`) y opciones.
- Aviso en el menú: turnos por confirmar.

---

## 12. Clientes

Módulo `clientes`, permiso `clientes` (solo Admin). **No hay tabla propia**: `GET /api/clientes` arma la lista con pedidos, presupuestos y turnos del negocio.

- Un cliente = mismo teléfono (últimos 10 dígitos, mínimo 8) o, sin teléfono, mismo email. Los pedidos sin teléfono (mesa, mostrador) no cuentan.
- Muestra nombre, teléfono, email, cantidad de pedidos y total gastado (sin cancelados), presupuestos, turnos y último contacto; buscador; "Escribir por WhatsApp".
- Lee hasta 2000 registros por fuente y avisa si se cortó. Respuesta sin caché (datos personales).

---

## 13. QR general y QR de mesa

- **QR general**: `https://dinexflow.com.ar/menu/<slug>` (gastronomía) o `/negocio/<slug>` (otros rubros). Nunca ofrece "en mesa".
- **QR de mesa**: `…/menu/<slug>?mesa=N&t=<firma>`, siempre por `/menu`. Firma HMAC-SHA256 de `mesa:<negocio>:<versión>:<mesa>` con `MESA_QR_SECRET` (22 caracteres).
- **Regenerar QR de mesas** sube `configuracion.mesas_qr_version` y anula todos los QR de mesa impresos de ese local.
- **QR del menú general**: `…/menu/<slug del primer negocio>/todos`.
- Los QR viejos por id (`/menu?negocio=<id>`) siguen funcionando.

---

## 14. Delivery con mapa y ticket

Links firmados (`utils/linksPedido.js`, HMAC por tipo): `ticket`, `seguimiento`, `reparto`, `presupuesto`, `reserva`. El link de uno no sirve para otro.

- **Repartidor** (`/reparto/<id>`): dirección con "Cómo llegar", llamar o escribir al cliente, ítems, envío y **cuánto cobrar en efectivo** (con vuelto, o "No cobres nada" si ya está pago); "Salí con el pedido" (estado `en_camino` y GPS cada ~8 s) y "Entregué" (doble toque).
- **Cliente** (`/seguimiento/<id>`): mapa Leaflet + OpenStreetMap, actualiza cada 10 s; al entregar, "Ver mi ticket".
- **Ticket** (`/ticket/<id>`): solo si está entregado; muestra envío y medio de pago; nunca muestra teléfono, dirección ni costos.
- Solo planes con WhatsApp; rate limit 200 cada 5 min; cambios de estado atómicos.

---

## 15. WhatsApp: avisos, chats, IA y número propio

Planes **Estándar** y **Premium** (y la prueba gratis). WhatsApp Cloud API oficial de Meta.

**Número de la plataforma** (desde el 17/11): número real de DinexFlow **+54 9 381 467-1285**, en la cuenta de WhatsApp Business "DinexFlow" (WABA `1176069968696889`, phone_number_id `1497889036737098`), con token permanente del usuario del sistema `dinexflow-bot` y tarjeta asignada. Las 11 plantillas se crean con `node scripts/crearPlantillasPlataforma.js` (lee `WHATSAPP_TOKEN` y `WHATSAPP_WABA_ID`; las que ya existen se saltean). Por ese número salen los avisos de los locales que no conectaron el suyo.

### 15.1 Avisos (plantillas de Meta, categoría Utilidad, idioma `es_AR`)

Se mandan solo si: el cliente **marcó la casilla** y dejó teléfono, el negocio puede enviar, el plan lo incluye y el aviso está **prendido** en Panel → WhatsApp. Se registran en `whatsapp_mensajes` y en el chat del cliente; el webhook actualiza enviado → entregado → leído / fallido.

**De pedido** (módulo `pedidos`; prendidos por defecto al activar los avisos):

| Clave | Plantilla | Cuándo |
|---|---|---|
| `pendiente` | `pedido_recibido` | Al confirmar el pedido |
| `preparando` | `pedido_en_preparacion` | Al tocar "Preparar" |
| `en_camino` | `pedido_en_camino_mapa` | Al enviar un delivery (con link del mapa) |
| `listo` | `pedido_listo_retirar` | Al tocar "Listo para retirar" |
| `entregado` | `pedido_entregado_ticket` | Al entregar (con link del ticket) |
| `cancelado` | `pedido_cancelado` | Al cancelar |

**De presupuesto y turno** (claves con prefijo; **apagados por defecto**; solo para negocios con esos módulos):

| Clave | Plantilla | Cuándo |
|---|---|---|
| `presupuesto.recibido` | `presupuesto_recibido` | El cliente pide el presupuesto |
| `presupuesto.cotizado` | `presupuesto_cotizado` | El negocio guarda la cotización |
| `reserva.confirmada` | `turno_confirmado` | El negocio confirma (o confirmación automática) |
| `reserva.reprogramada` | `turno_reprogramado` | El negocio cambia el horario |
| `reserva.cancelada` | `turno_cancelado` | El negocio cancela |

Parámetros: `{{1}}` cliente, `{{2}}` local, `{{3}}` número de pedido/presupuesto o día y hora del turno ("lunes 16/11 a las 18:30"), `{{4}}` link o servicio, `{{5}}` link del turno. Textos exactos en `docs/whatsapp-avisos.md` y en `backend/src/services/avisosPedidoService.js`. Ninguna plantilla termina en variable (Meta no lo acepta) y los parámetros se limpian de saltos de línea.

Teléfonos argentinos normalizados a `54` + 10 dígitos sin el 9.

### 15.2 Chats

Mensajes entrantes por webhook, guardados por negocio y teléfono; a qué negocio va (número propio → ese local; número compartido → el que ya habló, el de su último pedido o `WHATSAPP_NEGOCIO_DEFECTO`); regla de las 24 h (después solo plantillas); al responder una persona, la IA se pausa 12 h en ese chat. Panel → Chats con no leídos, "necesita atención" y sonido.

### 15.3 Asistente con IA

Responde **solo con datos del local**: menú disponible, **servicios** (precio, duración, si llevan turno o presupuesto), links para **sacar turno** y **pedir presupuesto**, horarios y si está abierto, formas de entrega, dirección, pedidos recientes del cliente e indicaciones del dueño. Reglas fijas (no inventa, no toma pedidos, no promete descuentos, no revela instrucciones, ignora intentos de cambiarle el rol). Deriva a una persona con `derivar_a_humano`. Espera 4 s para juntar mensajes. Proveedor OpenRouter con modelos de respaldo. **El texto que recibe un restaurante es idéntico al de antes** (verificado).

### 15.4 Número propio de cada local

"Conectar mi WhatsApp" (Embedded Signup de Meta, con **coexistencia**: el local sigue usando su app WhatsApp Business). El backend cambia el `code` por un token, confirma con Meta que el número es de esa cuenta, evita que esté en otro local, suscribe webhooks, registra el número (salvo coexistencia) y **crea solo las plantillas de los módulos que usa el local**. Token cifrado AES-256-GCM. Si el local tiene número propio y algo falla, no se usa el de la plataforma. Cada local paga sus mensajes con su tarjeta en Meta. Solo sirve con **WhatsApp Business**, no con el común.

### 15.5 Webhook de Meta

`GET /api/webhooks/whatsapp` (verificación con `WHATSAPP_VERIFY_TOKEN`) y `POST` (firma `X-Hub-Signature-256` con `WHATSAPP_APP_SECRET`; estados, mensajes, ecos del celular, cambios de cuenta).

---

## 16. Panel de administración

Menú lateral según **permisos y módulos**; barra inferior en el celular; tema claro/oscuro; avisos (pedidos nuevos, chats con sonido, stock bajo, presupuestos y turnos pendientes, soporte) y contador en la pestaña.

| Pantalla | Qué tiene |
|---|---|
| **Dashboard** | Saludo, "Ver menú" / **"Ver mi página"** (no gastronomía), compartir QR, nuevo producto; tarjeta del local con su link; métricas de ventas (**solo si toma pedidos**): hoy, período 7/30/90 días, ventas por día, cómo te piden, horas pico, más rentables, últimos pedidos, stock bajo, historial de ganancias con CSV; **Tu agenda** (presupuestos por responder, turnos por confirmar); **Presupuestos y turnos** de 30 días (recibidos, aceptados con %, monto aceptado, turnos atendidos, % que no vino, servicios más reservados); aviso de onboarding pendiente |
| **Pedidos** | En curso / Historial, filtros, estados, ticket, repartidor, personalización y "Ver archivo"; envío; pago (efectivo con vuelto, transferencia "Transfirió: X", "Ver comprobante", "Llegó la plata" / "No llegó") |
| **Presupuestos** | Bandeja y cotización |
| **Turnos** | Agenda, alta manual, reagendar, días sin atención, opciones |
| **Chats** | Conversaciones de WhatsApp e IA por chat |
| **Productos** | Tabla/tarjetas, filtros, stock; modal con Datos, Precio y venta, Imagen, Stock, Detalles, **Opciones** (variantes) y **Personalización** (campos) |
| **Categorías** | Lista y modal |
| **Servicios** | Alta y edición de servicios |
| **Clientes** | Lista con búsqueda y WhatsApp |
| **Código QR** | General o por mesa, menú general, regenerar QR de mesas |
| **WhatsApp** | Número propio, avisos (según módulos, con vista previa), mensaje de prueba, últimos mensajes, asistente IA |
| **Configuración** | Datos, ciudad y provincia, **rubro** (categoría + especialidad), **módulos**, imágenes, color, **opciones de servicio** (mesas, retiro, delivery, mostrador, envío, retiro programado, entrega programada), **Envío** (costo del delivery, envío gratis, cómo se cobra; solo el dueño), **Pagos** (efectivo, transferencia, datos de la cuenta, comprobante; solo el dueño), horarios |
| **Usuarios** | Equipo por roles, permisos con nombre, **Actividad reciente** (registro de cambios) |
| **Negocios** | Negocios de la cuenta con su link (por rubro) |
| **Suscripción** | Plan, estado, Mercado Pago |
| **Soporte** | Reportes a Tech |
| **Plataforma** | Solo Tech |
| **Onboarding** | 8 pasos |

---

## 17. Cuentas, roles y permisos

Jerarquía: **cuenta → negocios → datos**. Los usuarios pertenecen a una cuenta.

| Visible | Clave | Permisos |
|---|---|---|
| **Tech** | `es_plataforma = true` | Todo en todas las cuentas; Plataforma; bandeja de Soporte |
| **SuperAdmin** (dueño) | `admin` | `*` |
| **Admin** (segundo jefe) | `manager` | categorias, productos, pedidos, stock, qr, configuracion, negocios, usuarios, analiticas, **servicios, presupuestos, reservas, cotizar, clientes** |
| **Staff** | `staff` | productos, categorias, pedidos, stock, **servicios, presupuestos, reservas** (ve y cambia estados, **no cotiza**, **no ve Clientes**) |

Jerarquía: el dueño gestiona Admin y Staff; el Admin solo Staff; nadie crea otro dueño ni cambia su propio rol.

Plata del local: **solo el dueño** cambia Envío y Pagos (datos de la cuenta bancaria). **Dueño y Admin** confirman si llegó una transferencia; **Staff no**.

Cadena en cada ruta del panel: `authMiddleware` (JWT 24 h) → `scopeNegocio` (`X-Negocio-Id` de la propia cuenta) → `checkSuscripcion` → `requiereModulo` → `checkPermiso`. En el panel, `ProtectedRoute` por permiso y por módulo.

---

## 18. Planes, prueba gratis y cobro

| Plan | Precio mensual | Negocios | Productos (cuenta) | WhatsApp, chats, IA y mapa |
|---|---|---|---|---|
| Free (interno) | $0 | 1 | 10 | No |
| **Básico** | $20.000 | 1 | 50 | No |
| **Estándar** | $41.000 | 3 | 180 | Sí |
| **Premium** | $65.000 | 5 | 1.000 | Sí |

- **Prueba gratis de 15 días** sin tarjeta, con todo lo del Estándar. Sin plan anual.
- Productos repartidos en partes iguales entre negocios (Estándar: 180 / 90 / 60). Los **servicios no cuentan** para el límite (decisión pendiente).
- **Todos los módulos nuevos están en todos los planes**; los avisos de WhatsApp de presupuestos y turnos, solo Estándar y Premium.
- Estados: `trial`, `activo`, `cancelado` (hasta fin del mes pagado), `vencido` (402 `SUSCRIPCION_VENCIDA`).
- **Mercado Pago**: preapproval mensual, `external_reference = cuenta:<id>:plan:<code>`, webhook con firma `x-signature`, nunca confía en el cuerpo, verifica el monto, cancela la suscripción anterior al cambiar de plan.
- Fuentes únicas: precios en `backend/src/utils/planPrecios.js`, límites en `LIMITES_POR_PLAN` (`backend/src/utils/suscripcion.js`).

---

## 19. Registro de cambios (auditoría)

Tabla `registro_cambios`. Se escribe **en segundo plano** (nunca frena ni rompe la acción).

Registra: cambios de **módulos**, usuarios (**alta**, **cambio de rol o de activo**, **cambio de contraseña** sin guardar la clave, **baja**), **productos borrados** y cada vez que **Soporte entra con "Ver como el cliente"** (con `tech_id`). Presupuestos y turnos tienen su propio historial de eventos.

Se ve en **Usuarios → Actividad reciente** ("Ana borró el producto «Shampoo»", "Soporte DinexFlow entró a ver tu cuenta en modo solo lectura"). Cada cuenta ve solo lo suyo. `GET /api/usuarios/registro` (permiso `usuarios`, últimos 100).

---

## 20. Analíticas

`/api/analiticas` (módulo `estadisticas`, permiso `analiticas`), hora de Argentina:

| Endpoint | Qué devuelve |
|---|---|
| `GET /resumen` | 6 meses de ventas/costo/ganancia, top del mes, stock bajo |
| `GET /historial?desde&hasta&tipo` | Por mes, con productos más rentables |
| `GET /actividad?dias=7\|30\|90` | Serie diaria, período anterior, totales, ticket promedio, por tipo (los tipos nuevos solo si se usaron), estados, horas pico, hoy, últimos pedidos |
| `GET /agenda?dias=7\|30\|90` | Presupuestos (recibidos, sin responder, cotizados, aceptados, rechazados, % de aceptación, monto aceptado) y turnos del período (total, completados, ausentes, cancelados, % de ausencia, servicios más reservados) |

Ventas = pedidos **entregados** el día de entrega. Ganancia = ventas − costos.

---

## 21. Soporte, Plataforma y "Ver como el cliente"

- **Soporte**: todos los usuarios, sin chequeo de suscripción. Reportes (Error, Pago, Duda, Sugerencia) con captura; estados Abierto / En curso / Resuelto; email a `SOPORTE_EMAIL`; límites de 10 reportes por hora.
- **Plataforma** (solo Tech): resumen de cuentas, planes, estados, MRR; lista de cuentas con uso.
- **Ver como el cliente**: Tech entra a una cuenta como su dueño en **solo lectura** 30 min (JWT con `solo_lectura` y `tech_id`; todo lo que no sea GET da 403 `SOLO_LECTURA`). Ahora **queda en el registro de cambios** de la cuenta.

---

## 22. Autenticación, 2FA y emails

- JWT de 24 h, bcrypt, rate limit 10 intentos cada 15 min.
- **Registro** (cuenta en trial + negocio con slug + configuración + dueño) y **Google** (ID token verificado). Cuenta nueva → onboarding.
- **Recuperar contraseña** sin revelar si el usuario existe; token de un uso, 1 h, al email propio.
- **2FA** TOTP opcional con QR y 8 códigos de respaldo; secreto cifrado AES-256-GCM.
- **Mi cuenta**: perfil, email, contraseña, seguridad.
- **Emails** (Resend, `no-reply@dinexflow.com.ar`): recuperar contraseña, bienvenida, reporte de soporte.

---

## 23. Base de datos

### Tablas de siempre

`cuentas`, `usuarios`, `roles_permisos`, `password_reset_tokens`, `negocios`, `configuracion`, `categorias`, `productos`, `variantes_grupo`, `variantes_opcion`, `pedidos`, `pedido_items`, `whatsapp_avisos`, `whatsapp_mensajes`, `whatsapp_chats`, `whatsapp_ia`, `whatsapp_cuentas`, `soporte_tickets`, `soporte_mensajes`.

### Tablas nuevas (multirrubro)

| Tabla | Para qué | Campos clave |
|---|---|---|
| `rubros_categorias` | 11 categorías | `codigo` (slug), `nombre`, `descripcion`, `familia`, `icono`, `orden`, `sugerencias` |
| `rubros_especialidades` | 78 especialidades | `codigo` (slug), `categoria`, `nombre`, `orden`, `activo` |
| `producto_campos` | Campos de personalización | `producto_id`, `negocio_id`, `tipo`, `etiqueta`, `ayuda`, `opciones`, `obligatorio`, `orden`, `validaciones` |
| `adjuntos` | Archivos de clientes | `negocio_id`, `token`, `public_id`, `resource_type`, `formato`, `tipo`, `nombre`, `bytes`, `contexto`, `ref_id`, `usado` |
| `servicios` | Servicios | `nombre`, `descripcion`, `imagen_url`, `categoria`, `tipo_precio`, `precio`, `duracion_min`, `modalidades`, `requiere_turno`, `requiere_presupuesto`, `activo`, `orden` |
| `presupuestos` | Cotizaciones | `producto_id`, `servicio_id`, `referencia`, `cliente_nombre`, `telefono`, `email`, `acepta_whatsapp`, `descripcion`, `cantidad`, `medidas`, `estado`, `precio_cotizado`, `observaciones`, `valido_hasta`, `pedido_id` |
| `presupuesto_eventos` | Historial | `estado`, `autor`, `usuario_id`, `nota` |
| `reservas` | Turnos | `servicio_id`, `servicio_nombre`, `cliente_nombre`, `telefono`, `email`, `acepta_whatsapp`, `notas`, `inicio`, `fin`, `estado`, `origen` (+ EXCLUDE sin superposición) |
| `reserva_eventos` | Historial | `estado`, `autor`, `usuario_id`, `inicio_anterior`, `nota` |
| `agenda_bloqueos` | Días sin atención | `desde`, `hasta`, `motivo` |
| `registro_cambios` | Auditoría | `cuenta_id`, `negocio_id`, `usuario_id`, `tech_id`, `accion`, `entidad`, `entidad_id`, `detalle` |

### Columnas nuevas

- `negocios`: `rubro_categoria`, `rubro_especialidad`, `onboarding`, `modulos`.
- `configuracion`: `ciudad`, `provincia`, `agenda`, `modalidades`, **`envio`**, **`pagos`** (JSONB).
- `pedidos`: `programado_para`, **`costo_envio`** (≥ 0, default 0), **`envio_cobro`** (`pedido` | `efectivo`), **`metodo_pago`**, **`paga_con`** (> 0), **`estado_pago`**, **`transfirio`**, **`comprobante_id`** (→ `adjuntos`).
- `pedido_items`: `opciones`, `personalizacion` (foto histórica).
- `adjuntos`: **`uso`** (`personalizacion` por defecto, o `comprobante`).

**Función** `crear_pedido(p_pedido, p_items, p_stock, p_stock_opciones, p_adjuntos)`: pedido + ítems + stock + adjuntos en una transacción (recreada por `costo_envio.sql` y `medios_pago.sql` para guardar envío y pago). **No se borró ninguna tabla ni columna.**

---

## 24. Referencia de la API

### Públicas

| Método y ruta | Descripción |
|---|---|
| `GET /api/health` · `GET /api/keep-alive` | Estado |
| `GET /api/negocios/publico/:slug` · `…/:slug/grupo` | Resolver negocio / menú general |
| `GET /api/configuracion` | Configuración pública (módulos, modalidades, agenda, avisos) |
| `GET /api/categorias/activas` · `GET /api/productos/disponibles` · `GET /api/servicios/disponibles` | Catálogo |
| `GET /api/rubros` · `GET /api/modulos` | Catálogo de rubros y registro de módulos |
| `POST /api/pedidos` | Crear pedido |
| `POST /api/adjuntos` · `POST /api/adjuntos?uso=comprobante` | Subir archivo del cliente / comprobante de transferencia |
| `POST /api/presupuestos` · `GET /api/presupuestos/:id/publico` · `POST …/:id/responder` | Presupuesto del cliente |
| `GET /api/reservas/disponibilidad` · `POST /api/reservas` · `GET /api/reservas/:id/publico` · `POST …/:id/cancelar` · `POST …/:id/reprogramar` | Turno del cliente |
| `GET /api/tickets/:id` · `/api/reparto/:id` (+ salir, ubicacion, entregar) · `GET /api/seguimiento/:id` | Links firmados |
| `POST /api/webhooks/mercadopago` · `GET/POST /api/webhooks/whatsapp` | Webhooks |

### Autenticación (`/api/auth`)

`POST /login`, `/signup`, `/google`, `/forgot-password`, `/reset-password`, `/register`, `GET /verify`, `POST /change-password`, `PUT /profile`, `PUT /email`, `POST /2fa/verificar`, `/2fa/iniciar`, `/2fa/activar`, `/2fa/desactivar`.

### Panel

| Prefijo | Rutas |
|---|---|
| `/api/upload` | `POST /`, `DELETE /` (solo imágenes del propio negocio) |
| `/api/categorias` | CRUD |
| `/api/productos` | CRUD, `GET /stock-bajo`, `GET/PUT /:id/campos` (personalización) |
| `/api/variantes` | Grupos y opciones |
| `/api/servicios` | CRUD (módulo y permiso `servicios`) |
| `/api/presupuestos` | `GET /`, `GET /resumen`, `GET /:id`, `PATCH /:id/estado`, `POST /:id/cotizacion` y `POST /:id/convertir` (permiso `cotizar`) |
| `/api/reservas` | `GET /`, `/horarios`, `/resumen`, `GET/POST /bloqueos`, `DELETE /bloqueos/:id`, `POST /manual`, `GET /:id`, `PATCH /:id/estado`, `POST /:id/reagendar` |
| `/api/clientes` | `GET /` |
| `/api/adjuntos/:id` | `GET` (URL firmada; permiso pedidos) |
| `/api/onboarding` | `GET`, `PUT` |
| `/api/configuracion` · `/api/panel/configuracion` | `PUT /` (incluye módulos, modalidades, agenda, rubro), **`PUT /envio`** y **`PUT /pagos`** (solo el dueño) / `GET` |
| `/api/pedidos` | `GET /`, `GET /:id`, `GET /:id/link-reparto`, `PUT /:id/estado`, **`PUT /:id/pago`** (dueño y Admin), `DELETE /:id` |
| `/api/analiticas` | `/resumen`, `/historial`, `/actividad`, `/agenda` |
| `/api/usuarios` | CRUD, `/roles`, `/:id/password`, **`/registro`** |
| `/api/negocios` · `/api/plan` · `/api/suscripcion` · `/api/qr` | Negocios, plan, suscripción, QR |
| `/api/whatsapp` · `/api/whatsapp/chats` | Avisos, mensajes, prueba, IA, cuenta propia, plantillas; chats |
| `/api/soporte` · `/api/plataforma` | Soporte; Tech |

### Códigos de error

| Código | HTTP | Cuándo |
|---|---|---|
| `SUSCRIPCION_VENCIDA` | 402 | Prueba o suscripción vencida |
| `SUSCRIPCION_CANCELADA` | 403 | Crear negocio/producto con la suscripción cancelada |
| `LIMITE_NEGOCIOS_ALCANZADO` · `LIMITE_PRODUCTOS_ALCANZADO` | 403 | Límites del plan |
| `PLAN_SIN_WHATSAPP` | 403 | Función de Estándar/Premium en Básico |
| `SOLO_LECTURA` | 403 | Cambio en "Ver como el cliente" |
| `MODULO_INACTIVO` | 403 | El negocio no tiene el módulo |
| `ADJUNTO_NO_DISPONIBLE` | 400 | Archivo ya usado, vencido o de otro negocio |
| (sin código) | 409 | Turno superpuesto, cambio concurrente |

---

## 25. Seguridad

- **Aislamiento**: `scopeNegocio` + filtro por `negocio_id`/`cuenta_id` en cada consulta; tablas nuevas con `negocio_id NOT NULL`; pruebas de "otro negocio no lo ve".
- **Precios recalculados en el servidor**; productos ajenos o pausados rechazados; variantes y personalización validadas.
- **Costos privados**.
- **Envío y pago calculados en el servidor**: el costo del envío sale de la configuración actual (nunca del cliente) y el efectivo tiene que alcanzar para el total. Los datos bancarios del local solo se envían al menú si la transferencia está prendida; los comprobantes son privados y se ven con link firmado. Solo el dueño cambia envío y pagos.
- **Firmas HMAC** (comparación en tiempo constante): QR de mesa, links (ticket, seguimiento, reparto, presupuesto, reserva), webhooks.
- **Cifrado AES-256-GCM**: 2FA y tokens de WhatsApp.
- **Archivos**: validados por contenido, privados, URL firmada; imágenes por carpeta de negocio (`menu-digital/negocios/<id>`) y el borrado solo de las propias.
- **Rate limits**: auth, pedidos, presupuestos y turnos, adjuntos, reparto, soporte.
- **Consentimiento explícito** para WhatsApp (casillas desmarcadas).
- **Validación zod**, helmet, CORS por lista, CSP y cabeceras (`render.yaml`), solo lectura para soporte, auditoría de acciones.

---

## 26. Variables de entorno

### Backend (Render)

| Variable | Uso |
|---|---|
| `PORT`, `NODE_ENV` | Servidor |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base |
| `JWT_SECRET` | Sesiones (y base de claves derivadas) |
| `ALLOWED_ORIGINS`, `ADMIN_URL`, `VITE_MENU_URL` | CORS y links |
| `MESA_QR_SECRET` | QR de mesa (no rotar) |
| `TOTP_KEY` | 2FA (opcional) |
| `FREE_TRIAL_DAYS`, `TRIAL_PLAN` | Prueba gratis |
| `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Mercado Pago |
| `GOOGLE_CLIENT_ID` | Google |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Imágenes y archivos |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SOPORTE_EMAIL` | Emails |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_DEFAULT_CC`, `WHATSAPP_TEMPLATE_IDIOMA` | Número de la plataforma |
| `WHATSAPP_WABA_ID` | Cuenta de WhatsApp de la plataforma (solo para el script de plantillas, en el `.env` local) |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_NEGOCIO_DEFECTO` | Webhook y chats |
| `META_APP_ID`, `WHATSAPP_ES_CONFIG_ID`, `META_SDK_VERSION`, `WHATSAPP_CUENTAS_KEY` | Número propio por local |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `IA_ESPERA_MS`, `IA_PAUSA_HORAS`, `NEGOCIO_TZ` | IA |
| `KEEP_ALIVE_CRON`, `SELF_URL`, `RENDER_EXTERNAL_URL` | Keep-alive |

### Frontends

`VITE_API_URL` (ambos), `VITE_ADMIN_URL` (público), `VITE_MENU_URL` y `VITE_GOOGLE_CLIENT_ID` (panel).

---

## 27. Migraciones SQL

En `backend/db/`, todas idempotentes. Las de la evolución multirrubro, **ya corridas en producción**, en este orden:

1. `venta_por_peso.sql`
2. `rubros_onboarding.sql`
3. `modulos.sql`
4. `catalogo_universal.sql`
5. `presupuestos_reservas.sql`
6. `modalidades.sql`
7. `clientes.sql`
8. `registro_cambios.sql`
9. `whatsapp_cuentas.sql`
10. `costo_envio.sql` (después de `modalidades.sql`; recrea `crear_pedido`) — la base ya tiene `configuracion.envio`
11. **`medios_pago.sql`** (después de `costo_envio.sql`; recrea `crear_pedido`) — ⚠️ **pendiente de correr en Supabase**. Si se carga `configuracion.pagos` sin haber recreado la función, el pedido da error en vez de quedar sin medio de pago.

Anteriores: `schema.sql`, `rpc.sql`, `multitenant_stock.sql`, `roles*.sql`, `rol_plataforma.sql`, `suscripciones.sql`, `facturacion_ciclo.sql`, `hotmart_usuarios.sql`, `lemonsqueezy.sql`, `mercadopago.sql`, `planes_2026_11.sql`, `config_pedidos.sql`, `personalizacion.sql`, `moneda_negocio.sql`, `menu_porter.sql`, `multirubro.sql`, `pedido_entregado_at.sql`, `mesas_qr.sql`, `seguimiento_delivery.sql`, `whatsapp_avisos.sql`, `dos_factores.sql`, `soporte.sql`, `cuentas_prueba.sql`.

---

## 28. Despliegue, ramas y commits

- **Render** (`render.yaml`) publica al subir a `main`. Keep-alive cada 14 min + GitHub Actions diario. Tarea cada hora para limpiar archivos de clientes sin usar.
- **`main` en GitHub: `a8de7ce`** (17/11/2026). Publicado con merge rápido; commits a nombre de `facundolabtinos`.
- Para saber si Render ya publicó, mirar algo que solo produce el código nuevo (por ejemplo, el orden de claves normalizado de `envio`), no un campo nuevo de la base: el backend viejo lo devuelve igual.

| Commit | Contenido |
|---|---|
| `e7562c6` | Etapa 0 · Seguridad de pedidos y subida de imágenes |
| `f3f3c12` | Etapa 2 · Catálogo de rubros y onboarding de 8 pasos |
| `b16977a` | Etapa 3 · Módulos por negocio |
| `ab22ff3` | Etapa 4 · Personalización, servicios y pedido atómico |
| `7a2f966` | Etapa 5 · Presupuestos y turnos |
| `cf764c4` | Etapa 6 · Mostrador, envío y pedidos programados |
| `ea5b59a` | Etapa 7 · Página pública `/negocio/:slug` |
| `0942a26` | Etapa 8 · Clientes, agenda en el Dashboard, link por rubro |
| `aa70447` | Etapa 9a · Registro de cambios, analíticas de agenda, IA con servicios |
| `3ebddbc` | Número propio de WhatsApp (Embedded Signup) |
| `621ae76` | Etapa 9b · Avisos de WhatsApp de presupuestos y turnos |
| `c8d576f` | Etapa 10 · Verificación, "Sin stock" en talles, checklist |
| `20791e5` | Arreglo: no pedir resúmenes de módulos apagados (403) |
| `325817f` | Arreglo de tests con fecha fija (la hora sale de `Date.now()`; no cambia nada en producción) |
| `752fa35` | Landing multirrubro "Tu negocio es Dinex" |
| `9677138` | Script para crear las plantillas en la cuenta de WhatsApp de la plataforma |
| `b2c1ee2` | Costo del envío del delivery con envío gratis |
| `a8de7ce` | Medios de pago: efectivo con vuelto y transferencia con comprobante |

Detalle de despliegue: `docs/DESPLIEGUE_MULTIRUBRO.md`.

---

## 29. Pruebas

- **334 pruebas automáticas** del backend en 36 archivos (`npm test`, todas OK al 17/11): pedidos, **costo de envío**, **medios de pago y comprobante**, variantes, stock, personalización, adjuntos, módulos, rubros, onboarding, modalidades, presupuestos, turnos (superposición, límites, horarios), clientes, registro de cambios, analíticas, IA (restaurante sin cambios), avisos (consentimiento, módulos, Meta), WhatsApp propio, aislamiento, suscripción, límites, 2FA, Mercado Pago, QR, reparto, ticket, soporte, "Ver como el cliente".
- **Builds de producción** de los dos frontends y `tsc` limpios.
- **Prueba de los 5 casos en celular** (backend falso): restaurante con QR de mesa viejo, tienda con talles y envío, taza personalizada con foto, turno de peluquería, presupuesto cotizado y aceptado.
- **Prueba en producción** (15/11, Bar la Esquina): menú público y panel iguales a antes; subida real a Cloudinary con "Ver archivo" firmado; pedido con personalización; turno y bloqueo de superposición (409); presupuesto → cotizado → aceptado → pedido; Clientes, Actividad reciente y analíticas de agenda. Todo limpiado y los módulos restaurados.

---

## 30. Estado de WhatsApp en Meta

| Ítem | Estado |
|---|---|
| Verificación del negocio | ✅ Hecha |
| Webhooks de la app | ✅ Configurados |
| 5 plantillas de presupuesto/turno en la cuenta de prueba | ✅ Activas, calidad alta (vistas el 15/11) |
| 6 plantillas de pedido en la cuenta de prueba | Creadas antes; confirmar en "Administrar plantillas" que las 6 estén Activas (al 10/11 `pedido_en_camino_mapa` y `pedido_entregado_ticket` estaban en revisión) |
| Número de la plataforma | ✅ Número **real** de DinexFlow, +54 9 381 467-1285 (WABA `1176069968696889`), token permanente de `dinexflow-bot`, tarjeta asignada. Mensaje de prueba OK (17/11) |
| Plantillas en la cuenta real | ✅ Creadas con `scripts/crearPlantillasPlataforma.js`; `pedido_en_preparacion` seguía **en revisión** el 17/11 |
| Número propio de cada local | ⏳ Código listo. **Revisión de la app como Tech Provider enviada** (permisos `whatsapp_business_messaging`, `whatsapp_business_management`, `public_profile`; hasta 20 días). Al aprobarse: crear la configuración de Embedded Signup (variación WhatsApp, token de usuario del sistema que no vence) y cargar en Render `META_APP_ID=1133985485795933`, `WHATSAPP_ES_CONFIG_ID`, `WHATSAPP_APP_SECRET` y `WHATSAPP_CUENTAS_KEY` |

Errores de Meta ya vistos: #132001 = la plantilla no existe en esa cuenta; "Business eligibility payment issue" = la tarjeta no está asignada a la WABA. Sin acceso avanzado, Meta no muestra la variación "WhatsApp Embedded Signup" ni el activo "Cuentas de WhatsApp" al crear la configuración.

---

## 31. Pendientes, decisiones y límites conocidos

### Decisiones pendientes

| Tema | Hoy |
|---|---|
| H5: pedidos a negocios inactivos o con suscripción vencida | Se aceptan como antes. Además, `/api/configuracion` con un slug inexistente devuelve el negocio 1 (la página igual muestra "no encontrada") |
| Staff en presupuestos y turnos | Ve y cambia estados, no cotiza |
| Staff en Clientes | Sin acceso |
| ¿Los servicios cuentan para el límite del plan? | No |
| Apagar Pedidos oculta el historial de pedidos | Se oculta (vuelve al prenderlo) |

### Para activar en producción

- Correr **`backend/db/medios_pago.sql`** en Supabase (habilita efectivo y transferencia).
- Esperar la aprobación de Meta como Tech Provider y cargar las variables del número propio por local (§30).
- Confirmar que `pedido_en_preparacion` quedó aprobada en la cuenta real.

### No hecho todavía

- **Mercado Pago por negocio** (QR o link de pago de cada local, con Access Token cifrado u OAuth).
- Aviso por WhatsApp al cliente cuando el local confirma o rechaza la transferencia.
- Las analíticas cuentan como venta las transferencias todavía no confirmadas (cuentan pedidos entregados, sin mirar `estado_pago`).
- Riesgo bajo abierto: la personalización no filtra los adjuntos por `uso`, así que un token de comprobante podría usarse como archivo de personalización del mismo negocio (se dejó así para no romper la personalización antes de la migración).
- La política de privacidad todavía habla solo de gastronomía.
- Bar la Esquina muestra el teléfono de prueba viejo.
- Recordatorio automático del turno el día antes (necesita una tarea programada).
- El backend no rechaza vender una opción por encima de su stock (el menú ya no deja elegirla en 0).
- En servicios, el bloque de turnos podría ir antes del catálogo.

### Límites conocidos

- Agenda con capacidad 1 por negocio (sin profesionales ni recursos).
- Franjas que pasan la medianoche se cortan a las 24 h en los turnos (en pedidos programados sí se aceptan).
- Clientes lee hasta 2000 registros por fuente.
- Mejoras técnicas anteriores: webhook de Mercado Pago con suscripción inexistente responde 500; algunos middlewares devuelven `error.message`; "top por unidades" suma kg y unidades; el menú general usa la identidad del primer negocio; el repartidor deja de mandar ubicación si cierra la página.

---

## 32. Historial de hitos

| Fecha | Hito |
|---|---|
| 07/11/2026 | Landing con animaciones; panel rediseñado (claro/oscuro, Dashboard con gráficos) |
| 08/11/2026 | Precios en pesos y Mercado Pago; 2FA; menú de ejemplo; venta por peso; historial de pedidos; QR de mesa firmado |
| 09/11/2026 | WhatsApp con token permanente; ticket por link; delivery con mapa; todo en español y pesos; menú general; planes nuevos; Soporte; "Ver como el cliente"; dominio propio y emails |
| 10/11/2026 | Delivery con mapa probado en producción; verificación en Meta enviada; número propio por local |
| 14/11/2026 | Auditoría para pasar a SaaS multirrubro y plan de 10 etapas. Etapas 0 (seguridad), 2 (rubros y onboarding), 3 (módulos), 4 (catálogo universal), 5 (presupuestos y turnos), 6 (modalidades), 7 (página `/negocio/:slug`) y 8 (clientes y panel) |
| 15/11/2026 | Etapa 9 (registro de cambios, analíticas de agenda, IA con servicios, número propio commiteado, avisos de presupuesto y turno) y Etapa 10 (verificación y checklist). **Migraciones corridas y publicado en producción.** Prueba en producción completa; arreglo de pedidos de más con módulos apagados |
| 15–17/11/2026 | WhatsApp en Meta: negocio verificado, plantillas de presupuesto y turno aprobadas |
| 17/11/2026 | Landing multirrubro "Tu negocio es Dinex"; número real de WhatsApp de DinexFlow con sus plantillas; revisión de Tech Provider enviada; **costo del envío** con envío gratis; **medios de pago**: efectivo con vuelto y transferencia con comprobante (falta su migración en Supabase) |
