import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../lib/i18n";
import { BRAND_GRADIENT } from "../lib/brand";
import { MENU_PREVIEW_BASE, MENU_PUBLIC_BASE, menuPath } from "../lib/menuUrl";

type Device = "mobile" | "tablet" | "desktop";

const DEVICES: { id: Device; key: string; w: number; h: number }[] = [
  { id: "mobile", key: "mpMobile", w: 390, h: 800 },
  { id: "tablet", key: "mpTablet", w: 820, h: 1000 },
  { id: "desktop", key: "mpDesktop", w: 0, h: 0 },
];

const STORE_KEY = "menu_preview_device";

// Vista previa del menú público dentro del panel: /menu/:slug
// (o /menu?negocio=<id>). Carga el menú real en un iframe y permite
// probarlo en distintos tamaños, copiar el link público o abrirlo.
export default function MenuPreview() {
  const { slug } = useParams<{ slug?: string }>();
  const [params] = useSearchParams();
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { t } = useLang();

  const [device, setDevice] = useState<Device>(() => {
    try {
      const v = localStorage.getItem(STORE_KEY) as Device | null;
      return v && DEVICES.some((d) => d.id === v) ? v : "mobile";
    } catch {
      return "mobile";
    }
  });
  const [copied, setCopied] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, device);
    } catch {
      /* sin storage: no pasa nada */
    }
  }, [device]);

  // Ruta del menú + parámetros extra (p. ej. ?mesa=3) que vengan en la URL.
  const path = useMemo(() => {
    const base = menuPath(slug, params.get("negocio"));
    const extra = new URLSearchParams(params);
    if (base.includes("?negocio=")) extra.delete("negocio");
    const qs = extra.toString();
    return qs ? `${base}${base.includes("?") ? "&" : "?"}${qs}` : base;
  }, [slug, params]);

  const previewUrl = `${MENU_PREVIEW_BASE}${path}`;
  const publicUrl = `${MENU_PUBLIC_BASE}${path}`;
  const dev = DEVICES.find((d) => d.id === device)!;

  useEffect(() => {
    document.title = slug ? `${t("mpTitle")} · ${slug}` : t("mpTitle");
  }, [t, slug]);

  // Muestra el spinner hasta que el iframe actual termine de cargar.
  const frameKey = `${previewUrl}#${reloadKey}`;
  const loading = loadedKey !== frameKey;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(t("mpPublicLink"), publicUrl);
    }
  };

  const bg = isDark ? "#0b0d14" : "#eef1f6";
  const bar = isDark ? "rgba(17,20,30,0.85)" : "rgba(255,255,255,0.85)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";
  const text = isDark ? "#e2e8f0" : "#1e293b";
  const muted = isDark ? "#94a3b8" : "#64748b";
  const chip = isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)";

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap";

  return (
    <div className="flex h-screen flex-col" style={{ background: bg, color: text }}>
      {/* Barra superior */}
      <header
        className="sticky top-0 z-10 flex flex-wrap items-center gap-3 px-4 py-3 backdrop-blur-xl"
        style={{ background: bar, borderBottom: `1px solid ${border}` }}
      >
        <Link
          to={isAuthenticated ? "/admin/dashboard" : "/admin/login"}
          className={btn}
          style={{ background: chip, color: text }}
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">{t("mpBack")}</span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="text-xs" style={{ color: muted }}>
            {t("mpTitle")}
          </div>
          <div className="truncate text-sm font-semibold">{publicUrl.replace(/^https?:\/\//, "")}</div>
        </div>

        {/* Selector de dispositivo */}
        <div className="flex rounded-xl p-1" style={{ background: chip }} role="group">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              aria-pressed={device === d.id}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
              style={
                device === d.id
                  ? { background: BRAND_GRADIENT, color: "#111216" }
                  : { color: muted }
              }
            >
              {t(d.key)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className={btn}
            style={{ background: chip, color: text }}
            title={t("mpReload")}
          >
            ↻<span className="hidden lg:inline">{t("mpReload")}</span>
          </button>
          <button type="button" onClick={copy} className={btn} style={{ background: chip, color: text }}>
            {copied ? "✓" : "🔗"}
            <span className="hidden md:inline">{copied ? t("mpCopied") : t("mpCopy")}</span>
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={btn}
            style={{ background: BRAND_GRADIENT, color: "#111216" }}
          >
            ↗<span className="hidden md:inline">{t("mpOpen")}</span>
          </a>
        </div>
      </header>

      {/* Escenario */}
      <main className="relative flex flex-1 items-start justify-center overflow-auto p-4 sm:p-8">
        <div
          className="relative transition-all duration-300"
          style={
            device === "desktop"
              ? { width: "100%", height: "100%" }
              : { width: dev.w, maxWidth: "100%", height: dev.h, maxHeight: "100%", flexShrink: 0 }
          }
        >
          <div
            className="h-full w-full overflow-hidden"
            style={
              device === "mobile"
                ? {
                    borderRadius: 44,
                    padding: 10,
                    background: "linear-gradient(180deg,#334155,#0f172a)",
                    boxShadow: "0 40px 80px -24px rgba(0,0,0,0.55)",
                  }
                : {
                    borderRadius: device === "tablet" ? 28 : 14,
                    padding: device === "tablet" ? 12 : 0,
                    background: device === "tablet" ? "linear-gradient(180deg,#334155,#0f172a)" : "transparent",
                    border: device === "desktop" ? `1px solid ${border}` : undefined,
                    boxShadow: "0 30px 70px -28px rgba(0,0,0,0.45)",
                  }
            }
          >
            <div
              className="relative h-full w-full overflow-hidden bg-white"
              style={{ borderRadius: device === "mobile" ? 34 : device === "tablet" ? 18 : 14 }}
            >
              {loading && (
                <div className="absolute inset-0 grid place-items-center" style={{ background: bg }}>
                  <div
                    className="h-9 w-9 animate-spin rounded-full border-[3px] border-t-transparent"
                    style={{ borderColor: `${muted} transparent ${muted} ${muted}` }}
                  />
                </div>
              )}
              <iframe
                key={frameKey}
                src={previewUrl}
                title={t("mpTitle")}
                onLoad={() => setLoadedKey(frameKey)}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
