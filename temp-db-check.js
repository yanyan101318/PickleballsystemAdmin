const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ user: 'postgres', password: 'converge', host: 'localhost', database: 'ranaw_pickleball', port: 5432 });
  try {
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='borrow_records'");
    console.log(cols.rows.map(r => r.column_name).join(', '));
  } finally {
    pool.end();
  }
})();
