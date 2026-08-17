const cron = require("node-cron");
const supabase = require("../config/database");

/**
 * Menu Digital Keep-Alive
 * -----------------------
 * El plan gratuito de Supabase pausa la instancia tras un período de inactividad
 * (~7 días) y el Web Service Free de Render duerme tras ~15 min sin tráfico.
 *
 * Este servicio corre DENTRO del backend y hace dos cosas mientras el proceso
 * está despierto:
 *   1) pingDatabase(): consulta liviana a Supabase (mantiene la DB viva).
 *   2) selfPing(): auto-llamada HTTP al propio servicio (resetea el idle-timer
 *      de Render). Es best-effort: si no hay SELF_URL/RENDER_EXTERNAL_URL, se omite.
 *
 * POR QUÉ CADA 14 MIN (KEEP_ALIVE_CRON): Render Free duerme a los 15 min sin
 * tráfico entrante. El selfPing es una llamada HTTP externa al propio servicio,
 * así que CUENTA como tráfico entrante y reinicia ese contador. A 14 min queda
 * un minuto de margen. Resultado: el servicio no se duerme y desaparece el cold
 * start de ~50 s.
 *
 * Consumo: Render Free da 750 horas de instancia al mes y un servicio corriendo
 * 24/7 usa ~730. Entra, pero es UN solo servicio: si agregás otro, los dos
 * despiertos todo el mes se pasan del cupo.
 *
 * IMPORTANTE: si Render YA se durmió, este cron no corre (el proceso está
 * congelado) y no puede autodespertarse. Para ese caso está el keeper externo
 * `.github/workflows/keep-alive.yml`, que pega a `/api/keep-alive` una vez por
 * día: cubre el arranque tras un deploy, un crash o una pausa, y de paso evita
 * que Supabase se pause por inactividad (~7 días).
 */

// Cron por defecto: cada 14 min (por debajo de los 15 min de idle de Render).
const KEEP_ALIVE_CRON = process.env.KEEP_ALIVE_CRON || "*/14 * * * *";

// URL pública del propio servicio para el self-ping. Render la expone
// automáticamente como RENDER_EXTERNAL_URL; SELF_URL permite forzarla.
const SELF_URL = process.env.SELF_URL || process.env.RENDER_EXTERNAL_URL;

/** Consulta liviana a Supabase (head-count) para mantener la base despierta. */
async function pingDatabase() {
  const startedAt = Date.now();
  try {
    const { error } = await supabase
      .from("negocios")
      .select("id", { count: "exact", head: true });

    if (error) throw error;

    const ms = Date.now() - startedAt;
    console.log(`[keep-alive] Ping OK a Supabase (${ms}ms) @ ${new Date().toISOString()}`);
  } catch (err) {
    console.error("[keep-alive] Ping FALLÓ:", err);
  }
}

/**
 * Auto-llamada HTTP al endpoint de salud del propio servicio. Mantiene "tibio"
 * el Web Service mientras está despierto. Best-effort: no rompe nada si falla
 * ni si SELF_URL no está configurada.
 */
async function selfPing() {
  if (!SELF_URL) return; // sin URL pública no hay a quién llamarse
  const url = `${SELF_URL.replace(/\/+$/, "")}/api/health`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timeout);
    console.log(`[keep-alive] Self-ping ${res.status} → ${url}`);
  } catch (err) {
    console.error("[keep-alive] Self-ping FALLÓ:", err);
  }
}

/** Ejecuta ambos pings (DB + auto-llamada) en paralelo. */
async function runKeepAlive() {
  await Promise.allSettled([pingDatabase(), selfPing()]);
}

let task = null;

/**
 * Arranca el cron job de keep-alive. Se llama una vez al iniciar el servidor.
 * Ejecuta un ping inicial inmediato y luego se agenda según KEEP_ALIVE_CRON.
 */
function startKeepAlive() {
  if (task) return; // evita doble arranque

  if (!cron.validate(KEEP_ALIVE_CRON)) {
    console.error(`[keep-alive] Expresión cron inválida: "${KEEP_ALIVE_CRON}". Servicio deshabilitado.`);
    return;
  }

  // Ping inmediato al arrancar (confirma conectividad de una).
  void runKeepAlive();

  task = cron.schedule(KEEP_ALIVE_CRON, () => void runKeepAlive(), {
    timezone: "UTC",
  });

  console.log(`[keep-alive] Servicio activo. Agenda cron: "${KEEP_ALIVE_CRON}" (UTC).`);
}

/** Detiene el cron job (útil para apagado limpio o tests). */
function stopKeepAlive() {
  if (task) task.stop();
  task = null;
}

module.exports = { startKeepAlive, stopKeepAlive };
