import { useState, useEffect, useRef } from "react";
import QRCodeLib from "qrcode";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useNegocio } from "../../context/NegocioContext";
import { configuracionService } from "../../services/api";

const MENU_BASE =
  (import.meta.env.VITE_MENU_URL as string | undefined) ||
  "http://localhost:3000";

export default function QRCode() {
  const S = useStyles();
  const { isDark } = useTheme();
  const { negocioId, negocios } = useNegocio();
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
    negocios.find((n) => n.id === negocioId)?.nombre || `Negocio ${negocioId}`;

  // Traer cantidad de mesas del negocio activo.
  useEffect(() => {
    configuracionService
      .get()
      .then((c) => setMesasCant(c.mesas_activo ? c.mesas_cantidad || 0 : 0))
      .catch(() => setMesasCant(0));
  }, [negocioId]);

  // Generar la URL + QR cuando cambia negocio o mesa.
  useEffect(() => {
    let url = `${MENU_BASE}/menu?negocio=${negocioId}`;
    if (mesa) url += `&mesa=${encodeURIComponent(mesa)}`;
    setMenuUrl(url);
    if (ref.current) {
      QRCodeLib.toCanvas(ref.current, url, {
        width: 240,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
      })
        .then(() => setQrUrl(ref.current!.toDataURL("image/png")))
        .catch(console.error);
    }
  }, [negocioId, mesa]);

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

  return (
    <AdminLayout title="Código QR">
      {/* Centrado en toda la pantalla */}
      <div
        style={{
          minHeight: "calc(100vh - 140px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 8,
        }}
      >
        <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
          <h2 style={{ color: textPrimary, fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
            Código QR del menú
          </h2>
          <p style={{ color: textSecondary, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
            Apunta a <strong>{negocioNombre}</strong>. Descargalo o imprimilo
            para colocarlo en tus mesas; los clientes lo escanean y acceden al
            menú al instante.
          </p>

          <div
            style={{
              ...S.card,
              background: cardBg,
              padding: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            } as React.CSSProperties}
          >
            {/* Selector de mesa (si el negocio usa mesas) */}
            {mesasCant > 0 && (
              <div style={{ width: "100%", textAlign: "left" }}>
                <label style={S.label}>Mesa del QR</label>
                <select
                  value={mesa}
                  onChange={(e) => setMesa(e.target.value)}
                  style={{ ...S.input, cursor: "pointer" } as React.CSSProperties}
                >
                  <option value="">General (sin mesa)</option>
                  {Array.from({ length: mesasCant }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      Mesa {n}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* QR */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: 12,
                padding: 20,
                boxShadow: "0 0 40px rgba(0,0,0,0.06)",
              }}
            >
              <canvas ref={ref} style={{ display: "block" }} />
            </div>

            {/* URL */}
            <div style={{ width: "100%", textAlign: "left" }}>
              <label style={S.label}>URL del menú</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={menuUrl}
                  style={{ ...S.input, flex: 1 } as React.CSSProperties}
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
                  {copied ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 10, width: "100%" }}>
              <button
                onClick={download}
                style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 15, height: 15 }}>
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Descargar PNG
              </button>
              <button
                onClick={() => window.print()}
                style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} style={{ width: 15, height: 15 }}>
                  <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
