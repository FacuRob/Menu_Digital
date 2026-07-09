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
  loading: "Cargando el menú…",
  defaultTitle: "Nuestro Menú",
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
  addToOrder: "Agregar al pedido",
  backToMenu: "Volver al menú",
  // Carrito
  deliveryTable: "En mesa",
  deliveryPickup: "Retiro en el local",
  deliveryDelivery: "Delivery",
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
  deliveryAddress: "Dirección de entrega *",
  addressPlaceholder: "Calle, número, piso, referencias…",
  phone: "Teléfono *",
  phonePlaceholder: "Para que puedan contactarte",
  total: "Total",
  sendWhatsApp: "Enviar por WhatsApp",
  successTitle: "¡Pedido enviado!",
  successSubtitle: "El local ya recibió tu pedido.",
  keepBrowsing: "Seguir viendo el menú",
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
  addToOrder: "Add to order",
  backToMenu: "Back to menu",
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
  deliveryAddress: "Delivery address *",
  addressPlaceholder: "Street, number, floor, notes…",
  phone: "Phone *",
  phonePlaceholder: "So they can contact you",
  total: "Total",
  sendWhatsApp: "Send via WhatsApp",
  successTitle: "Order sent!",
  successSubtitle: "The venue has received your order.",
  keepBrowsing: "Keep browsing the menu",
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
  addToOrder: "Adicionar ao pedido",
  backToMenu: "Voltar ao menu",
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
  deliveryAddress: "Endereço de entrega *",
  addressPlaceholder: "Rua, número, andar, referências…",
  phone: "Telefone *",
  phonePlaceholder: "Para que possam contatá-lo",
  total: "Total",
  sendWhatsApp: "Enviar pelo WhatsApp",
  successTitle: "Pedido enviado!",
  successSubtitle: "O local já recebeu seu pedido.",
  keepBrowsing: "Continuar vendo o menu",
  emptyCart: "Seu carrinho está vazio",
  emptyCartSub: "Adicione produtos pelo menu.",
  errEnterName: "Informe seu nome para continuar.",
  errChooseTable: "Escolha uma mesa.",
  errEnterAddress: "Informe o endereço de entrega.",
  errEnterPhone: "Informe seu telefone para que possam contatá-lo.",
  errSendFailed: "Não foi possível enviar o pedido. Tente novamente.",
};

const DICTS: Record<Lang, Dict> = { es, en, pt };

// ── Contexto ─────────────────────────────────────────────────
const detectLang = (): Lang => {
  const saved = localStorage.getItem("menu_lang");
  if (saved && saved in DICTS) return saved as Lang;
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return (nav in DICTS ? nav : "es") as Lang;
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("menu_lang", l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICTS[lang][key] ?? DICTS.es[key] ?? key;
      if (vars)
        for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
      return s;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
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
  const { lang, setLang } = useLang();
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        position: "relative",
        cursor: "pointer",
      }}
      title="Idioma / Language"
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{current.flag}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Idioma"
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          border: `1px solid ${dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.15)"}`,
          background: dark ? "rgba(0,0,0,0.25)" : "#fff",
          color: dark ? "#fff" : "#1c1917",
          borderRadius: 999,
          padding: "5px 26px 5px 10px",
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} style={{ color: "#1c1917" }}>
            {l.label}
          </option>
        ))}
      </select>
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke={dark ? "#fff" : "#1c1917"}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: "absolute", right: 9, pointerEvents: "none" }}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}
