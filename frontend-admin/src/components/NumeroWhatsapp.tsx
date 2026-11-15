import { useEffect, useRef, useState } from "react";
import { useLang } from "../lib/i18n";
import { useDialogos } from "../lib/dialogos";
import { getApiErrorMessage, whatsappCuentaService, type CuentaWhatsapp } from "../services/api";

// "Tu número de WhatsApp": el local conecta su propio número con el alta de
// Meta (Embedded Signup v4). Si ya usa la app WhatsApp Business, Meta lo pasa
// por "coexistencia" y la sigue usando. Ver backend/src/services/whatsappCuentas.js.

type FBLoginResp = { authResponse?: { code?: string } | null };
type FBSdk = {
  init: (o: Record<string, unknown>) => void;
  login: (cb: (r: FBLoginResp) => void, o: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    FB?: FBSdk;
    fbAsyncInit?: () => void;
  }
}

// El SDK se carga una vez, al abrir la pantalla: así el popup de Meta se abre
// directo en el clic (si se cargara en el clic, el navegador lo bloquea).
let sdk: Promise<FBSdk> | null = null;
function cargarSdk(alta: NonNullable<CuentaWhatsapp["alta"]>): Promise<FBSdk> {
  if (!sdk) {
    sdk = new Promise<FBSdk>((ok, mal) => {
      window.fbAsyncInit = () => {
        window.FB!.init({ appId: alta.appId, autoLogAppEvents: true, xfbml: false, version: alta.sdkVersion });
        ok(window.FB!);
      };
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      s.crossOrigin = "anonymous";
      s.onerror = () => {
        sdk = null;
        mal(new Error("No se pudo cargar Meta"));
      };
      document.body.appendChild(s);
    });
  }
  return sdk;
}

// Sólo mensajes de las páginas de Meta (no "facebook.com.otro-sitio").
const ORIGEN_META = /^https:\/\/([a-z0-9-]+\.)?facebook\.com$/;

type Sesion = { waba_id: string; phone_number_id: string; coexistencia: boolean };

const ESTADO_TPL: Record<string, { key: string; cls: string }> = {
  APPROVED: { key: "waTplApproved", cls: "bg-ok-bg text-ok" },
  PENDING: { key: "waTplPending", cls: "bg-warn-bg text-warn" },
  IN_APPEAL: { key: "waTplPending", cls: "bg-warn-bg text-warn" },
  REJECTED: { key: "waTplRejected", cls: "bg-err-bg text-err" },
  FALTA: { key: "waTplMissing", cls: "bg-err-bg text-err" },
};

export default function NumeroWhatsapp({ onCambio }: { onCambio?: () => void }) {
  const { t } = useLang();
  const { confirmar } = useDialogos();
  const [info, setInfo] = useState<CuentaWhatsapp | null>(null);
  const [fb, setFb] = useState<FBSdk | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sesion = useRef<Sesion | null>(null);

  const cargar = () =>
    whatsappCuentaService
      .get()
      .then((r) => {
        setInfo(r);
        if (r.alta && !r.cuenta) cargarSdk(r.alta).then(setFb).catch(() => setFb(null));
      })
      .catch(() => setInfo(null));

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Eventos del popup de Meta: ids de la cuenta y del número elegidos.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (!ORIGEN_META.test(ev.origin) || typeof ev.data !== "string") return;
      let d: { type?: string; event?: string; data?: Record<string, string> };
      try {
        d = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (d.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event?.startsWith("FINISH") && d.data?.waba_id && d.data?.phone_number_id) {
        sesion.current = {
          waba_id: d.data.waba_id,
          phone_number_id: d.data.phone_number_id,
          coexistencia: d.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        };
      } else if (d.event === "CANCEL") {
        setMsg({ ok: false, text: t("waOwnCancel") });
      } else if (d.event === "ERROR") {
        setMsg({ ok: false, text: t("waOwnError", { msg: d.data?.error_message || "Meta" }) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [t]);

  // El code vence a los 30 s: se manda apenas llega (esperando un toque los ids).
  const terminar = async (code: string) => {
    for (let i = 0; i < 30 && !sesion.current; i++) await new Promise((r) => setTimeout(r, 100));
    const s = sesion.current;
    if (!s) {
      setMsg({ ok: false, text: t("waOwnError", { msg: "Meta no envió el número elegido" }) });
      setOcupado(false);
      return;
    }
    try {
      await whatsappCuentaService.conectar({ code, ...s });
      setMsg({ ok: true, text: t("waOwnDone") });
      await cargar();
      onCambio?.();
    } catch (e) {
      setMsg({ ok: false, text: t("waOwnError", { msg: getApiErrorMessage(e, "error") }) });
    } finally {
      setOcupado(false);
    }
  };

  const conectar = () => {
    if (!fb || !info?.alta) return;
    setMsg(null);
    setOcupado(true);
    sesion.current = null;
    try {
      // Callback normal (no async): el SDK de Meta rechaza funciones async.
      fb.login(
        (resp) => {
          const code = resp?.authResponse?.code;
          if (code) void terminar(code);
          else setOcupado(false);
        },
        {
          config_id: info.alta.configId,
          response_type: "code",
          override_default_response_type: true,
          extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
        },
      );
    } catch {
      setMsg({ ok: false, text: t("waOwnPopup") });
      setOcupado(false);
    }
  };

  const desconectar = async () => {
    if (!(await confirmar({ mensaje: t("waOwnDisconnectAsk"), peligro: true }))) return;
    setOcupado(true);
    try {
      await whatsappCuentaService.desconectar();
      setMsg(null);
      await cargar();
      onCambio?.();
    } catch (e) {
      setMsg({ ok: false, text: getApiErrorMessage(e, "error") });
    } finally {
      setOcupado(false);
    }
  };

  const recrear = async () => {
    setOcupado(true);
    try {
      await whatsappCuentaService.recrearPlantillas();
      await cargar();
    } catch (e) {
      setMsg({ ok: false, text: getApiErrorMessage(e, "error") });
    } finally {
      setOcupado(false);
    }
  };

  if (!info) return null;
  const { cuenta, plantillas, alta } = info;
  const faltan = (plantillas || []).some((p) => p.estado === "FALTA" || p.estado === "REJECTED");
  const btn =
    "cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";

  return (
    <section className="dash-in rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-1)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-fg">{t("waOwnTitle")}</h2>
          {cuenta ? (
            <>
              <p className="mt-1 text-sm font-semibold text-ok">
                {t("waOwnConnected", { tel: cuenta.telefono || "" })}
                {cuenta.nombre_visible ? ` · ${cuenta.nombre_visible}` : ""}
              </p>
              {cuenta.coexistencia && <p className="mt-1 text-sm text-fg-2">{t("waOwnCoexist")}</p>}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-fg-2">{t("waOwnDesc")}</p>
              {info.plataforma && <p className="mt-1 text-sm text-fg-3">{t("waOwnFallback")}</p>}
            </>
          )}
        </div>
        {cuenta ? (
          <button type="button" onClick={desconectar} disabled={ocupado} className={`${btn} border border-line text-fg-2`}>
            {t("waOwnDisconnect")}
          </button>
        ) : (
          alta && (
            <button
              type="button"
              onClick={conectar}
              disabled={ocupado || !fb}
              aria-busy={ocupado}
              className={`${btn} bg-ok text-surface`}
            >
              {ocupado ? t("waOwnConnecting") : t("waOwnConnect")}
            </button>
          )
        )}
      </div>

      {!cuenta && !alta && <p className="mt-3 text-sm text-warn">{t("waOwnUnavailable")}</p>}

      {cuenta && plantillas && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-3">{t("waOwnTemplates")}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {plantillas.map((p) => {
              const e = ESTADO_TPL[p.estado] || ESTADO_TPL.PENDING;
              return (
                <li key={p.nombre} className={`rounded-full px-3 py-1 text-xs font-semibold ${e.cls}`}>
                  {p.nombre} · {t(e.key)}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-fg-3">{t("waOwnTemplatesNote")}</p>
          {faltan && (
            <button type="button" onClick={recrear} disabled={ocupado} className={`${btn} mt-3 border border-line text-fg`}>
              {t("waOwnRetry")}
            </button>
          )}
        </div>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-err"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}
