// DinexAI: asistente del panel para el dueño/admin del negocio.
//
// Responde dudas sobre su cuenta ("cargué un producto y no se ve") mirando
// los datos reales del negocio. No toca nada: sólo explica y dice dónde ir.
// Usa la conexión a OpenRouter del asistente de WhatsApp, con clave y modelo
// propios (así el gasto de cada uno se ve por separado):
//   DINEXAI_API_KEY   clave de OpenRouter para DinexAI (si falta, usa OPENROUTER_API_KEY)
//   DINEXAI_MODEL     modelo. Si falta, usa los de WhatsApp (OPENROUTER_MODEL,
//                     hoy gratis) y si tampoco hay, anthropic/claude-haiku-5.5.
//                     Acepta varios separados por coma como respaldo.
const supabase = require("../config/database");
const { modulosDe } = require("../utils/modulos");
const { planEfectivo, diasRestantes, estaVigente } = require("../utils/suscripcion");
const { llamarOpenRouter, textoDe, precio, textoHorarios } = require("./iaService");
const { catalogoRubros } = require("../utils/rubros");

// Rubro con el nombre que ve el usuario ("Comercios y tiendas · Ropa"), no el
// código interno (QA: DinexAI decía "retail").
const FAMILIA_ES = { gastronomia: "Gastronomía", retail: "Comercio", servicios: "Servicios", generico: "Otro" };
async function nombreRubro(neg) {
  try {
    const { categorias } = await catalogoRubros();
    const cat = categorias.find((c) => c.codigo === neg.rubro_categoria);
    if (cat) {
      const esp = cat.especialidades.find((e) => e.codigo === neg.rubro_especialidad);
      return esp ? `${cat.nombre} · ${esp.nombre}` : cat.nombre;
    }
  } catch {
    // Sin catálogo (falta la migración o falló la consulta): el de la familia.
  }
  return FAMILIA_ES[neg.tipo_rubro] || FAMILIA_ES.gastronomia;
}

const MAX_MENSAJES = 12;

