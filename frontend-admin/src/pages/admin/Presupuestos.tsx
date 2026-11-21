import { numeroPedido } from "../../lib/numeroPedido";
import { useCallback, useEffect, useId, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import Modal from "../../components/Modal";
import { EmptyState, Segmented } from "../../components/ui";
import { useStyles } from "../../components/sharedStyles";
import { useAuth } from "../../context/AuthContext";
import { useNegocio } from "../../context/NegocioContext";
import { useDialogos } from "../../lib/dialogos";
import { useLang } from "../../lib/i18n";
import { fmtMoney } from "../../lib/money";
import { fechaHoraAR, waLink } from "../../lib/fechas";
import { IconReceipt } from "../../lib/icons";
import {
  adjuntosService,
  getApiErrorMessage,
  presupuestosService,
  type EstadoPresupuesto,
  type Presupuesto,
  type PresupuestoDetalle,
} from "../../services/api";

// Bandeja de presupuestos: el cliente pide, el negocio revisa, cotiza y,
// si el cliente acepta, lo pasa a pedido.

const COLOR: Record<EstadoPresupuesto, string> = {
  pendiente: "var(--warn)",
  en_revision: "var(--info)",
  cotizado: "var(--violet)",
  aceptado: "var(--ok)",
  rechazado: "var(--err)",
  convertido: "var(--ok)",
  cancelado: "var(--fg-3)",
};

export default function Presupuestos() {
  const { t } = useLang();
  const s = useStyles();
  const { hasPermiso } = useAuth();
  const { moneda, tieneModulo } = useNegocio();
  const { confirmar } = useDialogos();
  const uid = useId();
  const puedeCotizar = hasPermiso("cotizar");
  const [vista, setVista] = useState<"abiertos" | "cerrados">("abiertos");
  const [lista, setLista] = useState<Presupuesto[] | null>(null);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState<PresupuestoDetalle | null>(null);
  const [cot, setCot] = useState({ precio: "", observaciones: "", valido_hasta: "" });
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargar = useCallback(() => {
    presupuestosService
      .listar(vista)
      .then((l) => {
        setLista(l);
        setError("");
      })
      .catch((e) => setError(getApiErrorMessage(e, t("presErrCargar"))));
  }, [vista, t]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrir = async (id: number) => {
    setMsg(null);
    try {
      const d = await presupuestosService.ver(id);
      setDetalle(d);
      setCot({
        precio: d.precio_cotizado !== null ? String(d.precio_cotizado) : "",
        observaciones: d.observaciones || "",
        valido_hasta: d.valido_hasta || "",
      });
    } catch (e) {
      setError(getApiErrorMessage(e, t("presErrCargar")));
    }
  };

  // Ejecuta una acción, recarga el detalle y la lista.
  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    if (!detalle) return;
    setOcupado(true);
    setMsg(null);
    try {
      await fn();
      await abrir(detalle.id);
      setMsg({ ok: true, texto: ok });
      cargar();
      window.dispatchEvent(new Event("agenda-cambio"));
    } catch (e) {
      setMsg({ ok: false, texto: getApiErrorMessage(e, t("presErrAccion")) });
    } finally {
      setOcupado(false);
    }
  };

  const cotizar = () => {
    const precio = Number(cot.precio.replace(",", "."));
    if (!Number.isFinite(precio) || precio < 0 || cot.precio.trim() === "") {
      setMsg({ ok: false, texto: t("presFaltaPrecio") });
      document.getElementById(`${uid}-precio`)?.focus();
      return;
    }
    accion(
      () => presupuestosService.cotizar(detalle!.id, { precio, observaciones: cot.observaciones || null, valido_hasta: cot.valido_hasta || null }),
      t("presCotizado"),
    );
  };

  const estadoTxt = (e: EstadoPresupuesto) => t(`presEst_${e}`);
  const abierto = detalle && ["pendiente", "en_revision", "cotizado", "aceptado"].includes(detalle.estado);
  const textoWa = (d: PresupuestoDetalle) =>
    d.estado === "cotizado"
      ? t("presWaCotizado", { n: d.cliente_nombre, p: fmtMoney(Number(d.precio_cotizado), moneda), link: d.link })
      : t("presWaSeguimiento", { n: d.cliente_nombre, link: d.link });

  return (
    <AdminLayout title={t("navPresupuestos")}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{t("presTitle")}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14 }}>{t("presSub")}</p>
        </div>
        <Segmented
          label={t("presVista")}
          value={vista}
          onChange={setVista}
          options={[
            { value: "abiertos", label: t("presAbiertos") },
            { value: "cerrados", label: t("presCerrados") },
          ]}
        />
      </div>

      {error && <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{error}</p>}
      {!lista && !error && <p role="status" style={{ color: "var(--fg-3)" }}>{t("subLoading")}</p>}
      {lista?.length === 0 && <EmptyState icon={<IconReceipt size={26} />} title={t("presVacio")} desc={t("presVacioDesc")} />}

      {!!lista?.length && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(min(290px, 100%), 1fr))" }}>
          {lista.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => abrir(p.id)}
                style={{ ...s.card, width: "100%", textAlign: "left", padding: 14, display: "grid", gap: 6, cursor: "pointer", color: "var(--fg)" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ marginRight: "auto" }}>#{p.id} · {p.cliente_nombre}</strong>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLOR[p.estado] }}>{estadoTxt(p.estado)}</span>
                </span>
                {p.referencia && <span style={{ fontSize: 13, fontWeight: 600 }}>{p.referencia}</span>}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}>→ {t(`presPaso_${p.estado}`)}</span>
                <span style={{ fontSize: 13, color: "var(--fg-2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {p.descripcion}
                </span>
                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                  {fechaHoraAR(p.created_at)}
                  {p.precio_cotizado !== null && ` · ${fmtMoney(Number(p.precio_cotizado), moneda)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {detalle && (
        <Modal
          title={t("presDetalle", { n: detalle.id })}
          subtitle={`${detalle.cliente_nombre} · ${estadoTxt(detalle.estado)}`}
          onClose={() => setDetalle(null)}
          maxWidth={680}
          icon={<IconReceipt />}
        >
          <div style={{ ...s.modalBody, display: "grid", gap: 16 }}>
            <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "var(--surface-2)", fontWeight: 600, color: "var(--fg)" }}>
              {t("presProximo")}: {t(`presPaso_${detalle.estado}`)}
            </p>
            <p role="status" style={{ margin: 0, fontWeight: 600, color: msg?.ok ? "var(--ok)" : "var(--err)" }}>{msg?.texto || ""}</p>
            <section style={{ display: "grid", gap: 6, fontSize: 14, color: "var(--fg)" }}>
              {detalle.referencia && <p style={{ margin: 0 }}><strong>{t("presSobre")}:</strong> {detalle.referencia}</p>}
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{detalle.descripcion}</p>
              <p style={{ margin: 0, color: "var(--fg-2)" }}>
                {t("presCantidad")}: {detalle.cantidad}
                {detalle.medidas && ` · ${t("presMedidas")}: ${detalle.medidas}`}
              </p>
              <p style={{ margin: 0, color: "var(--fg-2)" }}>
                {[detalle.telefono, detalle.email].filter(Boolean).join(" · ")}
              </p>
              {detalle.adjuntos.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {detalle.adjuntos.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={async () => {
                          const w = window.open("", "_blank");
                          try {
                            const { url } = await adjuntosService.ver(a.id);
                            if (w) {
                              w.opener = null;
                              w.location.href = url;
                            }
                          } catch (e) {
                            w?.close();
                            setMsg({ ok: false, texto: getApiErrorMessage(e, t("adjErrAbrir")) });
                          }
                        }}
                        aria-label={`${t("adjVer")}: ${a.nombre} (${t("adjNuevaPestana")})`}
                        style={{ background: "none", border: "none", minHeight: 32, padding: "4px 2px", color: "var(--info)", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
                      >
                        {t("adjVer")}: {a.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Contactar y compartir el link del cliente */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {detalle.telefono && (
                <a href={waLink(detalle.telefono, textoWa(detalle))} target="_blank" rel="noopener noreferrer" style={{ ...s.btnGhost, minHeight: 44, textDecoration: "none" }}>
                  {detalle.estado === "cotizado" ? t("presEnviarWa") : t("presEscribirWa")}
                </a>
              )}
              <button
                type="button"
                style={{ ...s.btnGhost, minHeight: 44 }}
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(detalle.link)
                    .then(() => setMsg({ ok: true, texto: t("presLinkCopiado") }))
                    .catch(() => setMsg({ ok: false, texto: `${t("presLinkCopiarError")} ${detalle.link}` }))
                }
              >
                {t("presCopiarLink")}
              </button>
            </div>

            {/* Cotizar */}
            {puedeCotizar && ["pendiente", "en_revision", "cotizado"].includes(detalle.estado) && (
              <section style={{ display: "grid", gap: 10, padding: 12, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface-2)" }}>
                <strong style={{ color: "var(--fg)" }}>{detalle.estado === "cotizado" ? t("presRecotizar") : t("presCotizar")}</strong>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))" }}>
                  <div>
                    <label htmlFor={`${uid}-precio`} style={s.label}>{t("presPrecio")}</label>
                    <input id={`${uid}-precio`} style={s.input} inputMode="decimal" value={cot.precio} onChange={(e) => setCot({ ...cot, precio: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-vence`} style={s.label}>{t("presVence")}</label>
                    <input id={`${uid}-vence`} style={s.input} type="date" value={cot.valido_hasta} onChange={(e) => setCot({ ...cot, valido_hasta: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label htmlFor={`${uid}-obs`} style={s.label}>{t("presObservaciones")}</label>
                  <textarea id={`${uid}-obs`} style={{ ...s.input, minHeight: 70 }} maxLength={2000} value={cot.observaciones}
                    onChange={(e) => setCot({ ...cot, observaciones: e.target.value })} />
                </div>
                <div>
                  <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} onClick={cotizar} disabled={ocupado}>
                    {t("presGuardarCotizacion")}
                  </button>
                </div>
              </section>
            )}
            {!puedeCotizar && ["pendiente", "en_revision"].includes(detalle.estado) && (
              <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)" }}>{t("presSinPermisoCotizar")}</p>
            )}

            {/* Acciones de estado */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {detalle.estado === "pendiente" && (
                <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} disabled={ocupado}
                  onClick={() => accion(() => presupuestosService.estado(detalle.id, "en_revision"), t("presEst_en_revision"))}>
                  {t("presMarcarRevision")}
                </button>
              )}
              {detalle.estado === "aceptado" && !tieneModulo("pedidos") && (
                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)", alignSelf: "center" }}>{t("presSinPedidos")}</p>
              )}
              {detalle.estado === "aceptado" && puedeCotizar && tieneModulo("pedidos") && (
                <button type="button" style={{ ...s.btnPrimary, minHeight: 44 }} disabled={ocupado}
                  onClick={async () => {
                    if (await confirmar({ mensaje: t("presConfirmPedido") })) accion(() => presupuestosService.convertir(detalle.id), t("presConvertido"));
                  }}>
                  {t("presPasarPedido")}
                </button>
              )}
              {abierto && (
                <>
                  <button type="button" style={{ ...s.btnGhost, minHeight: 44, color: "var(--err)" }} disabled={ocupado}
                    onClick={async () => {
                      if (await confirmar({ mensaje: t("presConfirmRechazar"), peligro: true }))
                        accion(() => presupuestosService.estado(detalle.id, "rechazado"), t("presEst_rechazado"));
                    }}>
                    {t("presRechazar")}
                  </button>
                  <button type="button" style={{ ...s.btnGhost, minHeight: 44 }} disabled={ocupado}
                    onClick={async () => {
                      if (await confirmar({ mensaje: t("presConfirmCancelar"), peligro: true }))
                        accion(() => presupuestosService.estado(detalle.id, "cancelado"), t("presEst_cancelado"));
                    }}>
                    {t("presCancelar")}
                  </button>
                </>
              )}
              {detalle.pedido_id && <p style={{ margin: 0, alignSelf: "center", color: "var(--ok)", fontWeight: 600 }}>{t("presEsPedido", { n: numeroPedido({ id: detalle.pedido_id, numero: detalle.pedido_numero }) })}</p>}
            </div>
            {/* Historial */}
            <section>
              <h3 style={{ ...s.label, margin: "0 0 6px" }}>{t("presHistorial")}</h3>
              <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, color: "var(--fg-2)" }}>
                {detalle.eventos.map((e, i) => (
                  <li key={i}>
                    {fechaHoraAR(e.created_at)} · <strong style={{ color: "var(--fg)" }}>{estadoTxt(e.estado)}</strong> ·{" "}
                    {e.autor === "cliente" ? t("presPorCliente") : t("presPorNegocio")}
                    {e.nota ? ` · ${e.nota}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
