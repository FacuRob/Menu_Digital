import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  categoriasService,
  configuracionService,
  serviciosService,
  getApiErrorMessage,
  onboardingService,
  productosService,
  uploadService,
  type Configuracion,
  type Funcion,
  type Ofrece,
  type RubroElegido,
} from "../../services/api";
import { useLang } from "../../lib/i18n";
import { AccesoLayout } from "../../components/Acceso";
import RubroSelector from "../../components/RubroSelector";
import { useRubros } from "../../lib/rubros";
import { PROVINCIAS } from "../../lib/provincias";
import { MENU_PREVIEW_BASE, menuPath } from "../../lib/menuUrl";
import { IconSparkle, IconCheck } from "../../lib/icons";

// Onboarding en 8 pasos. El 1 (crear la cuenta) ya pasó al llegar acá.
// Cada "Seguir" guarda lo del paso y el número de paso en el negocio
// (PUT /api/onboarding), así se puede cortar y retomar después.
const TOTAL = 8;
type Paso = 2 | 3 | 4 | 5 | 6 | 7 | 8;

const OFRECE: { code: Ofrece; key: string }[] = [
  { code: "productos", key: "obOfreceProductos" },
  { code: "personalizados", key: "obOfrecePersonalizados" },
  { code: "servicios", key: "obOfreceServicios" },
];
const FUNCIONES: { code: Funcion; key: string }[] = [
  { code: "venta_directa", key: "obFnVentaDirecta" },
  { code: "pedidos", key: "obFnPedidos" },
  { code: "retiro", key: "obFnRetiro" },
  { code: "envios", key: "obFnEnvios" },
  { code: "presencial", key: "obFnPresencial" },
  { code: "virtual", key: "obFnVirtual" },
  { code: "reservas", key: "obFnReservas" },
  { code: "presupuestos", key: "obFnPresupuestos" },
];
// Lo que todavía no existe en el sistema: se guarda la elección, pero se
// avisa que llega más adelante (no prometemos algo que no anda hoy).
const PRONTO: Funcion[] = ["reservas", "presupuestos", "virtual"];

type Datos = Pick<Configuracion, "nombre" | "descripcion" | "telefono" | "email" | "direccion" | "ciudad" | "provincia">;
type Visual = Pick<Configuracion, "logo_url" | "portada_url" | "color_primario" | "whatsapp" | "horarios">;

export default function Onboarding() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { categorias } = useRubros();

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [paso, setPaso] = useState<Paso>(2);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [datos, setDatos] = useState<Datos>({ nombre: "", descripcion: "", telefono: "", email: "", direccion: "", ciudad: "", provincia: "" });
  const [rubro, setRubro] = useState<RubroElegido>({ rubro_categoria: null, rubro_especialidad: null });
  const [ofrece, setOfrece] = useState<Ofrece[] | null>(null);
  const [funciones, setFunciones] = useState<Funcion[] | null>(null);
  const [visual, setVisual] = useState<Visual>({ logo_url: "", portada_url: "", color_primario: "#ff5722", whatsapp: "", horarios: "" });
  const [subiendo, setSubiendo] = useState<"" | "logo_url" | "portada_url">("");
  const [slug, setSlug] = useState<string | null>(null);
  const [cantProductos, setCantProductos] = useState(0);
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });
  const [agregados, setAgregados] = useState<string[]>([]);
  // Módulos que salen de lo elegido (el paso 7 depende de si hay productos).
  const [conProductos, setConProductos] = useState(true);
  const [conServicios, setConServicios] = useState(false);

  const cargar = () =>
    Promise.all([
      onboardingService.get().catch(() => null),
      configuracionService.get().catch(() => null),
      productosService.getAll().catch(() => []),
    ]).then(([ob, cfg, prods]) => {
      // Sin la configuración no se sigue: los pasos guardarían valores vacíos
      // encima de los que el negocio ya tiene.
      if (!cfg) {
        setErrorCarga(true);
        setCargando(false);
        return;
      }
      setErrorCarga(false);
      const p = ob?.onboarding?.paso;
      if (p && p >= 2 && p <= TOTAL) setPaso(p as Paso);
      if (ob?.modulos) {
        setConProductos(ob.modulos.productos !== false);
        setConServicios(ob.modulos.servicios === true);
      }
      if (ob?.onboarding?.ofrece) setOfrece(ob.onboarding.ofrece);
      if (ob?.onboarding?.funciones) setFunciones(ob.onboarding.funciones);
      setSlug(ob?.slug ?? cfg?.slug ?? null);
      if (cfg) {
        setDatos({
          nombre: cfg.nombre || "",
          descripcion: cfg.descripcion || "",
          telefono: cfg.telefono || "",
          email: cfg.email || "",
          direccion: cfg.direccion || "",
          ciudad: cfg.ciudad || "",
          provincia: cfg.provincia || "",
        });
        setRubro({ rubro_categoria: cfg.rubro_categoria ?? null, rubro_especialidad: cfg.rubro_especialidad ?? null });
        setVisual({
          logo_url: cfg.logo_url || "",
          portada_url: cfg.portada_url || "",
          color_primario: cfg.color_primario || "#ff5722",
          whatsapp: cfg.whatsapp || "",
          horarios: cfg.horarios || "",
        });
      }
      setCantProductos(prods.length);
      setCargando(false);
    });
  useEffect(() => {
    cargar();
  }, []);

  // Sugerencias del rubro elegido (especialidad o, si no, su categoría).
  const categoria = categorias?.find((c) => c.codigo === rubro.rubro_categoria);
  const sugerencias = useMemo(() => {
    const esp = categoria?.especialidades.find((e) => e.codigo === rubro.rubro_especialidad);
    return esp?.sugerencias || categoria?.sugerencias || {};
  }, [categoria, rubro.rubro_especialidad]);
  const ofreceSel = ofrece ?? sugerencias.ofrece ?? ["productos"];
  const funcionesSel = funciones ?? sugerencias.funciones ?? ["pedidos", "retiro"];

  // Guarda lo del paso actual. Devuelve false si hay que quedarse.
  const guardarPaso = async (): Promise<boolean> => {
    if (paso === 2) {
      if (!datos.nombre.trim()) {
        setError(t("obNombreFalta"));
        document.getElementById("ob-nombre")?.focus();
        return false;
      }
      const cfg = await configuracionService.update({ ...datos, nombre: datos.nombre.trim() });
      if (cfg.slug) setSlug(cfg.slug);
    }
    if (paso === 3 && rubro.rubro_categoria) await configuracionService.update(rubro);
    if (paso === 4) {
      const r = await onboardingService.update({ ofrece: ofreceSel });
      if (r.modulos) {
        setConProductos(r.modulos.productos !== false);
        setConServicios(r.modulos.servicios === true);
      }
    }
    if (paso === 5) {
      const r = await onboardingService.update({ funciones: funcionesSel });
      if (r.modulos) {
        setConProductos(r.modulos.productos !== false);
        setConServicios(r.modulos.servicios === true);
      }
      // Lo que ya existe se prende ya: retiro, delivery y (en gastronomía) mesa.
      await configuracionService.update({
        retiro_activo: funcionesSel.includes("retiro"),
        delivery_activo: funcionesSel.includes("envios"),
        ...(categoria?.familia === "gastronomia" ? { mesas_activo: funcionesSel.includes("presencial") } : {}),
      });
    }
    if (paso === 6) await configuracionService.update(visual);
    if (paso === 7 && (nuevo.nombre.trim() || nuevo.precio.trim())) {
      setError(t("obProdSinAgregar"));
      return false;
    }
    return true;
  };

  const ir = async (destino: Paso | "panel") => {
    setError("");
    setGuardando(true);
    try {
      if (destino === "panel") {
        // "Seguir después" nunca traba: guarda lo que pueda del paso y sale.
        await guardarPaso().catch(() => false);
      } else if (destino > paso && !(await guardarPaso())) return;
      const nuevoPaso = destino === "panel" ? paso : destino;
      await onboardingService.update({ paso: nuevoPaso });
      if (destino === "panel") navigate("/admin/dashboard");
      else setPaso(destino);
    } catch (e) {
      setError(getApiErrorMessage(e, t("obGuardarError")));
    } finally {
      setGuardando(false);
    }
  };

  const publicar = async () => {
    setError("");
    setGuardando(true);
    try {
      await onboardingService.update({ paso: 8, completado: true });
      navigate("/admin/dashboard");
    } catch (e) {
      setError(getApiErrorMessage(e, t("obGuardarError")));
    } finally {
      setGuardando(false);
    }
  };

  const subir = async (e: ChangeEvent<HTMLInputElement>, campo: "logo_url" | "portada_url") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setSubiendo(campo);
    try {
      const { url } = await uploadService.uploadImagen(file);
      setVisual((v) => ({ ...v, [campo]: url }));
    } catch (err) {
      setError(getApiErrorMessage(err, t("obSubirError")));
    } finally {
      setSubiendo("");
    }
  };

  // Alta rápida: nombre + precio. Usa la primera categoría o crea "General".
  const agregarProducto = async () => {
    const precio = Number(nuevo.precio.replace(",", "."));
    if (!nuevo.nombre.trim() || !Number.isFinite(precio) || precio < 0) {
      setError(t("obProdFalta"));
      return;
    }
    setError("");
    setGuardando(true);
    try {
      if (!conProductos) {
        await serviciosService.create({
          nombre: nuevo.nombre.trim(),
          descripcion: null,
          imagen_url: null,
          categoria: null,
          tipo_precio: "fijo",
          precio,
          duracion_min: null,
          modalidades: ["presencial"],
          requiere_turno: false,
          requiere_presupuesto: false,
          activo: true,
          orden: cantProductos,
        });
      } else {
        const cats = await categoriasService.getAll();
        const cat = cats[0] || (await categoriasService.create({ nombre: t("obCatGeneral"), orden: 1, activo: true }));
        await productosService.create({
          nombre: nuevo.nombre.trim(),
          descripcion: "",
          precio,
          imagen_url: null,
          categoria_id: cat.id,
          disponible: true,
          orden: cantProductos + 1,
        });
      }
      setAgregados((a) => [...a, nuevo.nombre.trim()]);
      setCantProductos((n) => n + 1);
      setNuevo({ nombre: "", precio: "" });
      document.getElementById("ob-pnombre")?.focus();
    } catch (e) {
      setError(getApiErrorMessage(e, t("obGuardarError")));
    } finally {
      setGuardando(false);
    }
  };

  const titulos: Record<Paso, [string, string]> = {
    2: ["obDatosTitle", "obDatosSub"],
    3: ["obRubroTitle", "obRubroSubtitle"],
    4: ["obOfreceTitle", "obOfreceSub"],
    5: ["obFuncTitle", "obFuncSub"],
    6: ["obVisualTitle", "obVisualSub"],
    7: ["obCatalogoTitle", "obCatalogoSub"],
    8: ["obPublicarTitle", "obPublicarSub"],
  };

  const chip = (on: boolean) =>
    `min-h-11 cursor-pointer rounded-full border-2 px-4 text-[0.9375rem] font-semibold transition-colors ${
      on ? "border-[var(--tinta)] bg-[var(--tinta)] text-white" : "border-[var(--tinta)]/15 hover:border-[var(--tinta)]"
    }`;
  const toggle = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  if (cargando || errorCarga) {
    return (
      <AccesoLayout ancho={720} titulo={t("obWelcome")}>
        {cargando ? (
          <p role="status" className="text-[var(--gris)]">{t("subLoading")}</p>
        ) : (
          <>
            <p role="alert" className="rounded-2xl bg-[#fdecea] px-4 py-3 font-semibold text-[#a3241a]">{t("obCargaError")}</p>
            <button
              type="button"
              className="hp-btn mt-5"
              onClick={() => {
                setCargando(true);
                cargar();
              }}
            >
              {t("obReintentar")}
            </button>
          </>
        )}
      </AccesoLayout>
    );
  }

  return (
    <AccesoLayout
      ancho={720}
      titulo={t(titulos[paso][0])}
      subtitulo={t(titulos[paso][1])}
      antes={
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--gris)]">
            <IconSparkle size={15} /> {t("obStep", { n: paso, total: TOTAL })}
          </p>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: TOTAL }, (_, i) => i + 1).map((s) => (
              <span
                key={s}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: s <= paso ? "var(--aji)" : "var(--hueso)" }}
              />
            ))}
          </div>
        </div>
      }
    >
      {/* ── 2. Información del negocio ── */}
      {paso === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="ob-nombre" label={t("obNombre")} className="sm:col-span-2">
            <input id="ob-nombre" className="auth-input pl-4!" value={datos.nombre} maxLength={150} required
              aria-invalid={!!error && !datos.nombre.trim()} aria-describedby={error ? "ob-err" : undefined}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} autoComplete="organization" />
          </Campo>
          <Campo id="ob-desc" label={t("obDescripcion")} className="sm:col-span-2">
            <textarea id="ob-desc" className="auth-input pl-4!" rows={2} value={datos.descripcion || ""} maxLength={500}
              onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} placeholder={t("obDescripcionPh")} />
          </Campo>
          <Campo id="ob-tel" label={t("obTelefono")}>
            <input id="ob-tel" className="auth-input pl-4!" type="tel" value={datos.telefono || ""} autoComplete="tel"
              onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} />
          </Campo>
          <Campo id="ob-email" label={t("obEmail")}>
            <input id="ob-email" className="auth-input pl-4!" type="email" value={datos.email || ""} autoComplete="email"
              onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
          </Campo>
          <Campo id="ob-dir" label={t("obDireccion")} className="sm:col-span-2">
            <input id="ob-dir" className="auth-input pl-4!" value={datos.direccion || ""} autoComplete="street-address"
              onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} />
          </Campo>
          <Campo id="ob-ciudad" label={t("obCiudad")}>
            <input id="ob-ciudad" className="auth-input pl-4!" value={datos.ciudad || ""} autoComplete="address-level2"
              onChange={(e) => setDatos({ ...datos, ciudad: e.target.value })} />
          </Campo>
          <Campo id="ob-prov" label={t("obProvincia")}>
            <select id="ob-prov" className="auth-input pl-4! cursor-pointer" value={datos.provincia || ""}
              onChange={(e) => setDatos({ ...datos, provincia: e.target.value })}>
              <option value="">{t("cfgProvinceNone")}</option>
              {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Campo>
        </div>
      )}

      {/* ── 3. Rubro ── */}
      {paso === 3 && (
        <>
          <RubroSelector tema="acceso" value={rubro} onChange={setRubro} />
          {!rubro.rubro_categoria && <Nota>{t("obRubroOpcional")}</Nota>}
        </>
      )}

      {/* ── 4. ¿Qué ofrece? ── */}
      {paso === 4 && (
        <>
          <div role="group" aria-label={t("obOfreceTitle")} className="flex flex-wrap gap-2">
            {OFRECE.map((o) => (
              <button key={o.code} type="button" aria-pressed={ofreceSel.includes(o.code)} className={chip(ofreceSel.includes(o.code))}
                onClick={() => setOfrece(toggle(ofreceSel, o.code))}>
                {t(o.key)}
              </button>
            ))}
          </div>
          <Nota>{t("obOfreceNota")}</Nota>
          {cantProductos > 0 && !ofreceSel.includes("productos") && !ofreceSel.includes("personalizados") && (
            <Nota>{t("obOfreceConProductos", { n: cantProductos })}</Nota>
          )}
        </>
      )}

      {/* ── 5. ¿Cómo trabaja? ── */}
      {paso === 5 && (
        <>
          <div role="group" aria-label={t("obFuncTitle")} className="flex flex-wrap gap-2">
            {FUNCIONES.map((f) => (
              <button key={f.code} type="button" aria-pressed={funcionesSel.includes(f.code)} className={chip(funcionesSel.includes(f.code))}
                onClick={() => setFunciones(toggle(funcionesSel, f.code))}>
                {t(f.key)}
                {PRONTO.includes(f.code) && " "}
                {PRONTO.includes(f.code) && (
                  <span className="ml-1.5 text-xs font-bold uppercase tracking-wide opacity-75">{t("obPronto")}</span>
                )}
              </button>
            ))}
          </div>
          {funcionesSel.some((f) => PRONTO.includes(f)) && <Nota>{t("obFuncPronto")}</Nota>}
        </>
      )}

      {/* ── 6. Configuración visual ── */}
      {paso === 6 && (
        <div className="grid gap-5">
          <p role="status" className="sr-only">{subiendo ? t("obSubiendo") : ""}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["logo_url", "portada_url"] as const).map((campo) => (
              <div key={campo}>
                <p id={`ob-${campo}`} className="hp-label mb-2 text-[var(--gris)]">{t(campo === "logo_url" ? "obLogo" : "obPortada")}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="grid shrink-0 place-items-center overflow-hidden bg-[var(--hueso)]"
                    style={{ width: campo === "logo_url" ? 64 : 112, height: 64, borderRadius: campo === "logo_url" ? 999 : 14 }}
                  >
                    {visual[campo] ? <img src={visual[campo] || ""} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <label className="hp-btn-borde cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--cobalto)]">
                    <span id={`ob-${campo}-txt`}>
                      {subiendo === campo ? t("obSubiendo") : visual[campo] ? t("obCambiar") : t("obElegirImagen")}
                    </span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                      aria-labelledby={`ob-${campo} ob-${campo}-txt`}
                      disabled={!!subiendo} onChange={(e) => subir(e, campo)} />
                  </label>
                  {visual[campo] && !subiendo && (
                    <button
                      type="button"
                      className="min-h-11 cursor-pointer px-2 font-semibold underline underline-offset-4"
                      aria-label={`${t("obQuitar")} ${t(campo === "logo_url" ? "obLogo" : "obPortada")}`}
                      onClick={() => setVisual((v) => ({ ...v, [campo]: "" }))}
                    >
                      {t("obQuitar")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div>
            <label htmlFor="ob-color" className="hp-label mb-2 block text-[var(--gris)]">{t("obColor")}</label>
            <div className="flex items-center gap-3">
              <input id="ob-color" type="color" value={visual.color_primario || "#ff5722"}
                onChange={(e) => setVisual({ ...visual, color_primario: e.target.value })}
                className="h-11 w-16 cursor-pointer rounded-xl border-2 border-[var(--tinta)]/15 bg-white p-1" />
              <span className="font-mono text-sm text-[var(--gris)]">{visual.color_primario}</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id="ob-wa" label={t("obWhatsapp")}>
              <input id="ob-wa" className="auth-input pl-4!" type="tel" autoComplete="tel" value={visual.whatsapp || ""} placeholder="11 1234 5678"
                onChange={(e) => setVisual({ ...visual, whatsapp: e.target.value })} />
            </Campo>
            <Campo id="ob-hor" label={t("obHorarios")}>
              <input id="ob-hor" className="auth-input pl-4!" value={visual.horarios || ""} placeholder={t("obHorariosPh")}
                onChange={(e) => setVisual({ ...visual, horarios: e.target.value })} />
            </Campo>
          </div>
        </div>
      )}

      {/* ── 7. Catálogo ── */}
      {paso === 7 && !conProductos && !conServicios && <Nota>{t("obCatalogoSinProductos")}</Nota>}
      {paso === 7 && (conProductos || conServicios) && (
        <>
          <p className="mb-4 text-[0.9375rem]">
            {cantProductos === 0 ? t("obCatalogoVacio") : cantProductos === 1 ? t("obCatalogoUno") : t("obCatalogoHay", { n: cantProductos })}
          </p>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              agregarProducto();
            }}
          >
            <Campo id="ob-pnombre" label={conProductos ? t("obProdNombre") : t("obServNombre")}>
              <input id="ob-pnombre" className="auth-input pl-4!" value={nuevo.nombre} maxLength={150}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </Campo>
            <Campo id="ob-pprecio" label={t("obProdPrecio")}>
              <input id="ob-pprecio" className="auth-input pl-4!" inputMode="decimal" value={nuevo.precio}
                onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
            </Campo>
            <button type="submit" className="hp-btn" disabled={guardando}>{t("obAgregar")}</button>
          </form>
          <div role="status" aria-live="polite">
          {agregados.length > 0 && (
            <ul className="mt-4 grid gap-1.5">
              {agregados.map((n, i) => (
                <li key={i} className="flex items-center gap-2 text-[0.9375rem]">
                  <span className="text-[var(--verde,#1f8a4c)]"><IconCheck size={16} /></span> {n}
                </li>
              ))}
            </ul>
          )}
          </div>
          <Nota>{t("obCatalogoNota")}</Nota>
        </>
      )}

      {/* ── 8. Vista previa y publicar ── */}
      {paso === 8 && (
        <>
          <div className="overflow-hidden rounded-2xl border-2 border-[var(--tinta)]/10 bg-[var(--hueso)]">
            <iframe title={t("obPreviewTitle")} src={`${MENU_PREVIEW_BASE}${menuPath(slug)}`} className="block h-[440px] w-full bg-white" />
          </div>
          <a
            href={`${MENU_PREVIEW_BASE}${menuPath(slug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            {t("obAbrirPestana")}
          </a>
          <Nota>{t("obPublicarNota")}</Nota>
        </>
      )}

      {error && (
        <p id="ob-err" role="alert" className="mt-5 rounded-2xl bg-[#fdecea] px-4 py-3 text-[0.9375rem] font-semibold text-[#a3241a]">
          {error}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
        {paso > 2 && (
          <button type="button" onClick={() => ir((paso - 1) as Paso)} disabled={guardando} className="hp-btn-borde">
            ← {t("back")}
          </button>
        )}
        <button
          type="button"
          onClick={() => ir("panel")}
          disabled={guardando}
          className="min-h-11 cursor-pointer px-3 font-semibold text-[var(--tinta)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--cobalto)]"
        >
          {t("obDespues")}
        </button>
        {paso < 8 ? (
          <button type="button" onClick={() => ir((paso + 1) as Paso)} disabled={guardando || !!subiendo} aria-busy={guardando} className="hp-btn sm:ml-auto">
            {t("obContinue")}
          </button>
        ) : (
          <button type="button" onClick={publicar} disabled={guardando} aria-busy={guardando} className="hp-btn sm:ml-auto">
            {t("obPublicar")}
          </button>
        )}
      </div>
    </AccesoLayout>
  );
}

function Campo({ id, label, className = "", children }: { id: string; label: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="hp-label mb-2 block text-[var(--gris)]">{label}</label>
      {children}
    </div>
  );
}

function Nota({ children }: { children: ReactNode }) {
  return <p className="mt-5 rounded-2xl bg-[var(--hueso)] px-4 py-3.5 text-[0.9375rem] leading-relaxed">{children}</p>;
}
