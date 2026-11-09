# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dueños y encargados de locales gastronómicos chicos y medianos de **Argentina** (restaurantes, bares, cafeterías, hamburgueserías, pizzerías, heladerías, food trucks). Llegan a la landing desde el celular o la compu, buscando dejar la carta en PDF o papel y recibir pedidos sin pagar comisiones de apps de delivery. Se les habla de vos (español rioplatense).

Segundo público: los clientes del local, que escanean el QR y piden desde el navegador (no visitan la landing, pero son la experiencia que el dueño compra).

## Product Purpose

DinexFlow es un SaaS multi-negocio de menú digital: el dueño carga su carta en un panel, imprime un QR, y sus clientes eligen y envían el pedido ordenado por WhatsApp. El dueño gestiona pedidos, tickets, stock, variantes y ventas desde el mismo panel. Éxito de la landing: que el dueño cree su cuenta de prueba gratis.

## Positioning

Menú con QR + pedido armado que llega directo al WhatsApp del local, sin app para el cliente y sin intermediarios, administrado desde un panel con pedidos, stock y analíticas, para varios locales en una cuenta.

## Operating Context

- El cliente escanea el QR con la cámara; el menú abre en el navegador (`/menu/:slug`).
- El pedido llega al WhatsApp del local; el dueño lo sigue por estado en el panel e imprime tickets.
- Cambios de precio/fotos se reflejan al momento sin reimprimir el QR.
- Panel admin aparte (frontend-admin): login `…/admin/login`, alta `…/admin/login?view=signup`.

## Capabilities and Constraints

- Menú con QR, pedidos por WhatsApp, panel de pedidos y tickets, analíticas de ventas, personalización (logo, colores, portada, horarios), stock y variantes/modificadores, varios locales y equipo con roles, menú en español/inglés/portugués.
- Prueba gratis de 15 días sin tarjeta, con todo lo del plan Estándar. Al terminar, el panel avisa que hay que elegir un plan mensual para seguir operando.
- Pago mensual desde el panel con Mercado Pago, en pesos argentinos. Se cancela o cambia de plan cuando quiera. No hay plan anual.
- Planes (deben coincidir con `backend/src/utils/planPrecios.js`, el panel y la landing): Básico $20.000/mes (1 negocio, hasta 50 productos, carta con QR, variantes, personalización, analíticas); Estándar $41.000/mes (todo lo del Básico, hasta 3 negocios, 180 productos repartidos entre los negocios (180/90/60), control de stock, avisos y chats por WhatsApp, bot con IA y seguimiento del repartidor en el mapa) — destacado; Premium $65.000/mes (todo lo del Estándar, hasta 5 negocios, 1.000 productos repartidos entre los negocios (1000/500/334-333/250/200)). La prueba gratis de 15 días es igual al Estándar.
- Stack: React 19 + Vite + Tailwind v4, landing en `frontend/src/pages/Landing.tsx`, deploy en Netlify.

## Brand Commitments

Nombre: DinexFlow. El usuario dio libertad total: logo, paleta y estilo pueden cambiarse si el rediseño lo pide.

## Evidence on Hand

Ninguna prueba real todavía: **no hay clientes, testimonios, logos, fotos ni métricas reales**. No inventar ninguna. Los menús de demostración (Burger Club, Café Aroma, etc. en `frontend/src/components/landing/demos.ts`) son ficticios y deben rotularse como ejemplo.

## Product Principles

1. Mostrar el producto funcionando antes que describirlo.
2. Hablarle al dueño de local en su idioma: simple, concreto, de vos.
3. Una acción principal: probar gratis 15 días.
4. Nada inventado: sin testimonios ni números falsos.
5. Rápido en celulares modestos y con datos móviles.

## Accessibility & Inclusion

WCAG 2.2 AA: contraste, foco visible, áreas táctiles de 44px, respetar `prefers-reduced-motion`.
