const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'votacion',
    port: process.env.DB_PORT || 3306
});

connection.connect(err => {
    if (err) {
        console.error('Error al conectar a la base de datos MySQL:', err);
        return;
    }
    console.log('✅ Conectado correctamente a la base de datos MySQL');

    // Verificar que existan datos de prueba, si no, insertarlos
    initializeDatabase();
});

function initializeDatabase() {
    // Verificar si existen candidatos, si no, crear algunos de prueba
    connection.query('SELECT COUNT(*) as count FROM candidatos', (err, results) => {
        if (err) {
            console.error('Error al verificar candidatos:', err);
            return;
        }

        if (results[0].count === 0) {
            console.log('Insertando candidatos de prueba...');
            const candidatos = [
                ['Andrés Molina'],
                ['Carlos Castillo']
            ];

            connection.query('INSERT INTO candidatos (nombre) VALUES ?',
                [candidatos.map(c => [c[0]])],
                (err) => {
                    if (err) {
                        console.error('Error al insertar candidatos:', err);
                        return;
                    }
                    console.log('✅ Candidatos de prueba insertados correctamente');
                }
            );
        }
    });
}

module.exports = connection;