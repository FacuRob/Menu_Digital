import { useEffect, useId, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import { EmptyState } from "../../components/ui";
import { useStyles } from "../../components/sharedStyles";
import { useNegocio } from "../../context/NegocioContext";
import { useLang } from "../../lib/i18n";
import { fmtMoney } from "../../lib/money";
import { fechaHoraAR, waLink } from "../../lib/fechas";
import { clientesService, getApiErrorMessage, type Cliente } from "../../services/api";

// Clientes: quién te compró, pidió presupuesto o sacó turno (se arma con
// esos datos; un cliente = mismo teléfono o, si no dejó, mismo email).

export default function Clientes() {
  const { t } = useLang();
  const s = useStyles();
  const { moneda, tieneModulo } = useNegocio();
  const uid = useId();
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [truncado, setTruncado] = useState(false);

  useEffect(() => {
    clientesService
      .listar()
      .then((r) => {
        setLista(r.clientes);
        setTruncado(r.truncado);
      })
      .catch((e) => setError(getApiErrorMessage(e, t("cliErrCargar"))));
  }, [t]);

  // Singular cuando es 1 ("1 pedido").
  const tn = (clave: string, n: number) => (n === 1 ? t(`${clave}_1`) : t(clave, { n }));

  const texto = q.trim().toLowerCase();
  const digitos = texto.replace(/\D/g, "");
  const visibles = (lista || []).filter(
    (c) =>
      !texto ||
      (c.nombre || "").toLowerCase().includes(texto) ||
      (c.email || "").toLowerCase().includes(texto) ||
      (digitos.length >= 3 && (c.telefono || "").replace(/\D/g, "").includes(digitos)),
  );

  // Qué hizo cada cliente, sólo con lo que el negocio usa.
  const actividad = (c: Cliente) =>
    [
      tieneModulo("pedidos") && c.pedidos > 0 && `${tn("cliPedidos", c.pedidos)} · ${fmtMoney(c.total, moneda)}`,
      tieneModulo("presupuestos") && c.presupuestos > 0 && tn("cliPresupuestos", c.presupuestos),
      tieneModulo("reservas") && c.turnos > 0 && tn("cliTurnos", c.turnos),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <AdminLayout title={t("navClientes")}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{t("navClientes")}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14, maxWidth: "60ch" }}>{t("cliSub")}</p>
        </div>
        {!!lista?.length && (
          <div style={{ minWidth: 220, flex: "0 1 300px" }}>
            <label htmlFor={`${uid}-buscar`} style={s.label}>{t("cliBuscar")}</label>
            <input id={`${uid}-buscar`} type="search" style={s.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cliBuscarPh")} />
          </div>
        )}
      </div>

      {error && <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{error}</p>}
      {!lista && !error && <p role="status" style={{ color: "var(--fg-3)" }}>{t("subLoading")}</p>}
      {lista?.length === 0 && <EmptyState title={t("cliVacio")} desc={t("cliVacioDesc")} />}
      {!!lista?.length && (
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--fg-2)" }}>
          {/* Sólo se anuncia el resultado de la búsqueda, no el total. */}
          <span aria-live="polite" aria-atomic="true">{texto ? tn("cliEncontrados", visibles.length) : ""}</span>
          {!texto && tn("cliTotal", lista.length)}
        </p>
      )}
      {truncado && <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--fg-2)" }}>{t("cliTruncado")}</p>}
      {!!lista?.length && texto && !visibles.length && <p style={{ color: "var(--fg-2)" }}>{t("cliSinResultados")}</p>}

      {!!visibles.length && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))" }}>
          {visibles.map((c) => (
            <li key={c.clave} style={{ ...s.card, padding: 14, display: "grid", gap: 6, color: "var(--fg)" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{c.nombre || t("cliSinNombre")}</h3>
              <span style={{ fontSize: 13, color: "var(--fg-2)", overflowWrap: "anywhere" }}>
                {[c.telefono, c.email].filter(Boolean).join(" · ")}
              </span>
              {actividad(c) && <span style={{ fontSize: 13 }}>{actividad(c)}</span>}
              {c.ultimo && <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{t("cliUltimo", { f: fechaHoraAR(c.ultimo) })}</span>}
              {c.telefono && (
                <a
                  href={waLink(c.telefono, c.nombre ? t("cliWaHola", { n: c.nombre }) : t("cliWaHolaSinNombre"))}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t("cliEscribirWa")}: ${c.nombre || c.telefono} (${t("adjNuevaPestana")})`}
                  style={{ ...s.btnGhost, minHeight: 44, textDecoration: "none", justifySelf: "start", marginTop: 4 }}
                >
                  {t("cliEscribirWa")}
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminLayout>
  );
}
