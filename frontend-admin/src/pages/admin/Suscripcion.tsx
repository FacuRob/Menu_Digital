import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import ModulosSuscripcion from "../../components/ModulosSuscripcion";
import { useStyles } from "../../components/sharedStyles";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useLang, LOCALE } from "../../lib/i18n";
import { IconAlert } from "../../lib/icons";
import { useIsMobile } from "../../lib/useIsMobile";
import {
  suscripcionService,
  getApiErrorMessage,
  type SuscripcionEstado,
  type PlanCatalogo,
  type CodigoModulo,
} from "../../services/api";

const CODIGOS: CodigoModulo[] = ["whatsapp", "ia", "mapa"];

// ?modulo=ia → ["ia", "whatsapp"] (la IA pide WhatsApp).
const modulosDeUrl = (v: string | null): CodigoModulo[] => {
  const c = CODIGOS.find((x) => x === v);
  if (!c) return [];
  return c === "ia" ? ["ia", "whatsapp"] : [c];
};

// Estados → color + clave de traducción de la etiqueta.
const ESTADO_INFO: Record<
  string,
  { key: string; color: string; bg: string }
> = {
  trial: { key: "subStatusTrial", color: "var(--info)", bg: "var(--info-bg)" },
  activo: { key: "subStatusActive", color: "var(--ok)", bg: "var(--ok-bg)" },
  cancelado: { key: "subStatusCancelled", color: "var(--warn)", bg: "var(--warn-bg)" },
  vencido: { key: "subStatusExpired", color: "var(--err)", bg: "var(--err-bg)" },
};

// Beneficios por plan (claves de traducción). "Todo lo del plan anterior" va
// primero; después, los límites del backend y lo que suma cada plan.
const PERKS: Record<string, { incluye?: string; extras: string[] }> = {
  basic: { extras: ["subPerkQr", "subPerkVariantes", "subPerkCustom", "subPerkAnalytics"] },
  standard: {
    incluye: "subPerkAllBasic",
    extras: ["subPerkStock", "subPerkWhatsapp", "subPerkIA", "subPerkTracking"],
  },
  premium: { incluye: "subPerkAllStandard", extras: [] },
};

// Catálogo de respaldo (mismos precios que backend/src/utils/planPrecios.js).
const FALLBACK_PLANES: PlanCatalogo[] = [
  { code: "basic", precio_mensual: 22000, limites: { negocios: 1, productos: 50 } },
  { code: "standard", precio_mensual: 44000, limites: { negocios: 3, productos: 180 } },
  { code: "premium", precio_mensual: 72000, limites: { negocios: 5, productos: 1000 } },
];

