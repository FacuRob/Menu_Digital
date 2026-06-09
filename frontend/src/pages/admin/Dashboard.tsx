import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../components/AdminLayout";

const CARDS = [
  {
    permiso: "categorias",
    ruta: "/admin/categorias",
    label: "Categorías",
    desc: "Organizá las secciones del menú",
    accent: "#3b82f6",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "productos",
    ruta: "/admin/productos",
    label: "Productos",
    desc: "Administrá los ítems del menú",
    accent: "#8b5cf6",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
        <path
          d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    permiso: "qr",
    ruta: "/admin/qr",
    label: "Código QR",
    desc: "Generá el QR para tus mesas",
    accent: "#06b6d4",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="15" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="15" width="6" height="6" rx="1" />
        <path
          d="M15 15h.01M15 18h3M18 15v3M21 15h.01M21 21h.01"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    permiso: "*",
    ruta: "/admin/usuarios",
    label: "Usuarios",
    desc: "Roles y permisos del sistema",
    accent: "#f59e0b",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ width: 22, height: 22 }}
      >
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path
          d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const arrowIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    style={{ width: 14, height: 14 }}
  >
    <path
      d="M5 12h14M12 5l7 7-7 7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Dashboard() {
  const { hasPermiso, user } = useAuth();
  const navigate = useNavigate();
  const visible = CARDS.filter((c) => hasPermiso(c.permiso));

  return (
    <AdminLayout title="Dashboard">
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>
          {new Date().toLocaleDateString("es-AR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </div>
        <h2
          style={{ color: "#f1f5f9", fontSize: 22, fontWeight: 600, margin: 0 }}
        >
          Hola, {user?.nombre || user?.username} 👋
        </h2>
        <p style={{ color: "#475569", fontSize: 13, margin: "4px 0 0" }}>
          Bienvenido al panel de administración
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {visible.map((card) => (
          <button
            key={card.ruta}
            onClick={() => navigate(card.ruta)}
            style={{
              background: "#1a1d27",
              border: `1px solid rgba(255,255,255,0.07)`,
              borderRadius: 14,
              padding: "20px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = `${card.accent}55`;
              b.style.transform = "translateY(-2px)";
              b.style.boxShadow = `0 8px 30px ${card.accent}18`;
            }}
            onMouseLeave={(e) => {
              const b = e.currentTarget as HTMLButtonElement;
              b.style.borderColor = "rgba(255,255,255,0.07)";
              b.style.transform = "translateY(0)";
              b.style.boxShadow = "none";
            }}
          >
            {/* Accent dot top right */}
            <div
              style={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: `${card.accent}15`,
                pointerEvents: "none",
              }}
            />

            {/* Icon */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${card.accent}18`,
                border: `1px solid ${card.accent}30`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card.accent,
                marginBottom: 14,
              }}
            >
              {card.icon}
            </div>

            <div
              style={{
                color: "#f1f5f9",
                fontWeight: 600,
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                color: "#475569",
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              {card.desc}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: card.accent,
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Ir a {card.label} {arrowIcon}
            </div>
          </button>
        ))}
      </div>

      {/* Quick tip */}
      <div
        style={{
          marginTop: 24,
          padding: "14px 16px",
          borderRadius: 10,
          background: "rgba(59,130,246,0.07)",
          border: "1px solid rgba(59,130,246,0.15)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ color: "#3b82f6", fontSize: 18 }}>💡</div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          Usá el sidebar para navegar entre secciones. Podés colapsarlo con el
          botón ☰ del topbar.
        </div>
      </div>
    </AdminLayout>
  );
}
