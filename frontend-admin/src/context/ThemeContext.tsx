import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Fondo de cada tema (para la barra del navegador en el celular).
const FONDO: Record<Theme, string> = { light: "#f4f2ec", dark: "#0d0e11" };

// Primera vez: el tema del sistema. Después, lo que eligió el usuario.
function temaInicial(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* sin storage */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(temaInicial);

  // Elección explícita: se recuerda y deja de seguir al sistema.
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* sin storage */
    }
  };

  // Sin elección guardada: acompaña al tema del sistema si cambia.
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = () => {
      let guardado: string | null = null;
      try {
        guardado = localStorage.getItem("theme");
      } catch {
        /* sin storage */
      }
      if (guardado !== "dark" && guardado !== "light") setThemeState(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // El tema vive en <html data-theme>: así lo ven el CSS (tokens.css),
  // Tailwind y los portales (modales, desplegables).
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.theme = theme;
    html.style.background = "";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", FONDO[theme]);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark: theme === "dark" }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return context;
}
