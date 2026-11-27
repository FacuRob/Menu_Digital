import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import Modal from "../../components/Modal";
import TicketModal from "../../components/TicketModal";
import EditorPlano from "../../components/EditorPlano";
import PlanoMesas from "../../components/PlanoMesas";
import { COLOR_ESTADO, numerosDe, planoInicial, type EstadoMesa } from "../../lib/planoMesas";
import { EmptyState } from "../../components/ui";
import { useStyles } from "../../components/sharedStyles";
import { useAuth } from "../../context/AuthContext";
import { useNegocio } from "../../context/NegocioContext";
import { useLang } from "../../lib/i18n";
import { useDialogos } from "../../lib/dialogos";
import { fmtMoney } from "../../lib/money";
import { fmtPeso } from "../../lib/cantidad";
import { horaAR } from "../../lib/fechas";
import { numeroPedido } from "../../lib/numeroPedido";
import {
  configuracionService,
  getApiErrorMessage,
  mesasService,
  type Configuracion,
  type EstadoMesas,
  type MesaOcupada,
  type Pedido,
  type PlanoMesas as Plano,
} from "../../services/api";

// Mesas (gastronomía): el plano del local con las mesas libres y ocupadas.
// Una mesa se ocupa cuando el cliente escanea su QR (o pide) y se libera al
// sacar el ticket o al tocar "Liberar mesa".

const REFRESCO_MS = 15_000;

const estadoColor: Record<Pedido["estado"], string> = {
  pendiente: "var(--warn)",
  preparando: "var(--info)",
  listo: "var(--violet)",
  en_camino: "var(--teal)",
  entregado: "var(--ok)",
  cancelado: "var(--err)",
};
const estadoKey: Record<Pedido["estado"], string> = {
  pendiente: "pedStatePendiente",
  preparando: "pedStatePreparando",
  listo: "pedStateListo",
  en_camino: "pedStateEnCamino",
  entregado: "pedStateEntregado",
  cancelado: "pedStateCancelado",
};

const minutosDesde = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

// Todos los pedidos de la mesa en un solo comprobante.
const pedidoDeMesa = (o: MesaOcupada): Pedido => {
  const [primero] = o.pedidos;
  return {
    ...primero,
    mesa: o.mesa,
    tipo_entrega: "mesa",
    cliente: null,
    direccion_entrega: null,
    costo_envio: 0,
    metodo_pago: null,
    nota: o.pedidos.map((p) => p.nota).filter(Boolean).join(" · ") || null,
    created_at: o.ocupada_desde,
    total: o.total,
    items: o.pedidos.flatMap((p) => p.items || []),
  } as Pedido;
};

