import { useId, useState, type ReactNode } from "react";
import PlanoMesas, { type Seleccion } from "./PlanoMesas";
import { useStyles } from "./sharedStyles";
import { useLang } from "../lib/i18n";
import { useDialogos } from "../lib/dialogos";
import type { FormaMesa, MesaPlano, PisoPlano, PlanoMesas as Plano, ZonaPlano } from "../services/api";
import { juntarMesas, nombreMesa, numerosDe, nuevoId, separarMesa, sePegan } from "../lib/planoMesas";

// Editor del plano del local (sólo el dueño): pisos, zonas interior/exterior
// (rectángulos o círculos) y mesas. Se guarda todo junto al tocar "Guardar".
// Si se pega una mesa a otra, pregunta si son la misma mesa y las combina (6+7).

const MAX_PISOS = 5;

const solapa = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w + 0.3 && b.x < a.x + a.w + 0.3 && a.y < b.y + b.h + 0.3 && b.y < a.y + a.h + 0.3;

// Primer lugar libre del piso para algo de w × h.
const lugarLibre = (piso: PisoPlano, w: number, h: number) => {
  for (let y = 0.5; y + h <= piso.alto; y += 0.5) {
    for (let x = 0.5; x + w <= piso.ancho; x += 0.5) {
      if (!piso.mesas.some((m) => solapa({ x, y, w, h }, m))) return { x, y };
    }
  }
  return { x: Math.max(0, (piso.ancho - w) / 2), y: Math.max(0, (piso.alto - h) / 2) };
};

interface Props {
  inicial: Plano;
  existe: boolean; // ya había un plano guardado (se puede eliminar)
  onGuardar: (p: Plano) => Promise<void>;
  onEliminar: () => Promise<void>;
  onCancelar: () => void;
}

