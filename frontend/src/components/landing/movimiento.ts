// ¿El usuario pidió reducir el movimiento? (sin depender de GSAP ni Lenis)
export const sinMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
