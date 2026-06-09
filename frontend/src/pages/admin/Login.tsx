import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Credenciales inválidas");
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
    transition: "border-color 0.15s",
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
      {/* Background glow */}
      <div
        style={{
          position: "fixed",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 500,
          height: 300,
          background:
            "radial-gradient(ellipse,rgba(59,130,246,0.12) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              margin: "0 auto 14px",
            }}
          >
            🍽️
          </div>
          <h1
            style={{
              color: "#f1f5f9",
              fontSize: 22,
              fontWeight: 600,
              margin: "0 0 4px",
            }}
          >
            Menú Digital
          </h1>
          <p style={{ color: "#475569", fontSize: 13, margin: 0 }}>
            Ingresá a tu panel de administración
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#1a1d27",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "28px 24px",
          }}
        >
          <form
            onSubmit={submit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 7,
                }}
              >
                Usuario
              </label>
              <input
                style={inp}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="tu_usuario"
                onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                }
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 7,
                }}
              >
                Contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input
                  style={inp}
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                  }
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
                  {showPwd ? "🙈" : "👁️"}
                </button>
              </div>
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
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#1d4ed8" : "#3b82f6",
                border: "none",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => {
                if (!loading)
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "#2563eb";
              }}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background =
                  loading ? "#1d4ed8" : "#3b82f6")
              }
            >
              {loading && (
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
              )}
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
