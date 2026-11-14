import { useState } from "react";
import { adjuntosService, getApiErrorMessage, type ItemPersonalizacion } from "../services/api";
import { useLang } from "../lib/i18n";

// Lo que completó el cliente al personalizar un producto (foto guardada en
// el pedido). Los archivos se abren con un link firmado que vence.
export default function PersonalizacionItem({ datos }: { datos?: ItemPersonalizacion[] | null }) {
  const { t } = useLang();
  const [error, setError] = useState("");
  if (!datos?.length) return null;

  const abrir = async (id: number) => {
    setError("");
    // La ventana se abre ya (con el clic) para que el navegador no la bloquee.
    const w = window.open("", "_blank");
    try {
      const { url } = await adjuntosService.ver(id);
      if (w) {
        w.opener = null;
        w.location.href = url;
      } else window.location.assign(url);
    } catch (e) {
      w?.close();
      setError(getApiErrorMessage(e, t("adjErrAbrir")));
    }
  };

  const valor = (d: ItemPersonalizacion) =>
    Array.isArray(d.valor) ? d.valor.join(", ") : d.valor === null || d.valor === undefined ? "" : String(d.valor);

  return (
    <ul style={{ margin: "2px 0 4px 18px", padding: 0, listStyle: "none", display: "grid", gap: 3, fontSize: 12.5 }}>
      {datos.map((d) => (
        <li key={d.campo_id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ color: "var(--fg-3)" }}>{d.etiqueta}:</span>
          {d.tipo === "color" && typeof d.valor === "string" && /^#/.test(d.valor) && (
            <span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: d.valor, border: "1px solid var(--line-strong)" }} />
          )}
          {d.adjunto ? (
            <button
              type="button"
              onClick={() => abrir(d.adjunto!.id)}
              aria-label={`${t("adjVer")}: ${d.adjunto.nombre} (${t("adjNuevaPestana")})`}
              style={{ background: "none", border: "none", minHeight: 32, padding: "4px 2px", color: "var(--info)", fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontSize: 13 }}
            >
              {t("adjVer")}: {d.adjunto.nombre}
            </button>
          ) : (
            <span style={{ color: "var(--fg)", fontWeight: 600, whiteSpace: "pre-wrap" }}>{valor(d)}</span>
          )}
        </li>
      ))}
      {error && (
        <li role="alert" style={{ color: "var(--err)" }}>
          {error}
        </li>
      )}
    </ul>
  );
}
