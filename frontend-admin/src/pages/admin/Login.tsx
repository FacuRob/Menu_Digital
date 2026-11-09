import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService, pide2fa, type LoginResponse, type Requiere2fa } from "../../services/api";
import { useLang, LangSelector } from "../../lib/i18n";
import { BRAND_NAME } from "../../lib/brand";
import "@fontsource-variable/archivo/wdth.css";
import { MENU_PREVIEW_BASE } from "../../lib/menuUrl";
import {
  IconEye,
  IconEyeOff,
  IconAlert,
  IconInfo,
  IconCheck,
  IconSparkle,
  IconLock,
} from "../../lib/icons";

type View = "login" | "signup" | "forgot" | "forgot_sent" | "2fa";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

// Landing pública (vive en el mismo frontend que el menú).
const SITE_URL = `${MENU_PREVIEW_BASE}/`;

type GoogleId = {
  initialize: (o: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
const gsi = () =>
  (window as unknown as { google?: { accounts?: { id?: GoogleId } } }).google?.accounts?.id;

const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// ── Íconos chicos para los campos ─────────────────────────────
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 17,
  height: 17,
};
const IcUser = () => (
  <svg {...svgProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
  </svg>
);
const IcMail = () => (
  <svg {...svgProps}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);
const IcStore = () => (
  <svg {...svgProps}>
    <path d="M4 9.5 5.5 4h13L20 9.5" />
    <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
    <path d="M5 11v9h14v-9M10 20v-5h4v5" />
  </svg>
);

// Logo de la landing: globo de chat con QR sobre ají.
function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#ff5b24" />
      <path d="M7 9.5A2.5 2.5 0 019.5 7h13A2.5 2.5 0 0125 9.5v9a2.5 2.5 0 01-2.5 2.5H13l-4.6 3.8a.6.6 0 01-1-.5V21A2.5 2.5 0 017 18.5z" fill="#111216" />
      <rect x="10.5" y="10" width="4" height="4" rx="1" fill="#efede6" />
      <rect x="17.5" y="10" width="4" height="4" rx="1" fill="#efede6" />
      <rect x="10.5" y="15" width="4" height="3" rx="1" fill="#efede6" />
      <rect x="18" y="15.5" width="2" height="2" rx=".5" fill="#ff5b24" />
    </svg>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="hp-label mb-1.5 block text-[var(--gris)]">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gris)]">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

// Panel de color que se desliza sobre el formulario inactivo (escritorio).
// Cada pieza entra escalonada (--i) cuando su panel queda a la vista.
function OverlayContent({
  title,
  desc,
  cta,
  onClick,
  perks,
  oscuro,
  toast,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  perks: string[];
  oscuro?: boolean;
  toast?: { title: string; sub: string };
}) {
  const item = (i: number) => ({ ["--i" as string]: i });
  return (
    <div
      className={`relative flex h-full flex-col justify-center px-12 py-8 ${
        oscuro ? "hp-sobre-oscuro text-[var(--hueso)]" : "hp-sobre-aji text-[var(--tinta)]"
      }`}
    >
      <h2 className="hp-ov-item hp-display text-[clamp(2rem,min(3.6vw,6svh),3.25rem)]" style={item(0)}>
        {title}
      </h2>
      <p className="hp-ov-item mt-4 max-w-sm text-base leading-relaxed" style={item(1)}>
        {desc}
      </p>
      <ul className="mt-6 space-y-2.5">
        {perks.map((p, i) => (
          <li key={p} className="hp-ov-item flex items-center gap-3 font-medium" style={item(i + 2)}>
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                oscuro ? "bg-[var(--aji)] text-[var(--tinta)]" : "bg-[var(--tinta)] text-[var(--aji)]"
              }`}
            >
              <IconCheck size={14} />
            </span>
            {p}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClick}
        className={`hp-ov-item hp-btn mt-8 w-fit ${oscuro ? "" : "hp-btn-oscuro"}`}
        style={item(perks.length + 2)}
      >
        {cta}
        <span aria-hidden className="hp-btn-flecha">→</span>
      </button>

      {toast && (
        <div
          className="hp-ov-item hp-ov-toast absolute bottom-8 right-8 flex items-center gap-3 rounded-full bg-[var(--tinta)] py-2.5 pl-2.5 pr-5 text-[var(--hueso)]"
          style={item(perks.length + 3)}
          aria-hidden
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-[var(--aji)]">
            <span className="auth-ping absolute inset-0 rounded-full bg-[var(--aji)]" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-[var(--tinta)]" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-bold">{toast.title}</div>
            <div className="text-xs text-[var(--gris-claro)]">{toast.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const { t, lang } = useLang();
  // ?view=signup abre directo el registro (lo usa la landing pública).
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get("view") === "signup"
      ? "signup"
      : "login",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // Signup
  const [negocio, setNegocio] = useState("");
  const [email, setEmail] = useState("");
  const [signupPwd, setSignupPwd] = useState("");
  // Forgot
  const [forgotUser, setForgotUser] = useState("");
  // 2º paso (verificación en dos pasos)
  const [desafio, setDesafio] = useState("");
  const [codigo2fa, setCodigo2fa] = useState("");
  const codigoRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const googleLoginRef = useRef<HTMLDivElement>(null);
  const googleSignupRef = useRef<HTMLDivElement>(null);
  // Foco al cambiar de vista (teclado y lectores de pantalla).
  const loginUserRef = useRef<HTMLInputElement>(null);
  const signupNegocioRef = useRef<HTMLInputElement>(null);
  const forgotUserRef = useRef<HTMLInputElement>(null);
  const forgotLinkRef = useRef<HTMLButtonElement>(null);
  const sentTitleRef = useRef<HTMLHeadingElement>(null);
  const vistaAnterior = useRef<View | null>(null);

  const isSignup = view === "signup";

  // Al cambiar de vista, el foco va al primer campo de la nueva (no en la
  // primera carga). En escritorio espera a que el bloque de color la destape.
  useEffect(() => {
    const antes = vistaAnterior.current;
    vistaAnterior.current = view;
    if (antes === null) return;
    const destino =
      view === "signup"
        ? signupNegocioRef.current
        : view === "forgot"
          ? forgotUserRef.current
          : view === "forgot_sent"
            ? sentTitleRef.current
            : view === "2fa"
              ? codigoRef.current
            : antes === "forgot"
              ? forgotLinkRef.current
              : loginUserRef.current;
    const desliza =
      (view === "signup" || antes === "signup") &&
      window.matchMedia("(min-width: 900px) and (prefers-reduced-motion: no-preference)").matches;
    const id = window.setTimeout(() => destino?.focus({ preventScroll: true }), desliza ? 380 : 0);
    return () => window.clearTimeout(id);
  }, [view]);

  const go = (v: View) => {
    setView(v);
    setError("");
    // Mantener la URL en sincronía (recargar conserva la vista).
    const url = new URL(window.location.href);
    if (v === "signup") url.searchParams.set("view", "signup");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  // Respuesta de /login o /google: sesión directa, o pedir el código de 2FA.
  const entrar = (res: LoginResponse | Requiere2fa) => {
    if (pide2fa(res)) {
      setDesafio(res.desafio);
      setCodigo2fa("");
      go("2fa");
      return;
    }
    setSession(res.token, res.user);
    // Si Google acaba de crear la cuenta → onboarding; si no, al panel.
    navigate(res.nuevo ? "/admin/onboarding" : "/admin/dashboard");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      entrar(await authService.login(username, password));
    } catch (err) {
      setError(errMsg(err, t("errInvalidCreds")));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authService.signup(negocio, email, signupPwd);
      setSession(res.token, res.user);
      // Cuenta recién creada → onboarding (calibración inicial del negocio).
      navigate(res.nuevo ? "/admin/onboarding" : "/admin/dashboard");
    } catch (err) {
      setError(errMsg(err, t("errRequest")));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.forgotPassword(forgotUser);
      setView("forgot_sent");
    } catch (err) {
      setError(errMsg(err, t("errRequest")));
    } finally {
      setLoading(false);
    }
  };

  // Callback de Google Identity Services con el ID token.
  const onGoogle = async (resp: { credential?: string }) => {
    if (!resp?.credential) return;
    setError("");
    setLoading(true);
    try {
      entrar(await authService.google(resp.credential));
    } catch (err) {
      setError(errMsg(err, t("errRequest")));
    } finally {
      setLoading(false);
    }
  };

  const handle2fa = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authService.verificar2fa(desafio, codigo2fa);
      setSession(res.token, res.user);
      navigate("/admin/dashboard");
    } catch (err) {
      setError(errMsg(err, t("tfaErr")));
    } finally {
      setLoading(false);
    }
  };

  const onGoogleRef = useRef(onGoogle);
  useEffect(() => {
    onGoogleRef.current = onGoogle;
  });

  // Carga GIS y renderiza el botón de Google en login y en registro
  // (los dos formularios están montados a la vez para poder animarlos).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const render = () => {
      const g = gsi();
      if (!g) return;
      g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onGoogleRef.current(r) });
      [googleLoginRef.current, googleSignupRef.current].forEach((el) => {
        if (!el) return;
        el.innerHTML = "";
        g.renderButton(el, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.min(320, el.clientWidth || 320),
          locale: lang,
        });
      });
    };

    if (gsi()) {
      render();
      return;
    }
    let s = document.getElementById("gsi-script") as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.id = "gsi-script";
      document.head.appendChild(s);
    }
    s.addEventListener("load", render);
    return () => s?.removeEventListener("load", render);
  }, [lang]);

  // ── Piezas reutilizables ──
  const spinner = (
    <span
      aria-hidden
      className="inline-block h-4 w-4 rounded-full border-2 border-current/25 border-t-current"
      style={{ animation: "spin 0.7s linear infinite" }}
    />
  );

  const errorBox = (show: boolean, id: string) =>
    show && error ? (
      <div
        id={id}
        role="alert"
        className="auth-fade-up flex items-center gap-2 rounded-2xl bg-[var(--error-bg)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--error)]"
      >
        <IconAlert size={16} style={{ flexShrink: 0 }} /> {error}
      </div>
    ) : null;

  const primaryBtn = "hp-btn w-full";

  const googleBlock = (ref: React.RefObject<HTMLDivElement | null>) =>
    GOOGLE_CLIENT_ID ? (
      <>
        <div ref={ref} className="flex min-h-[40px] justify-center" />
        <div className="flex items-center gap-3 text-sm text-[var(--gris)]">
          <span className="h-0.5 flex-1 rounded bg-[var(--tinta)]/10" />
          {t("authOr")}
          <span className="h-0.5 flex-1 rounded bg-[var(--tinta)]/10" />
        </div>
      </>
    ) : null;

  // Pestañas con indicador deslizante (sólo móvil; en escritorio está el panel).
  const tabs = (
    <div role="tablist" aria-label={`${t("authTabLogin")} / ${t("authTabSignup")}`} className="relative flex rounded-full bg-[var(--hueso)] p-1">
      <span
        aria-hidden
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full transition-[transform,background-color] duration-500"
        style={{
          transform: isSignup ? "translateX(100%)" : "translateX(0)",
          backgroundColor: isSignup ? "var(--tinta)" : "var(--aji)",
          transitionTimingFunction: "var(--auth-ease)",
        }}
      />
      {(["login", "signup"] as const).map((v) => {
        const active = v === "signup" ? isSignup : !isSignup;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            id={`tab-${v}`}
            aria-selected={active}
            aria-controls={`panel-${v}`}
            onClick={() => go(v)}
            className={`relative z-10 min-h-11 flex-1 cursor-pointer rounded-full text-[0.9375rem] font-bold transition-colors duration-300 ${
              active ? (v === "signup" ? "text-[var(--hueso)]" : "text-[var(--tinta)]") : "text-[var(--gris)]"
            }`}
          >
            {v === "login" ? t("authTabLogin") : t("authTabSignup")}
          </button>
        );
      })}
    </div>
  );

  const linkBase =
    "cursor-pointer font-semibold text-[var(--tinta)] decoration-[1.5px] underline-offset-4 transition-colors hover:text-[var(--cobalto)]";
  const linkBtn = `${linkBase} underline`;

  const panelBase = "flex flex-col justify-center px-5 pb-6 pt-5 sm:px-10 min-[900px]:px-12 min-[900px]:py-8";
  const titulo = "hp-display text-[clamp(1.875rem,min(3.4vw,5.6svh),2.75rem)]";

  return (
    <div className="hp relative min-h-screen overflow-x-hidden">
      {/* Barra superior */}
      <header className="relative z-20 mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:h-16 sm:px-6">
        <a href={SITE_URL} className="flex items-center gap-2.5 rounded-lg">
          <LogoMark size={30} />
          <span className="hp-display text-[1.25rem] lowercase">{BRAND_NAME}</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-4">
          <a href={SITE_URL} className={`hidden rounded-lg px-2 py-2 text-[0.9375rem] sm:inline ${linkBase} hover:underline`}>
            ← {t("authBackSite")}
          </a>
          <LangSelector variant="hp" />
        </div>
      </header>

      <main className="relative z-10 flex items-start justify-center px-3 pb-3 sm:px-6 sm:pb-6 min-[900px]:h-[calc(100svh-4rem)] min-[900px]:min-h-[34rem] min-[900px]:items-center">
        <div className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-[24px] bg-white min-[900px]:h-full min-[900px]:max-h-[40rem] min-[900px]:max-w-[1000px] min-[900px]:rounded-[28px]">
        {/* Pestañas (sólo celular; en escritorio está el bloque de color). */}
        <div className="px-5 pt-5 sm:px-10 min-[900px]:hidden">{tabs}</div>
        <div className={`auth-shell min-h-0 flex-1 ${isSignup ? "is-signup" : ""}`}>
          {/* ── LOGIN (+ recuperar contraseña) ── */}
          <section id="panel-login" role="tabpanel" aria-labelledby="tab-login" className={`auth-panel auth-login ${panelBase}`} inert={isSignup}>

            {view !== "forgot" && view !== "forgot_sent" && view !== "2fa" && (
              <form key="login" onSubmit={handleLogin} aria-busy={loading} className="auth-fade-up flex flex-col gap-[clamp(0.75rem,1.9svh,1.125rem)]">
                <div>
                  <h1 className={titulo}>{t("authLoginTitle")}</h1>
                  <p className="mt-2 text-base text-[var(--gris)]">{t("loginSubtitle")}</p>
                </div>

                {googleBlock(googleLoginRef)}

                <Field label={t("user")} icon={<IcUser />}>
                  <input
                    ref={loginUserRef}
                    className="auth-input"
                    type="text"
                    name="username"
                    aria-invalid={!isSignup && !!error}
                    aria-describedby={!isSignup && error ? "err-login" : undefined}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder={t("userPlaceholder")}
                  />
                </Field>

                <Field label={t("password")} icon={<IconLock size={17} />}>
                  <input
                    className="auth-input pr-12"
                    type={showPwd ? "text" : "password"}
                    name="password"
                    aria-invalid={!isSignup && !!error}
                    aria-describedby={!isSignup && error ? "err-login" : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={t("showPwd")}
                    aria-pressed={showPwd}
                    className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[var(--gris)] transition-colors hover:text-[var(--tinta)]"
                  >
                    {showPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </Field>

                <div className="-mt-1 flex justify-end">
                  <button ref={forgotLinkRef} type="button" onClick={() => go("forgot")} className={`text-[0.9375rem] ${linkBtn}`}>
                    {t("forgotLink")}
                  </button>
                </div>

                {errorBox(!isSignup, "err-login")}

                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading && spinner}
                  {loading ? t("signingIn") : t("signIn")}
                </button>
              </form>
            )}

            {view === "2fa" && (
              <form key="2fa" onSubmit={handle2fa} aria-busy={loading} className="auth-fade-up flex flex-col gap-[clamp(0.75rem,1.9svh,1.125rem)]">
                <h1 className={titulo}>{t("tfaTitle")}</h1>
                <div className="flex gap-3 rounded-2xl bg-[var(--hueso)] px-4 py-3.5 text-[0.9375rem] leading-relaxed">
                  <IconInfo size={17} style={{ flexShrink: 0, marginTop: 3, color: "var(--cobalto)" }} />
                  {t("tfaInfo")}
                </div>
                <Field label={t("tfaCode")} icon={<IconLock size={17} />}>
                  <input
                    ref={codigoRef}
                    className="auth-input tracking-[0.2em]"
                    type="text"
                    name="one-time-code"
                    inputMode="text"
                    autoComplete="one-time-code"
                    aria-invalid={!!error}
                    aria-describedby={error ? "err-2fa" : undefined}
                    value={codigo2fa}
                    onChange={(e) => setCodigo2fa(e.target.value.slice(0, 20))}
                    required
                    placeholder="123456"
                  />
                </Field>

                {errorBox(true, "err-2fa")}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => go("login")} className="hp-btn-borde sm:flex-1">
                    ← {t("back")}
                  </button>
                  <button type="submit" disabled={loading} className="hp-btn sm:flex-1">
                    {loading && spinner}
                    {loading ? t("tfaVerifying") : t("tfaVerify")}
                  </button>
                </div>
              </form>
            )}

            {view === "forgot" && (
              <form key="forgot" onSubmit={handleForgot} aria-busy={loading} className="auth-fade-up flex flex-col gap-[clamp(0.75rem,1.9svh,1.125rem)]">
                <h1 className={titulo}>{t("forgotSubtitle")}</h1>
                <div className="flex gap-3 rounded-2xl bg-[var(--hueso)] px-4 py-3.5 text-[0.9375rem] leading-relaxed">
                  <IconInfo size={17} style={{ flexShrink: 0, marginTop: 3, color: "var(--cobalto)" }} />
                  {t("forgotInfo")}
                </div>
                <Field label={t("yourUser")} icon={<IcUser />}>
                  <input
                    ref={forgotUserRef}
                    className="auth-input"
                    type="text"
                    name="username"
                    autoComplete="username"
                    aria-invalid={!!error}
                    aria-describedby={error ? "err-forgot" : undefined}
                    value={forgotUser}
                    onChange={(e) => setForgotUser(e.target.value)}
                    required
                    placeholder={t("userPlaceholder")}
                  />
                </Field>

                {errorBox(true, "err-forgot")}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={() => go("login")} className="hp-btn-borde sm:flex-1">
                    ← {t("back")}
                  </button>
                  <button type="submit" disabled={loading} className="hp-btn sm:flex-1">
                    {loading && spinner}
                    {loading ? t("sending") : t("send")}
                  </button>
                </div>
              </form>
            )}

            {view === "forgot_sent" && (
              <div key="sent" role="status" className="auth-fade-up flex flex-col items-center gap-5 text-center">
                <div aria-hidden className="grid h-16 w-16 place-items-center rounded-full bg-[var(--tinta)] text-[var(--aji)]">
                  <IconCheck size={30} />
                </div>
                <div>
                  <h1 ref={sentTitleRef} tabIndex={-1} className="hp-display text-[1.75rem] outline-none">
                    {t("emailSent")}
                  </h1>
                  <p className="mt-2 leading-relaxed text-[var(--gris)]">{t("emailSentDesc")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    go("login");
                    setForgotUser("");
                  }}
                  className={primaryBtn}
                >
                  {t("backToLogin")}
                </button>
              </div>
            )}
          </section>

          {/* ── REGISTRO ── */}
          <section id="panel-signup" role="tabpanel" aria-labelledby="tab-signup" className={`auth-panel auth-signup ${panelBase}`} inert={!isSignup}>
            <form onSubmit={handleSignup} aria-busy={loading} className="flex flex-col gap-[clamp(0.75rem,1.9svh,1.125rem)]">
              <div>
                <h1 className={titulo}>{t("authSignupTitle")}</h1>
                <p className="mt-2 text-base text-[var(--gris)]">{t("authSignupSubtitle")}</p>
              </div>

              {googleBlock(googleSignupRef)}

              <Field label={t("authBusiness")} icon={<IcStore />}>
                <input
                  ref={signupNegocioRef}
                  className="auth-input"
                  type="text"
                  name="negocio"
                  autoComplete="organization"
                  aria-invalid={isSignup && !!error}
                  aria-describedby={isSignup && error ? "err-signup" : undefined}
                  value={negocio}
                  onChange={(e) => setNegocio(e.target.value)}
                  required
                  placeholder={t("authBusinessPh")}
                />
              </Field>
              <Field label={t("authEmail")} icon={<IcMail />}>
                <input
                  className="auth-input"
                  type="email"
                  name="email"
                  aria-invalid={isSignup && !!error}
                  aria-describedby={isSignup && error ? "err-signup" : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("authEmailPh")}
                />
              </Field>
              <Field label={t("password")} icon={<IconLock size={17} />}>
                <input
                  className="auth-input pr-12"
                  type={showSignupPwd ? "text" : "password"}
                  value={signupPwd}
                  onChange={(e) => setSignupPwd(e.target.value)}
                  required
                  minLength={8}
                  name="new-password"
                  autoComplete="new-password"
                  aria-invalid={isSignup && !!error}
                  aria-describedby={`pwd-hint${isSignup && error ? " err-signup" : ""}`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPwd(!showSignupPwd)}
                  aria-label={t("showPwd")}
                  aria-pressed={showSignupPwd}
                  className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[var(--gris)] transition-colors hover:text-[var(--tinta)]"
                >
                  {showSignupPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </Field>
              <p id="pwd-hint" className="-mt-2 text-sm text-[var(--gris)]">
                {t("min8")}
              </p>

              {errorBox(isSignup, "err-signup")}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading && spinner}
                {loading ? t("authCreating") : t("authCreateBtn")}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[0.9375rem] text-[var(--gris)]">
                <IconSparkle size={14} /> {t("authTrialNote")}
              </p>
            </form>
          </section>

          {/* ── Panel de color deslizante (escritorio): ají en login, tinta en registro ── */}
          <div className="auth-overlay">
            <div className="auth-overlay-inner">
              {/* Visible en REGISTRO: invita a volver al login */}
              <div className="auth-overlay-panel auth-ov-left" inert={!isSignup}>
                <OverlayContent
                  oscuro
                  title={t("authOvBackTitle")}
                  desc={t("authOvBackDesc")}
                  cta={t("authTabLogin")}
                  onClick={() => go("login")}
                  perks={[t("authOvPerk2"), t("authOvPerk3")]}
                />
              </div>

              {/* Visible en LOGIN: invita a crear cuenta */}
              <div className="auth-overlay-panel auth-ov-right" inert={isSignup}>
                <OverlayContent
                  title={t("authOvNewTitle")}
                  desc={t("authOvNewDesc")}
                  cta={t("authTabSignup")}
                  onClick={() => go("signup")}
                  perks={[t("authOvPerk1"), t("authOvPerk2"), t("authOvPerk3")]}
                  toast={{ title: t("authOvToast"), sub: t("authOvToastSub") }}
                />
              </div>
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
