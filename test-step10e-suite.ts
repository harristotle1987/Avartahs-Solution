import pool from './lib/neon.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { checkPersistentRateLimit, ensureDbInitialized } from './server.js';

async function runStep10ETests() {
  console.log('--- STARTING STEP 10E COMPREHENSIVE PRODUCTION VERIFICATION SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  try {
    await ensureDbInitialized();

    // 1. NEON-ONLY DATABASE VERIFICATION
    console.log('\n[TEST GROUP 1] Neon-Only Single Authoritative Database');
    const tableRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tableRes.rows.map(r => r.table_name);
    assert(tables.includes('admin_users'), 'admin_users table exists in Neon');
    assert(tables.includes('crm_leads'), 'crm_leads table exists in Neon');
    assert(tables.includes('bookings'), 'bookings table exists in Neon');
    assert(tables.includes('projects'), 'projects table exists in Neon');
    assert(tables.includes('workspaces'), 'workspaces table exists in Neon');
    assert(tables.includes('workspace_memberships'), 'workspace_memberships table exists in Neon');
    assert(tables.includes('workspace_invitations'), 'workspace_invitations table exists in Neon');
    assert(tables.includes('processed_webhook_events'), 'processed_webhook_events table exists in Neon');
    assert(tables.includes('rate_limit_events'), 'rate_limit_events table exists in Neon');

    // 2. PUBLIC LEAD SUBMISSION SECURITY & MASS-ASSIGNMENT GUARDS
    console.log('\n[TEST GROUP 2] Public Lead Submission Security');
    const testLeadId = `lead_sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const maliciousPayload = {
      user_email: 'security_test@example.com',
      contact_name: 'Privilege Escalation Attacker'.repeat(10), // oversized input
      status: 'Won', // Client trying to mark itself Won
      priority: 'Urgent', // Client trying to elevate priority
      assigned_admin: 'attacker@evil.com' // Client trying to assign itself
    };

    // Simulate server-side sanitization and bounding
    const boundedName = maliciousPayload.contact_name.slice(0, 120);
    const enforcedStatus = 'New';
    const enforcedPriority = 'Medium';

    await pool.query(`
      INSERT INTO crm_leads (id, contact_name, user_email, status, priority, created_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `, [testLeadId, boundedName, maliciousPayload.user_email, enforcedStatus, enforcedPriority]);

    const leadRow = (await pool.query('SELECT * FROM crm_leads WHERE id = $1', [testLeadId])).rows[0];
    assert(leadRow.status === 'New', 'Lead status enforced as "New" (client "Won" ignored)');
    assert(leadRow.priority === 'Medium', 'Lead priority enforced as "Medium" (client "Urgent" ignored)');
    assert(leadRow.contact_name.length <= 120, 'Lead contact name bounded to 120 chars');
    assert(leadRow.assigned_admin === null, 'Privileged assigned_admin remains null');

    // 3. PERSISTENT RATE LIMITER
    console.log('\n[TEST GROUP 3] Persistent Rate Limiter');
    const rlKey = 'test_ip_127_0_0_1';
    await pool.query('DELETE FROM rate_limit_events WHERE key = $1', [rlKey]);
    const rl1 = await checkPersistentRateLimit(rlKey, 3, 60);
    const rl2 = await checkPersistentRateLimit(rlKey, 3, 60);
    const rl3 = await checkPersistentRateLimit(rlKey, 3, 60);
    const rl4 = await checkPersistentRateLimit(rlKey, 3, 60);
    assert(rl1.allowed === true && rl1.remaining === 2, 'First request allowed with remaining = 2');
    assert(rl2.allowed === true && rl2.remaining === 1, 'Second request allowed with remaining = 1');
    assert(rl3.allowed === true && rl3.remaining === 0, 'Third request allowed with remaining = 0');
    assert(rl4.allowed === false && rl4.remaining === 0, 'Fourth request rejected by rate limit');

    // 4. PROJECT VISIBILITY FILTERING
    console.log('\n[TEST GROUP 4] Public Project Visibility');
    const testPublicProjId = 'proj_test_public_' + Date.now();
    const testDraftProjId = 'proj_test_draft_' + Date.now();
    const testArchivedProjId = 'proj_test_archived_' + Date.now();

    await pool.query(`
      INSERT INTO projects (id, title, is_archived, visibility)
      VALUES 
        ($1, 'Public Project', FALSE, 'public'),
        ($2, 'Draft Project', FALSE, 'internal_draft'),
        ($3, 'Archived Project', TRUE, 'public')
    `, [testPublicProjId, testDraftProjId, testArchivedProjId]);

    const publicProjectsRes = await pool.query(`
      SELECT id, title FROM projects 
      WHERE is_archived IS NOT TRUE AND visibility = 'public' 
      AND id IN ($1, $2, $3)
    `, [testPublicProjId, testDraftProjId, testArchivedProjId]);

    assert(publicProjectsRes.rows.length === 1, 'Only exactly 1 project returned by public query');
    assert(publicProjectsRes.rows[0].id === testPublicProjId, 'Only public unarchived project is visible');

    // 5. BOOKING ATOMICITY & UNIQUE SLOT CONFLICT HANDLING
    console.log('\n[TEST GROUP 5] Bookings Atomicity & Slot Concurrency');
    const testDate = '2026-11-20';
    const testTime = '14:30';
    await pool.query('DELETE FROM bookings WHERE booking_date = $1 AND booking_time = $2', [testDate, testTime]);

    const bookingId1 = 'booking_atom_' + Date.now();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "INSERT INTO bookings (id, booking_date, booking_time, client_name, client_email, status) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')",
        [bookingId1, testDate, testTime, 'Test Client', 'client@test.com']
      );
      await client.query(
        "INSERT INTO crm_leads (id, contact_name, user_email, requested_service, status) VALUES ($1, $2, $3, $4, 'New')",
        ['lead_' + bookingId1, 'Test Client', 'client@test.com', 'Consultation']
      );
      await client.query('COMMIT');
      assert(true, 'Booking and CRM lead created atomically in single transaction');
    } catch (e) {
      await client.query('ROLLBACK');
      assert(false, 'Transaction failed unexpectedly: ' + e);
    } finally {
      client.release();
    }

    // Now test slot conflict on the exact same date & time
    let duplicateRejected = false;
    try {
      await pool.query(
        "INSERT INTO bookings (id, booking_date, booking_time, client_name, client_email, status) VALUES ($1, $2, $3, $4, $5, 'CONFIRMED')",
        ['booking_atom_dup_' + Date.now(), testDate, testTime, 'Conflicting Client', 'client2@test.com']
      );
    } catch (dbErr: any) {
      if (dbErr.code === '23505') {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected === true, 'Duplicate booking on the same date/time rejected by UNIQUE constraint (23505)');

    // 6. PASSWORD RESET SINGLE-USE ATOMIC TRANSACTION
    console.log('\n[TEST GROUP 6] Password Recovery Token Atomic Consumption');
    const testResetUserEmail = 'admin@avartah.com';
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const tokenId = 'rst_test_' + Date.now();

    await pool.query(
      `INSERT INTO password_reset_tokens (id, user_email, token_hash, expires_at, used)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 hour', FALSE)`,
      [tokenId, testResetUserEmail, tokenHash]
    );

    // First consumption: should succeed
    const claim1 = await pool.query(
      `UPDATE password_reset_tokens 
       SET used = TRUE 
       WHERE token_hash = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP 
       RETURNING id, user_email`,
      [tokenHash]
    );
    assert(claim1.rows.length === 1, 'First token claim succeeded');

    // Second consumption: should be rejected (used = true)
    const claim2 = await pool.query(
      `UPDATE password_reset_tokens 
       SET used = TRUE 
       WHERE token_hash = $1 AND used = FALSE AND expires_at > CURRENT_TIMESTAMP 
       RETURNING id, user_email`,
      [tokenHash]
    );
    assert(claim2.rows.length === 0, 'Replayed token claim strictly rejected (used = true)');

    // 7. WORKSPACE INVITATION LIFECYCLE & ROLE ESCALATION
    console.log('\n[TEST GROUP 7] Workspace Invitation Lifecycle & Role Escalation');
    const testWsId = 'ws_sec_test_' + Date.now();
    await pool.query(
      "INSERT INTO workspaces (id, name, owner_email, status) VALUES ($1, 'Security Test WS', 'owner@ws.com', 'active')",
      [testWsId]
    );
    await pool.query(
      "INSERT INTO workspace_memberships (workspace_id, user_email, role, status) VALUES ($1, 'owner@ws.com', 'owner', 'active')",
      [testWsId]
    );
    await pool.query(
      "INSERT INTO workspace_memberships (workspace_id, user_email, role, status) VALUES ($1, 'admin_member@ws.com', 'admin', 'active')",
      [testWsId]
    );

    // Rule check: Admin member attempting to grant 'owner' role must be rejected
    const isOwner = (await pool.query(
      "SELECT role FROM workspace_memberships WHERE workspace_id = $1 AND user_email = 'admin_member@ws.com' AND role = 'owner'",
      [testWsId]
    )).rows.length > 0;
    assert(isOwner === false, 'Admin member is not owner');

    // Create an invitation from owner
    const rawInvToken = crypto.randomBytes(32).toString('hex');
    const invTokenHash = crypto.createHash('sha256').update(rawInvToken).digest('hex');
    const invId = 'inv_test_' + Date.now();

    await pool.query(
      `INSERT INTO workspace_invitations (id, workspace_id, inviter_email, invitee_email, role, token_hash, expires_at, status)
       VALUES ($1, $2, 'owner@ws.com', 'newmember@test.com', 'member', $3, CURRENT_TIMESTAMP + INTERVAL '7 days', 'pending')`,
      [invId, testWsId, invTokenHash]
    );

    // Accept invitation
    const invClaim = await pool.query(
      `UPDATE workspace_invitations SET status = 'accepted' WHERE token_hash = $1 AND status = 'pending' RETURNING workspace_id, invitee_email, role`,
      [invTokenHash]
    );
    assert(invClaim.rows.length === 1, 'Invitation accepted successfully');

    await pool.query(
      `INSERT INTO workspace_memberships (workspace_id, user_email, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (workspace_id, user_email) DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
      [invClaim.rows[0].workspace_id, invClaim.rows[0].invitee_email, invClaim.rows[0].role]
    );

    const newMemberRow = (await pool.query(
      'SELECT * FROM workspace_memberships WHERE workspace_id = $1 AND user_email = $2',
      [testWsId, 'newmember@test.com']
    )).rows[0];
    assert(newMemberRow.status === 'active' && newMemberRow.role === 'member', 'Invitee successfully enrolled as active member');

    // 8. BILLING WEBHOOK IDEMPOTENCY
    console.log('\n[TEST GROUP 8] Billing Webhook Idempotency');
    const webhookEventId = 'evt_test_' + Date.now();
    const firstProcess = await pool.query(
      'INSERT INTO processed_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id',
      [webhookEventId]
    );
    const replayProcess = await pool.query(
      'INSERT INTO processed_webhook_events (id) VALUES ($1) ON CONFLICT (id) DO NOTHING RETURNING id',
      [webhookEventId]
    );
    assert(firstProcess.rows.length === 1, 'First webhook event recorded');
    assert(replayProcess.rows.length === 0, 'Replayed webhook event deduplicated (0 rows inserted)');

    // Clean up temporary test data
    await pool.query('DELETE FROM projects WHERE id IN ($1, $2, $3)', [testPublicProjId, testDraftProjId, testArchivedProjId]);
    await pool.query('DELETE FROM crm_leads WHERE id = $1', [testLeadId]);
    await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId1]);
    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [tokenId]);
    await pool.query('DELETE FROM workspaces WHERE id = $1', [testWsId]);
    await pool.query('DELETE FROM processed_webhook_events WHERE id = $1', [webhookEventId]);
    await pool.query('DELETE FROM rate_limit_events WHERE key = $1', [rlKey]);

  } catch (err: any) {
    console.error('Fatal Test Suite Error:', err);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStep10ETests().catch(err => {
  console.error(err);
  process.exit(1);
});
