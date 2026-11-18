import { useState, useMemo, useEffect, useRef } from "react";
import type { Configuracion, TipoEntrega } from "../services/api";
import { pedidosService, adjuntosService, getErrorMessage } from "../services/api";
import type { CartApi } from "../hooks/useCart";
import { fmt, ProductImage, CIcon, esPorPeso, fmtPeso, redondearKg, PASO_KG } from "../lib/menuUi";
import { useLang } from "../lib/i18n";
import { calcularEnvio, type Envio } from "../lib/envio";
import { mediosActivos, montosDePago, type MetodoPago } from "../lib/pagos";

export default function CartDrawer({
  open,
  onClose,
  cart,
  mesa,
  mesaToken,
  config,
  demo = false,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartApi;
  // Mesa y firma del QR. Vacías = QR general (no se puede pedir en mesa).
  mesa: string;
  mesaToken: string;
  config: Configuracion | null;
  // Menú de ejemplo: el pedido no se guarda ni se manda por WhatsApp.
  demo?: boolean;
}) {
  const { t } = useLang();
  const entregaLabel: Record<TipoEntrega, string> = {
    mesa: t("deliveryTable"),
    retiro: t("deliveryPickup"),
    delivery: t("deliveryDelivery"),
    mostrador: t("deliveryCounter"),
    envio: t("deliveryShipping"),
  };
  const ICONO: Record<TipoEntrega, string> = { mesa: "mesa", retiro: "bolsa", delivery: "moto", mostrador: "mostrador", envio: "caja" };
  const [step, setStep] = useState<"datos" | "entrega">("datos");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  // Opt-in para avisos del pedido por WhatsApp (solo si el local los activó).
  const [avisoWa, setAvisoWa] = useState(false);
  // Medio de pago y, en efectivo, con cuánto paga (vacío = paga justo).
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [pagaCon, setPagaCon] = useState("");
  const [copiado, setCopiado] = useState("");
  // Transferencia: quién la hizo y el comprobante (token del archivo subido).
  const [transfirio, setTransfirio] = useState("");
  const [comprobante, setComprobante] = useState<{ token: string; nombre: string } | null>(null);
  const [subiendoComp, setSubiendoComp] = useState(false);
  const [errorComp, setErrorComp] = useState("");
  const [tipo, setTipo] = useState<TipoEntrega | null>(null);
  // Para más tarde (retiro o entrega programada): "YYYY-MM-DDTHH:mm" local.
  const [programar, setProgramar] = useState(false);
  const [cuando, setCuando] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // El backend rechazó el QR de mesa (firma vieja, mesa que ya no existe…):
  // se deja de ofrecer "en mesa" y el cliente puede elegir otra opción.
  const [mesaRechazada, setMesaRechazada] = useState(false);

  const { lines, total, setQty, remove, clear } = cart;
  // Envío del delivery (el backend lo vuelve a calcular con la configuración).
  const envioSel = calcularEnvio(config, tipo, total);
  const envioDelivery = calcularEnvio(config, "delivery", total);
  const medios = mediosActivos(config, tipo);
  // Si cambia la entrega y el medio elegido ya no está, se descarta.
  const metodoSel = metodo && medios.includes(metodo) ? metodo : medios.length === 1 ? medios[0] : null;
  const montos = montosDePago(metodoSel, total, envioSel);
  const pagaConNum = Number(pagaCon.replace(/\D/g, "")) || 0;
  const pagaConOk = metodoSel !== "efectivo" || !pagaCon || pagaConNum >= montos.efectivo;
  const copiar = (texto: string, clave: string) => {
    navigator.clipboard?.writeText(texto).then(() => {
      setCopiado(clave);
      setTimeout(() => setCopiado(""), 2000);
    }).catch(() => {});
  };
  // Pedidos con teléfono (para avisar o coordinar): retiro, delivery y envío.
  const conTelefono = (x: TipoEntrega | null) => x === "retiro" || x === "delivery" || x === "envio";
  // ¿Se puede pedir para más tarde con esta modalidad?
  const sePuedeProgramar = (x: TipoEntrega | null) =>
    (x === "retiro" && !!config?.modalidades?.retiro_programado) ||
    ((x === "delivery" || x === "envio") && !!config?.modalidades?.entrega_programada);
  // Mínimo para el selector: dentro de 30 minutos (hora local del celular).
  const minimoProgramado = () => {
    // Hora de Argentina (UTC−3), sin importar la zona del celular.
    return new Date(Date.now() + 30 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
  };

  // Opciones de entrega activas según la configuración del local.
  const opciones = useMemo<TipoEntrega[]>(() => {
    const o: TipoEntrega[] = [];
    // QR de mesa: el pedido es para esa mesa, sin otras opciones.
    if (mesa && mesaToken && !mesaRechazada && config?.mesas_activo) return ["mesa"];
    // QR general: sólo retiro o delivery (nunca elegir una mesa a mano).
    if (config?.retiro_activo) o.push("retiro");
    if (config?.modalidades?.mostrador) o.push("mostrador");
    if (config?.delivery_activo) o.push("delivery");
    if (config?.modalidades?.envio) o.push("envio");
    return o;
  }, [config, mesa, mesaToken, mesaRechazada]);

  // QR general en un local que sólo atiende en mesa: no hay a dónde mandar
  // el pedido. Se pide escanear el QR de la mesa (el backend también lo exige).
  const sinDestino =
    opciones.length === 0 && !!config?.mesas_activo && (config.mesas_cantidad || 0) > 0;

  const resetAll = () => {
    clear();
    setCliente("");
    setNota("");
    setDireccion("");
    setTelefono("");
    setAvisoWa(false);
    setMetodo(null);
    setPagaCon("");
    setTransfirio("");
    setComprobante(null);
    setErrorComp("");
    setProgramar(false);
    setCuando("");
    setTipo(null);
    setStep("datos");
  };

  // El teléfono se pide para retiro y delivery (para contactar al cliente).
  const requierePhone = conTelefono(tipo);
  const puedeProgramar = sePuedeProgramar(tipo);

  const cerrar = () => {
    setDone(false);
    setError("");
    setStep("datos");
    onClose();
  };

  // Al abrir: foco en "Cerrar", Escape cierra y la página no scrollea detrás.
  // Al cerrar: el foco vuelve a donde estaba. (El resto de la página queda inerte desde Menu.)
  const cerrarBtnRef = useRef<HTMLButtonElement>(null);
  const cerrarRef = useRef(cerrar);
  useEffect(() => {
    cerrarRef.current = cerrar;
  });
  useEffect(() => {
    if (!open) return;
    const previo = document.activeElement as HTMLElement | null;
    cerrarBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cerrarRef.current();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previo?.focus();
    };
  }, [open]);

  const buildPayload = (tipoEntrega: TipoEntrega | null) => ({
    mesa: tipoEntrega === "mesa" ? mesa : null,
    mesa_token: tipoEntrega === "mesa" ? mesaToken : null,
    cliente: cliente.trim(),
    nota: nota.trim() || null,
    tipo_entrega: tipoEntrega,
    direccion_entrega: tipoEntrega === "delivery" || tipoEntrega === "envio" ? direccion.trim() : null,
    telefono_cliente: conTelefono(tipoEntrega) ? telefono.trim() || null : null,
    acepta_whatsapp: !!config?.avisos_whatsapp && avisoWa && conTelefono(tipoEntrega),
    ...(programar && cuando && sePuedeProgramar(tipoEntrega) ? { programado_para: new Date(`${cuando}:00-03:00`).toISOString() } : {}),
    ...(metodoSel && mediosActivos(config, tipoEntrega).includes(metodoSel)
      ? {
          metodo_pago: metodoSel,
          paga_con: metodoSel === "efectivo" && pagaConNum > 0 ? pagaConNum : null,
          ...(metodoSel === "transferencia"
            ? { transfirio: transfirio.trim() || null, comprobante: modoComp !== "no" ? comprobante?.token || null : null }
            : {}),
        }
      : {}),
    items: lines.map((l) => ({
      producto_id: l.producto.id,
      nombre: l.producto.nombre,
      precio: l.unitPrice,
      cantidad: l.cantidad,
      opciones: l.opciones.map((o) => o.opcion_id),
      ...(l.personalizacion.length
        ? { personalizacion: l.personalizacion.map(({ campo_id, valor, adjunto }) => ({ campo_id, valor, adjunto })) }
        : {}),
    })),
  });

  // Validaciones
  const nombreOk = cliente.trim().length > 0;
  const entregaOk =
    (opciones.length === 0 && !sinDestino) ||
    (tipo === "mesa" && !!mesa && !!mesaToken && !mesaRechazada) ||
    tipo === "mostrador" ||
    (tipo === "retiro" && !!telefono.trim()) ||
    ((tipo === "delivery" || tipo === "envio") && !!direccion.trim() && !!telefono.trim());
  const modoComp = config?.pagos?.comprobante || "no";
  const compOk = metodoSel !== "transferencia" || modoComp !== "obligatorio" || !!comprobante;
  const pagoOk = medios.length === 0 || (!!metodoSel && pagaConOk && compOk && !subiendoComp);
  const subirComprobante = async (file: File | undefined) => {
    if (!file) return;
    setErrorComp("");
    if (!/^image\/|^application\/pdf$/.test(file.type)) return setErrorComp(t("payReceiptType"));
    if (file.size > 10 * 1024 * 1024) return setErrorComp(t("fileTooBig", { n: 10 }));
    setSubiendoComp(true);
    try {
      const r = await adjuntosService.subir(file, config?.negocio_id, "comprobante");
      setComprobante({ token: r.token, nombre: r.nombre });
    } catch (e) {
      setErrorComp(getErrorMessage(e, t("fileError")));
    } finally {
      setSubiendoComp(false);
    }
  };

  const irAEntrega = () => {
    if (!nombreOk) {
      setError(t("errEnterName"));
      return;
    }
    setError("");
    if (sinDestino) {
      setError(t("scanTableQr"));
      return;
    }
    if (opciones.length === 0) {
      finalizar(null, false);
      return;
    }
    if (!tipo) setTipo(opciones[0]);
    setStep("entrega");
  };

  const guardar = async (tipoEntrega: TipoEntrega | null) => {
    if (demo) return true;
    setSending(true);
    setError("");
    try {
      const pedido = await pedidosService.create(buildPayload(tipoEntrega));
      return pedido;
    } catch (e) {
      console.error(e);
      // Mostrar el motivo real del backend (p. ej. "escaneá el QR de tu mesa").
      const r = (e as { response?: { status?: number; data?: { message?: string } } }).response;
      setError(r?.data?.message || t("errSendFailed"));
      if (r?.status === 400 && tipoEntrega === "mesa") {
        setMesaRechazada(true);
        setTipo(null);
      }
      return null;
    } finally {
      setSending(false);
    }
  };

  const validarEntrega = (tipoEntrega: TipoEntrega | null) => {
    if (!nombreOk) {
      setError(t("errEnterName"));
      return false;
    }
    if (tipoEntrega === "mesa" && (!mesa || !mesaToken || mesaRechazada)) {
      setError(t("errChooseTable"));
      return false;
    }
    if (tipoEntrega === "delivery" && !direccion.trim()) {
      setError(t("errEnterAddress"));
      return false;
    }
    if (tipoEntrega === "envio" && direccion.trim().length < 10) {
      setError(t("errEnterFullAddress"));
      return false;
    }
    if (programar && sePuedeProgramar(tipoEntrega) && (!cuando || cuando < minimoProgramado())) {
      setError(t(cuando ? "errWhenTooSoon" : "errChooseWhen"));
      return false;
    }
    if (
      conTelefono(tipoEntrega) &&
      !telefono.trim()
    ) {
      setError(t("errEnterPhone"));
      return false;
    }
    if (mediosActivos(config, tipoEntrega).length > 0 && !metodoSel) {
      setError(t("errChoosePay"));
      return false;
    }
    if (!pagaConOk) {
      setError(t("payTooLow", { m: fmt(montos.efectivo) }));
      return false;
    }
    if (!compOk) {
      setError(t("errReceiptMissing"));
      return false;
    }
    return true;
  };

  const finalizar = async (tipoEntrega: TipoEntrega | null, conWhatsApp: boolean) => {
    if (!validarEntrega(tipoEntrega)) return;

    // Datos para el mensaje antes de limpiar el carrito.
    const lineasMsg = lines
      .map((l) => {
        const ops =
          l.opciones.length > 0
            ? ` (${l.opciones.map((o) => o.nombre).join(", ")})`
            : "";
        const cant = esPorPeso(l.producto) ? fmtPeso(l.cantidad) : `${l.cantidad}x`;
        const pers = l.personalizacion.map((v) => `\n   ${v.etiqueta}: ${v.texto}`).join("");
        return `• ${cant} ${l.producto.nombre}${ops} — ${fmt(
          l.cantidad * l.unitPrice,
        )}${pers}`;
      })
      .join("\n");
    const subtotalMsg = total;
    const envioLocal = calcularEnvio(config, tipoEntrega, total);

    const pedido = await guardar(tipoEntrega);
    if (!pedido) return;

    // El envío que guardó el servidor (por si el local lo cambió recién).
    const guardado = typeof pedido === "object" ? (pedido as { costo_envio?: number; envio_cobro?: string | null }) : null;
    const envioMsg = guardado
      ? { costo: Number(guardado.costo_envio || 0), cobro: guardado.envio_cobro || null, gratis: envioLocal.gratis }
      : envioLocal;
    const envioTxt =
      envioMsg.costo > 0
        ? `\nEnvío: ${fmt(envioMsg.costo)}${envioMsg.cobro === "efectivo" ? " (en efectivo al repartidor)" : ""}`
        : envioMsg.gratis
          ? "\nEnvío: gratis"
          : "";
    const totalMsg = subtotalMsg + envioMsg.costo;
    const pagoTxt =
      metodoSel === "efectivo" && mediosActivos(config, tipoEntrega).length
        ? `\nPago: Efectivo${pagaConNum > totalMsg ? ` (paga con ${fmt(pagaConNum)}, vuelto ${fmt(pagaConNum - totalMsg)})` : " (justo)"}`
        : metodoSel === "transferencia" && mediosActivos(config, tipoEntrega).length
          ? `\nPago: Transferencia (a confirmar)${transfirio.trim() ? `\nTransfirió: ${transfirio.trim()}` : ""}${comprobante ? "\nComprobante adjunto en el pedido" : ""}`
          : "";

    if (conWhatsApp && !demo) {
      const entregaTxt =
        tipoEntrega === "mesa"
          ? `Entrega: En mesa ${mesa.trim()}`
          : tipoEntrega === "delivery"
            ? `Entrega: Delivery\nDirección: ${direccion.trim()}`
            : tipoEntrega === "envio"
              ? `Entrega: Envío por correo\nDirección: ${direccion.trim()}`
              : tipoEntrega === "retiro"
                ? "Entrega: Retiro en el local"
                : tipoEntrega === "mostrador"
                  ? "Entrega: En el mostrador"
                  : "";
      const cuandoTxt = programar && cuando && sePuedeProgramar(tipoEntrega)
        ? `Para: ${new Date(`${cuando}:00-03:00`).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}\n`
        : "";

      const msg =
        `*Nuevo pedido — ${config?.nombre || "Menú"}*\n` +
        `Cliente: ${cliente.trim()}\n` +
        (telefono.trim() ? `Tel: ${telefono.trim()}\n` : "") +
        (entregaTxt ? entregaTxt + "\n" : "") +
        cuandoTxt +
        `\n${lineasMsg}\n${envioTxt}\n*Total: ${fmt(totalMsg)}*${pagoTxt}` +
        (nota.trim() ? `\n\nNota: ${nota.trim()}` : "");

      let num = (config?.whatsapp || config?.telefono || "").replace(/\D/g, "");
      if (num && !num.startsWith("54")) num = "549" + num;
      const url = num
        ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, "_blank");
    }

    setDone(true);
    resetAll();
  };

  return (
    <>
      <div
        className="mn-velo z-[90]"
        onClick={cerrar}
        aria-hidden
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .25s" }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="carrito-titulo"
        inert={!open}
        className="fixed inset-y-0 right-0 z-[91] flex w-full max-w-[420px] flex-col bg-[var(--bg)]"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          visibility: open ? "visible" : "hidden",
          // Al abrir se muestra al instante (para poder darle foco); al cerrar se oculta al terminar de salir.
          transition: open ? "transform .32s var(--ease)" : "transform .32s var(--ease), visibility 0s linear .32s",
        }}
      >
        {/* Cabecera */}
        <div className="flex items-center gap-2.5 border-b border-[var(--line)] px-4 py-3">
          {step === "entrega" && !done && (
            <button
              type="button"
              onClick={() => {
                setStep("datos");
                setError("");
              }}
              aria-label={t("back")}
              className="mn-icon-btn mn-icon-btn-suave"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <h2 id="carrito-titulo" className="mn-display flex-1 text-[1.3rem]">
            {done ? t("orderSent") : step === "entrega" ? t("howDoYouWantIt") : t("yourOrder")}
          </h2>
          <button ref={cerrarBtnRef} type="button" onClick={cerrar} aria-label={t("close")} className="mn-icon-btn mn-icon-btn-suave">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {done ? (
          <SuccessView onClose={cerrar} demo={demo} />
        ) : lines.length === 0 ? (
          <EmptyView onClose={cerrar} />
        ) : step === "datos" ? (
          <>
            {/* Lista + datos */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              <ul>
                {lines.map((l) => (
                  <li key={l.key} className="flex gap-3 border-b border-[var(--line)] py-3.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[12px] bg-[var(--bg-2)]">
                      <ProductImage url={l.producto.imagen_url} alt="" w={128} h={128} fill style={{ width: "100%", height: "100%" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] font-semibold leading-snug">{l.producto.nombre}</p>
                        <p className="mn-num shrink-0 text-[15px] font-bold">{fmt(l.unitPrice * l.cantidad)}</p>
                      </div>
                      {l.opciones.length > 0 && (
                        <p className="mt-0.5 text-[13px] leading-snug text-[var(--fg-2)]">{l.opciones.map((o) => o.nombre).join(" · ")}</p>
                      )}
                      {l.personalizacion.length > 0 && (
                        <ul className="mt-0.5 grid gap-0.5">
                          {l.personalizacion.map((v) => (
                            <li key={v.campo_id} className="line-clamp-3 break-words text-[13px] leading-snug text-[var(--fg-2)]">
                              {v.etiqueta}: <span className="font-semibold text-[var(--fg)]">{v.texto}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-2 flex items-center gap-1">
                        {/* Por peso: de a 100 g; bajar de 100 g quita la línea. */}
                        <MiniBtn
                          label={t("less")}
                          onClick={() => {
                            if (!esPorPeso(l.producto)) return setQty(l.key, l.cantidad - 1);
                            const next = redondearKg(l.cantidad - PASO_KG);
                            setQty(l.key, next < PASO_KG ? 0 : next);
                          }}
                        >
                          −
                        </MiniBtn>
                        <span className="mn-num min-w-7 text-center text-[15px] font-bold">
                          {esPorPeso(l.producto) ? fmtPeso(l.cantidad) : l.cantidad}
                        </span>
                        <MiniBtn
                          label={t("more")}
                          onClick={() => setQty(l.key, esPorPeso(l.producto) ? redondearKg(l.cantidad + PASO_KG) : l.cantidad + 1)}
                        >
                          +
                        </MiniBtn>
                        <button
                          type="button"
                          onClick={() => remove(l.key)}
                          className="ml-auto min-h-11 cursor-pointer px-2 text-[13px] font-semibold text-[var(--fg-2)] underline hover:text-[var(--fg)]"
                        >
                          {t("remove")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 grid gap-4 pb-4">
                <Field label={t("yourName")} value={cliente} onChange={setCliente} placeholder={t("namePlaceholder")} invalid={!!error && !nombreOk} />
                <Field label={t("note")} value={nota} onChange={setNota} placeholder={t("notePlaceholder")} textarea />
              </div>
            </div>

            <Footer
              total={total}
              error={error}
              primaryLabel={opciones.length === 0 ? (sending ? t("sending") : t("confirmOrder")) : t("continue")}
              primaryDisabled={sending || sinDestino}
              onPrimary={irAEntrega}
              showWhatsApp={opciones.length === 0}
              whatsAppDisabled={sending || sinDestino}
              aviso={sinDestino ? t("scanTableQr") : undefined}
              onWhatsApp={() => finalizar(null, true)}
            />
          </>
        ) : (
          <>
            {/* Paso entrega */}
            <div className="flex-1 overflow-y-auto p-4">
              <div role="radiogroup" aria-label={t("howDoYouWantIt")} className="grid gap-2.5">
                {opciones.map((op) => (
                  <button
                    key={op}
                    type="button"
                    role="radio"
                    aria-checked={tipo === op}
                    onClick={() => {
                      setTipo(op);
                      setError("");
                    }}
                    className="mn-opcion min-h-[3.75rem]"
                  >
                    <CIcon icon={ICONO[op]} size={22} />
                    <span className="flex-1">
                      <span className="block text-base font-bold">
                        {op === "mesa" ? `${entregaLabel.mesa} · ${t("tableN", { n: mesa })}` : entregaLabel[op]}
                      </span>
                      {op === "delivery" && (envioDelivery.costo > 0 || envioDelivery.gratis) && (
                        <span className="block text-[13px] font-semibold text-[var(--fg-2)]">
                          {envioDelivery.gratis
                            ? t("shippingFreeOption")
                            : t(envioDelivery.cobro === "efectivo" ? "shippingCostOptionCash" : "shippingCostOption", { m: fmt(envioDelivery.costo) })}
                        </span>
                      )}
                    </span>
                    <span className="mn-marca" aria-hidden>
                      {tipo === op && <span className="h-2 w-2 rounded-full bg-current" />}
                    </span>
                  </button>
                ))}
              </div>

              {/* Campos según opción */}
              {tipo === "mesa" && (
                <p className="mt-5 rounded-[var(--r-sm)] bg-[var(--surface)] px-4 py-3 text-[15px] ring-1 ring-[var(--line)]">
                  {t("tableFromQr", { n: mesa })}
                </p>
              )}
              {(tipo === "delivery" || tipo === "envio") && (
                <label className="mt-5 block">
                  <span className="mn-field-label">{tipo === "envio" ? t("shippingAddress") : t("deliveryAddress")}</span>
                  <textarea value={direccion} autoComplete="street-address" onChange={(e) => setDireccion(e.target.value)}
                    placeholder={tipo === "envio" ? t("shippingAddressPlaceholder") : t("addressPlaceholder")} rows={3} className="mn-field" />
                </label>
              )}
              {tipo === "mostrador" && (
                <p className="mt-5 rounded-[var(--r-sm)] bg-[var(--surface)] px-4 py-3 text-[15px] ring-1 ring-[var(--line)]">{t("counterHint")}</p>
              )}
              {puedeProgramar && (
                <fieldset className="mt-5 min-w-0">
                  <legend className="mn-field-label">{t("whenTitle")}</legend>
                  <div className="mt-1 grid gap-2">
                    {[false, true].map((prog) => (
                      <label key={String(prog)} className="mn-opcion">
                        <input type="radio" name="cuando" className="sr-only" checked={programar === prog}
                          onChange={() => {
                            setProgramar(prog);
                            setError("");
                          }} />
                        <span className="mn-marca" aria-hidden>{programar === prog && <span className="h-2 w-2 rounded-full bg-current" />}</span>
                        <span className="flex-1 text-[15px] font-semibold">{prog ? t("whenLater") : t("whenAsap")}</span>
                      </label>
                    ))}
                  </div>
                  {programar && (
                    <label className="mt-3 block">
                      <span className="mn-field-label">{t("whenDateTime")}</span>
                      <input type="datetime-local" className="mn-field" value={cuando} min={minimoProgramado()}
                        aria-describedby="cuando-ayuda" onChange={(e) => setCuando(e.target.value)} />
                      <span id="cuando-ayuda" className="mt-1 block text-[13px] text-[var(--fg-2)]">{t("whenHint")}</span>
                    </label>
                  )}
                </fieldset>
              )}
              {requierePhone && (
                <label className="mt-5 block">
                  <span className="mn-field-label">{t("phone")}</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder={t("phonePlaceholder")}
                    className="mn-field"
                  />
                </label>
              )}
              {medios.length > 0 && (
                <fieldset className="mt-5 min-w-0">
                  <legend className="mn-field-label">{t("payTitle")}</legend>
                  <div className="mt-1 grid gap-2">
                    {medios.map((m) => (
                      <label key={m} className="mn-opcion" aria-checked={metodoSel === m}>
                        <input type="radio" name="metodo-pago" className="sr-only" checked={metodoSel === m}
                          onChange={() => {
                            setMetodo(m);
                            setError("");
                          }} />
                        <span className="mn-marca" aria-hidden>{metodoSel === m && <span className="h-2 w-2 rounded-full bg-current" />}</span>
                        <span className="flex-1">
                          <span className="block text-[15px] font-semibold">{t(m === "efectivo" ? "payCash" : "payTransfer")}</span>
                          <span className="block text-[13px] text-[var(--fg-2)]">{t(m === "efectivo" ? "payCashSub" : "payTransferSub")}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {metodoSel === "efectivo" && (
                    <label className="mt-3 block">
                      <span className="mn-field-label">{t("payWithHowMuch")}</span>
                      <input type="text" inputMode="numeric" className="mn-field" value={pagaCon}
                        placeholder={t("payWithPlaceholder")} aria-invalid={!pagaConOk || undefined}
                        aria-describedby="paga-con-ayuda"
                        onChange={(e) => setPagaCon(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} />
                      <span id="paga-con-ayuda" aria-live="polite"
                        className={`mt-1 block text-sm font-semibold ${pagaConOk ? "text-[var(--fg)]" : "text-[var(--err)]"}`}>
                        {!pagaCon
                          ? <span className="font-normal text-[var(--fg-2)]">{t("payWithHint")}</span>
                          : !pagaConOk
                            ? t("payTooLow", { m: fmt(montos.efectivo) })
                            : pagaConNum === montos.efectivo
                              ? t("payExact", { m: fmt(montos.efectivo) })
                              : t("payChange", { m: fmt(pagaConNum - montos.efectivo) })}
                      </span>
                    </label>
                  )}
                  {metodoSel === "transferencia" && config?.pagos && (
                    <div className="mt-3 rounded-[var(--r-sm)] bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--line)]">
                      <p className="text-[15px] font-bold">{t("payTransferTo", { m: fmt(montos.transferir) })}</p>
                      <dl className="mt-2 grid gap-2 text-[15px]">
                        {([
                          ["alias", "payAlias", config.pagos.alias],
                          ["cbu", "payCbu", config.pagos.cbu],
                        ] as const).filter(([, , v]) => !!v).map(([k, label, v]) => (
                          <div key={k} className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <dt className="text-[13px] text-[var(--fg-2)]">{t(label)}</dt>
                              <dd className="mn-num break-all font-semibold">{v}</dd>
                            </div>
                            <button type="button" onClick={() => copiar(v, k)} aria-label={`${t("payCopy")} ${t(label)}`}
                              className="mn-btn mn-btn-borde min-h-11 shrink-0 px-3 text-sm">
                              {copiado === k ? t("payCopied") : t("payCopy")}
                            </button>
                          </div>
                        ))}
                        {config.pagos.titular && (
                          <div>
                            <dt className="text-[13px] text-[var(--fg-2)]">{t("payHolder")}</dt>
                            <dd className="font-semibold">{config.pagos.titular}</dd>
                          </div>
                        )}
                        {config.pagos.banco && (
                          <div>
                            <dt className="text-[13px] text-[var(--fg-2)]">{t("payBank")}</dt>
                            <dd className="font-semibold">{config.pagos.banco}</dd>
                          </div>
                        )}
                      </dl>
                      <p className="mt-3 text-sm leading-snug text-[var(--fg-2)]">{t("payTransferNote")}</p>
                      <label className="mt-4 block">
                        <span className="mn-field-label">{t("payWho")}</span>
                        <input className="mn-field" value={transfirio} maxLength={80} autoComplete="name"
                          placeholder={t("payWhoPlaceholder")} onChange={(e) => setTransfirio(e.target.value)} />
                      </label>
                      {modoComp !== "no" && (
                        <div className="mt-4">
                          <p id="comp-titulo" className="mn-field-label">
                            {t(modoComp === "obligatorio" ? "payReceipt" : "payReceiptOptional")}
                            {modoComp === "obligatorio" && <span aria-hidden> *</span>}
                          </p>
                          {comprobante ? (
                            <div className="mt-1 flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--bg-2)] px-3 py-2">
                              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">✓ {comprobante.nombre}</span>
                              <button type="button" onClick={() => setComprobante(null)}
                                className="min-h-11 cursor-pointer px-2 text-sm font-semibold underline">{t("payReceiptRemove")}</button>
                            </div>
                          ) : (
                            <label className="mn-btn mn-btn-borde mt-1 w-full cursor-pointer">
                              <input type="file" accept="image/*,application/pdf" className="sr-only"
                                aria-labelledby="comp-titulo" aria-describedby="comp-ayuda" disabled={subiendoComp}
                                onChange={(e) => {
                                  void subirComprobante(e.target.files?.[0]);
                                  e.target.value = "";
                                }} />
                              {subiendoComp ? t("payReceiptUploading") : t("payReceiptAttach")}
                            </label>
                          )}
                          <span id="comp-ayuda" className="mt-1 block text-[13px] text-[var(--fg-2)]">{t("payReceiptHint")}</span>
                          {errorComp && (
                            <span role="alert" className="mt-1 block text-sm font-semibold text-[var(--err)]">{errorComp}</span>
                          )}
                        </div>
                      )}
                      {montos.efectivo > 0 && (
                        <p className="mt-1 text-sm font-semibold leading-snug">{t("payShippingCash", { m: fmt(montos.efectivo) })}</p>
                      )}
                      <span className="sr-only" role="status">{copiado ? t("payCopied") : ""}</span>
                    </div>
                  )}
                </fieldset>
              )}
              {requierePhone && config?.avisos_whatsapp && (
                <label className="mn-opcion mt-4 items-start" aria-checked={avisoWa}>
                  <input
                    type="checkbox"
                    checked={avisoWa}
                    onChange={(e) => setAvisoWa(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0"
                    style={{ accentColor: "var(--mp-ink)" }}
                  />
                  <span>
                    <span className="block text-[15px] font-bold">{t("notifyWhatsapp")}</span>
                    <span className="mt-0.5 block text-[13px] text-[var(--fg-2)]">{t("notifyWhatsappSub")}</span>
                  </span>
                </label>
              )}
            </div>

            <Footer
              total={total}
              envio={envioSel}
              error={error}
              primaryLabel={sending ? t("sending") : t("confirmOrder")}
              primaryDisabled={sending || !entregaOk || !pagoOk}
              onPrimary={() => finalizar(tipo, false)}
              showWhatsApp
              whatsAppDisabled={sending || !entregaOk || !pagoOk}
              onWhatsApp={() => finalizar(tipo, true)}
            />
          </>
        )}
      </aside>
    </>
  );
}

// ── Subcomponentes ──
function Footer({
  total,
  envio,
  error,
  aviso,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  showWhatsApp,
  whatsAppDisabled,
  onWhatsApp,
}: {
  total: number;
  // Sólo en el paso de entrega: desglose productos + envío.
  envio?: Envio;
  error: string;
  aviso?: string;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  showWhatsApp: boolean;
  whatsAppDisabled: boolean;
  onWhatsApp: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="border-t border-[var(--line)] bg-[var(--surface)] px-4 pt-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
      {aviso && !error && (
        <p role="status" className="mb-3 rounded-[var(--r-sm)] bg-[var(--bg-2)] px-3 py-2 text-sm font-semibold">
          {aviso}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-[var(--r-sm)] bg-[var(--err-bg)] px-3 py-2 text-sm font-semibold text-[var(--err)]">
          {error}
        </p>
      )}
      {/* Total y envío: se anuncian al cambiar la forma de entrega. */}
      <div aria-live="polite">
      {envio && (envio.costo > 0 || envio.gratis) && (
        <dl className="mb-2 grid gap-1 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-[var(--fg-2)]">{t("products")}</dt>
            <dd className="mn-num font-semibold">{fmt(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[var(--fg-2)]">{t("shippingCost")}</dt>
            <dd className="mn-num font-semibold">{envio.gratis ? t("shippingFree") : fmt(envio.costo)}</dd>
          </div>
        </dl>
      )}
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] text-[var(--fg-2)]">{t("total")}</span>
        <span className="mn-num mn-display text-[1.75rem]">{fmt(total + (envio?.costo || 0))}</span>
      </div>
      {envio && (envio.cobro === "efectivo" || envio.faltaParaGratis > 0) && (
        <p className="-mt-1 mb-3 text-sm font-semibold leading-snug text-[var(--fg-2)]">
          {envio.cobro === "efectivo" && t("shippingCashNote", { m: fmt(envio.costo) })}
          {envio.cobro === "efectivo" && envio.faltaParaGratis > 0 && " "}
          {envio.faltaParaGratis > 0 && t("shippingMissingForFree", { m: fmt(envio.faltaParaGratis) })}
        </p>
      )}
      </div>

      <button type="button" onClick={onPrimary} disabled={primaryDisabled} className="mn-btn w-full">
        {primaryLabel}
      </button>

      {showWhatsApp && (
        <button type="button" onClick={onWhatsApp} disabled={whatsAppDisabled} className="mn-btn mn-btn-wa mt-2.5 w-full">
          <svg width={19} height={19} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z" />
          </svg>
          {t("sendWhatsApp")}
        </button>
      )}
    </div>
  );
}

function SuccessView({ onClose, demo }: { onClose: () => void; demo: boolean }) {
  const { t } = useLang();
  return (
    <div className="mn-in flex flex-1 flex-col items-center justify-center p-8 text-center" role="status">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-[var(--mp)] text-[var(--mp-on)]" style={{ boxShadow: "inset 0 0 0 1.5px var(--mp-edge, transparent)" }}>
        <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12 5 5 9-10" />
        </svg>
      </div>
      <h3 className="mn-display text-[1.75rem]">{t("successTitle")}</h3>
      <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-[var(--fg-2)]">{t(demo ? "demoSuccess" : "successSubtitle")}</p>
      <button type="button" onClick={onClose} className="mn-btn mt-7">
        {t("keepBrowsing")}
      </button>
    </div>
  );
}

function EmptyView({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <p className="mn-display text-[1.75rem]">{t("emptyCart")}</p>
      <p className="mt-3 text-[15px] text-[var(--fg-2)]">{t("emptyCartSub")}</p>
      <button type="button" onClick={onClose} className="mn-btn mn-btn-borde mt-7">
        {t("backToMenu")}
      </button>
    </div>
  );
}

function MiniBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="mn-icon-btn mn-icon-btn-suave text-lg font-bold">
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="mn-field-label">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className="mn-field" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={invalid || undefined} className="mn-field" />
      )}
    </label>
  );
}
