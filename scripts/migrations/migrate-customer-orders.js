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

async function migrateCustomerOrders() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'customerOrders'...");

    try {
        const snapshot = await db.collection('customerOrders').get(); // Assuming camelCase in Firebase
        console.log(`Found ${snapshot.size} customer orders in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Text Fields
            const customerName = data.customerName || data.customer_name || 'Unknown Customer';
            const customerType = data.customerType || data.customer_type || 'regular';
            const orderSource = data.orderSource || data.order_source || 'app';
            const status = data.status || 'pending';
            const dispatchStatus = data.dispatchStatus || data.dispatch_status || 'unassigned';
            const paymentMode = data.paymentMode || data.payment_mode || 'cash';

            // Financials
            const subtotal = parseFloat(data.subtotal) || 0.00;
            const serviceFee = parseFloat(data.serviceFee || data.service_fee) || 0.00;
            const grandTotal = parseFloat(data.grandTotal || data.grand_total) || 0.00;

            // JSON Array
            const storeBreakdown = JSON.stringify(data.storeBreakdown || data.store_breakdown || []);

            // Timestamps
            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();

            try {
                await pool.query(
                    `INSERT INTO customer_orders (
            id, customer_name, customer_type, order_source, status, dispatch_status, 
            subtotal, service_fee, grand_total, payment_mode, store_breakdown, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, customerName, customerType, orderSource, status, dispatchStatus,
                        subtotal, serviceFee, grandTotal, paymentMode, storeBreakdown, createdAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} customer orders. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateCustomerOrders();