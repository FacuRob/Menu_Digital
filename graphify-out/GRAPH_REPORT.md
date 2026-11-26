# Graph Report - Menu_Digital  (2026-11-08)

## Corpus Check
- 197 files · ~133,699 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: .css 6, (none) 3, .example 2)

## Summary
- 1454 nodes · 3429 edges · 85 communities (55 shown, 30 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 200 edges (avg confidence: 0.86)
- Token cost: 215,048 input · 0 output

## Community Hubs (Navigation)
- Landing pública y demo
- Panel: API y pantallas de mensajería
- Panel: layout, auth y negocio
- Panel: productos y categorías
- Backend: autenticación
- Backend: IA, chats y WhatsApp
- Backend: dependencias y keep-alive
- Backend: base de datos y suscripción
- Backend: controladores CRUD
- Panel: Dashboard y gráficos
- Panel: login, cuenta e idioma
- Producto y diseño (docs)
- Panel: pedidos y tickets
- Backend: servidor y middlewares
- Panel: App y tema
- Panel: configuración del negocio
- Deploy en Render
- Menú público: dependencias
- Menú público: modal y paleta
- Backend: analíticas y actividad
- Backend: avisos de pedido
- Panel: íconos, negocios y onboarding
- Panel: i18n y plataforma
- Backend: negocios y alcance
- Menú público: carta y horarios
- Config TS del panel (app)
- Menú público: servicios API
- Config TS del menú (app)
- Plan de transformación SaaS
- Config TS del panel (node)
- Config TS del menú (node)
- Avisos de pedido por WhatsApp (docs)
- Menú público: devDependencies
- Panel: dependencias
- Pagos con Lemon Squeezy
- Backend: usuarios
- Tests: mocks de Supabase
- Panel: diálogos y modales
- Panel: devDependencies
- GitHub Actions keep-alive
- Backend: variantes de producto
- Tests: cuenta y negocio
- Tests: scopeNegocio
- Menú público: rutas
- Menú público: carrito y tarjetas
- Menú público: i18n
- Webhooks y comparación segura
- Backend: pedidos
- Auditoría del panel (docs)
- Tests: Lemon Squeezy
- Menú público: hook del carrito
- Scripts npm del panel
- Scripts npm del menú
- Roles y multi-tenant (docs)
- Menú: tipos y eslint
- tsconfig raíz del panel
- tsconfig raíz del menú
- Gráficos propios (docs)
- Dep: baseline-browser-mapping (panel)
- Dep: react-hooks lint (panel)
- Dep: react-refresh lint (panel)
- Dep: globals (panel)
- Dep: tailwindcss (panel)
- Dep: @types/node (panel)
- Dep: @types/qrcode (panel)
- Dep: @types/react (panel)
- Dep: @types/react-dom (panel)
- Dep: @types/react-router-dom (panel)
- Dep: vite (panel)
- Dep: plugin-react (panel)
- READMEs plantilla Vite
- Dep: baseline-browser-mapping (menú)
- Dep: react-hooks lint (menú)
- Dep: react-refresh lint (menú)
- Dep: tailwind postcss (menú)
- Dep: @types/node (menú)
- Dep: @types/react (menú)
- Dep: @types/react-router-dom (menú)
- Dep: plugin-react (menú)

## God Nodes (most connected - your core abstractions)
1. `respondError()` - 80 edges
2. `useLang()` - 62 edges
3. `getNegocioId()` - 51 edges
4. `App()` - 28 edges
5. `supabase` - 27 edges
6. `AdminLayout()` - 26 edges
7. `base()` - 26 edges
8. `Productos()` - 26 edges
9. `Dashboard()` - 23 edges
10. `useNegocio()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Hora pico direction thesis` --semantically_similar_to--> `DESIGN.md — DinexFlow design system`  [INFERRED] [semantically similar]
  .impeccable/surfaces/frontend-src-pages-landing-tsx.md → DESIGN.md
- `dx-home class: no-flash background script` --semantically_similar_to--> `public/theme-init.js + ThemeContext`  [INFERRED] [semantically similar]
  frontend/index.html → DESIGN.md
- `frontend README (Vite React TS template)` --semantically_similar_to--> `frontend-admin README (Vite React TS template)`  [INFERRED] [semantically similar]
  frontend/README.md → frontend-admin/README.md
- `Landing surface brief (Landing.tsx)` --references--> `Argentine gastronomic business owners (voseo)`  [EXTRACTED]
  .impeccable/surfaces/frontend-src-pages-landing-tsx.md → PRODUCT.md
- `Landing surface brief (Landing.tsx)` --references--> `14-day free trial without card`  [EXTRACTED]
  .impeccable/surfaces/frontend-src-pages-landing-tsx.md → PRODUCT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-tenant isolation flow (JWT cuenta_id → scopeNegocio → NegocioContext)** — saas_suscripciones_get_auth_scope, saas_suscripciones_scope_negocio, frontend_admin_src_context_negociocontext, saas_suscripciones_es_plataforma [EXTRACTED 1.00]
- **Plan limits enforcement (trigger, middlewares, /api/plan)** — saas_suscripciones_set_limites_por_plan, saas_suscripciones_check_limite_middlewares, saas_suscripciones_plan_endpoint, saas_suscripciones_data_model [EXTRACTED 1.00]
- **Hora pico landing world** — _impeccable_surfaces_frontend_src_pages_landing_tsx_hora_pico_thesis, design_color_palette, design_typography_archivo_bodoni, design_motion_lenis_gsap, design_telefono_tsx, design_landing_css [INFERRED 0.85]
- **Fases del plan de transformación SaaS** — docs_plan_transformacion_saas_fase0_seguridad, docs_plan_transformacion_saas_fase1_multirubro, docs_plan_transformacion_saas_fase2_roles, docs_plan_transformacion_saas_fase3_lemonsqueezy, docs_plan_transformacion_saas_fase4_hardening [EXTRACTED 1.00]
- **Flujo de notificación de cambio de estado por WhatsApp** — docs_notificaciones_pedido_ia_whatsapp_updateestadopedido, docs_notificaciones_pedido_ia_whatsapp_notificacionpedidoservice, docs_notificaciones_pedido_ia_whatsapp_iaservice, docs_notificaciones_pedido_ia_whatsapp_whatsappservice [EXTRACTED 1.00]
- **Arquitectura de tema claro/oscuro del panel admin** — docs_auditoria_panel_admin_design_tokens, docs_auditoria_panel_admin_themeprovider, docs_auditoria_panel_admin_shared_components, docs_auditoria_panel_admin_paleta_hora_pico [INFERRED 0.85]

## Communities (85 total, 30 thin omitted)

### Community 0 - "Landing pública y demo"
Cohesion: 0.05
Nodes (71): Landing surface brief (Landing.tsx), Previous world 'Comanda del mozo' (rejected), Reference site iventions.com, Signature scene: del QR al WhatsApp, DESIGN.md — DinexFlow design system, Motion: Lenis + GSAP ScrollTrigger under matchMedia, OrderDemo.tsx (demo Probalo), QrCodigo + portal clip-path (+63 more)

### Community 1 - "Panel: API y pantallas de mensajería"
Cohesion: 0.05
Nodes (53): boton, darkS, lightS, pill, S, useTheme(), Chats(), CHECK (+45 more)

### Community 2 - "Panel: layout, auth y negocio"
Cohesion: 0.07
Nodes (40): AdminShell(), beep(), I, ItemNav, NAV, rolLabel, RUTAS_ABAJO, useCerrarAfuera() (+32 more)

### Community 3 - "Panel: productos y categorías"
Cohesion: 0.09
Nodes (47): AdminLayout(), Modal(), useStyles(), Switch(), EditGrupo, fromServer(), inputStyle, VariantesEditor() (+39 more)

### Community 4 - "Backend: autenticación"
Cohesion: 0.07
Nodes (47): bcrypt, buildResetUrl(), buildUsername(), changeEmail(), changePassword(), crearCuentaConNegocio(), crypto, forgotPassword() (+39 more)

### Community 5 - "Backend: IA, chats y WhatsApp"
Cohesion: 0.08
Nodes (45): cambiarIAChat(), chatDelNegocio(), enviarSaliente(), iaPausada(), listarChats(), mensajesDelChat(), negocioDelTelefono(), PAUSA_IA_MS() (+37 more)

### Community 6 - "Backend: dependencias y keep-alive"
Cohesion: 0.05
Nodes (45): author, dependencies, bcryptjs@^3.0.3, cloudinary@^2.10.0, cors@^2.8.5, dotenv@^17.2.3, express@^5.1.0, express-rate-limit@^8.5.2 (+37 more)

### Community 7 - "Backend: base de datos y suscripción"
Cohesion: 0.09
Nodes (27): { createClient }, supabase, getPlan(), getResumen(), catalogoPlanes(), getCheckout(), getEstado(), checkLimiteNegocios() (+19 more)

### Community 8 - "Backend: controladores CRUD"
Cohesion: 0.14
Nodes (37): createCategoria(), deleteCategoria(), getCategoriaById(), getCategorias(), getCategoriasActivas(), updateCategoria(), createProducto(), deleteProducto() (+29 more)

### Community 9 - "Panel: Dashboard y gráficos"
Cohesion: 0.10
Nodes (38): compacto(), DatosTabla(), GraficoBarras(), GraficoLinea(), Leyenda(), MapaCalor(), Ranking(), Reparto() (+30 more)

### Community 10 - "Panel: login, cuenta e idioma"
Cohesion: 0.14
Nodes (34): AccesoLayout(), AvisoAcceso(), CampoClave(), ErrorAcceso(), Campo(), CuentaModal(), CuentaTab, Estilos (+26 more)

### Community 11 - "Producto y diseño (docs)"
Cohesion: 0.06
Nodes (33): Backend README — REST API, API routes: /api/auth, /api/categorias, /api/productos, Backend stack: Node, Express, PostgreSQL, JWT, bcryptjs, bcrypt, components/Acceso.tsx (access screens, fase 6), Panel admin: Hora pico, versión trabajo, frontend-admin/src/styles/tokens.css, AdminShell route layout (AdminLayout.tsx + shell.css) (+25 more)

### Community 12 - "Panel: pedidos y tickets"
Cohesion: 0.12
Nodes (34): PrinterButton(), Props, TicketModal(), useNegocio(), IconPhone(), IconReceipt(), IconTruck(), fmtMoney() (+26 more)

### Community 13 - "Backend: servidor y middlewares"
Cohesion: 0.09
Nodes (25): keepAlive(), getCuentas(), getPortal(), authMiddleware(), jwt, checkPermiso(), express, router (+17 more)

### Community 14 - "Panel: App y tema"
Cohesion: 0.12
Nodes (28): AdminShell, App(), CambiarPassword, Cargando(), Categorias, Chats, Configuracion, Dashboard (+20 more)

### Community 15 - "Panel: configuración del negocio"
Cohesion: 0.11
Nodes (26): ConfiguracionEditor(), DIA_KEYS, EMPTY, Form, GRUPOS, HorariosEditor(), horariosTemplate(), IconClock() (+18 more)

### Community 16 - "Deploy en Render"
Cohesion: 0.07
Nodes (26): databases, databaseName, name, user, fromDatabase, generateValue, key, value (+18 more)

### Community 17 - "Menú público: dependencias"
Cohesion: 0.11
Nodes (25): dependencies, axios@^1.13.2, @fontsource/bodoni-moda@^5.3.0, @fontsource-variable/archivo@^5.3.0, gsap@^3.15.1, @gsap/react@^2.1.2, lenis@^1.3.27, qrcode@^1.5.4 (+17 more)

### Community 18 - "Menú público: modal y paleta"
Cohesion: 0.12
Nodes (23): ProductModal(), Sel, StepBtn(), cld(), CldOpts, darken(), DefaultFoodImage(), hexToRgb() (+15 more)

### Community 19 - "Backend: analíticas y actividad"
Cohesion: 0.14
Nodes (20): DIAS_VALIDOS, getActividad(), getHistorial(), getResumen(), keyDe(), MESES_ABBR, express, router (+12 more)

### Community 20 - "Backend: avisos de pedido"
Cohesion: 0.15
Nodes (22): DEFAULTS(), getConfiguracion(), RUBROS, updateConfiguracion(), express, router, avisoDe(), AVISOS (+14 more)

### Community 21 - "Panel: íconos, negocios y onboarding"
Cohesion: 0.16
Nodes (22): base(), IconBag(), IconBan(), IconBell(), IconBox(), IconList(), IconNote(), IconPin() (+14 more)

### Community 22 - "Panel: i18n y plataforma"
Cohesion: 0.11
Nodes (22): detectLang(), Dict, DICTS, en, es, I18nContext, I18nContextType, Lang (+14 more)

### Community 23 - "Backend: negocios y alcance"
Cohesion: 0.18
Nodes (16): createNegocio(), deleteNegocio(), getNegocioPublicoBySlug(), getNegocios(), RUBROS, updateNegocio(), requirePlataforma(), scopeNegocio() (+8 more)

### Community 24 - "Menú público: carta y horarios"
Cohesion: 0.17
Nodes (22): CategoriaIcon(), setMonedaMenu(), abiertoAhora(), CategoryBar(), Chip(), CIcon(), contactIcons, FooterLine() (+14 more)

### Community 25 - "Config TS del panel (app)"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 26 - "Menú público: servicios API"
Cohesion: 0.09
Nodes (20): api, authService, categoriasService, Configuracion, FranjaHoraria, HorariosConfig, LoginResponse, NegocioPublico (+12 more)

### Community 27 - "Config TS del menú (app)"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 28 - "Plan de transformación SaaS"
Cohesion: 0.12
Nodes (20): Propuestas de Mejoras de Arquitectura, Cropping dinámico de imágenes en Cloudinary, Lemon Squeezy como Merchant of Record, Multi-tenancy con tenant_id y RLS, Sistema de Roles RBAC (SuperAdmin/Admin/Staff), Middlewares Express de verificación de rol, Plataforma SaaS Multi-rubro, Plan de Transformación SaaS (+12 more)

### Community 29 - "Config TS del panel (node)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 30 - "Config TS del menú (node)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 31 - "Avisos de pedido por WhatsApp (docs)"
Cohesion: 0.15
Nodes (18): Notificaciones de pedido (IA + WhatsApp) — diseño original, fallbackMensaje, iaService.generarMensajeEstado (OpenRouter), notificacionPedidoService.notificarCambioEstado, Adaptador de proveedor WhatsApp (WHATSAPP_PROVIDER), pedidosController.updateEstadoPedido (PUT /api/pedidos/:id/estado), Ventana de 24 h de WhatsApp (texto libre vs plantilla), whatsappService (enviarTexto, enviarPlantilla, normalizarTelefono) (+10 more)

### Community 32 - "Menú público: devDependencies"
Cohesion: 0.11
Nodes (19): devDependencies, autoprefixer@^10.4.22, eslint@^9.39.1, globals@^16.5.0, postcss@^8.5.6, tailwindcss@^4.1.17, @types/react-dom@^19.2.3, typescript@~5.9.3 (+11 more)

### Community 33 - "Panel: dependencias"
Cohesion: 0.15
Nodes (17): dependencies, axios@^1.13.2, @fontsource-variable/archivo@^5.3.0, qrcode@^1.5.4, react@^19.2.0, react-dom@^19.2.0, react-router-dom@^7.9.6, axios (+9 more)

### Community 34 - "Pagos con Lemon Squeezy"
Cohesion: 0.22
Nodes (13): asegurarNegocio(), bcrypt, buildUsername(), buscarCuentaVinculada(), crypto, estadoDeLS(), firmaValida(), generarPassword() (+5 more)

### Community 35 - "Backend: usuarios"
Cohesion: 0.29
Nodes (14): bcrypt, cambiarPassword(), createUsuario(), deleteUsuario(), getRoles(), getTargetUsuario(), getUsuarioById(), getUsuarios() (+6 more)

### Community 36 - "Tests: mocks de Supabase"
Cohesion: 0.16
Nodes (10): assert, crypto, db, { test, beforeEach, afterEach }, createSupabaseMock(), injectModule(), assert, db (+2 more)

### Community 37 - "Panel: diálogos y modales"
Cohesion: 0.17
Nodes (8): COLOR, Dialogo(), DialogosProvider(), FONDO, Pedido, Tipo, DialogosApi, DialogosContext

### Community 38 - "Panel: devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.4.22, eslint@^9.39.1, @eslint/js@^9.39.1, postcss@^8.5.6, @tailwindcss/postcss@^4.1.17, typescript@~5.9.3, typescript-eslint@^8.46.4 (+7 more)

### Community 39 - "GitHub Actions keep-alive"
Cohesion: 0.14
Nodes (13): KEEPALIVE_URL, jobs, ping, name, on, schedule, workflow_dispatch, runs-on (+5 more)

### Community 40 - "Backend: variantes de producto"
Cohesion: 0.31
Nodes (10): createGrupo(), deleteGrupo(), fetchGruposConOpciones(), getVariantesProducto(), grupoDelNegocio(), productoDelNegocio(), updateGrupo(), validate() (+2 more)

### Community 41 - "Tests: cuenta y negocio"
Cohesion: 0.18
Nodes (8): assert, db, dbPath, { test, beforeEach }, assert, { test }, assert, { test }

### Community 42 - "Tests: scopeNegocio"
Cohesion: 0.17
Nodes (10): assert, cuentaPath, db, dbPath, makeRes(), res, NEGOCIOS, run() (+2 more)

### Community 43 - "Menú público: rutas"
Cohesion: 0.26
Nodes (8): App(), Cargando(), Landing, Menu, NotFound(), Privacidad, Privacidad(), Seccion()

### Community 44 - "Menú público: carrito y tarjetas"
Cohesion: 0.33
Nodes (12): CartDrawer(), EmptyView(), Field(), Footer(), inputStyle, labelStyle, MiniBtn(), SuccessView() (+4 more)

### Community 45 - "Menú público: i18n"
Cohesion: 0.17
Nodes (12): detectLang(), Dict, DICTS, en, es, I18nContext, I18nContextType, Lang (+4 more)

### Community 46 - "Webhooks y comparación segura"
Cohesion: 0.17
Nodes (7): verificarWebhook(), crypto, safeEqual(), assert, crypto, db, { test, beforeEach, afterEach }

### Community 47 - "Backend: pedidos"
Cohesion: 0.33
Nodes (9): avisarEnSegundoPlano(), createPedido(), ESTADOS_VALIDOS, getPedidoById(), getPedidos(), sinCosto(), updateEstadoPedido(), express (+1 more)

### Community 48 - "Auditoría del panel (docs)"
Cohesion: 0.20
Nodes (11): Auditoría del panel admin (2026-11-07), Hallazgos de accesibilidad y celular, Gráficos SVG propios del Dashboard, Problema: Dashboard descarga todos los pedidos, tokens.css con data-theme y @theme inline, Fases 0–6 del rediseño del panel, Problema: AdminLayout se remonta en cada página, Paleta "Hora pico, versión trabajo" (+3 more)

### Community 49 - "Tests: Lemon Squeezy"
Cohesion: 0.20
Nodes (6): assert, crypto, db, emails, llamar(), { test, beforeEach }

### Community 51 - "Menú público: hook del carrito"
Cohesion: 0.32
Nodes (7): Cart, CartApi, CartLine, lineKey(), SelectedOption, useCart(), Producto

### Community 52 - "Scripts npm del panel"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 53 - "Scripts npm del menú"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 54 - "Roles y multi-tenant (docs)"
Cohesion: 0.40
Nodes (5): Platform god-mode role (usuarios.es_plataforma), utils/cuenta.js getAuthScope / getCuentaId, requirePlataforma middleware + /api/plataforma endpoints, Roles superadmin/editor/visor (roles_permisos), scopeNegocio middleware (multi-tenant isolation)

### Community 56 - "Menú: tipos y eslint"
Cohesion: 0.33
Nodes (4): @eslint/js@^9.39.1, @types/qrcode@^1.5.6, @eslint/js, @types/qrcode

## Ambiguous Edges - Review These
- `Plans: Basic 9.99 / Standard 19.99 / Premium 39.99 USD` → `PLAN_PRECIO_* env vars (MRR)`  [AMBIGUOUS]
  SAAS_SUSCRIPCIONES.md · relation: conceptually_related_to

## Knowledge Gaps
- **36 isolated node(s):** `Typography: Archivo Variable + Bodoni Moda accent`, `QrCodigo + portal clip-path`, `Pricing section (Basic/Standard/Premium, USD)`, `AdminShell route layout (AdminLayout.tsx + shell.css)`, `components/charts.tsx (own SVG charts)` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 452 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Plans: Basic 9.99 / Standard 19.99 / Premium 39.99 USD` connect `Producto y diseño (docs)` to `Panel: i18n y plataforma`?**
  _High betweenness centrality (0.335) - this node is a cross-community bridge._
- **What connects `Typography: Archivo Variable + Bodoni Moda accent`, `QrCodigo + portal clip-path`, `Pricing section (Basic/Standard/Premium, USD)` to the rest of the system?**
  _36 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing pública y demo` be split into smaller, more focused modules?**
  _Cohesion score 0.05253077975376197 - nodes in this community are weakly interconnected._
- **Why does `PLAN_PRECIO_* env vars (MRR)` connect `Panel: i18n y plataforma` to `Producto y diseño (docs)`?**
  _High betweenness centrality (0.262) - this node is a cross-community bridge._
- **Should `Panel: API y pantallas de mensajería` be split into smaller, more focused modules?**
  _Cohesion score 0.050816696914700546 - nodes in this community are weakly interconnected._
- **Should `Panel: layout, auth y negocio` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Plans: Basic 9.99 / Standard 19.99 / Premium 39.99 USD` and `PLAN_PRECIO_* env vars (MRR)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._