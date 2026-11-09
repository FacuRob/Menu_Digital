import { fmtPeso } from "./cantidad";
// Generación e impresión de comprobantes de un pedido.
//
// Abre una ventana nueva con el comprobante ya maquetado y dispara la
// impresión. Soporta dos formatos:
//   - "termica": rollo de 80mm (impresora tickeadora), monoespaciada y compacta.
//   - "comun":   hoja A4/carta (impresora común), maqueta tipo factura.
//
// El comprobante NO muestra costo ni ganancia: esa información es privada del
// negocio y solo se ve en el Dashboard.

import type { Pedido, Configuracion } from "../services/api";
import { fmtMoney } from "./money";

export type FormatoTicket = "termica" | "comun";

// Traductor del panel (misma firma que `useLang().t`).
type T = (key: string, vars?: Record<string, string | number>) => string;

// Escapa texto para insertarlo seguro en el HTML del comprobante.
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Fecha/hora legible respetando la zona de quien imprime.
const fmtFecha = (s?: string) => {
  if (!s) return "";
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  const d = new Date(hasTz ? s : s.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface Linea {
  nombre: string;
  cantidad: number;
  unidad?: string;
  precioUnit: number;
  subtotal: number;
}

interface TicketCalc {
  lineas: Linea[];
  total: number;
}

// Deriva las líneas y el total del pedido.
const calcular = (pedido: Pedido): TicketCalc => {
  const lineas: Linea[] = (pedido.items || []).map((it) => {
    const cantidad = Number(it.cantidad) || 0;
    const precioUnit = Number(it.precio_unit) || 0;
    const subtotal = Number(it.subtotal) || precioUnit * cantidad;
    return { nombre: it.nombre, cantidad, unidad: it.unidad, precioUnit, subtotal };
  });
  const total =
    Number(pedido.total) || lineas.reduce((a, l) => a + l.subtotal, 0);
  return { lineas, total };
};

// Etiqueta del tipo de entrega del pedido.
const tipoLabel = (pedido: Pedido, t: T) => {
  if (pedido.tipo_entrega === "delivery") return t("pedDelivery");
  if (pedido.tipo_entrega === "retiro") return t("pedPickupInLocal");
  if (pedido.mesa) return t("pedTableN", { n: pedido.mesa });
  return t("pedOrder");
};

// ── Formato térmico (80mm) ───────────────────────────────────
const htmlTermica = (
  pedido: Pedido,
  config: Configuracion | null,
  moneda: string,
  calc: TicketCalc,
  t: T,
): string => {
  const fmt = (n: number) => fmtMoney(n, moneda);
  const local = config?.nombre || t("ticketLocalFallback");

  const filas = calc.lineas
    .map(
      (l) => `
      <div class="it">
        <div class="it-nom">${esc(l.nombre)}</div>
        <div class="it-cant">
          <span>${l.unidad === "kg" ? `${fmtPeso(l.cantidad)} x ${fmt(l.precioUnit)}/kg` : `${l.cantidad} x ${fmt(l.precioUnit)}`}</span>
          <span>${fmt(l.subtotal)}</span>
        </div>
      </div>`,
    )
    .join("");

  return `
  <div class="ticket">
    <div class="center bold big">${esc(local)}</div>
    ${config?.direccion ? `<div class="center sm">${esc(config.direccion)}</div>` : ""}
    ${config?.telefono ? `<div class="center sm">${t("ticketPhoneShort")}: ${esc(config.telefono)}</div>` : ""}
    <div class="sep"></div>
    <div class="row"><span>${t("ticketOrder")} #${pedido.id}</span><span>${esc(tipoLabel(pedido, t))}</span></div>
    <div class="row sm"><span>${esc(fmtFecha(pedido.created_at))}</span></div>
    ${pedido.cliente ? `<div class="row sm"><span>${t("ticketClient")}: ${esc(pedido.cliente)}</span></div>` : ""}
    ${pedido.direccion_entrega ? `<div class="row sm"><span>${t("ticketAddress")}: ${esc(pedido.direccion_entrega)}</span></div>` : ""}
    <div class="sep"></div>
    ${filas}
    <div class="sep"></div>
    <div class="row bold big"><span>${t("totalLabel")}</span><span>${fmt(calc.total)}</span></div>
    ${pedido.nota ? `<div class="sep"></div><div class="sm">${t("ticketNote")}: ${esc(pedido.nota)}</div>` : ""}
    <div class="sep"></div>
    <div class="center sm">${t("ticketThanks")}</div>
  </div>`;
};

// ── Formato común (A4 / carta) ───────────────────────────────
const htmlComun = (
  pedido: Pedido,
  config: Configuracion | null,
  moneda: string,
  calc: TicketCalc,
  t: T,
): string => {
  const fmt = (n: number) => fmtMoney(n, moneda);
  const local = config?.nombre || t("ticketLocalFallback");

  const filas = calc.lineas
    .map(
      (l) => `
      <tr>
        <td>${esc(l.nombre)}</td>
        <td class="num">${l.unidad === "kg" ? fmtPeso(l.cantidad) : l.cantidad}</td>
        <td class="num">${fmt(l.precioUnit)}</td>
        <td class="num">${fmt(l.subtotal)}</td>
      </tr>`,
    )
    .join("");

  return `
  <div class="doc">
    <div class="head">
      <div class="head-local">
        <div class="local">${esc(local)}</div>
        ${config?.direccion ? `<div class="muted">${esc(config.direccion)}</div>` : ""}
        ${config?.telefono ? `<div class="muted">${t("ticketPhoneShort")}: ${esc(config.telefono)}</div>` : ""}
      </div>
      <div class="doc-meta">
        <div class="doc-title">${t("ticketTitle")}</div>
        <div class="muted">${t("ticketOrder")} #${pedido.id}</div>
        <div class="muted">${esc(fmtFecha(pedido.created_at))}</div>
      </div>
    </div>

    <div class="info">
      <span><strong>${t("ticketType")}:</strong> ${esc(tipoLabel(pedido, t))}</span>
      ${pedido.cliente ? `<span><strong>${t("ticketClient")}:</strong> ${esc(pedido.cliente)}</span>` : ""}
      ${pedido.direccion_entrega ? `<span><strong>${t("ticketAddress")}:</strong> ${esc(pedido.direccion_entrega)}</span>` : ""}
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${t("ticketItem")}</th>
            <th class="num">${t("ticketQty")}</th>
            <th class="num">${t("ticketUnit")}</th>
            <th class="num">${t("ticketSubtotal")}</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>

    <div class="totals">
      <div class="t-row big"><span>${t("totalLabel")}</span><span>${fmt(calc.total)}</span></div>
    </div>

    ${pedido.nota ? `<div class="nota"><strong>${t("ticketNote")}:</strong> ${esc(pedido.nota)}</div>` : ""}
    <div class="foot">${t("ticketThanks")}</div>
  </div>`;
};

// Hoja de estilos para cada formato.
const estilos = (formato: FormatoTicket): string => {
  if (formato === "termica") {
    return `
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #000;
             font-family: 'Courier New', ui-monospace, monospace; }
      .ticket { width: 80mm; max-width: 100%; margin: 0 auto; padding: 6mm 4mm;
                font-size: 12px; line-height: 1.35; }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .big { font-size: 14px; }
      .sm { font-size: 11px; color: #222; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .it { margin: 3px 0; }
      .it-nom { font-weight: 700; }
      .it-cant { display: flex; justify-content: space-between; gap: 8px; }
      .sep { border-top: 1px dashed #000; margin: 6px 0; }
    `;
  }
  // En pantalla se ve como una hoja sobre fondo gris (vista previa); al
  // imprimir, la hoja ocupa la página sin sombra ni márgenes extra.
  return `
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e2e8f0; color: #1e293b;
           font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .content { padding: 24px 16px 32px; }
    .doc { width: 100%; max-width: 794px; margin: 0 auto; background: #fff;
           padding: 48px 52px; border-radius: 6px;
           box-shadow: 0 10px 30px -12px rgba(15,23,42,.35); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
            border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
    .head-local { min-width: 0; }
    .local { font-size: 22px; font-weight: 800; overflow-wrap: anywhere; }
    .muted { color: #64748b; font-size: 13px; margin-top: 2px; }
    .doc-meta { text-align: right; flex-shrink: 0; }
    .doc-title { font-size: 15px; font-weight: 700; letter-spacing: .08em;
                 text-transform: uppercase; color: #334155; }
    .info { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px;
            color: #334155; margin-bottom: 16px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; background: #f1f5f9; color: #334155;
         padding: 9px 10px; border-bottom: 1px solid #e2e8f0; }
    td { padding: 9px 10px; border-bottom: 1px solid #eef2f7; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 14px; display: flex; justify-content: flex-end; }
    .t-row { display: flex; justify-content: space-between; gap: 40px;
             min-width: 240px; padding: 4px 0; font-size: 14px; }
    .t-row.big { font-size: 18px; font-weight: 800; border-top: 2px solid #1e293b;
                 padding-top: 8px; }
    .nota { margin-top: 18px; font-size: 13px; color: #475569; font-style: italic; }
    .foot { margin-top: 26px; text-align: center; color: #94a3b8; font-size: 12px; }

    @media (max-width: 640px) {
      .content { padding: 12px 8px 20px; }
      .doc { padding: 24px 18px; }
      .head { flex-direction: column; }
      .doc-meta { text-align: left; }
      .t-row { min-width: 0; width: 100%; gap: 16px; }
      th, td { padding: 8px 6px; }
    }
    @media print {
      body { background: #fff; }
      .content { padding: 0; }
      .doc { max-width: none; padding: 0; border-radius: 0; box-shadow: none; }
    }
  `;
};

// Genera el documento HTML completo listo para imprimir.
export const generarTicketHTML = (
  pedido: Pedido,
  config: Configuracion | null,
  moneda: string,
  formato: FormatoTicket,
  t: T,
): string => {
  const calc = calcular(pedido);
  const cuerpo =
    formato === "termica"
      ? htmlTermica(pedido, config, moneda, calc, t)
      : htmlComun(pedido, config, moneda, calc, t);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t("ticketTitle")} #${pedido.id} — ${esc(config?.nombre || "")}</title>
  <style>${estilos(formato)}
    .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; gap: 8px;
               justify-content: center; padding: 10px; background: #0f172a; }
    .toolbar button { padding: 8px 18px; border: none; border-radius: 6px;
                      font-size: 13px; font-weight: 600; cursor: pointer; }
    .toolbar .print { background: #10b981; color: #fff; }
    .toolbar .close { background: #334155; color: #fff; }
    body { padding-top: 54px; }
    @media print { .toolbar { display: none; } body { padding-top: 0; } }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="print" onclick="window.print()">${t("ticketPrint")}</button>
    <button class="close" onclick="window.close()">${t("actionCancel")}</button>
  </div>
  <div class="content">${cuerpo}</div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 250);
    });
  </script>
</body>
</html>`;
};

// Tamaño de la ventana de vista previa según el formato: el ticket térmico es
// angosto; la hoja común necesita ancho de A4 para verse sin agrandar.
const tamanoVentana = (formato: FormatoTicket) => {
  const [w, h] = formato === "termica" ? [420, 720] : [900, 1000];
  const width = Math.min(w, window.screen.availWidth - 40);
  const height = Math.min(h, window.screen.availHeight - 60);
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  return `width=${width},height=${height},left=${left},top=${top}`;
};

// Abre la ventana de impresión con el comprobante. Devuelve false si el
// navegador bloqueó el popup (para avisar al usuario).
export const imprimirTicket = (
  pedido: Pedido,
  config: Configuracion | null,
  moneda: string,
  formato: FormatoTicket,
  t: T,
): boolean => {
  const html = generarTicketHTML(pedido, config, moneda, formato, t);
  const win = window.open("", "_blank", tamanoVentana(formato));
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
