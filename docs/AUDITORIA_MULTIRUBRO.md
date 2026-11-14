# DinexFlow multirrubro — Auditoría técnica y propuesta

> 14/11/2026 · Etapa 1 (auditoría). **No se modificó código.** Todo lo de abajo sale de leer el código real (`backend/src`, `backend/db`, `frontend`, `frontend-admin`) y de correr las pruebas actuales: **202 pasan, 0 fallan**.

---

## 1. Diagnóstico del proyecto actual

**Estado general: sano y listo para evolucionar.** La base multiempresa (`cuentas → negocios → datos`), el aislamiento (`scopeNegocio`), los permisos (`checkPermiso` + `roles_permisos`), los planes (`LIMITES_POR_PLAN`), los links firmados y WhatsApp están bien resueltos y tienen pruebas. El sistema ya dio un primer paso multirrubro (`db/multirubro.sql`: `tipo_rubro`, `config_campos`, `sku`, `atributos`, variantes).

**Lo que hoy lo ata a la gastronomía:**

| Dónde | Qué pasa |
|---|---|
| Rubros | 4 valores fijos (`gastronomia`, `retail`, `servicios`, `generico`) **repetidos en 6 lugares**: CHECK en la base, `configuracionController.js:9`, `negociosController.js:8`, `Onboarding.tsx:18`, `Negocios.tsx:22`, `ConfiguracionEditor.tsx:52` y `frontend/src/lib/menuUi.tsx:147`. |
| Módulos | No existen. El panel muestra el mismo menú a todos (`AdminLayout.tsx:150`, filtrado solo por permiso). `config_campos` existe en la base pero **nadie lo usa**. |
| Venta | El único flujo comercial es *carrito → pedido*. No hay servicios, presupuestos, reservas ni clientes como entidad. |
| Entrega | Tres booleanos en `configuracion` (`mesas_activo`, `retiro_activo`, `delivery_activo`). `pedidos.tipo_entrega` es `VARCHAR(20)` **sin CHECK** (ampliarlo es fácil). |
| Vocabulario | "Menú", "carta", "Mi Restaurante" (default de `configuracion`), "Estamos preparando el menú 🍽️", plantillas de WhatsApp de pedido, prompt de la IA ("menú disponible hoy"). |
| Onboarding | 2 pasos (rubro + datos). El progreso no se guarda: se entra solo si la respuesta de registro trae `nuevo: true`. |
| Público | `/menu/:slug`. Un solo componente de 1.084 líneas (`Menu.tsx`). |

### Hallazgos que conviene corregir antes de construir encima

Son de la base actual, no de lo nuevo. Los marco porque los módulos nuevos se apoyan en ellos.

| # | Severidad | Hallazgo | Dónde |
|---|---|---|---|
| H1 | **Alta** | Si un ítem trae un `producto_id` que no existe en ese negocio (o no trae id), el pedido **usa el precio y el nombre que manda el cliente** (`prod ? prod.precio : i.precio`). Tampoco se revisa `disponible`. Contradice la regla "nunca confiar en precios del cliente". | `pedidosController.js:123` y `:133` |
| H2 | **Alta** | `DELETE /api/upload` borra **cualquier** `public_id` de Cloudinary, aunque sea de otro negocio (los `public_id` se ven en las URLs públicas). La subida tampoco pasa por `scopeNegocio` y valida solo el `mimetype` que declara el navegador. | `routes/upload.js:57`, `server.js:149` |
| H3 | Media | Variantes: el backend solo verifica que la opción sea del negocio. **No** verifica que sea del mismo producto, que esté `activo`, que se cumplan los grupos obligatorios ni que un grupo `single` tenga una sola opción. Esa validación hoy vive solo en `ProductModal.tsx`. El stock por opción no se descuenta. | `pedidosController.js:106-129` |
| H4 | Media | Pedido + ítems + stock no son atómicos: si falla el insert de ítems queda un pedido sin ítems; el stock se lee y se escribe (dos pedidos simultáneos pueden vender la misma última unidad). | `pedidosController.js:160-201` |
| H5 | Media | Rutas públicas: sin `?negocio=` caen al **negocio 1**; aceptan pedidos de negocios inactivos o con la suscripción vencida (lo segundo puede ser a propósito: confirmarlo). | `utils/negocio.js:15` |
| H6 | Baja | `pedido_items.nombre` es `VARCHAR(150)` pero el código recorta a 250: un producto con nombre largo + opciones da 500. Confirmar en Supabase si la columna se amplió a mano. | `config_pedidos.sql:77`, `pedidosController.js:141` |
| H7 | Baja | Las tablas viejas tienen `negocio_id DEFAULT 1`. Las tablas nuevas **no** deben llevar default. | `multitenant_stock.sql:29-32` |
| H8 | Proceso | No hay pruebas de `createPedido`, productos ni variantes. Antes de tocar pedidos hay que escribir pruebas que fijen el comportamiento actual. | `backend/tests/` |
| H9 | Proceso | En el árbol hay trabajo **sin commitear** (número propio de WhatsApp: 11 archivos modificados + 4 nuevos). Conviene cerrarlo en su propia rama antes de empezar. | `git status` |

