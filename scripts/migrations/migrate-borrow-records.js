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

async function migrateBorrowRecords() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'borrowRecords'...");

    try {
        const borrowSnapshot = await db.collection('borrowRecords').get();
        console.log(`Found ${borrowSnapshot.size} borrow records in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of borrowSnapshot.docs) {
            const data = doc.data();

            // Basic Info
            const borrowerName = data.borrowerName || data.borrower_name || 'Unknown Borrower';
            const status = data.status || 'pending';

            // 📦 JSON Arrays (Stringified for safe PostgreSQL insertion)
            const items = JSON.stringify(data.items || []);
            const extensionHistory = JSON.stringify(data.extensionHistory || data.extension_history || []);

            // Timestamps
            const borrowedAt = parseSafeDate(data.borrowedAt || data.borrowed_at);
            const expectedReturnAt = parseSafeDate(data.expectedReturnAt || data.expected_return_at);
            const actualReturnAt = parseSafeDate(data.actualReturnAt || data.actual_return_at);
            const createdAt = parseSafeDate(data.createdAt || data.created_at) || new Date();

            // Numerics & Financials
            const hoursInitial = parseFloat(data.hoursInitial || data.hours_initial) || 0;
            const estimatedRentalCharge = parseFloat(data.estimatedRentalCharge || data.estimated_rental_charge) || 0.00;
            const rentalCharge = parseFloat(data.rentalCharge || data.rental_charge) || 0.00;
            const overdueCharge = parseFloat(data.overdueCharge || data.overdue_charge) || 0.00;
            const lateHours = parseFloat(data.lateHours || data.late_hours) || 0;
            const totalCharge = parseFloat(data.totalCharge || data.total_charge) || 0.00;

            // 🛡️ The Tank
            try {
                await pool.query(
                    `INSERT INTO borrow_records (
            id, borrower_name, items, status, borrowed_at, expected_return_at, 
            actual_return_at, hours_initial, estimated_rental_charge, rental_charge, 
            overdue_charge, late_hours, total_charge, extension_history, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, borrowerName, items, status, borrowedAt, expectedReturnAt,
                        actualReturnAt, hoursInitial, estimatedRentalCharge, rentalCharge,
                        overdueCharge, lateHours, totalCharge, extensionHistory, createdAt
                    ]
                );
                successCount++;
            } catch (err) {
                console.error(`❌ DB Error on Record ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} borrow records. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateBorrowRecords();