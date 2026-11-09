import { useMemo } from "react";
import QRCode from "qrcode";

// QR real dibujado como un solo <path> (sin innerHTML). Lleva al menú de
// ejemplo (/menu), así quien lo escanea con el celular lo prueba ahí.
export default function QrCodigo({ texto, className = "" }: { texto: string; className?: string }) {
  const { d, size } = useMemo(() => {
    const qr = QRCode.create(texto, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { d: path, size: n };
  }, [texto]);

  return (
    <svg viewBox={`-4 -4 ${size + 8} ${size + 8}`} className={className} shapeRendering="crispEdges" role="img" aria-label="Código QR que abre el menú de ejemplo">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
