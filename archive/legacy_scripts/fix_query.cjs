const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const anchor = `        const idList = insertedIds.map(id => \`'\${id}'\`).join(',');
        prospectsData = await sql.unsafe(\`SELECT * FROM prospects WHERE id IN (\${idList})\`);`;

const newBlock = `        prospectsData = await sql\`SELECT * FROM prospects WHERE id = ANY(\${insertedIds})\`;`;

code = code.replace(anchor, newBlock);
fs.writeFileSync('server.ts', code);
console.log("Fixed prospects query.");
