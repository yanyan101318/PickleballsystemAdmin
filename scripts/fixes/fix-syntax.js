const fs = require('fs');

// 1. Fix BookingManager (remove extra closing brace on line 271)
let bm = fs.readFileSync('src/admin/BookingManager.jsx', 'utf8');
bm = bm.replace('  }\n  }\n\n  async function updatePayStatus', '  }\n\n  async function updatePayStatus');
fs.writeFileSync('src/admin/BookingManager.jsx', bm);

// 2. Fix InventoryPage (remove firebase imports)
let inv = fs.readFileSync('src/admin/InventoryPage.jsx', 'utf8');
inv = inv.replace(/import\s*\{\s*db\s*\}\s*from\s*"\.\.\/firebase";?/g, '');
inv = inv.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');
fs.writeFileSync('src/admin/InventoryPage.jsx', inv);

// 3. Fix PaddleStackingPage (remove firebase imports)
let paddle = fs.readFileSync('src/admin/PaddleStackingPage.jsx', 'utf8');
paddle = paddle.replace(/import\s*\{\s*db\s*\}\s*from\s*"\.\.\/firebase";?/g, '');
paddle = paddle.replace(/import\s*\{[^}]*\}\s*from\s*"firebase\/firestore";?/g, '');
fs.writeFileSync('src/admin/PaddleStackingPage.jsx', paddle);

// 4. Fix Book.jsx (add syncState mock)
let book = fs.readFileSync('src/components/Book.jsx', 'utf8');
book = book.replace('const wrapSync = async (p) => p;', 'const wrapSync = async (p) => p;\n  const syncState = "online";\n  const setSyncState = () => {};');
fs.writeFileSync('src/components/Book.jsx', book);

console.log('Fixed syntax and undef errors');
