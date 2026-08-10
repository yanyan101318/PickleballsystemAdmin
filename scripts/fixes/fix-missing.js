const fs = require('fs');

// 1. Fix Book.jsx
let b = fs.readFileSync('src/components/Book.jsx', 'utf8');
// Replace ALL occurrences of the block with a single one
b = b.replace(/const syncState = "online";\r?\n\s*const setSyncState = \(\) => \{\};\r?\n/g, '');
b = b.replace(/const wrapSync = async \(p\) => p;/, 'const wrapSync = async (p) => p;\n  const syncState = "online";\n  const setSyncState = () => {};');
fs.writeFileSync('src/components/Book.jsx', b);

// 2. Fix BookingManager.jsx (re-add missing functions)
let bm = fs.readFileSync('src/admin/BookingManager.jsx', 'utf8');

const missingFunctions = `
  async function applyExtension(booking) {
    toast.error("Extension not yet supported in PG");
  }
  
  function openBalanceModal(b) {
    // mock
    toast.error("Balance modal not fully ported");
  }
  function closeBalanceModal() {
    // mock
  }
  async function settleBalance(bookingId, amount) {
    try {
      await fetch(\`/api/bookings/\${bookingId}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountPaid: amount })
      });
      toast.success("Balance updated");
    } catch(e) { toast.error("Error"); }
  }
`;

// Insert them right after the editBookingField function
bm = bm.replace(/(async function editBookingField[^{]*\{[\s\S]*?\n  \})/, '$1\\n' + missingFunctions);

fs.writeFileSync('src/admin/BookingManager.jsx', bm);
console.log('Fixed missing functions and syncState duplicate');
