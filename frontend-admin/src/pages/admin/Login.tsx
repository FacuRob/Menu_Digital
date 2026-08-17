import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import { useLang, LangSelector } from "../../lib/i18n";
import { BRAND_NAME, BRAND_GRADIENT, brandTextStyle } from "../../lib/brand";
import {
  IconEye,
  IconEyeOff,
  IconAlert,
  IconInfo,
  IconCheck,
  IconSparkle,
} from "../../lib/icons";

type View = "login" | "signup" | "forgot" | "forgot_sent";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as
  | string
  | undefined;

export default function Login() {
  const { t } = useLang();
  const [view, setView] = useState<View>("login");
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
  const { login, setSession } = useAuth();
  const navigate = useNavigate();
  const googleRef = useRef<HTMLDivElement>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || t("errInvalidCreds"));
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
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || t("errRequest"));
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
    } catch (err: any) {
      setError(err.response?.data?.message || t("errRequest"));
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
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || t("errRequest"));
    } finally {
      setLoading(false);
    }
  };

  // Carga GIS y renderiza el botón de Google en las vistas login/signup.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    if (view !== "login" && view !== "signup") return;

    const render = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id || !googleRef.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onGoogle,
      });
      googleRef.current.innerHTML = "";
      g.accounts.id.renderButton(googleRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 332,
      });
    };

    if ((window as any).google?.accounts?.id) {
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
  }, [view]);

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  const label: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 7,
  };
  const focusOn = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "#6366f1");
  const focusOff = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "rgba(255,255,255,0.08)");

  const primaryBtn: React.CSSProperties = {
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    background: BRAND_GRADIENT,
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: loading ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    opacity: loading ? 0.7 : 1,
  };

  const spinner = (
    <div
      style={{
        width: 16,
        height: 16,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );

  const errorBox = error && (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 8,
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.2)",
        color: "#f87171",
        fontSize: 13,
      }}
    >
      <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
    </div>
  );

  // Bloque de Google + separador (login/signup).
  const googleBlock = GOOGLE_CLIENT_ID && (
    <>
      <div ref={googleRef} style={{ display: "flex", justifyContent: "center" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "2px 0" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span style={{ color: "#475569", fontSize: 12 }}>{t("authOr")}</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>
    </>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      <div style={{ position: "fixed", top: 18, right: 20, zIndex: 10 }}>
        <LangSelector isDark />
      </div>

      {/* Glow de fondo con los colores de marca */}
      <div
        style={{
          position: "fixed",
          top: "18%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 520,
          height: 320,
          background:
            "radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,rgba(6,182,212,0.06) 45%,transparent 72%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
        {/* Marca */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 15,
              background: BRAND_GRADIENT,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              color: "#fff",
              margin: "0 auto 14px",
              boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
            }}
          >
            D
          </div>
          <h1 style={{ ...brandTextStyle, fontSize: 26, fontWeight: 800, margin: "0 0 4px" }}>
            {BRAND_NAME}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            {view === "signup"
              ? t("authSignupSubtitle")
              : view === "login"
                ? t("loginSubtitle")
                : t("forgotSubtitle")}
          </p>
        </div>

        <div
          style={{
            background: "#1a1d27",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "26px 24px",
          }}
        >
          {/* Tabs login / signup */}
          {(view === "login" || view === "signup") && (
            <div
              style={{
                display: "flex",
                background: "#0f1117",
                borderRadius: 10,
                padding: 3,
                marginBottom: 20,
              }}
            >
              {(["login", "signup"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    setError("");
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    background: view === v ? "#1a1d27" : "transparent",
                    color: view === v ? "#f1f5f9" : "#475569",
                    boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                  }}
                >
                  {v === "login" ? t("authTabLogin") : t("authTabSignup")}
                </button>
              ))}
            </div>
          )}

          {/* ── LOGIN ── */}
          {view === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {googleBlock}
              <div>
                <label style={label}>{t("user")}</label>
                <input
                  style={inp}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder={t("userPlaceholder")}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
              <div>
                <label style={label}>{t("password")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={inp}
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#475569",
                      fontSize: 14,
                    }}
                  >
                    {showPwd ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </div>
              </div>

              {errorBox}

              <button type="submit" disabled={loading} style={primaryBtn}>
                {loading && spinner}
                {loading ? t("signingIn") : t("signIn")}
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("forgot");
                  setError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                  marginTop: -4,
                }}
              >
                {t("forgotLink")}
              </button>
            </form>
          )}

          {/* ── SIGNUP ── */}
          {view === "signup" && (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {googleBlock}
              <div>
                <label style={label}>{t("authBusiness")}</label>
                <input
                  style={inp}
                  type="text"
                  value={negocio}
                  onChange={(e) => setNegocio(e.target.value)}
                  required
                  placeholder={t("authBusinessPh")}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
              <div>
                <label style={label}>{t("authEmail")}</label>
                <input
                  style={inp}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("authEmailPh")}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>
              <div>
                <label style={label}>{t("password")}</label>
                <input
                  style={inp}
                  type="password"
                  value={signupPwd}
                  onChange={(e) => setSignupPwd(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              {errorBox}

              <button type="submit" disabled={loading} style={primaryBtn}>
                {loading && spinner}
                {loading ? t("authCreating") : t("authCreateBtn")}
              </button>
              <p style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, color: "#475569", fontSize: 12, margin: "-2px 0 0" }}>
                <IconSparkle size={13} /> {t("authTrialNote")}
              </p>
            </form>
          )}

          {/* ── FORGOT ── */}
          {view === "forgot" && (
            <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.07)",
                  border: "1px solid rgba(99,102,241,0.15)",
                  color: "#94a3b8",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
<IconInfo size={15} style={{ flexShrink: 0, marginRight: 6, verticalAlign: "-2px" }} />
                {t("forgotInfo")}
              </div>
              <div>
                <label style={label}>{t("yourUser")}</label>
                <input
                  style={inp}
                  type="text"
                  value={forgotUser}
                  onChange={(e) => setForgotUser(e.target.value)}
                  required
                  placeholder={t("userPlaceholder")}
                  onFocus={focusOn}
                  onBlur={focusOff}
                />
              </div>

              {errorBox}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setError("");
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#94a3b8",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  ← {t("back")}
                </button>
                <button type="submit" disabled={loading} style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>
                  {loading && spinner}
                  {loading ? t("sending") : t("send")}
                </button>
              </div>
            </form>
          )}

          {/* ── SENT ── */}
          {view === "forgot_sent" && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10b981",
                }}
              >
                <IconCheck size={26} />
              </div>
              <div>
                <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
                  {t("emailSent")}
                </p>
                <p style={{ color: "#475569", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                  {t("emailSentDesc")}
                </p>
              </div>
              <button
                onClick={() => {
                  setView("login");
                  setForgotUser("");
                }}
                style={{ ...primaryBtn, width: "100%", marginTop: 0 }}
              >
                {t("backToLogin")}
              </button>
            </div>
          )}
        </div>

        {/* Switch login/signup abajo */}
        {(view === "login" || view === "signup") && (
          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "#475569" }}>
            <button
              onClick={() => {
                setView(view === "login" ? "signup" : "login");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#818cf8",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {view === "login" ? t("authToSignup") : t("authToLogin")}
            </button>
          </p>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
