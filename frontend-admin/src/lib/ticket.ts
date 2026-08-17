// Generación e impresión de comprobantes internos de un pedido.
//
// Abre una ventana nueva con el comprobante ya maquetado y dispara la
// impresión. Soporta dos formatos:
//   - "termica": rollo de 80mm (impresora tickeadora), monoespaciada y compacta.
//   - "comun":   hoja A4/carta (impresora común), maqueta tipo factura.
//
// El comprobante es de USO INTERNO: además del detalle de venta muestra el
// costo y la ganancia, para que el dueño tenga el panorama completo.

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
  precioUnit: number;
  subtotal: number;
  costoLinea: number;
  gananciaLinea: number;
}

interface TicketCalc {
  lineas: Linea[];
  totalVentas: number;
  totalCosto: number;
  ganancia: number;
}

// Deriva las líneas y totales del pedido (venta, costo y ganancia).
const calcular = (pedido: Pedido): TicketCalc => {
  const lineas: Linea[] = (pedido.items || []).map((it) => {
    const cantidad = Number(it.cantidad) || 0;
    const precioUnit = Number(it.precio_unit) || 0;
    const subtotal = Number(it.subtotal) || precioUnit * cantidad;
    const costoLinea = (Number(it.costo_unit) || 0) * cantidad;
    return {
      nombre: it.nombre,
      cantidad,
      precioUnit,
      subtotal,
      costoLinea,
      gananciaLinea: subtotal - costoLinea,
    };
  });
  const totalVentas =
    Number(pedido.total) ||
    lineas.reduce((a, l) => a + l.subtotal, 0);
  const totalCosto = lineas.reduce((a, l) => a + l.costoLinea, 0);
  return { lineas, totalVentas, totalCosto, ganancia: totalVentas - totalCosto };
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
          <span>${l.cantidad} x ${fmt(l.precioUnit)}</span>
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
    <div class="sep"></div>
    ${filas}
    <div class="sep"></div>
    <div class="row bold big"><span>${t("totalLabel")}</span><span>${fmt(calc.totalVentas)}</span></div>
    <div class="sep dashed"></div>
    <div class="center sm bold">${t("ticketInternal")}</div>
    <div class="row sm"><span>${t("ticketCostLabel")}</span><span>${fmt(calc.totalCosto)}</span></div>
    <div class="row sm bold"><span>${t("ticketProfitLabel")}</span><span>${fmt(calc.ganancia)}</span></div>
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
        <td class="num">${l.cantidad}</td>
        <td class="num">${fmt(l.precioUnit)}</td>
        <td class="num">${fmt(l.subtotal)}</td>
      </tr>`,
    )
    .join("");

  return `
  <div class="doc">
    <div class="head">
      <div>
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

    <div class="totals">
      <div class="t-row big"><span>${t("totalLabel")}</span><span>${fmt(calc.totalVentas)}</span></div>
    </div>

    <div class="internal">
      <div class="internal-title">${t("ticketInternal")}</div>
      <div class="t-row"><span>${t("ticketCostLabel")}</span><span>${fmt(calc.totalCosto)}</span></div>
      <div class="t-row profit"><span>${t("ticketProfitLabel")}</span><span>${fmt(calc.ganancia)}</span></div>
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
      .ticket { width: 80mm; padding: 6mm 4mm; font-size: 12px; line-height: 1.35; }
      .center { text-align: center; }
      .bold { font-weight: 700; }
      .big { font-size: 14px; }
      .sm { font-size: 11px; color: #222; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .it { margin: 3px 0; }
      .it-nom { font-weight: 700; }
      .it-cant { display: flex; justify-content: space-between; gap: 8px; }
      .sep { border-top: 1px dashed #000; margin: 6px 0; }
      .sep.dashed { border-top-style: dashed; }
    `;
  }
  return `
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #1e293b;
           font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .doc { max-width: 720px; margin: 0 auto; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #1e293b; padding-bottom: 14px; margin-bottom: 18px; }
    .local { font-size: 22px; font-weight: 800; }
    .muted { color: #64748b; font-size: 13px; margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 15px; font-weight: 700; letter-spacing: .08em;
                 text-transform: uppercase; color: #334155; }
    .info { display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px;
            color: #334155; margin-bottom: 16px; }
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
    .internal { margin: 18px 0 0 auto; min-width: 260px; max-width: 300px;
                background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 8px;
                padding: 10px 14px; }
    .internal-title { font-size: 11px; font-weight: 700; text-transform: uppercase;
                      letter-spacing: .06em; color: #64748b; margin-bottom: 6px; }
    .internal .t-row { min-width: 0; font-size: 13px; }
    .t-row.profit { font-weight: 800; color: #059669; }
    .nota { margin-top: 18px; font-size: 13px; color: #475569; font-style: italic; }
    .foot { margin-top: 26px; text-align: center; color: #94a3b8; font-size: 12px; }
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
    .toolbar { position: fixed; top: 0; left: 0; right: 0; display: flex; gap: 8px;
               justify-content: center; padding: 10px; background: #0f172a; }
    .toolbar button { padding: 8px 18px; border: none; border-radius: 6px;
                      font-size: 13px; font-weight: 600; cursor: pointer; }
    .toolbar .print { background: #10b981; color: #fff; }
    .toolbar .close { background: #334155; color: #fff; }
    .content { margin-top: 54px; }
    @media print { .toolbar { display: none; } .content { margin-top: 0; } }
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
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
};
