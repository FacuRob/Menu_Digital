import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStyles } from "./sharedStyles";
import { useAuth } from "../context/AuthContext";
import { useNegocio } from "../context/NegocioContext";
import { useLang } from "../lib/i18n";
import {
  suscripcionService,
  getApiErrorMessage,
  type CodigoModulo,
  type ModuloCatalogo,
  type SuscripcionEstado,
} from "../services/api";

// "Lo que pagás por mes": plan + módulos sumados, con Sumar / Quitar.
// Sólo para quien paga una suscripción de Mercado Pago (activa). Los cambios
// se cobran desde el próximo cobro; al quitar, se usa hasta ese cobro.
export default function ModulosSuscripcion({
  data,
  onCambio,
  money,
  fmtFecha,
  planNombre,
  precioEstandar,
  onElegirEstandar,
  abrir,
}: {
  data: SuscripcionEstado;
  onCambio: (d: Partial<SuscripcionEstado>) => void;
  money: (n: number) => string;
  fmtFecha: (iso: string | null) => string;
  planNombre: (code: string) => string;
  precioEstandar: number | null;
  onElegirEstandar: () => void;
  // Módulo a ofrecer apenas se abre la pantalla (?modulo=whatsapp).
  abrir?: CodigoModulo | null;
}) {
  const S = useStyles();
  const { t } = useLang();
  const { hasPermiso } = useAuth();
  const { recargarPlan } = useNegocio();
  const [confirmar, setConfirmar] = useState<{ codigo: CodigoModulo; accion: "sumar" | "quitar" } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const cajaRef = useRef<HTMLDivElement>(null);
  // Foco: al abrir la confirmación va a su panel; al cerrarla, al título de la tarjeta.
  const confirmRef = useRef<HTMLDivElement>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const abierta = useRef(false);
  useLayoutEffect(() => {
    if (confirmar) confirmRef.current?.focus();
    else if (abierta.current) tituloRef.current?.focus();
    abierta.current = !!confirmar;
  }, [confirmar]);

  const catalogo = data.modulos ?? [];
  const cuentaMods = data.modulos_cuenta ?? {};
  const monto = data.monto_proximo_cobro ?? 0;
  const puede = hasPermiso("suscripcion");
  const proximo = fmtFecha(data.periodo_fin);

  const incluido = (m: ModuloCatalogo) => m.incluido_en.includes(data.tipo_plan);
  const activo = (c: CodigoModulo) => !!cuentaMods[c] && !cuentaMods[c]!.baja_en;

  // Abrir la confirmación del módulo que pidió la pantalla de WhatsApp.
  useEffect(() => {
    if (!abrir || !puede) return;
    const m = catalogo.find((x) => x.codigo === abrir);
    if (!m || incluido(m) || activo(abrir)) return;
    if (m.requiere && !activo(m.requiere) && !catalogo.find((x) => x.codigo === m.requiere && incluido(x))) return;
    setConfirmar({ codigo: abrir, accion: "sumar" });
    const quieto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cajaRef.current?.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir]);

  const aplicar = async () => {
    if (!confirmar) return;
    setGuardando(true);
    setMsg(null);
    try {
      const fn = confirmar.accion === "sumar" ? suscripcionService.sumarModulo : suscripcionService.quitarModulo;
      const r = await fn(confirmar.codigo);
      onCambio({ modulos_cuenta: r.modulos_cuenta, funciones: r.funciones, monto_proximo_cobro: r.monto_proximo_cobro, periodo_fin: r.periodo_fin });
      recargarPlan();
      const nombre = catalogo.find((m) => m.codigo === confirmar.codigo)?.nombre ?? "";
      setMsg({
        ok: true,
        text:
          confirmar.accion === "sumar"
            ? t("modAddedOk", { modulo: nombre })
            : t("modRemovedOk", { modulo: nombre, date: fmtFecha(r.baja_en) }),
      });
      setConfirmar(null);
    } catch (e) {
      setMsg({ ok: false, text: getApiErrorMessage(e, t("modChangeError")) });
    } finally {
      setGuardando(false);
    }
  };

  const fila: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "6px 12px",
    padding: "12px 0",
    borderTop: "1px solid var(--line)",
  };
  const nombreCss: React.CSSProperties = { flex: "1 1 180px", fontSize: 14, fontWeight: 600, color: "var(--fg)" };
  const precioCss: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: "var(--fg)", fontVariantNumeric: "tabular-nums" };
  // Precio + botón: juntos y a la derecha (también cuando bajan de línea).
  const derechaCss: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 12, marginLeft: "auto" };
  const notaCss: React.CSSProperties = { fontSize: 13, color: "var(--fg-2)" };
  // Botones de 44 px de alto (táctil).
  const btn = (base: React.CSSProperties): React.CSSProperties => ({ ...base, minHeight: 44 });
  const pillCss: React.CSSProperties = {
    fontSize: 11.5,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    color: "var(--ok)",
    background: "var(--ok-bg)",
  };

  // Básico con módulos que ya cuesta más que el Estándar.
  const conviene = data.tipo_plan === "basic" && precioEstandar != null && monto > precioEstandar;

  return (
    <div ref={cajaRef} style={{ ...S.card, padding: 22, marginBottom: 18 }}>
      <h3 ref={tituloRef} tabIndex={-1} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--fg)", outline: "none" }}>{t("modPayTitle")}</h3>
      <p style={{ margin: "4px 0 10px", ...notaCss }}>{t("modHint")}</p>

      <div style={fila}>
        <span style={nombreCss}>{t("modPlanRow", { plan: planNombre(data.tipo_plan) })}</span>
        <span style={derechaCss}>
          {data.precio_fundador && <span style={{ ...pillCss, color: "var(--info)", background: "var(--info-bg)" }}>{t("modFounder")}</span>}
          <span style={precioCss}>{money(data.precio_plan ?? 0)}</span>
        </span>
      </div>

      {catalogo.map((m) => {
        const fila_ = cuentaMods[m.codigo];
        const enConfirm = confirmar?.codigo === m.codigo;
        const faltaReq = !!m.requiere && !activo(m.requiere) && !catalogo.find((x) => x.codigo === m.requiere && incluido(x));
        const dependiente = catalogo.find((x) => x.requiere === m.codigo && activo(x.codigo));
        const nombreReq = catalogo.find((x) => x.codigo === m.requiere)?.nombre ?? "";

        let derecha: React.ReactNode;
        if (incluido(m)) {
          derecha = <span style={pillCss}>{t("modIncluded")}</span>;
        } else if (fila_ && !fila_.baja_en) {
          derecha = (
            <>
              <span style={precioCss}>{money(m.precio_mensual)}</span>
              {puede && !dependiente && (
                <button type="button" style={btn({ ...S.btnGhost, color: "var(--err)" })} disabled={guardando}
                  onClick={() => { setMsg(null); setConfirmar({ codigo: m.codigo, accion: "quitar" }); }}>
                  {t("modRemove")}
                </button>
              )}
            </>
          );
        } else if (fila_?.baja_en) {
          derecha = (
            <>
              <span style={notaCss}>{t("modUntil", { date: fmtFecha(fila_.baja_en) })}</span>
              {puede && (
                <button type="button" style={btn(S.btnGhost)} disabled={guardando}
                  onClick={() => { setMsg(null); setConfirmar({ codigo: m.codigo, accion: "sumar" }); }}>
                  {t("modKeep")}
                </button>
              )}
            </>
          );
        } else {
          derecha = (
            <>
              <span style={{ ...precioCss, fontWeight: 600, color: "var(--fg-2)" }}>+{money(m.precio_mensual)}</span>
              {puede && (
                <button type="button" disabled={guardando || faltaReq}
                  style={btn(faltaReq ? { ...S.btnGhost, opacity: 0.55, cursor: "not-allowed" } : S.btnPrimary)}
                  aria-describedby={faltaReq ? `req-${m.codigo}` : undefined}
                  onClick={() => { setMsg(null); setConfirmar({ codigo: m.codigo, accion: "sumar" }); }}>
                  {t("modAdd")}
                </button>
              )}
            </>
          );
        }

        // Texto de la confirmación.
        let confirmTexto = "";
        if (enConfirm && confirmar) {
          if (confirmar.accion === "sumar") {
            confirmTexto = fila_?.baja_en
              ? t("modKeepBody", { date: proximo, total: money(fila_.cobrado ? monto + m.precio_mensual : monto) })
              : t("modAddBody", { date: proximo, total: money(monto + m.precio_mensual) });
          } else {
            confirmTexto = fila_?.cobrado
              ? t("modRemoveBody", { date: proximo, total: money(monto - m.precio_mensual) })
              : t("modRemoveBodyUnpaid", { date: proximo });
          }
        }

        return (
          <div key={m.codigo}>
            <div style={fila}>
              <span style={nombreCss}>
                {m.nombre}
                {!incluido(m) && faltaReq && !fila_ && (
                  <span id={`req-${m.codigo}`} style={{ display: "block", ...notaCss, fontWeight: 400 }}>{t("modNeeds", { modulo: nombreReq })}</span>
                )}
                {dependiente && fila_ && !fila_.baja_en && (
                  <span style={{ display: "block", ...notaCss, fontWeight: 400 }}>
                    {t("modRemoveFirst", { modulo: dependiente.nombre })}
                  </span>
                )}
              </span>
              <span style={derechaCss}>{derecha}</span>
            </div>
            {enConfirm && confirmar && (
              <div role="group" aria-labelledby={`conf-${m.codigo}`} ref={confirmRef} tabIndex={-1}
                style={{ margin: "0 0 12px", padding: "14px 16px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <div id={`conf-${m.codigo}`} style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>
                  {t(confirmar.accion === "sumar" ? (fila_?.baja_en ? "modKeepTitle" : "modAddTitle") : "modRemoveTitle", { modulo: m.nombre })}
                </div>
                <p style={{ margin: "4px 0 12px", fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)" }}>{confirmTexto}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="button" onClick={aplicar} disabled={guardando}
                    style={btn(confirmar.accion === "quitar" ? { ...S.btnPrimary, background: "var(--err)", borderColor: "var(--err)" } : S.btnPrimary)}>
                    {guardando ? t("modSaving") : t(confirmar.accion === "sumar" ? "modAddYes" : "modRemoveYes")}
                  </button>
                  <button type="button" onClick={() => setConfirmar(null)} disabled={guardando} style={btn(S.btnGhost)}>
                    {t(confirmar.accion === "sumar" ? "modAddNo" : "modRemoveNo")}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {data.descuento && (
        <div style={{ ...fila, ...notaCss }}>
          {t("modCouponNote", { pct: data.descuento.porcentaje })}
        </div>
      )}

      <div style={{ ...fila, borderTop: "2px solid var(--line)" }}>
        <span style={{ ...nombreCss, fontWeight: 700 }}>{t("modTotal", { date: proximo })}</span>
        <span style={{ ...precioCss, fontSize: 18 }}>{money(monto)}</span>
      </div>

      {conviene && (
        <div style={{ marginTop: 6, padding: "12px 14px", borderRadius: 10, background: "var(--info-bg)", color: "var(--fg)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{ flex: "1 1 240px", fontSize: 13.5 }}>
            {t(data.precio_fundador ? "modBetterStandardFounder" : "modBetterStandard", { total: money(monto), std: money(precioEstandar!) })}
          </span>
          {puede && (
            <button type="button" style={btn(S.btnPrimary)} onClick={onElegirEstandar}>
              {t("modSeeStandard")}
            </button>
          )}
        </div>
      )}

      {!puede && <p style={{ margin: "10px 0 0", ...notaCss }}>{t("modOnlyOwner")}</p>}
      {/* Siempre montado: así el lector de pantalla anuncia el resultado. */}
      <div role="status" aria-live="polite" style={{ marginTop: msg ? 10 : 0, fontSize: 13, fontWeight: 600, color: msg?.ok ? "var(--ok)" : "var(--err)" }}>
        {msg?.text}
      </div>
    </div>
  );
}
