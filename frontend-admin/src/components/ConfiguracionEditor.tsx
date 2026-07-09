import { useEffect, useState } from "react";
import { useStyles } from "./sharedStyles";
import { useTheme } from "../context/ThemeContext";
import {
  configuracionService,
  uploadService,
  type Configuracion,
  type HorariosConfig,
  type DiaHorario,
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
};

const MONEDAS = [
  { code: "ARS", label: "Peso argentino (ARS)" },
  { code: "USD", label: "Dólar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "BRL", label: "Real brasileño (BRL)" },
  { code: "MXN", label: "Peso mexicano (MXN)" },
  { code: "CLP", label: "Peso chileno (CLP)" },
  { code: "COP", label: "Peso colombiano (COP)" },
  { code: "PEN", label: "Sol peruano (PEN)" },
  { code: "UYU", label: "Peso uruguayo (UYU)" },
  { code: "PYG", label: "Guaraní (PYG)" },
  { code: "BOB", label: "Boliviano (BOB)" },
  { code: "GTQ", label: "Quetzal (GTQ)" },
];

const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

const PALETAS = [
  { nombre: "Naranja", color: "#ff5722" },
  { nombre: "Rojo", color: "#e11d48" },
  { nombre: "Verde", color: "#16a34a" },
  { nombre: "Azul", color: "#2563eb" },
  { nombre: "Violeta", color: "#7c3aed" },
  { nombre: "Turquesa", color: "#0d9488" },
  { nombre: "Fucsia", color: "#db2777" },
  { nombre: "Ámbar", color: "#d97706" },
];

// Template inicial cuando se activan los horarios por día.
const horariosTemplate = (): HorariosConfig =>
  DIAS.map((_, i) => ({
    cerrado: i === 6, // domingo cerrado por defecto
    franjas: i === 6 ? [] : [{ desde: "09:00", hasta: "13:00" }],
  }));

export default function ConfiguracionEditor({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const s = useStyles();
  const { isDark } = useTheme();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState<"logo" | "portada" | null>(null);
  const [usarPorDia, setUsarPorDia] = useState(false);

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#64748b" : "#94a3b8";

  useEffect(() => {
    (async () => {
      try {
        const cfg = await configuracionService.get();
        setForm({
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
        });
        setUsarPorDia(
          Array.isArray(cfg.horarios_config) && cfg.horarios_config.length > 0,
        );
      } catch (e) {
        console.error(e);
        setMsg({ type: "err", text: "No se pudo cargar la configuración." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof Form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    campo: "logo_url" | "portada_url",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(campo === "logo_url" ? "logo" : "portada");
    setMsg(null);
    try {
      const { url } = await uploadService.uploadImagen(file);
      setForm((f) => ({ ...f, [campo]: url }));
    } catch (err) {
      console.error(err);
      setMsg({ type: "err", text: "No se pudo subir la imagen." });
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

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await configuracionService.update({
        ...form,
        horarios_config: usarPorDia ? form.horarios_config : null,
      });
      setMsg({ type: "ok", text: "Configuración guardada correctamente." });
      onSaved?.();
    } catch (e) {
      console.error(e);
      setMsg({ type: "err", text: "No se pudo guardar. Intentá de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ color: textMuted }}>Cargando…</p>;
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: textPrimary, fontSize: 20, fontWeight: 600, margin: 0 }}>
          Datos del local
        </h2>
        <p style={{ color: textMuted, fontSize: 13, margin: "4px 0 0" }}>
          Esta información se muestra en el menú público de tus clientes.
        </p>
      </div>

      {msg && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            background:
              msg.type === "ok"
                ? "rgba(16,185,129,0.12)"
                : "rgba(239,68,68,0.1)",
            color: msg.type === "ok" ? "#059669" : "#dc2626",
            border: `1px solid ${
              msg.type === "ok"
                ? "rgba(16,185,129,0.25)"
                : "rgba(239,68,68,0.25)"
            }`,
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Imágenes */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          }}
        >
          <ImageField
            label="Logo"
            url={form.logo_url}
            uploading={uploading === "logo"}
            onPick={(e) => handleUpload(e, "logo_url")}
            onClear={() => set("logo_url")("")}
            shape="square"
            isDark={isDark}
          />
          <ImageField
            label="Imagen de portada (banner)"
            url={form.portada_url}
            uploading={uploading === "portada"}
            onPick={(e) => handleUpload(e, "portada_url")}
            onClear={() => set("portada_url")("")}
            shape="wide"
            isDark={isDark}
          />
        </div>
      </div>

      {/* Apariencia: paleta de colores */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ color: textPrimary, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
          Color del menú
        </h3>
        <p style={{ color: textMuted, fontSize: 12.5, margin: "0 0 14px" }}>
          Elegí la paleta del menú público (botones, precios, íconos).
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {PALETAS.map((p) => {
            const activo = (form.color_primario || "").toLowerCase() === p.color;
            return (
              <button
                key={p.color}
                title={p.nombre}
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
            Personalizado
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
      </div>

      {/* Moneda del menú */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ color: textPrimary, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
          Moneda del menú
        </h3>
        <p style={{ color: textMuted, fontSize: 12.5, margin: "0 0 14px" }}>
          Los precios se muestran en esta moneda. No hay conversión: cargá los
          precios directamente en la moneda que elijas.
        </p>
        <select
          value={form.moneda || "ARS"}
          onChange={(e) => set("moneda")(e.target.value)}
          style={{ ...s.input, maxWidth: 320, cursor: "pointer" }}
        >
          {MONEDAS.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Opciones de servicio */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ color: textPrimary, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
          Opciones de servicio
        </h3>
        <p style={{ color: textMuted, fontSize: 12.5, margin: "0 0 16px" }}>
          Activá cómo pueden pedir tus clientes. Aparecen en el carrito del menú.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <Toggle
            isDark={isDark}
            label="Mesas"
            desc="Pedidos para consumir en el local, eligiendo mesa."
            value={form.mesas_activo}
            onChange={(v) => setForm((f) => ({ ...f, mesas_activo: v }))}
          />
          {form.mesas_activo && (
            <div style={{ paddingLeft: 4, maxWidth: 220 }}>
              <label style={s.label}>Cantidad de mesas</label>
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
            isDark={isDark}
            label="Retiro en el local"
            desc="El cliente retira el pedido en el mostrador."
            value={form.retiro_activo}
            onChange={(v) => setForm((f) => ({ ...f, retiro_activo: v }))}
          />
          <Toggle
            isDark={isDark}
            label="Delivery"
            desc="Envío a domicilio. Se pide la dirección al confirmar."
            value={form.delivery_activo}
            onChange={(v) => setForm((f) => ({ ...f, delivery_activo: v }))}
          />
        </div>
      </div>

      {/* Horarios */}
      <div style={{ ...s.card, padding: 20, marginBottom: 16 }}>
        <h3 style={{ color: textPrimary, fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>
          Horarios
        </h3>
        <p style={{ color: textMuted, fontSize: 12.5, margin: "0 0 14px" }}>
          Definí por día (horario corrido o cortado) o dejá un texto simple.
        </p>
        <Toggle
          isDark={isDark}
          label="Definir horarios por día"
          desc="Mañana y tarde, sábado a la mañana, domingo cerrado, etc."
          value={usarPorDia}
          onChange={toggleUsarPorDia}
        />
        <div style={{ marginTop: 14 }}>
          {usarPorDia && form.horarios_config ? (
            <HorariosEditor
              value={form.horarios_config}
              onChange={setHorarios}
              isDark={isDark}
            />
          ) : (
            <div>
              <label style={s.label}>Horario (texto libre)</label>
              <input
                value={form.horarios || ""}
                onChange={(e) => set("horarios")(e.target.value)}
                placeholder="20:00 a 01:00 hs"
                style={s.input}
              />
            </div>
          )}
        </div>
      </div>

      {/* Campos */}
      <div style={{ ...s.card, padding: 20 }}>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          }}
        >
          <TextField s={s} label="Nombre del local" value={form.nombre} onChange={set("nombre")} />
          <TextField s={s} label="Dirección" value={form.direccion} onChange={set("direccion")} />
          <TextField s={s} label="Teléfono" value={form.telefono} onChange={set("telefono")} />
          <TextField s={s} label="WhatsApp" value={form.whatsapp} onChange={set("whatsapp")} placeholder="3814665263" />
          <TextField s={s} label="Email" value={form.email} onChange={set("email")} />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={s.label}>Descripción</label>
          <textarea
            value={form.descripcion || ""}
            onChange={(e) => set("descripcion")(e.target.value)}
            rows={3}
            placeholder="Breve descripción del local…"
            style={{ ...s.input, resize: "vertical" }}
          />
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ ...s.btnPrimary, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
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
  isDark,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 10,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
        background: isDark ? "#0f1117" : "#f8f9fa",
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: isDark ? "#f1f5f9" : "#1e293b" }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: isDark ? "#64748b" : "#94a3b8", marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          background: value ? "#10b981" : isDark ? "#334155" : "#cbd5e1",
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
            background: "#fff",
            transition: "left .2s",
            boxShadow: "0 1px 3px rgba(0,0,0,.3)",
          }}
        />
      </button>
    </div>
  );
}

function HorariosEditor({
  value,
  onChange,
  isDark,
}: {
  value: HorariosConfig;
  onChange: (v: HorariosConfig) => void;
  isDark: boolean;
}) {
  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textMuted = isDark ? "#64748b" : "#94a3b8";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const inputBg = isDark ? "#0f1117" : "#fff";

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
      {DIAS.map((dia, i) => {
        const d = value[i] || { cerrado: true, franjas: [] };
        const franjas = d.franjas || [];
        return (
          <div key={dia} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ width: 78, fontSize: 13, fontWeight: 600, color: textPrimary }}>
                {dia}
              </span>
              <button
                onClick={() => toggleCerrado(i)}
                role="switch"
                aria-checked={!d.cerrado}
                style={{
                  width: 40,
                  height: 22,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: d.cerrado ? (isDark ? "#334155" : "#cbd5e1") : "#10b981",
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
                    background: "#fff",
                    transition: "left .2s",
                  }}
                />
              </button>
              <span style={{ fontSize: 12, color: textMuted }}>
                {d.cerrado ? "Cerrado" : "Abierto"}
              </span>
              {!d.cerrado && (
                <button
                  onClick={() => copiarATodos(i)}
                  style={{ marginLeft: "auto", fontSize: 11, color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}
                >
                  Copiar a todos
                </button>
              )}
            </div>

            {!d.cerrado && (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {franjas.map((f, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="time" value={f.desde} onChange={(e) => setFranja(i, j, { desde: e.target.value })} style={timeInput} />
                    <span style={{ color: textMuted, fontSize: 12 }}>a</span>
                    <input type="time" value={f.hasta} onChange={(e) => setFranja(i, j, { hasta: e.target.value })} style={timeInput} />
                    {franjas.length > 1 && (
                      <button onClick={() => removeFranja(i, j)} title="Quitar franja" style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {franjas.length < 3 && (
                  <button
                    onClick={() => addFranja(i)}
                    style={{ fontSize: 12, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", justifySelf: "start", padding: 0 }}
                  >
                    + Agregar franja (horario cortado)
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
  isDark,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  shape: "square" | "wide";
  isDark: boolean;
}) {
  const border = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
  const boxH = 120;
  const boxW = shape === "square" ? 120 : "100%";
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 600,
          color: isDark ? "#475569" : "#64748b",
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
            background: isDark ? "#0f1117" : "#f8f9fa",
            flexShrink: 0,
          }}
        >
          {url ? (
            <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 24, opacity: 0.4 }}>🖼️</span>
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
              background: "#3b82f6",
              color: "#fff",
            }}
          >
            {uploading ? "Subiendo…" : url ? "Cambiar" : "Subir imagen"}
            <input type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} disabled={uploading} />
          </label>
          {url && (
            <button
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                textAlign: "left",
              }}
            >
              Quitar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
