import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/admin/Login";
import CambiarPassword from "./pages/admin/CambiarPassword";
import Dashboard from "./pages/admin/Dashboard";
import Categorias from "./pages/admin/Categorias";
import Productos from "./pages/admin/Productos";
import QRCode from "./pages/admin/QRCode";
import Usuarios from "./pages/admin/Usuarios";
import Menu from "./pages/Menu";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<Menu />} />
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
            path="/admin/usuarios"
            element={
              <ProtectedRoute permiso="*">
                <Usuarios />
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
    </AuthProvider>
  );
}

export default App;
