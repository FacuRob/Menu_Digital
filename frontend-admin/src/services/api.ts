import axios from "axios";

// En dev usamos "/api" (proxy de Vite → localhost:5000).
// En producción se define VITE_API_URL con la URL del backend.
const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Pedidos al servidor en curso. La pantalla de carga del panel espera a que
// lleguen en 0 para mostrar la sección con sus datos ya cargados.
let pendientes = 0;
export const apiPendientes = () => pendientes;
const terminar = () => {
  pendientes = Math.max(0, pendientes - 1);
};

api.interceptors.request.use(
  (config) => {
    pendientes++;
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Negocio activo (multi-tenant). Por defecto 1.
    const negocio = localStorage.getItem("negocio_id");
    config.headers["X-Negocio-Id"] = negocio || "1";
    return config;
  },
  (error) => Promise.reject(error),
);

// Suscripción vencida (402): el backend bloquea los datos del panel. Redirigir
// a la página de suscripción para que el usuario elija/renueve un plan.
api.interceptors.response.use(
  (r) => {
    terminar();
    return r;
  },
  (error) => {
    terminar();
    const data = error?.response?.data as { error?: string } | undefined;
    if (
      error?.response?.status === 402 &&
      data?.error === "SUSCRIPCION_VENCIDA" &&
      !window.location.pathname.includes("/admin/suscripcion")
    ) {
      window.location.assign("/admin/suscripcion");
    }
    return Promise.reject(error);
  },
);

// Extrae el mensaje de error que manda el backend (p. ej. límites 403),
// con un fallback genérico si la respuesta no trae detalle.
export function getApiErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as
      | { message?: string; error?: string }
      | undefined;
    return data?.message || data?.error || fallback;
  }
  return fallback;
}

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen_url: string | null;
  categoria_id: number;
  categoria_nombre?: string;
  disponible: boolean;
  orden: number;
  costo?: number;
  stock?: number;
  controlar_stock?: boolean;
  // "kg": precio por kilo y stock en kg. Sin el campo (migración pendiente) = unidad.
  unidad_venta?: "unidad" | "kg";
  negocio_id?: number;
  sku?: string | null;
  atributos?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// Multi-rubro: variantes/modificadores (talles, colores, extras…).
export interface VarianteOpcion {
  id?: number;
  nombre: string;
  precio_extra: number;
  stock?: number | null;
  activo?: boolean;
  orden?: number;
}
export interface VarianteGrupo {
  id: number;
  producto_id: number;
  nombre: string;
  tipo: "single" | "multi";
  obligatorio: boolean;
  orden: number;
  opciones: VarianteOpcion[];
}
export interface VarianteGrupoInput {
  nombre: string;
  tipo: "single" | "multi";
  obligatorio: boolean;
  orden?: number;
  opciones: VarianteOpcion[];
}

export interface Usuario {
  id: number;
  username: string;
  nombre: string | null;
  email?: string | null;
  rol: string;
  activo: boolean;
  permisos: string[];
  must_change_password?: boolean;
  cuenta_id?: number;
  es_plataforma?: boolean;
  created_at?: string;
  // Verificación en dos pasos (2FA) activa.
  totp_activo?: boolean;
}

export interface RolPermiso {
  rol: string;
  permisos: string[];
  descripcion: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: Usuario;
  // Presente en signup/google: true si se acaba de crear la cuenta (→ onboarding).
  nuevo?: boolean;
}

// Con 2FA activo, /login y /google no dan sesión: piden el código.
export interface Requiere2fa {
  requiere_2fa: true;
  desafio: string;
}
export const pide2fa = (r: LoginResponse | Requiere2fa): r is Requiere2fa =>
  "requiere_2fa" in r && r.requiere_2fa === true;

