import { useState, useEffect } from "react";
import {
  usuariosService,
  type Usuario,
  type RolPermiso,
} from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";

type Mode = "crear" | "editar" | "password" | null;

const CloseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    style={{ width: 16, height: 16 }}
  >
    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
  </svg>
);
const PlusIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    style={{ width: 14, height: 14 }}
  >
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const ROL_COLOR: Record<string, { bg: string; text: string; border: string }> =
  {
    superadmin: {
      bg: "rgba(59,130,246,0.12)",
      text: "#60a5fa",
      border: "rgba(59,130,246,0.3)",
    },
    editor: {
      bg: "rgba(139,92,246,0.12)",
      text: "#a78bfa",
      border: "rgba(139,92,246,0.3)",
    },
    visor: {
      bg: "rgba(100,116,139,0.12)",
      text: "#94a3b8",
      border: "rgba(100,116,139,0.3)",
    },
  };

const inputFocus = (e: React.FocusEvent<any>) =>
  (e.target.style.borderColor = "#3b82f6");
const inputBlur = (e: React.FocusEvent<any>) =>
  (e.target.style.borderColor = "rgba(0,0,0,0.1)");

export default function Usuarios() {
  const S = useStyles();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolPermiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [selected, setSelected] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    nombre: "",
    email: "",
    password: "",
    rol: "editor",
    activo: true,
  });
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const { user: me } = useAuth();

  useEffect(() => {
    fetch_();
  }, []);

  const fetch_ = async () => {
    try {
      setLoading(true);
      const [u, r] = await Promise.all([
        usuariosService.getAll(),
        usuariosService.getRoles(),
      ]);
      setUsuarios(u);
      setRoles(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const open = (m: Mode, u?: Usuario) => {
    setSelected(u || null);
    setError("");
    if (m === "crear")
      setForm({
        username: "",
        nombre: "",
        email: "",
        password: "",
        rol: "editor",
        activo: true,
      });
    if (m === "editar" && u)
      setForm({
        username: u.username,
        nombre: u.nombre || "",
        email: (u as any).email || "",
        password: "",
        rol: u.rol,
        activo: u.activo,
      });
    if (m === "password") {
      setNewPwd("");
      setShowPwd(false);
    }
    setMode(m);
  };
  const close = () => {
    setMode(null);
    setSelected(null);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "crear") {
        await usuariosService.create({
          username: form.username,
          password: form.password,
          nombre: form.nombre || undefined,
          email: form.email || undefined,
          rol: form.rol,
        } as any);
      }
      if (mode === "editar" && selected) {
        await usuariosService.update(selected.id, {
          nombre: form.nombre || undefined,
          email: form.email || undefined,
          rol: form.rol,
          activo: form.activo,
        } as any);
      }
      if (mode === "password" && selected) {
        await usuariosService.cambiarPassword(selected.id, newPwd);
      }
      await fetch_();
      close();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const del = async (u: Usuario) => {
    if (!confirm(`¿Eliminar a "${u.username}"?`)) return;
    try {
      await usuariosService.delete(u.id);
      await fetch_();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error al eliminar");
    }
  };

  const toggle = async (u: Usuario) => {
    try {
      await usuariosService.update(u.id, { activo: !u.activo });
      await fetch_();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error");
    }
  };

  const RolBadge = ({ rol }: { rol: string }) => {
    const c = ROL_COLOR[rol] || ROL_COLOR.visor;
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 9px",
          borderRadius: 20,
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
        }}
      >
        {rol}
      </span>
    );
  };

  return (
    <AdminLayout title="Usuarios">
      {/* Rol cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {roles.map((r) => (
          <div key={r.rol} style={{ ...S.card, padding: "14px 16px" }}>
            <RolBadge rol={r.rol} />
            <div
              style={{
                color: "#64748b",
                fontSize: 11,
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              {r.descripcion}
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 8,
              }}
            >
              {(r.permisos as string[]).map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 10,
                    background: "rgba(0,0,0,0.04)",
                    color: "#64748b",
                    padding: "2px 7px",
                    borderRadius: 6,
                  }}
                >
                  {p === "*" ? "Todo" : p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <span style={{ color: "#475569", fontSize: 12 }}>
          {usuarios.length} usuarios
        </span>
        <button
          style={S.btnPrimary}
          onClick={() => open("crear")}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
        >
          <PlusIcon /> Nuevo usuario
        </button>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 48 }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                border: "2px solid #3b82f6",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={S.thead}>
                <tr>
                  {[
                    "Usuario",
                    "Nombre",
                    "Email",
                    "Rol",
                    "Estado",
                    "Creado",
                    "Acciones",
                  ].map((h) => (
                    <th key={h} style={S.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr
                    key={u.id}
                    style={S.tr}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(0,0,0,0.02)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={S.td}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background:
                              ROL_COLOR[u.rol]?.bg || "rgba(59,130,246,0.12)",
                            border: `1.5px solid ${ROL_COLOR[u.rol]?.border || "rgba(59,130,246,0.3)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: ROL_COLOR[u.rol]?.text || "#60a5fa",
                            fontWeight: 700,
                            fontSize: 12,
                            flexShrink: 0,
                          }}
                        >
                          {u.username[0].toUpperCase()}
                        </div>
                        <span style={{ color: "#1e293b", fontWeight: 500 }}>
                          {u.username}
                        </span>
                        {u.id === me?.id && (
                          <span
                            style={{
                              fontSize: 10,
                              background: "rgba(16,185,129,0.1)",
                              color: "#059669",
                              border: "1px solid rgba(16,185,129,0.2)",
                              padding: "1px 7px",
                              borderRadius: 10,
                            }}
                          >
                            vos
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={S.tdMuted}>
                      {u.nombre || (
                        <span style={{ fontStyle: "italic", color: "#94a3b8" }}>
                          —
                        </span>
                      )}
                    </td>
                    <td style={S.tdMuted}>
                      {(u as any).email ? (
                        <span style={{ color: "#60a5fa", fontSize: 12 }}>
                          {(u as any).email}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontStyle: "italic",
                            color: "#94a3b8",
                            fontSize: 12,
                          }}
                        >
                          sin email
                        </span>
                      )}
                    </td>
                    <td style={S.td}>
                      <RolBadge rol={u.rol} />
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => toggle(u)}
                        disabled={u.id === me?.id}
                        style={{
                          ...(u.activo ? S.badgeGreen : S.badgeRed),
                          cursor: u.id === me?.id ? "not-allowed" : "pointer",
                          border: "none",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.opacity = "0.75")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.opacity = "1")
                        }
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: u.activo ? "#10b981" : "#ef4444",
                          }}
                        />
                        {u.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td style={S.tdMuted}>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 14 }}>
                        <button
                          onClick={() => open("editar", u)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#60a5fa",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => open("password", u)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#a78bfa",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Password
                        </button>
                        {u.id !== me?.id && (
                          <button onClick={() => del(u)} style={S.btnDanger}>
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {mode && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth: 500 }}>
            <div style={S.modalHeader}>
              <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 15 }}>
                {mode === "crear"
                  ? "Nuevo usuario"
                  : mode === "editar"
                    ? `Editar: ${selected?.username}`
                    : `Password: ${selected?.username}`}
              </span>
              <button
                onClick={close}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  display: "flex",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
              >
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={submit}>
              <div
                style={{
                  ...S.modalBody,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {mode === "crear" && (
                  <>
                    <div>
                      <label style={S.label}>Username *</label>
                      <input
                        style={S.input}
                        required
                        value={form.username}
                        placeholder="ej: maria_garcia"
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                        onFocus={inputFocus}
                        onBlur={inputBlur}
                      />
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label style={S.label}>Nombre</label>
                        <input
                          style={S.input}
                          value={form.nombre}
                          placeholder="ej: María García"
                          onChange={(e) =>
                            setForm({ ...form, nombre: e.target.value })
                          }
                          onFocus={inputFocus}
                          onBlur={inputBlur}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Contraseña *</label>
                        <input
                          style={S.input}
                          type="password"
                          required
                          minLength={6}
                          value={form.password}
                          placeholder="Mín. 6 caracteres"
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          onFocus={inputFocus}
                          onBlur={inputBlur}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>
                        Email
                        <span
                          style={{
                            color: "#94a3b8",
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            marginLeft: 6,
                            fontSize: 10,
                          }}
                        >
                          — usado para recuperar contraseña
                        </span>
                      </label>
                      <input
                        style={S.input}
                        type="email"
                        value={form.email}
                        placeholder="ej: maria@empresa.com"
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        onFocus={inputFocus}
                        onBlur={inputBlur}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Rol</label>
                      <select
                        style={{ ...S.input, cursor: "pointer" }}
                        value={form.rol}
                        onChange={(e) =>
                          setForm({ ...form, rol: e.target.value })
                        }
                        onFocus={inputFocus as any}
                        onBlur={inputBlur as any}
                      >
                        {roles.map((r) => (
                          <option key={r.rol} value={r.rol}>
                            {r.rol} — {r.descripcion}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {mode === "editar" && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <label style={S.label}>Nombre</label>
                        <input
                          style={S.input}
                          value={form.nombre}
                          placeholder="ej: María García"
                          onChange={(e) =>
                            setForm({ ...form, nombre: e.target.value })
                          }
                          onFocus={inputFocus}
                          onBlur={inputBlur}
                        />
                      </div>
                      <div>
                        <label style={S.label}>Rol</label>
                        <select
                          style={{
                            ...S.input,
                            cursor: "pointer",
                            opacity: selected?.id === me?.id ? 0.5 : 1,
                          }}
                          disabled={selected?.id === me?.id}
                          value={form.rol}
                          onChange={(e) =>
                            setForm({ ...form, rol: e.target.value })
                          }
                          onFocus={inputFocus as any}
                          onBlur={inputBlur as any}
                        >
                          {roles.map((r) => (
                            <option key={r.rol} value={r.rol}>
                              {r.rol} — {r.descripcion}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={S.label}>
                        Email
                        <span
                          style={{
                            color: "#94a3b8",
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            marginLeft: 6,
                            fontSize: 10,
                          }}
                        >
                          — usado para recuperar contraseña
                        </span>
                      </label>
                      <input
                        style={S.input}
                        type="email"
                        value={form.email}
                        placeholder="ej: maria@empresa.com"
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        onFocus={inputFocus}
                        onBlur={inputBlur}
                      />
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <div
                        onClick={() => {
                          if (selected?.id !== me?.id)
                            setForm({ ...form, activo: !form.activo });
                        }}
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 11,
                          background: form.activo
                            ? "#3b82f6"
                            : "rgba(0,0,0,0.1)",
                          position: "relative",
                          cursor:
                            selected?.id === me?.id ? "not-allowed" : "pointer",
                          transition: "background 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 3,
                            left: form.activo ? 18 : 3,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                      <span style={{ color: "#64748b", fontSize: 13 }}>
                        Usuario activo
                      </span>
                    </div>
                  </>
                )}

                {mode === "password" && (
                  <div>
                    <label style={S.label}>Nueva contraseña</label>
                    <div style={{ position: "relative" }}>
                      <input
                        style={S.input}
                        type={showPwd ? "text" : "password"}
                        required
                        minLength={6}
                        value={newPwd}
                        placeholder="Mínimo 6 caracteres"
                        onChange={(e) => setNewPwd(e.target.value)}
                        onFocus={inputFocus}
                        onBlur={inputBlur}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        style={{
                          position: "absolute",
                          right: 10,
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
                )}

                {error && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#f87171",
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    ⚠️ {error}
                  </div>
                )}
              </div>
              <div style={S.modalFooter}>
                <button
                  type="button"
                  onClick={close}
                  style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(0,0,0,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(0,0,0,0.04)")
                  }
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...S.btnPrimary,
                    flex: 1,
                    justifyContent: "center",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!saving)
                      (e.currentTarget as HTMLButtonElement).style.background =
                        "#2563eb";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.background =
                      "#3b82f6")
                  }
                >
                  {saving
                    ? "Guardando..."
                    : mode === "crear"
                      ? "Crear usuario"
                      : mode === "editar"
                        ? "Guardar cambios"
                        : "Cambiar contraseña"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}
