const { test } = require("node:test");
const assert = require("node:assert");
const { safeEqual } = require("../src/utils/safeEqual");

test("safeEqual: true para strings idénticos", () => {
  assert.equal(safeEqual("secreto-abc-123", "secreto-abc-123"), true);
});

test("safeEqual: false para strings distintos del mismo largo", () => {
  assert.equal(safeEqual("secreto-abc-123", "secreto-abc-124"), false);
});

test("safeEqual: false para largos distintos (no lanza excepción)", () => {
  assert.equal(safeEqual("corto", "un-secreto-mucho-mas-largo"), false);
});

test("safeEqual: false si algún lado no es string", () => {
  assert.equal(safeEqual(undefined, "x"), false);
  assert.equal(safeEqual("x", null), false);
  assert.equal(safeEqual(123, 123), false);
});

test("safeEqual: false para vacío contra secreto", () => {
  assert.equal(safeEqual("", "secreto"), false);
});
