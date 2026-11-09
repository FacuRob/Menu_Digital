const supabase = require("../config/database");
const { respondError } = require("../utils/respondError");
const df = require("../utils/dosFactores");
const { issueSession } = require("./authController");

const COLUMNAS = "id, username, totp_secreto, totp_activo, totp_respaldo, totp_ultimo_paso";

// Valida un código de la app o uno de respaldo. Devuelve los cambios a guardar
// (paso usado o respaldo consumido) o null si no vale.
const validar = (user, codigo) => {
  if (!user?.totp_secreto) return null;
  const paso = df.verificarCodigo(df.descifrar(user.totp_secreto), codigo, user.totp_ultimo_paso);
  if (paso !== null) return { totp_ultimo_paso: paso };
  const hash = df.hashRespaldo(codigo);
  const respaldo = user.totp_respaldo || [];
  if (user.totp_activo && respaldo.includes(hash)) {
    return { totp_respaldo: respaldo.filter((h) => h !== hash) };
  }
  return null;
};

const leerUsuario = async (id) => {
  const { data } = await supabase.from("usuarios").select(COLUMNAS).eq("id", id).maybeSingle();
  return data;
};

// POST /api/auth/2fa/verificar  (público)  { desafio, codigo } → sesión
const verificar = async (req, res) => {
  try {
    const id = df.leerDesafio(req.body.desafio);
    if (!id) {
      return res.status(401).json({ message: "La verificación venció. Volvé a iniciar sesión." });
    }
    const { data: user } = await supabase.from("usuarios").select("*").eq("id", id).maybeSingle();
    if (!user || !user.activo || !user.totp_activo) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    const cambios = validar(user, req.body.codigo);
    if (!cambios) return res.status(401).json({ message: "Código incorrecto" });
    await supabase.from("usuarios").update(cambios).eq("id", user.id);

    const session = await issueSession(user);
    res.json({ message: "Login exitoso", ...session });
  } catch (error) {
    return respondError(res, error, "verificar2fa");
  }
};

// POST /api/auth/2fa/iniciar  (logueado) → secreto nuevo, pendiente de confirmar
const iniciar = async (req, res) => {
  try {
    const user = await leerUsuario(req.user.id);
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    if (user.totp_activo) {
      return res.status(400).json({ message: "La verificación en dos pasos ya está activa" });
    }
    const secreto = df.generarSecreto();
    const { error } = await supabase
      .from("usuarios")
      .update({ totp_secreto: df.cifrar(secreto), totp_ultimo_paso: null })
      .eq("id", user.id);
    if (error) throw error;
    res.json({ secreto, otpauth: df.otpauthUrl(secreto, user.username) });
  } catch (error) {
    return respondError(res, error, "iniciar2fa");
  }
};

// POST /api/auth/2fa/activar  (logueado) { codigo } → activa y entrega respaldos
const activar = async (req, res) => {
  try {
    const user = await leerUsuario(req.user.id);
    if (!user?.totp_secreto || user.totp_activo) {
      return res.status(400).json({ message: "Primero generá el código QR" });
    }
    const cambios = validar(user, req.body.codigo);
    if (!cambios) return res.status(400).json({ message: "Código incorrecto" });

    const codigos = df.generarRespaldo();
    const { error } = await supabase
      .from("usuarios")
      .update({ ...cambios, totp_activo: true, totp_respaldo: codigos.map(df.hashRespaldo) })
      .eq("id", user.id);
    if (error) throw error;
    res.json({ message: "Verificación en dos pasos activada", codigos });
  } catch (error) {
    return respondError(res, error, "activar2fa");
  }
};

// POST /api/auth/2fa/desactivar  (logueado) { codigo } → pide un código válido
const desactivar = async (req, res) => {
  try {
    const user = await leerUsuario(req.user.id);
    if (!user?.totp_activo) {
      return res.status(400).json({ message: "La verificación en dos pasos no está activa" });
    }
    if (!validar(user, req.body.codigo)) {
      return res.status(400).json({ message: "Código incorrecto" });
    }
    const { error } = await supabase
      .from("usuarios")
      .update({ totp_activo: false, totp_secreto: null, totp_respaldo: null, totp_ultimo_paso: null })
      .eq("id", user.id);
    if (error) throw error;
    res.json({ message: "Verificación en dos pasos desactivada" });
  } catch (error) {
    return respondError(res, error, "desactivar2fa");
  }
};

module.exports = { verificar, iniciar, activar, desactivar };
