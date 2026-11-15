# DinexFlow multirrubro — Checklist de despliegue

Estado al 15/11/2026. Todo está commiteado en ramas encadenadas y **sin publicar**: `main` sigue en `bff0b90` y nada se subió a GitHub.

## 1. Qué se publica

Once commits, uno detrás del otro. `main` es ancestro directo, así que se puede llevar todo con un merge rápido (fast-forward) de la última rama.

| Commit | Etapa |
|---|---|
| `e7562c6` | 0 · Seguridad de pedidos y subida de imágenes |
| `f3f3c12` | 2 · Catálogo de rubros y onboarding de 8 pasos |
| `b16977a` | 3 · Módulos por negocio |
| `ab22ff3` | 4 · Personalización, servicios y pedido atómico |
| `7a2f966` | 5 · Presupuestos y turnos |
| `cf764c4` | 6 · Mostrador, envío y pedidos programados |
| `ea5b59a` | 7 · Página pública `/negocio/:slug` |
| `0942a26` | 8 · Clientes, agenda en el dashboard, link por rubro |
| `aa70447` | 9a · Registro de cambios, analíticas de agenda, IA con servicios |
| `3ebddbc` | Número propio de WhatsApp (Embedded Signup) |
| `621ae76` | 9b · Avisos de WhatsApp de presupuestos y turnos |
| (esta rama) | 10 · Verificación, "Sin stock" en talles, esta checklist |

## 2. Orden de despliegue

Primero la base, después el código. Todas las migraciones son idempotentes: se pueden correr más de una vez.

### 2.1 Migraciones en Supabase (SQL Editor), en este orden

1. `backend/db/venta_por_peso.sql`: sólo si no se corrió antes. Sin `pedido_items.unidad`, `crear_pedido` falla para todos.
2. `backend/db/rubros_onboarding.sql`: tablas de rubros y onboarding. Sin esto, `/api/rubros` da 500.
3. `backend/db/modulos.sql`: `negocios.modulos`. Va después de la 2, porque usa la columna `onboarding`.
4. `backend/db/catalogo_universal.sql`: personalización, adjuntos, servicios y la función `crear_pedido`.
5. `backend/db/presupuestos_reservas.sql`: presupuestos, turnos (`btree_gist`), agenda y permisos.
6. `backend/db/modalidades.sql`: `configuracion.modalidades`, `pedidos.programado_para` y `crear_pedido` actualizada.
7. `backend/db/clientes.sql`: permiso `clientes` para Admin.
8. `backend/db/registro_cambios.sql`: tabla de auditoría.
9. `backend/db/whatsapp_cuentas.sql`: número propio de WhatsApp.

Para comprobar que la 6 quedó bien: `select pg_get_functiondef('crear_pedido'::regproc)` tiene que incluir `programado_para`.

### 2.2 Variables de entorno en Render (backend)

Las de siempre no cambian. Nuevas, todas para el número propio de WhatsApp:

| Variable | ¿Obligatoria? | Para qué |
|---|---|---|
| `META_APP_ID` | Para "Conectar mi WhatsApp" | Id de la app de Meta |
| `WHATSAPP_ES_CONFIG_ID` | Para "Conectar mi WhatsApp" | Configuration ID de Facebook Login for Business |
| `WHATSAPP_CUENTAS_KEY` | Recomendada | Clave para cifrar los tokens de cada local (32+ caracteres al azar). Si falta, se deriva de `JWT_SECRET`: cambiar `JWT_SECRET` deja inservibles los números conectados. |
| `META_SDK_VERSION` | No | Por defecto `v27.0` |

Sin `META_APP_ID` ni `WHATSAPP_ES_CONFIG_ID`, el panel muestra "La conexión con Meta todavía no está habilitada" y todo lo demás funciona.

### 2.3 `render.yaml` (frontends)

Ya está en el código: la CSP admite el SDK de Meta (`connect.facebook.net`, `*.facebook.com`) y `geolocation=(self)` para la página del repartidor. Render lo toma al desplegar.

