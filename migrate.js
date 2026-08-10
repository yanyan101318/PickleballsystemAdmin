const admin = require('firebase-admin');
const pool = require('./db'); // Your existing PostgreSQL connection
const serviceAccount = require('./firebase-key.json'); // The key you just renamed

// 1. Initialize Firebase Master Access
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function migrateCourts() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'courts'...");

    try {
        // 2. Fetch all courts from Firebase
        const courtsSnapshot = await db.collection('courts').get();
        console.log(`Found ${courtsSnapshot.size} courts in Firebase. Moving them now...`);

        // 3. Loop and Insert into PostgreSQL
        for (const doc of courtsSnapshot.docs) {
            const data = doc.data();

            // Map the data (with fallbacks just in case a field is empty)
            const name = data.name || 'Unnamed Court';
            const description = data.description || '';
            const pricePerHour = data.pricePerHour || 0;
            const amenities = data.amenities || [];
            const isActive = data.isActive !== undefined ? data.isActive : true;

            // Insert into PostgreSQL
            await pool.query(
                `INSERT INTO courts (id, name, description, price_per_hour, amenities, is_active) 
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`, // This prevents crashes if you run it twice
                [doc.id, name, description, pricePerHour, amenities, isActive]
            );
        }

        console.log("✅ Courts migration complete! Check DBeaver or your browser.");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        process.exit(0); // Shuts down the script cleanly
    }
}

migrateCourts();