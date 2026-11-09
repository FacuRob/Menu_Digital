import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { useAuth } from "../../context/AuthContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconImage, IconPlus, IconX } from "../../lib/icons";
import { cld } from "../../lib/cloudinary";
import {
  getApiErrorMessage,
  soporteService,
  type EstadoSoporte,
  type MensajeSoporte,
  type TicketSoporte,
  type TipoSoporte,
} from "../../services/api";

// Sin sockets: se buscan novedades cada tanto (sólo con la pestaña visible).
const POLL_LISTA_MS = 15000;
const POLL_TICKET_MS = 8000;

const TIPOS: { id: TipoSoporte; label: string; ayuda: string }[] = [
  { id: "error", label: "Algo no funciona", ayuda: "Un botón, una pantalla o el menú falla" },
  { id: "pago", label: "Pagos y plan", ayuda: "Cobros, suscripción o cambio de plan" },
  { id: "duda", label: "Tengo una duda", ayuda: "No sé cómo hacer algo" },
  { id: "sugerencia", label: "Sugerencia", ayuda: "Una idea para mejorar el sistema" },
];
const TIPO_LABEL: Record<TipoSoporte, string> = {
  error: "Error",
  pago: "Pago",
  duda: "Duda",
  sugerencia: "Sugerencia",
};
const ESTADO: Record<EstadoSoporte, { label: string; cls: string }> = {
  abierto: { label: "Abierto", cls: "bg-info-bg text-info" },
  en_curso: { label: "En curso", cls: "bg-warn-bg text-warn" },
  resuelto: { label: "Resuelto", cls: "bg-ok-bg text-ok" },
};
type Filtro = "abiertos" | "resueltos" | "todos";
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abiertos", label: "Pendientes" },
  { id: "resueltos", label: "Resueltos" },
  { id: "todos", label: "Todos" },
];

const inputCls =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[16px] text-fg outline-none placeholder:text-fg-3 focus:ring-2 focus:ring-[color-mix(in_srgb,var(--focus)_30%,transparent)] sm:text-sm";

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

// En el celular la lista se oculta al abrir algo: el foco pasa al título de
// lo que se abrió (si no, queda perdido en la página).
function useEnfocarAlAbrir() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) ref.current?.focus();
  }, []);
  return ref;
}

// El aviso del menú lateral se actualiza al toque.
const avisarMenu = () => window.dispatchEvent(new Event("soporte-cambio"));

