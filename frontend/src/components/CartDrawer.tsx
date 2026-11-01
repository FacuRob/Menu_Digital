import { useState, useMemo } from "react";
import type { Configuracion, TipoEntrega } from "../services/api";
import { pedidosService } from "../services/api";
import type { CartApi } from "../hooks/useCart";
import {
  PRIMARY,
  PRIMARY_DARK,
  PRIMARY_SOFT,
  PRIMARY_SHADOW,
  PRIMARY_ON,
  fmt,
  ProductImage,
} from "../lib/menuUi";
import { useLang } from "../lib/i18n";

const WHATSAPP_GREEN = "#25d366";

export default function CartDrawer({
  open,
  onClose,
  cart,
  mesa,
  setMesa,
  config,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartApi;
  mesa: string;
  setMesa: (m: string) => void;
  config: Configuracion | null;
}) {
  const { t } = useLang();
  const entregaLabel: Record<TipoEntrega, string> = {
    mesa: t("deliveryTable"),
    retiro: t("deliveryPickup"),
    delivery: t("deliveryDelivery"),
  };
  const [step, setStep] = useState<"datos" | "entrega">("datos");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  // Opt-in para avisos del pedido por WhatsApp (solo si el local los activó).
  const [avisoWa, setAvisoWa] = useState(false);
  const [tipo, setTipo] = useState<TipoEntrega | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const { lines, total, setQty, remove, clear } = cart;

  // Opciones de entrega activas según la configuración del local.
  const opciones = useMemo<TipoEntrega[]>(() => {
    const o: TipoEntrega[] = [];
    if (config?.mesas_activo && (config.mesas_cantidad || 0) > 0) o.push("mesa");
    if (config?.retiro_activo) o.push("retiro");
    if (config?.delivery_activo) o.push("delivery");
    return o;
  }, [config]);

  const resetAll = () => {
    clear();
    setCliente("");
    setNota("");
    setDireccion("");
    setTelefono("");
    setAvisoWa(false);
    setMesa("");
    setTipo(null);
    setStep("datos");
  };

  // El teléfono se pide para retiro y delivery (para contactar al cliente).
  const requierePhone = tipo === "retiro" || tipo === "delivery";

  const cerrar = () => {
    setDone(false);
    setError("");
    setStep("datos");
    onClose();
  };

  const buildPayload = (tipoEntrega: TipoEntrega | null) => ({
    mesa: tipoEntrega === "mesa" ? mesa.trim() || null : null,
    cliente: cliente.trim(),
    nota: nota.trim() || null,
    tipo_entrega: tipoEntrega,
    direccion_entrega: tipoEntrega === "delivery" ? direccion.trim() : null,
    telefono_cliente:
      tipoEntrega === "retiro" || tipoEntrega === "delivery"
        ? telefono.trim() || null
        : null,
    acepta_whatsapp:
      !!config?.avisos_whatsapp &&
      avisoWa &&
      (tipoEntrega === "retiro" || tipoEntrega === "delivery"),
    items: lines.map((l) => ({
      producto_id: l.producto.id,
      nombre: l.producto.nombre,
      precio: l.unitPrice,
      cantidad: l.cantidad,
      opciones: l.opciones.map((o) => o.opcion_id),
    })),
  });

  // Validaciones
  const nombreOk = cliente.trim().length > 0;
  const entregaOk =
    opciones.length === 0 ||
    (tipo === "mesa" && mesa.trim()) ||
    (tipo === "retiro" && telefono.trim()) ||
    (tipo === "delivery" && direccion.trim() && telefono.trim());

  const irAEntrega = () => {
    if (!nombreOk) {
      setError(t("errEnterName"));
      return;
    }
    setError("");
    if (opciones.length === 0) {
      finalizar(null, false);
      return;
    }
    if (!tipo) setTipo(opciones[0]);
    setStep("entrega");
  };

  const guardar = async (tipoEntrega: TipoEntrega | null) => {
    setSending(true);
    setError("");
    try {
      const pedido = await pedidosService.create(buildPayload(tipoEntrega));
      return pedido;
    } catch (e) {
      console.error(e);
      setError(t("errSendFailed"));
      return null;
    } finally {
      setSending(false);
    }
  };

  const validarEntrega = (tipoEntrega: TipoEntrega | null) => {
    if (!nombreOk) {
      setError(t("errEnterName"));
      return false;
    }
    if (tipoEntrega === "mesa" && !mesa.trim()) {
      setError(t("errChooseTable"));
      return false;
    }
    if (tipoEntrega === "delivery" && !direccion.trim()) {
      setError(t("errEnterAddress"));
      return false;
    }
    if (
      (tipoEntrega === "retiro" || tipoEntrega === "delivery") &&
      !telefono.trim()
    ) {
      setError(t("errEnterPhone"));
      return false;
    }
    return true;
  };

  const finalizar = async (tipoEntrega: TipoEntrega | null, conWhatsApp: boolean) => {
    if (!validarEntrega(tipoEntrega)) return;

    // Datos para el mensaje antes de limpiar el carrito.
    const lineasMsg = lines
      .map((l) => {
        const ops =
          l.opciones.length > 0
            ? ` (${l.opciones.map((o) => o.nombre).join(", ")})`
            : "";
        return `• ${l.cantidad}x ${l.producto.nombre}${ops} — ${fmt(
          l.cantidad * l.unitPrice,
        )}`;
      })
      .join("\n");
    const totalMsg = total;

    const pedido = await guardar(tipoEntrega);
    if (!pedido) return;

    if (conWhatsApp) {
      const entregaTxt =
        tipoEntrega === "mesa"
          ? `Entrega: En mesa ${mesa.trim()}`
          : tipoEntrega === "delivery"
            ? `Entrega: Delivery\nDirección: ${direccion.trim()}`
            : tipoEntrega === "retiro"
              ? "Entrega: Retiro en el local"
              : "";

      const msg =
        `*Nuevo pedido — ${config?.nombre || "Menú"}*\n` +
        `Cliente: ${cliente.trim()}\n` +
        (telefono.trim() ? `Tel: ${telefono.trim()}\n` : "") +
        (entregaTxt ? entregaTxt + "\n" : "") +
        `\n${lineasMsg}\n\n*Total: ${fmt(totalMsg)}*` +
        (nota.trim() ? `\n\nNota: ${nota.trim()}` : "");

      let num = (config?.whatsapp || config?.telefono || "").replace(/\D/g, "");
      if (num && !num.startsWith("54")) num = "549" + num;
      const url = num
        ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    }

    setDone(true);
    resetAll();
  };

  return (
    <>
      <div
        onClick={cerrar}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity .25s",
        }}
      />

      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 91,
          width: "min(420px, 100%)",
          background: "linear-gradient(180deg, var(--mp-bg1, #2a0f06), #0b0b0b 55%)",
          color: "#fff",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform .3s cubic-bezier(.2,.8,.2,1)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          {step === "entrega" && !done && (
            <button
              onClick={() => {
                setStep("datos");
                setError("");
              }}
              aria-label={t("back")}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.08)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", flex: 1 }}>
            {done ? t("orderSent") : step === "entrega" ? t("howDoYouWantIt") : t("yourOrder")}
          </h2>
          <button
            onClick={cerrar}
            aria-label={t("close")}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.08)",
              cursor: "pointer",
              fontSize: 18,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            ✕
          </button>
        </div>

        {done ? (
          <SuccessView onClose={cerrar} />
        ) : lines.length === 0 ? (
          <EmptyView />
        ) : step === "datos" ? (
          <>
            {/* Lista + datos */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {lines.map((l) => (
                <div
                  key={l.key}
                  style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <ProductImage
                    url={l.producto.imagen_url}
                    alt={l.producto.nombre}
                    w={120}
                    h={120}
                    fill
                    style={{ width: 58, height: 58, borderRadius: 12, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>
                      {l.producto.nombre}
                    </div>
                    {l.opciones.length > 0 && (
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4, marginTop: 2 }}>
                        {l.opciones.map((o) => o.nombre).join(" · ")}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: PRIMARY, fontWeight: 700 }}>
                      {fmt(l.unitPrice * l.cantidad)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <MiniBtn onClick={() => setQty(l.key, l.cantidad - 1)}>−</MiniBtn>
                      <span style={{ minWidth: 22, textAlign: "center", fontWeight: 700, fontSize: 14 }}>
                        {l.cantidad}
                      </span>
                      <MiniBtn onClick={() => setQty(l.key, l.cantidad + 1)}>+</MiniBtn>
                      <button
                        onClick={() => remove(l.key)}
                        style={{ marginLeft: "auto", border: "none", background: "none", color: "rgba(255,255,255,0.45)", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                <Field
                  label={t("yourName")}
                  value={cliente}
                  onChange={setCliente}
                  placeholder={t("namePlaceholder")}
                  invalid={!!error && !nombreOk}
                />
                <Field
                  label={t("note")}
                  value={nota}
                  onChange={setNota}
                  placeholder={t("notePlaceholder")}
                  textarea
                />
              </div>
            </div>

            <Footer
              total={total}
              error={error}
              primaryLabel={opciones.length === 0 ? (sending ? t("sending") : t("confirmOrder")) : t("continue")}
              primaryDisabled={sending}
              onPrimary={irAEntrega}
              showWhatsApp={opciones.length === 0}
              whatsAppDisabled={sending}
              onWhatsApp={() => finalizar(null, true)}
            />
          </>
        ) : (
          <>
            {/* Paso entrega */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              <div style={{ display: "grid", gap: 10 }}>
                {opciones.map((op) => (
                  <button
                    key={op}
                    onClick={() => {
                      setTipo(op);
                      setError("");
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: `2px solid ${tipo === op ? PRIMARY : "rgba(255,255,255,0.12)"}`,
                      background: tipo === op ? PRIMARY_SOFT : "rgba(255,255,255,0.04)",
                      transition: "all .15s",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>
                      {op === "mesa" ? "🍽️" : op === "retiro" ? "🛍️" : "🛵"}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", flex: 1 }}>
                      {entregaLabel[op]}
                    </span>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: `2px solid ${tipo === op ? PRIMARY : "rgba(255,255,255,0.3)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {tipo === op && (
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: PRIMARY }} />
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {/* Campos según opción */}
              {tipo === "mesa" && (
                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>{t("tableLabel")}</label>
                  <select
                    value={mesa}
                    onChange={(e) => setMesa(e.target.value)}
                    style={{ ...inputStyle, appearance: "auto" as const }}
                  >
                    <option value="">{t("chooseTable")}</option>
                    {Array.from({ length: config?.mesas_cantidad || 0 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={String(n)}>
                        {t("tableN", { n })}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {tipo === "delivery" && (
                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>{t("deliveryAddress")}</label>
                  <textarea
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder={t("addressPlaceholder")}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>
              )}
              {requierePhone && (
                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>{t("phone")}</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    style={inputStyle}
                  />
                </div>
              )}
              {requierePhone && config?.avisos_whatsapp && (
                <label
                  style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "12px 14px",
                    borderRadius: 14,
                    cursor: "pointer",
                    border: `1.5px solid ${avisoWa ? "#25d366" : "rgba(255,255,255,0.12)"}`,
                    background: avisoWa ? "rgba(37,211,102,0.10)" : "rgba(255,255,255,0.04)",
                    transition: "all .15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={avisoWa}
                    onChange={(e) => setAvisoWa(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: 1, accentColor: "#25d366", flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                      {t("notifyWhatsapp")}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                      {t("notifyWhatsappSub")}
                    </span>
                  </span>
                </label>
              )}
            </div>

            <Footer
              total={total}
              error={error}
              primaryLabel={sending ? t("sending") : t("confirmOrder")}
              primaryDisabled={sending || !entregaOk}
              onPrimary={() => finalizar(tipo, false)}
              showWhatsApp
              whatsAppDisabled={sending || !entregaOk}
              onWhatsApp={() => finalizar(tipo, true)}
            />
          </>
        )}
      </aside>
    </>
  );
}

// ── Subcomponentes ──
function Footer({
  total,
  error,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  showWhatsApp,
  whatsAppDisabled,
  onWhatsApp,
}: {
  total: number;
  error: string;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  showWhatsApp: boolean;
  whatsAppDisabled: boolean;
  onWhatsApp: () => void;
}) {
  const { t } = useLang();
  return (
    <div
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        padding: "16px 18px calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      {error && (
        <div style={{ background: "rgba(239,68,68,0.12)", color: "#fca5a5", fontSize: 13, padding: "8px 12px", borderRadius: 10, marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{t("total")}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{fmt(total)}</span>
      </div>

      <button
        onClick={onPrimary}
        disabled={primaryDisabled}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: 999,
          border: "none",
          background: PRIMARY,
          color: PRIMARY_ON,
          fontSize: 15.5,
          fontWeight: 700,
          cursor: primaryDisabled ? "default" : "pointer",
          opacity: primaryDisabled ? 0.65 : 1,
          boxShadow: `0 8px 22px ${PRIMARY_SHADOW}`,
        }}
        onMouseEnter={(e) => !primaryDisabled && (e.currentTarget.style.background = PRIMARY_DARK)}
        onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
      >
        {primaryLabel}
      </button>

      {showWhatsApp && (
        <button
          onClick={onWhatsApp}
          disabled={whatsAppDisabled}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "14px",
            borderRadius: 999,
            border: "none",
            background: WHATSAPP_GREEN,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: whatsAppDisabled ? "default" : "pointer",
            opacity: whatsAppDisabled ? 0.65 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <svg width={19} height={19} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z" />
          </svg>
          {t("sendWhatsApp")}
        </button>
      )}
    </div>
  );
}

function SuccessView({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.15)", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, marginBottom: 16 }}>
        ✓
      </div>
      <h3 style={{ margin: 0, fontSize: 19, color: "#fff" }}>{t("successTitle")}</h3>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, marginTop: 6 }}>{t("successSubtitle")}</p>
      <button
        onClick={onClose}
        style={{ marginTop: 22, padding: "13px 26px", borderRadius: 999, border: "none", background: PRIMARY, color: PRIMARY_ON, fontWeight: 700, fontSize: 15, cursor: "pointer" }}
      >
        {t("keepBrowsing")}
      </button>
    </div>
  );
}

function EmptyView() {
  const { t } = useLang();
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 30, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
      <div style={{ fontSize: 46, marginBottom: 10 }}>🛒</div>
      <p style={{ fontSize: 15 }}>{t("emptyCart")}</p>
      <p style={{ fontSize: 13 }}>{t("emptyCartSub")}</p>
    </div>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#fff", fontSize: 16, fontWeight: 700, lineHeight: 1, cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "rgba(255,255,255,0.6)",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 12,
  border: "1.5px solid rgba(255,255,255,0.12)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  invalid?: boolean;
}) {
  const st: React.CSSProperties = {
    ...inputStyle,
    border: `1.5px solid ${invalid ? "#ef4444" : "rgba(255,255,255,0.12)"}`,
  };
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ ...st, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={st} />
      )}
    </label>
  );
}
