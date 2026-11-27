import { useEffect, useState, type ReactNode } from "react";
import "@fontsource-variable/archivo/wdth.css";
import "../components/landing/landing.css";
import { ADMIN_LOGIN_URL, ADMIN_SIGNUP_URL } from "../lib/links";
import { IconArrow, IconCheck, LogoMark } from "../components/landing/icons";
import { MODULOS, PLANES, TRIAL_DIAS, pesos, planDe, precioConTodo, precioPlan, type CodigoPlan } from "../lib/planes";
import { TarjetasModulos, TarjetasPlanes } from "../components/landing/Planes";

// Página de precios (/precios): planes, módulos que se suman al plan,
// comparativa y preguntas. Mismo mundo "Hora pico" que la landing, sin escenas.
const BRAND = "DinexFlow";
const CONTENEDOR = "mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12";
const DESCRIPCION =
  "Planes desde $22.000 por mes en pesos, con Mercado Pago. Sumá WhatsApp, IA o el mapa a tu plan, o elegí el Pro con todo incluido.";


// ── Comparativa ──────────────────────────────────────────────
// true = incluido · false = no · string = texto (cantidad o módulo pago).
type Celda = boolean | string;
const precioMod = (codigo: string) => pesos(MODULOS.find((m) => m.codigo === codigo)!.precio);
const COMPARATIVA: { grupo: string; filas: { label: string; valores: [Celda, Celda, Celda] }[] }[] = [
  {
    grupo: "Tu negocio",
    filas: [
      { label: "Negocios", valores: ["1", "Hasta 3", "Hasta 5"] },
      { label: "Productos", valores: ["50", "180", "1.000"] },
      { label: "Página con QR y link", valores: [true, true, true] },
      { label: "Usuarios para tu equipo, con permisos", valores: [true, true, true] },
    ],
  },
  {
    grupo: "Ventas",
    filas: [
      { label: "Pedidos para retirar y delivery", valores: [true, true, true] },
      { label: "Pedido en la mesa con QR", valores: [true, true, true] },
      { label: "Talles, colores y productos a medida", valores: [true, true, true] },
      { label: "Control de stock", valores: [false, true, true] },
    ],
  },
  {
    grupo: "Agenda",
    filas: [
      { label: "Servicios", valores: [true, true, true] },
      { label: "Turnos", valores: [true, true, true] },
      { label: "Presupuestos", valores: [true, true, true] },
    ],
  },
  {
    grupo: "Clientes",
    filas: [
      { label: "Listado de clientes", valores: [true, true, true] },
      { label: "Estadísticas de ventas", valores: [true, true, true] },
    ],
  },
  {
    grupo: "WhatsApp e IA",
    filas: [
      { label: "Avisos automáticos del pedido", valores: [`Módulo WhatsApp +$ ${precioMod("whatsapp")}`, true, true] },
      { label: "Chats con tus clientes", valores: ["Con el módulo WhatsApp", true, true] },
      { label: "Asistente con IA", valores: [`Módulo +$ ${precioMod("ia")}, pide WhatsApp`, `Módulo +$ ${precioMod("ia")}`, true] },
    ],
  },
  {
    grupo: "Delivery",
    filas: [{ label: "El repartidor en el mapa", valores: [`Módulo +$ ${precioMod("mapa")}`, true, true] }],
  },
];
const GRUPOS_VISIBLES = 2;

const INCLUIDO = [
  { titulo: "Tu página con QR", texto: "Lista para compartir en redes, en el local y en cada mesa." },
  { titulo: "Pedidos sin comisión", texto: "Lo que vendés es tuyo: pagás tu plan y los módulos que sumes, nada por pedido." },
  { titulo: "Turnos y presupuestos", texto: "Para peluquerías, servicios, talleres y encargos." },
  { titulo: "Soporte de una persona", texto: "Escribinos desde el panel y te responde alguien de verdad." },
];