---

## 2. Qué se reutiliza tal cual

- Multiempresa, `authMiddleware`, `scopeNegocio`, `checkPermiso`, `checkSuscripcion`, `requiereWhatsapp`, `noSoloLectura`, "Ver como el cliente".
- `validate(schema)` + Zod, `respondError`, `rateLimiters.js` (se agregan limitadores nuevos con el mismo patrón).
- `utils/linksPedido.js` (HMAC por tipo): sirve igual para links de presupuesto y de reserva del cliente.
- `productos`, `categorias`, `variantes_grupo`, `variantes_opcion`, `VariantesEditor.tsx`, `ProductModal.tsx`, carrito, venta por peso, QR firmado, ticket, reparto, seguimiento.
- Cloudinary (`config/cloudinary.js`), el patrón de validación de URLs propias de `soporteController`.
- WhatsApp: envío, cuentas propias, chats, IA, webhook, `whatsapp_avisos`.
- Panel: `AdminLayout` (lista `ItemNav`), `ProtectedRoute`, `SeccionesUi`, `InfoTip`, `NegocioContext`.
- `horarios_config` (por día con franjas) como punto de partida para la agenda.

## 3. Qué hay que ampliar

| Pieza | Ampliación |
|---|---|
| `negocios` | Categoría y especialidad de rubro, módulos activos, estado del onboarding. |
| `configuracion` | Modalidades nuevas (mostrador, retiro programado, envío externo, entrega programada, atención a domicilio/virtual, visitas). Los 3 booleanos actuales **se conservan** como fuente de verdad de mesa/retiro/delivery. |
| `productos` | `tipo_producto` (normal / configurable / personalizado), `requiere_presupuesto`, `compra_directa`. |
| `categorias` | `ambito` (productos / servicios) para no mezclar. |
| `pedidos` | `origen` (menú / presupuesto), `presupuesto_id`, nuevos `tipo_entrega` (`mostrador`, `envio`), fecha programada. |
| `pedido_items` | `opciones` y `personalizacion` como **foto histórica** en JSONB (hoy las opciones solo quedan pegadas en el nombre). |
| `createPedido` | Corregir H1, H3, H4; validar campos de personalización; mover pedido + ítems + stock a una función SQL (RPC) atómica. |
| `roles_permisos` | Permisos `servicios`, `presupuestos`, `reservas`, `clientes`. |
| `AdminLayout` / `App.tsx` | Cada ítem de navegación declara además qué **módulo** necesita. |
| `whatsapp_avisos.estados` | Pasar de "estados de pedido" a claves con prefijo (`pedido.*`, `presupuesto.*`, `reserva.*`) sin romper las actuales. |
| `iaService` | Contexto según módulos: servicios, precios "desde", link de reserva o presupuesto (sin tomar reservas por chat en esta versión). |
| Textos | Vocabulario por rubro (catálogo, menú, tienda, servicios) en lugar de "menú" fijo. |

## 4. Módulos nuevos

1. **Rubros** (catálogo central de categorías y especialidades).
2. **Configuración modular** (módulos + modalidades por negocio).
3. **Personalización de productos** (campos configurables + adjuntos).
4. **Servicios**.
5. **Presupuestos**.
6. **Reservas** (agenda, disponibilidad, bloqueos).
7. **Adjuntos** (subidas públicas seguras, compartido por personalización y presupuestos).
8. **Clientes** (hoy no existe como entidad: se arma de pedidos y chats). Propongo una **vista** derivada en la primera versión y una tabla solo si después hace falta.
9. **Registro de cambios** (auditoría de acciones importantes; también resuelve el pendiente de "Ver como el cliente").

---

## 5. Tablas que cambian (todo aditivo, `ADD COLUMN IF NOT EXISTS`)

```sql
-- negocios
rubro_categoria     VARCHAR(40)  REFERENCES rubros_categorias(codigo)   -- NULL = sin migrar
rubro_especialidad  VARCHAR(60)  REFERENCES rubros_especialidades(codigo)
modulos             JSONB        -- {"catalogo":true,"pedidos":true,"carrito":true,...}
onboarding          JSONB        -- {"paso":3,"completado":false,"publicado_at":null}
-- tipo_rubro se CONSERVA: pasa a ser la "familia" visual (íconos del menú) y se deriva de la categoría.

-- configuracion
modalidades         JSONB        -- solo las NUEVAS; mesa/retiro/delivery siguen en sus columnas

-- productos
tipo_producto        VARCHAR(20) NOT NULL DEFAULT 'normal'   -- normal | configurable | personalizado
compra_directa       BOOLEAN     NOT NULL DEFAULT true
requiere_presupuesto BOOLEAN     NOT NULL DEFAULT false

-- categorias
ambito  VARCHAR(20) NOT NULL DEFAULT 'productos'              -- productos | servicios

-- pedidos
origen          VARCHAR(20) NOT NULL DEFAULT 'menu'           -- menu | presupuesto | panel
presupuesto_id  INTEGER REFERENCES presupuestos(id) ON DELETE SET NULL
programado_para TIMESTAMPTZ                                    -- retiro/entrega programada

-- pedido_items
opciones        JSONB   -- [{grupo, opcion, precio_extra}]  foto al momento de la compra
personalizacion JSONB   -- [{campo_id, etiqueta, tipo, valor, adjunto_id}]
nombre          → ampliar a VARCHAR(250) (H6)
```

**Por qué JSONB para la foto histórica y no solo `atributos`:** las *definiciones* de los campos van en una tabla tipada (`producto_campos`, abajo) y el backend valida cada respuesta contra ellas. Lo que se guarda en el ítem es una copia congelada de etiqueta + valor: si mañana el negocio renombra o borra el campo, el pedido viejo sigue mostrando lo que compró el cliente.

**Backfill de negocios existentes** (en la misma migración): `modulos` se completa con exactamente lo que usan hoy (catálogo, productos, pedidos, carrito, entregas, estadísticas). `rubro_categoria` sale de `tipo_rubro` (`gastronomia → gastronomia`, `retail → comercios`, `servicios → servicios_profesionales`, `generico → otros`). Además, el código trata `modulos = NULL` igual que ese perfil, así funciona aunque la migración todavía no se haya corrido.

## 6. Tablas nuevas

Todas con `negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE` **sin default**, índice por `negocio_id`, RLS prendido sin políticas (como `soporte.sql`).

| Tabla | Campos principales |
|---|---|
| `rubros_categorias` | `codigo` PK, `nombre`, `icono`, `orden`, `activo` |
| `rubros_especialidades` | `codigo` PK, `categoria`, `nombre`, `modulos_sugeridos` JSONB, `modalidades_sugeridas` JSONB, `vocabulario` JSONB (`{"catalogo":"Menú","item":"Plato"}`), `orden`, `activo`. Se carga con las ~100 especialidades de la consigna. Agregar una = un `INSERT`. |
| `producto_campos` | `producto_id`, `negocio_id`, `tipo` (texto, texto_largo, numero, opcion, opciones, color, medida, imagen, archivo), `etiqueta`, `opciones` JSONB, `obligatorio`, `orden`, `validaciones` JSONB (`min`, `max`, `max_largo`, `tipos`, `max_mb`), `precio_extra` |
| `servicios` | `categoria_id` (categoría con ámbito servicios), `nombre`, `descripcion`, `imagen_url`, `tipo_precio` (fijo, desde, variable, a_consultar), `precio`, `duracion_min`, `modalidades` JSONB (presencial, domicilio, virtual), `requiere_turno`, `requiere_presupuesto`, `activo`, `orden` |
| `presupuestos` | `numero` (correlativo por negocio), `producto_id` / `servicio_id` (opcionales), `cliente_nombre`, `telefono`, `email`, `acepta_whatsapp`, `descripcion`, `cantidad`, `detalles` JSONB (medidas, características), `estado`, `precio_cotizado`, `observaciones`, `valido_hasta`, `pedido_id`, timestamps. CHECK de estados: pendiente, en_revision, cotizado, aceptado, rechazado, convertido, cancelado. |
| `presupuesto_eventos` | `presupuesto_id`, `estado_anterior`, `estado_nuevo`, `autor` (cliente / usuario_id), `nota`, `created_at` |
| `recursos` | `nombre` (profesional, sillón, box), `activo`. Opcional: sin recursos, la agenda es de capacidad 1 por negocio. |
| `agenda_horarios` | `recurso_id` (NULL = todo el negocio), `dia_semana`, `desde`, `hasta` |
| `agenda_bloqueos` | `recurso_id`, `desde` TIMESTAMPTZ, `hasta`, `motivo` (feriados, vacaciones) |
| `reservas` | `servicio_id`, `recurso_id`, `cliente_nombre`, `telefono`, `email`, `acepta_whatsapp`, `inicio` TIMESTAMPTZ, `fin`, `estado` (pendiente, confirmada, cancelada, completada, ausente), `modalidad`, `notas`, `reprogramada_de`. **Sin superposición garantizada por la base:** `EXCLUDE USING gist (negocio_id WITH =, coalesce(recurso_id,0) WITH =, tstzrange(inicio, fin) WITH &&) WHERE (estado IN ('pendiente','confirmada'))` (extensión `btree_gist`, disponible en Supabase). |
| `reserva_eventos` | Historial: creada, confirmada, cancelada, reprogramada (con horario anterior), autor |
| `adjuntos` | `contexto` (pedido_item, presupuesto), `ref_id`, `public_id` de Cloudinary, `resource_type`, `mime`, `bytes`, `nombre_original`, `token_subida`, `usado` (para limpiar huérfanos) |
| `registro_cambios` | `cuenta_id`, `negocio_id`, `usuario_id`, `tech_id`, `accion`, `entidad`, `entidad_id`, `detalle` JSONB, `created_at` |

**Adjuntos seguros:** se suben a Cloudinary como `type: "authenticated"` (no hay URL pública); el panel recibe una URL firmada que vence. Se valida en el backend: tamaño (ej. 10 MB), tipo por **bytes reales** del archivo (no por la extensión ni el `mimetype`) para imágenes y PDF, y una lista por extensión + tamaño para formatos sin firma (STL, OBJ, 3MF). Carpeta por negocio. Rate limit propio. Un job borra los adjuntos no usados a las 24 h.

**Operaciones atómicas en SQL (RPC):** supabase-js no tiene transacciones, así que lo que tiene que pasar "todo o nada" va en funciones `plpgsql` (ya hay antecedente en `rpc.sql`): `crear_pedido` (pedido + ítems + stock con `UPDATE … WHERE stock >= cantidad`), `convertir_presupuesto`, `crear_reserva` / `reprogramar_reserva`.

---

## 7. Endpoints

### Nuevos públicos (rate limit + Zod + negocio resuelto por slug y **activo**; sin caer al negocio 1)

