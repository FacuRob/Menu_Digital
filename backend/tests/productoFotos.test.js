const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);

let borradas;
injectModule(require.resolve("../src/config/cloudinary"), {
  uploader: { destroy: async (id) => borradas.push(id) },
});
let modulos;
injectModule(require.resolve("../src/middleware/requiereModulo"), { modulosNegocio: async () => modulos });
injectModule(require.resolve("../src/controllers/camposController"), { camposPorProducto: async () => ({}) });
injectModule(require.resolve("../src/utils/registroCambios"), { registrar: () => {} });

const { createProducto, updateProducto, getProductosDisponibles } = require("../src/controllers/productosController");
const { productoSchema } = require("../src/schemas");

const NEG = 7;
const cld = (n, neg = NEG) => `https://res.cloudinary.com/x/image/upload/v1/menu-digital/negocios/${neg}/${n}.jpg`;

let ops;
let actual; // fila del producto en la base (para update)
let rpcData;
let fotosTabla; // filas de select("id, imagenes") o error

beforeEach(() => {
  ops = [];
  borradas = [];
  modulos = { productos: true, personalizados: false };
  actual = { id: 1, imagen_url: cld("a"), imagenes: [cld("a"), cld("b"), cld("c")] };
  rpcData = [];
  fotosTabla = { data: [], error: null };
  db.setHandler((q) => {
    ops.push(q);
    if (q.op === "rpc") return { data: rpcData, error: null };
    if (q.table === "productos" && q.op === "insert") return { data: { id: 9, ...q.payload[0] }, error: null };
    if (q.table === "productos" && q.op === "update") return { data: { id: 1, ...q.payload }, error: null };
    if (q.table === "productos" && q.op === "select" && q.filters.id) return { data: actual, error: null };
    if (q.table === "productos" && q.op === "select") return fotosTabla;
    return { data: null, error: null };
  });
});

const res = () => {
  const r = { code: 200, body: null };
  r.status = (c) => ((r.code = c), r);
  r.json = (b) => ((r.body = b), r);
  return r;
};
const payload = (op) => ops.find((o) => o.table === "productos" && o.op === op)?.payload;
const base = { nombre: "Taza", precio: 100, categoria_id: 1 };

test("crear con 3 fotos: la primera es la principal y se guarda la lista", async () => {
  await createProducto({ negocioId: NEG, body: { ...base, imagenes: [cld("a"), cld("b"), cld("a"), cld("c")] } }, res());
  const p = payload("insert")[0];
  assert.equal(p.imagen_url, cld("a"));
  assert.deepEqual(p.imagenes, [cld("a"), cld("b"), cld("c")]); // sin repetidas
});

test("crear con una sola foto: no manda `imagenes` (anda sin la migración)", async () => {
  await createProducto({ negocioId: NEG, body: { ...base, imagen_url: cld("a") } }, res());
  const p = payload("insert")[0];
  assert.equal(p.imagen_url, cld("a"));
  assert.equal("imagenes" in p, false);
});

test("editar: cambia el orden y borra de Cloudinary sólo la foto que se sacó", async () => {
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagenes: [cld("c"), cld("a")] } }, res());
  const p = payload("update");
  assert.equal(p.imagen_url, cld("c"));
  assert.deepEqual(p.imagenes, [cld("c"), cld("a")]);
  assert.deepEqual(borradas, [`menu-digital/negocios/${NEG}/b`]);
});

test("editar: una foto de otro negocio puesta a mano nunca se borra", async () => {
  actual = { id: 1, imagen_url: cld("x", 99), imagenes: [cld("x", 99)] };
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagenes: [] } }, res());
  assert.equal(payload("update").imagen_url, null);
  assert.deepEqual(borradas, []);
});

test("editar sin la migración: con una foto anda; con varias avisa claro y no toca nada", async () => {
  actual = { id: 1, imagen_url: cld("a") };
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagenes: [cld("b")] } }, res());
  const p = payload("update");
  assert.equal(p.imagen_url, cld("b"));
  assert.equal("imagenes" in p, false);
  assert.deepEqual(borradas, [`menu-digital/negocios/${NEG}/a`]);

  ops = [];
  borradas = [];
  const r = res();
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagenes: [cld("b"), cld("c")] } }, r);
  assert.equal(r.code, 409);
  assert.equal(payload("update"), undefined);
  assert.deepEqual(borradas, []);
});

