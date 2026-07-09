# Menú Digital — SaaS: Suscripciones, Hotmart y Multi-Tenant

Documentación de todo lo implementado para convertir Menú Digital en un SaaS
con planes de suscripción, alta automática vía Hotmart y aislamiento por cuenta.

> **TL;DR del orden de ejecución**
> 1. Correr las 4 migraciones SQL en Supabase (en orden, ver abajo).
> 2. Configurar las variables de entorno nuevas en el backend.
> 3. Marcar tu usuario como `superadmin` + `es_plataforma` (ver [§7](#7-troubleshooting--tu-usuario-solo-ve-dashboard)).
> 4. Configurar el webhook en Hotmart apuntando a `/api/webhooks/hotmart`.

---

## 1. Modelo de datos

El sistema ya era multi-negocio (`negocios` = tenant). Se agregó por encima una
entidad **`cuentas`** (el suscriptor que paga), dueña de la suscripción y de los
negocios.

```
cuentas (plan + estado + límites)
   └── negocios (cuenta_id)        ← multi-tenant, limitado por plan
          └── productos (negocio_id)  ← limitado por plan
   └── usuarios (cuenta_id)        ← quién administra la cuenta
```

### Planes y límites

| Plan       | `limite_negocios` (multi-tenant) | `limite_productos` (por negocio) |
| ---------- | -------------------------------- | -------------------------------- |
| `free`     | 1 (sin multi-tenant)             | 10                               |
| `basic`    | 3                                | 50                               |
| `standard` | 10                               | 100                              |
| `premium`  | 9999 (ilimitado)                 | 9999                             |

Los **límites los deriva un trigger** en la BD a partir de `tipo_plan`: el
backend solo setea el plan y la base recalcula los dos límites. Imposible que
queden inconsistentes.

- `cuentas.estado_suscripcion`: `activo` | `cancelado`.

---

## 2. Migraciones SQL (correr en Supabase, en orden)

Todas son **idempotentes**. Ubicadas en `backend/db/`.

| # | Archivo | Qué hace |
| - | ------- | -------- |
| 1 | `suscripciones.sql` | Crea `cuentas` (plan, estado, `limite_negocios`, `limite_productos`) + trigger `set_limites_por_plan` + siembra la cuenta 1 como `premium` + agrega `negocios.cuenta_id`. |
| 2 | `hotmart_usuarios.sql` | Agrega `usuarios.cuenta_id` (FK), `email` UNIQUE en `cuentas` (para upsert), y columnas de auditoría `cuentas.origen` / `cuentas.hotmart_transaction`. |
| 3 | `rol_plataforma.sql` | Agrega `usuarios.es_plataforma` (god-mode cross-cuenta). Por defecto marca `WHERE id = 1`. |
| 4 | `facturacion_ciclo.sql` | Agrega `cuentas.ciclo_facturacion` (mensual\|anual) para calcular el MRR. |
| 5 | `moneda_negocio.sql` | Agrega `configuracion.moneda` (default `ARS`); cada negocio muestra el menú en su moneda. |

> **Nota:** `suscripciones.sql` depende de `multitenant_stock.sql` (tabla
> `negocios`), que ya debía estar corrida de antes.

La cuenta 1 se siembra en `premium` **a propósito**, para que los datos
existentes (todos con `cuenta_id = 1` por default) no queden bloqueados por
límites.

---

## 3. Límites de plan + manejo del 403

### Backend

Middlewares que devuelven **403** con un `error` tipado antes de guardar:

- `middleware/checkLimiteProductos.js` — en `POST /api/productos`. Lee el
  límite vía join `negocio → cuenta`. Errores: `LIMITE_PRODUCTOS_ALCANZADO`,
  `SUSCRIPCION_CANCELADA`.
- `middleware/checkLimiteNegocios.js` — en `POST /api/negocios`. Límite
  multi-tenant. Errores: `LIMITE_NEGOCIOS_ALCANZADO`, `SUSCRIPCION_CANCELADA`.

Endpoint de consulta de plan + uso (solo requiere estar logueado):

- `GET /api/plan` → `{ tipo_plan, estado_suscripcion, limite_negocios,
  negocios_usados, limite_productos, productos_usados }`
  (`controllers/planController.js`, `routes/plan.js`).

### Frontend-admin

- `services/api.ts` — helper `getApiErrorMessage()` (extrae el mensaje real del
  backend), `planService.get()`, interface `PlanInfo`.
- `pages/admin/Productos.tsx` y `pages/admin/Negocios.tsx`:
  - Badge **"X / Y del plan"**.
  - Botón "Nuevo" deshabilitado al llegar al límite (con tooltip explicativo).
  - Banner con el mensaje real del 403 dentro del modal (antes se tragaba con
    un `alert` genérico).

El 403 se maneja en dos capas: **preventiva** (UI bloquea antes de intentar) y
**defensiva** (si igual llega el 403, se muestra el mensaje exacto).

---

## 4. Webhook de Hotmart (alta automática)

Endpoint público (sin JWT; la seguridad es el token de Hotmart):

```
POST /api/webhooks/hotmart
```

Archivos: `controllers/hotmartController.js`, `routes/hotmart.js`,
`utils/hotmartPlans.js`, y `sendWelcomeEmail` en `services/emailService.js`.

### Flujo cuando la compra está aprobada (`approved` / `aprovado`)

1. **Valida el token de seguridad** — header `X-HOTMART-HOTTOK` (o `hottok` en
   el body) contra `HOTMART_HOTTOK`. Si no coincide → **401**.
2. **Mapea `product_id → plan`** (`utils/hotmartPlans.js`, configurable por env).
3. **Upsert de `cuentas` por email** con el plan → el trigger recalcula límites.
4. **Crea negocio + configuración** si la cuenta todavía no tiene ninguno.
5. **Crea el usuario** (`usuarios`, rol `superadmin`, `must_change_password`,
   contraseña temporal) si no existe.
6. **Envía email de bienvenida** con las credenciales (Resend).

### Detalles clave

- **Idempotente**: Hotmart reintenta. Si el usuario ya existe (re-compra,
  upgrade, reintento), solo actualiza el plan/vínculo y **no toca la
  contraseña** ni reenvía el email.
- Soporta el formato de webhook **2.0** (`data.buyer/purchase/product`) y el
  viejo (campos planos).
- Eventos no aprobados → **200** (para que Hotmart no reintente). Errores de BD
  → **500** (para que reintente).

### Punto 4 del pedido: email de acceso

- **Implementado (recomendado):** contraseña temporal + `must_change_password`.
  El usuario entra con la pass temporal y el sistema lo obliga a definir la suya.
  Reusa el flujo existente, cero deuda técnica.
- **Alternativa "enlace mágico" (login con un click):** reutilizar la tabla
  `password_reset_tokens` para un token de un solo uso + endpoint
  `GET /auth/magic?token=…` que devuelve el JWT. (No implementado; queda como
  opción si se quiere.)

---

## 5. Aislamiento multi-tenant

Sin esto, el header `X-Negocio-Id` (controlable por el cliente) permitía a un
usuario logueado leer/escribir datos de otra cuenta.

### Cómo se cerró

1. **`cuenta_id` en el JWT** — el login lo incluye
   (`controllers/authController.js`). Helper `utils/cuenta.js`:
   - `getAuthScope(req) → { cuentaId, esPlataforma }` (lee del JWT, con fallback
     a BD para tokens viejos).
   - `getCuentaId(req)` (compat).
2. **Middleware `middleware/scopeNegocio.js`** — montado tras `authMiddleware`
   en `categorias`, `productos`, `configuracion`, `pedidos`, `analiticas`,
   `plan`. Valida que el `X-Negocio-Id` sea de la cuenta y fija `req.negocioId`.
   Si el negocio no es de la cuenta, cae al primer negocio propio (**nunca**
   sirve datos de otra cuenta; evita 403 en cascada en el arranque).
   `getNegocioId` prioriza `req.negocioId`.
3. **Scoping en controllers**:
   - `negociosController` (list/get/update/delete) filtra por `cuenta_id`.
   - `usuariosController` (list/get/update/password/delete) filtra por
     `cuenta_id` (antes un superadmin de cliente veía **todos** los usuarios).
4. **Frontend** — `context/NegocioContext.tsx`: el fallback cae a `data[0].id`
   de la lista scopeada, no a un id fijo (`1`) que podría ser de otra cuenta.

Verificado con un test de mock (8 casos, incluidos los cross-tenant).

---

## 6. Rol de plataforma (god-mode)

Para el dueño del SaaS (vos), que necesita ver/gestionar **todas** las cuentas.

- Columna `usuarios.es_plataforma` (migración `rol_plataforma.sql`).
- Cuando `es_plataforma = true`:
  - `scopeNegocio` acepta cualquier negocio de cualquier cuenta.
  - `negociosController` y `usuariosController` **omiten** el filtro `cuenta_id`.
- Un `superadmin` de cliente Hotmart queda con `es_plataforma = false` → aislado
  a su propia cuenta.
- Es **solo server-side** y se activa por un `UPDATE` manual en la BD: ningún
  endpoint escribe `es_plataforma`, así que un cliente no puede autoasignárselo.

---

## 6.1. Panel de plataforma (dueño del SaaS)

Vista **exclusiva** para usuarios con `es_plataforma = true`. Los clientes
Hotmart (`es_plataforma = false`) nunca la ven ni pueden pegarle al endpoint.

- **Backend:** `GET /api/plataforma/cuentas` (listado de todas las cuentas con
  su uso: negocios/usuarios/productos) y `GET /api/plataforma/resumen`
  (totales, activas/canceladas, altas por Hotmart, distribución por plan).
  Protegido con `middleware/requirePlataforma.js` (403 si no es plataforma).
  Sin `scopeNegocio`: es cross-cuenta a propósito.
- **Frontend-admin:** `pages/admin/Plataforma.tsx`, ruta `/admin/plataforma`
  (guardada con `<ProtectedRoute plataforma>`), ítem "Plataforma" en el sidebar
  y tarjeta de acceso rápido en el Dashboard — todo condicionado a
  `isPlataforma` (nuevo en `AuthContext`).

> **Ojo con el token viejo:** `requirePlataforma` lee `es_plataforma` del JWT.
> Si tu sesión es anterior a marcarte como plataforma, cerrá sesión y volvé a
> entrar para regenerar el token.

---

## 7. Troubleshooting — "mi usuario solo ve Dashboard"

**Síntoma:** el sidebar solo muestra Dashboard y Ver Menú; no hay selector de
negocio; el rol figura como `ADMIN`.

**Causa:** el sidebar filtra por permisos (`hasPermiso`). Los roles válidos son
`superadmin` (`"*"`), `editor`, `visor`. Un usuario con `rol = 'admin'` (que no
existe en `roles_permisos`) recibe permisos vacíos → solo ve los ítems
públicos.

**Solución:** convertir tu usuario en superadmin de plataforma y re-loguear:

```sql
-- 1) Identificá tu usuario
SELECT id, username, nombre, rol, cuenta_id, es_plataforma FROM usuarios;

-- 2) Dale rol superadmin + god-mode (ajustá el WHERE)
UPDATE usuarios
SET rol = 'superadmin',
    es_plataforma = true
WHERE username = 'facundo';   -- o WHERE id = <tu id>

-- 3) Cerrá sesión y volvé a entrar (regenera el token con permisos '*')
```

> El token se regenera al re-loguear: siempre que cambies `rol`, `cuenta_id` o
> `es_plataforma`, cerrá sesión y volvé a entrar.

---

## 8. Variables de entorno (backend)

```bash
# Hotmart
HOTMART_HOTTOK=el_token_de_seguridad_de_hotmart
HOTMART_PRODUCTS_BASIC=1234567
HOTMART_PRODUCTS_STANDARD=2345678,2345679   # listas CSV de product_id
HOTMART_PRODUCTS_PREMIUM=3456789

# Precios de planes en USD → ganancia mensual (MRR) del panel (§6.1).
# Mensuales:
PLAN_PRECIO_BASIC_MONTHLY=7.99
PLAN_PRECIO_STANDARD_MONTHLY=14.99
PLAN_PRECIO_PREMIUM_MONTHLY=24.99
# Anuales (el MRR prorratea /12 según el ciclo de cada cuenta):
PLAN_PRECIO_BASIC_ANNUAL=79.90
PLAN_PRECIO_STANDARD_ANNUAL=149.90
PLAN_PRECIO_PREMIUM_ANNUAL=249.90

# Opcional: product_ids ANUALES de Hotmart (para detectar el ciclo).
# Si un id no está acá, la compra se toma como 'mensual'.
HOTMART_PRODUCTS_BASIC_ANNUAL=
HOTMART_PRODUCTS_STANDARD_ANNUAL=
HOTMART_PRODUCTS_PREMIUM_ANNUAL=

# Link del email de bienvenida
ADMIN_URL=https://tu-panel.com/admin/login

# Ya existían (email vía Resend)
RESEND_API_KEY=...
EMAIL_FROM=Menú Digital <onboarding@resend.dev>

# Ya existían (Supabase / JWT)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
```

En el panel de Hotmart: configurar el webhook apuntando a
`https://tu-backend.com/api/webhooks/hotmart`, evento **Compra aprobada**, y
copiar el hottok a `HOTMART_HOTTOK`.

---

## 9. Índice de archivos

### Backend — SQL (`backend/db/`)
- `suscripciones.sql` · `hotmart_usuarios.sql` · `rol_plataforma.sql`

### Backend — código nuevo (`backend/src/`)
- `controllers/`: `planController.js`, `hotmartController.js`
- `routes/`: `plan.js`, `hotmart.js`
- `middleware/`: `checkLimiteProductos.js`, `checkLimiteNegocios.js`, `scopeNegocio.js`
- `utils/`: `cuenta.js`, `hotmartPlans.js`

### Backend — código modificado
- `server.js` (rutas + `scopeNegocio`), `utils/negocio.js` (prioriza
  `req.negocioId`), `controllers/authController.js` (JWT con `cuenta_id` /
  `es_plataforma`), `controllers/negociosController.js`,
  `controllers/usuariosController.js`, `services/emailService.js`.

### Frontend-admin (`frontend-admin/src/`)
- `services/api.ts` (helper de error, `planService`, `PlanInfo`)
- `pages/admin/Productos.tsx`, `pages/admin/Negocios.tsx`
- `context/NegocioContext.tsx`

---

## 10. Pendientes / próximos pasos

- **Origen del cambio de plan** más allá del alta: cancelaciones/upgrades/
  downgrades de Hotmart (eventos `PURCHASE_CANCELED`, `SUBSCRIPTION_CANCELLATION`,
  etc.) para poner `estado_suscripcion = 'cancelado'` o cambiar de plan.
- **Enlace mágico** real (opción B del §4) si se prefiere sobre la contraseña
  temporal.
- **Acciones** sobre cuentas desde el panel (cambiar plan, cancelar, reenviar
  credenciales) — hoy es de solo lectura.
- **Detalle por cliente** en el panel (ver su negocio, ventas y usuarios al
  clickear una cuenta).
- **i18n del Dashboard admin**: el menú público ya está traducido (es/en/pt,
  `frontend/src/lib/i18n.tsx` + selector); falta traducir el panel admin
  (superficie grande, se hace por pantallas).

## 11. Probar el flujo de cliente nuevo

Sin esperar una compra real de Hotmart, crear un cliente de prueba:

```bash
cd backend
node scripts/seedClientePrueba.js "Bar Demo" demo@correo.com standard
```

Crea cuenta + negocio **vacío** + usuario superadmin (pass temporal `Prueba123`).
Verificás dos cosas: (1) la cuenta aparece en el panel de Plataforma; (2) al
loguear con ese usuario, el menú y el dashboard están vacíos (aislamiento OK).
