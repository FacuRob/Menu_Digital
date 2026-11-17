// Crea las plantillas de los avisos en la cuenta de WhatsApp de la plataforma.
// Uso (desde backend/): node scripts/crearPlantillasPlataforma.js
// Lee WHATSAPP_TOKEN y WHATSAPP_WABA_ID del .env. Las que ya existen se saltean.
require("dotenv").config();
const { crearPlantillas } = require("../src/services/whatsappCuentas");
const { AVISOS } = require("../src/services/avisosPedidoService");

const token = process.env.WHATSAPP_TOKEN;
const waba = process.env.WHATSAPP_WABA_ID;
if (!token || !waba) {
  console.error("Faltan WHATSAPP_TOKEN o WHATSAPP_WABA_ID en el .env");
  process.exit(1);
}

crearPlantillas({ waba_id: waba }, AVISOS, token).then((r) => {
  for (const p of r) console.log(p.ok ? "OK   " : "ERROR", p.nombre, p.error || "");
  process.exit(r.every((p) => p.ok) ? 0 : 1);
});
