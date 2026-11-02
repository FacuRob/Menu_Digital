import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useTheme } from "../../context/ThemeContext";
import { useNegocio } from "../../context/NegocioContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconInfo } from "../../lib/icons";
import { chatsService, getApiErrorMessage, type ChatWhatsapp, type MensajeChat } from "../../services/api";

// Cada cuánto se buscan novedades (no hay sockets: polling liviano).
const POLL_LISTA_MS = 8000;
const POLL_CHAT_MS = 4000;

function usePalette() {
  const { isDark } = useTheme();
  return {
    isDark,
    card: isDark ? "bg-[#151924] border border-white/[0.07]" : "bg-white border border-slate-200/80",
    title: isDark ? "text-slate-100" : "text-slate-900",
    text: isDark ? "text-slate-300" : "text-slate-600",
    muted: isDark ? "text-slate-500" : "text-slate-400",
    soft: isDark ? "bg-white/[0.04]" : "bg-slate-50",
    hover: isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50",
    active: isDark ? "bg-white/[0.07]" : "bg-emerald-50",
    border: isDark ? "border-white/[0.07]" : "border-slate-200/80",
    input: isDark
      ? "bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500"
      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400",
    wall: isDark ? "bg-[#0b141a]" : "bg-[#efeae2]",
    bubbleIn: isDark ? "bg-[#202c33] text-[#e9edef]" : "bg-white text-[#111b21]",
    bubbleOut: isDark ? "bg-[#005c4b] text-[#e9edef]" : "bg-[#d9fdd3] text-[#111b21]",
  };
}

// Se repite cada `ms` mientras la pestaña esté visible.
function usePolling(fn: () => void, ms: number, activo = true) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!activo) return;
    const id = window.setInterval(() => {
      if (!document.hidden) ref.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [ms, activo]);
}

const iniciales = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

// "+54 381 505-2050" a partir de "543815052050".
const telefonoLindo = (tel: string) => {
  const m = tel.match(/^54(\d{3})(\d{3})(\d{4})$/);
  return m ? `+54 ${m[1]} ${m[2]}-${m[3]}` : `+${tel}`;
};

const CHECK: Record<string, { txt: string; color?: string }> = {
  enviado: { txt: "✓" },
  entregado: { txt: "✓✓" },
  leido: { txt: "✓✓", color: "#53bdeb" },
  fallido: { txt: "!", color: "#ef4444" },
};

