# Propuestas de Mejoras y Evolución de la Arquitectura

Este documento detalla las mejoras sugeridas para evolucionar el sistema actual hacia una plataforma SaaS multi-rubro, escalable y robusta, basándose en la arquitectura actual (React, Node.js/Express, Supabase).

## 1. Evolución a Plataforma SaaS Multi-rubro
El objetivo principal es desacoplar el concepto exclusivo de "comida" (restaurantes) para permitir la venta de cualquier tipo de producto (ropa, electrónica, servicios, etc.).

*   **Modelado de Datos Genérico:** Cambiar nomenclaturas específicas. Por ejemplo, en lugar de manejar entidades como `ingredientes`, pasar a un modelo de `variantes` o `modificadores` (que puede aplicar a talles de ropa, colores, o extras de una comida).
*   **Campos Personalizables por Tenant:** Permitir que cada tienda (tenant) configure sus campos de productos dependiendo de su rubro.

## 2. Nuevo Sistema de Roles y Permisos (RBAC)
Para dar soporte al modelo SaaS, se implementará un sistema de roles jerárquico bien definido:

### 👑 SuperAdmin (Propietario de la Plataforma)
*   Tiene acceso global a toda la plataforma.
*   **Funciones:**
    *   Gestión y visualización de todos los negocios/tiendas registradas.
    *   Análisis de métricas globales (MRR, altas, bajas de usuarios).
    *   Gestión de suscripciones globales (suspender, activar o eliminar cuentas de tiendas por falta de pago).
    *   Configuración general del SaaS.

### 🏢 Admin (Propietario del Negocio / Cliente SaaS)
*   Dueño o gerente principal de una tienda específica.
*   **Funciones:**
    *   Control total sobre su propia tienda y catálogo de productos.
    *   Personalización de la apariencia de su tienda (logo, banners, paleta de colores).
    *   Visualización de métricas de ventas y reportes financieros de su local.
    *   Gestión de métodos de pago y cobro.
    *   Capacidad de invitar y administrar cuentas para su personal (Staff).

### 👥 Staff (Personal / Empleados del Negocio)
*   Operarios del día a día del negocio.
*   **Funciones:**
    *   Gestión de stock de los productos.
    *   Pausar o activar artículos en el catálogo.
    *   Recepción y gestión del estado de los pedidos (ej. "Pendiente", "Preparando", "Listo para entregar/enviar").
    *   *Restricción:* No tienen acceso a configuraciones de pago, facturación del SaaS, eliminación de la tienda, ni reportes financieros a nivel gerencial.

## 3. Integración de Pasarela de Pagos para el SaaS
Para gestionar las suscripciones de los clientes (los negocios que contratan tu plataforma):

*   **Lemon Squeezy como Merchant of Record (MoR):** Implementación recomendada para manejar la facturación recurrente (mensual/anual).
*   **Ventajas:** 
    *   Gestión automática de impuestos globales (como el IVA según el país).
    *   Portal de cliente nativo donde los *Admins* pueden actualizar sus tarjetas de crédito, pausar o cancelar su suscripción, y descargar facturas.
    *   API robusta para conectar mediante Webhooks con nuestro backend en Express para actualizar el estado de la suscripción en la base de datos (Supabase) en tiempo real.

## 4. Mejoras Técnicas Adicionales
*   **Seguridad:** Implementar Middlewares en Express para verificar exhaustivamente el rol de usuario consultando a Supabase antes de realizar cualquier acción sensible.
*   **Multi-tenancy en Base de Datos:** Asegurar que todas las tablas relacionadas con el negocio (productos, pedidos, staff) incluyan un `tenant_id` o `store_id` y que existan políticas de seguridad a nivel de fila (RLS) en Supabase para evitar fugas de datos entre tiendas.
*   **Optimización de Imágenes:** Mantener y potenciar el uso de Cloudinary, implementando recortes (cropping) dinámicos desde el frontend-admin para estandarizar el tamaño de las imágenes del catálogo sin importar el rubro.
