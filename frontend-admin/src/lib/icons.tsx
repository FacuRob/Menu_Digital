import type { CSSProperties } from "react";

// Iconos de línea (SVG) reutilizables. Heredan el color con `currentColor`.
type P = { size?: number; style?: CSSProperties };

const base = (size: number, style?: CSSProperties) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style,
});

// ── Rubros ──
export const IconUtensils = ({ size = 20, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M4 3v6a2 2 0 0 0 4 0V3M6 9v12" />
    <path d="M18 3c-1.7 0-3 2.2-3 5s1.3 4 3 4v9" />
  </svg>
);
export const IconBag = ({ size = 20, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
);
export const IconTools = ({ size = 20, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" />
  </svg>
);
export const IconBox = ({ size = 20, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5V8z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </svg>
);

// ── UI ──
export const IconEye = ({ size = 18, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconEyeOff = ({ size = 18, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9M6.6 6.6A17.7 17.7 0 0 0 2 11s3.5 7 10 7a9.5 9.5 0 0 0 3.4-.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </svg>
);
export const IconInfo = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconAlert = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
export const IconCheck = ({ size = 24, style }: P) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);
export const IconSparkle = ({ size = 14, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
    <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7z" />
  </svg>
);
export const IconPlus = ({ size = 15, style }: P) => (
  <svg {...base(size, style)} strokeWidth={2.2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconTrash = ({ size = 15, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
export const IconX = ({ size = 15, style }: P) => (
  <svg {...base(size, style)} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconLock = ({ size = 24, style }: P) => (
  <svg {...base(size, style)}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconImage = ({ size = 22, style }: P) => (
  <svg {...base(size, style)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
export const IconBell = ({ size = 20, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
export const IconPin = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);
export const IconNote = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
    <path d="M14 3v6h6M8 13h8M8 17h5" />
  </svg>
);
export const IconTruck = ({ size = 18, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M1 3h13v10H1zM14 7h4l3 3v3h-7z" />
    <circle cx="5.5" cy="17" r="2" />
    <circle cx="17.5" cy="17" r="2" />
  </svg>
);
export const IconBan = ({ size = 28, style }: P) => (
  <svg {...base(size, style)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </svg>
);
export const IconPhone = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);
export const IconReceipt = ({ size = 16, style }: P) => (
  <svg {...base(size, style)}>
    <path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3z" />
    <path d="M8 8h8M8 12h8" />
  </svg>
);
