require('dotenv').config();
const pool = require('./db');

async function migrateAuthSchema() {
  console.log('🚀 Adding auth columns to users table...');
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    `);
    console.log('✅ Columns added: password_hash, phone');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrateAuthSchema();