export default function Suscripcion() {
  const S = useStyles();
  const { isDark } = useTheme();
  const isMobile = useIsMobile();
  const { t, lang } = useLang();
  const [data, setData] = useState<SuscripcionEstado | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState<string>("");
  const [mpEmail, setMpEmail] = useState("");
  const [cupon, setCupon] = useState("");
  const [canjeando, setCanjeando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const { hasPermiso } = useAuth();
  const [cuponMsg, setCuponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // ?modulo=whatsapp: viene de la pantalla de WhatsApp (o Chats, Pedidos).
  const [params] = useSearchParams();
  const moduloPedido = CODIGOS.find((c) => c === params.get("modulo")) ?? null;
  // Módulos elegidos para sumar al Básico al pagarlo.
  const [modsCheckout, setModsCheckout] = useState<CodigoModulo[]>(() => modulosDeUrl(params.get("modulo")));

  const canjear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cupon.trim()) return;
    setCanjeando(true);
    setCuponMsg(null);
    try {
      const r = await suscripcionService.canjearCupon(cupon);
      setCuponMsg({
        ok: true,
        text: t(r.meses === 1 ? "subCouponApplied1" : "subCouponApplied", { pct: r.porcentaje, n: r.meses }),
      });
      setCupon("");
      setData(await suscripcionService.get());
    } catch (err) {
      setCuponMsg({ ok: false, text: getApiErrorMessage(err, t("subCouponError")) });
    } finally {
      setCanjeando(false);
    }
  };

  const textPrimary = "var(--fg)";
  const textMuted = "var(--fg-3)";
  const cardBg = "var(--surface)";
  const border = "var(--line)";
  const locale = LOCALE[lang] || "es-AR";

  useEffect(() => {
    (async () => {
      try {
        const d = await suscripcionService.get();
        setData(d);
        setMpEmail(d.mp_email || "");
      } catch (e) {
        setError(getApiErrorMessage(e, t("subLoadError")));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: data?.moneda ?? "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  const fmtFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(locale, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "—";

  const planNombre = (code: string) =>
    ({
      free: t("subPlanFree"),
      basic: t("subPlanBasic"),
      standard: t("subPlanStandard"),
      premium: t("subPlanPremium"),
    })[code] ?? code;

  const irACheckout = async (plan: PlanCatalogo["code"]) => {
    const email = mpEmail.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("subMpEmailInvalid"));
      document.getElementById("mp-email")?.focus();
      return;
    }
    try {
      setError("");
      setRedirecting(plan);
      const { url } = await suscripcionService.checkout(plan, email || undefined, plan === "basic" ? modsCheckout : []);
      window.location.assign(url);
    } catch (e) {
      setError(getApiErrorMessage(e, t("subCheckoutError")));
      setRedirecting("");
      // El aviso está arriba de todo: sin esto, el botón parece no hacer nada.
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const cancelarSuscripcion = async () => {
    try {
      setError("");
      setCancelando(true);
      const r = await suscripcionService.cancelar();
      setData((d) => (d ? { ...d, estado_suscripcion: r.estado_suscripcion, periodo_fin: r.periodo_fin } : d));
      setConfirmando(false);
    } catch (e) {
      setError(getApiErrorMessage(e, t("subCancelError")));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setCancelando(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title={t("navSuscripcion")}>
        <p style={{ color: textMuted }}>{t("subLoading")}</p>
      </AdminLayout>
    );
  }

  const estado = data?.estado_suscripcion || "trial";
  // Prueba o período vencido (aunque la BD todavía diga "trial") → se muestra como vencido.
  const info = data && !data.vigente ? ESTADO_INFO.vencido : ESTADO_INFO[estado] || ESTADO_INFO.trial;
  const dias = data?.dias_restantes ?? null;
  const esFree = data?.tipo_plan === "free" || estado === "trial";
  // Paga hoy por Mercado Pago: los módulos se suman o quitan desde acá.
  const pagaConMP = !!data && !data.es_plataforma && estado === "activo" && data.monto_proximo_cobro != null;
  const catalogoMods = data?.modulos ?? [];
  const precioDe = (code: string) => (data?.planes ?? FALLBACK_PLANES).find((p) => p.code === code);
  // Elegir el Básico con módulos al pagar (si ya paga el Básico, se suman en "Lo que pagás por mes").
  const basicoSumable = catalogoMods.length > 0 && !(data?.tipo_plan === "basic" && pagaConMP) && !data?.es_plataforma;
  const basico = precioDe("basic");
  const totalBasico =
    (basico ? (basico.precio_con_descuento ?? basico.precio_mensual) : 0) +
    catalogoMods.filter((m) => modsCheckout.includes(m.codigo)).reduce((t_, m) => t_ + m.precio_mensual, 0);
  // Estándar en la misma base que lo que paga (con el cupón, si lo hay).
  const std = precioDe("standard");
  const precioStd = std ? (std.precio_con_descuento ?? std.precio_mensual) : null;
  const toggleMod = (c: CodigoModulo) =>
    setModsCheckout((prev) => {
      if (prev.includes(c)) {
        // Sin WhatsApp no hay IA.
        return prev.filter((x) => x !== c && !(c === "whatsapp" && x === "ia"));
      }
      return c === "ia" && !prev.includes("whatsapp") ? [...prev, "ia", "whatsapp"] : [...prev, c];
    });

  return (
    <AdminLayout title={t("navSuscripcion")}>
      <div style={{ width: "100%" }}>
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              background: "var(--err-bg)",
              color: "var(--err)",
              border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
            }}
          >
            <IconAlert size={15} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        {/* ── Aviso de bloqueo: prueba terminada o suscripción vencida ── */}
        {data && !data.es_plataforma && !data.vigente && (
          <div
            role="alert"
            style={{
              marginBottom: 18,
              padding: "16px 18px",
              borderRadius: 12,
              background: "var(--err-bg)",
              border: "1px solid color-mix(in srgb, var(--err) 30%, transparent)",
              color: "var(--err)",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <IconAlert size={20} style={{ flexShrink: 0, marginTop: 1 }} />
            {esFree ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{t("subTrialEndedTitle")}</div>
                <p style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.5 }}>
                  {t("subTrialEndedBody", { n: data.trial_dias })}
                </p>
              </div>
            ) : (
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t("subBlocked")}</div>
            )}
          </div>
        )}

        {/* ── Estado actual ── */}
        {data && !data.es_plataforma && (
          <div
            style={{
              ...S.card,
              padding: 22,
              marginBottom: 18,
              display: "grid",
              gap: 20,
              gridTemplateColumns: isMobile ? "1fr" : "minmax(260px,1fr) auto",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: textPrimary }}>
                  {t("subPlanHeading", { plan: planNombre(data.tipo_plan) })}
                </h2>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    color: info.color,
                    background: info.bg,
                  }}
                >
                  {t(info.key)}
                </span>
                {data.descuento && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 999,
                      color: "var(--ok)",
                      background: "var(--ok-bg)",
                    }}
                  >
                    {t(data.descuento.meses_restantes === 1 ? "subCouponActive1" : "subCouponActive", {
                      pct: data.descuento.porcentaje,
                      n: data.descuento.meses_restantes,
                    })}
                  </span>
                )}
              </div>

              {/* Timeline de días restantes (trial / Free y cancelado) */}
              {data.periodo_fin && estado !== "activo" && (
                <div style={{ marginTop: 16 }}>
                  {esFree && (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: textPrimary, marginBottom: 8 }}>
                      {dias && dias > 0 ? (
                        <span>
                          {t(dias === 1 ? "subFreeRemaining1" : "subFreeRemaining", { n: dias })}
                        </span>
                      ) : (
                        t("subFreeEnded")
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12.5,
                      color: textMuted,
                      marginBottom: 6,
                    }}
                  >
                    <span>
                      {dias === 0
                        ? !data.vigente
                          ? t("subExpiredShort")
                          : t("subDueToday")
                        : t(dias === 1 ? "subDayLeft" : "subDaysLeft", { n: dias ?? 0 })}
                    </span>
                    <span>{t("subDueOn", { date: fmtFecha(data.periodo_fin) })}</span>
                  </div>
                  <TimelineBar
                    diasRestantes={dias ?? 0}
                    total={estado === "trial" ? data.trial_dias : 30}
                    color={info.color}
                    track={"var(--surface-3)"}
                  />
                </div>
              )}
              {estado === "activo" && (
                <p style={{ margin: "12px 0 0", fontSize: 13.5, color: textMuted }}>
                  {data.periodo_fin
                    ? t("subActiveNext", { date: fmtFecha(data.periodo_fin) })
                    : t("subActive")}
                </p>
              )}

              {data.tipo_plan !== "free" && (
                <a
                  href={data.portal_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...S.btnGhost, marginTop: 16, textDecoration: "none", display: "inline-flex" }}
                >
                  {t("subManageMp")}
                </a>
              )}

              {/* Cancelar: la baja la pide DinexFlow a Mercado Pago, así funciona
                  aunque el cliente haya pagado sin cuenta de Mercado Pago. */}
              {data.tipo_plan !== "free" && estado === "activo" && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                    border: `1px solid ${border}`,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: textPrimary, marginBottom: 6 }}>
                    {t("subCancelTitle")}
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: textMuted }}>
                    {data.periodo_fin
                      ? t("subCancelBody", { date: fmtFecha(data.periodo_fin) })
                      : t("subCancelBodyNoDate")}
                  </p>
                  {!hasPermiso("suscripcion") ? (
                    <p style={{ margin: 0, fontSize: 12.5, color: textMuted }}>{t("subCancelOnlyOwner")}</p>
                  ) : confirmando ? (
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary, flexBasis: "100%" }}>
                        {t("subCancelConfirm")}
                      </span>
                      <button
                        type="button"
                        onClick={cancelarSuscripcion}
                        disabled={cancelando}
                        style={{ ...S.btnPrimary, background: "var(--err)", borderColor: "var(--err)" }}
                      >
                        {cancelando ? t("subCancelling") : t("subCancelYes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(false)}
                        disabled={cancelando}
                        style={S.btnGhost}
                      >
                        {t("subCancelNo")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(true)}
                      style={{ ...S.btnGhost, color: "var(--err)" }}
                    >
                      {t("subCancelBtn")}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Calendario del mes de vencimiento */}
            {data.periodo_fin && (
              <MiniCalendario
                fin={data.periodo_fin}
                locale={locale}
                isDark={isDark}
                accent={info.color}
                border={border}
                textPrimary={textPrimary}
                textMuted={textMuted}
                cardBg={cardBg}
                dueLabel={t("subDueLabel")}
                todayLabel={t("subTodayLabel")}
              />
            )}
          </div>
        )}

        {/* ── Lo que pagás por mes: plan + módulos ── */}
        {data && pagaConMP && catalogoMods.length > 0 && (
          <ModulosSuscripcion
            data={data}
            onCambio={(d) => setData((prev) => (prev ? { ...prev, ...d } : prev))}
            money={money}
            fmtFecha={fmtFecha}
            planNombre={planNombre}
            precioEstandar={precioStd}
            onElegirEstandar={() => irACheckout("standard")}
            abrir={moduloPedido}
          />
        )}

        {data?.es_plataforma && (
          <div style={{ ...S.card, padding: 22, marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textPrimary }}>
              {t("subPlatformTitle")}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: textMuted }}>
              {t("subPlatformDesc")}
            </p>
          </div>
        )}

        {/* ── Cupón de descuento ── */}
        {data && !data.es_plataforma && !data.descuento && (
          <form onSubmit={canjear} style={{ ...S.card, padding: 18, marginBottom: 18 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: textPrimary }}>{t("subCouponTitle")}</div>
            <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: textMuted }}>{t("subCouponHint")}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label htmlFor="cupon" className="sr-only">
                {t("subCouponLabel")}
              </label>
              <input
                id="cupon"
                value={cupon}
                onChange={(e) => setCupon(e.target.value.toUpperCase())}
                placeholder="DINEX-XXXXXXXX"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: "1 1 220px",
                  minHeight: 42,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  background: cardBg,
                  color: textPrimary,
                  fontSize: 14,
                  fontFamily: "ui-monospace, monospace",
                  letterSpacing: "0.04em",
                }}
              />
              <button
                type="submit"
                disabled={canjeando || !cupon.trim()}
                style={{ ...S.btnPrimary, minHeight: 42, opacity: canjeando || !cupon.trim() ? 0.6 : 1 }}
              >
                {canjeando ? t("subCouponApplying") : t("subCouponApply")}
              </button>
            </div>
            {cuponMsg && (
              <div
                role={cuponMsg.ok ? "status" : "alert"}
                style={{ marginTop: 10, fontSize: 13, color: cuponMsg.ok ? "var(--ok)" : "var(--err)" }}
              >
                {cuponMsg.text}
              </div>
            )}
          </form>
        )}
        {cuponMsg?.ok && data?.descuento && (
          <div role="status" style={{ marginBottom: 18, fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>
            {cuponMsg.text}
          </div>
        )}

        {/* ── Planes ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline", justifyContent: "space-between", margin: "6px 2px 14px" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
            {data?.vigente ? t("subChangePlan") : t("subChoosePlan")}
          </h3>
          <span style={{ fontSize: 12.5, color: textMuted }}>{t("subPayNote")}</span>
        </div>

        {/* Email de la cuenta de Mercado Pago con la que se paga */}
        {data && !data.es_plataforma && (
          <div style={{ ...S.card, padding: 16, marginBottom: 14 }}>
            <label htmlFor="mp-email" style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: textPrimary }}>
              {t("subMpEmailLabel")}
            </label>
            <p id="mp-email-hint" style={{ margin: "3px 0 10px", fontSize: 12.5, color: textMuted }}>
              {t("subMpEmailHint")}
            </p>
            <input
              id="mp-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-describedby="mp-email-hint"
              value={mpEmail}
              onChange={(e) => setMpEmail(e.target.value)}
              placeholder="tu-email@mercadopago.com"
              style={{
                width: "100%",
                maxWidth: 420,
                minHeight: 42,
                padding: "8px 12px",
                borderRadius: 8,
                border: `1px solid ${border}`,
                background: cardBg,
                color: textPrimary,
                fontSize: 14,
              }}
            />
          </div>
        )}

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          }}
        >
          {(data?.planes ?? FALLBACK_PLANES).map((p) => {
            const esActual = data?.tipo_plan === p.code;
            const destacado = p.code === "standard";
            // Básico: se le pueden sumar módulos al pagarlo (si ya lo paga, se
            // suman desde "Lo que pagás por mes").
            const conMods = p.code === "basic" && !(esActual && pagaConMP) && catalogoMods.length > 0;
            const sumaMods = conMods
              ? catalogoMods.filter((m) => modsCheckout.includes(m.codigo)).reduce((t_, m) => t_ + m.precio_mensual, 0)
              : 0;
            const totalCard = (p.precio_con_descuento ?? p.precio_mensual) + sumaMods;
            const bizFeature =
              p.limites.negocios >= 9999
                ? t("subUnlimBiz")
                : t(p.limites.negocios === 1 ? "subOneBiz" : "subUpToBiz", { n: p.limites.negocios });
            // Productos: el total del plan, repartido entre los negocios.
            const prodFeature =
              p.limites.productos >= 9999
                ? t("subUnlimProds")
                : p.limites.negocios === 1
                  ? t("subUpToProds", { n: p.limites.productos })
                  : t("subProdsShared", {
                      total: p.limites.productos.toLocaleString("es-AR"),
                      per: Math.floor(p.limites.productos / p.limites.negocios),
                      n: p.limites.negocios,
                    });
            return (
              <div
                key={p.code}
                style={{
                  ...S.card,
                  padding: 20,
                  border: `1.5px solid ${destacado ? "var(--info)" : border}`,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {destacado && (
                  <span
                    style={{
                      position: "absolute",
                      top: -10,
                      left: 16,
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "var(--on-accent)",
                      background: "var(--accent)",
                      padding: "2px 10px",
                      borderRadius: 999,
                    }}
                  >
                    {t("subRecommended")}
                  </span>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
                  {planNombre(p.code)}
                </div>
                {p.precio_con_descuento != null && (
                  <s style={{ display: "block", marginTop: 8, fontSize: 13, color: textMuted }}>
                    {money(p.precio_mensual)}
                  </s>
                )}
                <div style={{ margin: p.precio_con_descuento != null ? "0 0 2px" : "8px 0 2px", display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: p.precio_con_descuento != null ? "var(--ok)" : textPrimary }}>
                    {money(p.precio_con_descuento ?? p.precio_mensual)}
                  </span>
                  <span style={{ fontSize: 12.5, color: textMuted }}>/{t("subPerMonth")}</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 18px", display: "grid", gap: 8, flex: 1, alignContent: "start" }}>
                  {[
                    ...(PERKS[p.code]?.incluye ? [t(PERKS[p.code].incluye!)] : []),
                    bizFeature,
                    prodFeature,
                    ...(PERKS[p.code]?.extras || []).map((k) => t(k)),
                  ].map((f, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, color: textMuted }}>
                      <span style={{ color: "var(--ok)", fontWeight: 800 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Módulos: en el Básico se suman (abajo); en los otros vienen incluidos. */}
                {catalogoMods.length > 0 && (
                  <div style={{ borderTop: `1px solid ${border}`, padding: "12px 0 0", margin: "0 0 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: textMuted }}>
                      {t(p.code === "basic" ? "modAddToBasic" : "modIncludedTitle")}
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {catalogoMods.map((m) => {
                        const incluido = m.incluido_en.includes(p.code);
                        const elegido = conMods && modsCheckout.includes(m.codigo);
                        return (
                          <li
                            key={m.codigo}
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              padding: "4px 10px",
                              borderRadius: 999,
                              border: `1px solid ${elegido ? "var(--accent)" : border}`,
                              background: elegido ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--surface-2)",
                              color: incluido ? "var(--ok)" : textPrimary,
                            }}
                          >
                            {incluido || elegido ? "✓ " : `+${money(m.precio_mensual)} `}
                            {m.nombre}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => irACheckout(p.code)}
                  disabled={esActual || redirecting === p.code}
                  style={{
                    ...(destacado ? S.btnPrimary : S.btnGhost),
                    width: "100%",
                    justifyContent: "center",
                    opacity: esActual ? 0.5 : redirecting === p.code ? 0.7 : 1,
                    cursor: esActual ? "default" : "pointer",
                  }}
                >
                  {esActual
                    ? t("subCurrentPlan")
                    : redirecting === p.code
                      ? t("subOpening")
                      : sumaMods > 0
                        ? t("modChooseWithTotal", { total: money(totalCard) })
                        : t("subChoose")}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Módulos para sumar al Básico (tarjetas, como en Fudo) ── */}
        {basicoSumable && (
          <section aria-labelledby="mods-titulo" style={{ marginTop: 28 }}>
            <div style={{ margin: "0 2px 14px" }}>
              <h3 id="mods-titulo" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: textPrimary }}>
                {t("modSectionTitle")}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fg-2)" }}>{t("modSectionHint")}</p>
            </div>
            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
              {catalogoMods.map((m) => {
                const elegido = modsCheckout.includes(m.codigo);
                const req = m.requiere ? catalogoMods.find((x) => x.codigo === m.requiere) : null;
                return (
                  <div
                    key={m.codigo}
                    style={{
                      ...S.card,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      border: `1.5px solid ${elegido ? "var(--accent)" : border}`,
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>{m.nombre}</div>
                    <div style={{ margin: "8px 0 2px", display: "flex", alignItems: "baseline", gap: 5 }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: textPrimary }}>+{money(m.precio_mensual)}</span>
                      <span style={{ fontSize: 12.5, color: textMuted }}>/{t("subPerMonth")}</span>
                    </div>
                    <p style={{ margin: "8px 0 12px", fontSize: 13, lineHeight: 1.55, color: "var(--fg-2)", flex: 1 }}>
                      {t(`modDesc_${m.codigo}`)}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "var(--ok-bg)", color: "var(--ok)" }}>
                        {t("modIncludedStdPrem")}
                      </span>
                      {req && (
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "var(--info-bg)", color: "var(--info)" }}>
                          {t("modNeeds", { modulo: req.nombre })}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => toggleMod(m.codigo)}
                      style={{ ...(elegido ? S.btnPrimary : S.btnGhost), width: "100%", justifyContent: "center", minHeight: 44 }}
                    >
                      {elegido ? t("modPicked") : t("modPick")}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Resumen: Básico + lo elegido */}
            <div
              role="status"
              aria-live="polite"
              style={{ ...S.card, marginTop: 14, padding: "16px 20px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 18px" }}
            >
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: textPrimary }}>
                  {t("modSummary", { total: money(totalBasico) })}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--fg-2)" }}>{t("modCardWhen")}</p>
                {precioStd != null && totalBasico > precioStd && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--info)", fontWeight: 600 }}>
                    {t("modBetterStandardShort", { std: money(precioStd) })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => irACheckout("basic")}
                disabled={redirecting === "basic"}
                style={{ ...S.btnGhost, minHeight: 44 }}
              >
                {redirecting === "basic" ? t("subOpening") : t("modChooseWithTotal", { total: money(totalBasico) })}
              </button>
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}

// ── Barra de progreso del período ──
function TimelineBar({
  diasRestantes,
  total,
  color,
  track,
}: {
  diasRestantes: number;
  total: number;
  color: string;
  track: string;
}) {
  const pct = Math.max(0, Math.min(100, (diasRestantes / Math.max(1, total)) * 100));
  return (
    <div style={{ height: 10, borderRadius: 999, background: track, overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 999,
          background: color,
          transition: "width .3s",
        }}
      />
    </div>
  );
}

// ── Calendario mensual que resalta hoy y la fecha de vencimiento ──
function MiniCalendario({
  fin,
  locale,
  isDark,
  accent,
  border,
  textPrimary,
  textMuted,
  cardBg,
  dueLabel,
  todayLabel,
}: {
  fin: string;
  locale: string;
  isDark: boolean;
  accent: string;
  border: string;
  textPrimary: string;
  textMuted: string;
  cardBg: string;
  dueLabel: string;
  todayLabel: string;
}) {
  const finDate = useMemo(() => new Date(fin), [fin]);
  const year = finDate.getFullYear();
  const month = finDate.getMonth();
  const hoy = new Date();

  // Encabezado de días (Lun..Dom) localizado. 1/1/2024 fue lunes.
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" }),
      ),
    [locale],
  );
  const titulo = useMemo(
    () => finDate.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    [finDate, locale],
  );

  const primerDia = new Date(year, month, 1);
  const offset = (primerDia.getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ];

  const esHoy = (d: number) =>
    d === hoy.getDate() && month === hoy.getMonth() && year === hoy.getFullYear();
  const esFin = (d: number) => d === finDate.getDate();

  return (
    <div
      style={{
        width: 232,
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: textPrimary, marginBottom: 8, textTransform: "capitalize" }}>
        {titulo}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {weekdays.map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: textMuted, padding: "2px 0", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const fin_ = esFin(d);
          const hoy_ = esHoy(d);
          return (
            <div
              key={i}
              title={fin_ ? dueLabel : hoy_ ? todayLabel : undefined}
              style={{
                textAlign: "center",
                fontSize: 11.5,
                padding: "5px 0",
                borderRadius: 7,
                fontWeight: fin_ || hoy_ ? 700 : 400,
                color: fin_ ? "var(--surface)" : hoy_ ? accent : textPrimary,
                background: fin_
                  ? accent
                  : hoy_
                    ? isDark
                      ? "var(--line)"
                      : "var(--line)"
                    : "transparent",
                border: hoy_ && !fin_ ? `1px solid ${accent}` : "1px solid transparent",
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
