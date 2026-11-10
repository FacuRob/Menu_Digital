const crypto = require("crypto");
const { safeEqual } = require("./safeEqual");

// Links públicos firmados de un pedido:
//   ticket      → /ticket/<id>?t=…       (cliente, al entregar)
//   seguimiento → /seguimiento/<id>?t=…  (cliente, mapa del delivery)
//   reparto     → /reparto/<id>?t=…      (repartidor: "Salí" / "Entregué")
// La firma (HMAC de tipo + pedido + negocio) impide usar el link de otro
// pedido o pasar del link del cliente al del repartidor.
const TIPOS = ["ticket", "seguimiento", "reparto"];

const clave = () => {
  if (!process.env.JWT_SECRET) throw new Error("Falta JWT_SECRET");
  return `${process.env.JWT_SECRET}:ticket`;
};

const MENU_URL = () =>
  (process.env.VITE_MENU_URL || "https://dinexflow.com.ar").replace(/\/+$/, "");

const firmar = (tipo, pedidoId, negocioId) => {
  if (!TIPOS.includes(tipo)) throw new Error(`Link desconocido: ${tipo}`);
  return crypto
    .createHmac("sha256", clave())
    .update(`${tipo}:${Number(pedidoId)}:${Number(negocioId)}`)
    .digest("base64url")
    .slice(0, 22);
};

const firmaValida = (tipo, pedidoId, negocioId, token) =>
  typeof token === "string" && !!token && safeEqual(token, firmar(tipo, pedidoId, negocioId));

const linkPedido = (tipo, pedido) =>
  `${MENU_URL()}/${tipo}/${pedido.id}?t=${firmar(tipo, pedido.id, pedido.negocio_id)}`;

module.exports = { firmar, firmaValida, linkPedido };
