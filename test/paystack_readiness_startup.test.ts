import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import pool from '../lib/neon.js';
import {
  validatePaystackReadiness,
  validatePaystackModeAndKey,
  isPaystackConfigured,
  initializePaystackTransaction,
  verifyPaystackTransaction
} from '../lib/paystack.js';

async function runPaystackReadinessTests() {
  console.log('========================================================================');
  console.log('AVARTAH SOLUTIONS — PAYSTACK STARTUP & READINESS VERIFICATION SUITE');
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

  function clearPaystackEnv() {
    delete process.env.PAYSTACK_MODE;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_CALLBACK_URL;
    delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
    delete process.env.PAYMENT_CURRENCY;
  }

  function assertNoSecretLeak(payload: unknown, label: string) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const leaked =
      serialized.includes('sk_test_') ||
      serialized.includes('sk_live_') ||
      serialized.includes('pk_test_') ||
      serialized.includes('pk_live_') ||
      serialized.includes('PAYSTACK_MODE') ||
      serialized.includes('PAYSTACK_SECRET_KEY') ||
      serialized.includes('PAYSTACK_CALLBACK_URL') ||
      serialized.includes('VITE_PAYSTACK_PUBLIC_KEY') ||
      serialized.includes('at ') && serialized.includes('.ts:');
    check(!leaked, `${label} does not expose secrets, stack traces, or internal config details`);
  }

  const origEnv = { ...process.env };
  const origQuery = pool.query.bind(pool);
  const origConnect = pool.connect.bind(pool);
  const origFetch = globalThis.fetch;

  let fetchCalls = 0;

  try {
    // =========================================================================
    // 1. Unit Tests for Central Paystack Readiness Validation
    // =========================================================================
    console.log('--- 1. Central Paystack Readiness Validation Rules ---');

    // 1a. Missing PAYSTACK_MODE (in both production and non-production)
    for (const envMode of ['production', 'test'] as const) {
      process.env.NODE_ENV = envMode;
      clearPaystackEnv();
      process.env.PAYSTACK_SECRET_KEY = envMode === 'production' ? 'sk_live_mock_secret_123456' : 'sk_test_mock_secret_123456';
      process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';

      const res = validatePaystackReadiness();
      check(
        res.ready === false && validatePaystackModeAndKey().valid === false && isPaystackConfigured() === false,
        `[${envMode}] Missing PAYSTACK_MODE fails readiness check even when secret key exists`
      );
      assertNoSecretLeak(res.error || '', `[${envMode}] Missing PAYSTACK_MODE diagnostic`);
    }

    // 1b. Invalid PAYSTACK_MODE
    for (const badMode of ['staging', 'sandbox', 'prod', 'dev', 'test_live']) {
      process.env.NODE_ENV = 'production';
      clearPaystackEnv();
      process.env.PAYSTACK_MODE = badMode;
      process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
      process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';

      const res = validatePaystackReadiness();
      check(
        res.ready === false && res.code === 'PAYSTACK_INVALID_CONFIG',
        `Invalid PAYSTACK_MODE="${badMode}" is rejected`
      );
    }

    // 1c. Missing or placeholder secret key
    for (const badKey of [undefined, '', '   ', 'sk_test_replace_with_your_actual_paystack_secret_key', 'sk_test_', 'invalid_key_12345']) {
      process.env.NODE_ENV = 'production';
      clearPaystackEnv();
      process.env.PAYSTACK_MODE = 'test';
      if (badKey !== undefined) process.env.PAYSTACK_SECRET_KEY = badKey;
      process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';

      const res = validatePaystackReadiness();
      check(
        res.ready === false,
        `Missing/invalid PAYSTACK_SECRET_KEY (${badKey === undefined ? 'unset' : JSON.stringify(badKey)}) is rejected`
      );
    }

    // 1d. Test / live key mismatch (both directions, secret & public keys)
    process.env.NODE_ENV = 'production';
    process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';

    process.env.PAYSTACK_MODE = 'live';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
    delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
    check(!validatePaystackReadiness().ready, 'PAYSTACK_MODE="live" rejects sk_test_ secret key');

    process.env.PAYSTACK_MODE = 'test';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_mock_secret_123456';
    check(!validatePaystackReadiness().ready, 'PAYSTACK_MODE="test" rejects sk_live_ secret key');

    process.env.PAYSTACK_MODE = 'live';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_mock_secret_123456';
    process.env.VITE_PAYSTACK_PUBLIC_KEY = 'pk_test_mock_public_123456';
    check(!validatePaystackReadiness().ready, 'PAYSTACK_MODE="live" rejects mismatched pk_test_ public key');

    process.env.PAYSTACK_MODE = 'test';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
    process.env.VITE_PAYSTACK_PUBLIC_KEY = 'pk_live_mock_public_123456';
    check(!validatePaystackReadiness().ready, 'PAYSTACK_MODE="test" rejects mismatched pk_live_ public key');

    // 1e. Production callback URL required
    process.env.NODE_ENV = 'production';
    process.env.PAYSTACK_MODE = 'live';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_mock_secret_123456';
    delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
    delete process.env.PAYSTACK_CALLBACK_URL;
    process.env.APP_BASE_URL = 'https://avartah.com';
    check(!validatePaystackReadiness().ready, 'Production readiness rejects missing PAYSTACK_CALLBACK_URL');

    process.env.PAYSTACK_CALLBACK_URL = 'http://avartah.com/api/os/payments/paystack/callback';
    check(!validatePaystackReadiness().ready, 'Production readiness rejects non-HTTPS PAYSTACK_CALLBACK_URL');

    // 1f. Valid configurations succeed
    process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
    const liveValid = validatePaystackReadiness();
    check(liveValid.ready === true && liveValid.mode === 'live' && liveValid.currency === 'NGN', 'Valid live production Paystack config passes readiness');

    process.env.PAYSTACK_MODE = 'test';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
    process.env.VITE_PAYSTACK_PUBLIC_KEY = 'pk_test_mock_public_123456';
    const testValid = validatePaystackReadiness();
    check(testValid.ready === true && testValid.mode === 'test', 'Valid test Paystack config passes readiness');

    // 1g. Direct client helpers fail safely without throwing when unconfigured
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('fetch should not be invoked when Paystack is unconfigured');
    }) as typeof fetch;

    clearPaystackEnv();
    const directInit = await initializePaystackTransaction({
      email: 'owner@avartah.com',
      amountKobo: 3500000,
      reference: 'avt_unconf_1'
    });
    check(directInit.success === false && fetchCalls === 0, 'initializePaystackTransaction fails safely without calling Paystack API when unconfigured');

    const directVerify = await verifyPaystackTransaction('avt_unconf_1');
    check(directVerify.success === false && directVerify.transientError === true && fetchCalls === 0, 'verifyPaystackTransaction fails safely without calling Paystack API when unconfigured');

    // =========================================================================
    // 2. Production Server Startup & Unrelated Services With Unconfigured Paystack
    // =========================================================================
    console.log('\n--- 2. Production Startup & Non-Payment Services With Unconfigured Paystack ---');

    clearPaystackEnv(); // Completely unconfigured Paystack
    process.env.NODE_ENV = 'production';
    process.env.AVARTAH_TEST_MODE = '1';
    process.env.AVARTAH_SKIP_DB_INIT = '1';
    process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/avartah_mock';
    process.env.SESSION_SECRET = 'mock_super_secure_session_secret_at_least_32_characters_long';
    process.env.APP_BASE_URL = 'https://avartah.com';
    process.env.ALLOWED_ORIGINS = 'https://avartah.com';

    const adminHash = await bcrypt.hash('AdminStrongPass!123', 10);
    const sessions = new Map<string, any>();
    const rateLimits = new Map<string, { count: number; reset_time_ms: number }>();
    const payments = new Map<string, any>();
    const subscriptions = new Map<string, any>();
    const webhookEvents = new Map<string, any>();

    let tenantPlanId = 'free';

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
        return { rows: [] };
      }
      if (q.includes('FROM admin_users WHERE LOWER(email) = LOWER($1)') || q.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
        const email = String(params[0] || '').toLowerCase();
        if (email === 'admin@avartah.com') {
          return { rows: [{ id: 1, email: 'admin@avartah.com', password_hash: adminHash, role: 'admin', is_active: true }] };
        }
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
        return { rows: [{ id: 'proj_1', title: 'Apex Portal', category: 'Web Platform', visibility: 'public', is_archived: false }] };
      }
      if (q.includes('FROM blogs')) {
        return { rows: [{ id: 'blog_1', title: 'Scaling SaaS', slug: 'scaling-saas', published: true }] };
      }
      if (q.includes('FROM subscription_plans WHERE id = $1')) {
        const pid = params[0];
        if (pid === 'free') return { rows: [{ id: 'free', name: 'Free', price_ngn: 0, price_usd: 0, is_active: true }] };
        if (pid === 'growth') return { rows: [{ id: 'growth', name: 'Growth', price_ngn: 35000, price_usd: 25, is_active: true }] };
        return { rows: [] };
      }
      if (q.includes('FROM subscription_plans')) {
        return {
          rows: [
            { id: 'free', name: 'Free', price_ngn: 0, is_active: true },
            { id: 'growth', name: 'Growth', price_ngn: 35000, is_active: true }
          ]
        };
      }
      if (q.includes('FROM tenants WHERE id = $1')) {
        if (params[0] === 'biz_demo_1') {
          return {
            rows: [
              { id: 'biz_demo_1', name: 'Demo Biz', business_name: 'Demo Biz', owner_email: 'admin@avartah.com', plan_id: tenantPlanId, status: 'ACTIVE' }
            ]
          };
        }
        return { rows: [] };
      }
      if (q.includes('FROM tenant_members')) {
        return { rows: [{ tenant_id: 'biz_demo_1', user_email: 'admin@avartah.com', role: 'owner', is_active: true }] };
      }
      if (q.includes('FROM tenant_settings')) {
        return { rows: [] };
      }
      if (q.includes('UPDATE tenants SET plan_id = $1')) {
        tenantPlanId = String(params[0]);
        return { rows: [] };
      }
      if (q.includes('FROM crm_leads')) {
        return { rows: [{ id: 'crm_1', name: 'Test Lead', status: 'NEW', phone: '+2348011112222', email: 'test@example.com' }] };
      }
      if (q.includes('FROM crm_outreach_history')) {
        return { rows: [{ id: 'out_1', crm_lead_id: 'crm_1', delivery_status: 'SENT' }] };
      }
      if (q.includes('FROM prospect_search_jobs') || q.includes('FROM prospects') || q.includes('FROM saved_prospects') || q.includes('FROM outreach_history')) {
        return { rows: [{ id: 'job_1', status: 'COMPLETED', query: 'salon' }] };
      }
      if (q.includes('FROM site_analytics')) {
        return { rows: [{ total_visitors: 10, engaged_visitors: 5, form_starters: 2, completed_audits: 1, pricing_sensitive: 0 }] };
      }
      if (q.includes('FROM leads')) {
        return { rows: [{ total_leads: 3 }] };
      }
      if (q.startsWith('INSERT INTO payments')) {
        payments.set(params[4], { id: params[0], tenant_id: params[1], plan_id: params[3], provider_reference: params[4], status: 'PENDING' });
        return { rows: [] };
      }
      if (q.includes('FROM payments WHERE provider_reference = $1')) {
        const p = payments.get(params[0]);
        return { rows: p ? [p] : [] };
      }
      if (q.startsWith('INSERT INTO webhook_events')) {
        webhookEvents.set(params[1], { id: params[0], event_key: params[1] });
        return { rows: [] };
      }
      if (q.startsWith('INSERT INTO subscriptions')) {
        subscriptions.set(params[3], { id: params[0], tenant_id: params[1], plan_id: params[2] });
        return { rows: [] };
      }
      return { rows: [] };
    };

    (pool as any).query = mockQuery;
    (pool as any).connect = async () => ({ query: mockQuery, release: () => {} });

    const serverMod = await import('../server.js');
    const app = serverMod.default;
    const startServer = serverMod.startServer;

    let startupError: any = null;
    try {
      await startServer();
    } catch (err) {
      startupError = err;
    }
    check(startupError === null, 'Production startServer() boots cleanly when PAYSTACK_* env vars are completely unset');

    // Verify unrelated application endpoints are fully operational
    const healthRes = await request(app).get('/api/health');
    check(healthRes.status === 200, 'GET /api/health returns 200 in production with unconfigured Paystack');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://avartah.com')
      .send({ email: 'admin@avartah.com', password: 'AdminStrongPass!123' });
    check(loginRes.status === 200 && loginRes.body.success === true, 'POST /api/auth/login succeeds (200) when Paystack is unconfigured');

    const setCookies = (loginRes.headers['set-cookie'] as unknown as string[]) || [];
    const cookieHeader = setCookies.map((c) => c.split(';')[0]).join('; ');
    const xsrfCookie = setCookies.find((c) => c.startsWith('XSRF-TOKEN='));
    const csrfToken = xsrfCookie ? decodeURIComponent(xsrfCookie.split(';')[0].split('=')[1]) : '';

    const sessionRes = await request(app).get('/api/auth/session').set('Cookie', cookieHeader);
    check(sessionRes.status === 200 && sessionRes.body.authenticated === true, 'GET /api/auth/session succeeds (200)');

    const projectsRes = await request(app).get('/api/projects');
    check(projectsRes.status === 200 && Array.isArray(projectsRes.body), 'GET /api/projects succeeds (200)');

    const blogsRes = await request(app).get('/api/blogs').set('Cookie', cookieHeader);
    check(blogsRes.status === 200 && Array.isArray(blogsRes.body), 'GET /api/blogs succeeds (200)');

    const analyticsRes = await request(app).get('/api/analytics-funnel?range=30D').set('Cookie', cookieHeader);
    check(analyticsRes.status === 200 && Array.isArray(analyticsRes.body), 'GET /api/analytics-funnel succeeds (200)');

    const plansRes = await request(app).get('/api/os/plans');
    check(plansRes.status === 200 && Array.isArray(plansRes.body), 'GET /api/os/plans (SaaS plans) succeeds (200)');

    const tenantsRes = await request(app).get('/api/os/tenants').set('Cookie', cookieHeader);
    check(tenantsRes.status === 200 && Array.isArray(tenantsRes.body), 'GET /api/os/tenants (Tenants) succeeds (200)');

    const freePlanRes = await request(app)
      .post('/api/os/payments/initialize')
      .set('Origin', 'https://avartah.com')
      .set('Cookie', cookieHeader)
      .set('x-csrf-token', csrfToken)
      .send({ tenant_id: 'biz_demo_1', plan_id: 'free' });
    check(freePlanRes.status === 200 && freePlanRes.body.isFreePlan === true, 'Free plan selection succeeds (200) without Paystack');

    // =========================================================================
    // 3. Payment Endpoints Fail Securely Across All Misconfiguration Cases
    // =========================================================================
    console.log('\n--- 3. Payment Endpoints Fail Securely When Unconfigured or Mismatched ---');

    const failureScenarios: Array<{ name: string; setup: () => void }> = [
      {
        name: 'completely unconfigured',
        setup: () => {
          process.env.NODE_ENV = 'production';
          clearPaystackEnv();
        }
      },
      {
        name: 'missing PAYSTACK_MODE',
        setup: () => {
          process.env.NODE_ENV = 'production';
          clearPaystackEnv();
          process.env.PAYSTACK_SECRET_KEY = 'sk_live_mock_secret_123456';
          process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
        }
      },
      {
        name: 'invalid PAYSTACK_MODE',
        setup: () => {
          process.env.NODE_ENV = 'production';
          clearPaystackEnv();
          process.env.PAYSTACK_MODE = 'invalid_env';
          process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
          process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
        }
      },
      {
        name: 'missing secret key',
        setup: () => {
          process.env.NODE_ENV = 'production';
          clearPaystackEnv();
          process.env.PAYSTACK_MODE = 'live';
          process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
        }
      },
      {
        name: 'live mode with test key mismatch',
        setup: () => {
          process.env.NODE_ENV = 'production';
          clearPaystackEnv();
          process.env.PAYSTACK_MODE = 'live';
          process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_123456';
          process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
        }
      }
    ];

    for (const scenario of failureScenarios) {
      scenario.setup();

      // 3a. Initialize paid plan
      const initRes = await request(app)
        .post('/api/os/payments/initialize')
        .set('Origin', 'https://avartah.com')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ tenant_id: 'biz_demo_1', plan_id: 'growth' });
      check(
        initRes.status === 503 && initRes.body.success === false && initRes.body.errorCode === 'PAYMENT_GATEWAY_UNAVAILABLE',
        `[${scenario.name}] POST /api/os/payments/initialize fails safely with 503`
      );
      assertNoSecretLeak(initRes.body, `[${scenario.name}] initialize response`);

      // 3b. Verify payment
      const verifyRes = await request(app)
        .post('/api/os/payments/verify')
        .set('Origin', 'https://avartah.com')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ reference: 'avt_biz_de_growth_abcdef12' });
      check(
        verifyRes.status === 503 && verifyRes.body.success === false && verifyRes.body.errorCode === 'PAYMENT_GATEWAY_UNAVAILABLE',
        `[${scenario.name}] POST /api/os/payments/verify fails safely with 503`
      );
      assertNoSecretLeak(verifyRes.body, `[${scenario.name}] verify response`);

      // 3c. Callback handling
      const cbRes = await request(app).get('/api/os/payments/paystack/callback?reference=avt_biz_de_growth_abcdef12');
      check(
        cbRes.status === 503 && cbRes.body.success === false && cbRes.body.errorCode === 'PAYMENT_GATEWAY_UNAVAILABLE',
        `[${scenario.name}] GET /api/os/payments/paystack/callback fails safely with 503`
      );
      assertNoSecretLeak(cbRes.body, `[${scenario.name}] callback response`);

      // 3d. Webhook processing
      const webhookPayload = JSON.stringify({
        event: 'charge.success',
        data: { id: 123456, reference: 'avt_biz_de_growth_abcdef12', amount: 3500000, currency: 'NGN', status: 'success' }
      });
      const signedWithTest = crypto.createHmac('sha512', 'sk_test_mock_secret_123456').update(webhookPayload).digest('hex');
      const whRes = await request(app)
        .post('/api/os/payments/paystack/webhook')
        .set('x-paystack-signature', signedWithTest)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);
      check(
        whRes.status === 503 && whRes.body.success === false && whRes.body.errorCode === 'PAYMENT_GATEWAY_UNAVAILABLE',
        `[${scenario.name}] POST /api/os/payments/paystack/webhook fails safely with 503`
      );
      assertNoSecretLeak(whRes.body, `[${scenario.name}] webhook response`);
    }

    check(
      payments.size === 0 && subscriptions.size === 0 && webhookEvents.size === 0 && tenantPlanId === 'free' && fetchCalls === 0,
      'Zero payment records, subscriptions, webhook events, or external Paystack API calls created during unconfigured failure scenarios'
    );

    console.log('\n========================================================================');
    console.log(`  PAYSTACK READINESS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    process.env = origEnv;
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
    globalThis.fetch = origFetch;
  }
}

runPaystackReadinessTests().catch((err) => {
  console.error('Fatal Paystack readiness test error:', err);
  process.exit(1);
});
