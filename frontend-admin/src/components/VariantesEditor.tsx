import { useEffect, useState } from "react";
import {
  variantesService,
  getApiErrorMessage,
  type VarianteGrupo,
  type VarianteOpcion,
} from "../services/api";
import { useLang } from "../lib/i18n";
import { IconPlus, IconTrash, IconX } from "../lib/icons";

// Grupo editable en memoria: puede no tener id todavía (aún no guardado).
interface EditGrupo {
  id?: number;
  nombre: string;
  tipo: "single" | "multi";
  obligatorio: boolean;
  opciones: VarianteOpcion[];
  _dirty?: boolean;
}

const fromServer = (g: VarianteGrupo): EditGrupo => ({
  id: g.id,
  nombre: g.nombre,
  tipo: g.tipo,
  obligatorio: g.obligatorio,
  opciones: g.opciones.map((o) => ({
    id: o.id,
    nombre: o.nombre,
    precio_extra: Number(o.precio_extra || 0),
    stock: o.stock ?? null,
  })),
});

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

/**
 * Editor de variantes/modificadores de un producto (multi-rubro).
 * Sirve para talles, colores o extras. Carga y guarda cada grupo de
 * forma independiente contra /api/variantes (no depende del form del producto).
 */
export default function VariantesEditor({ productoId }: { productoId: number }) {
  const { t } = useLang();
  const [grupos, setGrupos] = useState<EditGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<number | "nuevo" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await variantesService.getByProducto(productoId);
        setGrupos(data.map(fromServer));
      } catch (e) {
        setError(getApiErrorMessage(e, t("varErrLoad")));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId]);

  const patchGrupo = (idx: number, patch: Partial<EditGrupo>) =>
    setGrupos((gs) =>
      gs.map((g, i) => (i === idx ? { ...g, ...patch, _dirty: true } : g)),
    );

  const addGrupo = () =>
    setGrupos((gs) => [
      ...gs,
      { nombre: "", tipo: "single", obligatorio: false, opciones: [], _dirty: true },
    ]);

  const addOpcion = (idx: number) =>
    patchGrupo(idx, {
      opciones: [
        ...grupos[idx].opciones,
        { nombre: "", precio_extra: 0, stock: null },
      ],
    });

  const patchOpcion = (
    gi: number,
    oi: number,
    patch: Partial<VarianteOpcion>,
  ) =>
    patchGrupo(gi, {
      opciones: grupos[gi].opciones.map((o, i) =>
        i === oi ? { ...o, ...patch } : o,
      ),
    });

  const removeOpcion = (gi: number, oi: number) =>
    patchGrupo(gi, {
      opciones: grupos[gi].opciones.filter((_, i) => i !== oi),
    });

  const saveGrupo = async (idx: number) => {
    const g = grupos[idx];
    if (!g.nombre.trim()) {
      setError(t("varErrName"));
      return;
    }
    const payload = {
      nombre: g.nombre.trim(),
      tipo: g.tipo,
      obligatorio: g.obligatorio,
      opciones: g.opciones
        .filter((o) => o.nombre.trim())
        .map((o, i) => ({
          nombre: o.nombre.trim(),
          precio_extra: Number(o.precio_extra) || 0,
          stock: o.stock === null || o.stock === undefined ? null : Number(o.stock),
          orden: i,
        })),
    };
    try {
      setSavingId(g.id ?? "nuevo");
      setError("");
      const saved = g.id
        ? await variantesService.updateGrupo(g.id, payload)
        : await variantesService.createGrupo(productoId, payload);
      setGrupos((gs) => gs.map((x, i) => (i === idx ? fromServer(saved) : x)));
    } catch (e) {
      setError(getApiErrorMessage(e, t("varErrSave")));
    } finally {
      setSavingId(null);
    }
  };

  const deleteGrupo = async (idx: number) => {
    const g = grupos[idx];
    if (!g.id) {
      setGrupos((gs) => gs.filter((_, i) => i !== idx));
      return;
    }
    if (!confirm(t("varConfirmDelete", { name: g.nombre }))) return;
    try {
      await variantesService.deleteGrupo(g.id);
      setGrupos((gs) => gs.filter((_, i) => i !== idx));
    } catch (e) {
      setError(getApiErrorMessage(e, t("varErrDelete")));
    }
  };

  return (
    <div
      style={{
        borderTop: "1px solid rgba(0,0,0,0.08)",
        paddingTop: 14,
        marginTop: 2,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1e293b" }}>
            {t("varTitle")}
          </div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
            {t("varSubtitle")}
          </div>
        </div>
        <button
          type="button"
          onClick={addGrupo}
          style={{
            ...inputStyle,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            border: "1px solid #3b82f6",
            color: "#3b82f6",
            background: "rgba(59,130,246,0.06)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <IconPlus size={13} /> {t("varAddGroup")}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#dc2626", margin: "6px 0" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
          {t("varLoading")}
        </div>
      ) : grupos.length === 0 ? (
        <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
          {t("varEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
          {grupos.map((g, gi) => (
            <div
              key={g.id ?? `nuevo-${gi}`}
              style={{
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 10,
                padding: 12,
                background: "rgba(0,0,0,0.015)",
              }}
            >
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, flex: 1, minWidth: 120 }}
                  placeholder={t("varGroupNamePh")}
                  value={g.nombre}
                  onChange={(e) => patchGrupo(gi, { nombre: e.target.value })}
                />
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={g.tipo}
                  onChange={(e) =>
                    patchGrupo(gi, { tipo: e.target.value as "single" | "multi" })
                  }
                >
                  <option value="single">{t("varTypeSingle")}</option>
                  <option value="multi">{t("varTypeMulti")}</option>
                </select>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12.5,
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={g.obligatorio}
                    onChange={(e) => patchGrupo(gi, { obligatorio: e.target.checked })}
                  />
                  {t("varRequired")}
                </label>
              </div>

              {/* Opciones */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {g.opciones.map((o, oi) => (
                  <div key={oi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder={t("varOptionPh")}
                      value={o.nombre}
                      onChange={(e) => patchOpcion(gi, oi, { nombre: e.target.value })}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>+</span>
                      <input
                        style={{ ...inputStyle, width: 90 }}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t("varExtraPh")}
                        value={o.precio_extra}
                        onChange={(e) =>
                          patchOpcion(gi, oi, {
                            precio_extra: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOpcion(gi, oi)}
                      title={t("varRemoveOption")}
                      style={{
                        border: "none",
                        background: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        display: "flex",
                        padding: "0 4px",
                      }}
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOpcion(gi)}
                  style={{
                    ...inputStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    alignSelf: "flex-start",
                    border: "1px dashed rgba(0,0,0,0.2)",
                    background: "transparent",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  <IconPlus size={13} /> {t("varAddOption")}
                </button>
              </div>

              {/* Acciones del grupo */}
              <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => deleteGrupo(gi)}
                  style={{
                    ...inputStyle,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#dc2626",
                    background: "transparent",
                    cursor: "pointer",
                  }}
                >
                  <IconTrash size={13} /> {t("varDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => saveGrupo(gi)}
                  disabled={savingId !== null}
                  style={{
                    ...inputStyle,
                    border: "none",
                    background: "#3b82f6",
                    color: "#fff",
                    fontWeight: 600,
                    cursor: savingId !== null ? "default" : "pointer",
                    opacity: g._dirty ? 1 : 0.6,
                  }}
                >
                  {savingId === (g.id ?? "nuevo") ? t("varSaving") : t("varSaveGroup")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
