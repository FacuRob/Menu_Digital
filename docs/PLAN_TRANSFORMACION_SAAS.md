# Plan de Transformación SaaS — Menú Digital → Plataforma Multi-rubro

> Decisiones tomadas: **(1)** Migrar de Hotmart a **Lemon Squeezy** · **(2)** Realinear roles a **SuperAdmin / Admin / Staff** · **(3)** **Multi-rubro** es prioridad #1 · **(4)** Ejecutar por fases previa aprobación.

Este documento es el plan maestro. Cada fase es autónoma, con criterios de "hecho" y rollback. No se ejecuta ninguna fase sin tu OK.

---

## Estado actual (lo que YA existe — no se reconstruye)

- **Multi-tenant**: `cuentas → negocios → productos/categorias/pedidos/configuracion`, todas con `negocio_id`/`cuenta_id`. Middleware `scopeNegocio` + `cuenta_id` en el JWT. Aislamiento verificado con tests.
- **Roles/permisos**: tabla `roles_permisos` (`superadmin`=`"*"`, `editor`, `visor`) + flag `usuarios.es_plataforma` (god-mode cross-cuenta). Middlewares `checkPermiso`, `requirePlataforma`.
- **Límites por plan**: trigger `set_limites_por_plan` en DB; middlewares `checkLimiteProductos`/`checkLimiteNegocios`; endpoint `GET /api/plan`.
- **Pagos**: Hotmart (webhook `/api/webhooks/hotmart`, alta automática, email de bienvenida vía Resend).
- **Imágenes**: Cloudinary (sin cropping dinámico).

## Lo que se construye (huecos reales)

1. **Modelo genérico multi-rubro** (variantes/modificadores + tipo de rubro por negocio).
2. **Lemon Squeezy** reemplazando Hotmart.
3. **Realineación de roles** SuperAdmin/Admin/Staff.
4. **Cropping de imágenes** + hardening.

---

## ⚠️ FASE 0 — Seguridad y limpieza (BLOQUEANTE, va primero)

**Problema crítico:** `backend/.env` está commiteado con credenciales **reales y activas** (Supabase `service_role`, Cloudinary secret, Resend key). Cualquiera con acceso al repo tiene control total de la base y el storage.

### Pasos
1. **Rotar TODAS las credenciales expuestas** (vos, en cada panel):
   - Supabase → generar nueva `service_role key`.
   - Cloudinary → regenerar `API secret`.
   - Resend → revocar y crear nueva API key.
   - `JWT_SECRET` → generar uno nuevo fuerte (invalida sesiones activas; es lo deseado).
2. **Sacar `.env` del control de versiones**: `git rm --cached backend/.env`, confirmar que `backend/.gitignore` lo ignora, y crear `backend/.env.example` sin valores.
3. **Purga opcional del historial** (si el repo es público o compartido): `git filter-repo`/BFG. Si es privado y solo tuyo, alcanza con rotar + dejar de trackear.
4. Cargar las credenciales nuevas en el hosting (Render/Netlify) como variables de entorno, no en archivo.

### Hecho cuando
- `git ls-files | grep .env` no devuelve nada.
- Las claves viejas ya no funcionan (rotadas).
- El backend arranca leyendo las envs del hosting.

---

## FASE 1 — Multi-rubro (PRIORIDAD #1)

Objetivo: desacoplar el modelo de "comida" para vender cualquier cosa (ropa, electrónica, servicios). El cambio es **aditivo y retrocompatible**: el rubro gastronómico sigue funcionando igual.

### 1.1 — Modelo de datos (nueva migración `db/multirubro.sql`, idempotente)

- **`negocios.tipo_rubro`** `VARCHAR(30) DEFAULT 'gastronomia'` — `'gastronomia' | 'retail' | 'servicios' | 'generico'`. Define qué campos y vocabulario muestra el panel.
- **`negocios.config_campos`** `JSONB DEFAULT '{}'` — campos personalizables por tenant (qué mostrar/ocultar: stock, variantes, etc.).
- **Variantes/Modificadores** (reemplaza el concepto "ingredientes"):
  - `variantes_grupo` (id, producto_id, nombre p.ej. "Talle"/"Color"/"Extras", tipo `single|multi`, obligatorio bool, negocio_id).
  - `variantes_opcion` (id, grupo_id, nombre p.ej. "M"/"Rojo", precio_extra DECIMAL default 0, stock opcional, activo).
  - Aplica igual a talles de ropa, colores, o extras de comida.
- **`productos`**: agregar columnas genéricas opcionales — `sku VARCHAR`, `atributos JSONB DEFAULT '{}'` (campos libres por rubro: marca, material, duración, etc.).
- Índices por `negocio_id` en las tablas nuevas. `DISABLE ROW LEVEL SECURITY` como el resto (mantiene la arquitectura service_role).

