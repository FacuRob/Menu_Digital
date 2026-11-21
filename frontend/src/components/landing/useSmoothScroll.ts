import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sinMovimiento } from "./movimiento";

gsap.registerPlugin(ScrollTrigger);

// En celulares la barra del navegador cambia el alto al scrollear: no
// recalcular las escenas por eso (evita saltos).
ScrollTrigger.config({ ignoreMobileResize: true });

const ALTO_BARRA = 72; // la barra fija de arriba (h-[4.5rem])

// Adónde scrollear para mostrar una sección. Las escenas fijadas por GSAP
// (inicio, teléfono) se mueven mientras están fijas: su posición real es la
// de su contenedor (.pin-spacer), y arrancan pegadas arriba (ocupan toda la
// pantalla). Las demás quedan justo debajo de la barra.
function destino(el: HTMLElement) {
  const spacer = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : null;
  const top = (spacer ?? el).getBoundingClientRect().top + window.scrollY;
  return Math.max(0, spacer ? top : top - ALTO_BARRA);
}

// Desplazamiento suave (Lenis) sincronizado con ScrollTrigger.
// Con "reducir movimiento" activado no se instala: scroll nativo.
export function useSmoothScroll() {
  useEffect(() => {
    if (sinMovimiento()) return;
    const lenis = new Lenis({ lerp: 0.11 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Links internos (#seccion): los manejamos acá en vez de con las anclas
    // de Lenis, que miden mal las secciones fijadas.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]');
      const id = a?.getAttribute("href")?.slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(id === "top" ? 0 : destino(el));
      history.pushState(null, "", `#${id}`);
      if (id === "contenido") {
        // Link "Saltar al contenido": el foco también tiene que ir ahí.
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
}
