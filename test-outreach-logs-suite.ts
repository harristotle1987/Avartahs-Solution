import assert from 'assert';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@avartah.com';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Colony082987@';

interface HttpResult {
  status: number;
  headers: Headers;
  json: any;
  rawText: string;
}

class CookieJar {
  private cookies = new Map<string, string>();

  ingest(headers: Headers) {
    const getSetCookie = (headers as any).getSetCookie;
    const setCookies: string[] = typeof getSetCookie === 'function'
      ? getSetCookie.call(headers)
      : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : []);

    for (const raw of setCookies) {
      const firstPart = raw.split(';')[0];
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx > 0) {
        const name = firstPart.slice(0, eqIdx).trim();
        const val = firstPart.slice(eqIdx + 1).trim();
        this.cookies.set(name, val);
      }
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
}

async function apiCall(
  path: string,
  options: { method?: string; body?: any; jar?: CookieJar; csrfToken?: string } = {}
): Promise<HttpResult> {
  const method = options.method || 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.jar) {
    const cookieStr = options.jar.header();
    if (cookieStr) headers['Cookie'] = cookieStr;
  }
  if (options.csrfToken) {
    headers['x-csrf-token'] = options.csrfToken;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (options.jar) {
    options.jar.ingest(res.headers);
  }

  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, json, rawText };
}

