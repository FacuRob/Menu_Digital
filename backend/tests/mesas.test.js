const { test } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.MESA_QR_SECRET = process.env.MESA_QR_SECRET || "x".repeat(40);
const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
const { normalizarPlano } = require("../src/utils/planoMesas");
const { armarOcupadas, guardarPlano, ocuparMesa, liberarMesa } = require("../src/controllers/mesasController");
const { firmarMesa } = require("../src/utils/mesaQr");

const resMock = () => {
  const res = { code: 200, body: null, set() {}, end() { return res; } };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

test("plano: recorta medidas, descarta formas raras y avisa mesas repetidas", () => {
  const r = normalizarPlano({
    pisos: [{ nombre: " Planta baja ", ancho: 500, alto: 1, zonas: [{ tipo: "exterior", forma: "circulo", x: -3, w: 4, h: 4 }], mesas: [{ mesa: "5", forma: "triangular", x: 3, y: 1 }] }],
  });
  assert.equal(r.error, undefined);
  const piso = r.plano.pisos[0];
  assert.equal(piso.nombre, "Planta baja");
  assert.equal(piso.ancho, 100);
  assert.equal(piso.alto, 2);
  assert.equal(piso.zonas[0].tipo, "exterior");
  assert.equal(piso.zonas[0].x, 0);
  assert.equal(piso.mesas[0].forma, "cuadrada");
  assert.equal(r.mayorMesa, 5);

  assert.match(normalizarPlano({ pisos: [{ mesas: [{ mesa: 2 }] }, { mesas: [{ mesa: 2 }] }] }).error, /dos veces/);
  assert.match(normalizarPlano({ pisos: [{ mesas: [{ mesa: "A" }] }] }).error, /inválido/);
  assert.match(normalizarPlano({ pisos: [] }).error, /al menos un piso/);
});

test("ocupadas: con fila cuenta los pedidos desde que se ocupó; sin fila, sólo si hay pedidos en curso", () => {
  const r = armarOcupadas(
    [{ mesa: "3", ocupada_desde: "2026-11-26T20:00:00Z" }],
    [
      { id: 1, mesa: "3", estado: "entregado", total: 900, created_at: "2026-11-26T18:00:00Z" }, // cliente anterior
      { id: 2, mesa: "3", estado: "pendiente", total: 1000, created_at: "2026-11-26T20:05:00Z" },
      { id: 3, mesa: "3", estado: "listo", total: 500, created_at: "2026-11-26T20:30:00Z" },
      { id: 4, mesa: "7", estado: "preparando", total: 200, created_at: "2026-11-26T19:00:00Z" },
      { id: 5, mesa: "9", estado: "entregado", total: 200, created_at: "2026-11-26T19:00:00Z" }, // mesa ya cerrada
    ],
  );
  const m3 = r.find((o) => o.mesa === "3");
  assert.deepEqual(m3.pedidos.map((p) => p.id), [2, 3]);
  assert.equal(m3.total, 1500);
  assert.equal(m3.en_curso, 2);
  assert.ok(r.find((o) => o.mesa === "7"));
  assert.equal(r.find((o) => o.mesa === "9"), undefined);
});

test("plano: sólo el dueño lo guarda, y sube la cantidad de mesas si hace falta", async () => {
  const res1 = resMock();
  await guardarPlano({ user: { rol: "manager" }, negocioId: 4, body: { plano: null } }, res1);
  assert.equal(res1.code, 403);

  let patch;
  db.setHandler((q) => {
    if (q.table === "configuracion" && q.op === "select") return { data: { negocio_id: 4, mesas_activo: false, mesas_cantidad: 3 }, error: null };
    if (q.table === "configuracion" && q.op === "update") { patch = { ...q.payload, filtro: q.filters }; return { data: null, error: null }; }
    return { data: null, error: null };
  });
  const res2 = resMock();
  await guardarPlano({ user: { rol: "admin" }, negocioId: 4, headers: {}, body: { plano: { pisos: [{ mesas: [{ mesa: 8 }] }] } } }, res2);
  assert.equal(res2.code, 200);
  assert.equal(patch.mesas_cantidad, 8);
  assert.equal(patch.mesas_activo, true);
  assert.equal(patch.filtro.negocio_id, 4);
});

test("ocupar: exige el QR firmado de una mesa que existe", async () => {
  const filas = [];
  db.setHandler((q) => {
    if (q.table === "configuracion") return { data: { negocio_id: 4, mesas_activo: true, mesas_cantidad: 10, mesas_qr_version: 2 }, error: null };
    if (q.table === "mesas_estado" && q.op === "upsert") filas.push(q.payload);
    return { data: null, error: null };
  });
  const malo = resMock();
  await ocuparMesa({ negocioId: 4, body: { mesa: "5", t: firmarMesa(4, "5", 1) } }, malo); // versión vieja
  assert.equal(malo.code, 400);
  const fuera = resMock();
  await ocuparMesa({ negocioId: 4, body: { mesa: "11", t: firmarMesa(4, "11", 2) } }, fuera);
  assert.equal(fuera.code, 400);
  const ok = resMock();
  await ocuparMesa({ negocioId: 4, body: { mesa: "5", t: firmarMesa(4, "5", 2) } }, ok);
  assert.equal(ok.code, 204);
  assert.deepEqual(filas, [{ negocio_id: 4, mesa: "5" }]);
});

test("liberar: cierra los pedidos en curso de esa mesa y borra la ocupación", async () => {
  const ops = [];
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: q.filters, payload: q.payload });
    if (q.table === "pedidos") return { data: [{ id: 1 }, { id: 2 }], error: null };
    return { data: null, error: null };
  });
  const res = resMock();
  await liberarMesa({ negocioId: 4, params: { mesa: "5" } }, res);
  assert.equal(res.body.pedidos_cerrados, 2);
  const upd = ops.find((o) => o.table === "pedidos");
  assert.equal(upd.payload.estado, "entregado");
  assert.deepEqual(upd.filters, { negocio_id: 4, mesa: "5" });
  assert.ok(ops.find((o) => o.table === "mesas_estado" && o.op === "delete" && o.filters.mesa === "5"));
});
