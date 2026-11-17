import assert from 'assert';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import pool from '../lib/neon.js';
import {
  validatePaystackModeAndKey,
  validatePaystackStartupConfig,
  resolvePaystackCallbackUrl
} from '../lib/paystack.js';
import { executeDirectHttpProbe } from '../lib/auditDiagnostics.js';

interface MockAdminUser {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MockOrdinaryUser {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface MockSession {
  id: string;
  user_email: string;
  revoked: boolean;
  expires_at: number;
  ip_address?: string | null;
  user_agent?: string | null;
}

interface MockRateLimitRow {
  key: string;
  count: number;
  reset_time_ms: number;
}

interface MockResetToken {
  id: string;
  user_email: string;
  token_hash: string;
  expires_at: number;
  used: boolean;
}

function parseCookiePairs(setCookieHeaders: string[] | string | undefined): Record<string, string> {
  const arr = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : setCookieHeaders
    ? [setCookieHeaders]
    : [];
  const out: Record<string, string> = {};
  for (const header of arr) {
    const first = header.split(';')[0] || '';
    const eq = first.indexOf('=');
    if (eq > 0) {
      out[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
    }
  }
  return out;
}

function buildCookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function runSecurityVerificationSuite() {
  console.log('========================================================================');
  console.log('AVARTAH SOLUTIONS — TARGETED SECURITY & BACKEND FIXES VERIFICATION SUITE');
  console.log('========================================================================\n');

  const origEnv = { ...process.env };
  const origQuery = pool.query.bind(pool);
  const origConnect = pool.connect.bind(pool);
  const origConsoleLog = console.log;
  const origConsoleError = console.error;
  const capturedLogs: string[] = [];

  process.env.AVARTAH_TEST_MODE = '1';
  process.env.AVARTAH_SKIP_DB_INIT = '1';
  process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/avartah_mock';
  process.env.SESSION_SECRET = 'mock_super_secure_session_secret_at_least_32_characters_long';
  process.env.NODE_ENV = 'test';
  process.env.PAYSTACK_MODE = 'test';
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_key_1234567890abcdef';
  process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
  process.env.APP_BASE_URL = 'https://avartah.com';
  process.env.ALLOWED_ORIGINS = 'https://avartah.com,https://www.avartah.com';
  delete process.env.RESEND_API_KEY;

  const adminPassHash = await bcrypt.hash('AdminStrongPass!123', 10);
  const state = {
    nextAdminId: 2,
    nextUserId: 1,
    adminUsers: [
      {
        id: 1,
        email: 'admin@avartah.com',
        password_hash: adminPassHash,
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ] as MockAdminUser[],
    users: [] as MockOrdinaryUser[],
    sessions: new Map<string, MockSession>(),
    rateLimits: new Map<string, MockRateLimitRow>(),
    resetTokens: [] as MockResetToken[],
    workspaces: [{ id: 'ws_1', owner_email: 'admin@avartah.com', name: 'Test Workspace' }],
    invitations: [] as any[],
    analytics: [
      { step: 1, daysAgo: 2 },
      { step: 2, daysAgo: 3 },
      { step: 1, daysAgo: 20 },
      { step: 3, daysAgo: 25 },
      { step: 4, daysAgo: 60 }
    ],
    prospects: [] as any[],
    crmLeads: [] as any[],
    proposals: [] as any[],
    clientProjects: [] as any[],
    payments: [] as any[],
    subscriptions: [] as any[],
    subscriptionPlans: [{ id: 'pro', price_ngn: 25000 }],
    forceDbErrorOnce: false
  };

  async function mockQuery(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
      return { rows: [] };
    }

    if (state.forceDbErrorOnce && q.includes('FROM site_analytics')) {
      state.forceDbErrorOnce = false;
      throw new Error('FATAL_INTERNAL_SQL_STATE_SECRET_LEAK: relation "secret_internal_table" password=supersecret');
    }

    // rate_limit_events
    if (q.startsWith('INSERT INTO rate_limit_events')) {
      const key = String(params[0]);
      const windowSec = Number(params[1] || 60);
      const now = Date.now();
      const existing = state.rateLimits.get(key);
      if (!existing || existing.reset_time_ms < now) {
        const nextRow = { key, count: 1, reset_time_ms: now + windowSec * 1000 };
        state.rateLimits.set(key, nextRow);
        return { rows: [{ count: 1, reset_time_ms: nextRow.reset_time_ms }] };
      }
      existing.count += 1;
      return { rows: [{ count: existing.count, reset_time_ms: existing.reset_time_ms }] };
    }

    if (q.startsWith('SELECT count, EXTRACT(EPOCH FROM reset_time)')) {
      const key = String(params[0]);
      const existing = state.rateLimits.get(key);
      if (!existing || existing.reset_time_ms <= Date.now()) return { rows: [] };
      return { rows: [{ count: existing.count, reset_time_ms: existing.reset_time_ms }] };
    }

    if (q.startsWith('DELETE FROM rate_limit_events WHERE key = ANY($1)')) {
      const keys: string[] = params[0] || [];
      for (const k of keys) state.rateLimits.delete(k);
      return { rows: [] };
    }

    // Sessions
    if (q.startsWith('INSERT INTO admin_sessions')) {
      const [id, user_email, _user_role, _created_at, expires_at_ms, ip_address, user_agent] = params;
      state.sessions.set(id, {
        id,
        user_email: String(user_email).toLowerCase(),
        revoked: false,
        expires_at: typeof expires_at_ms === 'number' ? expires_at_ms : new Date(expires_at_ms).getTime(),
        ip_address,
        user_agent
      });
      return { rows: [] };
    }

    if (q.startsWith('SELECT * FROM admin_sessions WHERE id = $1')) {
      const s = state.sessions.get(params[0]);
      if (s && !s.revoked && s.expires_at > Date.now()) {
        return { rows: [s] };
      }
      return { rows: [] };
    }

    if (q.startsWith('UPDATE admin_sessions SET revoked = TRUE WHERE id = $1')) {
      const s = state.sessions.get(params[0]);
      if (s) s.revoked = true;
      return { rows: [] };
    }

    if (q.startsWith('UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND id != $2')) {
      const email = String(params[0]).toLowerCase();
      const keepId = String(params[1]);
      for (const s of state.sessions.values()) {
        if (s.user_email.toLowerCase() === email && s.id !== keepId) {
          s.revoked = true;
        }
      }
      return { rows: [] };
    }

    if (q.startsWith('UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1) AND revoked = FALSE RETURNING id')) {
      const email = String(params[0]).toLowerCase();
      const revokedRows: any[] = [];
      for (const s of state.sessions.values()) {
        if (s.user_email.toLowerCase() === email && !s.revoked) {
          s.revoked = true;
          revokedRows.push({ id: s.id });
        }
      }
      return { rows: revokedRows };
    }

    if (q.startsWith('UPDATE admin_sessions SET revoked = TRUE WHERE LOWER(user_email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      for (const s of state.sessions.values()) {
        if (s.user_email.toLowerCase() === email) {
          s.revoked = true;
        }
      }
      return { rows: [] };
    }

    // admin_users queries
    if (q.startsWith('SELECT * FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.adminUsers.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ ...found }] : [] };
    }

    if (q.startsWith('SELECT email FROM admin_users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE')) {
      const email = String(params[0]).toLowerCase();
      const found = state.adminUsers.find(u => u.email.toLowerCase() === email && u.is_active);
      return { rows: found ? [{ email: found.email }] : [] };
    }

    if (q.startsWith('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.adminUsers.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ id: found.id }] : [] };
    }

    if (q.startsWith('SELECT id, email, role, is_active FROM admin_users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.adminUsers.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ id: found.id, email: found.email, role: found.role, is_active: found.is_active }] : [] };
    }

    if (q.startsWith('SELECT id, email, role, is_active, created_at, updated_at FROM admin_users ORDER BY id ASC')) {
      return {
        rows: state.adminUsers.map(({ password_hash: _ph, ...rest }) => rest)
      };
    }

    if (q.startsWith('INSERT INTO admin_users (email, password_hash, role, is_active)')) {
      const [email, password_hash, role] = params;
      const created: MockAdminUser = {
        id: state.nextAdminId++,
        email: String(email).toLowerCase(),
        password_hash,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.adminUsers.push(created);
      const { password_hash: _ph, ...safe } = created;
      return { rows: [safe] };
    }

    if (q.startsWith('SELECT * FROM admin_users WHERE id = $1 FOR UPDATE')) {
      const idNum = Number(params[0]);
      const found = state.adminUsers.find(u => u.id === idNum);
      return { rows: found ? [{ ...found }] : [] };
    }

    if (q.startsWith("SELECT id FROM admin_users WHERE role = 'admin' AND is_active = TRUE AND id != $1")) {
      const idNum = Number(params[0]);
      return {
        rows: state.adminUsers
          .filter(u => u.role === 'admin' && u.is_active && u.id !== idNum)
          .map(u => ({ id: u.id }))
      };
    }

    if (q.startsWith('UPDATE admin_users SET ')) {
      const setMatch = q.match(/SET (.+?) WHERE ([\w()]+) = \$(\d+)/);
      if (setMatch) {
        const setParts = setMatch[1].split(',').map(s => s.trim());
        const whereCol = setMatch[2];
        const whereParamIdx = Number(setMatch[3]) - 1;
        const whereVal = params[whereParamIdx];
        const targets = state.adminUsers.filter(u =>
          whereCol === 'id' ? u.id === Number(whereVal) : u.email.toLowerCase() === String(whereVal).toLowerCase()
        );
        for (const t of targets) {
          for (const part of setParts) {
            const pMatch = part.match(/(\w+)\s*=\s*\$(\d+)/);
            if (pMatch) {
              const col = pMatch[1];
              const val = params[Number(pMatch[2]) - 1];
              (t as any)[col] = val;
            }
          }
          t.updated_at = new Date().toISOString();
        }
        return {
          rows: targets.map(({ password_hash: _ph, ...rest }) => rest)
        };
      }
    }

    if (q.startsWith('DELETE FROM admin_users WHERE id = $1')) {
      const idNum = Number(params[0]);
      state.adminUsers = state.adminUsers.filter(u => u.id !== idNum);
      return { rows: [] };
    }

    // users queries
    if (q.startsWith('SELECT * FROM users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.users.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ ...found }] : [] };
    }

    if (q.startsWith('SELECT id FROM users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.users.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ id: found.id }] : [] };
    }

    if (q.startsWith('SELECT email FROM users WHERE LOWER(email) = LOWER($1) AND is_active = TRUE')) {
      const email = String(params[0]).toLowerCase();
      const found = state.users.find(u => u.email.toLowerCase() === email && u.is_active);
      return { rows: found ? [{ email: found.email }] : [] };
    }

    if (q.startsWith('SELECT id, email, role, is_active FROM users WHERE LOWER(email) = LOWER($1)')) {
      const email = String(params[0]).toLowerCase();
      const found = state.users.find(u => u.email.toLowerCase() === email);
      return { rows: found ? [{ id: found.id, email: found.email, role: found.role, is_active: found.is_active }] : [] };
    }

    if (q.startsWith('INSERT INTO users (email, password_hash, role, is_active)')) {
      const [email, password_hash] = params;
      const created: MockOrdinaryUser = {
        id: state.nextUserId++,
        email: String(email).toLowerCase(),
        password_hash,
        role: 'user',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.users.push(created);
      const { password_hash: _ph, ...safe } = created;
      return { rows: [safe] };
    }

    if (q.startsWith('UPDATE users SET password_hash = $1')) {
      const [hash, identifier] = params;
      const user = state.users.find(u =>
        typeof identifier === 'number' || /^\d+$/.test(String(identifier))
          ? u.id === Number(identifier)
          : u.email.toLowerCase() === String(identifier).toLowerCase()
      );
      if (user) {
        user.password_hash = hash;
        user.updated_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (q.includes('FROM users u') && q.includes('AS active_sessions')) {
      let rows = state.users.map(u => {
        let activeSessions = 0;
        for (const s of state.sessions.values()) {
          if (s.user_email.toLowerCase() === u.email.toLowerCase() && !s.revoked && s.expires_at > Date.now()) {
            activeSessions++;
          }
        }
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          is_active: u.is_active,
          created_at: u.created_at,
          updated_at: u.updated_at,
          active_sessions: activeSessions
        };
      });
      if (params[0]) {
        const needle = String(params[0]).replace(/%/g, '').toLowerCase();
        rows = rows.filter(r => r.email.toLowerCase().includes(needle));
      }
      if (q.includes('u.is_active = TRUE')) rows = rows.filter(r => r.is_active);
      if (q.includes('u.is_active = FALSE')) rows = rows.filter(r => !r.is_active);
      return { rows };
    }

    if (q.startsWith('SELECT id, email, role, is_active FROM users WHERE id = $1 FOR UPDATE')) {
      const idNum = Number(params[0]);
      const found = state.users.find(u => u.id === idNum);
      return { rows: found ? [{ ...found }] : [] };
    }

    if (q.startsWith('SELECT id, email FROM users WHERE id = $1')) {
      const idNum = Number(params[0]);
      const found = state.users.find(u => u.id === idNum);
      return { rows: found ? [{ id: found.id, email: found.email }] : [] };
    }

    if (q.startsWith('UPDATE users SET is_active = $1')) {
      const [isActive, id] = params;
      const found = state.users.find(u => u.id === Number(id));
      if (!found) return { rows: [] };
      found.is_active = Boolean(isActive);
      found.updated_at = new Date().toISOString();
      const { password_hash: _ph, ...safe } = found;
      return { rows: [safe] };
    }

    // password_reset_tokens
    if (q.startsWith('INSERT INTO password_reset_tokens')) {
      const [id, user_email, token_hash, expires_at] = params;
      state.resetTokens.push({
        id,
        user_email: String(user_email).toLowerCase(),
        token_hash,
        expires_at: new Date(expires_at).getTime(),
        used: false
      });
      return { rows: [] };
    }

    if (q.startsWith('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1')) {
      const tok = state.resetTokens.find(t => t.id === params[0]);
      if (tok) tok.used = true;
      return { rows: [] };
    }

    // workspaces / invitations
    if (q.startsWith('SELECT role FROM workspace_memberships') || q.startsWith('SELECT role, status FROM workspace_memberships')) {
      const wsId = params[0];
      const email = String(params[1] || '').toLowerCase();
      if (wsId === 'ws_1' && email === 'admin@avartah.com') {
        return { rows: [{ role: 'owner', status: 'active' }] };
      }
      return { rows: [] };
    }

    if (q.startsWith('SELECT name FROM workspaces WHERE id = $1')) {
      const ws = state.workspaces.find(w => w.id === params[0]);
      return { rows: ws ? [{ name: ws.name }] : [] };
    }

    if (q.includes('FROM workspaces w') && q.includes('WHERE w.id = $1')) {
      const ws = state.workspaces.find(w => w.id === params[0]);
      return { rows: ws ? [{ ...ws, user_role: 'owner' }] : [] };
    }

    if (q.startsWith('INSERT INTO workspace_invitations')) {
      const [id, workspace_id, email, role, token_hash, invited_by, expires_at] = params;
      const inv = { id, workspace_id, email, role, token_hash, invited_by, status: 'pending', created_at: new Date().toISOString(), expires_at };
      state.invitations.push(inv);
      return { rows: [inv] };
    }

    if (q.startsWith('DELETE FROM workspace_invitations') || q.startsWith('UPDATE workspace_invitations SET status =')) {
      return { rows: [] };
    }

    // Analytics Funnel
    if (q.includes('FROM site_analytics') && q.includes('GROUP BY form_progress')) {
      let maxDays = Infinity;
      if (q.includes("INTERVAL '7 days'")) maxDays = 7;
      else if (q.includes("INTERVAL '30 days'")) maxDays = 30;
      const counts = new Map<number, number>();
      for (const row of state.analytics) {
        if (row.daysAgo <= maxDays) {
          counts.set(row.step, (counts.get(row.step) || 0) + 1);
        }
      }
      const rows = Array.from(counts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([step, count]) => ({ step, count }));
      return { rows };
    }

    // Business Intelligence
    if (q === 'SELECT COUNT(*)::int AS count FROM prospects') return { rows: [{ count: state.prospects.length }] };
    if (q === "SELECT COUNT(*)::int AS count FROM prospects WHERE qualification_status = 'QUALIFIED'") {
      return { rows: [{ count: state.prospects.filter(p => p.qualification_status === 'QUALIFIED').length }] };
    }
    if (q === 'SELECT COUNT(*)::int AS count FROM crm_leads') return { rows: [{ count: state.crmLeads.length }] };
    if (q === 'SELECT COUNT(*)::int AS count FROM proposals') return { rows: [{ count: state.proposals.length }] };
    if (q === 'SELECT COUNT(*)::int AS count FROM client_projects') return { rows: [{ count: state.clientProjects.length }] };
    if (q === 'SELECT COALESCE(SUM(budget), 0)::float AS total FROM client_projects') {
      const total = state.clientProjects.reduce((acc, p) => acc + Number(p.budget || 0), 0);
      return { rows: [{ total }] };
    }
    if (q === "SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments WHERE status = 'SUCCESS'") {
      const total = state.payments.filter(p => p.status === 'SUCCESS').reduce((acc, p) => acc + Number(p.amount || 0), 0);
      return { rows: [{ total }] };
    }
    if (q.includes('FROM subscriptions s') && q.includes('JOIN subscription_plans sp')) {
      const total = state.subscriptions
        .filter(s => String(s.status || '').toLowerCase() === 'active')
        .reduce((acc, s) => {
          const plan = state.subscriptionPlans.find(sp => sp.id === s.plan_id);
          return acc + Number(plan?.price_ngn || 0);
        }, 0);
      return { rows: [{ total }] };
    }

    // Diagnostics error trigger test
    if (q.startsWith('SELECT COUNT(*) AS count FROM site_analytics') || q.startsWith('SELECT * FROM site_analytics')) {
      return { rows: [{ count: state.analytics.length }] };
    }

    return { rows: [] };
  }

  (pool as any).query = mockQuery;
  (pool as any).connect = async () => ({
    query: mockQuery,
    release: () => {}
  });

  // Intercept console to assert zero secret/token leakage
  console.log = (...args: any[]) => {
    capturedLogs.push(args.map(a => String(a)).join(' '));
    origConsoleLog(...args);
  };
  console.error = (...args: any[]) => {
    capturedLogs.push(args.map(a => String(a)).join(' '));
    origConsoleError(...args);
  };

  let passed = 0;
  let failed = 0;
  function check(condition: boolean, label: string, detail?: string) {
    if (condition) {
      origConsoleLog(`  [PASS] ${label}`);
      passed++;
    } else {
      origConsoleError(`  [FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  try {
    const serverMod = await import('../server.js');
    await serverMod.startServer();
    const app = serverMod.app;

    // ------------------------------------------------------------------
    // 1. No Reset Token Disclosure & Strict Trusted Base URL
    // ------------------------------------------------------------------
    console.log('\n--- 1. Password-Reset Token Disclosure & Trusted Base URL ---');
    const logCountBeforeForgot = capturedLogs.length;
    const forgotNoEmailRes = await request(app)
      .post('/api/auth/forgot-password')
      .set('Origin', 'https://attacker.evil.example')
      .send({ email: 'admin@avartah.com' });

    check(forgotNoEmailRes.status === 200, 'Forgot-password returns 200 when email service unconfigured');
    check(!('reset_token' in forgotNoEmailRes.body), 'Forgot-password response NEVER includes reset_token');
    check(
      state.resetTokens.length === 1 && state.resetTokens[0].used === true,
      'Generated reset token is invalidated (used=TRUE) when email is unconfigured'
    );
    const logsSinceForgot = capturedLogs.slice(logCountBeforeForgot).join('\n');
    check(
      !logsSinceForgot.includes('reset-password?token='),
      'Server logs never print raw password-reset links or tokens'
    );

    // Production forgot-password with email configured & invalid APP_BASE_URL fails closed
    process.env.RESEND_API_KEY = 're_mock_test_key_123';
    process.env.NODE_ENV = 'production';
    process.env.APP_BASE_URL = 'http://insecure.example.com';
    const forgotInvalidProdUrl = await request(app)
      .post('/api/auth/forgot-password')
      .set('Origin', 'https://avartah.com')
      .set('X-Forwarded-Host', 'attacker.evil.example')
      .send({ email: 'admin@avartah.com' });
    check(
      forgotInvalidProdUrl.status === 500 && state.resetTokens[1]?.used === true,
      'Production forgot-password rejects non-HTTPS APP_BASE_URL, ignores forwarded host, and invalidates token'
    );

    // Restore test env
    process.env.NODE_ENV = 'test';
    process.env.APP_BASE_URL = 'https://avartah.com';
    delete process.env.RESEND_API_KEY;

    // ------------------------------------------------------------------
    // 2. Session Token Confidentiality & No localStorage Bearer Retrieval
    // ------------------------------------------------------------------
    console.log('\n--- 2. Cookie-Only Session Tokens & Client Storage Hygiene ---');
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ordinary@client.test', password: 'ClientPassword!123' });

    check(regRes.status === 201 && regRes.body.success === true, 'Ordinary user registration succeeds (201)');
    check(!('token' in regRes.body), 'POST /api/auth/register does NOT expose token in JSON body');
    const regCookies = parseCookiePairs(regRes.headers['set-cookie']);
    const regSetCookieRaw = Array.isArray(regRes.headers['set-cookie'])
      ? regRes.headers['set-cookie'].join('; ')
      : String(regRes.headers['set-cookie'] || '');
    check(
      Boolean(regCookies.admin_session) && regSetCookieRaw.includes('HttpOnly'),
      'POST /api/auth/register issues HttpOnly admin_session cookie'
    );

    // Login second session for same user
    const loginOrdinaryRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ordinary@client.test', password: 'ClientPassword!123' });
    check(loginOrdinaryRes.status === 200 && !('token' in loginOrdinaryRes.body), 'POST /api/auth/login omits raw token from JSON body');
    const ordCookies2 = parseCookiePairs(loginOrdinaryRes.headers['set-cookie']);

    const libAuthSource = fs.readFileSync(path.join(process.cwd(), 'lib/auth.ts'), 'utf8');
    const libApiSource = fs.readFileSync(path.join(process.cwd(), 'lib/api.ts'), 'utf8');
    check(
      !libAuthSource.includes('avartah_admin_session') && !libApiSource.includes('avartah_admin_session'),
      'Frontend lib/auth.ts and lib/api.ts contain zero localStorage session token lookups'
    );

    // ------------------------------------------------------------------
    // 3. Ordinary User Password Change & Other-Session Revocation
    // ------------------------------------------------------------------
    console.log('\n--- 3. Ordinary User Password Change & Other-Session Revocation ---');
    const changePassRes = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', buildCookieHeader(ordCookies2))
      .set('x-csrf-token', ordCookies2['XSRF-TOKEN'] || loginOrdinaryRes.body.csrfToken)
      .send({
        email: 'admin@avartah.com', // Attempted email spoofing must be ignored
        currentPassword: 'ClientPassword!123',
        newPassword: 'UpdatedClientPass!456'
      });

    check(changePassRes.status === 200 && changePassRes.body.success === true, 'Ordinary user can change own password via session');

    // Verify admin password was NOT overwritten & ordinary user session #1 was revoked while session #2 remains active
    const sess1Check = await request(app)
      .get('/api/auth/session')
      .set('Cookie', buildCookieHeader(regCookies));
    const sess2Check = await request(app)
      .get('/api/auth/session')
      .set('Cookie', buildCookieHeader(ordCookies2));
    check(sess1Check.body.authenticated === false, 'Other active session for ordinary user is revoked after password change');
    check(sess2Check.body.authenticated === true && sess2Check.body.user?.email === 'ordinary@client.test', 'Current session remains valid and targets session user');

    // Verify admin login still works with original password
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@avartah.com', password: 'AdminStrongPass!123' });
    check(adminLoginRes.status === 200, 'Admin password untouched by ordinary user spoofed email field');
    const adminCookies = parseCookiePairs(adminLoginRes.headers['set-cookie']);
    const adminCsrf = adminCookies['XSRF-TOKEN'] || adminLoginRes.body.csrfToken;

    // ------------------------------------------------------------------
    // 4. Workspace Invitation Trusted URL & No Token Leak
    // ------------------------------------------------------------------
    console.log('\n--- 4. Workspace Invitation URL & Token Protection ---');
    const inviteUnconfigured = await request(app)
      .post('/api/workspaces/ws_1/invitations')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .set('Origin', 'https://attacker.evil.example')
      .send({ email: 'teammate@example.com', role: 'member' });
    check(inviteUnconfigured.status === 503 && !('invitation_token' in inviteUnconfigured.body), 'Workspace invitation fails safely (503) without exposing invitation_token when email unconfigured');

    // ------------------------------------------------------------------
    // 5. Paystack Test/Live Config Enforcement & Prod Callback URL
    // ------------------------------------------------------------------
    console.log('\n--- 5. Paystack Test/Live Config & Production Callback Validation ---');
    process.env.PAYSTACK_MODE = 'test';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_mismatched_key_123456';
    const mismatchRes = validatePaystackModeAndKey();
    check(!mismatchRes.valid, 'Rejects PAYSTACK_MODE=test paired with sk_live_ key');

    process.env.PAYSTACK_MODE = 'staging';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_123456';
    check(!validatePaystackModeAndKey().valid, 'Rejects unknown PAYSTACK_MODE values');

    process.env.PAYSTACK_MODE = 'live';
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_valid_mock_key_123456';
    process.env.NODE_ENV = 'production';
    delete process.env.PAYSTACK_CALLBACK_URL;
    let startupThrew = false;
    try {
      validatePaystackStartupConfig();
    } catch {
      startupThrew = true;
    }
    check(startupThrew, 'validatePaystackStartupConfig fails closed in production when PAYSTACK_CALLBACK_URL is missing');

    let cbThrew = false;
    try {
      resolvePaystackCallbackUrl();
    } catch {
      cbThrew = true;
    }
    check(cbThrew, 'resolvePaystackCallbackUrl throws in production instead of falling back to headers');

    process.env.NODE_ENV = 'test';
    process.env.PAYSTACK_MODE = 'test';
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_key_1234567890abcdef';
    process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';

    // ------------------------------------------------------------------
    // 6. DB-Backed Login & Registration Rate Limiting + Lockouts
    // ------------------------------------------------------------------
    console.log('\n--- 6. DB-Backed Login & Registration Rate Limiting + Progressive Lockouts ---');
    // 4 bad attempts via alias 'admin', 5th via 'admin@avartah.com' -> must trigger progressive lockout (429)
    for (let i = 0; i < 4; i++) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin', password: 'WrongPassword!1' });
      assert.strictEqual(r.status, 401);
    }
    const fifthBadLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@avartah.com', password: 'WrongPassword!1' });
    check(
      fifthBadLogin.status === 429 && Boolean(fifthBadLogin.headers['retry-after']),
      '5th consecutive bad login across identifier alias triggers HTTP 429 progressive lockout with Retry-After'
    );

    // Registration rate limit check by email
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/register')
        .set('x-forwarded-for', `198.51.100.${i + 1}`)
        .send({ email: 'ratelimit.target@example.com', password: 'Weak' });
    }
    const sixthReg = await request(app)
      .post('/api/auth/register')
      .set('x-forwarded-for', '198.51.100.99')
      .send({ email: 'ratelimit.target@example.com', password: 'StrongPassword!123' });
    check(sixthReg.status === 429 && Boolean(sixthReg.headers['retry-after']), 'DB-backed registration rate limiter enforces per-identifier limit (429)');

    // ------------------------------------------------------------------
    // 7. Admin Role Management, Last-Admin Protection & Session Revocation
    // ------------------------------------------------------------------
    console.log('\n--- 7. Admin Role Governance & Session Revocation ---');
    const invalidRoleRes = await request(app)
      .post('/api/admin/users')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ email: 'rogue@avartah.com', password: 'StrongPassword!123', role: 'superadmin' });
    check(invalidRoleRes.status === 400, 'Rejects invalid administrator role outside [admin, editor]');

    const demoteLastAdminRes = await request(app)
      .patch('/api/admin/users/1')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ role: 'editor', is_active: true });
    check(demoteLastAdminRes.status === 400, 'Prevents demoting the last active administrator');

    const createEditorAdminRes = await request(app)
      .post('/api/admin/users')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ email: 'second.admin@avartah.com', password: 'StrongPassword!123', role: 'admin' });
    check(createEditorAdminRes.status === 201 && createEditorAdminRes.body.role === 'admin', 'Creates secondary admin cleanly');

    const secondLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'second.admin@avartah.com', password: 'StrongPassword!123' });
    const secondCookies = parseCookiePairs(secondLogin.headers['set-cookie']);

    const demoteSecond = await request(app)
      .patch(`/api/admin/users/${createEditorAdminRes.body.id}`)
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ role: 'editor', is_active: false });
    check(demoteSecond.status === 200, 'Disabling/demoting secondary admin succeeds');

    const secondPostRevoke = await request(app)
      .get('/api/auth/session')
      .set('Cookie', buildCookieHeader(secondCookies));
    check(secondPostRevoke.body.authenticated === false, 'Deactivating/demoting admin revokes existing admin_sessions immediately');

    // ------------------------------------------------------------------
    // 8. Separated Ordinary Registered Users Admin Endpoints
    // ------------------------------------------------------------------
    console.log('\n--- 8. Ordinary Registered Users Admin Governance ---');
    const regListRes = await request(app)
      .get('/api/admin/registered-users?search=ordinary')
      .set('Cookie', buildCookieHeader(adminCookies));
    check(
      regListRes.status === 200 &&
        Array.isArray(regListRes.body) &&
        regListRes.body.length === 1 &&
        regListRes.body[0].email === 'ordinary@client.test' &&
        regListRes.body[0].active_sessions === 1,
      'GET /api/admin/registered-users returns only ordinary users with active_sessions count'
    );

    const disableOrdRes = await request(app)
      .patch(`/api/admin/registered-users/${regListRes.body[0].id}`)
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ is_active: false });
    check(disableOrdRes.status === 200 && disableOrdRes.body.is_active === false, 'PATCH /api/admin/registered-users/:id disables ordinary user');

    const ordAfterDisable = await request(app)
      .get('/api/auth/session')
      .set('Cookie', buildCookieHeader(ordCookies2));
    check(ordAfterDisable.body.authenticated === false, 'Disabling ordinary user revokes active sessions');

    // Re-enable, create session, test explicit revoke-sessions endpoint
    await request(app)
      .patch(`/api/admin/registered-users/${regListRes.body[0].id}`)
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ is_active: true });
    const ordReLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ordinary@client.test', password: 'UpdatedClientPass!456' });
    const ordReCookies = parseCookiePairs(ordReLogin.headers['set-cookie']);

    const manualRevokeRes = await request(app)
      .post(`/api/admin/registered-users/${regListRes.body[0].id}/revoke-sessions`)
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf);
    check(
      manualRevokeRes.status === 200 && manualRevokeRes.body.revoked_count >= 1,
      'POST /api/admin/registered-users/:id/revoke-sessions revokes user sessions'
    );
    const ordAfterManualRevoke = await request(app)
      .get('/api/auth/session')
      .set('Cookie', buildCookieHeader(ordReCookies));
    check(ordAfterManualRevoke.body.authenticated === false, 'Manually revoked user session is rejected');

    // ------------------------------------------------------------------
    // 9. CRM-Only Prospect Persistence & Real DB Analytics / BI Metrics
    // ------------------------------------------------------------------
    console.log('\n--- 9. CRM-Only Persistence & Real Analytics/BI Calculations ---');
    const directSaveRes = await request(app)
      .post('/api/prospects')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ name: 'Should Not Persist' });
    check(
      directSaveRes.status === 403 && directSaveRes.body.errorCode === 'CRM_ONLY_PERSISTENCE_REQUIRED',
      'POST /api/prospects is disabled (403 CRM_ONLY_PERSISTENCE_REQUIRED)'
    );

    const autoBatchRes = await request(app)
      .post('/api/prospects/batch')
      .set('Cookie', buildCookieHeader(adminCookies))
      .set('x-csrf-token', adminCsrf)
      .send({ prospects: [{ name: 'Auto Batch' }] });
    check(autoBatchRes.status === 400 && autoBatchRes.body.errorCode === 'EXPLICIT_CRM_CONFIRMATION_REQUIRED', 'POST /api/prospects/batch blocks automatic non-CRM persistence');

    const funnel7d = await request(app)
      .get('/api/analytics-funnel?range=7D')
      .set('Cookie', buildCookieHeader(adminCookies));
    const funnelAll = await request(app)
      .get('/api/analytics-funnel?range=ALL')
      .set('Cookie', buildCookieHeader(adminCookies));
    const sumCounts = (rows: any[]) => rows.reduce((a, r) => a + Number(r.count || 0), 0);
    check(
      funnel7d.status === 200 && funnelAll.status === 200 && sumCounts(funnel7d.body) === 2 && sumCounts(funnelAll.body) === 5,
      'GET /api/analytics-funnel filters real DB events by ?range=7D vs ALL without synthetic multipliers'
    );

    const biEmpty = await request(app)
      .get('/api/business-intelligence')
      .set('Cookie', buildCookieHeader(adminCookies));
    check(
      biEmpty.status === 200 && biEmpty.body.total_revenue === 0 && biEmpty.body.conversion_rate === 0 && biEmpty.body.recurring_revenue === 0,
      'GET /api/business-intelligence returns zero defaults instead of fabricated 12500/18.5/2400 values'
    );

    state.crmLeads.push({ id: 'l1' }, { id: 'l2' });
    state.clientProjects.push({ id: 'cp1', budget: 4000 });
    state.payments.push({ id: 'pay1', status: 'SUCCESS', amount: 1500 });
    state.subscriptions.push({ id: 'sub1', plan_id: 'pro', status: 'active' });

    const biPopulated = await request(app)
      .get('/api/business-intelligence')
      .set('Cookie', buildCookieHeader(adminCookies));
    check(
      biPopulated.status === 200 &&
        biPopulated.body.total_revenue === 5500 &&
        biPopulated.body.conversion_rate === 50 &&
        biPopulated.body.recurring_revenue === 25000,
      'GET /api/business-intelligence derives revenue, conversion_rate, and recurring_revenue strictly from DB rows'
    );

    // ------------------------------------------------------------------
    // 10. CSP, Production HSTS, Production CORS, Sanitized 500s & SSRF
    // ------------------------------------------------------------------
    console.log('\n--- 10. CSP, Production HSTS/CORS, Sanitized 500s & Direct Probe SSRF ---');
    process.env.NODE_ENV = 'production';
    const healthProdRes = await request(app).get('/api/health');
    check(
      Boolean(healthProdRes.headers['content-security-policy']) &&
        Boolean(healthProdRes.headers['strict-transport-security']),
      'Production responses include Content-Security-Policy and Strict-Transport-Security headers'
    );

    const evilCorsRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil-attacker.example');
    check(
      evilCorsRes.status === 403 && !evilCorsRes.headers['access-control-allow-origin'],
      'Production CORS denies untrusted Origin with 403 without echoing Allow-Origin'
    );

    const allowedCorsRes = await request(app)
      .get('/api/health')
      .set('Origin', 'https://avartah.com');
    check(
      allowedCorsRes.status === 200 && allowedCorsRes.headers['access-control-allow-origin'] === 'https://avartah.com',
      'Production CORS allows explicitly configured APP_BASE_URL / ALLOWED_ORIGINS'
    );

    process.env.NODE_ENV = 'test';
    state.forceDbErrorOnce = true;
    const db500Res = await request(app)
      .get('/api/analytics')
      .set('Cookie', buildCookieHeader(adminCookies));
    const serialized500 = JSON.stringify(db500Res.body);
    check(
      db500Res.status === 500 &&
        !serialized500.includes('FATAL_INTERNAL_SQL_STATE') &&
        !serialized500.includes('secret_internal_table') &&
        !serialized500.includes('supersecret'),
      'HTTP 500 responses are sanitized and never leak raw SQL/internal error messages'
    );

    const loopbackProbe = await executeDirectHttpProbe('http://127.0.0.1:8080/admin');
    const metadataProbe = await executeDirectHttpProbe('http://169.254.169.254/latest/meta-data/');
    const redirectSsrfProbe = await executeDirectHttpProbe('https://public-site.example/', 5000, {
      resolveHostFn: async (host) => {
        if (host === 'public-site.example') return { safe: true, resolvedIp: '93.184.216.34' };
        return { safe: false, reason: 'Blocked private IP target' };
      },
      fetchFn: async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' }
        })
    });
    check(
      loopbackProbe.probe.status === 'FAILED' && /blocked|private|loopback/i.test(loopbackProbe.probe.error || ''),
      'executeDirectHttpProbe SSRF blocks loopback 127.0.0.1'
    );
    check(
      metadataProbe.probe.status === 'FAILED' && /blocked|private/i.test(metadataProbe.probe.error || ''),
      'executeDirectHttpProbe SSRF blocks cloud metadata 169.254.169.254'
    );
    check(
      redirectSsrfProbe.probe.status === 'FAILED' && /blocked|redirect/i.test(redirectSsrfProbe.probe.error || ''),
      'executeDirectHttpProbe blocks HTTP redirect hops targeting cloud metadata / private IPs'
    );

    console.log('\n========================================================================');
    console.log(`  SECURITY VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');
    if (failed > 0) process.exit(1);
    process.exit(0);
  } finally {
    console.log = origConsoleLog;
    console.error = origConsoleError;
    (pool as any).query = origQuery;
    (pool as any).connect = origConnect;
    process.env = origEnv;
  }
}

runSecurityVerificationSuite().catch((err) => {
  console.error('Fatal Security Verification Test Error:', err);
  process.exit(1);
});
