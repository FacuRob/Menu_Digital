// Plano del local (pantalla "Mesas" del panel). Se guarda como JSON en
// configuracion.mesas_plano. Las medidas van en metros.
//
//   { pisos: [{ id, nombre, ancho, alto,
//               zonas: [{ id, tipo: "interior"|"exterior", forma: "rect"|"circulo", nombre, x, y, w, h }],
//               mesas: [{ mesa: "5", forma: "redonda"|"cuadrada"|"rectangular", x, y, w, h }] }] }
//
// normalizarPlano limpia lo que manda el panel (recorta, redondea, descarta
// lo inválido) y devuelve { plano } o { error }.

const MAX_PISOS = 5;
const MAX_ZONAS = 60;
const MAX_MESAS = 200;
const MAX_MESA_NUM = 500;

const num = (v, min, max, def) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.round(Math.min(max, Math.max(min, n)) * 100) / 100;
};
const texto = (v, max) => String(v ?? "").trim().slice(0, max);
const id = (v, i, pref) => texto(v, 40).replace(/[^\w-]/g, "") || `${pref}${i + 1}`;

const FORMAS_MESA = ["redonda", "cuadrada", "rectangular"];

const normalizarPlano = (body) => {
  const pisosIn = body?.pisos;
  if (!Array.isArray(pisosIn) || pisosIn.length === 0) return { error: "El plano necesita al menos un piso." };
  if (pisosIn.length > MAX_PISOS) return { error: `Como máximo ${MAX_PISOS} pisos.` };

  const usadas = new Set();
  const pisos = [];
  for (const [i, p] of pisosIn.entries()) {
    const ancho = num(p?.ancho, 2, 100, 20);
    const alto = num(p?.alto, 2, 100, 12);
    const zonasIn = Array.isArray(p?.zonas) ? p.zonas : [];
    const mesasIn = Array.isArray(p?.mesas) ? p.mesas : [];
    if (zonasIn.length > MAX_ZONAS) return { error: `Como máximo ${MAX_ZONAS} zonas por piso.` };
    if (mesasIn.length > MAX_MESAS) return { error: `Como máximo ${MAX_MESAS} mesas por piso.` };

    const zonas = zonasIn.map((z, j) => ({
      id: id(z?.id, j, "z"),
      tipo: z?.tipo === "exterior" ? "exterior" : "interior",
      forma: z?.forma === "circulo" ? "circulo" : "rect",
      nombre: texto(z?.nombre, 30),
      x: num(z?.x, 0, ancho, 0),
      y: num(z?.y, 0, alto, 0),
      w: num(z?.w, 0.5, ancho, 4),
      h: num(z?.h, 0.5, alto, 4),
    }));

    const mesas = [];
    for (const m of mesasIn) {
      const n = Number(m?.mesa);
      if (!Number.isInteger(n) || n < 1 || n > MAX_MESA_NUM) {
        return { error: `Número de mesa inválido: usá números del 1 al ${MAX_MESA_NUM}.` };
      }
      if (usadas.has(n)) return { error: `La mesa ${n} está dos veces en el plano.` };
      usadas.add(n);
      mesas.push({
        mesa: String(n),
        forma: FORMAS_MESA.includes(m?.forma) ? m.forma : "cuadrada",
        x: num(m?.x, 0, ancho, 0),
        y: num(m?.y, 0, alto, 0),
        w: num(m?.w, 0.4, 10, 1),
        h: num(m?.h, 0.4, 10, 1),
      });
    }

    pisos.push({ id: id(p?.id, i, "p"), nombre: texto(p?.nombre, 30) || `Piso ${i + 1}`, ancho, alto, zonas, mesas });
  }

  return { plano: { pisos }, mayorMesa: usadas.size ? Math.max(...usadas) : 0 };
};

module.exports = { normalizarPlano, MAX_MESA_NUM };
