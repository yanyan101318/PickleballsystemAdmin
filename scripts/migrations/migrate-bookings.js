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

async function migrateBookings() {
    console.log("🚀 Starting Firebase to PostgreSQL Migration for 'bookings'...");

    try {
        const bookingsSnapshot = await db.collection('bookings').get();
        console.log(`Found ${bookingsSnapshot.size} bookings in Firebase. Moving them now...`);

        let successCount = 0;
        let skipCount = 0;

        for (const doc of bookingsSnapshot.docs) {
            const data = doc.data();

            // 1. Identifiers & Contact Info
            const userId = data.user_id || data.userId || null;
            const playerName = data.player_name || data.playerName || 'Unknown Player';
            const contactNumber = data.contact_number || data.contactNumber || '';
            const email = data.email || '';

            // 2. Court Info
            const courtId = data.court_id || data.courtId || null;
            const courtName = data.court_name || data.courtName || 'Unknown Court';

            // 3. Scheduling
            const bookingDate = parseSafeDate(data.booking_date || data.bookingDate) || new Date();
            const timeSlot = data.time_slot || data.timeSlot || '';
            const startTime = data.start_time || data.startTime || '';
            const endTime = data.end_time || data.endTime || '';
            const duration = parseFloat(data.duration) || 0;
            const playersCount = parseInt(data.players, 10) || 1; // Assuming at least 1 player
            const status = data.status || 'pending';

            // 4. Financials
            const totalAmount = parseFloat(data.total_amount || data.totalAmount) || 0.00;
            const amountPaid = parseFloat(data.amount_paid || data.amountPaid) || 0.00;
            const remainingBalance = parseFloat(data.remaining_balance || data.remainingBalance) || 0.00;
            const hourlyRate = parseFloat(data.hourly_rate || data.hourlyRate) || 0.00;
            const paymentPlan = data.payment_plan || data.paymentPlan || '';
            const paymentMethod = data.payment_method || data.paymentMethod || '';

            // 🛡️ The Tank (Inner Try-Catch)
            try {
                await pool.query(
                    `INSERT INTO bookings (
            id, user_id, player_name, contact_number, email, 
            court_id, court_name, booking_date, time_slot, start_time, 
            end_time, duration, players, status, total_amount, 
            amount_paid, remaining_balance, hourly_rate, payment_plan, payment_method
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          ) ON CONFLICT (id) DO NOTHING`,
                    [
                        doc.id, userId, playerName, contactNumber, email,
                        courtId, courtName, bookingDate, timeSlot, startTime,
                        endTime, duration, playersCount, status, totalAmount,
                        amountPaid, remainingBalance, hourlyRate, paymentPlan, paymentMethod
                    ]
                );
                successCount++;
            } catch (err) {
                // Log the exact constraint that failed so we can fix it if needed
                console.error(`❌ DB Error on ID [${doc.id}]:`, err.message);
                skipCount++;
            }
        }

        console.log(`\n✅ Migration Complete! Successfully moved ${successCount} bookings. Skipped/Failed: ${skipCount}.`);
    } catch (error) {
        console.error("❌ Fatal Migration Error:", error);
    } finally {
        process.exit(0);
    }
}

migrateBookings();