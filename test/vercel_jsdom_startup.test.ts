import assert from 'assert';
import bcrypt from 'bcrypt';
import { createRequire } from 'module';
import request from 'supertest';
import pool from '../lib/neon.js';

const require = createRequire(import.meta.url);

function getLoadedModulePaths(): string[] {
  return Object.keys(require.cache || {});
}

function isPackageLoaded(pkgSegment: string): boolean {
  const normalized = pkgSegment.replace(/\//g, process.platform === 'win32' ? '\\' : '/');
  return getLoadedModulePaths().some((p) => p.includes(`/node_modules/${normalized}/`) || p.includes(`\\node_modules\\${normalized}\\`));
}

async function runVercelJsdomStartupTests() {
  console.log('========================================================================');
  console.log('AVARTAH SOLUTIONS — JSDOM / ERR_REQUIRE_ESM & LAZY-LOAD VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  function check(cond: boolean, name: string, detail?: string) {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const origEnv = { ...process.env };
  const origQuery = pool.query.bind(pool);
  const origConnect = pool.connect.bind(pool);
  const origFetch = globalThis.fetch;

  process.env.AVARTAH_TEST_MODE = '1';
  process.env.AVARTAH_SKIP_DB_INIT = '1';
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/avartah_mock';
  process.env.SESSION_SECRET = 'mock_super_secure_session_secret_at_least_32_characters_long';
  process.env.NODE_ENV = 'test';
  process.env.PAYSTACK_MODE = 'test';
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_key_1234567890abcdef';
  process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
  process.env.APP_BASE_URL = 'https://avartah.com';
  process.env.ALLOWED_ORIGINS = 'https://avartah.com';

  try {
    console.log('--- 1. Startup Module Hygiene (No JSDOM / Rollup / @exodus/bytes at Boot) ---');
    const serverMod = await import('../server.js');
    const auditMod = await import('../lib/auditDiagnostics.js');
    const app = serverMod.default;
    const startServer = serverMod.startServer;

    const adminHash = await bcrypt.hash('AdminStrongPass!123', 10);
    const sessions = new Map<string, any>();
    const analyticsRows = new Map<string, any>();

    const rateLimits = new Map<string, { count: number; reset_time_ms: number }>();

    const mockQuery = async (text: string, params: any[] = []) => {
      const q = text.replace(/\s+/g, ' ').trim();
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') return { rows: [] };
      if (q.startsWith('INSERT INTO rate_limit_events')) {
        const key = String(params[0]);
        const windowSec = Number(params[1] || 60);
        const now = Date.now();
        const existing = rateLimits.get(key);
        if (!existing || existing.reset_time_ms < now) {
          const row = { count: 1, reset_time_ms: now + windowSec * 1000 };
          rateLimits.set(key, row);
          return { rows: [row] };
        }
        existing.count += 1;
        return { rows: [{ count: existing.count, reset_time_ms: existing.reset_time_ms }] };
      }
      if (q.startsWith('SELECT count, EXTRACT(EPOCH FROM reset_time)')) {
        const key = String(params[0]);
        const existing = rateLimits.get(key);
        if (!existing || existing.reset_time_ms <= Date.now()) return { rows: [] };
        return { rows: [{ count: existing.count, reset_time_ms: existing.reset_time_ms }] };
      }
      if (q.includes('DELETE FROM rate_limit_events')) {
        const keys: string[] = Array.isArray(params[0]) ? params[0] : [];
        for (const k of keys) rateLimits.delete(k);
        return { rows: [] };
      }
      if (q.includes('FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
        const email = String(params[0] || '').toLowerCase();
        if (email === 'admin@avartah.com') {
          return { rows: [{ id: 1, email: 'admin@avartah.com', password_hash: adminHash, role: 'admin', is_active: true }] };
        }
        return { rows: [] };
      }
      if (q.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
        return { rows: [] };
      }
      if (q.startsWith('INSERT INTO admin_sessions')) {
        const [id, user_email, user_role, _createdAt, expires_at_ms] = params;
        sessions.set(id, {
          id,
          user_email,
          user_role,
          revoked: false,
          expires_at: typeof expires_at_ms === 'number' ? expires_at_ms : new Date(expires_at_ms).getTime()
        });
        return { rows: [] };
      }
      if (q.includes('FROM admin_sessions WHERE id = $1')) {
        const s = sessions.get(params[0]);
        if (s && !s.revoked && s.expires_at > Date.now()) {
          return { rows: [{ ...s }] };
        }
        return { rows: [] };
      }
      if (q.includes('FROM projects')) {
        return {
          rows: [
            { id: 'proj_1', title: 'Apex Portal', category: 'Web Platform', visibility: 'public', is_archived: false }
          ]
        };
      }
      if (q.includes('FROM blogs')) {
        return {
          rows: [
            { id: 'blog_1', title: 'Architecture Notes', slug: 'architecture-notes', published: true }
          ]
        };
      }
      if (q.includes('FROM subscription_plans')) {
        return {
          rows: [
            { id: 'free', name: 'Free', price_ngn: 0, is_active: true },
            { id: 'growth', name: 'Growth', price_ngn: 35000, is_active: true }
          ]
        };
      }
      if (q.includes('FROM tenants t')) {
        return {
          rows: [
            { id: 'biz_demo_1', name: 'Demo Salon', business_name: 'Demo Salon', plan_id: 'growth', status: 'ACTIVE' }
          ]
        };
      }
      if (q.includes('INSERT INTO site_analytics')) {
        const [visitorId] = params;
        analyticsRows.set(visitorId, { visitor_id: visitorId, duration_seconds: params[2] || 0 });
        return { rows: [] };
      }
      if (q.includes('UPDATE site_analytics')) {
        const visitorId = params[5];
        if (analyticsRows.has(visitorId)) {
          analyticsRows.get(visitorId).duration_seconds = params[0];
        }
        return { rows: [] };
      }
      if (q.includes('FROM site_analytics')) {
        return {
          rows: [
            { total_visitors: analyticsRows.size || 1, engaged_visitors: 1, form_starters: 1, completed_audits: 1, pricing_sensitive: 0 }
          ]
        };
      }
      if (q.includes('FROM leads')) {
        return { rows: [{ total_leads: 1 }] };
      }
      return { rows: [] };
    };

    (pool as any).query = mockQuery;
    (pool as any).connect = async () => ({ query: mockQuery, release: () => {} });

    await startServer();

    check(!isPackageLoaded('jsdom'), 'jsdom is NOT loaded during server startup');
    check(!isPackageLoaded('html-encoding-sniffer'), 'html-encoding-sniffer is NOT loaded during server startup');
    check(!isPackageLoaded('@exodus/bytes'), '@exodus/bytes is NOT loaded anywhere at startup');
    check(!isPackageLoaded('vite'), 'vite is NOT loaded in test/production server startup');
    check(!isPackageLoaded('rollup'), 'rollup is NOT loaded in test/production server startup');

    console.log('\n--- 2. Ordinary API Endpoints Work Without Loading JSDOM ---');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@avartah.com', password: 'AdminStrongPass!123' });
    check(loginRes.status === 200 && loginRes.body.success === true, 'POST /api/auth/login returns 200');
    const setCookies = (loginRes.headers['set-cookie'] as unknown as string[]) || [];
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    const xsrfCookie = setCookies.find((c) => c.startsWith('XSRF-TOKEN='));
    const csrfToken = xsrfCookie ? decodeURIComponent(xsrfCookie.split(';')[0].split('=')[1]) : '';

    const sessionRes = await request(app).get('/api/auth/session').set('Cookie', cookieHeader);
    check(sessionRes.status === 200 && sessionRes.body.authenticated === true, 'GET /api/auth/session returns 200 authenticated');

    const projectsRes = await request(app).get('/api/projects');
    check(projectsRes.status === 200 && Array.isArray(projectsRes.body) && projectsRes.body.length === 1, 'GET /api/projects returns 200');

    const blogsRes = await request(app).get('/api/blogs').set('Cookie', cookieHeader);
    check(blogsRes.status === 200 && Array.isArray(blogsRes.body) && blogsRes.body.length === 1, 'GET /api/blogs returns 200');

    const plansRes = await request(app).get('/api/os/plans');
    check(plansRes.status === 200 && Array.isArray(plansRes.body) && plansRes.body.length === 2, 'GET /api/os/plans returns 200');

    const tenantsRes = await request(app).get('/api/os/tenants').set('Cookie', cookieHeader);
    check(tenantsRes.status === 200 && Array.isArray(tenantsRes.body) && tenantsRes.body.length === 1, 'GET /api/os/tenants returns 200');

    const analyticsInitRes = await request(app)
      .post('/api/analytics/init')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ visitor_id: 'vis_test_1', page_views: 1, duration_seconds: 5 });
    check(analyticsInitRes.status === 200 && analyticsInitRes.body.success === true, 'POST /api/analytics/init returns 200');

    const analyticsSyncRes = await request(app)
      .patch('/api/analytics/sync')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ visitor_id: 'vis_test_1', page_views: 2, duration_seconds: 25 });
    check(analyticsSyncRes.status === 200 && analyticsSyncRes.body.success === true, 'PATCH /api/analytics/sync returns 200');

    const funnelRes = await request(app).get('/api/analytics-funnel?range=30D').set('Cookie', cookieHeader);
    check(funnelRes.status === 200 && Array.isArray(funnelRes.body), 'GET /api/analytics-funnel returns 200');

    check(!isPackageLoaded('jsdom'), 'jsdom remains UNLOADED after auth, projects, blogs, os/plans, os/tenants, and analytics requests');

    console.log('\n--- 3. Lazy JSDOM + axe-core Accessibility Diagnostics & /api/audit/diagnose ---');
    const sampleHtml = `<!DOCTYPE html><html><head><title>Test Page</title></head><body><main><img src="/hero.png"><h1>Hello</h1></main></body></html>`;
    const axeResult = await auditMod.executeAxeCoreAudit(sampleHtml, 'https://example.com');
    check(
      axeResult.status === 'COMPLETED' && typeof axeResult.score === 'number' && axeResult.violationsCount >= 1,
      `executeAxeCoreAudit works lazily with jsdom@26.1.0 (status=${axeResult.status}, score=${axeResult.score}, violations=${axeResult.violationsCount})`
    );
    check(isPackageLoaded('jsdom'), 'jsdom loads cleanly on-demand when executeAxeCoreAudit runs');
    check(!isPackageLoaded('@exodus/bytes'), '@exodus/bytes is still NOT present even after loading jsdom');

    // Test POST /api/audit/diagnose endpoint contract end-to-end (with mocked fetch for target URL & PageSpeed)
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const target = String(input);
      if (target.includes('googleapis.com/pagespeedonline')) {
        return new Response(JSON.stringify({ error: { message: 'Quota skipped in mock' } }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(sampleHtml, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'strict-transport-security': 'max-age=31536000',
          'content-encoding': 'gzip'
        }
      });
    }) as typeof fetch;

    const diagnoseRes = await request(app)
      .post('/api/audit/diagnose')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ url: 'https://example.com' });

    const diagAxeStatus = diagnoseRes.body?.diagnostics?.axeCore?.status;
    check(
      diagnoseRes.status === 200 &&
        diagnoseRes.body.success === true &&
        diagnoseRes.body.diagnostics?.normalizedUrl === 'https://example.com/' &&
        diagnoseRes.body.diagnostics?.httpProbe &&
        diagnoseRes.body.diagnostics?.axeCore &&
        (diagAxeStatus === 'COMPLETED' || diagAxeStatus === 'UNAVAILABLE'),
      `POST /api/audit/diagnose succeeds with expected contract (httpStatus=${diagnoseRes.status}, axeStatus=${diagAxeStatus})`
    );

    const invalidDiagRes = await request(app)
      .post('/api/audit/diagnose')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ url: 'http://127.0.0.1/internal' });
    check(invalidDiagRes.status === 400 && invalidDiagRes.body.success === false, 'POST /api/audit/diagnose rejects SSRF loopback with 400');

    console.log('\n========================================================================');
    console.log(`  VERCEL JSDOM VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');
    assert.strictEqual(failed, 0, `${failed} checks failed`);
  } finally {
    globalThis.fetch = origFetch;
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
    process.env = origEnv;
  }
}

runVercelJsdomStartupTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  });