### 2.4 Meta (WhatsApp Manager de la plataforma)

- Crear las 5 plantillas nuevas (Utility, es_AR): `presupuesto_recibido`, `presupuesto_cotizado`, `turno_confirmado`, `turno_reprogramado` y `turno_cancelado`. El texto exacto está en `docs/whatsapp-avisos.md`.
- Para el número propio: Tech Provider, configuración de Facebook Login for Business, permisos avanzados y webhooks (ver `docs/whatsapp-avisos.md`).
- Los avisos nuevos vienen **apagados**. Cada local los prende cuando las plantillas están aprobadas.

### 2.5 Código

Merge de `feat/etapa-10-verificacion` a `main` (fast-forward) y push. Si Render tiene el despliegue automático activado, publica los tres servicios.

## 3. Prueba en producción (después de desplegar)

Hacerla con un negocio de prueba, nunca con uno real:

1. **Restaurante existente** (con `modulos` en NULL): el panel tiene que verse igual que antes. Abrir un QR de mesa impreso (`/menu/<slug>?mesa=…&t=…`) y hacer un pedido en mesa.
2. **Tienda de ropa**: producto con Talle y Color con stock. Un talle en 0 aparece "Sin stock". Hacer un pedido con envío por correo.
3. **Producto personalizado**: campo de texto y archivo. Subir una imagen real; es la **primera prueba real con Cloudinary** (`authenticated`). Abrir "Ver archivo" desde Pedidos.
4. **Peluquería**: sacar un turno desde `/negocio/<slug>`, confirmarlo desde Turnos y probar que dos turnos al mismo horario den error.
5. **Presupuesto**: pedirlo, cotizarlo, aceptarlo desde el link y pasarlo a pedido (con el módulo Pedidos prendido).
6. **Aislamiento**: con dos negocios de cuentas distintas, ninguno ve clientes, presupuestos, turnos ni registro del otro.
7. **Suscripción vencida**: el panel queda en solo lectura y los pedidos públicos se comportan como hasta hoy.

## 4. Qué se verificó y qué no

**Verificado, en local con el backend de prueba:**
- 317 pruebas automáticas del backend.
- `tsc` y build de producción de los dos frontends.
- Los 5 casos de punta a punta en tamaño celular: QR de mesa viejo (`/menu?negocio=…&mesa=…`), tienda con talles y envío, taza con texto y foto, turno de peluquería, y presupuesto cotizado y aceptado.
- El restaurante sin cambios en cada etapa: el texto que recibe la IA es idéntico y el panel muestra lo mismo.

**No verificado:**
- Migraciones contra la base real.
- Subida real a Cloudinary.
- Envíos reales de WhatsApp y alta de un número propio en Meta.
- Despliegue en Render.

## 5. Decisiones pendientes (no bloquean el despliegue)

| Tema | Hoy |
|---|---|
| H5: pedidos a negocios inactivos o con la suscripción vencida | Se aceptan, como antes |
| Staff en presupuestos y turnos | Ve y cambia estados, no cotiza |
| Staff en Clientes | Sin acceso (datos personales) |
| ¿Los servicios cuentan para el límite de productos del plan? | No cuentan |
| Apagar "Pedidos" también oculta el historial de pedidos | Se oculta (vuelve al prenderlo) |
| Recordatorio de turno el día antes | No hecho (necesita una tarea programada) |
| Stock por opción en el backend | El menú ya no deja elegir un talle en 0. El backend descuenta, pero no rechaza vender por encima del stock (igual que antes). |

## 6. Límites conocidos

- La agenda tiene capacidad 1 por negocio (no hay profesionales ni recursos).
- Las franjas que cruzan la medianoche se cortan a las 24 h en los turnos (en los pedidos programados sí se aceptan).
- Clientes lee hasta 2000 registros por fuente y avisa si se cortó.
