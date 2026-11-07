// Estilos compartidos del panel, sobre los tokens de src/styles/tokens.css.
// Los colores son variables CSS: el mismo objeto sirve para claro y oscuro
// (el tema lo cambia data-theme en <html>). lightS/darkS/useStyles quedan
// por compatibilidad con las pantallas que ya los usan.

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  lineHeight: 1.4,
} as React.CSSProperties;

const boton = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: "var(--r-sm)",
  fontSize: 14,
  fontWeight: 600,
  minHeight: 40,
  padding: "8px 16px",
  cursor: "pointer",
  transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
  whiteSpace: "nowrap" as const,
} as React.CSSProperties;

export const lightS = {
  page: { color: "var(--fg-2)" },

  card: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-1)",
  } as React.CSSProperties,

  thead: {
    background: "var(--surface-2)",
    borderBottom: "1px solid var(--line)",
  } as React.CSSProperties,
  th: {
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--fg-3)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
  },
  tr: {
    borderBottom: "1px solid var(--line)",
    transition: "background 0.12s",
  },
  td: {
    padding: "11px 14px",
    fontSize: 14,
    color: "var(--fg-2)",
  } as React.CSSProperties,
  tdMuted: {
    padding: "11px 14px",
    fontSize: 13,
    color: "var(--fg-3)",
  } as React.CSSProperties,

  input: {
    width: "100%",
    minHeight: 40,
    padding: "9px 12px",
    borderRadius: "var(--r-sm)",
    background: "var(--surface)",
    border: "1px solid var(--line-strong)",
    color: "var(--fg)",
    fontSize: 14,
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s, box-shadow 0.15s",
  } as React.CSSProperties,
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--fg-3)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: 6,
  } as React.CSSProperties,

  btnPrimary: {
    ...boton,
    background: "var(--accent)",
    border: "1px solid transparent",
    color: "var(--on-accent)",
  } as React.CSSProperties,
  btnGhost: {
    ...boton,
    fontWeight: 500,
    background: "var(--surface)",
    border: "1px solid var(--line-strong)",
    color: "var(--fg-2)",
  } as React.CSSProperties,
  btnDanger: {
    background: "none",
    border: "none",
    color: "var(--err)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
    padding: 0,
    transition: "color 0.15s",
  } as React.CSSProperties,

  badgeGreen: { ...pill, background: "var(--ok-bg)", color: "var(--ok)" } as React.CSSProperties,
  badgeRed: { ...pill, background: "var(--err-bg)", color: "var(--err)" } as React.CSSProperties,
  badgeBlue: { ...pill, background: "var(--info-bg)", color: "var(--info)" } as React.CSSProperties,

  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "var(--overlay)",
    display: "flex",
    // flex-start + margin:auto en el modal: se centra si entra en la
    // pantalla y, si es más alto (celular), se puede desplazar sin cortarse.
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 16,
    overflowY: "auto" as const,
    zIndex: 50,
  },
  modal: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--r-lg)",
    width: "100%",
    maxWidth: 480,
    margin: "auto",
    boxShadow: "var(--shadow-pop)",
  } as React.CSSProperties,
  modalHeader: {
    padding: "18px 20px",
    borderBottom: "1px solid var(--line)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,
  modalBody: { padding: "20px 22px 22px" } as React.CSSProperties,
  modalFooter: {
    padding: "16px 22px 18px",
    borderTop: "1px solid var(--line)",
    background: "var(--surface-2)",
    display: "flex",
    gap: 10,
  } as React.CSSProperties,
};

export const darkS: typeof lightS = lightS;

export function useStyles() {
  return lightS;
}

export const S = lightS;