| Método y ruta | Qué hace |
|---|---|
| `GET /api/rubros` | Categorías y especialidades activas (con caché) |
| `GET /api/publico/:slug` | Todo lo que necesita la página pública en una llamada: datos, módulos, modalidades, vocabulario |
| `GET /api/publico/:slug/servicios` | Servicios activos |
| `POST /api/publico/:slug/adjuntos` | Subir un archivo; devuelve un token de un solo uso |
| `POST /api/publico/:slug/presupuestos` | Solicitar presupuesto |
| `GET /api/presupuestos/:id?t=` · `POST …/aceptar` · `POST …/rechazar` | Ver y responder la cotización (link firmado) |
| `GET /api/publico/:slug/disponibilidad?servicio=&desde=&hasta=` | Huecos libres |
| `POST /api/publico/:slug/reservas` | Pedir turno |
| `GET /api/reservas/:id?t=` · `POST …/cancelar` · `POST …/reprogramar` | Gestión del cliente (link firmado) |

### Nuevos del panel (auth + scopeNegocio + checkSuscripcion + **requiereModulo** + checkPermiso)

| Prefijo | Rutas |
|---|---|
| `/api/negocio/modulos` | `GET`, `PUT` (permiso configuración) |
| `/api/onboarding` | `GET` (progreso), `PUT` (guardar paso), `POST /publicar` |
| `/api/productos/:id/campos` | CRUD de campos de personalización (permiso productos) |
| `/api/servicios` | CRUD (permiso servicios) |
| `/api/presupuestos` | `GET /`, `GET /:id`, `PATCH /:id/estado`, `POST /:id/cotizacion`, `POST /:id/convertir`, `GET /:id/adjuntos/:adjId` (URL firmada) |
| `/api/reservas` | `GET /` (rango de fechas), `GET /:id`, `POST /` (alta manual), `PATCH /:id/estado`, `POST /:id/reprogramar` |
| `/api/agenda` | `GET/PUT /horarios`, CRUD `/bloqueos`, CRUD `/recursos` |
| `/api/clientes` | `GET /` (vista derivada de pedidos, presupuestos y reservas) |

Middleware nuevo **`requiereModulo(nombre)`**: lee `negocios.modulos` (con caché corta, como `negocioConWhatsapp`) y responde 403 `MODULO_INACTIVO`. Así el panel y el backend usan la misma configuración.

### Modificados

| Endpoint | Cambio |
|---|---|
| `POST /api/pedidos` | H1, H3, H4, H5; personalización validada; modalidades nuevas; fecha programada |
| `PUT /api/configuracion` | Modalidades nuevas, validadas contra lo que permite el negocio |
| `POST/PUT /api/negocios` | Categoría y especialidad (validadas contra la tabla, no contra una lista fija) |
| `PUT /api/productos/:id` | `tipo_producto`, `compra_directa`, `requiere_presupuesto` |
| `GET /api/productos/disponibles` (RPC) | Devuelve campos de personalización y opciones activas; nunca `costo` |
| `POST/DELETE /api/upload` | Con `scopeNegocio`, carpeta por negocio, validación por bytes; DELETE solo de `public_id` de ese negocio (H2) |
| `GET /api/plan` | Informa módulos disponibles |
| `/api/whatsapp/avisos` | Claves con prefijo por entidad |

---

## 8. Rutas del frontend

### Público (`frontend/`)

| Ruta | Estado |
|---|---|
| `/negocio/:slug` | **Nueva canónica.** Se arma según módulos: menú/tienda + carrito, servicios, presupuesto, turnos |
| `/negocio/:slug/presupuesto` | Nuevo (`?producto=` o `?servicio=` opcional) |
| `/negocio/:slug/reservar` | Nuevo (`?servicio=`) |
| `/presupuesto/:id?t=` · `/reserva/:id?t=` | Nuevos: el cliente sigue su cotización o turno |
| `/menu`, `/menu?negocio=`, `/menu/:slug`, `/menu/:slug/todos` | **Se conservan** y muestran lo mismo que hoy. `/menu/:slug` renderiza la misma página que `/negocio/:slug` (sin redirigir, para no tocar los parámetros `?mesa=&t=` de los QR impresos). La firma de mesa depende del id del negocio, no de la ruta. |
| `/ticket`, `/reparto`, `/seguimiento` | Sin cambios |

