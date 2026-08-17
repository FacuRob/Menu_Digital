const { test } = require("node:test");
const assert = require("node:assert");
const {
  loginSchema,
  registerSchema,
  signupSchema,
  resetPasswordSchema,
  createPedidoSchema,
  productoSchema,
  varianteGrupoSchema,
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

test("registerSchema: acepta admin y staff (roles nuevos)", () => {
  for (const rol of ["admin", "staff"]) {
    const r = registerSchema.safeParse({
      username: "juan",
      password: "12345678",
      rol,
    });
    assert.equal(r.success, true, `rol ${rol} debería ser válido`);
  }
});

test("registerSchema: rechaza roles legacy (superadmin/editor/visor)", () => {
  for (const rol of ["superadmin", "editor", "visor"]) {
    const r = registerSchema.safeParse({
      username: "juan",
      password: "12345678",
      rol,
    });
    assert.equal(r.success, false, `rol legacy ${rol} ya no debe asignarse`);
  }
});

test("signupSchema: valida y normaliza el email a minúsculas", () => {
  const r = signupSchema.safeParse({
    negocio: "Bar Demo",
    email: "  User@Mail.com ",
    password: "12345678",
  });
  assert.equal(r.success, true);
  assert.equal(r.data.email, "user@mail.com");
});

test("signupSchema: rechaza password corta, email inválido y negocio corto", () => {
  assert.equal(
    signupSchema.safeParse({ negocio: "Bar Demo", email: "a@b.com", password: "1234567" }).success,
    false,
  );
  assert.equal(
    signupSchema.safeParse({ negocio: "Bar Demo", email: "no-mail", password: "12345678" }).success,
    false,
  );
  assert.equal(
    signupSchema.safeParse({ negocio: "X", email: "a@b.com", password: "12345678" }).success,
    false,
  );
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

test("createPedidoSchema: acepta opciones (ids de variante) y las coacciona a número", () => {
  const r = createPedidoSchema.safeParse({
    items: [{ producto_id: 1, cantidad: 1, opciones: ["5", 8] }],
  });
  assert.equal(r.success, true);
  assert.deepEqual(r.data.items[0].opciones, [5, 8]);
});

test("varianteGrupoSchema: exige nombre y aplica defaults (tipo single, opciones [])", () => {
  const r = varianteGrupoSchema.safeParse({ nombre: "Talle" });
  assert.equal(r.success, true);
  assert.equal(r.data.tipo, "single");
  assert.equal(r.data.obligatorio, false);
  assert.deepEqual(r.data.opciones, []);
});

test("varianteGrupoSchema: rechaza tipo inválido y opción sin nombre", () => {
  assert.equal(
    varianteGrupoSchema.safeParse({ nombre: "X", tipo: "triple" }).success,
    false,
  );
  assert.equal(
    varianteGrupoSchema.safeParse({
      nombre: "X",
      opciones: [{ precio_extra: 5 }],
    }).success,
    false,
  );
});

test("productoSchema: requiere nombre/precio/categoria y coacciona tipos", () => {
  const r = productoSchema.safeParse({
    nombre: "  Remera  ",
    precio: "1999.50",
    categoria_id: "3",
    controlar_stock: "true",
    atributos: { Marca: "Nike", Talle: "M" },
  });
  assert.equal(r.success, true);
  assert.equal(r.data.nombre, "Remera");
  assert.equal(r.data.precio, 1999.5);
  assert.equal(r.data.categoria_id, 3);
  assert.equal(r.data.controlar_stock, true);
});

test("productoSchema: rechaza sin nombre y con precio negativo", () => {
  assert.equal(
    productoSchema.safeParse({ nombre: "", precio: 10, categoria_id: 1 }).success,
    false,
  );
  assert.equal(
    productoSchema.safeParse({ nombre: "X", precio: -1, categoria_id: 1 }).success,
    false,
  );
});

test("productoSchema: rechaza atributos con más de 30 claves", () => {
  const atributos = {};
  for (let i = 0; i < 31; i++) atributos[`k${i}`] = "v";
  const r = productoSchema.safeParse({
    nombre: "X",
    precio: 1,
    categoria_id: 1,
    atributos,
  });
  assert.equal(r.success, false);
});

test("varianteGrupoSchema: coacciona precio_extra string→number en opciones", () => {
  const r = varianteGrupoSchema.safeParse({
    nombre: "Extras",
    tipo: "multi",
    opciones: [{ nombre: "Queso", precio_extra: "1.5" }],
  });
  assert.equal(r.success, true);
  assert.equal(r.data.opciones[0].precio_extra, 1.5);
});
