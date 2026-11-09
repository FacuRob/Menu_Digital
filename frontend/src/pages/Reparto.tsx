import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "@fontsource-variable/archivo/wdth.css";
import "../components/menu/menu.css";
import api from "../services/api";
import { fmt, fmtPeso, paletteVars, setMonedaMenu, PRIMARY, PRIMARY_ON } from "../lib/menuUi";

// Página del repartidor: /reparto/<id>?t=<firma>. La comparte el local desde
// Pedidos. "Salí" pasa el pedido a En camino y empieza a mandar la ubicación;
// "Entregué" lo cierra. Sin app: sólo hay que dejar esta página abierta.
interface RepartoData {
  id: number;
  estado: string;
  cliente: string | null;
  telefono: string | null;
  direccion: string | null;
  nota: string | null;
  total: number;
  items: { nombre: string; cantidad: number; unidad: string }[];
  local: { nombre: string; color_primario?: string | null; moneda?: string | null };
}

const CADA_MS = 8000; // como mucho una ubicación cada 8 s

const token = () => new URLSearchParams(window.location.search).get("t") || "";

export default function Reparto() {
  const { id } = useParams();
  const [data, setData] = useState<RepartoData | null>(null);
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [ultimoEnvio, setUltimoEnvio] = useState<Date | null>(null);
  const [confirmando, setConfirmando] = useState(false); // "Entregué" pide un segundo toque
  const [, setTick] = useState(0); // refresca el "hace X s"
  const ultimoRef = useRef(0);

  useEffect(() => {
    api
      .get<RepartoData>(`/reparto/${encodeURIComponent(id || "")}`, { params: { t: token() } })
      .then((r) => {
        setMonedaMenu(r.data.local.moneda);
        setData(r.data);
        document.title = `Reparto #${r.data.id} · ${r.data.local.nombre}`;
      })
      .catch(() => setError(true));
  }, [id]);

  const enCamino = data?.estado === "en_camino";

  // Mientras está en camino: GPS + pantalla encendida.
  useEffect(() => {
    if (!enCamino || !data) return;
    if (!("geolocation" in navigator)) {
      setAviso("Este celular no permite compartir la ubicación.");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const ahora = Date.now();
        if (ahora - ultimoRef.current < CADA_MS) return;
        ultimoRef.current = ahora;
        api
          .post(`/reparto/${data.id}/ubicacion`, { t: token(), lat: pos.coords.latitude, lng: pos.coords.longitude })
          .then(() => {
            setUltimoEnvio(new Date());
            setAviso("");
          })
          .catch((e) => {
            const estado = e?.response?.data?.estado;
            if (estado) setData((d) => (d ? { ...d, estado } : d));
            else setAviso("No se pudo mandar la ubicación. Revisá la conexión.");
          });
      },
      (err) =>
        setAviso(
          err.code === err.PERMISSION_DENIED
            ? "Activá el permiso de ubicación para que el cliente te vea en el mapa."
            : "No se pudo obtener la ubicación.",
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    // La pantalla no se apaga mientras se comparte (si el navegador lo permite).
    let lock: WakeLockSentinel | null = null;
    let activo = true;
    const pedirLock = () => {
      if (document.visibilityState === "visible" && "wakeLock" in navigator && !lock) {
        navigator.wakeLock
          .request("screen")
          .then((l) => {
            if (!activo) return void l.release().catch(() => {});
            lock = l;
            l.addEventListener("release", () => (lock = null));
          })
          .catch(() => {});
      }
    };
    pedirLock();
    document.addEventListener("visibilitychange", pedirLock);
    return () => {
      navigator.geolocation.clearWatch(watch);
      activo = false;
      document.removeEventListener("visibilitychange", pedirLock);
      lock?.release().catch(() => {});
    };
  }, [enCamino, data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const accion = useCallback(
    async (que: "salir" | "entregar") => {
      if (!data) return;
      if (que === "entregar" && !confirmando) {
        setConfirmando(true);
        window.setTimeout(() => setConfirmando(false), 4000);
        return;
      }
      setConfirmando(false);
      setOcupado(true);
      setAviso("");
      try {
        const r = await api.post<{ estado: string }>(`/reparto/${data.id}/${que}`, { t: token() });
        setData((d) => (d ? { ...d, estado: r.data.estado } : d));
      } catch (e) {
        const res = (e as { response?: { data?: { message?: string; estado?: string } } }).response?.data;
        if (res?.estado) setData((d) => (d ? { ...d, estado: res.estado! } : d));
        setAviso(res?.message || "No se pudo actualizar. Probá de nuevo.");
      } finally {
        setOcupado(false);
      }
    },
    [data, confirmando],
  );

  useEffect(() => {
    const reloj = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => window.clearInterval(reloj);
  }, []);

  const pageStyle = paletteVars(data?.local.color_primario);

  if (error || !data) {
    return (
      <div className="mn grid min-h-[100dvh] place-items-center p-6 text-center" style={pageStyle}>
        {error ? (
          <div className="max-w-sm">
            <h1 className="mn-display text-[clamp(2.25rem,9vw,3.5rem)]">Link no válido</h1>
            <p className="mt-4 text-[var(--fg-2)]">Pedile al local que te vuelva a mandar el link del pedido.</p>
          </div>
        ) : (
          <p className="text-[15px] font-semibold" role="status">Cargando pedido…</p>
        )}
      </div>
    );
  }

  const cerrado = data.estado === "entregado" || data.estado === "cancelado";
  const segs = ultimoEnvio ? Math.round((Date.now() - ultimoEnvio.getTime()) / 1000) : 0;
  const atrasado = segs > 30;
  const tel = (data.telefono || "").replace(/\D/g, "");
  const mapsUrl = data.direccion
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.direccion)}`
    : null;

  return (
    <div className="mn min-h-[100dvh] px-4 py-6" style={pageStyle}>
      <main className="mx-auto max-w-md">
        <header className="mn-sobre-color rounded-[var(--r-lg)] px-6 pb-6 pt-6" style={{ background: PRIMARY, color: PRIMARY_ON }}>
          <p className="mn-label opacity-80">Reparto · {data.local.nombre}</p>
          <h1 className="mn-display mt-2 text-[clamp(2rem,9vw,2.75rem)]">Pedido #{data.id}</h1>
          <p className="mt-3 text-[16px] font-semibold" role="status">
            {data.estado === "en_camino"
              ? "En camino · compartiendo tu ubicación"
              : data.estado === "entregado"
                ? "Entregado. ¡Gracias!"
                : data.estado === "cancelado"
                  ? "Este pedido fue cancelado"
                  : "Listo para salir"}
          </p>
        </header>

        <section className="mt-4 space-y-4 rounded-[var(--r-lg)] bg-[var(--surface)] px-6 py-5">
          {data.cliente && (
            <div>
              <p className="mn-label text-[var(--fg-2)]">Cliente</p>
              <p className="mt-1 text-[17px] font-semibold">{data.cliente}</p>
            </div>
          )}
          {data.direccion && (
            <div>
              <p className="mn-label text-[var(--fg-2)]">Dirección</p>
              <p className="mt-1 text-[17px] font-semibold">{data.direccion}</p>
              {mapsUrl && (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="mn-btn mn-btn-borde mt-3 w-full">
                  Cómo llegar <span className="sr-only">(abre Google Maps)</span>
                </a>
              )}
            </div>
          )}
          {tel && (
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${tel}`} className="mn-btn mn-btn-borde min-h-[2.75rem] flex-1 text-[15px]">Llamar</a>
              <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="mn-btn mn-btn-borde min-h-[2.75rem] flex-1 text-[15px]">
                WhatsApp
              </a>
            </div>
          )}
          {data.nota && (
            <div>
              <p className="mn-label text-[var(--fg-2)]">Nota</p>
              <p className="mt-1">{data.nota}</p>
            </div>
          )}
          <div className="border-t border-dashed border-[var(--field-border)] pt-4">
            <ul className="space-y-1 text-[15px]">
              {data.items.map((it, i) => (
                <li key={i}>
                  <span className="mn-num font-semibold">
                    {it.unidad === "kg" ? fmtPeso(Number(it.cantidad)) : `${it.cantidad} ×`}
                  </span>{" "}
                  {it.nombre}
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-baseline justify-between">
              <span className="mn-label">Total a cobrar</span>
              <span className="mn-num text-[1.5rem] font-extrabold">{fmt(Number(data.total))}</span>
            </p>
          </div>
        </section>

        {aviso && (
          <p role="status" className="mt-4 rounded-[var(--r-sm)] bg-[var(--err-bg)] px-4 py-3 text-[15px] font-semibold text-[var(--err)]">
            {aviso}
          </p>
        )}

        {!cerrado && (
          <div className="mt-4 space-y-3">
            {enCamino ? (
              <>
                <button
                  type="button"
                  className="mn-btn w-full"
                  disabled={ocupado}
                  aria-busy={ocupado}
                  onClick={() => accion("entregar")}
                >
                  {ocupado ? "Enviando…" : confirmando ? "Tocá de nuevo para confirmar" : "Entregué el pedido"}
                </button>
                <p
                  role="status"
                  className={`text-center text-[15px] ${atrasado ? "font-semibold text-[var(--err)]" : "text-[var(--fg)]"}`}
                >
                  {ultimoEnvio
                    ? atrasado
                      ? `Sin enviar ubicación hace ${segs} s. Revisá el GPS y la conexión.`
                      : "Compartiendo ubicación."
                    : "Buscando tu ubicación…"}{" "}
                  Dejá esta página abierta hasta entregar.
                </p>
              </>
            ) : (
              <button type="button" className="mn-btn w-full" disabled={ocupado} aria-busy={ocupado} onClick={() => accion("salir")}>
                {ocupado ? "Enviando…" : "Salí con el pedido"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
