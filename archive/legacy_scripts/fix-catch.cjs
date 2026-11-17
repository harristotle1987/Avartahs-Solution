const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const catchStr = `
  } catch (e) {
    console.error('[Backend] Schema migration failure:', e);
  }`;
  
code = code.replace(catchStr, '');
fs.writeFileSync('server.ts', code);
