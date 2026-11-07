---
name: DinexFlow
description: Carta digital con QR y pedidos que llegan ordenados al WhatsApp del local. Mundo visual "Hora pico" (landing pública).
colors:
  hueso: "#efede6"
  hueso-2: "#e4e1d8"
  aji: "#ff5b24"
  aji-deep: "#e8470f"
  tinta: "#111216"
  tinta-2: "#1c1d23"
  cobalto: "#3b3bf5"
  cobalto-deep: "#2626c9"
  blanco: "#ffffff"
  gris: "#5b5d66"
  gris-claro: "#a9abb4"
  wa-header: "#0b3d36"
  wa-ground: "#efeae2"
  wa-bubble: "#d9fdd3"
  wa-ink: "#111b21"
  wa-meta: "#4a5a63"
  wa-tick: "#2f8fc6"
typography:
  display-xl:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontStretch: "125%"
    fontWeight: 800
    lineHeight: 0.82
    letterSpacing: "-0.045em"
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6.1vw, 7.5rem)"
    fontStretch: "118%"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.035em"
  accent:
    fontFamily: "Bodoni Moda, Georgia, serif"
    fontStyle: italic
    fontWeight: 400
    letterSpacing: "-0.015em"
  label:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontStretch: "112%"
    fontWeight: 600
    letterSpacing: "0.04em"
    textTransform: uppercase
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  surface: "28px"
  pill: "999px"
components:
  button-primary: "Pastilla ají, texto tinta, 52px de alto"
  button-dark: "Pastilla tinta sobre fondos ají"
  button-outline: "Pastilla con borde de 2px en currentColor"
---

# Design System: DinexFlow

Fuente de verdad: `frontend/src/components/landing/landing.css` (tokens bajo `.dx`) y `frontend/src/pages/Landing.tsx`. Alcance: sólo la landing pública (`/`). Menu.tsx y frontend-admin no usan este mundo.

## Overview

**Hora pico.** La página se mueve como un local en plena hora pico: el scroll es el servicio. El QR del inicio se abre hasta llenar la pantalla de tinta, el manifiesto se enciende palabra por palabra, el teléfono queda fijo mientras el pedido viaja del cliente al WhatsApp del local, y los bloques de color cambian de golpe como cambia el turno.

Bloques plenos a todo el ancho que se alternan (hueso, ají, tinta, cobalto), grotesca ensanchada gigante y escenas fijadas con scroll suave. Gramática de movimiento tomada de https://iventions.com/ (escenas fijadas, tipografía enorme, bloques de color), no su marca.

Rechaza: el SaaS de tarjetas con teléfono flotante y sombra, la página estática y el mundo anterior "Comanda del mozo" (el dueño lo sintió antiguo).

Orden de secciones y su bloque de color:

| Sección | Fondo | Barra |
|---|---|---|
| Inicio (QR → portal) | hueso → tinta | claro → oscuro |
| Manifiesto | tinta | oscuro |
| Escena "Del QR a tu WhatsApp" | ají | claro |
| Probalo (demo) | cobalto | oscuro |
| Funciones | tinta | oscuro |
| Rubros | hueso | claro |
| Precios | hueso | claro |
| Preguntas | hueso | claro |
| Cierre | ají | claro |
| Pie (wordmark gigante) | tinta | oscuro |

## Colors

### Primary
- **Ají** `#ff5b24`: la acción (pastillas "Probar gratis"), la segunda línea del titular, los bloques de la escena del teléfono y del cierre. Hover `#e8470f`. El texto encima es siempre tinta, nunca blanco.

### Secondary
- **Cobalto** `#3b3bf5`: un solo bloque (la demo "Probalo") y el foco por defecto. Hover de botones oscuros. Texto encima: blanco.

### Neutral
- **Hueso** `#efede6`: fondo base y `theme-color`. `#e4e1d8` para superficies dentro del hueso.
- **Tinta** `#111216`: texto, bloques oscuros, portal del inicio, ficha QR. `#1c1d23` para superficies sobre tinta.
- **Gris** `#5b5d66` (secundario sobre hueso) y `#a9abb4` (secundario sobre tinta).

### Colores de WhatsApp (citados, no propios)
`wa-*` sólo dentro del mensaje de WhatsApp de ejemplo, para que se reconozca la app. Nunca fuera de ese componente.

### Named Rules
- **Bloques plenos.** Un color por sección, a todo el ancho. Sin degradados, sin vidrio, sin bloques "suaves" a medio tono.
- **La barra copia la sección.** La barra fija toma el fondo (`--nav-fondo`) y el tono de texto (`data-tema`) de la sección que tiene debajo; nada se imprime bajo los links.
- **Foco según el fondo.** `--focus`: cobalto sobre hueso, ají sobre tinta, blanco sobre cobalto, tinta sobre ají, `currentColor` en la barra.

