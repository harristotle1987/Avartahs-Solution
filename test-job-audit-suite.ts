import assert from 'assert';
import { applyJobFilters, isSafeJobUrl, calculateMatchScore } from './lib/jobs';
import { JobListing, JobFilterState } from './types';

const BASE_URL = 'http://localhost:3000';

console.log('===========================================================');
console.log('AVARTAH SOLUTIONS: Comprehensive Job Audit & Fix Test Suite');
console.log('===========================================================\n');

async function runTests() {
  // -------------------------------------------------------------
  // SECTION 1: SEARCH RELEVANCE & MULTI-WORD KEYWORD MATCHING
  // -------------------------------------------------------------
  console.log('--- SECTION 1: Search Relevance in lib/jobs.ts ---');

  const sampleJobs: JobListing[] = [
    {
      id: 'job-1',
      title: 'Senior React Developer',
      company: 'TechCorp Solutions',
      location: 'London, United Kingdom',
      country: 'GB',
      remote: 'hybrid',
      jobType: 'full-time',
      experienceLevel: 'senior',
      datePosted: new Date().toISOString(),
      source: 'Greenhouse',
      applyUrl: 'https://boards.greenhouse.io/techcorp/jobs/12345',
      description: 'We are seeking an experienced Senior React Developer to lead our frontend architecture.',
      skills: ['React', 'TypeScript', 'TailwindCSS'],
      status: 'ACTIVE',
      matchScore: 90
    },
    {
      id: 'job-2',
      title: 'Junior Python Developer',
      company: 'DataWorks Ltd',
      location: 'Manchester, United Kingdom',
      country: 'GB',
      remote: 'on-site',
      jobType: 'full-time',
      experienceLevel: 'entry',
      datePosted: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      source: 'Jobicy',
      applyUrl: 'https://jobicy.com/jobs/67890',
      description: 'Exciting entry-level position for a Python enthusiast.',
      skills: ['Python', 'SQL'],
      status: 'UNVERIFIED',
      matchScore: 60
    },
    {
      id: 'job-3',
      title: 'Lead Full-Stack React Engineer',
      company: 'Innovate Labs',
      location: 'San Francisco, USA',
      country: 'US',
      remote: 'remote',
      jobType: 'contract',
      experienceLevel: 'lead',
      datePosted: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
      source: 'Remotive',
      applyUrl: 'https://remotive.com/jobs/54321',
      description: 'Senior-level React developer / contractor wanted to build scalable systems.',
      skills: ['React', 'Node.js', 'PostgreSQL'],
      status: 'UNVERIFIED',
      matchScore: 85
    },
    {
      id: 'job-4',
      title: 'Mid-Level Frontend Engineer',
      company: 'CloudFlow UK',
      location: 'Bristol, United Kingdom',
      country: 'GB',
      remote: 'remote',
      jobType: 'full-time',
      experienceLevel: 'mid',
      datePosted: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
      source: 'Arbeitnow',
      applyUrl: 'https://www.arbeitnow.com/view/mid-frontend-engineer-bristol',
      description: 'Join our product team to craft modern UI components in React.',
      skills: ['React', 'JavaScript'],
      status: 'UNVERIFIED',
      matchScore: 75
    }
  ];

  // Test 1.1: Multi-word query requiring ALL significant terms
  console.log('Test 1.1: Multi-word query "Senior React Developer" precision');
  const baseFilters: JobFilterState = {
    keyword: 'Senior React Developer',
    location: '',
    country: 'all',
    remote: 'all',
    jobType: 'all',
    experienceLevel: 'all',
    datePosted: 'all',
    sortBy: 'date'
  };

  const multiWordResults = applyJobFilters(sampleJobs, baseFilters);
  // job-1 has Senior, React, Developer -> MATCH
  // job-3 has Lead Full-Stack React Engineer with "Senior" in description -> MATCH
  // job-2 only has "Developer" (missing Senior and React) -> MUST NOT MATCH
  // job-4 has React, Engineer, Mid (missing Senior and Developer) -> MUST NOT MATCH
  assert.strictEqual(multiWordResults.length, 2, 'Multi-word search must require all significant terms');
  assert(multiWordResults.some(j => j.id === 'job-1'), 'job-1 must match');
  assert(multiWordResults.some(j => j.id === 'job-3'), 'job-3 must match because description has Senior and React');
  assert(!multiWordResults.some(j => j.id === 'job-2'), 'Junior Python Developer must NOT match Senior React Developer');
  assert(!multiWordResults.some(j => j.id === 'job-4'), 'Mid-Level Frontend Engineer must NOT match Senior React Developer');
  console.log('✅ Passed: Multi-word query requires all significant terms; eliminated false positive "Junior Python Developer".');

  // Test 1.2: Location and Country filter
  console.log('\nTest 1.2: Country and Location filtering');
  const ukFilters: JobFilterState = {
    ...baseFilters,
    keyword: '',
    country: 'GB',
    location: 'London'
  };
  const ukResults = applyJobFilters(sampleJobs, ukFilters);
  assert.strictEqual(ukResults.length, 1, 'Only London, GB job should match');
  assert.strictEqual(ukResults[0].id, 'job-1');
  console.log('✅ Passed: Location and Country filtering verified.');

  // Test 1.3: Remote, Employment Type, and Experience filters
  console.log('\nTest 1.3: Remote, Job Type, and Experience Level filtering');
  const remoteFilters: JobFilterState = {
    ...baseFilters,
    keyword: '',
    remote: 'remote',
    jobType: 'contract',
    experienceLevel: 'lead'
  };
  const remoteResults = applyJobFilters(sampleJobs, remoteFilters);
  assert.strictEqual(remoteResults.length, 1, 'Only remote contract lead job should match');
  assert.strictEqual(remoteResults[0].id, 'job-3');
  console.log('✅ Passed: Remote, Job Type, and Experience filters verified.');

  // Test 1.4: Date Posted filter (e.g. last 7 days vs last 30 days)
  console.log('\nTest 1.4: Date posted filter');
  const weekFilters: JobFilterState = {
    ...baseFilters,
    keyword: '',
    datePosted: '7d'
  };
  const weekResults = applyJobFilters(sampleJobs, weekFilters);
  // job-1 (today) and job-2 (3d ago) match. job-3 (15d ago) and job-4 (40d ago) must not.
  assert.strictEqual(weekResults.length, 2, 'Only jobs posted within last 7 days should match');
  assert(weekResults.every(j => ['job-1', 'job-2'].includes(j.id)));
  console.log('✅ Passed: Date posted filter (7d) strictly verified.');

  // -------------------------------------------------------------
  // SECTION 2: JOB VALIDITY AND URL SAFETY
  // -------------------------------------------------------------
  console.log('\n--- SECTION 2: Job Validity & URL Safety ---');

  // Malformed and dangerous URLs
  assert.strictEqual(isSafeJobUrl(''), false, 'Empty URL must be rejected');
  assert.strictEqual(isSafeJobUrl('javascript:alert(1)'), false, 'Javascript scheme must be rejected');
  assert.strictEqual(isSafeJobUrl('ftp://example.com/job'), false, 'FTP scheme must be rejected');
  assert.strictEqual(isSafeJobUrl('not-a-valid-url'), false, 'Relative string must be rejected');
  assert.strictEqual(isSafeJobUrl('http://localhost:3000/apply'), false, 'Localhost must be rejected');
  assert.strictEqual(isSafeJobUrl('http://127.0.0.1:8080/apply'), false, '127.0.0.1 must be rejected');
  assert.strictEqual(isSafeJobUrl('http://192.168.1.10/job'), false, 'Private network 192.168.x.x must be rejected');
  assert.strictEqual(isSafeJobUrl('http://internal.company.local/apply'), false, '.local domain must be rejected');

  // Valid HTTPS URLs
  assert.strictEqual(isSafeJobUrl('https://boards.greenhouse.io/techcorp/jobs/12345'), true, 'Greenhouse ATS URL must be valid');
  assert.strictEqual(isSafeJobUrl('https://jobs.lever.co/company/xyz'), true, 'Lever ATS URL must be valid');
  assert.strictEqual(isSafeJobUrl('https://remotive.com/jobs/54321'), true, 'HTTPS job listing must be valid');
  console.log('✅ Passed: Malformed, non-HTTPS, localhost, and private intranet URLs safely rejected; valid HTTPS URLs accepted.');

  // -------------------------------------------------------------
  // SECTION 3: BACKEND API AUTHORIZATION ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n--- SECTION 3: Backend API Authorization & Session Enforcement ---');

  // Test 3.1: Unauthenticated request to /api/jobs/search must return 401
  console.log('Test 3.1: Unauthenticated POST /api/jobs/search rejection');
  const unauthSearchRes = await fetch(`${BASE_URL}/api/jobs/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword: 'React' })
  });
  assert.strictEqual(unauthSearchRes.status, 401, 'Unauthenticated search must return 401');
  const unauthSearchData = await unauthSearchRes.json();
  assert(unauthSearchData.error.includes('Unauthorized'), 'Error message must say Unauthorized');
  console.log('✅ Passed: Unauthenticated request to /api/jobs/search returned 401 Unauthorized.');

  // Test 3.2: Unauthenticated request to /api/jobs/saved must return 401
  console.log('\nTest 3.2: Unauthenticated GET /api/jobs/saved rejection');
  const unauthSavedRes = await fetch(`${BASE_URL}/api/jobs/saved`);
  assert.strictEqual(unauthSavedRes.status, 401, 'Unauthenticated saved jobs must return 401');
  console.log('✅ Passed: Unauthenticated request to /api/jobs/saved returned 401 Unauthorized (no default email fallback).');

  // Test 3.3: Unauthenticated request to /api/jobs/save must return 401
  console.log('\nTest 3.3: Unauthenticated POST /api/jobs/save rejection');
  const unauthSaveRes = await fetch(`${BASE_URL}/api/jobs/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job: sampleJobs[0] })
  });
  assert.strictEqual(unauthSaveRes.status, 401, 'Unauthenticated job save must return 401');
  console.log('✅ Passed: Unauthenticated request to /api/jobs/save returned 401 Unauthorized.');

  // Test 3.4: Ordinary user registration / login check
  console.log('\nTest 3.4: Ordinary User Login and Role Enforcement');
  // First login with an ordinary user or register one
  const testUserEmail = `testuser_${Date.now()}@example.com`;
  const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUserEmail,
      password: 'UserSecurePass123!',
      fullName: 'Test Ordinary User'
    })
  });

  let userToken = '';
  let userCookie = '';
  if (registerRes.status === 201) {
    const regData = await registerRes.json();
    userToken = regData.token;
    const cookie = registerRes.headers.get('set-cookie');
    if (cookie) userCookie = cookie.split(';')[0];
  } else {
    const regErrorText = await registerRes.text();
    console.log('Register failed with status:', registerRes.status, regErrorText);
    // Attempt login if already registered
    const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserEmail, password: 'UserSecurePass123!' })
    });
    const loginData = await userLoginRes.json();
    console.log('Login attempt result:', userLoginRes.status, loginData);
    userToken = loginData.token;
    const cookie = userLoginRes.headers.get('set-cookie');
    if (cookie) userCookie = cookie.split(';')[0];
  }

  assert(userToken, 'Ordinary user session token must be acquired');

  // Verify Ordinary User role is 'user'
  const userSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Cookie': userCookie
    }
  });
  const userSessionData = await userSessionRes.json();
  assert.strictEqual(userSessionData.authenticated, true, 'User must be authenticated');
  assert.strictEqual(userSessionData.user.role, 'user', 'Ordinary user role must strictly be "user"');
  console.log('✅ Passed: Ordinary user registered and role verified as "user".');

  // Test 3.5: Ordinary user trying to access /api/jobs/search must receive 403 Forbidden
  console.log('\nTest 3.5: Ordinary user accessing /api/jobs/search must receive 403 Forbidden');
  const userJobSearchRes = await fetch(`${BASE_URL}/api/jobs/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'Cookie': userCookie
    },
    body: JSON.stringify({ keyword: 'React' })
  });
  assert.strictEqual(userJobSearchRes.status, 403, 'Ordinary user must be forbidden (403) from job search');
  const userJobSearchData = await userJobSearchRes.json();
  assert(userJobSearchData.error.toLowerCase().includes('forbidden') || userJobSearchData.error.toLowerCase().includes('admin'), 'Error must specify admin access required');
  console.log('✅ Passed: Ordinary user blocked with 403 Forbidden from /api/jobs/search.');

  // Test 3.6: Ordinary user trying to access /api/jobs/saved must receive 403 Forbidden
  console.log('\nTest 3.6: Ordinary user accessing /api/jobs/saved must receive 403 Forbidden');
  const userSavedRes = await fetch(`${BASE_URL}/api/jobs/saved`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Cookie': userCookie
    }
  });
  assert.strictEqual(userSavedRes.status, 403, 'Ordinary user must be forbidden (403) from saved jobs');
  console.log('✅ Passed: Ordinary user blocked with 403 Forbidden from /api/jobs/saved.');

  // Test 3.7: Ordinary user CAN access /api/blogs (ordinary users may read blogs)
  console.log('\nTest 3.7: Ordinary user can access /api/blogs');
  const userBlogRes = await fetch(`${BASE_URL}/api/blogs`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Cookie': userCookie
    }
  });
  assert.strictEqual(userBlogRes.status, 200, 'Ordinary user must be permitted to read blogs');
  console.log('✅ Passed: Ordinary user successfully accesses /api/blogs.');

  // -------------------------------------------------------------
  // SECTION 4: ADMIN AUTHORIZED ACCESS & PERSISTENCE
  // -------------------------------------------------------------
  console.log('\n--- SECTION 4: Admin Access & Persistence Reliability ---');

  // Login as admin
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@avartah.com', password: 'Colony082987@' })
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin credentials must succeed');
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.token;
  const adminCookie = adminLoginRes.headers.get('set-cookie')?.split(';')[0] || '';

  // Test 4.1: Admin executes search on /api/jobs/search with all filters
  console.log('\nTest 4.1: Admin executes POST /api/jobs/search with filters');
  const adminSearchRes = await fetch(`${BASE_URL}/api/jobs/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      keyword: 'Developer',
      location: 'London',
      country: 'GB',
      remote: 'all',
      jobType: 'all',
      experienceLevel: 'all',
      datePosted: '30d'
    })
  });
  assert.strictEqual(adminSearchRes.status, 200, 'Admin job search must return 200 OK');
  const adminSearchData = await adminSearchRes.json();
  assert(adminSearchData.success === true, 'Response must indicate success: true');
  assert(Array.isArray(adminSearchData.jobs), 'Response must include jobs array');
  assert('persistedCount' in adminSearchData, 'Response must report persistedCount');
  assert('persistenceConfirmed' in adminSearchData, 'Response must confirm persistence status');
  console.log(`✅ Passed: Admin search succeeded. Returned ${adminSearchData.jobs.length} jobs, persisted: ${adminSearchData.persistedCount}, persistenceConfirmed: ${adminSearchData.persistenceConfirmed}`);

  // Test 4.2: Admin searches with empty results
  console.log('\nTest 4.2: Admin search with non-existent query (empty results handling)');
  const emptySearchRes = await fetch(`${BASE_URL}/api/jobs/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      'Cookie': adminCookie
    },
    body: JSON.stringify({
      keyword: 'NonExistentGibberishKeyword999999XYZ',
      location: 'Antarctica',
      country: 'AQ',
      remote: 'on-site',
      jobType: 'internship',
      experienceLevel: 'executive',
      datePosted: '1d'
    })
  });
  assert.strictEqual(emptySearchRes.status, 200, 'Empty search must return 200 OK with empty array');
  const emptySearchData = await emptySearchRes.json();
  assert(Array.isArray(emptySearchData.jobs) && emptySearchData.jobs.length === 0, 'Must return 0 jobs for unmatched query');
  console.log('✅ Passed: Empty search handled cleanly, returning empty array with 200 OK.');

  // Test 4.3: Admin saved-jobs endpoint
  console.log('\nTest 4.3: Admin GET /api/jobs/saved');
  const adminSavedRes = await fetch(`${BASE_URL}/api/jobs/saved`, {
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Cookie': adminCookie
    }
  });
  assert.strictEqual(adminSavedRes.status, 200, 'Admin saved jobs must return 200 OK');
  const adminSavedData = await adminSavedRes.json();
  assert(Array.isArray(adminSavedData), 'Saved jobs must be an array');
  console.log(`✅ Passed: Admin saved jobs fetched successfully (${adminSavedData.length} saved jobs).`);

  console.log('\n===========================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY! 100% PASS RATE');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with error:', err);
  process.exit(1);
});
