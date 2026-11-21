import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "../lib/i18n";
import { cld } from "../lib/cloudinary";
import { IconImage, IconX } from "../lib/icons";

// Varias fotos de un producto, en orden: la primera es la principal (la que
// se ve en la tarjeta del menú). Las nuevas se suben al guardar.
export type Foto = { key: string; url?: string; file?: File; preview: string };

export const MAX_FOTOS = 6;

let seq = 0;
export const fotoDeUrl = (url: string): Foto => ({ key: `u${seq++}`, url, preview: url });
const fotoDeArchivo = (file: File): Foto => ({ key: `f${seq++}`, file, preview: URL.createObjectURL(file) });

// Fotos guardadas de un producto: la lista o, si no hay, la foto de siempre.
export const fotosDeProducto = (p?: { imagenes?: string[] | null; imagen_url?: string | null } | null): Foto[] => {
  const lista = p?.imagenes?.length ? p.imagenes : p?.imagen_url ? [p.imagen_url] : [];
  return lista.map(fotoDeUrl);
};

// Firma para saber si cambió algo (orden, fotos nuevas o quitadas).
export const firmaFotos = (fotos: Foto[]) => fotos.map((f) => f.url ?? f.key).join("|");

// Copia de la lista con la foto i llevada al lugar a.
const moverEn = (lista: Foto[], i: number, a: number) => {
  const nueva = lista.slice();
  const [f] = nueva.splice(i, 1);
  nueva.splice(a, 0, f);
  return nueva;
};

