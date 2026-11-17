import re

with open('server.ts', 'r') as f:
    code = f.read()

def safe_replace(pattern, repl, text):
    return re.sub(pattern, repl, text)

# revenueRes
code = safe_replace(
    r"const revenueRes = await sql`[\s\S]*?FROM audit_submissions\s*`;",
    """const snapshotR = await db.collection('audit_submissions').get();
      let total_pipeline = 0;
      snapshotR.forEach(d => {
        const t = d.data().revenue_tier;
        if (t === '$1M-$5M') total_pipeline += 5000000;
        else if (t === '$5M+') total_pipeline += 10000000;
      });
      const revenueRes = [{ total_pipeline }];""",
    code
)

# analytics-funnel
code = safe_replace(
    r"const data = await sql`[\s\S]*?ORDER BY step ASC\s*`;",
    """const snapshot = await db.collection('site_analytics').get();
      const counts = new Map();
      snapshot.forEach(d => {
          const step = d.data().form_progress;
          if (step != null) counts.set(step, (counts.get(step) || 0) + 1);
      });
      const data = Array.from(counts.entries()).map(([step, count]) => ({ step, count })).sort((a, b) => (a.step > b.step ? 1 : -1));""",
    code
)

with open('server.ts', 'w') as f:
    f.write(code)