export default function Mesas() {
  const { t } = useLang();
  const s = useStyles();
  const { user, hasPermiso } = useAuth();
  const { moneda } = useNegocio();
  const { confirmar, avisar } = useDialogos();
  const fmt = (n: number) => fmtMoney(n, moneda);
  const esDueno = user?.rol === "admin";

  const [datos, setDatos] = useState<EstadoMesas | null>(null);
  const [error, setError] = useState("");
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [editando, setEditando] = useState(false);
  const [pi, setPi] = useState(0);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [ticket, setTicket] = useState<{ pedido: Pedido; mesa: string } | null>(null);
  const [liberando, setLiberando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setDatos(await mesasService.get());
      setError("");
    } catch (e) {
      setError(getApiErrorMessage(e, t("mesErrCargar")));
    }
  }, [t]);

  useEffect(() => {
    void cargar();
    configuracionService.get().then(setConfig).catch(() => {});
  }, [cargar]);

  // Se actualiza sola mientras se mira (no durante la edición del plano).
  useEffect(() => {
    if (editando) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void cargar();
    }, REFRESCO_MS);
    return () => window.clearInterval(id);
  }, [cargar, editando]);

  const ocupadas = useMemo(() => new Map((datos?.ocupadas || []).map((o) => [o.mesa, o])), [datos]);
  const plano = datos?.plano ?? null;

  // Mesas combinadas del plano (6+7): cada número apunta a todos los de su mesa.
  const grupos = useMemo(() => {
    const g = new Map<string, string[]>();
    plano?.pisos.forEach((p) => p.mesas.forEach((m) => numerosDe(m).forEach((n) => g.set(n, numerosDe(m)))));
    return g;
  }, [plano]);
  const numsDe = (m: string) => grupos.get(m) ?? [m];
  const nombreDe = (m: string) => numsDe(m).join("+");
  // Lo ocupado de una mesa, sumando sus números si está combinada.
  const infoDe = (m: string): MesaOcupada | undefined => {
    const partes = numsDe(m).flatMap((n) => ocupadas.get(n) ?? []);
    if (partes.length < 2) return partes[0] && { ...partes[0], mesa: nombreDe(m) };
    return {
      mesa: nombreDe(m),
      ocupada_desde: partes.map((o) => o.ocupada_desde).sort()[0],
      pedidos: partes.flatMap((o) => o.pedidos).sort((a, b) => ((a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1)),
      en_curso: partes.reduce((a, o) => a + o.en_curso, 0),
      total: partes.reduce((a, o) => a + o.total, 0),
    };
  };
  const estadoDe = (m: string): EstadoMesa => {
    const o = infoDe(m);
    if (!o) return "libre";
    return o.pedidos.length ? "pedido" : "ocupada";
  };
  const etiquetaEstado = (e: EstadoMesa) => t(e === "libre" ? "mesLibre" : e === "ocupada" ? "mesOcupada" : "mesConPedido");
  const etiquetaDe = (m: string) => {
    const o = infoDe(m);
    const e = estadoDe(m);
    return [t("mesMesaN", { n: nombreDe(m) }), etiquetaEstado(e), o?.pedidos.length ? fmt(o.total) : ""].filter(Boolean).join(", ");
  };
  const detalleDe = (m: string) => {
    const o = infoDe(m);
    return o?.pedidos.length ? fmt(o.total) : undefined;
  };

  // Mesas que existen (1..cantidad, más las del plano y las ocupadas).
  const todas = useMemo(() => {
    const set = new Set<number>();
    for (let i = 1; i <= (datos?.cantidad || 0); i++) set.add(i);
    plano?.pisos.forEach((p) => p.mesas.forEach((m) => numerosDe(m).forEach((n) => set.add(Number(n)))));
    datos?.ocupadas.forEach((o) => set.add(Number(o.mesa)));
    return [...set].filter((n) => Number.isFinite(n)).sort((a, b) => a - b).map(String);
  }, [datos, plano]);
  const enPlano = useMemo(() => new Set(plano?.pisos.flatMap((p) => p.mesas.flatMap(numerosDe)) || []), [plano]);
  const sinUbicar = todas.filter((m) => !enPlano.has(m));
  // Una mesa combinada cuenta una vez (por su primer número).
  const principales = [...new Set(todas.map((m) => numsDe(m)[0]))];
  const cuenta = { libre: 0, ocupada: 0, pedido: 0 } as Record<EstadoMesa, number>;
  principales.forEach((m) => cuenta[estadoDe(m)]++);

  const guardarPlano = async (p: Plano | null) => {
    try {
      const r = await mesasService.guardarPlano(p);
      setDatos((d) => (d ? { ...d, plano: r.plano, activo: r.activo, cantidad: r.cantidad } : d));
      setEditando(false);
      setPi(0);
    } catch (e) {
      throw new Error(getApiErrorMessage(e, t("mesErrGuardar")));
    }
  };

  const liberar = async (mesa: string, preguntar: boolean) => {
    const o = infoDe(mesa);
    if (preguntar) {
      const msg = o?.en_curso ? t("mesLiberarConfirmPedidos", { n: o.en_curso }) : t("mesLiberarConfirm", { n: nombreDe(mesa) });
      if (!(await confirmar({ titulo: t("mesLiberar"), mensaje: msg, confirmarTexto: t("mesLiberar") }))) return;
    }
    setLiberando(true);
    try {
      // Combinada: se liberan todos sus números.
      for (const n of numsDe(mesa)) if (ocupadas.has(n)) await mesasService.liberar(n);
      setAbierta(null);
      await cargar();
    } catch (e) {
      void avisar({ mensaje: getApiErrorMessage(e, t("mesErrLiberar")), tipo: "error" });
    } finally {
      setLiberando(false);
    }
  };

  const titulo = t("navMesas");
  const piso = plano?.pisos[Math.min(pi, plano.pisos.length - 1)];
  const mesaAbierta = abierta ? infoDe(abierta) : undefined;

  if (editando && datos) {
    return (
      <AdminLayout title={titulo}>
        <div style={{ marginBottom: 14 }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{plano ? t("mesEditarPlano") : t("mesDibujarLocal")}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14, maxWidth: "65ch" }}>{t("mesEditorSub")}</p>
        </div>
        <EditorPlano
          inicial={plano ?? planoInicial(datos.cantidad, t("mesPlantaBaja"))}
          existe={!!plano}
          onGuardar={guardarPlano}
          onEliminar={() => guardarPlano(null)}
          onCancelar={() => setEditando(false)}
        />
      </AdminLayout>
    );
  }

  const botonMesa = (m: string) => {
    const e = estadoDe(m);
    const c = COLOR_ESTADO[e];
    const o = infoDe(m);
    return (
      <li key={m}>
        <button
          className="tap"
          onClick={() => setAbierta(m)}
          aria-label={etiquetaDe(m)}
          style={{
            width: "100%",
            minHeight: 76,
            display: "grid",
            justifyItems: "center",
            alignContent: "center",
            gap: 2,
            borderRadius: "var(--r-md)",
            border: `2px solid ${c.stroke}`,
            background: c.fill,
            color: c.text,
            cursor: "pointer",
            padding: 8,
          }}
        >
          <span className="pn-num" style={{ fontSize: 22, fontWeight: 800 }}>{nombreDe(m)}</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{o?.pedidos.length ? fmt(o.total) : etiquetaEstado(e)}</span>
        </button>
      </li>
    );
  };

  const leyenda = (e: EstadoMesa) => (
    <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg-2)" }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: COLOR_ESTADO[e].fill, border: `2px solid ${COLOR_ESTADO[e].stroke}` }} />
      {etiquetaEstado(e)} <strong className="pn-num" style={{ color: "var(--fg)" }}>{cuenta[e]}</strong>
    </span>
  );

  return (
    <AdminLayout title={titulo}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginBottom: 16 }}>
        <div style={{ marginRight: "auto" }}>
          <h2 className="pn-title" style={{ margin: 0, fontSize: 22, color: "var(--fg)" }}>{titulo}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--fg-2)", fontSize: 14, maxWidth: "65ch" }}>{t("mesSub")}</p>
        </div>
        {esDueno && datos && (
          <button className="tap" style={plano ? s.btnGhost : s.btnPrimary} onClick={() => setEditando(true)}>
            {plano ? t("mesEditarPlano") : t("mesDibujarLocal")}
          </button>
        )}
      </div>

      {error && <p role="alert" style={{ color: "var(--err)", fontWeight: 600 }}>{error}</p>}
      {!datos && !error && <p role="status" style={{ color: "var(--fg-3)" }}>{t("subLoading")}</p>}

      {datos && !datos.migracion && (
        <p style={{ margin: "0 0 12px", padding: "10px 12px", borderRadius: "var(--r-sm)", background: "var(--warn-bg)", color: "var(--fg)", fontSize: 13 }}>
          {t("mesFaltaMigracion")}
        </p>
      )}

      {datos && todas.length === 0 && (
        <EmptyState
          title={t("mesVacio")}
          desc={
            <>
              {esDueno ? t("mesVacioDescDueno") : t("mesVacioDesc")}{" "}
              {hasPermiso("configuracion") && <Link to="/admin/configuracion" style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{t("mesIrConfig")}</Link>}
            </>
          }
        />
      )}

      {datos && todas.length > 0 && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }} aria-live="polite">
            {(["libre", "ocupada", "pedido"] as EstadoMesa[]).map(leyenda)}
          </div>

          {plano && piso && (
            <div style={{ ...s.card, padding: 12, marginBottom: 16 }}>
              {plano.pisos.length > 1 && (
                <div role="tablist" aria-label={t("mesPisos")} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {plano.pisos.map((p, i) => {
                    const ocup = p.mesas.filter((m) => infoDe(m.mesa)).length;
                    return (
                      <button
                        key={p.id}
                        role="tab"
                        aria-selected={i === pi}
                        className="tap"
                        onClick={() => setPi(i)}
                        style={{
                          ...s.btnGhost,
                          minHeight: 40,
                          fontSize: 13,
                          ...(i === pi ? { background: "var(--spot)", color: "var(--on-spot)", borderColor: "var(--spot)" } : {}),
                        }}
                      >
                        {p.nombre} · {t("mesOcupadasDe", { o: ocup, n: p.mesas.length })}
                      </button>
                    );
                  })}
                </div>
              )}
              <PlanoMesas
                piso={piso}
                estadoDe={estadoDe}
                detalleDe={detalleDe}
                etiquetaDe={etiquetaDe}
                onMesa={setAbierta}
                ariaLabel={t("mesPlanoDe", { p: piso.nombre })}
              />
            </div>
          )}

          {/* Con plano: las ocupadas también en botones grandes (cómodo en el celular). */}
          {plano && ocupadas.size > 0 && (
            <section aria-labelledby="mes-ocupadas" style={{ marginBottom: 16 }}>
              <h3 id="mes-ocupadas" style={{ margin: "0 0 8px", fontSize: 14, color: "var(--fg-2)" }}>{t("mesOcupadasAhora")}</h3>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
                {[...new Set([...ocupadas.keys()].map((n) => numsDe(n)[0]))].sort((a, b) => Number(a) - Number(b)).map(botonMesa)}
              </ul>
            </section>
          )}

          {sinUbicar.length > 0 && (
            <section aria-labelledby="mes-sin-ubicar">
              {plano && (
                <h3 id="mes-sin-ubicar" style={{ margin: "0 0 8px", fontSize: 14, color: "var(--fg-2)" }}>
                  {t("mesSinUbicar")}
                </h3>
              )}
              {!plano && <h3 id="mes-sin-ubicar" className="sr-only">{t("mesTodas")}</h3>}
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
                {sinUbicar.map(botonMesa)}
              </ul>
              {!plano && esDueno && (
                <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--fg-3)" }}>{t("mesSinPlanoTip")}</p>
              )}
            </section>
          )}
        </>
      )}

      {/* Detalle de una mesa */}
      {abierta && (
        <Modal
          title={t("mesMesaN", { n: nombreDe(abierta) })}
          subtitle={
            mesaAbierta
              ? t("mesOcupadaDesde", { h: horaAR(mesaAbierta.ocupada_desde), m: minutosDesde(mesaAbierta.ocupada_desde) })
              : t("mesLibre")
          }
          onClose={() => setAbierta(null)}
          maxWidth={520}
        >
          <div style={s.modalBody}>
            {!mesaAbierta && <p style={{ margin: 0, color: "var(--fg-2)" }}>{t("mesLibreDesc")}</p>}
            {mesaAbierta && mesaAbierta.pedidos.length === 0 && (
              <p style={{ margin: 0, color: "var(--fg-2)" }}>{t("mesSinPedidos")}</p>
            )}
            {mesaAbierta && mesaAbierta.pedidos.length > 0 && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
                {mesaAbierta.pedidos.map((p) => (
                  <li key={p.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <strong style={{ color: "var(--fg)", fontSize: 14 }}>{numeroPedido(p)}</strong>
                      <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{p.created_at ? horaAR(p.created_at) : ""}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          color: "var(--fg)",
                          background: `color-mix(in srgb, ${estadoColor[p.estado]} 16%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${estadoColor[p.estado]} 45%, transparent)`,
                        }}
                      >
                        {t(estadoKey[p.estado])}
                      </span>
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 3 }}>
                      {(p.items || []).map((it, i) => (
                        <li key={it.id ?? i} style={{ display: "flex", gap: 8, fontSize: 14, color: "var(--fg-2)" }}>
                          <span className="pn-num" style={{ minWidth: 42, color: "var(--fg)" }}>
                            {it.unidad === "kg" ? fmtPeso(Number(it.cantidad)) : `${it.cantidad}×`}
                          </span>
                          <span style={{ flex: 1 }}>
                            {it.nombre}
                            {!!it.opciones?.length && (
                              <span style={{ display: "block", fontSize: 12, color: "var(--fg-3)" }}>
                                {it.opciones.map((o) => o.opcion).join(", ")}
                              </span>
                            )}
                          </span>
                          <span className="pn-num">{fmt(Number(it.subtotal))}</span>
                        </li>
                      ))}
                    </ul>
                    {p.nota && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fg-2)" }}>{t("ticketNote")}: {p.nota}</p>}
                  </li>
                ))}
              </ul>
            )}
            {mesaAbierta && mesaAbierta.pedidos.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{t("totalLabel")}</span>
                <strong className="pn-num" style={{ fontSize: 19, color: "var(--fg)" }}>{fmt(mesaAbierta.total)}</strong>
              </div>
            )}
          </div>
          {mesaAbierta && (
            <div style={{ ...s.modalFooter, flexWrap: "wrap" }}>
              <button className="tap" style={s.btnGhost} disabled={liberando} onClick={() => abierta && liberar(abierta, true)}>
                {t("mesLiberar")}
              </button>
              {mesaAbierta.pedidos.length > 0 && (
                <button
                  className="tap"
                  style={s.btnPrimary}
                  disabled={liberando}
                  onClick={() => {
                    if (abierta) setTicket({ pedido: pedidoDeMesa(mesaAbierta), mesa: abierta });
                    setAbierta(null);
                  }}
                >
                  {t("mesImprimirTicket")}
                </button>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Ticket de la mesa: al imprimirlo, la mesa se libera. */}
      <TicketModal
        pedido={ticket?.pedido ?? null}
        config={config}
        onClose={() => setTicket(null)}
        onImpreso={() => ticket && void liberar(ticket.mesa, false)}
      />
    </AdminLayout>
  );
}
