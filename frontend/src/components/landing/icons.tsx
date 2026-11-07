// Íconos dibujados a mano para la landing: un solo trazo (1.75) y estilo.
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconCheck({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
    </svg>
  );
}

export function IconArrow({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconPlus({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconMinus({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconMenu({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// Globo de chat: representa el WhatsApp del local (sin usar la marca).
export function IconChat({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 19.5l1.2-3.6A7.5 7.5 0 1112 19.5a7.6 7.6 0 01-3.6-.9z" />
      <path d="M9 11.5h6M9 14h3.5" />
    </svg>
  );
}

// Doble tilde de "leído" en el mensaje.
export function IconTicks({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} viewBox="0 0 28 24" className={className}>
      <path d="M2.5 13l4.5 4.5L17 7.5" />
      <path d="M12 17.5L22 7.5" />
    </svg>
  );
}

// Marca de DinexFlow: un globo de chat (el pedido que llega) con los
// módulos de un QR adentro, sobre un cuadrado ají.
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#ff5b24" />
      <path d="M7 9.5A2.5 2.5 0 019.5 7h13A2.5 2.5 0 0125 9.5v9a2.5 2.5 0 01-2.5 2.5H13l-4.6 3.8a.6.6 0 01-1-.5V21A2.5 2.5 0 017 18.5z" fill="#111216" />
      <rect x="10.5" y="10" width="4" height="4" rx="1" fill="#efede6" />
      <rect x="17.5" y="10" width="4" height="4" rx="1" fill="#efede6" />
      <rect x="10.5" y="15" width="4" height="3" rx="1" fill="#efede6" />
      <rect x="18" y="15.5" width="2" height="2" rx=".5" fill="#ff5b24" />
    </svg>
  );
}
