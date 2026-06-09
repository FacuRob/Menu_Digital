import { useState, useEffect, useRef } from "react";
import QRCodeLib from "qrcode";
import AdminLayout from "../../components/AdminLayout";
import { S } from "../../components/sharedStyles";

export default function QRCode() {
  const [qrUrl, setQrUrl] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = `${window.location.origin}/menu`;
    setMenuUrl(url);
    if (ref.current) {
      QRCodeLib.toCanvas(ref.current, url, {
        width: 240,
        margin: 2,
        color: { dark: "#3b82f6", light: "#13151c" },
      })
        .then(() => setQrUrl(ref.current!.toDataURL("image/png")))
        .catch(console.error);
    }
  }, []);

  const download = () => {
    const a = document.createElement("a");
    a.download = "menu-qr.png";
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
      <div style={{ maxWidth: 520 }}>
        <p
          style={{
            color: "#475569",
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.6,
          }}
        >
          Descargá o imprimí este código QR para colocarlo en tus mesas. Los
          clientes lo escanean y acceden al menú digital instantáneamente.
        </p>

        <div
          style={{
            ...S.card,
            padding: 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* QR */}
          <div
            style={{
              background: "#13151c",
              border: "1px solid rgba(59,130,246,0.2)",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 0 40px rgba(59,130,246,0.08)",
            }}
          >
            <canvas ref={ref} style={{ display: "block" }} />
          </div>

          {/* URL */}
          <div style={{ width: "100%" }}>
            <label style={S.label}>URL del menú</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={menuUrl}
                style={{ ...S.input, flex: 1, color: "#64748b" }}
              />
              <button
                onClick={copy}
                style={{
                  ...S.btnGhost,
                  gap: 6,
                  flexShrink: 0,
                  background: copied
                    ? "rgba(16,185,129,0.1)"
                    : "rgba(255,255,255,0.05)",
                  color: copied ? "#34d399" : "#94a3b8",
                  borderColor: copied
                    ? "rgba(16,185,129,0.3)"
                    : "rgba(255,255,255,0.08)",
                }}
              >
                {copied ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              onClick={download}
              style={{ ...S.btnPrimary, flex: 1, justifyContent: "center" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#2563eb")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#3b82f6")
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                style={{ width: 15, height: 15 }}
              >
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Descargar PNG
            </button>
            <button
              onClick={() => window.print()}
              style={{ ...S.btnGhost, flex: 1, justifyContent: "center" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                style={{ width: 15, height: 15 }}
              >
                <path
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Imprimir
            </button>
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            marginTop: 14,
            padding: "14px 16px",
            borderRadius: 10,
            background: "rgba(59,130,246,0.06)",
            border: "1px solid rgba(59,130,246,0.12)",
          }}
        >
          <div
            style={{
              color: "#3b82f6",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            ¿CÓMO USARLO?
          </div>
          {[
            "Descargá o imprimí el código QR",
            "Colocalo en un lugar visible en cada mesa",
            "Los clientes lo escanean con la cámara del celular",
            "Se abre el menú digital automáticamente",
          ].map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  color: "#3b82f6",
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {i + 1}.
              </span>
              <span style={{ color: "#475569", fontSize: 12 }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
