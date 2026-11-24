import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "../lib/i18n";
import { useDialogos } from "../lib/dialogos";
import { IconCheck, IconInfo } from "../lib/icons";
import { getApiErrorMessage, whatsappQRService, type ConexionQR } from "../services/api";

// "Usá tu WhatsApp de siempre": el local vincula su WhatsApp común
// escaneando un QR (o con un código de 8 letras si está en el mismo celular),
// como WhatsApp Web. Ver backend/src/services/whatsappQR.js.
//
// Textos pensados para gente grande y nada técnica: pasos cortos, sin jerga.

const CADA_MS = 3000; // cada cuánto se pregunta si ya escaneó
const VENCE_MS = 5 * 60 * 1000; // después de esto se deja de esperar
const MODO_KEY = "wa_qr_modo"; // qr | codigo (sobrevive a una recarga)

// Número completo a partir de lo que escribe el local. Argentina: 10 dígitos
// (área + número) → 549…; con el "15" de antes se lo saca. null = no se entiende.
function numeroCompleto(raw: string): string | null {
  let d = raw.replace(/\D/g, "").replace(/^0/, "");
  if (d.startsWith("549") && d.length === 13) return d;
  if (d.startsWith("54") && d.length === 12) return `549${d.slice(2)}`;
  if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
  if (d.length === 12) {
    // "381 15 505 2050": el 15 va después del área (2 a 4 dígitos).
    const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
    if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  }
  return d.length === 10 ? `549${d}` : null;
}

const formatoCodigo = (c: string) => (c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : c);

// "Entrá a **Dispositivos vinculados**" → nombre del botón de WhatsApp en negrita.
function ConNegrita({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("**").map((parte, i) =>
        i % 2 ? (
          <strong key={i} className="font-bold">
            {parte}
          </strong>
        ) : (
          <Fragment key={i}>{parte}</Fragment>
        ),
      )}
    </>
  );
}

const leerModo = (): "qr" | "codigo" => {
  try {
    return sessionStorage.getItem(MODO_KEY) === "codigo" ? "codigo" : "qr";
  } catch {
    return "qr";
  }
};
const guardarModo = (m: "qr" | "codigo") => {
  try {
    sessionStorage.setItem(MODO_KEY, m);
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

export default function WhatsappQR({ onCambio }: { onCambio?: () => void }) {
  const { t } = useLang();
  const { confirmar } = useDialogos();
  const [info, setInfo] = useState<ConexionQR | null>(null);
  const [modo, setModo] = useState<"qr" | "codigo">(leerModo);
  const [pidiendoTel, setPidiendoTel] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [telError, setTelError] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [vencido, setVencido] = useState(false);
  const [sinRed, setSinRed] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const desde = useRef(0);
  const fallos = useRef(0);
  const estadoPrevio = useRef<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const moverFoco = useRef(false); // sólo después de una acción del usuario

  const aplicar = useCallback(
    (r: ConexionQR) => {
      setInfo((prev) => ({
        ...r,
        // El código de 8 letras sólo llega al pedirlo: se conserva mientras se espera.
        codigo: r.codigo ?? (r.cuenta?.estado === "vinculando" ? prev?.codigo : null),
      }));
      const estado = r.cuenta?.estado || null;
      if (estadoPrevio.current === "vinculando" && estado === "conectado") {
        setAnuncio(t("waQrDone"));
        moverFoco.current = true;
        onCambio?.();
      }
      estadoPrevio.current = estado;
    },
    [onCambio, t],
  );

  const cargar = useCallback(
    () =>
      whatsappQRService
        .get()
        .then((r) => {
          fallos.current = 0;
          setSinRed(false);
          aplicar(r);
        })
        .catch(() => {
          fallos.current += 1;
          if (fallos.current >= 3) setSinRed(true);
        }),
    [aplicar],
  );

  useEffect(() => {
    desde.current = Date.now();
    void cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const estado = info?.cuenta?.estado;
  const vinculando = estado === "vinculando";

  // Mientras se vincula, se pregunta cada 3 s si ya escaneó, y apenas se
  // vuelve a esta pestaña (por ejemplo, después de ir a WhatsApp).
  useEffect(() => {
    if (!vinculando || vencido) return;
    const revisar = () => {
      if (Date.now() - desde.current > VENCE_MS) {
        setVencido(true);
        setAnuncio(t("waQrExpired"));
        return;
      }
      if (document.visibilityState === "visible") void cargar();
    };
    const id = window.setInterval(revisar, CADA_MS);
    document.addEventListener("visibilitychange", revisar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", revisar);
    };
  }, [vinculando, vencido, cargar, t]);

  // Al cambiar de paso por una acción del usuario, el foco va al título.
  useEffect(() => {
    if (!moverFoco.current) return;
    moverFoco.current = false;
    titulo.current?.focus();
  }, [estado, vencido, pidiendoTel, modo]);

  const iniciar = async (conTelefono?: string) => {
    setOcupado(true);
    setError(null);
    setVencido(false);
    setAnuncio(t("waQrPreparing"));
    try {
      const r = await whatsappQRService.iniciar(conTelefono);
      desde.current = Date.now();
      const m = conTelefono ? "codigo" : "qr";
      setModo(m);
      guardarModo(m);
      setPidiendoTel(false);
      moverFoco.current = true;
      aplicar(r);
      setAnuncio(m === "codigo" ? t("waQrCodeReady") : t("waQrReady"));
      onCambio?.();
    } catch (e) {
      setAnuncio("");
      setError(getApiErrorMessage(e, t("waQrErrorGeneric")));
    } finally {
      setOcupado(false);
    }
  };

  const desconectar = async (preguntar = true) => {
    if (
      preguntar &&
      !(await confirmar({ mensaje: t("waQrDisconnectAsk"), confirmarTexto: t("waQrDisconnectYes") }))
    )
      return false;
    setOcupado(true);
    try {
      await whatsappQRService.desconectar();
      setError(null);
      setPidiendoTel(false);
      setVencido(false);
      moverFoco.current = true;
      await cargar();
      onCambio?.();
      return true;
    } catch (e) {
      setError(getApiErrorMessage(e, t("waQrErrorGeneric")));
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const pedirCodigo = () => {
    const n = numeroCompleto(telefono);
    setTelError(!n);
    if (n) void iniciar(n);
  };

  const copiar = async () => {
    if (!info?.codigo) return;
    try {
      await navigator.clipboard.writeText(info.codigo);
      setCopiado(true);
      setAnuncio(t("waQrCopied"));
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin portapapeles: el código sigue a la vista */
    }
  };

  // Sin la opción habilitada en el servidor (y sin conexión vieja): no se muestra.
  if (!info || (!info.disponible && !info.cuenta)) return null;

  // Recargó la página mientras esperaba el código de 8 letras (que no se
  // vuelve a mostrar): se ofrece pedir uno nuevo.
  const sinCodigo = vinculando && !vencido && modo === "codigo" && !info.codigo;

  const btn =
    "min-h-11 cursor-pointer rounded-xl px-5 py-3 text-[15px] font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0";
  const link =
    "-mx-2 inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-left text-[15px] font-semibold text-fg-2 underline underline-offset-4 hover:text-fg disabled:opacity-50";
  const paso = "flex gap-3 text-[15px] leading-snug text-fg";
  const num = "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ok-bg text-sm font-bold text-ok";

  const textoTitulo =
    estado === "conectado"
      ? t("waQrConnected")
      : estado === "desconectado"
        ? t("waQrLost")
        : vinculando
          ? t("waQrStepsTitle")
          : t("waQrTitle");

  const pasos = (lista: string[], extra?: ReactNode) => (
    <ol role="list" className="min-w-0 flex-1 space-y-3">
      {lista.map((p, i) => (
        <li key={i} className={paso}>
          <span className={num} aria-hidden="true">
            {i + 1}
          </span>
          <span className="min-w-0">
            <ConNegrita texto={p} />
            {i === lista.length - 1 && extra}
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <section
      aria-labelledby="wa-qr-titulo"
      className="dash-in rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-1)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {estado === "conectado" && (
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok-bg text-ok">
              <IconCheck size={18} />
            </span>
          )}
          <div className="min-w-0">
            {/* Recibe el foco al cambiar de paso (para lectores de pantalla); no es un control: sin recuadro. */}
            <h2
              id="wa-qr-titulo"
              ref={titulo}
              tabIndex={-1}
              style={{ outline: "none" }}
              className="text-[16px] font-semibold text-fg"
            >
              {textoTitulo}
            </h2>

            {/* ── Conectado ── */}
            {estado === "conectado" && (
              <>
                {(info.cuenta?.telefono || info.cuenta?.nombre_visible) && (
                  <p className="mt-0.5 text-[15px] font-semibold text-ok">
                    {[info.cuenta?.telefono, info.cuenta?.nombre_visible].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1.5 text-[15px] text-fg-2">{t("waQrConnectedDesc")}</p>
                <p className="mt-2 flex gap-2 text-sm text-fg-3">
                  <span className="mt-0.5 shrink-0">
                    <IconInfo size={14} />
                  </span>
                  {t("waQrTip")}
                </p>
              </>
            )}

            {/* ── Hay que volver a conectar ── */}
            {estado === "desconectado" && <p className="mt-1 text-[15px] text-fg-2">{t("waQrLostDesc")}</p>}

            {/* ── Sin conectar ── */}
            {!estado && <p className="mt-1 max-w-[62ch] text-[15px] text-fg-2">{t("waQrDesc")}</p>}
          </div>
        </div>
        {estado === "conectado" && (
          <button
            type="button"
            onClick={() => desconectar()}
            disabled={ocupado}
            className="min-h-11 cursor-pointer rounded-xl border border-line px-4 text-[15px] font-semibold text-fg-2 disabled:opacity-50"
          >
            {t("waQrDisconnect")}
          </button>
        )}
      </div>

      {estado === "desconectado" && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
          <button type="button" onClick={() => iniciar()} disabled={ocupado} className={`${btn} bg-ok text-surface`}>
            {t("waQrReconnect")}
          </button>
          <button type="button" onClick={() => desconectar()} disabled={ocupado} className={link}>
            {t("waQrDisconnect")}
          </button>
        </div>
      )}

      {!estado &&
        (pidiendoTel ? (
          <form
            className="mt-4 max-w-md"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              pedirCodigo();
            }}
          >
            <label htmlFor="wa-qr-tel" className="block text-[15px] font-semibold text-fg">
              {t("waQrPhoneLabel")}
            </label>
            <input
              id="wa-qr-tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              autoFocus
              value={telefono}
              onChange={(e) => {
                setTelefono(e.target.value);
                setTelError(false);
              }}
              placeholder="381 505 2050"
              aria-invalid={telError || undefined}
              aria-describedby={telError ? "wa-qr-tel-error wa-qr-tel-ayuda" : "wa-qr-tel-ayuda"}
              className={`mt-2 w-full rounded-xl border bg-surface px-4 py-3 text-[17px] text-fg placeholder:text-fg-3 focus:border-ok ${
                telError ? "border-err" : "border-line"
              }`}
            />
            {telError && (
              <p id="wa-qr-tel-error" role="alert" className="mt-1.5 text-sm font-semibold text-err">
                {t("waQrPhoneError")}
              </p>
            )}
            <p id="wa-qr-tel-ayuda" className="mt-1.5 text-sm text-fg-3">
              {t("waQrPhoneHelp")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <button type="submit" disabled={ocupado} aria-busy={ocupado} className={`${btn} bg-ok text-surface`}>
                {ocupado ? t("waQrPreparing") : t("waQrPhoneGet")}
              </button>
              <button
                type="button"
                onClick={() => {
                  moverFoco.current = true;
                  setPidiendoTel(false);
                }}
                disabled={ocupado}
                className={link}
              >
                {t("waQrUseQr")}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
            <button
              type="button"
              onClick={() => iniciar()}
              disabled={ocupado}
              aria-busy={ocupado}
              className={`${btn} bg-ok text-surface`}
            >
              {ocupado ? t("waQrPreparing") : t("waQrStart")}
            </button>
            <button
              type="button"
              onClick={() => {
                moverFoco.current = true;
                setPidiendoTel(true);
              }}
              disabled={ocupado}
              className={link}
            >
              {t("waQrSamePhone")}
            </button>
          </div>
        ))}

      {/* ── Vinculando ── */}
      {vinculando &&
        (vencido || sinCodigo ? (
          <div className="mt-3">
            <p className="text-[15px] text-fg-2">{vencido ? t("waQrExpired") : t("waQrCodeLost")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1">
              <button
                type="button"
                onClick={() => {
                  const n = modo === "codigo" ? numeroCompleto(telefono) : null;
                  if (modo === "codigo" && !n) void desconectar(false).then((ok) => ok && setPidiendoTel(true));
                  else void iniciar(n || undefined);
                }}
                disabled={ocupado}
                className={`${btn} bg-ok text-surface`}
              >
                {t("waQrNew")}
              </button>
              <button type="button" onClick={() => desconectar(false)} disabled={ocupado} className={link}>
                {t("waQrCancel")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-start">
              {modo === "codigo" && info.codigo ? (
                pasos(
                  [t("waQrCodeSteps1"), t("waQrCodeSteps2"), t("waQrCodeSteps3")],
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <strong className="font-mono text-[28px] font-bold tracking-[0.14em] text-fg sm:text-[32px]">
                      <span aria-hidden="true">{formatoCodigo(info.codigo)}</span>
                      <span className="sr-only">{info.codigo.split("").join(" ")}</span>
                    </strong>
                    <button
                      type="button"
                      onClick={copiar}
                      className="min-h-11 cursor-pointer rounded-xl border border-line px-4 text-[15px] font-semibold text-fg"
                    >
                      {copiado ? t("waQrCopied") : t("waQrCopy")}
                    </button>
                  </span>,
                )
              ) : (
                <>
                  <div className="grid aspect-square w-full max-w-[272px] shrink-0 place-items-center self-center rounded-2xl border border-line bg-white p-3 md:self-start">
                    {info.qr ? (
                      <img src={info.qr} alt={t("waQrImgAlt")} className="h-full w-full [image-rendering:pixelated]" />
                    ) : (
                      <span className="text-sm text-neutral-600">{t("waQrPreparing")}</span>
                    )}
                  </div>
                  {pasos([t("waQrStep1"), t("waQrStep2"), t("waQrStep3")])}
                </>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-sm text-fg-2">
                <span
                  className="h-2 w-2 animate-pulse rounded-full bg-ok motion-reduce:animate-none"
                  aria-hidden="true"
                />
                {sinRed ? t("waQrNoNet") : modo === "codigo" ? t("waQrWaitingCode") : t("waQrWaiting")}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                {modo === "qr" ? (
                  <button
                    type="button"
                    onClick={() => {
                      void desconectar(false).then((ok) => ok && setPidiendoTel(true));
                    }}
                    disabled={ocupado}
                    className={link}
                  >
                    {t("waQrSamePhone")}
                  </button>
                ) : (
                  <button type="button" onClick={() => iniciar()} disabled={ocupado} className={link}>
                    {t("waQrUseQr")}
                  </button>
                )}
                <button type="button" onClick={() => desconectar(false)} disabled={ocupado} className={link}>
                  {t("waQrCancel")}
                </button>
              </div>
            </div>
          </>
        ))}

      {/* Avisos para lectores de pantalla: regiones fijas, cambia sólo el texto. */}
      <div role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </div>
      <div role="alert" className={error ? "mt-3 text-sm text-err" : "sr-only"}>
        {error}
      </div>
    </section>
  );
}
