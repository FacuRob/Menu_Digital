const { test } = require("node:test");
const assert = require("node:assert");

// El cliente de Resend exige una clave al cargarse; acá no se manda nada.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || "re_test";
const { comprobanteHtml, numeroComprobante } = require("../src/services/emailService");

test("comprobante: el HTML lleva número, cliente, descuento y total", () => {
  const html = comprobanteHtml({
    id: 42,
    fecha: "2026-11-19T15:00:00Z",
    plan: "standard",
    precio_lista: 41000,
    descuento_pct: 25,
    total: 30750,
    moneda: "ARS",
    cliente_nombre: "Bar <La> Esquina",
    cliente_email: "c@e.test",
  });
  assert.equal(numeroComprobante(42), "0001-00000042");
  assert.ok(html.includes("0001-00000042"));
  assert.ok(html.includes("Bar &lt;La&gt; Esquina")); // escapado
  assert.ok(html.includes("Plan Estándar"));
  assert.ok(html.includes("Descuento por cupón (25 %)"));
  assert.ok(/30\.750/.test(html));
  assert.ok(html.includes("Documento no válido como factura"));
});

test("comprobante sin descuento: no muestra la línea de descuento", () => {
  const html = comprobanteHtml({ id: 1, plan: "basic", precio_lista: 20000, total: 20000, moneda: "ARS" });
  assert.equal(html.includes("Descuento por cupón"), false);
});
