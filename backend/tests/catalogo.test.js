const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/avisosPedidoService"), { notificarPedido: async () => {}, avisosDisponibles: async () => false });
let subidas;
injectModule(require.resolve("../src/config/cloudinary"), {
  uploader: {
    upload_stream: (opts, cb) => ({ end: () => (subidas.push(opts), cb(null, { public_id: `${opts.folder}/x`, format: "png" })) }),
  },
  utils: { private_download_url: (id, fmt, o) => `https://firmado/${id}?exp=${o.expires_at}&type=${o.type}` },
});
const { validarPersonalizacion } = require("../src/utils/personalizacion");
const { createPedido } = require("../src/controllers/pedidosController");
const { subirAdjunto, verAdjunto, tipoDeArchivo } = require("../src/controllers/adjuntosController");
const { putCampos } = require("../src/controllers/camposController");
const servicios = require("../src/controllers/serviciosController");
const { olvidarModulos } = require("../src/middleware/requiereModulo");
const { LEGADO } = require("../src/utils/modulos");
const { camposSchema, servicioSchema, createPedidoSchema } = require("../src/schemas");

const NEG = 7;
const TOKEN = "a".repeat(48);
const CAMPOS = [
  { id: 1, producto_id: 10, negocio_id: NEG, tipo: "texto", etiqueta: "Nombre", obligatorio: true, orden: 0, opciones: [], validaciones: { max_largo: 10 } },
  { id: 2, producto_id: 10, negocio_id: NEG, tipo: "opcion", etiqueta: "Color", obligatorio: false, orden: 1, opciones: ["Rojo", "Azul"], validaciones: {} },
  { id: 3, producto_id: 10, negocio_id: NEG, tipo: "archivo", etiqueta: "Modelo", obligatorio: false, orden: 2, opciones: [], validaciones: { tipos: ["3d"] } },
];
let negocio, ops, rpcResp;
beforeEach(() => {
  olvidarModulos(NEG);
  ops = [];
  subidas = [];
  rpcResp = null;
  negocio = { id: NEG, activo: true, modulos: { ...LEGADO, personalizados: true, servicios: true } };
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload, inList: q.inList });
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "configuracion") return { data: null, error: null };
    // Búsqueda de un producto puntual (maybeSingle): objeto o null.
    if (q.table === "productos" && q.filters.id) return { data: q.filters.negocio_id === NEG ? { id: 10 } : null, error: null };
    if (q.table === "productos" && q.op === "select")
      return { data: q.filters.negocio_id === NEG ? [{ id: 10, negocio_id: NEG, nombre: "Llavero", precio: 1500, costo: 300, disponible: true, controlar_stock: true, stock: 5 }] : [], error: null };
    if (q.table === "producto_campos" && q.op === "select") return { data: CAMPOS.filter((c) => c.negocio_id === q.filters.negocio_id), error: null };
    if (q.table === "adjuntos" && q.op === "select")
      return q.filters.id
        ? { data: q.filters.negocio_id === NEG ? { id: 4, negocio_id: NEG, public_id: "p/1.stl", resource_type: "raw", tipo: "3d", nombre: "llavero.stl" } : null, error: null }
        : { data: q.filters.negocio_id === NEG ? [{ id: 4, token: TOKEN, tipo: "3d", nombre: "llavero.stl" }] : [], error: null };
    if (q.table === "rpc:crear_pedido") return rpcResp || { data: null, error: null };
    if (q.op === "insert") return { data: Array.isArray(q.payload) ? q.payload.map((p, i) => ({ id: 100 + i, ...p })) : q.payload, error: null };
    return { data: [], error: null };
  });
});
const respuesta = () => {
  const res = { code: 200, body: null, set() {} };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

// ── Validación pura ──
test("personalización: arma la foto en orden y con el archivo", () => {
  const r = validarPersonalizacion(CAMPOS, [
    { campo_id: 3, adjunto: TOKEN },
    { campo_id: 1, valor: "  Ana " },
    { campo_id: 2, valor: "Azul" },
  ], { [TOKEN]: { id: 4, tipo: "3d", nombre: "llavero.stl" } });
  assert.deepEqual(r.snapshot.map((x) => [x.etiqueta, x.valor]), [["Nombre", "Ana"], ["Color", "Azul"], ["Modelo", null]]);
  assert.deepEqual(r.snapshot[2].adjunto, { id: 4, nombre: "llavero.stl" });
  assert.deepEqual(r.tokens, [TOKEN]);
});

test("personalización: obligatorio, largo, opción inexistente, campo ajeno, archivo inválido", () => {
  assert.match(validarPersonalizacion(CAMPOS, []).error, /Nombre/);
  assert.match(validarPersonalizacion(CAMPOS, [{ campo_id: 1, valor: "x".repeat(11) }]).error, /máximo 10/);
  assert.ok(validarPersonalizacion(CAMPOS, [{ campo_id: 1, valor: "Ana" }, { campo_id: 2, valor: "Verde" }]).error);
  assert.ok(validarPersonalizacion(CAMPOS, [{ campo_id: 1, valor: "Ana" }, { campo_id: 99, valor: "x" }]).error);
  assert.ok(validarPersonalizacion(CAMPOS, [{ campo_id: 1, valor: "Ana" }, { campo_id: 3, adjunto: TOKEN }], {}).error);
  assert.ok(
    validarPersonalizacion(CAMPOS, [{ campo_id: 1, valor: "Ana" }, { campo_id: 3, adjunto: TOKEN }], { [TOKEN]: { id: 4, tipo: "pdf" } }).error,
  );
});

test("personalización: número con mínimo/máximo, múltiple y color libre", () => {
  const c = [
    { id: 1, tipo: "numero", etiqueta: "Cant", orden: 0, opciones: [], validaciones: { min: 1, max: 5 } },
    { id: 2, tipo: "multiple", etiqueta: "Extras", orden: 1, opciones: ["A", "B"], validaciones: { max: 1 } },
    { id: 3, tipo: "color", etiqueta: "Color", orden: 2, opciones: [], validaciones: {} },
  ];
  assert.equal(validarPersonalizacion(c, [{ campo_id: 1, valor: "3,0" }]).snapshot[0].valor, 3);
  assert.ok(validarPersonalizacion(c, [{ campo_id: 1, valor: 9 }]).error);
  assert.ok(validarPersonalizacion(c, [{ campo_id: 2, valor: ["A", "B"] }]).error);
  assert.ok(validarPersonalizacion(c, [{ campo_id: 3, valor: "rojo" }]).error);
  assert.equal(validarPersonalizacion(c, [{ campo_id: 3, valor: "#FF0000" }]).snapshot[0].valor, "#FF0000");
});

// ── Pedido con personalización y función atómica ──
const pedir = async (body) => {
  const res = respuesta();
  await createPedido({ negocioId: NEG, body }, res);
  return res;
};
const ITEM = { producto_id: 10, cantidad: 2, personalizacion: [{ campo_id: 1, valor: "Ana" }, { campo_id: 3, adjunto: TOKEN }] };

test("pedido: usa crear_pedido con la foto, el stock y los archivos", async () => {
  rpcResp = { data: { pedido: { id: 55, negocio_id: NEG, total: 3000 }, items: [{ id: 1 }] }, error: null };
  const res = await pedir({ items: [ITEM] });
  assert.equal(res.code, 201);
  const rpc = ops.find((o) => o.table === "rpc:crear_pedido").payload;
  assert.equal(rpc.p_pedido.total, 3000);
  assert.equal(rpc.p_pedido.negocio_id, NEG);
  assert.deepEqual(rpc.p_items[0].personalizacion.map((x) => x.etiqueta), ["Nombre", "Modelo"]);
  assert.equal("_opciones" in rpc.p_items[0], false);
  assert.deepEqual(rpc.p_stock, [{ id: 10, cantidad: 2 }]);
  assert.deepEqual(rpc.p_adjuntos, [TOKEN]);
  assert.equal(ops.some((o) => o.table === "pedidos" && o.op === "insert"), false);
  // Sólo se buscan archivos de este negocio y sin usar.
  const adj = ops.find((o) => o.table === "adjuntos");
  assert.deepEqual([adj.filters.negocio_id, adj.filters.usado], [NEG, false]);
});

test("pedido: falta un campo obligatorio → 400 sin guardar", async () => {
  rpcResp = { data: { pedido: { id: 1 }, items: [] }, error: null };
  const res = await pedir({ items: [{ producto_id: 10, cantidad: 1 }] });
  assert.equal(res.code, 400);
  assert.equal(ops.some((o) => o.table === "rpc:crear_pedido"), false);
});

test("pedido: sin el módulo de personalizados, los campos no se exigen ni se guardan", async () => {
  negocio.modulos = { ...LEGADO };
  rpcResp = { data: { pedido: { id: 2 }, items: [] }, error: null };
  const res = await pedir({ items: [{ producto_id: 10, cantidad: 1, personalizacion: [{ campo_id: 1, valor: "Ana" }] }] });
  assert.equal(res.code, 201);
  const rpc = ops.find((o) => o.table === "rpc:crear_pedido").payload;
  assert.equal(rpc.p_items[0].personalizacion, null);
});

test("pedido: sin la función SQL, personalizar falla claro y sin guardar a medias", async () => {
  const res = await pedir({ items: [ITEM] }); // rpc no responde → PGRST202
  assert.equal(res.code, 500);
  assert.equal(ops.some((o) => o.table === "pedidos" && o.op === "insert"), false);
});

// ── Adjuntos ──
test("tipoDeArchivo: imagen, pdf y 3D por contenido; rechaza el resto", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  assert.equal(tipoDeArchivo(png, "a.png"), "imagen");
  assert.equal(tipoDeArchivo(Buffer.from("%PDF-1.7 xxxx"), "a.pdf"), "pdf");
  assert.equal(tipoDeArchivo(Buffer.from("solid pieza\nfacet"), "pieza.stl"), "3d");
  assert.equal(tipoDeArchivo(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0]), "a.3mf"), "3d");
  assert.equal(tipoDeArchivo(Buffer.from("no es zip para nada"), "a.3mf"), null);
  assert.equal(tipoDeArchivo(Buffer.from("MZ ejecutable......"), "virus.exe"), null);
  assert.equal(tipoDeArchivo(Buffer.from("<svg onload=alert(1)>"), "a.svg"), null);
});

