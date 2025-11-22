import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import QRCodeLib from 'qrcode';

const QRCode = () => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [menuUrl, setMenuUrl] = useState('');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const navigate = useNavigate();
    const { logout } = useAuth();

    useEffect(() => {
        // Obtener la URL actual del menú
        const url = `${window.location.origin}/menu`;
        setMenuUrl(url);
        generateQRCode(url);
    }, []);

    const generateQRCode = async (url: string) => {
        if (canvasRef.current) {
            try {
                await QRCodeLib.toCanvas(canvasRef.current, url, {
                    width: 400,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF',
                    },
                });

                // Convertir el canvas a imagen para descargar
                const dataUrl = canvasRef.current.toDataURL('image/png');
                setQrCodeUrl(dataUrl);
            } catch (error) {
                console.error('Error al generar QR:', error);
            }
        }
    };

    const handleDownload = () => {
        const link = document.createElement('a');
        link.download = 'menu-qr-code.png';
        link.href = qrCodeUrl;
        link.click();
    };

    const handlePrint = () => {
        window.print();
    };

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header - No se imprime */}
            <header className="bg-white shadow print:hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900">📱 Código QR del Menú</h1>
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
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-3">
                            Código QR del Menú Digital
                        </h2>
                        <p className="text-gray-600">
                            Descargá o imprimí este código QR para colocarlo en tus mesas
                        </p>
                    </div>

                    {/* QR Code */}
                    <div className="flex flex-col items-center space-y-6">
                        {/* Canvas del QR */}
                        <div className="bg-white p-8 rounded-2xl shadow-xl border-4 border-gray-200">
                            <canvas ref={canvasRef} className="block"></canvas>
                        </div>

                        {/* URL del menú */}
                        <div className="w-full max-w-md">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                URL del Menú:
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={menuUrl}
                                    readOnly
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(menuUrl);
                                        alert('URL copiada al portapapeles');
                                    }}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                                >
                                    📋 Copiar
                                </button>
                            </div>
                        </div>

                        {/* Botones de acción - No se imprimen */}
                        <div className="flex gap-4 print:hidden">
                            <button
                                onClick={handleDownload}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-md flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                📥 Descargar PNG
                            </button>

                            <button
                                onClick={handlePrint}
                                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all font-semibold shadow-md flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                🖨️ Imprimir
                            </button>
                        </div>

                        {/* Instrucciones */}
                        <div className="w-full max-w-2xl mt-8 print:hidden">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
                                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    Instrucciones de uso:
                                </h3>
                                <ul className="space-y-2 text-sm text-blue-800">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold">1.</span>
                                        <span>Descargá o imprimí el código QR</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold">2.</span>
                                        <span>Colocalo en un lugar visible en cada mesa</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold">3.</span>
                                        <span>Los clientes pueden escanear el QR con la cámara de su celular</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold">4.</span>
                                        <span>Automáticamente se abrirá el menú digital en su navegador</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Estilos para impresión */}
            <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          canvas, canvas * {
            visibility: visible;
          }
          canvas {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
        </div>
    );
};

export default QRCode;