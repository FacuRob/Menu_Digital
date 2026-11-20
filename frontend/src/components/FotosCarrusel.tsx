import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProductImage } from "../lib/menuUi";
import { useLang } from "../lib/i18n";

// Fotos de un producto: se pasan deslizando con el dedo (scroll horizontal
// con "snap") o con las flechas. Con una sola foto es una imagen común.
export default function FotosCarrusel({
  fotos,
  alt,
  children,
}: {
  fotos: string[];
  alt: string;
  // Lo que va encima de la foto (botón de volver).
  children?: ReactNode;
}) {
  const { t } = useLang();
  const pistaRef = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  // El aviso para lectores de pantalla arranca después del primer cambio.
  const [movio, setMovio] = useState(false);
  const varias = fotos.length > 1;

  // La foto visible sale de cuánto se deslizó (dedo, trackpad o flechas).
  useEffect(() => {
    const pista = pistaRef.current;
    if (!pista || !varias) return;
    const onScroll = () => {
      const i = Math.round(pista.scrollLeft / Math.max(1, pista.clientWidth));
      const n = Math.min(fotos.length - 1, Math.max(0, i));
      if (n !== 0) setMovio(true);
      setActual(n);
    };
    pista.addEventListener("scroll", onScroll, { passive: true });
    return () => pista.removeEventListener("scroll", onScroll);
  }, [varias, fotos.length]);

  const ir = (i: number) => {
    const pista = pistaRef.current;
    if (!pista) return;
    const destino = (i + fotos.length) % fotos.length;
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pista.scrollTo({ left: destino * pista.clientWidth, behavior: suave ? "smooth" : "auto" });
  };

  return (
    <div
      className="relative h-[260px] bg-[var(--bg-2)]"
      role={varias ? "region" : undefined}
      aria-roledescription={varias ? t("photosCarousel") : undefined}
      aria-label={varias ? alt : undefined}
    >
      {/* Enfocable (se desplaza): con el teclado se pasa con ← y →. */}
      <div
        ref={pistaRef}
        className="mn-fotos h-full"
        tabIndex={varias ? 0 : undefined}
        aria-label={varias ? t("photoOf", { n: actual + 1, total: fotos.length }) : undefined}
        onKeyDown={(e) => {
          if (!varias || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
          e.preventDefault();
          ir(actual + (e.key === "ArrowLeft" ? -1 : 1));
        }}
      >
        {(fotos.length ? fotos : [null]).map((url, i) => (
          <div
            key={`${i}-${url ?? ""}`}
            className="mn-foto h-full"
            role={varias ? "group" : undefined}
            aria-roledescription={varias ? t("photoSlide") : undefined}
            aria-label={varias ? t("photoOf", { n: i + 1, total: fotos.length }) : undefined}
            aria-hidden={varias && i !== actual ? true : undefined}
          >
            <ProductImage
              url={url}
              alt={alt}
              w={720}
              h={520}
              fill
              eager={i === 0}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ))}
      </div>

      {children}

      {varias && (
        <>
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label={t("photoPrev")}
            className="mn-icon-btn mn-foto-flecha absolute left-3 top-1/2 -translate-y-1/2"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label={t("photoNext")}
            className="mn-icon-btn mn-foto-flecha absolute right-3 top-1/2 -translate-y-1/2"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
          <div className="mn-foto-puntos absolute bottom-3 left-1/2 -translate-x-1/2" aria-hidden>
            {fotos.map((_, i) => (
              <span key={i} className={i === actual ? "mn-foto-punto is-on" : "mn-foto-punto"} />
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            {movio ? t("photoOf", { n: actual + 1, total: fotos.length }) : ""}
          </p>
        </>
      )}
    </div>
  );
}
