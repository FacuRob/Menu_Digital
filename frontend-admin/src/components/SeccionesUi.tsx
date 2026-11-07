import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { useTheme } from "../context/ThemeContext";

// Piezas compartidas por las ventanas con secciones ("Configuración del menú"
// y "Mi cuenta"), para que las dos tengan exactamente el mismo diseño.

export interface SideNavItem<T extends string> {
  id: T;
  label: string;
  accent: string;
  Icon: ComponentType<{ size?: number }>;
  // Punto naranja: la sección tiene cambios sin guardar.
  dirty?: boolean;
}

export interface SideNavGroup<T extends string> {
  label: string;
  color: string;
  items: SideNavItem<T>[];
}


// Menú de secciones: columna agrupada a la izquierda en computadora y fila
// deslizable arriba en el celular.
export function SideNav<T extends string>({
  groups,
  value,
  onChange,
  isMobile,
  dirtyTitle,
}: {
  groups: SideNavGroup<T>[];
  value: T;
  onChange: (id: T) => void;
  isMobile: boolean;
  dirtyTitle?: string;
}) {
  const { isDark } = useTheme();

  // En el celular la fila se desliza: mantener visible la sección elegida.
  const filaRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isMobile) return;
    const fila = filaRef.current;
    const activo = fila?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (fila && activo) {
      fila.scrollTo({
        left: activo.offsetLeft - (fila.clientWidth - activo.offsetWidth) / 2,
        behavior: "smooth",
      });
    }
  }, [value, isMobile]);

  const textPrimary = isDark ? "#f1f5f9" : "#1e293b";
  const activeBg = isDark ? "#2a2f3d" : "#ffffff";
  const itemColor = isDark ? "#94a3b8" : "#475569";
  const hoverBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)";

  const renderItem = (it: SideNavItem<T>) => {
    const activa = it.id === value;
    return (
      <button
        key={it.id}
        type="button"
        role="tab"
        aria-selected={activa}
        onClick={() => onChange(it.id)}
        onMouseEnter={(e) => {
          if (!activa) e.currentTarget.style.background = hoverBg;
        }}
        onMouseLeave={(e) => {
          if (!activa) e.currentTarget.style.background = "transparent";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          width: isMobile ? "auto" : "100%",
          flexShrink: 0,
          padding: isMobile ? "8px 12px" : "9px 10px",
          borderRadius: 9,
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          whiteSpace: "nowrap",
          fontSize: 13,
          fontWeight: activa ? 650 : 500,
          color: activa ? textPrimary : itemColor,
          background: activa ? activeBg : "transparent",
          boxShadow: activa ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <span
          style={{
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: 7,
            flexShrink: 0,
            color: activa ? it.accent : itemColor,
            background: activa ? `${it.accent}1f` : "transparent",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          <it.Icon size={16} />
        </span>
        {it.label}
        {it.dirty && (
          <span
            title={dirtyTitle}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#f59e0b",
              flexShrink: 0,
              marginLeft: "auto",
            }}
          />
        )}
      </button>
    );
  };

  const contenedor: React.CSSProperties = {
    padding: 6,
    borderRadius: 14,
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.04)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
  };

  if (isMobile) {
    return (
      <nav
        ref={filaRef}
        role="tablist"
        style={{
          ...contenedor,
          display: "flex",
          gap: 4,
          overflowX: "auto",
          scrollbarWidth: "none",
          position: "relative",
        }}
      >
        {groups.flatMap((g) => g.items).map(renderItem)}
      </nav>
    );
  }

  return (
    <nav
      role="tablist"
      aria-orientation="vertical"
      style={{ ...contenedor, width: 232, flexShrink: 0, position: "sticky", top: 0 }}
    >
      {groups.map((g, i) => (
        <div key={g.label} style={{ marginTop: i === 0 ? 0 : 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 10px 5px",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: g.color,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: g.color }} />
            {g.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {g.items.map(renderItem)}
          </div>
        </div>
      ))}
    </nav>
  );
}

// Tarjeta de sección: título, subtítulo y borde de color a la izquierda.
export function SectionCard({
  accent,
  title,
  subtitle,
  children,
}: {
  accent: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { isDark } = useTheme();
  return (
    <div
      style={{
        background: isDark ? "#1a1d27" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        marginBottom: 14,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "15px 18px 0" }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: isDark ? "#f1f5f9" : "#1e293b" }}>
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              margin: "3px 0 0",
              fontSize: 12,
              color: isDark ? "#64748b" : "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ padding: 18 }}>{children}</div>
    </div>
  );
}