test("subir adjunto: privado, en la carpeta del negocio, con token de un solo uso", async () => {
  const res = respuesta();
  await subirAdjunto({ query: { negocio: String(NEG) }, headers: {}, file: { buffer: Buffer.from("solid x\n"), originalname: "../../pieza.stl", size: 8 } }, res);
  assert.equal(res.code, 201);
  assert.match(res.body.token, /^[a-f0-9]{48}$/);
  assert.equal(res.body.nombre, "pieza.stl");
  assert.equal(subidas[0].type, "authenticated");
  assert.equal(subidas[0].folder, `menu-digital/adjuntos/${NEG}`);
  const ins = ops.find((o) => o.table === "adjuntos" && o.op === "insert").payload[0];
  assert.equal(ins.negocio_id, NEG);
});

test("subir adjunto: sin negocio, sin módulo o negocio inactivo → no sube", async () => {
  const sinNeg = respuesta();
  await subirAdjunto({ query: {}, headers: {}, file: { buffer: Buffer.from("solid"), originalname: "a.stl" } }, sinNeg);
  assert.equal(sinNeg.code, 400);
  negocio.modulos = { ...LEGADO };
  const sinMod = respuesta();
  await subirAdjunto({ query: { negocio: String(NEG) }, headers: {}, file: { buffer: Buffer.from("solid x"), originalname: "a.stl" } }, sinMod);
  assert.equal(sinMod.code, 403);
  olvidarModulos(NEG);
  negocio.activo = false;
  const inactivo = respuesta();
  await subirAdjunto({ query: { negocio: String(NEG) }, headers: {}, file: { buffer: Buffer.from("solid x"), originalname: "a.stl" } }, inactivo);
  assert.equal(inactivo.code, 404);
  assert.equal(subidas.length, 0);
});

test("ver adjunto: link firmado sólo para el negocio dueño", async () => {
  const ok = respuesta();
  await verAdjunto({ negocioId: NEG, params: { id: "4" } }, ok);
  assert.match(ok.body.url, /^https:\/\/firmado\/p\/1\.stl\?exp=\d+&type=authenticated$/);
  const ajeno = respuesta();
  await verAdjunto({ negocioId: 99, params: { id: "4" } }, ajeno);
  assert.equal(ajeno.code, 404);
});

// ── Campos (panel) ──
test("campos: sin el módulo → 403; producto de otro negocio → 404", async () => {
  negocio.modulos = { ...LEGADO };
  const r1 = respuesta();
  await putCampos({ negocioId: NEG, params: { id: "10" }, body: { campos: [] } }, r1);
  assert.equal(r1.code, 403);
  olvidarModulos(NEG);
  negocio.modulos = { ...LEGADO, personalizados: true };
  const r2 = respuesta();
  await putCampos({ negocioId: 99, params: { id: "10" }, body: { campos: [] } }, r2);
  assert.equal(r2.code, 404);
});

test("campos: guarda los nuevos antes de borrar los viejos", async () => {
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload, inList: q.inList });
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "productos") return { data: { id: 10 }, error: null };
    if (q.table === "producto_campos" && q.op === "select") return { data: [{ id: 1 }, { id: 2 }], error: null };
    if (q.op === "insert") return { data: q.payload.map((p, i) => ({ id: 50 + i, ...p })), error: null };
    return { data: [], error: null };
  });
  const res = respuesta();
  await putCampos({ negocioId: NEG, params: { id: "10" }, body: { campos: [{ tipo: "texto", etiqueta: "Frase", opciones: [], validaciones: {} }] } }, res);
  const iIns = ops.findIndex((o) => o.op === "insert");
  const iDel = ops.findIndex((o) => o.op === "delete");
  assert.ok(iIns >= 0 && iDel > iIns);
  assert.deepEqual(ops[iDel].inList.vals, [1, 2]);
  assert.equal(ops[iDel].filters.negocio_id, NEG);
  assert.equal(res.body[0].etiqueta, "Frase");
});