const FAQS = [
  {
    q: "¿Puedo sumar WhatsApp al plan Básico?",
    a: `Sí, por $ ${pesos(MODULOS[0].precio)} al mes, desde Suscripción en tu panel. Si además querés el mapa del repartidor, te conviene el Estándar: trae los dos por $ ${pesos(precioPlan("standard"))}.`,
  },
  {
    q: "¿El Estándar trae el asistente con IA?",
    a: `No, se lo sumás por $ ${pesos(MODULOS.find((m) => m.codigo === "ia")!.precio)} al mes (en total $ ${pesos(precioConTodo(planDe("standard")))}). El Pro lo trae incluido, junto con hasta 5 negocios y 1.000 productos, por $ ${pesos(precioPlan("premium"))}.`,
  },
  {
    q: "¿Los cupones de descuento sirven para los módulos?",
    a: "No. El cupón descuenta el precio del plan (Básico, Estándar o Pro); los módulos que sumes se cobran a su precio.",
  },
  {
    q: "¿Puedo quitar un módulo?",
    a: "Cuando quieras. Si ya lo pagaste, lo seguís usando hasta tu próximo cobro y desde ahí no se cobra más. Si lo quitás antes de haberlo pagado una vez, se cobra en ese próximo cobro y lo usás un mes más.",
  },
  {
    q: "¿Qué pasa al terminar la prueba gratis?",
    a: `Durante ${TRIAL_DIAS} días usás todo, con el asistente con IA incluido. Después elegís un plan y seguís con todo lo que cargaste. Si no elegís, el panel queda en pausa hasta que pagues; lo que cargaste no se borra.`,
  },
  {
    q: "¿Cómo se cobra?",
    a: "Una vez por mes, en pesos, con Mercado Pago. El plan y los módulos van en el mismo cobro. No hay plan anual ni permanencia mínima.",
  },
  {
    q: "¿Puedo cambiar de plan?",
    a: "Sí, desde el panel. Pagás el plan nuevo con Mercado Pago y la suscripción anterior se da de baja sola, así no pagás dos veces.",
  },
  { q: "¿Cobran comisión por pedido?", a: "No. Pagás tu plan (y los módulos que sumes), vendas lo que vendas." },
];

function Valor({ v, destacado }: { v: Celda; destacado?: boolean }) {
  if (v === true) {
    return (
      <>
        <IconCheck className={`mx-auto h-5 w-5 ${destacado ? "text-[var(--tinta)]" : ""}`} />
        <span className="sr-only">Incluido</span>
      </>
    );
  }
  if (v === false) {
    return (
      <>
        <span aria-hidden className="text-[var(--gris)]">—</span>
        <span className="sr-only">No incluido</span>
      </>
    );
  }
  return <span className={/^(Módulo|Con el módulo)/.test(v) ? "text-sm font-semibold text-[var(--cobalto)]" : "font-semibold"}>{v}</span>;
}

function Seccion({ id, titulo, children, className = "" }: { id?: string; titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id && titulo ? `${id}-titulo` : undefined} className={`scroll-mt-20 ${className}`}>
      {children}
    </section>
  );
}

