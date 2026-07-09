import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NegocioProvider } from "./context/NegocioContext";
import { LanguageProvider } from "./lib/i18n";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/admin/Login";
import CambiarPassword from "./pages/admin/CambiarPassword";
import Dashboard from "./pages/admin/Dashboard";
import Categorias from "./pages/admin/Categorias";
import Productos from "./pages/admin/Productos";
import QRCode from "./pages/admin/QRCode";
import Usuarios from "./pages/admin/Usuarios";
import Configuracion from "./pages/admin/Configuracion";
import Pedidos from "./pages/admin/Pedidos";
import Negocios from "./pages/admin/Negocios";
import Plataforma from "./pages/admin/Plataforma";

function App() {
  return (
    <LanguageProvider>
    <ThemeProvider>
      <AuthProvider>
        <NegocioProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
          <Route path="/admin/login" element={<Login />} />

          {/* Ruta especial — accesible estando autenticado pero con must_change_password */}
          <Route
            path="/admin/cambiar-password"
            element={
              <ProtectedRoute>
                <CambiarPassword />
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
            path="/admin/usuarios"
            element={
              <ProtectedRoute permiso="*">
                <Usuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/negocios"
            element={
              <ProtectedRoute permiso="*">
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

          <Route
            path="*"
            element={
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
                  <p>Página no encontrada</p>
                </div>
              </div>
            }
          />
          </Routes>
        </BrowserRouter>
        </NegocioProvider>
      </AuthProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
