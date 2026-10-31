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
  PRIMARY_SOFT,
  PRIMARY_SHADOW,
  PRIMARY_ON,
  PRIMARY_A35,
  paletteVars,
  fmt,
  setMonedaMenu,
  CategoriaIcon,
  ProductImage,
} from "../lib/menuUi";
import ProductModal from "../components/ProductModal";
import CartDrawer from "../components/CartDrawer";
import { useLang, LangSelector } from "../lib/i18n";

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

const Menu = () => {
  const { t } = useLang();
  const { slug } = useParams<{ slug?: string }>();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [search, setSearch] = useState("");
  const [modalProd, setModalProd] = useState<Producto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mesa, setMesa] = useState(
    () => new URLSearchParams(window.location.search).get("mesa") || "",
  );

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
  }, [slug]);

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
      window.scrollTo({ top: y, behavior: "smooth" });
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

  const pageStyle = {
    ...paletteVars(config?.color_primario),
    background: `radial-gradient(1100px 520px at 85% -8%, ${PRIMARY_A35}, transparent 62%), linear-gradient(165deg, var(--mp-bg1, #2a0f06) 0%, var(--mp-bg2, #120604) 45%, #070707 100%)`,
    backgroundAttachment: "fixed",
  };

  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center font-[Inter,system-ui,sans-serif] text-white"
        style={pageStyle}
      >
        <div className="text-5xl" style={{ animation: "pulse 1.4s ease-in-out infinite" }}>
          🍽️
        </div>
        <p className="mt-4 text-[15px] text-white/50">{t("loading")}</p>
        <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.94)}}`}</style>
      </div>
    );
  }

  // Slug inexistente: el negocio no existe o está inactivo.
  if (notFound) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center p-6 text-center font-[Inter,system-ui,sans-serif] text-white"
        style={pageStyle}
      >
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-white/[0.06] text-4xl ring-1 ring-white/10">🔍</div>
        <h1 className="mt-5 text-2xl font-extrabold">{t("notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-white/50">{t("notFoundDesc")}</p>
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
    config?.mesas_activo && (config.mesas_cantidad || 0) > 0 ? { k: "mesa", e: "🍽️", l: t("deliveryTable") } : null,
    config?.retiro_activo ? { k: "retiro", e: "🛍️", l: t("deliveryPickup") } : null,
    config?.delivery_activo ? { k: "delivery", e: "🛵", l: t("deliveryDelivery") } : null,
  ].filter(Boolean) as { k: string; e: string; l: string }[];

  return (
    <div
      className="min-h-screen pb-32 font-[Inter,system-ui,sans-serif] text-white antialiased selection:bg-white/20"
      style={pageStyle}
    >
      {/* ══ Portada ══ */}
      <header className="relative overflow-hidden">
        {portada && (
          <>
            <img src={portada} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,.15) 40%, var(--mp-bg2, #120604) 100%)" }}
            />
          </>
        )}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: PRIMARY }}
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8">
          <div className="flex justify-end">
            <LangSelector dark />
          </div>

          <div className="mn-in mt-6 flex items-center gap-4 sm:mt-10 sm:gap-5">
            {config?.logo_url ? (
              <img
                src={config.logo_url}
                alt={nombre}
                className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-2xl sm:h-20 sm:w-20"
                style={{ boxShadow: `0 0 0 2px ${PRIMARY_A35}, 0 18px 40px -12px ${PRIMARY_SHADOW}` }}
              />
            ) : (
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl font-extrabold sm:h-20 sm:w-20"
                style={{ background: PRIMARY_SOFT, color: PRIMARY, boxShadow: `inset 0 0 0 1px ${PRIMARY_A35}` }}
              >
                {nombre.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight drop-shadow sm:text-5xl">{nombre}</h1>
              {config?.descripcion && (
                <p className="mt-1 line-clamp-2 max-w-xl text-sm text-white/65 sm:text-base">{config.descripcion}</p>
              )}
            </div>
          </div>

          {/* Estado + modos de entrega */}
          <div className="mn-in mt-5 flex flex-wrap items-center gap-2 text-xs" style={{ animationDelay: "80ms" }}>
            {abierto !== null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
                  abierto ? "bg-emerald-400/15 text-emerald-300" : "bg-red-400/15 text-red-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${abierto ? "bg-emerald-400" : "bg-red-400"}`} />
                {abierto ? t("openNow") : t("closedNow")}
              </span>
            )}
            {hoyTxt && <Chip icon="clock">{hoyTxt}</Chip>}
            {entregas.map((e) => (
              <span key={e.k} className="rounded-full bg-white/10 px-2.5 py-1 text-white/75 backdrop-blur">
                {e.e} {e.l}
              </span>
            ))}
          </div>

          {/* Contacto */}
          {(config?.direccion || config?.telefono || config?.email || config?.whatsapp) && (
            <div className="mn-in mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ animationDelay: "140ms" }}>
              {config?.direccion && (
                <Chip
                  icon="pin"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.direccion)}`}
                >
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
                <a
                  href={waLink(config)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#25d366] px-3 py-1 font-semibold text-white shadow-lg shadow-[#25d366]/25 transition-transform hover:-translate-y-0.5"
                >
                  <WaIcon size={14} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ══ Barra fija: buscador + categorías ══ */}
      <div
        ref={stickyRef}
        className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--mp-bg2, #120604) 78%, transparent)" }}
      >
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <label className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm ring-1 ring-white/10 transition focus-within:ring-2" style={{ ["--tw-ring-color" as string]: PRIMARY_A35 }}>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/45" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="grid h-6 w-6 cursor-pointer place-items-center rounded-full bg-white/10 text-xs text-white/70 hover:bg-white/20"
                aria-label="Limpiar"
              >
                ✕
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
      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        {porCategoria.length === 0 ? (
          q ? (
            <div className="py-20 text-center text-white/50">
              <div className="text-5xl">🔍</div>
              <p className="mt-3 text-base">{t("noResults")}</p>
            </div>
          ) : (
            <div className="mx-auto max-w-sm py-16 text-center">
              <div
                className="mx-auto grid h-20 w-20 place-items-center rounded-3xl text-3xl font-extrabold"
                style={{ background: PRIMARY_SOFT, color: PRIMARY }}
              >
                {nombre.charAt(0).toUpperCase()}
              </div>
              <h3 className="mt-5 text-xl font-extrabold">{nombre}</h3>
              <p className="mt-2 text-white/70">{t("preparingTitle")}</p>
              <p className="mt-1 text-sm text-white/45">{t("preparingSubtitle")}</p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-10">
            {porCategoria.map(({ cat, prods }) => (
              <section
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                    style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                  >
                    <CategoriaIcon nombre={cat.nombre} rubro={config?.tipo_rubro} size={19} />
                  </span>
                  <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{cat.nombre}</h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-bold"
                    style={{ background: PRIMARY_SOFT, color: PRIMARY }}
                  >
                    {prods.length}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {prods.map((prod, i) => (
                    <ProductCard
                      key={prod.id}
                      prod={prod}
                      index={i}
                      onOpen={() => setModalProd(prod)}
                      onAdd={() => {
                        // Con variantes hay que elegir opciones → abrir el modal.
                        if (prod.variantes && prod.variantes.length > 0) {
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

      {/* ══ Footer con datos y horarios ══ */}
      <footer className="mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-6 rounded-3xl bg-white/[0.05] p-6 ring-1 ring-white/[0.08] backdrop-blur sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          <div>
            <h3 className="text-lg font-extrabold">{nombre}</h3>
            {config?.descripcion && <p className="mt-2 text-sm leading-relaxed text-white/55">{config.descripcion}</p>}
          </div>
          <div className="grid content-start gap-2.5 text-sm text-white/70">
            {config?.direccion && <FooterLine icon="pin">{config.direccion}</FooterLine>}
            {!tieneHorarios(config?.horarios_config) && config?.horarios && (
              <FooterLine icon="clock">{config.horarios}</FooterLine>
            )}
            {config?.telefono && <FooterLine icon="phone">{config.telefono}</FooterLine>}
            {config?.email && <FooterLine icon="mail">{config.email}</FooterLine>}
          </div>
          {tieneHorarios(config?.horarios_config) && <SemanaHorarios hc={config!.horarios_config!} />}
        </div>
        <div className="my-6 text-center">
          <p className="text-xs text-white/35">{t("pricesIncludeTax")}</p>
          <p className="mt-1.5 text-[11px] tracking-wide text-white/30">
            {t("madeWith")} <span className="font-bold" style={{ color: PRIMARY }}>DinexFlow</span>
          </p>
        </div>
      </footer>

      {/* ══ Botón "ir arriba" ══ */}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("ariaScrollTop")}
          title={t("ariaScrollTop")}
          className="mn-in fixed bottom-24 right-4 z-[80] grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-xl transition-transform hover:-translate-y-0.5 sm:right-6"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
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
          className="mn-bar-in fixed bottom-4 left-1/2 z-[80] flex w-[calc(100%-32px)] max-w-md cursor-pointer items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
          style={{
            background: PRIMARY,
            color: PRIMARY_ON,
            boxShadow: `0 14px 40px -10px ${PRIMARY_SHADOW}`,
            marginBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <span className="flex items-center gap-2.5">
            <span key={cart.count} className="mn-bump grid h-7 min-w-7 place-items-center rounded-full bg-black/20 px-1.5 text-xs">
              {cart.count}
            </span>
            {t("viewOrder")}
          </span>
          <span className="flex items-center gap-2">
            {fmt(cart.total)}
            <span aria-hidden>→</span>
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={t("ariaViewOrder")}
          className="fixed bottom-4 right-4 z-[80] grid h-14 w-14 cursor-pointer place-items-center rounded-full transition-transform hover:scale-105 sm:right-6"
          style={{ background: PRIMARY, color: PRIMARY_ON, boxShadow: `0 10px 30px ${PRIMARY_SHADOW}` }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1" />
            <circle cx="18" cy="21" r="1" />
            <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L23 6H6" />
          </svg>
        </button>
      )}

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
        setMesa={setMesa}
        config={config}
      />
    </div>
  );
};

// ── Card de producto (estilo app: imagen a la izquierda) ──
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
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="mn-in group flex cursor-pointer items-center gap-3 rounded-2xl bg-white/[0.055] p-2.5 ring-1 ring-white/[0.08] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.085] hover:ring-white/15"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div
        className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-28"
        style={{ background: `linear-gradient(135deg, ${PRIMARY_A35}, ${PRIMARY_SOFT})` }}
      >
        <ProductImage
          url={prod.imagen_url}
          alt={prod.nombre}
          w={224}
          h={224}
          fill
          style={{ width: "100%", height: "100%", transition: "transform .4s" }}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col self-stretch py-1">
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug">{prod.nombre}</h3>
          {personalizable && (
            <span
              className="mt-0.5 shrink-0 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide"
              style={{ background: PRIMARY_SOFT, color: PRIMARY }}
            >
              {t("customizable")}
            </span>
          )}
        </div>
        {prod.descripcion && (
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-white/50">{prod.descripcion}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="text-base font-extrabold" style={{ color: PRIMARY }}>
            {fmt(Number(prod.precio))}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            aria-label={t("ariaAddToOrder")}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-xl font-bold leading-none transition-transform hover:scale-110 active:scale-95"
            style={{ background: PRIMARY, color: PRIMARY_ON, boxShadow: `0 6px 16px -4px ${PRIMARY_SHADOW}` }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Barra de categorías (chips) con flechas en escritorio ──
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
      row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
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
    rowRef.current?.scrollBy({ left: dir === "next" ? 280 : -280, behavior: "smooth" });

  const arrow = (dir: "prev" | "next", disabled: boolean) => (
    <button
      type="button"
      onClick={() => scroll(dir)}
      disabled={disabled}
      aria-label={dir === "prev" ? t("ariaPrevCat") : t("ariaNextCat")}
      className={`absolute top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition md:grid ${
        dir === "prev" ? "left-0" : "right-0"
      } ${disabled ? "pointer-events-none opacity-0" : "hover:bg-white/20"}`}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );

  return (
    <div className="relative -mx-4 sm:mx-0">
      {arrow("prev", atStart)}
      <div
        ref={rowRef}
        className="mn-scroll flex gap-2 overflow-x-auto px-4 py-3 sm:px-0 md:px-10"
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
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold transition-all duration-300 ${
                isActive ? "shadow-lg" : "bg-white/[0.07] text-white/70 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white"
              }`}
              style={isActive ? { background: PRIMARY, color: PRIMARY_ON, boxShadow: `0 8px 20px -8px ${PRIMARY_SHADOW}` } : undefined}
            >
              <CategoriaIcon nombre={c.nombre} rubro={rubro} size={16} />
              {c.nombre}
            </button>
          );
        })}
      </div>
      {arrow("next", atEnd)}
    </div>
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

