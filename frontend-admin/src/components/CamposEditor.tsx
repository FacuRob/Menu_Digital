import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";
import { camposService, getApiErrorMessage, type CampoProducto, type TipoCampo } from "../services/api";
import { useLang } from "../lib/i18n";
import { IconPlus, IconTrash } from "../lib/icons";
import { useStyles } from "./sharedStyles";

// Campos que completa el cliente al pedir un producto personalizado
// (nombre a grabar, medidas, archivo de referencia…). Se guardan aparte del
// producto, todos juntos, con "Guardar campos" (como las opciones).

const TIPOS: TipoCampo[] = ["texto", "texto_largo", "numero", "opcion", "multiple", "color", "archivo"];
const CON_OPCIONES: TipoCampo[] = ["opcion", "multiple", "color"];
const ARCHIVOS = ["imagen", "pdf", "3d"] as const;

const input: CSSProperties = {
  width: "100%",
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line-strong)",
  background: "var(--surface)",
  color: "var(--fg)",
  fontSize: 13.5,
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const etiqueta: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--fg-2)", marginBottom: 4 };

const vacio = (): CampoProducto => ({ tipo: "texto", etiqueta: "", ayuda: "", opciones: [], obligatorio: false, validaciones: {} });

export default function CamposEditor({ productoId }: { productoId: number }) {
  const { t } = useLang();
  const uid = useId();
  const st = useStyles();
  const [campos, setCampos] = useState<CampoProducto[]>([]);
  const [textoOpciones, setTextoOpciones] = useState<string[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    camposService
      .get(productoId)
      .then((c) => {
        if (!vivo) return;
        setCampos(c);
        setTextoOpciones(c.map((x) => x.opciones.join(", ")));
      })
      .catch((e) => vivo && setMensaje({ ok: false, texto: getApiErrorMessage(e, t("campErrCargar")) }))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
  }, [productoId, t]);

  const cambiar = (i: number, patch: Partial<CampoProducto>) => {
    setCampos((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
    setCambios(true);
    setMensaje(null);
  };
  const cambiarVal = (i: number, patch: CampoProducto["validaciones"]) =>
    cambiar(i, { validaciones: { ...campos[i].validaciones, ...patch } });
  const agregar = () => {
    setCampos((cs) => [...cs, vacio()]);
    setTextoOpciones((o) => [...o, ""]);
    setCambios(true);
  };
  const quitar = (i: number) => {
    setCampos((cs) => cs.filter((_, k) => k !== i));
    setTextoOpciones((o) => o.filter((_, k) => k !== i));
    setCambios(true);
  };
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= campos.length) return;
    const swap = <T,>(l: T[]) => {
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    };
    setCampos(swap);
    setTextoOpciones(swap);
    setCambios(true);
  };
  const numero = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const guardar = async () => {
    const sinEtiqueta = campos.findIndex((c) => !c.etiqueta.trim());
    if (sinEtiqueta >= 0) {
      setMensaje({ ok: false, texto: t("campFaltaEtiqueta", { n: sinEtiqueta + 1 }) });
      document.getElementById(`${uid}-${sinEtiqueta}-et`)?.focus();
      return;
    }
    setGuardando(true);
    setMensaje(null);
    try {
      const lista = campos.map((c, i) => ({
        ...c,
        etiqueta: c.etiqueta.trim(),
        opciones: CON_OPCIONES.includes(c.tipo)
          ? (textoOpciones[i] || "").split(",").map((x) => x.trim()).filter(Boolean)
          : [],
      }));
      const guardados = await camposService.put(productoId, lista);
      setCampos(guardados);
      setTextoOpciones(guardados.map((x) => x.opciones.join(", ")));
      setCambios(false);
      setMensaje({ ok: true, texto: t("campGuardados") });
    } catch (e) {
      setMensaje({ ok: false, texto: getApiErrorMessage(e, t("campErrGuardar")) });
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <p role="status" style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("subLoading")}</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)" }}>{t("campComoFunciona")}</p>
      {campos.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: "var(--fg-2)" }}>{t("campVacio")}</p>}

      {campos.map((c, i) => {
        const id = `${uid}-${i}`;
        return (
          <fieldset
            key={c.id ?? `n${i}`}
            style={{ margin: 0, padding: 12, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)", display: "grid", gap: 10 }}
          >
            <legend style={{ padding: "0 4px", fontSize: 12.5, fontWeight: 700, color: "var(--fg-2)" }}>
              {t("campNumero", { n: i + 1 })}
            </legend>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))" }}>
              <div>
                <label htmlFor={`${id}-et`} style={etiqueta}>{t("campEtiqueta")}</label>
                <input id={`${id}-et`} style={input} value={c.etiqueta} maxLength={80} placeholder={t("campEtiquetaPh")}
                  aria-invalid={mensaje?.ok === false && !c.etiqueta.trim() ? true : undefined}
                  onChange={(e) => cambiar(i, { etiqueta: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${id}-tipo`} style={etiqueta}>{t("campTipo")}</label>
                <select id={`${id}-tipo`} style={{ ...input, cursor: "pointer" }} value={c.tipo}
                  onChange={(e) => cambiar(i, { tipo: e.target.value as TipoCampo, validaciones: {} })}>
                  {TIPOS.map((x) => <option key={x} value={x}>{t(`campTipo_${x}`)}</option>)}
                </select>
              </div>
            </div>

            {CON_OPCIONES.includes(c.tipo) && (
              <div>
                <label htmlFor={`${id}-op`} style={etiqueta}>{c.tipo === "color" ? t("campColores") : t("campOpciones")}</label>
                <input id={`${id}-op`} style={input} value={textoOpciones[i] || ""}
                  placeholder={c.tipo === "color" ? t("campColoresPh") : t("campOpcionesPh")}
                  aria-describedby={`${id}-op-ayuda`}
                  onChange={(e) => {
                    setTextoOpciones((o) => o.map((x, k) => (k === i ? e.target.value : x)));
                    setCambios(true);
                  }} />
                <p id={`${id}-op-ayuda`} style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-2)" }}>
                  {c.tipo === "color" ? t("campColoresAyuda") : t("campOpcionesAyuda")}
                </p>
              </div>
            )}
            {(c.tipo === "texto" || c.tipo === "texto_largo") && (
              <div style={{ maxWidth: 200 }}>
                <label htmlFor={`${id}-max`} style={etiqueta}>{t("campMaxLargo")}</label>
                <input id={`${id}-max`} style={input} type="number" min={1} max={1000} value={c.validaciones.max_largo ?? ""}
                  onChange={(e) => cambiarVal(i, { max_largo: numero(e.target.value) })} />
              </div>
            )}
            {c.tipo === "numero" && (
              <div style={{ display: "flex", gap: 10 }}>
                {(["min", "max"] as const).map((k) => (
                  <div key={k} style={{ maxWidth: 140 }}>
                    <label htmlFor={`${id}-${k}`} style={etiqueta}>{t(k === "min" ? "campMin" : "campMax")}</label>
                    <input id={`${id}-${k}`} style={input} type="number" value={c.validaciones[k] ?? ""}
                      onChange={(e) => cambiarVal(i, { [k]: numero(e.target.value) })} />
                  </div>
                ))}
              </div>
            )}
            {c.tipo === "archivo" && (
              <fieldset style={{ border: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 14 }}>
                <legend style={{ ...etiqueta, float: "left", marginBottom: 0, marginRight: 8, lineHeight: "44px" }}>{t("campArchivos")}</legend>
                {ARCHIVOS.map((k) => {
                  const actuales = c.validaciones.tipos?.length ? c.validaciones.tipos : [...ARCHIVOS];
                  const on = actuales.includes(k);
                  return (
                    <label key={k} style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, fontSize: 13.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={on} disabled={on && actuales.length === 1}
                        onChange={() => {
                          const nuevos = on ? actuales.filter((x) => x !== k) : [...actuales, k];
                          if (nuevos.length) cambiarVal(i, { tipos: nuevos });
                        }} />
                      {t(`campArch_${k}`)}
                    </label>
                  );
                })}
                <p style={{ flexBasis: "100%", margin: 0, fontSize: 12.5, color: "var(--fg-2)" }}>{t("campArchivoAyuda")}</p>
              </fieldset>
            )}

            <div>
              <label htmlFor={`${id}-ay`} style={etiqueta}>{t("campAyuda")}</label>
              <input id={`${id}-ay`} style={input} value={c.ayuda || ""} maxLength={200}
                onChange={(e) => cambiar(i, { ayuda: e.target.value })} />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, minHeight: 44, fontSize: 13.5, cursor: "pointer", marginRight: "auto" }}>
                <input type="checkbox" checked={c.obligatorio} onChange={(e) => cambiar(i, { obligatorio: e.target.checked })} />
                {t("campObligatorio")}
              </label>
              <button type="button" style={{ ...st.btnGhost, minHeight: 44, minWidth: 44 }} onClick={() => mover(i, -1)} disabled={i === 0}
                aria-label={t("campSubir", { n: i + 1 })}>↑</button>
              <button type="button" style={{ ...st.btnGhost, minHeight: 44, minWidth: 44 }} onClick={() => mover(i, 1)} disabled={i === campos.length - 1}
                aria-label={t("campBajar", { n: i + 1 })}>↓</button>
              <button type="button" style={{ ...st.btnGhost, minHeight: 44, minWidth: 44, color: "var(--err)" }} onClick={() => quitar(i)}
                aria-label={t("campQuitar", { n: i + 1 })}>
                <IconTrash size={14} />
              </button>
            </div>
          </fieldset>
        );
      })}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={{ ...st.btnGhost, minHeight: 44 }} onClick={agregar} disabled={campos.length >= 20}>
          <IconPlus size={13} /> {t("campAgregar")}
        </button>
        <button type="button" style={{ ...st.btnPrimary, minHeight: 44 }} onClick={guardar} disabled={guardando || !cambios} aria-busy={guardando}>
          {guardando ? t("subLoading") : t("campGuardar")}
        </button>
      </div>
      <p role="status" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: mensaje?.ok ? "var(--ok)" : "var(--err)" }}>
        {mensaje?.texto || ""}
      </p>
    </div>
  );
}
