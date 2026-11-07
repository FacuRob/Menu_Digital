import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider, useLang } from "./lib/i18n";

// Cada página se descarga sólo cuando se visita: la landing no carga el
// código del menú/carrito (ni axios), y el menú no carga la landing.
const Landing = lazy(() => import("./pages/Landing"));
const Menu = lazy(() => import("./pages/Menu"));
const Privacidad = lazy(() => import("./pages/Privacidad"));

// Mientras llega el código de la página se ve el fondo del <html>
// (index.html elige el color según la ruta: sin flash blanco).
const Cargando = () => <div role="status" aria-busy="true" aria-label="Cargando" style={{ minHeight: "100vh" }} />;

function NotFound() {
  const { t } = useLang();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
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

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
      <Suspense fallback={<Cargando />}>
      <Routes>
        {/* Página informativa del producto (landing). */}
        <Route path="/" element={<Landing />} />
        <Route path="/privacidad" element={<Privacidad />} />
        <Route path="/menu" element={<Menu />} />
        {/* Menú por negocio (multi-tenant): /menu/:slug */}
        <Route path="/menu/:slug" element={<Menu />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </BrowserRouter>
    </LanguageProvider>
  );
}

export default App;
