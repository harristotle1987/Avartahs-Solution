import re
import sys

with open('server.ts', 'r') as f:
    code = f.read()

# 1. Remove neon import
code = re.sub(r"import\s+\{\s*neon\s*\}\s*from\s+'@neondatabase/serverless';\n?", "", code)
# Add getDb import
code = re.sub(r"import\s+dotenv\s+from\s+'dotenv';", "import dotenv from 'dotenv';\nimport { getDb } from './lib/db.js';\n", code)

# 2. Remove initialization
init_pattern = r"if \(!process\.env\.DATABASE_URL\) \{[\s\S]*?console\.log\('\[Backend\] Database schema verified & fully provisioned\.'\);"
code = re.sub(init_pattern, "const db = getDb();\n  // No schema provisioning needed for Firestore.", code)

# 3. Replace sql blocks individually.
def safe_replace(pattern, repl, text):
    new_text, count = re.subn(pattern, repl, text)
    print(f"Replaced {count} instances of {pattern[:30]}...")
    return new_text

# PROJECTS
code = safe_replace(
    r"const data = await sql`\s*SELECT id, title, description, media, tags, link, created_at\s*FROM projects\s*ORDER BY created_at DESC\s*LIMIT \$\{limit\}\s*OFFSET \$\{offset\}\s*`;",
    """const snapshot = await db.collection('projects').orderBy('created_at', 'desc').limit(limit).offset(offset).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO projects[^`]*?ON CONFLICT \(id\) DO UPDATE SET[^`]*?`;",
    """await db.collection('projects').doc(project.id).set(project, { merge: true });""",
    code
)

code = safe_replace(
    r"await sql`DELETE FROM projects WHERE id = \$\{req\.params\.id\}`;",
    """await db.collection('projects').doc(req.params.id).delete();""",
    code
)

# BLOGS
code = safe_replace(
    r"const data = await sql`SELECT \* FROM blogs WHERE slug = \$\{slug\}`;",
    """const snapshot = await db.collection('blogs').where('slug', '==', slug).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO blogs[^`]*?ON CONFLICT \(id\) DO UPDATE SET[^`]*?`;",
    """await db.collection('blogs').doc(blog.id).set(blog, { merge: true });""",
    code
)

code = safe_replace(
    r"await sql`DELETE FROM blogs WHERE id = \$\{req\.params\.id\}`;",
    """await db.collection('blogs').doc(req.params.id).delete();""",
    code
)

# LEADS
code = safe_replace(
    r"const data = await sql`\s*SELECT id, session_id, target_url, user_email, user_phone, revenue_tier, core_problem, cta_source, status, created_at\s*FROM audit_submissions\s*ORDER BY created_at DESC\s*LIMIT \$\{limit\}\s*OFFSET \$\{offset\}\s*`;",
    """const snapshot = await db.collection('audit_submissions').orderBy('created_at', 'desc').limit(limit).offset(offset).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO audit_submissions[^`]*?VALUES \([^`]*?`;",
    """await db.collection('audit_submissions').doc(lead.id).set(lead, { merge: true });""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE audit_submissions\s*SET[^`]*?WHERE id = \$\{req\.params\.id\}\s*`;",
    """const updateData: any = {};
      if (user_email !== undefined) updateData.user_email = user_email;
      if (user_phone !== undefined) updateData.user_phone = user_phone;
      if (target_url !== undefined) updateData.target_url = target_url;
      if (revenue_tier !== undefined) updateData.revenue_tier = revenue_tier;
      if (core_problem !== undefined) updateData.core_problem = core_problem;
      if (status !== undefined) updateData.status = status;
      await db.collection('audit_submissions').doc(req.params.id).update(updateData);""",
    code
)

code = safe_replace(
    r"await sql`DELETE FROM audit_submissions WHERE id = \$\{req\.params\.id\}`;",
    """await db.collection('audit_submissions').doc(req.params.id).delete();""",
    code
)

# ANALYTICS
code = safe_replace(
    r"const analyticsRes = await sql`\s*SELECT \* FROM site_analytics\s*ORDER BY session_start DESC LIMIT 100\s*`;",
    """const snapshot = await db.collection('site_analytics').orderBy('session_start', 'desc').limit(100).get();
      const analyticsRes = snapshot.docs.map(d => d.data());""",
    code
)

code = safe_replace(
    r"const revenueRes = await sql`\s*SELECT revenue_tier, COUNT\(\*\) as count\s*FROM audit_submissions\s*WHERE revenue_tier IS NOT NULL\s*GROUP BY revenue_tier\s*`;",
    """const snapshot = await db.collection('audit_submissions').get();
      const revMap = new Map();
      snapshot.forEach(d => {
          const r = d.data().revenue_tier;
          if (r) revMap.set(r, (revMap.get(r) || 0) + 1);
      });
      const revenueRes = Array.from(revMap.entries()).map(([revenue_tier, count]) => ({ revenue_tier, count }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO site_analytics[^`]*?ON CONFLICT \(visitor_id\) DO UPDATE SET[^`]*?`;",
    """await db.collection('site_analytics').doc(req.body.visitor_id).set(req.body, { merge: true });""",
    code
)

# BOOKINGS
code = safe_replace(
    r"await sql`\s*INSERT INTO session_bookings[^`]*?ON CONFLICT \(id\) DO NOTHING\s*`;",
    """await db.collection('session_bookings').doc(booking.id).set(booking, { merge: true });""",
    code
)

code = safe_replace(
    r"const data = await sql`SELECT \* FROM session_bookings ORDER BY created_at DESC`;",
    """const snapshot = await db.collection('session_bookings').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

# COUNTS
code = safe_replace(
    r"const data = await sql`SELECT COUNT\(\*\) as count FROM site_analytics`;",
    """const snapshot = await db.collection('site_analytics').count().get();
       const data = [{ count: snapshot.data().count }];""",
    code
)
code = safe_replace(
    r"const data = await sql`SELECT COUNT\(\*\) as count FROM audit_submissions`;",
    """const snapshot = await db.collection('audit_submissions').count().get();
       const data = [{ count: snapshot.data().count }];""",
    code
)
code = safe_replace(
    r"const data = await sql`SELECT COUNT\(\*\) as count FROM projects`;",
    """const snapshot = await db.collection('projects').count().get();
      const data = [{ count: snapshot.data().count }];""",
    code
)

# PROSPECTS
code = safe_replace(
    r"const data = await sql`SELECT \* FROM prospects ORDER BY created_at DESC`;",
    """const snapshot = await db.collection('prospects').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO prospects[^`]*?VALUES \(\$\{id\}, \$\{prospect\.business_name\}[^`]*?ON CONFLICT \(id\) DO UPDATE SET[^`]*?`;",
    """await db.collection('prospects').doc(id).set({
          id, business_name: prospect.business_name, location: prospect.location, contact_info: prospect.contact_info,
          website_url: prospect.website_url || null, status: prospect.status || 'Ready for Outreach',
          ai_draft: prospect.ai_draft || null, email_draft: prospect.email_draft || null, whatsapp_draft: prospect.whatsapp_draft || null,
          created_at: new Date().toISOString()
        }, { merge: true });""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO prospects[^`]*?VALUES \(\$\{id\}, \$\{bName\}[^`]*?ON CONFLICT \(id\) DO UPDATE SET[^`]*?`;",
    """await db.collection('prospects').doc(id).set({
          id, business_name: bName, location: bLoc, contact_info: bContact,
          website_url: bWebsite, status: bStatus, email_draft: bEmailDraft, whatsapp_draft: bWhatsappDraft,
          created_at: new Date().toISOString()
        }, { merge: true });""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE prospects\s*SET[^`]*?WHERE id = \$\{req\.params\.id\}\s*`;",
    """await db.collection('prospects').doc(req.params.id).update(Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined)));""",
    code
)

code = safe_replace(
    r"await sql`DELETE FROM prospects WHERE id = \$\{req\.params\.id\}`;",
    """await db.collection('prospects').doc(req.params.id).delete();""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO prospects[^`]*?VALUES \(\$\{id\}, \$\{bName\}[^`]*?ON CONFLICT \(id\) DO NOTHING\s*`;",
    """await db.collection('prospects').doc(id).set({
            id, business_name: bName, location: bLoc, contact_info: bContact, website_url: bWeb, status: 'Ready for Outreach'
         }, { merge: true });""",
    code
)

code = safe_replace(
    r"prospectsData = await sql`SELECT \* FROM prospects WHERE id = ANY\(\$\{insertedIds\}\)`;",
    """const snapshot = await db.collection('prospects').where(admin.firestore.FieldPath.documentId(), 'in', insertedIds).get();
        prospectsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"const prospectData = await sql`SELECT \* FROM prospects WHERE id = \$\{id\}`;",
    """const doc = await db.collection('prospects').doc(id).get();
        const prospectData = doc.exists ? [doc.data()] : [];""",
    code
)

code = safe_replace(
    r"const templateData = await sql`SELECT \* FROM outreach_templates WHERE id = 'default-closer'`;",
    """const doc = await db.collection('outreach_templates').doc('default-closer').get();
      const templateData = doc.exists ? [doc.data()] : [];""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE prospects\s*SET contact_info = \$\{verifiedPhone \|\| null\}, website_url = \$\{bWebsite \|\| null\}\s*WHERE id = \$\{id\}\s*`;",
    """await db.collection('prospects').doc(id).update({ contact_info: verifiedPhone || null, website_url: bWebsite || null });""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE prospects\s*SET email_draft = \$\{emailDraft\}, whatsapp_draft = \$\{whatsappDraft\}, status = 'Draft Ready'\s*WHERE id = \$\{id\}\s*`;",
    """await db.collection('prospects').doc(id).update({ email_draft: emailDraft, whatsapp_draft: whatsappDraft, status: 'Draft Ready' });""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE prospects\s*SET status = 'Sent'\s*WHERE id = \$\{id\}\s*`;",
    """await db.collection('prospects').doc(id).update({ status: 'Sent' });""",
    code
)

code = safe_replace(
    r"await sql`\s*UPDATE prospects\s*SET contact_info = \$\{finalContactInfo\}, website_url = \$\{bWebsite\}, email_draft = \$\{emailDraft\}, whatsapp_draft = \$\{whatsappDraft\}, status = 'Draft Ready'\s*WHERE id = \$\{id\}\s*`;",
    """await db.collection('prospects').doc(id).update({ contact_info: finalContactInfo, website_url: bWebsite, email_draft: emailDraft, whatsapp_draft: whatsappDraft, status: 'Draft Ready' });""",
    code
)

# ADMIN
code = safe_replace(
    r"const users = await sql`SELECT \* FROM admin_users WHERE email = \$\{email\} LIMIT 1`;",
    """const snapshot = await db.collection('admin_users').where('email', '==', email).limit(1).get();
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO admin_users \(email, password_hash\) VALUES \(\$\{email\}, \$\{hash\}\)\s*`;",
    """await db.collection('admin_users').doc(email).set({ email, password_hash: hash });""",
    code
)

code = safe_replace(
    r"const countData = await sql`SELECT COUNT\(\*\) as count FROM admin_users`;",
    """const snapshot = await db.collection('admin_users').count().get();
      const countData = [{ count: snapshot.data().count }];""",
    code
)

code = safe_replace(
    r"await sql`\s*INSERT INTO admin_users \(email, password_hash\) VALUES \(\$\{email\}, \$\{hashedPassword\}\) ON CONFLICT \(email\) DO NOTHING\s*`;",
    """await db.collection('admin_users').doc(email).set({ email, password_hash: hashedPassword }, { merge: true });""",
    code
)

# HEALTH
code = safe_replace(
    r"await sql`SELECT 1`;",
    """await db.collection('admin_users').limit(1).get();""",
    code
)


with open('server.ts', 'w') as f:
    f.write(code)

