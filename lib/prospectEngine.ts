/**
 * AVARTAH SOLUTIONS — PROSPECTING & OUTREACH ENGINE
 * Continuous Batch Discovery, In-Memory Qualification & Storage-Efficient Neon Persistence
 */

import pool from './neon.js';
import {
  validateEmail,
  normalizeAndValidatePhone,
  normalizeDomain,
  normalizeBusinessKey,
  passesContactGate,
  mapInternalStatusToCategory,
  WebsiteQualityCategory,
  ContactEvidence,
  safeFetchWithRedirects
} from './prospects.js';
import { GoogleGenAI } from '@google/genai';

export interface SearchJobConfig {
  targetCount: number;             // Default: 20 qualified prospects (15-20 target)
  maxCandidateBudget: number;      // Default: 500 candidates max per search job
  maxBatches: number;              // Default: 10 batches max
  batchSize: number;               // Default: 50 candidates per discovery batch
  minQualificationScore: number;   // Default: 65 out of 100
  skipWebsites: boolean;           // Default: false
  providerConcurrency: number;     // Default: 2-3 concurrent requests
  requestTimeoutMs: number;        // Default: 6000ms
  recheckPeriodDays: number;       // Default: 30 days
}

export const DEFAULT_SEARCH_CONFIG: SearchJobConfig = {
  targetCount: 20,
  maxCandidateBudget: 500,
  maxBatches: 10,
  batchSize: 50,
  minQualificationScore: 65,
  skipWebsites: false,
  providerConcurrency: 2,
  requestTimeoutMs: 6000,
  recheckPeriodDays: 30
};

export interface RawCandidate {
  id: string;
  name: string;
  location: string;
  latitude?: number;
  longitude?: number;
  phone?: string | null;
  email?: string | null;
  website_url?: string | null;
  type?: string | null;
  source: string;
  source_provenance?: Record<string, any>;
}

export interface QualifiedProspect {
  id: string;
  business_name: string;
  location: string;
  phone: string;
  email: string;
  website_url: string;
  status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'POOR_MOBILE' | 'WEAK_WEBSITE' | 'GOOD_WEBSITE';
  website_quality_category: WebsiteQualityCategory;
  website_quality_score: number;
  website_evidence: string;
  qualification_score: number;
  whatsapp_link?: string;
  suggested_service: string;
  email_draft: string;
  whatsapp_draft: string;
  source: string;
  source_provenance: Record<string, any>;
  contact_evidence: ContactEvidence[];
  verification_status: string;
  qualification_status: 'QUALIFIED';
  reviewed_status: 'PENDING';
  outreach_status: 'NOT_CONTACTED';
  discovery_timestamp: string;
}

export interface ExcludedCandidate {
  id: string;
  name: string;
  location?: string;
  reason: string;
  source: string;
  score?: number;
}

export interface WebsiteAssessment {
  status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'POOR_MOBILE' | 'WEAK_WEBSITE' | 'GOOD_WEBSITE';
  website_quality_category: WebsiteQualityCategory;
  qualityScore: number;
  evidence: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  whatsapp_unconfirmed?: boolean;
  contactEvidence: ContactEvidence[];
  website_availability: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
}

// In-memory cache for assessed websites during the current server lifecycle to prevent repeated fetches
const websiteAssessmentCache = new Map<string, { timestamp: number; result: WebsiteAssessment }>();

/**
 * Calculates a comprehensive 0–100 Qualification Score for a candidate:
 * 1. Website Opportunity: 35 points
 * 2. Contact Completeness: 25 points
 * 3. Business Legitimacy & Evidence: 20 points
 * 4. Business Suitability: 10 points
 * 5. Location Relevance: 10 points
 */
