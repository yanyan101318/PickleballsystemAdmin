require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'pickleball_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

pool.query('UPDATE messages SET text = $1, is_edited = true WHERE id = $2 AND chat_id = $3 RETURNING *', ['', 'msg_mryo5bibxkahmz8u5uh', 'cht_mrynrehonog5ptbqxef'])
  .then(res => console.log('Success:', res.rows))
  .catch(err => console.error('DB Error:', err.message))
  .finally(() => pool.end());
