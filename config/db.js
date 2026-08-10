const { Pool } = require('pg');
require('dotenv').config();

// This Pool uses the exact variables from the .env file we created earlier!
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test the connection
pool.on('connect', () => {
    console.log('Successfully connected to PostgreSQL Database!');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;