// ── Servicios ──
test("servicios: el público no ve nada sin el módulo; el panel sólo toca su negocio", async () => {
  negocio.modulos = { ...LEGADO };
  const pub = respuesta();
  await servicios.getServiciosDisponibles({ headers: { "x-negocio-id": String(NEG) }, query: {} }, pub);
  assert.deepEqual(pub.body, []);

  const upd = respuesta();
  await servicios.updateServicio({ negocioId: NEG, params: { id: "3" }, body: servicioSchema.parse({ nombre: "Corte", precio: 8000 }) }, upd);
  const u = ops.find((o) => o.table === "servicios" && o.op === "update");
  assert.deepEqual([u.filters.id, u.filters.negocio_id], [3, NEG]);
});

test("servicios: precio variable se guarda sin precio", async () => {
  const res = respuesta();
  await servicios.createServicio({ negocioId: NEG, body: servicioSchema.parse({ nombre: "Instalación", tipo_precio: "variable", precio: 999 }) }, res);
  const ins = ops.find((o) => o.table === "servicios" && o.op === "insert").payload[0];
  assert.equal(ins.precio, null);
  assert.equal(ins.negocio_id, NEG);
});

// ── Esquemas ──
test("esquemas: campos, servicios y personalización en el pedido", () => {
  assert.equal(camposSchema.safeParse({ campos: [{ tipo: "opcion", etiqueta: "Talle", opciones: [] }] }).success, false);
  assert.equal(camposSchema.safeParse({ campos: [{ tipo: "texto", etiqueta: "Nombre" }] }).success, true);
  assert.equal(servicioSchema.safeParse({ nombre: "Corte" }).success, false); // fijo sin precio
  assert.equal(servicioSchema.safeParse({ nombre: "Corte", tipo_precio: "variable" }).success, true);
  assert.equal(
    createPedidoSchema.safeParse({ items: [{ producto_id: 1, personalizacion: [{ campo_id: 1, adjunto: "no-hex" }] }] }).success,
    false,
  );
});

