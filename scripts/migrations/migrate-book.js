const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Book.jsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Remove firebase imports
code = code.replace(/import\s*\{\s*useOfflineSync\s*\}\s*from\s*"..\/hooks\/useOfflineSync";?/g, '');
code = code.replace(/import\s*\{\s*db\s*\}\s*from\s*"..\/firebase";?/g, '');
code = code.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');

// 2. Fix the component hook
code = code.replace(/const\s*\{\s*wrapSync\s*\}\s*=\s*useOfflineSync\(\);/g, '');

// 3. Replace courts and bookings fetch in loadData
code = code.replace(/const\s*cSnap\s*=\s*await\s*getDocs\(collection\(db,\s*"courts"\)\);/g, 'const cRes = await fetch("/api/courts"); const cDocs = await cRes.json(); const cSnap = { docs: cDocs.map(c => ({ id: c.id, data: () => c })) };');
code = code.replace(/let\s*bSnap;\s*if\s*\(qDate\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?\}/g, `const bRes = await fetch(\`/api/bookings\${qDate ? "?date="+qDate : ""}\`); const bDocs = await bRes.json(); const bSnap = { docs: bDocs.map(b => ({ id: b.id, data: () => b })) };`);

// 4. Replace save booking
code = code.replace(/await\s*wrapSync\(\s*addDoc\(collection\(db,\s*"bookings"\),\s*bookingData\),\s*\{[\s\S]*?\}\s*\);/g, `
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });
    if (!res.ok) throw new Error("Failed to save booking");
    const docRef = await res.json();
    toast.success("Booking placed!");
`);

// 5. Replace payment save
code = code.replace(/if\s*\(resolvedPaid\s*>\s*0\)\s*\{[\s\S]*?await\s*addDoc\(collection\(db,\s*"payments"\),\s*paymentData\);[\s\S]*?\}/g, `// payments table removed`);

code = code.replace(/await\s*upsertCustomerAfterBooking\(db,\s*bookingData\);/g, `
    await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: bookingData.userId || null,
        fullName: bookingData.playerName,
        contactNumber: bookingData.contactNumber,
        email: bookingData.email || "",
        totalAmountSpent: bookingData.amountPaid || bookingData.totalAmount || 0
      })
    }).catch(e => console.error("CRM sync error", e));
`);

// Remove serverTimestamp usages and replace with standard ISO strings or null
code = code.replace(/serverTimestamp\(\)/g, 'new Date().toISOString()');

// Replace any leftover docRef.id with docRef.id 
// (our API returns the created object with .id)

fs.writeFileSync(filePath, code);
console.log('Book.jsx migrated to PG API calls.');
