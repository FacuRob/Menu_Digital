import { useState, useMemo, useEffect, useRef } from "react";
import type { Producto, VarianteGrupo } from "../services/api";
import type { SelectedOption } from "../hooks/useCart";
import { fmt, neto, ProductImage, esPorPeso, fmtPeso, redondearKg, PASO_KG } from "../lib/menuUi";
import { useLang } from "../lib/i18n";
import CamposCliente, { type ValorCampo } from "./CamposCliente";
import { faltanCampos } from "../lib/campos";

// Estado de selección: grupo_id → set de opcion_id elegidas.
type Sel = Record<number, number[]>;

// Opción con stock cargado y en 0: no se puede elegir (talle agotado, etc.).
const agotada = (o: { stock?: number | null }) => o.stock !== null && o.stock !== undefined && Number(o.stock) <= 0;

export default function ProductModal({
  producto,
  onClose,
  onAdd,
  contacto,
}: {
  producto: Producto;
  onClose: () => void;
  // Sin onAdd (el negocio no toma pedidos online) el detalle es sólo para ver.
  onAdd?: (
    producto: Producto,
    cantidad: number,
    opciones: SelectedOption[],
    personalizacion: ValorCampo[],
  ) => void;
  // Sin pedidos online: link para consultar al negocio (WhatsApp).
  contacto?: string | null;
}) {
  const { t } = useLang();
  // Por peso la cantidad va en kg (arranca en 250 g); si no, en unidades.
  const porPeso = esPorPeso(producto);
  const [cantidad, setCantidad] = useState(porPeso ? 0.25 : 1);
  const minimo = porPeso ? PASO_KG : 1;
  const paso = porPeso ? PASO_KG : 1;
  const grupos = useMemo<VarianteGrupo[]>(
    () => (Array.isArray(producto.variantes) ? producto.variantes : []),
    [producto],
  );

  // Preselección: grupos single obligatorios arrancan con su primera opción
  // con stock.
  const [sel, setSel] = useState<Sel>(() => {
    const init: Sel = {};
    for (const g of Array.isArray(producto.variantes) ? producto.variantes : []) {
      const primera = g.opciones.find((o) => !agotada(o));
      if (g.tipo === "single" && g.obligatorio && primera) {
        init[g.id] = [primera.id];
      } else {
        init[g.id] = [];
      }
    }
    return init;
  });

  const toggle = (g: VarianteGrupo, opcionId: number) => {
    setSel((prev) => {
      const cur = prev[g.id] || [];
      if (g.tipo === "single") {
        return { ...prev, [g.id]: [opcionId] };
      }
      // multi: alterna
      return {
        ...prev,
        [g.id]: cur.includes(opcionId)
          ? cur.filter((id) => id !== opcionId)
          : [...cur, opcionId],
      };
    });
  };

  // Opciones elegidas, aplanadas.
  const elegidas = useMemo<SelectedOption[]>(() => {
    const out: SelectedOption[] = [];
    for (const g of grupos) {
      for (const opId of sel[g.id] || []) {
        const op = g.opciones.find((o) => o.id === opId);
        if (op) {
          out.push({
            grupo_id: g.id,
            grupo_nombre: g.nombre,
            opcion_id: op.id,
            nombre: op.nombre,
            precio_extra: Number(op.precio_extra || 0),
          });
        }
      }
    }
    return out;
  }, [grupos, sel]);

  // Faltan grupos obligatorios sin elegir → no se puede agregar.
  // Personalización (campos que completa el cliente).
  const campos = useMemo(() => (Array.isArray(producto.campos) ? producto.campos : []), [producto]);
  const [valores, setValores] = useState<Record<number, ValorCampo>>({});
  const faltanVariantes = grupos.some((g) => g.obligatorio && (sel[g.id]?.length ?? 0) === 0);
  const camposFaltantes = faltanCampos(campos, valores);
  const faltanObligatorios = faltanVariantes || camposFaltantes.length > 0;
  // Al tocar "Agregar" con campos sin completar: se marcan y se avisa cuáles.
  const [intentos, setIntentos] = useState(0);
  const intento = intentos > 0;

  const base = Number(producto.precio);
  const extra = elegidas.reduce((a, o) => a + o.precio_extra, 0);
  const unit = base + extra;

  // Tras tocar "Agregar" con campos sin completar: foco al primero marcado.
  useEffect(() => {
    if (intentos) hojaRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [intentos]);

  // Escape cierra; el foco entra a la hoja y vuelve al cerrar.
  const hojaRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onClose);
  useEffect(() => {
    cerrarRef.current = onClose;
  });
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    hojaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrarRef.current();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previo?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex justify-center">
      <div className="mn-velo" onClick={onClose} style={{ animation: "mn-in .2s ease both" }} />
      <div
        ref={hojaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="producto-titulo"
        tabIndex={-1}
        className="mn-sube relative max-h-[92vh] w-full max-w-[460px] self-end overflow-y-auto rounded-t-[var(--r-lg)] bg-[var(--surface)] outline-none sm:m-4 sm:self-center sm:rounded-[var(--r-lg)]"
      >
        {/* Imagen */}
        <div className="relative h-[260px] bg-[var(--bg-2)]">
          <ProductImage url={producto.imagen_url} alt={producto.nombre} w={920} h={520} fill style={{ width: "100%", height: "100%" }} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t("back")}
            className="mn-icon-btn absolute left-3 top-3 bg-[var(--surface)] text-[var(--fg)] ring-1 ring-[var(--line)]"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div className="px-5 pb-6 pt-5">
          <h2 id="producto-titulo" className="mn-display text-[1.75rem]">
            {producto.nombre}
          </h2>
          {producto.descripcion && <p className="mt-2 text-[15px] leading-relaxed text-[var(--fg-2)]">{producto.descripcion}</p>}

          <p className="mn-num mt-4 text-[1.375rem] font-extrabold">
            {fmt(base)}
            {porPeso && <span className="text-base font-semibold text-[var(--fg-2)]"> /kg</span>}
          </p>
          <p className="mn-num mt-0.5 text-[13px] text-[var(--fg-2)]">
            {t("taxFree", { v: fmt(neto(base)) })}
            {porPeso ? " /kg" : ""}
          </p>

          {/* Grupos de variantes */}
          {grupos.map((g) => (
            <fieldset key={g.id} className="mt-6">
              <legend className="mb-2.5 flex items-center gap-2">
                <span className="text-[15px] font-bold">{g.nombre}</span>
                {g.obligatorio && <span className="mn-badge mn-label">{t("required")}</span>}
              </legend>
              <div className="grid gap-2">
                {g.opciones.map((op) => {
                  const checked = (sel[g.id] || []).includes(op.id);
                  const sinStock = agotada(op);
                  return (
                    <button
                      key={op.id}
                      type="button"
                      role={g.tipo === "single" ? "radio" : "checkbox"}
                      aria-checked={checked}
                      disabled={sinStock}
                      onClick={() => toggle(g, op.id)}
                      className="mn-opcion disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={`mn-marca ${g.tipo === "single" ? "" : "mn-marca-cuadro"}`} aria-hidden>
                        {checked &&
                          (g.tipo === "single" ? (
                            <span className="h-2 w-2 rounded-full bg-current" />
                          ) : (
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="m5 12 5 5 9-10" />
                            </svg>
                          ))}
                      </span>
                      <span className="flex-1 text-[15px] font-semibold">{op.nombre}</span>
                      {sinStock && <span className="text-sm font-semibold text-[var(--fg-2)]">{t("noStock")}</span>}
                      {!sinStock && Number(op.precio_extra) > 0 && (
                        <span className="mn-num text-sm font-bold text-[var(--fg-2)]">+{fmt(Number(op.precio_extra))}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          {/* Personalización */}
          {onAdd && campos.length > 0 && (
            <CamposCliente campos={campos} valores={valores} onChange={setValores} negocioId={producto.negocio_id} marcarFaltantes={intento} />
          )}

          {/* Por peso: atajos de 250 g, 500 g y 1 kg */}
          {porPeso && (
            <div className="mt-6 border-t border-[var(--line)] pt-5">
              <p className="text-[15px] font-semibold">{t("howMuch")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[0.25, 0.5, 1].map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    aria-pressed={cantidad === kg}
                    onClick={() => setCantidad(kg)}
                    className="mn-chip mn-cat"
                  >
                    {fmtPeso(kg)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selector de cantidad (unidades o de a 100 g) */}
          {onAdd && (
          <div className="mt-6 flex items-center justify-between border-t border-[var(--line)] pt-5">
            <span className="text-[15px] font-semibold">{porPeso ? t("weight") : t("quantity")}</span>
            <div className="flex items-center gap-1 rounded-full bg-[var(--bg-2)] p-1">
              <StepBtn
                label="−"
                aria={t("less")}
                onClick={() => setCantidad((q) => Math.max(minimo, redondearKg(q - paso)))}
                disabled={cantidad <= minimo}
              />
              <span className="mn-num min-w-8 text-center text-base font-bold" aria-live="polite">
                {porPeso ? fmtPeso(cantidad) : cantidad}
              </span>
              <StepBtn label="+" aria={t("more")} onClick={() => setCantidad((q) => Math.min(99, redondearKg(q + paso)))} />
            </div>
          </div>

          )}

          {/* Agregar al pedido. Si faltan opciones, el aviso va aparte y legible. */}
          {onAdd && faltanVariantes && (
            <p role="status" className="mt-5 text-sm font-semibold text-[var(--fg-2)]">
              {t("chooseRequired")}
            </p>
          )}
          {onAdd && !faltanVariantes && intento && camposFaltantes.length > 0 && (
            <p role="alert" className="mt-5 text-sm font-semibold text-[var(--err)]">
              {t("missingFields", { lista: camposFaltantes.join(", ") })}
            </p>
          )}
          {!onAdd && (
            <p className="mt-6 border-t border-[var(--line)] pt-5 text-[15px] text-[var(--fg-2)]">{t("noOnlineOrders")}</p>
          )}
          {!onAdd && contacto && (
            <a href={contacto} target="_blank" rel="noopener noreferrer" className="mn-btn mt-4 w-full">
              {t("askWhatsapp")}
            </a>
          )}
          {onAdd && (
          <button
            type="button"
            onClick={() => {
              if (faltanVariantes) return;
              if (camposFaltantes.length) {
                setIntentos((n) => n + 1);
                return;
              }
              onAdd(producto, cantidad, elegidas, campos.map((c) => valores[c.id]).filter(Boolean));
              onClose();
            }}
            disabled={faltanVariantes}
            className={`mn-btn mn-num w-full ${faltanObligatorios ? "mt-2" : "mt-5"}`}
          >
            {`${t("addToOrder")} · ${fmt(unit * cantidad)}`}
          </button>
          )}
          <button type="button" onClick={onClose} className={`mn-btn mn-btn-borde w-full ${onAdd ? "mt-2.5" : "mt-6"}`}>
            {t("backToMenu")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepBtn({ label, aria, onClick, disabled }: { label: string; aria: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="mn-icon-btn bg-[var(--surface)] text-xl font-bold text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}