// Captura adjunta: se sube apenas se elige, así "Enviar" es instantáneo.
function useCaptura() {
  const [url, setUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const subir = async (file: File | undefined | null) => {
    if (!file || subiendo) return;
    if (!file.type.startsWith("image/")) return setError("Sólo se pueden adjuntar imágenes.");
    if (file.size > 5 * 1024 * 1024) return setError("La imagen pesa más de 5 MB.");
    setError("");
    setSubiendo(true);
    try {
      setUrl((await soporteService.subirImagen(file)).url);
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudo subir la imagen."));
    } finally {
      setSubiendo(false);
    }
  };
  // Pegar una captura con Ctrl+V dentro del texto.
  const alPegar = (e: ClipboardEvent) => {
    const img = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (img) {
      e.preventDefault();
      subir(img);
    }
  };
  const limpiar = () => {
    setUrl(null);
    setError("");
  };
  return { url, subiendo, error, subir, alPegar, limpiar };
}

type Captura = ReturnType<typeof useCaptura>;

function BotonAdjuntar({ cap, compacto = false }: { cap: Captura; compacto?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          cap.subir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={cap.subiendo}
        aria-label="Adjuntar captura"
        title="Adjuntar captura"
        className={
          compacto
            ? "grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-fg-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
            : "inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 text-sm font-medium text-fg-2 transition-colors hover:bg-surface-2 disabled:opacity-50"
        }
      >
        <IconImage size={18} />
        {!compacto && (cap.subiendo ? "Subiendo…" : "Adjuntar captura")}
      </button>
    </>
  );
}

function VistaCaptura({ cap }: { cap: Captura }) {
  if (!cap.url && !cap.subiendo && !cap.error) return null;
  return (
    <div className="flex items-center gap-3">
      {cap.subiendo && <span className="text-sm text-fg-3">Subiendo la imagen…</span>}
      {cap.url && (
        <span className="relative inline-block">
          <img src={cld(cap.url, { w: 160 }) || ""} alt="Captura adjunta" className="h-20 w-20 rounded-lg border border-line object-cover" />
          <button
            type="button"
            onClick={cap.limpiar}
            aria-label="Quitar captura"
            className="absolute right-1 top-1 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-surface-inv text-fg-inv"
          >
            <IconX size={12} />
          </button>
        </span>
      )}
      {cap.error && <span className="text-sm text-err">{cap.error}</span>}
    </div>
  );
}

function ChipEstado({ estado }: { estado: EstadoSoporte }) {
  const e = ESTADO[estado];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${e.cls}`}>{e.label}</span>;
}

export default function Soporte() {
  const { lang } = useLang();
  const locale = LOCALE[lang];
  const [params, setParams] = useSearchParams();

  const { isPlataforma } = useAuth();
  const [tech, setTech] = useState(isPlataforma);
  // Tech arranca por lo pendiente; el cliente ve todo (así encuentra la
  // respuesta aunque el reporte ya esté resuelto).
  const [filtro, setFiltro] = useState<Filtro>(isPlataforma ? "abiertos" : "todos");
  const [tickets, setTickets] = useState<TicketSoporte[] | null>(null);
  const [errorLista, setErrorLista] = useState(false);
  // number = ticket abierto · "nuevo" = formulario · null = nada
  const [abierto, setAbierto] = useState<number | "nuevo" | null>(() => {
    const id = Number(params.get("ticket"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });

  // Si cambiaste de filtro con un pedido en camino, esa respuesta vieja se descarta.
  const filtroRef = useRef(filtro);
  useEffect(() => {
    filtroRef.current = filtro;
  }, [filtro]);
  const cargarLista = useCallback(() => {
    const pedido = filtro;
    soporteService
      .listar(pedido)
      .then((r) => {
        if (pedido !== filtroRef.current) return;
        setTech(r.tech);
        setTickets(r.tickets);
        setErrorLista(false);
      })
      .catch(() => {
        if (pedido !== filtroRef.current) return;
        setErrorLista(true);
        setTickets((t) => t ?? []);
      });
  }, [filtro]);

  useEffect(() => {
    setTickets(null);
    cargarLista();
  }, [cargarLista]);
  usePolling(cargarLista, POLL_LISTA_MS);

  // El link del email (?ticket=ID) se usa una vez y se saca de la URL.
  useEffect(() => {
    if (params.has("ticket")) {
      params.delete("ticket");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const horaCorta = (iso: string) => {
    const d = new Date(iso);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  };

  // El ticket abierto ya se leyó: la lista lo refleja sin esperar al polling.
  const marcarLeido = useCallback((t: TicketSoporte) => {
    setTickets((ts) => ts?.map((x) => (x.id === t.id ? { ...x, sin_leer: false, estado: t.estado } : x)) ?? ts);
  }, []);

  const alCrear = (t: TicketSoporte) => {
    if (filtro === "resueltos") setFiltro("todos");
    setTickets((ts) => (ts ? [t, ...ts.filter((x) => x.id !== t.id)] : [t]));
    setAbierto(t.id);
  };

  const lista = (
    <div className={`${abierto ? "hidden md:flex" : "flex"} min-h-0 w-full flex-col md:w-[340px] md:shrink-0 md:border-r md:border-line`}>
      <div className="flex flex-col gap-3 p-3">
        {!tech && (
          <button
            type="button"
            onClick={() => setAbierto("nuevo")}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            <IconPlus size={16} /> Nuevo reporte
          </button>
        )}
        <div role="group" aria-label="Filtrar reportes" className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`min-h-[44px] cursor-pointer rounded-lg text-[13px] font-semibold transition-colors ${
                filtro === f.id ? "bg-surface text-fg shadow-sm" : "text-fg-2 hover:text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {tickets === null ? (
          [0, 1, 2].map((k) => <div key={k} className="mx-1 mb-2 h-16 animate-pulse rounded-xl bg-surface-2" />)
        ) : errorLista && tickets.length === 0 ? (
          <div role="alert" className="px-4 py-10 text-center text-sm text-fg-2">
            <p>No pudimos cargar los reportes.</p>
            <button type="button" onClick={cargarLista} className="mt-2 min-h-[44px] cursor-pointer px-3 font-semibold text-accent-ink underline">
              Reintentar
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="font-semibold text-fg">
              {filtro === "resueltos"
                ? "Todavía no hay reportes resueltos"
                : filtro === "todos"
                  ? "Todavía no hay reportes"
                  : "No hay reportes pendientes"}
            </div>
            <p className="mt-1 text-sm text-fg-2">
              {tech
                ? "Cuando un cliente reporte algo, aparece acá."
                : "Si algo no anda bien, tocá «Nuevo reporte» y contanos qué pasó."}
            </p>
          </div>
        ) : (
          tickets.map((t) => {
            const activo = t.id === abierto;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={activo ? "true" : undefined}
                onClick={() => setAbierto(t.id)}
                className={`mb-1 flex w-full cursor-pointer flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  activo ? "bg-accent-soft" : "hover:bg-surface-2"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-fg ${t.sin_leer ? "font-bold" : "font-semibold"}`}>{t.asunto}</span>
                  <span className={`shrink-0 text-xs ${t.sin_leer ? "font-semibold text-accent-ink" : "text-fg-3"}`}>
                    {horaCorta(t.ultimo_at)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] text-fg-2">
                    {tech ? `${t.cuenta_nombre || `Cuenta #${t.cuenta_id}`} · ` : ""}
                    {TIPO_LABEL[t.tipo]} · #{t.id}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {t.sin_leer && (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                        <span className="sr-only">Mensaje nuevo</span>
                      </>
                    )}
                    <ChipEstado estado={t.estado} />
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout title="Soporte">
      <div className="flex w-full flex-col gap-3">
        <p className="hidden text-sm text-fg-2 md:block">
          {tech
            ? "Reportes de todas las cuentas. Respondé y marcá cada uno como resuelto."
            : "¿Algo no funciona o tenés una duda? Contanos qué pasó y, si podés, adjuntá una captura de pantalla."}
        </p>
        <div className="flex h-[calc(100dvh-140px)] min-h-[420px] md:h-[calc(100dvh-170px)] overflow-hidden rounded-2xl border border-line bg-surface">
          {lista}
          <div className={`${abierto ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}>
            {abierto === "nuevo" ? (
              <NuevoReporte onCancelar={() => setAbierto(null)} onCreado={alCrear} />
            ) : abierto ? (
              <Conversacion
                key={abierto}
                id={abierto}
                locale={locale}
                onVolver={() => setAbierto(null)}
                onLeido={marcarLeido}
                onCambio={cargarLista}
              />
            ) : (
              <div className="grid flex-1 place-items-center bg-surface-2 p-6 text-center">
                <p className="max-w-xs text-sm text-fg-2">
                  {tech ? "Elegí un reporte para ver la conversación." : "Elegí un reporte o creá uno nuevo."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function BotonVolver({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-fg hover:bg-surface-2 md:hidden"
      aria-label="Volver a la lista"
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

// ── Formulario de reporte nuevo (sólo clientes) ──
function NuevoReporte({ onCancelar, onCreado }: { onCancelar: () => void; onCreado: (t: TicketSoporte) => void }) {
  const [tipo, setTipo] = useState<TipoSoporte | null>(null);
  const [asunto, setAsunto] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const cap = useCaptura();
  const tituloRef = useEnfocarAlAbrir();
  const asuntoRef = useRef<HTMLInputElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipo) {
      document.querySelector<HTMLInputElement>('input[name="tipo"]')?.focus();
      return setError("Elegí qué tipo de reporte es.");
    }
    if (!asunto.trim()) {
      asuntoRef.current?.focus();
      return setError("Poné un título corto.");
    }
    if (!texto.trim() && !cap.url) {
      textoRef.current?.focus();
      return setError("Contanos qué pasó o adjuntá una captura.");
    }
    setEnviando(true);
    setError("");
    try {
      onCreado(await soporteService.crear({ tipo, asunto: asunto.trim(), texto: texto.trim(), imagen_url: cap.url }));
      avisarMenu();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo enviar el reporte."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <BotonVolver onClick={onCancelar} />
        <h2 ref={tituloRef} tabIndex={-1} className="px-1 text-base font-semibold text-fg outline-none">
          Nuevo reporte
        </h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-fg">¿Sobre qué es?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIPOS.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer flex-col rounded-xl border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--focus)] ${
                  tipo === t.id ? "border-accent bg-accent-soft" : "border-line hover:bg-surface-2"
                }`}
              >
                <input type="radio" name="tipo" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} className="sr-only" />
                <span className="text-sm font-semibold text-fg">{t.label}</span>
                <span className="text-[13px] text-fg-2">{t.ayuda}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-fg">Título</span>
          <input
            ref={asuntoRef}
            required
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            maxLength={120}
            placeholder="Ej.: No se guardan los precios"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-fg">¿Qué pasó?</span>
          <textarea
            ref={textoRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onPaste={cap.alPegar}
            rows={5}
            maxLength={4000}
            placeholder="Contanos qué estabas haciendo y qué viste. Podés pegar una captura con Ctrl+V."
            className={`${inputCls} resize-y`}
          />
        </label>

        <div className="space-y-3">
          <BotonAdjuntar cap={cap} />
          <VistaCaptura cap={cap} />
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
        {error && (
          <p role="alert" className="text-sm text-err sm:mr-auto">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando || cap.subiendo}
          className="min-h-[44px] cursor-pointer rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}

// ── Conversación de un ticket ──
function Conversacion({
  id,
  locale,
  onVolver,
  onLeido,
  onCambio,
}: {
  id: number;
  locale: string;
  onVolver: () => void;
  onLeido: (t: TicketSoporte) => void;
  onCambio: () => void;
}) {
  const [tech, setTech] = useState(false);
  const [ticket, setTicket] = useState<TicketSoporte | null>(null);
  const [mensajes, setMensajes] = useState<MensajeSoporte[]>([]);
  const [noExiste, setNoExiste] = useState(false);
  const [fallo, setFallo] = useState(false);
  const tituloRef = useEnfocarAlAbrir();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const cap = useCaptura();
  const finRef = useRef<HTMLDivElement>(null);
  const ultimoIdRef = useRef<number | null>(null);
  const vistosRef = useRef(-1);

  const cargar = useCallback(() => {
    soporteService
      .ver(id)
      .then((r) => {
        setTech(r.tech);
        setTicket(r.ticket);
        setFallo(false);
        // Conserva lo recién enviado si este pedido salió antes de mandarlo.
        setMensajes((prev) => {
          const ultimo = r.mensajes[r.mensajes.length - 1]?.id ?? 0;
          return [...r.mensajes, ...prev.filter((x) => x.id > ultimo)];
        });
        onLeido(r.ticket);
        // Al abrirlo o si llegó algo nuevo (no en cada vuelta del polling).
        if (r.mensajes.length !== vistosRef.current) {
          vistosRef.current = r.mensajes.length;
          avisarMenu();
        }
      })
      .catch((e) => {
        if (e?.response?.status === 404) setNoExiste(true);
        else setFallo(true);
      });
  }, [id, onLeido]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  usePolling(cargar, POLL_TICKET_MS, !noExiste);

  // Baja al final sólo cuando llega un mensaje nuevo.
  useEffect(() => {
    const ultimo = mensajes[mensajes.length - 1]?.id ?? null;
    if (ultimo !== ultimoIdRef.current) {
      finRef.current?.scrollIntoView({ block: "end" });
      ultimoIdRef.current = ultimo;
    }
  }, [mensajes]);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const limpio = texto.trim();
    if ((!limpio && !cap.url) || enviando || cap.subiendo) return;
    setEnviando(true);
    setError("");
    try {
      const r = await soporteService.responder(id, { texto: limpio, imagen_url: cap.url });
      setMensajes((ms) => (ms.some((x) => x.id === r.mensaje.id) ? ms : [...ms, r.mensaje]));
      setTicket((t) => (t ? { ...t, estado: r.estado } : t));
      setTexto("");
      cap.limpiar();
      onCambio();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo enviar el mensaje."));
    } finally {
      setEnviando(false);
    }
  };

  const cambiarEstado = async (estado: EstadoSoporte) => {
    if (!ticket || ticket.estado === estado) return;
    setError("");
    try {
      await soporteService.cambiarEstado(id, estado);
      setTicket({ ...ticket, estado });
      onCambio();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo cambiar el estado."));
    }
  };

  // Con teclado físico: Enter envía y Shift+Enter hace un salto de línea.
  // En el celular, Enter es salto de línea (se envía con el botón).
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      enviar();
    }
  };

  if (noExiste) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-fg-2">No encontramos ese reporte.</p>
          <button type="button" onClick={onVolver} className="mt-3 cursor-pointer text-sm font-semibold text-accent-ink underline">
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  if (fallo && !ticket) {
    return (
      <div role="alert" className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-fg-2">No pudimos cargar la conversación.</p>
          <div className="mt-2 flex justify-center gap-2">
            <button type="button" onClick={cargar} className="min-h-[44px] cursor-pointer px-3 text-sm font-semibold text-accent-ink underline">
              Reintentar
            </button>
            <button type="button" onClick={onVolver} className="min-h-[44px] cursor-pointer px-3 text-sm text-fg-2 underline md:hidden">
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2.5">
        <BotonVolver onClick={onVolver} />
        <div className="min-w-0 flex-1 px-1">
          <h2 ref={tituloRef} tabIndex={-1} className="truncate font-semibold text-fg outline-none">
            {ticket?.asunto ?? <span className="inline-block h-4 w-40 animate-pulse rounded bg-surface-2" aria-label="Cargando" />}
          </h2>
          {ticket && (
            <p className="truncate text-xs text-fg-3">
              #{ticket.id} · {TIPO_LABEL[ticket.tipo]}
              {tech && ` · ${ticket.cuenta_nombre || `Cuenta #${ticket.cuenta_id}`}`}
              {tech && ticket.cuenta_email ? ` · ${ticket.cuenta_email}` : ""}
            </p>
          )}
        </div>
        {ticket &&
          (tech ? (
            <div role="group" aria-label="Estado del reporte" className="flex gap-1 rounded-xl bg-surface-2 p-1">
              {(Object.keys(ESTADO) as EstadoSoporte[]).map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={ticket.estado === e}
                  onClick={() => cambiarEstado(e)}
                  className={`min-h-[44px] cursor-pointer rounded-lg px-2.5 text-xs font-semibold transition-colors ${
                    ticket.estado === e ? `${ESTADO[e].cls} shadow-sm` : "text-fg-2 hover:text-fg"
                  }`}
                >
                  {ESTADO[e].label}
                </button>
              ))}
            </div>
          ) : (
            <ChipEstado estado={ticket.estado} />
          ))}
      </div>

      <div
        role="log"
        aria-label="Mensajes del reporte"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-3 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] sm:px-6"
      >
        {mensajes.map((m) => {
          // "Mío" = del lado de quien mira.
          const mio = m.de_tech === tech;
          return (
            <div key={m.id} className={`mb-3 flex ${mio ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug sm:max-w-[70%] ${
                  mio ? "rounded-tr-md bg-accent-soft text-fg" : "rounded-tl-md border border-line bg-surface text-fg"
                }`}
              >
                <div className="mb-1 text-xs font-semibold text-fg-2">
                  {m.de_tech ? "Soporte DinexFlow" : m.autor || "Cliente"}
                </div>
                {m.imagen_url && (
                  <a
                    href={m.imagen_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir captura en una pestaña nueva"
                    className="mb-1.5 block"
                  >
                    <img
                      src={cld(m.imagen_url, { w: 640 }) || ""}
                      alt="Captura adjunta"
                      // Al cargar cambia de alto: si es el último mensaje, se vuelve a bajar.
                      onLoad={() => m.id === mensajes[mensajes.length - 1]?.id && finRef.current?.scrollIntoView({ block: "end" })}
                      className="max-h-72 w-auto rounded-lg border border-line"
                    />
                  </a>
                )}
                {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}
                <div className="mt-1 text-right text-xs text-fg-3">{fecha(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        {ticket?.estado === "resuelto" && (
          <p className="my-2 text-center text-xs text-fg-3">
            {tech
              ? "Marcado como resuelto. Si el cliente escribe, se vuelve a abrir."
              : "Lo marcamos como resuelto. Si sigue pasando, escribinos acá y lo reabrimos."}
          </p>
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="space-y-2 border-t border-line px-3 py-2.5">
        {error && (
          <p role="alert" className="text-sm text-err">
            {error}
          </p>
        )}
        <VistaCaptura cap={cap} />
        <div className="flex items-end gap-2">
          <BotonAdjuntar cap={cap} compacto />
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKey}
            onPaste={cap.alPegar}
            rows={1}
            maxLength={4000}
            placeholder={tech ? "Respondé al cliente…" : "Escribí un mensaje…"}
            aria-label="Mensaje"
            disabled={!ticket}
            className={`${inputCls} max-h-32 min-h-11 flex-1 resize-none rounded-2xl [field-sizing:content]`}
          />
          <button
            type="submit"
            disabled={(!texto.trim() && !cap.url) || enviando || cap.subiendo || !ticket}
            aria-label="Enviar"
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando ? (
              "…"
            ) : (
              <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden>
                <path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a.99.99 0 00-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
