// Fechas y horas del negocio (Argentina, UTC−3 sin horario de verano).
const TZ = "America/Argentina/Buenos_Aires";

export const fechaAR = (d: Date | string = new Date()) =>
  new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export const sumarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return fechaAR(d);
};

export const horaAR = (d: string) =>
  new Date(d).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const diaCortoAR = (fecha: string) =>
  new Date(`${fecha}T12:00:00-03:00`).toLocaleDateString("es-AR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

export const fechaLargaAR = (d: string) =>
  new Date(d).toLocaleString("es-AR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
