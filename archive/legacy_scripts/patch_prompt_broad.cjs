const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = `To extract exactly 49 unique business prospects, automatically generate and execute 30 to 40 secondary searches using similar words, synonyms, and related industry terminology to broaden the net. Target specific major neighborhoods, districts, streets, or local zones within "\${region}", combined with synonyms of the niche. This guarantees the highest accuracy and relevance of the businesses found.`;

const newPrompt = `To extract unique business prospects, automatically generate 10 to 15 broader search variations using synonyms and related industry terminology. Target the main city/region "\${region}", rather than hyper-specific neighborhoods, to ensure broad coverage in OpenStreetMap/Nominatim.

CRITICAL INSTRUCTIONS FOR MAP COMPATIBILITY:
1. Do not use highly granular neighborhoods unless they are major administrative zones. Stick to the main city/region (e.g. "hotel, Benin City, Nigeria").
2. Vary the synonyms (e.g. "hotel, Benin City", "guest house, Benin City", "resort, Benin City", "motel, Benin City").`;

code = code.replace(oldPrompt, newPrompt);
fs.writeFileSync('server.ts', code);
console.log("Patched AI prompt to be broader.");
