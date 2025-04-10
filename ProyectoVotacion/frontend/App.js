import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';

// Registrar componentes necesarios de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

// Variables de entorno (usar .env en React)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export default function Dashboard() {
    const [votos, setVotos] = useState({});
    const [estadisticas, setEstadisticas] = useState({
        totalVotos: 0,
        totalVotantes: 0
    });
    const [tipoGrafica, setTipoGrafica] = useState('bar');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);

    // Colores para los candidatos
    const colores = {
        'Marco': 'rgba(54, 162, 235, 0.8)',
        'Nacu': 'rgba(255, 99, 132, 0.8)'
    };

    // Conectar a socket.io y cargar datos iniciales
    useEffect(() => {
        // Cargar votos iniciales
        const cargarVotos = async () => {
            try {
                const respuesta = await axios.get(`${API_URL}/votos`);
                const votosIniciales = {};
                respuesta.data.forEach(voto => {
                    votosIniciales[voto.candidato] = voto.total;
                });
                setVotos(votosIniciales);
            } catch (err) {
                console.error('Error al cargar votos:', err);
                setError('Error al cargar los datos de votación');
            } finally {
                setCargando(false);
            }
        };

        // Cargar estadísticas
        const cargarEstadisticas = async () => {
            try {
                const respuesta = await axios.get(`${API_URL}/estadisticas`);
                setEstadisticas(respuesta.data);
            } catch (err) {
                console.error('Error al cargar estadísticas:', err);
            }
        };

        // Inicializar socket
        const socketIo = io(SOCKET_URL);
        setSocket(socketIo);

        socketIo.on('connect', () => {
            console.log('Conectado al servidor Socket.IO');
        });

        socketIo.on('nuevoVoto', (candidato) => {
            console.log('Nuevo voto recibido para:', candidato);
            setVotos(prevVotos => ({
                ...prevVotos,
                [candidato]: (prevVotos[candidato] || 0) + 1
            }));
            setEstadisticas(prev => ({
                ...prev,
                totalVotos: prev.totalVotos + 1
            }));
        });

        socketIo.on('connect_error', (err) => {
            console.error('Error de conexión Socket.IO:', err);
            setError('Error de conexión con el servidor');
        });

        cargarVotos();
        cargarEstadisticas();

        // Actualizar datos cada 30 segundos
        const intervalId = setInterval(() => {
            cargarVotos();
            cargarEstadisticas();
        }, 30000);

        // Limpieza
        return () => {
            clearInterval(intervalId);
            if (socketIo) socketIo.disconnect();
        };
    }, []);

    // Preparar datos para gráficas
    const datosGrafica = {
        labels: Object.keys(votos),
        datasets: [{
            label: 'Votos',
            data: Object.values(votos),
            backgroundColor: Object.keys(votos).map(candidato => colores[candidato] || 'rgba(153, 102, 255, 0.8)'),
            borderColor: Object.keys(votos).map(candidato => colores[candidato]?.replace('0.8', '1') || 'rgba(153, 102, 255, 1)'),
            borderWidth: 1
        }]
    };

    // Opciones de gráficas
    const opcionesGrafica = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Resultados de Votación en Tiempo Real',
                font: {
                    size: 18
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const total = Object.values(votos).reduce((a, b) => a + b, 0);
                        const porcentaje = total > 0 ? Math.round((value / total) * 100) : 0;
                        return `${label}: ${value} votos (${porcentaje}%)`;
                    }
                }
            }
        }
    };

    if (cargando) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center">
                    <div className="spinner"></div>
                    <p className="mt-4">Cargando datos de votación...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="text-center bg-red-100 p-6 rounded-lg">
                    <h2 className="text-2xl text-red-700 mb-2">Error</h2>
                    <p>{error}</p>
                    <button
                        className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                        onClick={() => window.location.reload()}
                    >
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <header className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Sistema de Votación Electrónica</h1>
                <p className="text-gray-600">Resultados en tiempo real</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-2">Total de Votos</h2>
                    <p className="text-4xl font-bold text-blue-600">{estadisticas.totalVotos}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-2">Total de Votantes</h2>
                    <p className="text-4xl font-bold text-green-600">{estadisticas.totalVotantes}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-semibold mb-2">Participación</h2>
                    <p className="text-4xl font-bold text-purple-600">
                        {estadisticas.totalVotantes > 0
                            ? `${Math.round((estadisticas.totalVotos / estadisticas.totalVotantes) * 100)}%`
                            : '0%'}
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">Resultados</h2>
                    <div className="flex space-x-2">
                        <button
                            className={`px-4 py-2 rounded ${tipoGrafica === 'bar' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                            onClick={() => setTipoGrafica('bar')}
                        >
                            Barras
                        </button>
                        <button
                            className={`px-4 py-2 rounded ${tipoGrafica === 'pie' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                            onClick={() => setTipoGrafica('pie')}
                        >
                            Pastel
                        </button>
                    </div>
                </div>

                <div className="h-80">
                    {tipoGrafica === 'bar' ? (
                        <Bar data={datosGrafica} options={opcionesGrafica} />
                    ) : (
                        <Pie data={datosGrafica} options={opcionesGrafica} />
                    )}
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold mb-4">Detalle de Votos</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead>
                        <tr>
                            <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left">Candidato</th>
                            <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left">Votos</th>
                            <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left">Porcentaje</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Object.entries(votos).map(([candidato, total]) => {
                            const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);
                            const porcentaje = totalVotos > 0 ? ((total / totalVotos) * 100).toFixed(2) : '0.00';

                            return (
                                <tr key={candidato}>
                                    <td className="py-2 px-4 border-b border-gray-200">
                                        <div className="flex items-center">
                                            <div className="w-4 h-4 mr-2" style={{ backgroundColor: colores[candidato] }}></div>
                                            {candidato}
                                        </div>
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200">{total}</td>
                                    <td className="py-2 px-4 border-b border-gray-200">{porcentaje}%</td>
                                </tr>
                            );
                        })}
                        </tbody>
                        <tfoot>
                        <tr>
                            <td className="py-2 px-4 border-b border-gray-200 font-bold">Total</td>
                            <td className="py-2 px-4 border-b border-gray-200 font-bold">
                                {Object.values(votos).reduce((a, b) => a + b, 0)}
                            </td>
                            <td className="py-2 px-4 border-b border-gray-200 font-bold">100%</td>
                        </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <footer className="mt-8 text-center text-gray-500 text-sm">
                <p>Sistema de Votación Electrónica © {new Date().getFullYear()}</p>
                <p className="mt-1">Estado: {socket?.connected ? 'Conectado' : 'Desconectado'}</p>
            </footer>
        </div>
    );
}