require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pickleball_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

pool.query('NOTIFY chat_events, $1', [JSON.stringify({ test: 1 })])
  .then(res => console.log('Success'))
  .catch(err => console.error('DB Error:', err.message))
  .finally(() => pool.end());
