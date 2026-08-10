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

async function migrateStores() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'stores'...");

    try {
        const storesSnapshot = await db.collection('stores').get();
        console.log(`Found ${storesSnapshot.size} stores in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of storesSnapshot.docs) {
            const data = doc.data();

            // Data Mapping & Fallbacks tailored to your DBeaver columns
            const name = data.name || data.ownerName || 'Unnamed Store';
            const status = data.status || 'active'; // Defaulting to active if missing
            const category = data.category || '';
            const description = data.description || '';

            // Numbers & Float conversions
            const estimatedPrepMinutes = parseInt(data.estimated_prep_minutes || data.prepTimeMinutes, 10) || 0;
            const commissionRate = parseFloat(data.commission_rate || data.commissionRate) || 0.00;

            const logoUrl = data.logo_url || data.logoUrl || null;
            const createdAt = parseSafeDate(data.created_at || data.createdAt) || new Date();

            // 🛡️ The Tank (Inner Try-Catch)
            try {
                await pool.query(
                    `INSERT INTO stores (
            id, name, status, category, description, 
            estimated_prep_minutes, logo_url, commission_rate, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, name, status, category, description,
                        estimatedPrepMinutes, logoUrl, commissionRate, createdAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} stores. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateStores();