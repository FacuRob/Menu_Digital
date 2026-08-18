import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { authService, getApiErrorMessage } from "../../services/api";
import { BRAND_LOGO, BRAND_NAME } from "../../lib/brand";
import { useLang } from "../../lib/i18n";
import { IconEye, IconEyeOff, IconAlert, IconCheck } from "../../lib/icons";

// Página pública para restablecer la contraseña con el token de un solo uso
// que llega por email (link ?token=...). No cambia nada hasta que el usuario
// envía una contraseña nueva válida.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { t } = useLang();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("rpErrMin8"));
      return;
    }
    if (password !== confirm) {
      setError(t("rpErrMismatch"));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, t("rpErrReset")));
    } finally {
      setLoading(false);
    }
  };

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
  const primaryBtn: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "#3b82f6",
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
  };

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
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src={BRAND_LOGO}
            alt={BRAND_NAME}
            style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto 14px", display: "block" }}
          />
          <h1
            style={{
              color: "#f1f5f9",
              fontSize: 22,
              fontWeight: 700,
              margin: "0 0 4px",
            }}
          >
            {t("newPassword")}
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            {t("rpSubtitle")}
          </p>
        </div>

        <div
          style={{
            background: "#1a1d27",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "28px 24px",
          }}
        >
          {!token ? (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <p style={{ color: "#f87171", fontSize: 14, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconAlert size={15} style={{ flexShrink: 0 }} /> {t("rpInvalidLink")}
              </p>
              <button
                onClick={() => navigate("/admin/login")}
                style={primaryBtn}
              >
                {t("rpGoLogin")}
              </button>
            </div>
          ) : done ? (
            <div
              style={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
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
              <p style={{ color: "#f1f5f9", fontSize: 15, fontWeight: 600, margin: 0 }}>
                {t("rpDone")}
              </p>
              <button
                onClick={() => navigate("/admin/login")}
                style={primaryBtn}
              >
                {t("authTabLogin")}
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label style={label}>{t("newPassword")}</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={inp}
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder={t("rpPwPh8")}
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
              <div>
                <label style={label}>{t("repeatPassword")}</label>
                <input
                  style={inp}
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={primaryBtn}>
                {loading ? t("saving") : t("rpSave")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/admin/login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#475569",
                  fontSize: 13,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                {t("backToLogin")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
