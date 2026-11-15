import { useEffect, useId, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Cargando, Hoja, NoEncontrado } from "../components/HojaNegocio";
import { useNegocioPublico } from "../lib/negocioPublico";
import { adjuntosService, getErrorMessage, presupuestosPublico, productosService, serviciosService } from "../services/api";

// Pedir un presupuesto: /negocio/:slug/presupuesto[?servicio=…|?producto=…]
const MAX_ARCHIVOS = 5;

export default function PedirPresupuesto() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const neg = useNegocioPublico(slug);
  const uid = useId();
  const qs = new URLSearchParams(window.location.search);
  const servicioId = parseInt(qs.get("servicio") || "", 10) || null;
  const productoId = parseInt(qs.get("producto") || "", 10) || null;
  const [referencia, setReferencia] = useState<string | null>(null);
  const [f, setF] = useState({ descripcion: "", cantidad: "1", medidas: "", nombre: "", telefono: "", email: "", wa: false }); // avisos por WhatsApp: sólo si el cliente lo marca
  const [archivos, setArchivos] = useState<{ token: string; nombre: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // Nombre de lo que eligió (si vino desde un servicio o producto).
  useEffect(() => {
    if (!neg || neg === "no" || (!servicioId && !productoId)) return;
    const pedido = servicioId
      ? serviciosService.getDisponibles(neg.id).then((l) => l.find((x) => x.id === servicioId)?.nombre)
      : productosService.getDisponibles(neg.id).then((l) => l.find((x) => x.id === productoId)?.nombre);
    pedido.then((n) => setReferencia(n || null)).catch(() => {});
  }, [neg, servicioId, productoId]);

  if (!neg) return <Cargando />;
  if (neg === "no") return <NoEncontrado titulo="Negocio no encontrado" texto="Revisá que el link esté completo." />;

  const subir = async (file?: File) => {
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) return setError("El archivo pesa más de 10 MB.");
    setSubiendo(true);
    try {
      const r = await adjuntosService.subir(file, neg.id);
      setArchivos((a) => [...a, { token: r.token, nombre: r.nombre }]);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo subir el archivo."));
    } finally {
      setSubiendo(false);
    }
  };

  const enviar = async () => {
    setError("");
    if (f.descripcion.trim().length < 5) return setError("Contanos un poco más qué necesitás.");
    if (!f.nombre.trim()) return setError("Poné tu nombre.");
    if (!f.telefono.trim() && !f.email.trim()) return setError("Dejá un teléfono o un email para responderte.");
    setEnviando(true);
    try {
      const r = await presupuestosPublico.pedir(neg.id, {
        servicio_id: servicioId,
        producto_id: productoId,
        descripcion: f.descripcion.trim(),
        cantidad: Math.max(1, parseInt(f.cantidad, 10) || 1),
        medidas: f.medidas.trim() || null,
        cliente_nombre: f.nombre.trim(),
        telefono: f.telefono.trim() || null,
        email: f.email.trim() || null,
        acepta_whatsapp: f.wa && !!f.telefono.trim(),
        adjuntos: archivos.map((a) => a.token),
      });
      // Al seguimiento (el mismo link que le puede mandar el negocio).
      const url = new URL(r.link!);
      navigate(`${url.pathname}${url.search}`);
    } catch (e) {
      setError(getErrorMessage(e, "No se pudo enviar. Probá de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  const campo = (k: string) => `${uid}-${k}`;
  return (
    <Hoja negocio={neg.config?.nombre} config={neg.config} titulo="Pedí un presupuesto" volver={`/negocio/${slug}`}>
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        {referencia && (
          <p className="rounded-[var(--r-sm)] bg-[var(--bg-2)] px-4 py-3 text-[15px]">
            Sobre: <strong>{referencia}</strong>
          </p>
        )}
        <label htmlFor={campo("desc")} className="block">
          <span className="mn-field-label">¿Qué necesitás?</span>
          <textarea id={campo("desc")} className="mn-field" rows={4} maxLength={3000} required value={f.descripcion}
            placeholder="Contanos lo que buscás: uso, materiales, colores, fechas…"
            onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <label htmlFor={campo("cant")} className="block">
            <span className="mn-field-label">Cantidad</span>
            <input id={campo("cant")} className="mn-field" type="number" min={1} inputMode="numeric" value={f.cantidad}
              onChange={(e) => setF({ ...f, cantidad: e.target.value })} />
          </label>
          <label htmlFor={campo("med")} className="block">
            <span className="mn-field-label">Medidas o características (opcional)</span>
            <input id={campo("med")} className="mn-field" maxLength={300} value={f.medidas} placeholder="Ej.: 120 × 60 cm"
              onChange={(e) => setF({ ...f, medidas: e.target.value })} />
          </label>
        </div>

        <div>
          <span className="mn-field-label" id={campo("arch")}>Fotos o archivos de referencia (opcional)</span>
          <div aria-live="polite">
          {archivos.length > 0 && (
            <ul className="mb-2 grid gap-1 text-[14px]">
              {archivos.map((a) => (
                <li key={a.token} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{a.nombre}</span>
                  <button type="button" className="mn-btn mn-btn-borde" aria-label={`Quitar ${a.nombre}`}
                    onClick={() => setArchivos((l) => l.filter((x) => x.token !== a.token))}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          </div>
          {archivos.length < MAX_ARCHIVOS && (
            <label className="mn-btn mn-btn-borde w-full cursor-pointer">
              {subiendo ? "Subiendo…" : "Agregar archivo"}
              <input type="file" className="sr-only" accept="image/*,application/pdf,.stl,.obj,.3mf" disabled={subiendo}
                aria-labelledby={campo("arch")}
                onChange={(e) => {
                  subir(e.target.files?.[0]);
                  e.target.value = "";
                }} />
            </label>
          )}
          <p className="mt-1.5 text-[13px] text-[var(--fg-2)]">
            Hasta {MAX_ARCHIVOS} archivos ({archivos.length}/{MAX_ARCHIVOS}): imágenes, PDF o 3D (STL, OBJ, 3MF), de hasta 10 MB. Sólo los ve el negocio.
          </p>
        </div>

        <fieldset className="grid gap-4 border-t border-[var(--line)] pt-5">
          <legend className="mn-field-label">Tus datos</legend>
          <label htmlFor={campo("nom")} className="block">
            <span className="mn-field-label">Nombre</span>
            <input id={campo("nom")} className="mn-field" maxLength={120} required autoComplete="name" value={f.nombre}
              onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          </label>
          <label htmlFor={campo("tel")} className="block">
            <span className="mn-field-label">Teléfono</span>
            <input id={campo("tel")} className="mn-field" type="tel" inputMode="tel" maxLength={40} autoComplete="tel" value={f.telefono}
              onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          </label>
          <label htmlFor={campo("mail")} className="block">
            <span className="mn-field-label">Email (si no dejás teléfono)</span>
            <input id={campo("mail")} className="mn-field" type="email" maxLength={160} autoComplete="email" value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })} />
          </label>
          {f.telefono.trim() && (
            <label className="mn-opcion items-start">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={f.wa} aria-describedby={campo("wa-ayuda")} onChange={(e) => setF({ ...f, wa: e.target.checked })} />
              <span>
                <span className="block text-[15px]">Quiero recibir avisos de mi presupuesto por WhatsApp al {f.telefono.trim()}</span>
                <span id={campo("wa-ayuda")} className="mt-0.5 block text-[13px] text-[var(--fg-2)]">Sólo mensajes sobre este presupuesto. Podés pedir que no te escriban más cuando quieras.</span>
              </span>
            </label>
          )}
        </fieldset>

        {error && <p role="alert" className="text-[14px] font-semibold text-[var(--err)]">{error}</p>}
        <button type="submit" className="mn-btn w-full" disabled={enviando || subiendo} aria-busy={enviando}>
          {enviando ? "Enviando…" : "Enviar pedido de presupuesto"}
        </button>
      </form>
    </Hoja>
  );
}
