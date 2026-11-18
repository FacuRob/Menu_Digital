import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// Idiomas soportados por el menú público.
export const LANGS = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
] as const;

export type Lang = (typeof LANGS)[number]["code"];

type Dict = Record<string, string>;

// ── Diccionarios ─────────────────────────────────────────────
// Sólo textos de la interfaz. El contenido del negocio (nombre de
// productos, descripciones) queda en el idioma que lo cargó el local.
const es: Dict = {
  // Menú general (todos los negocios de la cuenta)
  generalIntro: "Los menús de {n} negocios en un solo lugar. Cada pedido se hace a un solo negocio.",
  businesses: "Negocios",
  switchBizTitle: "¿Cambiar de negocio?",
  switchBizDesc: "Tu pedido tiene productos de {actual}. Cada pedido se hace a un solo negocio: para pedir en {nuevo} hay que vaciar tu pedido actual.",
  switchBizOk: "Vaciar pedido y pedir en {nuevo}",
  switchBizCancel: "Seguir con {actual}",
  loading: "Cargando el menú…",
  defaultTitle: "Nuestro Menú",
  notFoundTitle: "Menú no encontrado",
  notFoundDesc: "El local que buscás no existe o no está disponible.",
  notFound: "Página no encontrada",
  searchPlaceholder: "Buscar por productos",
  noResults: "No encontramos productos con esa búsqueda",
  preparingTitle: "Estamos preparando el menú 🍽️",
  preparingSubtitle: "Muy pronto vas a poder ver nuestros productos acá.",
  pricesIncludeTax: "Todos los precios incluyen IVA",
  madeWith: "Hecho con",
  contactChannels: "Nuestros canales de contacto",
  today: "Hoy",
  todaySuffix: "hoy",
  closedToday: "Cerrado hoy",
  schedule: "Horarios",
  closed: "Cerrado",
  ariaViewOrder: "Ver pedido",
  ariaAddToOrder: "Agregar al pedido",
  ariaScrollTop: "Ir arriba",
  ariaPrevCat: "Categoría anterior",
  ariaNextCat: "Categoría siguiente",
  day0: "Lunes",
  day1: "Martes",
  day2: "Miércoles",
  day3: "Jueves",
  day4: "Viernes",
  day5: "Sábado",
  day6: "Domingo",
  // Modal de producto
  back: "Volver",
  taxFree: "Sin impuestos nacionales: {v}",
  quantity: "Cantidad",
  weight: "Peso",
  howMuch: "¿Cuánto querés?",
  addToOrder: "Agregar al pedido",
  customizeTitle: "Personalizalo",
  missingFields: "Te falta completar: {lista}.",
  fieldMissing: "Completá este campo.",
  fileTooBig: "El archivo pesa más de {n} MB.",
  filePrivate: "Sólo lo ve el negocio.",
  removeFile: "Quitar",
  removeFileOf: "Quitar el archivo de {c}",
  colorNone: "Sin elegir",
  clearChoice: "Quitar",
  rangeBetween: "Entre {a} y {b}",
  rangeMin: "Mínimo {a}",
  rangeMax: "Máximo {b}",
  chooseFile: "Elegir archivo",
  changeFile: "Cambiar archivo",
  uploading: "Subiendo…",
  fileReady: "Listo: {n}",
  fileTypes: "Acepta: {t}. Hasta {n} MB.",
  file_imagen: "imágenes",
  file_pdf: "PDF",
  "file_3d": "STL, OBJ o 3MF",
  fileError: "No se pudo subir el archivo.",
  services: "Servicios",
  priceAsk: "A consultar",
  priceFrom: "Desde {p}",
  minutes: "{n} min",
  mod_presencial: "En el local",
  mod_domicilio: "A domicilio",
  mod_virtual: "Virtual",
  askService: "Consultar por WhatsApp",
  askInPlace: "Consultalo directamente en el local.",
  bookService: "Reservar turno",
  quoteService: "Pedir presupuesto",
  quoteTitle: "¿Necesitás algo a medida?",
  quoteSub: "Contanos qué buscás, sumá fotos o archivos de referencia y te respondemos con una cotización.",
  quoteCta: "Pedir presupuesto",
  noStock: "Sin stock",
  bookTitle: "¿Querés sacar turno?",
  bookSub: "Elegí el servicio, el día y el horario que te quede cómodo.",
  bookCta: "Ver horarios disponibles",
  // Vocabulario según el rubro: "clave@familia" reemplaza a "clave" fuera de
  // gastronomía (tienda = retail y genérico; servicios = peluquerías, etc.).
  "loading@tienda": "Cargando…",
  "defaultTitle@tienda": "Nuestro catálogo",
  "notFoundTitle@tienda": "Página no encontrada",
  "preparingTitle@tienda": "Estamos preparando el catálogo",
  "backToMenu@tienda": "Volver al catálogo",
  "keepBrowsing@tienda": "Seguir viendo el catálogo",
  "emptyCartSub@tienda": "Agregá productos desde el catálogo.",
  "loading@servicios": "Cargando…",
  "defaultTitle@servicios": "Nuestros servicios",
  "notFoundTitle@servicios": "Página no encontrada",
  "preparingTitle@servicios": "Estamos preparando nuestra página",
  "preparingSubtitle@servicios": "Muy pronto vas a poder ver lo que ofrecemos acá.",
  "searchPlaceholder@servicios": "Buscar servicios o productos",
  "noResults@servicios": "No encontramos resultados con esa búsqueda",
  "backToMenu@servicios": "Volver a la página",
  "keepBrowsing@servicios": "Seguir viendo la página",
  "emptyCartSub@servicios": "Sumá productos desde la página.",
  askServiceMsg: "Hola, quería consultar por el servicio: {s}",
  noOnlineOrders: "Este negocio no toma pedidos online. Consultá directamente para comprar.",
  askWhatsapp: "Consultar por WhatsApp",
  backToMenu: "Volver al menú",
  required: "Obligatorio",
  chooseRequired: "Elegí las opciones obligatorias",
  // Carrito
  deliveryTable: "En mesa",
  deliveryPickup: "Retiro en el local",
  deliveryDelivery: "Delivery",
  deliveryCounter: "En el mostrador",
  deliveryShipping: "Envío por correo",
  counterHint: "Pedís ahora y lo retirás en el mostrador cuando esté listo.",
  products: "Productos",
  shippingCost: "Envío",
  shippingFree: "Gratis",
  shippingCostOption: "Envío {m}",
  shippingCostOptionCash: "Envío {m}, en efectivo",
  shippingFreeOption: "Envío gratis",
  shippingCashNote: "El envío ({m}) se paga en efectivo al repartidor.",
  shippingMissingForFree: "Te faltan {m} para el envío gratis.",
  shippingFreeFrom: "Envío gratis desde {m}.",
  payTitle: "¿Cómo pagás?",
  payCash: "Efectivo",
  payCashSub: "Pagás al recibir el pedido",
  payTransfer: "Transferencia",
  payTransferSub: "A la cuenta del local",
  payWithHowMuch: "¿Con cuánto pagás? (opcional)",
  payWithPlaceholder: "Ej: 10000",
  payWithHint: "Dejalo vacío si pagás justo.",
  payChange: "Tu vuelto: {m}",
  payExact: "Pagás justo: {m}",
  payTooLow: "Poné al menos {m}, el total del pedido.",
  payTransferTo: "Transferí {m} a:",
  payAlias: "Alias",
  payCbu: "CBU / CVU",
  payHolder: "Titular",
  payBank: "Banco o billetera",
  payCopy: "Copiar",
  payCopied: "Copiado",
  payTransferNote: "Transferí y confirmá el pedido. El local revisa que haya llegado la plata.",
  payShippingCash: "El envío ({m}) lo pagás en efectivo al repartidor.",
  errChoosePay: "Elegí cómo vas a pagar.",
  payWho: "¿Quién hizo la transferencia? (opcional)",
  payWhoPlaceholder: "Si no fuiste vos, el nombre de quien transfirió",
  payReceipt: "Comprobante de la transferencia",
  payReceiptOptional: "Comprobante de la transferencia (opcional)",
  payReceiptHint: "Foto o PDF, hasta 10 MB.",
  payReceiptAttach: "Adjuntar comprobante",
  payReceiptChange: "Cambiar",
  payReceiptRemove: "Quitar",
  payReceiptUploading: "Subiendo…",
  payReceiptType: "El comprobante tiene que ser una foto o un PDF.",
  errReceiptMissing: "Adjuntá el comprobante de la transferencia.",
  shippingAddress: "Dirección completa para el envío",
  shippingAddressPlaceholder: "Calle y número, piso, ciudad, provincia y código postal",
  errEnterFullAddress: "Poné la dirección completa: calle, número, ciudad y código postal.",
  errChooseWhen: "Elegí el día y la hora.",
  errWhenTooSoon: "Elegí un horario con al menos 30 minutos de anticipación.",
  whenTitle: "¿Para cuándo?",
  whenAsap: "Lo antes posible",
  whenLater: "Programarlo para más tarde",
  whenDateTime: "Día y hora",
  whenHint: "Con al menos 30 minutos de anticipación y dentro del horario del local.",
  mod_visita: "Visita",
  orderSent: "Pedido enviado",
  howDoYouWantIt: "¿Cómo lo querés?",
  yourOrder: "Tu pedido",
  close: "Cerrar",
  remove: "Quitar",
  yourName: "Tu nombre *",
  namePlaceholder: "Ej: Juan",
  note: "Nota (opcional)",
  notePlaceholder: "Ej: sin sal, cocción a punto…",
  sending: "Enviando…",
  confirmOrder: "Confirmar pedido",
  continue: "Continuar",
  tableLabel: "Mesa *",
  chooseTable: "Elegí una mesa…",
  tableN: "Mesa {n}",
  scanTableQr: "Para pedir, escaneá el código QR de tu mesa.",
  tableFromQr: "Tu pedido va a la Mesa {n} (la del código QR que escaneaste).",
  deliveryAddress: "Dirección de entrega *",
  addressPlaceholder: "Calle, número, piso, referencias…",
  phone: "Teléfono *",
  phonePlaceholder: "Para que puedan contactarte",
  notifyWhatsapp: "Avisarme por WhatsApp cómo va mi pedido",
  notifyWhatsappSub: "Te escribimos cuando lo preparamos y cuando está listo o en camino.",
  total: "Total",
  sendWhatsApp: "Enviar por WhatsApp",
  successTitle: "¡Pedido enviado!",
  successSubtitle: "El local ya recibió tu pedido.",
  demoBanner: "Menú de ejemplo: podés probar todo, los pedidos no se envían.",
  demoBack: "Volver a DinexFlow",
  clearSearch: "Borrar búsqueda",
  less: "Uno menos",
  more: "Uno más",
  categories: "Categorías",
  demoSuccess: "Es un menú de ejemplo: el pedido no se envió a ningún lado. En tu carta le llega al local.",
  keepBrowsing: "Seguir viendo el menú",
  openNow: "Abierto ahora",
  closedNow: "Cerrado ahora",
  customizable: "Personalizable",
  viewOrder: "Ver pedido",
  orderCta: "Pedir",
  itemsN: "{n} productos",
  emptyCart: "Tu carrito está vacío",
  emptyCartSub: "Agregá productos desde el menú.",
  errEnterName: "Ingresá tu nombre para continuar.",
  errChooseTable: "Elegí una mesa.",
  errEnterAddress: "Ingresá la dirección de entrega.",
  errEnterPhone: "Ingresá tu teléfono para que puedan contactarte.",
  errSendFailed: "No se pudo enviar el pedido. Intentá de nuevo.",
};

