const { test } = require("node:test");
const assert = require("node:assert");
const { getNegocioId } = require("../src/utils/negocio");

test("getNegocioId: prioriza req.negocioId (validado por scopeNegocio)", () => {
  const req = { negocioId: 7, query: { negocio: "99" }, headers: {} };
  assert.equal(getNegocioId(req), 7);
});

test("getNegocioId: menú público lee ?negocio_id", () => {
  const req = { query: { negocio_id: "5" }, headers: {} };
  assert.equal(getNegocioId(req), 5);
});

test("getNegocioId: menú público lee ?negocio", () => {
  const req = { query: { negocio: "12" }, headers: {} };
  assert.equal(getNegocioId(req), 12);
});

test("getNegocioId: cae a 1 por defecto si no hay nada válido", () => {
  assert.equal(getNegocioId({ query: {}, headers: {} }), 1);
  assert.equal(getNegocioId({ query: { negocio: "abc" }, headers: {} }), 1);
});

test("getNegocioId: ignora req.negocioId no positivo", () => {
  const req = { negocioId: 0, query: { negocio: "8" }, headers: {} };
  assert.equal(getNegocioId(req), 8);
});
