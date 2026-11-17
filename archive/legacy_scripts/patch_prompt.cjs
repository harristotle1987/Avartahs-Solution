const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = 'To find more than 50 prospects, please generate 25 to 35 highly granular, localized search query variations suitable for search, targeting specific major neighborhoods, districts, streets, or local zones within "${region}", combined with synonyms of the niche.';
const newPrompt = 'To extract exactly 49 unique business prospects, automatically generate and execute 30 to 40 secondary searches using similar words, synonyms, and related industry terminology to broaden the net. Target specific major neighborhoods, districts, streets, or local zones within "${region}", combined with synonyms of the niche. This guarantees the highest accuracy and relevance of the businesses found.';

code = code.replace(oldPrompt, newPrompt);
fs.writeFileSync('server.ts', code);
console.log("Patched AI prompt for search generation.");
