import axios from "axios";
import { salirDeVerComo, verComoActivo } from "../lib/verComo";

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
    // Venció "Ver como el cliente" en medio de la sesión: vuelve a la cuenta de Tech.
    if (error?.response?.status === 401 && verComoActivo()) salirDeVerComo();
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
  // Todas las fotos en orden (la primera = imagen_url). Vacía en productos de antes.
  imagenes?: string[] | null;
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
  // Tech viendo esta cuenta con "Ver como el cliente" (no se puede cambiar nada).
  solo_lectura?: boolean;
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
  // Sin `imagen_url` ni `imagenes` (p. ej. el interruptor de disponible) el
  // servidor conserva las fotos que tiene.
  update: async (
    id: number,
    p: Omit<Producto, "id" | "created_at" | "updated_at" | "categoria_nombre" | "imagen_url"> & {
      imagen_url?: string | null;
    },
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
    email?: string;
    rol: string;
  }) => (await api.post<Usuario>("/usuarios", u)).data,
  update: async (
    id: number,
    u: { nombre?: string; email?: string; rol?: string; activo?: boolean },
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
  // Opciones de la agenda de turnos.
  agenda?: AgendaOpciones | null;
  modalidades?: ModalidadesEntrega | null;
  // Costo del delivery. Sólo el dueño lo cambia (PUT /configuracion/envio).
  envio?: EnvioConfig | null;
  // Medios de pago. Sólo el dueño los cambia (PUT /configuracion/pagos).
  pagos?: PagosConfig | null;
  moneda?: string | null;
  // Multi-rubro (viven en `negocios`, se editan desde Configuración).
  tipo_rubro?: TipoRubro;
  rubro_categoria?: string | null;
  rubro_especialidad?: string | null;
  config_campos?: Record<string, unknown>;
  // Módulos que usa el negocio (viven en `negocios`).
  modulos?: Modulos;
  ciudad?: string | null;
  provincia?: string | null;
}

export type TipoRubro = "gastronomia" | "retail" | "servicios" | "generico";

export type TipoEntrega = "mesa" | "retiro" | "delivery" | "mostrador" | "envio";
// Modalidades extra del negocio (mostrador, envío y pedidos programados).
export interface ModalidadesEntrega {
  mostrador?: boolean;
  envio?: boolean;
  retiro_programado?: boolean;
  entrega_programada?: boolean;
}

export interface PedidoItem {
  id?: number;
  producto_id: number | null;
  nombre: string;
  precio_unit: number;
  cantidad: number; // en kg si unidad = "kg"
  subtotal: number;
  unidad?: "unidad" | "kg";
  // Foto de lo que eligió y completó el cliente (pedidos nuevos).
  opciones?: { grupo: string; opcion: string; precio_extra: number }[] | null;
  personalizacion?: ItemPersonalizacion[] | null;
}

// ── Personalización de productos ──
export type TipoCampo = "texto" | "texto_largo" | "numero" | "opcion" | "multiple" | "color" | "archivo";
export interface CampoProducto {
  id?: number;
  tipo: TipoCampo;
  etiqueta: string;
  ayuda?: string | null;
  opciones: string[];
  obligatorio: boolean;
  validaciones: { max_largo?: number; min?: number; max?: number; tipos?: ("imagen" | "pdf" | "3d")[] };
}
export interface ItemPersonalizacion {
  campo_id: number;
  etiqueta: string;
  tipo: TipoCampo;
  valor: string | number | string[] | null;
  adjunto?: { id: number; nombre: string };
}
export const camposService = {
  get: async (productoId: number) => (await api.get<CampoProducto[]>(`/productos/${productoId}/campos`)).data,
  put: async (productoId: number, campos: CampoProducto[]) =>
    (await api.put<CampoProducto[]>(`/productos/${productoId}/campos`, { campos })).data,
};
export const adjuntosService = {
  // Link firmado que vence a los pocos minutos.
  ver: async (id: number) => (await api.get<{ url: string; nombre: string; tipo: string }>(`/adjuntos/${id}`)).data,
};

// ── Presupuestos ──
export type EstadoPresupuesto = "pendiente" | "en_revision" | "cotizado" | "aceptado" | "rechazado" | "convertido" | "cancelado";
export interface Presupuesto {
  id: number;
  producto_id: number | null;
  servicio_id: number | null;
  referencia: string | null;
  cliente_nombre: string;
  telefono: string | null;
  email: string | null;
  acepta_whatsapp: boolean;
  descripcion: string;
  cantidad: number;
  medidas: string | null;
  estado: EstadoPresupuesto;
  precio_cotizado: number | null;
  observaciones: string | null;
  valido_hasta: string | null;
  pedido_id: number | null;
  pedido_numero?: number | null;
  created_at: string;
}
export interface PresupuestoDetalle extends Presupuesto {
  eventos: { estado: EstadoPresupuesto; autor: string; nota: string | null; created_at: string }[];
  adjuntos: { id: number; nombre: string; tipo: string }[];
  link: string;
}
export const presupuestosService = {
  listar: async (vista: "abiertos" | "cerrados") => (await api.get<Presupuesto[]>("/presupuestos", { params: { vista } })).data,
  ver: async (id: number) => (await api.get<PresupuestoDetalle>(`/presupuestos/${id}`)).data,
  estado: async (id: number, estado: "en_revision" | "rechazado" | "cancelado") =>
    (await api.patch<Presupuesto>(`/presupuestos/${id}/estado`, { estado })).data,
  cotizar: async (id: number, c: { precio: number; observaciones?: string | null; valido_hasta?: string | null }) =>
    (await api.post<Presupuesto & { link: string }>(`/presupuestos/${id}/cotizacion`, c)).data,
  convertir: async (id: number) => (await api.post<Presupuesto & { pedido: { id: number } }>(`/presupuestos/${id}/convertir`)).data,
  resumen: async () => (await api.get<{ pendientes: number; aceptados: number }>("/presupuestos/resumen")).data,
};

// ── Turnos (reservas) ──
export type EstadoReserva = "pendiente" | "confirmada" | "cancelada" | "completada" | "ausente";
export interface Reserva {
  id: number;
  servicio_id: number | null;
  servicio_nombre: string;
  cliente_nombre: string;
  telefono: string | null;
  email: string | null;
  notas: string | null;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  origen: "cliente" | "panel";
}
export interface AgendaOpciones {
  paso_min: number;
  anticipacion_min: number;
  dias_max: number;
  confirmacion: "manual" | "automatica";
}
export interface Bloqueo { id: number; desde: string; hasta: string; motivo: string | null }
export const reservasService = {
  listar: async (desde: string, hasta: string) => (await api.get<Reserva[]>("/reservas", { params: { desde, hasta } })).data,
  ver: async (id: number) => (await api.get<Reserva & { link: string }>(`/reservas/${id}`)).data,
  estado: async (id: number, estado: Exclude<EstadoReserva, "pendiente">) =>
    (await api.patch<Reserva>(`/reservas/${id}/estado`, { estado })).data,
  reprogramar: async (id: number, inicio: string) => (await api.post<Reserva>(`/reservas/${id}/reagendar`, { inicio })).data,
  horarios: async (servicio: number, fecha: string, excluir?: number) =>
    (await api.get<{ horarios: string[] }>("/reservas/horarios", { params: { servicio, fecha, excluir } })).data.horarios,
  manual: async (r: { servicio_id: number; inicio: string; cliente_nombre: string; telefono?: string | null; notas?: string | null }) =>
    (await api.post<Reserva>("/reservas/manual", r)).data,
  bloqueos: async () => (await api.get<Bloqueo[]>("/reservas/bloqueos")).data,
  crearBloqueo: async (b: { desde: string; hasta: string; motivo?: string | null }) =>
    (await api.post<Bloqueo>("/reservas/bloqueos", b)).data,
  borrarBloqueo: async (id: number) => (await api.delete(`/reservas/bloqueos/${id}`)).data,
  resumen: async () => (await api.get<{ por_confirmar: number; primera: string | null }>("/reservas/resumen")).data,
};

// ── Servicios ──
export type TipoPrecio = "fijo" | "desde" | "variable";
export type ModalidadServicio = "presencial" | "domicilio" | "virtual" | "visita";
export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  categoria: string | null;
  tipo_precio: TipoPrecio;
  precio: number | null;
  duracion_min: number | null;
  modalidades: ModalidadServicio[];
  requiere_turno: boolean;
  requiere_presupuesto: boolean;
  activo: boolean;
  orden: number;
}
// Clientes: armados con pedidos, presupuestos y turnos (sin tabla propia).
export interface Cliente {
  clave: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  pedidos: number;
  total: number;
  presupuestos: number;
  turnos: number;
  ultimo: string | null;
}
export const clientesService = {
  // truncado: el negocio tiene más historial del que se lee (los más viejos no están).
  listar: async () => (await api.get<{ clientes: Cliente[]; truncado: boolean }>("/clientes")).data,
};

