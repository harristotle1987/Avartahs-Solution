const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `      // Launch background enrichment synchronously
      if (insertedIds.length > 0) {
        await processProspectsBackground(insertedIds);
      }`;

const newBlock = `
      // Launch background enrichment ASYNCHRONOUSLY
      if (insertedIds.length > 0) {
        processProspectsBackground(insertedIds).catch(err => {
          console.error("Background enrichment failed:", err);
        });
      }
`;

code = code.replace(anchor, newBlock);
fs.writeFileSync('server.ts', code);
console.log("Fixed blocking background enrichment.");
