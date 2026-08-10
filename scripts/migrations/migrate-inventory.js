const admin = require('firebase-admin');
const pool = require('./db');
const serviceAccount = require('./firebase-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 🛠️ The Bulletproof Date Parser
function parseSafeDate(val) {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val._seconds !== undefined) return new Date(val._seconds * 1000);
    return new Date(val);
}

async function migrateInventory() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'inventoryItems'...");

    try {
        // Calling the exact camelCase Firebase collection name
        const inventorySnapshot = await db.collection('inventoryItems').get();
        console.log(`Found ${inventorySnapshot.size} items in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of inventorySnapshot.docs) {
            const data = doc.data();

            // Text mapping
            const type = data.type || 'equipment'; // Fallback if missing in Firebase
            const category = data.category || '';
            const name = data.name || 'Unnamed Item';
            const notes = data.notes || '';

            // Float conversions for pricing
            const price = parseFloat(data.price) || 0.00;
            const pricePerHour = parseFloat(data.pricePerHour || data.price_per_hour) || 0.00;
            const overdueFinePerHour = parseFloat(data.overdueFinePerHour || data.overdue_fine_per_hour) || 0.00;

            // Integer conversions for quantities
            const availableQty = parseInt(data.availableQty || data.available_qty, 10) || 0;
            const totalQty = parseInt(data.totalQty || data.total_qty, 10) || 0;

            // Timestamps
            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();
            const updatedAt = parseSafeDate(data.updatedAt || data.updated_at) || new Date();

            // 🛡️ The Tank
            try {
                await pool.query(
                    `INSERT INTO inventory_items (
            id, type, category, name, notes, price, price_per_hour, 
            overdue_fine_per_hour, available_qty, total_qty, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, type, category, name, notes, price, pricePerHour,
                        overdueFinePerHour, availableQty, totalQty, createdAt, updatedAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on Item ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} inventory items. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateInventory();