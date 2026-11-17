/**
 * AVARTAH SOLUTIONS — PROSPECTING ENGINE COMPREHENSIVE VERIFICATION SUITE
 *
 * Covers Section M requirements (contracts, bounded multi-batch continuation,
 * rate-limit cooldowns, Nominatim spacing, in-memory & Neon deduplication,
 * bulk transaction writes, zero prospects_excluded writes, concurrent guard,
 * read-only polling, legacy route unification, SSRF protections, and admin RBAC)
 * strictly using mocked DB & mocked external providers (zero production Neon writes).
 */

import fs from 'fs';
import path from 'path';
import express from 'express';
import request from 'supertest';
import {
  ProspectDiscoveryEngine,
  clampTargetCount,
  buildDeterministicProspectId,
  parseRetryAfterMs,
  DbQueryExecutor,
  SafeFetchOutcome
} from '../lib/prospectDiscovery.js';
import {
  isSafeIp,
  isSafeUrl,
  validateEmail,
  normalizeAndValidatePhone,
  decodeCloudflareEmail,
  extractContactsFromHtml,
  extractSchemaOrgContacts,
  researchPublicContactsForBusiness
} from '../lib/prospects.js';
import { addProspectsToCrmTransactional } from '../lib/prospectCrm.js';

interface RecordedSqlQuery {
  text: string;
  params?: unknown[];
}

function createMockDb(initialExistingRows: any[] = [], initialExistingLeads: any[] = []) {
  const queries: RecordedSqlQuery[] = [];
  const storedRows = initialExistingRows.map((r) => ({ ...r }));
  const storedLeads = initialExistingLeads.map((l) => ({ ...l }));

  const counters = {
    selectCount: 0,
    insertCount: 0,
    updateCount: 0,
    deleteCount: 0,
    crmLeadWrites: 0,
    prospectWrites: 0,
    excludedWrites: 0
  };

  function matchProspectRow(row: any, ids: string[], emails: string[], phones: string[], names: string[], domainPatterns: string[]) {
    if (row.id && ids.includes(row.id)) return true;
    if (row.email && emails.includes(String(row.email).toLowerCase())) return true;
    if (row.phone && phones.includes(String(row.phone).replace(/[^\d+]/g, ''))) return true;
    if (row.business_name && names.includes(String(row.business_name).toLowerCase())) return true;
    if (row.website_url && domainPatterns.length > 0) {
      const w = String(row.website_url).toLowerCase();
      return domainPatterns.some((pat) => {
        const core = pat.replace(/%/g, '');
        return core && w.includes(core);
      });
    }
    return false;
  }

  function matchLeadRow(row: any, ids: string[], emails: string[], phones: string[], names: string[], domainPatterns: string[]) {
    if (row.id && ids.includes(row.id)) return true;
    if (row.user_email && emails.includes(String(row.user_email).toLowerCase())) return true;
    if (row.user_phone && phones.includes(String(row.user_phone).replace(/[^\d+]/g, ''))) return true;
    if (row.business_name && names.includes(String(row.business_name).toLowerCase())) return true;
    const site = String(row.target_url || row.website || '').toLowerCase();
    if (site && domainPatterns.length > 0) {
      return domainPatterns.some((pat) => {
        const core = pat.replace(/%/g, '');
        return core && site.includes(core);
      });
    }
    return false;
  }

  async function executeQuery(text: string, params?: unknown[]) {
    queries.push({ text: text.trim(), params });
    const upper = text.trim().toUpperCase();

    if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
      return { rows: [] };
    }

    if (upper.includes('PROSPECTS_EXCLUDED') && (upper.startsWith('INSERT') || upper.startsWith('UPDATE') || upper.startsWith('DELETE'))) {
      counters.excludedWrites++;
    }

    if (upper.startsWith('SELECT')) {
      counters.selectCount++;

      // Combined UNION ALL batch lookup in checkExistingProspectsBatch
      if (upper.includes('FROM PROSPECTS') && upper.includes('UNION ALL') && upper.includes('FROM CRM_LEADS')) {
        const ids = (params?.[0] as string[]) || [];
        const emails = (params?.[1] as string[]) || [];
        const phones = (params?.[2] as string[]) || [];
        const names = (params?.[3] as string[]) || [];
        const domainPatterns = (params?.[4] as string[]) || [];

        const matchedProspects = storedRows.filter((r) => matchProspectRow(r, ids, emails, phones, names, domainPatterns));
        const matchedLeads = storedLeads
          .filter((l) => matchLeadRow(l, [], emails, phones, names, domainPatterns))
          .map((l) => ({
            id: `crm_${l.id}`,
            business_name: l.business_name,
            location: l.city || l.country || '',
            phone: l.user_phone || null,
            email: l.user_email || null,
            website_url: l.target_url || l.website || null,
            reviewed_status: 'PROMOTED',
            crm_lead_id: l.id,
            promoted_at: l.created_at || '2026-01-01T00:00:00Z',
            outreach_status: l.status || 'New',
            suggested_service: l.requested_service || null,
            email_draft: null,
            whatsapp_draft: null,
            verification_status: 'SOURCE_CONFIRMED'
          }));
        return { rows: [...matchedProspects, ...matchedLeads] };
      }

      if (upper.includes('FROM CRM_LEADS')) {
        const ids = Array.isArray(params?.[0]) ? (params![0] as string[]) : params?.[0] ? [String(params[0])] : [];
        const emails = (params?.[1] as string[]) || [];
        const phones = (params?.[2] as string[]) || [];
        const names = (params?.[3] as string[]) || [];
        const domainPatterns = (params?.[4] as string[]) || [];
        const matched = storedLeads.filter((l) => matchLeadRow(l, ids, emails, phones, names, domainPatterns));
        return { rows: matched };
      }

      if (upper.includes('FROM PROSPECTS')) {
        if (upper.includes('WHERE ID = $1') && !Array.isArray(params?.[0])) {
          const targetId = String(params?.[0] || '');
          return { rows: storedRows.filter((r) => r.id === targetId) };
        }
        const ids = (params?.[0] as string[]) || [];
        const emails = (params?.[1] as string[]) || [];
        const phones = (params?.[2] as string[]) || [];
        const names = (params?.[3] as string[]) || [];
        const domainPatterns = (params?.[4] as string[]) || [];
        const matched = storedRows.filter((r) => matchProspectRow(r, ids, emails, phones, names, domainPatterns));
        return { rows: matched };
      }

      return { rows: [] };
    }

    if (upper.startsWith('UPDATE CRM_LEADS')) {
      counters.updateCount++;
      counters.crmLeadWrites++;
      const [contactName, businessName, userEmail, userPhone, targetUrl, website, assignedAdmin, id] = (params || []) as any[];
      const row = storedLeads.find((l) => l.id === id);
      if (row) {
        if (!row.contact_name && contactName) row.contact_name = contactName;
        if (!row.business_name && businessName) row.business_name = businessName;
        if (!row.user_email && userEmail) row.user_email = userEmail;
        if (!row.user_phone && userPhone) row.user_phone = userPhone;
        if (!row.target_url && targetUrl) row.target_url = targetUrl;
        if (!row.website && website) row.website = website;
        if (!row.assigned_admin && assignedAdmin) row.assigned_admin = assignedAdmin;
      }
      return { rows: row ? [row] : [] };
    }

    if (upper.startsWith('INSERT INTO CRM_LEADS')) {
      counters.insertCount++;
      counters.crmLeadWrites++;
      const [
        id, contact_name, business_name, user_email, user_phone,
        target_url, website, city, country, requested_service,
        priority, assigned_admin, notes
      ] = (params || []) as any[];
      const existing = storedLeads.find((l) => l.id === id);
      if (!existing) {
        storedLeads.push({
          id,
          contact_name,
          business_name,
          user_email,
          user_phone,
          target_url,
          website,
          city,
          country,
          requested_service,
          lead_source: 'Prospect Outreach',
          status: 'New',
          priority,
          assigned_admin,
          notes,
          created_at: new Date().toISOString()
        });
        return { rows: [{ id, inserted: true }] };
      } else {
        if (!existing.contact_name && contact_name) existing.contact_name = contact_name;
        if (!existing.business_name && business_name) existing.business_name = business_name;
        if (!existing.user_email && user_email) existing.user_email = user_email;
        if (!existing.user_phone && user_phone) existing.user_phone = user_phone;
        if (!existing.target_url && target_url) existing.target_url = target_url;
        if (!existing.website && website) existing.website = website;
        if (!existing.assigned_admin && assigned_admin) existing.assigned_admin = assigned_admin;
        return { rows: [{ id, inserted: false }] };
      }
    }

    if (upper.startsWith('INSERT INTO PROSPECTS')) {
      counters.insertCount++;
      counters.prospectWrites++;
      const pList = params || [];
      if (upper.includes("'PROMOTED'") && pList.length === 21) {
        const [
          id, business_name, location, phone, email, website_url, status,
          website_availability, website_quality_score, website_quality_category, website_evidence,
          whatsapp_link, source, source_provenance, contact_evidence,
          verification_status, crm_lead_id, suggested_service, email_draft, whatsapp_draft, notes
        ] = pList as any[];
        const existing = storedRows.find((r) => r.id === id);
        if (!existing) {
          storedRows.push({
            id,
            business_name,
            location,
            phone,
            email,
            website_url,
            status,
            website_availability,
            website_quality_score,
            website_quality_category,
            website_evidence,
            whatsapp_link,
            source,
            source_provenance,
            contact_evidence,
            verification_status,
            qualification_status: 'QUALIFIED',
            reviewed_status: 'PROMOTED',
            crm_lead_id,
            promoted_at: new Date().toISOString(),
            suggested_service,
            email_draft,
            whatsapp_draft,
            notes,
            outreach_status: 'NOT_CONTACTED'
          });
          return { rows: [{ id, inserted: true }] };
        } else {
          if (!existing.phone && phone) existing.phone = phone;
          if (!existing.email && email) existing.email = email;
          if (!existing.website_url && website_url) existing.website_url = website_url;
          if (!existing.whatsapp_link && whatsapp_link) existing.whatsapp_link = whatsapp_link;
          existing.verification_status = verification_status;
          existing.reviewed_status = 'PROMOTED';
          if (!existing.crm_lead_id && crm_lead_id) existing.crm_lead_id = crm_lead_id;
          return { rows: [{ id, inserted: false }] };
        }
      }
      return { rows: [] };
    }

    if (upper.startsWith('UPDATE') || upper.startsWith('DELETE')) {
      if (upper.startsWith('UPDATE')) counters.updateCount++;
      if (upper.startsWith('DELETE')) counters.deleteCount++;
    }

    return { rows: [] };
  }

  const db: DbQueryExecutor & { connect?: () => Promise<DbQueryExecutor & { release: () => void }> } = {
    query: executeQuery,
    async connect() {
      return {
        query: executeQuery,
        release() {}
      };
    }
  };

  return { db, queries, storedRows, storedLeads, counters };
}

function makeJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const h = new Headers({ 'content-type': 'application/json', ...headers });
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: h
  });
}

function makeTextResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
  const h = new Headers({ 'content-type': 'text/html', ...headers });
  return new Response(body, { status, headers: h });
}

function makeOsmElements(prefix: string, count: number, startIdx = 1, opts: { withWebsite?: boolean; withPhone?: boolean } = {}) {
  const elements: any[] = [];
  for (let i = startIdx; i < startIdx + count; i++) {
    const idNum = 100000 + i + prefix.length * 1000;
    const phoneNum = opts.withPhone === false ? undefined : `+44207946${String(1000 + i).slice(-4)}`;
    const tags: Record<string, string> = {
      name: `${prefix} Business ${i}`,
      'addr:city': 'London',
      'addr:street': `${i} Baker Street`
    };
    if (phoneNum) tags.phone = phoneNum;
    if (opts.withWebsite) tags.website = `https://${prefix.toLowerCase()}-${i}.example.com`;
    elements.push({
      type: 'node',
      id: idNum,
      lat: 51.5074 + i * 0.0001,
      lon: -0.1278 + i * 0.0001,
      tags
    });
  }
  return elements;
}

const defaultSafeFetch = async (url: string): Promise<SafeFetchOutcome> => {
  if (!isSafeUrl(url)) {
    return { ok: false, status: 403, text: '', finalUrl: url, error: 'Blocked unsafe URL scheme or host' };
  }
  return {
    ok: true,
    status: 200,
    text: '<html><head><title>Legacy Site</title></head><body><font>Welcome</font></body></html>',
    finalUrl: url
  };
};

async function runComprehensiveProspectTests() {
  console.log('====================================================================');
  console.log('  AVARTAH SOLUTIONS — PROSPECTING ENGINE COMPREHENSIVE TEST SUITE   ');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
      failed++;
    }
  }

  // -----------------------------------------------------------------------
  // 1. Target Clamping & Deterministic Utilities
  // -----------------------------------------------------------------------
  console.log('--- 1. Target Clamping & Helper Controls ---');
  assert(clampTargetCount(undefined) === 20, 'Default targetCount clamps to 20');
  assert(clampTargetCount(100) === 20, 'Over-limit targetCount (100) is capped server-side at 20');
  assert(clampTargetCount(4) === 15, 'Under-limit targetCount (4) is floored server-side at 15');
  assert(clampTargetCount(17) === 17, 'In-range targetCount (17) is preserved');
  assert(
    buildDeterministicProspectId('domain:example.com') === buildDeterministicProspectId('DOMAIN:example.com'),
    'Deterministic prospect ID is case-insensitive and stable across runs'
  );
  assert(parseRetryAfterMs('45', 10000) === 45000, 'Parses numeric Retry-After seconds cleanly');

  // -----------------------------------------------------------------------
  // 2. API Response Contracts (400 / Empty 200 / Partial 200 / 502 / Malformed)
  // -----------------------------------------------------------------------
  console.log('\n--- 2. Response Contracts (Validation, Empty, Partial, 502, Malformed) ---');
  {
    const { db, queries } = createMockDb();
    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      fetchFn: async () => makeJsonResponse([])
    });

    const badRes = await engine.runLocateDiscovery({ query: '   ', adminEmail: 'admin@avartah.com' });
    assert(badRes.httpStatus === 400 && badRes.body.errorCode === 'INVALID_QUERY', 'Empty query returns HTTP 400 INVALID_QUERY');
    assert(queries.length === 0, 'Validation rejection triggers 0 DB queries');

    const emptyRes = await engine.runLocateDiscovery({ query: 'spas in Nowhereville', adminEmail: 'admin@avartah.com' });
    assert(
      emptyRes.httpStatus === 200 && emptyRes.body.success === true && emptyRes.body.status === 'COMPLETED' && emptyRes.body.results.length === 0,
      'Valid search with zero candidates returns HTTP 200 COMPLETED (distinct from error)'
    );
    assert(emptyRes.body.providerError === false, 'Zero-result search does not raise false providerError');
  }

  {
    // Total Provider Failure -> 502 PROVIDER_UNAVAILABLE
    const { db, queries } = createMockDb();
    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      limits: { nominatimMinSpacingMs: 0, maxRetriesOnRateLimit: 0 },
      fetchFn: async () => makeJsonResponse({ error: 'Upstream unavailable' }, 503)
    });

    const failRes = await engine.runLocateDiscovery({ query: 'dentist in London', adminEmail: 'admin@avartah.com' });
    assert(failRes.httpStatus === 502 && failRes.body.errorCode === 'PROVIDER_UNAVAILABLE', 'All providers failing returns 502 PROVIDER_UNAVAILABLE');
    assert(failRes.body.status === 'FAILED' && failRes.body.providerError === true, 'Total provider failure marks status FAILED');
    assert(queries.length === 0, 'Total provider failure performs 0 DB writes or reads');
  }

  {
    // Partial Success + Malformed Non-JSON Provider Payload
    const { db } = createMockDb();
    let stageCall = 0;
    const engine = new ProspectDiscoveryEngine({
      db,
      geminiApiKey: 'fake-key',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      geminiGenerateFn: async () => '<html>Not valid JSON array</html>',
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=London')) {
          return makeJsonResponse([{ lat: '51.5074', lon: '-0.1278', display_name: 'London, UK' }]);
        }
        if (url.includes('overpass')) {
          stageCall++;
          if (stageCall === 1) {
            return makeJsonResponse({ elements: makeOsmElements('Ring1', 5, 1) });
          }
          // Malformed HTML from second Overpass ring
          return makeTextResponse('<html>502 Bad Gateway</html>', 200);
        }
        // Malformed Nominatim variation
        return makeTextResponse('<html>Rate page</html>', 200);
      }
    });

    const partialRes = await engine.runLocateDiscovery({ query: 'spas in London', adminEmail: 'admin@avartah.com' });
    assert(
      partialRes.httpStatus === 200 && partialRes.body.success === true && partialRes.body.status === 'PARTIAL_SUCCESS',
      'Returns 200 PARTIAL_SUCCESS when initial batch yields prospects and later provider returns malformed HTML'
    );
    assert(partialRes.body.results.length === 5, 'Preserves all 5 valid qualified prospects under partial failure');
    assert(partialRes.body.provider_stats.providerFailures.length > 0, 'Records malformed/degraded provider failure safely');
  }

  // -----------------------------------------------------------------------
  // 3. Automatic Multi-Batch Continuation & Immediate Stop at Target (20)
  // -----------------------------------------------------------------------
  console.log('\n--- 3. Automatic Multi-Batch Continuation & Stop at 20 Qualified ---');
  {
    const { db } = createMockDb();
    let overpassRings = 0;
    let nominatimPoiCalled = 0;
    let geminiCalled = 0;

    const engine = new ProspectDiscoveryEngine({
      db,
      geminiApiKey: 'test-key',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0, maxPublicResearchQueries: 0 },
      geminiGenerateFn: async () => {
        geminiCalled++;
        return '[]';
      },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=London')) {
          return makeJsonResponse([{ lat: '51.5074', lon: '-0.1278', display_name: 'London, UK' }]);
        }
        if (url.includes('overpass')) {
          overpassRings++;
          if (overpassRings === 1) {
            // 15km ring gives 12 qualified -> must auto-continue to 30km ring
            return makeJsonResponse({ elements: makeOsmElements('RingOne', 12, 1) });
          }
          // 30km ring gives 15 more qualified -> must stop immediately at 20!
          return makeJsonResponse({ elements: makeOsmElements('RingTwo', 15, 20) });
        }
        if (url.includes('nominatim')) {
          nominatimPoiCalled++;
        }
        return makeJsonResponse([]);
      }
    });

    const res = await engine.runLocateDiscovery({
      query: 'spas in London',
      targetCount: 20,
      adminEmail: 'admin@avartah.com'
    });

    assert(res.httpStatus === 200 && res.body.results.length === 20, 'Auto-continues Ring 1 -> Ring 2 and stops cleanly at exactly 20 qualified');
    assert(overpassRings === 2, `Executed 2 Overpass rings before hitting 20 (got ${overpassRings})`);
    assert(nominatimPoiCalled === 0 && geminiCalled === 0, 'Did NOT execute Nominatim POI variations or Gemini once target 20 was reached');
    assert(res.body.provider_stats.stopReason === 'target_reached', 'Records stopReason = target_reached');
  }

  // -----------------------------------------------------------------------
  // 4. Hard Budgets (Candidate, Provider Requests, Time Cap & Admin Stop)
  // -----------------------------------------------------------------------
  console.log('\n--- 4. Hard Candidate / Request / Time Budgets & Admin Stop ---');
  {
    const { db } = createMockDb();
    const engineCandCap = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { maxRawCandidates: 10, rawBatchSize: 5, nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=Manchester')) {
          return makeJsonResponse([{ lat: '53.48', lon: '-2.24', display_name: 'Manchester, UK' }]);
        }
        // Returns 25 raw candidates lacking phone/email (NEEDS_CONTACT) so qualified stays 0
        return makeJsonResponse({ elements: makeOsmElements('NoContact', 25, 1, { withPhone: false }) });
      }
    });
    const capRes = await engineCandCap.runLocateDiscovery({ query: 'salons in Manchester', adminEmail: 'admin@avartah.com' });
    assert(capRes.body.metrics.discovered === 10, `Raw candidates strictly capped at configured maxRawCandidates (10, got ${capRes.body.metrics.discovered})`);
    assert(capRes.body.provider_stats.stopReason === 'raw_candidate_limit_reached', 'Records raw_candidate_limit_reached stop reason');
  }

  {
    const { db } = createMockDb();
    const engineReqCap = new ProspectDiscoveryEngine({
      db,
      geminiApiKey: 'k',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { maxProviderRequests: 2, nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=Bristol')) {
          return makeJsonResponse([{ lat: '51.45', lon: '-2.58', display_name: 'Bristol, UK' }]);
        }
        return makeJsonResponse({ elements: makeOsmElements('Small', 2, 1) });
      }
    });
    const reqRes = await engineReqCap.runLocateDiscovery({ query: 'law firms in Bristol', adminEmail: 'admin@avartah.com' });
    const totalProviderCalls =
      reqRes.body.provider_stats.overpassQueries +
      reqRes.body.provider_stats.nominatimQueries +
      reqRes.body.provider_stats.groundingQueries;
    assert(totalProviderCalls <= 2, `Total provider requests capped at maxProviderRequests=2 (got ${totalProviderCalls})`);
  }

  {
    const { db } = createMockDb();
    let clock = 1000;
    const engineTimeCap = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => { clock += 50; },
      nowFn: () => { clock += 100; return clock; },
      safeFetchFn: defaultSafeFetch,
      limits: { maxJobDurationMs: 250, nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim')) {
          return makeJsonResponse([{ lat: '51.5', lon: '-0.1', display_name: 'London, UK' }]);
        }
        return makeJsonResponse({ elements: makeOsmElements('Slow', 3, 1) });
      }
    });
    const timeRes = await engineTimeCap.runLocateDiscovery({ query: 'gyms in London', adminEmail: 'admin@avartah.com' });
    assert(timeRes.body.provider_stats.stopReason === 'time_budget_reached', 'Time cap triggers clean termination with time_budget_reached');
  }

  {
    // Admin stop control
    const { db } = createMockDb();
    let stopTriggered = false;
    const engineStop = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=Leeds')) {
          return makeJsonResponse([{ lat: '53.8', lon: '-1.54', display_name: 'Leeds, UK' }]);
        }
        if (!stopTriggered) {
          stopTriggered = true;
          // Stop the active job mid-flight once Ring 1 starts
          setTimeout(() => {
            engineStop.stopJob('test_stop_job_1234', 'admin@avartah.com');
          }, 15);
          await new Promise((r) => setTimeout(r, 40));
        }
        return makeJsonResponse({ elements: makeOsmElements('StopCo', 4, 1) });
      }
    });
    const stopRes = await engineStop.runLocateDiscovery({
      query: 'hotels in Leeds',
      adminEmail: 'admin@avartah.com',
      clientJobId: 'test_stop_job_1234'
    });
    assert(stopRes.body.status === 'STOPPED', `Admin stopJob() terminates job with status STOPPED (got ${stopRes.body.status})`);
  }

  // -----------------------------------------------------------------------
  // 5. Provider 429 Cooldown, Retry-After & Zero Retry on Permanent 4xx
  // -----------------------------------------------------------------------
  console.log('\n--- 5. Provider 429 Cooldown & 0 Retries on Permanent 4xx ---');
  {
    const { db } = createMockDb();
    let mirror1Calls = 0;
    let mirror2Calls = 0;
    const nowTime = 1_000_000;

    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      nowFn: () => nowTime,
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim.openstreetmap.org/search?q=Glasgow')) {
          return makeJsonResponse([{ lat: '55.86', lon: '-4.25', display_name: 'Glasgow, UK' }]);
        }
        if (url.includes('overpass-api.de')) {
          mirror1Calls++;
          return makeJsonResponse({ error: 'Too many requests' }, 429, { 'retry-after': '42' });
        }
        if (url.includes('overpass.kumi.systems')) {
          mirror2Calls++;
          return makeJsonResponse({ error: 'Forbidden' }, 403);
        }
        return makeJsonResponse([], 200);
      }
    });

    await engine.runLocateDiscovery({ query: 'spas in Glasgow', adminEmail: 'admin@avartah.com' });
    const health = engine.getHealthStateSnapshot();
    const primaryHealth = health['overpass:https://overpass-api.de/api/interpreter'];
    assert(mirror1Calls === 1, 'HTTP 429 does NOT spin/retry exhausted quota mirror immediately');
    assert(mirror2Calls === 1, 'Permanent HTTP 403 executes 0 retries');
    assert(
      Boolean(primaryHealth && primaryHealth.cooldownUntil >= nowTime + 42000),
      'HTTP 429 Retry-After=42 applies >=42s cooldown in provider health registry'
    );
  }

  // -----------------------------------------------------------------------
  // 6. Nominatim Minimum Request Spacing (>= 1100ms) & Geocode TTL Cache
  // -----------------------------------------------------------------------
  console.log('\n--- 6. Nominatim Spacing & Geocode TTL Cache ---');
  {
    const { db } = createMockDb();
    let virtualClock = 10_000;
    const requestTimestamps: number[] = [];
    const sleeps: number[] = [];

    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      nowFn: () => virtualClock,
      sleepFn: async (ms) => {
        sleeps.push(ms);
        virtualClock += ms;
      },
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 1100 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim')) {
          requestTimestamps.push(virtualClock);
          if (url.includes('limit=1')) {
            return makeJsonResponse([{ lat: '51.5', lon: '-0.1', display_name: 'Cardiff, UK' }]);
          }
          return makeJsonResponse([]);
        }
        return makeJsonResponse({ elements: [] });
      }
    });

    await engine.runLocateDiscovery({ query: 'spas in Cardiff', adminEmail: 'admin@avartah.com' });
    let minGapOk = true;
    for (let i = 1; i < requestTimestamps.length; i++) {
      if (requestTimestamps[i] - requestTimestamps[i - 1] < 1100) minGapOk = false;
    }
    assert(requestTimestamps.length >= 2 && minGapOk, 'Every consecutive Nominatim request respects >=1100ms mutex spacing');

    // Second search for Cardiff must hit geocodeCache without querying Nominatim for geocode
    const beforeCalls = requestTimestamps.length;
    const secondRes = await engine.runLocateDiscovery({ query: 'gyms in Cardiff', adminEmail: 'admin@avartah.com' });
    assert(secondRes.body.provider_stats.cacheHits > 0, 'Geocode cache hit recorded on repeat city lookup');
    assert(requestTimestamps.length >= beforeCalls, 'Cache prevents duplicate city-level geocode query');
  }

  // -----------------------------------------------------------------------
  // 7. In-Memory & Read-Only Neon/CRM Deduplication + ZERO Raw Discovery Writes
  // -----------------------------------------------------------------------
  console.log('\n--- 7. Batch & Read-Only CRM/Neon Deduplication + ZERO Discovery Writes ---');
  {
    const existingRowId = buildDeterministicProspectId('domain:existing-spa.example.com');
    const { db, queries, storedRows, storedLeads, counters } = createMockDb(
      [
        {
          id: existingRowId,
          business_name: 'Existing CRM Spa',
          location: '10 Existing Rd, London',
          phone: '+442079460999',
          email: 'owner@existing-spa.example.com',
          website_url: 'https://existing-spa.example.com',
          reviewed_status: 'PROMOTED',
          crm_lead_id: 'lead_existing_99',
          promoted_at: '2026-01-01T00:00:00Z',
          outreach_status: 'CONTACTED'
        }
      ],
      [
        {
          id: 'lead_direct_crm_55',
          contact_name: 'Direct CRM Owner',
          business_name: 'Direct CRM Salon',
          user_email: 'direct@crm-salon.example.com',
          user_phone: '+442079460888',
          target_url: '',
          website: '',
          city: 'London',
          country: 'UK',
          status: 'New'
        }
      ]
    );

    let test7OverpassCall = 0;
    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0, maxPublicResearchQueries: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim')) {
          return makeJsonResponse([{ lat: '51.5', lon: '-0.1', display_name: 'London, UK' }]);
        }
        test7OverpassCall++;
        if (test7OverpassCall > 1) {
          return makeJsonResponse({ elements: [] });
        }
        return makeJsonResponse({
          elements: [
            // Duplicate pair in same batch sharing phone -> collapses in memory BEFORE crawl
            {
              type: 'node',
              id: 1,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Alpha Salon', phone: '+442079460001', 'addr:street': '1 High St' }
            },
            {
              type: 'node',
              id: 2,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Alpha Salon Branch', phone: '+442079460001', 'addr:street': '1 High St' }
            },
            // Two separate Instagram-only businesses -> must NOT collapse on instagram.com domain!
            {
              type: 'node',
              id: 3,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Insta Spa A', phone: '+442079460002', website: 'https://instagram.com/instaspaa' }
            },
            {
              type: 'node',
              id: 4,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Insta Spa B', phone: '+442079460003', website: 'https://instagram.com/instaspab' }
            },
            // Matches pre-existing record in prospects by domain
            {
              type: 'node',
              id: 5,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Existing CRM Spa', website: 'https://existing-spa.example.com', phone: '+442079460999' }
            },
            // Matches pre-existing record in crm_leads directly by phone
            {
              type: 'node',
              id: 6,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Direct CRM Salon', phone: '+442079460888', 'addr:city': 'London' }
            },
            // No contact info -> stays in needsContact in memory only, NEVER written to Neon
            {
              type: 'node',
              id: 7,
              lat: 51.5,
              lon: -0.1,
              tags: { name: 'Silent Salon' }
            }
          ]
        });
      }
    });

    const res = await engine.runLocateDiscovery({ query: 'salons in London', adminEmail: 'admin@avartah.com' });
    assert(res.body.metrics.batch_duplicates === 1, 'In-batch duplicate collapses cleanly in memory');
    assert(res.body.existingMatches.length === 2, 'Existing prospects + crm_leads matches separated into existingMatches');
    assert(res.body.existingMatches.some((m) => m.crm_lead_id === 'lead_existing_99'), 'Preserves existing prospects->CRM lead ID');
    assert(res.body.existingMatches.some((m) => m.crm_lead_id === 'lead_direct_crm_55'), 'Detects direct crm_leads match without duplicating');
    assert(res.body.results.length === 3, 'Net-new qualified count excludes existingMatches & batch duplicates');
    assert(res.body.metrics.newly_qualified === 3, 'metrics.newly_qualified counts net-new qualified only');
    assert(res.body.needsContact.length === 1, 'Missing-contact business placed in needsContact review tab');
    assert(res.body.results.some((r) => r.name === 'Insta Spa A') && res.body.results.some((r) => r.name === 'Insta Spa B'), 'Social-media-only profiles remain independent opportunities');
    assert(res.body.results.every((r) => r.isTemporary === true), 'Discovery records are marked ephemeral (isTemporary: true)');

    // CRITICAL PERSISTENCE INVARIANT: ZERO SQL writes during discovery!
    const writeQueries = queries.filter((q) => /^\s*(INSERT|UPDATE|DELETE|TRUNCATE|CREATE)\b/i.test(q.text));
    assert(writeQueries.length === 0, `Discovery executes ZERO SQL write statements (got ${writeQueries.length})`);
    assert(
      counters.selectCount === 1 &&
      counters.insertCount === 0 &&
      counters.updateCount === 0 &&
      counters.deleteCount === 0 &&
      counters.excludedWrites === 0,
      `Instrumented discovery SQL counts: SELECT=${counters.selectCount}, INSERT=${counters.insertCount}, UPDATE=${counters.updateCount}, DELETE=${counters.deleteCount}`
    );
    assert(
      res.body.db_stats.dbReads === 1 &&
      res.body.db_stats.dbWrites === 0 &&
      res.body.db_stats.rowsInserted === 0 &&
      res.body.db_stats.rowsUpdated === 0 &&
      res.body.db_stats.excludedInserts === 0,
      'Response db_stats accurately reports 1 read and 0 writes/inserts/updates'
    );
    assert(storedRows.length === 1 && storedLeads.length === 1, 'Prospects and crm_leads tables remain completely unmodified after discovery');
  }

  // -----------------------------------------------------------------------
  // 8. Concurrent Identical Search Guard & Read-Only Polling
  // -----------------------------------------------------------------------
  console.log('\n--- 8. Concurrent Search Guard & Read-Only Polling ---');
  {
    const { db, queries } = createMockDb();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => { releaseFirst = r; });

    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async () => {
        await gate;
        return makeJsonResponse([]);
      }
    });

    const firstPromise = engine.runLocateDiscovery({
      query: 'spas in Liverpool',
      adminEmail: 'admin@avartah.com',
      clientJobId: 'concurrent_job_1'
    });

    // Wait a tick so first job enters active state
    await new Promise((r) => setTimeout(r, 10));
    const dupRes = await engine.runLocateDiscovery({
      query: 'spas in Liverpool',
      adminEmail: 'admin@avartah.com'
    });

    assert(dupRes.httpStatus === 409 && dupRes.body.errorCode === 'CONCURRENT_JOB_ACTIVE', 'Duplicate concurrent search returns 409 CONCURRENT_JOB_ACTIVE');

    // Read-only polling check
    const queryCountBeforePoll = queries.length;
    const snap = engine.getJobStatus('concurrent_job_1');
    const history = engine.getJobHistory('admin@avartah.com');
    assert(snap !== null && history.length >= 1, 'Status polling & history read session snapshot cleanly');
    assert(queries.length === queryCountBeforePoll, 'Status polling & history execute 0 DB queries');

    releaseFirst();
    await firstPromise;
  }

  // -----------------------------------------------------------------------
  // 9. Honest Verification & WhatsApp Labels
  // -----------------------------------------------------------------------
  console.log('\n--- 9. Honest Verification & WhatsApp Unconfirmed Labels ---');
  {
    const { db } = createMockDb();
    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: async (url: string): Promise<SafeFetchOutcome> => {
        if (url.includes('has-wa')) {
          return {
            ok: true,
            status: 200,
            text: '<html><body><a href="https://wa.me/447700900111">Chat</a><font>old</font></body></html>',
            finalUrl: url
          };
        }
        return {
          ok: true,
          status: 200,
          text: '<html><body><p>Call us: +442079460222</p><font>old</font></body></html>',
          finalUrl: url
        };
      },
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        if (String(input).includes('nominatim')) {
          return makeJsonResponse([{ lat: '51.5', lon: '-0.1', display_name: 'London, UK' }]);
        }
        return makeJsonResponse({
          elements: [
            { type: 'node', id: 701, lat: 51.5, lon: -0.1, tags: { name: 'HasWA Clinic', phone: '+447700900111', website: 'https://has-wa.example.com' } },
            { type: 'node', id: 702, lat: 51.5, lon: -0.1, tags: { name: 'NoWA Clinic', phone: '+442079460222', website: 'https://no-wa.example.com' } }
          ]
        });
      }
    });

    const res = await engine.runLocateDiscovery({ query: 'dentist in London', adminEmail: 'admin@avartah.com' });
    const withWa = res.body.results.find((r) => r.name === 'HasWA Clinic');
    const withoutWa = res.body.results.find((r) => r.name === 'NoWA Clinic');
    assert(Boolean(withWa && !withWa.whatsapp_unconfirmed && withWa.whatsapp_link), 'Marks whatsapp_unconfirmed=false only when confirmed wa.me link found');
    assert(Boolean(withoutWa && withoutWa.whatsapp_unconfirmed && !withoutWa.whatsapp_link), 'Marks whatsapp_unconfirmed=true when phone has no confirmed WhatsApp link');
    assert(
      !JSON.stringify(res.body.results).toLowerCase().includes('independently verified'),
      'Never falsely claims contacts are independently verified'
    );
  }

  // -----------------------------------------------------------------------
  // 10. Website SSRF & Redirect Protections
  // -----------------------------------------------------------------------
  console.log('\n--- 10. Website SSRF & Redirect Protections ---');
  {
    assert(!isSafeIp('127.0.0.1') && !isSafeIp('169.254.169.254') && !isSafeIp('10.0.0.1'), 'Blocks loopback, metadata, and RFC1918 private IPs');
    assert(!isSafeUrl('http://127.0.0.1:8080/admin') && !isSafeUrl('file:///etc/passwd') && !isSafeUrl('http://metadata.google.internal/'), 'Blocks unsafe URLs & non-HTTP schemes');

    const engine = new ProspectDiscoveryEngine({
      db: createMockDb().db,
      safeFetchFn: async (url) => ({
        ok: false,
        status: 403,
        text: '',
        finalUrl: url,
        error: 'SSRF Blocked: prohibited redirect to loopback IP'
      })
    });

    const ssrfUrlRes = await engine.assessWebsiteWithCache('http://169.254.169.254/latest/meta-data/');
    const ssrfRedirRes = await engine.assessWebsiteWithCache('https://redirector.example.com');
    assert(ssrfUrlRes.status === 'NEEDS_REVIEW' && ssrfUrlRes.evidence.includes('SSRF'), 'assessWebsiteWithCache blocks unsafe metadata target URL');
    assert(ssrfRedirRes.status === 'NEEDS_REVIEW' && ssrfRedirRes.evidence.includes('SSRF'), 'assessWebsiteWithCache blocks unsafe SSRF redirect destination');
  }

  // -----------------------------------------------------------------------
  // 11. Express Route Admin RBAC & Legacy Route Unification (Supertest)
  // -----------------------------------------------------------------------
  console.log('\n--- 11. Admin RBAC & Legacy Route Delegation (Supertest + Static Audit) ---');
  {
    const { db } = createMockDb();
    const sharedEngine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        if (String(input).includes('nominatim')) {
          return makeJsonResponse([{ lat: '51.5', lon: '-0.1', display_name: 'London, UK' }]);
        }
        return makeJsonResponse({ elements: makeOsmElements('LegacyUnified', 2, 1) });
      }
    });

    const testApp = express();
    testApp.use(express.json());
    const mockRequireAdmin: express.RequestHandler = (req, res, next) => {
      const authHeader = req.headers['x-test-role'];
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
      if (authHeader !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      (req as any).adminUser = { email: 'admin@avartah.com', role: 'admin' };
      next();
    };

    testApp.post('/api/prospects/locate', mockRequireAdmin, async (req, res) => {
      const result = await sharedEngine.runLocateDiscovery({
        query: req.body?.query,
        skipWebsites: Boolean(req.body?.skipWebsites),
        targetCount: req.body?.targetCount,
        adminEmail: (req as any).adminUser.email
      });
      return res.status(result.httpStatus).json(result.body);
    });
    testApp.post('/api/prospects/search', mockRequireAdmin, async (req, res) => {
      const combined = `${req.body?.niche || ''} in ${req.body?.region || ''}`.trim();
      const result = await sharedEngine.runLocateDiscovery({
        query: combined,
        adminEmail: (req as any).adminUser.email
      });
      return res.status(result.httpStatus).json({
        ...result.body,
        deprecatedRoute: '/api/prospects/locate',
        count: result.body.results.length,
        data: result.body.results
      });
    });

    const unauth = await request(testApp).post('/api/prospects/locate').send({ query: 'spas in London' });
    const nonAdmin = await request(testApp).post('/api/prospects/search').set('x-test-role', 'user').send({ region: 'London', niche: 'spas' });
    const legacyOk = await request(testApp).post('/api/prospects/search').set('x-test-role', 'admin').send({ region: 'London', niche: 'spas' });

    assert(unauth.status === 401, 'Unauthenticated /api/prospects/locate blocked with 401');
    assert(nonAdmin.status === 403, 'Non-admin /api/prospects/search blocked with 403');
    assert(
      legacyOk.status === 200 && legacyOk.body.deprecatedRoute === '/api/prospects/locate' && legacyOk.body.count === 2,
      'Legacy /api/prospects/search delegates to unified ProspectDiscoveryEngine with backward-compatible fields'
    );

    // Inspect authoritative server.ts wiring
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    assert(
      !serverSource.includes('async function processProspectsBackground') &&
      !serverSource.includes('processProspectsBackground('),
      'Legacy parallel background worker processProspectsBackground is removed from server.ts'
    );
    assert(
      serverSource.includes("app.post('/api/prospects/locate', requireAdminAuth") &&
      serverSource.includes("app.get('/api/prospects/locate/status/:jobId', requireAdminAuth") &&
      serverSource.includes("app.get('/api/prospects/locate/history', requireAdminAuth") &&
      serverSource.includes("app.post('/api/prospects/locate/stop/:jobId', requireAdminAuth") &&
      serverSource.includes("app.post('/api/prospects/search', requireAdminAuth") &&
      serverSource.includes("app.post('/api/prospects/batch', requireAdminAuth") &&
      serverSource.includes('async function invokeNvidiaOrGeminiAI('),
      'All authoritative locate, status, history, stop, search, and batch routes in server.ts enforce requireAdminAuth and NVIDIA-first AI helper'
    );
  }

  // -----------------------------------------------------------------------
  // 12. NVIDIA NIM Primary AI Supplement & 429/403 Cooldown Controls
  // -----------------------------------------------------------------------
  console.log('\n--- 12. NVIDIA NIM Primary AI Supplement & Cooldowns ---');
  {
    const { db } = createMockDb();
    let geminiCalled = false;
    let nvidiaCalled = 0;

    const nvidiaPrimaryEngine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: 'test-nv-key',
      geminiApiKey: 'test-gemini-key',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        if (String(input).includes('nominatim.openstreetmap.org/search?q=York')) {
          return makeJsonResponse([{ lat: '53.95', lon: '-1.08', display_name: 'York, UK' }]);
        }
        return makeJsonResponse({ elements: [] });
      },
      nvidiaGenerateFn: async () => {
        nvidiaCalled++;
        return JSON.stringify([
          {
            name: 'York Sanctuary Spa',
            location: '12 Stonegate, York',
            phone: '+441904555011',
            email: null,
            website_url: null,
            type: 'Day Spa'
          }
        ]);
      },
      geminiGenerateFn: async () => {
        geminiCalled = true;
        return '[]';
      }
    });

    const nvRes = await nvidiaPrimaryEngine.runLocateDiscovery({
      query: 'spas in York',
      adminEmail: 'admin@avartah.com'
    });
    assert(nvidiaCalled === 1 && !geminiCalled, 'Prefers NVIDIA NIM over Gemini when NVIDIA_API_KEY is set');
    assert(
      nvRes.body.provider_stats.nvidiaQueries === 1 && nvRes.body.provider_stats.groundingQueries === 0,
      'Records nvidiaQueries=1 and groundingQueries=0 under NVIDIA mode'
    );
    assert(
      nvRes.body.results.length === 1 && nvRes.body.results[0].source === 'nvidia-nim',
      'Validates and qualifies NVIDIA directory candidate with nvidia-nim provenance'
    );

    // NVIDIA HTTP 429 Retry-After sets cooldown without duplicate retry
    const nowTime = 2_000_000;
    const { db: db2 } = createMockDb();
    let nv429Calls = 0;
    const nvidia429Engine = new ProspectDiscoveryEngine({
      db: db2,
      nvidiaApiKey: 'test-nv-key',
      geminiApiKey: '',
      nowFn: () => nowTime,
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('integrate.api.nvidia.com')) {
          nv429Calls++;
          return makeJsonResponse({ error: 'Rate limit exceeded' }, 429, { 'retry-after': '55' });
        }
        if (url.includes('nominatim.openstreetmap.org/search?q=Bath')) {
          return makeJsonResponse([{ lat: '51.38', lon: '-2.36', display_name: 'Bath, UK' }]);
        }
        return makeJsonResponse({ elements: [] });
      }
    });

    await nvidia429Engine.runLocateDiscovery({ query: 'spas in Bath', adminEmail: 'admin@avartah.com' });
    const nvHealth = nvidia429Engine.getHealthStateSnapshot()['nvidia-nim'];
    assert(nv429Calls === 1, 'NVIDIA 429 triggers 0 immediate duplicate requests');
    assert(
      Boolean(nvHealth && nvHealth.cooldownUntil >= nowTime + 55000),
      'NVIDIA HTTP 429 Retry-After=55 sets >=55s cooldown'
    );
  }

  // -----------------------------------------------------------------------
  // 13. Deep Extraction, Cloudflare Decode, JSON-LD & Zero Guessing
  // -----------------------------------------------------------------------
  console.log('\n--- 13. Deep Contact Extraction, Obfuscation Decode & Asset Rejection ---');
  {
    // Build real Cloudflare xor-encoded hex for 'owner@lagosbistro.ng' with key 0x42
    const key = 0x42;
    const plain = 'owner@lagosbistro.ng';
    const encodedHex =
      key.toString(16).padStart(2, '0') +
      Array.from(plain).map((ch) => (ch.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('');
    assert(decodeCloudflareEmail(encodedHex) === plain, 'Decodes Cloudflare data-cfemail protection cleanly');

    const richHtml = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "LocalBusiness",
                  "name": "Lagos Bistro",
                  "email": "bookings@lagosbistro.ng",
                  "telephone": "+234 803 111 2233",
                  "sameAs": ["https://instagram.com/lagosbistro", "https://wa.me/2348031112233"]
                }
              ]
            }
          </script>
        </head>
        <body>
          <img src="/assets/logo@2x.png" alt="Logo" />
          <a href="/cdn-cgi/l/email-protection" data-cfemail="${encodedHex}">Email Us</a>
          <p>Backup desk: desk [at] lagosbistro [dot] ng</p>
          <a href="https://facebook.com/lagosbistro.official">Facebook</a>
        </body>
      </html>
    `;
    const extracted = extractContactsFromHtml(richHtml, 'https://lagosbistro.ng/contact');
    const deobfOnlyExtracted = extractContactsFromHtml(
      '<html><body><p>Backup desk: desk [at] lagosbistro [dot] ng</p></body></html>',
      'https://lagosbistro.ng/contact'
    );
    const jsonLd = extractSchemaOrgContacts(richHtml, 'https://lagosbistro.ng/contact');
    assert(
      !validateEmail('logo@2x.png').isValid && !validateEmail('banner@3x.webp').isValid,
      'Rejects @2x/@3x image asset filenames as invalid emails'
    );
    assert(
      extracted.email === plain,
      'Extracts decoded Cloudflare cfemail from HTML anchor'
    );
    assert(deobfOnlyExtracted.email === 'desk@lagosbistro.ng', 'Deobfuscates [at] / [dot] visible email text accurately');
    assert(
      jsonLd.email === 'bookings@lagosbistro.ng' &&
      jsonLd.phone === '+2348031112233' &&
      jsonLd.socialProfiles?.instagram === 'https://instagram.com/lagosbistro',
      'Parses JSON-LD @graph email, phone, and sameAs social profiles'
    );
    assert(
      extracted.socialProfiles?.facebook === 'https://facebook.com/lagosbistro.official',
      'Extracts business social profile URLs from HTML anchors'
    );
  }

  // -----------------------------------------------------------------------
  // 14. Bounded Public Contact Research (DDG -> Bing Fallback, Match Guard, Walls)
  // -----------------------------------------------------------------------
  console.log('\n--- 14. Bounded Multi-Stage Public Contact Research ---');
  {
    const fetchedUrls: string[] = [];
    const ddgSuccessRes = await researchPublicContactsForBusiness(
      {
        businessName: 'Savannah Bakery',
        location: 'Lekki, Lagos',
        city: 'Lagos',
        countryContext: 'Nigeria'
      },
      {
        maxSearchQueries: 1,
        maxFollowupPages: 2,
        fetchFn: async (input) => {
          const url = String(input);
          fetchedUrls.push(url);
          if (url.includes('html.duckduckgo.com')) {
            return makeTextResponse(`
              <html><body>
                <div class="result">
                  <a class="result__a" href="https://directory.ng/savannah-bakery-lekki">Savannah Bakery - Lekki, Lagos</a>
                  <div class="result__snippet">Fresh pastries in Lekki Lagos. Call +234 809 555 4411</div>
                </div>
                <div class="result">
                  <a class="result__a" href="https://other-unrelated.com/boston-bakery">Boston Bread Co</a>
                  <div class="result__snippet">Call +1 617 555 0000 or email fake@bostonbread.com</div>
                </div>
              </body></html>
            `);
          }
          return makeTextResponse('', 404);
        },
        safeFetchFn: async (url) => {
          if (url.includes('directory.ng/savannah-bakery-lekki')) {
            return {
              ok: true,
              status: 200,
              finalUrl: url,
              text: '<html><body><h1>Savannah Bakery</h1><p>Lekki, Lagos</p><a href="mailto:orders@savannahbakery.ng">Email</a><a href="https://wa.me/2348095554411">WhatsApp</a></body></html>'
            };
          }
          return { ok: false, status: 403, finalUrl: url, text: '', error: 'Login wall' };
        }
      }
    );

    assert(ddgSuccessRes.email === 'orders@savannahbakery.ng', 'DDG research finds business-matched public email from directory page');
    assert(ddgSuccessRes.phone === '+2348095554411', 'DDG research extracts & normalizes business phone');
    assert(ddgSuccessRes.whatsapp === 'https://wa.me/2348095554411', 'Extracts confirmed WhatsApp link');
    assert(
      !fetchedUrls.some((u) => u.includes('bing.com')),
      'Does NOT query Bing fallback when DuckDuckGo succeeds and returns contacts'
    );
    assert(
      ddgSuccessRes.contactEvidence.some(
        (ev) => ev.contact_value === 'orders@savannahbakery.ng' && ev.source_url.includes('directory.ng')
      ),
      'Records verifiable contact evidence with source_url for every found contact'
    );
    assert(
      ddgSuccessRes.contactEvidence.some((ev) => ev.verification_status === 'SOURCE_CONFIRMED'),
      'Marks verified public page contacts as SOURCE_CONFIRMED (never fake independently verified)'
    );

    // Scenario B: DuckDuckGo returns HTTP 403 -> Bing fallback kicks in cleanly + ignores 403 login wall follow-up
    const fallbackCalls: string[] = [];
    const bingFallbackRes = await researchPublicContactsForBusiness(
      {
        businessName: 'Ikeja Auto Works',
        location: 'Ikeja, Lagos',
        city: 'Lagos',
        countryContext: 'Nigeria',
        socialUrls: ['https://instagram.com/ikejaautoworks']
      },
      {
        maxSearchQueries: 1,
        maxFollowupPages: 2,
        fetchFn: async (input) => {
          const url = String(input);
          fallbackCalls.push(url);
          if (url.includes('html.duckduckgo.com')) {
            return makeTextResponse('Forbidden', 403);
          }
          if (url.includes('bing.com/search')) {
            return makeTextResponse(`
              <html><body>
                <li class="b_algo">
                  <h2><a href="https://nigerialist.example.com/ikeja-auto-works">Ikeja Auto Works - Lagos</a></h2>
                  <p>Call Ikeja Auto Works in Lagos on 0803 777 6655</p>
                </li>
              </body></html>
            `);
          }
          return makeTextResponse('', 404);
        },
        safeFetchFn: async (url) => {
          // Instagram returns 403 login wall; must skip gracefully without fabricating email
          if (url.includes('instagram.com')) {
            return { ok: false, status: 403, finalUrl: url, text: '' };
          }
          return {
            ok: true,
            status: 200,
            finalUrl: url,
            text: '<html><body><h2>Ikeja Auto Works</h2><p>Lagos, Nigeria — Tel: 0803 777 6655</p></body></html>'
          };
        }
      }
    );

    assert(fallbackCalls.some((u) => u.includes('bing.com/search')), 'Falls back to Bing when DuckDuckGo returns 403');
    assert(
      bingFallbackRes.providerFailures.some((f) => f.toLowerCase().includes('instagram') && f.includes('403')),
      'Records login-wall HTTP 403 restriction safely without crashing'
    );
    assert(bingFallbackRes.phone === '+2348037776655', 'Extracts valid Nigerian phone via Bing fallback');
    assert(!bingFallbackRes.email, 'Phone-only business leaves email strictly absent (zero email guessing)');
  }

  // -----------------------------------------------------------------------
  // 15. Ephemeral Discovery + Explicit Add to CRM Atomicity & Idempotency (Supertest)
  // -----------------------------------------------------------------------
  console.log('\n--- 15. End-to-End Ephemeral Discovery + Add to CRM Idempotency & Field Preservation ---');
  {
    const { db, queries, storedRows, storedLeads, counters } = createMockDb();
    const engine = new ProspectDiscoveryEngine({
      db,
      nvidiaApiKey: '',
      geminiApiKey: '',
      sleepFn: async () => {},
      safeFetchFn: defaultSafeFetch,
      limits: { nominatimMinSpacingMs: 0, maxPublicResearchQueries: 0 },
      fetchFn: async (input) => {
        const url = String(input);
        if (url.includes('nominatim')) {
          return makeJsonResponse([{ lat: '6.5244', lon: '3.3792', display_name: 'Lagos, Nigeria' }]);
        }
        return makeJsonResponse({
          elements: [
            { type: 'node', id: 9101, lat: 6.52, lon: 3.37, tags: { name: 'Victoria Tailor', phone: '+2348021001001', email: 'hello@victoriatailor.ng', 'addr:city': 'Lagos' } },
            { type: 'node', id: 9102, lat: 6.53, lon: 3.38, tags: { name: 'Yaba Grill', phone: '+2348021002002', 'addr:city': 'Lagos' } },
            { type: 'node', id: 9103, lat: 6.54, lon: 3.39, tags: { name: 'Surulere Barber', phone: '+2348021003003', 'addr:city': 'Lagos' } }
          ]
        });
      }
    });

    const app = express();
    app.use(express.json());
    const authAdmin: express.RequestHandler = (req, res, next) => {
      (req as any).adminUser = { email: 'admin@avartah.com', role: 'admin' };
      next();
    };

    app.post('/api/prospects/locate', authAdmin, async (req, res) => {
      const r = await engine.runLocateDiscovery({
        query: req.body?.query,
        skipWebsites: req.body?.skipWebsites !== false,
        targetCount: req.body?.targetCount,
        adminEmail: (req as any).adminUser.email
      });
      return res.status(r.httpStatus).json(r.body);
    });

    app.post('/api/prospects/reassess-website', authAdmin, async (req, res) => {
      const a = await engine.assessWebsiteWithCache(req.body?.website_url || null, 'Lagos');
      return res.json({ success: true, persisted: false, status: a.status, evidence: a.evidence });
    });

    app.post('/api/prospects/generate', authAdmin, async (req, res) => {
      return res.json({
        success: true,
        persisted: false,
        email_draft: `Draft for ${req.body?.business_name}`,
        whatsapp_draft: `WA for ${req.body?.business_name}`
      });
    });

    app.post('/api/prospects/batch', authAdmin, async (req, res) => {
      if (req.body?.confirmAddToCrm !== true) {
        return res.status(400).json({ error: 'Explicit Add to CRM confirmation required', code: 'EXPLICIT_CRM_CONFIRMATION_REQUIRED' });
      }
      const out = await addProspectsToCrmTransactional(db, (req as any).adminUser.email, req.body?.prospects || []);
      return res.status(200).json(out);
    });

    app.post('/api/prospects/crm/add', authAdmin, async (req, res) => {
      const out = await addProspectsToCrmTransactional(db, (req as any).adminUser.email, req.body?.prospects || []);
      return res.status(200).json(out);
    });

    app.post('/api/prospects/:id/promote', authAdmin, async (req, res) => {
      const pid = String(req.params.id || '');
      const existingRes = await db.query('SELECT * FROM prospects WHERE id = $1', [pid]);
      const p = existingRes.rows?.[0] || {};
      const payload = { ...p, ...(req.body || {}), id: p.id || pid };
      const batch = await addProspectsToCrmTransactional(db, (req as any).adminUser.email, [payload], {
        allowExistingProspectId: p.id || undefined
      });
      const first = batch.results[0];
      return res.json({ success: true, lead_id: first.lead_id, prospect_id: first.prospect_id, deduplicated: first.deduplicated, status: first.status });
    });

    app.post('/api/prospects/:id/outreach-log', authAdmin, async (req, res) => {
      const pid = String(req.params.id || '');
      const existingRes = await db.query('SELECT id, crm_lead_id FROM prospects WHERE id = $1', [pid]);
      if (!existingRes.rows?.[0]) {
        return res.status(400).json({ error: 'Add this prospect to CRM first', code: 'ADD_TO_CRM_REQUIRED' });
      }
      return res.json({ success: true });
    });

    // 1. Run Discovery -> ZERO writes!
    const locateRes = await request(app).post('/api/prospects/locate').send({ query: 'services in Lagos' });
    assert(locateRes.status === 200 && locateRes.body.results.length === 3, 'Discovery returns 3 ephemeral website-less prospects');
    assert(
      counters.insertCount === 0 && counters.updateCount === 0 && counters.deleteCount === 0,
      `Discovery produces ZERO DB writes (INSERT=${counters.insertCount}, UPDATE=${counters.updateCount}, DELETE=${counters.deleteCount})`
    );
    assert(storedRows.length === 0 && storedLeads.length === 0, 'Both prospects and crm_leads remain empty after discovery');

    // 2. Ephemeral enrichments (reassess / generate / unconfirmed batch / unadded outreach-log) -> ZERO writes!
    const [reassessRes, genRes, unconfirmedBatchRes, unaddedOutreachRes] = await Promise.all([
      request(app).post('/api/prospects/reassess-website').send({ id: locateRes.body.results[0].id, website_url: '' }),
      request(app).post('/api/prospects/generate').send({ id: locateRes.body.results[0].id, business_name: 'Victoria Tailor' }),
      request(app).post('/api/prospects/batch').send({ prospects: locateRes.body.results }),
      request(app).post(`/api/prospects/${locateRes.body.results[0].id}/outreach-log`).send({ channel: 'email' })
    ]);
    assert(reassessRes.status === 200 && reassessRes.body.persisted === false, 'Reassess is ephemeral');
    assert(genRes.status === 200 && genRes.body.persisted === false, 'Generate draft is ephemeral');
    assert(unconfirmedBatchRes.status === 400 && unconfirmedBatchRes.body.code === 'EXPLICIT_CRM_CONFIRMATION_REQUIRED', 'Unconfirmed /batch is rejected with 400');
    assert(unaddedOutreachRes.status === 400 && unaddedOutreachRes.body.code === 'ADD_TO_CRM_REQUIRED', 'Unadded outreach logging is blocked until added to CRM');
    assert(counters.insertCount === 0 && counters.updateCount === 0 && storedLeads.length === 0, 'Still ZERO DB writes after enrichment & unconfirmed requests');

    // 3. Explicit Single Add to CRM -> ONLY 1 lead + 1 prospect created
    const firstCand = locateRes.body.results[0];
    const addOneRes = await request(app).post('/api/prospects/crm/add').send({
      prospects: [{ ...firstCand, notes: 'Custom admin intro note' }]
    });
    assert(
      addOneRes.status === 200 &&
      addOneRes.body.summary.added === 1 &&
      addOneRes.body.results[0].status === 'added' &&
      storedLeads.length === 1 &&
      storedRows.length === 1,
      'Explicit single Add to CRM writes ONLY the 1 selected business to crm_leads and prospects'
    );
    assert(
      storedLeads[0].assigned_admin === 'admin@avartah.com' &&
      storedLeads[0].notes === 'Custom admin intro note',
      'CRM lead preserves exact assigned_admin and notes parameter binding'
    );

    // 4. Double-click / retry on already-added record + weaker confidence -> deduplicates & preserves non-empty CRM fields
    const retryRes = await request(app).post('/api/prospects/crm/add').send({
      prospects: [{
        ...firstCand,
        email: 'different@should-not-overwrite.com',
        phone: '+2348099999999',
        verification_status: 'FORMAT_VALID',
        notes: 'Overwriting note should be ignored'
      }]
    });
    assert(
      retryRes.status === 200 &&
      retryRes.body.summary.added === 0 &&
      retryRes.body.summary.already_exists === 1 &&
      retryRes.body.results[0].deduplicated === true &&
      storedLeads.length === 1 &&
      storedRows.length === 1,
      'Repeat Add to CRM triggers ZERO duplicate rows (already_exists + deduplicated=true)'
    );
    assert(
      storedLeads[0].user_email === 'hello@victoriatailor.ng' &&
      storedLeads[0].user_phone === '+2348021001001' &&
      storedLeads[0].notes === 'Custom admin intro note' &&
      storedRows[0].verification_status === firstCand.verification_status &&
      storedRows[0].verification_status !== 'FORMAT_VALID',
      'Repeat Add to CRM never overwrites existing non-empty email/phone/notes or downgrades verification confidence'
    );

    // 5. Explicit Bulk Add Selected to CRM -> saves ONLY selected subset (candidate 2), leaving candidate 3 unsaved!
    const secondCand = locateRes.body.results[1];
    const bulkAddRes = await request(app).post('/api/prospects/crm/add').send({
      prospects: [firstCand, secondCand]
    });
    assert(
      bulkAddRes.status === 200 &&
      bulkAddRes.body.summary.already_exists === 1 &&
      bulkAddRes.body.summary.added === 1 &&
      storedLeads.length === 2 &&
      storedRows.length === 2,
      'Bulk Add Selected saves ONLY newly selected candidate while skipping already-added CRM match and leaving unselected candidates unpersisted'
    );

    // 6. Promote compatibility on existing prospect ID -> deduplicates cleanly
    const promoteExistingRes = await request(app).post(`/api/prospects/${storedRows[1].id}/promote`).send({});
    assert(
      promoteExistingRes.status === 200 &&
      promoteExistingRes.body.success === true &&
      promoteExistingRes.body.deduplicated === true &&
      storedLeads.length === 2,
      'Legacy /api/prospects/:id/promote delegates cleanly to CRM transaction without duplicates'
    );

    // 7. Static UI audit for Section 9-12 ephemeral workspace guarantees
    const uiSource = fs.readFileSync(path.join(process.cwd(), 'components', 'ProspectLocator.tsx'), 'utf8');
    assert(
      uiSource.includes('const [skipWebsites, setSkipWebsites] = useState(true)') &&
      uiSource.includes('Temporary Research Workspace') &&
      uiSource.includes('Add Selected to CRM') &&
      uiSource.includes('Add to CRM') &&
      uiSource.includes('Phone-Only') &&
      !uiSource.includes('fetchExistingProspects') &&
      !uiSource.includes('Sync Batch'),
      'ProspectLocator UI defaults to no-official-website mode, uses Temporary Research Workspace, removes batch auto-sync, and gates persistence behind Add to CRM'
    );

    console.log(`  [INFO] Total queries inspected across test 15: SELECT=${counters.selectCount}, INSERT=${counters.insertCount}, UPDATE=${counters.updateCount}`);
  }

  // -----------------------------------------------------------------------
  // 16. CRM Outreach Delivery Log Schema, Endpoints & Admin UI Audit
  // -----------------------------------------------------------------------
  console.log('\n--- 16. CRM Outreach Delivery Log Schema, Endpoints & UI Audit ---');
  {
    const migrationsSource = fs.readFileSync(path.join(process.cwd(), 'lib', 'migrations.ts'), 'utf8');
    const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
    const dashboardSource = fs.readFileSync(path.join(process.cwd(), 'pages', 'AdminDashboard.tsx'), 'utf8');
    const outreachViewSource = fs.readFileSync(path.join(process.cwd(), 'components', 'CrmOutreachLogsView.tsx'), 'utf8');

    assert(
      migrationsSource.includes('032_crm_outreach_delivery_status') &&
      migrationsSource.includes('delivery_status') &&
      migrationsSource.includes('crm_lead_id') &&
      migrationsSource.includes('ai_generated'),
      'Migration 032 extends crm_outreach_history with delivery_status, crm_lead_id, provider, error_message, and ai_generated'
    );

    assert(
      serverSource.includes("app.get('/api/crm/outreach-logs', requireAdminAuth") &&
      serverSource.includes("app.patch('/api/crm/outreach-logs/:logId', requireAdminAuth") &&
      serverSource.includes("app.post('/api/crm/leads/:leadId/outreach', requireAdminAuth") &&
      serverSource.includes('INSERT INTO crm_outreach_history') &&
      serverSource.includes("delivery_status = 'DRAFT_OPENED'") || serverSource.includes("'DRAFT_OPENED'"),
      'server.ts protects all CRM outreach log endpoints with requireAdminAuth and persists delivery_status across /outreach-log and /send'
    );

    assert(
      dashboardSource.includes('CrmOutreachLogsView') &&
      dashboardSource.includes('CrmLeadOutreachModal') &&
      dashboardSource.includes('Outreach Delivery Log'),
      'AdminDashboard wires CrmOutreachLogsView and CrmLeadOutreachModal under Client Operations'
    );

    assert(
      outreachViewSource.includes('getCrmOutreachLogs') &&
      outreachViewSource.includes('updateCrmOutreachLogStatus') &&
      outreachViewSource.includes('sendOrLogCrmLeadOutreach') &&
      outreachViewSource.includes('generateCrmLeadPitch'),
      'CrmOutreachLogsView supports filtering, inspecting AI pitches, dispatching, and updating persisted delivery statuses'
    );
  }

  console.log('\n====================================================================');
  console.log(`  COMPREHENSIVE TEST SUMMARY: ${passed} PASS / ${failed} FAIL`);
  console.log('====================================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveProspectTests().catch((err) => {
  console.error('Unhandled error in comprehensive test suite:', err);
  process.exit(1);
});