## Typography

- **Archivo Variable** (eje `wdth` 62–125, `wght` 100–900) para todo. Los titulares van ensanchados (118–125%) y en 800, con interletra apretada.
- **Bodoni Moda itálica** sólo para frases cortas de acento ("Escaneá. y pedí." en el portal). Nunca en párrafos ni botones.

### Hierarchy
- **display-xl**: contador 01/02/03, wordmark del pie, rubros. `font-stretch:125%`, `line-height:0.82`.
- **display**: h1 en dos bloques ("Tu carta en el celu." / "El pedido, en tu WhatsApp."), h2 de cada sección, títulos de pasos y planes.
- **label**: rótulos en mayúscula (`.dx-label`), "Ejemplo · Sushi Zen", "Recomendado".
- **body**: 1.0625–1.125rem, `leading-relaxed`, máximo ~34rem de ancho.
- Precios y cantidades con `tabular-nums` (`.dx-tabular`).

### Named Rules
- **Dos frases enteras.** El h1 nunca parte una frase entre líneas en escritorio: cada frase es un bloque.
- **Letra calada.** En rubros alternan filas sólidas y caladas (`-webkit-text-stroke: 2px` tinta, con fallback `@supports`).

## Layout

- Contenedor común (`CONTENEDOR`) con márgenes laterales amplios; cada sección ocupa al menos `100svh` cuando es escena.
- Escena del teléfono en escritorio: grilla `pasos | teléfono | contador` (`minmax(0,1fr) auto minmax(0,0.7fr)`), teléfono centrado y del alto de la pantalla.
- Precios: tres tarjetas con fila de encabezado de alto fijo (`min-h-[2.75rem]`) para alinear precio y lista; "Recomendado" va en línea junto al nombre.
- Breakpoints: 640px (`sm`), 1024px (`lg`, donde empiezan las escenas fijadas del inicio y el contador).

## Elevation & Depth

Sin sombras decorativas, tampoco en el teléfono. La profundidad sale del cambio de bloque de color y del orden de capas (portal sobre el inicio, pantallas apiladas en el teléfono). La única "sombra" es el filete de 2px tinta (`box-shadow` como borde) del botón de la barra, para separarlo del ají.

## Shapes

- **28px** (`--radio`) en superficies: tarjetas de precio, ficha QR, demo, mensaje.
- **Pastilla** (`999px`) en todas las acciones, toggles y badges.
- El teléfono es una forma dibujada (marco tinta, isla), sin sombra.

## Components

### Buttons
- `.dx-btn`: pastilla ají, texto tinta, 52px de alto, 700 ensanchado; hover `aji-deep`, `:active` scale 0.97, flecha que se corre 3px.
- `.dx-btn.dx-btn-oscuro`: tinta con texto blanco, para fondos ají (cierre). Hover cobalto.
- `.dx-btn.dx-btn-nav`: la pastilla de la barra, con filete tinta.
- `.dx-btn-borde`: borde 2px `currentColor`, para acciones secundarias.

### Navigation
Dos capas fijas: la de fondo y texto (`.dx-nav`, cambia con la sección) y la de acciones (logo, "Probar gratis", hamburguesa) encima. En el celular, panel `nav#menu-movil`; Escape cierra y devuelve el foco.

### Ficha QR y portal (inicio)
Ficha tinta con un QR real (`QrCodigo`, un solo `<path>` SVG con zona de silencio de 4 módulos) que apunta a `/#probalo`. En escritorio, al scrollear, la ficha viaja al centro y crece mientras el portal de tinta se abre con `clip-path` desde su caja hasta `inset(0)`, y aparece "Escaneá. y pedí." en Bodoni.

### Teléfono (escena firma)
`Telefono.tsx`: tres pantallas (`data-pantalla` 1–3: escaneo, carta, chat) apiladas. Rotulado "Ejemplo · Sushi Zen". En escritorio los pasos a la izquierda se encienden de a uno (los demás al 45%) y el contador gigante 01/02/03 rueda a la derecha; los números en línea de los pasos se ocultan cuando el contador está a la vista.

### Funciones
Lista de filas en tinta; la fila activa (clase `is-activa`, por ScrollTrigger) pasa a hueso pleno, las demás quedan mezcladas al 48%.

