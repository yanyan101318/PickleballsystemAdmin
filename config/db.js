const { Pool } = require('pg');
require('dotenv').config();

// This Pool uses the exact variables from the .env file we created earlier!
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
    };

const pool = new Pool(poolConfig);

// Test the connection
pool.on('connect', () => {
    console.log('Successfully connected to PostgreSQL Database!');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;