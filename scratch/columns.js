const pool = require('../config/db');

async function check() {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_items'");
  console.log(res.rows.map(r=>r.column_name));
  process.exit(0);
}
check();
