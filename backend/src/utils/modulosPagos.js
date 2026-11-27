// Módulos pagos que se suman al plan (WhatsApp, Asistente con IA, Mapa del
// repartidor) y el monto mensual que se cobra por Mercado Pago.
//
// Reglas:
// - Se suman a los planes que no los incluyen (Básico: los tres; Estándar:
//   la IA). Free no.
// - Al sumar, se usa en el momento y se cobra desde el próximo cobro.
// - Al quitar, se sigue usando hasta el próximo cobro y desde ahí no se cobra.
//   Si todavía no entró en ningún cobro, se cobra una vez antes de irse (así
//   no se puede sumar y quitar entre cobros para usarlo gratis).
// - El cupón descuenta sólo el precio del plan, no los módulos.
// - precio_plan_fijo (precio de fundador) reemplaza al precio de lista.
//
// Todo es puro (sin base ni Mercado Pago): los controladores guardan el
// resultado y actualizan el monto de la suscripción.
const { MODULOS_PAGOS, PRECIOS_MENSUALES } = require("./planPrecios");
const { LIMITES_POR_PLAN, modulosVigentes, estaVigente } = require("./suscripcion");
const { tieneDescuento } = require("./cupones");

const CODIGOS_MODULOS = Object.keys(MODULOS_PAGOS);

const ms = (fecha) => (fecha ? new Date(fecha).getTime() : NaN);

// ¿Se puede sumar `codigo` al plan? No si el plan ya lo incluye, ni en Free.
const sumable = (plan, codigo) =>
  !!MODULOS_PAGOS[codigo] && plan !== "free" && !!LIMITES_POR_PLAN[plan] && !LIMITES_POR_PLAN[plan][codigo];

// Módulos sumados y sin baja pedida.
const sinBaja = (modulos) => Object.keys(modulos || {}).filter((c) => !modulos[c]?.baja_en);

// Mismo día del mes siguiente; si no existe (31 → febrero), el último día.
const unMesDespues = (fecha) => {
  const d = new Date(fecha);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString();
};

// Mercado Pago puede correr unos días la fecha del cobro: una baja que cae
// hasta una semana después del próximo cobro se toma como "en ese cobro"
// (así no se cobra un mes de más).
const MARGEN_MS = 7 * 24 * 60 * 60 * 1000;

// Módulos que entran en el próximo cobro (periodo_fin): los sumables al plan
// cuya baja, si la hay, es después de ese cobro.
const modulosACobrar = (cuenta) => {
  const m = cuenta?.modulos_pagos || {};
  const proximo = ms(cuenta?.periodo_fin);
  return Object.keys(m).filter((c) => {
    if (!sumable(cuenta.tipo_plan, c)) return false;
    if (!m[c]?.baja_en) return true;
    return Number.isFinite(proximo) && ms(m[c].baja_en) > proximo + MARGEN_MS;
  });
};

const precioModulos = (codigos) => codigos.reduce((t, c) => t + (MODULOS_PAGOS[c]?.precio || 0), 0);

const conDescuento = (precio, pct) => {
  const p = Number(pct) || 0;
  return p > 0 ? Math.round((precio * (100 - p)) / 100) : precio;
};

// Precio del plan de la cuenta: el de fundador si lo tiene, si no el de lista.
const precioPlan = (cuenta) =>
  Number(cuenta?.precio_plan_fijo) > 0 ? Number(cuenta.precio_plan_fijo) : PRECIOS_MENSUALES[cuenta?.tipo_plan] || 0;

// Lo que se le cobra a la cuenta en el próximo cobro.
const montoProximoCobro = (cuenta) => {
  const plan = precioPlan(cuenta);
  const pct = tieneDescuento(cuenta) ? cuenta.descuento_pct : 0;
  return conDescuento(plan, pct) + precioModulos(modulosACobrar(cuenta));
};

// Lo mismo sin el cupón (precio de lista de lo que tiene).
const montoLista = (cuenta) => precioPlan(cuenta) + precioModulos(modulosACobrar(cuenta));

