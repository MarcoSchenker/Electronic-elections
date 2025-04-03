import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Bar } from 'react-chartjs-2';

const socket = io('http://13.216.166.251:3000');

export default function Dashboard() {
    const [votos, setVotos] = useState({});

    useEffect(() => {
        fetch('http://13.216.166.251/votos')
            .then(res => res.json())
            .then(data => {
                const votosIniciales = {};
                data.forEach(voto => votosIniciales[voto.candidato] = voto.total);
                setVotos(votosIniciales);
            });

        socket.on('nuevoVoto', (candidato) => {
            setVotos(prevVotos => ({
                ...prevVotos,
                [candidato]: (prevVotos[candidato] || 0) + 1
            }));
        });
    }, []);

    const data = {
        labels: Object.keys(votos),
        datasets: [{
            label: 'Votos',
            data: Object.values(votos),
            backgroundColor: ['blue', 'red'],
        }]
    };

    return (
        <div>
            <h1>Resultados en Tiempo Real</h1>
            <Bar data={data} />
        </div>
    );
}