### 1.2 — Backend
- Controllers/rutas nuevos: `variantesController` + `routes/variantes.js` (CRUD scopeado por negocio, `checkPermiso('productos')`).
- Extender `productosController` para devolver variantes anidadas y `atributos`.
- Extender `get_productos_disponibles` (RPC) para incluir variantes en el menú público.
- Schemas de validación (Zod/Joi según `src/schemas/`) para variantes y atributos.

### 1.3 — Frontend-admin
- En `Productos.tsx`: editor de grupos de variantes + opciones (con precio extra y stock opcional).
- Selector de **tipo de rubro** en `Configuracion.tsx` que cambia labels/campos (i18n del vocabulario: "Plato"→"Producto"/"Artículo").
- `atributos` dinámicos por rubro (formulario configurable).

### 1.4 — Frontend (menú público)
- `ProductModal.tsx`: render de variantes (radio para single, checkbox para multi) con recálculo de precio.
- `useCart.ts`: el ítem del carrito incluye las opciones elegidas y su precio extra.

### Hecho cuando
- Un negocio `retail` puede crear un producto con grupo "Talle" (S/M/L) y "Color", y el cliente elige en el menú público sumando precio.
- El negocio gastronómico existente sigue funcionando sin cambios.

---

## FASE 2 — Realineación de roles (SuperAdmin / Admin / Staff)

Mapa de migración (retrocompatible vía backfill):

| Hoy | Nuevo | Alcance |
| --- | --- | --- |
| `es_plataforma = true` | **SuperAdmin** (plataforma) | Cross-cuenta, dueño del SaaS |
| rol `superadmin` (cliente) | **Admin** (dueño del negocio) | Total dentro de su cuenta |
| rol `editor` + `visor` | **Staff** (empleados) | Stock, pausar artículos, pedidos. Sin pagos/facturación/borrar tienda/reportes financieros |

### 2.1 — DB (`db/roles_v2.sql`, idempotente)
- `INSERT` de roles nuevos en `roles_permisos`:
  - `admin` → `"*"` (total dentro de la cuenta).
  - `staff` → `["productos","categorias","pedidos","stock"]` (sin `configuracion` de pagos, sin `negocios`, sin `analiticas` financieras).
- **Backfill**: `UPDATE usuarios SET rol='admin' WHERE rol='superadmin' AND es_plataforma=false`; `UPDATE usuarios SET rol='staff' WHERE rol IN ('editor','visor')`.
- Mantener filas viejas `superadmin/editor/visor` unos días por compatibilidad de tokens; luego limpiar.
- La identidad **SuperAdmin** sigue siendo el flag `es_plataforma` (server-side, no autoasignable) — se renombra solo en la UI.

### 2.2 — Backend
- Nuevo permiso granular `stock` para Staff (pausar/activar artículos, ajustar stock) separado de la edición completa de productos.
- `checkPermiso` sin cambios (ya lee de `roles_permisos`).
- Endpoint para que un **Admin** invite/gestione Staff de su cuenta (ya existe `usuariosController` scopeado; agregar restricción de que Admin solo puede crear rol `staff`, nunca `admin`/plataforma).

### 2.3 — Frontends
- Renombrar labels: "superadmin"→"SuperAdmin", el rol de cliente a "Admin", empleados a "Staff".
- Sidebar/guards por permiso (ya existe `hasPermiso` + `ProtectedRoute plataforma`).

### Hecho cuando
- Un Admin puede crear usuarios Staff con acceso limitado; el Staff no ve pagos ni reportes financieros ni puede borrar la tienda.

---

## FASE 3 — Migración a Lemon Squeezy (reemplaza Hotmart)

Lemon Squeezy como **Merchant of Record**: maneja impuestos, facturación recurrente y portal de cliente.

### 3.1 — DB (`db/lemonsqueezy.sql`, idempotente)
- Agregar a `cuentas`: `ls_customer_id`, `ls_subscription_id`, `ls_variant_id`, `ls_status`, `renueva_at TIMESTAMPTZ`.
- `origen` pasa a aceptar `'lemonsqueezy'`. Deprecar (no borrar aún) `hotmart_transaction`.
- Mapa `variant_id (LS) → plan/ciclo` (por env, como hoy con Hotmart).

### 3.2 — Backend (nuevo, deprecando Hotmart)
- `controllers/lemonSqueezyController.js` + `routes/lemonsqueezy.js`:
  - **Webhook** `POST /api/webhooks/lemonsqueezy`: verifica firma HMAC (`X-Signature` con `LEMONSQUEEZY_WEBHOOK_SECRET`), maneja `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_payment_success/failed`.
  - Upsert de `cuentas` por email → trigger recalcula límites (igual que hoy). Alta de usuario Admin + email de bienvenida (reusa `sendWelcomeEmail`).
  - Manejo de cancelaciones/upgrades/downgrades (hueco que Hotmart tenía pendiente).
- `utils/lemonSqueezyPlans.js`: mapea `variant_id → { plan, ciclo }`.
- **Checkout**: endpoint `GET /api/checkout/:plan` que arma la URL de checkout de LS (o links directos configurados por env).
- **Portal de cliente**: endpoint que devuelve la `customer portal URL` de LS para que el Admin gestione tarjeta/cancelación/facturas.

