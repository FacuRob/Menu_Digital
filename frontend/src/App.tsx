import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, StaticRouter, Routes, Route, useLocation } from "react-router-dom";
import { LanguageProvider, useLang } from "./lib/i18n";

// Cada página se descarga sólo cuando se visita: la landing no carga el
// código del menú/carrito (ni axios), y el menú no carga la landing.
const Landing = lazy(() => import("./pages/Landing"));
const Menu = lazy(() => import("./pages/Menu"));
const Privacidad = lazy(() => import("./pages/Privacidad"));
const Precios = lazy(() => import("./pages/Precios"));
const Ticket = lazy(() => import("./pages/Ticket"));
const PedirPresupuesto = lazy(() => import("./pages/PedirPresupuesto"));
const Reservar = lazy(() => import("./pages/Reservar"));
const PresupuestoSeguimiento = lazy(() => import("./pages/PresupuestoSeguimiento"));
const ReservaSeguimiento = lazy(() => import("./pages/ReservaSeguimiento"));
const Reparto = lazy(() => import("./pages/Reparto"));
const Seguimiento = lazy(() => import("./pages/Seguimiento"));

// Mientras llega el código de la página se ve el fondo del <html>
// (index.html elige el color según la ruta: sin flash blanco).
const Cargando = () => <div role="status" aria-busy="true" aria-label="Cargando" style={{ minHeight: "100dvh" }} />;

// Dirección oficial de cada página para Google (sin ?mesa=, ?negocio=, etc.).
// /menu/:slug y /negocio/:slug muestran lo mismo: cuenta como una sola.
const SITIO = "https://dinexflow.com.ar";
function Canonica() {
  const { pathname } = useLocation();
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel=canonical]");
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    const ruta = pathname.replace(/\/+$/, "") || "/";
    link.href = SITIO + ruta.replace(/^\/menu\/([^/]+)$/, "/negocio/$1");
  }, [pathname]);
  return null;
}

function NotFound() {
  const { t } = useLang();
  // Que Google no guarde las páginas que no existen (el servidor igual da 200).
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100dvh",
        background: "#0f1117",
        color: "#475569",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>404</div>
        <p>{t("notFound")}</p>
      </div>
    </div>
  );
}

// En el navegador, BrowserRouter. Al compilar (entry-server.tsx) se genera el
// HTML de la landing con StaticRouter: mismo árbol, así React lo reutiliza.
function Router({ url, children }: { url?: string; children: ReactNode }) {
  return url === undefined ? <BrowserRouter>{children}</BrowserRouter> : <StaticRouter location={url}>{children}</StaticRouter>;
}

function App({ url }: { url?: string }) {
  return (
    <LanguageProvider>
      <Router url={url}>
      <Canonica />
      <Suspense fallback={<Cargando />}>
      <Routes>
        {/* Página informativa del producto (landing). */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/menu" element={<Menu />} />
        {/* Menú por negocio (multi-tenant): /menu/:slug */}
        <Route path="/menu/:slug" element={<Menu key="uno" />} />
        {/* Menú general: todos los negocios de la cuenta (QR general). */}
        <Route path="/menu/:slug/todos" element={<Menu key="todos" general />} />
        {/* Ticket de un pedido (link firmado que llega por WhatsApp). */}
        <Route path="/ticket/:id" element={<Ticket />} />
        {/* Seguimiento del delivery: repartidor y cliente (links firmados). */}
        <Route path="/reparto/:id" element={<Reparto />} />
        <Route path="/seguimiento/:id" element={<Seguimiento />} />
        {/* Página pública canónica de cualquier rubro: la misma que /menu/:slug
            (los QR impresos siguen en /menu y no se tocan). */}
        <Route path="/negocio/:slug" element={<Menu key="uno" canonica />} />
        {/* Presupuestos y turnos: pedir y seguir con el link firmado. */}
        <Route path="/negocio/:slug/presupuesto" element={<PedirPresupuesto />} />
        <Route path="/negocio/:slug/reservar" element={<Reservar />} />
        <Route path="/presupuesto/:id" element={<PresupuestoSeguimiento />} />
        <Route path="/reserva/:id" element={<ReservaSeguimiento />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </Router>
    </LanguageProvider>
  );
}

export default App;
