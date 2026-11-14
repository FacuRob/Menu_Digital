// ══════════════════════════════════════════════════════════════
// Módulos por negocio (negocios.modulos, db/modulos.sql). Única fuente: el
// panel pide el registro a GET /api/modulos y el backend valida contra él.
//
// No confundir con el rubro: el rubro sugiere módulos en el onboarding, pero
// cada negocio prende los que use (una impresión 3D puede tener productos,
// pedidos y presupuestos; una peluquería, servicios y reservas).
// ══════════════════════════════════════════════════════════════

// disponible: false = todavía no existe en el sistema (se puede dejar
// elegido, pero no hace nada). requiere: módulos que tienen que estar
// prendidos para que este funcione.
const REGISTRO = [
  { codigo: "catalogo", nombre: "Catálogo", descripcion: "Tu página pública con lo que ofrecés.", disponible: true, fijo: true },
  { codigo: "productos", nombre: "Productos", descripcion: "Productos con precio, fotos, opciones y stock.", disponible: true, requiere: ["catalogo"] },
  { codigo: "personalizados", nombre: "Productos personalizados", descripcion: "Campos que completa el cliente (texto, medidas, archivos).", disponible: false, requiere: ["productos"] },
  { codigo: "servicios", nombre: "Servicios", descripcion: "Servicios con precio fijo, desde o a consultar, y duración.", disponible: false, requiere: ["catalogo"] },
  { codigo: "pedidos", nombre: "Pedidos", descripcion: "Los clientes arman su pedido y te llega al panel.", disponible: true, requiere: ["productos"] },
  // El carrito va con los pedidos (hoy es la única forma de pedir online).
  { codigo: "carrito", nombre: "Carrito", descripcion: "Carrito de compras en tu página.", disponible: true, requiere: ["pedidos"], oculto: true },
  { codigo: "entregas", nombre: "Entregas", descripcion: "Retiro en el local, delivery y pedido en mesa.", disponible: true, requiere: ["pedidos"] },
  { codigo: "presupuestos", nombre: "Presupuestos", descripcion: "Los clientes te piden una cotización y vos respondés.", disponible: false, requiere: ["catalogo"] },
  { codigo: "reservas", nombre: "Reservas y turnos", descripcion: "Agenda con horarios y turnos sin superposición.", disponible: false, requiere: ["catalogo"] },
  { codigo: "clientes", nombre: "Clientes", descripcion: "Listado de tus clientes y su historial.", disponible: false },
  { codigo: "estadisticas", nombre: "Estadísticas", descripcion: "Ventas, ganancia y horas pico en el Dashboard.", disponible: true },
];
const CODIGOS = REGISTRO.map((m) => m.codigo);

// Lo que tiene un negocio que nunca configuró módulos (todos los anteriores
// a este cambio): exactamente lo que el sistema hacía hasta hoy.
const LEGADO = { catalogo: true, productos: true, personalizados: false, servicios: false, pedidos: true, carrito: true, entregas: true, presupuestos: false, reservas: false, clientes: false, estadisticas: true };

// Deja un objeto completo y coherente (lo que no viene sale de `base`):
// sólo claves conocidas, booleanos,
// catálogo siempre prendido y dependencias respetadas (si falta lo que un
// módulo necesita, se apaga). El carrito sigue a los pedidos.
function normalizar(entrada, base = LEGADO) {
  const m = {};
  for (const c of CODIGOS) m[c] = entrada && typeof entrada[c] === "boolean" ? entrada[c] : base[c];
  m.catalogo = true;
  m.carrito = m.pedidos;
  // Dos vueltas alcanzan: la cadena más larga es entregas → pedidos → productos.
  for (let i = 0; i < 3; i++) {
    for (const { codigo, requiere = [] } of REGISTRO) {
      if (m[codigo] && requiere.some((r) => !m[r])) m[codigo] = false;
    }
  }
  return m;
}

// Módulos que rigen para un negocio (fila de `negocios`, puede no tener la
// columna si db/modulos.sql no corrió).
const modulosDe = (negocio) => normalizar(negocio?.modulos || null);

// Módulos sugeridos por lo que se eligió en el onboarding.
//   ofrece:    productos | personalizados | servicios
//   funciones: venta_directa | pedidos | retiro | envios | presencial | ...
function desdeOnboarding({ ofrece = [], funciones = [] } = {}, familia) {
  const productos = ofrece.includes("productos") || ofrece.includes("personalizados");
  // Retiro, envíos o la mesa (gastronomía) también son formas de pedir.
  const conEntrega =
    funciones.includes("retiro") || funciones.includes("envios") || (familia === "gastronomia" && funciones.includes("presencial"));
  const pedidos = productos && (funciones.includes("pedidos") || funciones.includes("venta_directa") || conEntrega);
  const entregas = pedidos && conEntrega;
  return normalizar({
    productos,
    personalizados: ofrece.includes("personalizados"),
    servicios: ofrece.includes("servicios"),
    pedidos,
    entregas,
    presupuestos: funciones.includes("presupuestos"),
    reservas: funciones.includes("reservas"),
    clientes: true,
    estadisticas: true,
  });
}

module.exports = { REGISTRO, CODIGOS, LEGADO, normalizar, modulosDe, desdeOnboarding };
