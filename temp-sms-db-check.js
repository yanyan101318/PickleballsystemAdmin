const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ user: 'postgres', password: 'converge', host: 'localhost', database: 'ranaw_pickleball', port: 5432 });
  try {
    const tbl = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='sms_logs'");
    console.log('sms_logs exists:', tbl.rows.length > 0);
    if (tbl.rows.length > 0) {
      const cols = await pool.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_name='sms_logs' ORDER BY ordinal_position");
      console.log('sms_logs columns:');
      cols.rows.forEach(r => console.log(`  ${r.column_name} (${r.data_type})`));
    }
  } catch (err) {
    console.error('error:', err.message);
  } finally {
    await pool.end();
  }
})();