### Precios
Tres planes (Basic, Standard recomendado en ají, Premium en tinta). Selector Mensual/Anual con radios reales (`fieldset.dx-toggle`) y línea `aria-live`. Precio en USD, "pagás online con tarjeta, en dólares".

### Demo "Probalo"
`OrderDemo.tsx` sobre cobalto: el visitante elige un local de ejemplo, suma productos, envía y ve el mensaje de WhatsApp; al enviar, el mensaje recibe foco y aparece "Armá la tuya gratis".

## Motion

- **Lenis** (`lerp 0.11`, anclas con offset −72px) movido por el ticker de GSAP; **ScrollTrigger** con `scrub` para las escenas.
- Todo bajo `gsap.matchMedia`: sin `prefers-reduced-motion` y, para el portal y el contador, sólo ≥1024px.
- Escenas: inicio fijado `+=110%`; manifiesto palabra por palabra (0.4 → 1); teléfono fijado `+=230%` con tres pasos; funciones fila por fila; rubros que se deslizan en `xPercent`; cierre que escala desde 0.82; wordmark que sube.
- Curvas: `power2.inOut` para cambios de pantalla, `power3.inOut` para el contador, `cubic-bezier(0.16,1,0.3,1)` en micro-interacciones.

### Named Rules
- **Visible por defecto.** Todas las reglas que ocultan o apilan cosas dependen de la clase `.dx-motion`, que pone el JS. Si el JS falla o hay reducción de movimiento, la página se ve completa y quieta, sin scroll suave.
- **Nada tapado e interactivo.** El contenido del inicio cubierto por el portal recibe `inert`.
- **Medir sin transformaciones.** Las posiciones se miden con offsets (`cajaDentro`), no con `getBoundingClientRect`, para que los tweens no se midan a sí mismos.

## Do's and Don'ts

### Do:
- Un bloque de color pleno por sección y la barra copiando ese bloque.
- Titulares gigantes ensanchados; Bodoni sólo como acento corto.
- Mostrar el producto funcionando (teléfono, mensaje de WhatsApp, demo jugable), siempre rotulado "Ejemplo".
- Voseo y tono de dueño a dueño.

### Don't:
- Sombras, degradados, glassmorphism o teléfonos flotantes.
- Testimonios, logos de clientes o métricas inventadas.
- Texto blanco sobre ají.
- Animaciones que oculten contenido sin `.dx-motion`, o escenas fijadas en el celular.
- Volver al mundo "Comanda del mozo" (papel de talonario, sello, birome).

---

# Panel admin: "Hora pico, versión trabajo"

Fuente de verdad: `frontend-admin/src/styles/tokens.css`. El tema va en `<html data-theme="light|dark">`; lo ponen `ThemeContext` y `public/theme-init.js`, que lo hace antes de React. La primera vez sigue `prefers-color-scheme`. El login (`.hp` en `index.css`) es siempre claro y usa la paleta de la landing.

Misma familia que la landing, pero tranquila para usar todo el día:
- base neutra cálida;
- ají sólo para la acción principal y los avisos;
- cobalto para el foco y la información;
- seis colores para los gráficos.

Nada de colores sueltos en los componentes. Tailwind tiene clases sobre los tokens: `bg-surface`, `text-fg-2`, `border-line`, `bg-accent`, `text-ok`, etc.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | #f4f2ec | #0d0e11 | fondo de página |
| `--surface` / `-2` / `-3` | #fff / #f8f6f1 / #efede6 | #16171c / #1d1f25 / #25272e | tarjetas, campos, rellenos |
| `--fg` / `-2` / `-3` | #111216 / #44464f / #5f616a | #efede6 / #c2c0b9 / #94949a | texto (todos ≥ 4,5:1) |
| `--accent` (+`--on-accent` tinta) | #ff5b24 | #ff6a38 | acción principal, ítem activo |
| `--accent-ink` | #b5370a | #ff8a5c | ají como texto |
| `--focus` / `--info` | #3b3bf5 | #8c8cff | anillo de foco, información |
| `--ok` `--warn` `--err` (+ `-bg`) | verde, ámbar, rojo oscuros | versiones claras | estados |
| `--spot` / `--on-spot` | #111216 / #efede6 | #24262d / #efede6 | bloque destacado (tarjeta del local) |
| `--chart-1…6` | cobalto, ají, verde, ámbar, violeta, petróleo | versiones claras | series de gráficos |

Forma: radios `--r-sm` 10px, `--r-md` 14px y `--r-lg` 20px. En claro hay una sombra casi nula; en oscuro, ninguna. Letra Archivo en todo el panel, con títulos ensanchados (`.pn-title`) y números tabulares (`.pn-num`).

