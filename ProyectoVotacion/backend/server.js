require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const mqtt = require('mqtt');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ['GET', 'POST']
    }
});

// Middleware de seguridad
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
}));
app.use(express.json());

// Variables de entorno (crear archivo .env)
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'usuario_mysql';
const DB_PASS = process.env.DB_PASS || 'contraseña_mysql';
const DB_NAME = process.env.DB_NAME || 'votacion';
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost';
const MQTT_USER = process.env.MQTT_USER;
const MQTT_PASS = process.env.MQTT_PASS;
const PORT = process.env.PORT || 3000;

// Conexión a MySQL con pool de conexiones
const dbPool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Crear tablas si no existen
async function initializeDB() {
    try {
        const connection = await dbPool.getConnection();

        // Tabla de usuarios (personas que han votado)
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        huella VARCHAR(255) NOT NULL UNIQUE,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Tabla de votos
        await connection.execute(`
      CREATE TABLE IF NOT EXISTS votos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato VARCHAR(255) NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        connection.release();
        console.log('Base de datos inicializada correctamente');
    } catch (err) {
        console.error('Error inicializando la base de datos:', err);
        process.exit(1);
    }
}

// Opciones MQTT
const mqttOptions = {
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000
};

// Agregar credenciales si están disponibles
if (MQTT_USER && MQTT_PASS) {
    mqttOptions.username = MQTT_USER;
    mqttOptions.password = MQTT_PASS;
}

// Conectar a MQTT
const mqttClient = mqtt.connect(MQTT_URL, mqttOptions);

mqttClient.on('connect', () => {
    console.log('Conectado a MQTT');
    mqttClient.subscribe('votacion', (err) => {
        if (err) {
            console.error('Error al suscribirse al topic:', err);
        }
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log('Mensaje MQTT recibido:', data);

        if (data.accion === 'voto') {
            const candidato = data.candidato;
            console.log(`Nuevo voto por: ${candidato}`);

            // Insertar voto en la base de datos
            await dbPool.execute(
                'INSERT INTO votos (candidato, timestamp) VALUES (?, NOW())',
                [candidato]
            );

            // Emitir evento a clientes conectados
            io.emit('nuevoVoto', candidato);

        } else if (data.accion === 'registro') {
            const huella = data.huella;
            console.log(`Registrando huella: ${huella}`);

            try {
                await dbPool.execute(
                    'INSERT INTO usuarios (huella) VALUES (?)',
                    [huella]
                );
                console.log('Huella registrada correctamente');
            } catch (dbErr) {
                if (dbErr.code === 'ER_DUP_ENTRY') {
                    console.log('Huella ya registrada, ignorando');
                } else {
                    throw dbErr;
                }
            }
        }
    } catch (err) {
        console.error('Error procesando mensaje MQTT:', err);
    }
});

mqttClient.on('error', (err) => {
    console.error('Error MQTT:', err);
});

// API para obtener votos
app.get('/votos', async (req, res) => {
    try {
        const [rows] = await dbPool.execute(
            'SELECT candidato, COUNT(*) AS total FROM votos GROUP BY candidato'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error al obtener votos:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// API para verificar si una huella ya votó
app.post('/verificar-huella', async (req, res) => {
    try {
        const { huella } = req.body;

        if (!huella) {
            return res.status(400).json({ error: 'Se requiere el parámetro huella' });
        }

        const [rows] = await dbPool.execute(
            'SELECT * FROM usuarios WHERE huella = ?',
            [huella]
        );

        res.json({ registrado: rows.length > 0 });
    } catch (err) {
        console.error('Error al verificar huella:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Estadísticas generales
app.get('/estadisticas', async (req, res) => {
    try {
        const [totalVotos] = await dbPool.execute('SELECT COUNT(*) as total FROM votos');
        const [totalVotantes] = await dbPool.execute('SELECT COUNT(*) as total FROM usuarios');

        res.json({
            totalVotos: totalVotos[0].total,
            totalVotantes: totalVotantes[0].total
        });
    } catch (err) {
        console.error('Error al obtener estadísticas:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Socket.io para comunicación en tiempo real
io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

// Inicializar sistema
async function iniciarServidor() {
    try {
        await initializeDB();

        server.listen(PORT, () => {
            console.log(`Servidor escuchando en el puerto ${PORT}`);
        });
    } catch (err) {
        console.error('Error al iniciar el servidor:', err);
        process.exit(1);
    }
}

iniciarServidor();

// Manejo de cierre gracioso
process.on('SIGTERM', async () => {
    console.log('Cerrando servidor...');
    await dbPool.end();
    mqttClient.end();
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});