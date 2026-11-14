const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const { injectModule } = require("./helpers/supabaseMock");

// Cloudinary falso: registra lo que se sube y lo que se borra.
let subidas, borradas;
injectModule(require.resolve("../src/config/cloudinary"), {
  uploader: {
    upload_stream: (opts, cb) => ({
      end: () => {
        subidas.push(opts);
        cb(null, { secure_url: "https://x/y.png", public_id: `${opts.folder}/abc` });
      },
    }),
    destroy: async (id) => borradas.push(id),
  },
});
const { esImagen } = require("../src/utils/imagen");
const router = require("../src/routes/upload");

beforeEach(() => {
  subidas = [];
  borradas = [];
});

const handler = (metodo) => {
  const pila = router.stack.find((l) => l.route?.methods[metodo]).route.stack;
  return pila[pila.length - 1].handle; // el último es el handler (antes va multer)
};
const respuesta = () => {
  const res = { code: 200, body: null };
  res.status = (c) => ((res.code = c), res);
  res.json = (b) => ((res.body = b), res);
  return res;
};

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]);
const GIF = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(10)]);

test("esImagen: reconoce png, jpg, webp y gif por su contenido", () => {
  for (const b of [PNG, JPG, WEBP, GIF]) assert.equal(esImagen(b), true);
});

test("esImagen: rechaza un archivo que sólo dice ser imagen", () => {
  assert.equal(esImagen(Buffer.from("<script>alert(1)</script>")), false);
  assert.equal(esImagen(Buffer.from("%PDF-1.7 ............")), false);
  assert.equal(esImagen(Buffer.alloc(3)), false);
  assert.equal(esImagen(null), false);
});

test("subida: va a la carpeta del negocio", async () => {
  const res = respuesta();
  await handler("post")({ negocioId: 7, file: { buffer: PNG } }, res);
  assert.equal(res.code, 200);
  assert.equal(subidas[0].folder, "menu-digital/negocios/7");
});

test("subida: un archivo disfrazado de imagen se rechaza sin llegar a Cloudinary", async () => {
  const res = respuesta();
  await handler("post")({ negocioId: 7, file: { buffer: Buffer.from("no soy una imagen, lo prometo") } }, res);
  assert.equal(res.code, 400);
  assert.equal(subidas.length, 0);
});

test("borrado: sólo imágenes de la carpeta del propio negocio", async () => {
  const del = handler("delete");
  for (const id of [
    "menu-digital/negocios/8/abc", // de otro negocio
    "menu-digital/negocios/70/abc", // prefijo parecido
    "menu-digital/productos/abc", // carpeta vieja compartida
    "menu-digital/soporte/abc",
    "menu-digital/negocios/7/../8/abc",
  ]) {
    const res = respuesta();
    await del({ negocioId: 7, body: { public_id: id } }, res);
    assert.equal(res.code, 403, id);
  }
  assert.deepEqual(borradas, []);

  const ok = respuesta();
  await del({ negocioId: 7, body: { public_id: "menu-digital/negocios/7/abc" } }, ok);
  assert.equal(ok.code, 200);
  assert.deepEqual(borradas, ["menu-digital/negocios/7/abc"]);
});
