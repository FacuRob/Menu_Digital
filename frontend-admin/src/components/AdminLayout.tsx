import { Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNegocio } from "../context/NegocioContext";
import { apiPendientes, chatsService, pedidosService, productosService } from "../services/api";
import LoadingScreen from "./LoadingScreen";
import Modal from "./Modal";
import ConfiguracionEditor from "./ConfiguracionEditor";
import CuentaModal, { type CuentaTab } from "./CuentaModal";
import { useLang, LangSelector } from "../lib/i18n";
import { BRAND_NAME, BRAND_LOGO } from "../lib/brand";
import { menuPath } from "../lib/menuUrl";
import { useIsMobile } from "../lib/useIsMobile";
import "../styles/shell.css";
import { TituloCtx, useTituloPagina } from "./tituloPagina";

// ── Íconos de línea del menú (heredan el color) ──
const Ico = ({ d, children }: { d?: string; children?: ReactNode }) => (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d ? <path d={d} /> : children}
  </svg>
);
const I = {
  dashboard: (
    <Ico>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Ico>
  ),
  categorias: <Ico d="M4 6h16M4 12h16M4 18h10" />,
  productos: (
    <Ico>
      <path d="M20 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </Ico>
  ),
  pedidos: (
    <Ico>
      <path d="M6 2h12l1 4H5l1-4z" />
      <path d="M5 6v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6" />
      <path d="M9 11h6M9 15h4" />
    </Ico>
  ),
  chats: (
    <Ico>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />
      <path d="M8.5 11h7M8.5 14h4" />
    </Ico>
  ),
  whatsapp: (
    <Ico>
      <path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4l-4.5 1.1z" />
      <path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1.2-1.2 1.8.9-.3 1.3c-3.6.4-7.7-3.7-7.3-7.3l1.3-.3.9 1.8L9 9.5z" />
    </Ico>
  ),
  qr: (
    <Ico>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="3" y="15" width="6" height="6" rx="1" />
      <path d="M15 15h.01M15 18h3M18 15v3M21 15h.01M21 21h.01" />
    </Ico>
  ),
  usuarios: (
    <Ico>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Ico>
  ),
  negocios: (
    <Ico>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
    </Ico>
  ),
  suscripcion: (
    <Ico>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Ico>
  ),
  plataforma: (
    <Ico>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M3 12h18" />
    </Ico>
  ),
  menu: (
    <Ico>
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.5 12C3.7 7.9 7.5 5 12 5s8.3 2.9 9.5 7c-1.2 4.1-5 7-9.5 7s-8.3-2.9-9.5-7z" />
    </Ico>
  ),
  ext: <Ico d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />,
  gear: (
    <Ico>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Ico>
  ),
  logout: <Ico d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  burger: <Ico d="M4 6h16M4 12h16M4 18h16" />,
  close: <Ico d="M6 6l12 12M18 6L6 18" />,
  chevron: <Ico d="M9 6l6 6-6 6" />,
  down: <Ico d="M6 9l6 6 6-6" />,
  bell: (
    <Ico>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Ico>
  ),
  box: (
    <Ico>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8M12 13v8" />
    </Ico>
  ),
  sun: (
    <Ico>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </Ico>
  ),
  moon: <Ico d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />,
  more: (
    <Ico>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </Ico>
  ),
};

type ItemNav = { permiso: string; ruta: string; labelKey: string; icon: ReactNode; external?: boolean };

const NAV: ItemNav[] = [
  { permiso: "any", ruta: "/admin/dashboard", labelKey: "navDashboard", icon: I.dashboard },
  { permiso: "pedidos", ruta: "/admin/pedidos", labelKey: "navPedidos", icon: I.pedidos },
  { permiso: "pedidos", ruta: "/admin/chats", labelKey: "navChats", icon: I.chats },
  { permiso: "productos", ruta: "/admin/productos", labelKey: "navProductos", icon: I.productos },
  { permiso: "categorias", ruta: "/admin/categorias", labelKey: "navCategorias", icon: I.categorias },
  { permiso: "qr", ruta: "/admin/qr", labelKey: "navQr", icon: I.qr },
  { permiso: "configuracion", ruta: "/admin/whatsapp", labelKey: "navWhatsapp", icon: I.whatsapp },
  { permiso: "usuarios", ruta: "/admin/usuarios", labelKey: "navUsuarios", icon: I.usuarios },
  { permiso: "negocios", ruta: "/admin/negocios", labelKey: "navNegocios", icon: I.negocios },
  { permiso: "suscripcion", ruta: "/admin/suscripcion", labelKey: "navSuscripcion", icon: I.suscripcion },
  { permiso: "plataforma", ruta: "/admin/plataforma", labelKey: "navPlataforma", icon: I.plataforma },
  { permiso: "any", ruta: "/menu", labelKey: "navVerMenu", icon: I.menu, external: true },
];

// Barra inferior del celular: lo de todos los días. El resto va en "Más".
const RUTAS_ABAJO = ["/admin/dashboard", "/admin/pedidos", "/admin/chats", "/admin/productos"];

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

// Envoltorio de cada pantalla: sólo informa el título. La estructura (menú,
// barra superior, avisos) es AdminShell, que se monta una sola vez como
// layout de ruta (App.tsx) y no se rearma al cambiar de sección.
export default function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  useTituloPagina(title);
  return <>{children}</>;
}

// Cierra un desplegable al tocar afuera o con Escape (y con Escape el foco
// vuelve al botón que lo abrió).
function useCerrarAfuera(
  abierto: boolean,
  refs: React.RefObject<HTMLElement | null>[],
  cerrar: () => void,
  volverA?: () => HTMLElement | null | undefined,
) {
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });
  useEffect(() => {
    if (!abierto) return;
    const onDown = (e: MouseEvent) => {
      if (refs.every((r) => r.current && !r.current.contains(e.target as Node))) cerrarRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      cerrarRef.current();
      volverA?.()?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
}

const beep = () => {
  try {
    const AC =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

export function AdminShell() {
  const isMobile = useIsMobile();
  const [titulo, setTitulo] = useState("");
  // Computadora: el menú arranca abierto en pantallas anchas y con sólo
  // íconos en las medianas. Si alguien lo cambia, se recuerda.
  const [collapsedPref, setCollapsedPref] = useState(() => {
    try {
      const g = localStorage.getItem("sidebar_collapsed");
      if (g === "0" || g === "1") return g === "1";
    } catch {
      /* sin almacenamiento */
    }
    return window.innerWidth < 1100;
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
  const { isDark, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const menuHref = menuPath(slug, negocioId);

  // ── Avisos: pedidos nuevos, chats y stock ──
  const [nuevosPedidos, setNuevosPedidos] = useState(0);
  const [toast, setToast] = useState<{ texto: string; ruta: string; chat?: boolean } | null>(null);
  const [chatsAviso, setChatsAviso] = useState({ no_leidos: 0, atender: 0 });
  const atenderRef = useRef<number | null>(null);
  const [stockBajo, setStockBajo] = useState<{ id: number; nombre: string; stock: number }[]>([]);
  const lastPedidoRef = useRef<number>(0);

  // Desplegables y ventanas
  const [negOpen, setNegOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configPos, setConfigPos] = useState({ left: 0, bottom: 0 });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [cuentaTab, setCuentaTab] = useState<CuentaTab | null>(null);
  const negRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const configBtnRef = useRef<HTMLButtonElement>(null);
  const configPanelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const masRef = useRef<HTMLButtonElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const boton = (r: React.RefObject<HTMLElement | null>) => () => r.current?.querySelector("button");
  useCerrarAfuera(negOpen, [negRef], () => setNegOpen(false), boton(negRef));
  useCerrarAfuera(stockOpen, [stockRef], () => setStockOpen(false), boton(stockRef));
  useCerrarAfuera(configOpen, [configBtnRef, configPanelRef], () => setConfigOpen(false), () => configBtnRef.current);

  useEffect(() => {
    if (!isAuthenticated || !hasPermiso("pedidos")) return;
    let active = true;
    // Último pedido visto, por negocio (si no, al cambiar de local saltan
    // avisos falsos de "pedidos nuevos").
    const clave = `last_pedido_id:${negocioId}`;
    try {
      lastPedidoRef.current = Number(localStorage.getItem(clave) || localStorage.getItem("last_pedido_id") || 0);
    } catch {
      lastPedidoRef.current = 0;
    }
    const check = async () => {
      if (document.hidden && lastPedidoRef.current > 0) return;
      try {
        const pend = await pedidosService.getAll({ estado: "pendiente" });
        if (!active) return;
        const maxId = pend.reduce((m, p) => Math.max(m, p.id), 0);
        if (lastPedidoRef.current > 0) {
          const nuevos = pend.filter((p) => p.id > lastPedidoRef.current).length;
          if (nuevos > 0) {
            setNuevosPedidos((n) => n + nuevos);
            setToast({
              texto: t(nuevos > 1 ? "toastNewOrders_other" : "toastNewOrders_one", { n: nuevos }),
              ruta: "/admin/pedidos",
            });
            beep();
          }
        }
        if (maxId > lastPedidoRef.current) {
          lastPedidoRef.current = maxId;
          try {
            localStorage.setItem(clave, String(maxId));
          } catch {
            /* sin storage */
          }
        }
      } catch {
        /* ignore */
      }
    };
    check();
    const id = setInterval(check, 20000);
    return () => {
      active = false;
      clearInterval(id);
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
    const id = setInterval(check, 15000);
    window.addEventListener("chats-cambio", check);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("chats-cambio", check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, negocioId]);

  useEffect(() => {
    if (!isAuthenticated || !hasPermiso("productos")) return;
    let active = true;
    const check = async () => {
      if (document.hidden) return;
      try {
        const data = await productosService.getStockBajo();
        if (active) setStockBajo(data);
      } catch {
        /* ignore */
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, negocioId]);

  // Número en la pestaña del navegador: "(2) Pedidos · DinexFlow".
  useEffect(() => {
    const n = chatsAviso.atender + chatsAviso.no_leidos;
    const base = titulo ? `${titulo} · ${BRAND_NAME}` : `${BRAND_NAME} · Admin`;
    document.title = n > 0 ? `(${n}) ${base}` : base;
  }, [chatsAviso, titulo]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Pantalla de carga: sólo al entrar al panel (la estructura ya no se
  // rearma en cada sección). Mínimo para que se vea la animación y hasta que
  // terminen los pedidos al servidor (con tope). ──
  const [carga, setCarga] = useState<"on" | "saliendo" | "off">("on");
  useEffect(() => {
    const MINIMO = 500;
    const TOPE = 4000;
    const inicio = Date.now();
    let libreDesde = 0;
    let fin: ReturnType<typeof setTimeout> | undefined;
    const terminar = () => {
      clearInterval(revisar);
      clearTimeout(tope);
      setCarga("saliendo");
      fin = setTimeout(() => setCarga("off"), 350);
    };
    const revisar = setInterval(() => {
      if (apiPendientes() > 0) {
        libreDesde = 0;
        return;
      }
      if (!libreDesde) libreDesde = Date.now();
      if (Date.now() - libreDesde >= 150 && Date.now() - inicio >= MINIMO) terminar();
    }, 50);
    const tope = setTimeout(terminar, TOPE);
    return () => {
      clearInterval(revisar);
      clearTimeout(tope);
      clearTimeout(fin);
    };
  }, []);

  // Al cambiar de sección: cerrar cajón y desplegables, volver arriba y
  // llevar el foco al contenido (así el lector anuncia la sección nueva).
  const primeraRuta = useRef(true);
  useEffect(() => {
    setDrawerOpen(false);
    setConfigOpen(false);
    setNegOpen(false);
    setStockOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    if (primeraRuta.current) {
      primeraRuta.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  // Cajón del celular: Escape lo cierra y la página de atrás no se desplaza.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // El foco entra al cajón (al ítem actual o al primero).
    const lado = sideRef.current;
    // Un cuadro después: el cajón recién deja de estar oculto.
    const raf = requestAnimationFrame(() => {
      const actual = lado?.querySelector<HTMLElement>("[aria-current=page]") || lado?.querySelector<HTMLElement>(".sh-link");
      actual?.focus();
    });
    const mas = masRef.current;
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (mas && lado?.contains(document.activeElement)) mas.focus();
    };
  }, [drawerOpen]);

  const visible = NAV.filter((n) =>
    n.permiso === "any" ? true : n.permiso === "plataforma" ? isPlataforma : hasPermiso(n.permiso),
  );
  const abajo = visible.filter((n) => RUTAS_ABAJO.includes(n.ruta));
  const negocioActual = negocios.find((n) => n.id === negocioId);
  const hayChats = chatsAviso.atender > 0 || chatsAviso.no_leidos > 0;

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

  // El panel de Configuración se abre "hacia el costado" del botón.
  const toggleConfig = () => {
    if (!configOpen) {
      const r = configBtnRef.current?.getBoundingClientRect();
      if (r) setConfigPos({ left: r.right + 8, bottom: Math.max(12, window.innerHeight - r.bottom) });
    }
    setConfigOpen((v) => !v);
  };

  const themeToggle = (
    <div className="sh-theme" role="group" aria-label={t("appearance")}>
      <button type="button" aria-pressed={!isDark} aria-label={t("themeLight")} onClick={() => setTheme("light")}>
        {I.sun}
      </button>
      <button type="button" aria-pressed={isDark} aria-label={t("themeDark")} onClick={() => setTheme("dark")}>
        {I.moon}
      </button>
    </div>
  );

  // Contador de chats junto al ítem "Chats".
  const avisoChats = (esChats: boolean) => {
    if (!esChats || !hayChats) return null;
    const atender = chatsAviso.atender;
    return collapsed ? (
      <>
        <span className={`sh-dot${atender > 0 ? " is-warn chat-alerta" : ""}`} aria-hidden />
        <span className="sr-only">{atender > 0 ? t("chNeedsHuman") : t("chUnreadN", { n: chatsAviso.no_leidos })}</span>
      </>
    ) : (
      <span className={`sh-badge${atender > 0 ? " is-warn chat-alerta" : ""}`}>
        <span aria-hidden>{atender > 0 ? atender : chatsAviso.no_leidos > 99 ? "99+" : chatsAviso.no_leidos}</span>
        <span className="sr-only">{atender > 0 ? t("chNeedsHuman") : t("chUnreadN", { n: chatsAviso.no_leidos })}</span>
      </span>
    );
  };

  return (
    <TituloCtx.Provider value={setTitulo}>
      <div className="sh">
        <a href="#contenido" className="sh-skip">
          {t("skipToContent")}
        </a>

        {/* Celular: fondo detrás del cajón; tocarlo lo cierra. */}
        <div className={`sh-scrim sh-mobile${drawerOpen ? " is-open" : ""}`} onClick={() => setDrawerOpen(false)} aria-hidden />

        {/* ── Menú lateral ── */}
        <aside
          id="menu-panel"
          ref={sideRef}
          className={`sh-side${collapsed ? " is-collapsed" : ""}${drawerOpen ? " is-open" : ""}`}
          aria-label={t("brandSubtitle")}
          role={isMobile && drawerOpen ? "dialog" : undefined}
          aria-modal={isMobile && drawerOpen ? true : undefined}
          inert={isMobile && !drawerOpen}
        >
          <div className="sh-brand">
            <img src={BRAND_LOGO} alt="" width={34} height={34} />
            <div className="sh-brand-text">
              <div className="sh-brand-name pn-title">{BRAND_NAME.toLowerCase()}</div>
              <div className="sh-brand-sub">{t("brandSubtitle")}</div>
            </div>
            {isMobile && (
              <button type="button" className="sh-iconbtn" style={{ marginLeft: "auto" }} onClick={() => setDrawerOpen(false)} aria-label={t("closeMenu")}>
                {I.close}
              </button>
            )}
          </div>

          <nav className="sh-nav" aria-label={t("navMain")}>
            {visible.map((item) =>
              item.external ? (
                <a
                  key={item.ruta}
                  className="sh-link"
                  href={menuHref}
                  target="_blank"
                  rel="noopener"
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  {item.icon}
                  <span className="sh-label">{t(item.labelKey)}</span>
                  <span className="sh-ext" aria-hidden>
                    {I.ext}
                  </span>
                </a>
              ) : (
                <NavLink
                  key={item.ruta}
                  to={item.ruta}
                  className="sh-link"
                  title={collapsed ? t(item.labelKey) : undefined}
                >
                  {item.icon}
                  <span className={collapsed ? "sr-only" : "sh-label"}>{t(item.labelKey)}</span>
                  {avisoChats(item.ruta === "/admin/chats")}
                </NavLink>
              ),
            )}
          </nav>

          <div className="sh-foot">
            {/* Celular: idioma y tema (en computadora están arriba). */}
            {isMobile && (
              <div className="sh-prefs">
                <span>{t("appearance")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LangSelector isDark={isDark} />
                  {themeToggle}
                </div>
              </div>
            )}
            <button
              ref={configBtnRef}
              type="button"
              className={`sh-link${configOpen ? " is-open" : ""}`}
              onClick={toggleConfig}
              aria-expanded={configOpen}
              title={collapsed ? t("pageConfig") : undefined}
              aria-label={collapsed ? t("pageConfig") : undefined}
            >
              {I.gear}
              <span className="sh-label">{t("pageConfig")}</span>
              <span className="sh-chev" style={{ display: "grid", opacity: 0.6 }} aria-hidden>
                <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </button>

            {user && (
              <div className="sh-user" title={collapsed ? user.nombre || user.username : undefined}>
                <span className="sh-avatar" aria-hidden>
                  {(user.nombre || user.username || "?")[0].toUpperCase()}
                </span>
                <div className="sh-user-text">
                  <div className="sh-user-name">{user.nombre || user.username}</div>
                  <div className="sh-user-rol">{isPlataforma ? "HiperAdmin" : rolLabel[user.rol] || user.rol}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              className="sh-link is-danger"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
              title={collapsed ? t("logout") : undefined}
              aria-label={collapsed ? t("logout") : undefined}
            >
              {I.logout}
              <span className="sh-label">{t("logout")}</span>
            </button>
          </div>
        </aside>

        {/* ── Columna principal ── */}
        <div className="sh-main" inert={(isMobile && drawerOpen) || carga === "on"}>
          <header className="sh-top">
            <button
              type="button"
              className="sh-iconbtn sh-desk"
              onClick={toggleMenu}
              aria-label={t(collapsed ? "openMenu" : "closeMenu")}
              aria-expanded={!collapsed}
            >
              {I.burger}
            </button>
            <h1 className="sh-title pn-title">{titulo}</h1>

            <div className="sh-actions">
              {/* Selector de negocio (dueño y Admin, que gestionan sucursales). */}
              {(isSuperAdmin || hasPermiso("negocios")) && negocios.length > 0 && (
                <div ref={negRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className="sh-select"
                    onClick={() => setNegOpen((v) => !v)}
                    aria-expanded={negOpen}
                    aria-label={`${t("navNegocios")}: ${negocioActual?.nombre || t("bizFallback", { n: negocioId })}`}
                  >
                    <span className="sh-select-ini" aria-hidden>
                      {(negocioActual?.nombre || "N")[0].toUpperCase()}
                    </span>
                    <span className="sh-select-name">{negocioActual?.nombre || t("bizFallback", { n: negocioId })}</span>
                    <span style={{ display: "grid", width: 16 }} aria-hidden>
                      {I.down}
                    </span>
                  </button>
                  {negOpen && (
                    <div className="sh-pop">
                      <div className="sh-pop-list">
                        {negocios.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            className="sh-pop-item"
                            aria-current={n.id === negocioId}
                            onClick={() => {
                              setNegOpen(false);
                              setNegocioId(n.id);
                            }}
                          >
                            {n.nombre}
                            {!n.activo && <span className="sh-pop-meta">{t("inactive")}</span>}
                          </button>
                        ))}
                      </div>
                      <div className="sh-pop-foot">
                        <button
                          type="button"
                          className="sh-pop-item"
                          onClick={() => {
                            setNegOpen(false);
                            navigate("/admin/negocios");
                          }}
                        >
                          <span style={{ display: "grid", width: 18 }} aria-hidden>
                            {I.gear}
                          </span>
                          {t("manageNegocios")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <span className="sh-desk" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LangSelector isDark={isDark} />
                {themeToggle}
              </span>

              {/* Pedidos nuevos */}
              {hasPermiso("pedidos") && (
                <button
                  type="button"
                  className={`sh-iconbtn${nuevosPedidos > 0 ? " is-alert" : ""}`}
                  onClick={irAPedidos}
                  aria-label={nuevosPedidos > 0 ? `${t("newOrders")}: ${nuevosPedidos}` : t("newOrders")}
                  title={t("newOrders")}
                >
                  {I.bell}
                  {nuevosPedidos > 0 && (
                    <span className="sh-count" aria-hidden>
                      {nuevosPedidos}
                    </span>
                  )}
                </button>
              )}

              {/* Alerta de stock */}
              {hasPermiso("productos") && (
                <div ref={stockRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    className={`sh-iconbtn${stockBajo.length ? " is-alert" : ""}`}
                    onClick={() => setStockOpen((v) => !v)}
                    aria-expanded={stockOpen}
                    aria-label={stockBajo.length ? `${t("stockAlerts")}: ${stockBajo.length}` : t("stockAlerts")}
                    title={t("stockAlerts")}
                  >
                    {I.box}
                    {stockBajo.length > 0 && (
                      <span className="sh-count" aria-hidden>
                        {stockBajo.length}
                      </span>
                    )}
                  </button>
                  {stockOpen && (
                    <div className="sh-pop" style={{ width: isMobile ? "auto" : 290 }}>
                      <div className="sh-pop-head">{t("stockAlerts")}</div>
                      {stockBajo.length === 0 ? (
                        <div className="sh-pop-empty">{t("stockAllGood")}</div>
                      ) : (
                        <div className="sh-pop-list">
                          {stockBajo.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="sh-pop-item"
                              onClick={() => {
                                setStockOpen(false);
                                navigate("/admin/productos");
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.nombre}
                              </span>
                              <span
                                className="sh-pop-meta"
                                style={{ color: p.stock === 0 ? "var(--err)" : "var(--warn)", fontWeight: 700 }}
                              >
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
            </div>
          </header>

          <main id="contenido" ref={mainRef} className="sh-content" tabIndex={-1}>
            <Suspense
              fallback={
                <div className="sh-skeleton" role="status">
                  <span className="sr-only">{t("loadingScreen")}</span>
                  <div />
                  <div />
                  <div />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* ── Barra inferior (celular) ── */}
        <nav className="sh-bottom" aria-label={t("navBottom")} inert={drawerOpen}>
          {abajo.map((item) => (
            <NavLink key={item.ruta} to={item.ruta} className="sh-bottom-item">
              <span style={{ position: "relative", display: "grid" }}>
                {item.icon}
                {item.ruta === "/admin/chats" && hayChats && (
                  <>
                    <span className={`sh-dot${chatsAviso.atender > 0 ? " is-warn" : ""}`} style={{ top: -3, right: -6 }} aria-hidden />
                    <span className="sr-only">{chatsAviso.atender > 0 ? t("chNeedsHuman") : t("chUnreadN", { n: chatsAviso.no_leidos })}</span>
                  </>
                )}
              </span>
              {t(item.labelKey)}
            </NavLink>
          ))}
          <button
            ref={masRef}
            type="button"
            className="sh-bottom-item"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="menu-panel"
          >
            {I.more}
            {t("navMore")}
          </button>
        </nav>

        {/* Panel de Configuración (al costado del botón) */}
        {configOpen && (
          <div
            ref={configPanelRef}
            className="sh-cfg"
            style={isMobile ? undefined : { left: configPos.left, bottom: configPos.bottom }}
          >
            <div className="sh-cfg-group">
              <div className="sh-cfg-label">{t("cfgGroupProfile")}</div>
              <button
                type="button"
                role="menuitem"
                className="sh-pop-item"
                onClick={() => {
                  setConfigOpen(false);
                  setDrawerOpen(false);
                  setCuentaTab("perfil");
                }}
              >
                {t("acctTitle")}
                <span className="sh-pop-meta" style={{ display: "grid", width: 16 }} aria-hidden>
                  {I.chevron}
                </span>
              </button>
            </div>
            {hasPermiso("configuracion") && (
              <div className="sh-cfg-group">
                <div className="sh-cfg-label">{t("cfgGroupMenu")}</div>
                <button
                  type="button"
                  role="menuitem"
                  className="sh-pop-item"
                  onClick={() => {
                    setConfigOpen(false);
                    setDrawerOpen(false);
                    setShowConfigModal(true);
                  }}
                >
                  {t("configModalTitle")}
                  <span className="sh-pop-meta" style={{ display: "grid", width: 16 }} aria-hidden>
                    {I.chevron}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {carga !== "off" && <LoadingScreen leaving={carga === "saliendo"} />}

        {/* Aviso: pedido nuevo o chat para atender */}
        <div aria-live="polite" role="status">
          {toast && (
            <button type="button" className="sh-toast" onClick={irAlToast}>
              <span className="sh-toast-ico" aria-hidden>
                <span style={{ display: "grid", width: 20, height: 20 }}>{toast.chat ? I.chats : I.bell}</span>
              </span>
              <span>
                <span className="sh-toast-title" style={{ display: "block" }}>
                  {toast.texto}
                </span>
                <span className="sh-toast-sub">{toast.chat ? t("chToastTap") : t("toastTapToView")}</span>
              </span>
            </button>
          )}
        </div>

        {cuentaTab && <CuentaModal inicial={cuentaTab} onClose={() => setCuentaTab(null)} />}

        {showConfigModal && (
          <Modal title={t("configModalTitle")} icon={<span style={{ display: "grid", width: 20 }}>{I.gear}</span>} onClose={() => setShowConfigModal(false)} maxWidth={1100}>
            <div style={{ background: "var(--bg)", padding: isMobile ? 12 : 22 }}>
              <ConfiguracionEditor />
            </div>
          </Modal>
        )}
      </div>
    </TituloCtx.Provider>
  );
}
