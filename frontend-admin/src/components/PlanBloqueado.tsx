import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { useStyles } from "./sharedStyles";
import { useAuth } from "../context/AuthContext";
import { useNegocio } from "../context/NegocioContext";
import { useLang } from "../lib/i18n";
import { suscripcionService, type CodigoModulo } from "../services/api";

// Precios de respaldo (mismos que backend/src/utils/planPrecios.js) mientras
// llega el catálogo.
const RESPALDO = { basic: 22000, standard: 44000, whatsapp: 12000, ia: 11000, mapa: 6000, pagaConMP: false };
type Precios = typeof RESPALDO;
let cache: Promise<Precios> | null = null;

// Precio del Estándar y de cada módulo, del catálogo del backend (una vez).
export function usePreciosPlanes(activo = true): Precios {
  const [p, setP] = useState<Precios>(RESPALDO);
  useEffect(() => {
    if (!activo) return;
    cache ??= suscripcionService
      .get()
      .then((d) => {
        const out = { ...RESPALDO };
        for (const code of ["basic", "standard"] as const) {
          const v = d.planes?.find((x) => x.code === code)?.precio_mensual;
          if (v) out[code] = v;
        }
        for (const m of d.modulos ?? []) out[m.codigo] = m.precio_mensual;
        // Lo que paga hoy por su Básico (el precio de fundador, si lo tiene).
        if (d.tipo_plan === "basic" && d.precio_plan) out.basic = d.precio_plan;
        out.pagaConMP = d.monto_proximo_cobro != null;
        return out;
      })
      .catch(() => {
        cache = null;
        return RESPALDO;
      });
    let vivo = true;
    cache.then((v) => vivo && setP(v));
    return () => {
      vivo = false;
    };
  }, [activo]);
  return p;
}

const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// Oferta para sumar un módulo o pasar al Estándar (en lugar de un candado).
export function OfertaModulo({ modulo, compacta = false }: { modulo: CodigoModulo; compacta?: boolean }) {
  const { t } = useLang();
  const { hasPermiso } = useAuth();
  const S = useStyles();
  const precios = usePreciosPlanes();
  const puede = hasPermiso("suscripcion");
  const precioMod = precios[modulo];
  // Lo que pagaría con el Básico y este módulo. La IA pide WhatsApp, así que
  // su total incluye los dos.
  const conModulo = precios.basic + precioMod + (modulo === "ia" ? precios.whatsapp : 0);
  const diferencia = precios.standard - conModulo;

  return (
    <div style={{ ...S.card, maxWidth: compacta ? undefined : 620, margin: compacta ? 0 : "24px auto", padding: compacta ? "20px" : "28px 24px" }}>
      <h2 style={{ fontSize: compacta ? 17 : 20, fontWeight: 700, margin: "0 0 8px", color: "var(--fg)" }}>{t(`offer_${modulo}_title`)}</h2>
      <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{t(`offer_${modulo}_desc`)}</p>
      {!puede ? (
        <p style={{ color: "var(--fg-2)", fontSize: 14, margin: "14px 0 0" }}>{t("offerAskOwner")}</p>
      ) : (
        <>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", marginTop: 18 }}>
            <Link
              to={`/admin/suscripcion?modulo=${modulo}`}
              style={{ display: "block", padding: "16px 18px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--fg)", textDecoration: "none" }}
            >
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{t(`offer_${modulo}_add`, { precio: pesos(precioMod) })}</span>
              <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "var(--fg-2)" }}>{t("offerAddSub")}</span>
            </Link>
            <Link
              to="/admin/suscripcion"
              style={{ display: "block", padding: "16px 18px", borderRadius: 12, border: "1.5px solid var(--accent)", background: "color-mix(in srgb, var(--accent) 10%, var(--surface))", color: "var(--fg)", textDecoration: "none" }}
            >
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{t("offerStandard", { precio: pesos(precios.standard) })}</span>
              <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "var(--fg-2)" }}>{t("offerStandardSub")}</span>
            </Link>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--fg-2)" }}>
            {diferencia > 0
              ? t("offerDiff", { dif: pesos(diferencia), total: pesos(conModulo) })
              : t("offerCheaper", { total: pesos(conModulo) })}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--fg-2)" }}>{t(precios.pagaConMP ? "offerFoot" : "offerFootNew")}</p>
        </>
      )}
    </div>
  );
}

// Pantallas de WhatsApp (avisos, chats, IA): sin WhatsApp (Básico sin el
// módulo) muestra la oferta en vez del contenido. Mientras no se sabe el
// plan (null), muestra la pantalla normal: el backend igual la corta.
export default function SoloConWhatsapp({ tituloKey, children }: { tituloKey: string; children: ReactNode }) {
  const { conWhatsapp } = useNegocio();
  const { t } = useLang();
  if (conWhatsapp !== false) return <>{children}</>;
  return (
    <AdminLayout title={t(tituloKey)}>
      <OfertaModulo modulo="whatsapp" />
    </AdminLayout>
  );
}
