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

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    // Negocio activo (multi-tenant). Por defecto 1.
    const negocio = localStorage.getItem("negocio_id");
    config.headers["X-Negocio-Id"] = negocio || "1";
    return config;
  },
  (error) => Promise.reject(error),
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
  negocio_id?: number;
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
  cuenta_id?: number;
  es_plataforma?: boolean;
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
}

export type TipoEntrega = "mesa" | "retiro" | "delivery";

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
  getAll: async (params?: { estado?: string; mesa?: string }) =>
    (await api.get<Pedido[]>("/pedidos", { params })).data,
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
  created_at?: string;
}

export const negociosService = {
  getAll: async () => (await api.get<Negocio[]>("/negocios")).data,
  create: async (payload: { nombre: string; slug?: string }) =>
    (await api.post<Negocio>("/negocios", payload)).data,
  update: async (
    id: number,
    payload: { nombre?: string; slug?: string; activo?: boolean },
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

export const analiticasService = {
  getResumen: async () => (await api.get<Resumen>("/analiticas/resumen")).data,
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

export const planService = {
  get: async () => (await api.get<PlanInfo>("/plan")).data,
};

// ── Panel de plataforma (sólo dueño del SaaS · es_plataforma) ──
export interface Cuenta {
  id: number;
  nombre: string;
  email: string | null;
  tipo_plan: TipoPlan;
  ciclo_facturacion?: "mensual" | "anual";
  estado_suscripcion: "activo" | "cancelado";
  limite_negocios: number;
  limite_productos: number;
  origen: string | null;
  hotmart_transaction: string | null;
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
  por_hotmart: number;
  por_plan: { free: number; basic: number; standard: number; premium: number };
  total_negocios: number;
  moneda: string;
  mrr: number;
  mrr_por_plan: { basic: number; standard: number; premium: number };
  precios: {
    moneda: string;
    mensual: { free: number; basic: number; standard: number; premium: number };
    anual: { free: number; basic: number; standard: number; premium: number };
  };
}

export const plataformaService = {
  getCuentas: async () =>
    (await api.get<Cuenta[]>("/plataforma/cuentas")).data,
  getResumen: async () =>
    (await api.get<PlataformaResumen>("/plataforma/resumen")).data,
};

export default api;
