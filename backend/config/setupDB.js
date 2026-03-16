const mariadb = require('mariadb');

async function setupDB() {
    let conn;
    try {
        // First connect without database to create it
        conn = await mariadb.createConnection({
            host: 'localhost',
            user: 'appuser',
            password: 'password'
        });

        await conn.query('CREATE DATABASE IF NOT EXISTS logindb');
        await conn.query('USE logindb');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);
        await conn.query(`
            INSERT IGNORE INTO users (username, password) VALUES ('admin', 'password')
        `);

        console.log('Database and table created, sample user inserted.');
    } catch (err) {
        console.error('Error setting up DB:', err.message);
    } finally {
        if (conn) conn.end();
    }
}

setupDB();