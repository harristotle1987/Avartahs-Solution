/**
 * AVARTAH SOLUTIONS — PAYSTACK CALLBACK & VERIFICATION ROUTE TEST SUITE
 *
 * Tests real Express routes in api/businessOSRouter.ts using supertest,
 * mocked Paystack HTTP responses (globalThis.fetch), and an isolated in-memory
 * PostgreSQL pool shim (so all route logic, SQL queries, state transitions,
 * idempotency, and security checks run deterministically even without a live DB).
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import request from 'supertest';
import crypto from 'crypto';
import pool from '../lib/neon.js';
import { businessOSRouter } from '../api/businessOSRouter.js';
import {
  getConfiguredPaystackCallbackUrl,
  resolvePaystackCallbackUrl,
  isValidPaystackReference,
  getPaystackPaymentCurrency,
  PAYSTACK_CALLBACK_PATH
} from '../lib/paystack.js';
import { getSessionSecret } from '../lib/serverAuth.js';

interface MockPayment {
  id: string;
  tenant_id: string;
  user_email: string;
  plan_id: string;
  provider: string;
  provider_reference: string;
  amount: number;
  amount_kobo: number;
  currency: string;
  payment_method: string;
  status: string;
  provider_transaction_id?: string | null;
  channel?: string | null;
  verified_at?: string | null;
  metadata?: any;
}

async function runPaystackCallbackSuite() {
  console.log('===================================================================');
  console.log('  AVARTAH SOLUTIONS — PAYSTACK CALLBACK & VERIFICATION TEST SUITE  ');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // Save original env & globals
  const origEnv = { ...process.env };
  const origFetch = globalThis.fetch;
  const origPoolQuery = pool.query.bind(pool);
  const origPoolConnect = pool.connect.bind(pool);

  // Set deterministic test secrets
  const TEST_SESSION_SECRET = 'test_session_secret_minimum_32_characters_for_hmac_verification_ok';
  const TEST_PAYSTACK_SECRET = 'sk_test_mock_avartah_paystack_secret_key_for_tests_123456';
  process.env.SESSION_SECRET = TEST_SESSION_SECRET;
  process.env.PAYSTACK_MODE = 'test';
  process.env.PAYSTACK_SECRET_KEY = TEST_PAYSTACK_SECRET;
  process.env.PAYMENT_CURRENCY = 'NGN';
  process.env.NODE_ENV = 'test';
  process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.test/api/os/payments/paystack/callback';

  // In-memory isolated DB state
  const state = {
    users: new Map<string, any>([
      ['owner@testbiz.com', { id: 1, email: 'owner@testbiz.com', role: 'user', is_active: true }]
    ]),
    adminUsers: new Map<string, any>(),
    sessions: new Map<string, any>(),
    tenants: new Map<string, any>([
      [
        'biz_test_01',
        {
          id: 'biz_test_01',
          name: 'Test Salon Ltd',
          business_name: 'Test Salon Ltd',
          owner_email: 'owner@testbiz.com',
          plan_id: 'free',
          status: 'ACTIVE'
        }
      ]
    ]),
    tenantMembers: new Map<string, any>([
      [
        'biz_test_01:owner@testbiz.com',
        { id: 'tm_1', tenant_id: 'biz_test_01', user_email: 'owner@testbiz.com', role: 'owner', is_active: true }
      ]
    ]),
    plans: new Map<string, any>([
      ['free', { id: 'free', name: 'Free Starter', price_ngn: 0, price_usd: 0, is_active: true }],
      ['growth', { id: 'growth', name: 'Business Pro', price_ngn: 35000, price_usd: 25, is_active: true }],
      ['inactive_plan', { id: 'inactive_plan', name: 'Legacy Plan', price_ngn: 10000, price_usd: 10, is_active: false }]
    ]),
    payments: new Map<string, MockPayment>(),
    subscriptions: new Map<string, any>(),
    webhookEvents: new Map<string, any>(),
    auditLogs: [] as any[]
  };

  async function makeSignedSessionToken(email: string, role: string = 'user'): Promise<string> {
    const secret = await getSessionSecret();
    const sid = crypto.randomBytes(16).toString('hex');
    const createdAt = Date.now();
    const expiresAt = createdAt + 3600 * 1000;
    const payloadB64 = Buffer.from(
      JSON.stringify({ sid, email: email.toLowerCase(), role, exp: expiresAt, iat: createdAt })
    ).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    state.sessions.set(sid, { id: sid, user_email: email.toLowerCase(), revoked: false, expires_at: expiresAt });
    return `${payloadB64}.${sig}`;
  }

  async function mockQuery(sql: string, params: any[] = []): Promise<{ rows: any[] }> {
    const q = sql.replace(/\s+/g, ' ').trim();

    if (q === 'BEGIN' || q === 'COMMIT' || q === 'ROLLBACK') {
      return { rows: [] };
    }

    if (q.startsWith('SELECT * FROM admin_sessions WHERE id = $1')) {
      const s = state.sessions.get(params[0]);
      if (s && !s.revoked && s.expires_at > Date.now()) return { rows: [s] };
      return { rows: [] };
    }

    if (q.startsWith('SELECT id, email, role, is_active FROM admin_users')) {
      const u = state.adminUsers.get(String(params[0]).toLowerCase());
      return { rows: u ? [u] : [] };
    }

    if (q.startsWith('SELECT id, email, role, is_active FROM users')) {
      const u = state.users.get(String(params[0]).toLowerCase());
      return { rows: u ? [u] : [] };
    }

    if (q.startsWith('SELECT id, name, business_name, owner_email, plan_id FROM tenants WHERE id = $1')) {
      const t = state.tenants.get(params[0]);
      return { rows: t ? [t] : [] };
    }

    if (q.startsWith('SELECT id, owner_email, status FROM tenants WHERE id = $1')) {
      const t = state.tenants.get(params[0]);
      return { rows: t ? [t] : [] };
    }

    if (q.includes('FROM tenants t LEFT JOIN subscription_plans sp ON t.plan_id = sp.id WHERE t.id = $1')) {
      const t = state.tenants.get(params[0]);
      if (!t) return { rows: [] };
      const plan = state.plans.get(t.plan_id) || null;
      return { rows: [{ ...t, plan }] };
    }

    if (q.startsWith('SELECT role FROM tenant_members')) {
      const m = state.tenantMembers.get(`${params[0]}:${String(params[1]).toLowerCase()}`);
      return { rows: m ? [{ role: m.role }] : [] };
    }

    if (q.includes('FROM subscription_plans WHERE id = $1')) {
      const p = state.plans.get(params[0]);
      return { rows: p ? [p] : [] };
    }

    if (q.startsWith('INSERT INTO payments')) {
      const [id, tenant_id, user_email, plan_id, provider_reference, amount, amount_kobo, currency, metadata] = params;
      state.payments.set(provider_reference, {
        id,
        tenant_id,
        user_email,
        plan_id,
        provider: 'paystack',
        provider_reference,
        amount,
        amount_kobo,
        currency,
        payment_method: 'ONLINE',
        status: 'PENDING',
        metadata
      });
      return { rows: [] };
    }

    if (q.startsWith('SELECT * FROM payments WHERE provider_reference = $1')) {
      const p = state.payments.get(params[0]);
      return { rows: p ? [{ ...p }] : [] };
    }

    if (q.startsWith('UPDATE payments SET status = \'SUCCESS\'')) {
      const [txId, channel, ref] = params;
      const p = state.payments.get(ref);
      if (p) {
        p.status = 'SUCCESS';
        p.provider_transaction_id = txId;
        p.channel = channel;
        p.verified_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    if (q.startsWith('UPDATE payments SET status = \'')) {
      const match = q.match(/SET status = '([A-Z_]+)'/);
      const newStatus = match ? match[1] : 'FAILED';
      const ref = params[0];
      const p = state.payments.get(ref);
      if (p) p.status = newStatus;
      return { rows: [] };
    }

    if (q.startsWith('UPDATE tenants SET plan_id = $1')) {
      const [planId, tenantId] = params;
      const t = state.tenants.get(tenantId);
      if (t) t.plan_id = planId;
      return { rows: [] };
    }

    if (q.startsWith('INSERT INTO subscriptions')) {
      const [id, tenant_id, plan_id, payment_reference, user_email] = params;
      if (!state.subscriptions.has(payment_reference)) {
        state.subscriptions.set(payment_reference, {
          id,
          tenant_id,
          plan_id,
          status: 'active',
          provider: 'paystack',
          payment_reference,
          user_email
        });
      }
      return { rows: [] };
    }

    if (q.startsWith('SELECT id FROM webhook_events WHERE event_key = $1')) {
      const e = state.webhookEvents.get(params[0]);
      return { rows: e ? [{ id: e.id }] : [] };
    }

    if (q.startsWith('INSERT INTO webhook_events')) {
      const [id, eventKey, eventType, payload] = params;
      if (!state.webhookEvents.has(eventKey)) {
        state.webhookEvents.set(eventKey, { id, eventKey, eventType, payload });
      }
      return { rows: [] };
    }

    if (q.startsWith('INSERT INTO tenant_audit_logs')) {
      state.auditLogs.push({ params });
      return { rows: [] };
    }

    return { rows: [] };
  }

  (pool as any).query = mockQuery;
  (pool as any).connect = async () => ({
    query: mockQuery,
    release: () => {}
  });

  // Track Paystack API mock behaviors
  let capturedInitPayload: any = null;
  let mockVerifyBehavior: (ref: string) => { httpStatus?: number; body: any } = (ref) => ({
    httpStatus: 200,
    body: {
      status: true,
      data: {
        id: 555001,
        status: 'success',
        reference: ref,
        amount: 3500000,
        currency: 'NGN',
        channel: 'card',
        paid_at: new Date().toISOString(),
        customer: { email: 'owner@testbiz.com' },
        metadata: { tenant_id: 'biz_test_01', plan_id: 'growth' }
      }
    }
  });

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.paystack.co/transaction/initialize') {
      capturedInitPayload = JSON.parse(String(init?.body || '{}'));
      return new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: `https://checkout.paystack.com/mock_${capturedInitPayload.reference}`,
            access_code: 'mock_access_123',
            reference: capturedInitPayload.reference
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.startsWith('https://api.paystack.co/transaction/verify/')) {
      const ref = decodeURIComponent(url.split('/transaction/verify/')[1] || '');
      const resSpec = mockVerifyBehavior(ref);
      return new Response(JSON.stringify(resSpec.body), {
        status: resSpec.httpStatus || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    throw new Error(`Unexpected fetch URL in Paystack test: ${url}`);
  }) as typeof fetch;

  try {
    // ---------------------------------------------------------------
    // 1. Unit tests for PAYSTACK_CALLBACK_URL & validation helpers
    // ---------------------------------------------------------------
    console.log('--- 1. Server-Side PAYSTACK_CALLBACK_URL Resolution & Reference Validation ---');

    process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.com/api/os/payments/paystack/callback';
    process.env.NODE_ENV = 'production';
    assert(
      getConfiguredPaystackCallbackUrl() === 'https://avartah.com/api/os/payments/paystack/callback',
      'Configured HTTPS PAYSTACK_CALLBACK_URL is accepted in production'
    );

    process.env.PAYSTACK_CALLBACK_URL = 'http://avartah.com/api/os/payments/paystack/callback';
    assert(
      getConfiguredPaystackCallbackUrl() === null,
      'Insecure HTTP PAYSTACK_CALLBACK_URL is rejected in production'
    );

    process.env.PAYSTACK_CALLBACK_URL = 'https://YOUR_DOMAIN/api/os/payments/paystack/callback';
    assert(
      getConfiguredPaystackCallbackUrl() === null,
      'Placeholder YOUR_DOMAIN callback URL is rejected'
    );

    delete process.env.PAYSTACK_CALLBACK_URL;
    process.env.APP_BASE_URL = 'https://deployed.avartah.com';
    let prodMissingCallbackThrew = false;
    try {
      resolvePaystackCallbackUrl();
    } catch {
      prodMissingCallbackThrew = true;
    }
    assert(
      prodMissingCallbackThrew,
      'Fails closed in production when PAYSTACK_CALLBACK_URL is unset (no APP_BASE_URL or header fallback)'
    );

    process.env.NODE_ENV = 'test';
    assert(
      resolvePaystackCallbackUrl() === `https://deployed.avartah.com${PAYSTACK_CALLBACK_PATH}`,
      'Falls back to APP_BASE_URL + callback route path in non-production when PAYSTACK_CALLBACK_URL is unset'
    );
    process.env.PAYSTACK_CALLBACK_URL = 'https://avartah.test/api/os/payments/paystack/callback';
    assert(getPaystackPaymentCurrency() === 'NGN', 'Default payment currency resolves to NGN');
    assert(isValidPaystackReference('avt_biz_te_growth_abc123') === true, 'Accepts valid Paystack reference');
    assert(isValidPaystackReference('../admin?x=1') === false, 'Rejects malformed/path-traversal reference');
    assert(isValidPaystackReference('') === false, 'Rejects empty reference');

    // ---------------------------------------------------------------
    // 2. Mount Express app with businessOSRouter
    // ---------------------------------------------------------------
    const app = express();
    app.use(cookieParser());
    app.use(
      bodyParser.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        }
      })
    );
    app.use('/api/os', businessOSRouter);

    const ownerToken = await makeSignedSessionToken('owner@testbiz.com', 'user');

    // ---------------------------------------------------------------
    // 3. Payment Initialization uses PAYSTACK_CALLBACK_URL (ignores untrusted client callback_url)
    // ---------------------------------------------------------------
    console.log('\n--- 2. Checkout Initialization & Callback URL Enforcement ---');
    const initRes = await request(app)
      .post('/api/os/payments/initialize')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        tenant_id: 'biz_test_01',
        plan_id: 'growth',
        callback_url: 'https://evil-attacker.example/steal'
      });

    assert(initRes.status === 200 && initRes.body.success === true, 'POST /api/os/payments/initialize succeeds');
    assert(
      capturedInitPayload?.callback_url === 'https://avartah.test/api/os/payments/paystack/callback',
      'Paystack initialize payload uses server PAYSTACK_CALLBACK_URL and ignores client-supplied untrusted callback_url'
    );
    assert(
      capturedInitPayload?.amount === 3500000 && capturedInitPayload?.currency === undefined,
      'Server computes exact kobo amount (3500000) from DB plan'
    );
    assert(
      state.tenants.get('biz_test_01').plan_id === 'free',
      'Tenant remains on free tier immediately after initialization (never activated early)'
    );

    const validRef = initRes.body.reference as string;

    // ---------------------------------------------------------------
    // 4. Negative / Mismatch / Abandoned / Failed Callback Tests
    // ---------------------------------------------------------------
    console.log('\n--- 3. Callback Security & Negative Verification Cases ---');

    // 4a. Missing or invalid reference
    const missingRefCb = await request(app).get('/api/os/payments/paystack/callback');
    assert(
      missingRefCb.status === 302 && missingRefCb.headers.location === '/business-os/billing?payment_error=invalid_reference',
      'Callback without reference redirects safely with invalid_reference error'
    );

    // 4b. Unknown reference
    const unknownRefCb = await request(app).get('/api/os/payments/paystack/callback?reference=avt_unknown_ref_9999');
    assert(
      unknownRefCb.status === 302 && unknownRefCb.headers.location.includes('payment_error=not_found'),
      'Callback with unknown reference redirects with not_found error without activating'
    );

    // 4c. Failed payment
    const failedRef = 'avt_failed_tx_001';
    state.payments.set(failedRef, {
      id: 'pay_fail_1',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: failedRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = (ref) => ({
      body: {
        status: true,
        data: { id: 101, status: 'failed', reference: ref, amount: 3500000, currency: 'NGN', gateway_response: 'Declined' }
      }
    });
    const failedCb = await request(app).get(`/api/os/payments/paystack/callback?trxref=${failedRef}&reference=${failedRef}`);
    assert(
      failedCb.status === 302 && failedCb.headers.location.includes('payment_error=failed'),
      'Failed Paystack payment redirects with payment_error=failed'
    );
    assert(
      state.payments.get(failedRef)?.status === 'FAILED' && state.tenants.get('biz_test_01').plan_id === 'free',
      'Failed payment marks status=FAILED and leaves tenant on free tier'
    );

    // 4d. Abandoned payment
    const abandonedRef = 'avt_abandoned_tx_002';
    state.payments.set(abandonedRef, {
      id: 'pay_ab_2',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: abandonedRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = (ref) => ({
      body: { status: true, data: { id: 102, status: 'abandoned', reference: ref, amount: 3500000, currency: 'NGN' } }
    });
    const abandonedCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${abandonedRef}`);
    assert(
      abandonedCb.status === 302 && abandonedCb.headers.location.includes('payment_error=abandoned'),
      'Abandoned Paystack payment redirects with payment_error=abandoned'
    );
    assert(
      state.payments.get(abandonedRef)?.status === 'ABANDONED' && state.tenants.get('biz_test_01').plan_id === 'free',
      'Abandoned payment marks status=ABANDONED and never activates subscription'
    );

    // 4e. Amount mismatch
    const underpaidRef = 'avt_underpaid_tx_003';
    state.payments.set(underpaidRef, {
      id: 'pay_under_3',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: underpaidRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = (ref) => ({
      body: {
        status: true,
        data: {
          id: 103,
          status: 'success',
          reference: ref,
          amount: 100000, // ₦1,000 instead of ₦35,000
          currency: 'NGN',
          customer: { email: 'owner@testbiz.com' }
        }
      }
    });
    const underpaidCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${underpaidRef}`);
    assert(
      underpaidCb.status === 302 && underpaidCb.headers.location.includes('payment_error=amount_mismatch'),
      'Underpaid transaction redirects with payment_error=amount_mismatch'
    );
    assert(
      state.payments.get(underpaidRef)?.status === 'AMOUNT_MISMATCH' && state.tenants.get('biz_test_01').plan_id === 'free',
      'Amount mismatch leaves tenant on free tier'
    );

    // 4f. Currency mismatch
    const usdRef = 'avt_usd_tx_004';
    state.payments.set(usdRef, {
      id: 'pay_usd_4',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: usdRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = (ref) => ({
      body: {
        status: true,
        data: {
          id: 104,
          status: 'success',
          reference: ref,
          amount: 3500000,
          currency: 'USD',
          customer: { email: 'owner@testbiz.com' }
        }
      }
    });
    const usdCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${usdRef}`);
    assert(
      usdCb.status === 302 && usdCb.headers.location.includes('payment_error=currency_mismatch'),
      'Currency mismatch redirects with payment_error=currency_mismatch'
    );
    assert(
      state.payments.get(usdRef)?.status === 'CURRENCY_MISMATCH' && state.tenants.get('biz_test_01').plan_id === 'free',
      'Currency mismatch leaves tenant on free tier'
    );

    // 4g. Reference mismatch returned by provider
    const refMismatchRef = 'avt_ref_mismatch_005';
    state.payments.set(refMismatchRef, {
      id: 'pay_refm_5',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: refMismatchRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = () => ({
      body: {
        status: true,
        data: {
          id: 105,
          status: 'success',
          reference: 'avt_some_other_reference',
          amount: 3500000,
          currency: 'NGN',
          customer: { email: 'owner@testbiz.com' }
        }
      }
    });
    const refMismatchCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${refMismatchRef}`);
    assert(
      refMismatchCb.status === 302 && refMismatchCb.headers.location.includes('payment_error=reference_mismatch'),
      'Provider reference mismatch redirects with payment_error=reference_mismatch'
    );
    assert(
      state.payments.get(refMismatchRef)?.status === 'REFERENCE_MISMATCH' && state.tenants.get('biz_test_01').plan_id === 'free',
      'Reference mismatch never activates subscription'
    );

    // 4h. Metadata tenant mismatch
    const metaMismatchRef = 'avt_meta_mismatch_006';
    state.payments.set(metaMismatchRef, {
      id: 'pay_metam_6',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: metaMismatchRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    mockVerifyBehavior = (ref) => ({
      body: {
        status: true,
        data: {
          id: 106,
          status: 'success',
          reference: ref,
          amount: 3500000,
          currency: 'NGN',
          customer: { email: 'owner@testbiz.com' },
          metadata: { tenant_id: 'biz_other_tenant', plan_id: 'growth' }
        }
      }
    });
    const metaMismatchCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${metaMismatchRef}`);
    assert(
      metaMismatchCb.status === 302 && metaMismatchCb.headers.location.includes('payment_error=tenant_mismatch'),
      'Tenant metadata mismatch redirects with payment_error=tenant_mismatch'
    );
    assert(
      state.subscriptions.size === 0 && state.tenants.get('biz_test_01').plan_id === 'free',
      'Zero subscriptions activated across all failure/mismatch scenarios'
    );

    // ---------------------------------------------------------------
    // 5. Valid Success Callback -> Single Activation + Idempotent Repeat + Webhook Dedupe
    // ---------------------------------------------------------------
    console.log('\n--- 4. Successful Callback Verification, Idempotency & Webhook Separation ---');
    mockVerifyBehavior = (ref) => ({
      body: {
        status: true,
        data: {
          id: 777001,
          status: 'success',
          reference: ref,
          amount: 3500000,
          currency: 'NGN',
          channel: 'card',
          paid_at: new Date().toISOString(),
          customer: { email: 'owner@testbiz.com' },
          metadata: { tenant_id: 'biz_test_01', plan_id: 'growth' }
        }
      }
    });

    const successCb = await request(app).get(
      `/api/os/payments/paystack/callback?trxref=${validRef}&reference=${validRef}`
    );
    assert(
      successCb.status === 302 &&
        successCb.headers.location === `/business-os/billing?reference=${validRef}&payment_status=verified&tenant=biz_test_01`,
      'Valid Paystack callback verifies server-side and redirects cleanly to /business-os/billing'
    );
    assert(state.payments.get(validRef)?.status === 'SUCCESS', 'Payment record transitioned to SUCCESS');
    assert(state.tenants.get('biz_test_01').plan_id === 'growth', 'Tenant upgraded to growth plan');
    assert(state.subscriptions.size === 1, 'Exactly one subscription record created');

    // Repeat callback hit (browser refresh)
    const repeatCb = await request(app).get(`/api/os/payments/paystack/callback?reference=${validRef}`);
    assert(
      repeatCb.status === 302 && repeatCb.headers.location.includes('payment_status=verified'),
      'Duplicate callback hit returns verified redirect idempotently'
    );
    assert(state.subscriptions.size === 1, 'Duplicate callback hit does not create duplicate subscription');

    // Frontend POST /api/os/payments/verify follow-up call
    const verifyFollowUp = await request(app)
      .post('/api/os/payments/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reference: validRef });
    assert(
      verifyFollowUp.status === 200 && verifyFollowUp.body.success === true && verifyFollowUp.body.alreadyProcessed === true,
      'Follow-up POST /api/os/payments/verify confirms alreadyProcessed: true idempotently'
    );

    // Separate Webhook call for same transaction
    const webhookPayload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 777001,
        reference: validRef,
        amount: 3500000,
        currency: 'NGN',
        status: 'success',
        channel: 'card',
        customer: { email: 'owner@testbiz.com' }
      }
    });
    const validWebhookSig = crypto
      .createHmac('sha512', TEST_PAYSTACK_SECRET)
      .update(Buffer.from(webhookPayload))
      .digest('hex');

    const webhookAfterCb = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', validWebhookSig)
      .send(webhookPayload);

    assert(
      webhookAfterCb.status === 200 &&
        webhookAfterCb.body.received === true &&
        webhookAfterCb.body.alreadyProcessed === true,
      'Separate webhook endpoint acknowledges alreadyProcessed: true idempotently after callback activation'
    );
    assert(state.subscriptions.size === 1, 'Total subscriptions remain strictly 1 across callback + verify + webhook');

    // Duplicate webhook replay with same event ID
    const webhookReplay = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', validWebhookSig)
      .send(webhookPayload);
    assert(
      webhookReplay.status === 200 && webhookReplay.body.duplicate === true,
      'Replayed webhook event is deduplicated via webhook_events'
    );

    // Negative route-level HMAC-SHA512 webhook signature tests against a fresh PENDING payment
    const forgedRef = 'avt_forged_wh_001';
    state.payments.set(forgedRef, {
      id: 'pay_forged_wh_1',
      tenant_id: 'biz_test_01',
      user_email: 'owner@testbiz.com',
      plan_id: 'growth',
      provider: 'paystack',
      provider_reference: forgedRef,
      amount: 35000,
      amount_kobo: 3500000,
      currency: 'NGN',
      payment_method: 'ONLINE',
      status: 'PENDING'
    });
    const forgedWhPayload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 888001,
        reference: forgedRef,
        amount: 3500000,
        currency: 'NGN',
        status: 'success'
      }
    });

    const missingSigRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .send(forgedWhPayload);
    assert(missingSigRes.status === 401, 'Webhook without x-paystack-signature returns 401');

    const badSigRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', '0'.repeat(128))
      .send(forgedWhPayload);
    assert(badSigRes.status === 401, 'Webhook with forged 128-hex signature returns 401');

    const whitespaceTamperedPayload = forgedWhPayload + ' ';
    const validForOriginalSig = crypto
      .createHmac('sha512', TEST_PAYSTACK_SECRET)
      .update(Buffer.from(forgedWhPayload))
      .digest('hex');
    const whitespaceTamperedRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', validForOriginalSig)
      .send(whitespaceTamperedPayload);
    assert(
      whitespaceTamperedRes.status === 401,
      'Webhook with modified raw bytes (even whitespace) rejects signature signed for re-serialized JSON'
    );

    const noRawBodyApp = express();
    noRawBodyApp.use(bodyParser.json());
    noRawBodyApp.use('/api/os', businessOSRouter);
    const missingRawBodyRes = await request(noRawBodyApp)
      .post('/api/os/payments/paystack/webhook')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', validForOriginalSig)
      .send(forgedWhPayload);
    assert(
      missingRawBodyRes.status === 401,
      'Webhook rejects request when raw request body buffer was not captured (fails closed)'
    );

    assert(
      state.payments.get(forgedRef)?.status === 'PENDING' && !state.webhookEvents.has('paystack_charge.success_888001'),
      'Failed HMAC-SHA512 webhook verifications never touch payments or webhook_events'
    );

    console.log('\n===================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED                     `);
    console.log('===================================================================\n');

    if (failed > 0) process.exit(1);
    process.exit(0);
  } finally {
    // Restore globals
    (pool as any).query = origPoolQuery;
    (pool as any).connect = origPoolConnect;
    globalThis.fetch = origFetch;
    process.env = origEnv;
  }
}

runPaystackCallbackSuite().catch((err) => {
  console.error('Fatal Paystack Callback Test Error:', err);
  process.exit(1);
});
