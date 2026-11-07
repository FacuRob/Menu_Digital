// Tema desde el primer instante (sin flash): pone data-theme en <html> para
// que los tokens de src/styles/tokens.css ya apliquen antes de React.
// El login y el reset son siempre claros (estilo "Hora pico").
// Va en un archivo aparte (no inline) porque la CSP del admin sólo permite
// scripts propios.
(function () {
  var html = document.documentElement;
  var t = null;
  try {
    t = localStorage.getItem("theme");
  } catch (e) {
    /* sin storage */
  }
  if (t !== "dark" && t !== "light") {
    t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  var acceso = /\/admin\/(login|reset-password|cambiar-password|onboarding)|^\/$|^\/admin\/?$/.test(location.pathname);
  html.setAttribute("data-theme", t);
  var bg = acceso ? "#efede6" : t === "dark" ? "#0d0e11" : "#f4f2ec";
  html.style.background = bg;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", bg);
})();
