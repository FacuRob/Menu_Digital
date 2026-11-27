// Después de `vite build` y `vite build --ssr`: mete el HTML de la landing en
// dist/index.html, así Google (y cualquiera sin JavaScript) ve el texto.
// Ese index.html se sirve en todas las rutas (rewrite de Render): en las que
// no son "/" el HTML de la landing se oculta al instante y main.tsx lo borra.
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(raiz, "dist");
const manifiestoPath = path.join(dist, ".vite", "manifest.json");

const falla = (msg) => {
  console.error(`prerender: ${msg}`);
  process.exit(1);
};

// CSS y JS de la landing (página lazy): se piden desde el <head> sólo en "/",
// así el HTML se ve con su estilo desde el primer cuadro.
const manifiesto = JSON.parse(await readFile(manifiestoPath, "utf8"));
const landing = manifiesto["src/pages/Landing.tsx"];
if (!landing) falla("no encontré src/pages/Landing.tsx en el manifest");
const css = new Set();
const visto = new Set();
const juntarCss = (clave) => {
  if (visto.has(clave)) return;
  visto.add(clave);
  const e = manifiesto[clave];
  if (!e || e.isEntry) return; // el CSS de la entrada ya está en el <head>
  (e.css || []).forEach((c) => css.add(`/${c}`));
  (e.imports || []).forEach(juntarCss);
};
juntarCss("src/pages/Landing.tsx");

const { render } = await import(pathToFileURL(path.join(raiz, "dist-ssr", "entry-server.js")).href);
const cuerpo = await render("/");
if (!cuerpo.includes("hero-titulo")) falla("el HTML generado no tiene la landing");

const estilos = [...css].map((h) => `<link rel="stylesheet" href="${h}">`).join("");
const enlaces = estilos + `<link rel="modulepreload" href="/${landing.file}">`;
// Script en archivo aparte (no inline): así anda aunque la CSP tenga
// script-src 'self'. Sin async/defer: tiene que correr antes de pintar.
// El nombre lleva un hash del contenido para que nunca quede uno viejo en caché.
const codigo = `if(location.pathname==="/")document.write(${JSON.stringify(enlaces)});else document.documentElement.classList.add("dx-otra");\n`;
const nombreJs = `assets/dx-pre-${createHash("sha256").update(codigo).digest("hex").slice(0, 8)}.js`;
await writeFile(path.join(dist, nombreJs), codigo);
const cabeza =
  `<style>html.dx-otra #root[data-pre]{display:none}</style>\n` +
  // Sin JavaScript no corre ningún script: estilos y fondo de la landing igual.
  `    <noscript>${estilos}<style>html,body{background:#efede6}</style></noscript>\n` +
  `    <script src="/${nombreJs}"></script>\n` +
  `  </head>`;

const indexPath = path.join(dist, "index.html");
let html = await readFile(indexPath, "utf8");
if (!html.includes('<div id="root"></div>') || !html.includes("</head>")) falla("index.html no tiene el formato esperado");
html = html.replace("</head>", cabeza).replace('<div id="root"></div>', `<div id="root" data-pre>${cuerpo}</div>`);
await writeFile(indexPath, html);

// /precios: el mismo HTML pero con título, descripción y vista previa propios.
// WhatsApp y Facebook no corren JavaScript: sin esto, al compartir el link se
// vería la vista previa de la landing. Render sirve este archivo antes del
// rewrite a /index.html; si no, queda el comportamiento de siempre.
const PRECIOS = {
  title: "Precios y planes · DinexFlow",
  desc: "Planes desde $22.000 por mes en pesos, con Mercado Pago. Sumá WhatsApp, IA o el mapa a tu plan, o elegí el Pro con todo incluido.",
};
let precios = html;
const cambiar = (re, nuevo) => {
  if (!re.test(precios)) falla(`/precios: no encontré ${re}`);
  precios = precios.replace(re, nuevo);
};
cambiar(/<title>[^<]*<\/title>/, `<title>${PRECIOS.title}</title>`);
cambiar(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${PRECIOS.desc}$2`);
cambiar(/(<meta property="og:url" content=")[^"]*(")/, "$1https://dinexflow.com.ar/precios$2");
cambiar(/(<meta property="og:title" content=")[^"]*(")/, `$1${PRECIOS.title}$2`);
cambiar(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${PRECIOS.desc}$2`);
precios = precios.replace("</head>", '<link rel="canonical" href="https://dinexflow.com.ar/precios">\n  </head>');
await mkdir(path.join(dist, "precios"), { recursive: true });
await writeFile(path.join(dist, "precios", "index.html"), precios);

// El manifest sólo hacía falta acá: que no quede publicado.
await rm(path.join(dist, ".vite"), { recursive: true, force: true });
console.log(`prerender: landing en dist/index.html (${Math.round(cuerpo.length / 1024)} KB, ${css.size} CSS)`);