const en: Dict = {
  loading: "Loading menu…",
  defaultTitle: "Our Menu",
  notFoundTitle: "Menu not found",
  notFoundDesc: "The place you're looking for doesn't exist or isn't available.",
  notFound: "Page not found",
  searchPlaceholder: "Search products",
  noResults: "No products found for that search",
  preparingTitle: "We're preparing the menu 🍽️",
  preparingSubtitle: "You'll be able to see our products here very soon.",
  pricesIncludeTax: "All prices include tax",
  madeWith: "Made with",
  contactChannels: "Our contact channels",
  today: "Today",
  todaySuffix: "today",
  closedToday: "Closed today",
  schedule: "Hours",
  closed: "Closed",
  ariaViewOrder: "View order",
  ariaAddToOrder: "Add to order",
  ariaScrollTop: "Back to top",
  ariaPrevCat: "Previous category",
  ariaNextCat: "Next category",
  day0: "Monday",
  day1: "Tuesday",
  day2: "Wednesday",
  day3: "Thursday",
  day4: "Friday",
  day5: "Saturday",
  day6: "Sunday",
  back: "Back",
  taxFree: "Before taxes: {v}",
  quantity: "Quantity",
  weight: "Weight",
  howMuch: "How much?",
  addToOrder: "Add to order",
  backToMenu: "Back to menu",
  required: "Required",
  chooseRequired: "Choose the required options",
  deliveryTable: "Dine-in",
  deliveryPickup: "Pickup",
  deliveryDelivery: "Delivery",
  orderSent: "Order sent",
  howDoYouWantIt: "How would you like it?",
  yourOrder: "Your order",
  close: "Close",
  remove: "Remove",
  yourName: "Your name *",
  namePlaceholder: "e.g. John",
  note: "Note (optional)",
  notePlaceholder: "e.g. no salt, medium cooked…",
  sending: "Sending…",
  confirmOrder: "Confirm order",
  continue: "Continue",
  tableLabel: "Table *",
  chooseTable: "Choose a table…",
  tableN: "Table {n}",
  scanTableQr: "To order, scan the QR code on your table.",
  tableFromQr: "Your order goes to Table {n} (the one on the QR code you scanned).",
  deliveryAddress: "Delivery address *",
  addressPlaceholder: "Street, number, floor, notes…",
  phone: "Phone *",
  phonePlaceholder: "So they can contact you",
  notifyWhatsapp: "Notify me on WhatsApp about my order",
  notifyWhatsappSub: "We will message you when it is being prepared and when it is ready or on its way.",
  total: "Total",
  sendWhatsApp: "Send via WhatsApp",
  successTitle: "Order sent!",
  successSubtitle: "The venue has received your order.",
  demoBanner: "Sample menu: try everything, orders aren't sent.",
  demoBack: "Back to DinexFlow",
  clearSearch: "Clear search",
  less: "One less",
  more: "One more",
  categories: "Categories",
  demoSuccess: "This is a sample menu: the order wasn't sent anywhere. On your menu it reaches the venue.",
  keepBrowsing: "Keep browsing the menu",
  openNow: "Open now",
  closedNow: "Closed now",
  customizable: "Customizable",
  viewOrder: "View order",
  orderCta: "Order",
  itemsN: "{n} items",
  emptyCart: "Your cart is empty",
  emptyCartSub: "Add products from the menu.",
  errEnterName: "Enter your name to continue.",
  errChooseTable: "Choose a table.",
  errEnterAddress: "Enter the delivery address.",
  errEnterPhone: "Enter your phone so they can contact you.",
  errSendFailed: "Couldn't send the order. Please try again.",
};

const pt: Dict = {
  loading: "Carregando o menu…",
  defaultTitle: "Nosso Menu",
  notFoundTitle: "Menu não encontrado",
  notFoundDesc: "O local que você procura não existe ou não está disponível.",
  notFound: "Página não encontrada",
  searchPlaceholder: "Buscar produtos",
  noResults: "Nenhum produto encontrado para essa busca",
  preparingTitle: "Estamos preparando o menu 🍽️",
  preparingSubtitle: "Em breve você poderá ver nossos produtos aqui.",
  pricesIncludeTax: "Todos os preços incluem impostos",
  madeWith: "Feito com",
  contactChannels: "Nossos canais de contato",
  today: "Hoje",
  todaySuffix: "hoje",
  closedToday: "Fechado hoje",
  schedule: "Horários",
  closed: "Fechado",
  ariaViewOrder: "Ver pedido",
  ariaAddToOrder: "Adicionar ao pedido",
  ariaScrollTop: "Ir para o topo",
  ariaPrevCat: "Categoria anterior",
  ariaNextCat: "Próxima categoria",
  day0: "Segunda",
  day1: "Terça",
  day2: "Quarta",
  day3: "Quinta",
  day4: "Sexta",
  day5: "Sábado",
  day6: "Domingo",
  back: "Voltar",
  taxFree: "Sem impostos: {v}",
  quantity: "Quantidade",
  weight: "Peso",
  howMuch: "Quanto você quer?",
  addToOrder: "Adicionar ao pedido",
  backToMenu: "Voltar ao menu",
  required: "Obrigatório",
  chooseRequired: "Escolha as opções obrigatórias",
  deliveryTable: "Na mesa",
  deliveryPickup: "Retirada no local",
  deliveryDelivery: "Delivery",
  orderSent: "Pedido enviado",
  howDoYouWantIt: "Como você quer?",
  yourOrder: "Seu pedido",
  close: "Fechar",
  remove: "Remover",
  yourName: "Seu nome *",
  namePlaceholder: "Ex: João",
  note: "Observação (opcional)",
  notePlaceholder: "Ex: sem sal, ao ponto…",
  sending: "Enviando…",
  confirmOrder: "Confirmar pedido",
  continue: "Continuar",
  tableLabel: "Mesa *",
  chooseTable: "Escolha uma mesa…",
  tableN: "Mesa {n}",
  scanTableQr: "Para pedir, escaneie o QR da sua mesa.",
  tableFromQr: "Seu pedido vai para a Mesa {n} (a do QR que você escaneou).",
  deliveryAddress: "Endereço de entrega *",
  addressPlaceholder: "Rua, número, andar, referências…",
  phone: "Telefone *",
  phonePlaceholder: "Para que possam contatá-lo",
  notifyWhatsapp: "Me avise pelo WhatsApp sobre o meu pedido",
  notifyWhatsappSub: "Escrevemos quando estiver em preparo e quando estiver pronto ou a caminho.",
  total: "Total",
  sendWhatsApp: "Enviar pelo WhatsApp",
  successTitle: "Pedido enviado!",
  successSubtitle: "O local já recebeu seu pedido.",
  demoBanner: "Menu de exemplo: teste tudo, os pedidos não são enviados.",
  demoBack: "Voltar ao DinexFlow",
  clearSearch: "Limpar busca",
  less: "Um a menos",
  more: "Um a mais",
  categories: "Categorias",
  demoSuccess: "Este é um menu de exemplo: o pedido não foi enviado. No seu menu, ele chega ao local.",
  keepBrowsing: "Continuar vendo o menu",
  openNow: "Aberto agora",
  closedNow: "Fechado agora",
  customizable: "Personalizável",
  viewOrder: "Ver pedido",
  orderCta: "Pedir",
  itemsN: "{n} produtos",
  emptyCart: "Seu carrinho está vazio",
  emptyCartSub: "Adicione produtos pelo menu.",
  errEnterName: "Informe seu nome para continuar.",
  errChooseTable: "Escolha uma mesa.",
  errEnterAddress: "Informe o endereço de entrega.",
  errEnterPhone: "Informe seu telefone para que possam contatá-lo.",
  errSendFailed: "Não foi possível enviar o pedido. Tente novamente.",
};

const DICTS: Record<Lang, Dict> = { es, en, pt };

// Por ahora todo el sistema va en español: sin selector y sin detectar el
// idioma del navegador. Las traducciones quedan para reactivarlo a futuro.
export const MULTI_IDIOMA = false;

// ── Contexto ─────────────────────────────────────────────────
const detectLang = (): Lang => {
  if (!MULTI_IDIOMA) return "es";
  const saved = localStorage.getItem("menu_lang");
  if (saved && saved in DICTS) return saved as Lang;
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return (nav in DICTS ? nav : "es") as Lang;
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  // Rubro del negocio que se está viendo (cambia "menú" por "catálogo"…).
  setRubro: (r: string | null) => void;
}

const FAMILIA: Record<string, string> = { retail: "tienda", generico: "tienda", servicios: "servicios" };

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(detectLang);
  const [familia, setFamilia] = useState<string | null>(null);
  const setRubro = useCallback((r: string | null) => setFamilia((r && FAMILIA[r]) || null), []);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("menu_lang", l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const fk = familia ? `${key}@${familia}` : "";
      let s = (fk && (DICTS[lang][fk] ?? DICTS.es[fk])) || DICTS[lang][key] || DICTS.es[key] || key;
      if (vars)
        for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    [lang, familia],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, setRubro }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLang debe usarse dentro de LanguageProvider");
  return ctx;
};

// ── Selector de idioma (desplegable compacto) ────────────────
export function LangSelector({ dark = false }: { dark?: boolean }) {
  // dark: sobre un bloque de color; toma el color del texto que lo rodea.
  const { lang, setLang } = useLang();
  if (!MULTI_IDIOMA) return null;
  return (
    <label
      style={{ display: "inline-flex", alignItems: "center", position: "relative", cursor: "pointer" }}
      title="Idioma / Language"
    >
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Idioma"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          border: "none",
          boxShadow: `inset 0 0 0 1.5px ${dark ? "color-mix(in srgb, currentColor 45%, transparent)" : "rgba(0,0,0,0.15)"}`,
          background: dark ? "transparent" : "#fff",
          color: dark ? "inherit" : "#1c1917",
          borderRadius: 999,
          minHeight: 44,
          padding: "0 30px 0 14px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} style={{ color: "#1c1917", background: "#fff" }}>
            {l.label}
          </option>
        ))}
      </select>
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        style={{ position: "absolute", right: 11, pointerEvents: "none", color: dark ? "inherit" : "#1c1917" }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
