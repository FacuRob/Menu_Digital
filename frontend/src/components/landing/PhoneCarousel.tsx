import { useCallback, useEffect, useRef, useState } from "react";
import { DEMOS, type Demo } from "./demos";

const AUTOPLAY_MS = 3800;

// ── Pantalla del teléfono: un menú de ejemplo en miniatura ──
function PhoneScreen({ d }: { d: Demo }) {
  return (
    <div className="h-full w-full overflow-hidden text-white" style={{ background: d.bg }}>
      {/* Portada */}
      <div className="relative px-4 pt-9 pb-4">
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(circle at 80% 0%, ${d.accent}, transparent 60%)` }}
        />
        <div className="relative flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-2xl text-2xl shadow-lg"
            style={{ background: `${d.accent}33`, border: `1px solid ${d.accent}66` }}
          >
            {d.emoji}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold leading-tight">{d.nombre}</div>
            <div className="truncate text-[10.5px] text-white/60">{d.tagline}</div>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-1.5 text-[10px]">
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Abierto
          </span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">⭐ 4.9</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">25-35 min</span>
        </div>
      </div>

      {/* Buscador */}
      <div className="mx-4 flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-[10.5px] text-white/40 ring-1 ring-white/10">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        Buscar productos
      </div>

      {/* Categorías */}
      <div className="mt-3 flex gap-1.5 overflow-hidden px-4">
        {d.cats.map((c, i) => (
          <span
            key={c}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
            style={
              i === 0
                ? { background: d.accent, color: "#0b0b0b" }
                : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }
            }
          >
            {c}
          </span>
        ))}
      </div>

      {/* Productos */}
      <div className="mt-3 space-y-2 px-4">
        {d.items.map((it) => (
          <div key={it.name} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/[0.07]">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-[26px]"
              style={{ background: `linear-gradient(135deg, ${d.accent}40, ${d.accent}10)` }}
            >
              {it.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[11.5px] font-semibold">{it.name}</span>
                {it.tag && (
                  <span
                    className="rounded px-1 py-px text-[8px] font-bold uppercase"
                    style={{ background: `${d.accent}30`, color: d.accent }}
                  >
                    {it.tag}
                  </span>
                )}
              </div>
              <div className="truncate text-[9.5px] text-white/50">{it.desc}</div>
              <div className="mt-0.5 text-[11.5px] font-bold" style={{ color: d.accent }}>
                {it.price}
              </div>
            </div>
            <div
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold text-black"
              style={{ background: d.accent }}
            >
              +
            </div>
          </div>
        ))}
      </div>

      {/* Botón de pedido */}
      <div className="absolute inset-x-4 bottom-5">
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-2.5 text-[11px] font-bold text-black shadow-xl"
          style={{ background: d.accent, boxShadow: `0 10px 30px -8px ${d.accent}` }}
        >
          <span className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-black/20 text-[10px]">2</span>
            <span className="whitespace-nowrap">Ver pedido</span>
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            Pedir
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
              <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.4z" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

function Phone({ d }: { d: Demo }) {
  return (
    <div className="relative h-[520px] w-[260px] rounded-[44px] bg-gradient-to-b from-slate-700 to-slate-900 p-[7px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
      <div className="relative h-full w-full overflow-hidden rounded-[38px] bg-black">
        <div className="absolute left-1/2 top-2 z-10 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-black" />
        <PhoneScreen d={d} />
      </div>
    </div>
  );
}

// ── Carrusel "coverflow" de teléfonos, con autoplay, swipe y teclado ──
export default function PhoneCarousel({
  onChange,
}: {
  onChange?: (i: number) => void;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = DEMOS.length;

  const go = useCallback(
    (i: number) => {
      const next = ((i % n) + n) % n;
      setActive(next);
      onChange?.(next);
    },
    [n, onChange],
  );

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => go(active + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active, paused, go]);

  // Distancia circular (-n/2..n/2) entre una tarjeta y la activa.
  const offset = (i: number) => {
    let o = i - active;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        if (e.key === "ArrowLeft") go(active - 1);
      }}
      tabIndex={0}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Ejemplos de menús por rubro"
    >
      {/* Escenario */}
      <div className="relative mx-auto h-[540px] w-full max-w-[560px] [perspective:1400px]">
        {DEMOS.map((d, i) => {
          const o = offset(i);
          const abs = Math.abs(o);
          const visible = abs <= 1;
          return (
            <button
              type="button"
              key={d.nombre}
              aria-label={`Ver ejemplo: ${d.rubro}`}
              aria-hidden={!visible}
              tabIndex={visible ? 0 : -1}
              onClick={() => go(i)}
              className="absolute left-1/2 top-1/2 cursor-pointer outline-none transition-all duration-700 ease-[cubic-bezier(.2,.7,.2,1)]"
              style={{
                transform: `translate(-50%, -50%) translateX(${o * 62}%) scale(${o === 0 ? 1 : 0.8}) rotateY(${o * -22}deg)`,
                opacity: visible ? (o === 0 ? 1 : 0.45) : 0,
                zIndex: 10 - abs,
                // Las que no se ven no se pintan (menos trabajo para el celular).
                visibility: visible ? "visible" : "hidden",
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              <Phone d={d} />
              {o === 0 && (
                <div
                  className="pointer-events-none absolute -inset-24 -z-10 rounded-full transition-colors duration-700"
                  style={{ background: `radial-gradient(closest-side, ${d.accent}66, transparent)` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selector de rubro + progreso */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {DEMOS.map((d, i) => (
          <button
            type="button"
            key={d.rubro}
            onClick={() => go(i)}
            className={`relative overflow-hidden rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              i === active
                ? "bg-white text-slate-900 shadow-lg"
                : "bg-white/5 text-slate-300 ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            <span className="relative z-10">
              {d.emoji} {d.rubro}
            </span>
            {i === active && !paused && (
              <span
                key={active}
                className="lp-progress absolute inset-x-0 bottom-0 h-[2px]"
                style={{ background: d.accent, animationDuration: `${AUTOPLAY_MS}ms` }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