const contactIcons: Record<string, ReactNode> = {
  pin: (
    <>
      <path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
};

const CIcon = ({ icon, size = 14 }: { icon: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    {contactIcons[icon]}
  </svg>
);

function Chip({ icon, href, children }: { icon: string; href?: string; children: ReactNode }) {
  const cls =
    "inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-white/80 backdrop-blur";
  const body = (
    <>
      <CIcon icon={icon} />
      <span className="truncate">{children}</span>
    </>
  );
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={`${cls} transition-colors hover:bg-white/20`}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function SemanaHorarios({ hc }: { hc: HorariosConfig }) {
  const { t } = useLang();
  const hoy = hoyIndex();
  return (
    <div>
      <div className="mb-2.5 text-sm font-bold">{t("schedule")}</div>
      <div className="grid gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const txt = franjasTxt(hc[i]);
          const esHoy = i === hoy;
          return (
            <div
              key={i}
              className={`flex justify-between gap-3 rounded-lg px-2 py-1 text-[12.5px] ${esHoy ? "font-bold text-white" : "text-white/55"}`}
              style={esHoy ? { background: PRIMARY_SOFT } : undefined}
            >
              <span>
                {t(`day${i}`)}
                {esHoy ? ` · ${t("todaySuffix")}` : ""}
              </span>
              <span className={txt ? "" : "text-red-300"}>{txt || t("closed")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FooterLine({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span style={{ color: PRIMARY }}>
        <CIcon icon={icon} size={16} />
      </span>
      <span>{children}</span>
    </div>
  );
}

export default Menu;
