import AdminLayout from "../../components/AdminLayout";
import ConfiguracionEditor from "../../components/ConfiguracionEditor";

export default function Configuracion() {
  return (
    <AdminLayout title="Configuración">
      <div style={{ maxWidth: 780 }}>
        <ConfiguracionEditor />
      </div>
    </AdminLayout>
  );
}
