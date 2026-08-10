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

async function migrateAnnouncements() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'announcements'...");

    try {
        const snapshot = await db.collection('announcements').get();
        console.log(`Found ${snapshot.size} announcements in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            const title = data.title || 'Untitled Announcement';
            const message = data.message || data.description || '';
            const type = data.type || 'general';
            const createdBy = data.createdBy || data.created_by || 'system';

            // Strict Boolean checking
            const isActive = (data.isActive !== undefined) ? !!data.isActive :
                (data.is_active !== undefined) ? !!data.is_active : false;

            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();

            try {
                await pool.query(
                    `INSERT INTO announcements (
            id, title, message, type, is_active, created_by, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7
          ) ON CONFLICT (id) DO NOTHING`,
                    [doc.id, title, message, type, isActive, createdBy, createdAt]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} announcements. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateAnnouncements();