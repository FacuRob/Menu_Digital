// Modal que aparece al entregar un pedido: pregunta si se quiere generar el
// ticket y ofrece elegir el tipo de impresora (térmica o común).

import { useDialogos } from "../lib/dialogos";
import Modal from "./Modal";
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
  const { moneda } = useNegocio();
  const { t } = useLang();
  const { avisar } = useDialogos();

  if (!pedido) return null;

  const fmt = (n: number) => fmtMoney(n, moneda);

  const totalVentas =
    Number(pedido.total) ||
    (pedido.items || []).reduce((a, it) => a + Number(it.subtotal || 0), 0);

  const textPrimary = "var(--fg)";
  const textSecondary = "var(--fg-2)";
  const textMuted = "var(--fg-3)";
  const cardBorder = "var(--line)";

  const imprimir = (formato: FormatoTicket) => {
    const ok = imprimirTicket(pedido, config, moneda, formato, t);
    if (!ok) {
      void avisar({ mensaje: t("ticketPopupBlocked") });
      return;
    }
    onClose();
  };

  return (
    <Modal
      title={t("ticketAsk")}
      subtitle={t("ticketAskDesc", { n: pedido.id })}
      icon={<IconReceipt size={20} />}
      onClose={onClose}
      maxWidth={440}
    >
      <div style={{ padding: "18px 22px 22px" }}>
        {/* Total del pedido (sin costo ni ganancia: eso solo se ve en el Dashboard) */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            margin: "0 0 18px",
            background: "var(--surface-2)",
            border: `1px solid ${cardBorder}`,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 12, color: textMuted }}>{t("totalLabel")}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: textPrimary }}>
            {fmt(totalVentas)}
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
            accent="var(--violet)"
            icon="🧾"
            border={cardBorder}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            onClick={() => imprimir("termica")}
          />
          <PrinterButton
            title={t("ticketCommon")}
            desc={t("ticketCommonDesc")}
            accent="var(--teal)"
            icon="🖨️"
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
    </Modal>
  );
}

function PrinterButton({
  title,
  desc,
  accent,
  icon,
  border,
  textPrimary,
  textSecondary,
  onClick,
}: {
  title: string;
  desc: string;
  accent: string;
  icon: string;
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
        background: "var(--surface)",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `color-mix(in srgb, ${accent} 40%, transparent)`;
        e.currentTarget.style.background = `color-mix(in srgb, ${accent} 7%, transparent)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = border;
        e.currentTarget.style.background = "var(--surface)";
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `color-mix(in srgb, ${accent} 9%, transparent)`,
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
