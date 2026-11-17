const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace 50 with 49
code = code.replace(/50/g, '49');
// Wait, replacing ALL 50s might break other things, let's be careful.