async function runLiveOutreachLogsSuite() {
  console.log('====================================================================');
  console.log('  AVARTAH SOLUTIONS — LIVE NEON CRM OUTREACH DELIVERY LOG SUITE     ');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;
  function check(desc: string, cond: boolean, detail?: string) {
    if (cond) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const jar = new CookieJar();
  let csrfToken = '';
  let createdProspectId: string | null = null;
  let createdLeadId: string | null = null;
  const createdLogIds: string[] = [];

  try {
    // 1. Verify DB readiness
    const readyRes = await apiCall('/api/ready');
    check(
      'Server /api/ready reports live Neon database connected',
      readyRes.status === 200 && readyRes.json?.database === 'connected',
      `status=${readyRes.status} body=${readyRes.rawText}`
    );

    // 2. Verify unauthenticated access is rejected
    const unauthLogs = await apiCall('/api/crm/outreach-logs');
    check('Unauthenticated GET /api/crm/outreach-logs returns 401', unauthLogs.status === 401);

    // 3. Authenticate as Admin
    const loginRes = await apiCall('/api/auth/login', {
      method: 'POST',
      jar,
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    });
    csrfToken = loginRes.json?.csrfToken || jar.get('XSRF-TOKEN') || '';
    check(
      'Admin login succeeds and acquires session + CSRF token',
      loginRes.status === 200 && Boolean(csrfToken),
      `status=${loginRes.status}`
    );

    // 4. Add a temporary test prospect to CRM explicitly
    const uniqueSuffix = Date.now();
    const testEmail = `outreach.verify.${uniqueSuffix}@apexdentalclinic.co.uk`;
    const testPhone = `+447911${String(uniqueSuffix).slice(-6)}`;
    const addRes = await apiCall('/api/prospects/crm/add', {
      method: 'POST',
      jar,
      csrfToken,
      body: {
        requested_service: 'Website Modernization',
        priority: 'High',
        notes: 'Live outreach delivery log verification record',
        prospects: [
          {
            id: `temp_outreach_${uniqueSuffix}`,
            business_name: `Apex Outreach Verify ${uniqueSuffix}`,
            location: 'Manchester, UK',
            country: 'UK',
            email: testEmail,
            phone: testPhone,
            status: 'NO_WEBSITE',
            website_quality_category: 'No website found',
            website_quality_score: 20,
            verification_status: 'SOURCE_CONFIRMED'
          }
        ]
      }
    });

    createdProspectId = addRes.json?.results?.[0]?.prospect_id || null;
    createdLeadId = addRes.json?.results?.[0]?.lead_id || null;
    check(
      'Explicit Add to CRM creates persistent prospect + CRM lead in Neon',
      addRes.status === 200 && Boolean(createdProspectId) && Boolean(createdLeadId),
      `status=${addRes.status} body=${addRes.rawText}`
    );

    assert(createdProspectId && createdLeadId, 'Missing created IDs');

    // 5. Generate AI / Grounded pitch for the CRM lead
    const pitchRes = await apiCall(`/api/crm/leads/${encodeURIComponent(createdLeadId)}/outreach`, {
      method: 'POST',
      jar,
      csrfToken,
      body: { action: 'generate_pitch' }
    });
    check(
      'POST /api/crm/leads/:leadId/outreach generate_pitch returns email & whatsapp drafts',
      pitchRes.status === 200 &&
        Boolean(pitchRes.json?.email?.subject) &&
        Boolean(pitchRes.json?.email?.body) &&
        Boolean(pitchRes.json?.whatsappMessage),
      `status=${pitchRes.status}`
    );

    // 6. Log WhatsApp outreach via /api/prospects/:id/outreach-log
    const waLogRes = await apiCall(`/api/prospects/${encodeURIComponent(createdProspectId)}/outreach-log`, {
      method: 'POST',
      jar,
      csrfToken,
      body: {
        channel: 'whatsapp',
        recipient: testPhone,
        message: pitchRes.json.whatsappMessage,
        delivery_status: 'DRAFT_OPENED',
        provider: 'whatsapp_web',
        ai_generated: true,
        crm_lead_id: createdLeadId,
        business_name: `Apex Outreach Verify ${uniqueSuffix}`
      }
    });
    const waLogId = waLogRes.json?.id;
    if (waLogId) createdLogIds.push(waLogId);
    check(
      'POST /api/prospects/:id/outreach-log persists WhatsApp DRAFT_OPENED log',
      waLogRes.status === 200 && waLogRes.json?.logged === true && waLogRes.json?.delivery_status === 'DRAFT_OPENED' && Boolean(waLogId),
      `status=${waLogRes.status} body=${waLogRes.rawText}`
    );

    // 7. Log Email outreach via /api/prospects/send
    const sendLogRes = await apiCall('/api/prospects/send', {
      method: 'POST',
      jar,
      csrfToken,
      body: {
        id: createdProspectId,
        channel: 'email',
        recipient: testEmail,
        subject: pitchRes.json.email.subject,
        draft: pitchRes.json.email.body,
        ai_generated: true
      }
    });
    const sendLogId = sendLogRes.json?.id;
    if (sendLogId) createdLogIds.push(sendLogId);
    check(
      'POST /api/prospects/send also persists crm_outreach_history Email DRAFT_OPENED row',
      sendLogRes.status === 200 && sendLogRes.json?.delivery_status === 'DRAFT_OPENED' && Boolean(sendLogId),
      `status=${sendLogRes.status} body=${sendLogRes.rawText}`
    );

    // 8. Log Email outreach directly via /api/crm/leads/:leadId/outreach
    const directLeadLogRes = await apiCall(`/api/crm/leads/${encodeURIComponent(createdLeadId)}/outreach`, {
      method: 'POST',
      jar,
      csrfToken,
      body: {
        channel: 'email',
        recipient: testEmail,
        subject: pitchRes.json.email.subject,
        message: pitchRes.json.email.body,
        delivery_status: 'SENT',
        ai_generated: true
      }
    });
    const directLogId = directLeadLogRes.json?.log?.id;
    if (directLogId) createdLogIds.push(directLogId);
    check(
      'POST /api/crm/leads/:leadId/outreach persists direct CRM lead Email SENT log',
      directLeadLogRes.status === 200 && directLeadLogRes.json?.delivery_status === 'SENT' && Boolean(directLogId),
      `status=${directLeadLogRes.status} body=${directLeadLogRes.rawText}`
    );

    // 9. Query GET /api/crm/outreach-logs filtered by lead_id
    const fetchAllRes = await apiCall(`/api/crm/outreach-logs?lead_id=${encodeURIComponent(createdLeadId)}`, { jar });
    check(
      'GET /api/crm/outreach-logs returns all 3 persisted entries for lead with summary counts',
      fetchAllRes.status === 200 &&
        Array.isArray(fetchAllRes.json?.logs) &&
        fetchAllRes.json.logs.length === 3 &&
        fetchAllRes.json.summary?.email_count === 2 &&
        fetchAllRes.json.summary?.whatsapp_count === 1 &&
        fetchAllRes.json.summary?.sent_count === 1 &&
        fetchAllRes.json.summary?.draft_opened_count === 2,
      `status=${fetchAllRes.status} count=${fetchAllRes.json?.logs?.length} summary=${JSON.stringify(fetchAllRes.json?.summary)}`
    );

    // 10. Filter by channel=whatsapp
    const waFilterRes = await apiCall(
      `/api/crm/outreach-logs?lead_id=${encodeURIComponent(createdLeadId)}&channel=whatsapp`,
      { jar }
    );
    check(
      'GET /api/crm/outreach-logs filters cleanly by channel=whatsapp',
      waFilterRes.status === 200 && waFilterRes.json.logs?.length === 1 && waFilterRes.json.logs[0].channel === 'whatsapp'
    );

    // 11. Update delivery status via PATCH /api/crm/outreach-logs/:logId
    const patchRes = await apiCall(`/api/crm/outreach-logs/${encodeURIComponent(waLogId)}`, {
      method: 'PATCH',
      jar,
      csrfToken,
      body: { delivery_status: 'REPLIED', error_message: 'Prospect replied on WhatsApp confirming call' }
    });
    check(
      'PATCH /api/crm/outreach-logs/:logId updates delivery_status to REPLIED in Neon',
      patchRes.status === 200 && patchRes.json?.log?.delivery_status === 'REPLIED',
      `status=${patchRes.status} body=${patchRes.rawText}`
    );

    // 12. Verify invalid delivery_status is rejected with 400
    const badPatchRes = await apiCall(`/api/crm/outreach-logs/${encodeURIComponent(waLogId)}`, {
      method: 'PATCH',
      jar,
      csrfToken,
      body: { delivery_status: 'INVALID_STATE' }
    });
    check('PATCH /api/crm/outreach-logs/:logId rejects invalid status with 400', badPatchRes.status === 400);

    // 13. Re-fetch to verify persistence of updated status
    const verifyUpdatedRes = await apiCall(
      `/api/crm/outreach-logs?lead_id=${encodeURIComponent(createdLeadId)}&delivery_status=REPLIED`,
      { jar }
    );
    check(
      'GET /api/crm/outreach-logs?delivery_status=REPLIED confirms persisted REPLIED status',
      verifyUpdatedRes.status === 200 && verifyUpdatedRes.json.logs?.length === 1 && verifyUpdatedRes.json.logs[0].id === waLogId
    );
  } finally {
    for (const logId of createdLogIds) {
      await apiCall(`/api/crm/outreach-logs/${encodeURIComponent(logId)}`, { method: 'DELETE', jar, csrfToken }).catch(() => {});
    }
    if (createdLeadId) {
      await apiCall(`/api/leads/${encodeURIComponent(createdLeadId)}`, { method: 'DELETE', jar, csrfToken }).catch(() => {});
    }
    if (createdProspectId) {
      await apiCall(`/api/prospects/${encodeURIComponent(createdProspectId)}`, { method: 'DELETE', jar, csrfToken }).catch(() => {});
    }
  }

  console.log('\n====================================================================');
  console.log(`  LIVE OUTREACH LOG SUITE SUMMARY: ${passed} PASS / ${failed} FAIL`);
  console.log('====================================================================');
  if (failed > 0) process.exit(1);
}

runLiveOutreachLogsSuite().catch((err) => {
  console.error('Unhandled error in live outreach suite:', err);
  process.exit(1);
});
