import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import request from 'supertest';
import pool, {
  executeWithRetry,
  getNeonDiagnostics,
  isTransientNeonError,
  sanitizeDbErrorMessage
} from '../lib/neon.js';
import {
  AuthConfigurationError,
  createSession,
  getSessionSecret,
  isAuthConfigurationError,
  validateSession
} from '../lib/serverAuth.js';
import { verifyServerlessAdmin } from '../lib/serverless-auth.js';
import { MIGRATIONS, SITE_ANALYTICS_RECONCILIATION_SQL } from '../lib/migrations.js';

async function runRemediationVerificationTests() {
  console.log('========================================================================');
  console.log('AVARTAH SOLUTIONS — PRODUCTION REMEDIATION VERIFICATION SUITE');
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

  function assertNoSecretsInText(payload: unknown, secretTokens: string[], label: string) {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const hasSecret = secretTokens.some((tok) => tok && serialized.includes(tok));
    const hasPgUri = /postgres(?:ql)?:\/\/[^\s"']+/i.test(serialized);
    const hasStack = serialized.includes('at ') && serialized.includes('.ts:');
    check(!hasSecret && !hasPgUri && !hasStack, `${label} does not leak secrets, DB URIs, or stack traces`);
  }

  const origEnv = { ...process.env };
  const origQuery = pool.query.bind(pool);
  const origConnect = pool.connect.bind(pool);

  const VALID_SECRET_A = 'a'.repeat(64);
  const VALID_SECRET_B = 'b'.repeat(64);
  const TEST_DB_URL = 'postgresql://dbuser_secret:TopSecretPass99@ep-cool-mode-123456-pooler.us-east-2.aws.neon.tech/avartah_prod?sslmode=require';

  try {
    // =========================================================================
    // PART A: SESSION_SECRET FAIL-CLOSED & CONSISTENCY
    // =========================================================================
    console.log('--- PART A: SESSION_SECRET Validation, Fail-Closed & Signing Consistency ---');

    process.env.AVARTAH_TEST_MODE = '1';
    process.env.AVARTAH_SKIP_DB_INIT = '1';
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.APP_BASE_URL = 'https://avartahs-solution.vercel.app';
    process.env.ALLOWED_ORIGINS = 'https://avartahs-solution.vercel.app';

    let systemSettingsReads = 0;
    const activeSessions = new Map<string, any>();
    const adminHash = await bcrypt.hash('StrongAdminPass!2026', 10);

    const baseMockQuery = async (text: string, params: any[] = []) => {
      const q = text.replace(/\s+/g, ' ').trim();
      if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK' || q.startsWith('SET LOCAL')) {
        return { rows: [], rowCount: 0 };
      }
      if (q === 'SELECT 1') return { rows: [{ '?column?': 1 }], rowCount: 1 };
      if (q.includes('system_settings')) {
        systemSettingsReads++;
        return { rows: [{ value: 'db_fallback_secret_that_must_not_be_used_in_production_123456' }], rowCount: 1 };
      }
      if (q.startsWith('INSERT INTO rate_limit_events')) {
        return { rows: [{ count: 1, reset_time_ms: Date.now() + 60000 }], rowCount: 1 };
      }
      if (q.startsWith('SELECT count, EXTRACT(EPOCH FROM reset_time)')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
        const email = String(params[0] || '').toLowerCase();
        if (email === 'admin@avartah.com') {
          return {
            rows: [{ id: 1, email: 'admin@avartah.com', password_hash: adminHash, role: 'admin', is_active: true }],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM users WHERE LOWER(email) = LOWER($1)')) {
        return { rows: [], rowCount: 0 };
      }
      if (q.startsWith('INSERT INTO users')) {
        return {
          rows: [{ id: 101, email: String(params[0] || ''), role: 'user', is_active: true, created_at: new Date().toISOString() }],
          rowCount: 1
        };
      }
      if (q.startsWith('INSERT INTO admin_sessions')) {
        const [id, user_email, user_role, _createdAt, expires_at_ms] = params;
        activeSessions.set(id, {
          id,
          user_email,
          user_role,
          revoked: false,
          expires_at: typeof expires_at_ms === 'number' ? expires_at_ms : new Date(expires_at_ms).getTime()
        });
        return { rows: [], rowCount: 1 };
      }
      if (q.includes('FROM admin_sessions WHERE id = $1')) {
        const s = activeSessions.get(params[0]);
        if (s && !s.revoked && s.expires_at > Date.now()) {
          return { rows: [{ ...s }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (q.includes('FROM tenants')) {
        return {
          rows: [{ id: 'ten_1', name: 'Test Business', business_name: 'Test Business', owner_email: 'admin@avartah.com', plan_id: 'free', status: 'ACTIVE' }],
          rowCount: 1
        };
      }
      if (q.includes('FROM projects')) {
        return { rows: [{ id: 'proj_1', title: 'Apex System', visibility: 'public', is_archived: false }], rowCount: 1 };
      }
      if (q.includes('FROM blogs')) {
        return { rows: [{ id: 'blog_1', title: 'Scalable Neon', slug: 'scalable-neon', published: true }], rowCount: 1 };
      }
      if (q.includes('FROM subscription_plans WHERE id = $1')) {
        const planId = String(params[0] || '');
        if (planId === 'growth') {
          return { rows: [{ id: 'growth', name: 'Business Pro', price_ngn: 35000, price_usd: 25, is_active: true }], rowCount: 1 };
        }
        return { rows: [{ id: 'free', name: 'Free', price_ngn: 0, price_usd: 0, is_active: true }], rowCount: 1 };
      }
      if (q.includes('FROM subscription_plans')) {
        return {
          rows: [
            { id: 'free', name: 'Free', price_ngn: 0, is_active: true },
            { id: 'growth', name: 'Business Pro', price_ngn: 35000, is_active: true }
          ],
          rowCount: 2
        };
      }
      return { rows: [], rowCount: 0 };
    };

    (pool as any).query = baseMockQuery;
    (pool as any).connect = async () => ({ query: baseMockQuery, release: () => {} });

    const serverMod = await import('../server.js');
    const app = serverMod.default;
    await serverMod.startServer();

    // 1. Missing, weak, whitespace, and placeholder secrets MUST throw AuthConfigurationError in production
    process.env.NODE_ENV = 'production';
    for (const badSecret of [
      undefined,
      '',
      '   \t\n   ',
      'too_short_secret_under_32_chars',
      'your_minimum_32_characters_random_hex_secret_here',
      'change-me-in-production-000000000000000000'
    ]) {
      if (badSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = badSecret;

      let caught: any = null;
      try {
        await getSessionSecret();
      } catch (err) {
        caught = err;
      }
      check(
        caught instanceof AuthConfigurationError && isAuthConfigurationError(caught) && caught.statusCode === 503,
        `Production getSessionSecret rejects invalid secret (${badSecret === undefined ? 'unset' : JSON.stringify(badSecret.slice(0, 18))})`
      );
    }
    check(systemSettingsReads === 0, 'Production getSessionSecret NEVER reads or falls back to system_settings');

    // 2. Valid production SESSION_SECRET succeeds and is shared cleanly across serverAuth & serverless-auth
    process.env.SESSION_SECRET = VALID_SECRET_A;
    const resolvedSecret = await getSessionSecret();
    check(resolvedSecret === VALID_SECRET_A, 'Production getSessionSecret returns exact configured SESSION_SECRET');

    const mockReq: any = { headers: { 'user-agent': 'vitest-agent', 'x-vercel-ip': '198.51.100.42' }, socket: {} };
    const createdToken = await createSession('admin@avartah.com', 'admin', mockReq);
    const validated = await validateSession(createdToken);
    check(
      Boolean(validated && validated.email === 'admin@avartah.com' && validated.role === 'admin'),
      'createSession + validateSession roundtrip succeeds in production with valid SESSION_SECRET'
    );

    const makeMockServerlessRes = () => {
      const state = { statusCode: 200, body: null as any };
      const res: any = {
        status(code: number) {
          state.statusCode = code;
          return res;
        },
        json(data: any) {
          state.body = data;
        }
      };
      return { res, state };
    };

    const slOk = makeMockServerlessRes();
    const serverlessVerified = await verifyServerlessAdmin(
      { headers: { cookie: `admin_session=${encodeURIComponent(createdToken)}` } },
      slOk.res
    );
    check(
      serverlessVerified === true,
      'verifyServerlessAdmin validates the exact session cookie signed by createSession'
    );

    // 3. Clearing/changing SESSION_SECRET immediately invalidates sessions without stale cache
    process.env.SESSION_SECRET = VALID_SECRET_B;
    const validatedWrongSecret = await validateSession(createdToken);
    check(validatedWrongSecret === null, 'Changing SESSION_SECRET immediately rejects tokens signed with previous secret');

    delete process.env.SESSION_SECRET;
    let thrownOnValidate = false;
    try {
      await validateSession(createdToken);
    } catch (err) {
      thrownOnValidate = isAuthConfigurationError(err);
    }
    check(thrownOnValidate, 'Clearing SESSION_SECRET immediately causes validateSession to fail closed with AuthConfigurationError');

    const slMissing = makeMockServerlessRes();
    const serverlessMissing = await verifyServerlessAdmin(
      { headers: { cookie: `admin_session=${encodeURIComponent(createdToken)}` } },
      slMissing.res
    );
    check(
      serverlessMissing === false && slMissing.state.statusCode === 503,
      `verifyServerlessAdmin fails closed with 503 when SESSION_SECRET is unset (got ${slMissing.state.statusCode})`
    );

    // 4. HTTP auth endpoints return 503 (never 500 or fallback auth) when SESSION_SECRET is missing/weak
    delete process.env.SESSION_SECRET;
    const loginMissingRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@avartah.com', password: 'StrongAdminPass!2026' });
    check(
      loginMissingRes.status === 503 && loginMissingRes.body?.errorCode === 'AUTH_UNAVAILABLE',
      `POST /api/auth/login fails closed with 503 AUTH_UNAVAILABLE when SESSION_SECRET is missing (got ${loginMissingRes.status})`
    );
    assertNoSecretsInText(loginMissingRes.body, [VALID_SECRET_A, VALID_SECRET_B, 'TopSecretPass99'], '503 login response');

    process.env.SESSION_SECRET = 'short_123';
    const sessionWeakRes = await request(app).get('/api/auth/session');
    check(
      sessionWeakRes.status === 503 && sessionWeakRes.body?.errorCode === 'AUTH_UNAVAILABLE',
      `GET /api/auth/session fails closed with 503 AUTH_UNAVAILABLE when SESSION_SECRET is < 32 chars (got ${sessionWeakRes.status})`
    );

    const registerWeakRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@avartah.com', password: 'StrongUserPass!2026' });
    check(
      registerWeakRes.status === 503 && registerWeakRes.body?.errorCode === 'AUTH_UNAVAILABLE',
      `POST /api/auth/register fails closed with 503 AUTH_UNAVAILABLE when SESSION_SECRET is weak (got ${registerWeakRes.status})`
    );

    const tenantsWeakRes = await request(app)
      .get('/api/os/tenants')
      .set('Cookie', `admin_session=${encodeURIComponent(createdToken)}`);
    check(
      tenantsWeakRes.status === 503 && tenantsWeakRes.body?.errorCode === 'AUTH_UNAVAILABLE',
      `Protected /api/os/tenants fails closed with 503 AUTH_UNAVAILABLE when SESSION_SECRET is weak (got ${tenantsWeakRes.status})`
    );

    // Restore valid SESSION_SECRET and verify login + session + protected route succeed
    process.env.SESSION_SECRET = VALID_SECRET_A;
    const loginOk = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@avartah.com', password: 'StrongAdminPass!2026' });
    check(
      loginOk.status === 200 && loginOk.body?.success === true && loginOk.body?.user?.email === 'admin@avartah.com',
      'POST /api/auth/login succeeds with valid SESSION_SECRET'
    );
    const authCookies = loginOk.headers['set-cookie'];
    const sessionOk = await request(app).get('/api/auth/session').set('Cookie', authCookies);
    check(sessionOk.status === 200 && sessionOk.body?.authenticated === true, 'GET /api/auth/session verifies valid production session');

    // =========================================================================
    // PART B: NEON CONNECTION TIMEOUTS, RETRIES & COLD-START RECOVERY
    // =========================================================================
    console.log('\n--- PART B: Neon Connection Timeouts, Bounded Retries & Instance Recovery ---');

    check(
      isTransientNeonError(new Error('Connection terminated due to connection timeout')),
      'isTransientNeonError classifies "Connection terminated due to connection timeout" as transient'
    );
    check(
      isTransientNeonError(Object.assign(new Error('cannot connect now'), { code: '57P03' })),
      'isTransientNeonError classifies SQLSTATE 57P03 as transient'
    );
    check(
      !isTransientNeonError(Object.assign(new Error('column "page_views" of relation "site_analytics" does not exist'), { code: '42703' })),
      'isTransientNeonError does NOT classify schema error 42703 as transient'
    );
    check(
      !isTransientNeonError(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' })),
      'isTransientNeonError does NOT classify unique violation 23505 as transient'
    );

    let retryAttempts = 0;
    const retryResult = await executeWithRetry(
      'test_transient_recovery',
      async () => {
        retryAttempts++;
        if (retryAttempts < 3) {
          throw new Error('Connection terminated due to connection timeout');
        }
        return 'ok';
      },
      { maxAttempts: 3, baseDelayMs: 5 }
    );
    check(retryAttempts === 3 && retryResult === 'ok', 'executeWithRetry retries transient timeout and recovers cleanly');

    let nonTransientAttempts = 0;
    let nonTransientErr: any = null;
    try {
      await executeWithRetry(
        'test_schema_no_retry',
        async () => {
          nonTransientAttempts++;
          throw Object.assign(new Error('column "id" does not exist'), { code: '42703' });
        },
        { maxAttempts: 3, baseDelayMs: 5 }
      );
    } catch (err) {
      nonTransientErr = err;
    }
    check(nonTransientAttempts === 1 && nonTransientErr?.code === '42703', 'executeWithRetry does NOT retry permanent SQL errors');

    const redacted = sanitizeDbErrorMessage('Connection failed for postgresql://secretuser:MySecret99@ep-test-pooler.neon.tech/neondb?sslmode=require');
    check(
      !redacted.includes('MySecret99') && !redacted.includes('secretuser') && redacted.includes('[REDACTED]'),
      'sanitizeDbErrorMessage redacts PostgreSQL credentials completely'
    );

    const diag = getNeonDiagnostics();
    check(
      diag.configured &&
        diag.validUrl &&
        diag.isNeonHost &&
        diag.isPooledEndpoint &&
        diag.sslMode === 'require' &&
        diag.host === 'ep-cool-mode-123456-pooler.us-east-2.aws.neon.tech',
      'getNeonDiagnostics safely inspects host, pooler status, and sslmode without exposing credentials'
    );
    assertNoSecretsInText(diag, ['TopSecretPass99', 'dbuser_secret'], 'Neon diagnostics');

    // Test cold-start DB init failure recovery (must NOT permanently poison dbInitPromise!)
    delete process.env.AVARTAH_SKIP_DB_INIT;
    serverMod.resetDbInitStateForTesting();

    (pool as any).connect = async () => {
      throw new Error('Connection terminated due to connection timeout');
    };
    (pool as any).query = async () => {
      throw new Error('Connection terminated due to connection timeout');
    };

    const failInitReq = await request(app).get('/api/projects');
    check(
      failInitReq.status === 503,
      `Transient DB init timeout returns truthful 503 (no fake 200 data) (got ${failInitReq.status})`
    );
    assertNoSecretsInText(failInitReq.body, ['TopSecretPass99', 'dbuser_secret', VALID_SECRET_A], '503 DB failure response');

    // Now restore working DB without restarting server — warm instance must self-heal!
    (pool as any).connect = async () => ({ query: baseMockQuery, release: () => {} });
    (pool as any).query = baseMockQuery;

    const recoverProjects = await request(app).get('/api/projects');
    const recoverHealth = await request(app).get('/api/db-health');
    const recoverReady = await request(app).get('/api/ready');
    check(
      recoverProjects.status === 200 && Array.isArray(recoverProjects.body) && recoverProjects.body.length > 0,
      'Subsequent /api/projects recovers to 200 after initial DB timeout (dbInitPromise was not permanently poisoned)'
    );
    check(
      recoverHealth.status === 200 && recoverHealth.body?.status === 'connected' && Boolean(recoverHealth.body?.neon?.host),
      `/api/db-health returns 200 with safe Neon diagnostics on recovery (got ${recoverHealth.status} ${JSON.stringify(recoverHealth.body)})`
    );
    check(
      recoverReady.status === 200 && recoverReady.body?.status === 'ready' && recoverReady.body?.database === 'connected',
      `/api/ready returns 200 status=ready on recovery (got ${recoverReady.status} ${JSON.stringify(recoverReady.body)})`
    );
    assertNoSecretsInText(recoverHealth.body, ['TopSecretPass99', 'dbuser_secret', VALID_SECRET_A], '/api/db-health response');

    // Re-enable skip-db-init for deterministic isolated endpoint checks below
    process.env.AVARTAH_SKIP_DB_INIT = '1';

    // =========================================================================
    // PART C: site_analytics SCHEMA MIGRATION & ENDPOINT RECONCILIATION
    // =========================================================================
    console.log('\n--- PART C: site_analytics Schema Reconciliation & Endpoint Safety ---');

    const migration033 = MIGRATIONS.find((m) => m.id === '033_site_analytics_schema_reconciliation');
    check(Boolean(migration033), 'Migration 033_site_analytics_schema_reconciliation is registered in MIGRATIONS');
    check(
      !/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\s+site_analytics\b/i.test(SITE_ANALYTICS_RECONCILIATION_SQL),
      'Migration 033 is strictly non-destructive (no DROP/TRUNCATE/DELETE)'
    );
    const requiredAnalyticsColumns = [
      'id',
      'visitor_id',
      'user_email',
      'ip_address',
      'user_agent',
      'referrer',
      'session_start',
      'duration_seconds',
      'page_views',
      'form_progress',
      'submitted',
      'is_pricing_sensitive',
      'cta_clicks',
      'exit_page',
      'step_durations',
      'whatsapp_handshake',
      'calendly_handshake',
      'created_at',
      'updated_at'
    ];
    check(
      requiredAnalyticsColumns.every((col) =>
        new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${col}\\b`, 'i').test(SITE_ANALYTICS_RECONCILIATION_SQL)
      ),
      'Migration 033 reconciles all 19 site_analytics columns via ADD COLUMN IF NOT EXISTS'
    );
    check(
      SITE_ANALYTICS_RECONCILIATION_SQL.includes('ROW_NUMBER() OVER') &&
        SITE_ANALYTICS_RECONCILIATION_SQL.includes('uq_site_analytics_id') &&
        SITE_ANALYTICS_RECONCILIATION_SQL.includes("contype = 'p'"),
      'Migration 033 preserves legacy PKs, backfills deterministic unique id values, and creates uq_site_analytics_id'
    );

    // Simulate legacy site_analytics table behavior & route handlers
    const analyticsStore = new Map<string, any>([
      ['vis_legacy_001', { id: 'legacy_pk_row_1', visitor_id: 'vis_legacy_001', page_views: 1, duration_seconds: 12 }]
    ]);
    let simulateLegacyVisitorPkConflict = false;
    let analyticsDbDown = false;

    const analyticsMockQuery = async (text: string, params: any[] = []) => {
      const q = text.replace(/\s+/g, ' ').trim();
      if (q.includes('site_analytics')) {
        if (analyticsDbDown) {
          throw new Error('Connection terminated due to connection timeout');
        }
        if (q.startsWith('INSERT INTO site_analytics')) {
          const visitorId = params[0];
          const isInitQuery = params.length === 12;
          const durationSeconds = isInitQuery ? params[2] : params[1];
          const pages = isInitQuery ? params[3] : params[2];
          const formProgress = isInitQuery ? params[4] : params[3];
          const submitted = isInitQuery ? params[5] : params[4];
          const isPricingSensitive = isInitQuery ? params[6] : params[5];
          const exitPage = isInitQuery ? params[8] : params[7];
          if (simulateLegacyVisitorPkConflict) {
            simulateLegacyVisitorPkConflict = false;
            throw Object.assign(new Error('duplicate key value violates unique constraint "site_analytics_pkey"'), { code: '23505' });
          }
          const existing = analyticsStore.get(visitorId) || Array.from(analyticsStore.values()).find((r) => r.visitor_id === visitorId);
          analyticsStore.set(visitorId, {
            id: visitorId,
            visitor_id: visitorId,
            duration_seconds: durationSeconds,
            page_views: pages ?? (existing ? (existing.page_views || 1) + 1 : 1),
            form_progress: formProgress,
            submitted,
            is_pricing_sensitive: isPricingSensitive,
            exit_page: exitPage
          });
          return { rows: [], rowCount: 1 };
        }
        if (q.startsWith('UPDATE site_analytics') && q.includes('WHERE visitor_id = $1')) {
          const visitorId = params[0];
          const isInitFallback = params.length === 12;
          const durationSeconds = isInitFallback ? params[2] : params[1];
          const pages = isInitFallback ? params[3] : params[2];
          const formProgress = isInitFallback ? params[4] : params[3];
          const submitted = isInitFallback ? params[5] : params[4];
          const isPricingSensitive = isInitFallback ? params[6] : params[5];
          const exitPage = isInitFallback ? params[8] : params[7];
          const row = Array.from(analyticsStore.values()).find((r) => r.visitor_id === visitorId);
          if (!row) return { rows: [], rowCount: 0 };
          row.duration_seconds = durationSeconds;
          row.page_views = pages ?? ((row.page_views || 1) + 1);
          row.form_progress = formProgress;
          row.submitted = submitted;
          row.is_pricing_sensitive = isPricingSensitive;
          row.exit_page = exitPage;
          return { rows: [], rowCount: 1 };
        }
        if (q.startsWith('UPDATE site_analytics') && (q.includes('WHERE id = $6 OR visitor_id = $6') || q.includes('WHERE visitor_id = $6'))) {
          const [durationSeconds, _pages, formProgress, submitted, isPricingSensitive, visitorId, _cta, exitPage] = params;
          const row = analyticsStore.get(visitorId) || Array.from(analyticsStore.values()).find((r) => r.visitor_id === visitorId);
          if (!row) return { rows: [], rowCount: 0 };
          row.duration_seconds = durationSeconds;
          row.form_progress = formProgress;
          row.submitted = submitted;
          row.is_pricing_sensitive = isPricingSensitive;
          row.exit_page = exitPage;
          return { rows: [], rowCount: 1 };
        }
      }
      return baseMockQuery(text, params);
    };

    (pool as any).query = analyticsMockQuery;
    (pool as any).connect = async () => ({ query: analyticsMockQuery, release: () => {} });

    // Test idempotent init + repeat init + legacy 23505 fallback + sync upsert + concurrent execution
    const initRes1 = await request(app)
      .post('/api/analytics/init')
      .send({ visitor_id: 'vis_new_999', duration_seconds: 5, page_views: 1, exit_page: '/' });
    const initRes2 = await request(app)
      .post('/api/analytics/init')
      .send({ visitor_id: 'vis_new_999', duration_seconds: 15, page_views: 2, exit_page: '/pricing' });
    check(
      initRes1.status === 200 && initRes2.status === 200 && analyticsStore.get('vis_new_999')?.page_views === 2,
      'POST /api/analytics/init executes repeatedly without duplicate errors'
    );

    simulateLegacyVisitorPkConflict = true;
    const legacyPkRes = await request(app)
      .post('/api/analytics/init')
      .send({ visitor_id: 'vis_legacy_001', duration_seconds: 40, exit_page: '/services' });
    check(
      legacyPkRes.status === 200 && analyticsStore.get('vis_legacy_001')?.duration_seconds === 40,
      'POST /api/analytics/init safely updates pre-existing legacy visitor_id PK rows on 23505 conflict'
    );

    // Sync for a row that has not called /init yet triggers upsert fallback cleanly
    const syncUpsertRes = await request(app)
      .patch('/api/analytics/sync')
      .send({ visitor_id: 'vis_cold_sync_1', duration_seconds: 22, form_progress: 40, exit_page: '/audit' });
    check(
      syncUpsertRes.status === 200 && analyticsStore.has('vis_cold_sync_1'),
      `PATCH /api/analytics/sync creates/upserts record safely when UPDATE matches 0 rows (got ${syncUpsertRes.status})`
    );

    // Concurrent calls
    const concurrentResults = await Promise.all([
      request(app).post('/api/analytics/init').send({ visitor_id: 'vis_conc_1', duration_seconds: 1 }),
      request(app).patch('/api/analytics/sync').send({ visitor_id: 'vis_conc_1', duration_seconds: 10 }),
      request(app).post('/api/analytics/init').send({ visitor_id: 'vis_conc_2', duration_seconds: 2 })
    ]);
    check(
      concurrentResults.every((r) => r.status === 200),
      'Concurrent /api/analytics/init and /api/analytics/sync requests complete cleanly'
    );

    // DB outage on analytics returns truthful 503 (never fake 200 success:false)
    analyticsDbDown = true;
    const initDbDownRes = await request(app).post('/api/analytics/init').send({ visitor_id: 'vis_down' });
    const syncDbDownRes = await request(app).patch('/api/analytics/sync').send({ visitor_id: 'vis_down' });
    check(
      initDbDownRes.status === 503 && syncDbDownRes.status === 503,
      `Analytics endpoints return truthful 503 during DB outage (got init=${initDbDownRes.status}, sync=${syncDbDownRes.status})`
    );
    analyticsDbDown = false;

    // =========================================================================
    // PART D: PAYSTACK REGRESSION CHECK
    // =========================================================================
    console.log('\n--- PART D: Paystack Readiness & Core Route Isolation ---');

    process.env.NODE_ENV = 'production';
    process.env.SESSION_SECRET = VALID_SECRET_A;
    delete process.env.PAYSTACK_MODE;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_CALLBACK_URL;
    delete process.env.VITE_PAYSTACK_PUBLIC_KEY;

    const csrfTokenHeader = String(loginOk.headers['x-csrf-token'] || '');
    const mergedCookies = [
      ...(Array.isArray(authCookies) ? authCookies : [authCookies].filter(Boolean)),
      ...(csrfTokenHeader ? [`XSRF-TOKEN=${csrfTokenHeader}`] : [])
    ];

    const [projNonPay, blogNonPay, plansNonPay, authNonPay, tenantsNonPay] = await Promise.all([
      request(app).get('/api/projects'),
      request(app).get('/api/blogs').set('Cookie', mergedCookies),
      request(app).get('/api/os/plans'),
      request(app).get('/api/auth/session').set('Cookie', mergedCookies),
      request(app).get('/api/os/tenants').set('Cookie', mergedCookies)
    ]);
    check(
      projNonPay.status === 200 &&
        blogNonPay.status === 200 &&
        plansNonPay.status === 200 &&
        authNonPay.status === 200 &&
        tenantsNonPay.status === 200,
      `All core routes remain operational in production when Paystack env vars are unconfigured (proj=${projNonPay.status}, blogs=${blogNonPay.status}, plans=${plansNonPay.status}, auth=${authNonPay.status}, tenants=${tenantsNonPay.status})`
    );

    const payInitRes = await request(app)
      .post('/api/os/payments/initialize')
      .set('Cookie', mergedCookies)
      .set('x-csrf-token', csrfTokenHeader)
      .send({ tenant_id: 'ten_1', plan_id: 'growth' });
    const payVerifyRes = await request(app)
      .post('/api/os/payments/verify')
      .set('Cookie', mergedCookies)
      .set('x-csrf-token', csrfTokenHeader)
      .send({ reference: 'ref_missing_cfg_123' });
    const payCallbackRes = await request(app).get('/api/os/payments/paystack/callback?reference=ref_missing_cfg_123');
    const payWebhookRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('x-paystack-signature', crypto.createHmac('sha512', 'wrong').update('{}').digest('hex'))
      .send({ event: 'charge.success' });

    check(
      payInitRes.status === 503 &&
        payVerifyRes.status === 503 &&
        payCallbackRes.status === 503 &&
        payWebhookRes.status === 503,
      `Payment endpoints fail closed with 503 when Paystack is unconfigured (init=${payInitRes.status}, verify=${payVerifyRes.status}, cb=${payCallbackRes.status}, wh=${payWebhookRes.status})`
    );
    assertNoSecretsInText(
      { payInit: payInitRes.body, payVerify: payVerifyRes.body, payWebhook: payWebhookRes.body },
      [VALID_SECRET_A, 'TopSecretPass99'],
      '503 Paystack responses'
    );
  } finally {
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
    process.env = origEnv;
  }

  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRemediationVerificationTests().catch((err) => {
  console.error('Fatal test suite error:', err);
  process.exit(1);
});
