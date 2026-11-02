import { useState, useEffect, useRef } from "react";
import QRCodeLib from "qrcode";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useNegocio } from "../../context/NegocioContext";
import { useLang } from "../../lib/i18n";
import { configuracionService } from "../../services/api";

import { MENU_PUBLIC_BASE as MENU_BASE } from "../../lib/menuUrl";

export default function QRCode() {
  const S = useStyles();
  const { isDark } = useTheme();
  const { t } = useLang();
  const { negocioId, negocios, slug } = useNegocio();
  const [qrUrl, setQrUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [mesa, setMesa] = useState("");
  const [mesasCant, setMesasCant] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textSecondary = isDark ? "#94a3b8" : "#475569";
  const cardBg = isDark ? "#1a1d27" : "#ffffff";
  const negocioNombre =
    negocios.find((n) => n.id === negocioId)?.nombre ||
    t("bizFallback", { n: negocioId });

  // Traer cantidad de mesas del negocio activo.
  useEffect(() => {
    configuracionService
      .get()
      .then((c) => setMesasCant(c.mesas_activo ? c.mesas_cantidad || 0 : 0))
      .catch(() => setMesasCant(0));
  }, [negocioId]);

  // Generar la URL + QR cuando cambia negocio, slug o mesa.
  useEffect(() => {
    // Preferimos el slug (/menu/:slug). Si el negocio aún no tiene slug,
    // caemos al esquema viejo por id (/menu?negocio=<id>).
    let url = slug
      ? `${MENU_BASE}/menu/${slug}`
      : `${MENU_BASE}/menu?negocio=${negocioId}`;
    if (mesa) url += `${slug ? "?" : "&"}mesa=${encodeURIComponent(mesa)}`;
    setMenuUrl(url);
    if (ref.current) {
      QRCodeLib.toCanvas(ref.current, url, {
        // Se genera grande (nítido al imprimir) y se muestra más chico.
        width: 520,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
      })
        .then(() => setQrUrl(ref.current!.toDataURL("image/png")))
        .catch(console.error);
    }
  }, [negocioId, slug, mesa]);

  const download = () => {
    const a = document.createElement("a");
    a.download = `qr-${negocioNombre}${mesa ? `-mesa-${mesa}` : ""}.png`;
    a.href = qrUrl;
    a.click();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(menuUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const tips = [t("qrTip1"), t("qrTip2"), t("qrTip3")];

  return (
    <AdminLayout title={t("navQr")}>
      {/* Dos columnas en pantallas anchas (QR | ajustes); una en el celular. */}
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
          alignItems: "stretch",
        }}
      >
        {/* ── Vista previa del QR ── */}
        <div
          style={{
            ...S.card,
            background: isDark
              ? "radial-gradient(120% 90% at 50% 0%, rgba(99,102,241,0.16), transparent 60%), #1a1d27"
              : "radial-gradient(120% 90% at 50% 0%, rgba(99,102,241,0.10), transparent 60%), #ffffff",
            padding: "32px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            textAlign: "center",
          } as React.CSSProperties}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: 18,
              boxShadow: isDark
                ? "0 18px 50px rgba(0,0,0,0.45)"
                : "0 18px 50px rgba(15,23,42,0.12)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {/* El canvas (grande, para descargar) queda oculto; se muestra
                la imagen a tamaño fijo. */}
            <canvas ref={ref} style={{ display: "none" }} />
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={t("qrHeading")}
                style={{ display: "block", width: "min(280px, 62vw)", height: "auto" }}
              />
            ) : (
              <div style={{ width: "min(280px, 62vw)", aspectRatio: "1" }} />
            )}
          </div>
          <div>
            <div style={{ color: textPrimary, fontSize: 18, fontWeight: 700 }}>
              {negocioNombre}
            </div>
            <div style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, marginTop: 3 }}>
              {mesa ? t("pedTableN", { n: mesa }) : t("qrGeneral")}
            </div>
          </div>
          <p style={{ color: textSecondary, fontSize: 12.5, margin: 0, maxWidth: 320, lineHeight: 1.5 }}>
            {t("qrScanHint")}
          </p>
        </div>

        {/* ── Ajustes, enlace y acciones ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              ...S.card,
              background: cardBg,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            } as React.CSSProperties}
          >
            <div>
              <h2 style={{ color: textPrimary, fontSize: 19, fontWeight: 700, margin: "0 0 6px" }}>
                {t("qrHeading")}
              </h2>
              <p style={{ color: textSecondary, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
                {t("qrSubA")}
                <strong>{negocioNombre}</strong>
                {t("qrSubB")}
              </p>
            </div>

            {/* Selector de mesa (si el negocio usa mesas) */}
            {mesasCant > 0 && (
              <div>
                <label style={S.label}>{t("qrTableLabel")}</label>
                <select
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  style={{ ...S.input, cursor: "pointer" } as React.CSSProperties}
                >
                  <option value="">{t("qrGeneral")}</option>
                  {Array.from({ length: mesasCant }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {t("pedTableN", { n })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* URL */}
            <div>
              <label style={S.label}>{t("qrUrlLabel")}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={menuUrl}
                  style={{ ...S.input, flex: 1, minWidth: 0 } as React.CSSProperties}
                />
                <button
                  onClick={copy}
                  style={{
                    ...S.btnGhost,
                    gap: 6,
                    flexShrink: 0,
                    ...(copied
                      ? { background: "rgba(16,185,129,0.12)", color: "#059669" }
                      : {}),
                  } as React.CSSProperties}
                >
                  {copied ? t("qrCopied") : t("qrCopy")}
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={download}
                style={{ ...S.btnPrimary, flex: "1 1 160px", justifyContent: "center", padding: "11px 16px" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 15, height: 15 }}>
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("qrDownload")}
              </button>
              <button
                onClick={() => window.print()}
                style={{ ...S.btnGhost, flex: "1 1 160px", justifyContent: "center", padding: "11px 16px" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 15, height: 15 }}>
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("ticketPrint")}
              </button>
            </div>
          </div>

          {/* Consejos */}
          <div
            style={{
              ...S.card,
              background: cardBg,
              padding: "20px 24px",
              flex: 1,
            } as React.CSSProperties}
          >
            <div style={{ color: textPrimary, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {t("qrTipsTitle")}
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {tips.map((tip, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: "#fff",
                      background: "linear-gradient(135deg,#6366f1,#06b6d4)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ color: textSecondary, fontSize: 13, lineHeight: 1.55, paddingTop: 2 }}>
                    {tip}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
