import { useState, useEffect } from "react";
import { categoriasService, type Categoria } from "../../services/api";
import AdminLayout from "../../components/AdminLayout";
import { S } from "../../components/sharedStyles";

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

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState({ nombre: "", orden: 0, activo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch_();
  }, []);

  const fetch_ = async () => {
    try {
      setLoading(true);
      setCategorias(await categoriasService.getAll());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (c?: Categoria) => {
    setEditing(c || null);
    setForm(
      c
        ? { nombre: c.nombre, orden: c.orden, activo: c.activo }
        : { nombre: "", orden: categorias.length + 1, activo: true },
    );
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      editing
        ? await categoriasService.update(editing.id, form)
        : await categoriasService.create(form);
      await fetch_();
      closeModal();
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    if (!confirm("¿Eliminar esta categoría y todos sus productos?")) return;
    try {
      await categoriasService.delete(id);
      fetch_();
    } catch {
      alert("Error al eliminar");
    }
  };

  return (
    <AdminLayout title="Categorías">
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span style={{ color: "#475569", fontSize: 12 }}>
          {categorias.length} categorías
        </span>
        <button
          style={S.btnPrimary}
          onClick={() => openModal()}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
        >
          <PlusIcon /> Nueva categoría
        </button>
      </div>

      {/* Table card */}
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
        ) : categorias.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            <div style={{ fontSize: 14 }}>No hay categorías todavía</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                {["Nombre", "Orden", "Estado", "Acciones"].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr
                  key={c.id}
                  style={S.tr}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.02)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={{ ...S.td, fontWeight: 500, color: "#e2e8f0" }}>
                    {c.nombre}
                  </td>
                  <td style={S.tdMuted}>{c.orden}</td>
                  <td style={S.td}>
                    <span style={c.activo ? S.badgeGreen : S.badgeRed}>
                      <span
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: c.activo ? "#10b981" : "#ef4444",
                        }}
                      />
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <button
                        onClick={() => openModal(c)}
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
                      <button onClick={() => del(c.id)} style={S.btnDanger}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 15 }}>
                {editing ? "Editar categoría" : "Nueva categoría"}
              </span>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#475569",
                  display: "flex",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
              >
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={submit}>
              <div style={S.modalBody}>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div>
                    <label style={S.label}>Nombre</label>
                    <input
                      style={S.input}
                      required
                      value={form.nombre}
                      placeholder="Ej: Entradas, Bebidas..."
                      onChange={(e) =>
                        setForm({ ...form, nombre: e.target.value })
                      }
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                      }
                    />
                  </div>
                  <div>
                    <label style={S.label}>Orden de aparición</label>
                    <input
                      style={S.input}
                      type="number"
                      min="1"
                      required
                      value={form.orden}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          orden: parseInt(e.target.value) || 0,
                        })
                      }
                      onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                      onBlur={(e) =>
                        (e.target.style.borderColor = "rgba(255,255,255,0.08)")
                      }
                    />
                  </div>
                  <div>
                    <label style={S.label}>Estado</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[true, false].map((val) => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setForm({ ...form, activo: val })}
                          style={{
                            flex: 1,
                            padding: "8px 0",
                            borderRadius: 8,
                            border: `1px solid ${form.activo === val ? (val ? "#10b981" : "#ef4444") : "rgba(255,255,255,0.08)"}`,
                            background:
                              form.activo === val
                                ? val
                                  ? "rgba(16,185,129,0.1)"
                                  : "rgba(239,68,68,0.1)"
                                : "transparent",
                            color:
                              form.activo === val
                                ? val
                                  ? "#34d399"
                                  : "#f87171"
                                : "#475569",
                            fontSize: 13,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {val ? "Activo" : "Inactivo"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div style={S.modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{ ...S.btnGhost, flex: 1 }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      "rgba(255,255,255,0.05)")
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
                    : editing
                      ? "Actualizar"
                      : "Crear categoría"}
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