// ── Correcciones de la revisión ──
test("campos: los que ya existen conservan su id; los quitados se borran", async () => {
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload, inList: q.inList });
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "productos") return { data: { id: 10 }, error: null };
    if (q.table === "producto_campos" && q.op === "select") return { data: [{ id: 1 }, { id: 2 }], error: null };
    if (q.op === "update") return { data: { id: q.filters.id, ...q.payload }, error: null };
    if (q.op === "insert") return { data: q.payload.map((p, i) => ({ id: 80 + i, ...p })), error: null };
    return { data: [], error: null };
  });
  const res = respuesta();
  await putCampos(
    { negocioId: NEG, params: { id: "10" }, body: { campos: [{ id: 1, tipo: "texto", etiqueta: "Nombre" }, { tipo: "numero", etiqueta: "Alto" }] } },
    res,
  );
  const upd = ops.find((o) => o.op === "update");
  assert.deepEqual([upd.filters.id, upd.filters.negocio_id], [1, NEG]);
  assert.deepEqual(ops.find((o) => o.op === "delete").inList.vals, [2]);
  assert.deepEqual(res.body.map((c) => c.id), [1, 80]);
});

test("pedido: si el archivo ya lo tomó otro pedido, 400 claro", async () => {
  rpcResp = { data: null, error: { code: "P0001", message: "ADJUNTO_NO_DISPONIBLE" } };
  const res = await pedir({ items: [ITEM] });
  assert.equal(res.code, 400);
  assert.match(res.body.message, /archivo/);
});

test("subir adjunto: tope de archivos sin usar por negocio → 429", async () => {
  const base = db;
  db.setHandler((q) => {
    if (q.table === "negocios") return { data: negocio, error: null };
    if (q.table === "adjuntos" && q.selectOpts?.head) return { data: null, count: 50, error: null };
    return { data: null, error: null };
  });
  const res = respuesta();
  await subirAdjunto({ query: { negocio: String(NEG) }, headers: {}, file: { buffer: Buffer.from("solid x\n"), originalname: "a.stl", size: 8 } }, res);
  assert.equal(res.code, 429);
  assert.equal(subidas.length, 0);
  void base;
});

test("subir adjunto: un PDF con nombre .html se guarda como .pdf", async () => {
  const res = respuesta();
  await subirAdjunto({ query: { negocio: String(NEG) }, headers: {}, file: { buffer: Buffer.from("%PDF-1.7 hola"), originalname: "trampa.html", size: 13 } }, res);
  assert.equal(res.code, 201);
  assert.match(subidas[0].public_id, /\.pdf$/);
});

test("esquemas: mínimo mayor que máximo y imagen de servicio no https se rechazan", () => {
  assert.equal(camposSchema.safeParse({ campos: [{ tipo: "numero", etiqueta: "Alto", validaciones: { min: 10, max: 5 } }] }).success, false);
  assert.equal(servicioSchema.safeParse({ nombre: "Corte", precio: 1, imagen_url: "http://x.com/a.png" }).success, false);
  assert.equal(servicioSchema.safeParse({ nombre: "Corte", precio: 1, imagen_url: "https://res.cloudinary.com/a.png" }).success, true);
});

test("limpieza: borra de Cloudinary y de la tabla sólo los archivos sin usar viejos", async () => {
  const destruidos = [];
  require.cache[require.resolve("../src/config/cloudinary")].exports.uploader.destroy = async (id, o) => destruidos.push([id, o.type]);
  const { limpiarAdjuntos } = require("../src/services/limpiezaAdjuntos");
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, lts: q.lts, inList: q.inList });
    if (q.table === "adjuntos" && q.op === "select") return { data: [{ id: 5, public_id: "p/5", resource_type: "raw" }], error: null };
    return { data: null, error: null };
  });
  const n = await limpiarAdjuntos();
  assert.equal(n, 1);
  assert.deepEqual(destruidos, [["p/5", "authenticated"]]);
  const sel = ops.find((o) => o.table === "adjuntos" && o.op === "select");
  assert.equal(sel.filters.usado, false);
  assert.ok(sel.lts.created_at);
  const del = ops.find((o) => o.op === "delete");
  assert.deepEqual([del.inList.vals, del.filters.usado], [[5], false]);
});
