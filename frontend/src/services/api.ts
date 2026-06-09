import axios from "axios";

const API_URL = "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// Tipos
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

// Auth
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
};

// Categorías
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

// Productos
export const productosService = {
  getAll: async () => (await api.get<Producto[]>("/productos")).data,
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

// Upload
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

// Usuarios (solo superadmin)
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

export default api;
