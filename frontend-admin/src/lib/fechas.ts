// Fechas y horas del negocio (Argentina, UTC−3 sin horario de verano).
const TZ = "America/Argentina/Buenos_Aires";

// "YYYY-MM-DD" de hoy (o de un instante) en Argentina.
export const fechaAR = (d: Date | string = new Date()) =>
  new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export const sumarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return fechaAR(d);
};

export const horaAR = (d: string) =>
  new Date(d).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const diaLargoAR = (fecha: string) => {
  const s = new Date(`${fecha}T12:00:00-03:00`).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fechaHoraAR = (d: string) =>
  new Date(d).toLocaleString("es-AR", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Link de WhatsApp a un teléfono argentino (o sólo con texto si no hay número).
export const waLink = (telefono: string | null | undefined, texto: string) => {
  let n = (telefono || "").replace(/D/g, "").replace(/^0/, "");
  if (n && !n.startsWith("54")) n = "549" + n;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
};
