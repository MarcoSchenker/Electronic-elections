const express = require('express');
const mysql = require('mysql');
const mqtt = require('mqtt');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Configuración de MySQL
const db = mysql.createConnection({
    host: 'IP_PRIVADA_DATABASE',
    user: 'usuario_mysql',
    password: 'contraseña_mysql',
    database: 'votacion'
});

db.connect(err => {
    if (err) {
        console.error('Error conectando a MySQL:', err);
        return;
    }
    console.log('Conectado a MySQL');
});

// Configuración de MQTT
const mqttClient = mqtt.connect('mqtt://IP_PRIVADA_MQTT');

mqttClient.on('connect', () => {
    console.log('Conectado a MQTT');
    mqttClient.subscribe('votacion');
});

mqttClient.on('message', (topic, message) => {
    const [accion, dato] = message.toString().split(':');

    if (accion === 'voto') {
        const candidato = dato;
        console.log(`Nuevo voto por: ${candidato}`);

        db.query('INSERT INTO votos (candidato, timestamp) VALUES (?, NOW())', [candidato], (err) => {
            if (err) {
                console.error('Error guardando el voto en MySQL:', err);
            } else {
                io.emit('nuevoVoto', candidato);
            }
        });
    } else if (accion === 'registro') {
        const huella = dato;
        console.log(`Registrando nueva huella: ${huella}`);

        db.query('INSERT INTO usuarios (huella) VALUES (?)', [huella], (err) => {
            if (err) {
                console.error('Error registrando huella en MySQL:', err);
            } else {
                console.log('Huella registrada correctamente');
            }
        });
    }
});

// API para obtener los votos
app.get('/votos', (req, res) => {
    db.query('SELECT candidato, COUNT(*) AS total FROM votos GROUP BY candidato', (err, results) => {
        if (err) {
            res.status(500).send(err);
            return;
        }
        res.json(results);
    });
});

// API para verificar huella antes de votar
app.post('/verificar-huella', (req, res) => {
    const { huella } = req.body;
    db.query('SELECT * FROM usuarios WHERE huella = ?', [huella], (err, results) => {
        if (err) {
            res.status(500).send(err);
            return;
        }
        res.json({ registrado: results.length > 0 });
    });
});

server.listen(3000, () => {
    console.log('Servidor escuchando en el puerto 3000');
});
