import axios from 'axios';

const API_URL = '/api';

// Configuración de axios
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar el token en cada petición
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
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
    rol: string;
}

export interface LoginResponse {
    message: string;
    token: string;
    user: Usuario;
}

// Servicios de Auth
export const authService = {
    login: async (username: string, password: string) => {
        const response = await api.post<LoginResponse>('/auth/login', { username, password });
        return response.data;
    },

    register: async (username: string, password: string) => {
        const response = await api.post('/auth/register', { username, password });
        return response.data;
    },

    verify: async () => {
        const response = await api.get('/auth/verify');
        return response.data;
    },
};

// Servicios de Categorías
export const categoriasService = {
    getAll: async () => {
        const response = await api.get<Categoria[]>('/categorias');
        return response.data;
    },

    getActivas: async () => {
        const response = await api.get<Categoria[]>('/categorias/activas');
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<Categoria>(`/categorias/${id}`);
        return response.data;
    },

    create: async (categoria: Omit<Categoria, 'id' | 'created_at' | 'updated_at'>) => {
        const response = await api.post<Categoria>('/categorias', categoria);
        return response.data;
    },

    update: async (id: number, categoria: Omit<Categoria, 'id' | 'created_at' | 'updated_at'>) => {
        const response = await api.put<Categoria>(`/categorias/${id}`, categoria);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/categorias/${id}`);
        return response.data;
    },
};

// Servicios de Productos
export const productosService = {
    getAll: async () => {
        const response = await api.get<Producto[]>('/productos');
        return response.data;
    },

    getDisponibles: async () => {
        const response = await api.get<Producto[]>('/productos/disponibles');
        return response.data;
    },

    getByCategoria: async (categoriaId: number) => {
        const response = await api.get<Producto[]>(`/productos/categoria/${categoriaId}`);
        return response.data;
    },

    getById: async (id: number) => {
        const response = await api.get<Producto>(`/productos/${id}`);
        return response.data;
    },

    create: async (producto: Omit<Producto, 'id' | 'created_at' | 'updated_at' | 'categoria_nombre'>) => {
        const response = await api.post<Producto>('/productos', producto);
        return response.data;
    },

    update: async (id: number, producto: Omit<Producto, 'id' | 'created_at' | 'updated_at' | 'categoria_nombre'>) => {
        const response = await api.put<Producto>(`/productos/${id}`, producto);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/productos/${id}`);
        return response.data;
    },
};

export default api;