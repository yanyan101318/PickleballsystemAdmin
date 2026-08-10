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

async function migrateCustomers() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'customers'...");

    try {
        const customersSnapshot = await db.collection('customers').get();
        console.log(`Found ${customersSnapshot.size} customers in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of customersSnapshot.docs) {
            const data = doc.data();

            // Explicitly synced to your DBeaver columns
            const userId = data.user_id || data.userId || null;
            const fullName = data.name || data.fullName || data.customerName || 'Unknown Customer';
            const contactNumber = data.phone || data.phoneNumber || data.contactNumber || data.contact_number || '';
            const email = data.email || '';

            // Float conversion for money
            const totalSpent = parseFloat(data.total_spent || data.totalSpent) || 0.00;

            const createdAt = parseSafeDate(data.created_at || data.createdAt) || new Date();
            const updatedAt = parseSafeDate(data.updated_at || data.updatedAt) || new Date();

            // 🛡️ The Tank (Inner Try-Catch)
            try {
                await pool.query(
                    `INSERT INTO customers (
            id, user_id, full_name, contact_number, email, total_spent, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id,
                        userId,
                        fullName,
                        contactNumber,
                        email,
                        totalSpent,
                        createdAt,
                        updatedAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on Customer ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} customers. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateCustomers();