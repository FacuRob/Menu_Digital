import { DEMOS } from "./demos";
import { WhatsAppPedido } from "./Pedido";
import { parsePrecio, pesos, totalDe, type Linea } from "./comanda-utils";
import { IconChat, IconPlus } from "./icons";

// Teléfono de la escena "del QR al WhatsApp". Tiene tres pantallas apiladas
// (escanea, elige, le llega al local); el scroll las va mostrando. Sin
// movimiento sólo se ve la última (landing.css › .dx-pantalla).
// El local de sushi: su color no se confunde con el fondo ají de la escena.
const DEMO = DEMOS.find((d) => d.rubro === "Sushi") ?? DEMOS[0];

const CANTIDADES = [1, 2, 1];
const PEDIDO_EJEMPLO: Linea[] = DEMO.items.map((it, i) => ({
  qty: CANTIDADES[i],
  name: it.name,
  amount: CANTIDADES[i] * parsePrecio(it.price),
}));

function Escaneo() {
  return (
    <div className="dx-pantalla flex-col items-center justify-center bg-[#0c0d10] text-white" data-pantalla="1">
      <div className="relative grid h-44 w-44 place-items-center">
        {/* Esquinas del visor de la cámara */}
        <svg viewBox="0 0 176 176" className="absolute inset-0 h-full w-full" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round">
          <path d="M2 38V8a6 6 0 016-6h30M138 2h30a6 6 0 016 6v30M174 138v30a6 6 0 01-6 6h-30M38 174H8a6 6 0 01-6-6v-30" />
        </svg>
        <div className="grid h-28 w-28 grid-cols-3 gap-1.5 rounded-lg bg-white p-2">
          {[1, 0, 1, 0, 1, 0, 1, 1, 0].map((on, i) => (
            <span key={i} className={`rounded-[3px] ${on ? "bg-[var(--tinta)]" : "bg-transparent"}`} />
          ))}
        </div>
        <span data-escaner className="absolute inset-x-3 top-1/2 h-0.5 rounded-full bg-[var(--aji)] shadow-[0_0_12px_2px_rgba(255,91,36,0.6)]" />
      </div>
      <p className="mt-8 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--tinta)]">
        Abrir la carta de {DEMO.nombre}
      </p>
    </div>
  );
}

function Carta() {
  return (
    <div className="dx-pantalla flex-col bg-white text-[var(--tinta)]" data-pantalla="2">
      <div className="px-4 pb-4 pt-9" style={{ background: DEMO.accent }}>
        <p className="dx-display text-[1.6rem]">{DEMO.nombre}</p>
        <p className="mt-1 text-xs font-medium">{DEMO.tagline}</p>
      </div>
      <ul className="flex-1 divide-y divide-[var(--tinta)]/10">
        {DEMO.items.map((it, i) => (
          <li key={it.name} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{it.name}</p>
              <p className="truncate text-xs text-[var(--gris)]">{it.desc}</p>
              <p className="dx-tabular mt-0.5 text-sm font-semibold">{it.price}</p>
            </div>
            <span
              data-sumar={i}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-white"
            >
              <IconPlus className="h-4 w-4" />
            </span>
          </li>
        ))}
      </ul>
      <div className="m-3 flex items-center justify-between rounded-full bg-[var(--aji)] px-4 py-3 text-sm font-bold">
        <span>
          Ver pedido · {CANTIDADES.reduce((a, b) => a + b, 0)}
        </span>
        <span className="dx-tabular">{pesos(totalDe(PEDIDO_EJEMPLO))}</span>
      </div>
    </div>
  );
}

function Chat() {
  return (
    <div className="dx-pantalla flex-col bg-[var(--wa-ground)]" data-pantalla="3">
      <div className="flex items-center gap-2 bg-[var(--wa-header)] px-4 pb-3 pt-9 text-sm font-medium text-white">
        <IconChat className="h-4 w-4" />
        WhatsApp de {DEMO.nombre}
      </div>
      <div className="flex flex-1 flex-col justify-end pb-4">
        <WhatsAppPedido sinCabecera negocio={DEMO.nombre} mesa="4" numero={128} lineas={PEDIDO_EJEMPLO} className="rounded-none" />
      </div>
    </div>
  );
}

export default function Telefono({ className = "" }: { className?: string }) {
  return (
    <div>
      <p className="dx-label mb-3 text-center">Ejemplo · {DEMO.nombre}</p>
      <div
        className={`relative aspect-[9/19] w-full overflow-hidden rounded-[2.75rem] border-[10px] border-[var(--tinta)] bg-[var(--tinta)] ${className}`}
        aria-hidden
      >
        <span className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-[var(--tinta)]" />
        <div className="relative h-full w-full overflow-hidden rounded-[2rem]">
          <Escaneo />
          <Carta />
          <Chat />
        </div>
      </div>
    </div>
  );
}
