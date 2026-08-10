const fs = require('fs');

// 4. Fix Book.jsx (add syncState mock)
let book = fs.readFileSync('src/components/Book.jsx', 'utf8');
book = book.replace(/const wrapSync = async \(p\) => p;/, 'const wrapSync = async (p) => p;\n  const syncState = "online";\n  const setSyncState = () => {};');
fs.writeFileSync('src/components/Book.jsx', book);

console.log('Book fixed');
