import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import "@fontsource-variable/archivo/wdth.css";
import { BRAND_LOGO, BRAND_NAME } from "../lib/brand";
import { LangSelector, useLang } from "../lib/i18n";
import { IconAlert, IconEye, IconEyeOff, IconLock } from "../lib/icons";
import { MENU_PREVIEW_BASE } from "../lib/menuUrl";

// Pantallas de acceso fuera del panel (restablecer y cambiar contraseña,
// onboarding): mismo mundo "Hora pico" que el login (clases .hp en
// index.css), siempre claro.

export function AccesoLayout({
  titulo,
  subtitulo,
  icono,
  antes,
  ancho = 460,
  children,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  icono?: ReactNode;
  antes?: ReactNode;
  ancho?: number;
  children: ReactNode;
}) {
  // Cuando cambia el título (otro paso, "listo"), el foco va al título: así
  // el teclado no se pierde y el lector anuncia la pantalla nueva.
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const primera = useRef(true);
  const texto = typeof titulo === "string" ? titulo : "";
  useEffect(() => {
    if (texto) document.title = `${texto} · ${BRAND_NAME}`;
    if (primera.current) {
      primera.current = false;
      return;
    }
    h1Ref.current?.focus();
  }, [texto]);
  return (
    <div className="hp min-h-screen">
      <header className="mx-auto flex h-14 max-w-[1120px] items-center justify-between px-4 sm:h-16 sm:px-6">
        <a href={`${MENU_PREVIEW_BASE}/`} className="flex items-center gap-2.5 rounded-lg">
          <img src={BRAND_LOGO} alt="" width={30} height={30} />
          <span className="hp-display text-[1.25rem] lowercase">{BRAND_NAME}</span>
        </a>
        <LangSelector variant="hp" />
      </header>
      <main className="flex justify-center px-3 pb-10 pt-2 sm:px-6 sm:pt-8">
        <div className="w-full rounded-[24px] bg-white p-6 sm:rounded-[28px] sm:p-9" style={{ maxWidth: ancho }}>
          {antes}
          {icono && (
            <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--tinta)] text-[var(--aji)]" aria-hidden>
              {icono}
            </span>
          )}
          <h1 ref={h1Ref} tabIndex={-1} className="hp-display text-[clamp(1.875rem,4vw,2.5rem)] outline-none">
            {titulo}
          </h1>
          {subtitulo && <p className="mt-3 text-[1.0625rem] text-[var(--gris)]">{subtitulo}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function ErrorAcceso({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div id={id} role="alert" className="flex items-center gap-2 rounded-2xl bg-[var(--error-bg)] px-4 py-3 text-[0.9375rem] font-medium text-[var(--error)]">
      <IconAlert size={16} style={{ flexShrink: 0 }} /> {children}
    </div>
  );
}

export function AvisoAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[var(--hueso)] px-4 py-3.5 text-[0.9375rem] leading-relaxed">
      <span className="mt-0.5 shrink-0 text-[var(--aji-deep)]" aria-hidden>
        <IconAlert size={17} />
      </span>
      {children}
    </div>
  );
}

// Campo de contraseña con botón para mostrarla.
export function CampoClave({
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  invalido = false,
  descripcion,
  debajo,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalido?: boolean;
  descripcion?: string;
  debajo?: ReactNode;
}) {
  const { t } = useLang();
  const id = useId();
  const [ver, setVer] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="hp-label mb-2 block text-[var(--gris)]">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gris)]" aria-hidden>
          <IconLock size={17} />
        </span>
        <input
          id={id}
          className="auth-input pr-12"
          type={ver ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalido || undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-describedby={descripcion}
          style={invalido ? { borderColor: "var(--error)" } : undefined}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={t("showPwd")}
          aria-pressed={ver}
          className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[var(--gris)] transition-colors hover:text-[var(--tinta)]"
        >
          {ver ? <IconEyeOff size={17} /> : <IconEye size={17} />}
        </button>
      </div>
      {debajo}
    </div>
  );
}
