// Color de fondo desde el primer instante (sin flash blanco): oscuro en el
// login; en el panel, el del tema elegido (claro u oscuro). Va en un archivo
// aparte (no inline) porque la CSP del admin sólo permite scripts propios.
(function () {
  var bg = "#060912";
  if (!/\/admin\/(login|reset-password)|^\/$|^\/admin\/?$/.test(location.pathname)) {
    var t = null;
    try {
      t = localStorage.getItem("theme");
    } catch (e) {
      /* sin storage: tema claro */
    }
    bg = t === "dark" ? "#0f1117" : "#f0f2f5";
  }
  document.documentElement.style.background = bg;
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", bg);
})();
