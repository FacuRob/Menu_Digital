import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">
                        🍽️ Panel de Administración
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-600">Hola, <strong>{user?.username}</strong></span>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            Cerrar Sesión
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card Categorías */}
                    <div
                        onClick={() => navigate('/admin/categorias')}
                        className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-purple-500"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">📁 Categorías</h2>
                            <div className="bg-purple-100 text-purple-600 rounded-full p-3">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-600">Gestionar categorías del menú</p>
                    </div>

                    {/* Card Productos */}
                    <div
                        onClick={() => navigate('/admin/productos')}
                        className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-indigo-500"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">🍕 Productos</h2>
                            <div className="bg-indigo-100 text-indigo-600 rounded-full p-3">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-600">Gestionar productos del menú</p>
                    </div>

                    {/* Card Ver Menú */}
                    <div
                        onClick={() => navigate('/menu')}
                        className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-green-500"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">👁️ Ver Menú</h2>
                            <div className="bg-green-100 text-green-600 rounded-full p-3">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-600">Vista previa del menú del cliente</p>
                    </div>

                    {/* Card QR Code */}
                    <div
                        onClick={() => navigate('/admin/qr')}
                        className="bg-white rounded-xl shadow-md p-8 hover:shadow-xl transition-shadow cursor-pointer border-2 border-transparent hover:border-yellow-500"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">📱 Código QR</h2>
                            <div className="bg-yellow-100 text-yellow-600 rounded-full p-3">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                </svg>
                            </div>
                        </div>
                        <p className="text-gray-600">Generar código QR del menú</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;