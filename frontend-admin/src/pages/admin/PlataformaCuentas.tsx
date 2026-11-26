import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import { useStyles } from "../../components/sharedStyles";
import { useLang } from "../../lib/i18n";
import { SearchIcon, Highlight } from "../../lib/listUi";
import { IconX } from "../../lib/icons";
import { planColor, fmtFecha, useVerComo, useMotivoTexto } from "../../lib/plataforma";
import {
  plataformaService,
  getApiErrorMessage,
  type Cuenta,
  type CuentaRiesgo,
  type TipoPlan,
} from "../../services/api";

const MODULO_NOMBRE: Record<string, string> = { whatsapp: "WhatsApp", ia: "IA", mapa: "Mapa" };

// Plataforma · Cuentas: la lista completa, pensada para muchas cuentas.
// Se busca, se filtra por estado y plan, y se pagina de a POR_PAGINA.

const POR_PAGINA = 15;
type Filtro = "todas" | "riesgo" | "activo" | "trial" | "cancelado" | "vencido";
const FILTROS: Filtro[] = ["todas", "riesgo", "activo", "trial", "cancelado", "vencido"];
const PLANES: TipoPlan[] = ["free", "basic", "standard", "premium"];

const ESTADO: Record<Cuenta["estado_suscripcion"], { key: string; color: string }> = {
  activo: { key: "pfFilterActive", color: "var(--ok)" },
  trial: { key: "pfFilterTrial", color: "var(--info)" },
  cancelado: { key: "pfFilterCancelled", color: "var(--warn)" },
  vencido: { key: "pfFilterExpired", color: "var(--err)" },
};

export default function PlataformaCuentas() {
  const S = useStyles();
  const { t, lang } = useLang();
  const motivoTexto = useMotivoTexto();
  const [params, setParams] = useSearchParams();
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [riesgo, setRiesgo] = useState<Map<number, CuentaRiesgo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { entrando, verComo } = useVerComo(setError);

  // Filtros en la URL: se pueden compartir y sobreviven a recargar.
  const filtro = (FILTROS.includes(params.get("f") as Filtro) ? params.get("f") : "todas") as Filtro;
  const plan = (PLANES.includes(params.get("plan") as TipoPlan) ? params.get("plan") : "") as TipoPlan | "";
  const [search, setSearch] = useState(params.get("q") || "");
  const [pagina, setPagina] = useState(1);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v && v !== "todas") p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
    setPagina(1);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const [cueR, riesR] = await Promise.allSettled([plataformaService.getCuentas(), plataformaService.getRiesgo()]);
      if (!active) return;
      if (cueR.status === "fulfilled") setCuentas(cueR.value);
      if (riesR.status === "fulfilled") setRiesgo(new Map(riesR.value.map((r) => [r.id, r])));
      const fail = [cueR, riesR].find((r) => r.status === "rejected");
      if (fail && fail.status === "rejected") setError(getApiErrorMessage(fail.reason, t("pfLoadError")));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = search.trim().toLowerCase().replace(/^#/, "");
  const porTexto = useMemo(
    () =>
      cuentas.filter(
        (c) =>
          (!plan || c.tipo_plan === plan) &&
          (!q || c.nombre.toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || String(c.id) === q),
      ),
    [cuentas, plan, q],
  );

  const pasa = (c: Cuenta, f: Filtro) =>
    f === "todas" ? true : f === "riesgo" ? riesgo.has(c.id) : c.estado_suscripcion === f;
  const conteo = (f: Filtro) => porTexto.filter((c) => pasa(c, f)).length;

  // Más nuevas primero; en "En riesgo", las urgentes arriba.
  const filtradas = porTexto
    .filter((c) => pasa(c, filtro))
    .sort((a, b) =>
      filtro === "riesgo"
        ? Number(riesgo.get(b.id)?.nivel === "alto") - Number(riesgo.get(a.id)?.nivel === "alto") || b.id - a.id
        : (b.created_at || "").localeCompare(a.created_at || "") || b.id - a.id,
    );
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pag = Math.min(pagina, totalPaginas);
  const visibles = filtradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);

  const filtroLabel: Record<Filtro, string> = {
    todas: t("pfFilterAll"),
    riesgo: t("pfFilterRisk"),
    activo: t("pfFilterActive"),
    trial: t("pfFilterTrial"),
    cancelado: t("pfFilterCancelled"),
    vencido: t("pfFilterExpired"),
  };

  const th = { ...S.th, whiteSpace: "nowrap" as const };

  return (
    <AdminLayout title={`${t("navPlataforma")} · ${t("pfNavCuentas")}`}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: 10,
            background: "var(--err-bg)",
            border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
            color: "var(--err)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Filtro por estado: pestañas con su cantidad */}
      <div
        role="group"
        aria-label={t("pfFilterState")}
        style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}
      >
        {FILTROS.map((f) => {
          const on = f === filtro;
          const n = conteo(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={on}
              onClick={() => setParam("f", f)}
              className="tap"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 13px",
                borderRadius: 999,
                border: `1px solid ${on ? "var(--fg)" : "var(--line)"}`,
                background: on ? "var(--fg)" : "var(--surface)",
                color: on ? "var(--bg)" : "var(--fg-2)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f === "riesgo" && n > 0 && (
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--err)" }} />
              )}
              {filtroLabel[f]}
              <span className="pn-num" style={{ opacity: 0.7, fontWeight: 500 }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {/* Búsqueda + plan */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200, maxWidth: 380 }}>
          <span
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-3)",
              display: "flex",
              pointerEvents: "none",
            }}
          >
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagina(1);
            }}
            placeholder={t("pfAcctSearchPh")}
            aria-label={t("pfAcctSearchPh")}
            style={{ ...S.input, padding: "8px 30px 8px 32px" }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label={t("actionCancel")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--fg-3)",
                display: "flex",
                padding: 2,
              }}
            >
              <IconX size={14} />
            </button>
          )}
        </div>
        <select
          value={plan}
          onChange={(e) => setParam("plan", e.target.value)}
          aria-label={t("pfFilterPlan")}
          style={{ ...S.input, width: "auto", minWidth: 170, cursor: "pointer", padding: "8px 12px" }}
        >
          <option value="">{t("pfAllPlans")}</option>
          {PLANES.map((p) => (
            <option key={p} value={p} style={{ textTransform: "capitalize" }}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div style={{ ...S.card, overflowX: "auto" }}>
        {loading ? (
          <div style={{ padding: 24, fontSize: 13, color: "var(--fg-3)" }}>{t("subLoading")}</div>
        ) : visibles.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 14, color: "var(--fg-3)" }}>
            {cuentas.length === 0 ? t("pfNoAccounts") : t("searchNoResults")}
          </div>
        ) : (
          <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse" }}>
            <thead style={S.thead}>
              <tr>
                <th scope="col" style={th}>{t("pfColAccount")}</th>
                <th scope="col" style={th}>{t("pfColPlan")}</th>
                <th scope="col" style={th}>{t("colStatus")}</th>
                <th scope="col" style={th}>{t("pfColRisk")}</th>
                <th scope="col" style={th}>{t("pfColUsage")}</th>
                <th scope="col" style={th}>{t("pfColSignup")}</th>
                <th scope="col" style={th}>
                  <span className="sr-only">{t("colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const r = riesgo.get(c.id);
                const est = ESTADO[c.estado_suscripcion] || { key: c.estado_suscripcion, color: "var(--fg-3)" };
                return (
                  <tr
                    key={c.id}
                    style={S.tr}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ ...S.td, minWidth: 200, maxWidth: 280 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 13.5,
                          color: "var(--fg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Highlight text={c.nombre} query={search} />
                        <span style={{ color: "var(--fg-3)", fontWeight: 400, marginLeft: 6, fontSize: 11.5 }}>#{c.id}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--fg-3)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.email ? <Highlight text={c.email} query={search} /> : "—"}
                        {c.origen ? ` · ${c.origen}` : ""}
                      </div>
                    </td>
                    <td style={S.td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "var(--fg)", textTransform: "capitalize" }}>
                        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: planColor[c.tipo_plan] }} />
                        {c.tipo_plan}
                      </span>
                      {(c.modulos?.length || c.precio_fundador || c.monto_mensual != null) && (
                        <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 3, lineHeight: 1.4 }}>
                          {c.modulos?.length ? `+ ${c.modulos.map((m) => MODULO_NOMBRE[m]).join(", ")}` : null}
                          {c.modulos?.length && (c.precio_fundador || c.monto_mensual != null) ? " · " : null}
                          {c.precio_fundador ? t("modFounder") : null}
                          {c.precio_fundador && c.monto_mensual != null ? " · " : null}
                          {c.monto_mensual != null
                            ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(c.monto_mensual) + "/mes"
                            : null}
                        </div>
                      )}
                    </td>
                    <td style={S.td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: est.color, whiteSpace: "nowrap" }}>
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: est.color }} />
                        {t(est.key)}
                      </span>
                    </td>
                    <td style={S.td}>
                      {r ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {r.motivos.map((m) => (
                            <span
                              key={m.tipo}
                              style={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 999,
                                whiteSpace: "nowrap",
                                color: m.nivel === "alto" ? "var(--err)" : "var(--warn)",
                                background: m.nivel === "alto" ? "var(--err-bg)" : "var(--warn-bg)",
                              }}
                            >
                              {motivoTexto(m)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "var(--fg-3)", fontSize: 13 }}>—</span>
                      )}
                    </td>
                    <td className="pn-num" style={{ ...S.td, fontSize: 12.5, color: "var(--fg-2)", whiteSpace: "nowrap" }}>
                      <div>
                        {t("pfUsageBiz", {
                          n: c.negocios_count,
                          max: c.limite_negocios >= 9999 ? "∞" : c.limite_negocios,
                        })}
                      </div>
                      <div style={{ color: "var(--fg-3)" }}>{t("pfUsageProd", { n: c.productos_count })}</div>
                    </td>
                    <td style={{ ...S.tdMuted, whiteSpace: "nowrap" }}>{fmtFecha(c.created_at, lang)}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => verComo(c)}
                        disabled={entrando !== null}
                        aria-label={`${t("pfViewAs")}: ${c.nombre}`}
                        aria-busy={entrando === c.id}
                        className="inline-flex min-h-[36px] cursor-pointer items-center whitespace-nowrap rounded-lg border border-line px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
                      >
                        {entrando === c.id ? t("pfOpening") : t("pfViewAs")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {filtradas.length > POR_PAGINA && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
          <span className="pn-num" style={{ fontSize: 13, color: "var(--fg-3)" }}>
            {t("pfPageOf", {
              a: (pag - 1) * POR_PAGINA + 1,
              b: Math.min(pag * POR_PAGINA, filtradas.length),
              n: filtradas.length,
            })}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...S.btnGhost, opacity: pag === 1 ? 0.5 : 1 }} disabled={pag === 1} onClick={() => setPagina(pag - 1)}>
              {t("pfPrev")}
            </button>
            <button
              type="button"
              style={{ ...S.btnGhost, opacity: pag === totalPaginas ? 0.5 : 1 }}
              disabled={pag === totalPaginas}
              onClick={() => setPagina(pag + 1)}
            >
              {t("pfNext")}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
