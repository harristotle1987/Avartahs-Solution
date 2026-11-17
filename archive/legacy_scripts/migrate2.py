import re

with open('server.ts', 'r') as f:
    code = f.read()

def replace_projects_paginate(m):
    return """const snapshot = await db.collection('projects').orderBy('created_at', 'desc').limit(limit).offset(offset).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`\s*SELECT id[\s\S]*?FROM projects\s*ORDER BY created_at DESC\s*LIMIT \$\{limit\}\s*OFFSET \$\{offset\}\s*`;", replace_projects_paginate, code)

def replace_audit_paginate(m):
    return """const snapshot = await db.collection('audit_submissions').orderBy('created_at', 'desc').limit(limit).offset(offset).get();
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"const data = await sql`\s*SELECT id[\s\S]*?FROM audit_submissions\s*ORDER BY created_at DESC\s*LIMIT \$\{limit\}\s*OFFSET \$\{offset\}\s*`;", replace_audit_paginate, code)

def replace_prospects_any(m):
    return """const snapshot = await db.collection('prospects').where(admin.firestore.FieldPath.documentId(), 'in', insertedIds).get();
        prospectsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));"""
code = re.sub(r"prospectsData = await sql`SELECT \* FROM prospects WHERE id = ANY\(\$\{insertedIds\}\)`;", replace_prospects_any, code)

def replace_prospect_id(m):
    return """const doc = await db.collection('prospects').doc(id).get();
        const prospectData = doc.exists ? [doc.data()] : [];"""
code = re.sub(r"const prospectData = await sql`SELECT \* FROM prospects WHERE id = \$\{id\}`;", replace_prospect_id, code)

def replace_template(m):
    return """const doc = await db.collection('outreach_templates').doc('default-closer').get();
      const templateData = doc.exists ? [doc.data()] : [];"""
code = re.sub(r"const templateData = await sql`SELECT \* FROM outreach_templates WHERE id = 'default-closer'`;", replace_template, code)

def replace_prospect_update_1(m):
    return """await db.collection('prospects').doc(id).update({ contact_info: verifiedPhone || null, website_url: bWebsite || null });"""
code = re.sub(r"await sql`\s*UPDATE prospects\s*SET contact_info = \$\{verifiedPhone \|\| null\}, website_url = \$\{bWebsite \|\| null\}\s*WHERE id = \$\{id\}\s*`;", replace_prospect_update_1, code)

def replace_prospect_update_2(m):
    return """await db.collection('prospects').doc(id).update({ email_draft: emailDraft, whatsapp_draft: whatsappDraft, status: 'Draft Ready' });"""
code = re.sub(r"await sql`\s*UPDATE prospects\s*SET email_draft = \$\{emailDraft\}, whatsapp_draft = \$\{whatsappDraft\}, status = 'Draft Ready'\s*WHERE id = \$\{id\}\s*`;", replace_prospect_update_2, code)

def replace_prospect_update_sent(m):
    return """await db.collection('prospects').doc(id).update({ status: 'Sent' });"""
code = re.sub(r"await sql`\s*UPDATE prospects\s*SET status = 'Sent'\s*WHERE id = \$\{id\}\s*`;", replace_prospect_update_sent, code)

def replace_db_health(m):
    return """await db.collection('admin_users').limit(1).get();"""
code = re.sub(r"await sql`SELECT 1`;", replace_db_health, code)

def replace_prospect_update_bg(m):
    return """await db.collection('prospects').doc(id).update({ contact_info: finalContactInfo, website_url: bWebsite, email_draft: emailDraft, whatsapp_draft: whatsappDraft, status: 'Draft Ready' });"""
code = re.sub(r"await sql`\s*UPDATE prospects\s*SET contact_info = \$\{finalContactInfo\}, website_url = \$\{bWebsite\}, email_draft = \$\{emailDraft\}, whatsapp_draft = \$\{whatsappDraft\}, status = 'Draft Ready'\s*WHERE id = \$\{id\}\s*`;", replace_prospect_update_bg, code)

with open('server.ts', 'w') as f:
    f.write(code)

