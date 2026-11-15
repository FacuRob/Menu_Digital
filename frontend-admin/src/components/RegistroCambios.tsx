import { useEffect, useState } from "react";
import { useStyles } from "./sharedStyles";
import { useNegocio } from "../context/NegocioContext";
import { useLang } from "../lib/i18n";
import { fechaHoraAR } from "../lib/fechas";
import { registroService, type CambioRegistrado } from "../services/api";

// Actividad reciente de la cuenta: cambios de módulos, usuarios, productos
// borrados y cada vez que Soporte entró a mirar (en Usuarios).

export default function RegistroCambios() {
  const { t } = useLang();
  const s = useStyles();
  const { negocios } = useNegocio();
  const [lista, setLista] = useState<CambioRegistrado[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    registroService
      .listar()
      .then(setLista)
      .catch(() => setError(true));
  }, []);

  const d = (r: CambioRegistrado, k: string) => String((r.detalle as Record<string, unknown> | null)?.[k] ?? "");
  const texto = (r: CambioRegistrado) => {
    const clave = `reg_${r.accion}_${r.entidad}`;
    const txt = t(clave, { u: d(r, "username") || t("regSinNombre"), n: d(r, "nombre") || t("regSinNombre"), rol: d(r, "rol") });
    return txt === clave ? t("regGenerico") : txt;
  };
  const negocio = (id: number | null) => (id && negocios.length > 1 ? negocios.find((n) => n.id === id)?.nombre : null);

  return (
    <section aria-labelledby="reg-titulo" style={{ marginTop: 28 }}>
      <h2 id="reg-titulo" className="pn-title" style={{ margin: 0, fontSize: 18, color: "var(--fg)" }}>{t("regTitulo")}</h2>
      <p style={{ margin: "4px 0 12px", color: "var(--fg-2)", fontSize: 14 }}>{t("regSub")}</p>
      {error && <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{t("regError")}</p>}
      {!lista && !error && <p role="status" style={{ color: "var(--fg-2)" }}>{t("subLoading")}</p>}
      {lista?.length === 0 && <p style={{ color: "var(--fg-2)" }}>{t("regVacio")}</p>}
      {!!lista?.length && (
        <ol style={{ ...s.card, listStyle: "none", margin: 0, padding: 0 }}>
          {lista.map((r, i) => (
            <li key={r.id} style={{ padding: "10px 14px", borderTop: i ? "1px solid var(--line)" : "none", display: "grid", gap: 2 }}>
              <span style={{ fontSize: 14, color: "var(--fg)" }}>
                <strong>{r.quien || t("regAlguien")}</strong> {texto(r)}
              </span>
              <span style={{ fontSize: 13, color: "var(--fg-2)" }}>
                <time dateTime={r.created_at}>{fechaHoraAR(r.created_at)}</time>
                {negocio(r.negocio_id) && ` · ${negocio(r.negocio_id)}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
