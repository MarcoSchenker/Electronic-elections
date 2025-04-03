const mqtt = require('mqtt');
const mysql = require('mysql2');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());

// Conexión a MySQL
const db = mysql.createConnection({
    host: 'tu-ip-ec2',
    user: 'root',
    password: 'password',
    database: 'votacion'
});

db.connect(err => {
    if (err) throw err;
    console.log("Conectado a la base de datos");
});

// Conectar a MQTT
const client = mqtt.connect('mqtt://broker.hivemq.com');
client.on('connect', () => {
    console.log("Conectado a MQTT");
    client.subscribe('votacion/votos');
});

client.on('message', (topic, message) => {
    const voto = message.toString();
    console.log(`Voto recibido: ${voto}`);
    db.query("INSERT INTO votos (candidato) VALUES (?)", [voto], (err) => {
        if (err) throw err;
        console.log("Voto guardado");
        io.emit('nuevoVoto', voto); // Enviar actualización en tiempo real
    });
});

// API para obtener votos
app.get('/votos', (req, res) => {
    db.query("SELECT candidato, COUNT(*) as total FROM votos GROUP BY candidato", (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

// Iniciar servidor
server.listen(3000, () => {
    console.log("Servidor corriendo en puerto 3000");
});