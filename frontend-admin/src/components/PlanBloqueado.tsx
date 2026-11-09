import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "./AdminLayout";
import { useStyles } from "./sharedStyles";
import { useAuth } from "../context/AuthContext";
import { useNegocio } from "../context/NegocioContext";
import { useLang } from "../lib/i18n";

// Pantallas de WhatsApp (avisos, chats, IA): con plan Básico muestra un aviso
// para mejorar el plan en vez del contenido. Mientras no se sabe el plan
// (null), muestra la pantalla normal: el backend igual la corta.
export default function SoloConWhatsapp({ tituloKey, children }: { tituloKey: string; children: ReactNode }) {
  const { conWhatsapp } = useNegocio();
  const { hasPermiso } = useAuth();
  const { t } = useLang();
  const S = useStyles();
  if (conWhatsapp !== false) return <>{children}</>;
  return (
    <AdminLayout title={t(tituloKey)}>
      <div style={{ ...S.card, maxWidth: 560, margin: "24px auto", padding: "28px 24px", textAlign: "center" }}>
        <span className="sh-badge is-plan" style={{ marginLeft: 0 }} aria-hidden>
          {t("planTagStandard")}
        </span>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "14px 0 8px", color: "var(--fg)" }}>{t("planLockedTitle")}</h2>
        <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{t("planLockedDesc")}</p>
        {!hasPermiso("suscripcion") && (
          <p style={{ color: "var(--fg-2)", fontSize: 14, margin: "14px 0 0" }}>{t("planLockedAskOwner")}</p>
        )}
        {hasPermiso("suscripcion") && (
          <Link
            to="/admin/suscripcion"
            style={{ ...S.btnPrimary, display: "inline-flex", marginTop: 20, padding: "11px 18px", textDecoration: "none" }}
          >
            {t("planLockedCta")}
          </Link>
        )}
      </div>
    </AdminLayout>
  );
}
