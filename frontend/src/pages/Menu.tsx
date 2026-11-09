import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  productosService,
  categoriasService,
  configuracionService,
  negociosPublicoService,
  setNegocioActivo,
} from "../services/api";
import type {
  Producto,
  Categoria,
  Configuracion,
  HorariosConfig,
  DiaHorario,
} from "../services/api";
import { useCart } from "../hooks/useCart";
import {
  PRIMARY,
  PRIMARY_ON,
  paletteVars,
  fmt,
  setMonedaMenu,
  CategoriaIcon,
  CIcon,
  ProductImage,
  esPorPeso,
} from "../lib/menuUi";
import ProductModal from "../components/ProductModal";
import CartDrawer from "../components/CartDrawer";
import { useLang, LangSelector } from "../lib/i18n";
import "@fontsource-variable/archivo/wdth.css";
import "../components/menu/menu.css";
import { DEMO_CATEGORIAS, DEMO_CONFIG, DEMO_PRODUCTOS } from "../lib/menuDemo";

// ── Horarios ────────────────────────────────────────────────
const hoyIndex = () => {
  const d = new Date().getDay(); // 0=Domingo..6=Sábado
  return d === 0 ? 6 : d - 1; // 0=Lunes..6=Domingo
};
const franjasTxt = (d?: DiaHorario) =>
  d && !d.cerrado && d.franjas?.length
    ? d.franjas
        .filter((f) => f.desde && f.hasta)
        .map((f) => `${f.desde}–${f.hasta}`)
        .join(" · ")
    : "";
const horarioHoy = (hc?: HorariosConfig | null) => {
  if (!hc || !Array.isArray(hc) || !hc.length) return "";
  return franjasTxt(hc[hoyIndex()]);
};
const tieneHorarios = (hc?: HorariosConfig | null) =>
  !!hc && Array.isArray(hc) && hc.length > 0;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
// ¿Está abierto ahora? Considera franjas que pasan la medianoche (ej. 20:00–02:00).
const abiertoAhora = (hc?: HorariosConfig | null): boolean | null => {
  if (!tieneHorarios(hc)) return null;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const hoy = hoyIndex();
  const ayer = (hoy + 6) % 7;
  const dentro = (d: DiaHorario | undefined, check: (desde: number, hasta: number) => boolean) =>
    !!d && !d.cerrado && (d.franjas || []).some((f) => f.desde && f.hasta && check(toMin(f.desde), toMin(f.hasta)));
  return (
    dentro(hc![hoy], (a, b) => (b > a ? mins >= a && mins < b : mins >= a)) ||
    dentro(hc![ayer], (a, b) => b <= a && mins < b)
  );
};

// Scroll suave salvo que el sistema pida reducir el movimiento.
const suave = (): ScrollBehavior =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";

const Menu = () => {
  const { t } = useLang();
  const { slug } = useParams<{ slug?: string }>();
  // /menu a secas (sin slug ni ?negocio, que usan los QR viejos) es la demo.
  const demo = !slug && !new URLSearchParams(window.location.search).get("negocio");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [modalProd, setModalProd] = useState<Producto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Mesa del QR (?mesa=5&t=<firma>). Es fija: el cliente no la elige ni la
  // cambia. Sin firma es el QR general y no se puede pedir "en mesa"; el
  // backend lo vuelve a verificar al recibir el pedido.
  const [{ mesa, mesaToken }] = useState(() => {
    const qs = new URLSearchParams(window.location.search);
    const t = qs.get("t") || "";
    return { mesa: t ? (qs.get("mesa") || "").trim().slice(0, 50) : "", mesaToken: t };
  });

  const cart = useCart();
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});
  const stickyRef = useRef<HTMLDivElement>(null);
  const [activeCat, setActiveCat] = useState<number | null>(null);
  const [showTop, setShowTop] = useState(false);

  // Mostrar el botón "ir arriba" tras bajar un poco.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (demo) {
      setProductos(DEMO_PRODUCTOS);
      setCategorias(DEMO_CATEGORIAS);
      setConfig(DEMO_CONFIG);
      setMonedaMenu(DEMO_CONFIG.moneda);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setNotFound(false);

        // Multi-tenant: si la URL es /menu/:slug, resolver el slug al negocio
        // antes de pedir los datos. Si no existe, mostrar "no encontrado".
        if (slug) {
          try {
            const neg = await negociosPublicoService.getBySlug(slug);
            setNegocioActivo(neg.id);
          } catch {
            setNotFound(true);
            return;
          }
        }

        const [p, c, cfg] = await Promise.all([
          productosService.getDisponibles(),
          categoriasService.getActivas(),
          configuracionService.get().catch(() => null),
        ]);
        setProductos(Array.isArray(p) ? p : []);
        setCategorias(Array.isArray(c) ? c : []);
        setConfig(cfg);
        setMonedaMenu(cfg?.moneda); // moneda del negocio para el formato de precios
      } catch (e) {
        console.error("Error al cargar el menú:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, demo]);

  // Título de la pestaña con el nombre del local.
  useEffect(() => {
    if (config?.nombre) document.title = config.nombre;
  }, [config?.nombre]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? productos.filter(
            (p) =>
              p.nombre.toLowerCase().includes(q) ||
              (p.descripcion || "").toLowerCase().includes(q),
          )
        : productos,
    [productos, q],
  );

  const porCategoria = useMemo(
    () =>
      categorias
        .map((cat) => ({
          cat,
          prods: filtered.filter((p) => p.categoria_id === cat.id),
        }))
        .filter((pc) => pc.prods.length > 0),
    [categorias, filtered],
  );

  // Alto de la barra fija (buscador + categorías) para compensar el scroll.
  const stickyOffset = () => (stickyRef.current?.offsetHeight || 120) + 12;

  const scrollToCat = (id: number) => {
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset();
      window.scrollTo({ top: y, behavior: suave() });
    }
  };

  // Scroll-spy: resalta la categoría cuya sección estás mirando. Recorre las
  // secciones y marca como activa la última cuyo tope ya pasó el offset.
  useEffect(() => {
    if (!porCategoria.length) return;
    const onScroll = () => {
      const offset = stickyOffset() + 40;
      let current = porCategoria[0].cat.id;
      for (const { cat } of porCategoria) {
        const el = sectionRefs.current[cat.id];
        if (el && el.getBoundingClientRect().top - offset <= 0) current = cat.id;
      }
      setActiveCat(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [porCategoria]);

  const pageStyle = paletteVars(config?.color_primario);

  if (loading) {
    return (
      <div className="mn grid min-h-screen place-items-center p-6" style={pageStyle} role="status" aria-busy="true">
        <div className="w-48 text-center">
          <p className="text-[15px] font-semibold">{t("loading")}</p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--bg-2)]">
            <div className="h-full w-2/5 rounded-full bg-[var(--fg)]" style={{ animation: "mn-carga 1.1s var(--ease) infinite" }} />
          </div>
        </div>
      </div>
    );
  }

  // Slug inexistente: el negocio no existe o está inactivo.
  if (notFound) {
    return (
      <div className="mn grid min-h-screen place-items-center p-6 text-center" style={pageStyle}>
        <div className="max-w-sm">
          <h1 className="mn-display text-[clamp(2.25rem,9vw,3.5rem)]">{t("notFoundTitle")}</h1>
          <p className="mt-4 text-[var(--fg-2)]">{t("notFoundDesc")}</p>
        </div>
      </div>
    );
  }

  const nombre = config?.nombre || t("defaultTitle");
  const portada = config?.portada_url;
  const abierto = abiertoAhora(config?.horarios_config);
  const hoyTxt = tieneHorarios(config?.horarios_config)
    ? `${t("today")}: ${horarioHoy(config?.horarios_config) || t("closedToday")}`
    : config?.horarios || "";
  const entregas = [
    config?.mesas_activo && (config.mesas_cantidad || 0) > 0 ? { k: "mesa", l: t("deliveryTable") } : null,
    config?.retiro_activo ? { k: "bolsa", l: t("deliveryPickup") } : null,
    config?.delivery_activo ? { k: "moto", l: t("deliveryDelivery") } : null,
  ].filter(Boolean) as { k: string; l: string }[];

  return (
    <div className="mn min-h-screen" style={pageStyle}>
      <div inert={!!modalProd || cartOpen}>
      {demo && (
        <div className="mn-sobre-tinta flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[var(--fg)] px-4 py-2.5 text-center text-[13px] text-[var(--bg)]">
          <span>{t("demoBanner")}</span>
          <a href="/" className="font-semibold underline">
            {t("demoBack")}
          </a>
        </div>
      )}

      {/* ══ Cabecera ══
          Con portada: la foto de fondo, oscurecida hacia los bordes y abajo,
          con los datos del local encima en blanco.
          Sin portada: bloque pleno con el color del local. */}
      <header
        className={`relative overflow-hidden ${portada ? "mn-hero-foto" : "mn-sobre-color"}`}
        style={
          portada
            ? { background: "var(--fg)", color: "#fff" }
            : { background: PRIMARY, color: PRIMARY_ON, borderBottom: "1.5px solid var(--mp-edge, transparent)" }
        }
      >
        {portada && (
          <>
            <img src={portada} alt="" className="mn-hero-img absolute inset-0 h-full w-full object-cover" />
            <div className="mn-hero-velo absolute inset-0" aria-hidden />
          </>
        )}
        <div
          className={`relative mx-auto flex max-w-6xl flex-col px-4 pb-7 pt-4 sm:px-6 sm:pb-10 ${
            portada ? "min-h-[440px] sm:min-h-[520px]" : ""
          }`}
        >
          <div className="flex justify-end">
            <LangSelector dark />
          </div>

          <div className={`mn-in flex items-end gap-4 sm:gap-5 ${portada ? "mt-auto pt-16" : "mt-6 sm:mt-8"}`}>
            {config?.logo_url && (
              <img
                src={config.logo_url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-[18px] bg-white object-cover sm:h-20 sm:w-20"
              />
            )}
            <div className="min-w-0">
              <h1 className="mn-display break-words text-[clamp(2.25rem,9vw,4.5rem)]">{nombre}</h1>
            </div>
          </div>
          {config?.descripcion && (
            <p className="mn-in mt-3 max-w-[60ch] text-[15px] leading-relaxed sm:text-base" style={{ animationDelay: "60ms" }}>
              {config.descripcion}
            </p>
          )}

          {/* Estado + modos de entrega */}
          <div className="mn-in mt-5 flex flex-wrap items-center gap-2" style={{ animationDelay: "100ms" }}>
            {mesa && config?.mesas_activo && (
              <span className="mn-chip mn-chip-lleno">
                <CIcon icon="mesa" /> {t("tableN", { n: mesa })}
              </span>
            )}
            {abierto !== null &&
              (abierto ? (
                <span className="mn-chip mn-chip-lleno">
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden />
                  {t("openNow")}
                </span>
              ) : (
                <span className="mn-chip mn-chip-linea">{t("closedNow")}</span>
              ))}
            {hoyTxt && (
              <span className="mn-chip mn-chip-linea mn-num">
                <CIcon icon="clock" /> {hoyTxt}
              </span>
            )}
            {entregas.map((e) => (
              <span key={e.k} className="mn-chip mn-chip-linea">
                <CIcon icon={e.k} /> {e.l}
              </span>
            ))}
          </div>

          {/* Contacto */}
          {(config?.direccion || config?.telefono || config?.email || config?.whatsapp) && (
            <div className="mn-in mt-2 flex flex-wrap items-center gap-2" style={{ animationDelay: "140ms" }}>
              {config?.direccion && (
                <Chip icon="pin" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.direccion)}`}>
                  {config.direccion}
                </Chip>
              )}
              {config?.telefono && (
                <Chip icon="phone" href={`tel:${config.telefono.replace(/\s/g, "")}`}>
                  {config.telefono}
                </Chip>
              )}
              {config?.email && (
                <Chip icon="mail" href={`mailto:${config.email}`}>
                  {config.email}
                </Chip>
              )}
              {(config?.whatsapp || config?.telefono) && (
                <a href={waLink(config)} target="_blank" rel="noreferrer" className="mn-chip bg-[var(--wa)] font-bold text-[var(--fg)]">
                  <WaIcon size={15} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ══ Barra fija: buscador + categorías ══ */}
      <div ref={stickyRef} className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--bg)]">
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <label className="relative block">
            <span className="sr-only">{t("searchPlaceholder")}</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--fg-2)]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="mn-field rounded-full pl-11 pr-12 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mn-icon-btn mn-icon-btn-suave absolute right-0.5 top-1/2 -translate-y-1/2"
                aria-label={t("clearSearch")}
              >
                <XIcon />
              </button>
            )}
          </label>

          {categorias.length > 0 && !q ? (
            <CategoryBar categorias={categorias} onPick={scrollToCat} active={activeCat} rubro={config?.tipo_rubro} />
          ) : (
            <div className="h-3" />
          )}
        </div>
      </div>

      {/* ══ Productos ══ */}
      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        {porCategoria.length === 0 ? (
          q ? (
            <div className="py-20 text-center">
              <p className="mn-display text-2xl">{t("noResults")}</p>
              <button type="button" onClick={() => setSearch("")} className="mn-btn mn-btn-borde mt-6">
                {t("clearSearch")}
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-sm py-16 text-center">
              <h2 className="mn-display text-3xl">{t("preparingTitle")}</h2>
              <p className="mt-3 text-[var(--fg-2)]">{t("preparingSubtitle")}</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-12">
            {porCategoria.map(({ cat, prods }) => (
              <section
                key={cat.id}
                aria-labelledby={`cat-${cat.id}`}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
              >
                <h2 id={`cat-${cat.id}`} className="mb-4 flex items-baseline gap-3">
                  <span className="mn-display text-[clamp(1.75rem,6vw,2.5rem)]">{cat.nombre}</span>
                  <span className="mn-num text-sm font-semibold text-[var(--fg-2)]">{prods.length}</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {prods.map((prod, i) => (
                    <ProductCard
                      key={prod.id}
                      prod={prod}
                      index={i}
                      onOpen={() => setModalProd(prod)}
                      onAdd={() => {
                        // Con variantes o por peso hay que elegir algo → abrir el modal.
                        if ((prod.variantes && prod.variantes.length > 0) || esPorPeso(prod)) {
                          setModalProd(prod);
                        } else {
                          cart.add(prod, 1);
                        }
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* ══ Pie: bloque tinta con datos y horarios ══ */}
      <footer className="mn-sobre-tinta mt-16 bg-[var(--fg)] text-[var(--bg)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          <div>
            <p className="mn-display text-3xl">{nombre}</p>
            {config?.descripcion && <p className="mt-3 max-w-[45ch] text-sm leading-relaxed text-[var(--fg-dark-2)]">{config.descripcion}</p>}
          </div>
          <div className="grid content-start gap-3 text-sm">
            {config?.direccion && <FooterLine icon="pin">{config.direccion}</FooterLine>}
            {!tieneHorarios(config?.horarios_config) && config?.horarios && <FooterLine icon="clock">{config.horarios}</FooterLine>}
            {config?.telefono && <FooterLine icon="phone">{config.telefono}</FooterLine>}
            {config?.email && <FooterLine icon="mail">{config.email}</FooterLine>}
          </div>
          {tieneHorarios(config?.horarios_config) && <SemanaHorarios hc={config!.horarios_config!} />}
        </div>
        <div className="mx-auto max-w-6xl border-t border-[var(--ink-2)] px-4 pb-28 pt-6 text-xs text-[var(--fg-dark-2)] sm:px-6">
          <p>{t("pricesIncludeTax")}</p>
          <p className="mt-1.5">
            {t("madeWith")} <span className="font-bold text-[var(--bg)]">DinexFlow</span>
          </p>
        </div>
      </footer>

      {/* ══ Botón "ir arriba" ══ */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: suave() })}
          aria-label={t("ariaScrollTop")}
          title={t("ariaScrollTop")}
          className="mn-in mn-icon-btn fixed bottom-24 right-4 z-[80] bg-[var(--surface)] text-[var(--fg)] ring-1 ring-[var(--field-border)] sm:right-6"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      )}

      {/* ══ Barra de pedido (con productos) / botón de carrito (vacío) ══ */}
      {cart.count > 0 ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={t("ariaViewOrder")}
          className="mn-btn mn-sube fixed bottom-4 left-1/2 z-[80] w-[calc(100%-32px)] max-w-md -translate-x-1/2 justify-between ring-2 ring-[var(--fg)]"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="flex items-center gap-2.5">
            <span key={cart.count} className="mn-num mn-chip-lleno grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs">
              {cart.count}
            </span>
            {t("viewOrder")}
          </span>
          <span className="mn-num flex items-center gap-2">
            {fmt(cart.total)}
            <ArrowIcon />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={t("ariaViewOrder")}
          className="mn-icon-btn fixed bottom-4 right-4 z-[80] h-14 w-14 bg-[var(--fg)] text-[var(--bg)] ring-2 ring-[var(--bg)] sm:right-6"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="9" cy="21" r="1" />
            <circle cx="18" cy="21" r="1" />
            <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
        </button>
      )}

      </div>

      {/* Modal de producto */}
      {modalProd && (
        <ProductModal
          producto={modalProd}
          onClose={() => setModalProd(null)}
          onAdd={(p, cantidad, opciones) => cart.add(p, cantidad, opciones)}
        />
      )}

      {/* Carrito */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        mesa={mesa}
        mesaToken={mesaToken}
        config={config}
        demo={demo}
      />
    </div>
  );
};

// ── Tarjeta de producto (imagen a la izquierda) ──
const ProductCard = ({
  prod,
  index,
  onOpen,
  onAdd,
}: {
  prod: Producto;
  index: number;
  onOpen: () => void;
  onAdd: () => void;
}) => {
  const { t } = useLang();
  const personalizable = !!prod.variantes && prod.variantes.length > 0;
  return (
    <div
      className="mn-card mn-in relative"
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
    >
      <div className="mn-card-img">
        <ProductImage url={prod.imagen_url} alt={prod.nombre} w={232} h={232} fill style={{ width: "100%", height: "100%" }} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1 pr-1">
        <h3 className="line-clamp-2 text-[16px] font-semibold leading-snug [font-stretch:105%]">
          <button
            type="button"
            onClick={onOpen}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-[var(--r-md)] after:content-['']"
          >
            {prod.nombre}
          </button>
        </h3>
        {personalizable && (
          <span className="mt-1 self-start">
            <span className="mn-badge mn-label">{t("customizable")}</span>
          </span>
        )}
        {prod.descripcion && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--fg-2)]">{prod.descripcion}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="mn-num text-[17px] font-extrabold">
            {fmt(Number(prod.precio))}
            {esPorPeso(prod) && <span className="text-[13px] font-semibold text-[var(--fg-2)]"> /kg</span>}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={`${t("ariaAddToOrder")}: ${prod.nombre}`}
            className="mn-icon-btn mn-icon-btn-mp relative z-10 -mb-1 -mr-1"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Barra de categorías (pastillas) con flechas en escritorio ──
const CategoryBar = ({
  categorias,
  onPick,
  active,
  rubro,
}: {
  categorias: Categoria[];
  onPick: (id: number) => void;
  active: number | null;
  rubro?: string | null;
}) => {
  const { t } = useLang();
  const rowRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Mantener la categoría activa visible en la barra (auto-scroll suave).
  useEffect(() => {
    if (active == null) return;
    const btn = btnRefs.current[active];
    const row = rowRef.current;
    if (btn && row) {
      const target = btn.offsetLeft - row.clientWidth / 2 + btn.clientWidth / 2;
      row.scrollTo({ left: Math.max(0, target), behavior: suave() });
    }
  }, [active]);

  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [categorias]);

  const scroll = (dir: "prev" | "next") =>
    rowRef.current?.scrollBy({ left: dir === "next" ? 280 : -280, behavior: suave() });

  const arrow = (dir: "prev" | "next", disabled: boolean) => (
    <button
      type="button"
      onClick={() => scroll(dir)}
      disabled={disabled}
      aria-label={dir === "prev" ? t("ariaPrevCat") : t("ariaNextCat")}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-[var(--surface)] text-[var(--fg)] ring-1 ring-[var(--line)] transition-opacity md:grid ${
        dir === "prev" ? "left-0" : "right-0"
      } ${disabled ? "pointer-events-none opacity-0" : "hover:ring-[var(--fg)]"}`}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );

  return (
    <nav aria-label={t("categories")} className="relative -mx-4 sm:mx-0">
      {arrow("prev", atStart)}
      <div
        ref={rowRef}
        className="mn-scroll flex gap-2 overflow-x-auto px-4 py-3 sm:px-0 md:px-11"
        style={{
          maskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
        }}
      >
        {categorias.map((c) => {
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              type="button"
              ref={(el) => {
                btnRefs.current[c.id] = el;
              }}
              onClick={() => onPick(c.id)}
              aria-current={isActive ? "true" : undefined}
              className="mn-chip mn-cat shrink-0"
            >
              <CategoriaIcon nombre={c.nombre} rubro={rubro} size={16} />
              {c.nombre}
            </button>
          );
        })}
      </div>
      {arrow("next", atEnd)}
    </nav>
  );
};

// ── Helpers de contacto ──
function waLink(config: Configuracion | null) {
  let num = (config?.whatsapp || config?.telefono || "").replace(/\D/g, "");
  if (num && !num.startsWith("54")) num = "549" + num;
  return num ? `https://wa.me/${num}` : "#";
}

function WaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z" />
    </svg>
  );
}

const XIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const ArrowIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

function Chip({ icon, href, children }: { icon: string; href: string; children: ReactNode }) {
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="mn-chip mn-chip-linea max-w-full">
      <CIcon icon={icon} />
      <span className="truncate">{children}</span>
    </a>
  );
}

function SemanaHorarios({ hc }: { hc: HorariosConfig }) {
  const { t } = useLang();
  const hoy = hoyIndex();
  return (
    <div>
      <p className="mn-label mb-3 text-[var(--fg-dark-2)]">{t("schedule")}</p>
      <dl className="grid gap-1">
        {Array.from({ length: 7 }, (_, i) => {
          const txt = franjasTxt(hc[i]);
          const esHoy = i === hoy;
          return (
            <div
              key={i}
              className={`flex justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] ${esHoy ? "bg-[var(--ink-2)] font-bold text-[var(--bg)]" : "text-[var(--fg-dark-2)]"}`}
            >
              <dt>
                {t(`day${i}`)}
                {esHoy ? ` · ${t("todaySuffix")}` : ""}
              </dt>
              <dd className="mn-num">{txt || t("closed")}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function FooterLine({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <CIcon icon={icon} size={16} />
      <span>{children}</span>
    </div>
  );
}

export default Menu;
