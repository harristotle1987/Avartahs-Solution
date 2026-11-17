const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the background call with a sync await call
code = code.replace(
    "processProspectsBackground(insertedIds).catch(err => console.error('[Background Enrichment]', err));",
    "await processProspectsBackground(insertedIds);"
);

// We need to return the processed prospects as part of the JSON response
const jsonResRegex = /res\.json\(\{ success: true, count: totalInsertedCount, source: usedSources\.join\(\s*','\s*\) \|\| 'none' \}\);/;
const replacement = `
      let prospectsData = [];
      if (insertedIds.length > 0) {
        const idList = insertedIds.map(id => \`'\${id}'\`).join(',');
        prospectsData = await sql.unsafe(\`SELECT * FROM prospects WHERE id IN (\${idList})\`);
      }
      res.json({ success: true, count: totalInsertedCount, source: usedSources.join(',') || 'none', data: prospectsData });
`;
code = code.replace(jsonResRegex, replacement);

fs.writeFileSync('server.ts', code);
console.log("Patched to run sync and return JSON data.");
