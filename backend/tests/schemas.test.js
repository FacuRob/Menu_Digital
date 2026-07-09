const { test } = require("node:test");
const assert = require("node:assert");
const {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  createPedidoSchema,
} = require("../src/schemas");

test("loginSchema: rechaza body vacío", () => {
  assert.equal(loginSchema.safeParse({}).success, false);
});

test("loginSchema: acepta y trimea el username", () => {
  const r = loginSchema.safeParse({ username: "  admin  ", password: "x" });
  assert.equal(r.success, true);
  assert.equal(r.data.username, "admin");
});

test("registerSchema: rechaza email inválido", () => {
  const r = registerSchema.safeParse({
    username: "juan",
    password: "12345678",
    email: "no-es-mail",
  });
  assert.equal(r.success, false);
});

test("registerSchema: rechaza password corta (<8)", () => {
  const r = registerSchema.safeParse({ username: "juan", password: "1234567" });
  assert.equal(r.success, false);
});

test("registerSchema: rechaza rol fuera del enum", () => {
  const r = registerSchema.safeParse({
    username: "juan",
    password: "12345678",
    rol: "root",
  });
  assert.equal(r.success, false);
});

test("resetPasswordSchema: exige token y password >=8", () => {
  assert.equal(
    resetPasswordSchema.safeParse({ token: "t", newPassword: "123" }).success,
    false,
  );
  assert.equal(
    resetPasswordSchema.safeParse({ token: "t", newPassword: "12345678" })
      .success,
    true,
  );
});

test("createPedidoSchema: rechaza items vacío", () => {
  assert.equal(createPedidoSchema.safeParse({ items: [] }).success, false);
});

test("createPedidoSchema: coacciona cantidad string→number y limpia claves extra", () => {
  const r = createPedidoSchema.safeParse({
    items: [{ producto_id: 1, cantidad: "2" }],
    tipo_entrega: "retiro",
    hackeo: "DROP TABLE",
  });
  assert.equal(r.success, true);
  assert.equal(r.data.items[0].cantidad, 2);
  assert.equal(r.data.hackeo, undefined); // claves desconocidas descartadas
});

test("createPedidoSchema: rechaza tipo_entrega fuera del enum", () => {
  const r = createPedidoSchema.safeParse({
    items: [{ producto_id: 1 }],
    tipo_entrega: "teletransporte",
  });
  assert.equal(r.success, false);
});
