import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { sinMovimiento } from "./movimiento";

gsap.registerPlugin(ScrollTrigger);

// En celulares la barra del navegador cambia el alto al scrollear: no
// recalcular las escenas por eso (evita saltos).
ScrollTrigger.config({ ignoreMobileResize: true });


// Desplazamiento suave (Lenis) sincronizado con ScrollTrigger.
// Con "reducir movimiento" activado no se instala: scroll nativo.
export function useSmoothScroll() {
  useEffect(() => {
    if (sinMovimiento()) return;
    const lenis = new Lenis({ anchors: { offset: -72 }, lerp: 0.11 });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
}
