---
version: 1
slug: "frontend-src-pages-landing-tsx"
primary_target: "frontend/src/pages/Landing.tsx"
related_targets: []
---

## Scope

Landing pública de DinexFlow (`/`), modo Persuade. Público: dueños de locales gastronómicos de Argentina (voseo). Acción: crear cuenta de prueba 14 días (ADMIN_SIGNUP_URL). Sin pruebas reales: demos rotuladas "de ejemplo", sin testimonios ni métricas. Reemplaza al mundo "Comanda del mozo" (el usuario lo sintió antiguo y estático).

## Direction contract

THESIS: "Hora pico": la página se mueve como un local en plena hora pico. El scroll es el servicio: el QR se abre hasta llenar la pantalla, el teléfono muestra el pedido paso a paso y los bloques de color cambian de golpe como cambia el turno. Rechaza el SaaS de tarjetas con teléfono flotante y la página estática.

OWN-WORLD: Bloques de color plenos que se alternan a todo el ancho: hueso #efede6, ají #ff5b24, tinta #111216 y cobalto #3b3bf5. Grotesca Archivo variable ensanchada (wdth 112-125, peso 800) en tamaños gigantes, minúscula y mayúscula, interletra apretada; serif Bodoni Moda itálica sólo para frases cortas de acento. Pastillas redondeadas para acciones, esquinas grandes (28px) en superficies, sin sombras decorativas (tampoco en el teléfono). La barra fija toma el fondo de la sección que tiene debajo.

STORY: El dueño entiende en el primer viewport qué es y tiene el botón; al bajar ve el QR abrirse, el manifiesto escribirse, el pedido viajar del celular del cliente a su WhatsApp, las funciones una por una, lo prueba en la demo, ve precios y se registra.

FIRST VIEWPORT: Fondo hueso. Arriba nav con logo, links y pastilla ají "Probar gratis". Titular gigante en dos líneas a todo el ancho ("Tu carta en el celu." / "El pedido, en tu WhatsApp." con la segunda en ají); abajo a la izquierda bajada + botón ají "Probar 14 días gratis" + link "Ver cómo funciona"; a la derecha una ficha QR real (tinta) que al scrollear se expande con clip-path hasta llenar la pantalla en tinta.

FORM: Mundo fijado por el usuario: pidió "Estilo nuevo + scroll" con intensidad "Como la referencia" y dio el sitio de referencia https://iventions.com/ (escenas fijadas con scroll, tipografía gigante, bloques de color). El sorteo se omitió por decisión del usuario, porque una dirección fijada por el usuario le gana al sorteo. seed: none (sorteo omitido: dirección fijada por el usuario). Se traduce la gramática de movimiento, no la marca de la referencia.

SIGNATURE INTERACTION: Escena fijada "del QR al WhatsApp": el teléfono queda quieto en el centro, con los pasos a su izquierda y un contador gigante 01/02/03 a su derecha, mientras el scroll avanza tres pasos (escanea → elige → llega a WhatsApp), con la pantalla cambiando y el texto del paso activo resaltado. Desplazamiento suave con Lenis + GSAP ScrollTrigger. Con prefers-reduced-motion: sin fijaciones ni desplazamiento suave, todo visible y estático. Contenido visible por defecto si el JS falla.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
