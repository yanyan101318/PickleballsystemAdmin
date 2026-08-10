require('dotenv').config();
const pool = require('./db');

async function checkAllSchemas() {
  const tables = [
    'bookings', 'announcements', 'courts', 'tournaments',
    'inventory_items', 'customers', 'activity_logs',
    'schedule', 'sessions', 'memberships', 'paddle_stacking', 'paddle_sessions'
  ];
  for (const t of tables) {
    try {
      const r = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
        [t]
      );
      if (r.rows.length > 0) {
        console.log(`\n✅ TABLE: ${t}`);
        r.rows.forEach(row => console.log(`   ${row.column_name} (${row.data_type})`));
      } else {
        console.log(`\n❌ NOT FOUND: ${t}`);
      }
    } catch(e) {
      console.log(`\n❌ ERROR on ${t}: ${e.message}`);
    }
  }
  process.exit(0);
}
checkAllSchemas();