export interface UploadResponse {
  url: string;
  public_id: string;
}

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post<LoginResponse | Requiere2fa>("/auth/login", {
      username,
      password,
    });
    return response.data;
  },
  signup: async (negocio: string, email: string, password: string) => {
    const response = await api.post<LoginResponse>("/auth/signup", {
      negocio,
      email,
      password,
    });
    return response.data;
  },
  google: async (credential: string) => {
    const response = await api.post<LoginResponse | Requiere2fa>("/auth/google", {
      credential,
    });
    return response.data;
  },
  verify: async () => {
    const response = await api.get("/auth/verify");
    return response.data;
  },
  forgotPassword: async (username: string) => {
    const response = await api.post("/auth/forgot-password", { username });
    return response.data;
  },
  resetPassword: async (token: string, newPassword: string) => {
    const response = await api.post("/auth/reset-password", {
      token,
      newPassword,
    });
    return response.data;
  },
  // currentPassword: obligatoria salvo en el cambio forzado (contraseña temporal).
  changePassword: async (newPassword: string, currentPassword?: string) => {
    const response = await api.post<LoginResponse>("/auth/change-password", {
      newPassword,
      ...(currentPassword ? { currentPassword } : {}),
    });
    return response.data;
  },
  // Las acciones de "Mi cuenta" devuelven un token nuevo + el usuario al día.
  updateProfile: async (data: { nombre?: string | null; username?: string }) => {
    const response = await api.put<LoginResponse>("/auth/profile", data);
    return response.data;
  },
  // ── Verificación en dos pasos ──
  verificar2fa: async (desafio: string, codigo: string) =>
    (await api.post<LoginResponse>("/auth/2fa/verificar", { desafio, codigo })).data,
  iniciar2fa: async () =>
    (await api.post<{ secreto: string; otpauth: string }>("/auth/2fa/iniciar")).data,
  activar2fa: async (codigo: string) =>
    (await api.post<{ codigos: string[] }>("/auth/2fa/activar", { codigo })).data,
  desactivar2fa: async (codigo: string) =>
    (await api.post("/auth/2fa/desactivar", { codigo })).data,
  changeEmail: async (email: string, currentPassword: string) => {
    const response = await api.put<LoginResponse>("/auth/email", {
      email,
      currentPassword,
    });
    return response.data;
  },
};

export const categoriasService = {
  getAll: async () => (await api.get<Categoria[]>("/categorias")).data,
  getActivas: async () =>
    (await api.get<Categoria[]>("/categorias/activas")).data,
  getById: async (id: number) =>
    (await api.get<Categoria>(`/categorias/${id}`)).data,
  create: async (c: Omit<Categoria, "id" | "created_at" | "updated_at">) =>
    (await api.post<Categoria>("/categorias", c)).data,
  update: async (
    id: number,
    c: Omit<Categoria, "id" | "created_at" | "updated_at">,
  ) => (await api.put<Categoria>(`/categorias/${id}`, c)).data,
  delete: async (id: number) => (await api.delete(`/categorias/${id}`)).data,
};

export const productosService = {
  getAll: async () => (await api.get<Producto[]>("/productos")).data,
  getStockBajo: async () =>
    (await api.get<{ id: number; nombre: string; stock: number }[]>(
      "/productos/stock-bajo",
    )).data,
  getDisponibles: async () =>
    (await api.get<Producto[]>("/productos/disponibles")).data,
  getByCategoria: async (id: number) =>
    (await api.get<Producto[]>(`/productos/categoria/${id}`)).data,
  getById: async (id: number) =>
    (await api.get<Producto>(`/productos/${id}`)).data,
  create: async (
    p: Omit<Producto, "id" | "created_at" | "updated_at" | "categoria_nombre">,
  ) => (await api.post<Producto>("/productos", p)).data,
  update: async (
    id: number,
    p: Omit<Producto, "id" | "created_at" | "updated_at" | "categoria_nombre">,
  ) => (await api.put<Producto>(`/productos/${id}`, p)).data,
  delete: async (id: number) => (await api.delete(`/productos/${id}`)).data,
};

export const variantesService = {
  getByProducto: async (productoId: number) =>
    (await api.get<VarianteGrupo[]>(`/variantes/producto/${productoId}`)).data,
  createGrupo: async (productoId: number, g: VarianteGrupoInput) =>
    (await api.post<VarianteGrupo>(`/variantes/producto/${productoId}`, g)).data,
  updateGrupo: async (grupoId: number, g: Partial<VarianteGrupoInput>) =>
    (await api.put<VarianteGrupo>(`/variantes/grupo/${grupoId}`, g)).data,
  deleteGrupo: async (grupoId: number) =>
    (await api.delete(`/variantes/grupo/${grupoId}`)).data,
};

export const uploadService = {
  uploadImagen: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append("imagen", file);
    return (
      await api.post<UploadResponse>("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
  deleteImagen: async (public_id: string) => {
    await api.delete("/upload", { data: { public_id } });
  },
};

export const usuariosService = {
  getAll: async () => (await api.get<Usuario[]>("/usuarios")).data,
  getById: async (id: number) =>
    (await api.get<Usuario>(`/usuarios/${id}`)).data,
  getRoles: async () => (await api.get<RolPermiso[]>("/usuarios/roles")).data,
  create: async (u: {
    username: string;
    password: string;
    nombre?: string;
    rol: string;
  }) => (await api.post<Usuario>("/usuarios", u)).data,
  update: async (
    id: number,
    u: { nombre?: string; rol?: string; activo?: boolean },
  ) => (await api.put<Usuario>(`/usuarios/${id}`, u)).data,
  cambiarPassword: async (id: number, password: string) =>
    (await api.put(`/usuarios/${id}/password`, { password })).data,
  delete: async (id: number) => (await api.delete(`/usuarios/${id}`)).data,
};

export interface FranjaHoraria {
  desde: string;
  hasta: string;
}
export interface DiaHorario {
  cerrado: boolean;
  franjas: FranjaHoraria[];
}
export type HorariosConfig = DiaHorario[]; // 0=Lunes … 6=Domingo

export interface Configuracion {
  id: number;
  nombre: string;
  // Slug del negocio (para la URL pública /menu/:slug).
  slug?: string | null;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  horarios: string | null;
  logo_url: string | null;
  portada_url: string | null;
  mesas_activo: boolean;
  mesas_cantidad: number;
  delivery_activo: boolean;
  retiro_activo: boolean;
  color_primario?: string | null;
  horarios_config?: HorariosConfig | null;
  moneda?: string | null;
  // Multi-rubro (viven en `negocios`, se editan desde Configuración).
  tipo_rubro?: TipoRubro;
  config_campos?: Record<string, unknown>;
}

export type TipoRubro = "gastronomia" | "retail" | "servicios" | "generico";

export type TipoEntrega = "mesa" | "retiro" | "delivery";

export interface PedidoItem {
  id?: number;
  producto_id: number | null;
  nombre: string;
  precio_unit: number;
  cantidad: number; // en kg si unidad = "kg"
  subtotal: number;
  unidad?: "unidad" | "kg";
}

export interface Pedido {
  id: number;
  mesa: string | null;
  cliente: string | null;
  nota: string | null;
  total: number;
  estado: "pendiente" | "preparando" | "listo" | "en_camino" | "entregado" | "cancelado";
  tipo_entrega?: TipoEntrega | null;
  direccion_entrega?: string | null;
  telefono_cliente?: string | null;
  acepta_whatsapp?: boolean;
  created_at?: string;
  updated_at?: string;
  items?: PedidoItem[];
}

export interface NuevoPedidoItem {
  producto_id: number | null;
  nombre: string;
  precio: number;
  cantidad: number;
}

export const configuracionService = {
  get: async () => (await api.get<Configuracion>("/configuracion")).data,
  update: async (c: Partial<Configuracion>) =>
    (await api.put<Configuracion>("/configuracion", c)).data,
};

export const pedidosService = {
  create: async (payload: {
    mesa?: string | null;
    cliente?: string | null;
    nota?: string | null;
    tipo_entrega?: TipoEntrega | null;
    direccion_entrega?: string | null;
    telefono_cliente?: string | null;
    items: NuevoPedidoItem[];
  }) => (await api.post<Pedido>("/pedidos", payload)).data,
  getAll: async (params?: { estado?: string; mesa?: string; vista?: "curso" | "historial" }) =>
    (await api.get<Pedido[]>("/pedidos", { params })).data,
  // Historial paginado: entregados y cancelados de un período.
  getPagina: async (params: {
    vista?: "curso" | "historial";
    estado?: string;
    mesa?: string;
    desde?: string;
    hasta?: string;
    limit: number;
    offset: number;
  }) => (await api.get<{ pedidos: Pedido[]; total: number }>("/pedidos", { params })).data,
  // Sólo pedidos cancelados (el backend rechaza el resto).
  delete: async (id: number) => (await api.delete(`/pedidos/${id}`)).data,
  getById: async (id: number) =>
    (await api.get<Pedido>(`/pedidos/${id}`)).data,
  updateEstado: async (id: number, estado: Pedido["estado"]) =>
    (await api.put<Pedido>(`/pedidos/${id}/estado`, { estado })).data,
};

export interface Negocio {
  id: number;
  nombre: string;
  slug: string | null;
  activo: boolean;
  tipo_rubro?: TipoRubro;
  created_at?: string;
}

export const negociosService = {
  getAll: async () => (await api.get<Negocio[]>("/negocios")).data,
  create: async (payload: { nombre: string; slug?: string; tipo_rubro?: TipoRubro }) =>
    (await api.post<Negocio>("/negocios", payload)).data,
  update: async (
    id: number,
    payload: { nombre?: string; slug?: string; activo?: boolean; tipo_rubro?: TipoRubro },
  ) => (await api.put<Negocio>(`/negocios/${id}`, payload)).data,
  delete: async (id: number) =>
    (await api.delete(`/negocios/${id}`)).data,
};

export interface ResumenMes {
  key: string;
  label: string;
  ventas: number;
  costo: number;
  ganancia: number;
  pedidos: number;
}

export interface Resumen {
  meses: ResumenMes[];
  mes_actual: { ventas: number; costo: number; ganancia: number; pedidos: number };
  top_productos: { nombre: string; ganancia: number; cantidad: number }[];
  stock_bajo: { id: number; nombre: string; stock: number }[];
}

export interface HistorialMes extends ResumenMes {
  anio: number;
}

export interface Historial {
  desde: string; // YYYY-MM
  hasta: string; // YYYY-MM
  tipo: TipoEntrega | null;
  meses: HistorialMes[];
  totales: { ventas: number; costo: number; ganancia: number; pedidos: number };
  top_productos: { nombre: string; ventas: number; ganancia: number; cantidad: number }[];
}

export interface ActividadDia {
  fecha: string; // YYYY-MM-DD (hora de Argentina)
  ventas: number;
  ganancia: number;
  pedidos: number;
}

export interface Actividad {
  desde: string;
  hasta: string;
  dias: number;
  serie: ActividadDia[];
  totales: { ventas: number; ganancia: number; pedidos: number; ticket: number };
  anterior: { ventas: number; ganancia: number; pedidos: number };
  serie_anterior: number[];
  por_tipo: { tipo: TipoEntrega; pedidos: number; ventas: number }[];
  estados: Record<string, number>;
  horas: number[][]; // [día de la semana (lunes = 0)][hora 0-23] = pedidos
  hoy: { pedidos: number; pendientes: number; ventas: number };
  recientes: {
    id: number;
    total: number;
    estado: string;
    tipo_entrega: TipoEntrega | null;
    mesa?: string | number | null;
    created_at: string;
    items: number;
  }[];
}

export const analiticasService = {
  getActividad: async (dias: 7 | 30 | 90) =>
    (await api.get<Actividad>("/analiticas/actividad", { params: { dias } })).data,
  getResumen: async () => (await api.get<Resumen>("/analiticas/resumen")).data,
  getHistorial: async (params: { desde: string; hasta: string; tipo?: TipoEntrega | "" }) =>
    (
      await api.get<Historial>("/analiticas/historial", {
        params: { desde: params.desde, hasta: params.hasta, tipo: params.tipo || undefined },
      })
    ).data,
};

export type TipoPlan = "free" | "basic" | "standard" | "premium";

export interface PlanInfo {
  tipo_plan: TipoPlan;
  estado_suscripcion: "activo" | "cancelado";
  limite_negocios: number;
  negocios_usados: number;
  limite_productos: number;
  productos_usados: number;
}

// Firmas de los QR por mesa: la URL lleva ?mesa=N&t=<firma> y el backend
// sólo acepta pedidos "en mesa" con una firma válida.
export const qrService = {
  mesas: async () =>
    (await api.get<{ mesas: { mesa: string; t: string }[] }>("/qr/mesas")).data.mesas,
  // Anula todos los QR de mesa impresos del negocio y devuelve las firmas nuevas.
  regenerar: async () =>
    (await api.post<{ mesas: { mesa: string; t: string }[] }>("/qr/regenerar")).data.mesas,
};

export const planService = {
  get: async () => (await api.get<PlanInfo>("/plan")).data,
};

// ── Panel de plataforma (sólo dueño del SaaS · es_plataforma) ──
export interface Cuenta {
  id: number;
  nombre: string;
  email: string | null;
  tipo_plan: TipoPlan;
  estado_suscripcion: "activo" | "cancelado";
  limite_negocios: number;
  limite_productos: number;
  origen: string | null;
  created_at?: string;
  suscripcion_actualizada_at?: string;
  negocios_count: number;
  usuarios_count: number;
  productos_count: number;
}

export interface PlataformaResumen {
  total_cuentas: number;
  activas: number;
  canceladas: number;
  por_pago: number;
  por_plan: { free: number; basic: number; standard: number; premium: number };
  total_negocios: number;
  moneda: string;
  mrr: number;
  mrr_por_plan: { basic: number; standard: number; premium: number };
  precios: {
    moneda: string;
    mensual: { free: number; basic: number; standard: number; premium: number };
  };
}

export const plataformaService = {
  getCuentas: async () =>
    (await api.get<Cuenta[]>("/plataforma/cuentas")).data,
  getResumen: async () =>
    (await api.get<PlataformaResumen>("/plataforma/resumen")).data,
};

// ── Suscripción (Mercado Pago, mensual en ARS + prueba gratis) ──
export type EstadoSuscripcion = "trial" | "activo" | "cancelado" | "vencido";

export interface PlanCatalogo {
  code: "basic" | "standard" | "premium";
  precio_mensual: number;
  limites: { negocios: number; productos: number };
}

export interface SuscripcionEstado {
  es_plataforma: boolean;
  tipo_plan: TipoPlan;
  estado_suscripcion: EstadoSuscripcion;
  vigente: boolean;
  periodo_fin: string | null;
  dias_restantes: number | null;
  creado_at?: string;
  moneda: string;
  trial_dias: number;
  portal_url: string;
  planes: PlanCatalogo[];
}

export const suscripcionService = {
  get: async () => (await api.get<SuscripcionEstado>("/suscripcion")).data,
  checkout: async (plan: PlanCatalogo["code"]) =>
    (await api.get<{ url: string }>(`/suscripcion/checkout/${plan}`)).data,
};

// ── Avisos de pedido por WhatsApp ──────────────────────────────
export type EstadoAviso = "pendiente" | "preparando" | "en_camino" | "listo" | "entregado" | "cancelado";

export interface AvisosWhatsapp {
  conectado: boolean;
  activo: boolean;
  estados: Record<EstadoAviso, boolean>;
  avisos: { estado: EstadoAviso; plantilla: string; texto: string }[];
}

export interface MensajeWhatsapp {
  id: number;
  pedido_id: number | null;
  telefono: string;
  aviso: EstadoAviso | "prueba" | null;
  estado: "enviado" | "entregado" | "leido" | "fallido";
  error: string | null;
  created_at: string;
}

export const whatsappService = {
  getAvisos: async () => (await api.get<AvisosWhatsapp>("/whatsapp/avisos")).data,
  updateAvisos: async (p: { activo?: boolean; estados?: Partial<Record<EstadoAviso, boolean>> }) =>
    (await api.put<Pick<AvisosWhatsapp, "activo" | "estados">>("/whatsapp/avisos", p)).data,
  getMensajes: async () => (await api.get<MensajeWhatsapp[]>("/whatsapp/mensajes")).data,
  prueba: async (telefono: string) =>
    (await api.post<{ message: string }>("/whatsapp/prueba", { telefono })).data,
};

// ── Chats de WhatsApp (Fase 2) ─────────────────────────────────
export interface ChatWhatsapp {
  id: number;
  telefono: string;
  nombre: string | null;
  ultimo_texto: string | null;
  ultimo_at: string | null;
  ultimo_entrante_at: string | null;
  no_leidos: number;
  puede_responder: boolean;
  // Fase 3: la IA no responde en este chat (pausa manual, respondió una
  // persona o la IA lo derivó).
  ia_pausada?: boolean;
  necesita_humano?: boolean;
}

export interface MensajeChat {
  id: number;
  direccion: "entrante" | "saliente";
  autor?: "negocio" | "ia" | "aviso" | null;
  texto: string | null;
  aviso: EstadoAviso | "prueba" | null;
  plantilla: string | null;
  estado: "enviado" | "entregado" | "leido" | "fallido" | "recibido";
  error: string | null;
  pedido_id: number | null;
  created_at: string;
}

export const chatsService = {
  listar: async () =>
    (await api.get<{ conectado: boolean; ia_activa: boolean; chats: ChatWhatsapp[] }>("/whatsapp/chats")).data,
  mensajes: async (id: number) =>
    (await api.get<{ chat: ChatWhatsapp; mensajes: MensajeChat[] }>(`/whatsapp/chats/${id}/mensajes`)).data,
  enviar: async (id: number, texto: string) =>
    (await api.post<MensajeChat>(`/whatsapp/chats/${id}/mensajes`, { texto })).data,
  resumen: async () =>
    (await api.get<{ no_leidos: number; atender: number }>("/whatsapp/chats/resumen")).data,
  cambiarIA: async (id: number, activa: boolean) =>
    (await api.patch<ChatWhatsapp>(`/whatsapp/chats/${id}/ia`, { activa })).data,
};

// ── Asistente con IA (Fase 3) ──────────────────────────────────
export interface ConfigIA {
  configurada: boolean; // el servidor tiene la clave de OpenRouter
  activo: boolean;
  instrucciones: string;
}

export const iaService = {
  get: async () => (await api.get<ConfigIA>("/whatsapp/ia")).data,
  update: async (p: { activo?: boolean; instrucciones?: string }) =>
    (await api.put<Pick<ConfigIA, "activo" | "instrucciones">>("/whatsapp/ia", p)).data,
};

export default api;
