import { createContext, useContext, useLayoutEffect } from "react";

// Título de la sección actual: cada pantalla lo informa y la estructura del
// panel (AdminShell) lo muestra arriba y en la pestaña del navegador.
// Módulo aparte y liviano: lo usa también ProtectedRoute sin cargar el menú.
export const TituloCtx = createContext<((t: string) => void) | null>(null);

export function useTituloPagina(titulo: string) {
  const setTitulo = useContext(TituloCtx);
  useLayoutEffect(() => {
    setTitulo?.(titulo);
  }, [titulo, setTitulo]);
}
