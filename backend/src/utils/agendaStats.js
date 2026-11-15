// ══════════════════════════════════════════════════════════════
// Números de presupuestos y turnos para el Dashboard (funciones puras).
// ══════════════════════════════════════════════════════════════
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

// Presupuestos pedidos en el período: cuántos se cotizaron y cuántos aceptó
// el cliente (aceptado o ya pasado a pedido).
function statsPresupuestos(filas = []) {
  const cuenta = (estados) => filas.filter((p) => estados.includes(p.estado)).length;
  const cotizados = cuenta(["cotizado", "aceptado", "rechazado", "convertido"]);
  const aceptadosF = filas.filter((p) => ["aceptado", "convertido"].includes(p.estado));
  return {
    recibidos: filas.length,
    sin_responder: cuenta(["pendiente", "en_revision"]),
    cotizados,
    aceptados: aceptadosF.length,
    rechazados: cuenta(["rechazado"]),
    tasa_aceptacion: pct(aceptadosF.length, cotizados),
    monto_aceptado: r2(aceptadosF.reduce((a, p) => a + (Number(p.precio_cotizado) || 0), 0)),
  };
}

// Turnos del período (por fecha del turno): asistencia y servicios más
// pedidos.
function statsTurnos(filas = []) {
  const cuenta = (e) => filas.filter((r) => r.estado === e).length;
  const completados = cuenta("completada");
  const ausentes = cuenta("ausente");
  const porServicio = new Map();
  for (const r of filas) {
    if (r.estado === "cancelada") continue;
    const k = r.servicio_nombre || "—";
    porServicio.set(k, (porServicio.get(k) || 0) + 1);
  }
  return {
    total: filas.length,
    completados,
    ausentes,
    cancelados: cuenta("cancelada"),
    tasa_ausencia: pct(ausentes, completados + ausentes),
    top_servicios: [...porServicio.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, turnos]) => ({ nombre, turnos })),
  };
}

module.exports = { statsPresupuestos, statsTurnos };
