import { useState, useEffect, useRef } from "react";
import {
  productosService,
  categoriasService,
  uploadService,
  type Producto,
  type Categoria,
} from "../../services/api";
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

type Vista = "disponibles" | "no_disponibles";

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>("disponibles");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    precio: 0,
    imagen_url: "",
    categoria_id: 0,
    disponible: true,
    orden: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<number | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch_();
  }, []);

  const fetch_ = async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        productosService.getAll(),
        categoriasService.getAll(),
      ]);
      setProductos(p);
      setCategorias(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar por vista activos/inactivos + categoría
  const filtrados = productos
    .filter((p) => (vista === "disponibles" ? p.disponible : !p.disponible))
    .filter((p) =>
      filterCategoria === "all" ? true : p.categoria_id === filterCategoria,
    );

  const totalDisponibles = productos.filter((p) => p.disponible).length;
  const totalNoDisponibles = productos.filter((p) => !p.disponible).length;

  // Toggle disponible directamente desde la tabla
  const toggleDisponible = async (p: Producto) => {
    try {
      await productosService.update(p.id, {
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        imagen_url: p.imagen_url,
        categoria_id: p.categoria_id,
        disponible: !p.disponible,
        orden: p.orden,
      });
      fetch_();
    } catch {
      alert("Error al cambiar estado");
    }
  };

  const openModal = (p?: Producto) => {
    setEditing(p || null);
    setForm(
      p
        ? {
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: p.precio,
            imagen_url: p.imagen_url || "",
            categoria_id: p.categoria_id,
            disponible: p.disponible,
            orden: p.orden,
          }
        : {
            nombre: "",
            descripcion: "",
            precio: 0,
            imagen_url: "",
            categoria_id: categorias[0]?.id || 0,
            disponible: true,
            orden: productos.length + 1,
          },
    );
    setImagePreview(p?.imagen_url || "");
    setImageFile(null);
    setUploadError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview("");
    setUploadError("");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    setForm((prev) => ({ ...prev, imagen_url: "" }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUploadError("");
    try {
      let url = form.imagen_url;
      if (imageFile) {
        setUploading(true);
        try {
          url = (await uploadService.uploadImagen(imageFile)).url;
        } catch {
          setUploadError("Error al subir la imagen.");
          setSaving(false);
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }
      const data = { ...form, imagen_url: url || null };
      editing
        ? await productosService.update(editing.id, data)
        : await productosService.create(data);
      await fetch_();
      closeModal();
    } catch {
      alert("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  const inputFocus = (e: React.FocusEvent<any>) =>
    (e.target.style.borderColor = "#3b82f6");
  const inputBlur = (e: React.FocusEvent<any>) =>
    (e.target.style.borderColor = "rgba(255,255,255,0.08)");

  return (
    <AdminLayout title="Productos">
      {/* ── Toggle Disponibles / No disponibles ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            background: "#13151c",
            borderRadius: 10,
            padding: 3,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <button
            onClick={() => setVista("disponibles")}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              background: vista === "disponibles" ? "#1a1d27" : "transparent",
              color: vista === "disponibles" ? "#34d399" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block",
              }}
            />
            Disponibles
            <span
              style={{
                fontSize: 11,
                background: "rgba(16,185,129,0.15)",
                color: "#34d399",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {totalDisponibles}
            </span>
          </button>
          <button
            onClick={() => setVista("no_disponibles")}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              transition: "all 0.15s",
              background:
                vista === "no_disponibles" ? "#1a1d27" : "transparent",
              color: vista === "no_disponibles" ? "#f87171" : "#475569",
              display: "flex",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#ef4444",
                display: "inline-block",
              }}
            />
            No disponibles
            <span
              style={{
                fontSize: 11,
                background: "rgba(239,68,68,0.12)",
                color: "#f87171",
                padding: "1px 7px",
                borderRadius: 99,
              }}
            >
              {totalNoDisponibles}
            </span>
          </button>
        </div>

        {/* Filtro por categoría */}
        <select
          value={filterCategoria}
          onChange={(e) =>
            setFilterCategoria(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
          style={{
            ...S.input,
            width: "auto",
            padding: "7px 12px",
            fontSize: 12,
            cursor: "pointer",
          }}
          onFocus={inputFocus}
          onBlur={inputBlur}
        >
          <option value="all">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <span style={{ color: "#334155", fontSize: 12, marginLeft: 4 }}>
          {filtrados.length} productos
        </span>

        {/* Botón nuevo — a la derecha */}
        <button
          style={{ ...S.btnPrimary, marginLeft: "auto" }}
          onClick={() => openModal()}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2563eb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3b82f6")}
        >
          <PlusIcon /> Nuevo producto
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
        ) : filtrados.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>
              {vista === "disponibles" ? "✅" : "🚫"}
            </div>
            <div style={{ fontSize: 14 }}>
              No hay productos{" "}
              {vista === "disponibles" ? "disponibles" : "no disponibles"}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={S.thead}>
                <tr>
                  {[
                    "",
                    "Producto",
                    "Categoría",
                    "Precio",
                    "Estado",
                    "Ord.",
                    "Acciones",
                  ].map((h) => (
                    <th key={h} style={S.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr
                    key={p.id}
                    style={S.tr}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "rgba(255,255,255,0.02)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={{ ...S.td, width: 44 }}>
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            objectFit: "cover",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: "rgba(255,255,255,0.04)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                          }}
                        >
                          🍽️
                        </div>
                      )}
                    </td>
                    <td style={{ ...S.td, maxWidth: 200 }}>
                      <div
                        style={{
                          color: "#e2e8f0",
                          fontWeight: 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.nombre}
                      </div>
                      {p.descripcion && (
                        <div
                          style={{
                            color: "#334155",
                            fontSize: 11,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            marginTop: 2,
                          }}
                        >
                          {p.descripcion}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <span
                        style={{
                          ...S.badgeBlue,
                          background: "rgba(59,130,246,0.08)",
                        }}
                      >
                        {p.categoria_nombre}
                      </span>
                    </td>
                    <td
                      style={{
                        ...S.td,
                        color: "#e2e8f0",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmt(p.precio)}
                    </td>
                    <td style={S.td}>
                      {/* Toggle disponible directamente */}
                      <button
                        onClick={() => toggleDisponible(p)}
                        title={
                          p.disponible
                            ? "Click para desactivar"
                            : "Click para activar"
                        }
                        style={{
                          ...(p.disponible ? S.badgeGreen : S.badgeRed),
                          cursor: "pointer",
                          border: "none",
                          transition: "all 0.15s",
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
                            background: p.disponible ? "#10b981" : "#ef4444",
                          }}
                        />
                        {p.disponible ? "Disponible" : "No disp."}
                      </button>
                    </td>
                    <td style={S.tdMuted}>{p.orden}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 14 }}>
                        <button
                          onClick={() => openModal(p)}
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

                        {/* BOTON ELIMINAR, COMENTADO */}
                        {/* <button onClick={() => del(p.id)} style={S.btnDanger}>Eliminar</button> */}
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
      {showModal && (
        <div
          style={{
            ...S.overlay,
            alignItems: "flex-start",
            paddingTop: 20,
            overflowY: "auto",
          }}
        >
          <div style={{ ...S.modal, maxWidth: 560, marginBottom: 20 }}>
            <div style={S.modalHeader}>
              <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 15 }}>
                {editing ? "Editar producto" : "Nuevo producto"}
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
              <div
                style={{
                  ...S.modalBody,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div>
                  <label style={S.label}>Nombre *</label>
                  <input
                    style={S.input}
                    required
                    value={form.nombre}
                    placeholder="Ej: Milanesa napolitana"
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                </div>
                <div>
                  <label style={S.label}>Descripción</label>
                  <textarea
                    style={
                      {
                        ...S.input,
                        resize: "none",
                        height: 70,
                        fontFamily: "inherit",
                      } as React.CSSProperties
                    }
                    value={form.descripcion}
                    placeholder="Descripción del producto..."
                    onChange={(e) =>
                      setForm({ ...form, descripcion: e.target.value })
                    }
                    onFocus={inputFocus as any}
                    onBlur={inputBlur as any}
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
                    <label style={S.label}>Precio *</label>
                    <input
                      style={S.input}
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.precio}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          precio: parseFloat(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div>
                    <label style={S.label}>Categoría *</label>
                    <select
                      style={{ ...S.input, cursor: "pointer" }}
                      required
                      value={form.categoria_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          categoria_id: parseInt(e.target.value),
                        })
                      }
                      onFocus={inputFocus as any}
                      onBlur={inputBlur as any}
                    >
                      {categorias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <label style={S.label}>Orden</label>
                    <input
                      style={S.input}
                      type="number"
                      min="1"
                      value={form.orden}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          orden: parseInt(e.target.value) || 0,
                        })
                      }
                      onFocus={inputFocus}
                      onBlur={inputBlur}
                    />
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setForm({ ...form, disponible: !form.disponible })
                      }
                    >
                      <div
                        style={{
                          width: 38,
                          height: 22,
                          borderRadius: 11,
                          background: form.disponible
                            ? "#3b82f6"
                            : "rgba(255,255,255,0.1)",
                          position: "relative",
                          transition: "background 0.2s",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 3,
                            left: form.disponible ? 18 : 3,
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            background: "#fff",
                            transition: "left 0.2s",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                          }}
                        />
                      </div>
                      <span style={{ color: "#94a3b8", fontSize: 13 }}>
                        Disponible
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label style={S.label}>Imagen</label>
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    {imagePreview && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={imagePreview}
                          alt="preview"
                          style={{
                            width: 72,
                            height: 72,
                            objectFit: "cover",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          style={{
                            position: "absolute",
                            top: -6,
                            right: -6,
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "#ef4444",
                            border: "none",
                            color: "#fff",
                            fontSize: 10,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        flex: 1,
                        border: "2px dashed rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: 14,
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(59,130,246,0.4)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.08)")
                      }
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFile}
                        style={{ display: "none" }}
                      />
                      <div style={{ color: "#475569", fontSize: 12 }}>
                        {imagePreview ? "Cambiar imagen" : "Seleccionar imagen"}
                      </div>
                      <div
                        style={{ color: "#334155", fontSize: 11, marginTop: 3 }}
                      >
                        JPG, PNG, WebP — máx. 5MB
                      </div>
                    </div>
                  </div>
                  {uploadError && (
                    <div
                      style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}
                    >
                      ⚠️ {uploadError}
                    </div>
                  )}
                  {imageFile && !uploadError && (
                    <div
                      style={{ fontSize: 11, color: "#60a5fa", marginTop: 6 }}
                    >
                      📎 {imageFile.name} — se subirá al guardar
                    </div>
                  )}
                </div>
              </div>
              <div style={S.modalFooter}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
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
                    ? uploading
                      ? "Subiendo imagen..."
                      : "Guardando..."
                    : editing
                      ? "Actualizar"
                      : "Crear producto"}
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
