# Auditoría del panel admin (frontend-admin) — 2026-11-07

Hecha con el subagente **web-auditor** (sólo lectura). Base para el rediseño del panel en la paleta "Hora pico, versión trabajo".

## Lo más importante

1. **No hay paleta central.** Hay unos 616 códigos de color en 35 archivos y 268 usos de `isDark` en 24 archivos. Hay tres "superficies oscuras" distintas (`#1a1d27`, `#151924`, `#13151c`) y cuatro estilos de botón (azul `#3b82f6`, cian, Tailwind blanco y ají del login).
2. **Pantallas siempre oscuras**, aunque elijas modo claro: Onboarding, CambiarPassword, ResetPassword, la pantalla de error de ProtectedRoute y NotFound.
3. **Modo oscuro roto a medias** en Usuarios:
   - el nombre del usuario sale en `#1e293b`, casi invisible sobre fondo oscuro;
   - los colores de rol no tienen contraste suficiente en modo claro.

   VariantesEditor no tiene modo oscuro.
4. **El layout se vuelve a montar en cada página** (`<AdminLayout>` dentro de cada pantalla). Al navegar:
   - se reinician los 3 consultas automáticas (pedidos, chats y stock);
   - la pantalla de carga espera como mínimo 650 ms cada vez;
   - se pierde el estado del menú lateral.
5. **El Dashboard descarga todos los pedidos** con sus ítems (`/pedidos` sin límite) sólo para contar los de hoy y mostrar 6. Supabase corta en 1000 filas, así que con el tiempo los números quedarían incompletos.
6. **Accesibilidad:**
   - la navegación usa botones en vez de enlaces (no se puede abrir en otra pestaña y no marca la página actual);
   - casi no hay foco visible;
   - el modal no atrapa el foco;
   - los textos tenues tienen poco contraste;
   - hay muchos textos de 10–11 px;
   - algunos estados se muestran sólo con color.
7. **Celular:**
   - el corte para celular depende de JavaScript, así que primero se ve el diseño equivocado;
   - entre 769 y 1023 px el menú queda sólo con íconos;
   - hay 5 tablas con scroll horizontal;
   - el botón de tema mide 28×24 px.

## Arquitectura propuesta

- `src/styles/tokens.css` con variables en `:root` y `[data-theme="dark"]`, conectadas a Tailwind con `@theme inline`:
  - superficies: `--bg`, `--surface`, `--surface-2`;
  - texto: `--fg`, `--fg-2`, `--fg-3`;
  - bordes: `--line`;
  - acento y foco: `--accent`, `--focus`;
  - estados: `--ok`, `--warn`, `--err`, `--info` y su fondo;
  - estados de pedido: `--st-*`;
  - gráficos: `--chart-1..6`.
- `ThemeProvider` y `theme-init.js` ponen `data-theme` en `<html>`. El valor inicial sigue `prefers-color-scheme`.
- `sharedStyles.ts` pasa a usar `var(--…)`. Con eso, 9 pantallas se migran sin tocarlas.
- Componentes compartidos que faltan:
  - Button, Card/Stat, DataTable (con tarjetas en celular);
  - Field, Badge/StatusPill, EmptyState, Skeleton, PageHeader;
  - AdminShell con Sidebar y Topbar separados.

## Dashboard: gráficos propuestos (SVG propio, ~5 KB, sin librería)

1. Ventas por día (7/30 días) comparadas con el período anterior. Necesita el endpoint nuevo `GET /analiticas/dias`.
2. Pedidos por tipo de entrega (mesa / delivery / retiro).
3. Horas pico (día × hora, en hora de Argentina).
4. Productos más vendidos, por unidades o por ganancia.
5. Ticket promedio y margen por mes.
6. Plataforma: planes y MRR. Los datos ya existen.

## Fases (cada una se puede entregar sola)

| Fase | Qué | Riesgo |
|---|---|---|
| 0 | Tokens claro/oscuro, `data-theme` en `<html>`, sin cambios visibles | bajo |
| 1 | Componentes compartidos + `sharedStyles` con tokens → 9 pantallas migradas | bajo |
| 2 | Shell: layout de ruta, enlaces reales, barra inferior en celular, modal accesible | medio |
| 3 | Dashboard con gráficos + endpoints livianos en el backend | medio |
| 4 | Pedidos, Chats, Productos, Categorías (tarjetas en celular, estados únicos) | medio |
| 5 | Configuración, Mi cuenta, Variantes, WhatsApp, Suscripción, Plataforma | alto |
| 6 | Pantallas siempre oscuras al estilo "Hora pico" + limpieza | bajo |

En cada fase hay que verificar:
- contraste de al menos 4,5:1 en los dos temas;
- foco visible;
- botones táctiles de 44 px;
- que no haya scroll horizontal a 360 px.

No migrar `lib/ticket.ts`: es para imprimir en blanco y negro.
