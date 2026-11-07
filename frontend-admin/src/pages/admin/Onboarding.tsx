import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { configuracionService, type TipoRubro } from "../../services/api";
import { useLang } from "../../lib/i18n";
import { AccesoLayout } from "../../components/Acceso";
import {
  IconUtensils,
  IconBag,
  IconTools,
  IconBox,
  IconSparkle,
} from "../../lib/icons";

// Rubros (mismo set que ConfiguracionEditor / backend). Definen los iconos del
// menú y el vocabulario del panel.
const RUBROS: {
  code: TipoRubro;
  labelKey: string;
  descKey: string;
  Icon: ComponentType<{ size?: number }>;
}[] = [
  { code: "gastronomia", labelKey: "rubroGastro", descKey: "rubroGastroDesc", Icon: IconUtensils },
  { code: "retail", labelKey: "rubroRetail", descKey: "rubroRetailDesc", Icon: IconBag },
  { code: "servicios", labelKey: "rubroServicios", descKey: "rubroServiciosDesc", Icon: IconTools },
  { code: "generico", labelKey: "rubroGenerico", descKey: "rubroGenericoDesc", Icon: IconBox },
];

const MONEDAS = ["ARS", "USD", "EUR", "BRL", "MXN", "CLP", "COP", "PEN", "UYU", "PYG", "BOB", "GTQ"];

export default function Onboarding() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [rubro, setRubro] = useState<TipoRubro>("gastronomia");
  const [moneda, setMoneda] = useState("ARS");
  const [mesa, setMesa] = useState(false);
  const [retiro, setRetiro] = useState(true);
  const [delivery, setDelivery] = useState(false);
  const [saving, setSaving] = useState(false);
  // Si la persona ya eligió algo, la configuración guardada no lo pisa.
  const tocado = useRef(false);

  // Prefill con la config actual del negocio (creado en el signup).
  useEffect(() => {
    configuracionService
      .get()
      .then((cfg) => {
        if (tocado.current) return;
        if (cfg.tipo_rubro) setRubro(cfg.tipo_rubro as TipoRubro);
        if (cfg.moneda) setMoneda(cfg.moneda);
        setMesa(!!cfg.mesas_activo);
        setRetiro(cfg.retiro_activo !== false);
        setDelivery(!!cfg.delivery_activo);
      })
      .catch(() => {});
  }, []);

  const irADashboard = () => navigate("/admin/dashboard");

  // Guarda el rubro y avanza (así no se pierde si luego omite el paso 2).
  const continuar = async () => {
    setSaving(true);
    try {
      await configuracionService.update({ tipo_rubro: rubro });
    } catch {
      /* si falla, igual dejamos avanzar; se puede reintentar en Configuración */
    } finally {
      setSaving(false);
      setStep(2);
    }
  };

  const terminar = async () => {
    setSaving(true);
    try {
      await configuracionService.update({
        tipo_rubro: rubro,
        moneda,
        mesas_activo: mesa,
        retiro_activo: retiro,
        delivery_activo: delivery,
      });
    } catch {
      /* no bloqueamos el ingreso por un error de guardado */
    } finally {
      setSaving(false);
      irADashboard();
    }
  };

  const chip = (on: boolean) =>
    `min-h-11 cursor-pointer rounded-full border-2 px-4 text-[0.9375rem] font-semibold transition-colors ${
      on ? "border-[var(--tinta)] bg-[var(--tinta)] text-white" : "border-[var(--tinta)]/15 hover:border-[var(--tinta)]"
    }`;

  return (
    <AccesoLayout
      ancho={620}
      titulo={step === 1 ? t("obRubroTitle") : t("obTuneTitle")}
      subtitulo={step === 1 ? t("obRubroSubtitle") : t("obTuneSubtitle")}
      antes={
        <div className="mb-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--gris)]">
            <IconSparkle size={15} /> {t("obWelcome")}
          </p>
          <p className="sr-only">{t("obStep", { n: step, total: 2 })}</p>
          <div className="flex gap-1.5" aria-hidden>
            {[1, 2].map((s) => (
              <span
                key={s}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: s <= step ? "var(--aji)" : "var(--hueso)" }}
              />
            ))}
          </div>
        </div>
      }
    >
      {/* ── PASO 1: Rubro ── */}
      {step === 1 && (
        <>
          <div role="radiogroup" aria-label={t("obRubroTitle")} className="grid gap-3 sm:grid-cols-2">
            {RUBROS.map((r, i) => {
              const activo = rubro === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  tabIndex={activo ? 0 : -1}
                  onClick={() => {
                    tocado.current = true;
                    setRubro(r.code);
                  }}
                  onKeyDown={(e) => {
                    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
                    if (!paso) return;
                    e.preventDefault();
                    const sig = RUBROS[(i + paso + RUBROS.length) % RUBROS.length];
                    tocado.current = true;
                    setRubro(sig.code);
                    const grupo = e.currentTarget.parentElement;
                    requestAnimationFrame(() =>
                      grupo?.querySelector<HTMLButtonElement>(`[data-rubro="${sig.code}"]`)?.focus(),
                    );
                  }}
                  data-rubro={r.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors ${
                    activo ? "border-[var(--tinta)] bg-[var(--hueso)]" : "border-[var(--tinta)]/10 hover:border-[var(--tinta)]/40"
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                      activo ? "bg-[var(--tinta)] text-[var(--aji)]" : "bg-[var(--hueso)] text-[var(--gris)]"
                    }`}
                    aria-hidden
                  >
                    <r.Icon size={22} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">{t(r.labelKey)}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-[var(--gris)]">{t(r.descKey)}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={irADashboard} disabled={saving} className="hp-btn-borde">
              {t("obSkip")}
            </button>
            <button type="button" onClick={continuar} disabled={saving} aria-busy={saving} className="hp-btn">
              {t("obContinue")}
            </button>
          </div>
        </>
      )}

      {/* ── PASO 2: Puesta a punto rápida ── */}
      {step === 2 && (
        <>
          <p id="ob-modalidad" className="hp-label mb-2 text-[var(--gris)]">
            {t("obModalidad")}
          </p>
          <div role="group" aria-labelledby="ob-modalidad" className="mb-6 flex flex-wrap gap-2">
            {([
              ["obMesa", mesa, setMesa],
              ["obRetiro", retiro, setRetiro],
              ["obDelivery", delivery, setDelivery],
            ] as const).map(([key, val, set]) => (
              <button
                key={key}
                type="button"
                aria-pressed={val}
                onClick={() => {
                  tocado.current = true;
                  set(!val);
                }}
                className={chip(val)}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <label htmlFor="ob-moneda" className="hp-label mb-2 block text-[var(--gris)]">
            {t("obCurrency")}
          </label>
          <select
            id="ob-moneda"
            value={moneda}
            onChange={(e) => {
              tocado.current = true;
              setMoneda(e.target.value);
            }}
            className="auth-input cursor-pointer"
            style={{ paddingLeft: 16 }}
          >
            {MONEDAS.map((c) => (
              <option key={c} value={c}>
                {t(`cur_${c}`)}
              </option>
            ))}
          </select>

          <p className="mt-5 rounded-2xl bg-[var(--hueso)] px-4 py-3.5 text-[0.9375rem] leading-relaxed">{t("obTuneNote")}</p>

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button type="button" onClick={() => setStep(1)} className="hp-btn-borde">
              ← {t("back")}
            </button>
            <button
              type="button"
              onClick={irADashboard}
              disabled={saving}
              className="min-h-11 cursor-pointer px-3 font-semibold text-[var(--tinta)] underline decoration-[1.5px] underline-offset-4 hover:text-[var(--cobalto)]"
            >
              {t("obSkip")}
            </button>
            <button type="button" onClick={terminar} disabled={saving} aria-busy={saving} className="hp-btn sm:ml-auto">
              {saving && (
                <span
                  aria-hidden
                  className="inline-block h-4 w-4 rounded-full border-2 border-current/25 border-t-current"
                  style={{ animation: "spin 0.7s linear infinite" }}
                />
              )}
              {t("obFinish")}
            </button>
          </div>
        </>
      )}
    </AccesoLayout>
  );
}
