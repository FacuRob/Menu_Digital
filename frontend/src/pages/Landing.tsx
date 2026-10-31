import { useEffect, useState, type ReactNode } from "react";
import PhoneCarousel from "../components/landing/PhoneCarousel";
import { DEMOS } from "../components/landing/demos";
import { ADMIN_LOGIN_URL, ADMIN_SIGNUP_URL } from "../lib/links";
import logo from "../assets/brand/Logo.png";

const BRAND = "DinexFlow";
const TRIAL_DIAS = 14;

// ── Utilidades ───────────────────────────────────────────────

// Revela con animación los elementos `.lp-reveal` al entrar en pantalla.
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".lp-reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Logo({ size = 40 }: { size?: number }) {
  // El PNG trae mucho margen: lo recortamos dentro de un cuadrado.
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-xl bg-white/95 shadow-lg shadow-cyan-500/10"
      style={{ width: size, height: size }}
    >
      <img
        src={logo}
        alt=""
        className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2"
        style={{ height: size * 1.9 }}
      />
    </span>
  );
}

const GRADIENT_TEXT =
  "bg-gradient-to-r from-cyan-300 via-teal-200 to-amber-300 bg-clip-text text-transparent";

function SectionTitle({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: string;
}) {
  return (
    <div className="lp-reveal mx-auto max-w-2xl text-center">
      <span className="inline-block rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-cyan-300">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h2>
      {desc && <p className="mt-4 text-base text-slate-400 sm:text-lg">{desc}</p>}
    </div>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-5 w-5 shrink-0 ${className}`}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Navbar ───────────────────────────────────────────────────
const NAV = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
  { href: "#faq", label: "Preguntas" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? "border-b border-white/10 bg-[#060912]/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-lg font-bold tracking-tight text-white">{BRAND}</span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href={ADMIN_LOGIN_URL}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white"
          >
            Ingresar
          </a>
          <a
            href={ADMIN_SIGNUP_URL}
            className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition-transform hover:-translate-y-0.5"
          >
            Probar gratis
          </a>
        </div>

        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg text-slate-200 ring-1 ring-white/10 md:hidden"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/10 px-4 pb-5 pt-2 md:hidden">
          {NAV.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-base text-slate-200 hover:bg-white/5"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={ADMIN_LOGIN_URL}
              className="rounded-xl px-4 py-3 text-center text-sm font-medium text-white ring-1 ring-white/15"
            >
              Ingresar
            </a>
            <a
              href={ADMIN_SIGNUP_URL}
              className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 px-4 py-3 text-center text-sm font-semibold text-slate-950"
            >
              Probar gratis
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function Hero() {
  const [demo, setDemo] = useState(0);
  const accent = DEMOS[demo].accent;

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-32 lg:pt-36 lg:pb-24">
      {/* Fondo */}
      <div className="lp-grid-bg pointer-events-none absolute inset-0" />
      <div className="lp-blob pointer-events-none absolute -left-40 top-10 h-[480px] w-[480px] rounded-full bg-cyan-500/20 blur-[120px]" />
      <div
        className="lp-blob pointer-events-none absolute -right-32 top-40 h-[520px] w-[520px] rounded-full blur-[130px] transition-colors duration-1000"
        style={{ background: `${accent}33`, animationDelay: "-6s" }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:px-8">
        <div className="text-center lg:text-left">
          <a
            href="#producto"
            className="lp-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-3 text-xs text-slate-300 backdrop-blur transition-colors hover:border-white/20"
          >
            <span className="rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-2 py-0.5 font-semibold text-slate-950">
              Nuevo
            </span>
            Pedidos directo a tu WhatsApp
            <span aria-hidden>→</span>
          </a>

          <h1
            className="lp-rise mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            Tu menú digital
            <br />
            <span className={`lp-shine ${GRADIENT_TEXT}`}>que vende solo.</span>
          </h1>

          <p
            className="lp-rise mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg lg:mx-0"
            style={{ animationDelay: "160ms" }}
          >
            Creá la carta de tu restaurante, bar o cafetería en minutos. Tus clientes escanean el QR,
            eligen y te piden por WhatsApp. Vos controlás pedidos, stock y ventas desde un solo panel.
          </p>

          <div
            className="lp-rise mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
            style={{ animationDelay: "240ms" }}
          >
            <a
              href={ADMIN_SIGNUP_URL}
              className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-300 px-7 py-4 text-base font-bold text-slate-950 shadow-2xl shadow-cyan-500/30 transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Empezar gratis {TRIAL_DIAS} días
              <span className="transition-transform group-hover:translate-x-1" aria-hidden>
                →
              </span>
            </a>
            <a
              href="#precios"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 sm:w-auto"
            >
              Ver planes
            </a>
          </div>

          <ul
            className="lp-rise mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400 lg:justify-start"
            style={{ animationDelay: "320ms" }}
          >
            {["Sin tarjeta de crédito", "Listo en 5 minutos", "Cancelás cuando quieras"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-teal-300" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Carrusel + tarjetas flotantes */}
        <div className="lp-rise relative" style={{ animationDelay: "200ms" }}>
          <PhoneCarousel onChange={setDemo} />

          <div className="lp-float pointer-events-none absolute left-0 top-10 hidden w-56 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-xl sm:block xl:-left-6">
            <div className="flex items-center gap-3">
              <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-lg">
                <span className="lp-ping-soft absolute inset-0 rounded-xl bg-emerald-400/30" />
                🔔
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white">Nuevo pedido #128</div>
                <div className="text-[11px] text-slate-400">Mesa 4 · $24.600</div>
              </div>
            </div>
          </div>

          <div
            className="lp-float-slow pointer-events-none absolute bottom-28 right-0 hidden w-48 rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur-xl sm:block xl:-right-4"
            style={{ animationDelay: "-3s" }}
          >
            <div className="text-[11px] text-slate-400">Escaneos de QR hoy</div>
            <div className="mt-1 flex items-end justify-between">
              <span className="text-2xl font-bold text-white">342</span>
              <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                +18%
              </span>
            </div>
            <div className="mt-2 flex h-8 items-end gap-1">
              {[40, 55, 35, 70, 60, 85, 100].map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-sm bg-gradient-to-t from-cyan-500/40 to-teal-300"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Cinta de rubros ──────────────────────────────────────────
const RUBROS = [
  "🍔 Hamburgueserías",
  "☕ Cafeterías",
  "🍕 Pizzerías",
  "🍣 Sushi",
  "🍦 Heladerías",
  "🍸 Bares",
  "🥗 Comida saludable",
  "🥐 Panaderías",
  "🌮 Food trucks",
  "🍝 Restaurantes",
  "🧋 Bubble tea",
  "🍩 Pastelerías",
];

function Marquee() {
  const row = [...RUBROS, ...RUBROS];
  return (
    <section className="relative border-y border-white/5 bg-white/[0.02] py-6">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Pensado para cualquier negocio gastronómico
      </p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <div className="lp-marquee flex w-max gap-3">
          {row.map((r, i) => (
            <span
              key={i}
              className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-slate-300"
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Funcionalidades (bento) ──────────────────────────────────
type Feature = { icon: string; title: string; desc: string; span?: string; accent: string };
const FEATURES: Feature[] = [
  {
    icon: "📱",
    title: "Menú con QR al instante",
    desc: "Generá el QR de tu local, imprimilo y listo. Cambiás precios o fotos y se actualiza al momento, sin reimprimir nada.",
    span: "md:col-span-2",
    accent: "from-cyan-400/20",
  },
  {
    icon: "💬",
    title: "Pedidos por WhatsApp",
    desc: "El cliente arma su pedido y te llega ordenado a tu WhatsApp, listo para preparar.",
    accent: "from-emerald-400/20",
  },
  {
    icon: "🧾",
    title: "Panel de pedidos y tickets",
    desc: "Seguí cada pedido por estado e imprimí tickets desde el panel.",
    accent: "from-amber-400/20",
  },
  {
    icon: "📊",
    title: "Analíticas de ventas",
    desc: "Descubrí tus productos estrella, horarios pico y cuánto vendés por día.",
    accent: "from-fuchsia-400/20",
  },
  {
    icon: "🎨",
    title: "Tu marca, tu estilo",
    desc: "Logo, colores, portada y horarios. Tu menú se ve como tu local, no como una plantilla.",
    accent: "from-sky-400/20",
  },
  {
    icon: "📦",
    title: "Stock y variantes",
    desc: "Tamaños, extras y modificadores. Avisos de stock bajo para no vender lo que no tenés.",
    accent: "from-orange-400/20",
  },
  {
    icon: "🏪",
    title: "Varios locales y equipo",
    desc: "Administrá todas tus sucursales desde una cuenta y sumá a tu equipo con permisos por rol.",
    span: "md:col-span-2",
    accent: "from-teal-400/20",
  },
  {
    icon: "🌎",
    title: "Multi-idioma",
    desc: "Tu menú en español, inglés y portugués para recibir turistas sin barreras.",
    accent: "from-violet-400/20",
  },
];

function Features() {
  return (
    <section id="producto" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Producto"
          title={
            <>
              Todo lo que tu local necesita,{" "}
              <span className={GRADIENT_TEXT}>en un solo lugar</span>
            </>
          }
          desc="Dejá de pelearte con PDFs y cartas impresas. DinexFlow convierte tu menú en una herramienta de ventas."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`lp-reveal group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.05] ${f.span ?? ""}`}
              style={{ transitionDelay: `${(i % 4) * 70}ms` }}
            >
              <div
                className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br ${f.accent} to-transparent opacity-60 blur-2xl transition-opacity group-hover:opacity-100`}
              />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-2xl">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Cómo funciona ────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    title: "Creá tu cuenta",
    desc: `Registrate gratis y elegí el rubro de tu negocio. Tenés ${TRIAL_DIAS} días para probar todo.`,
  },
  {
    n: "02",
    title: "Cargá tu menú",
    desc: "Sumá categorías, productos, fotos y precios. Personalizá colores, logo y horarios.",
  },
  {
    n: "03",
    title: "Compartí tu QR",
    desc: "Poné el QR en las mesas, en Instagram o en tu vidriera. Los pedidos empiezan a llegar.",
  },
];

