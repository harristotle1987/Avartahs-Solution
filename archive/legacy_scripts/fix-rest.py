import re

with open('server.ts', 'r') as f:
    code = f.read()

def safe_replace(pattern, repl, text):
    return re.sub(pattern, repl, text)

# admin/summary
code = safe_replace(
    r"const analyticsRes = await sql`\s*SELECT \s*COUNT\(\*\) as total_visitors,\s*COALESCE\(AVG\(duration_seconds\), 0\)::int as avg_duration,[\s\S]*?FROM site_analytics\s*`;",
    """const snapshotA = await db.collection('site_analytics').get();
      let total_visitors = snapshotA.size;
      let totalDuration = 0, total_leads = 0, pricing_sensitive_leads = 0;
      snapshotA.forEach(d => {
        const data = d.data();
        totalDuration += data.duration_seconds || 0;
        if (data.submitted) total_leads++;
        if (data.is_pricing_sensitive) pricing_sensitive_leads++;
      });
      const avg_duration = total_visitors ? Math.floor(totalDuration / total_visitors) : 0;
      const analyticsRes = [{ total_visitors, avg_duration, total_leads, pricing_sensitive_leads }];""",
    code
)

code = safe_replace(
    r"const revenueRes = await sql`\s*SELECT \s*SUM\([\s\S]*?as total_pipeline\s*FROM audit_submissions\s*`;",
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

# analytics pagination
code = safe_replace(
    r"const data = await sql`\s*SELECT visitor_id, session_start, duration_seconds, cta_clicks, form_progress, submitted, exit_page, is_pricing_sensitive, whatsapp_handshake, calendly_handshake \s*FROM site_analytics \s*ORDER BY session_start DESC \s*LIMIT \$\{limit\} OFFSET \$\{offset\}\s*`;",
    """const snapshot = await db.collection('site_analytics').orderBy('session_start', 'desc').limit(limit).offset(offset).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

# analytics funnel
code = safe_replace(
    r"const data = await sql`\s*SELECT \s*form_progress as step,\s*COUNT\(\*\)::int as count\s*FROM site_analytics\s*WHERE form_progress IS NOT NULL\s*GROUP BY form_progress\s*ORDER BY step ASC\s*`;",
    """const snapshot = await db.collection('site_analytics').get();
      const counts = new Map();
      snapshot.forEach(d => {
          const step = d.data().form_progress;
          if (step != null) counts.set(step, (counts.get(step) || 0) + 1);
      });
      const data = Array.from(counts.entries()).map(([step, count]) => ({ step, count })).sort((a, b) => (a.step > b.step ? 1 : -1));""",
    code
)

# analytics init
code = safe_replace(
    r"await sql`\s*INSERT INTO site_analytics \(visitor_id, session_start, cta_clicks, form_progress, submitted, exit_page, is_pricing_sensitive\)\s*VALUES \(\$\{session\.visitor_id\}, \$\{session\.session_start\}, \$\{JSON\.stringify\(session\.cta_clicks\)\}::jsonb, \$\{session\.form_progress\}, \$\{session\.submitted\}, \$\{session\.exit_page\}, false\)\s*ON CONFLICT \(visitor_id\) DO NOTHING\s*`;",
    """await db.collection('site_analytics').doc(session.visitor_id).set(session, { merge: true });""",
    code
)

# analytics sync
code = safe_replace(
    r"await sql`\s*UPDATE site_analytics \s*SET[\s\S]*?WHERE visitor_id = \$\{session\.visitor_id\}\s*`;",
    """await db.collection('site_analytics').doc(session.visitor_id).set(session, { merge: true });""",
    code
)

# update password
code = safe_replace(
    r"await sql`\s*UPDATE admin_users \s*SET password_hash = \$\{newPassword\} \s*WHERE email = \$\{email\}\s*`;",
    """await db.collection('admin_users').doc(email).update({ password_hash: newPassword });""",
    code
)

# session bookings
code = safe_replace(
    r"const countData = await sql`\s*SELECT COUNT\(\*\) as count FROM session_bookings\s*WHERE booking_date = \$\{booking\.date\} AND booking_time = \$\{booking\.time\}\s*`;",
    """const snapshot = await db.collection('session_bookings').where('booking_date', '==', booking.date).where('booking_time', '==', booking.time).get();
       const countData = [{ count: snapshot.size }];""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO session_bookings \(id, name, email, booking_date, booking_time, message, created_at\)\s*VALUES \(\$\{booking\.id\}, \$\{booking\.name \|\| 'Anonymous'\}, \$\{booking\.email\}, \$\{booking\.date\}, \$\{booking\.time\}, \$\{booking\.message \|\| null\}, \$\{booking\.created_at\}\)\s*`;",
    """await db.collection('session_bookings').doc(booking.id).set(booking, { merge: true });""",
    code
)

code = safe_replace(
    r"const data = await sql`\s*SELECT booking_time as time FROM session_bookings \s*WHERE booking_date = \$\{date\}\s*`;",
    """const snapshot = await db.collection('session_bookings').where('booking_date', '==', date).get();
      const data = snapshot.docs.map(d => ({ time: d.data().booking_time }));""",
    code
)

with open('server.ts', 'w') as f:
    f.write(code)

