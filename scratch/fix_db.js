const pool = require('../config/db');

async function fixDb() {
  try {
    const res = await pool.query(`UPDATE courts SET amenities = '[]'::jsonb WHERE jsonb_typeof(amenities) = 'object' AND amenities = '{}'::jsonb`);
    console.log(`Updated ${res.rowCount} rows in courts.`);
    
    // Also null out any empty objects if any exist that should be null/empty array
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

fixDb();