export default function Chats() {
  const P = usePalette();
  const { t, lang } = useLang();
  const { negocioId } = useNegocio();
  const locale = LOCALE[lang];

  const [chats, setChats] = useState<ChatWhatsapp[] | null>(null);
  const [conectado, setConectado] = useState(true);
  const [iaActiva, setIaActiva] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [abiertoId, setAbiertoId] = useState<number | null>(null);
  const [chat, setChat] = useState<ChatWhatsapp | null>(null);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const finRef = useRef<HTMLDivElement>(null);
  const ultimoIdRef = useRef<number | null>(null);

  const cargarLista = useCallback(() => {
    chatsService
      .listar()
      .then((r) => {
        setChats(r.chats);
        setConectado(r.conectado);
        setIaActiva(r.ia_activa);
      })
      .catch(() => setChats((c) => c ?? []));
  }, []);

  const cargarChat = useCallback((id: number) => {
    chatsService
      .mensajes(id)
      .then((r) => {
        setChat(r.chat);
        setMensajes(r.mensajes);
        // La lista refleja que ya se leyó.
        setChats((cs) => cs?.map((c) => (c.id === id ? { ...c, no_leidos: 0 } : c)) ?? cs);
        // El aviso del menú lateral se actualiza al toque.
        window.dispatchEvent(new Event("chats-cambio"));
      })
      .catch(() => {});
  }, []);

  // Al cambiar de negocio: se empieza de cero.
  useEffect(() => {
    setChats(null);
    setAbiertoId(null);
    cargarLista();
  }, [negocioId, cargarLista]);

  useEffect(() => {
    setChat(null);
    setMensajes([]);
    setError("");
    setTexto("");
    if (abiertoId) cargarChat(abiertoId);
  }, [abiertoId, cargarChat]);

  usePolling(cargarLista, POLL_LISTA_MS);
  usePolling(() => abiertoId && cargarChat(abiertoId), POLL_CHAT_MS, !!abiertoId);

  // Baja al final solo cuando llega un mensaje nuevo (no en cada polling).
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1]?.id ?? null;
    if (ultimo !== ultimoIdRef.current) {
      finRef.current?.scrollIntoView({ block: "end" });
      ultimoIdRef.current = ultimo;
    }
  }, [mensajes]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!chats || !q) return chats ?? [];
    const digitos = q.replace(/\D/g, "");
    return chats.filter(
      (c) => (c.nombre || "").toLowerCase().includes(q) || (digitos && c.telefono.includes(digitos)),
    );
  }, [chats, busqueda]);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpio = texto.trim();
    if (!abiertoId || !limpio || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const m = await chatsService.enviar(abiertoId, limpio);
      // El polling puede haberlo traído antes: no se duplica.
      setMensajes((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
      setTexto("");
      setChats(
        (cs) =>
          cs
            ?.map((c) => (c.id === abiertoId ? { ...c, ultimo_texto: limpio, ultimo_at: m.created_at } : c))
            .sort((a, b) => (b.ultimo_at || "").localeCompare(a.ultimo_at || "")) ?? cs,
      );
    } catch (err) {
      setError(getApiErrorMessage(err, t("chSendError")));
      cargarChat(abiertoId);
    } finally {
      setEnviando(false);
    }
  };

  // Pausa o reactiva la IA en este chat.
  const cambiarIA = async () => {
    if (!chat) return;
    try {
      const c = await chatsService.cambiarIA(chat.id, !!chat.ia_pausada);
      setChat(c);
      window.dispatchEvent(new Event("chats-cambio"));
      setChats(
        (cs) => cs?.map((x) => (x.id === c.id ? { ...x, ia_pausada: c.ia_pausada, necesita_humano: c.necesita_humano } : x)) ?? cs,
      );
    } catch (err) {
      setError(getApiErrorMessage(err, t("chSendError")));
    }
  };

  // Enter envía; Shift+Enter hace un salto de línea.
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      enviar();
    }
  };

  const horaCorta = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }
    if (d.toDateString() === ayer.toDateString()) return t("chYesterday");
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  };

  const dia = (iso: string) => {
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString()) return t("chToday");
    if (d.toDateString() === ayer.toDateString()) return t("chYesterday");
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  };

  const nombreDe = (c: ChatWhatsapp) => c.nombre || telefonoLindo(c.telefono);

  // ── Lista de chats ──
  const lista = (
    <div className={`flex min-h-0 flex-col ${abiertoId ? "hidden md:flex" : "flex"} md:w-[340px] md:shrink-0 md:border-r ${P.border}`}>
      <div className="p-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={t("chSearch")}
          className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 ${P.input}`}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {chats === null ? (
          [0, 1, 2, 3].map((k) => <div key={k} className={`mx-1 mb-2 h-16 animate-pulse rounded-xl ${P.soft}`} />)
        ) : filtrados.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mb-3 text-4xl">💬</div>
            <div className={`font-semibold ${P.title}`}>{t("chEmptyTitle")}</div>
            {!busqueda && <p className={`mt-1 text-sm ${P.text}`}>{t("chEmptyDesc")}</p>}
          </div>
        ) : (
          filtrados.map((c) => {
            const activo = c.id === abiertoId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setAbiertoId(c.id)}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  activo ? P.active : P.hover
                }`}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
                  {iniciales(c.nombre || t("chUnknown"))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate font-semibold ${P.title}`}>{nombreDe(c)}</span>
                    <span className={`shrink-0 text-[11px] ${c.no_leidos ? "font-semibold text-emerald-500" : P.muted}`}>
                      {horaCorta(c.ultimo_at)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={`truncate text-[13px] ${P.text}`}>{c.ultimo_texto || t("chNoMessages")}</span>
                    {c.necesita_humano && (
                      <span
                        className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-500"
                        title={t("chNeedsHuman")}
                      >
                        👋 {t("chAttend")}
                      </span>
                    )}
                    {c.no_leidos > 0 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                        {c.no_leidos}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  // ── Conversación ──
  let ultimoDia = "";
  const conversacion = (
    <div className={`min-h-0 min-w-0 flex-1 flex-col ${abiertoId ? "flex" : "hidden md:flex"}`}>
      {!abiertoId ? (
        <div className={`grid flex-1 place-items-center p-6 text-center ${P.wall}`}>
          <div>
            <div className="mb-2 text-5xl opacity-70">💬</div>
            <p className={`text-sm ${P.text}`}>{t("chPick")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* Encabezado */}
          <div className={`flex items-center gap-3 border-b px-3 py-2.5 ${P.border}`}>
            <button
              type="button"
              onClick={() => setAbiertoId(null)}
              className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full md:hidden ${P.hover} ${P.title}`}
              aria-label={t("chBack")}
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-sm font-bold text-white">
              {iniciales(chat?.nombre || t("chUnknown"))}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`truncate font-semibold ${P.title}`}>{chat ? nombreDe(chat) : "…"}</div>
              {chat && <div className={`truncate text-xs ${P.muted}`}>{telefonoLindo(chat.telefono)}</div>}
            </div>
            {iaActiva && chat && (
              <button
                type="button"
                onClick={cambiarIA}
                title={chat.ia_pausada ? t("chIaResume") : t("chIaPause")}
                className={`shrink-0 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  chat.ia_pausada
                    ? `${P.border} ${P.text} ${P.hover}`
                    : "border-violet-500/30 bg-violet-500/10 text-violet-500 hover:bg-violet-500/15"
                }`}
              >
                🤖 {chat.ia_pausada ? t("chIaPaused") : t("chIaOn")}
              </button>
            )}
          </div>

          {iaActiva && chat?.necesita_humano && (
            <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/[0.08] px-4 py-2 text-sm text-amber-600">
              👋 {t("chNeedsHuman")}
            </div>
          )}

          {/* Mensajes */}
          <div className={`min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 ${P.wall}`}>
            {mensajes.map((m) => {
              const d = dia(m.created_at);
              const separador = d !== ultimoDia;
              ultimoDia = d;
              const sale = m.direccion === "saliente";
              const ck = CHECK[m.estado];
              return (
                <div key={m.id}>
                  {separador && (
                    <div className="my-3 flex justify-center">
                      <span className={`rounded-lg px-3 py-1 text-[11px] font-medium shadow-sm ${P.bubbleIn}`}>{d}</span>
                    </div>
                  )}
                  <div className={`mb-1.5 flex ${sale ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-1.5 text-[14px] leading-snug shadow-sm sm:max-w-[70%] ${
                        sale ? `${P.bubbleOut} rounded-tr-none` : `${P.bubbleIn} rounded-tl-none`
                      }`}
                    >
                      {m.autor === "ia" && (
                        <div className="mb-0.5 text-[11px] font-semibold text-violet-500">🤖 {t("chIaAuthor")}</div>
                      )}
                      {m.aviso && (
                        <div className="mb-0.5 text-[11px] font-semibold opacity-70">
                          🤖 {t("chAutoAviso")}
                          {m.pedido_id ? ` · #${m.pedido_id}` : ""}
                        </div>
                      )}
                      <span className="whitespace-pre-wrap break-words">{m.texto || "—"}</span>
                      <span className="ml-2 inline-flex translate-y-1 items-center gap-1 text-[10px] opacity-60">
                        {new Date(m.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        {sale && ck && <span style={{ color: ck.color }}>{ck.txt}</span>}
                      </span>
                      {m.estado === "fallido" && (
                        <div className="mt-1 text-[11px] font-medium text-red-500" title={m.error || undefined}>
                          {t("chFailed")}
                          {m.error ? `: ${m.error}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={finRef} />
          </div>

          {/* Escribir */}
          {chat && !chat.puede_responder ? (
            <div className={`flex items-start gap-2 border-t px-4 py-3 text-sm ${P.border} ${P.text}`}>
              <span className="mt-0.5 text-amber-500">
                <IconInfo size={16} />
              </span>
              {t("chClosed")}
            </div>
          ) : (
            <form onSubmit={enviar} className={`border-t px-3 py-2.5 ${P.border}`}>
              {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={onKey}
                  rows={1}
                  maxLength={4096}
                  placeholder={t("chPlaceholder")}
                  disabled={!chat}
                  className={`max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl border px-4 py-2.5 text-[16px] outline-none focus:ring-2 focus:ring-emerald-500/30 sm:text-sm ${P.input}`}
                />
                <button
                  type="submit"
                  disabled={!texto.trim() || enviando || !chat}
                  aria-label={t("chSend")}
                  className="grid h-[42px] w-[42px] shrink-0 cursor-pointer place-items-center rounded-full bg-[#25d366] text-white transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {enviando ? (
                    "…"
                  ) : (
                    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
                      <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                    </svg>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );

  return (
    <AdminLayout title={t("navChats")}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3">
        {!conectado && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-4 py-2.5 text-sm text-amber-600">
            <IconInfo size={16} /> {t("chNotConnected")}
          </div>
        )}
        <div className={`flex h-[calc(100dvh-140px)] min-h-[460px] overflow-hidden rounded-2xl ${P.card}`}>
          {lista}
          {conversacion}
        </div>
      </div>
    </AdminLayout>
  );
}
