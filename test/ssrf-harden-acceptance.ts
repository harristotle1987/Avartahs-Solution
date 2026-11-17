import { 
  isSafeIp, 
  isSafeUrl, 
  parseIpv4ToOctets, 
  resolveAndValidateHost, 
  safeFetchWithRedirects, 
  deepScrapeWebsiteContacts 
} from '../lib/prospects.ts';

async function runSsrfHardeningTests() {
  console.log('================================================================');
  console.log('WEBSITE SCRAPER SSRF SECURITY HARDENING ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail: string = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. IP Range & Encoding Validation
  console.log('--- 1. IP Range & Alternative Format Validation ---');
  assert(!isSafeIp('127.0.0.1'), 'Blocks 127.0.0.1 loopback');
  assert(!isSafeIp('127.0.0.2'), 'Blocks 127.0.0.0/8 subnet');
  assert(!isSafeIp('10.0.0.1'), 'Blocks 10.0.0.0/8 private IP');
  assert(!isSafeIp('172.16.0.1'), 'Blocks 172.16.0.0/12 private IP');
  assert(!isSafeIp('192.168.1.1'), 'Blocks 192.168.0.0/16 private IP');
  assert(!isSafeIp('169.254.169.254'), 'Blocks 169.254.169.254 Cloud metadata IP');
  assert(!isSafeIp('100.64.0.1'), 'Blocks 100.64.0.0/10 Carrier-grade NAT');
  assert(!isSafeIp('0.0.0.0'), 'Blocks 0.0.0.0 current network');
  assert(!isSafeIp('::1'), 'Blocks IPv6 loopback ::1');
  assert(!isSafeIp('fc00::1'), 'Blocks IPv6 ULA fc00::/7');
  assert(!isSafeIp('fe80::1'), 'Blocks IPv6 Link-Local fe80::/10');
  assert(!isSafeIp('::ffff:127.0.0.1'), 'Blocks IPv4-mapped IPv6 loopback');
  assert(!isSafeIp('::ffff:10.0.0.1'), 'Blocks IPv4-mapped IPv6 private');

  // Decimal and Hex IPv4
  const decOctets = parseIpv4ToOctets('2130706433'); // 127.0.0.1 in decimal
  assert(Boolean(decOctets && decOctets[0] === 127 && decOctets[3] === 1), 'Parses single decimal IP 2130706433 to 127.0.0.1');
  assert(!isSafeIp('2130706433'), 'Blocks single decimal IPv4 2130706433 (127.0.0.1)');
  
  const hexOctets = parseIpv4ToOctets('0x7f000001'); // 127.0.0.1 in hex
  assert(Boolean(hexOctets && hexOctets[0] === 127 && hexOctets[3] === 1), 'Parses hex IP 0x7f000001 to 127.0.0.1');
  assert(!isSafeIp('0x7f000001'), 'Blocks hex IPv4 0x7f000001');

  assert(isSafeIp('8.8.8.8'), 'Allows public IPv4 8.8.8.8');
  assert(isSafeIp('93.184.216.34'), 'Allows public IPv4 93.184.216.34 (example.com)');
  console.log('');

  // 2. URL Format & Protocol Validation
  console.log('--- 2. URL Format & Protocol Validation ---');
  assert(!isSafeUrl('http://localhost:3000'), 'Blocks http://localhost:3000');
  assert(!isSafeUrl('http://127.0.0.1:8080'), 'Blocks http://127.0.0.1:8080');
  assert(!isSafeUrl('http://169.254.169.254/latest/meta-data/'), 'Blocks Cloud metadata URL');
  assert(!isSafeUrl('http://metadata.google.internal/'), 'Blocks GCP metadata domain');
  assert(!isSafeUrl('file:///etc/passwd'), 'Blocks file:// protocol');
  assert(!isSafeUrl('gopher://127.0.0.1:70'), 'Blocks gopher:// protocol');
  assert(!isSafeUrl('http://user:pass@example.com'), 'Blocks userinfo in URL');
  assert(!isSafeUrl('http://2130706433/'), 'Blocks decimal IP in URL host');
  assert(isSafeUrl('https://example.com'), 'Allows public https://example.com');
  assert(isSafeUrl('https://avartah.com'), 'Allows public https://avartah.com');
  console.log('');

  // 3. Host Resolution & DNS Security
  console.log('--- 3. DNS Host Resolution & Rebinding Validation ---');
  const resLocal = await resolveAndValidateHost('localhost');
  assert(!resLocal.safe, 'DNS check blocks localhost');

  const resMeta = await resolveAndValidateHost('169.254.169.254');
  assert(!resMeta.safe, 'DNS check blocks 169.254.169.254');

  const resPublic = await resolveAndValidateHost('example.com');
  assert(resPublic.safe && resPublic.addresses.length > 0, 'DNS check resolves and allows example.com');
  console.log('');

  // 4. Manual Redirect & Fetch Security
  console.log('--- 4. Fetcher & Redirect Chain Enforcement ---');
  const fetchLocal = await safeFetchWithRedirects('http://127.0.0.1:8080/admin');
  assert(!fetchLocal.ok && fetchLocal.error?.includes('Blocked'), 'Fetch blocks 127.0.0.1');

  const fetchMeta = await safeFetchWithRedirects('http://169.254.169.254/latest/meta-data/');
  assert(!fetchMeta.ok && fetchMeta.error?.includes('Blocked'), 'Fetch blocks metadata endpoint');

  const fetchPublic = await safeFetchWithRedirects('https://example.com', { timeoutMs: 5000 });
  assert(fetchPublic.ok && fetchPublic.text.toLowerCase().includes('example domain'), 'Fetch successfully retrieves public site https://example.com');

  const scrapeRes = await deepScrapeWebsiteContacts('https://example.com');
  assert(!scrapeRes.error, 'Deep scraper succeeds on safe public website');
  console.log('');

  console.log('================================================================');
  console.log(`ACCEPTANCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSsrfHardeningTests().catch(err => {
  console.error('Fatal SSRF Test Runner Error:', err);
  process.exit(1);
});
