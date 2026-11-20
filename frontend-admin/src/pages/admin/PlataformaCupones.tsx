import AdminLayout from "../../components/AdminLayout";
import CuponesPanel from "../../components/CuponesPanel";
import { useLang } from "../../lib/i18n";

export default function PlataformaCupones() {
  const { t } = useLang();
  return (
    <AdminLayout title={`${t("navPlataforma")} · ${t("pfNavCupones")}`}>
      <CuponesPanel />
    </AdminLayout>
  );
}