test("menú público: cada producto trae sus fotos; sin lista, la de siempre", async () => {
  rpcData = [
    { id: 1, imagen_url: cld("a") },
    { id: 2, imagen_url: cld("z") },
    { id: 3, imagen_url: null },
  ];
  fotosTabla = { data: [{ id: 1, imagenes: [cld("a"), cld("b")] }, { id: 2, imagenes: [] }, { id: 3, imagenes: [] }], error: null };
  const r = res();
  await getProductosDisponibles({ query: { negocio: String(NEG) }, headers: {} }, r);
  assert.deepEqual(r.body.map((p) => p.imagenes), [[cld("a"), cld("b")], [cld("z")], []]);
});

test("menú público sin la migración: la consulta de fotos falla y no rompe nada", async () => {
  rpcData = [{ id: 1, imagen_url: cld("a") }];
  fotosTabla = { data: null, error: { message: "column productos.imagenes does not exist" } };
  const r = res();
  await getProductosDisponibles({ query: { negocio: String(NEG) }, headers: {} }, r);
  assert.equal(r.code, 200);
  assert.deepEqual(r.body[0].imagenes, [cld("a")]);
});

test("esquema: hasta 6 fotos y sólo https", () => {
  const seis = Array.from({ length: 6 }, (_, i) => cld(i));
  assert.equal(productoSchema.safeParse({ ...base, imagenes: seis }).success, true);
  assert.equal(productoSchema.safeParse({ ...base, imagenes: [...seis, cld(7)] }).success, false);
  assert.equal(productoSchema.safeParse({ ...base, imagenes: ["http://x.com/a.jpg"] }).success, false);
  assert.equal(productoSchema.safeParse({ ...base, imagenes: ["javascript:alert(1)"] }).success, false);
});

test("editar sin `imagenes` (p. ej. el interruptor de disponible): conserva las fotos extra", async () => {
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagen_url: cld("a"), disponible: false } }, res());
  const p = payload("update");
  assert.deepEqual(p.imagenes, [cld("a"), cld("b"), cld("c")]);
  assert.deepEqual(borradas, []);
});

test("panel viejo cambia la principal: reemplaza sólo la primera", async () => {
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagen_url: cld("n") } }, res());
  const p = payload("update");
  assert.equal(p.imagen_url, cld("n"));
  assert.deepEqual(p.imagenes, [cld("n"), cld("b"), cld("c")]);
  assert.deepEqual(borradas, [`menu-digital/negocios/${NEG}/a`]);
});

test("editar sin nada de fotos (ni `imagenes` ni `imagen_url`): quedan todas", async () => {
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, disponible: false } }, res());
  assert.deepEqual(payload("update").imagenes, [cld("a"), cld("b"), cld("c")]);
  assert.deepEqual(borradas, []);
});

test("si el guardado falla, no se borra nada de Cloudinary", async () => {
  db.setHandler((q) => {
    if (q.table === "productos" && q.op === "update") return { data: null, error: { message: "falló" } };
    if (q.table === "productos" && q.op === "select") return { data: actual, error: null };
    return { data: null, error: null };
  });
  const r = res();
  await updateProducto({ negocioId: NEG, params: { id: 1 }, body: { ...base, imagenes: [cld("a")] } }, r);
  assert.equal(r.code, 404);
  assert.deepEqual(borradas, []);
});

test("borrar el producto borra todas sus fotos del negocio", async () => {
  const { deleteProducto } = require("../src/controllers/productosController");
  db.setHandler((q) => {
    if (q.table === "productos" && q.op === "delete") return { data: { id: 1, nombre: "Taza", ...actual }, error: null };
    return { data: null, error: null };
  });
  await deleteProducto({ negocioId: NEG, params: { id: 1 } }, res());
  assert.deepEqual(borradas, ["a", "b", "c"].map((n) => `menu-digital/negocios/${NEG}/${n}`));
});

test("alta con varias fotos sin la migración: 409 claro, no 500", async () => {
  db.setHandler((q) => {
    if (q.table === "productos" && q.op === "insert")
      return { data: null, error: { message: "Could not find the 'imagenes' column of 'productos'" } };
    return { data: null, error: null };
  });
  const r = res();
  await createProducto({ negocioId: NEG, body: { ...base, imagenes: [cld("a"), cld("b")] } }, r);
  assert.equal(r.code, 409);
});
