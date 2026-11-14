const { test } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { listar, agrupar, claveDe } = require("../src/controllers/clientesController");

test("clave: mismo teléfono con o sin prefijo; sin teléfono, el email; sin nada, nadie", () => {
  assert.equal(claveDe("+54 9 381 555-1234"), claveDe("3815551234"));
  assert.equal(claveDe(null, " Ana@Mail.com "), "e:ana@mail.com");
  assert.equal(claveDe("", ""), null);
  assert.equal(claveDe("555123", null), null); // muy corto para identificar a alguien
});

test("agrupar: junta pedidos, presupuestos y turnos del mismo cliente", () => {
  const r = agrupar({
    pedidos: [
      { cliente: "Ana", telefono_cliente: "381 555 1234", total: 1000, estado: "entregado", created_at: "2026-11-01T10:00:00Z" },
      { cliente: "Ana", telefono_cliente: "+5493815551234", total: 500, estado: "cancelado", created_at: "2026-11-02T10:00:00Z" },
      { cliente: "Mesa 4", telefono_cliente: null, total: 9000, estado: "entregado", created_at: "2026-11-03T10:00:00Z" },
    ],
    presupuestos: [{ cliente_nombre: "Ana López", telefono: "3815551234", email: "ana@mail.com", created_at: "2026-11-05T10:00:00Z" }],
    reservas: [{ cliente_nombre: "Beto", telefono: null, email: "beto@mail.com", created_at: "2026-11-04T10:00:00Z" }],
  });
  assert.equal(r.length, 2); // el pedido de mesa sin teléfono no cuenta
  const [ana, beto] = r; // el más reciente primero
  assert.equal(ana.nombre, "Ana López");
  assert.equal(ana.pedidos, 2);
  assert.equal(ana.total, 1000); // el cancelado no suma
  assert.equal(ana.presupuestos, 1);
  assert.equal(ana.email, "ana@mail.com");
  assert.equal(beto.turnos, 1);
});

test("listar: filtra cada fuente por el negocio y tolera una tabla que falta", async () => {
  const filtros = [];
  db.setHandler((q) => {
    filtros.push({ table: q.table, filters: q.filters });
    if (q.table === "pedidos") return { data: [{ cliente: "Ana", telefono_cliente: "3815551234", total: 10, estado: "nuevo", created_at: "2026-11-01" }], error: null };
    if (q.table === "reservas") return { data: null, error: { message: "relation does not exist" } };
    return { data: [], error: null };
  });
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  await listar({ negocioId: 7, headers: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.clientes.length, 1);
  assert.equal(res.body.truncado, false);
  assert.deepEqual(filtros.map((f) => f.table).sort(), ["pedidos", "presupuestos", "reservas"]);
  for (const f of filtros) assert.equal(f.filters.negocio_id, 7, f.table);
});

test("listar: si fallan todas las fuentes → error (no una lista vacía); con más de 2000 filas avisa truncado", async () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  db.setHandler(() => ({ data: null, error: { message: "caída" } }));
  await listar({ negocioId: 7, headers: {} }, res);
  assert.equal(res.code, 500);

  const muchos = Array.from({ length: 2001 }, (_, i) => ({ cliente: "X", telefono_cliente: `38100${String(i).padStart(5, "0")}`, total: 1, estado: "nuevo", created_at: "2026-11-01" }));
  db.setHandler((q) => ({ data: q.table === "pedidos" ? muchos : [], error: null }));
  res.code = 200;
  await listar({ negocioId: 7, headers: {} }, res);
  assert.equal(res.body.truncado, true);
  assert.equal(res.body.clientes.length, 2000);
});
