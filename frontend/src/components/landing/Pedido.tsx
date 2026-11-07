import type { CSSProperties } from "react";
import { IconChat, IconTicks } from "./icons";
import { pesos, totalDe, type Linea } from "./comanda-utils";

const numeroPedido = (n: number) => `Nº ${String(n).padStart(4, "0")}`;

type PedidoProps = {
  numero: number;
  mesa: string;
  lineas: Linea[];
  enviado?: boolean;
  vacio?: string;
  className?: string;
};

// El pedido tal como lo arma el cliente: renglones, cantidades y total.
export function PedidoCard({ numero, mesa, lineas, enviado = false, vacio, className = "" }: PedidoProps) {
  return (
    <div className={`rounded-[var(--radio)] bg-[var(--hueso)] p-6 text-[var(--tinta)] sm:p-8 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <p className="dx-label text-[var(--gris)]">
          Pedido {numeroPedido(numero)} · Mesa {mesa}
        </p>
        <span
          className={`dx-label rounded-full px-3 py-1 transition-colors duration-200 ${
            enviado ? "bg-[var(--cobalto)] text-white" : "bg-[var(--hueso-2)] text-[var(--gris)]"
          }`}
        >
          {enviado ? "Enviado" : "Armando"}
        </span>
      </div>

      <ul className="mt-6 min-h-[9.5rem] divide-y divide-[var(--tinta)]/10 border-y border-[var(--tinta)]/10" aria-label="Detalle del pedido">
        {lineas.length === 0 && vacio && <li className="py-4 text-[var(--gris)]">{vacio}</li>}
        {lineas.map((l) => (
          <li key={l.name} className="dx-tabular grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-2 py-3.5 text-lg">
            <span className="font-semibold">{l.qty}×</span>
            <span className="truncate">{l.name}</span>
            <span className="font-semibold">{pesos(l.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-baseline justify-between">
        <span className="dx-label text-[var(--gris)]">Total</span>
        <span className="dx-display dx-tabular text-[2.5rem]">{pesos(totalDe(lineas))}</span>
      </div>
    </div>
  );
}

type BubbleProps = {
  negocio: string;
  mesa: string;
  numero: number;
  lineas: Linea[];
  hora?: string;
  className?: string;
  style?: CSSProperties;
  /** Sin la barra superior (dentro del teléfono ya hay una). */
  sinCabecera?: boolean;
};

// El mensaje tal como le llega al local por WhatsApp. Usa la letra del
// sistema y los colores de WhatsApp a propósito: es una cita de esa app.
export function WhatsAppPedido({
  negocio,
  mesa,
  numero,
  lineas,
  hora = "21:04",
  className = "",
  style,
  sinCabecera = false,
}: BubbleProps) {
  return (
    <figure className={`overflow-hidden rounded-[22px] bg-[var(--wa-ground)] ${className}`} style={style}>
      {!sinCabecera && (
        <figcaption className="flex items-center gap-2 bg-[var(--wa-header)] px-4 py-2.5 text-sm font-medium text-white">
          <IconChat className="h-4 w-4" />
          WhatsApp de {negocio}
        </figcaption>
      )}
      <div className="p-3">
        <div
          className="ml-auto max-w-[19rem] rounded-xl rounded-tr-sm bg-[var(--wa-bubble)] px-3.5 pb-1.5 pt-2.5 text-[0.9375rem] leading-snug text-[var(--wa-ink)] shadow-[0_1px_1px_rgba(0,0,0,0.12)]"
          style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
        >
          <p className="font-bold">Nuevo pedido {numeroPedido(numero)}</p>
          <p>Mesa {mesa}</p>
          <ul className="my-1.5">
            {lineas.map((l) => (
              <li key={l.name} className="dx-tabular">
                {l.qty}x {l.name} · {pesos(l.amount)}
              </li>
            ))}
          </ul>
          <p className="dx-tabular font-bold">Total: {pesos(totalDe(lineas))}</p>
          <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-[var(--wa-meta)]">
            {hora}
            <IconTicks className="h-4 w-4 text-[var(--wa-tick)]" />
          </p>
        </div>
      </div>
    </figure>
  );
}