### 3.3 — Eliminación de Hotmart (una vez LS esté verificado)
- Borrar: `controllers/hotmartController.js`, `routes/hotmart.js`, `utils/hotmartPlans.js`, `db/hotmart_usuarios.sql` (la columna `cuenta_id` que agrega se mueve/mantiene en otra migración), tests `hotmartPlans.test.js`, `hotmartWebhook.test.js`.
- Quitar la ruta `/api/webhooks/hotmart` de `server.js` y el `express.urlencoded` si no se usa en otro lado.
- Quitar envs `HOTMART_*`.
- ⚠️ **No se borra hasta que LS procese al menos un pago de prueba correctamente** (sandbox de LS).

### Hecho cuando
- Una compra de prueba en LS crea cuenta+usuario+negocio, el Admin recibe email, y puede entrar al portal de LS desde el panel. Hotmart removido sin romper nada.

---

## FASE 4 — Mejoras técnicas finales

- **Cloudinary cropping dinámico**: componente de recorte en el admin (aspect ratio fijo por rubro) antes de subir; transformaciones (`c_fill`, `g_auto`) en la URL de entrega.
- **Hardening**: revisar rate limiters, validar exhaustivamente inputs de variantes/atributos, revisar CORS/allowed origins en prod.
- **RLS — DECISIÓN: NO se activa (documentado).** El backend accede a Supabase con la `service_role key`, que **bypassa RLS por diseño**. Activar RLS hoy: (a) no agrega seguridad —el aislamiento por `cuenta_id`/`negocio_id` ya se hace en la capa de app (middleware `scopeNegocio` + filtros por cuenta, verificado con tests); y (b) rompería el acceso solo si en el futuro se expusiera el `anon key` al cliente. La condición para reconsiderar RLS es migrar la autenticación a **Supabase Auth por-usuario** (que el frontend hable directo con Supabase con el token del usuario). Mientras el backend Express sea el único que toca la BD con `service_role`, **RLS es redundante** y se deja deshabilitado a propósito (como ya venía en todas las tablas: `DISABLE ROW LEVEL SECURITY`).

---

## Variables de entorno — `.env`

### ➕ AGREGAR (Lemon Squeezy)
```bash
# --- Lemon Squeezy (Merchant of Record) ---
LEMONSQUEEZY_API_KEY=                 # API key de la cuenta LS
LEMONSQUEEZY_STORE_ID=                # id de tu store en LS
LEMONSQUEEZY_WEBHOOK_SECRET=          # secret para verificar la firma HMAC del webhook

# Mapa variant_id (LS) → plan. Listas CSV, igual que Hotmart antes.
LEMONSQUEEZY_VARIANTS_BASIC=
LEMONSQUEEZY_VARIANTS_STANDARD=
LEMONSQUEEZY_VARIANTS_PREMIUM=
# Opcional: variants anuales (para detectar ciclo). Si no está, se asume mensual.
LEMONSQUEEZY_VARIANTS_BASIC_ANNUAL=
LEMONSQUEEZY_VARIANTS_STANDARD_ANNUAL=
LEMONSQUEEZY_VARIANTS_PREMIUM_ANNUAL=

# Links de checkout directos (alternativa a construirlos por API)
LEMONSQUEEZY_CHECKOUT_BASIC=
LEMONSQUEEZY_CHECKOUT_STANDARD=
LEMONSQUEEZY_CHECKOUT_PREMIUM=
```

### ➖ ELIMINAR (Hotmart, al terminar Fase 3)
```bash
HOTMART_HOTTOK
HOTMART_PRODUCTS_BASIC / _STANDARD / _PREMIUM
HOTMART_PRODUCTS_BASIC_ANNUAL / _STANDARD_ANNUAL / _PREMIUM_ANNUAL
```

### 🔄 ROTAR (Fase 0 — ya expuestas en el repo)
```bash
SUPABASE_SERVICE_ROLE_KEY   # nueva key en Supabase
CLOUDINARY_API_SECRET       # regenerar
RESEND_API_KEY              # revocar + nueva
JWT_SECRET                  # nuevo secret fuerte
```

### ✅ SE MANTIENEN
`PORT`, `SUPABASE_URL`, `ADMIN_URL`, `ALLOWED_ORIGINS`, `VITE_MENU_URL`, `EMAIL_FROM`, `PLAN_PRECIO_*` (siguen alimentando el MRR del panel), `OPENROUTER_*`, `WHATSAPP_*`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`.

---

## Orden de ejecución recomendado

1. **Fase 0** (seguridad) — hazlo ya, es bloqueante y no depende de mí para rotar claves.
2. **Fase 1** (multi-rubro) — el diferencial de producto.
3. **Fase 2** (roles) — se apoya en que multi-rubro ya definió el vocabulario.
4. **Fase 3** (Lemon Squeezy) — con Hotmart vivo hasta verificar LS.
5. **Fase 4** (cropping + hardening).

Cada fase se aprueba y ejecuta por separado.
