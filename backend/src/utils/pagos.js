// ══════════════════════════════════════════════════════════════
// Medios de pago de los pedidos. Los configura el dueño de la cuenta en
// configuracion.pagos:
//   efectivo       → paga en efectivo al recibir (puede decir con cuánto paga)
//   transferencia  → transfiere al alias / CBU-CVU; el pedido queda "en revisión"
//                    hasta que el negocio confirma que llegó la plata
//   alias, cbu, titular, banco → datos que ve el cliente para transferir
//   comprobante    → "no" | "opcional" | "obligatorio": si el cliente adjunta
//                    el comprobante de la transferencia (foto o PDF)
// Sin medios activos, el pedido se toma como siempre (sin pago).
// No aplica a pedidos en mesa (se paga en el local) ni sin tipo de entrega.
//
// Pedido: metodo_pago ("efectivo" | "transferencia"), paga_con (efectivo),
//         estado_pago ("pendiente" | "en_revision" | "pagado" | "rechazado").
// ══════════════════════════════════════════════════════════════
const MAX = 10_000_000;
const METODOS = ["efectivo", "transferencia"];
const ESTADOS_PAGO = ["pendiente", "en_revision", "pagado", "rechazado"];
const COMPROBANTE = ["no", "opcional", "obligatorio"];

const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const redondear = (n) => Math.round(n * 100) / 100;

function normalizarPagos(p) {
  const o = p && typeof p === "object" && !Array.isArray(p) ? p : {};
  return {
    efectivo: o.efectivo === true,
    transferencia: o.transferencia === true,
    alias: texto(o.alias, 40),
    cbu: texto(o.cbu, 22).replace(/\D/g, ""),
    titular: texto(o.titular, 80),
    banco: texto(o.banco, 60),
    comprobante: COMPROBANTE.includes(o.comprobante) ? o.comprobante : "no",
  };
}

// Lo que manda el panel → { valor } o { error }.
function validarPagos(p) {
  if (!p || typeof p !== "object" || Array.isArray(p)) return { error: "Datos de pago inválidos." };
  const v = normalizarPagos(p);
  if (v.alias && !/^[a-zA-Z0-9.-]{6,20}$/.test(v.alias)) {
    return { error: "El alias tiene que tener entre 6 y 20 letras, números, puntos o guiones." };
  }
  if (v.cbu && v.cbu.length !== 22) return { error: "El CBU o CVU tiene que tener 22 números." };
  if (v.transferencia) {
    if (!v.alias && !v.cbu) return { error: "Para transferencias, poné el alias o el CBU/CVU." };
    if (!v.titular) return { error: "Para transferencias, poné el nombre del titular de la cuenta." };
  }
  return { valor: v };
}

// Medios que el cliente puede elegir hoy.
function mediosActivos(cfg) {
  const p = normalizarPagos(cfg?.pagos);
  return METODOS.filter((m) => p[m] && (m !== "transferencia" || p.alias || p.cbu));
}

// Cuánto cobra cada parte: lo que se transfiere y lo que se paga en efectivo
// al recibir. `total` = productos; `envio` = { costo, cobro } de utils/envio.
function montosDePago(metodo, total, envio) {
  const costo = Number(envio?.costo || 0);
  if (metodo === "transferencia") {
    const enEfectivo = envio?.cobro === "efectivo" ? costo : 0;
    return { transferir: redondear(total + costo - enEfectivo), efectivo: enEfectivo };
  }
  return { transferir: 0, efectivo: redondear(total + costo) };
}

// Pago elegido por el cliente → { valor: {metodo_pago, paga_con, estado_pago, ...} | null } o { error }.
// Transferencia: `transfirio` (quién hizo la transferencia, opcional) y
// `comprobante` (adjunto ya validado del negocio, o null).
function validarPago({ cfg, tipoEntrega, metodo, pagaCon, total, envio, transfirio, comprobante }) {
  const medios = mediosActivos(cfg);
  if (medios.length === 0 || !tipoEntrega || tipoEntrega === "mesa") return { valor: null };
  if (!metodo) return { error: "Elegí cómo vas a pagar." };
  if (!medios.includes(metodo)) return { error: "Ese medio de pago no está disponible en este local." };

  if (metodo === "transferencia") {
    const modo = normalizarPagos(cfg?.pagos).comprobante;
    if (modo === "obligatorio" && !comprobante) return { error: "Adjuntá el comprobante de la transferencia." };
    const quien = texto(transfirio, 80);
    return {
      valor: {
        metodo_pago: "transferencia",
        paga_con: null,
        estado_pago: "en_revision",
        ...(quien ? { transfirio: quien } : {}),
        ...(comprobante && modo !== "no" ? { comprobante_id: comprobante.id } : {}),
      },
    };
  }
  // Efectivo: sin monto = paga justo.
  let paga = null;
  if (pagaCon !== null && pagaCon !== undefined && pagaCon !== "") {
    const n = Number(pagaCon);
    const aPagar = montosDePago("efectivo", total, envio).efectivo;
    if (!Number.isFinite(n) || n <= 0 || n > MAX) return { error: "El monto con el que pagás no es válido." };
    if (n < aPagar) return { error: "El monto con el que pagás es menor que el total." };
    paga = redondear(n);
  }
  return { valor: { metodo_pago: "efectivo", paga_con: paga, estado_pago: "pendiente" } };
}

module.exports = { METODOS, ESTADOS_PAGO, COMPROBANTE, normalizarPagos, validarPagos, mediosActivos, montosDePago, validarPago };