// Monto de una suscripción nueva (checkout): precio de lista del plan, con el
// cupón si lo hay, más los módulos elegidos.
const montoSuscripcionNueva = (plan, modulos = [], pct = 0) =>
  conDescuento(PRECIOS_MENSUALES[plan] || 0, pct) + precioModulos(modulos);

// Módulos elegidos al pagar un plan. → { valor: [...] } o { error }.
const validarModulosNuevos = (plan, lista) => {
  if (lista == null) return { valor: [] };
  if (!Array.isArray(lista)) return { error: "Módulos inválidos." };
  const valor = [...new Set(lista.map(String))].sort();
  for (const c of valor) {
    if (!MODULOS_PAGOS[c]) return { error: "Módulo inválido." };
    if (!sumable(plan, c)) return { error: `${MODULOS_PAGOS[c].nombre} ya viene en ese plan o no se puede sumar.` };
    const req = MODULOS_PAGOS[c].requiere;
    // Si el plan ya trae el requisito (WhatsApp en el Estándar), alcanza.
    if (req && !valor.includes(req) && !LIMITES_POR_PLAN[plan]?.[req]) {
      return { error: `${MODULOS_PAGOS[c].nombre} necesita ${MODULOS_PAGOS[req].nombre}.` };
    }
  }
  return { valor };
};

// Módulos de una suscripción recién pagada (ya entraron en el primer cobro).
const modulosDeAlta = (codigos, ahora = Date.now()) => {
  const desde = new Date(ahora).toISOString();
  return Object.fromEntries(codigos.map((c) => [c, { desde, cobrado: true, baja_en: null }]));
};

// Sumar un módulo. → { modulos } o { error, code }.
const sumarModulo = (cuenta, codigo, ahora = Date.now()) => {
  const def = MODULOS_PAGOS[codigo];
  if (!def) return { error: "Ese módulo no existe.", code: "MODULO_INVALIDO" };
  if (!sumable(cuenta.tipo_plan, codigo)) {
    return { error: `${def.nombre} ya viene incluido en tu plan.`, code: "NO_SUMABLE" };
  }
  const actuales = cuenta.modulos_pagos || {};
  if (def.requiere && !sinBaja(actuales).includes(def.requiere) && !LIMITES_POR_PLAN[cuenta.tipo_plan]?.[def.requiere]) {
    return { error: `Para sumar ${def.nombre} primero sumá ${MODULOS_PAGOS[def.requiere].nombre}.`, code: "REQUIERE" };
  }
  const previo = actuales[codigo];
  if (previo && !previo.baja_en) return { error: `Ya tenés ${def.nombre}.`, code: "YA_ACTIVO" };

  // Si había pedido quitarlo y se arrepiente, sigue como estaba.
  const fila = previo
    ? { ...previo, baja_en: null }
    : { desde: new Date(ahora).toISOString(), cobrado: false, baja_en: null };
  return { modulos: { ...actuales, [codigo]: fila } };
};

// Quitar un módulo: se usa hasta el próximo cobro (o uno más si nunca se
// cobró). → { modulos, baja_en } o { error, code }.
const quitarModulo = (cuenta, codigo, ahora = Date.now()) => {
  const def = MODULOS_PAGOS[codigo];
  const actuales = cuenta.modulos_pagos || {};
  const previo = def && actuales[codigo];
  if (!previo || previo.baja_en) return { error: "No tenés ese módulo activo.", code: "NO_ACTIVO" };

  const dependiente = CODIGOS_MODULOS.find((c) => MODULOS_PAGOS[c].requiere === codigo && sinBaja(actuales).includes(c));
  if (dependiente) {
    return {
      error: `Primero quitá ${MODULOS_PAGOS[dependiente].nombre}: funciona con ${def.nombre}.`,
      code: "DEPENDE",
    };
  }

  const proximo = Number.isFinite(ms(cuenta.periodo_fin)) ? new Date(cuenta.periodo_fin).toISOString() : new Date(ahora).toISOString();
  let baja_en = previo.cobrado ? proximo : unMesDespues(proximo);
  // Un módulo del que depende otro ya dado de baja (IA sin cobrar todavía)
  // dura lo mismo que ese: no se paga la IA sin poder usarla.
  for (const c of CODIGOS_MODULOS) {
    const dep = actuales[c];
    if (MODULOS_PAGOS[c].requiere === codigo && dep?.baja_en && ms(dep.baja_en) > ms(baja_en)) baja_en = dep.baja_en;
  }
  return { modulos: { ...actuales, [codigo]: { ...previo, baja_en } }, baja_en };
};

