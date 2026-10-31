const { test } = require("node:test");
const assert = require("node:assert");
const { createSupabaseMock } = require("./helpers/supabaseMock");
const { slugify, slugDisponible, slugUnico } = require("../src/utils/slug");

// Mock: `ocupados` es { slug: id } de los negocios existentes.
const dbCon = (ocupados) => {
  const db = createSupabaseMock();
  db.setHandler((q) => {
    const id = ocupados[q.filters.slug];
    return { data: id ? { id } : null, error: null };
  });
  return db;
};

test("slugify: normaliza acentos, espacios y símbolos", () => {
  assert.equal(slugify("  Pizzería Roma & Co. "), "pizzeria-roma-co");
  assert.equal(slugify(""), "");
});

test("slugify: respeta el largo máximo sin dejar guion final", () => {
  assert.equal(slugify("abc def", 4), "abc");
});

test("slugUnico: si está libre, devuelve el slug tal cual", async () => {
  assert.equal(await slugUnico(dbCon({}), "Pizzería Roma"), "pizzeria-roma");
});

test("slugUnico: si está tomado por otra cuenta, agrega un número", async () => {
  const db = dbCon({ "pizzeria-roma": 5, "pizzeria-roma-2": 9 });
  assert.equal(await slugUnico(db, "Pizzería Roma"), "pizzeria-roma-3");
});

test("slugUnico: texto vacío usa 'negocio'", async () => {
  assert.equal(await slugUnico(dbCon({}), "!!!"), "negocio");
});

test("slugDisponible: el propio negocio no cuenta como ocupado al editar", async () => {
  const db = dbCon({ "bar-juan": 7 });
  assert.equal(await slugDisponible(db, "bar-juan", { excludeId: "7" }), true);
  assert.equal(await slugDisponible(db, "bar-juan", { excludeId: 8 }), false);
});
