const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;
const db = require('./db');
const dotenv = require('dotenv');

// Middleware
app.use(cors());
app.use(express.json());

// Rutas principales
app.get('/', (req, res) => {
    res.send('API funcionando');
});

// Obtener todos los candidatos
app.get('/api/candidatos', (req, res) => {
    const query = 'SELECT * FROM candidatos ORDER BY id_candidato ASC';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener candidatos:', err);
            return res.status(500).json({ error: 'Error al obtener candidatos' });
        }
        res.status(200).json(results);
    });
});

// Agregar un nuevo candidato
app.post('/api/candidatos', (req, res) => {
    const { nombre, descripcion } = req.body;

    if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre del candidato es requerido' });
    }

    const query = 'INSERT INTO candidatos (nombre, descripcion) VALUES (?, ?)';

    db.query(query, [nombre, descripcion || ''], (err, result) => {
        if (err) {
            console.error('Error al agregar candidato:', err);
            return res.status(500).json({ error: 'Error al agregar candidato' });
        }
        res.status(201).json({
            mensaje: 'Candidato agregado correctamente',
            id_candidato: result.insertId
        });
    });
});

app.delete('/api/candidatos/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM candidatos WHERE id_candidato = ?';

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar candidato:', err);
            return res.status(500).json({ error: 'Error al eliminar candidato' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Candidato no encontrado' });
        }

        res.status(200).json({ mensaje: 'Candidato eliminado correctamente' });
    });
});

// Obtener estadísticas de votación
app.get('/api/estadisticas', (req, res) => {
    const query = `
        SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
        FROM candidatos c
        LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
        GROUP BY c.id_candidato
        ORDER BY total_votos DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener estadísticas:', err);
            return res.status(500).json({ error: 'Error al obtener estadísticas' });
        }
        res.status(200).json(results);
    });
});

// Obtener estadísticas por región
app.get('/api/estadisticas/region/:region', (req, res) => {
    const { region } = req.params;

    // Aquí podrías filtrar por región si tuvieras esa columna en tu base de datos
    // Por ahora devolvemos todos los datos
    const query = `
        SELECT c.id_candidato, c.nombre, COUNT(v.id_voto) as total_votos
        FROM candidatos c
        LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
        GROUP BY c.id_candidato
        ORDER BY total_votos DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener estadísticas por región:', err);
            return res.status(500).json({ error: 'Error al obtener estadísticas por región' });
        }
        res.status(200).json(results);
    });
});

// Autenticar usuario por huella digital
app.post('/api/autenticar', (req, res) => {
    const { id_huella } = req.body;

    if (!id_huella) {
        return res.status(400).json({ error: 'Se requiere ID de huella' });
    }

    const query = 'SELECT * FROM usuarios WHERE id_huella = ?';

    db.query(query, [id_huella], (err, results) => {
        if (err) {
            console.error('Error al autenticar usuario:', err);
            return res.status(500).json({ error: 'Error al autenticar usuario' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.status(200).json({ usuario: results[0] });
    });
});

// Registrar un nuevo usuario con huella
app.post('/api/usuarios', (req, res) => {
    const { id_huella } = req.body;

    if (!id_huella) {
        return res.status(400).json({ error: 'Se requiere ID de huella' });
    }

    // Verificar si el usuario ya existe
    const checkQuery = 'SELECT * FROM usuarios WHERE id_huella = ?';

    db.query(checkQuery, [id_huella], (err, results) => {
        if (err) {
            console.error('Error al verificar usuario:', err);
            return res.status(500).json({ error: 'Error al verificar usuario' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'El usuario ya existe' });
        }

        // Registrar el nuevo usuario
        const insertQuery = 'INSERT INTO usuarios (id_huella) VALUES (?)';

        db.query(insertQuery, [id_huella], (err, result) => {
            if (err) {
                console.error('Error al registrar usuario:', err);
                return res.status(500).json({ error: 'Error al registrar usuario' });
            }

            res.status(201).json({
                mensaje: 'Usuario registrado exitosamente',
                id_usuario: result.insertId
            });
        });
    });
});

// Registrar un voto
app.post('/api/votar', (req, res) => {
    const { id_usuario, id_candidato } = req.body;

    if (!id_usuario || !id_candidato) {
        return res.status(400).json({ error: 'Se requieren ID de usuario e ID de candidato' });
    }

    // Verificar si el usuario ya votó
    const checkQuery = 'SELECT * FROM votaciones WHERE id_usuario = ?';

    db.query(checkQuery, [id_usuario], (err, results) => {
        if (err) {
            console.error('Error al verificar voto previo:', err);
            return res.status(500).json({ error: 'Error al verificar voto previo' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'El usuario ya ha votado' });
        }

        // Registrar el voto
        const insertQuery = 'INSERT INTO votaciones (id_usuario, id_candidato) VALUES (?, ?)';

        db.query(insertQuery, [id_usuario, id_candidato], (err, result) => {
            if (err) {
                console.error('Error al registrar voto:', err);
                return res.status(500).json({ error: 'Error al registrar voto' });
            }

            res.status(201).json({ mensaje: 'Voto registrado exitosamente', id_voto: result.insertId });
        });
    });
});

// Obtener top líderes
app.get('/api/lideres', (req, res) => {
    const query = `
        SELECT c.id_candidato, c.nombre, 
               COUNT(v.id_voto) as votos_validos,
               (SELECT COUNT(*) FROM votaciones v2 WHERE v2.id_candidato = c.id_candidato) as votos_totales,
               CASE 
                  WHEN c.id_candidato % 2 = 0 THEN 'down'
                  ELSE 'up'
               END as tendencia
        FROM candidatos c
        LEFT JOIN votaciones v ON c.id_candidato = v.id_candidato
        GROUP BY c.id_candidato
        ORDER BY votos_validos DESC
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener líderes:', err);
            return res.status(500).json({ error: 'Error al obtener líderes' });
        }
        res.status(200).json(results);
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🔥 Servidor escuchando en http://localhost:${PORT}`);
});