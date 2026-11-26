import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/bodoni-moda/latin-400-italic.css";
import "../components/landing/landing.css";
import { ADMIN_LOGIN_URL, ADMIN_SIGNUP_URL } from "../lib/links";
import { useSmoothScroll } from "../components/landing/useSmoothScroll";
import OrderDemo from "../components/landing/OrderDemo";
import Telefono from "../components/landing/Telefono";
import QrCodigo from "../components/landing/QrCodigo";
import { IconArrow, IconCheck, IconClose, IconMenu, IconUsuario, LogoMark } from "../components/landing/icons";
import { TRIAL_DIAS } from "../lib/planes";
import { TarjetasModulos, TarjetasPlanes } from "../components/landing/Planes";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const BRAND = "DinexFlow";
const CONTENEDOR = "mx-auto w-full max-w-[1600px] px-5 sm:px-8 lg:px-12";

function Flecha() {
  return <IconArrow className="dx-btn-flecha h-4 w-4" />;
}

// ── Navegación ───────────────────────────────────────────────
const NAV = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#probalo", label: "Probalo" },
  { href: "#precios", label: "Precios" },
  { href: "#preguntas", label: "Preguntas" },
];

type TemaNav = "claro" | "oscuro";

function Navbar({ textoRef }: { textoRef: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);

  // Escape cierra el menú y devuelve el foco al botón.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      botonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header>
      {/* Capa de fondo y texto: toma el color de la sección que tiene debajo, así nada se imprime debajo de los links. */}
      <div
        ref={textoRef}
        data-tema="claro"
        className="dx-nav pointer-events-none fixed inset-x-0 top-0 z-50 bg-[var(--nav-fondo,var(--hueso))] text-[var(--tinta)] transition-[color,background-color] duration-300 data-[tema=oscuro]:text-[var(--hueso)]"
      >
        <div className={`${CONTENEDOR} flex h-[4.5rem] items-center gap-4`}>
          <span aria-hidden className="dx-display ml-[2.75rem] hidden text-[1.375rem] sm:inline">
            {BRAND.toLowerCase()}
          </span>
          <nav aria-label="Principal" className="pointer-events-auto ml-4 hidden lg:block xl:ml-10">
            <ul className="flex items-center gap-1">
              {NAV.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-medium hover:underline xl:px-3">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Capa de acciones: logo, botón principal y menú del celular. */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[51]">
        <div className={`${CONTENEDOR} flex h-[4.5rem] items-center justify-between gap-4`}>
          <a href="#top" className="pointer-events-auto flex min-h-11 items-center" aria-label={`${BRAND}, ir al inicio`}>
            <LogoMark size={34} />
          </a>

          <div className="pointer-events-auto flex items-center gap-2">
          {/* Para los que ya tienen cuenta: botón oscuro con filete hueso, se ve sobre cualquier fondo. */}
          {/* El envoltorio oculta el botón en el celular (.dx-btn le gana a "hidden"); ahí está en el menú. */}
          <span className="hidden sm:contents">
            <a
              href={ADMIN_LOGIN_URL}
              className="dx-btn dx-btn-oscuro min-h-11 whitespace-nowrap px-5 text-[0.9375rem] ring-2 ring-[var(--hueso)]/70"
            >
              <IconUsuario className="h-[1.125rem] w-[1.125rem]" />
              Ingresar
            </a>
          </span>
          <a href={ADMIN_SIGNUP_URL} className="dx-btn dx-btn-nav min-h-11 whitespace-nowrap px-4 text-[0.9375rem] sm:px-5">
            Probar gratis
          </a>
          <button
            ref={botonRef}
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-[var(--tinta)] text-[var(--hueso)] ring-2 ring-[var(--hueso)]/70 lg:hidden"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            aria-controls={open ? "menu-movil" : undefined}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
        </div>
      </div>

      {open && (
        <nav
          id="menu-movil"
          aria-label="Menú"
          className="dx-sobre-oscuro fixed inset-x-3 top-[4.75rem] z-[52] rounded-[var(--radio)] bg-[var(--tinta)] px-6 pb-6 pt-3 text-[var(--hueso)] lg:hidden"
        >
          <ul>
            {NAV.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="dx-display flex min-h-14 items-center border-b border-white/10 text-[1.75rem]"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href={ADMIN_LOGIN_URL}
            onClick={() => setOpen(false)}
            className="dx-btn-borde mt-5 w-full gap-2 text-lg font-medium text-[var(--hueso)]"
          >
            <IconUsuario />
            Ingresar a mi panel
          </a>
        </nav>
      )}
    </header>
  );
}

// ── 1. Inicio: el eslogan y el QR que se abre hasta llenar la pantalla ──
// "Tu ___ es Dinex.": la palabra rota una sola vuelta y termina en "empresa";
// al terminar, "Dinex" se subraya. La que sale se desenfoca y la nueva
// aparece letra por letra. Con reducción de movimiento queda quieta en "empresa".
const PALABRAS = ["negocio", "local", "tienda", "taller", "estudio", "empresa"];
const PASO_MS = 1700;
const SALIDA_MS = 750; // un poco más que dx-desenfoca (700 ms) en landing.css

function Eslogan() {
  // Arranca igual que el HTML generado al compilar (sin movimiento reducido)
  // y se corrige al montar: si no, React no coincide con ese HTML.
  const [quieto, setQuieto] = useState(false);
  // paso va de 0 a la última palabra ("empresa") y ahí se queda.
  const [paso, setPaso] = useState(0);
  const [saliendo, setSaliendo] = useState<number | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setQuieto(true);
      setPaso(PALABRAS.length - 1);
      setListo(true);
      return;
    }
    let n = 0;
    let fuera = 0;
    const id = window.setInterval(() => {
      n += 1;
      setSaliendo(n - 1);
      setPaso(n);
      window.clearTimeout(fuera);
      fuera = window.setTimeout(() => setSaliendo(null), SALIDA_MS);
      if (n >= PALABRAS.length - 1) {
        window.clearInterval(id);
        setListo(true);
      }
    }, PASO_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(fuera);
    };
  }, []);

  const palabra = (p: number) => PALABRAS[p % PALABRAS.length];

  return (
    // El tamaño mira el ancho y también el alto: en notebooks (pantalla baja)
    // el título se achica para que el botón entre sin hacer scroll.
    <h1 id="hero-titulo" data-hero-titulo className="dx-display text-[clamp(2.75rem,min(10.5vw,19svh),11rem)]">
      <span className="sr-only">Tu empresa es Dinex.</span>
      <span aria-hidden className="block">
        Tu{" "}
        <span className="dx-rotador">
          {saliendo !== null && (
            <span key={`s${saliendo}`} className="dx-rotador-palabra dx-rotador-sale">
              {palabra(saliendo)}
            </span>
          )}
          <span key={paso} className="dx-rotador-palabra">
            {quieto || paso === 0
              ? palabra(paso)
              : [...palabra(paso)].map((l, i) => (
                  <span key={i} className="dx-rotador-letra" style={{ "--i": i } as CSSProperties}>
                    {l}
                  </span>
                ))}
          </span>
        </span>
      </span>
      <span aria-hidden className="block">
        es{" "}
        <span className="dx-dinex" data-listo={listo}>
          Dinex
        </span>
        .
      </span>
    </h1>
  );
}

