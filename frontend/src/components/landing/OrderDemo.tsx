import { useEffect, useMemo, useRef, useState } from "react";
import { DEMOS } from "./demos";
import { PedidoCard, WhatsAppPedido } from "./Pedido";
import { parsePrecio, pesos, totalDe, type Linea } from "./comanda-utils";
import { IconArrow, IconMinus, IconPlus } from "./icons";
import { sinMovimiento } from "./movimiento";
import { ADMIN_SIGNUP_URL } from "../../lib/links";

const MESA = "7";

// "Probalo vos": el visitante juega a ser el cliente del local. Toca
// productos de un menú de ejemplo, el pedido se arma y al enviarlo ve el
// mensaje que le llegaría al local por WhatsApp.
export default function OrderDemo() {
  const [demoIdx, setDemoIdx] = useState(0);
  const [cant, setCant] = useState<Record<string, number>>({});
  const [numero, setNumero] = useState(129);
  const [enviado, setEnviado] = useState(false);
  const mensajeRef = useRef<HTMLDivElement>(null);

  const demo = DEMOS[demoIdx];

  const lineas: Linea[] = useMemo(
    () =>
      demo.items
        .filter((it) => (cant[it.name] ?? 0) > 0)
        .map((it) => ({ qty: cant[it.name], name: it.name, amount: cant[it.name] * parsePrecio(it.price) })),
    [demo, cant],
  );

  // Al enviar, acerca el mensaje a la vista (en el celular queda más abajo).
  useEffect(() => {
    if (!enviado) return;
    mensajeRef.current?.scrollIntoView({ behavior: sinMovimiento() ? "auto" : "smooth", block: "nearest" });
    mensajeRef.current?.focus({ preventScroll: true });
  }, [enviado]);

  const cambiar = (name: string, delta: number) => {
    setEnviado(false);
    setCant((c) => ({ ...c, [name]: Math.max(0, Math.min(9, (c[name] ?? 0) + delta)) }));
  };

  const elegirLocal = (i: number) => {
    setDemoIdx(i);
    setCant({});
    setEnviado(false);
  };

  const nuevo = () => {
    setCant({});
    setEnviado(false);
    setNumero((n) => n + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      {/* Lo que toca el cliente */}
      <div className="rounded-[var(--radio)] bg-white p-5 text-[var(--tinta)] sm:p-7">
        <p id="demo-locales" className="dx-label text-[var(--gris)]">
          Elegí un local de ejemplo
        </p>
        <div role="group" aria-labelledby="demo-locales" className="mt-3 flex flex-wrap gap-2">
          {DEMOS.map((d, i) => (
            <button
              key={d.nombre}
              type="button"
              aria-pressed={i === demoIdx}
              onClick={() => elegirLocal(i)}
              className={`min-h-11 rounded-full border-2 px-4 text-[0.9375rem] font-semibold transition-colors duration-150 ${
                i === demoIdx
                  ? "border-[var(--tinta)] bg-[var(--tinta)] text-white"
                  : "border-[var(--tinta)]/15 hover:border-[var(--tinta)]"
              }`}
            >
              {d.rubro}
            </button>
          ))}
        </div>

        <div className="mt-6 overflow-hidden rounded-[22px] border border-[var(--tinta)]/10">
          <div className="px-5 pb-4 pt-5" style={{ background: demo.accent }}>
            <p className="dx-display text-3xl">{demo.nombre}</p>
            <p className="mt-1 text-sm font-medium">{demo.tagline} · menú de ejemplo</p>
          </div>
          <ul className="divide-y divide-[var(--tinta)]/10">
            {demo.items.map((it) => {
              const q = cant[it.name] ?? 0;
              return (
                <li key={it.name} className="flex items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{it.name}</p>
                    <p className="text-sm text-[var(--gris)]">{it.desc}</p>
                    <p className="dx-tabular mt-1 font-semibold">{it.price}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {q > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => cambiar(it.name, -1)}
                          aria-label={`Quitar un ${it.name}`}
                          className="grid h-11 w-11 place-items-center rounded-full border-2 border-[var(--tinta)]/15 transition-colors hover:border-[var(--tinta)]"
                        >
                          <IconMinus />
                        </button>
                        <span className="dx-tabular w-6 text-center font-semibold" aria-hidden>
                          {q}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => cambiar(it.name, 1)}
                      aria-label={`Agregar ${it.name}${q ? `, van ${q}` : ""}`}
                      className="grid h-11 w-11 place-items-center rounded-full bg-[var(--tinta)] text-white transition-colors hover:bg-[var(--cobalto)]"
                    >
                      <IconPlus />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Lo que le llega al local */}
      <div>
        <PedidoCard numero={numero} mesa={MESA} lineas={lineas} enviado={enviado} vacio="Tocá un producto para sumarlo al pedido." />

        <p className="sr-only" aria-live="polite">
          {lineas.length
            ? `Pedido: ${lineas.map((l) => `${l.qty} ${l.name}`).join(", ")}. Total ${pesos(totalDe(lineas))}.`
            : "Pedido vacío."}
          {enviado ? " Pedido enviado por WhatsApp." : ""}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {!enviado ? (
            <button
              type="button"
              onClick={() => setEnviado(true)}
              disabled={!lineas.length}
              className="dx-btn disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[var(--aji)]"
            >
              Enviar por WhatsApp
              <IconArrow className="dx-btn-flecha h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={nuevo} className="dx-btn-borde text-white hover:bg-white hover:text-[var(--tinta)]">
              Armar otro pedido
            </button>
          )}
          {!lineas.length && !enviado && <span className="text-[0.9375rem] text-white/85">Agregá al menos un producto.</span>}
        </div>

        {enviado && (
          <div ref={mensajeRef} tabIndex={-1} aria-label="Mensaje que le llega al local" className="mt-6 scroll-mb-6 outline-none">
            <WhatsAppPedido negocio={demo.nombre} mesa={MESA} numero={numero} lineas={lineas} />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <a href={ADMIN_SIGNUP_URL} className="dx-btn">
                Armá la tuya gratis
                <IconArrow className="dx-btn-flecha h-4 w-4" />
              </a>
              <span className="text-white/85">14 días, sin tarjeta.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
