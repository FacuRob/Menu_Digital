import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useLang } from "../lib/i18n";
import { BRAND_LOGO, BRAND_NAME, brandTextStyle } from "../lib/brand";

// Pantalla de carga del panel: logo con aro giratorio, "Cargando..." y una
// barra animada. Los estilos están en index.css (clases .dx-loader-*).
//
// `leaving` la desvanece antes de quitarla. Las animaciones usan el reloj de
// la página como punto de partida (--dx-t), así que si una pantalla de carga
// reemplaza a otra (sesión → código de la página → datos) la animación sigue
// donde iba en vez de reiniciarse.
export default function LoadingScreen({ leaving = false }: { leaving?: boolean }) {
  const { isDark } = useTheme();
  const { t } = useLang();
  const [t0] = useState(() => `-${Math.round(performance.now())}ms`);

  return (
    <div
      className={`dx-loader${leaving ? " is-leaving" : ""}`}
      role="status"
      aria-live="polite"
      style={
        {
          "--dx-t": t0,
          background: isDark ? "#0f1117" : "#f0f2f5",
          color: isDark ? "#94a3b8" : "#64748b",
        } as React.CSSProperties
      }
    >
      <div className="dx-loader-mark">
        <span className="dx-loader-glow" />
        <span className="dx-loader-ring" />
        <img
          className="dx-loader-logo"
          src={BRAND_LOGO}
          alt={BRAND_NAME}
          width={76}
          height={76}
        />
      </div>

      <div className="dx-loader-name" style={brandTextStyle}>
        {BRAND_NAME}
      </div>

      <div className="dx-loader-text">
        {t("loadingScreen")}
        <span className="dx-loader-dots" aria-hidden>
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>

      <div
        className="dx-loader-bar"
        style={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.08)" }}
      >
        <span />
      </div>
    </div>
  );
}
