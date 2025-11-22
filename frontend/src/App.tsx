import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Categorias from './pages/admin/Categorias';
import Productos from './pages/admin/Productos';
import QRCode from './pages/admin/QRCode';
import Menu from './pages/Menu';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />

          <Route path="/menu" element={<Menu />} />

          <Route path="/admin/login" element={<Login />} />
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
              <ProtectedRoute>
                <Categorias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/productos"
            element={
              <ProtectedRoute>
                <Productos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/qr"
            element={
              <ProtectedRoute>
                <QRCode />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<div className="flex items-center justify-center h-screen"><h1 className="text-2xl">404 - Página no encontrada</h1></div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;