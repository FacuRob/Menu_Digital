import { useState, useEffect, useRef } from "react";
import {
  productosService,
  categoriasService,
  type Producto,
  type Categoria,
} from "../services/api";

const Menu = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [p, c] = await Promise.all([
        productosService.getDisponibles(),
        categoriasService.getActivas(),
      ]);
      setProductos(p);
      setCategorias(c);
    } catch (e) {
      console.error("Error al cargar el menú:", e);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  const porCategoria = categorias.map((cat) => ({
    cat,
    prods: productos.filter((p) => p.categoria_id === cat.id),
  }));

  const visible = selected
    ? porCategoria.filter((pc) => pc.cat.id === selected)
    : porCategoria;

  const scrollTo = (id: number | null) => {
    setSelected(id);
    // scroll the active filter chip into view horizontally
    if (filterRef.current) {
      const btn = filterRef.current.querySelector(
        `[data-id="${id ?? "all"}"]`,
      ) as HTMLElement;
      btn?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
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
          background: "#fef9f5",
          fontFamily: "'Inter',system-ui,sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 48,
            marginBottom: 16,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        >
          🍽️
        </div>
        <p style={{ color: "#9ca3af", fontSize: 15 }}>Cargando el menú...</p>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#fef9f5",
        fontFamily: "'Inter',system-ui,sans-serif",
      }}
    >
      {/* ── Header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          background: "rgba(255,249,245,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        {/* Brand */}
        <div
          style={{
            maxWidth: 680,
            margin: "0 auto",
            padding: "16px 16px 12px",
            textAlign: "center",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 26 }}>🍽️</span>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: "#1c1917",
                letterSpacing: "-0.5px",
              }}
            >
              Nuestro Menú
            </h1>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "#9ca3af" }}>
            Descubrí nuestros platos del día
          </p>
        </div>

        {/* Filtros */}
        {categorias.length > 0 && (
          <div
            ref={filterRef}
            style={{
              display: "flex",
              gap: 8,
              padding: "0 16px 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            <style>{`::-webkit-scrollbar{display:none}`}</style>

            {[
              { id: null, nombre: "Todos" },
              ...categorias.map((c) => ({ id: c.id, nombre: c.nombre })),
            ].map((item) => {
              const active = selected === item.id;
              return (
                <button
                  key={item.id ?? "all"}
                  data-id={item.id ?? "all"}
                  onClick={() => scrollTo(item.id)}
                  style={{
                    flexShrink: 0,
                    padding: "7px 16px",
                    borderRadius: 999,
                    border: active ? "none" : "1.5px solid #e5e7eb",
                    background: active ? "#f97316" : "#fff",
                    color: active ? "#fff" : "#6b7280",
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    transition: "all 0.18s",
                    boxShadow: active
                      ? "0 2px 12px rgba(249,115,22,0.3)"
                      : "none",
                    fontFamily: "inherit",
                  }}
                >
                  {item.nombre}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Contenido ── */}
      <main
        style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 60px" }}
      >
        {visible.every((pc) => pc.prods.length === 0) ? (
          <div
            style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <p style={{ fontSize: 16 }}>
              No hay productos disponibles en este momento
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {visible.map(({ cat, prods }) => {
              if (prods.length === 0) return null;
              return (
                <section key={cat.id}>
                  {/* Título categoría */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background:
                          "linear-gradient(to right,#fed7aa,transparent)",
                      }}
                    />
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#1c1917",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cat.nombre}
                    </h2>
                    <div
                      style={{
                        flex: 1,
                        height: 1,
                        background:
                          "linear-gradient(to left,#fed7aa,transparent)",
                      }}
                    />
                  </div>

                  {/* Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill,minmax(min(100%,280px),1fr))",
                      gap: 14,
                    }}
                  >
                    {prods.map((prod) => (
                      <ProductCard key={prod.id} prod={prod} fmt={fmt} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: "1px solid #f3f4f6",
          background: "#fff",
          padding: "20px 16px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
          ¿Alguna duda? Consultá con nuestro personal
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#d1d5db" }}>
          Todos los precios incluyen IVA
        </p>
      </footer>
    </div>
  );
};

// Componente de card de producto separado para hover limpio
const ProductCard = ({
  prod,
  fmt,
}: {
  prod: Producto;
  fmt: (n: number) => string;
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #f3f4f6",
        overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
        boxShadow: hovered
          ? "0 8px 32px rgba(0,0,0,0.10)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-2px)" : "none",
        cursor: "default",
      }}
    >
      {/* Imagen */}
      {prod.imagen_url && (
        <div style={{ height: 170, overflow: "hidden", background: "#f9fafb" }}>
          <img
            src={prod.imagen_url}
            alt={prod.nombre}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.35s",
              transform: hovered ? "scale(1.04)" : "scale(1)",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display =
                "none";
            }}
          />
        </div>
      )}

      {/* Contenido */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#1c1917",
              lineHeight: 1.3,
              flex: 1,
            }}
          >
            {prod.nombre}
          </h3>
          <span
            style={{
              flexShrink: 0,
              fontSize: 15,
              fontWeight: 700,
              color: "#f97316",
              background: "#fff7ed",
              padding: "3px 9px",
              borderRadius: 999,
              border: "1px solid #fed7aa",
              whiteSpace: "nowrap",
            }}
          >
            {fmt(prod.precio)}
          </span>
        </div>
        {prod.descripcion && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "#6b7280",
              lineHeight: 1.55,
            }}
          >
            {prod.descripcion}
          </p>
        )}
      </div>
    </div>
  );
};

export default Menu;
