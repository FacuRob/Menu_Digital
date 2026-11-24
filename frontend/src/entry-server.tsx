// Sólo para el build (scripts/prerender.mjs): genera el HTML de una ruta con
// el mismo árbol que main.tsx, así la landing llega con texto sin JavaScript.
// prerender espera a que carguen las páginas lazy (render a string no).
import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import App from "./App";

export async function render(url: string): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <App url={url} />
    </StrictMode>,
  );
  return new Response(prelude).text();
}