`Menu.tsx` se separa en secciones (cabecera, catálogo, servicios, CTA de presupuesto/turno) para no llenarlo de `if`. El carrito aparece solo si el módulo `carrito` está activo; "Comprar" directo vs. "Pedir presupuesto" sale de `compra_directa` / `requiere_presupuesto` de cada producto.

### Panel (`frontend-admin/`)

| Ruta | Estado |
|---|---|
| `/admin/onboarding` | Rehecho en 8 pasos, retomable (lee `/api/onboarding`) |
| `/admin/servicios` | Nueva |
| `/admin/presupuestos` | Nueva (bandeja + detalle con adjuntos y cotización) |
| `/admin/reservas` | Nueva (agenda día/semana + lista) |
| `/admin/agenda` | Nueva (horarios, bloqueos, recursos) |
| `/admin/clientes` | Nueva |
| `/admin/productos` | Pestaña "Personalización" en el modal de producto |
| `/admin/configuracion` | Rubro (categoría + especialidad), módulos y modalidades |
| `/admin/negocios` | Rubro con el catálogo central |
| `/admin/dashboard` | Tarjetas según módulos (turnos de hoy, presupuestos pendientes) |

`ItemNav` suma `modulo?: string` y `NegocioContext` expone los módulos del negocio activo. El restaurante ve exactamente el menú de hoy.

---

## 9. Riesgos de migración

| Riesgo | Mitigación |
|---|---|
| Un negocio gastronómico cambia de comportamiento | Backfill explícito + `modulos = NULL` equivale al perfil de hoy. Pruebas de caracterización de `createPedido` (H8) antes de tocarlo. Caso 1 (restaurante) se prueba en **cada** etapa. |
| QR impresos dejan de andar | `/menu/*` no se toca; la firma no depende de la ruta. Prueba automática con un QR de mesa viejo. |
| Migraciones a medio correr en Supabase | Cada `.sql` idempotente y el código tolera que falte (patrón actual con `select("*")`). Checklist de qué corrió antes de cada etapa (la doc lista varias como "a confirmar"). |
| Sin transacciones en supabase-js | RPC `plpgsql` para pedido, conversión y reservas. |
| Choque de turnos | Restricción `EXCLUDE` en la base, no solo en el código. Zona horaria fija `America/Argentina/Buenos_Aires` (`NEGOCIO_TZ`). |
| Archivos de clientes expuestos | Cloudinary `authenticated` + URL firmada que vence + validación por bytes + carpeta por negocio. |
| Fugas entre negocios | Toda tabla nueva con `negocio_id NOT NULL`; cada consulta filtra por `req.negocioId`; pruebas de aislamiento por módulo (como `scopeNegocio.test.js`). |
| Plantillas de WhatsApp | Meta tarda días en aprobarlas y hay que crearlas también en cada número propio ya conectado. Enviarlas a revisión al empezar la etapa 5. |
| CHECK `chk_tipo_rubro` | Se conserva; las especialidades viven en su propia tabla. No se borra ninguna columna. |
| Trabajo sin commitear (H9) | Cerrarlo primero. |
| Volumen de textos | i18n del panel tiene ~2.400 líneas en 3 idiomas. Con `MULTI_IDIOMA = false`, propongo escribir solo español para lo nuevo y dejar en/pt como copia del español hasta reactivarlos. |

**No se elimina ninguna tabla ni columna.** `tipo_rubro` y `config_campos` quedan; `config_campos` se podría deprecar más adelante (no se usa), pero no hace falta ahora.

---

## 10. Plan de implementación

Cada etapa en su rama, con sus pruebas, su migración y un resumen al terminar. El restaurante (caso 1) se prueba siempre.

