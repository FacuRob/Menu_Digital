const { test } = require("node:test");
const assert = require("node:assert");
const { calcularActividad, enArgentina, sumarDias } = require("../src/utils/actividad");

// "Ahora": sábado 7/11/2026 15:00 en Argentina (18:00 UTC).
const AHORA = new Date("2026-11-07T18:00:00Z");
const item = (subtotal, costo_unit = 0, cantidad = 1) => ({ subtotal, costo_unit, cantidad });

test("enArgentina: usa la hora del local (UTC-3), no la del servidor", () => {
  // 01:30 UTC del día 8 = 22:30 del día 7 en Argentina.
  const r = enArgentina("2026-11-08T01:30:00Z");
  assert.equal(r.fecha, "2026-11-07");
  assert.equal(r.hora, 22);
  assert.equal(r.dow, 5); // sábado (lunes = 0)
});

test("sumarDias: cruza meses", () => {
  assert.equal(sumarDias("2026-11-01", -1), "2026-10-31");
  assert.equal(sumarDias("2026-12-31", 1), "2027-01-01");
});

test("calcularActividad: un casillero por día, con días vacíos", () => {
  const r = calcularActividad([], { dias: 7, ahora: AHORA });
  assert.equal(r.serie.length, 7);
  assert.equal(r.desde, "2026-11-01");
  assert.equal(r.hasta, "2026-11-07");
  assert.deepEqual(r.totales, { ventas: 0, ganancia: 0, pedidos: 0, ticket: 0 });
});

test("calcularActividad: ventas sólo de entregados, ganancia = ventas - costo", () => {
  const pedidos = [
    { id: 1, estado: "entregado", created_at: "2026-11-06T20:00:00Z", total: 1000, tipo_entrega: "mesa", pedido_items: [item(1000, 400)] },
    { id: 2, estado: "pendiente", created_at: "2026-11-07T17:00:00Z", total: 500, tipo_entrega: "delivery", pedido_items: [item(500)] },
    { id: 3, estado: "cancelado", created_at: "2026-11-07T17:30:00Z", total: 800, tipo_entrega: "retiro", pedido_items: [item(800)] },
  ];
  const r = calcularActividad(pedidos, { dias: 7, ahora: AHORA });
  assert.equal(r.totales.ventas, 1000);
  assert.equal(r.totales.ganancia, 600);
  assert.equal(r.totales.pedidos, 1);
  assert.equal(r.totales.ticket, 1000);
  const dia6 = r.serie.find((b) => b.fecha === "2026-11-06");
  assert.equal(dia6.ventas, 1000);
  // Hoy: el pendiente cuenta como pedido; el cancelado no.
  assert.deepEqual(r.hoy, { pedidos: 1, pendientes: 1, ventas: 0 });
  // Por tipo: no cuenta cancelados.
  const tipos = Object.fromEntries(r.por_tipo.map((t) => [t.tipo, t.pedidos]));
  assert.deepEqual(tipos, { mesa: 1, delivery: 1, retiro: 0 });
  assert.equal(r.estados.cancelado, 1);
});

test("calcularActividad: el período anterior se suma aparte para comparar", () => {
  const pedidos = [
    // 3 días antes del inicio (1/11) → período anterior.
    { id: 1, estado: "entregado", created_at: "2026-10-29T15:00:00Z", total: 300, pedido_items: [item(300)] },
  ];
  const r = calcularActividad(pedidos, { dias: 7, ahora: AHORA });
  assert.equal(r.totales.ventas, 0);
  assert.deepEqual(r.anterior, { ventas: 300, ganancia: 300, pedidos: 1 });
  // 29/10 es el día 4 del período anterior (25/10 – 31/10).
  assert.deepEqual(r.serie_anterior, [0, 0, 0, 0, 300, 0, 0]);
});

test("calcularActividad: horas pico por día de la semana y hora local", () => {
  const pedidos = [
    { id: 1, estado: "entregado", created_at: "2026-11-07T00:15:00Z", tipo_entrega: "mesa", total: 100, pedido_items: [] },
  ];
  const r = calcularActividad(pedidos, { dias: 7, ahora: AHORA });
  // 00:15 UTC del sábado = viernes 21:15 en Argentina.
  assert.equal(r.horas[4][21], 1);
  // Sin ítems: usa el total del pedido.
  assert.equal(r.totales.ventas, 100);
});

test("calcularActividad: pendientes ahora cuenta también los de días anteriores", () => {
  const pedidos = [
    { id: 1, estado: "pendiente", created_at: "2026-11-05T20:00:00Z", total: 100, pedido_items: [] },
    { id: 2, estado: "pendiente", created_at: "2026-11-07T17:00:00Z", total: 100, pedido_items: [] },
  ];
  const r = calcularActividad(pedidos, { dias: 7, ahora: AHORA });
  assert.equal(r.hoy.pendientes, 2);
  assert.equal(r.hoy.pedidos, 1);
});

test("calcularActividad: la venta cuenta el día en que se entregó", () => {
  const pedidos = [
    { id: 1, estado: "entregado", created_at: "2026-11-03T22:00:00Z", entregado_at: "2026-11-05T15:00:00Z", total: 700, pedido_items: [item(700)] },
  ];
  const r = calcularActividad(pedidos, { dias: 7, ahora: AHORA });
  assert.equal(r.serie.find((b) => b.fecha === "2026-11-05").ventas, 700);
  assert.equal(r.serie.find((b) => b.fecha === "2026-11-03").ventas, 0);
});

test("calcularActividad: 30 días cruzando de mes", () => {
  const r = calcularActividad([], { dias: 30, ahora: AHORA });
  assert.equal(r.desde, "2026-10-09");
  assert.equal(r.serie.length, 30);
  assert.equal(r.serie[29].fecha, "2026-11-07");
});
