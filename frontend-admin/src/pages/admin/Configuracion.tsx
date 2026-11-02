import AdminLayout from "../../components/AdminLayout";
import ConfiguracionEditor from "../../components/ConfiguracionEditor";
import { useLang } from "../../lib/i18n";

export default function Configuracion() {
  const { t } = useLang();
  return (
    <AdminLayout title={t("pageConfig")}>
      <div style={{ width: "100%" }}>
        <ConfiguracionEditor />
      </div>
    </AdminLayout>
  );
}
