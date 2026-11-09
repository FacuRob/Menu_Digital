import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@fontsource-variable/archivo/wdth.css";
import "../components/menu/menu.css";
import api from "../services/api";
import { paletteVars, PRIMARY, PRIMARY_ON } from "../lib/menuUi";

// Mapa del delivery para el cliente: /seguimiento/<id>?t=<firma>. Llega en el
// aviso de WhatsApp de "en camino". Se actualiza solo cada 10 s.
interface SeguimientoData {
  id: number;
  estado: string;
  cliente: string | null;
  ubicacion: { lat: number; lng: number; at: string } | null;
  ticket: string | null;
  local: { nombre: string; telefono?: string | null; color_primario?: string | null };
}

const CADA_MS = 10000;
const FINALES = ["entregado", "cancelado"];

const TITULO: Record<string, string> = {
  pendiente: "Recibimos tu pedido",
  preparando: "Estamos preparando tu pedido",
  listo: "Tu pedido está listo",
  en_camino: "Tu pedido va en camino",
  entregado: "¡Pedido entregado!",
  cancelado: "Pedido cancelado",
};

const haceCuanto = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
};

export default function Seguimiento() {
  const { id } = useParams();
  const [data, setData] = useState<SeguimientoData | null>(null);
  const [error, setError] = useState(false);
  const [, setTick] = useState(0); // refresca el "hace X s"
  const mapaEl = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const moto = useRef<L.CircleMarker | null>(null);

  // Carga y vuelve a consultar hasta que el pedido termina.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    let timer: number | undefined;
    let vivo = true;
    const cargar = () =>
      api
        .get<SeguimientoData>(`/seguimiento/${encodeURIComponent(id || "")}`, { params: { t } })
        .then((r) => {
          if (!vivo) return;
          setData(r.data);
          document.title = `${TITULO[r.data.estado] || "Tu pedido"} · ${r.data.local.nombre}`;
          if (!FINALES.includes(r.data.estado)) timer = window.setTimeout(cargar, CADA_MS);
        })
        .catch((e) => {
          if (!vivo) return;
          if (e?.response?.status === 404) setError(true);
          else timer = window.setTimeout(cargar, CADA_MS); // sin conexión: reintenta
        });
    cargar();
    const reloj = window.setInterval(() => setTick((n) => n + 1), 5000);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
      window.clearInterval(reloj);
    };
  }, [id]);

  // Mapa: se crea con la primera ubicación y después sólo se mueve el punto.
  const ubic = data?.ubicacion;
  useEffect(() => {
    if (!ubic || !mapaEl.current) return;
    const pos: L.LatLngExpression = [ubic.lat, ubic.lng];
    if (!mapa.current) {
      mapa.current = L.map(mapaEl.current, { zoomControl: true, attributionControl: true }).setView(pos, 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa.current);
      const color = getComputedStyle(mapaEl.current).getPropertyValue("--mp").trim() || "#ff5722";
      moto.current = L.circleMarker(pos, { radius: 11, color: "#111216", weight: 3, fillColor: color, fillOpacity: 1 })
        .bindTooltip("Repartidor")
        .addTo(mapa.current);
    } else {
      moto.current?.setLatLng(pos);
      if (!mapa.current.getBounds().pad(-0.2).contains(pos)) mapa.current.panTo(pos);
    }
  }, [ubic?.lat, ubic?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al salir de la página se libera el mapa.
  useEffect(
    () => () => {
      mapa.current?.remove();
      mapa.current = null;
      moto.current = null;
    },
    [],
  );

  // El mapa se va cuando el pedido deja de estar en camino.
  useEffect(() => {
    if (ubic || !mapa.current) return;
    mapa.current.remove();
    mapa.current = null;
    moto.current = null;
  }, [ubic]);

  const pageStyle = paletteVars(data?.local.color_primario);

  if (error || !data) {
    return (
      <div className="mn grid min-h-[100dvh] place-items-center p-6 text-center" style={pageStyle}>
        {error ? (
          <div className="max-w-sm">
            <h1 className="mn-display text-[clamp(2.25rem,9vw,3.5rem)]">Link no válido</h1>
            <p className="mt-4 text-[var(--fg-2)]">Revisá que el link esté completo, tal como te llegó por WhatsApp.</p>
          </div>
        ) : (
          <p className="text-[15px] font-semibold" role="status">Buscando tu pedido…</p>
        )}
      </div>
    );
  }

  const tel = (data.local.telefono || "").replace(/\D/g, "");

  return (
    <div className="mn flex min-h-[100dvh] flex-col" style={pageStyle}>
      <header className="mn-sobre-color px-5 pb-5 pt-5" style={{ background: PRIMARY, color: PRIMARY_ON }}>
        <div className="mx-auto max-w-2xl">
          <p className="mn-label opacity-80">
            {data.local.nombre} · Pedido #{data.id}
          </p>
          <h1 className="mn-display mt-2 text-[clamp(1.9rem,8vw,2.75rem)]">{TITULO[data.estado] || "Tu pedido"}</h1>
          <p className="sr-only" role="status">{TITULO[data.estado] || ""}</p>
        </div>
      </header>

      {data.estado === "en_camino" && (
        <div className="relative h-[55dvh] min-h-[320px]">
          <div ref={mapaEl} className="absolute inset-0" role="region" aria-label="Mapa con la ubicación del repartidor" />
          {!ubic && (
            <p className="absolute inset-0 grid place-items-center px-6 text-center text-[15px] font-semibold text-[var(--fg-2)]">
              Esperando la ubicación del repartidor…
            </p>
          )}
        </div>
      )}

      <footer className="mx-auto w-full max-w-2xl space-y-3 px-5 py-5">
        {data.estado === "en_camino" && ubic && (
          <p className="text-[15px] text-[var(--fg)]">Ubicación actualizada {haceCuanto(ubic.at)}.</p>
        )}
        {data.estado !== "en_camino" && !FINALES.includes(data.estado) && (
          <p className="text-[16px] text-[var(--fg)]">Cuando el repartidor salga, vas a ver acá su ubicación en el mapa.</p>
        )}
        {data.ticket && (
          <a href={data.ticket} className="mn-btn w-full">
            Ver mi ticket
          </a>
        )}
        {tel && !FINALES.includes(data.estado) && (
          <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className="mn-btn mn-btn-borde w-full">
            Escribir al local
          </a>
        )}
      </footer>
    </div>
  );
}
