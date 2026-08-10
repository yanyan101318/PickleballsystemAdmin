const admin = require('firebase-admin');
const pool = require('./db');
const serviceAccount = require('./firebase-key.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

function parseSafeDate(val) {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val._seconds !== undefined) return new Date(val._seconds * 1000);
    return new Date(val);
}

async function migrateOrders() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'orders'...");

    try {
        const snapshot = await db.collectionGroup('vendorOrders').get();
        console.log(`Found ${snapshot.size} orders in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Relational IDs
            const storeId = data.storeId || data.store_id || null;
            const customerOrderId = data.customerOrderId || data.customer_order_id || null;
            const courtId = data.courtId || data.court_id || null;

            // Text Fields
            const storeName = data.storeName || data.store_name || 'Unknown Store';
            const customerName = data.customerName || data.customer_name || 'Unknown Customer';
            const playerName = data.playerName || data.player_name || 'Unknown Player';
            const status = data.status || 'pending';
            const paymentBadge = data.paymentBadge || data.payment_badge || 'unpaid';

            // Financials
            const subtotal = parseFloat(data.subtotal) || 0.00;

            // JSON Array
            const items = JSON.stringify(data.items || []);

            // Timestamps
            const transferredAt = parseSafeDate(data.transferredAt || data.transferred_at);
            const completedAt = parseSafeDate(data.completedAt || data.completed_at);
            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();

            try {
                await pool.query(
                    `INSERT INTO orders (
            id, store_id, customer_order_id, court_id, store_name, customer_name, player_name, 
            status, subtotal, payment_badge, items, transferred_at, completed_at, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, storeId, customerOrderId, courtId, storeName, customerName, playerName,
                        status, subtotal, paymentBadge, items, transferredAt, completedAt, createdAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} orders. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateOrders();