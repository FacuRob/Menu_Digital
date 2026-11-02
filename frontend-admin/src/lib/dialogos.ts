import { createContext, useContext } from "react";

// Diálogos con estilo que reemplazan a confirm() y alert() del navegador.
// El proveedor (que los dibuja) está en components/Dialogos.tsx.
//   const { confirmar, avisar } = useDialogos();
//   if (!(await confirmar({ mensaje: "¿Borrar?", peligro: true }))) return;
//   void avisar({ mensaje: "No se pudo guardar", tipo: "error" });

export interface DialogosApi {
  confirmar: (o: {
    mensaje: string;
    titulo?: string;
    confirmarTexto?: string;
    peligro?: boolean;
  }) => Promise<boolean>;
  avisar: (o: { mensaje: string; titulo?: string; tipo?: "info" | "error" }) => Promise<void>;
}

export const DialogosContext = createContext<DialogosApi | null>(null);

export function useDialogos() {
  const api = useContext(DialogosContext);
  if (!api) throw new Error("useDialogos debe usarse dentro de DialogosProvider");
  return api;
}
