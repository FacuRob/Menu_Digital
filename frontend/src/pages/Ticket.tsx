import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "@fontsource-variable/archivo/wdth.css";
import "../components/menu/menu.css";
import api from "../services/api";
import { fmt, fmtPeso, paletteVars, setMonedaMenu, PRIMARY, PRIMARY_ON } from "../lib/menuUi";

// Ticket de un pedido. Llega por WhatsApp al marcarlo "Entregado":
// /ticket/<id>?t=<firma>. Sin la firma correcta el backend responde 404.
interface TicketData {
  id: number;
  cliente: string | null;
  tipo_entrega: "mesa" | "retiro" | "delivery" | null;
  mesa: string | null;
  total: number;
  estado: string;
  created_at: string;
  entregado_at: string | null;
  items: { nombre: string; cantidad: number; precio_unit: number; subtotal: number; unidad: string }[];
  local: {
    nombre: string;
    direccion?: string | null;
    telefono?: string | null;
    logo_url?: string | null;
    color_primario?: string | null;
    moneda?: string | null;
  };
}

const ENTREGA: Record<string, string> = { mesa: "En mesa", retiro: "Retiro en el local", delivery: "Delivery" };

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default function Ticket() {
  const { id } = useParams();
  const [data, setData] = useState<TicketData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    api
      .get<TicketData>(`/tickets/${encodeURIComponent(id || "")}`, { params: { t } })
      .then((r) => {
        setMonedaMenu(r.data.local.moneda);
        setData(r.data);
        document.title = `Ticket #${r.data.id} · ${r.data.local.nombre}`;
      })
      .catch(() => setError(true));
  }, [id]);

  const pageStyle = paletteVars(data?.local.color_primario);

  if (error || !data) {
    return (
      <div className="mn grid min-h-screen place-items-center p-6 text-center" style={pageStyle} role={error ? undefined : "status"}>
        {error ? (
          <div className="max-w-sm">
            <h1 className="mn-display text-[clamp(2.25rem,9vw,3.5rem)]">Ticket no encontrado</h1>
            <p className="mt-4 text-[var(--fg-2)]">Revisá que el link esté completo, tal como te llegó por WhatsApp.</p>
          </div>
        ) : (
          <p className="text-[15px] font-semibold">Cargando ticket…</p>
        )}
      </div>
    );
  }

  const { local } = data;
  return (
    <div className="mn min-h-screen px-4 py-8 sm:py-12" style={pageStyle}>
      <main className="mx-auto max-w-md overflow-hidden rounded-[var(--r-lg)] bg-[var(--surface)] print:max-w-none print:rounded-none">
        <header className="mn-sobre-color px-6 pb-6 pt-7" style={{ background: PRIMARY, color: PRIMARY_ON }}>
          <div className="flex items-center gap-4">
            {local.logo_url && (
              <img src={local.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-[16px] bg-white object-cover" />
            )}
            <div className="min-w-0">
              <p className="mn-label opacity-80">Ticket</p>
              <h1 className="mn-display mt-1 text-[clamp(1.75rem,7vw,2.25rem)]">{local.nombre}</h1>
            </div>
          </div>
        </header>

        <section className="px-6 py-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[14px]">
            <div>
              <dt className="mn-label text-[var(--fg-2)]">Pedido</dt>
              <dd className="mn-num mt-0.5 font-semibold">#{data.id}</dd>
            </div>
            <div>
              <dt className="mn-label text-[var(--fg-2)]">Fecha</dt>
              <dd className="mn-num mt-0.5 font-semibold">{fecha(data.entregado_at || data.created_at)}</dd>
            </div>
            {data.cliente && (
              <div>
                <dt className="mn-label text-[var(--fg-2)]">Cliente</dt>
                <dd className="mt-0.5 font-semibold">{data.cliente}</dd>
              </div>
            )}
            {data.tipo_entrega && (
              <div>
                <dt className="mn-label text-[var(--fg-2)]">Entrega</dt>
                <dd className="mt-0.5 font-semibold">
                  {ENTREGA[data.tipo_entrega]}
                  {data.tipo_entrega === "mesa" && data.mesa ? ` ${data.mesa}` : ""}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className="border-t border-dashed border-[var(--field-border)] px-6 py-5" aria-label="Detalle">
          <ul className="space-y-3">
            {data.items.map((it, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 text-[15px]">
                <div className="min-w-0">
                  <p className="font-semibold leading-snug">{it.nombre}</p>
                  <p className="mn-num text-[13px] text-[var(--fg-2)]">
                    {it.unidad === "kg" ? fmtPeso(Number(it.cantidad)) : `${it.cantidad} ×`}{" "}
                    {fmt(Number(it.precio_unit))}
                    {it.unidad === "kg" ? "/kg" : ""}
                  </p>
                </div>
                <span className="mn-num shrink-0 font-semibold">{fmt(Number(it.subtotal))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex items-baseline justify-between border-t border-dashed border-[var(--field-border)] px-6 py-5">
          <span className="mn-label">Total</span>
          <span className="mn-num text-[1.75rem] font-extrabold">{fmt(Number(data.total))}</span>
        </section>

        {(local.direccion || local.telefono) && (
          <footer className="bg-[var(--bg-2)] px-6 py-4 text-[13px] text-[var(--fg-2)]">
            {local.direccion && <p>{local.direccion}</p>}
            {local.telefono && <p>Tel. {local.telefono}</p>}
          </footer>
        )}
      </main>

      <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 print:hidden">
        <button type="button" className="mn-btn w-full" onClick={() => window.print()}>
          Guardar o imprimir
        </button>
        <p className="text-[12px] text-[var(--fg-2)]">
          Comprobante no válido como factura · Hecho con <span className="font-bold">DinexFlow</span>
        </p>
      </div>
    </div>
  );
}
