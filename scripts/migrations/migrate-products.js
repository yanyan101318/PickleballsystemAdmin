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

async function migrateProducts() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'products' (Subcollections)...");

    try {
        // 🛠️ Use collectionGroup to pull from ALL nested stores at once
        const productsSnapshot = await db.collectionGroup('products').get();
        console.log(`Found ${productsSnapshot.size} nested products in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of productsSnapshot.docs) {
            const data = doc.data();

            // 🛠️ Dynamically extract the store_id from the Firebase document path
            // Path looks like: stores/STORE_ID/products/PRODUCT_ID
            const storeId = doc.ref.parent.parent ? doc.ref.parent.parent.id : null;

            const name = data.name || 'Unnamed Product';
            const description = data.description || '';

            const price = parseFloat(data.price) || 0.00;
            const stock = parseInt(data.stock, 10) || parseInt(data.quantity, 10) || 0;
            const quantity = parseInt(data.quantity, 10) || 0;

            const available = data.available !== undefined ? data.available : true;
            const productImage = data.productImage || data.product_image || null;

            const updatedAt = parseSafeDate(data.updatedAt || data.updated_at) || new Date();
            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();

            try {
                await pool.query(
                    `INSERT INTO products 
           (id, store_id, name, description, price, stock, quantity, available, product_image, updated_at, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO NOTHING`,
                    [doc.id, storeId, name, description, price, stock, quantity, available, productImage, updatedAt, createdAt]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} products.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateProducts();