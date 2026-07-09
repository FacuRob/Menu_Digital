import { useState, useEffect, useRef, useMemo } from "react";
import {
  productosService,
  categoriasService,
  configuracionService,
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
  PRIMARY_DARK,
  PRIMARY_SHADOW,
  paletteVars,
  fmt,
  setMonedaMenu,
  CategoriaIcon,
  ProductImage,
} from "../lib/menuUi";
import ProductModal from "../components/ProductModal";
import CartDrawer from "../components/CartDrawer";
import { useLang, LangSelector } from "../lib/i18n";

const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
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

const Menu = () => {
  const { t } = useLang();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [config, setConfig] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalProd, setModalProd] = useState<Producto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mesa, setMesa] = useState(
    () => new URLSearchParams(window.location.search).get("mesa") || "",
  );
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cart = useCart();
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [p, c, cfg] = await Promise.all([
          productosService.getDisponibles(),
          categoriasService.getActivas(),
          configuracionService.get().catch(() => null),
        ]);
        setProductos(p);
        setCategorias(c);
        setConfig(cfg);
        setMonedaMenu(cfg?.moneda); // moneda del negocio para el formato de precios
      } catch (e) {
        console.error("Error al cargar el menú:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const scrollToCat = (id: number) => {
    const el = sectionRefs.current[id];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf7f4",
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >
        <div style={{ fontSize: 46, marginBottom: 14, animation: "pulse 1.4s ease-in-out infinite" }}>
          🍽️
        </div>
        <p style={{ color: "#9ca3af", fontSize: 15 }}>{t("loading")}</p>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    );
  }

  const nombre = config?.nombre || t("defaultTitle");
  const portada = config?.portada_url;

  return (
    <div
      style={{
        ...paletteVars(config?.color_primario),
        minHeight: "100vh",
        background: "#fbf7f4",
        fontFamily: "'Inter',system-ui,sans-serif",
        paddingBottom: 90,
      }}
    >
      {/* ══ Banner superior ══ */}
      <header
        style={{
          position: "relative",
          padding: "22px 24px 70px",
          color: "#fff",
          background: portada
            ? `linear-gradient(rgba(20,12,8,.62),rgba(20,12,8,.74)), url(${portada}) center/cover`
            : "linear-gradient(120deg,#2a1913 0%,#7a2f13 60%,#c1440e 100%)",
        }}
      >
        <div style={{ position: "absolute", top: 16, right: 20, zIndex: 6 }}>
          <LangSelector dark />
        </div>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          {/* Logo + nombre */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {config?.logo_url ? (
              <img
                src={config.logo_url}
                alt={nombre}
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 16,
                  objectFit: "cover",
                  boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 74,
                  height: 74,
                  borderRadius: 16,
                  background: "rgba(0,0,0,.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 30,
                  fontWeight: 800,
                  color: PRIMARY,
                  boxShadow: "0 6px 20px rgba(0,0,0,.35)",
                }}
              >
                {nombre.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 30,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  textShadow: "0 2px 10px rgba(0,0,0,.4)",
                }}
              >
                {nombre}
              </h1>
              {config?.descripcion && (
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: 13.5,
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: 1.4,
                    maxWidth: 360,
                    textShadow: "0 1px 6px rgba(0,0,0,.45)",
                  }}
                >
                  {config.descripcion}
                </p>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 34,
              flexWrap: "wrap",
              fontSize: 14.5,
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {config?.direccion && (
                <ContactLine icon="pin">{config.direccion}</ContactLine>
              )}
              {tieneHorarios(config?.horarios_config) ? (
                <ContactLine icon="clock">
                  {t("today")}:{" "}
                  {horarioHoy(config?.horarios_config) || t("closedToday")}
                </ContactLine>
              ) : (
                config?.horarios && (
                  <ContactLine icon="clock">{config.horarios}</ContactLine>
                )
              )}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {config?.telefono && (
                <ContactLine icon="phone">{config.telefono}</ContactLine>
              )}
              {config?.email && (
                <ContactLine icon="mail">{config.email}</ContactLine>
              )}
            </div>

            {(config?.whatsapp || config?.telefono) && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 800, lineHeight: 1.2, maxWidth: 120 }}>
                  {t("contactChannels")}
                </span>
                <a
                  href={waLink(config)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "#25d366",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    flexShrink: 0,
                    boxShadow: "0 4px 14px rgba(0,0,0,.3)",
                  }}
                >
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.2 1.1-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.7-1.2-4.4-3.9-4.6-4.1-.1-.2-1-1.4-1-2.6s.6-1.8.9-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3Z" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══ Contenedor blanco (superpuesto al banner) ══ */}
      <div
        style={{
          maxWidth: 1180,
          margin: "-48px auto 0",
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 -2px 30px rgba(0,0,0,.06)",
          padding: "26px 26px 40px",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* Buscador */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth={2}
            strokeLinecap="round"
            style={{ position: "absolute", left: 18, top: 16 }}
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4-4" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            style={{
              width: "100%",
              padding: "15px 18px 15px 48px",
              borderRadius: 14,
              border: "1.5px solid #ececec",
              fontSize: 15,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              background: "#fcfbfa",
            }}
          />
        </div>

        {/* Fila de íconos de categoría con flechas next/prev */}
        {categorias.length > 0 && !q && (
          <CategoryBar
            categorias={categorias}
            onPick={scrollToCat}
            isDesktop={isDesktop}
          />
        )}

        {/* Secciones de productos */}
        {porCategoria.length === 0 ? (
          q ? (
            <div style={{ textAlign: "center", padding: "70px 0", color: "#9ca3af" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
              <p style={{ fontSize: 16 }}>{t("noResults")}</p>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "60px 20px 40px" }}>
              {config?.logo_url ? (
                <img
                  src={config.logo_url}
                  alt={nombre}
                  style={{ width: 84, height: 84, borderRadius: 20, objectFit: "cover", margin: "0 auto 16px", display: "block", boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}
                />
              ) : (
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 20,
                    margin: "0 auto 16px",
                    background: "linear-gradient(135deg,#ff8a5c,#ff5722)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 34,
                    fontWeight: 800,
                    color: "#fff",
                    boxShadow: `0 8px 24px ${PRIMARY_SHADOW}`,
                  }}
                >
                  {nombre.charAt(0).toUpperCase()}
                </div>
              )}
              <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#1c1917" }}>
                {nombre}
              </h3>
              <p style={{ margin: 0, fontSize: 15, color: "#6b7280" }}>
                {t("preparingTitle")}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
                {t("preparingSubtitle")}
              </p>
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 22 }}>
            {porCategoria.map(({ cat, prods }) => (
              <section
                key={cat.id}
                ref={(el) => {
                  sectionRefs.current[cat.id] = el;
                }}
              >
                <h2
                  style={{
                    margin: "0 0 16px",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#1c1917",
                  }}
                >
                  {cat.nombre}
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))",
                    gap: 18,
                  }}
                >
                  {prods.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      prod={prod}
                      onOpen={() => setModalProd(prod)}
                      onAdd={() => cart.add(prod, 1)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ══ Footer con descripción y datos ══ */}
      <footer
        style={{
          maxWidth: 1180,
          margin: "34px auto 0",
          padding: "0 26px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "26px 28px",
            boxShadow: "0 1px 10px rgba(0,0,0,.05)",
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#1c1917" }}>
              {nombre}
            </h3>
            {config?.descripcion && (
              <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
                {config.descripcion}
              </p>
            )}
          </div>
          <div style={{ display: "grid", gap: 10, fontSize: 14, color: "#4b5563" }}>
            {config?.direccion && <FooterLine icon="pin">{config.direccion}</FooterLine>}
            {!tieneHorarios(config?.horarios_config) && config?.horarios && (
              <FooterLine icon="clock">{config.horarios}</FooterLine>
            )}
            {config?.telefono && <FooterLine icon="phone">{config.telefono}</FooterLine>}
            {config?.email && <FooterLine icon="mail">{config.email}</FooterLine>}
          </div>
          {tieneHorarios(config?.horarios_config) && (
            <SemanaHorarios hc={config!.horarios_config!} />
          )}
        </div>
        <div style={{ textAlign: "center", margin: "18px 0 30px" }}>
          <p style={{ fontSize: 12, color: "#c4beba", margin: 0 }}>
            {t("pricesIncludeTax")}
          </p>
          <p style={{ fontSize: 11, color: "#d6d0cc", margin: "6px 0 0", letterSpacing: "0.02em" }}>
            {t("madeWith")} <span style={{ color: PRIMARY, fontWeight: 700 }}>Menú Digital</span>
          </p>
        </div>
      </footer>

      {/* ══ Botón flotante del carrito ══ */}
      <button
        onClick={() => setCartOpen(true)}
        aria-label={t("ariaViewOrder")}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 80,
          width: 62,
          height: 62,
          borderRadius: "50%",
          border: "none",
          background: PRIMARY,
          color: "#fff",
          cursor: "pointer",
          boxShadow: `0 10px 30px ${PRIMARY_SHADOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" />
          <circle cx="18" cy="21" r="1" />
          <path d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
        {cart.count > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              minWidth: 24,
              height: 24,
              padding: "0 6px",
              borderRadius: 999,
              background: "#111",
              color: "#fff",
              fontSize: 12.5,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fbf7f4",
            }}
          >
            {cart.count}
          </span>
        )}
      </button>

      {/* Modal de producto */}
      {modalProd && (
        <ProductModal
          producto={modalProd}
          onClose={() => setModalProd(null)}
          onAdd={(p, cantidad) => cart.add(p, cantidad)}
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

// ── Card de producto (texto a la izquierda, imagen a la derecha) ──
const ProductCard = ({
  prod,
  onOpen,
  onAdd,
}: {
  prod: Producto;
  onOpen: () => void;
  onAdd: () => void;
}) => {
  const { t } = useLang();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #f0eeec",
        overflow: "hidden",
        cursor: "pointer",
        minHeight: 132,
        boxShadow: hovered ? "0 10px 30px rgba(0,0,0,.10)" : "0 1px 4px rgba(0,0,0,.04)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "box-shadow .2s, transform .2s",
      }}
    >
      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0, padding: "16px 16px 14px", display: "flex", flexDirection: "column" }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#1c1917", lineHeight: 1.3 }}>
          {prod.nombre}
        </h3>
        {prod.descripcion && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 13,
              color: "#6b7280",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {prod.descripcion}
          </p>
        )}
        <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 17, fontWeight: 800, color: PRIMARY }}>
          {fmt(Number(prod.precio))}
        </div>
      </div>

      {/* Imagen + botón agregar */}
      <div style={{ position: "relative", width: 132, flexShrink: 0, background: "#f4f2f0" }}>
        <ProductImage url={prod.imagen_url} alt={prod.nombre} style={{ width: "100%", height: "100%" }} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          aria-label={t("ariaAddToOrder")}
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background: PRIMARY,
            color: "#fff",
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 4px 12px ${PRIMARY_SHADOW}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = PRIMARY_DARK)}
          onMouseLeave={(e) => (e.currentTarget.style.background = PRIMARY)}
        >
          +
        </button>
      </div>
    </div>
  );
};

// ── Barra de categorías con flechas next/prev (desktop) ──
const CategoryBar = ({
  categorias,
  onPick,
  isDesktop,
}: {
  categorias: Categoria[];
  onPick: (id: number) => void;
  isDesktop: boolean;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = () => {
    const el = rowRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };

  useEffect(() => {
    update();
    const el = rowRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [categorias]);

  const scroll = (dir: "prev" | "next") => {
    rowRef.current?.scrollBy({
      left: dir === "next" ? 280 : -280,
      behavior: "smooth",
    });
  };

  return (
    <div
      style={{
        position: "relative",
        borderBottom: "1px solid #f1efed",
        marginBottom: 6,
      }}
    >
      <div
        ref={rowRef}
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 14,
          paddingLeft: isDesktop ? 42 : 0,
          paddingRight: isDesktop ? 42 : 0,
          scrollbarWidth: "none",
        }}
      >
        <style>{`::-webkit-scrollbar{display:none}`}</style>
        {categorias.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              flexShrink: 0,
              width: 104,
              padding: "6px 4px",
              border: "none",
              background: "none",
              cursor: "pointer",
              color: PRIMARY,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
              fontFamily: "inherit",
            }}
          >
            <CategoriaIcon nombre={c.nombre} size={28} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "#3f3f46",
                lineHeight: 1.25,
                textAlign: "center",
              }}
            >
              {c.nombre}
            </span>
          </button>
        ))}
      </div>

      {isDesktop && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 14,
              display: "flex",
              alignItems: "center",
              background:
                "linear-gradient(to right,#fff 55%,rgba(255,255,255,0))",
              paddingRight: 12,
            }}
          >
            <CatArrow dir="prev" disabled={atStart} onClick={() => scroll("prev")} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 14,
              display: "flex",
              alignItems: "center",
              background:
                "linear-gradient(to left,#fff 55%,rgba(255,255,255,0))",
              paddingLeft: 12,
            }}
          >
            <CatArrow dir="next" disabled={atEnd} onClick={() => scroll("next")} />
          </div>
        </>
      )}
    </div>
  );
};

// ── Flecha circular reutilizable ──
const CatArrow = ({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) => {
  const { t } = useLang();
  return (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={dir === "prev" ? t("ariaPrevCat") : t("ariaNextCat")}
    style={{
      width: 34,
      height: 34,
      borderRadius: "50%",
      border: "1.5px solid #ececec",
      background: "#fff",
      color: disabled ? "#d4d4d4" : PRIMARY,
      cursor: disabled ? "default" : "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all .15s",
    }}
    onMouseEnter={(e) => {
      if (!disabled) {
        e.currentTarget.style.background = PRIMARY;
        e.currentTarget.style.color = "#fff";
        e.currentTarget.style.borderColor = PRIMARY;
      }
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = "#fff";
      e.currentTarget.style.color = disabled ? "#d4d4d4" : PRIMARY;
      e.currentTarget.style.borderColor = "#ececec";
    }}
  >
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {dir === "prev" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  </button>
  );
};

// ── Helpers de contacto ──
function waLink(config: Configuracion | null) {
  let num = (config?.whatsapp || config?.telefono || "").replace(/\D/g, "");
  if (num && !num.startsWith("54")) num = "549" + num;
  return num ? `https://wa.me/${num}` : "#";
}

const contactIcons: Record<string, React.ReactNode> = {
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
  phone: (
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
};

function ContactLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9, flexShrink: 0 }}>
        {contactIcons[icon]}
      </svg>
      <span>{children}</span>
    </div>
  );
}

function SemanaHorarios({ hc }: { hc: HorariosConfig }) {
  const { t } = useLang();
  const hoy = hoyIndex();
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1917", marginBottom: 8 }}>
        {t("schedule")}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {DIAS_SEMANA.map((_, i) => {
          const txt = franjasTxt(hc[i]);
          const esHoy = i === hoy;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: 12.5,
                color: esHoy ? "#1c1917" : "#6b7280",
                fontWeight: esHoy ? 700 : 400,
              }}
            >
              <span>
                {t(`day${i}`)}
                {esHoy ? ` · ${t("todaySuffix")}` : ""}
              </span>
              <span style={{ color: txt ? "#4b5563" : "#c0392b" }}>
                {txt || t("closed")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FooterLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#4b5563" }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRIMARY} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        {contactIcons[icon]}
      </svg>
      <span>{children}</span>
    </div>
  );
}

export default Menu;
