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

async function migrateUsers() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'users'...");

    try {
        const usersSnapshot = await db.collection('users').get();
        console.log(`Found ${usersSnapshot.size} users in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of usersSnapshot.docs) {
            const data = doc.data();

            const email = data.email || `no-email-${doc.id}@placeholder.com`;
            const displayName = data.displayName || data.name || data.display_name || 'Unnamed User';
            const role = data.role || 'player';
            const isActive = data.isActive !== undefined ? data.isActive : true;

            const lastLogin = parseSafeDate(data.lastLogin);
            const createdAt = parseSafeDate(data.createdAt) || new Date();

            // 🛡️ The Inner Try-Catch (The Tank)
            try {
                await pool.query(
                    `INSERT INTO users (id, email, display_name, role, is_active, last_login, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
                    [doc.id, email, displayName, role, isActive, lastLogin, createdAt]
                );
                successCount++;
            } catch (err) {
                // If it's specifically a duplicate email error (Postgres code 23505)
                if (err.code === '23505') {
                    console.log(`⚠️ Skipped ID [${doc.id}]: Email '${email}' already exists in PostgreSQL.`);
                    skipCount++;
                } else {
                    console.error(`❌ Unexpected error on ID [${doc.id}]:`, err.message);
                }
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} users. Skipped ${skipCount} duplicates.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateUsers();