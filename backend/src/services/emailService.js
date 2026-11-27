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

// ─── COMPROBANTE DE PAGO (cobro mensual aprobado) ────────────
const NOMBRE_PLAN = { basic: "Básico", standard: "Estándar", premium: "Pro" };
const dinero = (n, moneda = "ARS") =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n || 0);
const fecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" })
    : "—";
// 0001-00000042: punto de venta + número correlativo.
const numeroComprobante = (id) => `0001-${String(id).padStart(8, "0")}`;

// HTML del comprobante (exportado aparte para poder previsualizarlo).
const comprobanteHtml = (c) => {
  const etiqueta = (t) =>
    `<p style="margin:0 0 4px;font-family:${FUENTE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.gris};">${t}</p>`;
  const fila = (concepto, importe, { fuerte = false, color = C.tinta, borde = true } = {}) => `
    <tr>
      <td style="padding:12px 0;${borde ? `border-bottom:1px solid ${C.hueso2};` : ""}font-family:${FUENTE};font-size:${fuerte ? 16 : 14}px;line-height:1.45;font-weight:${fuerte ? 800 : 400};color:${color};">${concepto}</td>
      <td align="right" style="padding:12px 0;${borde ? `border-bottom:1px solid ${C.hueso2};` : ""}font-family:${FUENTE};font-size:${fuerte ? 20 : 14}px;font-weight:${fuerte ? 800 : 600};color:${color};white-space:nowrap;">${importe}</td>
    </tr>`;
  const plan = NOMBRE_PLAN[c.plan] || c.plan;
  const descuento = Math.max(0, (c.precio_lista || 0) - (c.total || 0));
  const periodo =
    c.periodo_desde || c.periodo_hasta ? `Período: ${fecha(c.periodo_desde)} al ${fecha(c.periodo_hasta)}` : "Suscripción mensual";

  return plantilla({
    previa: `Comprobante ${numeroComprobante(c.id)} · ${dinero(c.total, c.moneda)} · Plan ${plan}`,
    cuerpo:
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top;">
          ${etiqueta("Comprobante de pago")}
          <p style="margin:0;font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:${C.tinta};letter-spacing:1px;">N.º ${numeroComprobante(c.id)}</p>
        </td>
        <td align="right" style="vertical-align:top;">
          ${etiqueta("Fecha")}
          <p style="margin:0;font-family:${FUENTE};font-size:15px;font-weight:700;color:${C.tinta};">${fecha(c.fecha)}</p>
        </td>
      </tr></table>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
        <tr><td style="background:${C.hueso};border-radius:14px;padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="50%" style="vertical-align:top;padding-right:10px;">
              ${etiqueta("Emitido por")}
              <p style="margin:0;font-family:${FUENTE};font-size:14px;line-height:1.5;color:${C.tinta};"><strong>${escapar(c.emisor?.nombre || "DinexFlow")}</strong>${c.emisor?.cuit ? `<br/>CUIT ${escapar(c.emisor.cuit)}` : ""}<br/>dinexflow.com.ar</p>
            </td>
            <td width="50%" style="vertical-align:top;padding-left:10px;">
              ${etiqueta("Cliente")}
              <p style="margin:0;font-family:${FUENTE};font-size:14px;line-height:1.5;color:${C.tinta};word-break:break-word;"><strong>${escapar(c.cliente_nombre || "—")}</strong>${c.cliente_email ? `<br/>${escapar(c.cliente_email)}` : ""}</p>
            </td>
          </tr></table>
        </td></tr>
      </table>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;">
        <tr>
          <td style="padding:0 0 8px;border-bottom:2px solid ${C.tinta};font-family:${FUENTE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.gris};">Detalle</td>
          <td align="right" style="padding:0 0 8px;border-bottom:2px solid ${C.tinta};font-family:${FUENTE};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.gris};">Importe</td>
        </tr>
        ${fila(`<strong>DinexFlow · Plan ${escapar(plan)}</strong><br/><span style="font-size:12.5px;color:${C.gris};">${periodo}</span>`, dinero(c.precio_lista, c.moneda))}
        ${descuento > 0 ? fila(`Descuento por cupón${c.descuento_pct ? ` (${c.descuento_pct} %)` : ""}`, `−${dinero(descuento, c.moneda)}`, { color: C.gris }) : ""}
        <tr><td colspan="2" style="height:4px;line-height:4px;font-size:0;border-bottom:3px solid ${C.aji};">&nbsp;</td></tr>
        ${fila("Total pagado", dinero(c.total, c.moneda), { fuerte: true, borde: false })}
      </table>` +
      `<p style="margin:14px 0 0;font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.gris};">Pagado con <strong style="color:${C.tinta};">Mercado Pago</strong> · débito automático mensual${c.mp_pago_id ? ` · operación ${escapar(c.mp_pago_id)}` : ""}.</p>` +
      (c.url ? boton(c.url, "Ver mi suscripción") : "") +
      aviso("Gracias por confiar en DinexFlow. <strong>Documento no válido como factura.</strong>"),
  });
};

// Manda el comprobante al cliente; `copia` (opcional) va en copia oculta.
const sendComprobantePago = ({ to, copia, comprobante }) =>
  resend.emails
    .send({
      from: FROM(),
      to,
      ...(copia ? { bcc: copia } : {}),
      subject: `Comprobante de pago ${numeroComprobante(comprobante.id)} · DinexFlow`,
      html: comprobanteHtml(comprobante),
    })
    .then(({ error }) => {
      if (error) throw new Error(error.message);
    });

module.exports = {
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSoporteAviso,
  sendComprobantePago,
  comprobanteHtml,
  numeroComprobante,
};
