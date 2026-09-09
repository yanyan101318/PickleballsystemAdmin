const fs = require('fs');
let data = fs.readFileSync('server.js', 'utf8');
data = data.replace(/'NOTIFY chat_events, \$1'/g, '`SELECT pg_notify(\'chat_events\', $1)`');
fs.writeFileSync('server.js', data);
console.log('Fixed NOTIFY in server.js');
