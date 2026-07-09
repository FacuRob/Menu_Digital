import { useEffect, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useNegocio } from "../../context/NegocioContext";
import {
  negociosService,
  planService,
  getApiErrorMessage,
  type Negocio,
  type PlanInfo,
} from "../../services/api";

export default function Negocios() {
  const s = useStyles();
  const { isDark } = useTheme();
  const { negocios, refresh, negocioId, setNegocioId } = useNegocio();
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Negocio | null>(null);
  const [nombre, setNombre] = useState("");
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [saveError, setSaveError] = useState("");

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      await refresh();
      setPlan(await planService.get().catch(() => null));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uso del plan (multi-tenant).
  const suscripcionCancelada = plan?.estado_suscripcion === "cancelado";
  const usados = plan ? plan.negocios_usados : negocios.length;
  const limite = plan?.limite_negocios ?? null;
  const alLimite = limite !== null && usados >= limite;
  const bloqueadoNuevo = suscripcionCancelada || alLimite;

  const open = (n?: Negocio) => {
    setEditing(n || null);
    setNombre(n?.nombre || "");
    setSaveError("");
    setShowModal(true);
  };

  const save = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      if (editing) {
        await negociosService.update(editing.id, { nombre: nombre.trim() });
      } else {
        await negociosService.create({ nombre: nombre.trim() });
      }
      await refresh();
      setPlan(await planService.get().catch(() => plan));
      setShowModal(false);
    } catch (e) {
      setSaveError(getApiErrorMessage(e, "No se pudo guardar el negocio."));
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (n: Negocio) => {
    try {
      await negociosService.update(n.id, { activo: !n.activo });
      await refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const eliminar = async (n: Negocio) => {
    if (n.id === 1) return;
    if (
      !confirm(
        `¿Eliminar "${n.nombre}"? Se borrarán su menú, configuración y pedidos.`,
      )
    )
      return;
    try {
      await negociosService.delete(n.id);
      await refresh();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar.");
    }
  };

  return (
    <AdminLayout title="Negocios">
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ color: textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
            Tus negocios
          </h2>
          <p style={{ color: textMuted, fontSize: 13, margin: "4px 0 0" }}>
            Administrá varios locales desde un solo panel. El negocio activo es
            el que ves en el resto de las secciones.
          </p>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {limite !== null && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 9px",
                borderRadius: 99,
                background: alLimite
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(59,130,246,0.1)",
                color: alLimite ? "#dc2626" : "#3b82f6",
              }}
              title={`Plan ${plan?.tipo_plan}: hasta ${limite} negocios`}
            >
              {usados} / {limite === 9999 ? "∞" : limite} negocios del plan
            </span>
          )}
          <button
            onClick={() => !bloqueadoNuevo && open()}
            disabled={bloqueadoNuevo}
            title={
              suscripcionCancelada
                ? "Suscripción cancelada"
                : alLimite
                  ? limite === 1
                    ? "Tu plan Free permite un solo negocio. Mejorá tu plan para multi-negocio."
                    : `Alcanzaste el límite de ${limite} negocios de tu plan`
                  : "Nuevo negocio"
            }
            style={{
              ...s.btnPrimary,
              opacity: bloqueadoNuevo ? 0.5 : 1,
              cursor: bloqueadoNuevo ? "not-allowed" : "pointer",
            }}
          >
            + Nuevo negocio
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: textMuted }}>Cargando…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          }}
        >
          {negocios.map((n) => {
            const activo = n.id === negocioId;
            return (
              <div
                key={n.id}
                style={{
                  ...s.card,
                  padding: 16,
                  border: activo
                    ? "2px solid #3b82f6"
                    : (s.card.border as string),
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {n.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: textPrimary, fontWeight: 600, fontSize: 14 }}>
                      {n.nombre}
                    </div>
                    <div style={{ color: textMuted, fontSize: 11 }}>
                      #{n.id} · {n.slug || "sin-slug"}
                    </div>
                  </div>
                  {activo && (
                    <span style={{ ...s.badgeBlue }}>Activo</span>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  {!activo && (
                    <button
                      onClick={() => setNegocioId(n.id)}
                      style={{ ...s.btnPrimary, padding: "7px 12px", fontSize: 12.5 }}
                    >
                      Usar este
                    </button>
                  )}
                  <button
                    onClick={() => open(n)}
                    style={{ ...s.btnGhost, padding: "7px 12px", fontSize: 12.5 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(n)}
                    style={{ ...s.btnGhost, padding: "7px 12px", fontSize: 12.5 }}
                  >
                    {n.activo ? "Desactivar" : "Activar"}
                  </button>
                  {n.id !== 1 && (
                    <button
                      onClick={() => eliminar(n)}
                      style={{ ...s.btnGhost, padding: "7px 12px", fontSize: 12.5, color: "#ef4444" }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div style={s.overlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, color: textPrimary }}>
                {editing ? "Editar negocio" : "Nuevo negocio"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: textMuted }}
              >
                ✕
              </button>
            </div>
            <div style={s.modalBody}>
              <label style={s.label}>Nombre del negocio *</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Parrilla del Centro"
                style={s.input}
                autoFocus
              />
              {saveError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#dc2626",
                    fontSize: 12.5,
                    lineHeight: 1.4,
                  }}
                >
                  ⚠️ {saveError}
                </div>
              )}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setShowModal(false)} style={s.btnGhost}>
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving || !nombre.trim()}
                style={{ ...s.btnPrimary, marginLeft: "auto", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
