const { test } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { statsPresupuestos, statsTurnos } = require("../src/utils/agendaStats");
const { registrar } = require("../src/utils/registroCambios");
const { listar: listarRegistro } = require("../src/controllers/registroController");
const { armarPrompt } = require("../src/services/iaService");

const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};
const esperar = () => new Promise((r) => setTimeout(r, 5));

// ── Analíticas de agenda ──
test("stats de presupuestos: cotizados, aceptados (incluye convertidos) y tasa", () => {
  const s = statsPresupuestos([
    { estado: "pendiente" },
    { estado: "cotizado", precio_cotizado: 100 },
    { estado: "aceptado", precio_cotizado: 200 },
    { estado: "convertido", precio_cotizado: "300.5" },
    { estado: "rechazado", precio_cotizado: 50 },
  ]);
  assert.deepEqual(s, { recibidos: 5, sin_responder: 1, cotizados: 4, aceptados: 2, rechazados: 1, tasa_aceptacion: 50, monto_aceptado: 500.5 });
  assert.equal(statsPresupuestos([]).tasa_aceptacion, null);
});

test("stats de turnos: asistencia y servicios más pedidos (sin cancelados)", () => {
  const s = statsTurnos([
    { estado: "completada", servicio_nombre: "Corte" },
    { estado: "completada", servicio_nombre: "Corte" },
    { estado: "ausente", servicio_nombre: "Color" },
    { estado: "cancelada", servicio_nombre: "Color" },
    { estado: "confirmada", servicio_nombre: "Color" },
  ]);
  assert.equal(s.tasa_ausencia, 33);
  assert.deepEqual(s.top_servicios, [{ nombre: "Corte", turnos: 2 }, { nombre: "Color", turnos: 2 }]);
});

// ── Registro de cambios ──
test("registrar: guarda quién (con Soporte) y nunca rompe aunque la base falle", async () => {
  const ops = [];
  db.setHandler((q) => {
    ops.push(q);
    return { data: null, error: { message: "no existe la tabla" } };
  });
  registrar({ user: { id: 4, cuenta_id: 2, tech_id: 9 }, negocioId: 7 }, "borrar", "producto", 15, { nombre: "Muzza" });
  await esperar();
  const fila = ops.find((o) => o.table === "registro_cambios").payload[0];
  assert.deepEqual(fila, { cuenta_id: 2, negocio_id: 7, usuario_id: 4, tech_id: 9, accion: "borrar", entidad: "producto", entidad_id: "15", detalle: { nombre: "Muzza" } });
  db.setHandler(() => {
    throw new Error("caída");
  });
  assert.doesNotThrow(() => registrar({}, "x", "y"));
});

test("registro: sólo la cuenta del usuario; Soporte se muestra como tal; sin tabla, lista vacía", async () => {
  const filtros = [];
  db.setHandler((q) => {
    filtros.push(q);
    if (q.table === "registro_cambios") {
      return { data: [{ id: 1, usuario_id: 4, tech_id: null, accion: "crear" }, { id: 2, usuario_id: 4, tech_id: 9, accion: "ver_como" }], error: null };
    }
    if (q.table === "usuarios") return { data: [{ id: 4, username: "ana", nombre: "Ana" }], error: null };
    return { data: [], error: null };
  });
  const res = respuesta();
  await listarRegistro({ user: { id: 4, cuenta_id: 2 } }, res);
  assert.equal(filtros.find((q) => q.table === "registro_cambios").filters.cuenta_id, 2);
  assert.equal(filtros.find((q) => q.table === "usuarios").filters.cuenta_id, 2);
  assert.deepEqual(res.body.map((r) => r.quien), ["Ana", "Soporte DinexFlow"]);

  db.setHandler(() => ({ data: null, error: { code: "42P01", message: "relation does not exist" } }));
  const res2 = respuesta();
  await listarRegistro({ user: { id: 4, cuenta_id: 2 } }, res2);
  assert.deepEqual(res2.body, []);

  // Otro error (base caída): no se disfraza de "sin cambios".
  db.setHandler(() => ({ data: null, error: { code: "08006", message: "caída" } }));
  const res3 = respuesta();
  await listarRegistro({ user: { id: 4, cuenta_id: 2 } }, res3);
  assert.equal(res3.code, 500);
});

// ── IA ──
const FECHA = new Date("2026-11-15T20:00:00Z");
test("IA: un restaurante no ve servicios ni turnos y su link sigue en /menu", () => {
  const p = armarPrompt(
    { cfg: { nombre: "La Esquina" }, slug: "la-esquina", categorias: [{ id: 1, nombre: "Pizzas" }], productos: [{ nombre: "Muzza", precio: 9000, categoria_id: 1 }], pedidos: [] },
    "",
    FECHA,
  );
  assert.ok(p.includes("/menu/la-esquina"));
  assert.ok(p.includes("MENÚ (solo productos disponibles hoy)"));
  assert.ok(!p.includes("SERVICIOS") && !p.includes("TURNOS Y PRESUPUESTOS"));
});

test("IA: con servicios, los lista con precio y duración y da los links de turno y presupuesto", () => {
  const p = armarPrompt(
    {
      cfg: { nombre: "Estudio Lu" },
      slug: "estudio-lu",
      rubro: "servicios",
      modulos: { servicios: true, reservas: true, presupuestos: true },
      categorias: [],
      productos: [],
      pedidos: [],
      servicios: [
        { nombre: "Corte", precio: 8000, tipo_precio: "desde", duracion_min: 30, requiere_turno: true, descripcion: "Lavado   y\nmasajes" },
        { nombre: "Tocado", tipo_precio: "variable", requiere_presupuesto: true },
      ],
    },
    "",
    FECHA,
  );
  assert.ok(!p.includes("MENÚ (solo")); // sin productos no habla de un menú vacío
  assert.match(p, /- Corte: desde \$\s?8\.000,00 · 30 min · con turno \(Lavado y masajes\)/);
  assert.ok(p.includes("- Tocado: precio a consultar · con presupuesto"));
  assert.ok(p.includes("/negocio/estudio-lu/reservar"));
  assert.ok(p.includes("/negocio/estudio-lu/presupuesto"));
  assert.ok(p.includes("/negocio/estudio-lu")); // link de la página
});
