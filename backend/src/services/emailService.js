const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendPasswordResetEmail = async ({ to, username, tempPassword }) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🍽️</div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Menú Digital</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Panel de Administración</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;font-weight:700;">Recuperación de contraseña</h2>
              <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
                Hola <strong style="color:#1e293b;">${username}</strong>, tu contraseña temporal es:
              </p>
              <div style="background:#f8fafc;border:2px dashed #3b82f6;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
                <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Contraseña temporal</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#1e40af;letter-spacing:4px;font-family:monospace;">${tempPassword}</p>
              </div>
              <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;margin:0 0 20px;">
                <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">
                  ⚠️ <strong>Importante:</strong> Al iniciar sesión, el sistema te pedirá que establezcas una nueva contraseña antes de continuar.
                </p>
              </div>
              <p style="margin:0;color:#94a3b8;font-size:13px;">Si no solicitaste este cambio, ignorá este email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Menú Digital · Sistema de administración</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Menú Digital <onboarding@resend.dev>",
    to,
    subject: "🔑 Tu contraseña temporal — Menú Digital",
    html,
  });

  if (error) throw new Error(error.message);
};

// ─── EMAIL DE BIENVENIDA (compra Hotmart aprobada) ───────────
// Manda las credenciales de acceso al panel. La contraseña es temporal:
// al primer login el sistema obliga a cambiarla (must_change_password).
const sendWelcomeEmail = async ({
  to,
  nombre,
  username,
  tempPassword,
  loginUrl,
  plan,
}) => {
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;">
              <div style="font-size:36px;margin-bottom:10px;">🍽️</div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Menú Digital</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">¡Tu cuenta está lista!</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;font-weight:700;">¡Bienvenido${nombre ? `, ${nombre}` : ""}!</h2>
              <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">
                Gracias por tu compra. Activamos tu plan <strong style="color:#1e40af;text-transform:capitalize;">${plan || ""}</strong>.
                Estas son tus credenciales para entrar al panel de administración:
              </p>
              <div style="background:#f8fafc;border:2px dashed #3b82f6;border-radius:12px;padding:20px;margin:0 0 20px;">
                <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Usuario</p>
                <p style="margin:0 0 14px;font-size:16px;font-weight:700;color:#1e293b;word-break:break-all;">${username}</p>
                <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Contraseña temporal</p>
                <p style="margin:0;font-size:26px;font-weight:800;color:#1e40af;letter-spacing:3px;font-family:monospace;">${tempPassword}</p>
              </div>
              <div style="text-align:center;margin:0 0 20px;">
                <a href="${loginUrl}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
                  Entrar al panel
                </a>
              </div>
              <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:14px 16px;">
                <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">
                  ⚠️ <strong>Importante:</strong> Al iniciar sesión te pediremos que definas tu propia contraseña.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">Menú Digital · Sistema de administración</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Menú Digital <onboarding@resend.dev>",
    to,
    subject: "🎉 Tu cuenta de Menú Digital está lista",
    html,
  });

  if (error) throw new Error(error.message);
};

module.exports = { sendPasswordResetEmail, sendWelcomeEmail };
