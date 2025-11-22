import { useState, useEffect } from 'react';
import { productosService, categoriasService, type Producto, type Categoria } from '../services/api';

const Menu = () => {
    const [productos, setProductos] = useState<Producto[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategoria, setSelectedCategoria] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [productosData, categoriasData] = await Promise.all([
                productosService.getDisponibles(),
                categoriasService.getActivas(),
            ]);
            setProductos(productosData);
            setCategorias(categoriasData);
        } catch (error) {
            console.error('Error al cargar el menú:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
        }).format(price);
    };

    // Agrupar productos por categoría
    const productosPorCategoria = categorias.map((categoria) => ({
        categoria,
        productos: productos.filter((p) => p.categoria_id === categoria.id),
    }));

    // Filtrar por categoría seleccionada
    const categoriasFiltradas = selectedCategoria
        ? productosPorCategoria.filter((pc) => pc.categoria.id === selectedCategoria)
        : productosPorCategoria;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">Cargando menú...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
            {/* Header */}
            <header className="bg-white shadow-md sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-6">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            🍽️ Nuestro Menú
                        </h1>
                        <p className="text-gray-600">Descubre estos platos culinarios</p>
                    </div>
                </div>

                {/* Filtros de Categorías */}
                {categorias.length > 0 && (
                    <div className="border-t border-gray-200 bg-white">
                        <div className="max-w-4xl mx-auto px-4 py-4">
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                <button
                                    onClick={() => setSelectedCategoria(null)}
                                    className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategoria === null
                                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Todas
                                </button>
                                {categorias.map((categoria) => (
                                    <button
                                        key={categoria.id}
                                        onClick={() => setSelectedCategoria(categoria.id)}
                                        className={`px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedCategoria === categoria.id
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {categoria.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Contenido Principal */}
            <main className="max-w-4xl mx-auto px-4 py-8">
                {categoriasFiltradas.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-gray-600 text-lg">No hay productos disponibles en este momento</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {categoriasFiltradas.map(({ categoria, productos: prods }) => {
                            if (prods.length === 0) return null;

                            return (
                                <section key={categoria.id} className="space-y-6">
                                    {/* Título de Categoría */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-gradient-to-r from-orange-200 to-red-200"></div>
                                        <h2 className="text-3xl font-bold text-gray-800 px-4">
                                            {categoria.nombre}
                                        </h2>
                                        <div className="flex-1 h-px bg-gradient-to-l from-orange-200 to-red-200"></div>
                                    </div>

                                    {/* Grid de Productos */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {prods.map((producto) => (
                                            <div
                                                key={producto.id}
                                                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                                            >
                                                {/* Imagen del producto (si existe) */}
                                                {producto.imagen_url && (
                                                    <div className="h-48 bg-gray-200 overflow-hidden">
                                                        <img
                                                            src={producto.imagen_url}
                                                            alt={producto.nombre}
                                                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                            }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Contenido */}
                                                <div className="p-6">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h3 className="text-xl font-bold text-gray-900 flex-1">
                                                            {producto.nombre}
                                                        </h3>
                                                        <span className="text-2xl font-bold text-orange-600 ml-3">
                                                            {formatPrice(producto.precio)}
                                                        </span>
                                                    </div>

                                                    {producto.descripcion && (
                                                        <p className="text-gray-600 text-sm leading-relaxed">
                                                            {producto.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-16">
                <div className="max-w-4xl mx-auto px-4 py-8 text-center">
                    <p className="text-gray-600">
                        ¿Alguna duda? Consultá con nuestro personal
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                        Menú Digital - Todos los precios incluyen IVA
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default Menu;