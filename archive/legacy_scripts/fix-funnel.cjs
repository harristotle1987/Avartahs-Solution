const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const revStart = code.indexOf('const revenueRes = await sql`');
const revEnd = code.indexOf('`;', revStart) + 2;

if (revStart !== -1) {
  code = code.substring(0, revStart) + `const snapshotR = await db.collection('audit_submissions').get();
      let total_pipeline = 0;
      snapshotR.forEach(d => {
        const t = d.data().revenue_tier;
        if (t === '$1M-$5M') total_pipeline += 5000000;
        else if (t === '$5M+') total_pipeline += 10000000;
      });
      const revenueRes = [{ total_pipeline }];` + code.substring(revEnd);
}

const funStart = code.indexOf('const data = await sql`');
if (funStart !== -1) {
    const funEnd = code.indexOf('`;', funStart) + 2;
    code = code.substring(0, funStart) + `const snapshot = await db.collection('site_analytics').get();
      const counts = new Map();
      snapshot.forEach(d => {
          const step = d.data().form_progress;
          if (step != null) counts.set(step, (counts.get(step) || 0) + 1);
      });
      const data = Array.from(counts.entries()).map(([step, count]) => ({ step, count })).sort((a, b) => (a.step > b.step ? 1 : -1));` + code.substring(funEnd);
}


fs.writeFileSync('server.ts', code);
