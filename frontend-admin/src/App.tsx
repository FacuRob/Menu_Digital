import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { NegocioProvider } from "./context/NegocioContext";
import { LanguageProvider, useLang } from "./lib/i18n";
import ProtectedRoute from "./components/ProtectedRoute";
import LoadingScreen from "./components/LoadingScreen";
import { DialogosProvider } from "./components/Dialogos";

// Cada pantalla se descarga recién cuando se visita: el login no baja el
// código de pedidos, productos, QR, etc.
const Login = lazy(() => import("./pages/admin/Login"));
const ResetPassword = lazy(() => import("./pages/admin/ResetPassword"));
const CambiarPassword = lazy(() => import("./pages/admin/CambiarPassword"));
const Onboarding = lazy(() => import("./pages/admin/Onboarding"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const Categorias = lazy(() => import("./pages/admin/Categorias"));
const Productos = lazy(() => import("./pages/admin/Productos"));
const QRCode = lazy(() => import("./pages/admin/QRCode"));
const Usuarios = lazy(() => import("./pages/admin/Usuarios"));
const Configuracion = lazy(() => import("./pages/admin/Configuracion"));
const Pedidos = lazy(() => import("./pages/admin/Pedidos"));
const Negocios = lazy(() => import("./pages/admin/Negocios"));
const Plataforma = lazy(() => import("./pages/admin/Plataforma"));
const Suscripcion = lazy(() => import("./pages/admin/Suscripcion"));
const MenuPreview = lazy(() => import("./pages/MenuPreview"));
const WhatsApp = lazy(() => import("./pages/admin/WhatsApp"));
const Chats = lazy(() => import("./pages/admin/Chats"));

// Mientras llega el código de la pantalla. En las secciones del panel se ve la
// pantalla de carga animada; en el login y el menú público, solo el fondo
// (sin flash blanco).
function Cargando() {
  const { isDark } = useTheme();
  const path = window.location.pathname;
  const enLogin = /\/admin\/(login|reset-password)/.test(path);
  if (path.startsWith("/admin/") && !enLogin) return <LoadingScreen />;
  return (
    <div
      style={{
        minHeight: "100vh",
        background: enLogin ? "#060912" : isDark ? "#0f1117" : "#f0f2f5",
      }}
    />
  );
}

function App() {
  return (
    <LanguageProvider>
    <ThemeProvider>
      <DialogosProvider>
      <AuthProvider>
        <NegocioProvider>
        <BrowserRouter>
        <Suspense fallback={<Cargando />}>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />

          {/* Ruta especial — accesible estando autenticado pero con must_change_password */}
          <Route
            path="/admin/cambiar-password"
            element={
              <ProtectedRoute>
                <CambiarPassword />
              </ProtectedRoute>
            }
          />

          {/* Onboarding post-registro: calibración inicial del negocio. */}
          <Route
            path="/admin/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/categorias"
            element={
              <ProtectedRoute permiso="categorias">
                <Categorias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/productos"
            element={
              <ProtectedRoute permiso="productos">
                <Productos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/qr"
            element={
              <ProtectedRoute permiso="qr">
                <QRCode />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/pedidos"
            element={
              <ProtectedRoute permiso="pedidos">
                <Pedidos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/configuracion"
            element={
              <ProtectedRoute permiso="configuracion">
                <Configuracion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/chats"
            element={
              <ProtectedRoute permiso="pedidos">
                <Chats />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/whatsapp"
            element={
              <ProtectedRoute permiso="configuracion">
                <WhatsApp />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/usuarios"
            element={
              <ProtectedRoute permiso="usuarios">
                <Usuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/negocios"
            element={
              <ProtectedRoute permiso="negocios">
                <Negocios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/plataforma"
            element={
              <ProtectedRoute plataforma>
                <Plataforma />
              </ProtectedRoute>
            }
          />
          {/* Suscripción: accesible aunque el plan esté vencido para poder
              comprar/renovar. Reservada al dueño (SuperAdmin): el permiso
              "suscripcion" sólo lo cubre el "*" del rol 'admin'. */}
          <Route
            path="/admin/suscripcion"
            element={
              <ProtectedRoute permiso="suscripcion">
                <Suscripcion />
              </ProtectedRoute>
            }
          />

          {/* Vista previa del menú público de un negocio: /menu/:slug
              (o /menu?negocio=<id> si el negocio aún no tiene slug). */}
          <Route path="/menu" element={<MenuPreview />} />
          <Route path="/menu/:slug" element={<MenuPreview />} />

          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </BrowserRouter>
        </NegocioProvider>
      </AuthProvider>
      </DialogosProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

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

export default App;
