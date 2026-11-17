import re

with open('server.ts', 'r') as f:
    code = f.read()

# 1. Remove neon import
code = re.sub(r"import\s+\{\s*neon\s*\}\s*from\s+'@neondatabase/serverless';\n?", "", code)
# Add getDb import
code = re.sub(r"import\s+dotenv\s+from\s+'dotenv';", "import dotenv from 'dotenv';\nimport { getDb } from './lib/db.js';\n", code)

# 2. Remove initialization
init_pattern = r"if \(!process\.env\.DATABASE_URL\) \{[\s\S]*?console\.log\('\[Backend\] Database schema verified & fully provisioned\.'\);"
code = re.sub(init_pattern, "const db = getDb();\n  // No schema provisioning needed for Firestore.", code)

# 3. Handle specific SQL queries

def replace_projects_get(m):
    return """const snapshot = await db.collection('projects').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`SELECT \* FROM projects ORDER BY created_at DESC`;", replace_projects_get, code)

def replace_projects_post(m):
    return """await db.collection('projects').doc(project.id).set(project, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO projects[\s\S]*?ON CONFLICT \(id\) DO UPDATE SET[\s\S]*?`;", replace_projects_post, code)

def replace_projects_delete(m):
    return """await db.collection('projects').doc(req.params.id).delete();"""
code = re.sub(r"await sql`DELETE FROM projects WHERE id = \$\{req\.params\.id\}`;", replace_projects_delete, code)

def replace_blogs_get(m):
    return """const snapshot = await db.collection('blogs').where('slug', '==', slug).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`SELECT \* FROM blogs WHERE slug = \$\{slug\}`;", replace_blogs_get, code)

def replace_audit_get(m):
    return """const snapshot = await db.collection('audit_submissions').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`SELECT \* FROM audit_submissions ORDER BY created_at DESC`;", replace_audit_get, code)

def replace_audit_post(m):
    return """await db.collection('audit_submissions').doc(submission.id).set(submission, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO audit_submissions[\s\S]*?ON CONFLICT \(id\) DO NOTHING\s*`;", replace_audit_post, code)

def replace_audit_patch(m):
    return """await db.collection('audit_submissions').doc(req.params.id).update({ status });"""
code = re.sub(r"await sql`UPDATE audit_submissions SET status = \$\{status\} WHERE id = \$\{req\.params\.id\}`;", replace_audit_patch, code)

def replace_audit_delete(m):
    return """await db.collection('audit_submissions').doc(req.params.id).delete();"""
code = re.sub(r"await sql`DELETE FROM audit_submissions WHERE id = \$\{req\.params\.id\}`;", replace_audit_delete, code)

def replace_analytics_post(m):
    return """await db.collection('site_analytics').doc(req.body.visitor_id).set(req.body, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO site_analytics[\s\S]*?ON CONFLICT \(visitor_id\) DO UPDATE SET[\s\S]*?`;", replace_analytics_post, code)

def replace_analytics_get(m):
    return """const snapshot = await db.collection('site_analytics').orderBy('session_start', 'desc').limit(100).get();
      const analyticsRes = snapshot.docs.map(d => d.data());"""
code = re.sub(r"const analyticsRes = await sql`[\s\S]*?ORDER BY session_start DESC LIMIT 100`;", replace_analytics_get, code)

def replace_revenue_get(m):
    return """const snapshot = await db.collection('audit_submissions').get();
      const revenueRes = snapshot.docs.map(d => d.data());"""
code = re.sub(r"const revenueRes = await sql`\s*SELECT revenue_tier, COUNT\(\*\) as count[\s\S]*?GROUP BY revenue_tier\s*`;", replace_revenue_get, code)

def replace_bookings_post(m):
    return """await db.collection('session_bookings').doc(booking.id).set(booking, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO session_bookings[\s\S]*?ON CONFLICT \(id\) DO NOTHING\s*`;", replace_bookings_post, code)

def replace_bookings_get(m):
    return """const snapshot = await db.collection('session_bookings').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`SELECT \* FROM session_bookings ORDER BY created_at DESC`;", replace_bookings_get, code)

def replace_count_site(m):
    return """const snapshot = await db.collection('site_analytics').count().get();
       const data = [{ count: snapshot.data().count }];"""
code = re.sub(r"const data = await sql`SELECT COUNT\(\*\) as count FROM site_analytics`;", replace_count_site, code)

def replace_count_audit(m):
    return """const snapshot = await db.collection('audit_submissions').count().get();
       const data = [{ count: snapshot.data().count }];"""
code = re.sub(r"const data = await sql`SELECT COUNT\(\*\) as count FROM audit_submissions`;", replace_count_audit, code)

def replace_count_projects(m):
    return """const snapshot = await db.collection('projects').count().get();
      const data = [{ count: snapshot.data().count }];"""
code = re.sub(r"const data = await sql`SELECT COUNT\(\*\) as count FROM projects`;", replace_count_projects, code)

def replace_prospects_get(m):
    return """const snapshot = await db.collection('prospects').orderBy('created_at', 'desc').get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`SELECT \* FROM prospects ORDER BY created_at DESC`;", replace_prospects_get, code)

def replace_prospects_post(m):
    return """await db.collection('prospects').doc(id).set({
          id, business_name: prospect.business_name, location: prospect.location, contact_info: prospect.contact_info,
          website_url: prospect.website_url || null, status: prospect.status || 'Ready for Outreach',
          ai_draft: prospect.ai_draft || null, email_draft: prospect.email_draft || null, whatsapp_draft: prospect.whatsapp_draft || null,
          created_at: new Date().toISOString()
        }, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO prospects[\s\S]*?VALUES \(\$\{id\}, \$\{prospect\.business_name\}[\s\S]*?ON CONFLICT \(id\) DO UPDATE SET[\s\S]*?whatsapp_draft = EXCLUDED\.whatsapp_draft\s*`;", replace_prospects_post, code)

def replace_prospects_post_b(m):
    return """await db.collection('prospects').doc(id).set({
          id, business_name: bName, location: bLoc, contact_info: bContact,
          website_url: bWebsite, status: bStatus, email_draft: bEmailDraft, whatsapp_draft: bWhatsappDraft,
          created_at: new Date().toISOString()
        }, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO prospects[\s\S]*?VALUES \(\$\{id\}, \$\{bName\}[\s\S]*?ON CONFLICT \(id\) DO UPDATE SET[\s\S]*?whatsapp_draft = EXCLUDED\.whatsapp_draft\s*`;", replace_prospects_post_b, code)

def replace_prospects_patch(m):
    return """await db.collection('prospects').doc(req.params.id).update(Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined)));"""
code = re.sub(r"await sql`\s*UPDATE prospects\s*SET[\s\S]*?whatsapp_draft = COALESCE\(\$\{updates\.whatsapp_draft\}, whatsapp_draft\)\s*WHERE id = \$\{req\.params\.id\}\s*`;", replace_prospects_patch, code)

def replace_prospects_delete(m):
    return """await db.collection('prospects').doc(req.params.id).delete();"""
code = re.sub(r"await sql`DELETE FROM prospects WHERE id = \$\{req\.params\.id\}`;", replace_prospects_delete, code)

def replace_admin_get(m):
    return """const snapshot = await db.collection('admin_users').where('email', '==', email).limit(1).get();
      const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const users = await sql`SELECT \* FROM admin_users WHERE email = \$\{email\} LIMIT 1`;", replace_admin_get, code)

def replace_admin_post(m):
    return """await db.collection('admin_users').doc(email).set({ email, password_hash: hash });"""
code = re.sub(r"await sql`\s*INSERT INTO admin_users \(email, password_hash\) VALUES \(\$\{email\}, \$\{hash\}\)\s*`;", replace_admin_post, code)

def replace_users_count(m):
    return """const snapshot = await db.collection('admin_users').count().get();
      const countData = [{ count: snapshot.data().count }];"""
code = re.sub(r"const countData = await sql`SELECT COUNT\(\*\) as count FROM admin_users`;", replace_users_count, code)

def replace_admin_bootstrap(m):
    return """await db.collection('admin_users').doc(email).set({ email, password_hash: hashedPassword }, { merge: true });"""
code = re.sub(r"await sql`\s*INSERT INTO admin_users \(email, password_hash\) VALUES \(\$\{email\}, \$\{hashedPassword\}\) ON CONFLICT \(email\) DO NOTHING\s*`;", replace_admin_bootstrap, code)


with open('server.ts', 'w') as f:
    f.write(code)