export default function Precios() {
  const [completa, setCompleta] = useState(false);

  // Título, descripción y fondo del <html> sólo mientras se ve esta página.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("dx-home");
    const titulo = document.title;
    document.title = `Precios y planes · ${BRAND}`;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const desc = meta?.content;
    if (meta) meta.content = DESCRIPCION;
    return () => {
      html.classList.remove("dx-home");
      document.title = titulo;
      if (meta && desc != null) meta.content = desc;
    };
  }, []);

  const grupos = completa ? COMPARATIVA : COMPARATIVA.slice(0, GRUPOS_VISIBLES);
  const basicoConTodo = precioConTodo(planDe("basic"));
  const basicoWaMapa = precioPlan("basic") + MODULOS.filter((m) => m.codigo !== "ia").reduce((t, m) => t + m.precio, 0);

  return (
    <div className="dx min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-[60] rounded-full bg-[var(--aji)] px-5 py-3 font-semibold text-[var(--tinta)] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      {/* ── Barra ── */}
      <header className="sticky top-0 z-50 border-b border-[var(--tinta)]/10 bg-[var(--hueso)]">
        <div className={`${CONTENEDOR} flex h-[4.5rem] items-center justify-between gap-3`}>
          <div className="flex items-center gap-3 sm:gap-6">
            <a href="/" className="flex min-h-11 items-center gap-2.5" aria-label={`${BRAND}, ir al inicio`}>
              <LogoMark size={34} />
              <span aria-hidden className="dx-display hidden text-[1.375rem] sm:inline">
                {BRAND.toLowerCase()}
              </span>
            </a>
            <nav aria-label="Principal">
              <ul className="flex items-center gap-1">
                <li className="hidden md:block">
                  <a href="/#como-funciona" className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-medium hover:underline">
                    Cómo funciona
                  </a>
                </li>
                <li className="md:hidden">
                  <a href="/" className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-medium hover:underline">
                    Inicio
                  </a>
                </li>
                <li className="hidden md:block">
                  <a href="/precios" aria-current="page" className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold underline">
                    Precios
                  </a>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <a href={ADMIN_LOGIN_URL} className="inline-flex min-h-11 items-center px-3 text-[0.9375rem] font-medium hover:underline">
              Ingresar
            </a>
            <a href={ADMIN_SIGNUP_URL} className="dx-btn dx-btn-nav min-h-11 whitespace-nowrap px-4 text-[0.9375rem] sm:px-5">
              Probar gratis
            </a>
          </div>
        </div>
      </header>

      <main id="contenido">
        {/* ── 1. Inicio + planes ── */}
        <Seccion className="bg-[var(--hueso)] pb-20 pt-14 sm:pb-28 sm:pt-20">
          <div className={CONTENEDOR}>
            <p className="dx-label text-[var(--gris)]">Precios</p>
            <h1 className="dx-display mt-4 max-w-[18ch] text-[clamp(2.6rem,6.4vw,6rem)]">
              Planes desde <span className="whitespace-nowrap">$ {pesos(precioPlan("basic"))}</span> al mes.
            </h1>
            <p className="mt-6 max-w-[40rem] text-lg leading-relaxed text-[var(--gris)] sm:text-xl">
              Tu página, tus pedidos y tus clientes en un solo lugar. Empezás con lo justo y sumás lo que necesites, cuando lo necesites.
            </p>
            <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-[1.0625rem] font-medium">
              {[`${TRIAL_DIAS} días gratis, sin tarjeta`, "Pagás mes a mes, en pesos, con Mercado Pago", "Te atiende una persona"].map((g) => (
                <li key={g} className="flex items-center gap-2">
                  <IconCheck className="h-5 w-5 shrink-0 text-[var(--aji-deep)]" />
                  {g}
                </li>
              ))}
            </ul>

            <TarjetasPlanes nivel="h2" className="mt-14" />

            <p className="mt-6 max-w-[52rem] text-[1.0625rem] leading-relaxed text-[var(--gris)]">
              ¿Sumás WhatsApp y el mapa al Básico? Serían $ {pesos(basicoWaMapa)} por mes.{" "}
              <strong className="font-semibold text-[var(--tinta)]">El Estándar los trae, con hasta 3 negocios, por $ {pesos(precioPlan("standard"))}.</strong>{" "}
              ¿Querés todo, con el asistente con IA? El Básico con todo sale $ {pesos(basicoConTodo)} y el Estándar con IA, $ {pesos(precioConTodo(planDe("standard")))}.{" "}
              <strong className="font-semibold text-[var(--tinta)]">El Pro trae todo por $ {pesos(precioPlan("premium"))}.</strong>
            </p>

            {/* Más de un negocio */}
            <div className="mt-12 flex flex-col gap-5 rounded-[var(--radio)] border-2 border-[var(--tinta)] p-7 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold">¿Tenés más de un negocio?</h2>
                <p className="mt-1.5 max-w-[40rem] text-[var(--gris)]">
                  Con el Estándar o el Pro manejás todos desde una sola cuenta, cada uno con su página y su QR.
                </p>
              </div>
              <a href="#comparar" className="dx-btn-borde shrink-0 hover:bg-[var(--tinta)] hover:text-white">
                Comparar planes
              </a>
            </div>
          </div>
        </Seccion>

        {/* ── 2. Módulos ── */}
        <Seccion id="modulos" titulo="Sumale módulos" className="dx-sobre-oscuro bg-[var(--tinta)] py-20 text-[var(--hueso)] sm:py-28">
          <div className={CONTENEDOR}>
            <h2 id="modulos-titulo" className="dx-display text-[clamp(2.4rem,5.5vw,5rem)]">
              Sumale módulos
            </h2>
            <p className="mt-5 max-w-[40rem] text-lg leading-relaxed text-[var(--gris-claro)]">
              A tu plan le sumás sólo lo que usás, desde tu panel. Lo sumás y lo usás ya; se cobra con tu próximo pago, todos
              los meses hasta que lo quites. El Estándar ya trae WhatsApp y el mapa; el Pro, todo.
            </p>
            <TarjetasModulos tema="oscuro" className="mt-12" />
          </div>
        </Seccion>

        {/* ── 3. Incluido en todos ── */}
        <Seccion id="incluido" titulo="Incluido en todos los planes" className="bg-[var(--hueso)] py-20 sm:py-28">
          <div className={CONTENEDOR}>
            <h2 id="incluido-titulo" className="dx-display text-[clamp(2.4rem,5.5vw,5rem)]">
              En todos los planes
            </h2>
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {INCLUIDO.map((i) => (
                <li key={i.titulo} className="rounded-[var(--radio)] bg-[var(--hueso-2)] p-7">
                  <h3 className="text-xl font-bold">{i.titulo}</h3>
                  <p className="mt-2 leading-relaxed text-[var(--gris)]">{i.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </Seccion>

        {/* ── 4. Comparativa ── */}
        <Seccion id="comparar" titulo="¿Qué incluye cada plan?" className="bg-[var(--hueso)] pb-20 sm:pb-28">
          <div className={`${CONTENEDOR} border-t border-[var(--tinta)]/15 pt-16`}>
            <h2 id="comparar-titulo" className="dx-display text-[clamp(2.4rem,5.5vw,5rem)]">
              ¿Qué incluye cada plan?
            </h2>
            <p className="mt-6 text-[var(--gris)] sm:hidden">Deslizá la tabla para ver los tres planes.</p>
            {/* Con foco: así la tabla también se desliza con el teclado. */}
            <div role="region" aria-label="Comparación de planes" tabIndex={0} className="mt-4 overflow-x-auto sm:mt-10">
              <table id="tabla-comparar" className="w-full min-w-[30rem] border-collapse text-left">
                <caption className="sr-only">Comparación de los planes Básico, Estándar y Pro</caption>
                <thead>
                  <tr className="border-b-2 border-[var(--tinta)]">
                    <th scope="col" className="w-[34%] py-4 pr-4 font-semibold text-[var(--gris)]">
                      Funciones
                    </th>
                    {PLANES.map((p) => (
                      <th key={p.code} scope="col" className={`px-3 py-4 text-center ${p.code === "standard" ? "bg-[var(--aji)]" : ""}`}>
                        <span className="block text-lg font-bold">{p.name}</span>
                        <span className={`block text-sm ${p.code === "standard" ? "text-[var(--tinta)]/80" : "text-[var(--gris)]"}`}>$ {pesos(p.mensual)}/mes</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {grupos.map((g) => (
                  <tbody key={g.grupo}>
                    <tr>
                      <th scope="colgroup" colSpan={4} className="dx-label pb-2 pt-7 text-[var(--gris)]">
                        {g.grupo}
                      </th>
                    </tr>
                    {g.filas.map((f) => (
                      <tr key={f.label} className="border-b border-[var(--tinta)]/12">
                        <th scope="row" className="py-3.5 pr-4 font-medium">
                          {f.label}
                        </th>
                        {f.valores.map((v, i) => {
                          const code: CodigoPlan = PLANES[i].code;
                          const destacado = code === "standard";
                          return (
                            <td key={code} className={`px-3 py-3.5 text-center ${destacado ? "bg-[color-mix(in_srgb,var(--aji)_18%,var(--hueso))]" : ""}`}>
                              <Valor v={v} destacado={destacado} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
            <button
              type="button"
              aria-expanded={completa}
              aria-controls="tabla-comparar"
              onClick={() => setCompleta((v) => !v)}
              className="dx-btn-borde mt-8 w-full justify-center hover:bg-[var(--tinta)] hover:text-white sm:w-auto"
            >
              {completa ? "Ver menos" : "Ver la comparativa completa"}
            </button>
          </div>
        </Seccion>

        {/* ── 5. Preguntas ── */}
        <Seccion id="preguntas" titulo="Preguntas frecuentes" className="bg-[var(--hueso)] pb-24 sm:pb-32">
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
        </Seccion>

        {/* ── 6. Cierre ── */}
        <section aria-labelledby="cierre-titulo" className="dx-sobre-aji bg-[var(--aji)] py-20 text-[var(--tinta)] sm:py-28">
          <div className={CONTENEDOR}>
            <h2 id="cierre-titulo" className="dx-display max-w-[18ch] text-[clamp(2.4rem,6vw,6rem)]">
              Probalo {TRIAL_DIAS} días con todo incluido.
            </h2>
            <p className="mt-5 max-w-[36rem] text-lg leading-relaxed">Sin tarjeta. Al terminar elegís tu plan, o no seguís y listo.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <a href={ADMIN_SIGNUP_URL} className="dx-btn dx-btn-oscuro">
                Probar gratis
                <IconArrow className="dx-btn-flecha h-4 w-4" />
              </a>
              <a href={ADMIN_LOGIN_URL} className="dx-btn-borde hover:bg-[var(--tinta)] hover:text-white">
                Ya tengo cuenta
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="dx-sobre-oscuro bg-[var(--tinta)] py-10 text-[var(--hueso)]">
        <div className={`${CONTENEDOR} flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
          <nav aria-label="Pie de página">
            <ul className="flex flex-wrap gap-x-2 gap-y-1">
              {[
                ["/", "Inicio"],
                ["/#como-funciona", "Cómo funciona"],
                ["/menu", "Ver un ejemplo"],
                ["/privacidad", "Privacidad"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="inline-flex min-h-11 items-center px-2 text-[var(--gris-claro)] hover:text-white">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="text-sm text-[var(--gris-claro)]">
            © {new Date().getFullYear()} {BRAND}
          </p>
        </div>
      </footer>
    </div>
  );
}
