import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { categoriasService, type Categoria } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Categorias = () => {
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
    const [formData, setFormData] = useState({
        nombre: '',
        orden: 0,
        activo: true,
    });

    const navigate = useNavigate();
    const { logout } = useAuth();

    // Cargar categorías al montar el componente
    useEffect(() => {
        fetchCategorias();
    }, []);

    const fetchCategorias = async () => {
        try {
            setLoading(true);
            const data = await categoriasService.getAll();
            setCategorias(data);
        } catch (error) {
            console.error('Error al cargar categorías:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (categoria?: Categoria) => {
        if (categoria) {
            setEditingCategoria(categoria);
            setFormData({
                nombre: categoria.nombre,
                orden: categoria.orden,
                activo: categoria.activo,
            });
        } else {
            setEditingCategoria(null);
            setFormData({
                nombre: '',
                orden: categorias.length + 1,
                activo: true,
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingCategoria(null);
        setFormData({ nombre: '', orden: 0, activo: true });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCategoria) {
                await categoriasService.update(editingCategoria.id, formData);
            } else {
                await categoriasService.create(formData);
            }
            fetchCategorias();
            handleCloseModal();
        } catch (error) {
            console.error('Error al guardar categoría:', error);
            alert('Error al guardar la categoría');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Estás seguro de eliminar esta categoría? Se eliminarán también todos sus productos.')) {
            try {
                await categoriasService.delete(id);
                fetchCategorias();
            } catch (error) {
                console.error('Error al eliminar categoría:', error);
                alert('Error al eliminar la categoría');
            }
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <p className="text-xl text-gray-600">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">📁 Gestión de Categorías</h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                        >
                            ← Volver
                        </button>
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
                <div className="mb-6">
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-105 font-semibold"
                    >
                        ➕ Nueva Categoría
                    </button>
                </div>

                {/* Lista de Categorías */}
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nombre
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Orden
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Estado
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Acciones
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {categorias.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                        No hay categorías registradas
                                    </td>
                                </tr>
                            ) : (
                                categorias.map((categoria) => (
                                    <tr key={categoria.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{categoria.nombre}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-500">{categoria.orden}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${categoria.activo
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                }`}>
                                                {categoria.activo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button
                                                onClick={() => handleOpenModal(categoria)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={() => handleDelete(categoria.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                🗑️ Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {editingCategoria ? '✏️ Editar Categoría' : '➕ Nueva Categoría'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="nombre" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    id="nombre"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    required
                                    placeholder="Ej: Entradas, Platos principales..."
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="orden" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Orden
                                </label>
                                <input
                                    type="number"
                                    id="orden"
                                    value={formData.orden}
                                    onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                                    required
                                    min="1"
                                    placeholder="Orden de visualización"
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
                                />
                            </div>

                            <div>
                                <label htmlFor="activo" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Estado
                                </label>
                                <select
                                    id="activo"
                                    value={formData.activo ? 'true' : 'false'}
                                    onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'true' })}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
                                >
                                    <option value="true">Activo</option>
                                    <option value="false">Inactivo</option>
                                </select>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all transform hover:scale-105"
                                >
                                    {editingCategoria ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categorias;