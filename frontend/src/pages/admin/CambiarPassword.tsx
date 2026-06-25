import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function CambiarPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, logout, setMustChangePassword } = useAuth();
  const navigate = useNavigate();

  const strength = (() => {
    if (newPassword.length === 0) return 0;
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (newPassword.length >= 10) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthLabel = [
    "",
    "Muy débil",
    "Débil",
    "Regular",
    "Buena",
    "Fuerte",
  ][strength];
  const strengthColor = [
    "",
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#10b981",
  ][strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      return setError("La contraseña debe tener al menos 6 caracteres");
    }
    if (newPassword !== confirm) {
      return setError("Las contraseñas no coinciden");
    }

    setLoading(true);
    try {
      await authService.changePassword(newPassword);
      setMustChangePassword(false);
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  const inp: React.CSSProperties = {
    width: "100%",
    padding: "11px 42px 11px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };
  const labelS: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 7,
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
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 500,
          height: 300,
          background:
            "radial-gradient(ellipse,rgba(245,158,11,0.08) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#d97706,#f59e0b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              margin: "0 auto 14px",
            }}
          >
            🔑
          </div>
          <h1
            style={{
              color: "#f1f5f9",
              fontSize: 20,
              fontWeight: 700,
              margin: "0 0 4px",
            }}
          >
            Cambiá tu contraseña
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            Hola{" "}
            <strong style={{ color: "#94a3b8" }}>
              {user?.nombre || user?.username}
            </strong>
            , por seguridad debés establecer una nueva contraseña antes de
            continuar.
          </p>
        </div>

        {/* Warning banner */}
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "#fbbf24",
            }}
          >
            Estás usando una contraseña temporal. Debe ser cambiada para acceder
            al sistema.
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
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Nueva contraseña */}
            <div>
              <label style={labelS}>Nueva contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  style={inp}
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Mínimo 6 caracteres"
                  onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
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
                  {showNew ? "🙈" : "👁️"}
                </button>
              </div>

              {/* Barra de fortaleza */}
              {newPassword.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 2,
                          background:
                            i <= strength
                              ? strengthColor
                              : "rgba(255,255,255,0.06)",
                          transition: "background 0.2s",
                        }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 11,
                      color: strengthColor,
                    }}
                  >
                    {strengthLabel}
                  </p>
                </div>
              )}
            </div>

            {/* Confirmar */}
            <div>
              <label style={labelS}>Confirmar contraseña</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{
                    ...inp,
                    borderColor:
                      confirm && confirm !== newPassword
                        ? "rgba(239,68,68,0.5)"
                        : "rgba(255,255,255,0.08)",
                  }}
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repetí la contraseña"
                  onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={(e) =>
                    (e.target.style.borderColor =
                      confirm && confirm !== newPassword
                        ? "rgba(239,68,68,0.5)"
                        : "rgba(255,255,255,0.08)")
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
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
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>
              {confirm && confirm !== newPassword && (
                <p
                  style={{ margin: "5px 0 0", fontSize: 11, color: "#f87171" }}
                >
                  Las contraseñas no coinciden
                </p>
              )}
              {confirm && confirm === newPassword && confirm.length >= 6 && (
                <p
                  style={{ margin: "5px 0 0", fontSize: 11, color: "#34d399" }}
                >
                  ✓ Las contraseñas coinciden
                </p>
              )}
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
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 10,
                background: "#f59e0b",
                border: "none",
                color: "#1c1917",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#d97706";
              }}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  "#f59e0b")
              }
            >
              {loading && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(0,0,0,0.2)",
                    borderTopColor: "#1c1917",
                    borderRadius: "50%",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
              )}
              {loading ? "Guardando..." : "Establecer nueva contraseña"}
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#334155",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
