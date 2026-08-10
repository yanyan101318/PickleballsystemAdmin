require('dotenv').config();
const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const pool = require('./db');

async function testRegister() {
  const name = 'Test Admin';
  const email = `test_${Date.now()}@ranaw.com`;
  const phone = '09171234567';
  const password = 'test1234';

  try {
    // Check duplicate
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('❌ Email already exists');
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newId = randomUUID();

    const result = await pool.query(
      `INSERT INTO users (id, email, display_name, phone, role, password_hash, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id, email, display_name, role`,
      [newId, email.trim(), name.trim(), phone.trim(), 'admin', password_hash, true]
    );

    console.log('✅ Register SUCCESS:', JSON.stringify(result.rows[0], null, 2));
  } catch (err) {
    console.error('❌ Register FAILED:', err.message);
  } finally {
    process.exit(0);
  }
}

testRegister();
