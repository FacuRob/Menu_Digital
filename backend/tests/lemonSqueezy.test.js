const { test, beforeEach } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const { createSupabaseMock, injectModule } = require("./helpers/supabaseMock");

process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "secreto-de-test";
process.env.LEMONSQUEEZY_VARIANTS_STANDARD = "222";

// ── Inyección de dependencias ANTES de requerir el controller ──
const db = createSupabaseMock();
const emails = [];
injectModule(require.resolve("../src/config/database"), db);
injectModule(require.resolve("../src/services/emailService"), {
  sendWelcomeEmail: async (m) => emails.push(m),
});
const { lemonSqueezyWebhook } = require("../src/controllers/lemonSqueezyController");

// Registro de lo que el webhook hace contra la BD.
let ops;
let cuentas; // cuentas existentes: [{ id, email, ls_subscription_id }]

beforeEach(() => {
  ops = [];
  emails.length = 0;
  cuentas = [{ id: 7, email: "duenio@bar.com", ls_subscription_id: null }];
  db.setHandler((q) => {
    ops.push({ table: q.table, op: q.op, filters: { ...q.filters }, payload: q.payload });
    if (q.table === "cuentas" && q.op === "select") {
      const f = q.filters;
      const c = cuentas.find(
        (x) =>
          (f.id !== undefined && x.id === f.id) ||
          (f.ls_subscription_id !== undefined && x.ls_subscription_id === f.ls_subscription_id),
      );
      return { data: c ? { id: c.id } : null, error: null };
    }
    if (q.table === "cuentas" && q.op === "update") {
      return { data: { id: q.filters.id, ...q.payload }, error: null };
    }
    if (q.table === "cuentas" && q.op === "upsert") {
      return { data: { id: 99, ...q.payload }, error: null };
    }
    if (q.table === "negocios" && q.op === "select") return { data: null, count: 1, error: null };
    if (q.table === "usuarios" && q.op === "select") return { data: null, error: null };
    if (q.table === "usuarios" && q.op === "insert") {
      return { data: { id: 500, username: "x", email: "x" }, error: null };
    }
    return { data: null, error: null };
  });
});

const evento = ({ email, custom, subId = "sub_1" }) => ({
  meta: { event_name: "subscription_created", ...(custom ? { custom_data: custom } : {}) },
  data: {
    id: subId,
    attributes: {
      user_email: email,
      user_name: "Juan",
      variant_id: 222,
      status: "active",
      customer_id: 1,
      renews_at: "2030-01-01T00:00:00Z",
    },
  },
});

const llamar = async (payload) => {
  const raw = Buffer.from(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", process.env.LEMONSQUEEZY_WEBHOOK_SECRET).update(raw).digest("hex");
  const res = {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
  await lemonSqueezyWebhook({ body: raw, headers: { "x-signature": sig } }, res);
  return res;
};

test("webhook: paga con OTRO email pero llega a su cuenta por cuenta_id", async () => {
  const res = await llamar(evento({ email: "otro@gmail.com", custom: { cuenta_id: "7" } }));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.cuenta_id, 7);
  const upd = ops.find((o) => o.table === "cuentas" && o.op === "update");
  assert.equal(upd.filters.id, 7);
  assert.equal(upd.payload.tipo_plan, "standard");
  assert.equal(upd.payload.estado_suscripcion, "activo");
  // No crea cuentas ni usuarios nuevos, ni manda email de bienvenida.
  assert.ok(!ops.some((o) => o.table === "cuentas" && o.op === "upsert"));
  assert.ok(!ops.some((o) => o.table === "usuarios" && o.op === "insert"));
  assert.equal(emails.length, 0);
});

test("webhook: renovaciones sin custom_data se vinculan por la suscripción", async () => {
  cuentas[0].ls_subscription_id = "sub_1";
  const res = await llamar(evento({ email: "otro@gmail.com", subId: "sub_1" }));
  assert.equal(res.body.cuenta_id, 7);
  assert.ok(!ops.some((o) => o.op === "upsert"));
});

test("webhook: compra directa sin cuenta previa crea cuenta y usuario", async () => {
  const res = await llamar(evento({ email: "Nuevo@Bar.com", subId: "sub_nuevo" }));
  assert.equal(res.statusCode, 201);
  const ups = ops.find((o) => o.table === "cuentas" && o.op === "upsert");
  assert.equal(ups.payload.email, "nuevo@bar.com");
  assert.ok(ops.some((o) => o.table === "usuarios" && o.op === "insert"));
  assert.equal(emails.length, 1);
});

test("webhook: firma inválida → 401", async () => {
  const raw = Buffer.from(JSON.stringify(evento({ email: "a@b.com" })));
  const res = {
    status(c) {
      this.statusCode = c;
      return this;
    },
    json() {
      return this;
    },
  };
  await lemonSqueezyWebhook({ body: raw, headers: { "x-signature": "00" } }, res);
  assert.equal(res.statusCode, 401);
});