function HowItWorks() {
  return (
    <section id="como-funciona" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[500px] -translate-y-1/2 bg-gradient-to-r from-cyan-500/5 via-teal-500/10 to-amber-500/5 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Cómo funciona"
          title={
            <>
              De cero a recibir pedidos <span className={GRADIENT_TEXT}>en 3 pasos</span>
            </>
          }
        />

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="lp-reveal relative rounded-3xl border border-white/10 bg-[#0a0f1c]/80 p-7 text-center backdrop-blur"
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-teal-400/5 text-2xl font-extrabold text-cyan-200 shadow-[0_0_40px_-10px] shadow-cyan-400/50">
                {s.n}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Números */}
        <div className="lp-reveal mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-4">
          {[
            { v: "5 min", l: "para tener tu menú online" },
            { v: "0", l: "reimpresiones de carta" },
            { v: "24/7", l: "tu menú siempre disponible" },
            { v: "3", l: "idiomas para tus clientes" },
          ].map((s) => (
            <div key={s.l} className="bg-[#070b15] p-6 text-center sm:p-8">
              <div className={`text-3xl font-extrabold sm:text-4xl ${GRADIENT_TEXT}`}>{s.v}</div>
              <div className="mt-1 text-xs text-slate-400 sm:text-sm">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Precios ──────────────────────────────────────────────────
// Deben coincidir con el catálogo del panel (frontend-admin › Suscripcion).
type Plan = {
  code: string;
  name: string;
  desc: string;
  mensual: number;
  anual: number;
  perks: string[];
  highlight?: boolean;
  cta: string;
};
const PLANES: Plan[] = [
  {
    code: "basic",
    name: "Basic",
    desc: "Para arrancar con tu primer local.",
    mensual: 9.99,
    anual: 99,
    perks: [
      "Hasta 3 negocios",
      "50 productos por negocio",
      "Menú con QR ilimitado",
      "Pedidos por WhatsApp",
      "Variantes y modificadores",
      "Personalización del menú",
    ],
    cta: "Empezar con Basic",
  },
  {
    code: "standard",
    name: "Standard",
    desc: "El favorito de los locales que crecen.",
    mensual: 19.99,
    anual: 199,
    perks: [
      "Todo lo de Basic",
      "Hasta 10 negocios",
      "100 productos por negocio",
      "Analíticas de ventas",
      "Control de stock",
    ],
    highlight: true,
    cta: "Elegir Standard",
  },
  {
    code: "premium",
    name: "Premium",
    desc: "Para cadenas y franquicias.",
    mensual: 39.99,
    anual: 399,
    perks: [
      "Todo lo de Standard",
      "Negocios ilimitados",
      "Productos ilimitados",
      "Soporte prioritario",
    ],
    cta: "Elegir Premium",
  },
];

const usd = (v: number) =>
  v.toLocaleString("es-AR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

function Pricing() {
  const [anual, setAnual] = useState(false);

  return (
    <section id="precios" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionTitle
          eyebrow="Precios"
          title={
            <>
              Planes simples, <span className={GRADIENT_TEXT}>sin sorpresas</span>
            </>
          }
          desc={`Empezá con ${TRIAL_DIAS} días gratis. Sin tarjeta. Después elegí el plan que mejor le queda a tu negocio.`}
        />

        {/* Toggle mensual / anual */}
        <div className="lp-reveal mt-10 flex justify-center">
          <div className="relative inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1">
            <span
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-white shadow transition-transform duration-300"
              style={{ transform: anual ? "translateX(100%)" : "translateX(0)" }}
            />
            {[
              { v: false, l: "Mensual" },
              { v: true, l: "Anual" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                onClick={() => setAnual(o.v)}
                aria-pressed={anual === o.v}
                className={`relative z-10 w-28 rounded-full py-2 text-sm font-semibold transition-colors sm:w-32 ${
                  anual === o.v ? "text-slate-900" : "text-slate-300"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-amber-300">
          🎁 Pagando anual te llevás 2 meses gratis
        </p>

        <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-3">
          {PLANES.map((p, i) => {
            const precio = anual ? p.anual : p.mensual;
            return (
              <div
                key={p.code}
                className={`lp-reveal relative flex flex-col rounded-3xl p-[1px] ${
                  p.highlight
                    ? "bg-gradient-to-b from-cyan-300 via-teal-400/60 to-amber-300/60 shadow-2xl shadow-cyan-500/20 lg:-my-4"
                    : "bg-white/10"
                }`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div
                  className={`flex h-full flex-col rounded-[23px] p-7 sm:p-8 ${
                    p.highlight ? "bg-[#0a1220]" : "bg-[#080c17]"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-300 to-amber-300 px-3 py-1 text-xs font-bold text-slate-950 shadow-lg">
                      ⭐ Más elegido
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  <p className="mt-1 text-sm text-slate-400">{p.desc}</p>

                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-lg font-semibold text-slate-400">US$</span>
                    <span className="text-5xl font-extrabold tracking-tight text-white">{usd(precio)}</span>
                    <span className="mb-1.5 text-sm text-slate-400">/{anual ? "año" : "mes"}</span>
                  </div>
                  <p className="mt-1 h-5 text-xs text-teal-300">
                    {anual ? `Equivale a US$ ${usd(Math.round((p.anual / 12) * 100) / 100)}/mes` : ""}
                  </p>

                  <a
                    href={ADMIN_SIGNUP_URL}
                    className={`mt-6 block rounded-2xl py-3.5 text-center text-sm font-bold transition-transform hover:-translate-y-0.5 ${
                      p.highlight
                        ? "bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 shadow-lg shadow-cyan-500/25"
                        : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/15"
                    }`}
                  >
                    {p.cta}
                  </a>

                  <ul className="mt-7 space-y-3 text-sm">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2.5 text-slate-300">
                        <Check className={p.highlight ? "text-cyan-300" : "text-teal-400/80"} />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lp-reveal mx-auto mt-10 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center sm:flex-row sm:text-left">
          <div>
            <div className="font-semibold text-white">¿Querés probar antes de decidir?</div>
            <div className="text-sm text-slate-400">
              Prueba gratis de {TRIAL_DIAS} días con todas las funciones. Sin tarjeta de crédito.
            </div>
          </div>
          <a
            href={ADMIN_SIGNUP_URL}
            className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition-transform hover:-translate-y-0.5"
          >
            Crear cuenta gratis
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Preguntas frecuentes ─────────────────────────────────────
const FAQS = [
  {
    q: "¿Necesito saber de tecnología?",
    a: "No. Si sabés usar WhatsApp, sabés usar DinexFlow. Cargás tus productos desde el panel y el menú se arma solo.",
  },
  {
    q: "¿Cómo adquiero el servicio?",
    a: `Creás tu cuenta gratis y usás todo durante ${TRIAL_DIAS} días. Cuando quieras, desde el panel entrás a "Suscripción", elegís un plan y pagás online con tarjeta. Se activa al instante.`,
  },
  {
    q: "¿Mis clientes tienen que descargar una app?",
    a: "No. Escanean el QR con la cámara del celular y el menú se abre en el navegador, al instante.",
  },
  {
    q: "¿Puedo cambiar precios cuando quiera?",
    a: "Sí, todas las veces que quieras. Los cambios se ven en el menú en el momento, sin reimprimir el QR.",
  },
  {
    q: "¿Puedo cancelar o cambiar de plan?",
    a: "Sí. Podés subir, bajar o cancelar tu plan cuando quieras desde el panel, sin permanencia mínima.",
  },
  {
    q: "¿Sirve para varios locales?",
    a: "Sí. Según tu plan podés administrar varios negocios desde una sola cuenta, cada uno con su propio menú y QR.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionTitle eyebrow="Preguntas" title="Preguntas frecuentes" />
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className={`lp-reveal overflow-hidden rounded-2xl border transition-colors ${
                  isOpen ? "border-cyan-400/30 bg-cyan-400/[0.04]" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                >
                  <span className="font-medium text-white">{f.q}</span>
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 text-slate-300 transition-transform duration-300 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                <div
                  className="grid transition-[grid-template-rows] duration-300 ease-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400 sm:px-6">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── CTA final + footer ───────────────────────────────────────
function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 lg:px-8">
      <div className="lp-reveal relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 via-teal-500/10 to-amber-500/20 px-6 py-16 text-center sm:px-12 sm:py-20">
        <div className="lp-grid-bg pointer-events-none absolute inset-0 opacity-60" />
        <div className="lp-blob pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
        <div
          className="lp-blob pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-amber-400/25 blur-3xl"
          style={{ animationDelay: "-8s" }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Tu próximo cliente ya tiene el celular en la mano.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
            Dale un menú que lo haga pedir. Creá el tuyo hoy, gratis.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={ADMIN_SIGNUP_URL}
              className="w-full rounded-2xl bg-white px-7 py-4 text-base font-bold text-slate-900 shadow-2xl transition-transform hover:-translate-y-0.5 sm:w-auto"
            >
              Crear mi menú gratis →
            </a>
            <a
              href={ADMIN_LOGIN_URL}
              className="w-full rounded-2xl border border-white/20 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto"
            >
              Ya tengo cuenta
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="font-semibold text-white">{BRAND}</span>
          <span className="text-sm text-slate-500">· Menús digitales que venden</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-slate-400">
          {NAV.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </a>
          ))}
          <a href={ADMIN_LOGIN_URL} className="hover:text-white">
            Panel admin
          </a>
        </div>
        <div className="text-xs text-slate-500">© {new Date().getFullYear()} {BRAND}</div>
      </div>
    </footer>
  );
}

export default function Landing() {
  useReveal();

  useEffect(() => {
    const prev = document.title;
    document.title = `${BRAND} · Menú digital con QR y pedidos por WhatsApp`;
    const html = document.documentElement;
    const prevScroll = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      document.title = prev;
      html.style.scrollBehavior = prevScroll;
    };
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#060912] font-sans text-slate-200 antialiased selection:bg-cyan-400/30">
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
