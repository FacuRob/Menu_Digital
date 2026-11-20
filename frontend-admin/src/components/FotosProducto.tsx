import { useEffect, useRef, useState } from "react";
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
    if (a < 0 || a >= fotos.length) return;
    const nueva = fotos.slice();
    const [f] = nueva.splice(i, 1);
    nueva.splice(a, 0, f);
    onChange(nueva);
    setAviso(t("prodFotoMovida", { n: a + 1, total: nueva.length }));
  };

  return (
    <div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))",
          gap: 12,
        }}
      >
        {fotos.map((f, i) => (
          <li key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ position: "relative" }}>
              <img
                src={f.url ? cld(f.url, { w: 240, h: 240, fill: true }) || f.url : f.preview}
                alt={t("prodFotoN", { n: i + 1 })}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: 12,
                  border: i === 0 ? "2px solid var(--accent)" : "1px solid var(--line)",
                  display: "block",
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
      <p className="sr-only" role="status">
        {aviso}
      </p>
      <p id="fotos-ayuda" style={{ margin: "10px 0 0", fontSize: 12, color: "var(--fg-3)" }}>
        {t("prodFotosAyuda")} {t("prodImageHint")}
      </p>
    </div>
  );
}
