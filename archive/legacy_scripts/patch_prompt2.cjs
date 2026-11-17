const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /To find more than \d+ prospects, please generate \d+ to \d+ highly granular, localized search query variations suitable for search, targeting specific major neighborhoods, districts, streets, or local zones within "\$\{region\}", combined with synonyms of the niche\./g;
code = code.replace(regex, 'To extract exactly 49 unique business prospects, automatically generate and execute 30 to 40 secondary searches using similar words, synonyms, and related industry terminology to broaden the net. Target specific major neighborhoods, districts, streets, or local zones within "${region}", combined with synonyms of the niche. This guarantees the highest accuracy and relevance of the businesses found.');

fs.writeFileSync('server.ts', code);