| Etapa | Contenido | Hecho cuando |
|---|---|---|
| **0. Base segura** | Cerrar H9. Pruebas de caracterización de pedidos/productos/variantes. Corregir H1, H2, H3, H6 (y decidir H5). | Pruebas nuevas en verde; un pedido con precio inventado o producto ajeno se rechaza; nadie borra imágenes de otro negocio. |
| **2. Rubros y onboarding** | Tablas de rubros + seed; `GET /api/rubros`; las 6 listas fijas pasan a leer del catálogo; onboarding de 8 pasos con progreso guardado (los pasos 7 y 8 usan lo que ya existe hasta que lleguen las etapas siguientes). | Alta nueva elige categoría y especialidad; cortar a la mitad y volver retoma el paso; negocios viejos sin cambios. |
| **3. Módulos** | `negocios.modulos`, backfill, `requiereModulo`, menú del panel por módulo, pantalla de módulos. | Peluquería sin "Pedidos/QR/Mesas"; restaurante idéntico a hoy. |
| **4. Catálogo universal** | `tipo_producto`, `producto_campos`, adjuntos, foto histórica en `pedido_items`, RPC `crear_pedido`; `servicios`. | Casos 2 y 3 (parte productos): talles/colores con stock, producto personalizado con archivo, el panel ve la personalización del pedido. |
| **5. Presupuestos y reservas** | Tablas, endpoints, pantallas del panel y del público, links firmados, conversión a pedido, agenda. | Casos 3, 4 y 5 completos; dos turnos al mismo horario → el segundo se rechaza. |
| **6. Modalidades** | Modalidades nuevas en configuración, checkout y validación del backend. | El checkout solo muestra lo habilitado; el backend rechaza lo no habilitado. |
| **7. Página pública** | `/negocio/:slug`, secciones por módulo, vocabulario por rubro, compatibilidad `/menu`. | QR viejos y nuevos funcionan; prueba en celular de los 5 casos. |
| **8. Panel** | Dashboard por módulo, Clientes, permisos nuevos en roles. | Staff ve lo que corresponde; navegación por rubro como en los ejemplos. |
| **9. Integraciones** | Avisos con prefijo, plantillas nuevas, IA con servicios, analíticas de presupuestos/reservas, `registro_cambios`. | Avisos de presupuesto y reserva con consentimiento; chats e IA de restaurante sin cambios. |
| **10. Pruebas y despliegue** | Los 5 casos de punta a punta, aislamiento, suscripción, QR viejos, móvil; checklist de migraciones y variables de Render. | Todo verificado en local con backend falso y luego en producción. |

Las etapas 2 y 3 se pueden hacer juntas (comparten el onboarding). La 6 depende de la 3; la 7 de la 4 y la 5.

---

## Recomendación separada: planes (no se implementa sin tu OK)

No cambio precios ni límites. Propuesta para decidir:

1. **Todos los módulos nuevos en todos los planes** durante el lanzamiento (igual que analíticas). Ningún negocio actual pierde nada.
2. **Servicios cuentan dentro del límite de productos** del plan (mismo cupo de "ítems de catálogo"), para que nadie cargue 1.000 servicios en el Básico. Alternativa: cupo aparte.
3. **Avisos de WhatsApp de presupuestos y reservas** siguen la regla actual: solo Estándar y Premium (`requiereWhatsapp`).
4. **Adjuntos**: tope por plan de espacio o cantidad por mes (Cloudinary cobra por almacenamiento). Ej.: Básico 200 MB, Estándar 1 GB, Premium 5 GB. Es el único costo nuevo real.
5. Recordatorio automático de turnos por WhatsApp: candidato a función de Estándar/Premium.

## Decisiones que necesito de vos

1. ¿Los pedidos a negocios **inactivos** o con la **suscripción vencida** se rechazan (H5)?
2. Permisos del rol **Staff** en lo nuevo: propongo `reservas` y `presupuestos` (ver y cambiar estado), pero **no** cotizar precios. ¿OK?
3. ¿Arrancamos por la **Etapa 0** (correcciones + pruebas), o preferís que H1/H2 vayan sueltos ya mismo como arreglo de seguridad?
4. Planes: ¿aprobás los puntos 1 a 3 de la recomendación? (4 y 5 se pueden dejar para después.)