// Después de un cobro aprobado: los módulos sumados antes del cobro quedan
// cobrados y los que llegaron a su baja se borran.
const modulosAlCobrar = (modulos, fechaCobro, ahora = Date.now()) => {
  const cobro = Number.isFinite(ms(fechaCobro)) ? ms(fechaCobro) : ahora;
  const out = {};
  for (const [c, fila] of Object.entries(modulos || {})) {
    if (fila?.baja_en && ms(fila.baja_en) <= ahora) continue;
    out[c] = { ...fila, cobrado: !!fila?.cobrado || ms(fila?.desde) <= cobro };
  }
  return out;
};

// ── Volver a pagar un plan cancelado que todavía no venció ──
// Ej.: Estándar cancelado pagado hasta el 20/12 que suma la IA. Paga HOY sólo
// los módulos nuevos (pago único, hasta el 20/12) y autoriza un débito que
// arranca el 20/12 con plan + módulos. Así no pierde los días que ya pagó.

// ¿La cuenta puede volver a pagar su plan sin perder días?
const puedeReactivar = (cuenta, ahora = Date.now()) =>
  cuenta?.estado_suscripcion === "cancelado" &&
  ["basic", "standard", "premium"].includes(cuenta?.tipo_plan) &&
  estaVigente(cuenta) &&
  ms(cuenta.periodo_fin) > ahora;

// De los módulos elegidos, los que todavía no puede usar (se pagan ahora).
const modulosAPagarAhora = (cuenta, codigos, ahora = Date.now()) => {
  const vigentes = modulosVigentes(cuenta, ahora);
  return codigos.filter((c) => !vigentes.includes(c));
};

// Pago único de módulos: "cuenta:29:pagomod:ia.whatsapp".
const referenciaPagoModulos = (cuentaId, codigos) => `cuenta:${cuentaId}:pagomod:${[...codigos].sort().join(".")}`;
const leerReferenciaPagoModulos = (ref) => {
  const m = /^cuenta:(\d+):pagomod:([a-z]+(?:\.[a-z]+)*)$/.exec(String(ref || ""));
  if (!m) return null;
  const modulos = m[2].split(".");
  if (!modulos.every((c) => MODULOS_PAGOS[c])) return null;
  return { cuentaId: Number(m[1]), modulos };
};

// Módulos pagados por única vez: se usan desde ya hasta `hasta` (cuando
// arranca el débito, que los vuelve a incluir).
const modulosPagadosHasta = (modulos, codigos, hasta, ahora = Date.now()) => {
  const desde = new Date(ahora).toISOString();
  const out = { ...(modulos || {}) };
  for (const c of codigos) out[c] = { desde, cobrado: true, baja_en: new Date(hasta).toISOString() };
  return out;
};

// Catálogo para el panel.
const catalogoModulos = () =>
  CODIGOS_MODULOS.map((codigo) => ({
    codigo,
    nombre: MODULOS_PAGOS[codigo].nombre,
    precio_mensual: MODULOS_PAGOS[codigo].precio,
    requiere: MODULOS_PAGOS[codigo].requiere || null,
    incluido_en: Object.keys(LIMITES_POR_PLAN).filter((p) => LIMITES_POR_PLAN[p][codigo]),
  }));

module.exports = {
  CODIGOS_MODULOS,
  sumable,
  modulosACobrar,
  precioPlan,
  montoProximoCobro,
  montoLista,
  montoSuscripcionNueva,
  validarModulosNuevos,
  modulosDeAlta,
  sumarModulo,
  quitarModulo,
  modulosAlCobrar,
  catalogoModulos,
  precioModulos,
  puedeReactivar,
  modulosAPagarAhora,
  referenciaPagoModulos,
  leerReferenciaPagoModulos,
  modulosPagadosHasta,
};
