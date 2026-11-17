import pool from '../lib/neon.ts';
import { runDatabaseMigrations } from '../lib/migrations.ts';
import request from 'supertest';
import app from '../server.ts';
import crypto from 'crypto';

interface SearchTestSpec {
  category: string;
  location: string;
  query: string;
}

const SEARCH_SPECS: SearchTestSpec[] = [
  { category: 'Salons & Spas', location: 'London, UK', query: 'spas in London' },
  { category: 'Law Firms', location: 'Lagos, Nigeria', query: 'law firms in Lagos' },
  { category: 'Restaurants & Eateries', location: 'Manchester, UK', query: 'restaurants in Manchester' },
  { category: 'Furniture Businesses', location: 'New York, US', query: 'furniture in New York' },
  { category: 'Dental Clinics', location: 'Abuja, Nigeria', query: 'dentist in Abuja' },
  { category: 'Beauty Salons', location: 'Birmingham, UK', query: 'salons in Birmingham' },
  { category: 'Auto Repair', location: 'Houston, US', query: 'auto repair in Houston' },
  { category: 'Salons & Spas', location: 'Benin City, Nigeria', query: 'spas in Benin City' },
  { category: 'Restaurants & Eateries', location: 'Chicago, US', query: 'eateries in Chicago' },
  { category: 'Law Firms', location: 'Bristol, UK', query: 'law firms in Bristol' }
];

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('PROSPECTING & OUTREACH ENGINE — 10-COMBINATION ACCEPTANCE SUITE');
  console.log('================================================================\n');

  await runDatabaseMigrations();

  // Create an active admin session token for testing
  const adminEmail = 'admin@avartah.com';
  const secretRes = await pool.query("SELECT value FROM system_settings WHERE key = 'SESSION_SECRET'");
  const secret = secretRes.rows[0]?.value || 'default-secret-key-32-chars-long!';

  const sessionId = 'test-session-' + crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + 24 * 3600 * 1000;

  await pool.query(
    `INSERT INTO admin_sessions (id, user_email, user_role, created_at, expires_at, revoked, ip_address, user_agent)
     VALUES ($1, $2, 'admin', TO_TIMESTAMP($3 / 1000.0), TO_TIMESTAMP($4 / 1000.0), FALSE, '127.0.0.1', 'Vitest')
     ON CONFLICT (id) DO NOTHING`,
    [sessionId, adminEmail, now, expiresAt]
  );

  const payload = JSON.stringify({ sid: sessionId, email: adminEmail, role: 'admin', exp: expiresAt, iat: now });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  const adminAuthCookie = `admin_session=${payloadB64}.${signature}`;

  const summaryReports = [];

  for (let i = 0; i < SEARCH_SPECS.length; i++) {
    const spec = SEARCH_SPECS[i];
    console.log(`[TEST ${i + 1}/10] Executing search for: "${spec.query}" (${spec.category} | ${spec.location})`);

    const tStart = Date.now();
    const res = await request(app)
      .post('/api/prospects/locate')
      .set('Cookie', adminAuthCookie)
      .send({ query: spec.query, skipWebsites: false, targetCount: 20 });
    const durationMs = Date.now() - tStart;

    if (res.status !== 200 || !res.body.success) {
      console.error(`  ❌ Failed with status ${res.status}:`, res.body.error);
      summaryReports.push({
        testNum: i + 1,
        query: spec.query,
        category: spec.category,
        location: spec.location,
        status: 'FAILED',
        error: res.body.error,
        durationMs
      });
      continue;
    }

    const { results, metrics, shortfall_explanation, provider_stats } = res.body;
    const qualifiedCount = results.length;

    // Independent stage validations on returned qualified prospects
    let identityVerified = true;
    let contactVerified = true;
    let websiteQualified = true;
    let finalQualified = true;
    let allHaveDrafts = true;

    for (const p of results) {
      // 1. Business Identity check
      if (!p.id || !p.name || typeof p.name !== 'string' || !p.name.trim()) {
        identityVerified = false;
      }
      // 2. Contact Validity check (must have validated public email or usable phone number)
      const hasEmail = Boolean(p.email && typeof p.email === 'string' && p.email.includes('@') && !p.email.includes('example.com'));
      const hasPhone = Boolean(p.phone && typeof p.phone === 'string' && p.phone.trim().length >= 7);
      if (!hasEmail && !hasPhone) {
        contactVerified = false;
      }
      // 3. Website Status check (exclude modern functional websites)
      if (p.status === 'GOOD_WEBSITE' || p.website_quality_category === 'Website appears functional and current') {
        websiteQualified = false;
      }
      // 4. Final Qualification check
      if (!p.qualified) {
        finalQualified = false;
      }
      // 5. Outreach Drafts check
      if (!p.suggested_service || !p.email_draft || !p.whatsapp_draft) {
        allHaveDrafts = false;
      }
    }

    console.log(`  ✅ Discovered Raw: ${metrics?.discovered || 0}`);
    console.log(`  ✅ Unique Businesses: ${metrics?.unique || 0}`);
    console.log(`  ✅ Business Identity Verified: ${identityVerified ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Contact-Verified: ${contactVerified ? 'PASS' : 'FAIL'} (${qualifiedCount} prospects)`);
    console.log(`  ✅ Website-Qualified: ${websiteQualified ? 'PASS' : 'FAIL'} (${qualifiedCount} prospects)`);
    console.log(`  🎯 Final Qualified Prospects: ${qualifiedCount} (Target: 15–20)`);
    console.log(`  ⏱️ Duration: ${(durationMs / 1000).toFixed(2)}s`);
    if (shortfall_explanation) {
      console.log(`  ℹ️ Truthful Explanation: ${shortfall_explanation}`);
    }

    summaryReports.push({
      testNum: i + 1,
      query: spec.query,
      category: spec.category,
      location: spec.location,
      rawDiscovered: metrics?.discovered || 0,
      uniqueBusinesses: metrics?.unique || 0,
      identityVerified,
      contactVerified,
      websiteQualified,
      finalQualified,
      qualifiedCount,
      durationMs,
      shortfallExplanation: shortfall_explanation || 'Target achieved (15–20)',
      providerQueries: provider_stats,
      allHaveDrafts
    });

    console.log('----------------------------------------------------------------\n');
  }

  console.log('================================================================');
  console.log('SUMMARY OF 10-COMBINATION ACCEPTANCE RUN');
  console.log('================================================================');
  console.table(summaryReports.map(r => ({
    Query: r.query,
    Raw: r.rawDiscovered,
    Unique: r.uniqueBusinesses,
    Qualified: r.qualifiedCount,
    Duration: `${(r.durationMs / 1000).toFixed(1)}s`,
    'Identity Valid': r.identityVerified ? 'YES' : 'NO',
    'Contact Valid': r.contactVerified ? 'YES' : 'NO',
    'No Good Sites': r.websiteQualified ? 'YES' : 'NO',
    'Final Qualified': r.finalQualified ? 'YES' : 'NO',
    'Drafts Ready': r.allHaveDrafts ? 'YES' : 'NO'
  })));

  // Persist report JSON for the final response
  const fs = await import('fs');
  fs.writeFileSync('acceptance-results.json', JSON.stringify(summaryReports, null, 2));

  await pool.end();
  process.exit(0);
}

runAcceptanceTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
