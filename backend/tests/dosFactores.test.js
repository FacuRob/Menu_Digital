const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.JWT_SECRET = "jwt-de-test";

const db = createSupabaseMock();
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/emailService"), { sendPasswordResetEmail: async () => {} });
const df = require("../src/utils/dosFactores");
const { login } = require("../src/controllers/authController");
const dosFactores = require("../src/controllers/dosFactoresController");

// RFC 6238, vector SHA-1: secreto "12345678901234567890", T=59 s → 94287082 (8 díg.)
const SECRETO_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP: coincide con el vector oficial del RFC 6238", () => {
  assert.equal(df.codigoEnPaso(SECRETO_RFC, df.pasoActual(59_000)), "287082");
});

test("TOTP: acepta ±1 paso y rechaza reusar el mismo código", () => {
  const ms = 1_700_000_000_000;
  const paso = df.pasoActual(ms);
  const codigo = df.codigoEnPaso(SECRETO_RFC, paso);
  assert.equal(df.verificarCodigo(SECRETO_RFC, codigo, null, ms), paso);
  assert.equal(df.verificarCodigo(SECRETO_RFC, codigo, null, ms + 30_000), paso);
  assert.equal(df.verificarCodigo(SECRETO_RFC, codigo, paso, ms), null);
  assert.equal(df.verificarCodigo(SECRETO_RFC, "000000", null, ms), null);
  assert.equal(df.verificarCodigo(SECRETO_RFC, "abc", null, ms), null);
});

test("cifrado del secreto: ida y vuelta, y no queda en claro", () => {
  const g = df.cifrar("SECRETO");
  assert.ok(!g.includes("SECRETO"));
  assert.equal(df.descifrar(g), "SECRETO");
});

test("el desafío no sirve como sesión (otra clave) y vence", () => {
  const d = df.crearDesafio(7);
  assert.equal(df.leerDesafio(d), 7);
  assert.throws(() => jwt.verify(d, process.env.JWT_SECRET));
  assert.equal(df.leerDesafio(jwt.sign({ id: 7 }, process.env.JWT_SECRET)), null);
});

// ── Flujo de login con el mock de la BD ──
let usuario;
let updates;
const secreto = df.generarSecreto();
const respaldo = ["abcde-12345"];

beforeEach(async () => {
  updates = [];
  usuario = {
    id: 5,
    username: "duenio",
    password: await bcrypt.hash("clave-segura", 4),
    rol: "admin",
    activo: true,
    cuenta_id: 1,
    totp_activo: true,
    totp_secreto: df.cifrar(secreto),
    totp_respaldo: respaldo.map(df.hashRespaldo),
    totp_ultimo_paso: null,
  };
  db.setHandler((q) => {
    if (q.table === "usuarios" && q.op === "select") return { data: usuario, error: null };
    if (q.table === "usuarios" && q.op === "update") {
      updates.push(q.payload);
      return { data: null, error: null };
    }
    if (q.table === "roles_permisos") return { data: { permisos: ["*"] }, error: null };
    return { data: null, error: null };
  });
});

const llamar = async (fn, body) => {
  const res = {
    code: 200,
    body: null,
    status(c) {
      this.code = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  await fn({ body }, res);
  return res;
};

test("login con 2FA: la contraseña sola no da sesión", async () => {
  const r = await llamar(login, { username: "duenio", password: "clave-segura" });
  assert.equal(r.body.requiere_2fa, true);
  assert.equal(r.body.token, undefined);
  assert.equal(df.leerDesafio(r.body.desafio), 5);
});

test("2º paso: código correcto da sesión; incorrecto no", async () => {
  const desafio = df.crearDesafio(5);
  const mal = await llamar(dosFactores.verificar, { desafio, codigo: "000000" });
  assert.equal(mal.code, 401);

  const ok = await llamar(dosFactores.verificar, {
    desafio,
    codigo: df.codigoEnPaso(secreto, df.pasoActual()),
  });
  assert.equal(ok.code, 200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.totp_activo, true);
  assert.equal(updates[0].totp_ultimo_paso, df.pasoActual());
});

test("2º paso: un código de respaldo sirve una vez y se consume", async () => {
  const r = await llamar(dosFactores.verificar, { desafio: df.crearDesafio(5), codigo: "ABCDE-12345" });
  assert.equal(r.code, 200);
  assert.deepEqual(updates[0].totp_respaldo, []);
});

test("2º paso: desafío vencido o inventado → 401", async () => {
  const r = await llamar(dosFactores.verificar, { desafio: "basura.basura.basura", codigo: "123456" });
  assert.equal(r.code, 401);
});

test("login sin 2FA: sesión directa como siempre", async () => {
  usuario.totp_activo = false;
  const r = await llamar(login, { username: "duenio", password: "clave-segura" });
  assert.ok(r.body.token);
  assert.equal(r.body.requiere_2fa, undefined);
});
