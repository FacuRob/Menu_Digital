// Cálculo de la actividad del negocio para el Dashboard (función pura, sin
// base de datos, para poder testearla).
//
// Fechas en hora de Argentina (UTC-3, sin horario de verano): "hoy", el día
// de cada venta y la hora pico salen del reloj del local, no del servidor.

const TZ = "America/Argentina/Buenos_Aires";
const TIPOS = ["mesa", "delivery", "retiro"];
const ESTADOS = ["pendiente", "preparando", "listo", "en_camino", "entregado", "cancelado"];

const partes = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

// { fecha: "YYYY-MM-DD", hora: 0-23, dow: 0 (lunes) - 6 (domingo) }
function enArgentina(fecha) {
  const p = Object.fromEntries(partes.formatToParts(new Date(fecha)).map((x) => [x.type, x.value]));
  return { fecha: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) % 24, dow: DOW[p.weekday] };
}

// Suma (o resta) días a una fecha "YYYY-MM-DD".
function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const r2 = (n) => +Number(n || 0).toFixed(2);

function montos(p) {
  let ventas = 0;
  let costo = 0;
  for (const it of p.pedido_items || []) {
    const v = Number(it.subtotal) || Number(it.precio_unit) * Number(it.cantidad) || 0;
    ventas += v;
    costo += Number(it.costo_unit) * Number(it.cantidad) || 0;
  }
  // Pedidos sin ítems guardados: usar el total del pedido.
  if (!ventas && p.total) ventas = Number(p.total) || 0;
  return { ventas, costo };
}

// pedidos: filas de "pedidos" (cualquier estado) creadas desde el inicio del
// período anterior, con pedido_items. dias: largo del período (7, 30, 90).
function calcularActividad(pedidos, { dias = 30, ahora = new Date() } = {}) {
  const hoy = enArgentina(ahora).fecha;
  const desde = sumarDias(hoy, -(dias - 1));
  const desdeAnterior = sumarDias(desde, -dias);

  // Un casillero por día del período (incluidos los días sin ventas).
  const serie = [];
  const idx = {};
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    const b = { fecha, ventas: 0, ganancia: 0, pedidos: 0 };
    serie.push(b);
    idx[fecha] = b;
  }

  const anterior = { ventas: 0, ganancia: 0, pedidos: 0 };
  // Ventas del período anterior día por día, alineadas con la serie actual
  // (índice i = mismo lugar del período), para la línea de comparación.
  const serieAnterior = Array(dias).fill(0);
  const porTipo = Object.fromEntries(TIPOS.map((t) => [t, { tipo: t, pedidos: 0, ventas: 0 }]));
  const estados = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  // Horas pico: [día de la semana][hora] = pedidos.
  const horas = Array.from({ length: 7 }, () => Array(24).fill(0));
  const hoyRes = { pedidos: 0, pendientes: 0, ventas: 0 };

  for (const p of pedidos || []) {
    const creado = enArgentina(p.created_at);
    const enPeriodo = creado.fecha >= desde && creado.fecha <= hoy;

    // Demanda (todo lo pedido, menos cancelados): tipo, hora y estados.
    if (enPeriodo) {
      if (p.estado in estados) estados[p.estado] += 1;
      if (p.estado !== "cancelado") {
        const tipo = p.tipo_entrega || (p.mesa ? "mesa" : null);
        if (porTipo[tipo]) {
          porTipo[tipo].pedidos += 1;
          porTipo[tipo].ventas += Number(p.total) || montos(p).ventas;
        }
        horas[creado.dow][creado.hora] += 1;
      }
    }
    if (creado.fecha === hoy && p.estado !== "cancelado") hoyRes.pedidos += 1;
    // "Pendientes ahora": sin importar el día en que se pidieron.
    if (p.estado === "pendiente") hoyRes.pendientes += 1;

    // Ventas: sólo entregados, en el día en que se entregaron (igual que el
    // resumen mensual).
    if (p.estado !== "entregado") continue;
    const dia = enArgentina(p.entregado_at || p.created_at).fecha;
    const { ventas, costo } = montos(p);
    if (idx[dia]) {
      idx[dia].ventas += ventas;
      idx[dia].ganancia += ventas - costo;
      idx[dia].pedidos += 1;
    } else if (dia >= desdeAnterior && dia < desde) {
      const i = Math.round((new Date(`${dia}T12:00:00Z`) - new Date(`${desdeAnterior}T12:00:00Z`)) / 86400000);
      if (i >= 0 && i < dias) serieAnterior[i] += ventas;
      anterior.ventas += ventas;
      anterior.ganancia += ventas - costo;
      anterior.pedidos += 1;
    }
    if (dia === hoy) hoyRes.ventas += ventas;
  }

  const totales = { ventas: 0, ganancia: 0, pedidos: 0 };
  for (const b of serie) {
    b.ventas = r2(b.ventas);
    b.ganancia = r2(b.ganancia);
    totales.ventas += b.ventas;
    totales.ganancia += b.ganancia;
    totales.pedidos += b.pedidos;
  }
  totales.ventas = r2(totales.ventas);
  totales.ganancia = r2(totales.ganancia);
  totales.ticket = totales.pedidos ? r2(totales.ventas / totales.pedidos) : 0;

  return {
    desde,
    hasta: hoy,
    dias,
    serie,
    totales,
    anterior: { ventas: r2(anterior.ventas), ganancia: r2(anterior.ganancia), pedidos: anterior.pedidos },
    serie_anterior: serieAnterior.map(r2),
    por_tipo: TIPOS.map((t) => ({ ...porTipo[t], ventas: r2(porTipo[t].ventas) })),
    estados,
    horas,
    hoy: { ...hoyRes, ventas: r2(hoyRes.ventas) },
  };
}

module.exports = { calcularActividad, enArgentina, sumarDias, TZ };
