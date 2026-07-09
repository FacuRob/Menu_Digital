import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Menu from "./pages/Menu";
import { LanguageProvider } from "./lib/i18n";

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<Menu />} />

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
    </LanguageProvider>
  );
}

export default App;
