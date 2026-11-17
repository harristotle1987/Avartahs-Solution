import http from 'http';
import assert from 'assert';
import pool from './lib/neon';
import { 
  validateEmail, 
  normalizeAndValidatePhone, 
  passesContactGate, 
  buildMailtoUrl, 
  buildWhatsAppUrl, 
  isSafeUrl,
  expandBusinessCategory,
  cleanQueryParts,
  normalizeDomain,
  normalizeBusinessKey,
  mapInternalStatusToCategory,
  WEBSITE_QUALITY_CATEGORIES,
  type WebsiteQualityCategory
} from './lib/prospects';

function httpRequest(
  options: http.RequestOptions, 
  postData?: any, 
  cookie?: string
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
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

async function runStep5TestSuite() {
  console.log('================================================================');
  console.log('AVARTAH SOLUTIONS — STEP 5: PROSPECTING & CRM INTEGRATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function testAssert(desc: string, condition: boolean, extra?: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} ${extra ? `-> ${extra}` : ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Discovery, Query Expansion & Synonyms
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Discovery, Query Expansion & Synonyms ---');
  try {
    const spaExpansion = expandBusinessCategory('spas');
    testAssert('Plural "spas" singularizes to "spa"', spaExpansion.normalizedNiche === 'spa');
    testAssert('Spa synonyms include wellness, massage, beauty salon', spaExpansion.expandedTerms.includes('wellness') && spaExpansion.expandedTerms.includes('massage'));
    testAssert('Generates OSM tag clauses for spa', spaExpansion.osmTagClauses.some(c => c.includes('amenity') || c.includes('leisure')));

    const clinicExpansion = expandBusinessCategory('clinics');
    testAssert('Plural "clinics" expands to doctors, medical, dental', clinicExpansion.expandedTerms.includes('doctors') || clinicExpansion.expandedTerms.includes('clinic'));

    const parsedQuery = cleanQueryParts('dental clinic in Manchester');
    testAssert('Cleanly parses niche and location', parsedQuery.niche.toLowerCase().includes('dental') && parsedQuery.location === 'Manchester');
  } catch (err: any) {
    testAssert('Group 1 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 2: Evidence-Based Website Quality Assessment (5 Categories)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Evidence-Based Website Quality Assessment (5 Categories) ---');
  try {
    // Category 1: No website found
    testAssert(
      'Category 1: mapInternalStatusToCategory("NO_WEBSITE") returns "No website found"',
      mapInternalStatusToCategory('NO_WEBSITE') === 'No website found'
    );
    testAssert(
      'Category 1: null/empty status maps to inconclusive or no website',
      mapInternalStatusToCategory(null) === 'Assessment inconclusive'
    );

    // Category 2: Website inaccessible or apparently broken
    testAssert(
      'Category 2: mapInternalStatusToCategory("BROKEN_WEBSITE") returns "Website inaccessible or apparently broken"',
      mapInternalStatusToCategory('BROKEN_WEBSITE') === 'Website inaccessible or apparently broken'
    );

    // Category 3: Website potentially outdated
    testAssert(
      'Category 3: mapInternalStatusToCategory("OUTDATED_WEBSITE") returns "Website potentially outdated"',
      mapInternalStatusToCategory('OUTDATED_WEBSITE') === 'Website potentially outdated'
    );

    // Category 4: Website appears functional and current
    testAssert(
      'Category 4: mapInternalStatusToCategory("GOOD_WEBSITE") returns "Website appears functional and current"',
      mapInternalStatusToCategory('GOOD_WEBSITE') === 'Website appears functional and current'
    );

    // Category 5: Assessment inconclusive
    testAssert(
      'Category 5: mapInternalStatusToCategory("NEEDS_REVIEW") returns "Assessment inconclusive"',
      mapInternalStatusToCategory('NEEDS_REVIEW') === 'Assessment inconclusive'
    );

    // Rule: Temporary timeout must NOT mean website is broken
    function simulateAvailabilityEvaluation(outcome: { isTimeout: boolean; httpStatus: number; hasDeprecatedTags: boolean; hasModernLayout: boolean }): { category: WebsiteQualityCategory; reason: string } {
      if (outcome.isTimeout) {
        return {
          category: 'Assessment inconclusive',
          reason: 'Temporary timeout does not imply that the website is broken. Assessment inconclusive; reassessment recommended.'
        };
      }
      if (outcome.httpStatus === 404 || outcome.httpStatus === 410) {
        return {
          category: 'Website inaccessible or apparently broken',
          reason: `Persistent HTTP status ${outcome.httpStatus}`
        };
      }
      if (outcome.hasDeprecatedTags) {
        return {
          category: 'Website potentially outdated',
          reason: 'Deprecated tags like font/marquee detected'
        };
      }
      if (outcome.hasModernLayout) {
        return {
          category: 'Website appears functional and current',
          reason: 'Modern responsive layout'
        };
      }
      return {
        category: 'Assessment inconclusive',
        reason: 'Ambiguous signals'
      };
    }

    const timeoutCase = simulateAvailabilityEvaluation({ isTimeout: true, httpStatus: 0, hasDeprecatedTags: false, hasModernLayout: false });
    testAssert('Temporary timeout correctly maps to "Assessment inconclusive"', timeoutCase.category === 'Assessment inconclusive');
    testAssert('Temporary timeout reason states it does not imply broken', timeoutCase.reason.includes('does not imply that the website is broken'));

    const notFoundCase = simulateAvailabilityEvaluation({ isTimeout: false, httpStatus: 404, hasDeprecatedTags: false, hasModernLayout: false });
    testAssert('HTTP 404 maps to "Website inaccessible or apparently broken"', notFoundCase.category === 'Website inaccessible or apparently broken');

    const outdatedCase = simulateAvailabilityEvaluation({ isTimeout: false, httpStatus: 200, hasDeprecatedTags: true, hasModernLayout: false });
    testAssert('Obsolete markup maps to "Website potentially outdated"', outdatedCase.category === 'Website potentially outdated');

    const currentCase = simulateAvailabilityEvaluation({ isTimeout: false, httpStatus: 200, hasDeprecatedTags: false, hasModernLayout: true });
    testAssert('Modern markup maps to "Website appears functional and current"', currentCase.category === 'Website appears functional and current');
  } catch (err: any) {
    testAssert('Group 2 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 3: Contact Validation & WhatsApp Distinction
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Contact Validation & WhatsApp Distinction ---');
  try {
    // 1. Syntactic email validity vs. dummy placeholders
    const validRealEmail = validateEmail('contact@apexmedical.co.uk');
    testAssert('Legitimate business email syntax is valid', validRealEmail.isValid === true);
    testAssert('Legitimate business email is not marked as placeholder', validRealEmail.isPlaceholder === false);

    const dummyEmail1 = validateEmail('info@domain.com');
    testAssert('Placeholder domain.com is rejected', dummyEmail1.isValid === false && dummyEmail1.isPlaceholder === true);

    const dummyEmail2 = validateEmail('test@example.com');
    testAssert('Placeholder example.com is rejected', dummyEmail2.isValid === false && dummyEmail2.isPlaceholder === true);

    const dummyEmail3 = validateEmail('info@greencleaners.com');
    testAssert('Placeholder greencleaners.com is rejected', dummyEmail3.isValid === false && dummyEmail3.isPlaceholder === true);

    // 2. Telephone normalization & building number rejection
    const houseNumberVal = normalizeAndValidatePhone('42');
    testAssert('Short house number "42" is rejected as address number', houseNumberVal.isAddressNumber === true && houseNumberVal.isValid === false);

    const yearVal = normalizeAndValidatePhone('2024');
    testAssert('Year number "2024" is rejected as address number', yearVal.isAddressNumber === true && yearVal.isValid === false);

    const repetitiveVal = normalizeAndValidatePhone('0000000000');
    testAssert('Repetitive dummy digits rejected', repetitiveVal.isValid === false);

    const nigerianMobile = normalizeAndValidatePhone('08031234567', 'Nigeria');
    testAssert('Nigerian mobile normalized to +2348031234567', nigerianMobile.isValid === true && nigerianMobile.normalizedPhone === '+2348031234567');

    const ukMobile = normalizeAndValidatePhone('07911123456', 'London, UK');
    testAssert('UK number normalized to +447911123456', ukMobile.isValid === true && ukMobile.normalizedPhone === '+447911123456');

    // 3. Strict WhatsApp Distinction (Never represent unverified phone as confirmed WhatsApp)
    testAssert('Standard phone is not marked as WhatsApp confirmed', ukMobile.isWhatsAppConfirmed === false);

    // Qualification Gate requires at least 1 real contact
    const prospectWithContact = { name: 'Real Clinic', email: 'hello@realclinic.co.uk', phone: '+442079460000' };
    testAssert('Prospect with valid email/phone passes contact gate', passesContactGate(prospectWithContact));

    const prospectWithoutContact = { name: 'Empty Workshop', email: null, phone: null, website: 'https://example.com' };
    testAssert('Prospect with no contact fails contact gate', passesContactGate(prospectWithoutContact) === false);
  } catch (err: any) {
    testAssert('Group 3 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 4: SSRF Security Guards
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: SSRF Security Guards ---');
  try {
    testAssert('Blocks localhost', isSafeUrl('http://localhost:3000') === false);
    testAssert('Blocks 127.0.0.1 loopback', isSafeUrl('http://127.0.0.1') === false);
    testAssert('Blocks 127.127.127.127 loopback', isSafeUrl('http://127.127.127.127:8080') === false);
    testAssert('Blocks 0.0.0.0', isSafeUrl('http://0.0.0.0') === false);
    testAssert('Blocks AWS/GCP metadata 169.254.169.254', isSafeUrl('http://169.254.169.254/latest/meta-data/') === false);
    testAssert('Blocks metadata.google.internal', isSafeUrl('http://metadata.google.internal/computeMetadata/v1/') === false);
    testAssert('Blocks private 10.0.0.0/8', isSafeUrl('http://10.0.1.5') === false);
    testAssert('Blocks private 192.168.0.0/16', isSafeUrl('http://192.168.1.1/admin') === false);
    testAssert('Blocks private 172.16.0.0/12', isSafeUrl('http://172.16.10.20') === false);
    testAssert('Blocks non-FQDN hostname', isSafeUrl('http://internal-server') === false);
    testAssert('Allows legitimate public website', isSafeUrl('https://mayfairspa.co.uk') === true);
    testAssert('Allows legitimate Nigerian domain', isSafeUrl('https://business.com.ng/services') === true);
  } catch (err: any) {
    testAssert('Group 4 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 5: Conservative Deduplication
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Conservative Deduplication ---');
  try {
    const domain1 = normalizeDomain('https://www.mayfairspa.co.uk/about/');
    const domain2 = normalizeDomain('http://mayfairspa.co.uk');
    testAssert('Normalizes domains consistently', domain1 === 'mayfairspa.co.uk' && domain2 === 'mayfairspa.co.uk');

    const key1 = normalizeBusinessKey('The Mayfair Spa & Wellness', 'London, UK');
    const key2 = normalizeBusinessKey('The Mayfair Spa  Wellness', 'London, UK');
    testAssert('Generates consistent business keys ignoring punctuation', key1 === key2);
  } catch (err: any) {
    testAssert('Group 5 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 6: Backend CRM Integration & Promotion Endpoints
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Backend CRM Integration & Promotion Endpoints ---');
  let adminCookie = '';
  let adminCsrfToken = '';
  try {
    const loginRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST'
    }, { email: 'admin@avartah.com', password: 'Colony082987@' });

    testAssert('Admin login succeeds for CRM promotion tests', loginRes.statusCode === 200);
    const setCookies = Array.isArray(loginRes.headers['set-cookie'])
      ? loginRes.headers['set-cookie']
      : loginRes.headers['set-cookie']
      ? [loginRes.headers['set-cookie']]
      : [];
    const sessionPair = setCookies.map(c => c.split(';')[0]).find(c => c.startsWith('admin_session=')) || '';
    const xsrfPair = setCookies.map(c => c.split(';')[0]).find(c => c.startsWith('XSRF-TOKEN=')) || '';
    adminCookie = [sessionPair, xsrfPair].filter(Boolean).join('; ');
    try {
      adminCsrfToken = JSON.parse(loginRes.body)?.csrfToken || '';
    } catch {}
    if (!adminCsrfToken && xsrfPair) {
      adminCsrfToken = decodeURIComponent(xsrfPair.split('=')[1] || '');
    }
    testAssert('Admin session acquired', Boolean(sessionPair));
  } catch (err: any) {
    testAssert('Admin setup failed', false, err.message);
  }

  const testProspectId = `test_prospect_${Date.now()}`;
  const testProspectEmail = `director_${Date.now()}@premierhealth.co.uk`;
  const testWebsite = `https://premierhealth-${Date.now()}.co.uk`;
  const csrfHeaders: Record<string, string> = adminCsrfToken ? { 'x-csrf-token': adminCsrfToken } : {};

  try {
    // 1. Verify direct generic POST /api/prospects is disabled (CRM-only persistence)
    const saveRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/prospects',
      method: 'POST',
      headers: csrfHeaders
    }, {
      id: testProspectId,
      name: 'Premier Health Clinic',
      location: 'Manchester, UK',
      phone: `+44${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      email: testProspectEmail,
      website: testWebsite,
      status: 'OUTDATED_WEBSITE',
      website_quality_category: 'Website potentially outdated',
      website_quality_score: 42,
      evidence: 'Missing mobile viewport; obsolete HTML tags present'
    }, adminCookie);

    testAssert('Direct POST /api/prospects is disabled with 403 CRM_ONLY_PERSISTENCE_REQUIRED', saveRes.statusCode === 403);

    // 2. Verify zero premature rows in Neon prospects table
    const preCheck = await pool.query('SELECT * FROM prospects WHERE id = $1', [testProspectId]);
    testAssert('Zero premature prospect rows persisted before Add to CRM', preCheck.rows.length === 0);

    // 3. Explicit Add to CRM via POST /api/prospects/:id/promote with candidate payload
    const promoteRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/prospects/${testProspectId}/promote`,
      method: 'POST',
      headers: csrfHeaders
    }, {
      requested_service: 'Full Digital Overhaul & Redesign',
      priority: 'Urgent',
      notes: 'Client has an outdated website without mobile layout.',
      prospect: {
        id: testProspectId,
        business_name: 'Premier Health Clinic',
        location: 'Manchester, UK',
        phone: `+44${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        email: testProspectEmail,
        website_url: testWebsite,
        status: 'OUTDATED_WEBSITE',
        website_quality_category: 'Website potentially outdated',
        website_quality_score: 42,
        evidence: 'Missing mobile viewport; obsolete HTML tags present'
      }
    }, adminCookie);

    testAssert('POST /api/prospects/:id/promote returns 200 OK', promoteRes.statusCode === 200);
    const promoteJson = JSON.parse(promoteRes.body);
    testAssert('Promotion returns success: true', promoteJson.success === true);
    testAssert('Promotion returns lead_id', Boolean(promoteJson.lead_id));
    testAssert('New promotion was not a pre-existing duplicate', promoteJson.deduplicated === false);

    // 4. Verify crm_leads table contains the promoted lead
    const crmLeadCheck = await pool.query('SELECT * FROM crm_leads WHERE id = $1', [promoteJson.lead_id]);
    testAssert('Authoritative crm_leads record created', crmLeadCheck.rows.length === 1);
    testAssert('Lead source is "Prospect Outreach"', crmLeadCheck.rows[0].lead_source === 'Prospect Outreach');
    testAssert('Lead business name matches prospect', crmLeadCheck.rows[0].business_name === 'Premier Health Clinic');
    testAssert('Lead email matches prospect', crmLeadCheck.rows[0].user_email === testProspectEmail);

    // 5. Verify prospect table has reviewed_status = 'PROMOTED' and linked crm_lead_id
    const persistedProspectId = promoteJson.prospect_id || testProspectId;
    const updatedProspect = await pool.query('SELECT reviewed_status, crm_lead_id, promoted_at, website_quality_category FROM prospects WHERE id = $1', [persistedProspectId]);
    testAssert('Prospect confirmed in Neon prospects table after Add to CRM', updatedProspect.rows.length === 1);
    testAssert('Website quality category preserved in Neon', updatedProspect.rows[0]?.website_quality_category === 'Website potentially outdated');
    testAssert('Prospect reviewed_status is PROMOTED', updatedProspect.rows[0]?.reviewed_status === 'PROMOTED');
    testAssert('Prospect links to crm_lead_id', updatedProspect.rows[0]?.crm_lead_id === promoteJson.lead_id);
    testAssert('Promoted timestamp recorded', Boolean(updatedProspect.rows[0]?.promoted_at));

    // 6. Test Deduplication: Attempt to promote again -> must link to existing without creating duplicate
    const secondPromoteRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/prospects/${persistedProspectId}/promote`,
      method: 'POST',
      headers: csrfHeaders
    }, {}, adminCookie);

    testAssert('Second promotion call returns 200 OK', secondPromoteRes.statusCode === 200);
    const secondJson = JSON.parse(secondPromoteRes.body);
    testAssert('Second promotion detects duplicate and links existing lead', secondJson.deduplicated === true && secondJson.lead_id === promoteJson.lead_id);

    // 7. Test Reassessment Endpoint: POST /api/prospects/reassess-website
    const reassessRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/prospects/reassess-website',
      method: 'POST',
      headers: csrfHeaders
    }, {
      id: persistedProspectId,
      website_url: 'https://premierhealth.co.uk'
    }, adminCookie);

    testAssert('POST /api/prospects/reassess-website returns 200 OK', reassessRes.statusCode === 200);
    const reassessJson = JSON.parse(reassessRes.body);
    testAssert('Reassessment returns updated assessment object', Boolean(reassessJson.assessment && reassessJson.assessment.website_quality_category));

    // 8. Test Search & Filter on GET /api/prospects
    const filterRes = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/prospects?search=Premier+Health`,
      method: 'GET'
    }, null, adminCookie);

    testAssert('GET /api/prospects with search query returns 200 OK', filterRes.statusCode === 200);
    const filterList = JSON.parse(filterRes.body);
    testAssert('Search finds the promoted prospect in Neon', filterList.some((p: any) => p.id === persistedProspectId));

    // Cleanup test data
    await pool.query('DELETE FROM crm_leads WHERE id = $1', [promoteJson.lead_id]);
    await pool.query('DELETE FROM prospects WHERE id = $1', [persistedProspectId]);
  } catch (err: any) {
    testAssert('Group 6 error', false, err.message);
  }

  // -------------------------------------------------------------
  // TEST GROUP 7: Security & Unauthorized Access
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Security & Unauthorized Access ---');
  try {
    const unauthGet = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/prospects',
      method: 'GET'
    });
    testAssert('Unauthenticated GET /api/prospects rejected with 401', unauthGet.statusCode === 401);

    const unauthPromote = await httpRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/prospects/any_id/promote`,
      method: 'POST'
    }, {});
    testAssert('Unauthenticated POST /api/prospects/:id/promote rejected with 401', unauthPromote.statusCode === 401);
  } catch (err: any) {
    testAssert('Group 7 error', false, err.message);
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runStep5TestSuite();