export const serviciosService = {
  getAll: async () => (await api.get<Servicio[]>("/servicios")).data,
  create: async (s: Omit<Servicio, "id">) => (await api.post<Servicio>("/servicios", s)).data,
  update: async (id: number, s: Omit<Servicio, "id"> & { id?: number }) => {
    const { id: _omit, ...datos } = s as Servicio;
    void _omit;
    return (await api.put<Servicio>(`/servicios/${id}`, datos)).data;
  },
  delete: async (id: number) => (await api.delete(`/servicios/${id}`)).data,
};

export interface Pedido {
  // Para cuándo lo quiere el cliente (retiro o entrega programada).
  programado_para?: string | null;
  id: number;
  // Número que ve la gente (propio del negocio). `id` es interno.
  numero?: number | null;
  mesa: string | null;
  cliente: string | null;
  nota: string | null;
  // Sólo productos. Lo que paga el cliente = total + costo_envio.
  total: number;
  costo_envio?: number;
  envio_cobro?: "pedido" | "efectivo" | null;
  // Medio de pago (null = el local no usa medios de pago).
  metodo_pago?: "efectivo" | "transferencia" | null;
  paga_con?: number | null;
  estado_pago?: "pendiente" | "en_revision" | "pagado" | "rechazado" | null;
  // Transferencia: quién la hizo y el comprobante adjunto (adjuntos.id).
  transfirio?: string | null;
  comprobante_id?: number | null;
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

export interface EnvioConfig {
  cobrar: boolean;
  monto: number;
  // Con productos por este monto o más, el envío es gratis (null = nunca).
  gratis_desde: number | null;
  // "pedido": junto con el pedido · "efectivo": en efectivo al repartidor.
  cobro: "pedido" | "efectivo";
}

export interface PagosConfig {
  efectivo: boolean;
  transferencia: boolean;
  alias: string;
  cbu: string;
  titular: string;
  banco: string;
  // Comprobante de la transferencia: no se pide, opcional u obligatorio.
  comprobante: "no" | "opcional" | "obligatorio";
}

export const configuracionService = {
  get: async () => (await api.get<Configuracion>("/panel/configuracion")).data,
  update: async (c: Partial<Configuracion>) =>
    (await api.put<Configuracion>("/configuracion", c)).data,
  updateEnvio: async (e: EnvioConfig) =>
    (await api.put<{ envio: EnvioConfig }>("/configuracion/envio", e)).data.envio,
  updatePagos: async (p: PagosConfig) =>
    (await api.put<{ pagos: PagosConfig }>("/configuracion/pagos", p)).data.pagos,
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
  // Transferencias: "Llegó la plata" / "No llegó" (dueño y Admin).
  updatePago: async (id: number, estado_pago: "pagado" | "rechazado" | "en_revision") =>
    (await api.put<Pedido>(`/pedidos/${id}/pago`, { estado_pago })).data,
  // Link firmado para el repartidor (sólo pedidos delivery).
  linkReparto: async (id: number) =>
    (await api.get<{ url: string }>(`/pedidos/${id}/link-reparto`)).data.url,
};

export interface Negocio {
  id: number;
  nombre: string;
  slug: string | null;
  activo: boolean;
  tipo_rubro?: TipoRubro;
  rubro_categoria?: string | null;
  rubro_especialidad?: string | null;
  created_at?: string;
}

// Rubro elegido en un formulario: categoría + especialidad (opcional).
export interface RubroElegido {
  rubro_categoria: string | null;
  rubro_especialidad: string | null;
}

export const negociosService = {
  getAll: async () => (await api.get<Negocio[]>("/negocios")).data,
  create: async (payload: { nombre: string; slug?: string } & Partial<RubroElegido>) =>
    (await api.post<Negocio>("/negocios", payload)).data,
  update: async (
    id: number,
    payload: { nombre?: string; slug?: string; activo?: boolean } & Partial<RubroElegido>,
  ) => (await api.put<Negocio>(`/negocios/${id}`, payload)).data,
  delete: async (id: number) =>
    (await api.delete(`/negocios/${id}`)).data,
};

// ── Módulos por negocio (registro en GET /api/modulos) ──
export type Modulos = Record<string, boolean>;
export interface ModuloInfo {
  codigo: string;
  nombre: string;
  descripcion: string;
  // false = todavía no existe en el sistema.
  disponible: boolean;
  requiere?: string[];
  // fijo: siempre activo. oculto: va junto con otro (no se muestra).
  fijo?: boolean;
  oculto?: boolean;
}
export const modulosService = {
  getRegistro: async () => (await api.get<ModuloInfo[]>("/modulos")).data,
};

// ── Catálogo central de rubros (GET /api/rubros) ──
export interface Sugerencias {
  ofrece?: Ofrece[];
  funciones?: Funcion[];
}
export interface RubroEspecialidad {
  codigo: string;
  nombre: string;
  sugerencias: Sugerencias;
}
export interface RubroCategoria {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  familia: TipoRubro;
  icono: string | null;
  sugerencias: Sugerencias;
  especialidades: RubroEspecialidad[];
}
export const rubrosService = {
  getAll: async () => (await api.get<{ categorias: RubroCategoria[] }>("/rubros")).data.categorias,
};

// ── Onboarding retomable (progreso por negocio) ──
export type Ofrece = "productos" | "personalizados" | "servicios";
export type Funcion =
  | "venta_directa" | "pedidos" | "retiro" | "envios"
  | "presencial" | "virtual" | "reservas" | "presupuestos";
export interface OnboardingProgreso {
  paso?: number;
  completado?: boolean;
  ofrece?: Ofrece[];
  funciones?: Funcion[];
}
export interface OnboardingEstado {
  // null = negocio anterior al onboarding nuevo (se considera configurado).
  onboarding: OnboardingProgreso | null;
  nombre: string;
  slug: string | null;
  activo: boolean;
  tipo_rubro: TipoRubro;
  rubro_categoria: string | null;
  rubro_especialidad: string | null;
  modulos?: Modulos;
}
export const onboardingService = {
  get: async () => (await api.get<OnboardingEstado>("/onboarding")).data,
  update: async (p: Omit<OnboardingProgreso, "completado"> & { completado?: boolean }) =>
    (await api.put<OnboardingEstado>("/onboarding", p)).data,
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

// Presupuestos y turnos del período (null si el negocio no usa ese módulo).
export interface StatsAgenda {
  dias: number;
  truncado?: boolean;
  presupuestos: { recibidos: number; sin_responder: number; cotizados: number; aceptados: number; rechazados: number; tasa_aceptacion: number | null; monto_aceptado: number } | null;
  turnos: { total: number; completados: number; ausentes: number; cancelados: number; tasa_ausencia: number | null; top_servicios: { nombre: string; turnos: number }[] } | null;
}

// Registro de cambios de la cuenta (Usuarios → Actividad reciente).
export interface CambioRegistrado {
  id: number;
  negocio_id: number | null;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  detalle: unknown;
  created_at: string;
  quien: string | null;
}
export const registroService = {
  listar: async () => (await api.get<CambioRegistrado[]>("/usuarios/registro")).data,
};

export const analiticasService = {
  getAgenda: async (dias: 7 | 30 | 90 = 30) => (await api.get<StatsAgenda>("/analiticas/agenda", { params: { dias } })).data,
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
  // false sólo cuando ya no puede usar el panel (cancelada y pasó el mes pagado).
  vigente?: boolean;
  limite_negocios: number;
  negocios_usados: number;
  limite_productos: number;
  productos_usados: number;
  // Plan que rige hoy (en prueba gratis, el de prueba).
  plan_efectivo?: TipoPlan | null;
  // WhatsApp, chats, bot con IA y mapa del repartidor (Estándar y Premium).
  whatsapp?: boolean;
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
  estado_suscripcion: "trial" | "activo" | "cancelado" | "vencido";
  periodo_fin?: string | null;
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

export interface Cupon {
  id: number;
  codigo: string;
  porcentaje: number;
  meses: number;
  created_at: string;
  usado_por_cuenta_id: number | null;
  usado_at: string | null;
  cuenta?: { id: number; nombre: string; email: string | null } | null;
}

// Cuenta en riesgo (panel Tech): por qué conviene ayudarla.
export type MotivoRiesgo =
  | "vencida"
  | "cancelada"
  | "prueba_vencida"
  | "prueba_por_vencer"
  | "sin_configurar"
  | "sin_pedidos";

export interface CuentaRiesgo {
  id: number;
  nombre: string;
  email: string | null;
  tipo_plan: TipoPlan;
  estado_suscripcion: string;
  nivel: "alto" | "medio";
  motivos: { tipo: MotivoRiesgo; nivel: "alto" | "medio"; dias?: number | null }[];
}

export const plataformaService = {
  getRiesgo: async () =>
    (await api.get<CuentaRiesgo[]>("/plataforma/riesgo")).data,
  getCuentas: async () =>
    (await api.get<Cuenta[]>("/plataforma/cuentas")).data,
  getResumen: async () =>
    (await api.get<PlataformaResumen>("/plataforma/resumen")).data,
  // Cupones de descuento para la suscripción.
  getCupones: async () =>
    (await api.get<{ disponibles: Cupon[]; usados: Cupon[] }>("/plataforma/cupones")).data,
  crearCupones: async (body: { porcentaje: number; meses: number; cantidad: number }) =>
    (await api.post<Cupon[]>("/plataforma/cupones", body)).data,
  eliminarCupon: async (id: number) => {
    await api.delete(`/plataforma/cupones/${id}`);
  },
  // Token de solo lectura para "Ver como el cliente".
  verComo: async (cuentaId: number) =>
    (
      await api.post<{ token: string; cuenta: { id: number; nombre: string }; minutos: number }>(
        `/plataforma/cuentas/${cuentaId}/ver`,
      )
    ).data,
};

// ── Suscripción (Mercado Pago, mensual en ARS + prueba gratis) ──
export type EstadoSuscripcion = "trial" | "activo" | "cancelado" | "vencido";

export interface PlanCatalogo {
  code: "basic" | "standard" | "premium";
  precio_mensual: number;
  // Solo si la cuenta tiene un cupón vigente.
  precio_con_descuento?: number;
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
  descuento?: { porcentaje: number; meses_restantes: number } | null;
  // Email de Mercado Pago para precargar (último usado o el del usuario).
  mp_email?: string | null;
}

export const suscripcionService = {
  get: async () => (await api.get<SuscripcionEstado>("/suscripcion")).data,
  // `email`: el de la cuenta de Mercado Pago con la que se paga.
  checkout: async (plan: PlanCatalogo["code"], email?: string) =>
    (await api.post<{ url: string }>(`/suscripcion/checkout/${plan}`, { email })).data,
  // Baja de la suscripción: DinexFlow se la pide a Mercado Pago.
  cancelar: async () =>
    (await api.post<{ estado_suscripcion: EstadoSuscripcion; periodo_fin: string | null }>("/suscripcion/cancelar")).data,
  canjearCupon: async (codigo: string) =>
    (await api.post<{ porcentaje: number; meses: number }>("/suscripcion/cupon", { codigo })).data,
};

// ── Avisos de pedido por WhatsApp ──────────────────────────────
export type EstadoAviso =
  | "pendiente"
  | "preparando"
  | "en_camino"
  | "listo"
  | "entregado"
  | "cancelado"
  // Presupuestos y turnos (sólo si el negocio usa esos módulos).
  | "presupuesto.recibido"
  | "presupuesto.cotizado"
  | "reserva.confirmada"
  | "reserva.reprogramada"
  | "reserva.cancelada";

export interface AvisosWhatsapp {
  conectado: boolean;
  // El local envía desde su propio número (si no, desde el de la plataforma).
  numero_propio?: boolean;
  // WhatsApp común conectado con código QR (null = no lo usa).
  qr?: EstadoQR | null;
  qr_disponible?: boolean;
  activo: boolean;
  estados: Record<EstadoAviso, boolean>;
  // ejemplos: valores de muestra para la vista previa ({{1}}, {{2}}, …).
  avisos: { estado: EstadoAviso; plantilla: string; texto: string; ejemplos?: string[] }[];
}

export interface MensajeWhatsapp {
  id: number;
  pedido_id: number | null;
  pedido_numero?: number | null;
  telefono: string;
  aviso: EstadoAviso | "prueba" | null;
  estado: "enviado" | "entregado" | "leido" | "fallido";
  error: string | null;
  created_at: string;
}

// Número de WhatsApp propio del local (Embedded Signup de Meta).
export interface CuentaWhatsapp {
  cuenta: { telefono: string | null; nombre_visible: string | null; coexistencia: boolean; conectado_at: string } | null;
  plantillas: { nombre: string; estado: string }[] | null;
  alta: { appId: string; configId: string; sdkVersion: string } | null;
  plataforma: boolean;
}

export const whatsappCuentaService = {
  get: async () => (await api.get<CuentaWhatsapp>("/whatsapp/cuenta")).data,
  conectar: async (p: { code: string; waba_id: string; phone_number_id: string; coexistencia: boolean }) =>
    (await api.post("/whatsapp/cuenta", p)).data,
  recrearPlantillas: async () => (await api.post("/whatsapp/cuenta/plantillas")).data,
  desconectar: async () => (await api.delete("/whatsapp/cuenta")).data,
};

// WhatsApp común conectado con código QR (Evolution API).
export type EstadoQR = "vinculando" | "conectado" | "desconectado";
export interface ConexionQR {
  disponible: boolean;
  cuenta: { estado: EstadoQR; telefono: string | null; nombre_visible: string | null; conectado_at: string | null } | null;
  qr?: string | null; // imagen (data:image/png;base64,…)
  codigo?: string | null; // código de 8 letras (vincular con el número)
}

export const whatsappQRService = {
  get: async () => (await api.get<ConexionQR>("/whatsapp/qr")).data,
  iniciar: async (telefono?: string) => (await api.post<ConexionQR>("/whatsapp/qr", telefono ? { telefono } : {})).data,
  desconectar: async () => (await api.delete("/whatsapp/qr")).data,
};

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
  pedido_numero?: number | null;
  created_at: string;
}

// ── Soporte: reportes de los clientes al equipo Tech ──
export type TipoSoporte = "error" | "pago" | "duda" | "sugerencia";
export type EstadoSoporte = "abierto" | "en_curso" | "resuelto";

export interface TicketSoporte {
  id: number;
  cuenta_id: number;
  cuenta_nombre: string | null;
  cuenta_email?: string | null;
  autor: string | null;
  tipo: TipoSoporte;
  asunto: string;
  estado: EstadoSoporte;
  sin_leer: boolean;
  ultimo_at: string;
  created_at: string;
}

export interface MensajeSoporte {
  id: number;
  de_tech: boolean;
  texto: string | null;
  imagen_url: string | null;
  created_at: string;
  autor: string | null;
}

export interface NuevoMensajeSoporte {
  texto?: string;
  imagen_url?: string | null;
}

export const soporteService = {
  listar: async (estado: "abiertos" | "resueltos" | "todos") =>
    (await api.get<{ tech: boolean; tickets: TicketSoporte[] }>("/soporte", { params: { estado } })).data,
  resumen: async () => (await api.get<{ sin_leer: number }>("/soporte/resumen")).data,
  ver: async (id: number) =>
    (await api.get<{ tech: boolean; ticket: TicketSoporte; mensajes: MensajeSoporte[] }>(`/soporte/${id}`)).data,
  crear: async (body: NuevoMensajeSoporte & { tipo: TipoSoporte; asunto: string }) =>
    (await api.post<TicketSoporte>("/soporte", body)).data,
  responder: async (id: number, body: NuevoMensajeSoporte) =>
    (await api.post<{ mensaje: MensajeSoporte; estado: EstadoSoporte }>(`/soporte/${id}/mensajes`, body)).data,
  cambiarEstado: async (id: number, estado: EstadoSoporte) =>
    (await api.patch<{ id: number; estado: EstadoSoporte }>(`/soporte/${id}`, { estado })).data,
  subirImagen: async (file: File) => {
    const formData = new FormData();
    formData.append("imagen", file);
    return (
      await api.post<{ url: string }>("/soporte/imagen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
    ).data;
  },
};

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
  // Nombre con el que se presenta ("Soy Alex…"). Vacío = sin nombre.
  nombre_asistente?: string;
}

export const iaService = {
  get: async () => (await api.get<ConfigIA>("/whatsapp/ia")).data,
  update: async (p: { activo?: boolean; instrucciones?: string; nombre_asistente?: string }) =>
    (await api.put<Pick<ConfigIA, "activo" | "instrucciones" | "nombre_asistente">>("/whatsapp/ia", p)).data,
};

export default api;
