import { useEffect, type ReactNode } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "./menu/menu.css";
import type { Configuracion } from "../services/api";
import { paletteVars, PRIMARY, PRIMARY_ON } from "../lib/menuUi";

// Página pública simple con la identidad del negocio (color y logo):
// la usan "Pedir presupuesto", "Reservar turno" y sus links de seguimiento.
export function Hoja({
  negocio,
  config,
  titulo,
  volver,
  children,
}: {
  negocio?: string | null;
  config?: Configuracion | null;
  titulo: string;
  volver?: string | null;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = negocio ? `${titulo} · ${negocio}` : titulo;
  }, [titulo, negocio]);
  return (
    <div className="mn min-h-screen px-4 py-6 sm:py-10" style={paletteVars(config?.color_primario)}>
      <main className="mx-auto max-w-lg overflow-hidden rounded-[var(--r-lg)] bg-[var(--surface)]">
        <header className="mn-sobre-color px-6 pb-6 pt-6" style={{ background: PRIMARY, color: PRIMARY_ON }}>
          {volver && (
            <a href={volver} className="mn-label mb-3 inline-flex min-h-11 items-center underline underline-offset-4">
              ← Volver
            </a>
          )}
          <div className="flex items-center gap-4">
            {config?.logo_url && <img src={config.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-[14px] bg-white object-cover" />}
            <div className="min-w-0">
              {negocio && <p className="mn-label opacity-80">{negocio}</p>}
              <h1 className="mn-display mt-1 text-[clamp(1.75rem,7vw,2.25rem)]">{titulo}</h1>
            </div>
          </div>
        </header>
        <div className="px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="mn grid min-h-screen place-items-center p-6 text-center" role="status">
      <p className="text-[15px] font-semibold">{texto}</p>
    </div>
  );
}

export function NoEncontrado({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mn grid min-h-screen place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="mn-display text-[clamp(2rem,8vw,3rem)]">{titulo}</h1>
        <p className="mt-4 text-[var(--fg-2)]">{texto}</p>
      </div>
    </div>
  );
}
