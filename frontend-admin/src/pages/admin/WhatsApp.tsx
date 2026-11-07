import { useEffect, useState, type FormEvent } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useTheme } from "../../context/ThemeContext";
import { useNegocio } from "../../context/NegocioContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconCheck, IconInfo } from "../../lib/icons";
import {
  configuracionService,
  getApiErrorMessage,
  iaService,
  whatsappService,
  type ConfigIA,
  type AvisosWhatsapp,
  type EstadoAviso,
  type MensajeWhatsapp,
} from "../../services/api";

const EMOJI: Record<EstadoAviso, string> = {
  pendiente: "📥",
  preparando: "👨‍🍳",
  en_camino: "🛵",
  listo: "🛍️",
  entregado: "🎉",
  cancelado: "❌",
};

const ESTADO_MSG: Record<MensajeWhatsapp["estado"], { color: string; check: string }> = {
  enviado: { color: "#64748b", check: "✓" },
  entregado: { color: "#64748b", check: "✓✓" },
  leido: { color: "#0ea5e9", check: "✓✓" },
  fallido: { color: "#ef4444", check: "!" },
};

function usePalette() {
  const { isDark } = useTheme();
  return {
    isDark,
    card: isDark
      ? "bg-[#151924] border border-white/[0.07]"
      : "bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.04)]",
    title: isDark ? "text-slate-100" : "text-slate-900",
    text: isDark ? "text-slate-300" : "text-slate-600",
    muted: isDark ? "text-slate-500" : "text-slate-400",
    soft: isDark ? "bg-white/[0.04]" : "bg-slate-50",
    input: isDark
      ? "bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
  };
}

// Interruptor accesible.
function Toggle({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative block h-6 w-11 shrink-0 cursor-pointer rounded-full p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-emerald-500" : "bg-slate-500/35 ring-1 ring-inset ring-slate-400/40"
      }`}
    >
      {/* left-0 explícito: sin él, el botón centra la bolita y apagado parece encendido. */}
      <span
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full shadow transition-transform ${
          on ? "bg-white" : "bg-slate-200"
        }`}
        style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  );
}