export default function EditorPlano({ inicial, existe, onGuardar, onEliminar, onCancelar }: Props) {
  const { t } = useLang();
  const s = useStyles();
  const uid = useId();
  const { confirmar } = useDialogos();
  const [plano, setPlano] = useState<Plano>(inicial);
  const [pi, setPi] = useState(0);
  const [sel, setSel] = useState<Seleccion>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [cambios, setCambios] = useState(false);

  const piso = plano.pisos[Math.min(pi, plano.pisos.length - 1)];
  const usadas = new Set(plano.pisos.flatMap((p) => p.mesas.flatMap((m) => numerosDe(m).map(Number))));
  const proxima = () => {
    let n = 1;
    while (usadas.has(n)) n++;
    return String(n);
  };

  const setPiso = (nuevo: PisoPlano) => {
    setPlano((p) => ({ pisos: p.pisos.map((x) => (x.id === nuevo.id ? nuevo : x)) }));
    setCambios(true);
  };

  const agregarMesa = (forma: FormaMesa) => {
    const w = forma === "rectangular" ? 1.8 : 1;
    const h = 1;
    const mesa: MesaPlano = { mesa: proxima(), forma, w, h, ...lugarLibre(piso, w, h) };
    setPiso({ ...piso, mesas: [...piso.mesas, mesa] });
    setSel({ tipo: "mesa", id: mesa.mesa });
  };

  const agregarZona = (tipo: ZonaPlano["tipo"], forma: ZonaPlano["forma"]) => {
    const w = Math.min(forma === "circulo" ? 5 : 6, piso.ancho);
    const h = Math.min(forma === "circulo" ? 5 : 4, piso.alto);
    const zona: ZonaPlano = {
      id: nuevoId("z"),
      tipo,
      forma,
      nombre: tipo === "exterior" ? t("mesZonaExteriorNombre") : t("mesZonaInteriorNombre"),
      x: 0,
      y: 0,
      w,
      h,
    };
    setPiso({ ...piso, zonas: [...piso.zonas, zona] });
    setSel({ tipo: "zona", id: zona.id });
  };

  const borrarSel = () => {
    if (!sel) return;
    if (sel.tipo === "mesa") setPiso({ ...piso, mesas: piso.mesas.filter((m) => m.mesa !== sel.id) });
    else setPiso({ ...piso, zonas: piso.zonas.filter((z) => z.id !== sel.id) });
    setSel(null);
  };

  const mesaSel = sel?.tipo === "mesa" ? piso.mesas.find((m) => m.mesa === sel.id) : undefined;
  const zonaSel = sel?.tipo === "zona" ? piso.zonas.find((z) => z.id === sel.id) : undefined;

  const cambiarMesa = (cambio: Partial<MesaPlano>) => {
    if (!mesaSel) return;
    setPiso({ ...piso, mesas: piso.mesas.map((m) => (m.mesa === mesaSel.mesa ? { ...m, ...cambio } : m)) });
    if (cambio.mesa) setSel({ tipo: "mesa", id: cambio.mesa });
  };
  const cambiarZona = (cambio: Partial<ZonaPlano>) => {
    if (!zonaSel) return;
    setPiso({ ...piso, zonas: piso.zonas.map((z) => (z.id === zonaSel.id ? { ...z, ...cambio } : z)) });
  };

  // Mesa combinada: dos mesas del piso pasan a ser una (6+7). Los QR de las
  // dos siguen andando y cargan a la misma mesa.
  const juntar = (a: MesaPlano, b: MesaPlano) => {
    const nueva = juntarMesas(a, b);
    setPlano((p) => ({
      pisos: p.pisos.map((x) =>
        x.id !== piso.id ? x : { ...x, mesas: [...x.mesas.filter((m) => m.mesa !== a.mesa && m.mesa !== b.mesa), nueva] },
      ),
    }));
    setCambios(true);
    setSel({ tipo: "mesa", id: nueva.mesa });
  };
  // Al soltar una mesa pegada a otra: ¿son la misma mesa?
  const alSoltarMesa = async (id: string) => {
    const yo = piso.mesas.find((m) => m.mesa === id);
    const otra = yo && piso.mesas.find((m) => m.mesa !== id && sePegan(yo, m));
    if (!yo || !otra) return;
    const si = await confirmar({
      titulo: t("mesJuntarTitulo"),
      mensaje: t("mesJuntarPregunta", { a: nombreMesa(yo), b: nombreMesa(otra) }),
      confirmarTexto: t("mesJuntarSi"),
    });
    if (si) juntar(yo, otra);
  };
  const separar = () => {
    if (!mesaSel?.unidas?.length) return;
    const partes = separarMesa(mesaSel);
    setPiso({ ...piso, mesas: [...piso.mesas.filter((m) => m.mesa !== mesaSel.mesa), ...partes] });
    setSel({ tipo: "mesa", id: partes[0].mesa });
  };

  // Número de mesa: entero, sin repetir en ningún piso.
  const [numError, setNumError] = useState("");
  const cambiarNumero = (txt: string) => {
    const n = Number(txt);
    if (!Number.isInteger(n) || n < 1 || n > 500) return setNumError(t("mesNumInvalido"));
    if (String(n) !== mesaSel?.mesa && usadas.has(n)) return setNumError(t("mesNumRepetido", { n }));
    setNumError("");
    cambiarMesa({ mesa: String(n) });
  };

  const agregarPiso = () => {
    const nuevo: PisoPlano = { id: nuevoId("p"), nombre: t("mesPisoN", { n: plano.pisos.length + 1 }), ancho: piso.ancho, alto: piso.alto, zonas: [], mesas: [] };
    setPlano((p) => ({ pisos: [...p.pisos, nuevo] }));
    setPi(plano.pisos.length);
    setSel(null);
    setCambios(true);
  };
  const borrarPiso = async () => {
    if (plano.pisos.length < 2) return;
    if (!(await confirmar({ mensaje: t("mesBorrarPisoConfirm", { p: piso.nombre }), peligro: true, confirmarTexto: t("mesBorrarPiso") }))) return;
    setPlano((p) => ({ pisos: p.pisos.filter((x) => x.id !== piso.id) }));
    setPi(0);
    setSel(null);
    setCambios(true);
  };

  // Medidas del piso: lo que quede afuera se acomoda adentro.
  const medida = (campo: "ancho" | "alto", v: number) => {
    const val = Math.min(100, Math.max(2, Math.round(v * 2) / 2 || 2));
    const dentro = <T extends { x: number; y: number; w: number; h: number }>(it: T): T => {
      const w = Math.min(it.w, campo === "ancho" ? val : piso.ancho);
      const h = Math.min(it.h, campo === "alto" ? val : piso.alto);
      return {
        ...it,
        w,
        h,
        x: Math.min(it.x, (campo === "ancho" ? val : piso.ancho) - w),
        y: Math.min(it.y, (campo === "alto" ? val : piso.alto) - h),
      };
    };
    setPiso({ ...piso, [campo]: val, mesas: piso.mesas.map(dentro), zonas: piso.zonas.map(dentro) });
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await onGuardar(plano);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mesErrGuardar"));
      setGuardando(false);
    }
  };
  const cancelar = async () => {
    if (cambios && !(await confirmar({ mensaje: t("mesDescartarConfirm"), confirmarTexto: t("mesDescartar") }))) return;
    onCancelar();
  };
  const eliminar = async () => {
    if (!(await confirmar({ mensaje: t("mesEliminarPlanoConfirm"), peligro: true, confirmarTexto: t("mesEliminarPlano") }))) return;
    setGuardando(true);
    try {
      await onEliminar();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("mesErrGuardar"));
      setGuardando(false);
    }
  };

  const btn = { ...s.btnGhost, minHeight: 40, fontSize: 13 };
  const num = (id: string, label: string, value: number, onChange: (v: number) => void, step = 0.5, min = 0.5) => (
    <div style={{ minWidth: 0 }}>
      <label htmlFor={id} style={s.label}>{label}</label>
      <input id={id} type="number" inputMode="decimal" step={step} min={min} style={s.input} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Pisos */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }} role="tablist" aria-label={t("mesPisos")}>
        {plano.pisos.map((p, i) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={i === pi}
            className="tap"
            onClick={() => {
              setPi(i);
              setSel(null);
            }}
            style={{
              ...btn,
              ...(i === pi ? { background: "var(--spot)", color: "var(--on-spot)", borderColor: "var(--spot)" } : {}),
            }}
          >
            {p.nombre}
          </button>
        ))}
        {plano.pisos.length < MAX_PISOS && (
          <button className="tap" style={btn} onClick={agregarPiso}>
            + {t("mesAgregarPiso")}
          </button>
        )}
      </div>

      <div className="mes-editor" style={{ display: "grid", gap: 14 }}>
        <style>{`@media (min-width: 1000px){.mes-editor{grid-template-columns:minmax(0,1fr) 280px;align-items:start}}`}</style>
        <div style={{ ...s.card, padding: 12, minWidth: 0 }}>
          {/* Agregar */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            <Grupo titulo={t("mesAgregarMesa")}>
              <button className="tap" style={btn} onClick={() => agregarMesa("redonda")}>◯ {t("mesFormaRedonda")}</button>
              <button className="tap" style={btn} onClick={() => agregarMesa("cuadrada")}>▢ {t("mesFormaCuadrada")}</button>
              <button className="tap" style={btn} onClick={() => agregarMesa("rectangular")}>▭ {t("mesFormaRectangular")}</button>
            </Grupo>
            <Grupo titulo={t("mesAgregarZona")}>
              <button className="tap" style={btn} onClick={() => agregarZona("interior", "rect")}>{t("mesZonaInterior")}</button>
              <button className="tap" style={btn} onClick={() => agregarZona("exterior", "rect")}>{t("mesZonaExterior")}</button>
              <button className="tap" style={btn} onClick={() => agregarZona("interior", "circulo")}>{t("mesZonaCirculo")}</button>
            </Grupo>
          </div>
          <PlanoMesas
            piso={piso}
            editable
            sel={sel}
            onSel={setSel}
            onCambio={setPiso}
            onBorrar={borrarSel}
            onSoltarMesa={alSoltarMesa}
            ariaLabel={t("mesPlanoDe", { p: piso.nombre })}
          />
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--fg-3)" }}>{t("mesAyudaEditor")}</p>
        </div>

        {/* Propiedades */}
        <aside style={{ ...s.card, padding: 14, display: "grid", gap: 12, minWidth: 0 }} aria-label={t("mesPropiedades")}>
          {mesaSel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--fg)" }}>{t("mesMesaN", { n: nombreMesa(mesaSel) })}</h3>
              {mesaSel.unidas?.length ? (
                <>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)" }}>
                    {t("mesCombinadaDesc", { n: numerosDe(mesaSel).join(", ") })}
                  </p>
                  <button className="tap" style={{ ...s.btnGhost, justifySelf: "start" }} onClick={separar}>
                    {t("mesSeparar")}
                  </button>
                </>
              ) : (
              <div>
                <label htmlFor={`${uid}-num`} style={s.label}>{t("mesNumero")}</label>
                <input
                  key={mesaSel.mesa}
                  id={`${uid}-num`}
                  type="number"
                  min={1}
                  max={500}
                  style={s.input}
                  defaultValue={mesaSel.mesa}
                  aria-invalid={!!numError}
                  aria-describedby={numError ? `${uid}-numerr` : undefined}
                  onBlur={(e) => cambiarNumero(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && cambiarNumero((e.target as HTMLInputElement).value)}
                />
                {numError && <p id={`${uid}-numerr`} role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "var(--err)" }}>{numError}</p>}
              </div>
              )}
              {piso.mesas.length > 1 && (
                <div>
                  <label htmlFor={`${uid}-juntar`} style={s.label}>{t("mesJuntarCon")}</label>
                  <select
                    id={`${uid}-juntar`}
                    style={s.input}
                    value=""
                    onChange={(e) => {
                      const otra = piso.mesas.find((m) => m.mesa === e.target.value);
                      if (otra) juntar(mesaSel, otra);
                    }}
                  >
                    <option value="">{t("mesJuntarElegir")}</option>
                    {piso.mesas
                      .filter((m) => m.mesa !== mesaSel.mesa)
                      .map((m) => (
                        <option key={m.mesa} value={m.mesa}>{t("mesMesaN", { n: nombreMesa(m) })}</option>
                      ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor={`${uid}-forma`} style={s.label}>{t("mesForma")}</label>
                <select id={`${uid}-forma`} style={s.input} value={mesaSel.forma} onChange={(e) => cambiarMesa({ forma: e.target.value as FormaMesa })}>
                  <option value="redonda">{t("mesFormaRedonda")}</option>
                  <option value="cuadrada">{t("mesFormaCuadrada")}</option>
                  <option value="rectangular">{t("mesFormaRectangular")}</option>
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {num(`${uid}-mw`, t("mesAnchoM"), mesaSel.w, (v) => cambiarMesa({ w: Math.max(0.4, Math.min(20, v || 0.4)) }), 0.25, 0.4)}
                {num(`${uid}-mh`, t("mesLargoM"), mesaSel.h, (v) => cambiarMesa({ h: Math.max(0.4, Math.min(20, v || 0.4)) }), 0.25, 0.4)}
              </div>
              <button style={{ ...s.btnDanger, justifySelf: "start", minHeight: 40 }} onClick={borrarSel}>{t("mesQuitarMesa")}</button>
            </>
          ) : zonaSel ? (
            <>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--fg)" }}>{t("mesZona")}</h3>
              <div>
                <label htmlFor={`${uid}-zn`} style={s.label}>{t("mesNombre")}</label>
                <input id={`${uid}-zn`} style={s.input} maxLength={30} value={zonaSel.nombre} onChange={(e) => cambiarZona({ nombre: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`${uid}-zt`} style={s.label}>{t("mesTipoZona")}</label>
                <select id={`${uid}-zt`} style={s.input} value={zonaSel.tipo} onChange={(e) => cambiarZona({ tipo: e.target.value as ZonaPlano["tipo"] })}>
                  <option value="interior">{t("mesZonaInterior")}</option>
                  <option value="exterior">{t("mesZonaExterior")}</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-zf`} style={s.label}>{t("mesForma")}</label>
                <select id={`${uid}-zf`} style={s.input} value={zonaSel.forma} onChange={(e) => cambiarZona({ forma: e.target.value as ZonaPlano["forma"] })}>
                  <option value="rect">{t("mesFormaRect")}</option>
                  <option value="circulo">{t("mesFormaCirculo")}</option>
                </select>
              </div>
              <button style={{ ...s.btnDanger, justifySelf: "start", minHeight: 40 }} onClick={borrarSel}>{t("mesQuitarZona")}</button>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: 15, color: "var(--fg)" }}>{piso.nombre}</h3>
              <div>
                <label htmlFor={`${uid}-pn`} style={s.label}>{t("mesNombrePiso")}</label>
                <input id={`${uid}-pn`} style={s.input} maxLength={30} value={piso.nombre} onChange={(e) => setPiso({ ...piso, nombre: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {num(`${uid}-pa`, t("mesAnchoM"), piso.ancho, (v) => medida("ancho", v), 0.5, 2)}
                {num(`${uid}-pl`, t("mesLargoM"), piso.alto, (v) => medida("alto", v), 0.5, 2)}
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>{t("mesAyudaPiso")}</p>
              {plano.pisos.length > 1 && (
                <button style={{ ...s.btnDanger, justifySelf: "start", minHeight: 40 }} onClick={borrarPiso}>{t("mesBorrarPiso")}</button>
              )}
            </>
          )}
        </aside>
      </div>

      {error && <p role="alert" style={{ margin: 0, color: "var(--err)", fontWeight: 600 }}>{error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button className="tap" style={s.btnPrimary} onClick={guardar} disabled={guardando}>
          {guardando ? t("mesGuardando") : t("mesGuardarPlano")}
        </button>
        <button className="tap" style={s.btnGhost} onClick={cancelar} disabled={guardando}>{t("mesCancelar")}</button>
        {existe && (
          <button className="tap" style={{ ...s.btnDanger, marginLeft: "auto", minHeight: 40 }} onClick={eliminar} disabled={guardando}>
            {t("mesEliminarPlano")}
          </button>
        )}
      </div>
    </div>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={titulo} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginRight: 10 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</span>
      {children}
    </div>
  );
}
