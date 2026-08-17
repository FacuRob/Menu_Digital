const { test } = require("node:test");
const assert = require("node:assert");
const { estaVigente, diasRestantes, MS_DIA } = require("../src/utils/suscripcion");

const enDias = (n) => new Date(Date.now() + n * MS_DIA).toISOString();

test("estaVigente: activo siempre vigente (aunque no haya periodo_fin)", () => {
  assert.equal(estaVigente({ estado_suscripcion: "activo", periodo_fin: null }), true);
});

test("estaVigente: trial vigente solo si periodo_fin es futuro", () => {
  assert.equal(
    estaVigente({ estado_suscripcion: "trial", periodo_fin: enDias(5) }),
    true,
  );
  assert.equal(
    estaVigente({ estado_suscripcion: "trial", periodo_fin: enDias(-1) }),
    false,
  );
  assert.equal(
    estaVigente({ estado_suscripcion: "trial", periodo_fin: null }),
    false,
  );
});

test("estaVigente: cancelado con gracia hasta periodo_fin", () => {
  assert.equal(
    estaVigente({ estado_suscripcion: "cancelado", periodo_fin: enDias(3) }),
    true,
  );
  assert.equal(
    estaVigente({ estado_suscripcion: "cancelado", periodo_fin: enDias(-3) }),
    false,
  );
});

test("estaVigente: vencido nunca vigente", () => {
  assert.equal(
    estaVigente({ estado_suscripcion: "vencido", periodo_fin: enDias(10) }),
    false,
  );
});

test("diasRestantes: redondea hacia arriba y no baja de 0", () => {
  assert.equal(diasRestantes(enDias(2)), 2);
  assert.equal(diasRestantes(enDias(-5)), 0);
  assert.equal(diasRestantes(null), null);
});