## Estructura (`components/AdminLayout.tsx` + `styles/shell.css`)

- `AdminShell` es un **layout de ruta** (`App.tsx`): se monta una vez y cada sección se dibuja en `<Outlet/>`. Al navegar no se reinician las consultas automáticas ni aparece la pantalla de carga.
- Cada pantalla sigue usando `<AdminLayout title>`, que ahora sólo informa el título.
- **Menú lateral:**
  - 240 px, o 72 px sólo con íconos (se recuerda);
  - enlaces `NavLink` con `aria-current`;
  - barra ají a la izquierda en el ítem activo.
- **Celular (≤ 768 px):** barra inferior con Dashboard, Pedidos, Chats, Productos y "Más", que abre el cajón con el menú completo.
- **Accesibilidad:**
  - "Saltar al contenido";
  - los desplegables se cierran con Escape;
  - los avisos usan `aria-live`;
  - los botones táctiles miden ≥ 40 px.

## Componentes

- `components/ui.tsx`: `Card`, `Segmented`, `EmptyState` y `Delta`.
- `components/charts.tsx`, en SVG propio y sin librerías:
  - `GraficoLinea`: con el período anterior punteado y recorrido con las flechas;
  - `GraficoBarras`, `Reparto`, `Ranking` y `MapaCalor`;
  - `DatosTabla`: los datos en una tabla desplegable.
- `sharedStyles.ts` usa `var(--…)`, así que las pantallas viejas que lo usan ya funcionan en los dos temas.

## Dashboard

Arriba van el saludo, las acciones (Ver menú, Compartir QR y Nuevo producto en ají) y la tarjeta del local, con el link y lo de hoy. Después hay un período de 7, 30 o 90 días con estas secciones:
- 4 métricas comparadas con el período anterior;
- ventas por día;
- cómo te piden;
- horas pico;
- productos top (por ganancia o por unidades);
- últimos pedidos;
- stock bajo;
- ventas por mes;
- historial.

Datos: `GET /api/analiticas/actividad?dias=` (backend `utils/actividad.js`, en hora de Argentina). Ya no baja `/pedidos` completo.

## Pantallas de trabajo (fase 4)

Pedidos, Chats, Categorías y Productos, junto con Ticket, Variantes y el resaltado de búsqueda, ya usan los tokens.

- **Estados de pedido** (un color por estado, igual en todo el panel):

  | Estado | Token |
  |---|---|
  | pendiente | `--warn` |
  | preparando | `--info` |
  | listo | `--violet` |
  | en camino | `--teal` |
  | entregado | `--ok` |
  | cancelado | `--err` |

- **Tipo de entrega:**
  - en gráficos: mesa `--chart-1`, delivery `--chart-2` y retiro `--chart-3`;
  - en filtros con texto: `--info`, `--accent-ink` y `--ok`, que tienen contraste de texto.
- **Interruptores:** `Switch` de `components/ui.tsx` (`role="switch"`, se usa con el teclado). La clase `.tap` da 44 px de alto en el celular a los controles con estilos en línea.
- **Texto sobre un color pleno:** usa `var(--surface)`, que contrasta en los dos temas.
- **Transparencias:** `color-mix(in srgb, <color> N%, transparent)`, nunca un hex con dígitos agregados.
- **Chats:** conserva los colores de WhatsApp (fondo y burbujas), citados para que se reconozca la app.
- **Celular:** Categorías y Productos arrancan en vista "Tarjetas" si el usuario no eligió otra.

## Configuración y administración (fase 5)

Configuración, Mi cuenta, Usuarios, Negocios, QR, WhatsApp, Suscripción y Plataforma ya usan los tokens. No se tocaron a propósito:
- la **paleta del menú público** (`color_primario` y las opciones de color de Configuración), porque es el color que elige cada local para su carta;
- el **código QR**, que queda negro sobre una tarjeta blanca en los dos temas para que se escanee bien;
- los **colores citados de WhatsApp** en la vista previa de avisos.

Los roles de usuario usan `--info` (SuperAdmin), `--teal` (Admin) y `--violet` (Staff). Los campos de formulario tienen el borde `--field-border` (3:1 contra el fondo). El texto sobre ají va en `--on-accent` (tinta); sobre los demás colores plenos, en `--surface`. Los interruptores apagados usan `--fg-3`, que se ve en los dos temas.

## Pendiente (fase 6, ver `docs/auditoria-panel-admin.md`)

- Pantallas siempre oscuras: Onboarding, CambiarPassword y ResetPassword. Se pasan al estilo "Hora pico", como el login.
