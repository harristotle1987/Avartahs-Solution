const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/google_maps: !!process\.env\.GOOGLE_MAPS_PLATFORM_KEY,?\s*/g, '');
fs.writeFileSync('server.ts', code);
