import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService, type Usuario } from '../services/api';

interface AuthContextType {
    user: Usuario | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<Usuario | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    // Verificar si hay un token válido al cargar la app
    useEffect(() => {
        const verifyToken = async () => {
            const savedToken = localStorage.getItem('token');
            if (savedToken) {
                try {
                    const response = await authService.verify();
                    setUser(response.user);
                    setToken(savedToken);
                } catch (error) {
                    console.error('Token inválido:', error);
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
            }
            setIsLoading(false);
        };

        verifyToken();
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const response = await authService.login(username, password);
            setUser(response.user);
            setToken(response.token);
            localStorage.setItem('token', response.token);
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            throw error;
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                login,
                logout,
                isAuthenticated: !!token && !!user,
                isLoading,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
};