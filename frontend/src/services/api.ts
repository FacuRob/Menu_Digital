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

// Negocio del menú público. Se resuelve desde la URL:
//   - /menu/:slug  → se resuelve el slug a un id (ver setNegocioActivo).
//   - /menu?negocio=<id>  → compatibilidad con el esquema viejo.
// Por defecto queda vacío (el backend cae al negocio 1).
let negocioActivo =
  new URLSearchParams(window.location.search).get("negocio") || "";

// Fija el negocio activo (lo llama el menú tras resolver el slug).
export const setNegocioActivo = (id: number | string) => {
  negocioActivo = String(id);
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Una llamada puede pedir otro negocio a propósito (menú general).
    if (negocioActivo && config.params?.negocio == null) {
      config.params = { ...(config.params || {}), negocio: negocioActivo };
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Negocio público resuelto por slug (datos no sensibles).
export interface NegocioPublico {
  id: number;
  nombre: string;
  slug: string | null;
}

export const negociosPublicoService = {
  // Resuelve /menu/:slug → { id, nombre, slug }. Lanza 404 si no existe.
  getBySlug: async (slug: string) =>
    (await api.get<NegocioPublico>(`/negocios/publico/${encodeURIComponent(slug)}`))
      .data,
  // Menú general (/menu/:slug/todos): todos los negocios activos de la cuenta.
  getGrupo: async (slug: string) =>
    (
      await api.get<{ nombre: string; negocios: NegocioPublico[] }>(
        `/negocios/publico/${encodeURIComponent(slug)}/grupo`,
      )
    ).data,
};

// Parámetro para leer los datos de un negocio puntual (menú general).
const delNegocio = (negocio?: number) => (negocio ? { params: { negocio } } : undefined);

export interface Categoria {
  id: number;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Multi-rubro: variantes/modificadores (talles, colores, extras…).
export interface VarianteOpcion {
  id: number;
  nombre: string;
  precio_extra: number;
  stock?: number | null;
}
// Campo que completa el cliente para personalizar un producto.
export interface CampoProducto {
  id: number;
  tipo: "texto" | "texto_largo" | "numero" | "opcion" | "multiple" | "color" | "archivo";
  etiqueta: string;
  ayuda?: string | null;
  opciones: string[];
  obligatorio: boolean;
  orden: number;
  validaciones: { max_largo?: number; min?: number; max?: number; tipos?: ("imagen" | "pdf" | "3d")[] };
}

// Servicio del negocio (corte, instalación, consultoría…).
export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  categoria: string | null;
  tipo_precio: "fijo" | "desde" | "variable";
  precio: number | null;
  duracion_min: number | null;
  modalidades: ("presencial" | "domicilio" | "virtual")[];
  requiere_turno: boolean;
  requiere_presupuesto: boolean;
}

// Mensaje de error del backend (o el de respaldo).
export const getErrorMessage = (e: unknown, respaldo: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || respaldo;

export interface VarianteGrupo {
  id: number;
  nombre: string;
  tipo: "single" | "multi";
  obligatorio: boolean;
  orden: number;
  opciones: VarianteOpcion[];
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen_url: string | null;
  // Todas las fotos en orden (la primera = imagen_url). Puede faltar.
  imagenes?: string[] | null;
  categoria_id: number;
  categoria_nombre?: string;
  disponible: boolean;
  orden: number;
  costo?: number;
  stock?: number;
  controlar_stock?: boolean;
  // "kg": precio por kilo; la cantidad del pedido va en kg (0.35 = 350 g).
  unidad_venta?: "unidad" | "kg";
  negocio_id?: number;
  sku?: string | null;
  atributos?: Record<string, unknown>;
  variantes?: VarianteGrupo[];
  // Campos de personalización (si el negocio personaliza productos).
  campos?: CampoProducto[];
  created_at?: string;
  updated_at?: string;
}

export interface Usuario {
  id: number;
  username: string;
  nombre: string | null;
  rol: string;
  activo: boolean;
  permisos: string[];
  must_change_password?: boolean;
  created_at?: string;
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
}

export interface UploadResponse {
  url: string;
  public_id: string;
}

export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post<LoginResponse>("/auth/login", {
      username,
      password,
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
  changePassword: async (newPassword: string) => {
    const response = await api.post("/auth/change-password", { newPassword });
    return response.data;
  },
};

export const categoriasService = {
  getAll: async () => (await api.get<Categoria[]>("/categorias")).data,
  getActivas: async (negocio?: number) =>
    (await api.get<Categoria[]>("/categorias/activas", delNegocio(negocio))).data,
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
  getDisponibles: async (negocio?: number) =>
    (await api.get<Producto[]>("/productos/disponibles", delNegocio(negocio))).data,
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

export const serviciosService = {
  getDisponibles: async (negocio?: number) =>
    (await api.get<Servicio[]>("/servicios/disponibles", delNegocio(negocio))).data,
};

// ── Presupuestos y turnos (páginas públicas) ──
export type EstadoPresupuesto = "pendiente" | "en_revision" | "cotizado" | "aceptado" | "rechazado" | "convertido" | "cancelado";
export interface PresupuestoCliente {
  id: number;
  estado: EstadoPresupuesto;
  referencia: string | null;
  descripcion: string;
  cantidad: number;
  medidas: string | null;
  precio_cotizado: number | null;
  observaciones: string | null;
  valido_hasta: string | null;
  vencido?: boolean;
  created_at: string;
  link?: string;
  negocio?: { nombre: string; whatsapp: string | null; telefono: string | null; slug?: string | null } | null;
}
export type EstadoReserva = "pendiente" | "confirmada" | "cancelada" | "completada" | "ausente";
export interface ReservaCliente {
  id: number;
  estado: EstadoReserva;
  servicio_id: number | null;
  servicio_nombre: string;
  inicio: string;
  fin: string;
  cliente_nombre: string;
  modificable?: boolean;
  negocio_id?: number;
  link?: string;
  negocio?: { nombre: string; whatsapp: string | null; telefono: string | null; slug?: string | null } | null;
}
const firmado = (t: string) => ({ params: { t, negocio: undefined } });
export const presupuestosPublico = {
  pedir: async (negocio: number, p: Record<string, unknown>) =>
    (await api.post<PresupuestoCliente>("/presupuestos", p, { params: { negocio } })).data,
  ver: async (id: string, t: string) => (await api.get<PresupuestoCliente>(`/presupuestos/${id}/publico`, firmado(t))).data,
  responder: async (id: string, t: string, decision: "aceptar" | "rechazar") =>
    (await api.post<PresupuestoCliente>(`/presupuestos/${id}/responder`, { decision }, firmado(t))).data,
};
export const reservasPublico = {
  horarios: async (negocio: number, servicio: number, fecha: string) =>
    (await api.get<{ horarios: string[] }>("/reservas/disponibilidad", { params: { negocio, servicio, fecha } })).data.horarios,
  reservar: async (negocio: number, r: Record<string, unknown>) =>
    (await api.post<ReservaCliente>("/reservas", r, { params: { negocio } })).data,
  ver: async (id: string, t: string) => (await api.get<ReservaCliente>(`/reservas/${id}/publico`, firmado(t))).data,
  horariosDe: async (r: ReservaCliente, negocio: number, fecha: string, t: string) =>
    r.servicio_id
      ? (await api.get<{ horarios: string[] }>("/reservas/disponibilidad", { params: { negocio, servicio: r.servicio_id, fecha, excluir: r.id, t } })).data.horarios
      : [],
  cancelar: async (id: string, t: string) => (await api.post<ReservaCliente>(`/reservas/${id}/cancelar`, {}, firmado(t))).data,
  reprogramar: async (id: string, t: string, inicio: string) =>
    (await api.post<ReservaCliente>(`/reservas/${id}/reprogramar`, { inicio }, firmado(t))).data,
};

// Archivos del cliente para personalizar (quedan privados para el negocio).
export const adjuntosService = {
  subir: async (archivo: File, negocio?: number, uso?: "comprobante") => {
    const fd = new FormData();
    fd.append("archivo", archivo);
    return (
      await api.post<{ token: string; nombre: string; tipo: string }>("/adjuntos", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { ...(negocio ? { negocio } : {}), ...(uso ? { uso } : {}) },
      })
    ).data;
  },
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
  negocio_id?: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  whatsapp: string | null;
  // El local tiene activos los avisos de pedido por WhatsApp.
  avisos_whatsapp?: boolean;
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
  tipo_rubro?: "gastronomia" | "retail" | "servicios" | "generico" | string | null;
  // Módulos del negocio (los que no vienen se consideran activos).
  modulos?: Partial<Record<string, boolean>>;
  // Link público del negocio (/menu/:slug).
  slug?: string | null;
  // Modalidades extra: mostrador, envío por correo y programar para después.
  modalidades?: { mostrador?: boolean; envio?: boolean; retiro_programado?: boolean; entrega_programada?: boolean } | null;
  // Costo del delivery (lo configura el dueño). cobro "efectivo" = se paga al repartidor.
  envio?: { cobrar: boolean; monto: number; gratis_desde: number | null; cobro: "pedido" | "efectivo" } | null;
  // Medios de pago (los configura el dueño). Datos de la cuenta sólo si hay transferencia.
  pagos?: {
    efectivo: boolean;
    transferencia: boolean;
    alias: string;
    cbu: string;
    titular: string;
    banco: string;
    // Comprobante de la transferencia: no se pide, opcional u obligatorio.
    comprobante?: "no" | "opcional" | "obligatorio";
  } | null;
}

export type TipoEntrega = "mesa" | "retiro" | "delivery" | "mostrador" | "envio";

export interface PedidoItem {
  id?: number;
  producto_id: number | null;
  nombre: string;
  precio_unit: number;
  cantidad: number;
  subtotal: number;
}

export interface Pedido {
  id: number;
  mesa: string | null;
  cliente: string | null;
  nota: string | null;
  total: number;
  estado: "pendiente" | "preparando" | "entregado" | "cancelado";
  tipo_entrega?: TipoEntrega | null;
  direccion_entrega?: string | null;
  telefono_cliente?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: PedidoItem[];
}

export interface NuevoPedidoItem {
  producto_id: number | null;
  nombre: string;
  precio: number;
  cantidad: number;
  opciones?: number[]; // ids de opciones de variante elegidas
  // Personalización: valor por campo (o el token del archivo subido).
  personalizacion?: { campo_id: number; valor?: string | number | string[] | null; adjunto?: string }[];
}

export const configuracionService = {
  get: async (negocio?: number) =>
    (await api.get<Configuracion>("/configuracion", delNegocio(negocio))).data,
  update: async (c: Partial<Configuracion>) =>
    (await api.put<Configuracion>("/configuracion", c)).data,
};

export const pedidosService = {
  create: async (payload: {
    mesa?: string | null;
    mesa_token?: string | null;
    cliente?: string | null;
    nota?: string | null;
    tipo_entrega?: TipoEntrega | null;
    direccion_entrega?: string | null;
    telefono_cliente?: string | null;
    acepta_whatsapp?: boolean;
    items: NuevoPedidoItem[];
  }) => (await api.post<Pedido>("/pedidos", payload)).data,
  getAll: async (params?: { estado?: string; mesa?: string }) =>
    (await api.get<Pedido[]>("/pedidos", { params })).data,
  getById: async (id: number) =>
    (await api.get<Pedido>(`/pedidos/${id}`)).data,
  updateEstado: async (id: number, estado: Pedido["estado"]) =>
    (await api.put<Pedido>(`/pedidos/${id}/estado`, { estado })).data,
};

// Escanear el QR de una mesa la marca ocupada en el panel del local.
export const mesasPublico = {
  ocupar: async (mesa: string, t: string) => {
    await api.post("/mesas/ocupar", { mesa, t });
  },
};

export default api;