function Hero({ qrUrl }: { qrUrl: string }) {
  return (
    <section id="top" data-hero data-nav="claro" data-fondo="hueso" aria-labelledby="hero-titulo" className="relative min-h-[100svh] overflow-hidden bg-[var(--hueso)]">
      <div data-hero-contenido className={`${CONTENEDOR} flex min-h-[100svh] flex-col justify-center gap-10 pb-8 pt-28 lg:gap-[clamp(1.5rem,4svh,4rem)] lg:pb-[clamp(1.5rem,5svh,3rem)] lg:pt-[clamp(5rem,12svh,6rem)]`}>
        <Eslogan />

        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div data-hero-bajada>
            <p className="max-w-[40rem] text-lg leading-relaxed text-[var(--gris)] sm:text-xl">
              Tu página con productos, servicios, presupuestos y turnos. Tus clientes compran, piden o reservan desde el
              celular, y vos manejás todo desde un solo panel.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <a href={ADMIN_SIGNUP_URL} className="dx-btn">
                Probar {TRIAL_DIAS} días gratis
                <Flecha />
              </a>
              <a href="#como-funciona" className="inline-flex min-h-12 items-center justify-center font-semibold underline underline-offset-[6px]">
                Ver cómo funciona
              </a>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.9375rem] text-[var(--gris)] lg:[@media(max-height:700px)]:hidden">
              {["Sin tarjeta de crédito", "Sin app para tus clientes", "Cancelás cuando quieras"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <IconCheck className="h-4 w-4 text-[var(--tinta)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* La ficha QR: real, abre el menú de ejemplo (/menu). */}
          <figure className="relative z-30 flex items-end gap-4 lg:flex-col lg:items-end" data-tile>
            <a href="/menu" aria-label="Abrir la página de ejemplo" className="block w-[clamp(9rem,min(18vw,28svh),17rem)] rounded-[var(--radio)] bg-[var(--tinta)] p-3">
              <QrCodigo texto={qrUrl} className="block w-full rounded-[18px] bg-white text-[var(--tinta)]" />
            </a>
            <figcaption className="max-w-[12rem] text-sm text-[var(--gris)] lg:text-right">
              Escanealo con tu celular: abre una página de ejemplo. <a href="/menu" className="font-semibold text-[var(--tinta)] underline">O probala acá.</a>
            </figcaption>
          </figure>
        </div>
      </div>

      {/* Portal de tinta (sólo con movimiento): crece desde la ficha QR. */}
      <div data-portal aria-hidden className="dx-portal pointer-events-none absolute inset-0 z-20 bg-[var(--tinta)]">
        <p
          data-portal-texto
          className="dx-display absolute inset-0 grid place-items-center px-5 text-center text-[clamp(3.5rem,13vw,13rem)] text-[var(--hueso)] opacity-0"
        >
          <span>
            Escaneá. <span className="dx-serif block text-[0.55em] text-[var(--aji)]">y listo.</span>
          </span>
        </p>
      </div>
    </section>
  );
}

// ── 2. Manifiesto: se enciende palabra por palabra ───────────
const MANIFIESTO =
  "Sin app, sin PDF, sin mensajes perdidos. Tus clientes entran desde el celular, compran, piden un presupuesto o sacan turno, y todo te llega ordenado.";

function Manifiesto() {
  return (
    <section data-manifiesto data-nav="oscuro" data-fondo="tinta" aria-label="Qué hace DinexFlow" className="dx-sobre-oscuro relative -mt-px bg-[var(--tinta)] py-28 text-[var(--hueso)] sm:py-40">
      <div className={CONTENEDOR}>
        <p className="dx-display max-w-[22ch] text-[clamp(2.1rem,5.4vw,5.5rem)] font-bold [font-stretch:112%]">
          {MANIFIESTO.split(" ").map((w, i) => (
            <span key={i} className="dx-palabra">
              {w}{" "}
            </span>
          ))}
          <span className="dx-serif dx-palabra text-[var(--aji)]">Vos sólo atendés.</span>
        </p>
      </div>
    </section>
  );
}

// ── 3. Escena fija: del QR al WhatsApp ───────────────────────
const PASOS = [
  {
    titulo: "Entra",
    texto: "Tu cliente escanea tu QR o abre tu link y tu página se abre en el navegador. No baja nada.",
  },
  {
    titulo: "Elige",
    texto: "Recorre tus productos o servicios con fotos y precios, y arma su pedido, saca un turno o te pide un presupuesto.",
  },
  {
    titulo: "Te llega",
    texto: "Te llega ordenado al panel y, si quiere, le avisás cada paso por WhatsApp.",
  },
];

function EscenaTelefono() {
  return (
    <section id="como-funciona" data-escena data-nav="claro" data-fondo="aji" aria-labelledby="como-titulo" className="dx-sobre-aji bg-[var(--aji)] text-[var(--tinta)]">
      <div className={`${CONTENEDOR} grid min-h-[100svh] items-center gap-5 pb-6 pt-20 md:grid-cols-[minmax(0,1fr)_auto] md:gap-[clamp(2rem,3.5vw,3rem)] md:py-[clamp(5rem,12svh,6rem)] lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.7fr)]`}>
        <div>
          <h2 id="como-titulo" className="dx-display text-balance text-[clamp(2.4rem,min(5.6vw,9svh),5.75rem)]">
            Del celu de tu cliente a tu panel
          </h2>
          <ol className="dx-pasos mt-5 md:mt-[clamp(1rem,4svh,3.5rem)] md:space-y-[clamp(0.75rem,3svh,2rem)]">
            {PASOS.map((p, i) => (
              <li key={p.titulo} data-paso={i} className="mb-6 md:mb-0">
                <div className="flex items-baseline gap-4">
                  <span className="dx-paso-num dx-display dx-tabular text-[clamp(1.5rem,2.4vw,2.25rem)]" aria-hidden>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="dx-display text-[clamp(1.9rem,min(3.6vw,6svh),3.5rem)]">{p.titulo}</h3>
                </div>
                <p className="dx-paso-texto mt-2 max-w-[34rem] text-lg leading-relaxed sm:pl-14 md:[@media(max-height:820px)]:text-base">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="mx-auto w-[max(9rem,min(15.5rem,62vw,calc((100svh-27rem)*0.47)))] md:w-[min(15.5rem,30vw,calc((100svh-10rem)*0.47))] lg:w-[min(23rem,26vw,calc((100svh-12rem)*0.47))]">
          <Telefono />
        </div>
        {/* Contador gigante del paso (sólo con movimiento, en pantallas grandes). */}
        <div aria-hidden className="dx-contador dx-display dx-display-xl items-end justify-self-end leading-none">
          <span className="grid overflow-hidden">
            {PASOS.map((p, i) => (
              <span key={p.titulo} data-contador={i} className="text-[clamp(5rem,min(11vw,16svh),14rem)] [grid-area:1/1]">
                {String(i + 1).padStart(2, "0")}
              </span>
            ))}
          </span>
          <span className="pb-[0.12em] text-[clamp(1.5rem,2.4vw,2.5rem)]">/03</span>
        </div>
      </div>
    </section>
  );
}

// ── 4. Funciones: la que pasa por el centro se ilumina ───────
type Funcion = { titulo: string; texto: string; plan: string };
const FUNCIONES: Funcion[] = [
  { titulo: "Tu página con QR", texto: "Tu catálogo con fotos y precios, con tu QR y tu link. Cambiás algo y se ve al momento.", plan: "Todos los planes" },
  { titulo: "Pedidos y envíos", texto: "Retiro, delivery, en el mostrador o envío por correo, ahora o programado para más tarde. Seguí cada pedido por estado e imprimí el ticket.", plan: "Todos los planes" },
  { titulo: "Talles, colores y extras", texto: "Talles, colores, tamaños y agregados, cada uno con su precio, como los pide la gente.", plan: "Todos los planes" },
  { titulo: "A medida", texto: "Productos personalizados: tu cliente escribe el texto, pone las medidas o sube su foto.", plan: "Todos los planes" },
  { titulo: "Servicios y turnos", texto: "Tu cliente elige el servicio, el día y el horario libre. Nunca se pisan dos turnos.", plan: "Todos los planes" },
  { titulo: "Presupuestos", texto: "Te piden un presupuesto, lo cotizás desde el panel y el cliente lo acepta con un toque.", plan: "Todos los planes" },
  { titulo: "Tus clientes", texto: "Quién te compró, te pidió un presupuesto o sacó turno, todo en una lista.", plan: "Todos los planes" },
  { titulo: "Tu marca", texto: "Logo, colores, portada y horarios. Tu página se ve como tu negocio.", plan: "Todos los planes" },
  { titulo: "Varios negocios", texto: "Todos tus negocios y sucursales en una cuenta, y tu equipo con permisos por rol.", plan: "Según el plan" },
  { titulo: "Analíticas", texto: "Lo que más se vende, horarios pico, cuánto vendés por día y cómo vienen tus presupuestos y turnos.", plan: "Todos los planes" },
  { titulo: "Control de stock", texto: "Avisos de stock bajo para no vender lo que no tenés.", plan: "Estándar y Premium" },
  { titulo: "Avisos y chats con IA", texto: "Avisos automáticos por WhatsApp de cada pedido, presupuesto y turno, chats con tus clientes y un asistente que responde por vos.", plan: "Estándar y Premium" },
  { titulo: "Repartidor en el mapa", texto: "Tu cliente sigue el delivery en vivo desde el celular, sin instalar nada.", plan: "Estándar y Premium" },
];

function Funciones() {
  return (
    <section data-nav="oscuro" data-fondo="tinta" aria-labelledby="funciones-titulo" className="dx-sobre-oscuro bg-[var(--tinta)] py-24 text-[var(--hueso)] sm:py-32">
      <div className={CONTENEDOR}>
        <h2 id="funciones-titulo" className="dx-serif text-[clamp(1.75rem,3vw,2.75rem)] text-[var(--gris-claro)]">
          Todo lo que pasa después, en un solo panel
        </h2>
        <ul className="mt-10 border-t border-white/15">
          {FUNCIONES.map((f, i) => {
            return (
              <li
                key={f.titulo}
                data-funcion={i}
                className="grid gap-x-10 gap-y-2 border-b border-white/15 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-center xl:grid-cols-[minmax(0,1fr)_24rem] lg:py-6"
              >
                <h3 className="dx-funcion-titulo dx-display text-[clamp(2rem,4.6vw,5.25rem)] xl:text-[clamp(2rem,5.4vw,5.25rem)] transition-colors duration-300">
                  {f.titulo}
                </h3>
                <div className="dx-funcion-texto transition-opacity duration-300">
                  <p className="text-lg leading-relaxed">{f.texto}</p>
                  <p className="dx-label mt-2 text-[var(--gris-claro)]">{f.plan}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ── 5. Rubros: dos filas que se deslizan con el scroll ───────
const RUBROS = ["Restaurantes", "Tiendas de ropa", "Peluquerías", "Impresión 3D", "Cafeterías", "Consultorios", "Talleres", "Estética", "Ferreterías", "Academias", "Fotógrafos", "Cabañas"];

function Rubros() {
  const fila = (calado: boolean) => (
    <div className="flex w-max items-center gap-8 whitespace-nowrap pr-8">
      {[...RUBROS, ...RUBROS].map((r, i) => (
        <span key={i} className="flex items-center gap-8">
          <span className={`dx-display text-[clamp(3rem,8.5vw,8.5rem)] ${calado ? "dx-calado" : ""}`}>{r}</span>
          <span className="h-[0.6em] w-[0.6em] shrink-0 rounded-[30%] bg-[var(--aji)] text-[clamp(3rem,8.5vw,8.5rem)]" />
        </span>
      ))}
    </div>
  );
  return (
    <section data-rubros data-nav="claro" data-fondo="hueso" aria-label="Para qué negocios sirve" className="overflow-hidden bg-[var(--hueso)] py-20 sm:py-28">
      <p className="sr-only">Sirve para {RUBROS.join(", ").toLowerCase()} y cualquier otro negocio.</p>
      <div aria-hidden>
        <div data-fila="1">{fila(false)}</div>
        <div data-fila="2" className="mt-2">
          {fila(true)}
        </div>
      </div>
    </section>
  );
}

// ── 6. Probalo ───────────────────────────────────────────────
function Probalo() {
  return (
    <section id="probalo" data-nav="oscuro" data-fondo="cobalto" aria-labelledby="probalo-titulo" className="dx-sobre-cobalto scroll-mt-16 bg-[var(--cobalto)] py-24 text-white sm:py-32">
      <div className={CONTENEDOR}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
          <h2 id="probalo-titulo" className="dx-display text-[clamp(2.75rem,7vw,7rem)]">
            Probalo vos
          </h2>
          <p className="max-w-[36rem] text-lg leading-relaxed text-white/85 sm:text-xl">
            Hacé de cliente un minuto: elegí un negocio, sumá productos y mirá el pedido que le llegaría. Los negocios y
            precios son de ejemplo.
          </p>
        </div>
        <div className="mt-12">
          <OrderDemo />
        </div>
      </div>
    </section>
  );
}

// ── 7. Precios ───────────────────────────────────────────────
// Planes y módulos: src/lib/planes.ts (los precios coinciden con el backend).



function Precios() {
  return (
    <section id="precios" data-nav="claro" data-fondo="hueso" aria-labelledby="precios-titulo" className="scroll-mt-16 bg-[var(--hueso)] py-24 sm:py-32">
      <div className={CONTENEDOR}>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 id="precios-titulo" className="dx-display text-[clamp(2.75rem,7vw,7rem)]">
              Planes simples
            </h2>
            <p className="mt-5 max-w-[42rem] text-lg leading-relaxed text-[var(--gris)]">
              Empezás con {TRIAL_DIAS} días gratis, sin tarjeta y con todo lo del plan Estándar. Después elegís tu plan
              y lo pagás mes a mes con Mercado Pago, en pesos. Al Básico le podés sumar WhatsApp, el asistente con IA o
              el mapa del repartidor.
            </p>
          </div>
          <a href="/precios" className="dx-btn-borde shrink-0 self-start hover:bg-[var(--tinta)] hover:text-white lg:self-auto">
            Ver precios y módulos
          </a>
        </div>

        <TarjetasPlanes className="mt-14" />

        {/* Módulos que se suman al Básico: tarjetas propias, debajo de los planes. */}
        <div className="mt-16">
          <h3 className="dx-display text-[clamp(2rem,4vw,3.25rem)]">Sumale módulos al Básico</h3>
          <p className="mt-4 max-w-[40rem] text-lg leading-relaxed text-[var(--gris)]">
            Los sumás desde tu panel y se cobran con tu próximo pago. En el Estándar y el Premium ya vienen incluidos.
          </p>
          <TarjetasModulos nivel="h4" className="mt-8" />
        </div>
      </div>
    </section>
  );
}

// ── 8. Preguntas ─────────────────────────────────────────────
const FAQS = [
  { q: "¿Sirve para mi rubro?", a: "Sí. Restaurantes, tiendas, productos a medida, peluquerías, consultorios, profesionales, talleres, academias, alojamientos y más. Al crear tu cuenta elegís tu rubro y activás sólo lo que usás: productos, servicios, pedidos, presupuestos o turnos." },
  { q: "¿Necesito saber de tecnología?", a: `No. Si sabés usar WhatsApp, sabés usar ${BRAND}. Cargás lo que vendés desde el panel y tu página se arma sola.` },
  { q: "¿Mis clientes tienen que descargar una app?", a: "No. Escanean el QR o abren tu link y tu página se abre en el navegador, al instante." },
  { q: "¿Cómo contrato el servicio?", a: `Creás tu cuenta gratis y usás todo durante ${TRIAL_DIAS} días. Cuando quieras, en el panel entrás a "Suscripción", elegís un plan y lo pagás con Mercado Pago. Se renueva solo cada mes y se activa al instante.` },
  { q: "¿Puedo cambiar precios cuando quiera?", a: "Sí, todas las veces que quieras. Los cambios se ven en tu página en el momento, sin reimprimir el QR." },
  { q: "¿Puedo cancelar o cambiar de plan?", a: "Sí. Subís, bajás o cancelás tu plan cuando quieras desde el panel, sin permanencia mínima." },
  { q: "¿Sirve para varios negocios?", a: "Sí. Según tu plan administrás varios negocios desde una sola cuenta, cada uno con su página y su QR." },
];

function Preguntas() {
  return (
    <section id="preguntas" data-nav="claro" data-fondo="hueso" aria-labelledby="preguntas-titulo" className="scroll-mt-16 bg-[var(--hueso)] pb-24 sm:pb-32">
      <div className={`${CONTENEDOR} grid gap-10 border-t border-[var(--tinta)]/15 pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16`}>
        <h2 id="preguntas-titulo" className="dx-display text-[clamp(2.4rem,5vw,4.75rem)]">
          Preguntas
        </h2>
        <div className="border-t-2 border-[var(--tinta)]">
          {FAQS.map((f) => (
            <details key={f.q} className="border-b border-[var(--tinta)]/15">
              <summary className="flex min-h-16 cursor-pointer items-center justify-between gap-6 py-5 text-xl font-semibold transition-colors hover:text-[var(--cobalto)]">
                {f.q}
                <span aria-hidden className="dx-faq-mark grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--tinta)] text-white transition-transform duration-200">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="max-w-[62ch] pb-6 text-lg leading-relaxed text-[var(--gris)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 9. Cierre + pie con la marca gigante ─────────────────────
function Cierre() {
  return (
    <section data-cierre data-nav="claro" data-fondo="aji" aria-labelledby="cierre-titulo" className="dx-sobre-aji overflow-hidden bg-[var(--aji)] py-24 text-[var(--tinta)] sm:py-32">
      <div className={CONTENEDOR}>
        <h2 id="cierre-titulo" data-cierre-titulo className="dx-display max-w-[16ch] origin-left text-[clamp(2.75rem,7.6vw,8rem)]">
          Tu próximo cliente ya tiene el celular en la mano.
        </h2>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <a href={ADMIN_SIGNUP_URL} className="dx-btn dx-btn-oscuro">
            Probar {TRIAL_DIAS} días gratis
            <Flecha />
          </a>
          <a href={ADMIN_LOGIN_URL} className="dx-btn-borde hover:bg-[var(--tinta)] hover:text-white">
            Ya tengo cuenta
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer data-nav="oscuro" data-fondo="tinta" className="dx-sobre-oscuro overflow-hidden bg-[var(--tinta)] pt-14 text-[var(--hueso)]">
      <div className={`${CONTENEDOR} flex flex-col gap-6 md:flex-row md:items-center md:justify-between`}>
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-2 gap-y-1">
            {NAV.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex min-h-11 items-center px-2 text-[var(--gris-claro)] hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/precios" className="inline-flex min-h-11 items-center px-2 text-[var(--gris-claro)] hover:text-white">
                Precios y módulos
              </a>
            </li>
            <li>
              <a href="/privacidad" className="inline-flex min-h-11 items-center px-2 text-[var(--gris-claro)] hover:text-white">
                Privacidad
              </a>
            </li>
          </ul>
        </nav>
        <p className="text-sm text-[var(--gris-claro)]">
          © {new Date().getFullYear()} {BRAND}
        </p>
      </div>
      <p data-marca aria-hidden className="dx-display dx-display-xl mt-10 select-none pb-[2vw] whitespace-nowrap text-center text-[17.5vw] text-[var(--hueso)]">
        {BRAND.toLowerCase()}
      </p>
    </footer>
  );
}

// ── Página ───────────────────────────────────────────────────
// URL del QR del inicio: la pública si está configurada (en localhost un
// celular no podría abrirla), si no el origen actual. Al generar el HTML en
// el build no hay window: se usa la dirección oficial.
const ORIGEN = typeof window === "undefined" ? "https://dinexflow.com.ar" : window.location.origin;
const QR_URL = `${((import.meta.env.VITE_PUBLIC_URL as string | undefined) || ORIGEN).replace(/\/+$/, "")}/menu`;

// Posición de un elemento dentro de otro sin contar transforms (la ficha QR
// se escala durante la escena y getBoundingClientRect lo incluiría).
function cajaDentro(el: HTMLElement, contenedor: HTMLElement) {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== contenedor) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return {
    top: y,
    left: x,
    right: contenedor.offsetWidth - x - el.offsetWidth,
    bottom: contenedor.offsetHeight - y - el.offsetHeight,
  };
}

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useSmoothScroll();

  // Fondo del <html> en tono hueso sólo mientras se ve la landing.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dx-home");
    return () => html.classList.remove("dx-home");
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current!;
      const q = gsap.utils.selector(root);
      const mm = gsap.matchMedia();
      const condiciones = { movimiento: "(prefers-reduced-motion: no-preference)", escritorio: "(min-width: 1024px) and (min-height: 560px)", lista: "(min-width: 768px) and (min-height: 560px)" };
      // Color de la barra: atributo y variable en el DOM, sin estado de React
      // (no re-renderiza la página). El fondo copia el de la sección de abajo.
      const ponerTema = (t: TemaNav, fondo: string) => {
        const nav = navRef.current;
        if (!nav) return;
        nav.setAttribute("data-tema", t);
        nav.style.setProperty("--nav-fondo", `var(--${fondo})`);
      };
      // Avance de la escena del QR (0 a 1): define el color de la barra sobre el inicio.
      let avanceHero = () => 0;

      mm.add(condiciones, (ctx) => {
        const { movimiento, escritorio, lista } = ctx.conditions as { movimiento: boolean; escritorio: boolean; lista: boolean };
        if (!movimiento) return;
        root.classList.add("dx-motion");

        // 1. Inicio (sólo en pantallas grandes, donde entra completo): el
        //    portal de tinta crece desde la ficha QR. En el celular el inicio
        //    no se fija, para no tapar nada.
        if (escritorio) {
          const hero = q("[data-hero]")[0];
          const contenido = q("[data-hero-contenido]")[0];
          const tile = q("[data-tile] > a")[0];
          const desdeFicha = () => {
            const c = cajaDentro(tile, hero);
            return `inset(${c.top}px ${c.right}px ${c.bottom}px ${c.left}px round 28px)`;
          };
          // Desplazamiento que lleva la ficha QR al centro de la pantalla.
          const alCentro = () => {
            const c = cajaDentro(tile, hero);
            return {
              x: hero.offsetWidth / 2 - (c.left + tile.offsetWidth / 2),
              y: window.innerHeight / 2 - (c.top + tile.offsetHeight / 2),
            };
          };
          const tlHero = gsap
            .timeline({
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "+=110%",
                pin: true,
                anticipatePin: 1,
                scrub: 0.6,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                  const cubierto = self.progress > 0.45;
                  // Con la tinta encima: barra clara y el contenido tapado fuera del foco.
                  ponerTema(cubierto ? "oscuro" : "claro", cubierto ? "tinta" : "hueso");
                  contenido.toggleAttribute("inert", cubierto);
                },
              },
            })
            .fromTo(q("[data-portal]"), { clipPath: desdeFicha }, { clipPath: "inset(0px 0px 0px 0px round 0px)", ease: "power2.inOut", duration: 1 }, 0)
            .to(q("[data-tile] figcaption"), { opacity: 0, duration: 0.12 }, 0)
            .to(tile, { x: () => alCentro().x, y: () => alCentro().y, scale: 2.1, duration: 0.55, ease: "power2.inOut" }, 0)
            // autoAlpha: además de transparente queda oculto, así el enlace no captura clics.
            .to(tile, { scale: 2.8, autoAlpha: 0, duration: 0.2, ease: "power1.in" }, 0.55)
            .to(q("[data-hero-titulo], [data-hero-bajada]"), { yPercent: -18, ease: "none", duration: 0.8 }, 0)
            .to(q("[data-portal-texto]"), { opacity: 1, duration: 0.25 }, 0.72)
            .from(q("[data-portal-texto] > span"), { scale: 0.86, duration: 0.35, ease: "power2.out" }, 0.7);
          avanceHero = () => tlHero.scrollTrigger?.progress ?? 0;
        }

        // 2. Manifiesto: palabra por palabra; termina encendido con el texto centrado.
        gsap.to(q(".dx-palabra"), {
          opacity: 1,
          stagger: 0.12,
          ease: "none",
          scrollTrigger: { trigger: q("[data-manifiesto]")[0], start: "top 70%", end: "center 45%", scrub: true },
        });

        // 3. Escena del teléfono: queda fija y avanza tres pasos.
        const escena = q("[data-escena]")[0];
        const pasos = q("[data-paso]");
        // Desde tablet los 3 pasos se ven en lista (el activo resaltado); en el celular se superponen.
        const apagado = lista ? 0.45 : 0;
        gsap.set(pasos.slice(1), { opacity: apagado });
        gsap.set(q('[data-pantalla="2"], [data-pantalla="3"]'), { yPercent: 100 });
        const contador = q("[data-contador]");
        gsap.set(contador.slice(1), { yPercent: 100 });
        // El escáner sólo se mueve mientras la escena está en pantalla.
        gsap.fromTo(
          q("[data-escaner]"),
          { y: -56 },
          {
            y: 56,
            duration: 1.1,
            ease: "sine.inOut",
            repeat: -1,
            yoyo: true,
            scrollTrigger: { trigger: escena, start: "top bottom", end: "bottom top", toggleActions: "play pause resume pause" },
          },
        );
        gsap
          .timeline({
            scrollTrigger: { trigger: escena, start: "top top", end: "+=230%", pin: true, anticipatePin: 1, scrub: 0.6 },
          })
          .to({}, { duration: 0.6 })
          .to(pasos[0], { opacity: apagado, duration: 0.3 }, 1)
          .to(pasos[1], { opacity: 1, duration: 0.3 }, lista ? 1 : 1.3)
          .to(q('[data-pantalla="2"]'), { yPercent: 0, duration: 0.8, ease: "power2.inOut" }, 0.9)
          .to(contador[0], { yPercent: -100, duration: 0.6, ease: "power3.inOut" }, 0.95)
          .to(contador[1], { yPercent: 0, duration: 0.6, ease: "power3.inOut" }, 0.95)
          .from(q("[data-sumar]"), { scale: 0.6, backgroundColor: "#ff5b24", stagger: 0.15, duration: 0.3 }, 1.5)
          .to(pasos[1], { opacity: apagado, duration: 0.3 }, 2.4)
          .to(pasos[2], { opacity: 1, duration: 0.3 }, lista ? 2.4 : 2.7)
          .to(q('[data-pantalla="3"]'), { yPercent: 0, duration: 0.8, ease: "power2.inOut" }, 2.3)
          .to(contador[1], { yPercent: -100, duration: 0.6, ease: "power3.inOut" }, 2.35)
          .to(contador[2], { yPercent: 0, duration: 0.6, ease: "power3.inOut" }, 2.35)
          .to({}, { duration: 0.7 });

        // 4. Funciones: se resalta la que cruza el centro (clase, sin estado de React).
        q("[data-funcion]").forEach((el) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 55%",
            end: "bottom 55%",
            onToggle: (self) => el.classList.toggle("is-activa", self.isActive),
          });
        });

        // 5. Rubros: las filas se deslizan en sentidos opuestos.
        const rubros = q("[data-rubros]")[0];
        gsap.fromTo(q('[data-fila="1"]'), { xPercent: 0 }, { xPercent: -22, ease: "none", scrollTrigger: { trigger: rubros, start: "top bottom", end: "bottom top", scrub: true } });
        gsap.fromTo(q('[data-fila="2"]'), { xPercent: -30 }, { xPercent: -8, ease: "none", scrollTrigger: { trigger: rubros, start: "top bottom", end: "bottom top", scrub: true } });

        // 9. Cierre y marca gigante del pie.
        gsap.from(q("[data-cierre-titulo]"), {
          scale: 0.82,
          ease: "none",
          scrollTrigger: { trigger: q("[data-cierre]")[0], start: "top bottom", end: "top 25%", scrub: true },
        });
        gsap.from(q("[data-marca]"), {
          yPercent: 45,
          ease: "none",
          scrollTrigger: { trigger: q("[data-marca]")[0], start: "top bottom", end: "bottom bottom", scrub: true },
        });

        return () => {
          root.classList.remove("dx-motion");
          q("[data-hero-contenido]")[0]?.removeAttribute("inert");
          avanceHero = () => 0;
        };
      });

      // Color de la barra según la sección que pasa por debajo. Va en otro
      // mm.add registrado después: cuando cambia una media query se recrea
      // siempre detrás de las escenas fijas, con sus medidas ya incluidas.
      mm.add(condiciones, () => {
        q("[data-nav]").forEach((el) => {
          const esHero = el.hasAttribute("data-hero");
          const fijada = el.parentElement?.classList.contains("pin-spacer") ? el.parentElement : el;
          ScrollTrigger.create({
            trigger: fijada,
            start: "top 36px",
            end: "bottom 36px",
            onToggle: (self) => {
              if (!self.isActive) return;
              // Sobre el inicio, con la tinta ya desplegada, la barra va clara.
              const d = (el as HTMLElement).dataset;
              if (esHero && avanceHero() > 0.45) ponerTema("oscuro", "tinta");
              else ponerTema(d.nav as TemaNav, d.fondo ?? "hueso");
            },
          });
        });
      });

      // Las fuentes cambian medidas: recalcular una vez cuando terminan de cargar.
      let vivo = true;
      document.fonts?.ready.then(() => vivo && ScrollTrigger.refresh());
      return () => {
        vivo = false;
      };
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="dx min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-[var(--aji)] px-5 py-3 font-semibold text-[var(--tinta)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>
      <Navbar textoRef={navRef} />
      <main id="contenido">
        <Hero qrUrl={QR_URL} />
        <Manifiesto />
        <EscenaTelefono />
        <Probalo />
        <Funciones />
        <Rubros />
        <Precios />
        <Preguntas />
        <Cierre />
      </main>
      <Footer />
    </div>
  );
}
