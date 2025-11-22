import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productosService, categoriasService, type Producto, type Categoria } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const Productos = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
    const [formData, setFormData] = useState({
        nombre: '',
        descripcion: '',
        precio: 0,
        imagen_url: '',
        categoria_id: 0,
        disponible: true,
        orden: 0,
    });

    const navigate = useNavigate();
    const { logout } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [productosData, categoriasData] = await Promise.all([
                productosService.getAll(),
                categoriasService.getAll(),
            ]);
            setProductos(productosData);
            setCategorias(categoriasData);
        } catch (error) {
            console.error('Error al cargar datos:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (producto?: Producto) => {
        if (producto) {
            setEditingProducto(producto);
            setFormData({
                nombre: producto.nombre,
                descripcion: producto.descripcion,
                precio: producto.precio,
                imagen_url: producto.imagen_url || '',
                categoria_id: producto.categoria_id,
                disponible: producto.disponible,
                orden: producto.orden,
            });
        } else {
            setEditingProducto(null);
            setFormData({
                nombre: '',
                descripcion: '',
                precio: 0,
                imagen_url: '',
                categoria_id: categorias.length > 0 ? categorias[0].id : 0,
                disponible: true,
                orden: productos.length + 1,
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProducto(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const dataToSend = {
                ...formData,
                imagen_url: formData.imagen_url || null,
            };

            if (editingProducto) {
                await productosService.update(editingProducto.id, dataToSend);
            } else {
                await productosService.create(dataToSend);
            }
            fetchData();
            handleCloseModal();
        } catch (error) {
            console.error('Error al guardar producto:', error);
            alert('Error al guardar el producto');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('¿Estás seguro de eliminar este producto?')) {
            try {
                await productosService.delete(id);
                fetchData();
            } catch (error) {
                console.error('Error al eliminar producto:', error);
                alert('Error al eliminar el producto');
            }
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
        }).format(price);
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
                    <h1 className="text-2xl font-bold text-gray-900">🍕 Gestión de Productos</h1>
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
                {/* Botón Agregar */}
                <div className="mb-6">
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold shadow-md"
                    >
                        ➕ Nuevo Producto
                    </button>
                </div>

                {/* Tabla */}
                {productos.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <p className="text-gray-600 text-lg">No hay productos creados</p>
                        <p className="text-gray-400 mt-2">Crea tu primer producto para comenzar</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Producto
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Categoría
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Precio
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Estado
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Orden
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {productos.map((producto) => (
                                        <tr key={producto.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{producto.nombre}</div>
                                                        <div className="text-sm text-gray-500 line-clamp-1">{producto.descripcion}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{producto.categoria_nombre}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">{formatPrice(producto.precio)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${producto.disponible
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                        }`}
                                                >
                                                    {producto.disponible ? 'Disponible' : 'No disponible'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-500">{producto.orden}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenModal(producto)}
                                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(producto.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    🗑️ Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800">
                                {editingProducto ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre del Producto
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                        placeholder="Ej: Milanesa Napolitana"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                        placeholder="Describe el producto..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Precio
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.precio}
                                        onChange={(e) => setFormData({ ...formData, precio: parseFloat(e.target.value) || 0 })}
                                        required
                                        min="0"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Categoría
                                    </label>
                                    <select
                                        value={formData.categoria_id}
                                        onChange={(e) => setFormData({ ...formData, categoria_id: parseInt(e.target.value) })}
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                    >
                                        {categorias.map((categoria) => (
                                            <option key={categoria.id} value={categoria.id}>
                                                {categoria.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        URL de Imagen (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.imagen_url}
                                        onChange={(e) => setFormData({ ...formData, imagen_url: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Orden
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.orden}
                                        onChange={(e) => setFormData({ ...formData, orden: parseInt(e.target.value) || 0 })}
                                        required
                                        min="1"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="disponible"
                                            checked={formData.disponible}
                                            onChange={(e) => setFormData({ ...formData, disponible: e.target.checked })}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <label htmlFor="disponible" className="ml-2 block text-sm text-gray-900">
                                            Producto disponible (visible en el menú)
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
                                >
                                    {editingProducto ? 'Actualizar' : 'Crear'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Productos;