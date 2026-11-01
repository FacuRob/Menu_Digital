import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { useLang, LangSelector } from "../../lib/i18n";
import { BRAND_NAME, BRAND_LOGO } from "../../lib/brand";
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

type View = "login" | "signup" | "forgot" | "forgot_sent";

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

function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={BRAND_LOGO}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className="inline-block shrink-0 rounded-xl bg-white shadow-lg shadow-cyan-500/10"
      style={{ width: size, height: size }}
    />
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
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

// Panel de marca que se desliza sobre el formulario inactivo (escritorio).
function OverlayContent({
  title,
  desc,
  cta,
  onClick,
  perks,
  toast,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  perks: string[];
  toast?: { title: string; sub: string };
}) {
  return (
    <div className="relative flex h-full flex-col justify-center px-12 py-12 text-white">
      <h2 className="text-4xl font-extrabold leading-tight tracking-tight">{title}</h2>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-200/85">{desc}</p>
      <ul className="mt-7 space-y-3">
        {perks.map((p) => (
          <li key={p} className="flex items-center gap-3 text-sm text-slate-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
              <IconCheck size={13} />
            </span>
            {p}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClick}
        className="mt-9 w-fit cursor-pointer rounded-2xl border border-white/40 bg-white/10 px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:text-slate-900"
      >
        {cta} →
      </button>

      {toast && (
        <div className="auth-float absolute bottom-10 right-10 flex w-60 items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/50 p-3 shadow-2xl backdrop-blur-xl">
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/20 text-lg">
            <span className="auth-ping absolute inset-0 rounded-xl bg-emerald-400/30" />
            🔔
          </span>
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold">{toast.title}</div>
            <div className="truncate text-[11px] text-slate-300">{toast.sub}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const { t } = useLang();
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const { login, setSession } = useAuth();
  const navigate = useNavigate();
  const googleLoginRef = useRef<HTMLDivElement>(null);
  const googleSignupRef = useRef<HTMLDivElement>(null);

  const isSignup = view === "signup";

  const go = (v: View) => {
    setView(v);
    setError("");
    // Mantener la URL en sincronía (recargar conserva la vista).
    const url = new URL(window.location.href);
    if (v === "signup") url.searchParams.set("view", "signup");
    else url.searchParams.delete("view");
    window.history.replaceState(null, "", url);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard");
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
      const res = await authService.google(resp.credential);
      setSession(res.token, res.user);
      // Si Google acaba de crear la cuenta → onboarding; si no, al panel.
      navigate(res.nuevo ? "/admin/onboarding" : "/admin/dashboard");
    } catch (err) {
      setError(errMsg(err, t("errRequest")));
    } finally {
      setLoading(false);
    }
  };

  // Carga GIS y renderiza el botón de Google en login y en registro
  // (los dos formularios están montados a la vez para poder animarlos).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const render = () => {
      const g = gsi();
      if (!g) return;
      g.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogle });
      [googleLoginRef.current, googleSignupRef.current].forEach((el) => {
        if (!el) return;
        el.innerHTML = "";
        g.renderButton(el, {
          theme: "filled_black",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: 320,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Piezas reutilizables ──
  const spinner = (
    <span
      className="inline-block h-4 w-4 rounded-full border-2 border-slate-900/25 border-t-slate-900"
      style={{ animation: "spin 0.7s linear infinite" }}
    />
  );

  const errorBox = (show: boolean) =>
    show && error ? (
      <div className="auth-fade-up flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">
        <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
      </div>
    ) : null;

  const primaryBtn =
    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:shadow-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

  const googleBlock = (ref: React.RefObject<HTMLDivElement | null>) =>
    GOOGLE_CLIENT_ID ? (
      <>
        <div ref={ref} className="flex min-h-[44px] justify-center" />
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          {t("authOr")}
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </>
    ) : null;

  // Pestañas con indicador deslizante (sólo móvil; en escritorio está el panel).
  const tabs = (
    <div className="relative mb-7 flex rounded-xl border border-white/10 bg-white/[0.03] p-1 min-[900px]:hidden">
      <span
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-r from-cyan-400/90 to-teal-300/90 shadow transition-transform duration-500"
        style={{
          transform: isSignup ? "translateX(100%)" : "translateX(0)",
          transitionTimingFunction: "cubic-bezier(.7,0,.2,1)",
        }}
      />
      {(["login", "signup"] as const).map((v) => {
        const active = v === "signup" ? isSignup : !isSignup;
        return (
          <button
            key={v}
            type="button"
            onClick={() => go(v)}
            aria-pressed={active}
            className={`relative z-10 flex-1 cursor-pointer rounded-lg py-2 text-[13px] font-semibold transition-colors ${
              active ? "text-slate-950" : "text-slate-400"
            }`}
          >
            {v === "login" ? t("authTabLogin") : t("authTabSignup")}
          </button>
        );
      })}
    </div>
  );

  const panelBase = "flex flex-col justify-center px-6 py-10 sm:px-12 min-[900px]:py-12";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] font-[Inter,system-ui,sans-serif] text-slate-200 antialiased">
      {/* Fondo */}
      <div className="auth-grid-bg pointer-events-none fixed inset-0" />
      {/* Manchas de luz con degradado radial (sin filtro blur: liviano en celulares). */}
      <div
        className="auth-blob auth-glow pointer-events-none fixed -left-64 -top-24 h-[720px] w-[720px]"
        style={{ ["--glow" as string]: "rgba(6,182,212,0.22)" }}
      />
      <div
        className="auth-blob auth-glow pointer-events-none fixed -bottom-32 -right-56 h-[760px] w-[760px]"
        style={{ ["--glow" as string]: "rgba(245,158,11,0.16)", animationDelay: "-7s" }}
      />

      {/* Barra superior */}
      <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <a href={SITE_URL} className="flex items-center gap-2.5">
          <BrandMark size={36} />
          <span className="text-lg font-bold tracking-tight text-white">{BRAND_NAME}</span>
        </a>
        <div className="flex items-center gap-3">
          <a
            href={SITE_URL}
            className="hidden rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white sm:inline"
          >
            ← {t("authBackSite")}
          </a>
          <LangSelector isDark />
        </div>
      </header>

      <main className="relative z-10 flex items-center justify-center px-4 pb-12 pt-2 sm:px-6 min-[900px]:min-h-[calc(100vh-88px)] min-[900px]:pb-16">
        <div
          className={`auth-shell w-full max-w-[460px] rounded-[28px] border border-white/10 bg-[#0a0f1c]/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)] min-[900px]:max-w-[1000px] min-[900px]:bg-[#0a0f1c]/85 min-[900px]:backdrop-blur-xl ${
            isSignup ? "is-signup" : ""
          }`}
        >
          {/* ── LOGIN (+ recuperar contraseña) ── */}
          <section className={`auth-panel auth-login ${panelBase}`} inert={isSignup}>
            {tabs}

            {view !== "forgot" && view !== "forgot_sent" && (
              <form key="login" onSubmit={handleLogin} className="auth-fade-up flex flex-col gap-4">
                <div className="mb-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white">{t("authLoginTitle")}</h1>
                  <p className="mt-1.5 text-sm text-slate-400">{t("loginSubtitle")}</p>
                </div>

                {googleBlock(googleLoginRef)}

                <Field label={t("user")} icon={<IcUser />}>
                  <input
                    className="auth-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                    placeholder={t("userPlaceholder")}
                  />
                </Field>

                <Field label={t("password")} icon={<IconLock size={17} />}>
                  <input
                    className="auth-input pr-11"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors hover:text-slate-200"
                  >
                    {showPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </Field>

                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => go("forgot")}
                    className="cursor-pointer text-[13px] font-medium text-cyan-300/90 transition-colors hover:text-cyan-200"
                  >
                    {t("forgotLink")}
                  </button>
                </div>

                {errorBox(!isSignup)}

                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading && spinner}
                  {loading ? t("signingIn") : t("signIn")}
                </button>

                <p className="mt-2 text-center text-[13px] text-slate-500 min-[900px]:hidden">
                  <button
                    type="button"
                    onClick={() => go("signup")}
                    className="cursor-pointer font-semibold text-cyan-300"
                  >
                    {t("authToSignup")}
                  </button>
                </p>
              </form>
            )}

            {view === "forgot" && (
              <form key="forgot" onSubmit={handleForgot} className="auth-fade-up flex flex-col gap-4">
                <div className="mb-2">
                  <h1 className="text-3xl font-extrabold tracking-tight text-white">{t("forgotSubtitle")}</h1>
                </div>
                <div className="flex gap-2.5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.06] px-3.5 py-3 text-[13px] leading-relaxed text-slate-300">
                  <IconInfo size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  {t("forgotInfo")}
                </div>
                <Field label={t("yourUser")} icon={<IcUser />}>
                  <input
                    className="auth-input"
                    type="text"
                    value={forgotUser}
                    onChange={(e) => setForgotUser(e.target.value)}
                    required
                    placeholder={t("userPlaceholder")}
                  />
                </Field>

                {errorBox(true)}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => go("login")}
                    className="flex-1 cursor-pointer rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
                  >
                    ← {t("back")}
                  </button>
                  <button type="submit" disabled={loading} className={`${primaryBtn} flex-1`}>
                    {loading && spinner}
                    {loading ? t("sending") : t("send")}
                  </button>
                </div>
              </form>
            )}

            {view === "forgot_sent" && (
              <div key="sent" className="auth-fade-up flex flex-col items-center gap-4 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                  <IconCheck size={30} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{t("emailSent")}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t("emailSentDesc")}</p>
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
          <section className={`auth-panel auth-signup ${panelBase}`} inert={!isSignup}>
            {tabs}
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="mb-2">
                <h1 className="text-3xl font-extrabold tracking-tight text-white">{t("authSignupTitle")}</h1>
                <p className="mt-1.5 text-sm text-slate-400">{t("authSignupSubtitle")}</p>
              </div>

              {googleBlock(googleSignupRef)}

              <Field label={t("authBusiness")} icon={<IcStore />}>
                <input
                  className="auth-input"
                  type="text"
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("authEmailPh")}
                />
              </Field>
              <Field label={t("password")} icon={<IconLock size={17} />}>
                <input
                  className="auth-input pr-11"
                  type={showSignupPwd ? "text" : "password"}
                  value={signupPwd}
                  onChange={(e) => setSignupPwd(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPwd(!showSignupPwd)}
                  aria-label={showSignupPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 transition-colors hover:text-slate-200"
                >
                  {showSignupPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                </button>
              </Field>

              {errorBox(isSignup)}

              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading && spinner}
                {loading ? t("authCreating") : t("authCreateBtn")}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <IconSparkle size={13} /> {t("authTrialNote")}
              </p>

              <p className="text-center text-[13px] text-slate-500 min-[900px]:hidden">
                <button
                  type="button"
                  onClick={() => go("login")}
                  className="cursor-pointer font-semibold text-cyan-300"
                >
                  {t("authToLogin")}
                </button>
              </p>
            </form>
          </section>

          {/* ── Panel de marca deslizante (escritorio) ── */}
          <div className="auth-overlay">
            <div className="auth-overlay-inner bg-gradient-to-br from-cyan-500 via-teal-600 to-indigo-700">
              <div className="auth-grid-bg pointer-events-none absolute inset-0 opacity-70" />
              <div
                className="auth-blob auth-glow pointer-events-none absolute -left-40 -top-6 h-[30rem] w-[30rem]"
                style={{ ["--glow" as string]: "rgba(103,232,249,0.40)" }}
              />
              <div
                className="auth-blob auth-glow pointer-events-none absolute -bottom-40 right-[10%] h-[30rem] w-[30rem]"
                style={{ ["--glow" as string]: "rgba(252,211,77,0.35)", animationDelay: "-9s" }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-slate-950/40" />

              {/* Visible en REGISTRO: invita a volver al login */}
              <div className="auth-overlay-panel auth-ov-left">
                <OverlayContent
                  title={t("authOvBackTitle")}
                  desc={t("authOvBackDesc")}
                  cta={t("authTabLogin")}
                  onClick={() => go("login")}
                  perks={[t("authOvPerk2"), t("authOvPerk3")]}
                />
              </div>

              {/* Visible en LOGIN: invita a crear cuenta */}
              <div className="auth-overlay-panel auth-ov-right">
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
      </main>
    </div>
  );
}