const Flecha = ({ izq }: { izq?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={izq ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

// 44 px: se tocan bien con el dedo.
const botonChico: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 8,
  border: "1px solid var(--line-strong)",
  background: "var(--surface)",
  color: "var(--fg-2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

export default function FotosProducto({
  fotos,
  onChange,
  onError,
}: {
  fotos: Foto[];
  onChange: (f: Foto[]) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const quedan = MAX_FOTOS - fotos.length;
  // Aviso para lectores de pantalla al mover una foto.
  const [aviso, setAviso] = useState("");

  // Al cerrar, libera las vistas previas de fotos que no se subieron.
  const fotosRef = useRef(fotos);
  fotosRef.current = fotos;
  useEffect(
    () => () => fotosRef.current.forEach((f) => f.file && URL.revokeObjectURL(f.preview)),
    [],
  );

  const agregar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(e.target.files || []);
    e.target.value = "";
    if (!archivos.length) return;
    onError(archivos.length > quedan ? t("prodFotosMax", { n: MAX_FOTOS }) : "");
    onChange([...fotos, ...archivos.slice(0, quedan).map(fotoDeArchivo)]);
  };

  const quitar = (i: number) => {
    const f = fotos[i];
    if (f.file) URL.revokeObjectURL(f.preview);
    onError("");
    onChange(fotos.filter((_, j) => j !== i));
  };

  const mover = (i: number, a: number) => {
    if (a < 0 || a >= fotos.length || a === i) return;
    onChange(moverEn(fotos, i, a));
    setAviso(t("prodFotoMovida", { n: a + 1, total: fotos.length }));
  };

  // ── Arrastrar para ordenar (mouse y dedo) ──
  // Mouse: se arrastra apenas se mueve. Dedo: hay que dejarlo apretado un
  // instante; si se desliza antes, es un scroll normal de la ventana.
  const listaRef = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ desde: number; sobre: number; x: number; y: number; w: number; ox: number; oy: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  // Mientras se arrastra con el dedo, el dedo no desplaza la ventana.
  useEffect(() => {
    const ul = listaRef.current;
    if (!ul) return;
    const frenar = (e: TouchEvent) => {
      if (dragRef.current) e.preventDefault();
    };
    ul.addEventListener("touchmove", frenar, { passive: false });
    return () => ul.removeEventListener("touchmove", frenar);
  }, []);

  const empezar = (e: React.PointerEvent, i: number) => {
    if (fotos.length < 2 || e.button !== 0) return;
    // Lugares de cada foto al empezar: el destino sale de sobre cuál está el puntero.
    const lugares = Array.from(listaRef.current?.querySelectorAll<HTMLElement>("[data-foto]") ?? []).map((el) =>
      el.getBoundingClientRect(),
    );
    const x0 = e.clientX;
    const y0 = e.clientY;
    const w = lugares[i]?.width ?? 116;
    // Punto de la foto donde se agarró: la copia queda tomada de ahí, sin saltar.
    const ox = x0 - (lugares[i]?.left ?? x0 - w / 2);
    const oy = y0 - (lugares[i]?.top ?? y0 - w / 2);
    const esDedo = e.pointerType !== "mouse";
    let activo = false;
    let timer = 0;

    const destino = (x: number, y: number) => {
      let mejor = i;
      let dist = Infinity;
      lugares.forEach((r, j) => {
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
        if (d < dist) [dist, mejor] = [d, j];
      });
      return mejor;
    };
    const activar = (x: number, y: number) => {
      activo = true;
      navigator.vibrate?.(15);
      setDrag({ desde: i, sobre: destino(x, y), x, y, w, ox, oy });
    };
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const lejos = Math.hypot(ev.clientX - x0, ev.clientY - y0) > (esDedo ? 10 : 5);
      if (!activo) {
        if (esDedo) {
          if (lejos) terminar(); // se movió antes de tiempo: era un scroll
        } else if (lejos) activar(ev.clientX, ev.clientY);
        return;
      }
      setDrag((d) => d && { ...d, x: ev.clientX, y: ev.clientY, sobre: destino(ev.clientX, ev.clientY) });
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const d = dragRef.current;
      if (activo && d) mover(d.desde, d.sobre);
      terminar();
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && terminar();
    const terminar = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", terminar);
      window.removeEventListener("keydown", onKey, true);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", terminar);
    window.addEventListener("keydown", onKey, true);
    if (esDedo) timer = window.setTimeout(() => activar(x0, y0), 250);
  };

  // Mientras se arrastra, la lista se ve ya reordenada.
  const vista = drag ? moverEn(fotos, drag.desde, drag.sobre) : fotos;
  const arrastrada = drag ? fotos[drag.desde] : null;
  const srcDe = (f: Foto) => (f.url ? cld(f.url, { w: 240, h: 240, fill: true }) || f.url : f.preview);

  return (
    <div>
      <ul
        ref={listaRef}
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(116px, 100%), 1fr))",
          gap: 12,
        }}
      >
        {vista.map((f, i) => (
          <li key={f.key} data-foto style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              style={{
                position: "relative",
                cursor: fotos.length > 1 ? (drag ? "grabbing" : "grab") : undefined,
                opacity: f === arrastrada ? 0.35 : 1,
                touchAction: drag ? "none" : "manipulation",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
              }}
              onPointerDown={(e) => {
                // La X de quitar no arrastra.
                if ((e.target as HTMLElement).closest("button")) return;
                empezar(e, fotos.indexOf(f));
              }}
              onContextMenu={(e) => fotos.length > 1 && e.preventDefault()}
              title={fotos.length > 1 ? t("prodFotoArrastrar") : undefined}
            >
              <img
                src={srcDe(f)}
                alt={t("prodFotoN", { n: i + 1 })}
                loading="lazy"
                decoding="async"
                draggable={false}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: 12,
                  border: i === 0 ? "2px solid var(--accent)" : "1px solid var(--line)",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
              {i === 0 && (
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    bottom: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                  }}
                >
                  {t("prodFotoPrincipal")}
                </span>
              )}
              {f.file && (
                <span
                  style={{
                    position: "absolute",
                    left: 6,
                    top: 6,
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 999,
                    background: "var(--surface)",
                    color: "var(--info)",
                    border: "1px solid var(--line)",
                  }}
                >
                  {t("prodFotoNueva")}
                </span>
              )}
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label={t("prodFotoQuitar", { n: i + 1 })}
                title={t("prodFotoQuitar", { n: i + 1 })}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 44,
                  height: 44,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--err)",
                    border: "2px solid var(--surface)",
                    color: "var(--surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <IconX size={13} />
                </span>
              </button>
            </div>
            {fotos.length > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => mover(i, i - 1)}
                  aria-disabled={i === 0}
                  aria-label={t("prodFotoAntes", { n: i + 1 })}
                  title={t("prodFotoAntes", { n: i + 1 })}
                  style={{ ...botonChico, opacity: i === 0 ? 0.35 : 1, cursor: i === 0 ? "default" : "pointer" }}
                >
                  <Flecha izq />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  aria-disabled={i === fotos.length - 1}
                  aria-label={t("prodFotoDespues", { n: i + 1 })}
                  title={t("prodFotoDespues", { n: i + 1 })}
                  style={{
                    ...botonChico,
                    opacity: i === fotos.length - 1 ? 0.35 : 1,
                    cursor: i === fotos.length - 1 ? "default" : "pointer",
                  }}
                >
                  <Flecha />
                </button>
              </div>
            )}
          </li>
        ))}

        {quedan > 0 && (
          <li>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-describedby="fotos-ayuda"
              className="hover:!border-[var(--focus)]"
              style={{
                width: "100%",
                aspectRatio: "1",
                border: "2px dashed var(--line-strong)",
                borderRadius: 12,
                padding: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                textAlign: "center",
                cursor: "pointer",
                background: "var(--surface-2)",
                font: "inherit",
                color: "var(--fg-3)",
              }}
            >
              <IconImage size={22} />
              <span style={{ color: "var(--fg-2)", fontSize: 12.5, fontWeight: 600 }}>
                {fotos.length ? t("prodFotoAgregar") : t("prodSelectImage")}
              </span>
              <span style={{ fontSize: 11 }}>{t("prodFotosQuedan", { n: quedan })}</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={agregar}
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden
      />
      {/* Copia que sigue al puntero mientras se arrastra. Va con portal a
          <body>: el modal usa backdrop-filter, que vuelve "fixed" relativo al
          modal y la copia aparecía corrida respecto del mouse. */}
      {drag && arrastrada && createPortal(
        <img
          src={srcDe(arrastrada)}
          alt=""
          aria-hidden
          style={{
            position: "fixed",
            left: drag.x - drag.ox,
            top: drag.y - drag.oy,
            width: drag.w,
            height: drag.w,
            objectFit: "cover",
            borderRadius: 12,
            border: "2px solid var(--accent)",
            boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
            transform: "scale(1.05) rotate(-2deg)",
            pointerEvents: "none",
            zIndex: 1000,
          }}
        />,
        document.body,
      )}
      <p className="sr-only" role="status">
        {aviso}
      </p>
      <p id="fotos-ayuda" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
        {t("prodFotosAyuda")} {t("prodImageHint")}
      </p>
    </div>
  );
}