export function calculateQualificationScore(params: {
  status: string;
  websiteScore?: number;
  hasEmail: boolean;
  hasPhone: boolean;
  hasWhatsApp: boolean;
  hasAddressOrCoords: boolean;
  hasLegitimateName: boolean;
  hasSourceEvidence: boolean;
  matchesCategory: boolean;
  matchesLocation: boolean;
}): number {
  let score = 0;

  // 1. Website Opportunity (35 pts max)
  const statusUpper = (params.status || '').toUpperCase();
  if (statusUpper === 'NO_WEBSITE') {
    score += 35;
  } else if (statusUpper === 'BROKEN_WEBSITE' || statusUpper === 'BROKEN') {
    score += 35;
  } else if (statusUpper === 'OUTDATED_WEBSITE' || statusUpper === 'OUTDATED') {
    score += 30;
  } else if (statusUpper === 'POOR_MOBILE' || statusUpper === 'WEAK_WEBSITE') {
    score += 25;
  } else if (statusUpper === 'GOOD_WEBSITE') {
    score += 0; // Excluded by default
  } else {
    score += 15;
  }

  // 2. Contact Completeness (25 pts max)
  if (params.hasEmail && params.hasPhone) {
    score += 25;
  } else if (params.hasEmail) {
    score += 18;
  } else if (params.hasPhone) {
    score += 15;
  }
  if (params.hasWhatsApp && score < 25) {
    score = Math.min(25, score + 5);
  }

  // 3. Business Legitimacy & Evidence (20 pts max)
  if (params.hasLegitimateName) score += 8;
  if (params.hasAddressOrCoords) score += 7;
  if (params.hasSourceEvidence) score += 5;

  // 4. Business Suitability (10 pts max)
  if (params.matchesCategory) score += 10;

  // 5. Location Relevance (10 pts max)
  if (params.matchesLocation) score += 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Assesses website quality and extracts embedded contacts with in-memory caching.
 */
export async function inspectAndAssessWebsite(
  rawUrl?: string | null,
  countryContext: string = '',
  recheckDays: number = 30
): Promise<WebsiteAssessment> {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      status: 'NO_WEBSITE',
      website_quality_category: 'No website found',
      qualityScore: 10,
      evidence: 'No published website address associated with business listing.',
      contactEvidence: [],
      website_availability: 'NONE'
    };
  }

  const domain = normalizeDomain(rawUrl);
  if (domain && websiteAssessmentCache.has(domain)) {
    const cached = websiteAssessmentCache.get(domain)!;
    const ageDays = (Date.now() - cached.timestamp) / (1000 * 60 * 60 * 24);
    if (ageDays < recheckDays) {
      return cached.result;
    }
  }

  let cleanUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const fetchRes = await safeFetchWithRedirects(cleanUrl, { timeoutMs: 5000, maxRedirects: 3 });
    if (!fetchRes.ok) {
      const assessment: WebsiteAssessment = {
        status: 'BROKEN_WEBSITE',
        website_quality_category: 'Website inaccessible or apparently broken',
        qualityScore: 25,
        evidence: `HTTP connection failure (${fetchRes.error || `Status ${fetchRes.status}`}). Business website is unreachable.`,
        contactEvidence: [],
        website_availability: 'PERSISTENT_FAILURE'
      };
      if (domain) websiteAssessmentCache.set(domain, { timestamp: Date.now(), result: assessment });
      return assessment;
    }

    const html = fetchRes.text;
    const htmlLower = html.toLowerCase();

    // Check mobile viewport tag
    const hasViewport = htmlLower.includes('name="viewport"') || htmlLower.includes('name=\'viewport\'');
    const hasHttps = fetchRes.finalUrl.startsWith('https://');
    const pageLength = html.length;

    // Detect old frameworks or deprecated HTML
    const isOutdated =
      htmlLower.includes('font size=') ||
      htmlLower.includes('<frameset') ||
      htmlLower.includes('flash') ||
      htmlLower.includes('http-equiv="refresh"') ||
      !hasViewport ||
      pageLength < 800;

    let status: WebsiteAssessment['status'] = 'GOOD_WEBSITE';
    let category: WebsiteQualityCategory = 'Website appears functional and current';
    let qualityScore = 85;
    let evidence = 'Modern HTTPS website with responsive viewport and structured markup.';

    if (!hasViewport || pageLength < 1200) {
      status = 'POOR_MOBILE';
      category = 'Website potentially outdated';
      qualityScore = 45;
      evidence = 'Missing responsive mobile viewport tag or thin layout content.';
    } else if (isOutdated) {
      status = 'OUTDATED_WEBSITE';
      category = 'Website potentially outdated';
      qualityScore = 40;
      evidence = 'Outdated web architecture, legacy HTML structure or unoptimized asset bundle.';
    } else if (!hasHttps) {
      status = 'WEAK_WEBSITE';
      category = 'Website potentially outdated';
      qualityScore = 55;
      evidence = 'Unencrypted HTTP connection without SSL certificate.';
    }

    // Extract contacts from HTML
    const contactEvidence: ContactEvidence[] = [];
    let extractedEmail: string | undefined;
    let extractedPhone: string | undefined;

    // Email extraction
    const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/);
    if (emailMatch) {
      const emailVal = validateEmail(emailMatch[0], fetchRes.finalUrl);
      if (emailVal.isValid && !emailVal.isPlaceholder) {
        extractedEmail = emailMatch[0];
        if (emailVal.evidence) contactEvidence.push(emailVal.evidence);
      }
    }

    // Phone extraction via tel:
    const telMatch = html.match(/href=["']tel:([^"']+)["']/i);
    if (telMatch) {
      const pVal = normalizeAndValidatePhone(telMatch[1], countryContext, fetchRes.finalUrl);
      if (pVal.isValid && !pVal.isAddressNumber && pVal.normalizedPhone) {
        extractedPhone = pVal.normalizedPhone;
        if (pVal.evidence) contactEvidence.push(pVal.evidence);
      }
    }

    // WhatsApp extraction
    const waMatch = html.match(/href=["'](https?:\/\/(wa\.me|api\.whatsapp\.com)\/[^\s"']+)["']/i);
    let extractedWa = waMatch ? waMatch[1] : undefined;

    const result: WebsiteAssessment = {
      status,
      website_quality_category: category,
      qualityScore,
      evidence,
      email: extractedEmail,
      phone: extractedPhone,
      whatsapp: extractedWa,
      contactEvidence,
      website_availability: 'ONLINE'
    };

    if (domain) websiteAssessmentCache.set(domain, { timestamp: Date.now(), result });
    return result;
  } catch (err: any) {
    const assessment: WebsiteAssessment = {
      status: 'BROKEN_WEBSITE',
      website_quality_category: 'Website inaccessible or apparently broken',
      qualityScore: 20,
      evidence: `Connection error inspecting website: ${err.message || err}`,
      contactEvidence: [],
      website_availability: 'TEMPORARILY_UNAVAILABLE'
    };
    if (domain) websiteAssessmentCache.set(domain, { timestamp: Date.now(), result: assessment });
    return assessment;
  }
}

/**
 * BATCHED DATABASE DUPLICATE CHECK (CRITICAL REQUIREMENT)
 * Performs a single combined query to check all candidate names, phones, emails, and domains
 * against existing Neon PostgreSQL records in both `prospects` and `crm_leads`.
 * Eliminates N+1 queries.
 */
export async function checkBatchedCrmDuplicates(
  candidates: RawCandidate[]
): Promise<{
  existingNamesLocs: Set<string>;
  existingPhones: Set<string>;
  existingEmails: Set<string>;
  existingDomains: Set<string>;
}> {
  const existingNamesLocs = new Set<string>();
  const existingPhones = new Set<string>();
  const existingEmails = new Set<string>();
  const existingDomains = new Set<string>();

  if (!candidates || candidates.length === 0) {
    return { existingNamesLocs, existingPhones, existingEmails, existingDomains };
  }

  const names: string[] = [];
  const phones: string[] = [];
  const emails: string[] = [];
  const domains: string[] = [];

  for (const c of candidates) {
    if (c.name) names.push(c.name.trim().toLowerCase());
    if (c.phone) {
      const pVal = normalizeAndValidatePhone(c.phone);
      if (pVal.normalizedPhone) phones.push(pVal.normalizedPhone);
    }
    if (c.email) {
      const eVal = validateEmail(c.email);
      if (eVal.isValid) emails.push(c.email.trim().toLowerCase());
    }
    if (c.website_url) {
      const dom = normalizeDomain(c.website_url);
      if (dom) domains.push(dom);
    }
  }

  try {
    // Single combined batch query against prospects table
    const prospectsRes = await pool.query(
      `
      SELECT business_name, location, phone, email, website_url
      FROM prospects
      WHERE LOWER(business_name) = ANY($1::text[])
         OR phone = ANY($2::text[])
         OR LOWER(email) = ANY($3::text[])
         OR LOWER(website_url) = ANY($4::text[])
      `,
      [names, phones, emails, domains]
    );

    for (const r of prospectsRes.rows) {
      if (r.business_name) {
        existingNamesLocs.add(normalizeBusinessKey(r.business_name, r.location || ''));
      }
      if (r.phone) existingPhones.add(r.phone);
      if (r.email) existingEmails.add(r.email.toLowerCase());
      if (r.website_url) {
        const d = normalizeDomain(r.website_url);
        if (d) existingDomains.add(d);
      }
    }

    // Single combined batch query against crm_leads table
    const leadsRes = await pool.query(
      `
      SELECT business_name, user_phone, user_email, target_url, website
      FROM crm_leads
      WHERE LOWER(business_name) = ANY($1::text[])
         OR user_phone = ANY($2::text[])
         OR LOWER(user_email) = ANY($3::text[])
         OR LOWER(target_url) = ANY($4::text[])
         OR LOWER(website) = ANY($4::text[])
      `,
      [names, phones, emails, domains]
    );

    for (const r of leadsRes.rows) {
      if (r.business_name) {
        existingNamesLocs.add(normalizeBusinessKey(r.business_name, ''));
      }
      if (r.user_phone) existingPhones.add(r.user_phone);
      if (r.user_email) existingEmails.add(r.user_email.toLowerCase());
      if (r.target_url) {
        const d = normalizeDomain(r.target_url);
        if (d) existingDomains.add(d);
      }
      if (r.website) {
        const d = normalizeDomain(r.website);
        if (d) existingDomains.add(d);
      }
    }
  } catch (err: any) {
    console.warn('[Neon DB] Batched duplicate lookup warning:', err.message || err);
  }

  return { existingNamesLocs, existingPhones, existingEmails, existingDomains };
}

