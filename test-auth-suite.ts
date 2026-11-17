import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

console.log('===========================================================');
console.log('Running Avartah Solutions Comprehensive Auth Test Suite');
console.log('===========================================================\n');

async function runAuthTests() {
  // Test 1: Accessing session while unauthenticated must return { authenticated: false }
  console.log('--- Test 1: Unauthenticated Session Check ---');
  const unauthSessionRes = await fetch(`${BASE_URL}/api/auth/session`);
  assert.strictEqual(unauthSessionRes.status, 200, 'Session check should return 200');
  const unauthSessionData = await unauthSessionRes.json();
  assert.strictEqual(unauthSessionData.authenticated, false, 'Unauthenticated user must have authenticated=false');
  console.log('✅ Test 1 Passed: Unauthenticated session check returns false.');

  // Test 2: Protected admin endpoint without session must return 401 Unauthorized
  console.log('\n--- Test 2: Protected Admin Route Rejection ---');
  const unauthAdminRes = await fetch(`${BASE_URL}/api/prospects`);
  assert.strictEqual(unauthAdminRes.status, 401, 'Protected route without session must return 401 Unauthorized');
  const unauthAdminData = await unauthAdminRes.json();
  assert(unauthAdminData.error.includes('Unauthorized'), 'Error message must specify Unauthorized');
  console.log('✅ Test 2 Passed: Protected route strictly rejects unauthenticated requests.');

  // Test 3: Attempting bypass with obsolete fake header must return 401 Unauthorized
  console.log('\n--- Test 3: Fake Authorization Header Rejection ---');
  const fakeHeaderRes = await fetch(`${BASE_URL}/api/prospects`, {
    headers: {
      'Authorization': 'Bearer active_authenticated_secure',
      'x-admin-key': 'admin-authorized'
    }
  });
  assert.strictEqual(fakeHeaderRes.status, 401, 'Arbitrary or obsolete token bypasses must be rejected');
  console.log('✅ Test 3 Passed: Arbitrary/fake authorization tokens strictly rejected.');

  // Test 4: Invalid credentials login must return 401 with generic error
  console.log('\n--- Test 4: Invalid Credentials Login ---');
  const invalidLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@avartah.com', password: 'WrongPassword123!' })
  });
  assert.strictEqual(invalidLoginRes.status, 401, 'Invalid password must return 401');
  const invalidLoginData = await invalidLoginRes.json();
  assert.strictEqual(invalidLoginData.error, 'Invalid email or password', 'Must return generic error');
  console.log('✅ Test 4 Passed: Invalid credentials returned 401 with generic error.');

  // Test 5: Valid admin login sets HttpOnly cookie and NEVER returns token in JSON body
  console.log('\n--- Test 5: Valid Admin Credentials Login ---');
  const validLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@avartah.com', password: 'Colony082987@' })
  });
  assert.strictEqual(validLoginRes.status, 200, 'Valid credentials must return 200');
  const validLoginData = await validLoginRes.json();
  assert.strictEqual(validLoginData.success, true, 'Login response must indicate success: true');
  assert(!('token' in validLoginData), 'Login response must NOT expose raw session token in JSON body');

  // Extract Set-Cookie headers
  const setCookieValues = typeof (validLoginRes.headers as any).getSetCookie === 'function'
    ? (validLoginRes.headers as any).getSetCookie() as string[]
    : [validLoginRes.headers.get('set-cookie') || ''];
  const joinedCookies = setCookieValues.join('; ');
  assert(joinedCookies.includes('admin_session='), 'Set-Cookie must contain admin_session');
  assert(joinedCookies.includes('HttpOnly'), 'Cookie must be HttpOnly');

  const adminSessionPair = setCookieValues
    .map(c => c.split(';')[0])
    .find(c => c.startsWith('admin_session=')) || joinedCookies.split(';')[0];
  const xsrfPair = setCookieValues
    .map(c => c.split(';')[0])
    .find(c => c.startsWith('XSRF-TOKEN='));
  const cookieHeader = xsrfPair ? `${adminSessionPair}; ${xsrfPair}` : adminSessionPair;
  const csrfToken = validLoginData.csrfToken || (xsrfPair ? decodeURIComponent(xsrfPair.split('=')[1]) : '');
  const sessionCookie = adminSessionPair;
  console.log('✅ Test 5 Passed: Valid credentials returned HttpOnly cookie without JSON token leak.');

  // Test 6: Server Session Verification with Cookie
  console.log('\n--- Test 6: Validate Server Session via Cookie ---');
  const verifiedSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { 'Cookie': cookieHeader }
  });
  assert.strictEqual(verifiedSessionRes.status, 200);
  const verifiedSessionData = await verifiedSessionRes.json();
  assert.strictEqual(verifiedSessionData.authenticated, true, 'Session check with cookie must be authenticated');
  assert.strictEqual(verifiedSessionData.user.email, 'admin@avartah.com', 'User email must match session');
  console.log('✅ Test 6 Passed: Server session verified successfully via HttpOnly cookie.');

  // Test 7: Accessing Protected Admin Route with Valid Session Cookie
  console.log('\n--- Test 7: Access Protected Admin Route with Session Cookie ---');
  const adminAccessRes = await fetch(`${BASE_URL}/api/prospects`, {
    headers: { 'Cookie': cookieHeader }
  });
  assert.strictEqual(adminAccessRes.status, 200, 'Protected admin route must be accessible with valid session cookie');
  const prospectsList = await adminAccessRes.json();
  assert(Array.isArray(prospectsList), 'Prospects response must be an array');
  console.log('✅ Test 7 Passed: Protected route access granted with valid session cookie.');

  // Test 8: Logout invalidates session and clears cookie
  console.log('\n--- Test 8: Logout & Session Invalidation ---');
  const logoutHeaders: Record<string, string> = { 'Cookie': cookieHeader };
  if (csrfToken) logoutHeaders['x-csrf-token'] = csrfToken;
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: logoutHeaders
  });
  assert.strictEqual(logoutRes.status, 200, 'Logout should succeed');
  const logoutCookie = logoutRes.headers.get('set-cookie');
  assert(logoutCookie && (logoutCookie.includes('admin_session=;') || logoutCookie.includes('Max-Age=0') || logoutCookie.includes('Expires=')), 'Logout must clear admin_session cookie');

  // Verify that previous session cookie is now revoked and rejected
  const postLogoutSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { 'Cookie': sessionCookie }
  });
  const postLogoutSessionData = await postLogoutSessionRes.json();
  assert.strictEqual(postLogoutSessionData.authenticated, false, 'Revoked session token must return authenticated=false');

  const postLogoutAdminRes = await fetch(`${BASE_URL}/api/prospects`, {
    headers: { 'Cookie': sessionCookie }
  });
  assert.strictEqual(postLogoutAdminRes.status, 401, 'Revoked session must be rejected with 401');
  console.log('✅ Test 8 Passed: Logout successfully invalidated session and revoked all access.');

  console.log('\n===========================================================');
  console.log('🎉 ALL AUTHENTICATION FLOW TESTS PASSED! 🎉');
  console.log('===========================================================');
}

runAuthTests().catch(err => {
  console.error('❌ Auth Test Failure:', err);
  process.exit(1);
});
