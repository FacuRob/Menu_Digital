import type { ReactNode } from "react";

// Piezas básicas del panel, sobre los tokens (src/styles/tokens.css).
// Tailwind con clases semánticas: bg-surface, text-fg-2, border-line…

export function Card({
  title,
  desc,
  action,
  children,
  className = "",
  as: Tag = "section",
}: {
  title?: ReactNode;
  desc?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <Tag className={`min-w-0 rounded-[var(--r-lg)] border border-line bg-surface p-5 shadow-[var(--shadow-1)] sm:p-6 ${className}`}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="pn-title text-[1.125rem] text-fg">{title}</h2>}
            {desc && <p className="mt-1 text-sm text-fg-3">{desc}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

// Selector de opciones excluyentes (7 / 30 / 90 días, etc.).
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full bg-surface-3 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`min-h-9 cursor-pointer rounded-full px-3.5 text-sm font-semibold transition-colors ${
              on ? "bg-surface text-fg shadow-[var(--shadow-1)]" : "text-fg-3 hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Interruptor (encendido / apagado) con rol de switch y teclado.
export function Switch({
  checked,
  onChange,
  label,
  color = "var(--ok)",
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--r-sm)] text-left text-sm text-fg-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden
        className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
        style={{ background: checked ? color : "var(--fg-3)" }}
      >
        <span
          className="absolute top-[3px] h-4 w-4 rounded-full bg-surface transition-[left]"
          style={{ left: checked ? 19 : 3 }}
        />
      </span>
      {label}
    </button>
  );
}

export function EmptyState({ icon, title, desc }: { icon?: ReactNode; title: ReactNode; desc?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-md)] bg-surface-2 px-4 py-8 text-center">
      {icon && (
        <span className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-fg-3" aria-hidden>
          {icon}
        </span>
      )}
      <p className="font-semibold text-fg">{title}</p>
      {desc && <p className="max-w-xs text-sm text-fg-3">{desc}</p>}
    </div>
  );
}

// Variación contra el período anterior: ↑ 12 % / ↓ 3 %.
export function Delta({ value, inverse = false, label }: { value: number | null; inverse?: boolean; label: string }) {
  if (value === null || !isFinite(value)) return <span className="text-sm text-fg-3">{label}</span>;
  if (Math.abs(value) < 0.05)
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <span className="pn-num rounded-md bg-surface-3 px-1.5 py-0.5 font-bold text-fg-2">= 0%</span>
        <span className="text-fg-3">{label}</span>
      </span>
    );
  const up = value >= 0;
  const bueno = inverse ? !up : up;
  const n = Math.abs(value);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`pn-num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold ${
          bueno ? "bg-ok-bg text-ok" : "bg-err-bg text-err"
        }`}
      >
        <span aria-hidden>{up ? "↑" : "↓"}</span>
        <span className="sr-only">{up ? "+" : "−"}</span>
        {n.toFixed(n < 10 ? 1 : 0)}%
      </span>
      <span className="text-fg-3">{label}</span>
    </span>
  );
}
