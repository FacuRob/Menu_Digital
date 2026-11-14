import { useCallback, useEffect, useId, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import Modal from "../../components/Modal";
import { EmptyState, Switch } from "../../components/ui";
import { useStyles } from "../../components/sharedStyles";
import { useNegocio } from "../../context/NegocioContext";
import { useDialogos } from "../../lib/dialogos";
import { useLang } from "../../lib/i18n";
import { fmtMoney } from "../../lib/money";
import { IconPlus, IconTools } from "../../lib/icons";
import {
  getApiErrorMessage,
  serviciosService,
  uploadService,
  type ModalidadServicio,
  type Servicio,
  type TipoPrecio,
} from "../../services/api";

// Servicios del negocio (corte de pelo, instalación, consultoría…): aparte
// de los productos, con precio fijo, "desde" o a consultar, y duración.

type Form = Omit<Servicio, "id">;
const VACIO: Form = {
  nombre: "",
  descripcion: "",
  imagen_url: null,
  categoria: "",
  tipo_precio: "fijo",
  precio: null,
  duracion_min: null,
  modalidades: ["presencial"],
  requiere_turno: false,
  requiere_presupuesto: false,
  activo: true,
  orden: 0,
};
const MODALIDADES: ModalidadServicio[] = ["presencial", "domicilio", "virtual", "visita"];

export default function Servicios() {
  const { t } = useLang();
  const s = useStyles();
  const { moneda } = useNegocio();
  const { confirmar } = useDialogos();
  const uid = useId();
  const [lista, setLista] = useState<Servicio[] | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState<Form>(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(() => {
    serviciosService
      .getAll()
      .then((l) => {
        setLista(l);
        setErrorCarga("");
      })
      .catch((e) => setErrorCarga(getApiErrorMessage(e, t("servErrCargar"))));
  }, [t]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = (sv?: Servicio) => {
    setEditando(sv || null);
    setForm(sv ? { ...VACIO, ...sv } : { ...VACIO, orden: lista?.length || 0 });
    setError("");
    setAbierto(true);
  };

  const precioTexto = (sv: Pick<Servicio, "tipo_precio" | "precio">) =>
    sv.tipo_precio === "variable"
      ? t("servPrecioConsultar")
      : sv.tipo_precio === "desde"
        ? t("servPrecioDesde", { p: fmtMoney(Number(sv.precio), moneda) })
        : fmtMoney(Number(sv.precio), moneda);

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError(t("servFaltaNombre"));
      return;
    }
    if (form.tipo_precio !== "variable" && (form.precio === null || Number.isNaN(Number(form.precio)))) {
      setError(t("servFaltaPrecio"));
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const datos = {
        ...form,
        nombre: form.nombre.trim(),
        precio: form.tipo_precio === "variable" ? null : Number(form.precio),
        duracion_min: form.duracion_min ? Number(form.duracion_min) : null,
      };
      if (editando) await serviciosService.update(editando.id, datos);
      else await serviciosService.create(datos);
      setAbierto(false);
      cargar();
    } catch (e) {
      setError(getApiErrorMessage(e, t("servErrGuardar")));
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (sv: Servicio) => {
    if (!(await confirmar({ mensaje: t("servConfirmBorrar", { n: sv.nombre }), peligro: true }))) return;
    try {
      await serviciosService.delete(sv.id);
      cargar();
    } catch (e) {
      setErrorCarga(getApiErrorMessage(e, t("servErrGuardar")));
    }
  };

  const activar = async (sv: Servicio) => {
    try {
      await serviciosService.update(sv.id, { ...sv, activo: !sv.activo });
      cargar();
    } catch (e) {
      setErrorCarga(getApiErrorMessage(e, t("servErrGuardar")));
    }
  };

  const subirImagen = async (file?: File) => {
    if (!file) return;
    setSubiendo(true);
    setError("");
    try {
      const { url } = await uploadService.uploadImagen(file);
      setForm((f) => ({ ...f, imagen_url: url }));
    } catch (e) {
      setError(getApiErrorMessage(e, t("prodUploadError")));
    } finally {
      setSubiendo(false);
    }
  };

  const campo = (k: keyof Form) => `${uid}-${String(k)}`;

  return (
    <AdminLayout title={t("navServicios")}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{t("servTitle")}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14 }}>{t("servSub")}</p>
        </div>
        <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} onClick={() => abrir()}>
          <IconPlus size={14} /> {t("servNuevo")}
        </button>
      </div>

      {errorCarga && (
        <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{errorCarga}</p>
      )}
      {!lista && !errorCarga && <p role="status" style={{ color: "var(--fg-3)" }}>{t("subLoading")}</p>}
      {lista?.length === 0 && <EmptyState icon={<IconTools size={26} />} title={t("servVacio")} desc={t("servVacioDesc")} />}

      {!!lista?.length && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {lista.map((sv) => (
            <li key={sv.id} style={{ ...s.card, padding: 14, display: "grid", gap: 6, borderStyle: sv.activo ? "solid" : "dashed" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong style={{ color: "var(--fg)", fontSize: 15, marginRight: "auto" }}>
                  {sv.nombre}
                  {!sv.activo && <span style={{ ...s.badgeRed, marginLeft: 8 }}>{t("servPausado")}</span>}
                </strong>
                <span style={{ color: "var(--fg)", fontWeight: 700 }}>{precioTexto(sv)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-2)" }}>
                {[
                  sv.categoria,
                  sv.duracion_min ? t("servMin", { n: sv.duracion_min }) : null,
                  sv.modalidades.map((m) => t(`servMod_${m}`)).join(" · "),
                ]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <Switch checked={sv.activo} onChange={() => activar(sv)} label={sv.activo ? t("servActivo") : t("servPausado")} />
                <button type="button" style={{ ...s.btnGhost, minHeight: 44, marginLeft: "auto" }} onClick={() => abrir(sv)}>
                  {t("actionEdit")}
                </button>
                <button type="button" style={{ ...s.btnGhost, minHeight: 44, color: "var(--err)" }} onClick={() => borrar(sv)}>
                  {t("actionDelete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <Modal title={editando ? t("servEditar") : t("servNuevo")} subtitle={editando?.nombre} onClose={() => setAbierto(false)} maxWidth={620} icon={<IconTools />}>
          <form
            style={{ ...s.modalBody, display: "grid", gap: 14 }}
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            <div>
              <label htmlFor={campo("nombre")} style={s.label}>{t("servNombre")}</label>
              <input id={campo("nombre")} style={s.input} value={form.nombre} maxLength={150} required
                onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </div>
            <div>
              <label htmlFor={campo("descripcion")} style={s.label}>{t("servDescripcion")}</label>
              <textarea id={campo("descripcion")} style={{ ...s.input, minHeight: 70 }} value={form.descripcion || ""} maxLength={2000}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <div>
                <label htmlFor={campo("categoria")} style={s.label}>{t("servCategoria")}</label>
                <input id={campo("categoria")} style={s.input} value={form.categoria || ""} maxLength={80} placeholder={t("servCategoriaPh")}
                  list={`${uid}-cats`} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                <datalist id={`${uid}-cats`}>
                  {[...new Set((lista || []).map((x) => x.categoria).filter(Boolean))].map((c) => <option key={c!} value={c!} />)}
                </datalist>
              </div>
              <div>
                <label htmlFor={campo("duracion_min")} style={s.label}>{t("servDuracion")}</label>
                <input id={campo("duracion_min")} style={s.input} type="number" min={5} max={1440} step={5} value={form.duracion_min ?? ""}
                  onChange={(e) => setForm({ ...form, duracion_min: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
              <div>
                <label htmlFor={campo("tipo_precio")} style={s.label}>{t("servTipoPrecio")}</label>
                <select id={campo("tipo_precio")} style={{ ...s.input, cursor: "pointer" }} value={form.tipo_precio}
                  onChange={(e) => setForm({ ...form, tipo_precio: e.target.value as TipoPrecio })}>
                  <option value="fijo">{t("servPrecio_fijo")}</option>
                  <option value="desde">{t("servPrecio_desde")}</option>
                  <option value="variable">{t("servPrecio_variable")}</option>
                </select>
              </div>
              {form.tipo_precio !== "variable" && (
                <div>
                  <label htmlFor={campo("precio")} style={s.label}>{t("servPrecio")}</label>
                  <input id={campo("precio")} style={s.input} type="number" min={0} step="any" value={form.precio ?? ""}
                    onChange={(e) => setForm({ ...form, precio: e.target.value === "" ? null : Number(e.target.value) })} />
                </div>
              )}
            </div>
            <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
              <legend style={s.label}>{t("servModalidades")}</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                {MODALIDADES.map((m) => {
                  const on = form.modalidades.includes(m);
                  return (
                    <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 40, cursor: "pointer", color: "var(--fg)", fontSize: 14 }}>
                      <input type="checkbox" checked={on}
                        onChange={() => {
                          const nuevas = on ? form.modalidades.filter((x) => x !== m) : [...form.modalidades, m];
                          if (nuevas.length) setForm({ ...form, modalidades: nuevas });
                        }} />
                      {t(`servMod_${m}`)}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div style={{ display: "grid", gap: 2 }}>
              <Switch checked={form.requiere_turno} onChange={(v) => setForm({ ...form, requiere_turno: v })} label={t("servReqTurno")} />
              <Switch checked={form.requiere_presupuesto} onChange={(v) => setForm({ ...form, requiere_presupuesto: v })} label={t("servReqPresupuesto")} />
              <Switch checked={form.activo} onChange={(v) => setForm({ ...form, activo: v })} label={t("servActivoLabel")} />
              {(form.requiere_turno || form.requiere_presupuesto) && (
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--fg-2)" }}>{t("servProntoNota")}</p>
              )}
            </div>
            <div>
              <span style={s.label}>{t("servImagen")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {form.imagen_url && <img src={form.imagen_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />}
                <label style={{ ...s.btnGhost, minHeight: 44, cursor: "pointer" }}>
                  {subiendo ? t("subLoading") : form.imagen_url ? t("obCambiar") : t("obElegirImagen")}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={subiendo}
                    onChange={(e) => {
                      subirImagen(e.target.files?.[0]);
                      e.target.value = "";
                    }} />
                </label>
                {form.imagen_url && (
                  <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => setForm({ ...form, imagen_url: null })}>
                    {t("obQuitar")}
                  </button>
                )}
              </div>
            </div>
            {error && <p role="alert" style={{ margin: 0, color: "var(--err)", fontWeight: 600 }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} onClick={() => setAbierto(false)}>{t("actionCancel")}</button>
              <button type="submit" style={{ ...s.btnPrimary, minHeight: 44 }} disabled={guardando || subiendo} aria-busy={guardando}>
                {guardando ? t("subLoading") : t("actionSave")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}
