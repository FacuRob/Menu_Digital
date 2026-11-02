import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNegocio } from "../context/NegocioContext";
import { chatsService, pedidosService, productosService } from "../services/api";
import ConfiguracionEditor from "./ConfiguracionEditor";
import { useLang, LangSelector } from "../lib/i18n";
import { BRAND_NAME, BRAND_LOGO, brandTextStyle } from "../lib/brand";
import { IconBell } from "../lib/icons";
import { menuPath } from "../lib/menuUrl";
import { useIsMobile } from "../lib/useIsMobile";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 16, height: 16 }}>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 16, height: 16 }}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} style={{ width: 18, height: 18, flexShrink: 0 }}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NAV = [
  {
    permiso: "any",
    ruta: "/admin/dashboard",
    labelKey: "navDashboard",
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
    labelKey: "navCategorias",
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
    labelKey: "navProductos",
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
    permiso: "pedidos",
    ruta: "/admin/pedidos",
    labelKey: "navPedidos",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path d="M6 2h12l1 4H5l1-4z" strokeLinejoin="round" />
        <path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6" />
        <path d="M9 11h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "pedidos",
    ruta: "/admin/chats",
    labelKey: "navChats",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" strokeLinejoin="round" />
        <path d="M8.5 11h7M8.5 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "configuracion",
    ruta: "/admin/whatsapp",
    labelKey: "navWhatsapp",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path
          d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4l-4.5 1.1z"
          strokeLinejoin="round"
        />
        <path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.9-.3 1.3c-3.6.4-7.7-3.7-7.3-7.3l1.3-.3.9 1.8L9 9.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    permiso: "qr",
    ruta: "/admin/qr",
    labelKey: "navQr",
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
    permiso: "usuarios",
    ruta: "/admin/usuarios",
    labelKey: "navUsuarios",
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
    permiso: "negocios",
    ruta: "/admin/negocios",
    labelKey: "navNegocios",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <path d="M3 21h18" strokeLinecap="round" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    permiso: "suscripcion",
    ruta: "/admin/suscripcion",
    labelKey: "navSuscripcion",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "plataforma",
    ruta: "/admin/plataforma",
    labelKey: "navPlataforma",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        className="w-[18px] h-[18px] flex-shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    permiso: "any",
    ruta: "/menu",
    labelKey: "navVerMenu",
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

// Etiqueta de grupo dentro del panel de Configuración (con color de acento).
const configGroupLabel = (color: string): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 10px 7px",
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color,
});

// Punto de color que precede a cada grupo.
const configDot = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

