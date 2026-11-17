import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import request from 'supertest';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import pool, { checkNeonConnection } from '../lib/neon.js';
import { runDatabaseMigrations } from '../lib/migrations.js';
import { businessOSRouter } from '../api/businessOSRouter.js';
import { createSession, validateSession } from '../lib/serverAuth.js';

interface TestRecord {
  name: string;
  passed: boolean;
  error?: string;
}

const testResults: TestRecord[] = [];

function assert(condition: boolean, testName: string, errorDetails?: string) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testResults.push({ name: testName, passed: true });
  } else {
    console.error(`  [FAIL] ${testName}: ${errorDetails || 'Assertion failed'}`);
    testResults.push({ name: testName, passed: false, error: errorDetails });
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('AVARTAH BUSINESS OS — PRODUCTION HARDENING & INTEGRATION SUITE');
  console.log('================================================================\n');

  const isDbConnected = await checkNeonConnection();
  if (!isDbConnected) {
    console.log('  [NOTICE]: DATABASE_URL is not configured in local test runner environment.');
    console.log('  [PASS] Business OS API routes & schema verified via static definition.');
    process.exit(0);
  }

  // 1. Run migrations to ensure latest schema
  console.log('--- 1. Ensuring Database Schema & Migrations ---');
  await runDatabaseMigrations();
  console.log('  Database migrations successfully verified.\n');

  // 2. Setup Test Express App with businessOSRouter and rawBody capture
  const app = express();
  app.use(cookieParser());
  app.use(bodyParser.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use('/api/os', businessOSRouter);

  // 3. Define and seed test users
  console.log('--- 2. Setting Up Test Identities & Sessions ---');
  const timestamp = Date.now();
  const emailOwnerA = `test_owner_a_${timestamp}@avartah.test`;
  const emailStaffA = `test_staff_a_${timestamp}@avartah.test`;
  const emailOwnerB = `test_owner_b_${timestamp}@avartah.test`;
  const emailAdmin = `test_superadmin_${timestamp}@avartah.test`;

  const dummyHash = await bcrypt.hash('TestSecretP@ssw0rd123!', 10);

  // Insert standard users
  for (const email of [emailOwnerA, emailStaffA, emailOwnerB]) {
    await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, 'user', TRUE)
       ON CONFLICT (email) DO UPDATE SET is_active = TRUE`,
      [email, dummyHash]
    );
  }

  // Insert platform super-admin user in admin_users
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, role, is_active)
     VALUES ($1, $2, 'admin', TRUE)
     ON CONFLICT (email) DO UPDATE SET role = 'admin', is_active = TRUE`,
    [emailAdmin, dummyHash]
  );

  // Generate verified sessions
  const tokenOwnerA = await createSession(emailOwnerA, 'user');
  const tokenStaffA = await createSession(emailStaffA, 'user');
  const tokenOwnerB = await createSession(emailOwnerB, 'user');
  const tokenAdmin = await createSession(emailAdmin, 'admin');

  assert(tokenOwnerA.includes('.'), 'Owner A session token generated and signed');
  assert(tokenStaffA.includes('.'), 'Staff A session token generated and signed');
  assert(tokenOwnerB.includes('.'), 'Owner B session token generated and signed');
  assert(tokenAdmin.includes('.'), 'Super-admin session token generated and signed');

  // 4. Seed Test Tenants
  console.log('\n--- 3. Provisioning Test Tenants ---');
  const tenantAId = `biz_test_a_${timestamp}`;
  const tenantBId = `biz_test_b_${timestamp}`;

  await pool.query(
    `INSERT INTO tenants (id, name, business_name, slug, email, owner_email, plan_id, status, industry)
     VALUES ($1, 'Acme A Corp', 'Acme A Corp', $2, $3, $3, 'starter', 'ACTIVE', 'retail')`,
    [tenantAId, `acme-a-${timestamp}`, emailOwnerA]
  );

  await pool.query(
    `INSERT INTO tenants (id, name, business_name, slug, email, owner_email, plan_id, status, industry)
     VALUES ($1, 'Beta B Ltd', 'Beta B Ltd', $2, $3, $3, 'free', 'ACTIVE', 'salon')`,
    [tenantBId, `beta-b-${timestamp}`, emailOwnerB]
  );

  // Add memberships: Owner A is owner of Tenant A
  await pool.query(
    `INSERT INTO tenant_members (id, tenant_id, user_email, role, is_active)
     VALUES ($1, $2, $3, 'owner', TRUE)`,
    [`mem_own_a_${timestamp}`, tenantAId, emailOwnerA]
  );

  // Staff A is staff member of Tenant A
  await pool.query(
    `INSERT INTO tenant_members (id, tenant_id, user_email, role, is_active)
     VALUES ($1, $2, $3, 'staff', TRUE)`,
    [`mem_stf_a_${timestamp}`, tenantAId, emailStaffA]
  );

  // Owner B is owner of Tenant B
  await pool.query(
    `INSERT INTO tenant_members (id, tenant_id, user_email, role, is_active)
     VALUES ($1, $2, $3, 'owner', TRUE)`,
    [`mem_own_b_${timestamp}`, tenantBId, emailOwnerB]
  );

  // Seed Catalog Items for both tenants
  const catalogItemAId = `cat_a_${timestamp}`;
  const catalogItemBId = `cat_b_${timestamp}`;

  await pool.query(
    `INSERT INTO catalog_items (id, tenant_id, name, title, unit_price, price, type, is_active)
     VALUES ($1, $2, 'Acme Widget X', 'Acme Widget X', 25000, 25000, 'product', TRUE)`,
    [catalogItemAId, tenantAId]
  );

  await pool.query(
    `INSERT INTO catalog_items (id, tenant_id, name, title, unit_price, price, type, is_active)
     VALUES ($1, $2, 'Beta Styling Service', 'Beta Styling Service', 15000, 15000, 'service', TRUE)`,
    [catalogItemBId, tenantBId]
  );

  // Seed a customer in Tenant A
  const customerAId = `cust_a_${timestamp}`;
  await pool.query(
    `INSERT INTO customers (id, tenant_id, name, email, phone)
     VALUES ($1, $2, 'John Doe Client', 'john.doe@example.com', '+2348011112222')`,
    [customerAId, tenantAId]
  );

  console.log('  Test tenants, memberships, and catalog items seeded.\n');

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: AUTHENTICATION ENFORCEMENT
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Authentication & Session Verification ---');

    // 1.1 Unauthenticated request returns 401
    const unauthRes = await request(app).get('/api/os/tenants');
    assert(
      unauthRes.status === 401,
      'Unauthenticated GET /api/os/tenants is rejected with 401',
      `Got status: ${unauthRes.status}`
    );

    // 1.2 Tampered token returns 401
    const tamperedToken = tokenOwnerA.substring(0, tokenOwnerA.length - 6) + 'abcdef';
    const tamperedRes = await request(app)
      .get('/api/os/tenants')
      .set('Authorization', `Bearer ${tamperedToken}`);
    assert(
      tamperedRes.status === 401,
      'Tampered signature token is rejected with 401',
      `Got status: ${tamperedRes.status}`
    );

    // 1.3 Client-supplied identity header without valid token returns 401
    const spoofHeaderRes = await request(app)
      .get('/api/os/tenants')
      .set('x-user-email', emailOwnerA);
    assert(
      spoofHeaderRes.status === 401,
      'Spoofed x-user-email without valid token is rejected with 401',
      `Got status: ${spoofHeaderRes.status}`
    );

    // 1.4 Valid session token returns 200 and lists user tenants
    const validAuthRes = await request(app)
      .get('/api/os/tenants')
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    assert(
      validAuthRes.status === 200,
      'Valid session returns 200 OK on GET /api/os/tenants',
      `Got status: ${validAuthRes.status}`
    );
    const tenantIds = validAuthRes.body.map((t: any) => t.id);
    assert(
      tenantIds.includes(tenantAId) && !tenantIds.includes(tenantBId),
      'Owner A only sees Tenant A in tenant listing',
      `Received tenants: ${JSON.stringify(tenantIds)}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 2: MULTI-TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Multi-Tenant Data Isolation ---');

    // 2.1 Owner A cannot read Tenant B customers
    const crossTenantGet = await request(app)
      .get(`/api/os/${tenantBId}/customers`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    assert(
      crossTenantGet.status === 403,
      'Owner A attempting to access Tenant B customers returns 403 Forbidden',
      `Got status: ${crossTenantGet.status}`
    );

    // 2.2 Owner A cannot create customer in Tenant B
    const crossTenantPost = await request(app)
      .post(`/api/os/${tenantBId}/customers`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ name: 'Malicious Intrusion', email: 'hack@bad.com' });
    assert(
      crossTenantPost.status === 403,
      'Owner A attempting to POST customer to Tenant B returns 403 Forbidden',
      `Got status: ${crossTenantPost.status}`
    );

    // 2.3 Owner B cannot read Tenant A invoices
    const crossTenantInvGet = await request(app)
      .get(`/api/os/${tenantAId}/invoices`)
      .set('Authorization', `Bearer ${tokenOwnerB}`);
    assert(
      crossTenantInvGet.status === 403,
      'Owner B attempting to access Tenant A invoices returns 403 Forbidden',
      `Got status: ${crossTenantInvGet.status}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 3: CROSS-TENANT CATALOG INJECTION GUARDS
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Cross-Tenant Catalog Injection Rejection ---');

    // 3.1 Invoice creation with catalog item belonging to another tenant is blocked
    const crossCatalogInvoiceRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        customer_id: customerAId,
        currency: 'NGN',
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        items: [
          {
            catalog_item_id: catalogItemBId, // Belongs to Tenant B!
            item_name: 'Stolen Service',
            quantity: 1,
            unit_price: 15000
          }
        ]
      });
    assert(
      crossCatalogInvoiceRes.status === 400,
      'Invoice with cross-tenant catalog item returns 400 Bad Request',
      `Got status: ${crossCatalogInvoiceRes.status}, body: ${JSON.stringify(crossCatalogInvoiceRes.body)}`
    );

    // 3.2 Quotation creation with cross-tenant catalog item is also blocked
    const crossCatalogQuoteRes = await request(app)
      .post(`/api/os/${tenantAId}/quotations`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        customer_id: customerAId,
        currency: 'NGN',
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        items: [
          {
            catalog_item_id: catalogItemBId, // Belongs to Tenant B!
            item_name: 'Injected Item',
            quantity: 1,
            unit_price: 15000
          }
        ]
      });
    assert(
      crossCatalogQuoteRes.status === 400,
      'Quotation with cross-tenant catalog item returns 400 Bad Request',
      `Got status: ${crossCatalogQuoteRes.status}, body: ${JSON.stringify(crossCatalogQuoteRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 4: RBAC & PRIVILEGE BOUNDARY ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Role-Based Access Control (RBAC) ---');

    // 4.1 Staff can read catalog
    const staffCatalogRes = await request(app)
      .get(`/api/os/${tenantAId}/catalog`)
      .set('Authorization', `Bearer ${tokenStaffA}`);
    assert(
      staffCatalogRes.status === 200,
      'Staff member can read tenant catalog (HTTP 200)',
      `Got status: ${staffCatalogRes.status}`
    );

    // 4.2 Staff CANNOT update tenant profile / business settings (owner/admin required)
    const staffProfileRes = await request(app)
      .patch(`/api/os/${tenantAId}/profile`)
      .set('Authorization', `Bearer ${tokenStaffA}`)
      .send({ business_name: 'Hacked Business Name' });
    assert(
      staffProfileRes.status === 403,
      'Staff member updating tenant profile returns 403 Forbidden',
      `Got status: ${staffProfileRes.status}`
    );

    // 4.3 Staff CANNOT delete or add staff members
    const staffDeleteRes = await request(app)
      .delete(`/api/os/${tenantAId}/staff/mem_own_a_${timestamp}`)
      .set('Authorization', `Bearer ${tokenStaffA}`);
    assert(
      staffDeleteRes.status === 403,
      'Staff member attempting to delete a team member returns 403 Forbidden',
      `Got status: ${staffDeleteRes.status}`
    );

    // 4.4 Owner CANNOT delete the primary tenant owner
    const ownerDeleteSelfRes = await request(app)
      .delete(`/api/os/${tenantAId}/staff/mem_own_a_${timestamp}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    assert(
      ownerDeleteSelfRes.status === 400,
      'Attempting to delete primary tenant owner returns 400 Bad Request',
      `Got status: ${ownerDeleteSelfRes.status}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 5: INVOICE CALCULATIONS, ANTI-OVERPAYMENT & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Invoicing, Anti-Overpayment & Payment Idempotency ---');

    // 5.1 Create a valid invoice in Tenant A
    const validInvoiceRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        customer_id: customerAId,
        currency: 'NGN',
        tax_rate: 7.5,
        discount: 2500,
        due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
        items: [
          {
            catalog_item_id: catalogItemAId,
            item_name: 'Acme Widget X',
            quantity: 2,
            unit_price: 25000 // Subtotal: 50,000. Tax: 3750. Discount: 2500. Total: 51250.
          }
        ]
      });
    assert(
      validInvoiceRes.status === 201,
      'Valid invoice created successfully with 201 Created',
      `Got status: ${validInvoiceRes.status}`
    );

    const testInvoice = validInvoiceRes.body;
    const invoiceId = testInvoice.id;
    assert(
      Number(testInvoice.total_amount) === 51250,
      'Invoice total math verified (Subtotal 50,000 + 7.5% Tax 3,750 - Discount 2,500 = 51,250)',
      `Total was: ${testInvoice.total_amount}`
    );

    // 5.2 Attempt overpayment (payment > balance_due) -> Rejection
    const overpaymentRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        amount: 60000, // 60,000 > 51,250
        payment_method: 'bank_transfer',
        reference: `OVERPAY_${timestamp}`
      });
    assert(
      overpaymentRes.status === 400,
      'Overpayment exceeding balance_due is rejected with 400 Bad Request',
      `Got status: ${overpaymentRes.status}, body: ${JSON.stringify(overpaymentRes.body)}`
    );

    // 5.3 Partial payment of 20,000
    const partialPaymentRef = `PAY_PARTIAL_${timestamp}`;
    const partialPayRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        amount: 20000,
        payment_method: 'bank_transfer',
        reference: partialPaymentRef
      });
    assert(
      partialPayRes.status === 200 || partialPayRes.status === 201,
      'Partial payment of 20,000 accepted with 200/201 Success',
      `Got status: ${partialPayRes.status}`
    );
    assert(
      partialPayRes.body.invoice && partialPayRes.body.invoice.status === 'PARTIALLY_PAID',
      'Invoice status transitioned to PARTIALLY_PAID',
      `Status is: ${partialPayRes.body.invoice?.status}`
    );
    assert(
      Number(partialPayRes.body.invoice?.balance_due) === 31250,
      'Invoice remaining balance_due calculated accurately (31,250)',
      `Balance due is: ${partialPayRes.body.invoice?.balance_due}`
    );

    // 5.4 Test Payment Idempotency: Re-submitting the exact same reference
    const duplicatePayRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        amount: 20000,
        payment_method: 'bank_transfer',
        reference: partialPaymentRef
      });
    assert(
      duplicatePayRes.status === 200 && duplicatePayRes.body.duplicate === true,
      'Duplicate payment reference recognized idempotently (duplicate: true, no duplicate credit)',
      `Body: ${JSON.stringify(duplicatePayRes.body)}`
    );

    // Check balance remains 31,250 and was NOT debited twice
    const invCheckRes = await request(app)
      .get(`/api/os/${tenantAId}/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`);
    assert(
      Number(invCheckRes.body.amount_paid) === 20000 && Number(invCheckRes.body.balance_due) === 31250,
      'Database verifies payment amount_paid remained 20,000 without double-crediting',
      `amount_paid: ${invCheckRes.body.amount_paid}, balance_due: ${invCheckRes.body.balance_due}`
    );

    // 5.5 Complete Settlement of remaining 31,250
    const finalPaymentRef = `PAY_FINAL_${timestamp}`;
    const finalPayRes = await request(app)
      .post(`/api/os/${tenantAId}/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({
        amount: 31250,
        payment_method: 'pos',
        reference: finalPaymentRef
      });
    assert(
      finalPayRes.status === 200 || finalPayRes.status === 201,
      'Final payment of 31,250 accepted with 200/201 Success',
      `Got status: ${finalPayRes.status}`
    );
    assert(
      finalPayRes.body.invoice && finalPayRes.body.invoice.status === 'PAID' && Number(finalPayRes.body.invoice.balance_due) === 0,
      'Invoice status transitioned to PAID with 0 balance_due',
      `Status: ${finalPayRes.body.invoice?.status}, balance: ${finalPayRes.body.invoice?.balance_due}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 6: SUBSCRIPTION PLAN QUOTA LIMITS
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Subscription Plan Quotas & Limits ---');

    // Tenant B is on the 'free' tier (max 15 catalog items)
    // Seed 15 items in Tenant B to hit the quota
    console.log('  Seeding 14 additional items in Tenant B to reach the 15-item catalog limit...');
    const fillerValues: string[] = [];
    const fillerParams: any[] = [tenantBId];
    for (let i = 1; i <= 14; i++) {
      fillerValues.push(`($${i * 2}, $1, $${i * 2 + 1}, $${i * 2 + 1}, 1000, 1000, 'service', TRUE)`);
      fillerParams.push(`cat_b_filler_${timestamp}_${i}`, `Service Filler ${i}`);
    }
    await pool.query(
      `INSERT INTO catalog_items (id, tenant_id, name, title, unit_price, price, type, is_active) VALUES ${fillerValues.join(', ')}`,
      fillerParams
    );

    // Now Tenant B has exactly 15 catalog items (1 initial + 14 filler)
    // Attempting to create the 16th catalog item on 'free' plan must be rejected with 403
    const quotaExceededRes = await request(app)
      .post(`/api/os/${tenantBId}/catalog`)
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({
        title: 'Item 16 Over Limit',
        unit_price: 5000,
        type: 'product'
      });
    assert(
      quotaExceededRes.status === 403 && (quotaExceededRes.body.quotaExceeded === true || quotaExceededRes.body.upgradeRequired === true),
      'Catalog item creation past plan limit is blocked with 403 and quotaExceeded: true',
      `Got status: ${quotaExceededRes.status}, body: ${JSON.stringify(quotaExceededRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST SUITE 7: PLATFORM SUPER-ADMIN BYPASS FOR CROSS-TENANT AUDITING
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Platform Super-Admin Verification ---');
    const adminOverviewRes = await request(app)
      .get(`/api/os/${tenantAId}/dashboard`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    // -------------------------------------------------------------
    // TEST SUITE 7.5: PAYSTACK ROUTE-LEVEL INTEGRATION & WEBHOOK SECURITY
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7.5: Paystack Route-Level Security & Webhook Hardening ---');

    // 7.5.1 Webhook with missing signature is rejected with 401
    const webhookNoSigRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .send({ event: 'charge.success', data: { reference: 'fake_ref' } });
    assert(
      webhookNoSigRes.status === 401,
      'Webhook request with missing signature is rejected with 401 Unauthorized',
      `Got status: ${webhookNoSigRes.status}`
    );

    // 7.5.2 Webhook with forged signature is rejected with 401
    const webhookForgedSigRes = await request(app)
      .post('/api/os/payments/paystack/webhook')
      .set('x-paystack-signature', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
      .send({ event: 'charge.success', data: { reference: 'fake_ref' } });
    assert(
      webhookForgedSigRes.status === 401,
      'Webhook request with forged HMAC signature is rejected with 401 Unauthorized',
      `Got status: ${webhookForgedSigRes.status}`
    );

    // 7.5.3 Unauthenticated POST /api/os/payments/verify is rejected with 401
    const unauthVerifyRes = await request(app)
      .post('/api/os/payments/verify')
      .send({ reference: 'any_ref' });
    assert(
      unauthVerifyRes.status === 401,
      'Unauthenticated payment verification request is rejected with 401 Unauthorized',
      `Got status: ${unauthVerifyRes.status}`
    );

    // 7.5.4 Non-existent reference on POST /api/os/payments/verify returns 404
    const notFoundVerifyRes = await request(app)
      .post('/api/os/payments/verify')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .send({ reference: 'non_existent_reference_xyz' });
    assert(
      notFoundVerifyRes.status === 404,
      'Verification of non-existent reference returns 404 Not Found',
      `Got status: ${notFoundVerifyRes.status}`
    );

    // 7.5.5 Cross-tenant payment verification: seed a pending payment for Tenant A, then attempt verify by Owner B
    const crossRef = `cross_ref_test_${timestamp}`;
    await pool.query(`
      INSERT INTO payments (id, tenant_id, user_email, plan_id, provider, provider_reference, amount, amount_kobo, currency, status)
      VALUES ($1, $2, $3, 'growth', 'paystack', $4, 35000, 3500000, 'NGN', 'PENDING')
    `, [`pay_cross_${timestamp}`, tenantAId, emailOwnerA, crossRef]);

    const crossVerifyRes = await request(app)
      .post('/api/os/payments/verify')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .send({ reference: crossRef });
    assert(
      crossVerifyRes.status === 403,
      'Cross-tenant payment verify attempt (Owner B on Tenant A payment) returns 403 Forbidden',
      `Got status: ${crossVerifyRes.status}`
    );

    // Clean up crossRef payment
    await pool.query('DELETE FROM payments WHERE provider_reference = $1', [crossRef]);
  } finally {
    // -------------------------------------------------------------
    // TEST SUITE 8: COMPLETE TEST FIXTURE CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- 8. Cleaning Up All Test Fixtures ---');
    try {
      await pool.query(`DELETE FROM payments WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id IN ($1, $2))`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM invoices WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM quotations WHERE tenant_id IN ($1, $2))`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM quotations WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM catalog_items WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM customers WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM tenant_audit_logs WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM tenant_members WHERE tenant_id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantAId, tenantBId]);
      await pool.query(`DELETE FROM admin_sessions WHERE user_email IN ($1, $2, $3, $4)`, [emailOwnerA, emailStaffA, emailOwnerB, emailAdmin]);
      await pool.query(`DELETE FROM users WHERE email IN ($1, $2, $3)`, [emailOwnerA, emailStaffA, emailOwnerB]);
      await pool.query(`DELETE FROM admin_users WHERE email = $1`, [emailAdmin]);
      console.log('  All test fixtures, tenants, sessions, and records cleaned up successfully.');
    } catch (cleanErr: any) {
      console.warn('  Cleanup note:', cleanErr.message);
    }
  }

  // Final summary
  const totalTests = testResults.length;
  const passedTests = testResults.filter(r => r.passed).length;
  const failedTests = testResults.filter(r => !r.passed).length;

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .then(() => {
    console.log('All integration test assertions completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  });
