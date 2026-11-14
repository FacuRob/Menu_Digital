import { useId, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { adjuntosService, getErrorMessage, type CampoProducto } from "../services/api";
import { useLang } from "../lib/i18n";

// Lo que el cliente completa para personalizar un producto. El backend lo
// vuelve a validar todo al recibir el pedido.
export interface ValorCampo {
  campo_id: number;
  valor?: string | number | string[] | null;
  adjunto?: string; // token del archivo subido
  // Para mostrar en el carrito y en el mensaje.
  etiqueta: string;
  texto: string;
}

const MAX_MB = 10;
const ACCEPT: Record<string, string> = {
  imagen: "image/jpeg,image/png,image/webp,image/gif",
  pdf: "application/pdf,.pdf",
  "3d": ".stl,.obj,.3mf",
};

export default function CamposCliente({
  campos,
  valores,
  onChange,
  negocioId,
  marcarFaltantes = false,
}: {
  campos: CampoProducto[];
  valores: Record<number, ValorCampo>;
  // setState del padre: se actualiza siempre sobre el valor más reciente.
  onChange: Dispatch<SetStateAction<Record<number, ValorCampo>>>;
  negocioId?: number;
  // Después de intentar agregar con datos faltantes: se marcan los campos.
  marcarFaltantes?: boolean;
}) {
  const { t } = useLang();
  const uid = useId();
  const [subiendo, setSubiendo] = useState<number | null>(null);
  const [errores, setErrores] = useState<Record<number, string>>({});

  const poner = (c: CampoProducto, valor: ValorCampo["valor"], texto: string, adjunto?: string) => {
    const vacio = !adjunto && (valor === "" || valor === null || (Array.isArray(valor) && valor.length === 0));
    onChange((prev) => {
      const next = { ...prev };
      if (vacio) delete next[c.id];
      else next[c.id] = { campo_id: c.id, valor, adjunto, etiqueta: c.etiqueta, texto };
      return next;
    });
  };

  const subir = async (c: CampoProducto, file?: File) => {
    if (!file) return;
    setErrores((e) => ({ ...e, [c.id]: "" }));
    // Se avisa antes de subir (el backend igual lo controla).
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrores((x) => ({ ...x, [c.id]: t("fileTooBig", { n: MAX_MB }) }));
      return;
    }
    setSubiendo(c.id);
    try {
      const r = await adjuntosService.subir(file, negocioId);
      poner(c, null, r.nombre, r.token);
    } catch (e) {
      setErrores((x) => ({ ...x, [c.id]: getErrorMessage(e, t("fileError")) }));
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <div className="mt-6 grid gap-5 border-t border-[var(--line)] pt-5">
      <p className="text-[15px] font-bold">{t("customizeTitle")}</p>
      {campos.map((c) => {
        const id = `${uid}-${c.id}`;
        const v = valores[c.id];
        const errId = `${id}-err`;
        const falta = marcarFaltantes && c.obligatorio && !v;
        const error = errores[c.id] || (falta ? t("fieldMissing") : "");
        // Rango del número, para que se sepa antes de escribir.
        const { min, max: maxNum } = c.validaciones;
        const limites =
          c.tipo !== "numero"
            ? null
            : min !== undefined && maxNum !== undefined
              ? t("rangeBetween", { a: min, b: maxNum })
              : min !== undefined
                ? t("rangeMin", { a: min })
                : maxNum !== undefined
                  ? t("rangeMax", { b: maxNum })
                  : null;
        const ayudaTexto = [c.ayuda, limites].filter(Boolean).join(" · ");
        const ayudaId = ayudaTexto ? `${id}-ayuda` : undefined;
        const describe = [ayudaId, error ? errId : null].filter(Boolean).join(" ") || undefined;
        const etiqueta = (
          <span className="mn-field-label flex items-center gap-2">
            {c.etiqueta}
            {c.obligatorio && <span className="mn-badge mn-label">{t("required")}</span>}
          </span>
        );
        const ayuda = ayudaTexto && <span id={ayudaId} className="mt-1 block text-[13px] text-[var(--fg-2)]">{ayudaTexto}</span>;
        const msgError = error && (
          <p id={errId} role="alert" className="mt-1.5 text-[13px] font-semibold text-[var(--err)]">{error}</p>
        );
        const comun = {
          "aria-describedby": describe,
          "aria-invalid": error ? true : undefined,
          "aria-required": c.obligatorio || undefined,
        };

        // Lista de opciones: radios (una) o casillas (varias), nativos.
        if (c.tipo === "opcion" || c.tipo === "multiple" || (c.tipo === "color" && c.opciones.length > 0)) {
          const multi = c.tipo === "multiple";
          const elegidas = Array.isArray(v?.valor) ? v.valor : v?.valor ? [String(v.valor)] : [];
          return (
            <fieldset key={c.id} aria-describedby={describe} aria-invalid={error ? true : undefined}>
              <legend className="mb-2">{etiqueta}</legend>
              {ayuda}
              <div className="mt-2 grid gap-2">
                {c.opciones.map((op) => {
                  const on = elegidas.includes(op);
                  return (
                    <label key={op} className="mn-opcion" aria-checked={on}>
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={id}
                        className="sr-only"
                        checked={on}
                        onChange={() => {
                          if (!multi) return poner(c, op, op);
                          const lista = on ? elegidas.filter((x) => x !== op) : [...elegidas, op];
                          poner(c, lista, lista.join(", "));
                        }}
                      />
                      <span className={`mn-marca ${multi ? "mn-marca-cuadro" : ""}`} aria-hidden>
                        {on && <span className="h-2 w-2 rounded-full bg-current" />}
                      </span>
                      <span className="flex-1 text-[15px] font-semibold">{op}</span>
                    </label>
                  );
                })}
              </div>
              {msgError}
            </fieldset>
          );
        }

        if (c.tipo === "archivo") {
          const tipos = c.validaciones.tipos?.length ? c.validaciones.tipos : ["imagen", "pdf", "3d"];
          return (
            <div key={c.id}>
              <span id={`${id}-lbl`}>{etiqueta}</span>
              {ayuda}
              <div className="mt-2 flex flex-wrap gap-2">
                <label className="mn-btn mn-btn-borde flex-1 cursor-pointer">
                  <span id={`${id}-txt`}>
                    {subiendo === c.id ? t("uploading") : v?.adjunto ? t("changeFile") : t("chooseFile")}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    accept={tipos.map((x) => ACCEPT[x]).join(",")}
                    disabled={subiendo !== null}
                    aria-labelledby={`${id}-lbl ${id}-txt`}
                    {...comun}
                    onChange={(e) => {
                      subir(c, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {v?.adjunto && subiendo !== c.id && (
                  <button
                    type="button"
                    className="mn-btn mn-btn-borde"
                    onClick={() => poner(c, null, "")}
                    aria-label={t("removeFileOf", { c: c.etiqueta })}
                  >
                    {t("removeFile")}
                  </button>
                )}
              </div>
              <p role="status" className="mt-1.5 text-[13px] font-semibold text-[var(--fg)]">
                {v?.adjunto ? t("fileReady", { n: v.texto }) : ""}
              </p>
              <p className="text-[13px] text-[var(--fg-2)]">
                {t("fileTypes", { t: tipos.map((x) => t(`file_${x}`)).join(", "), n: MAX_MB })} {t("filePrivate")}
              </p>
              {msgError}
            </div>
          );
        }

        if (c.tipo === "color") {
          const elegido = typeof v?.valor === "string" ? v.valor : null;
          return (
            <div key={c.id}>
              <label htmlFor={`${id}-color`}>{etiqueta}</label>
              {ayuda}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  id={`${id}-color`}
                  type="color"
                  className="h-12 w-20 cursor-pointer rounded-[var(--r-sm)] border border-[var(--field-border)] bg-[var(--surface)] p-1"
                  value={elegido || "#888888"}
                  {...comun}
                  onChange={(e) => poner(c, e.target.value, e.target.value)}
                />
                <span className="text-[14px] font-semibold">{elegido ? elegido.toUpperCase() : t("colorNone")}</span>
                {elegido && (
                  <button type="button" className="mn-btn mn-btn-borde" onClick={() => poner(c, "", "")}>
                    {t("clearChoice")}
                  </button>
                )}
              </div>
              {msgError}
            </div>
          );
        }

        const largo = c.tipo === "texto_largo";
        const max = c.validaciones.max_largo || (largo ? 1000 : 200);
        const texto = typeof v?.valor === "string" ? v.valor : "";
        let control: ReactNode;
        if (c.tipo === "numero") {
          control = (
            <input
              id={`${id}-in`}
              type="number"
              inputMode="decimal"
              className="mn-field"
              min={min}
              max={maxNum}
              value={v?.valor === undefined || v?.valor === null ? "" : String(v.valor)}
              {...comun}
              onChange={(e) => poner(c, e.target.value === "" ? "" : Number(e.target.value), e.target.value)}
            />
          );
        } else if (largo) {
          control = (
            <textarea
              id={`${id}-in`}
              className="mn-field"
              rows={3}
              maxLength={max}
              value={texto}
              {...comun}
              onChange={(e) => poner(c, e.target.value, e.target.value)}
            />
          );
        } else {
          control = (
            <input
              id={`${id}-in`}
              className="mn-field"
              maxLength={max}
              value={texto}
              autoComplete="off"
              {...comun}
              onChange={(e) => poner(c, e.target.value, e.target.value)}
            />
          );
        }
        return (
          <div key={c.id}>
            <label htmlFor={`${id}-in`}>{etiqueta}</label>
            {ayuda}
            {control}
            {c.tipo !== "numero" && texto.length > max * 0.8 && (
              <p className="mt-1 text-right text-[12px] text-[var(--fg-2)]">
                {texto.length} / {max}
              </p>
            )}
            {msgError}
          </div>
        );
      })}
    </div>
  );
}
