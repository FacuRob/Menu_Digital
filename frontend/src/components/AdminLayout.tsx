import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV = [
  {
    permiso: "any",
    ruta: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    permiso: "categorias",
    ruta: "/admin/categorias",
    label: "Categorías",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "productos",
    ruta: "/admin/productos",
    label: "Productos",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
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
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
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
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
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
  {
    permiso: "any",
    ruta: "/menu",
    label: "Ver Menú",
    external: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
];

const rolColor: Record<string, string> = {
  superadmin: "#3b82f6",
  editor: "#8b5cf6",
  visor: "#6b7280",
};

export default function AdminLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasPermiso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const visible = NAV.filter(
    (n) => n.permiso === "any" || hasPermiso(n.permiso),
  );
  const isActive = (ruta: string) => location.pathname === ruta;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0f1117",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: collapsed ? 56 : 220,
          transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
          background: "#13151c",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: collapsed ? "18px 0" : "18px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg,#3b82f6,#6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            🍽️
          </div>
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  color: "#f1f5f9",
                  fontWeight: 600,
                  fontSize: 13,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                Menú Digital
              </div>
              <div
                style={{ color: "#475569", fontSize: 11, whiteSpace: "nowrap" }}
              >
                Panel Admin
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
          }}
        >
          {visible.map((item) => {
            const active = isActive(item.ruta);
            return (
              <button
                key={item.ruta}
                onClick={() => navigate(item.ruta)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: collapsed ? "9px 0" : "9px 11px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  background: active ? "rgba(59,130,246,0.15)" : "transparent",
                  color: active ? "#60a5fa" : "#94a3b8",
                  fontSize: 13,
                  fontWeight: active ? 500 : 400,
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.color =
                    "#e2e8f0";
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color =
                      "#94a3b8";
                  }
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "20%",
                      height: "60%",
                      width: 3,
                      borderRadius: "0 3px 3px 0",
                      background: "#3b82f6",
                    }}
                  />
                )}
                <span style={{ color: active ? "#60a5fa" : "inherit" }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.label}
                  </span>
                )}
                {!collapsed && item.external && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{
                      width: 11,
                      height: 11,
                      marginLeft: "auto",
                      opacity: 0.35,
                      flexShrink: 0,
                    }}
                  >
                    <path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </nav>

        {/* User + logout */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {!collapsed && user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: `${rolColor[user.rol] || "#3b82f6"}22`,
                  border: `1.5px solid ${rolColor[user.rol] || "#3b82f6"}55`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: rolColor[user.rol] || "#3b82f6",
                  fontWeight: 600,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {(user.nombre || user.username || "?")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div
                  style={{
                    color: "#e2e8f0",
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.nombre || user.username}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: rolColor[user.rol] || "#3b82f6",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginTop: 1,
                  }}
                >
                  {user.rol}
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: collapsed ? "9px 0" : "9px 11px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "#64748b",
              fontSize: 13,
              width: "100%",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(239,68,68,0.1)";
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
            }}
            title={collapsed ? "Cerrar sesión" : undefined}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              style={{ width: 18, height: 18, flexShrink: 0 }}
            >
              <path
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {!collapsed && "Cerrar Sesión"}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: 52,
            background: "#13151c",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 20px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#475569",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#94a3b8")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#475569")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              style={{ width: 18, height: 18 }}
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          <h1
            style={{
              color: "#f1f5f9",
              fontSize: 15,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {title}
          </h1>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#334155",
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10b981",
              }}
            />
            En línea
          </div>
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
            background: "#0f1117",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
