// Modal que aparece al entregar un pedido: pregunta si se quiere generar el
// ticket y ofrece elegir el tipo de impresora (térmica o común). Muestra
// también la ganancia del pedido, para uso interno del dueño.

import { useTheme } from "../context/ThemeContext";
import { useNegocio } from "../context/NegocioContext";
import { useLang } from "../lib/i18n";
import { fmtMoney } from "../lib/money";
import { imprimirTicket, type FormatoTicket } from "../lib/ticket";
import { IconReceipt } from "../lib/icons";
import type { Pedido, Configuracion } from "../services/api";

interface Props {
  pedido: Pedido | null;
  config: Configuracion | null;
  onClose: () => void;
}

export default function TicketModal({ pedido, config, onClose }: Props) {
  const { isDark } = useTheme();
  const { moneda } = useNegocio();
  const { t } = useLang();

  if (!pedido) return null;

  const fmt = (n: number) => fmtMoney(n, moneda);

  // Ganancia del pedido = ventas − costo (costo congelado en cada ítem).
  const totalVentas =
    Number(pedido.total) ||
    (pedido.items || []).reduce((a, it) => a + Number(it.subtotal || 0), 0);
  const totalCosto = (pedido.items || []).reduce(
    (a, it) => a + Number(it.costo_unit || 0) * Number(it.cantidad || 0),
    0,
  );
  const ganancia = totalVentas - totalCosto;

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const textMuted = isDark ? "#475569" : "#94a3b8";
  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";

  const imprimir = (formato: FormatoTicket) => {
    const ok = imprimirTicket(pedido, config, moneda, formato, t);
    if (!ok) {
      alert(t("ticketPopupBlocked"));
      return;
    }
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 16,
          padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        {/* Encabezado */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: "#10b98118",
              border: "1px solid #10b98130",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#10b981",
              flexShrink: 0,
            }}
          >
            <IconReceipt size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: textPrimary }}>
              {t("ticketAsk")}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: textSecondary }}>
              {t("ticketAskDesc", { n: pedido.id })}
            </p>
          </div>
        </div>

        {/* Resumen: total y ganancia */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            margin: "16px 0 18px",
          }}
        >
          <div
            style={{
              background: isDark ? "rgba(255,255,255,0.03)" : "#f8fafc",
              border: `1px solid ${cardBorder}`,
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 3 }}>
              {t("totalLabel")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: textPrimary }}>
              {fmt(totalVentas)}
            </div>
          </div>
          <div
            style={{
              background: isDark ? "rgba(16,185,129,0.08)" : "#ecfdf5",
              border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: textMuted, marginBottom: 3 }}>
              {t("ticketProfitLabel")}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#10b981" }}>
              {fmt(ganancia)}
            </div>
          </div>
        </div>

        {/* Opciones de impresora */}
        <div style={{ fontSize: 11, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
          {t("ticketChoosePrinter")}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <PrinterButton
            title={t("ticketThermal")}
            desc={t("ticketThermalDesc")}
            accent="#8b5cf6"
            icon="🧾"
            isDark={isDark}
            border={cardBorder}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            onClick={() => imprimir("termica")}
          />
          <PrinterButton
            title={t("ticketCommon")}
            desc={t("ticketCommonDesc")}
            accent="#0ea5e9"
            icon="🖨️"
            isDark={isDark}
            border={cardBorder}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            onClick={() => imprimir("comun")}
          />
        </div>

        {/* Cancelar */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 9,
            border: `1px solid ${cardBorder}`,
            background: "transparent",
            color: textSecondary,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("ticketNoThanks")}
        </button>
      </div>
    </div>
  );
}

function PrinterButton({
  title,
  desc,
  accent,
  icon,
  isDark,
  border,
  textPrimary,
  textSecondary,
  onClick,
}: {
  title: string;
  desc: string;
  accent: string;
  icon: string;
  isDark: boolean;
  border: string;
  textPrimary: string;
  textSecondary: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 14px",
        borderRadius: 11,
        border: `1px solid ${border}`,
        background: isDark ? "rgba(255,255,255,0.02)" : "#fff",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}66`;
        e.currentTarget.style.background = `${accent}12`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.02)" : "#fff";
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${accent}18`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: textPrimary }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: 12, color: textSecondary }}>
          {desc}
        </span>
      </span>
      <span style={{ color: accent, fontSize: 18, fontWeight: 700 }}>→</span>
    </button>
  );
}
