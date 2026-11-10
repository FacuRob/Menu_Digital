const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = () => process.env.EMAIL_FROM || "DinexFlow <no-reply@dinexflow.com.ar>";

// Colores de la marca (DESIGN.md). El texto sobre ají va siempre en tinta.
const C = {
  hueso: "#efede6",
  hueso2: "#e4e1d8",
  tinta: "#111216",
  gris: "#5b5d66",
  aji: "#ff5b24",
};
const FUENTE = "Helvetica,Arial,sans-serif";
// PNG porque Gmail no muestra SVG. Se sirve desde el menú público.
const LOGO_URL = "https://dinexflow.com.ar/email-logo.png";

const escapar = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// ─── Piezas comunes ──────────────────────────────────────────
const boton = (url, texto) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
  <tr><td style="background:${C.aji};border-radius:999px;padding:15px 30px;">
    <a href="${escapar(url)}" style="display:inline-block;font-family:${FUENTE};font-size:15px;font-weight:700;color:${C.tinta};text-decoration:none;">${texto}</a>
  </td></tr>
</table>
<p style="margin:0 0 4px;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${C.gris};">Si el botón no funciona, copiá este link en el navegador:</p>
<p style="margin:0;font-family:${FUENTE};font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapar(url)}" style="color:${C.tinta};">${escapar(url)}</a></p>`;

const aviso = (texto) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
  <tr><td style="background:${C.hueso};border-left:4px solid ${C.aji};border-radius:0 12px 12px 0;padding:14px 16px;font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.tinta};">${texto}</td></tr>
</table>`;

const titulo = (t) =>
  `<h1 style="margin:0 0 12px;font-family:${FUENTE};font-size:24px;line-height:1.25;font-weight:800;color:${C.tinta};letter-spacing:-0.01em;">${t}</h1>`;

const parrafo = (t) =>
  `<p style="margin:0 0 12px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${C.gris};">${t}</p>`;

// Arma el email completo: cabecera tinta con el logo, tarjeta blanca y pie.
// `previa` es el texto que muestra la bandeja de entrada al lado del asunto.
const plantilla = ({ previa, cuerpo }) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>DinexFlow</title>
</head>
<body style="margin:0;padding:0;background:${C.hueso};">
  <div style="display:none;mso-hide:all;max-height:0;overflow:hidden;opacity:0;">${escapar(previa)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.hueso};padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${C.hueso2};border-radius:20px;overflow:hidden;">
        <tr><td style="background:${C.tinta};padding:22px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px;"/></td>
            <td style="vertical-align:middle;padding-left:12px;font-family:${FUENTE};font-size:20px;font-weight:800;color:${C.hueso};letter-spacing:-0.01em;">DinexFlow</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 32px 32px;">${cuerpo}</td></tr>
        <tr><td style="border-top:1px solid ${C.hueso2};padding:18px 32px;font-family:${FUENTE};font-size:12px;line-height:1.5;color:${C.gris};">
          DinexFlow · Carta digital con QR y pedidos por WhatsApp<br/>
          <a href="https://dinexflow.com.ar" style="color:${C.tinta};">dinexflow.com.ar</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const enviar = async ({ to, subject, html }) => {
  const { error } = await resend.emails.send({ from: FROM(), to, subject, html });
  if (error) throw new Error(error.message);
};

// ─── RECUPERAR CONTRASEÑA ────────────────────────────────────
const sendPasswordResetEmail = ({ to, username, resetUrl }) =>
  enviar({
    to,
    subject: "Restablecé tu contraseña de DinexFlow",
    html: plantilla({
      previa: "Elegí una contraseña nueva. El link vence en 1 hora.",
      cuerpo:
        titulo("Restablecé tu contraseña") +
        parrafo(
          `Hola <strong style="color:${C.tinta};">${escapar(username)}</strong>, recibimos un pedido para cambiar la contraseña de tu cuenta. Tocá el botón para elegir una nueva.`,
        ) +
        boton(resetUrl, "Elegir contraseña nueva") +
        aviso("<strong>El link vence en 1 hora</strong> y sirve una sola vez.") +
        `<p style="margin:20px 0 0;font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.gris};">Si no pediste este cambio, ignorá este email: tu contraseña actual sigue funcionando.</p>`,
    }),
  });

// ─── BIENVENIDA (alta por suscripción aprobada) ──────────────
// Manda las credenciales de acceso al panel. La contraseña es temporal:
// al primer login el sistema obliga a cambiarla (must_change_password).
const sendWelcomeEmail = ({ to, nombre, username, tempPassword, loginUrl, plan }) => {
  const etiqueta = (t) =>
    `<p style="margin:0 0 4px;font-family:${FUENTE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.gris};">${t}</p>`;
  return enviar({
    to,
    subject: "Tu cuenta de DinexFlow está lista",
    html: plantilla({
      previa: "Estos son tus datos para entrar al panel.",
      cuerpo:
        titulo(`Bienvenido${nombre ? `, ${escapar(nombre)}` : ""}`) +
        parrafo(
          `Gracias por elegir DinexFlow. Activamos tu plan <strong style="color:${C.tinta};text-transform:capitalize;">${escapar(plan)}</strong>. Estos son tus datos para entrar al panel:`,
        ) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
          <tr><td style="background:${C.hueso};border-radius:14px;padding:20px 22px;">
            ${etiqueta("Usuario")}
            <p style="margin:0 0 16px;font-family:${FUENTE};font-size:16px;font-weight:700;color:${C.tinta};word-break:break-all;">${escapar(username)}</p>
            ${etiqueta("Contraseña temporal")}
            <p style="margin:0;font-family:'Courier New',monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:${C.tinta};word-break:break-all;">${escapar(tempPassword)}</p>
          </td></tr>
        </table>` +
        boton(loginUrl, "Entrar al panel") +
        aviso("<strong>Al entrar por primera vez</strong> te vamos a pedir que elijas tu propia contraseña."),
    }),
  });
};

// ─── AVISO AL DUEÑO: reporte nuevo de un cliente ─────────────
// Para el asunto: una sola línea, sin saltos que rompan la cabecera.
const unaLinea = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const TIPO_SOPORTE = { error: "Error", pago: "Pago", duda: "Duda", sugerencia: "Sugerencia" };

const sendSoporteAviso = ({ to, cuenta, tipo, asunto, texto, url }) =>
  enviar({
    to,
    subject: `Soporte: ${unaLinea(asunto, 80)} — ${unaLinea(cuenta, 60)}`,
    html: plantilla({
      previa: `${TIPO_SOPORTE[tipo] || tipo} · ${cuenta}`,
      cuerpo:
        `<p style="margin:0 0 8px;font-family:${FUENTE};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.gris};">${escapar(TIPO_SOPORTE[tipo] || tipo)} · ${escapar(cuenta)}</p>` +
        titulo(escapar(asunto)) +
        `<p style="margin:0;font-family:${FUENTE};font-size:15px;line-height:1.6;color:${C.tinta};white-space:pre-wrap;">${escapar(String(texto).slice(0, 1500))}</p>` +
        (url ? boton(url, "Ver el reporte") : ""),
    }),
  });

module.exports = { sendPasswordResetEmail, sendWelcomeEmail, sendSoporteAviso };
