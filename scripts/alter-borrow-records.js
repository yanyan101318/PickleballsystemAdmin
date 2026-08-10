const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ user: 'postgres', password: 'converge', host: 'localhost', database: 'ranaw_pickleball', port: 5432 });
  try {
    await pool.query('ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);');
    await pool.query('ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS court VARCHAR(100);');
    await pool.query('ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;');
    console.log('Successfully altered borrow_records table.');
  } catch(e) {
    console.error('Error altering table:', e);
  } finally {
    pool.end();
  }
})();