// Limpia la clave pegada en Render: espacios, comillas, "Bearer " o el
// nombre de la variable de más. Si adentro hay una clave de OpenRouter
// (sk-or-…), se usa sólo esa.
const limpiarClave = (v) => {
  const t = String(v || "").trim();
  const sk = t.match(/sk-or-[A-Za-z0-9_-]+/);
  if (sk) return sk[0];
  return t.replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "").trim();
};
const claveDinexAI = () => limpiarClave(process.env.DINEXAI_API_KEY) || limpiarClave(process.env.OPENROUTER_API_KEY);
const dinexAIConfigurado = () => !!claveDinexAI();
const modeloDinexAI = () => {
  const lista = String(process.env.DINEXAI_MODEL || process.env.OPENROUTER_MODEL || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (!lista.length) lista.push("anthropic/claude-haiku-5.5");
  // `models: undefined` pisa el respaldo del modelo de WhatsApp.
  return { model: lista[0], models: lista.length > 1 ? lista.slice(0, 3) : undefined };
};
const MAX_LARGO = 1500;
const MAX_PRODUCTOS_LISTADOS = 40;

// Qué hay en cada sección del panel (para decir "andá a …").
const GUIA_PANEL = `
- Dashboard: resumen del día, ventas, link de la página y QR para compartir.
- Pedidos: pedidos que llegan, cambiar su estado (pendiente → preparando → listo → en camino → entregado).
- Chats: conversaciones de WhatsApp con clientes (y el asistente con IA que les responde).
- Productos: crear/editar productos, precio, fotos, categoría, "Disponible", stock, variantes (talle, sabor, extras).
- Categorías: crear categorías, ordenarlas y activarlas/desactivarlas. Una categoría desactivada oculta todos sus productos.
- Código QR: QR del menú y QR por mesa para imprimir.
- WhatsApp: conectar el WhatsApp del local (con código QR), avisos automáticos y el asistente con IA para clientes.
- Usuarios: invitar empleados y darles permisos por rol.
- Negocios: crear o administrar otros locales de la misma cuenta, activar/desactivar la página.
- Suscripción: plan actual, días de prueba, pagar o cambiar de plan.
- Configuración (menú de abajo a la izquierda): datos del local (nombre, logo, portada, dirección, WhatsApp), horarios, formas de entrega (mesa, retiro, delivery, envío), costo de envío, medios de pago, moneda, rubro y módulos.
- Soporte: reportar un problema al equipo de DinexFlow.
Según el rubro y los módulos también pueden aparecer: Servicios, Turnos, Presupuestos y Clientes.`;

const ESTADO_PLAN = {
  trial: "prueba gratis",
  activo: "activo (pagando)",
  cancelado: "cancelado (sigue hasta fin del ciclo pagado)",
  vencido: "vencido",
};

// Por qué un producto NO aparece en la página pública. Mismas reglas que la
// función get_productos_disponibles de la base.
function motivosOculto(p, catPorId) {
  const m = [];
  const cat = p.categoria_id != null ? catPorId.get(p.categoria_id) : null;
  if (!cat) m.push("no tiene categoría asignada");
  else if (cat.activo === false) m.push(`su categoría "${cat.nombre}" está desactivada`);
  if (p.disponible === false) m.push('está marcado como "No disponible"');
  if (p.controlar_stock && !(Number(p.stock) > 0)) m.push("controla stock y el stock está en 0");
  return m;
}

function avisosProducto(p) {
  const a = [];
  if (!(Number(p.precio) > 0)) a.push("precio en 0");
  const fotos = Array.isArray(p.imagenes) ? p.imagenes.filter(Boolean) : [];
  if (!p.imagen_url && !fotos.length) a.push("sin foto");
  return a;
}

async function diagnostico(negocioId, cuentaId) {
  const [negR, cfgR, catR, prodR, cuentaR, pendR] = await Promise.all([
    supabase.from("negocios").select("*").eq("id", negocioId).maybeSingle(),
    supabase.from("configuracion").select("*").eq("negocio_id", negocioId).maybeSingle(),
    supabase.from("categorias").select("id, nombre, activo, orden").eq("negocio_id", negocioId).order("orden"),
    supabase.from("productos").select("*").eq("negocio_id", negocioId).order("created_at", { ascending: false }),
    cuentaId
      ? supabase.from("cuentas").select("*").eq("id", cuentaId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId)
      .eq("estado", "pendiente"),
  ]);

  const neg = negR.data || {};
  const cfg = cfgR.data || {};
  const categorias = catR.data || [];
  const productos = prodR.data || [];
  const cuenta = cuentaR.data;
  const modulos = modulosDe(neg);
  const moneda = cfg.moneda || "ARS";
  const catPorId = new Map(categorias.map((c) => [c.id, c]));

  const visibles = [];
  const ocultos = [];
  for (const p of productos) {
    const motivos = motivosOculto(p, catPorId);
    (motivos.length ? ocultos : visibles).push({ p, motivos });
  }

  const lineaProd = ({ p, motivos }) => {
    const cat = catPorId.get(p.categoria_id)?.nombre || "sin categoría";
    const estado = motivos.length ? `NO SE VE en la página: ${motivos.join("; ")}` : "se ve en la página";
    const avisos = avisosProducto(p);
    return `- "${p.nombre}" · ${precio(p.precio, moneda)} · categoría: ${cat} · ${estado}${avisos.length ? ` · ojo: ${avisos.join(", ")}` : ""}`;
  };

  // Los ocultos primero (son los que generan dudas), después los más nuevos.
  const listados = [...ocultos, ...visibles.slice(0, Math.max(0, MAX_PRODUCTOS_LISTADOS - ocultos.length))]
    .slice(0, MAX_PRODUCTOS_LISTADOS);

  const conProductos = new Set(visibles.map(({ p }) => p.categoria_id));
  const catVacias = categorias.filter((c) => c.activo !== false && !conProductos.has(c.id)).map((c) => c.nombre);

  const problemas = [];
  if (neg.activo === false) problemas.push('La página del negocio está DESACTIVADA (nadie la ve). Se activa en "Negocios".');
  if (!neg.slug) problemas.push("El negocio no tiene dirección web (slug) todavía.");
  if (!modulos.productos) problemas.push('El módulo "Productos" está apagado: los productos no se muestran. Se prende en Configuración → Módulos.');
  if (!categorias.length) problemas.push('No hay ninguna categoría creada. Sin categoría los productos no aparecen: crear una en "Categorías".');
  if (cuenta && !estaVigente(cuenta)) problemas.push('La suscripción está vencida: hay que elegir un plan en "Suscripción".');
  const hc = cfg.horarios_config;
  if (!(Array.isArray(hc) && hc.some((d) => d && !d.cerrado && d.franjas?.length)) && !cfg.horarios)
    problemas.push("No cargó horarios (Configuración → Horarios).");
  if (!cfg.whatsapp) problemas.push("No cargó el número de WhatsApp del local (Configuración → Datos del local).");
  if (!cfg.logo_url) problemas.push("No subió el logo (Configuración → Datos del local).");
  if (modulos.pedidos && !cfg.retiro_activo && !cfg.delivery_activo && !cfg.mesas_activo && !cfg.modalidades?.mostrador && !cfg.modalidades?.envio)
    problemas.push("No tiene ninguna forma de entrega activa: los clientes no pueden pedir (Configuración → Entregas).");

  const plan = cuenta
    ? `Plan: ${planEfectivo(cuenta) || cuenta.tipo_plan || "sin plan"} · estado: ${ESTADO_PLAN[cuenta.estado_suscripcion] || cuenta.estado_suscripcion}${
        cuenta.periodo_fin ? ` · días restantes: ${diasRestantes(cuenta.periodo_fin)}` : ""
      }`
    : "Plan: no informado.";

  return `NEGOCIO: ${cfg.nombre || neg.nombre || "sin nombre"} (rubro: ${await nombreRubro(neg)})
Página pública: ${neg.slug ? `/negocio/${neg.slug}` : "sin dirección"} · ${neg.activo === false ? "DESACTIVADA" : "online"}
${plan}
Módulos prendidos: ${Object.entries(modulos).filter(([, v]) => v).map(([k]) => k).join(", ") || "ninguno"}
Formas de entrega: ${[cfg.mesas_activo && "mesa", cfg.retiro_activo && "retiro", cfg.delivery_activo && "delivery", cfg.modalidades?.mostrador && "mostrador", cfg.modalidades?.envio && "envío"].filter(Boolean).join(", ") || "ninguna"}
Horarios:
${textoHorarios(cfg)}
Pedidos pendientes ahora: ${pendR.count ?? 0}

CATEGORÍAS (${categorias.length}): ${categorias.map((c) => `${c.nombre}${c.activo === false ? " [DESACTIVADA]" : ""}`).join(", ") || "ninguna"}
${catVacias.length ? `Categorías activas sin productos visibles: ${catVacias.join(", ")}` : ""}

PRODUCTOS: ${productos.length} en total · ${visibles.length} se ven en la página · ${ocultos.length} no se ven
${listados.map(lineaProd).join("\n") || "(no hay productos cargados)"}
${productos.length > listados.length ? `(y ${productos.length - listados.length} productos más que se ven bien)` : ""}

PROBLEMAS DETECTADOS:
${problemas.map((x) => `- ${x}`).join("\n") || "- Ninguno."}`;
}

function armarPrompt(datos, nombreUsuario) {
  return `Sos DinexAI, el asistente de DinexFlow dentro del panel de administración. Ayudás al dueño o encargado del negocio${
    nombreUsuario ? ` (se llama ${nombreUsuario})` : ""
  } con dudas sobre su cuenta y sobre cómo usar el panel.

CÓMO RESPONDER
1. Español rioplatense, tuteo/voseo ("cargalo", "andá a"). Cálido y directo.
2. Corto: 1 a 4 oraciones o una lista breve de pasos. Sin saludos largos ni relleno.
3. Usá los DATOS DEL NEGOCIO de abajo para diagnosticar. Si te pregunta por algo concreto (un producto, una categoría), buscalo por nombre y decí exactamente qué pasa y cómo arreglarlo, nombrando la sección del panel.
4. No inventes datos, secciones ni funciones que no estén acá. Si no sabés o es un error técnico, sugerí reportarlo en "Soporte".
5. No podés hacer cambios en la cuenta: explicás qué tocar y dónde.
6. Podés usar **negrita** para nombres de secciones o botones. Nada de tablas ni títulos.
7. Si te piden algo que no tiene que ver con DinexFlow o con su negocio, respondé amablemente que sólo podés ayudar con el panel.
8. ${AVISO_DATOS_ACTUALES}

SECCIONES DEL PANEL
${GUIA_PANEL}

REGLAS PARA QUE UN PRODUCTO SE VEA EN LA PÁGINA PÚBLICA
- Tener una categoría asignada, y esa categoría estar activa.
- Estar marcado como "Disponible".
- Si controla stock, tener stock mayor a 0.
- El negocio tiene que estar activo y el módulo Productos prendido.
- Un precio en 0 o la falta de foto no lo ocultan, pero conviene corregirlos.

DATOS DEL NEGOCIO (actualizados a este momento)
${datos}`;
}

// Los datos se releen en cada mensaje, pero el modelo tiende a repetir lo que
// ya dijo en la conversación (QA: seguía diciendo "Productos está apagado"
// después de prenderlo). Va en las reglas y, si ya hubo respuestas, otra vez
// pegado al último mensaje del usuario (un segundo "system" a mitad de la
// conversación lo rechazan algunos modelos).
const AVISO_DATOS_ACTUALES =
  "Los DATOS DEL NEGOCIO se leen de nuevo en cada mensaje. Si contradicen algo que respondiste antes en esta conversación (el usuario pudo haberlo arreglado), mandan los datos: decí que ya está resuelto y no repitas lo anterior.";

// Deja sólo mensajes válidos del chat: roles user/assistant, texto recortado.
function limpiarMensajes(mensajes) {
  if (!Array.isArray(mensajes)) return [];
  const lista = mensajes
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_MENSAJES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_LARGO) }));
  // El historial arranca y termina con el usuario.
  while (lista.length && lista[0].role !== "user") lista.shift();
  return lista.length && lista[lista.length - 1].role === "user" ? lista : [];
}

async function responder({ negocioId, cuentaId, nombreUsuario, mensajes }) {
  const historial = limpiarMensajes(mensajes);
  if (!historial.length) {
    const err = new Error("Escribí tu pregunta.");
    err.status = 400;
    throw err;
  }
  const datos = await diagnostico(negocioId, cuentaId);
  const clave = claveDinexAI();
  if (!clave.startsWith("sk-or-")) {
    // OpenRouter responde "Missing Authentication header": no es una clave
    // secreta (p. ej. se pegó el ID de la clave en vez de la clave).
    console.warn(`[DinexAI] La clave no empieza con "sk-or-" (largo ${clave.length}). Copiá la clave secreta de OpenRouter en DINEXAI_API_KEY.`);
  }
  const system = armarPrompt(datos, nombreUsuario);
  const ultimo = historial[historial.length - 1];
  const conAviso = historial.some((m) => m.role === "assistant")
    ? [...historial.slice(0, -1), { role: "user", content: `[${AVISO_DATOS_ACTUALES}]\n\n${ultimo.content}` }]
    : historial;
  const pedir = (messages) =>
    llamarOpenRouter(
      // Margen para los modelos que "piensan" antes de responder.
      { messages, ...modeloDinexAI(), max_tokens: 1200, temperature: 0.2 },
      { apiKey: claveDinexAI() },
    );
  let msg;
  try {
    msg = await pedir([{ role: "system", content: system }, ...conAviso]);
  } catch (err) {
    // Clave inválida, sin crédito o saturado: reintentar no sirve.
    if ([401, 402, 429].includes(Number(err.status))) throw err;
    // Algunos modelos gratis (p. ej. Gemma) no aceptan instrucciones de
    // sistema: van pegadas al primer mensaje del usuario.
    console.warn(`[DinexAI] Falló con instrucciones de sistema (${err.message}); reintento sin ellas.`);
    const [primero, ...resto] = conAviso;
    msg = await pedir([{ role: "user", content: `${system}

--- PREGUNTA DEL ADMIN ---
${primero.content}` }, ...resto]);
  }
  return textoDe(msg) || "No pude armar una respuesta. ¿Me lo preguntás de otra forma?";
}

module.exports = { limpiarClave, dinexAIConfigurado, responder, diagnostico, motivosOculto, limpiarMensajes };
