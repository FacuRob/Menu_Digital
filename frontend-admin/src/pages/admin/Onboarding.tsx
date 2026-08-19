import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { configuracionService, type TipoRubro } from "../../services/api";
import { useLang } from "../../lib/i18n";
import { BRAND_NAME, BRAND_GRADIENT, BRAND_LOGO_FULL } from "../../lib/brand";
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

  // Prefill con la config actual del negocio (creado en el signup).
  useEffect(() => {
    configuracionService
      .get()
      .then((cfg) => {
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

  // ── Estilos (mismos tokens que el login) ──
  const card: React.CSSProperties = {
    background: "#1a1d27",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: "26px 24px",
  };
  const primaryBtn: React.CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    background: BRAND_GRADIENT,
    border: "none",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.7 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  const ghostBtn: React.CSSProperties = {
    padding: "12px 18px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#94a3b8",
    fontSize: 14,
    cursor: "pointer",
  };
  const label: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* Glow de fondo */}
      <div
        style={{
          position: "fixed",
          top: "16%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 520,
          height: 320,
          background:
            "radial-gradient(ellipse,rgba(99,102,241,0.12) 0%,rgba(6,182,212,0.06) 45%,transparent 72%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 560, position: "relative" }}>
        {/* Marca + progreso */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img
            src={BRAND_LOGO_FULL}
            alt={BRAND_NAME}
            style={{ width: 170, maxWidth: "60%", height: "auto", margin: "0 auto 10px", display: "block" }}
          />
          <p style={{ color: "#94a3b8", fontSize: 13.5, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <IconSparkle size={14} /> {t("obWelcome")}
          </p>
        </div>

        <div style={card}>
          {/* Indicador de paso */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
            {[1, 2].map((s) => (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 99,
                  background: s <= step ? "#6366f1" : "rgba(255,255,255,0.08)",
                  transition: "background .2s",
                }}
              />
            ))}
          </div>

          {/* ── PASO 1: Rubro ── */}
          {step === 1 && (
            <>
              <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                {t("obRubroTitle")}
              </h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 18px" }}>
                {t("obRubroSubtitle")}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                  gap: 10,
                }}
              >
                {RUBROS.map((r) => {
                  const activo = rubro === r.code;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => setRubro(r.code)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 14px",
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        background: activo ? "rgba(99,102,241,0.12)" : "rgba(255,255,255,0.03)",
                        border: `1.5px solid ${activo ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                        transition: "all .15s",
                      }}
                    >
                      <span
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: activo ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                          color: activo ? "#a5b4fc" : "#94a3b8",
                        }}
                      >
                        <r.Icon size={22} />
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", color: "#f1f5f9", fontSize: 14, fontWeight: 600 }}>
                          {t(r.labelKey)}
                        </span>
                        <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 2, lineHeight: 1.3 }}>
                          {t(r.descKey)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button type="button" onClick={irADashboard} style={ghostBtn}>
                  {t("obSkip")}
                </button>
                <button type="button" onClick={continuar} disabled={saving} style={{ ...primaryBtn, marginLeft: "auto" }}>
                  {t("obContinue")}
                </button>
              </div>
            </>
          )}

          {/* ── PASO 2: Puesta a punto rápida ── */}
          {step === 2 && (
            <>
              <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>
                {t("obTuneTitle")}
              </h2>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 18px" }}>
                {t("obTuneSubtitle")}
              </p>

              {/* Modalidad de venta */}
              <label style={label}>{t("obModalidad")}</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
                {([
                  ["obMesa", mesa, setMesa],
                  ["obRetiro", retiro, setRetiro],
                  ["obDelivery", delivery, setDelivery],
                ] as const).map(([key, val, set]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set(!val)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 99,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      background: val ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
                      border: `1.5px solid ${val ? "#6366f1" : "rgba(255,255,255,0.08)"}`,
                      color: val ? "#a5b4fc" : "#94a3b8",
                      transition: "all .15s",
                    }}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>

              {/* Moneda */}
              <label style={label}>{t("obCurrency")}</label>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e2e8f0",
                  fontSize: 14,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {MONEDAS.map((c) => (
                  <option key={c} value={c} style={{ background: "#1a1d27" }}>
                    {t(`cur_${c}`)}
                  </option>
                ))}
              </select>

              {/* Nota: el resto se edita luego en Configuración */}
              <p
                style={{
                  marginTop: 16,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(99,102,241,0.07)",
                  border: "1px solid rgba(99,102,241,0.15)",
                  color: "#94a3b8",
                  fontSize: 12.5,
                  lineHeight: 1.5,
                }}
              >
                {t("obTuneNote")}
              </p>

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button type="button" onClick={() => setStep(1)} style={ghostBtn}>
                  ← {t("back")}
                </button>
                <button type="button" onClick={irADashboard} style={ghostBtn}>
                  {t("obSkip")}
                </button>
                <button type="button" onClick={terminar} disabled={saving} style={{ ...primaryBtn, marginLeft: "auto" }}>
                  {saving && (
                    <span
                      style={{
                        width: 15,
                        height: 15,
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin .7s linear infinite",
                      }}
                    />
                  )}
                  {t("obFinish")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