export default function WhatsApp() {
  const P = usePalette();
  const { t, lang } = useLang();
  const { negocioId } = useNegocio();
  const [data, setData] = useState<AvisosWhatsapp | null>(null);
  const [mensajes, setMensajes] = useState<MensajeWhatsapp[]>([]);
  const [local, setLocal] = useState("Tu local");
  const [error, setError] = useState("");
  const [tel, setTel] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ia, setIa] = useState<ConfigIA | null>(null);
  const [instrucciones, setInstrucciones] = useState("");
  const [iaMsg, setIaMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [guardandoIa, setGuardandoIa] = useState(false);

  const cargarMensajes = () =>
    whatsappService.getMensajes().then(setMensajes).catch(() => setMensajes([]));

  useEffect(() => {
    whatsappService
      .getAvisos()
      .then(setData)
      .catch((e) => setError(getApiErrorMessage(e, t("waSaveError"))));
    configuracionService
      .get()
      .then((c) => c.nombre && setLocal(c.nombre))
      .catch(() => {});
    iaService
      .get()
      .then((c) => {
        setIa(c);
        setInstrucciones(c.instrucciones || "");
      })
      .catch(() => setIa(null));
    cargarMensajes();
    const id = window.setInterval(cargarMensajes, 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId]);

  // Guarda con actualización optimista (vuelve atrás si falla).
  const guardar = async (cambio: { activo?: boolean; estados?: Partial<Record<EstadoAviso, boolean>> }) => {
    if (!data) return;
    const previo = data;
    setData({
      ...data,
      activo: cambio.activo ?? data.activo,
      estados: { ...data.estados, ...(cambio.estados || {}) },
    });
    setError("");
    try {
      await whatsappService.updateAvisos(cambio);
    } catch (e) {
      setData(previo);
      setError(getApiErrorMessage(e, t("waSaveError")));
    }
  };

  // Asistente con IA: interruptor (optimista) e indicaciones del local.
  const guardarIa = async (cambio: { activo?: boolean; instrucciones?: string }) => {
    if (!ia) return;
    const previo = ia;
    setIa({ ...ia, ...cambio });
    setIaMsg(null);
    setGuardandoIa(true);
    try {
      const r = await iaService.update(cambio);
      setIa({ ...previo, ...r });
      if (cambio.instrucciones !== undefined) setIaMsg({ ok: true, text: t("iaSaved") });
    } catch (e) {
      setIa(previo);
      setIaMsg({ ok: false, text: getApiErrorMessage(e, t("waSaveError")) });
    } finally {
      setGuardandoIa(false);
    }
  };

  const enviarPrueba = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setTestMsg(null);
    try {
      await whatsappService.prueba(tel);
      setTestMsg({ ok: true, text: t("waTestOk") });
      cargarMensajes();
    } catch (err) {
      setTestMsg({ ok: false, text: getApiErrorMessage(err, t("waSaveError")) });
    } finally {
      setEnviando(false);
    }
  };

  const ejemplo = (texto: string) =>
    texto.replace("{{1}}", "Juan").replace("{{2}}", local).replace("{{3}}", "128");

  const hora = new Date().toLocaleTimeString(LOCALE[lang], { hour: "2-digit", minute: "2-digit" });

  return (
    <AdminLayout title={t("navWhatsapp")}>
      <div className="w-full space-y-5 pb-6">
        {/* Encabezado */}
        <div className="dash-in">
          <h2 className={`text-2xl font-extrabold tracking-tight ${P.title}`}>{t("waTitle")}</h2>
          <p className={`mt-1 text-sm ${P.text}`}>{t("waSubtitle")}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
        )}

        {!data ? (
          <div className="space-y-3">
            {[0, 1, 2].map((k) => (
              <div key={k} className={`h-24 animate-pulse rounded-2xl ${P.soft}`} />
            ))}
          </div>
        ) : (
          <>
            {/* Estado de la conexión */}
            <div
              className={`dash-in flex items-start gap-3 rounded-2xl border px-4 py-3.5 ${
                data.conectado
                  ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                  : "border-amber-500/30 bg-amber-500/[0.08]"
              }`}
            >
              <span
                className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  data.conectado ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                }`}
              >
                {data.conectado ? <IconCheck size={16} /> : <IconInfo size={16} />}
              </span>
              <div>
                <div className={`font-semibold ${P.title}`}>
                  {data.conectado ? t("waConnected") : t("waNotConnected")}
                </div>
                <div className={`text-sm ${P.text}`}>
                  {data.conectado ? t("waConnectedDesc") : t("waNotConnectedDesc")}
                </div>
              </div>
            </div>

            {/* Interruptor general */}
            <div className={`dash-in flex items-center gap-4 rounded-2xl p-5 ${P.card}`} style={{ animationDelay: "60ms" }}>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25d366]/15 text-2xl">💬</span>
              <div className="min-w-0 flex-1">
                <div className={`font-semibold ${P.title}`}>{t("waMasterTitle")}</div>
                <div className={`text-sm ${P.text}`}>{t("waMasterDesc")}</div>
              </div>
              <Toggle on={data.activo} onChange={(v) => guardar({ activo: v })} label={t("waMasterTitle")} />
            </div>

            {/* Avisos por estado */}
            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className={`text-xs font-semibold uppercase tracking-[0.1em] ${P.muted}`}>{t("waAvisosTitle")}</h2>
                <span className={`text-xs ${P.muted}`}>{t("waPreviewNote")}</span>
              </div>
              <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${data.activo ? "" : "opacity-55"}`}>
                {data.avisos.map((a, i) => {
                  const on = !!data.estados[a.estado];
                  return (
                    <div
                      key={a.estado}
                      className={`dash-in flex flex-col rounded-2xl p-4 ${P.card}`}
                      style={{ animationDelay: `${100 + i * 50}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${P.soft}`}>
                          {EMOJI[a.estado]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className={`font-semibold ${P.title}`}>{t(`waAv_${a.estado}`)}</div>
                          <div className={`text-xs ${P.muted}`}>{t(`waWhen_${a.estado}`)}</div>
                        </div>
                        <Toggle
                          on={on}
                          disabled={!data.activo}
                          onChange={(v) => guardar({ estados: { [a.estado]: v } })}
                          label={t(`waAv_${a.estado}`)}
                        />
                      </div>
                      {/* Vista previa estilo WhatsApp */}
                      <div
                        className={`mt-3 rounded-xl p-3 ${P.isDark ? "bg-[#0b141a]" : "bg-[#efeae2]"} ${on ? "" : "grayscale"}`}
                      >
                        <div
                          className={`relative ml-auto max-w-[92%] rounded-lg rounded-tr-none px-3 py-2 text-[13px] leading-snug shadow-sm ${
                            P.isDark ? "bg-[#005c4b] text-[#e9edef]" : "bg-[#d9fdd3] text-[#111b21]"
                          }`}
                        >
                          {ejemplo(a.texto)}
                          <span className="ml-2 inline-block translate-y-1 text-[10px] opacity-60">
                            {hora} <span className="text-sky-400">✓✓</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className={`mt-3 flex items-center gap-2 text-xs ${P.muted}`}>
                <IconInfo size={14} /> {t("waOptinNote")}
              </p>
            </section>

            {/* Asistente con IA (Fase 3) */}
            {ia && (
              <section className={`rounded-2xl p-5 ${P.card}`}>
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-2xl">🤖</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${P.title}`}>{t("iaTitle")}</div>
                    <div className={`text-sm ${P.text}`}>{t("iaDesc")}</div>
                  </div>
                  <Toggle
                    on={ia.activo}
                    disabled={!ia.configurada || guardandoIa}
                    onChange={(v) => guardarIa({ activo: v })}
                    label={t("iaTitle")}
                  />
                </div>
                {!ia.configurada && (
                  <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-600">
                    <IconInfo size={14} /> {t("iaNotConfigured")}
                  </p>
                )}
                <ul className={`mt-4 grid gap-2 text-sm sm:grid-cols-3 ${P.text}`}>
                  <li className={`rounded-xl px-3 py-2 ${P.soft}`}>✅ {t("iaDoes1")}</li>
                  <li className={`rounded-xl px-3 py-2 ${P.soft}`}>🚫 {t("iaDoes2")}</li>
                  <li className={`rounded-xl px-3 py-2 ${P.soft}`}>👋 {t("iaDoes3")}</li>
                </ul>
                <label className={`mt-4 block text-sm font-semibold ${P.title}`} htmlFor="ia-instrucciones">
                  {t("iaInstrTitle")}
                </label>
                <p className={`mt-0.5 text-xs ${P.muted}`}>{t("iaInstrDesc")}</p>
                <textarea
                  id="ia-instrucciones"
                  value={instrucciones}
                  onChange={(e) => setInstrucciones(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder={t("iaInstrPh")}
                  className={`mt-2 w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/30 ${P.input}`}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs ${P.muted}`}>{instrucciones.length}/2000</span>
                  <div className="flex items-center gap-3">
                    {iaMsg && (
                      <span className={`text-sm ${iaMsg.ok ? "text-emerald-500" : "text-red-500"}`}>{iaMsg.text}</span>
                    )}
                    <button
                      type="button"
                      disabled={guardandoIa || instrucciones === (ia.instrucciones || "")}
                      onClick={() => guardarIa({ instrucciones })}
                      className="cursor-pointer rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      {t("iaSave")}
                    </button>
                  </div>
                </div>
              </section>
            )}

            <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              {/* Prueba */}
              <form onSubmit={enviarPrueba} className={`rounded-2xl p-5 ${P.card}`}>
                <h3 className={`text-[15px] font-semibold ${P.title}`}>{t("waTestTitle")}</h3>
                <p className={`mt-1 text-sm ${P.text}`}>{t("waTestDesc")}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="tel"
                    inputMode="tel"
                    value={tel}
                    onChange={(e) => setTel(e.target.value)}
                    placeholder={t("waTestPh")}
                    required
                    className={`min-w-0 flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 ${P.input}`}
                  />
                  <button
                    type="submit"
                    disabled={enviando || !data.conectado}
                    className="cursor-pointer rounded-xl bg-[#25d366] px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {enviando ? "…" : t("waTestBtn")}
                  </button>
                </div>
                {testMsg && (
                  <p className={`mt-3 text-sm ${testMsg.ok ? "text-emerald-500" : "text-red-500"}`}>{testMsg.text}</p>
                )}
              </form>

              {/* Registro */}
              <div className={`rounded-2xl p-5 ${P.card}`}>
                <h3 className={`mb-3 text-[15px] font-semibold ${P.title}`}>{t("waLogTitle")}</h3>
                {mensajes.length === 0 ? (
                  <div className={`rounded-xl py-8 text-center text-sm ${P.soft} ${P.muted}`}>{t("waLogEmpty")}</div>
                ) : (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                    {mensajes.map((m) => {
                      const st = ESTADO_MSG[m.estado] || ESTADO_MSG.enviado;
                      return (
                        <li key={m.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${P.soft}`}>
                          <span className="text-lg">{m.aviso && m.aviso !== "prueba" ? EMOJI[m.aviso] : "🧪"}</span>
                          <div className="min-w-0 flex-1">
                            <div className={`truncate font-medium ${P.title}`}>
                              {m.aviso === "prueba" || !m.aviso ? t("waTestLabel") : t(`waAv_${m.aviso}`)}
                              {m.pedido_id ? ` · ${t("waOrderN", { n: m.pedido_id })}` : ""}
                            </div>
                            <div className={`truncate text-xs ${P.muted}`} title={m.error || undefined}>
                              {m.telefono} ·{" "}
                              {new Date(m.created_at).toLocaleString(LOCALE[lang], {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {m.error ? ` · ${m.error}` : ""}
                            </div>
                          </div>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{ background: `${st.color}1a`, color: st.color }}
                          >
                            {st.check} {t(`waSt_${m.estado}`)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
