import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType } from "react";
import { useStyles } from "./sharedStyles";
import { useLang } from "../lib/i18n";
import {
  IconUtensils,
  IconBag,
  IconTools,
  IconBox,
  IconImage,
  IconCheck,
  IconAlert,
  IconStore,
  IconTruck,
} from "../lib/icons";
import { useIsMobile } from "../lib/useIsMobile";
import { MULTI_MONEDA } from "../lib/money";
import { SideNav, SectionCard } from "./SeccionesUi";
import {
  configuracionService,
  uploadService,
  type Configuracion,
  type HorariosConfig,
  type DiaHorario,
  type TipoRubro,
} from "../services/api";

type Form = Omit<Configuracion, "id">;

const EMPTY: Form = {
  nombre: "",
  descripcion: "",
  direccion: "",
  telefono: "",
  whatsapp: "",
  email: "",
  horarios: "",
  logo_url: "",
  portada_url: "",
  mesas_activo: false,
  mesas_cantidad: 0,
  delivery_activo: false,
  retiro_activo: true,
  color_primario: "#ff5722",
  horarios_config: null,
  moneda: "ARS",
  tipo_rubro: "gastronomia",
};

// Rubros soportados (multi-rubro). Cada uno ajusta el vocabulario del panel.
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

// Códigos de moneda soportados. La etiqueta se traduce con t(`cur_${code}`).
const MONEDAS = [
  "ARS",
  "USD",
  "EUR",
  "BRL",
  "MXN",
  "CLP",
  "COP",
  "PEN",
  "UYU",
  "PYG",
  "BOB",
  "GTQ",
];

// Claves i18n de los días (lun→dom). Se traducen con t(dayKey).
const DIA_KEYS = [
  "dayMon",
  "dayTue",
  "dayWed",
  "dayThu",
  "dayFri",
  "daySat",
  "daySun",
];

const PALETAS = [
  { nameKey: "palOrange", color: "#ff5722" },
  { nameKey: "palRed", color: "#e11d48" },
  { nameKey: "palGreen", color: "#16a34a" },
  { nameKey: "palBlue", color: "#2563eb" },
  { nameKey: "palViolet", color: "#7c3aed" },
  { nameKey: "palTeal", color: "#0d9488" },
  { nameKey: "palFuchsia", color: "#db2777" },
  { nameKey: "palAmber", color: "#d97706" },
];

// ── Secciones del menú lateral ──
// Se muestra una sección a la vez. Cada una lista los campos que le
// pertenecen, para marcar con un punto las que tienen cambios sin guardar.
type SeccionId =
  | "datos"
  | "rubro"
  | "imagenes"
  | "color"
  | "moneda"
  | "servicio"
  | "horarios";

type IconoP = { size?: number };
const svgP = (size = 17) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});
const IconPalette = ({ size }: IconoP) => (
  <svg {...svgP(size)}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="10" cy="7" r="1" />
    <circle cx="15" cy="7.5" r="1" />
  </svg>
);
const IconCoin = ({ size }: IconoP) => (
  <svg {...svgP(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.7 0-2.8.8-2.8 2s1.1 1.7 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.4-.5-2.9-1.3M12 6.5v11" />
  </svg>
);
const IconClock = ({ size }: IconoP) => (
  <svg {...svgP(size)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const GRUPOS: {
  labelKey: string;
  color: string;
  items: {
    id: SeccionId;
    labelKey: string;
    accent: string;
    Icon: ComponentType<{ size?: number }>;
    campos: (keyof Form)[];
  }[];
}[] = [
  {
    labelKey: "cfgNavBusiness",
    color: "var(--info)",
    items: [
      {
        id: "datos",
        labelKey: "cfgHeading",
        accent: "var(--info)",
        Icon: IconStore,
        campos: ["nombre", "direccion", "telefono", "whatsapp", "email", "descripcion"],
      },
      { id: "rubro", labelKey: "rubroTitle", accent: "var(--teal)", Icon: IconBag, campos: ["tipo_rubro"] },
    ],
  },
  {
    labelKey: "cfgNavLook",
    color: "var(--violet)",
    items: [
      { id: "imagenes", labelKey: "cfgImagesTitle", accent: "var(--violet)", Icon: IconImage, campos: ["logo_url", "portada_url"] },
      { id: "color", labelKey: "cfgColorTitle", accent: "var(--chart-5)", Icon: IconPalette, campos: ["color_primario"] },
    ],
  },
  {
    labelKey: "cfgNavSales",
    color: "var(--ok)",
    items: [
      { id: "moneda", labelKey: "cfgCurrencyTitle", accent: "var(--warn)", Icon: IconCoin, campos: ["moneda"] },
      {
        id: "servicio",
        labelKey: "cfgServiceTitle",
        accent: "var(--ok)",
        Icon: IconTruck,
        campos: ["mesas_activo", "mesas_cantidad", "retiro_activo", "delivery_activo"],
      },
      { id: "horarios", labelKey: "cfgHours", accent: "var(--info)", Icon: IconClock, campos: ["horarios", "horarios_config"] },
    ],
  },
];

// Template inicial cuando se activan los horarios por día.
const horariosTemplate = (): HorariosConfig =>
  DIA_KEYS.map((_, i) => ({
    cerrado: i === 6, // domingo cerrado por defecto
    franjas: i === 6 ? [] : [{ desde: "09:00", hasta: "13:00" }],
  }));

export default function ConfiguracionEditor({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const s = useStyles();
  const { t } = useLang();
  const [form, setForm] = useState<Form>(EMPTY);
  // Snapshot de lo persistido: sirve para detectar cambios (dirty) y para
  // revertir con "Cancelar". Los cambios NO se aplican hasta confirmar.
  const [initial, setInitial] = useState<{ form: Form; usarPorDia: boolean } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState<"logo" | "portada" | null>(null);
  const [usarPorDia, setUsarPorDia] = useState(false);
  const [seccion, setSeccion] = useState<SeccionId>("datos");
  const isMobile = useIsMobile();

  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const cardBorder = "var(--line)";

  useEffect(() => {
    (async () => {
      try {
        const cfg = await configuracionService.get();
        const loaded: Form = {
          nombre: cfg.nombre || "",
          descripcion: cfg.descripcion || "",
          direccion: cfg.direccion || "",
          telefono: cfg.telefono || "",
          whatsapp: cfg.whatsapp || "",
          email: cfg.email || "",
          horarios: cfg.horarios || "",
          logo_url: cfg.logo_url || "",
          portada_url: cfg.portada_url || "",
          mesas_activo: !!cfg.mesas_activo,
          mesas_cantidad: cfg.mesas_cantidad || 0,
          delivery_activo: !!cfg.delivery_activo,
          retiro_activo: !!cfg.retiro_activo,
          color_primario: cfg.color_primario || "#ff5722",
          horarios_config: cfg.horarios_config || null,
          moneda: cfg.moneda || "ARS",
          tipo_rubro: cfg.tipo_rubro || "gastronomia",
        };
        const upd =
          Array.isArray(cfg.horarios_config) && cfg.horarios_config.length > 0;
        setForm(loaded);
        setUsarPorDia(upd);
        setInitial({ form: loaded, usarPorDia: upd });
      } catch (e) {
        console.error(e);
        setToast({ type: "err", text: t("cfgLoadError") });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-cierre del toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), toast.type === "ok" ? 3000 : 4500);
    return () => clearTimeout(id);
  }, [toast]);

  const set = (k: keyof Form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    campo: "logo_url" | "portada_url",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(campo === "logo_url" ? "logo" : "portada");
    try {
      const { url } = await uploadService.uploadImagen(file);
      setForm((f) => ({ ...f, [campo]: url }));
    } catch (err) {
      console.error(err);
      setToast({ type: "err", text: t("cfgUploadError") });
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const setHorarios = (hc: HorariosConfig) =>
    setForm((f) => ({ ...f, horarios_config: hc }));

  const toggleUsarPorDia = (v: boolean) => {
    setUsarPorDia(v);
    if (v && (!form.horarios_config || form.horarios_config.length === 0)) {
      setForm((f) => ({ ...f, horarios_config: horariosTemplate() }));
    }
  };

  // Firma del "payload efectivo": normaliza horarios_config (null si no se usa
  // por día) para que toggles reversibles no marquen cambios falsos.
  const signature = (f: Form, u: boolean) =>
    JSON.stringify({ ...f, horarios_config: u ? f.horarios_config : null });
  const dirty =
    !!initial &&
    signature(form, usarPorDia) !== signature(initial.form, initial.usarPorDia);

  // ¿Esta sección tiene cambios sin guardar? (punto en el menú lateral)
  const seccionCambiada = (id: SeccionId, campos: (keyof Form)[]) => {
    if (!initial) return false;
    if (id === "horarios") {
      const h = (f: Form, u: boolean) =>
        JSON.stringify([f.horarios, u ? f.horarios_config : null]);
      return h(form, usarPorDia) !== h(initial.form, initial.usarPorDia);
    }
    return campos.some(
      (c) => JSON.stringify(form[c]) !== JSON.stringify(initial.form[c]),
    );
  };

  const cancel = () => {
    if (!initial) return;
    setForm(initial.form);
    setUsarPorDia(initial.usarPorDia);
  };

  const save = async () => {
    setSaving(true);
    try {
      await configuracionService.update({
        ...form,
        horarios_config: usarPorDia ? form.horarios_config : null,
      });
      setInitial({ form, usarPorDia });
      setToast({ type: "ok", text: t("cfgSaved") });
      onSaved?.();
    } catch (e) {
      console.error(e);
      setToast({ type: "err", text: t("cfgSaveError") });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ color: textMuted }}>{t("subLoading")}</p>;
  }

  return (
    <>
      <style>{`@keyframes cfgSecIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? 12 : 20,
          alignItems: isMobile ? "stretch" : "flex-start",
        }}
      >
        <SideNav
          value={seccion}
          onChange={setSeccion}
          isMobile={isMobile}
          dirtyTitle={t("cfgUnsaved")}
          groups={GRUPOS.map((g) => ({
            label: t(g.labelKey),
            color: g.color,
            items: g.items
              .filter((it) => MULTI_MONEDA || it.id !== "moneda")
              .map((it) => ({
              id: it.id,
              label: t(it.labelKey),
              accent: it.accent,
              Icon: it.Icon,
              dirty: seccionCambiada(it.id, it.campos),
            })),
          }))}
        />

        {/* Sección elegida. Alto mínimo fijo para que la ventana no salte
            de tamaño al pasar de una sección corta a una larga. */}
        <div
          key={seccion}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: isMobile ? undefined : 460,
            animation: "cfgSecIn .22s ease both",
          }}
        >
      {/* ── Datos del local (identidad) ── */}
      {seccion === "datos" && (
      <SectionCard
        accent="var(--info)"
        title={t("cfgHeading")}
        subtitle={t("cfgSubtitle")}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          }}
        >
          <TextField s={s} label={t("cfgVenueName")} value={form.nombre} onChange={set("nombre")} />
          <TextField s={s} label={t("cfgAddress")} value={form.direccion} onChange={set("direccion")} />
          <TextField s={s} label={t("cfgPhone")} value={form.telefono} onChange={set("telefono")} />
          <TextField s={s} label="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="3814665263" />
          <TextField s={s} label={t("colEmail")} value={form.email} onChange={set("email")} />
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={s.label}>{t("prodDescField")}</label>
          <textarea
            value={form.descripcion || ""}
            onChange={(e) => set("descripcion")(e.target.value)}
            rows={3}
            placeholder={t("cfgDescriptionPh")}
            style={{ ...s.input, resize: "vertical" }}
          />
        </div>
      </SectionCard>
      )}

      {/* ── Imágenes ── */}
      {seccion === "imagenes" && (
      <SectionCard
        accent="var(--violet)"
        title={t("cfgImagesTitle")}
        subtitle={t("cfgImagesSubtitle")}
      >
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          }}
        >
          <ImageField
            label={t("cfgLogo")}
            url={form.logo_url}
            uploading={uploading === "logo"}
            onPick={(e) => handleUpload(e, "logo_url")}
            onClear={() => set("logo_url")("")}
            shape="square"
          />
          <ImageField
            label={t("cfgCover")}
            url={form.portada_url}
            uploading={uploading === "portada"}
            onPick={(e) => handleUpload(e, "portada_url")}
            onClear={() => set("portada_url")("")}
            shape="wide"
          />
        </div>
      </SectionCard>
      )}

      {/* ── Tipo de rubro (multi-rubro) ── */}
      {seccion === "rubro" && (
      <SectionCard
        accent="var(--teal)"
        title={t("rubroTitle")}
        subtitle={t("rubroSubtitle")}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          }}
        >
          {RUBROS.map((r) => {
            const activo = (form.tipo_rubro || "gastronomia") === r.code;
            return (
              <button
                key={r.code}
                type="button"
                aria-pressed={activo}
                onClick={() => setForm((f) => ({ ...f, tipo_rubro: r.code }))}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  textAlign: "left",
                  border: `2px solid ${activo ? "var(--teal)" : "var(--line)"}`,
                  background: activo
                    ? "color-mix(in srgb, var(--teal) 10%, transparent)"
                    : "var(--surface-2)",
                }}
              >
                <span style={{ color: activo ? "var(--teal)" : textMuted, display: "flex", flexShrink: 0 }}>
                  <r.Icon size={22} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: textPrimary }}>
                    {t(r.labelKey)}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: textMuted, marginTop: 2 }}>
                    {t(r.descKey)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </SectionCard>
      )}

      {/* ── Apariencia: paleta de colores ── */}
      {seccion === "color" && (
      <SectionCard
        accent={form.color_primario || "#db2777"}
        title={t("cfgColorTitle")}
        subtitle={t("cfgColorSubtitle")}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {PALETAS.map((p) => {
            const activo = (form.color_primario || "").toLowerCase() === p.color;
            return (
              <button
                key={p.color}
                type="button"
                title={t(p.nameKey)}
                aria-label={t(p.nameKey)}
                aria-pressed={activo}
                onClick={() => set("color_primario")(p.color)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: p.color,
                  border: activo ? "3px solid #fff" : "2px solid transparent",
                  boxShadow: activo
                    ? `0 0 0 2px ${p.color}`
                    : "0 1px 3px rgba(0,0,0,0.2)",
                  cursor: "pointer",
                }}
              />
            );
          })}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginLeft: 6,
              fontSize: 12.5,
              color: textMuted,
              cursor: "pointer",
            }}
          >
            {t("cfgCustom")}
            <input
              type="color"
              value={form.color_primario || "#ff5722"}
              onChange={(e) => set("color_primario")(e.target.value)}
              style={{
                width: 34,
                height: 34,
                border: "none",
                background: "none",
                cursor: "pointer",
                padding: 0,
              }}
            />
          </label>
        </div>
      </SectionCard>
      )}

      {/* ── Moneda del menú ── */}
      {MULTI_MONEDA && seccion === "moneda" && (
      <SectionCard
        accent="var(--warn)"
        title={t("cfgCurrencyTitle")}
        subtitle={t("cfgCurrencySubtitle")}
      >
        <select
          value={form.moneda || "ARS"}
          onChange={(e) => set("moneda")(e.target.value)}
          style={{ ...s.input, maxWidth: 320, cursor: "pointer" }}
        >
          {MONEDAS.map((code) => (
            <option key={code} value={code}>
              {t(`cur_${code}`)}
            </option>
          ))}
        </select>
      </SectionCard>
      )}

      {/* ── Opciones de servicio ── */}
      {seccion === "servicio" && (
      <SectionCard
        accent="var(--ok)"
        title={t("cfgServiceTitle")}
        subtitle={t("cfgServiceSubtitle")}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Toggle
            label={t("cfgTables")}
            desc={t("cfgTablesDesc")}
            value={form.mesas_activo}
            onChange={(v) => setForm((f) => ({ ...f, mesas_activo: v }))}
          />
          {form.mesas_activo && (
            <div style={{ paddingLeft: 4, maxWidth: 220 }}>
              <label style={s.label}>{t("cfgTablesQty")}</label>
              <input
                type="number"
                min={0}
                value={form.mesas_cantidad}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mesas_cantidad: Math.max(0, parseInt(e.target.value, 10) || 0),
                  }))
                }
                style={s.input}
              />
            </div>
          )}
          <Toggle
            label={t("cfgPickup")}
            desc={t("cfgPickupDesc")}
            value={form.retiro_activo}
            onChange={(v) => setForm((f) => ({ ...f, retiro_activo: v }))}
          />
          <Toggle
            label={t("pedDelivery")}
            desc={t("cfgDeliveryDesc")}
            value={form.delivery_activo}
            onChange={(v) => setForm((f) => ({ ...f, delivery_activo: v }))}
          />
        </div>
      </SectionCard>
      )}

      {/* ── Horarios ── */}
      {seccion === "horarios" && (
      <SectionCard
        accent="var(--info)"
        title={t("cfgHours")}
        subtitle={t("cfgHoursSubtitle")}
      >
        <Toggle
          label={t("cfgHoursPerDay")}
          desc={t("cfgHoursPerDayDesc")}
          value={usarPorDia}
          onChange={toggleUsarPorDia}
        />
        <div style={{ marginTop: 14 }}>
          {usarPorDia && form.horarios_config ? (
            <HorariosEditor
              value={form.horarios_config}
              onChange={setHorarios}
            />
          ) : (
            <div>
              <label style={s.label}>{t("cfgHoursText")}</label>
              <input
                value={form.horarios || ""}
                onChange={(e) => set("horarios")(e.target.value)}
                placeholder={t("cfgHoursTextPh")}
                style={s.input}
              />
            </div>
          )}
        </div>
      </SectionCard>
      )}
        </div>
      </div>

      {/* Espaciador para que la barra flotante no tape la última tarjeta. */}
      <div style={{ height: dirty ? 76 : 8, transition: "height 0.2s" }} />

      {/* ── Barra flotante: aparece al haber cambios sin guardar ──
          Se renderiza con un portal a <body> para que position:fixed sea
          relativo a la ventana. Si quedara dentro del modal (que usa
          backdrop-filter), este crearía un containing block y la barra
          aparecería en el medio y no seguiría el scroll. */}
      {dirty &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              zIndex: 350,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "11px 12px 11px 18px",
            borderRadius: 14,
            background: "var(--surface)",
            border: `1px solid ${cardBorder}`,
            boxShadow: "0 16px 44px rgba(0,0,0,0.30)",
            animation: "cfgBarIn .22s cubic-bezier(.2,.8,.2,1)",
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <style>{`@keyframes cfgBarIn{from{opacity:0;transform:translate(-50%,18px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
              color: textPrimary,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--warn)",
                boxShadow: "0 0 0 3px color-mix(in srgb, var(--warn) 25%, transparent)",
                flexShrink: 0,
              }}
            />
            {t("cfgUnsaved")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={cancel}
              disabled={saving}
              style={{ ...s.btnGhost, padding: "8px 14px" }}
            >
              {t("actionCancel")}
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{ ...s.btnPrimary, padding: "8px 16px", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? t("saving") : t("saveChanges")}
            </button>
          </div>
          </div>,
          document.body,
        )}

      {/* ── Toast (arriba a la derecha) ──
          También con portal a <body> por el mismo motivo del backdrop-filter. */}
      {toast &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 400,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderRadius: 12,
            background: toast.type === "ok" ? "var(--ok)" : "var(--err)",
            color: "var(--surface)",
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: "0 12px 34px rgba(0,0,0,0.28)",
            animation: "cfgToastIn .25s ease",
            maxWidth: "min(360px, calc(100vw - 32px))",
          }}
        >
          <style>{`@keyframes cfgToastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}`}</style>
          <span style={{ display: "flex", flexShrink: 0 }}>
            {toast.type === "ok" ? <IconCheck size={18} /> : <IconAlert size={18} />}
          </span>
          {toast.text}
          </div>,
          document.body,
        )}
    </>
  );
}

function TextField({
  s,
  label,
  value,
  onChange,
  placeholder,
}: {
  s: ReturnType<typeof useStyles>;
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={s.input}
      />
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${"var(--line)"}`,
        background: "var(--surface-2)",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={typeof label === "string" ? label : undefined}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: value ? "var(--ok)" : "var(--fg-3)",
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: value ? 23 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--surface)",
            transition: "left .2s",
          }}
        />
      </button>
    </div>
  );
}

function HorariosEditor({
  value,
  onChange,
}: {
  value: HorariosConfig;
  onChange: (v: HorariosConfig) => void;
}) {
  const { t } = useLang();
  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const border = "var(--line)";
  const inputBg = "var(--surface)";

  const update = (i: number, patch: Partial<DiaHorario>) =>
    onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const setFranja = (
    i: number,
    j: number,
    patch: Partial<{ desde: string; hasta: string }>,
  ) =>
    update(i, {
      franjas: (value[i].franjas || []).map((f, k) =>
        k === j ? { ...f, ...patch } : f,
      ),
    });

  const addFranja = (i: number) =>
    update(i, {
      franjas: [...(value[i].franjas || []), { desde: "17:00", hasta: "21:00" }],
    });

  const removeFranja = (i: number, j: number) =>
    update(i, { franjas: (value[i].franjas || []).filter((_, k) => k !== j) });

  const toggleCerrado = (i: number) => {
    const d = value[i];
    if (d.cerrado)
      update(i, {
        cerrado: false,
        franjas:
          d.franjas && d.franjas.length
            ? d.franjas
            : [{ desde: "09:00", hasta: "13:00" }],
      });
    else update(i, { cerrado: true });
  };

  const copiarATodos = (i: number) => {
    const d = value[i];
    onChange(
      value.map(() => ({
        cerrado: d.cerrado,
        franjas: (d.franjas || []).map((f) => ({ ...f })),
      })),
    );
  };

  const timeInput: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: 8,
    border: `1px solid ${border}`,
    background: inputBg,
    color: textPrimary,
    fontSize: 13,
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {DIA_KEYS.map((diaKey, i) => {
        const dia = t(diaKey);
        const d = value[i] || { cerrado: true, franjas: [] };
        const franjas = d.franjas || [];
        return (
          <div key={diaKey} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ width: 78, fontSize: 13, fontWeight: 600, color: textPrimary }}>
                {dia}
              </span>
              <button
                type="button"
                onClick={() => toggleCerrado(i)}
                role="switch"
                aria-checked={!d.cerrado}
                aria-label={`${dia}: ${t("cfgOpen")}`}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: d.cerrado ? "var(--fg-3)" : "var(--ok)",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: d.cerrado ? 3 : 21,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--surface)",
                    transition: "left .2s",
                  }}
                />
              </button>
              <span style={{ fontSize: 12, color: textMuted }}>
                {d.cerrado ? t("cfgClosed") : t("cfgOpen")}
              </span>
              {!d.cerrado && (
                <button
                  onClick={() => copiarATodos(i)}
                  style={{ marginLeft: "auto", fontSize: 11, color: "var(--info)", background: "none", border: "none", cursor: "pointer" }}
                >
                  {t("cfgCopyAll")}
                </button>
              )}
            </div>

            {!d.cerrado && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {franjas.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="time" aria-label={`${dia} ${j + 1}: ${t("cfgFrom")}`} value={f.desde} onChange={(e) => setFranja(i, j, { desde: e.target.value })} style={timeInput} />
                    <span style={{ color: textMuted, fontSize: 12 }}>{t("cfgTo")}</span>
                    <input type="time" aria-label={`${dia} ${j + 1}: ${t("cfgTo")}`} value={f.hasta} onChange={(e) => setFranja(i, j, { hasta: e.target.value })} style={timeInput} />
                    {franjas.length > 1 && (
                      <button type="button" onClick={() => removeFranja(i, j)} aria-label={t("cfgRemoveRange")} title={t("cfgRemoveRange")} style={{ background: "none", border: "none", color: "var(--err)", cursor: "pointer", fontSize: 18, lineHeight: 1, minWidth: 44, minHeight: 44 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {franjas.length < 3 && (
                  <button
                    onClick={() => addFranja(i)}
                    style={{ fontSize: 12, color: "var(--info)", background: "none", border: "none", cursor: "pointer", justifySelf: "start", padding: 0 }}
                  >
                    {t("cfgAddRange")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ImageField({
  label,
  url,
  uploading,
  onPick,
  onClear,
  shape,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  shape: "square" | "wide";
}) {
  const { t } = useLang();
  const border = "var(--line-strong)";
  const boxH = 120;
  const boxW = shape === "square" ? 120 : "100%";
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--fg-3)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: boxW,
            height: boxH,
            maxWidth: shape === "wide" ? 220 : 120,
            borderRadius: 10,
            border: `1.5px dashed ${border}`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          {url ? (
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ opacity: 0.4, color: "var(--fg-3)", display: "flex" }}>
              <IconImage size={24} />
            </span>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12.5,
              fontWeight: 500,
              background: "var(--accent)",
              color: "var(--on-accent)",
            }}
          >
            {uploading ? t("cfgUploading") : url ? t("cfgChange") : t("cfgUploadImg")}
            <input type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} disabled={uploading} />
          </label>
          {url && (
            <button
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                color: "var(--err)",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                textAlign: "left",
              }}
            >
              {t("attrRemove")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