// Ítem del panel de Configuración. Si `soon` está activo, se muestra
// deshabilitado con un badge "Próximamente" (funcionalidad futura). Los ítems
// accionables muestran una flecha en el color de acento del grupo.
function ConfigSubItem({
  label,
  onClick,
  soon,
  soonLabel,
  accent,
  textColor,
  muted,
  hoverBg,
}: {
  label: string;
  onClick?: () => void;
  soon?: boolean;
  soonLabel?: string;
  accent: string;
  textColor: string;
  muted: string;
  hoverBg: string;
}) {
  return (
    <button
      onClick={soon ? undefined : onClick}
      disabled={soon}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        border: "none",
        width: "100%",
        background: "transparent",
        color: soon ? muted : textColor,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: soon ? "default" : "pointer",
        textAlign: "left",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        if (soon) return;
        (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (soon) return;
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {soon ? (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            padding: "2px 7px",
            borderRadius: 999,
            background: "rgba(245,158,11,0.16)",
            color: "#d97706",
            flexShrink: 0,
          }}
        >
          {soonLabel}
        </span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={13}
          height={13}
          fill="none"
          stroke={accent}
          strokeWidth={2.2}
          style={{ flexShrink: 0 }}
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

const rolColor: Record<string, string> = {
  admin: "#3b82f6", // SuperAdmin (dueño)
  manager: "#0ea5e9", // Admin (2º jefe)
  staff: "#8b5cf6",
  // Legacy (usuarios/tokens sin migrar)
  superadmin: "#3b82f6",
  editor: "#8b5cf6",
  visor: "#6b7280",
};

// Label visible del rol (clave DB → nombre de negocio). El "HiperAdmin"
// (es_plataforma) se resuelve aparte porque es un flag, no un rol.
const rolLabel: Record<string, string> = {
  admin: "SuperAdmin",
  manager: "Admin",
  staff: "Staff",
  superadmin: "SuperAdmin",
  editor: "Staff",
  visor: "Staff",
};

export default function AdminLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const isMobile = useIsMobile();
  // Computadora: el menú arranca cerrado (solo íconos). Si alguien lo abre o
  // lo cierra, se recuerda en este navegador, también después de cerrar
  // sesión y volver a entrar (el logout solo borra el token).
  // Celular: el menú es un cajón que se abre con ☰ y se cierra al elegir.
  const [collapsedPref, setCollapsedPref] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") !== "0";
    } catch {
      return true;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const collapsed = !isMobile && collapsedPref;
  const toggleMenu = () => {
    if (isMobile) {
      setDrawerOpen((v) => !v);
      return;
    }
    setCollapsedPref((v) => {
      try {
        localStorage.setItem("sidebar_collapsed", v ? "0" : "1");
      } catch {
        /* sin almacenamiento */
      }
      return !v;
    });
  };
  const { user, logout, hasPermiso, isSuperAdmin, isPlataforma, isAuthenticated } = useAuth();
  const { t } = useLang();
  const { negocioId, negocios, slug, setNegocioId } = useNegocio();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // "Ver Menú" abre la vista previa del propio panel (/menu/:slug), que
  // carga el menú público del negocio activo.
  const menuHref = menuPath(slug, negocioId);

  // ── Notificaciones de pedidos nuevos ──
  const [nuevosPedidos, setNuevosPedidos] = useState(0);
  const [toast, setToast] = useState<{ texto: string; ruta: string; chat?: boolean } | null>(null);
  // Chats de WhatsApp: mensajes sin leer y chats que la IA pasó a una persona.
  const [chatsAviso, setChatsAviso] = useState({ no_leidos: 0, atender: 0 });
  const atenderRef = useRef<number | null>(null);
  const [negOpen, setNegOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configPos, setConfigPos] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  });
  const configBtnRef = useRef<HTMLButtonElement>(null);
  const configPanelRef = useRef<HTMLDivElement>(null);
  const [stockBajo, setStockBajo] = useState<
    { id: number; nombre: string; stock: number }[]
  >([]);
  const [stockOpen, setStockOpen] = useState(false);
  const negRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const lastPedidoRef = useRef<number>(
    Number(localStorage.getItem("last_pedido_id") || 0),
  );

  const beep = () => {
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o.start();
      o.stop(ctx.currentTime + 0.36);
      o.onended = () => ctx.close();
    } catch {
      /* audio bloqueado hasta interacción */
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !hasPermiso("pedidos")) return;
    let active = true;
    const check = async () => {
      try {
        const pend = await pedidosService.getAll({ estado: "pendiente" });
        if (!active) return;
        const maxId = pend.reduce((m, p) => Math.max(m, p.id), 0);
        if (lastPedidoRef.current > 0) {
          const nuevos = pend.filter((p) => p.id > lastPedidoRef.current).length;
          if (nuevos > 0) {
            setNuevosPedidos((n) => n + nuevos);
            setToast({
              texto: t(nuevos > 1 ? "toastNewOrders_other" : "toastNewOrders_one", {
                n: nuevos,
              }),
              ruta: "/admin/pedidos",
            });
            beep();
          }
        }
        if (maxId > lastPedidoRef.current) {
          lastPedidoRef.current = maxId;
          localStorage.setItem("last_pedido_id", String(maxId));
        }
      } catch {
        /* ignore */
      }
    };
    check();
    const intervalId = setInterval(check, 20000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, negocioId]);

  useEffect(() => {
    if (!isAuthenticated || !hasPermiso("pedidos")) return;
    let active = true;
    atenderRef.current = null;
    const check = async () => {
      if (document.hidden && atenderRef.current !== null) return;
      try {
        const r = await chatsService.resumen();
        if (!active) return;
        setChatsAviso(r);
        // Un chat nuevo para atender: aviso con sonido (no en la primera carga).
        if (atenderRef.current !== null && r.atender > atenderRef.current) {
          setToast({ texto: t("chToastAttend"), ruta: "/admin/chats", chat: true });
          beep();
        }
        atenderRef.current = r.atender;
      } catch {
        /* sin WhatsApp o sin migración: no se muestra nada */
      }
    };
    check();
    const intervalId = setInterval(check, 15000);
    window.addEventListener("chats-cambio", check);
    return () => {
      active = false;
      clearInterval(intervalId);
      window.removeEventListener("chats-cambio", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, negocioId]);

  // Número en la pestaña del navegador: "(2) DinexFlow · Admin".
  useEffect(() => {
    const n = chatsAviso.atender + chatsAviso.no_leidos;
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = n > 0 ? `(${n}) ${base}` : base;
  }, [chatsAviso]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (negRef.current && !negRef.current.contains(e.target as Node))
        setNegOpen(false);
    };
    if (negOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [negOpen]);

  const negocioActual = negocios.find((n) => n.id === negocioId);
  const irAPedidos = () => {
    setNuevosPedidos(0);
    navigate("/admin/pedidos");
  };
  const irAlToast = () => {
    if (!toast) return;
    if (toast.ruta === "/admin/pedidos") irAPedidos();
    else navigate(toast.ruta);
    setToast(null);
  };

  // ── Alerta de stock (candado + burbuja) ──
  useEffect(() => {
    if (!isAuthenticated || !hasPermiso("productos")) return;
    let active = true;
    const check = async () => {
      try {
        const data = await productosService.getStockBajo();
        if (active) setStockBajo(data);
      } catch {
        /* ignore */
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, negocioId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (stockRef.current && !stockRef.current.contains(e.target as Node))
        setStockOpen(false);
    };
    if (stockOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [stockOpen]);

  // El panel de Configuración se abre "hacia el costado" (flotante). Como el
  // sidebar tiene overflow:hidden, lo posicionamos con position:fixed usando
  // el rect del botón. Se cierra al hacer click fuera del botón y del panel.
  const toggleConfig = () => {
    if (!configOpen) {
      const r = configBtnRef.current?.getBoundingClientRect();
      if (r)
        setConfigPos({
          left: r.right + 8,
          bottom: Math.max(12, window.innerHeight - r.bottom),
        });
    }
    setConfigOpen((v) => !v);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        configBtnRef.current &&
        !configBtnRef.current.contains(target) &&
        configPanelRef.current &&
        !configPanelRef.current.contains(target)
      )
        setConfigOpen(false);
    };
    if (configOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [configOpen]);

  // Celular: el cajón se cierra al cambiar de página, al pasar a pantalla
  // grande y con la tecla Escape. Mientras está abierto, la página de atrás
  // no se desplaza.
  useEffect(() => {
    setDrawerOpen(false);
    setConfigOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const visible = NAV.filter((n) =>
    n.permiso === "any"
      ? true
      : n.permiso === "plataforma"
        ? isPlataforma
        : hasPermiso(n.permiso),
  );
  const isActive = (ruta: string) => location.pathname === ruta;

  const bg = isDark ? "#0f1117" : "#f0f2f5";
  const sidebarBg = isDark ? "#13151c" : "#ffffff";
  const sidebarBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const topbarBg = isDark ? "#13151c" : "#ffffff";
  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const textSecondary = isDark ? "#94a3b8" : "#64748b";
  const textMuted = isDark ? "#475569" : "#94a3b8";
  const navBgActive = isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)";
  const navActiveColor = isDark ? "#60a5fa" : "#2563eb";
  const navColor = isDark ? "#94a3b8" : "#64748b";
  const navHoverBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const navHoverColor = isDark ? "#e2e8f0" : "#1e293b";

  // Desplegables del topbar: en computadora cuelgan del botón; en el celular
  // ocupan el ancho de la pantalla para no salirse por los costados.
  const dropdownPos = (gap: number): React.CSSProperties =>
    isMobile
      ? { position: "fixed", top: 52 + gap, left: 8, right: 8 }
      : { position: "absolute", top: `calc(100% + ${gap}px)`, right: 0 };

  // Selector Sol/Luna (topbar en computadora, menú lateral en celular).
  const themeToggle = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: isDark ? "#0f1117" : "#e2e8f0",
      }}
    >
      <button
        onClick={() => {
          if (isDark) toggleTheme();
        }}
        title="Modo claro"
        style={{
          width: 28,
          height: 24,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: !isDark ? "#ffffff" : "transparent",
          color: !isDark ? "#f59e0b" : textMuted,
          boxShadow: !isDark ? "0 1px 2px rgba(0,0,0,0.15)" : "none",
        }}
      >
        <SunIcon />
      </button>
      <button
        onClick={() => {
          if (!isDark) toggleTheme();
        }}
        title="Modo oscuro"
        style={{
          width: 28,
          height: 24,
          borderRadius: 999,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDark ? "#1a1d27" : "transparent",
          color: isDark ? "#818cf8" : textMuted,
        }}
      >
        <MoonIcon />
      </button>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        background: bg,
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Celular: fondo oscuro detrás del cajón; tocarlo lo cierra. */}
      {isMobile && (
        <div
          onClick={() => setDrawerOpen(false)}
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(0,0,0,0.5)",
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? "auto" : "none",
            transition: "opacity 0.25s ease",
          }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        aria-label={t("brandSubtitle")}
        style={{
          width: isMobile ? "min(280px, 84vw)" : collapsed ? 56 : 220,
          transition: isMobile
            ? "transform 0.28s cubic-bezier(.4,0,.2,1), visibility 0.28s"
            : "width 0.25s cubic-bezier(.4,0,.2,1)",
          background: sidebarBg,
          borderRight: `1px solid ${sidebarBorder}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
          ...(isMobile && {
            position: "fixed",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 100,
            transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
            visibility: drawerOpen ? "visible" : "hidden",
            boxShadow: drawerOpen ? "8px 0 30px rgba(0,0,0,0.25)" : "none",
            paddingBottom: "env(safe-area-inset-bottom)",
          }),
        }}
      >
        {/* Brand */}
        <div
          style={{
            padding: collapsed ? "18px 0" : "18px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: `1px solid ${sidebarBorder}`,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <img
            src={BRAND_LOGO}
            alt={BRAND_NAME}
            width={32}
            height={32}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
          {!collapsed && (
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  ...brandTextStyle,
                  fontWeight: 800,
                  fontSize: 14,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {BRAND_NAME}
              </div>
              <div
                style={{ color: textMuted, fontSize: 11, whiteSpace: "nowrap" }}
              >
                {t("brandSubtitle")}
              </div>
            </div>
          )}
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label={t("closeMenu")}
              style={{
                marginLeft: "auto",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
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
            const esChats = item.ruta === "/admin/chats";
            const atender = esChats ? chatsAviso.atender : 0;
            const sinLeer = esChats ? chatsAviso.no_leidos : 0;
            return (
              <div key={item.ruta} style={{ position: "relative" }}>
              <button
                onClick={() =>
                  item.external
                    ? window.open(menuHref, "_blank", "noopener")
                    : navigate(item.ruta)
                }
                title={collapsed ? t(item.labelKey) : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: collapsed ? "9px 0" : isMobile ? "12px 12px" : "9px 11px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  background: active ? navBgActive : "transparent",
                  color: active ? navActiveColor : navColor,
                  fontSize: isMobile ? 14.5 : 13,
                  fontWeight: active ? 500 : 400,
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = navHoverBg;
                    (e.currentTarget as HTMLButtonElement).style.color = navHoverColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = navColor;
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
                <span style={{ color: active ? navActiveColor : "inherit", position: "relative", display: "flex" }}>
                  {item.icon}
                  {collapsed && (atender > 0 || sinLeer > 0) && (
                    <span
                      className={atender > 0 ? "chat-alerta" : undefined}
                      style={{
                        position: "absolute",
                        top: -3,
                        right: -4,
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        background: atender > 0 ? "#f59e0b" : "#10b981",
                        border: `2px solid ${sidebarBg}`,
                      }}
                    />
                  )}
                </span>
                {!collapsed && (
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t(item.labelKey)}
                  </span>
                )}
                {!collapsed && (atender > 0 || sinLeer > 0) && (
                  <span
                    className={atender > 0 ? "chat-alerta" : undefined}
                    title={atender > 0 ? t("chNeedsHuman") : t("chUnreadN", { n: sinLeer })}
                    style={{
                      marginLeft: "auto",
                      minWidth: 20,
                      height: 20,
                      padding: "0 7px",
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      color: "#fff",
                      background: atender > 0 ? "#f59e0b" : "#10b981",
                    }}
                  >
                    {atender > 0 ? `👋 ${atender}` : sinLeer > 99 ? "99+" : sinLeer}
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
              </div>
            );
          })}
        </nav>

        {/* Settings gear + logout */}
        <div
          style={{
            borderTop: `1px solid ${sidebarBorder}`,
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {/* Celular: idioma y tema (en computadora están en el topbar). */}
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "6px 8px 10px",
                marginBottom: 4,
                borderBottom: `1px solid ${sidebarBorder}`,
              }}
            >
              <span style={{ fontSize: 12, color: textMuted }}>{t("appearance")}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LangSelector isDark={isDark} />
                {themeToggle}
              </div>
            </div>
          )}
          {/* Configuración: abre un panel flotante hacia el costado (agrupa
              perfil personal y config del menú del negocio). Se ubica arriba
              del bloque del usuario. */}
          <button
            ref={configBtnRef}
            onClick={toggleConfig}
            title={collapsed ? t("pageConfig") : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: collapsed ? "9px 0" : "9px 11px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: configOpen ? navBgActive : "transparent",
              color: configOpen ? navActiveColor : navColor,
              fontSize: 13,
              width: "100%",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (configOpen) return;
              (e.currentTarget as HTMLButtonElement).style.background = navHoverBg;
              (e.currentTarget as HTMLButtonElement).style.color = navHoverColor;
            }}
            onMouseLeave={(e) => {
              if (configOpen) return;
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = navColor;
            }}
          >
            <GearIcon />
            {!collapsed && (
              <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap" }}>
                {t("pageConfig")}
              </span>
            )}
            {!collapsed && (
              <svg
                viewBox="0 0 24 24"
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ flexShrink: 0, opacity: 0.7 }}
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Usuario (antes estaba dentro de "Ajustes") */}
          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: collapsed ? "8px 0" : "8px 8px",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              title={collapsed ? `${user.nombre || user.username} · ${isPlataforma ? "HiperAdmin" : rolLabel[user.rol] || user.rol}` : undefined}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
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
              {!collapsed && (
                <div style={{ overflow: "hidden", flex: 1 }}>
                  <div
                    style={{
                      color: textPrimary,
                      fontSize: 12.5,
                      fontWeight: 600,
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
                    {isPlataforma ? "HiperAdmin" : rolLabel[user.rol] || user.rol}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Logout */}
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
              color: navColor,
              fontSize: 13,
              width: "100%",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)";
              (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = navColor;
            }}
            title={collapsed ? t("logout") : undefined}
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
            {!collapsed && t("logout")}
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
            background: topbarBg,
            borderBottom: `1px solid ${sidebarBorder}`,
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 8 : 12,
            padding: isMobile ? "0 8px 0 4px" : "0 20px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={toggleMenu}
            aria-label={t(isMobile && drawerOpen ? "closeMenu" : "openMenu")}
            aria-expanded={isMobile ? drawerOpen : !collapsed}
            style={{
              position: "relative",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: isMobile ? textSecondary : textMuted,
              padding: isMobile ? 10 : 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textSecondary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = textMuted)}
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
            {/* Celular: con el menú cerrado, un punto avisa que hay chats. */}
            {isMobile && (chatsAviso.atender > 0 || chatsAviso.no_leidos > 0) && (
              <span
                className={chatsAviso.atender > 0 ? "chat-alerta" : undefined}
                style={{
                  position: "absolute",
                  top: 7,
                  right: 6,
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  background: chatsAviso.atender > 0 ? "#f59e0b" : "#10b981",
                  border: `2px solid ${topbarBg}`,
                }}
              />
            )}
          </button>
          <h1
            style={{
              color: textPrimary,
              fontSize: 15,
              fontWeight: 600,
              margin: 0,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 6 : 14,
              flexShrink: 0,
            }}
          >
            {/* Selector de negocio (multi-tenant): dueño (SuperAdmin) y
                Admin/manager, que también gestionan sucursales. */}
            {(isSuperAdmin || hasPermiso("negocios")) && negocios.length > 0 && (
              <div ref={negRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setNegOpen((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${sidebarBorder}`,
                    background: isDark ? "#0f1117" : "#f8f9fa",
                    color: textPrimary,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    maxWidth: isMobile ? 130 : 200,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: "linear-gradient(135deg,#3b82f6,#6366f1)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      flexShrink: 0,
                    }}
                  >
                    {(negocioActual?.nombre || "N")[0].toUpperCase()}
                  </span>
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {negocioActual?.nombre || t("bizFallback", { n: negocioId })}
                  </span>
                  <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {negOpen && (
                  <div
                    style={{
                      ...dropdownPos(6),
                      minWidth: 220,
                      background: isDark ? "#1a1d27" : "#fff",
                      border: `1px solid ${sidebarBorder}`,
                      borderRadius: 10,
                      boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                      overflow: "hidden",
                      zIndex: 70,
                    }}
                  >
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {negocios.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setNegOpen(false);
                            setNegocioId(n.id);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            border: "none",
                            cursor: "pointer",
                            background:
                              n.id === negocioId
                                ? isDark
                                  ? "rgba(59,130,246,0.15)"
                                  : "rgba(59,130,246,0.1)"
                                : "transparent",
                            color: n.id === negocioId ? "#3b82f6" : textPrimary,
                            fontSize: 13,
                            fontWeight: n.id === negocioId ? 600 : 400,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {n.nombre}
                          {!n.activo && (
                            <span style={{ marginLeft: "auto", fontSize: 10, color: textMuted }}>
                              {t("inactive")}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        setNegOpen(false);
                        navigate("/admin/negocios");
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        borderTop: `1px solid ${sidebarBorder}`,
                        cursor: "pointer",
                        background: "transparent",
                        color: "#3b82f6",
                        fontSize: 12.5,
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      ⚙ {t("manageNegocios")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Idioma y tema: en el celular van dentro del menú lateral */}
            {!isMobile && <LangSelector isDark={isDark} />}
            {!isMobile && themeToggle}

            {/* Campana de notificaciones */}
            {hasPermiso("pedidos") && (
              <button
                onClick={irAPedidos}
                title={t("newOrders")}
                style={{
                  position: "relative",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: nuevosPedidos > 0 ? "#f59e0b" : textMuted,
                  padding: 4,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {nuevosPedidos > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      minWidth: 16,
                      height: 16,
                      padding: "0 4px",
                      borderRadius: 999,
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {nuevosPedidos}
                  </span>
                )}
              </button>
            )}

            {/* Candado / alerta de stock */}
            {hasPermiso("productos") && (
              <div ref={stockRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setStockOpen((v) => !v)}
                  title={t("stockAlerts")}
                  style={{
                    position: "relative",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: stockBajo.length ? "#ef4444" : textMuted,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  {stockBajo.length > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 999,
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {stockBajo.length}
                    </span>
                  )}
                </button>
                {stockOpen && (
                  <div
                    style={{
                      ...dropdownPos(8),
                      width: isMobile ? "auto" : 270,
                      background: isDark ? "#1a1d27" : "#fff",
                      border: `1px solid ${sidebarBorder}`,
                      borderRadius: 10,
                      boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                      zIndex: 70,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${sidebarBorder}`, fontSize: 12.5, fontWeight: 700, color: textPrimary }}>
                      {t("stockAlerts")}
                    </div>
                    {stockBajo.length === 0 ? (
                      <div style={{ padding: "16px 12px", fontSize: 12.5, color: textMuted }}>
                        {t("stockAllGood")}
                      </div>
                    ) : (
                      <div style={{ maxHeight: 280, overflowY: "auto" }}>
                        {stockBajo.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              setStockOpen(false);
                              navigate("/admin/productos");
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "9px 12px",
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              color: textPrimary,
                              fontSize: 13,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = navHoverBg)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.nombre}
                            </span>
                            <span style={{ color: p.stock === 0 ? "#ef4444" : "#f59e0b", fontWeight: 700, flexShrink: 0 }}>
                              {p.stock === 0 ? t("soldOut") : t("unitsShort", { n: p.stock })}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                display: isMobile ? "none" : "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: textMuted,
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
              {t("online")}
            </div>
          </div>
        </header>

        {/* Content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile
              ? "14px 12px calc(20px + env(safe-area-inset-bottom))"
              : "20px 24px",
            background: bg,
          }}
        >
          {children}
        </main>
      </div>

      {/* Panel flotante de Configuración (se abre hacia el costado) */}
      {configOpen && (
        <div
          ref={configPanelRef}
          style={{
            position: "fixed",
            // Celular: el panel se muestra abajo, a todo lo ancho y por
            // encima del menú lateral.
            ...(isMobile
              ? { left: 10, right: 10, bottom: "calc(10px + env(safe-area-inset-bottom))" }
              : { left: configPos.left, bottom: configPos.bottom, width: 252 }),
            background: isDark ? "#1a1d27" : "#ffffff",
            border: `1px solid ${sidebarBorder}`,
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
            zIndex: 120,
            overflow: "hidden",
            animation: "cfgIn .16s ease",
          }}
        >
          <style>{`@keyframes cfgIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}`}</style>

          {/* Encabezado */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 14px",
              borderBottom: `1px solid ${sidebarBorder}`,
              background: isDark ? "rgba(59,130,246,0.10)" : "rgba(59,130,246,0.06)",
              color: textPrimary,
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            <span style={{ color: "#3b82f6", display: "flex" }}>
              <GearIcon />
            </span>
            {t("pageConfig")}
          </div>

          {/* ── Perfil (cuenta personal) ── */}
          <div style={{ padding: "8px 8px 6px" }}>
            <div style={configGroupLabel("#3b82f6")}>
              <span style={configDot("#3b82f6")} />
              {t("cfgGroupProfile")}
            </div>
            <ConfigSubItem
              label={t("profileEdit")}
              soon
              soonLabel={t("soon")}
              accent="#3b82f6"
              textColor={textPrimary}
              muted={textMuted}
              hoverBg={navHoverBg}
            />
            <ConfigSubItem
              label={t("profileEmail")}
              soon
              soonLabel={t("soon")}
              accent="#3b82f6"
              textColor={textPrimary}
              muted={textMuted}
              hoverBg={navHoverBg}
            />
            <ConfigSubItem
              label={t("usrChangePw")}
              onClick={() => {
                setConfigOpen(false);
                navigate("/admin/cambiar-password");
              }}
              accent="#3b82f6"
              textColor={textPrimary}
              muted={textMuted}
              hoverBg={navHoverBg}
            />
          </div>

          {/* ── Menú del negocio ── */}
          {hasPermiso("configuracion") && (
            <>
              <div style={{ height: 1, background: sidebarBorder }} />
              <div style={{ padding: "8px 8px 10px" }}>
                <div style={configGroupLabel("#8b5cf6")}>
                  <span style={configDot("#8b5cf6")} />
                  {t("cfgGroupMenu")}
                </div>
                <ConfigSubItem
                  label={t("configModalTitle")}
                  onClick={() => {
                    setConfigOpen(false);
                    setDrawerOpen(false);
                    setShowConfigModal(true);
                  }}
                  accent="#8b5cf6"
                  textColor={textPrimary}
                  muted={textMuted}
                  hoverBg={navHoverBg}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Toast: pedido nuevo o chat para atender */}
      {toast && (
        <div
          onClick={irAlToast}
          style={{
            position: "fixed",
            ...(isMobile
              ? { left: 10, right: 10, bottom: "calc(12px + env(safe-area-inset-bottom))" }
              : { bottom: 22, right: 22 }),
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "13px 18px",
            borderRadius: 12,
            background: "#111827",
            color: "#fff",
            boxShadow: "0 12px 34px rgba(0,0,0,0.35)",
            cursor: "pointer",
            animation: "toastIn .25s ease",
          }}
        >
          <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
          <span style={{ display: "flex", color: "#fbbf24", fontSize: 20 }}>
            {toast.chat ? "👋" : <IconBell size={20} />}
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{toast.texto}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {toast.chat ? t("chToastTap") : t("toastTapToView")}
            </div>
          </div>
        </div>
      )}

      {/* Modal: editor de configuración del menú */}
      {showConfigModal && (
        <div
          onClick={() => setShowConfigModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: isMobile ? "12px 8px" : "40px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 820,
              background: bg,
              borderRadius: 16,
              padding: isMobile ? 14 : 24,
              boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 18,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: textPrimary }}>
                {t("configModalTitle")}
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                  color: textSecondary,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <ConfiguracionEditor />
          </div>
        </div>
      )}
    </div>
  );
}
