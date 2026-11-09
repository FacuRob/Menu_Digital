import { useState, useEffect } from "react";
import { useDialogos } from "../../lib/dialogos";
import { categoriasService, type Categoria } from "../../services/api";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import Modal from "../../components/Modal";
import { useLang } from "../../lib/i18n";
import { SearchIcon, ListIcon, GridIcon, Highlight } from "../../lib/listUi";
import { MOBILE_QUERY, useIsMobile } from "../../lib/useIsMobile";
import { IconX, IconList, IconEye } from "../../lib/icons";
import { Switch } from "../../components/ui";
import { Campo, InfoTip } from "../../components/InfoTip";
import { SideNav, SectionCard, SeccionPanel } from "../../components/SeccionesUi";
import { abrirSeccionInvalida } from "../../lib/secciones";

type ViewMode = "lista" | "cards";
type CatSeccion = "datos" | "estado";

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

export default function Categorias() {
  const S = useStyles();
  const { t } = useLang();
  const { avisar } = useDialogos();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [form, setForm] = useState({ nombre: "", orden: 0, activo: true });
  // Valores al abrir el modal: marcan con un punto las secciones con cambios.
  const [inicial, setInicial] = useState(form);
  const [seccion, setSeccion] = useState<CatSeccion>("datos");
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Vista elegida; si nunca eligió: tarjetas en el celular (la tabla no entra).
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const g = localStorage.getItem("cat_view");
      if (g === "lista" || g === "cards") return g;
    } catch {
      /* sin storage */
    }
    return window.matchMedia(MOBILE_QUERY).matches ? "cards" : "lista";
  });

  const setViewMode = (v: ViewMode) => {
    try {
      localStorage.setItem("cat_view", v);
    } catch {
      /* sin storage */
    }
    setView(v);
  };

  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const cardBg = "var(--surface)";
  const cardBorder = "var(--line)";

  const q = search.trim().toLowerCase();
  const filtradas = categorias.filter(
    (c) => !q || c.nombre.toLowerCase().includes(q),
  );

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
    const valores = c
      ? { nombre: c.nombre, orden: c.orden, activo: c.activo }
      : { nombre: "", orden: categorias.length + 1, activo: true };
    setEditing(c || null);
    setForm(valores);
    setInicial(valores);
    setSeccion("datos");
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
      if (editing) await categoriasService.update(editing.id, form);
      else await categoriasService.create(form);
      await fetch_();
      closeModal();
    } catch {
      void avisar({ mensaje: t("errSaveGeneric"), tipo: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Toggle activo/inactivo directo desde la tabla
  const toggleActivo = async (c: Categoria) => {
    try {
      await categoriasService.update(c.id, {
        nombre: c.nombre,
        orden: c.orden,
        activo: !c.activo,
      });
      fetch_();
    } catch {
      void avisar({ mensaje: t("errStatusChange"), tipo: "error" });
    }
  };

  return (
    <AdminLayout title={t("navCategorias")}>
      {/* Toolbar: búsqueda + vista + nuevo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Búsqueda por texto */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180, maxWidth: 340 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: textMuted,
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("catSearchPh")}
            style={{ ...S.input, padding: "8px 30px 8px 32px" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: textMuted,
                display: "flex",
                padding: 2,
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        <span style={{ color: textMuted, fontSize: 12 }}>
          {t("catCount", { n: filtradas.length })}
        </span>

        {/* Toggle de vista Lista / Tarjetas */}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            background: cardBg,
            borderRadius: 10,
            padding: 3,
            border: `1px solid ${cardBorder}`,
          }}
        >
          {(
            [
              { key: "lista", label: t("viewList"), Icon: ListIcon },
              { key: "cards", label: t("viewCards"), Icon: GridIcon },
            ] as const
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              title={v.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 12px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontSize: 12.5,
                fontWeight: 600,
                transition: "all 0.15s",
                background:
                  view === v.key ? "var(--surface-3)" : "transparent",
                color: view === v.key ? "var(--info)" : textMuted,
              }}
            >
              <v.Icon />
              {v.label}
            </button>
          ))}
        </div>

        <button
          style={S.btnPrimary}
          onClick={() => openModal()}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
        >
          <PlusIcon /> {t("catNew")}
        </button>
      </div>

      {/* ── Resultados ── */}
      {loading ? (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: "2px solid var(--focus)",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          </div>
        </div>
      ) : filtradas.length === 0 ? (
        <div style={S.card}>
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--fg-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 8, display: "flex", justifyContent: "center", color: "var(--fg-3)" }}>
              {q ? <SearchIcon size={30} /> : "📁"}
            </div>
            <div style={{ fontSize: 14 }}>
              {q ? t("searchNoResults") : t("catEmpty")}
            </div>
          </div>
        </div>
      ) : view === "cards" ? (
        /* ── Vista Tarjetas ── */
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          }}
        >
          {filtradas.map((c) => (
            <div
              key={c.id}
              style={{ ...S.card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <span style={{ color: textPrimary, fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>
                  <Highlight text={c.nombre} query={search} />
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: textMuted,
                    background: "var(--surface-2)",
                    borderRadius: 6,
                    padding: "2px 7px",
                    whiteSpace: "nowrap",
                  }}
                  title={t("colOrder")}
                >
                  #{c.orden}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <button
                  onClick={() => toggleActivo(c)}
                  title={c.activo ? t("clickToDeactivate") : t("clickToActivate")}
                  style={{ ...(c.activo ? S.badgeGreen : S.badgeRed), cursor: "pointer", border: "none" }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.activo ? "var(--ok)" : "var(--err)" }} />
                  {c.activo ? t("statusActive") : t("statusInactive")}
                </button>
                <button
                  onClick={() => openModal(c)}
                  style={{ background: "none", border: "none", color: "var(--info)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  {t("actionEdit")}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Vista Lista (tabla) ── */
        <div style={{ ...S.card, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                {[t("colName"), t("colOrder"), t("colStatus"), t("colActions")].map((h) => (
                  <th key={h} style={S.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr
                  key={c.id}
                  style={S.tr}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--surface-2)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <td style={{ ...S.td, fontWeight: 600, fontSize: 13.5, color: textPrimary }}>
                    <Highlight text={c.nombre} query={search} />
                  </td>
                  <td style={S.tdMuted}>{c.orden}</td>
                  <td style={S.td}>
                    {/* Toggle activo/inactivo */}
                    <button
                      onClick={() => toggleActivo(c)}
                      title={
                        c.activo
                          ? t("clickToDeactivate")
                          : t("clickToActivate")
                      }
                      style={{
                        ...(c.activo ? S.badgeGreen : S.badgeRed),
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
                          background: c.activo ? "var(--ok)" : "var(--err)",
                        }}
                      />
                      {c.activo ? t("statusActive") : t("statusInactive")}
                    </button>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <button
                        onClick={() => openModal(c)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--info)",
                          fontSize: 13,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {t("actionEdit")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: mismo diseño que "Configuración del menú" y "Mi cuenta". */}
      {showModal && (
        <Modal
          title={editing ? t("catEditTitle") : t("catNew")}
          subtitle={editing ? editing.nombre : undefined}
          onClose={closeModal}
          maxWidth={760}
          icon={<IconList />}
        >
          <form onSubmit={submit} onInvalidCapture={abrirSeccionInvalida(seccion, setSeccion)}>
            <div
              style={{
                background: "var(--surface-3)",
                padding: isMobile ? 12 : 22,
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 12 : 20,
                alignItems: isMobile ? "stretch" : "flex-start",
              }}
            >
              <SideNav<CatSeccion>
                value={seccion}
                onChange={setSeccion}
                isMobile={isMobile}
                dirtyTitle={t("cfgUnsaved")}
                groups={[
                  {
                    label: t("catNavGroup"),
                    color: "var(--info)",
                    items: [
                      {
                        id: "datos",
                        label: t("catSecData"),
                        accent: "var(--info)",
                        Icon: IconList,
                        dirty: !!editing && form.nombre !== inicial.nombre,
                      },
                      {
                        id: "estado",
                        label: t("catSecShow"),
                        accent: "var(--ok)",
                        Icon: IconEye,
                        dirty: !!editing && (form.orden !== inicial.orden || form.activo !== inicial.activo),
                      },
                    ],
                  },
                ]}
              />

              <div style={{ flex: 1, minWidth: 0, display: "grid" }}>
                <SeccionPanel id="datos" visible={seccion === "datos"}>
                  <SectionCard accent="var(--info)" title={t("catSecData")} subtitle={t("catSecDataSub")}>
                    <Campo label={t("qCatName")}>
                      <input
                        style={S.input}
                        required
                        maxLength={80}
                        value={form.nombre}
                        placeholder={t("catNamePh")}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      />
                    </Campo>
                  </SectionCard>
                </SeccionPanel>

                <SeccionPanel id="estado" visible={seccion === "estado"}>
                  <SectionCard accent="var(--ok)" title={t("catSecShow")} subtitle={t("catSecShowSub")}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <Campo label={t("qCatPos")} info={t("iCatPos")}>
                        <input
                          style={S.input}
                          type="number"
                          min="1"
                          required
                          value={form.orden}
                          onChange={(e) => setForm({ ...form, orden: parseInt(e.target.value) || 0 })}
                        />
                      </Campo>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Switch
                          checked={form.activo}
                          onChange={(v) => setForm({ ...form, activo: v })}
                          label={form.activo ? t("catVisibleOn") : t("catVisibleOff")}
                        />
                        <InfoTip texto={t("iCatVisible")} titulo={t("catVisibleOn")} />
                      </div>
                    </div>
                  </SectionCard>
                </SeccionPanel>
              </div>
            </div>
            <div style={S.modalFooter}>
              <button
                type="button"
                onClick={closeModal}
                style={{ ...S.btnGhost, flex: 1 }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--surface-2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    "var(--surface)")
                }
              >
                {t("actionCancel")}
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
                      "var(--accent-hover)";
                }}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "var(--accent)")
                }
              >
                {saving
                  ? t("saving")
                  : editing
                    ? t("actionUpdate")
                    : t("catCreate")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </AdminLayout>
  );
}
