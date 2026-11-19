import { useEffect, useState } from "react";
import { plataformaService, getApiErrorMessage, type Cupon } from "../services/api";

// Panel de cupones de descuento (solo Tech, dentro de Plataforma).
// Genera cupones "X % por N meses"; al canjearlos un cliente pasan a "Usados".

const fmtFecha = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

const mesesTxt = (n: number) => (n === 1 ? "1 mes" : `${n} meses`);

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  color: "var(--fg-3)",
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 14px",
  color: "var(--fg)",
  borderBottom: "1px solid var(--line)",
  whiteSpace: "nowrap",
};
const input: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--fg)",
  fontSize: 14,
};
const btn =
  "inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60";

export default function CuponesPanel() {
  const [disponibles, setDisponibles] = useState<Cupon[]>([]);
  const [usados, setUsados] = useState<Cupon[]>([]);
  const [tab, setTab] = useState<"disponibles" | "usados">("disponibles");
  const [porcentaje, setPorcentaje] = useState("20");
  const [meses, setMeses] = useState("1");
  const [cantidad, setCantidad] = useState("1");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  const cargar = async () => {
    try {
      const r = await plataformaService.getCupones();
      setDisponibles(r.disponibles);
      setUsados(r.usados);
    } catch (e) {
      setError(getApiErrorMessage(e, "No se pudieron cargar los cupones."));
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const generar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerando(true);
    setError(null);
    setAviso(null);
    try {
      const nuevos = await plataformaService.crearCupones({
        porcentaje: Number(porcentaje),
        meses: Number(meses),
        cantidad: Number(cantidad),
      });
      setAviso(nuevos.length === 1 ? "Se generó 1 cupón." : `Se generaron ${nuevos.length} cupones.`);
      setTab("disponibles");
      await cargar();
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudieron generar los cupones."));
    } finally {
      setGenerando(false);
    }
  };

  const eliminar = async (c: Cupon) => {
    if (!window.confirm(`¿Eliminar el cupón ${c.codigo}? Ya no se podrá usar.`)) return;
    setError(null);
    try {
      await plataformaService.eliminarCupon(c.id);
      setDisponibles((l) => l.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(getApiErrorMessage(err, "No se pudo eliminar el cupón."));
    }
  };

  const copiar = async (c: Cupon) => {
    try {
      await navigator.clipboard.writeText(c.codigo);
      setCopiado(c.id);
      setTimeout(() => setCopiado((id) => (id === c.id ? null : id)), 1500);
    } catch {
      /* sin portapapeles: el código igual se ve en la tabla */
    }
  };

  const lista = tab === "disponibles" ? disponibles : usados;

  return (
    <section
      aria-labelledby="cupones-titulo"
      style={{
        marginTop: 24,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        boxShadow: "var(--shadow-1)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <h3 id="cupones-titulo" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
          Cupones de descuento
        </h3>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--fg-3)" }}>
          Cada cupón se usa una sola vez. El cliente lo escribe en Suscripción y paga con descuento los meses que indiques.
        </p>
      </div>

      {/* Generar */}
      <form
        onSubmit={generar}
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          alignItems: "end",
        }}
      >
        <label style={{ fontSize: 12, color: "var(--fg-2)", display: "grid", gap: 4 }}>
          Descuento (%)
          <input type="number" min={1} max={90} required value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: 12, color: "var(--fg-2)", display: "grid", gap: 4 }}>
          Meses
          <input type="number" min={1} max={24} required value={meses} onChange={(e) => setMeses(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: 12, color: "var(--fg-2)", display: "grid", gap: 4 }}>
          Cantidad
          <input type="number" min={1} max={50} required value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={input} />
        </label>
        <button type="submit" disabled={generando} className={btn} style={{ background: "var(--accent)", color: "var(--on-accent)", borderColor: "transparent" }}>
          {generando ? "Generando…" : "Generar cupones"}
        </button>
      </form>

      {(error || aviso) && (
        <div
          role={error ? "alert" : "status"}
          style={{
            margin: "12px 18px 0",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            color: error ? "var(--err)" : "var(--ok)",
            background: error ? "var(--err-bg)" : "var(--ok-bg)",
          }}
        >
          {error || aviso}
        </div>
      )}

      {/* Pestañas */}
      <div role="tablist" style={{ display: "flex", gap: 6, padding: "12px 18px 0" }}>
        {(
          [
            ["disponibles", `Disponibles (${disponibles.length})`],
            ["usados", `Usados (${usados.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={btn}
            style={
              tab === key
                ? { color: "var(--accent)", borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
                : { color: "var(--fg-3)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto", padding: "8px 0 4px" }}>
        {lista.length === 0 ? (
          <div style={{ padding: "16px 18px", fontSize: 13, color: "var(--fg-3)" }}>
            {tab === "disponibles" ? "No hay cupones disponibles. Generá uno arriba." : "Todavía nadie usó un cupón."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th scope="col" style={th}>Código</th>
                <th scope="col" style={th}>Descuento</th>
                <th scope="col" style={th}>Duración</th>
                {tab === "disponibles" ? (
                  <>
                    <th scope="col" style={th}>Creado</th>
                    <th scope="col" style={th}><span className="sr-only">Acciones</span></th>
                  </>
                ) : (
                  <>
                    <th scope="col" style={th}>Usado por</th>
                    <th scope="col" style={th}>Fecha de uso</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{c.codigo}</td>
                  <td style={td}>{c.porcentaje} %</td>
                  <td style={td}>{mesesTxt(c.meses)}</td>
                  {tab === "disponibles" ? (
                    <>
                      <td style={{ ...td, color: "var(--fg-3)" }}>{fmtFecha(c.created_at)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className={btn} onClick={() => copiar(c)} aria-label={`Copiar el código ${c.codigo}`}>
                            {copiado === c.id ? "Copiado" : "Copiar"}
                          </button>
                          <button type="button" className={btn} onClick={() => eliminar(c)} aria-label={`Eliminar el cupón ${c.codigo}`} style={{ color: "var(--err)" }}>
                            Eliminar
                          </button>
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={td}>
                        {c.cuenta?.nombre || `Cuenta #${c.usado_por_cuenta_id}`}
                        <span style={{ color: "var(--fg-3)", marginLeft: 6, fontSize: 11 }}>#{c.usado_por_cuenta_id}</span>
                        {c.cuenta?.email && <div style={{ color: "var(--fg-3)", fontSize: 12 }}>{c.cuenta.email}</div>}
                      </td>
                      <td style={{ ...td, color: "var(--fg-3)" }}>{fmtFecha(c.usado_at)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