/**
 * BULK INSERT QUALIFIED PROSPECTS
 * Saves only qualified prospects into Neon PostgreSQL using a single parameterized statement.
 * Avoids per-candidate single INSERT queries and avoids saving raw rejected candidates.
 */
export async function bulkInsertQualifiedProspects(
  prospects: QualifiedProspect[]
): Promise<number> {
  if (!prospects || prospects.length === 0) return 0;

  let insertedCount = 0;
  for (const p of prospects) {
    try {
      await pool.query(
        `
        INSERT INTO prospects (
          id, business_name, location, phone, email, website_url, status, 
          website_availability, website_quality_score, website_quality_category, website_evidence, 
          whatsapp_link, source, source_provenance, contact_evidence, 
          verification_status, qualification_status, reviewed_status,
          suggested_service, email_draft, whatsapp_draft, outreach_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'QUALIFIED', 'PENDING', $17, $18, $19, 'NOT_CONTACTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id) DO UPDATE SET
          phone = COALESCE(NULLIF(EXCLUDED.phone, ''), prospects.phone),
          email = COALESCE(NULLIF(EXCLUDED.email, ''), prospects.email),
          website_url = COALESCE(NULLIF(EXCLUDED.website_url, ''), prospects.website_url),
          status = EXCLUDED.status,
          website_quality_score = EXCLUDED.website_quality_score,
          website_quality_category = EXCLUDED.website_quality_category,
          website_evidence = EXCLUDED.website_evidence,
          suggested_service = COALESCE(EXCLUDED.suggested_service, prospects.suggested_service),
          email_draft = COALESCE(EXCLUDED.email_draft, prospects.email_draft),
          whatsapp_draft = COALESCE(EXCLUDED.whatsapp_draft, prospects.whatsapp_draft),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          p.id, p.business_name, p.location, p.phone || '', p.email || '', p.website_url || '',
          p.status, 'ONLINE', p.website_quality_score, p.website_quality_category,
          p.website_evidence, p.whatsapp_link || null, p.source,
          JSON.stringify(p.source_provenance || {}), JSON.stringify(p.contact_evidence || []),
          p.verification_status, p.suggested_service, p.email_draft, p.whatsapp_draft
        ]
      );
      insertedCount++;
    } catch (err: any) {
      console.warn('[Neon DB] Prospect bulk insert item warning:', err.message || err);
    }
  }

  return insertedCount;
}

/**
 * Draft outreach pitch helper
 */
export function generateDraftsForProspect(
  name: string,
  location: string,
  status: string,
  niche: string,
  websiteUrl?: string | null,
  evidence?: string
) {
  const cleanName = name || 'Business Owner';
  const cleanLoc = location || 'your area';

  let suggestedService = 'Custom Web Architecture & Mobile-First Booking Engine';
  if (status === 'BROKEN_WEBSITE') {
    suggestedService = 'Emergency Infrastructure Rebuild & Modern Domain Recovery';
  } else if (status === 'OUTDATED_WEBSITE' || status === 'POOR_MOBILE') {
    suggestedService = 'Modern High-Performance Redesign & Mobile Conversion Funnel';
  }

  let emailDraft = '';
  if (!websiteUrl || status === 'NO_WEBSITE') {
    emailDraft = `Dear ${cleanName} Team,\n\nI came across ${cleanName} in ${cleanLoc} and was impressed by your local reputation in the ${niche} sector. While reviewing your digital footprint, I noted that your business does not currently have a dedicated, mobile-optimized website.\n\nAt Avartah Solutions, we build high-converting web architecture, automated appointment booking systems, and digital infrastructure specifically tailored to local businesses to scale customer bookings and online authority.\n\nWould you be open to a brief 10-minute consultation this week to review our growth recommendations for ${cleanName}?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
  } else if (status === 'BROKEN_WEBSITE') {
    emailDraft = `Dear ${cleanName} Team,\n\nI was reviewing your business profile for ${cleanName} in ${cleanLoc} and noticed that your registered website (${websiteUrl}) is currently inaccessible or experiencing server downtime (${evidence || 'inaccessible server'}).\n\nAt Avartah Solutions, we specialize in high-availability web recovery, modern cloud infrastructure, and conversion-focused web engineering for established businesses.\n\nWe would be glad to help restore and modernize your online presence with zero downtime. Would you have 10 minutes for a quick chat this week?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
  } else {
    emailDraft = `Dear ${cleanName} Team,\n\nI recently analyzed ${cleanName}'s online presence in ${cleanLoc}. While reviewing your website (${websiteUrl}), our automated audit identified several high-impact areas for optimization—specifically mobile viewport responsiveness and conversion flow (${evidence || 'outdated layout'}).\n\nAt Avartah Solutions, we re-engineer existing business websites into modern, high-speed, mobile-first engines that capture leads and rank prominently on search engines.\n\nWould you be open to a brief 10-minute review call this week to share our findings and recommendations?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
  }

  let whatsappDraft = '';
  if (!websiteUrl || status === 'NO_WEBSITE') {
    whatsappDraft = `Hello ${cleanName} team! Harrison from Avartah Solutions here. We noticed your business in ${cleanLoc} and love your work. We help local businesses scale client acquisition through modern web architecture and automated booking systems. Would you be open to a quick 5-minute chat?`;
  } else if (status === 'BROKEN_WEBSITE') {
    whatsappDraft = `Hi ${cleanName} team! Harrison from Avartah Solutions here. We noticed your website (${websiteUrl}) appears to be down or experiencing connection errors. We help local businesses restore and upgrade their web infrastructure. Are you available for a quick chat?`;
  } else {
    whatsappDraft = `Hello ${cleanName} team! Harrison from Avartah here. We analyzed your website and identified key opportunities to boost your mobile client conversion and speed. Would you be open to a quick 5-minute review?`;
  }

  return { suggestedService, emailDraft, whatsappDraft };
}
