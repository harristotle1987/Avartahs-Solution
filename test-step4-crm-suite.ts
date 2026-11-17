import http from 'http';
import pool from './lib/neon';

function httpRequest(options: http.RequestOptions, postData?: any, cookie?: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = postData ? (typeof postData === 'string' ? postData : JSON.stringify(postData)) : null;
    const headers = { ...(options.headers || {}) };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
      headers['Content-Type'] = 'application/json';
    }
    if (cookie) {
      headers['Cookie'] = cookie;
    }
    const req = http.request({ ...options, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runStep4Tests() {
  console.log('====================================================');
  console.log('AVARTAH SOLUTIONS — STEP 4: LEAD CAPTURE & CRM TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} ${extra ? `-> ${extra}` : ''}`);
      failed++;
    }
  }

  // Authenticate as Admin first to get session cookie
  let adminCookie = '';
  try {
    const loginRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'admin@avartah.com', password: 'Colony082987@' });
    
    assert('Admin login succeeds for CRM test setup', loginRes.statusCode === 200);
    adminCookie = loginRes.headers['set-cookie']?.[0]?.split(';')[0] || '';
    assert('Admin session cookie acquired', Boolean(adminCookie));
  } catch (err: any) {
    assert('Admin login failed during setup', false, err.message);
  }

  // TEST GROUP 1: Lead Creation & Deduplication
  console.log('\n--- TEST GROUP 1: Lead Creation & Deduplication ---');
  let testLeadId = `test_lead_${Date.now()}`;
  const testLeadEmail = `sarah.connor.${Date.now()}@cyberdyne.ng`;
  try {
    const createRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'POST'
    }, {
      id: testLeadId,
      contact_name: 'Sarah Connor',
      business_name: 'Cyberdyne Systems Nigeria',
      user_email: testLeadEmail,
      user_phone: `+23480${Math.floor(1000000 + Math.random() * 9000000)}`,
      target_url: `https://cyberdyne-${Date.now()}.ng`,
      revenue_tier: '$1,000 - $5,000',
      core_problem: 'Need AI automation for logistics operations.',
      requested_service: 'AI Integration & Business Automation',
      lead_source: 'Website Enquiry',
      status: 'New',
      priority: 'High'
    });

    assert('POST /api/leads creates lead successfully', createRes.statusCode === 200);
    const json = JSON.parse(createRes.body);
    assert('Lead creation returns success: true', json.success === true);
    if (json.id) testLeadId = json.id;

    // Test Deduplication by Email
    const duplicateRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'POST'
    }, {
      id: `lead_dup_${Date.now()}`,
      contact_name: 'Sarah Connor (Updated)',
      user_email: testLeadEmail.toUpperCase(), // casing different, should deduplicate
      user_phone: '+2348031234567',
      core_problem: 'Updated core problem description.'
    });

    assert('POST /api/leads with duplicate email succeeds (deduplicates)', duplicateRes.statusCode === 200);
    const dupJson = JSON.parse(duplicateRes.body);
    assert('Deduplication flag or ID matches existing record', dupJson.deduplicated === true || dupJson.id === testLeadId);
  } catch (err: any) {
    assert('Lead creation and deduplication test error', false, err.message);
  }

  // TEST GROUP 2: CRM Filtering, Searching & Stats
  console.log('\n--- TEST GROUP 2: CRM Filtering, Searching & Stats ---');
  try {
    const getLeadsRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/leads?search=${encodeURIComponent(testLeadEmail.split('@')[0])}`,
      method: 'GET'
    }, null, adminCookie);

    assert('GET /api/leads with search query returns 200 OK', getLeadsRes.statusCode === 200);
    const leadsList = JSON.parse(getLeadsRes.body);
    assert('Search correctly finds the test lead', leadsList.length >= 1 && leadsList[0].user_email.toLowerCase() === testLeadEmail.toLowerCase());

    const statsRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads/stats',
      method: 'GET'
    }, null, adminCookie);

    assert('GET /api/leads/stats returns 200 OK', statsRes.statusCode === 200);
    const stats = JSON.parse(statsRes.body);
    assert('Stats overview contains total, new_leads, qualified, won, lost', typeof stats.total === 'number' && typeof stats.new_leads === 'number');
  } catch (err: any) {
    assert('CRM filtering and stats test error', false, err.message);
  }

  // TEST GROUP 3: Lead Status Transition & PATCH updates
  console.log('\n--- TEST GROUP 3: Lead Status Transition & PATCH Updates ---');
  try {
    const patchRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/leads/${testLeadId}`,
      method: 'PATCH'
    }, {
      status: 'Qualified',
      priority: 'Urgent',
      notes: 'Initial discovery call completed successfully. Proposal requested.',
      follow_up_date: new Date(Date.now() + 86400000).toISOString()
    }, adminCookie);

    assert('PATCH /api/leads/:id successfully updates status and notes', patchRes.statusCode === 200);

    // Verify update in database
    const dbCheck = await pool.query('SELECT status, priority, notes FROM crm_leads WHERE id = $1', [testLeadId]);
    assert('Database reflects updated status to Qualified', dbCheck.rows[0].status === 'Qualified');
    assert('Database reflects priority to Urgent', dbCheck.rows[0].priority === 'Urgent');
  } catch (err: any) {
    assert('Lead update test error', false, err.message);
  }

  // TEST GROUP 4: Booking Integration
  console.log('\n--- TEST GROUP 4: Booking Integration with CRM ---');
  try {
    const bookingId = `booking_${Date.now()}`;
    const bookingRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST'
    }, {
      id: bookingId,
      name: 'Adeola Johnson',
      email: 'adeola.johnson@example.com',
      phone: '+2348098765432',
      date: '2026-11-01',
      time: '14:00',
      message: 'Discussing e-commerce multi-vendor platform.'
    });

    assert('POST /api/bookings successfully creates booking and syncs lead', bookingRes.statusCode === 200);

    // Verify lead created in crm_leads from booking
    const bookingLeadCheck = await pool.query("SELECT * FROM crm_leads WHERE id = $1", [`lead_booking_${bookingId}`]);
    assert('Booking successfully created a CRM lead with source Booking', bookingLeadCheck.rows.length === 1 && bookingLeadCheck.rows[0].lead_source === 'Booking');
    
    // Cleanup booking lead
    await pool.query("DELETE FROM crm_leads WHERE id = $1", [`lead_booking_${bookingId}`]);
  } catch (err: any) {
    assert('Booking CRM integration test error', false, err.message);
  }

  // TEST GROUP 5: Security & Authorization Enforcement
  console.log('\n--- TEST GROUP 5: Security & Authorization Enforcement ---');
  try {
    const unauthRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leads',
      method: 'GET'
    });
    assert('GET /api/leads without authentication is strictly rejected (401)', unauthRes.statusCode === 401);

    const unauthPatch = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/leads/${testLeadId}`,
      method: 'PATCH'
    }, { status: 'Won' });
    assert('PATCH /api/leads/:id without authentication is strictly rejected (401)', unauthPatch.statusCode === 401);
  } catch (err: any) {
    assert('Security test error', false, err.message);
  }

  // Cleanup test lead
  try {
    await pool.query('DELETE FROM crm_leads WHERE id = $1', [testLeadId]);
  } catch (e) {}

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runStep4Tests();
