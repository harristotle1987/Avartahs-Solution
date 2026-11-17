import {
  buildDeterministicProspectId,
  DbQueryExecutor,
  DiscoveryDbStats
} from './prospectDiscovery.js';
import {
  extractCanonicalKeys,
  isSafeUrl,
  isSocialOrDirectoryDomain,
  mapInternalStatusToCategory,
  normalizeAndValidatePhone,
  normalizeDomain,
  validateEmail
} from './prospects.js';

export type AddToCrmItemStatus = 'added' | 'already_exists' | 'rejected' | 'failed';

export interface AddToCrmItemResult {
  id: string;
  prospect_id: string | null;
  lead_id: string | null;
  business_name: string;
  status: AddToCrmItemStatus;
  deduplicated: boolean;
  matchedBy?: string;
  error?: string;
}

export interface AddToCrmBatchResponse {
  success: boolean;
  summary: {
    added: number;
    already_exists: number;
    rejected: number;
    failed: number;
  };
  results: AddToCrmItemResult[];
}

export interface AddToCrmOptions {
  requested_service?: string;
  priority?: string;
  notes?: string;
  contact_name?: string;
  allowExistingProspectId?: string;
}

const ALLOWED_PRIORITIES = new Set(['Low', 'Medium', 'High', 'Urgent']);

function sanitizePriority(raw?: string): 'Low' | 'Medium' | 'High' | 'Urgent' {
  if (!raw || typeof raw !== 'string') return 'Medium';
  const match = Array.from(ALLOWED_PRIORITIES).find((p) => p.toLowerCase() === raw.trim().toLowerCase());
  return (match as 'Low' | 'Medium' | 'High' | 'Urgent') || 'Medium';
}

function sanitizeText(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLen);
}

interface NormalizedCandidateForCrm {
  originalIndex: number;
  clientTempId: string;
  prospectId: string;
  businessName: string;
  contactName: string;
  location: string;
  country: string;
  email: string;
  phone: string;
  websiteUrl: string;
  domain: string | null;
  nameLocationKey: string;
  whatsappLink: string | null;
  socialProfiles: Record<string, string | null> | null;
  status: string;
  websiteQualityCategory: string;
  websiteQualityScore: number;
  websiteAvailability: string;
  websiteEvidence: string;
  source: string;
  sourceProvenance: Record<string, unknown>;
  contactEvidence: unknown[];
  verificationStatus: string;
  suggestedService: string;
  emailDraft: string;
  whatsappDraft: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  notes: string;
}

function confidenceRank(status?: string | null): number {
  const s = String(status || '').toUpperCase();
  if (s.includes('INDEPENDENTLY_VERIFIED')) return 4;
  if (s.includes('SOURCE_CONFIRMED')) return 3;
  if (s.includes('FOUND')) return 2;
  if (s.includes('FORMAT_VALID')) return 1;
  return 0;
}

/**
 * Transactional, idempotent CRM admission helper.
 * ONLY called upon explicit administrator "Add to CRM" or confirmed bulk "Add Selected to CRM".
 * Validates & normalizes all fields server-side, generates server-authoritative IDs/statuses,
 * rechecks duplicates against BOTH crm_leads & prospects in a single transaction,
 * and never overwrites existing non-empty or higher-confidence CRM fields.
 */
export async function addProspectsToCrmTransactional(
  db: DbQueryExecutor,
  adminEmail: string,
  rawItems: unknown[],
  options: AddToCrmOptions = {},
  dbStats?: DiscoveryDbStats
): Promise<AddToCrmBatchResponse> {
  const results: AddToCrmItemResult[] = [];
  const summary = { added: 0, already_exists: 0, rejected: 0, failed: 0 };

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { success: true, summary, results };
  }

  const normalizedItems: NormalizedCandidateForCrm[] = [];
  const seenBatchMap = new Map<string, NormalizedCandidateForCrm>();

  for (let idx = 0; idx < rawItems.length; idx++) {
    const raw = rawItems[idx];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      results[idx] = {
        id: `invalid_${idx}`,
        prospect_id: null,
        lead_id: null,
        business_name: 'Unknown',
        status: 'rejected',
        deduplicated: false,
        error: 'Invalid prospect payload object.'
      };
      summary.rejected++;
      continue;
    }

    const item = raw as Record<string, any>;
    const rawName = sanitizeText(item.business_name || item.name, 200);
    if (!rawName) {
      results[idx] = {
        id: sanitizeText(item.id, 80) || `invalid_${idx}`,
        prospect_id: null,
        lead_id: null,
        business_name: '',
        status: 'rejected',
        deduplicated: false,
        error: 'Business name is required before adding to CRM.'
      };
      summary.rejected++;
      continue;
    }

    const location = sanitizeText(item.location || item.label || '', 250);
    const country = sanitizeText(item.country || '', 100);

    // Strictly validate & normalize email server-side (never accept placeholders)
    const rawEmail = sanitizeText(item.email, 200);
    const emailCheck = validateEmail(rawEmail);
    const validEmail = emailCheck.isValid && !emailCheck.isPlaceholder ? rawEmail.toLowerCase() : '';

    // Strictly validate & normalize phone server-side (reject building numbers/years/dummies)
    const rawPhone = sanitizeText(item.phone || item.contact_info, 60);
    const phoneCheck = normalizeAndValidatePhone(rawPhone, country || location);
    const validPhone = phoneCheck.isValid && !phoneCheck.isAddressNumber && phoneCheck.normalizedPhone
      ? phoneCheck.normalizedPhone
      : '';

    // Validate standalone official website vs social profile
    const rawWebsite = sanitizeText(item.website_url || item.website, 400);
    let standaloneWebsite = '';
    const socialProfiles: Record<string, string | null> =
      item.social_profiles && typeof item.social_profiles === 'object' ? { ...item.social_profiles } : {};

    if (rawWebsite) {
      const normalizedUrl = /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`;
      if (isSafeUrl(normalizedUrl)) {
        if (isSocialOrDirectoryDomain(normalizedUrl)) {
          if (!socialProfiles.primary) socialProfiles.primary = normalizedUrl;
        } else {
          standaloneWebsite = normalizedUrl;
        }
      }
    }

    const keys = extractCanonicalKeys({
      name: rawName,
      location,
      website: standaloneWebsite || null,
      phone: validPhone || null,
      email: validEmail || null,
      countryContext: country || location
    });

    // Determine server-authoritative persistent ID
    const clientTempId = sanitizeText(item.id, 80) || buildDeterministicProspectId(keys.primaryKey);
    const explicitExistingId =
      options.allowExistingProspectId && /^[a-zA-Z0-9_-]{3,80}$/.test(options.allowExistingProspectId)
        ? options.allowExistingProspectId
        : null;
    const serverProspectId = explicitExistingId || buildDeterministicProspectId(keys.primaryKey);

    // Validate WhatsApp link only when usable phone exists and scheme is safe
    let whatsappLink: string | null = null;
    const rawWa = sanitizeText(item.whatsapp_link, 300);
    if (validPhone && rawWa && isSafeUrl(rawWa) && (rawWa.includes('wa.me/') || rawWa.includes('whatsapp.com/'))) {
      whatsappLink = rawWa;
    }

    const scoreRaw = Number(item.website_quality_score);
    const websiteQualityScore = Number.isFinite(scoreRaw) ? Math.min(100, Math.max(0, Math.round(scoreRaw))) : 50;
    const websiteStatus = sanitizeText(item.status, 60) || (standaloneWebsite ? 'NEEDS_REVIEW' : 'NO_WEBSITE');
    const websiteQualityCategory =
      sanitizeText(item.website_quality_category, 120) || mapInternalStatusToCategory(websiteStatus);

    const priority = sanitizePriority(item.priority || options.priority);
    const suggestedService = sanitizeText(
      item.suggested_service || options.requested_service,
      200
    ) || 'Website Modernization & Digital Growth';
    const notes = sanitizeText(
      item.notes || options.notes,
      1500
    ) || `Added via Prospecting Engine. Website Status: ${websiteQualityCategory}. Location: ${location || 'N/A'}.`;
    const contactName = sanitizeText(item.contact_name || options.contact_name, 160) || rawName;

    // Normalize verification status honestly (never accept ungrounded "INDEPENDENTLY_VERIFIED" from client)
    let verificationStatus = sanitizeText(item.verification_status, 120) || 'NOT_FOUND';
    if (verificationStatus.toUpperCase().includes('INDEPENDENTLY_VERIFIED')) {
      verificationStatus = validEmail || validPhone ? 'SOURCE_CONFIRMED' : 'NOT_FOUND';
    } else if (!validEmail && !validPhone) {
      verificationStatus = 'NOT_FOUND';
    }

    // Intra-batch deduplication
    const dedupTokens = [
      keys.domain ? `d:${keys.domain}` : '',
      keys.phone ? `p:${keys.phone}` : '',
      keys.email ? `e:${keys.email}` : '',
      `nl:${keys.nameLocation}`
    ].filter(Boolean);

    const inBatchDup = dedupTokens.map((t) => seenBatchMap.get(t)).find(Boolean);
    if (inBatchDup) {
      results[idx] = {
        id: clientTempId,
        prospect_id: inBatchDup.prospectId,
        lead_id: `lead_prospect_${inBatchDup.prospectId}`,
        business_name: rawName,
        status: 'already_exists',
        deduplicated: true,
        matchedBy: 'same batch duplicate'
      };
      summary.already_exists++;
      continue;
    }

    const normalized: NormalizedCandidateForCrm = {
      originalIndex: idx,
      clientTempId,
      prospectId: serverProspectId,
      businessName: rawName,
      contactName,
      location,
      country,
      email: validEmail,
      phone: validPhone,
      websiteUrl: standaloneWebsite,
      domain: keys.domain,
      nameLocationKey: keys.nameLocation,
      whatsappLink,
      socialProfiles: Object.keys(socialProfiles).length > 0 ? socialProfiles : null,
      status: websiteStatus,
      websiteQualityCategory,
      websiteQualityScore,
      websiteAvailability: sanitizeText(item.website_availability, 40) || (standaloneWebsite ? 'UNVERIFIED' : 'NONE'),
      websiteEvidence: sanitizeText(item.evidence || item.website_evidence, 1000),
      source: sanitizeText(item.source, 80) || 'osm-overpass',
      sourceProvenance: {
        ...(item.source_provenance && typeof item.source_provenance === 'object' ? item.source_provenance : {}),
        ...(Object.keys(socialProfiles).length > 0 ? { social_profiles: socialProfiles } : {}),
        added_to_crm_by: adminEmail,
        added_to_crm_at: new Date().toISOString()
      },
      contactEvidence: Array.isArray(item.contact_evidence) ? item.contact_evidence.slice(0, 20) : [],
      verificationStatus,
      suggestedService,
      emailDraft: sanitizeText(item.email_draft, 4000),
      whatsappDraft: sanitizeText(item.whatsapp_draft, 2000),
      priority,
      notes
    };

    for (const tok of dedupTokens) {
      seenBatchMap.set(tok, normalized);
    }
    normalizedItems.push(normalized);
  }

  if (normalizedItems.length === 0) {
    return { success: summary.failed === 0, summary, results };
  }

  // Batched lookup tokens
  const prospectIds = normalizedItems.map((i) => i.prospectId);
  const leadIds = normalizedItems.map((i) => `lead_prospect_${i.prospectId}`);
  const emails = normalizedItems.map((i) => i.email).filter(Boolean);
  const phones = normalizedItems.map((i) => i.phone).filter(Boolean);
  const names = normalizedItems.map((i) => i.businessName.toLowerCase());
  const domainPatterns = normalizedItems.map((i) => i.domain).filter(Boolean).map((d) => `%${d}%`);

  const txDb: DbQueryExecutor & { release?: () => void } =
    typeof (db as any).connect === 'function' ? await (db as any).connect() : db;

  try {
    await txDb.query('BEGIN');

    if (dbStats) dbStats.dbReads += 2;

    const existingLeadsRes = await txDb.query(
      `SELECT id, contact_name, business_name, user_email, user_phone, target_url, website, city, country, notes
       FROM crm_leads
       WHERE id = ANY($1::text[])
          OR LOWER(user_email) = ANY($2::text[])
          OR REGEXP_REPLACE(COALESCE(user_phone, ''), '[^0-9+]', '', 'g') = ANY($3::text[])
          OR LOWER(business_name) = ANY($4::text[])
          OR LOWER(COALESCE(NULLIF(target_url, ''), website)) LIKE ANY($5::text[])`,
      [leadIds, emails, phones, names, domainPatterns]
    );

    const existingProspectsRes = await txDb.query(
      `SELECT id, business_name, location, phone, email, website_url, crm_lead_id, reviewed_status, verification_status
       FROM prospects
       WHERE id = ANY($1::text[])
          OR LOWER(email) = ANY($2::text[])
          OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9+]', '', 'g') = ANY($3::text[])
          OR LOWER(business_name) = ANY($4::text[])
          OR LOWER(website_url) LIKE ANY($5::text[])`,
      [prospectIds, emails, phones, names, domainPatterns]
    );

    const existingLeads: any[] = existingLeadsRes.rows || [];
    const existingProspects: any[] = existingProspectsRes.rows || [];

    for (const cand of normalizedItems) {
      try {
        // Match against existing prospects table first (including explicit promotion IDs)
        const matchedProspect = existingProspects.find((p) => {
          if (p.id && p.id === cand.prospectId) return true;
          if (cand.email && p.email && String(p.email).trim().toLowerCase() === cand.email) return true;
          if (cand.phone && p.phone && String(p.phone).replace(/[^\d+]/g, '') === cand.phone.replace(/[^\d+]/g, '')) return true;
          if (cand.domain && p.website_url && !isSocialOrDirectoryDomain(p.website_url)) {
            if (normalizeDomain(p.website_url) === cand.domain) return true;
          }
          if (p.business_name && p.location) {
            const pKeys = extractCanonicalKeys({ name: String(p.business_name), location: String(p.location) });
            if (pKeys.nameLocation === cand.nameLocationKey) return true;
          }
          return false;
        });

        const effectiveProspectId = matchedProspect?.id || cand.prospectId;

        // Match against authoritative crm_leads store
        let matchedLead: any = null;
        let matchedBy = '';

        if (matchedProspect?.crm_lead_id) {
          matchedLead = existingLeads.find((l) => l.id === matchedProspect.crm_lead_id) || {
            id: matchedProspect.crm_lead_id
          };
          matchedBy = 'linked prospect CRM lead ID';
        }

        if (!matchedLead && cand.email) {
          matchedLead = existingLeads.find((l) => l.user_email && String(l.user_email).trim().toLowerCase() === cand.email);
          if (matchedLead) matchedBy = 'verified email';
        }

        if (!matchedLead && cand.phone) {
          const normCandDigits = cand.phone.replace(/[^\d+]/g, '');
          matchedLead = existingLeads.find(
            (l) => l.user_phone && String(l.user_phone).replace(/[^\d+]/g, '') === normCandDigits
          );
          if (matchedLead) matchedBy = 'verified telephone';
        }

        if (!matchedLead && cand.domain) {
          matchedLead = existingLeads.find((l) => {
            const url = l.target_url || l.website;
            return url && !isSocialOrDirectoryDomain(url) && normalizeDomain(url) === cand.domain;
          });
          if (matchedLead) matchedBy = 'domain / website';
        }

        if (!matchedLead) {
          matchedLead = existingLeads.find((l) => {
            if (!l.business_name) return false;
            const lName = String(l.business_name).trim().toLowerCase();
            if (lName !== cand.businessName.toLowerCase()) return false;
            const lLoc = String(l.city || l.country || '').trim().toLowerCase();
            if (!lLoc || !cand.location) return true;
            const cLoc = cand.location.toLowerCase();
            return cLoc.includes(lLoc) || lLoc.includes(cLoc.split(',')[0].trim());
          });
          if (matchedLead) matchedBy = 'business name match';
        }

        // Preserve higher confidence verification status if prospect already exists
        const finalVerification =
          matchedProspect?.verification_status &&
          confidenceRank(matchedProspect.verification_status) > confidenceRank(cand.verificationStatus)
            ? matchedProspect.verification_status
            : cand.verificationStatus;

        let finalLeadId: string;
        let itemStatus: AddToCrmItemStatus;
        let deduplicated: boolean;

        if (matchedLead) {
          finalLeadId = matchedLead.id;
          itemStatus = 'already_exists';
          deduplicated = true;

          // Non-destructive enrichment ONLY of empty CRM fields; never overwrite existing values
          await txDb.query(
            `UPDATE crm_leads
             SET contact_name = COALESCE(NULLIF(contact_name, ''), $1),
                 business_name = COALESCE(NULLIF(business_name, ''), $2),
                 user_email = COALESCE(NULLIF(user_email, ''), $3),
                 user_phone = COALESCE(NULLIF(user_phone, ''), $4),
                 target_url = COALESCE(NULLIF(target_url, ''), $5),
                 website = COALESCE(NULLIF(website, ''), $6),
                 assigned_admin = COALESCE(NULLIF(assigned_admin, ''), $7),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $8`,
            [
              cand.contactName,
              cand.businessName,
              cand.email || null,
              cand.phone || null,
              cand.websiteUrl || null,
              cand.websiteUrl || null,
              adminEmail,
              finalLeadId
            ]
          );
          if (dbStats) dbStats.dbWrites++;
        } else {
          finalLeadId = `lead_prospect_${effectiveProspectId}`;
          const leadInsertRes = await txDb.query(
            `INSERT INTO crm_leads (
               id, contact_name, business_name, user_email, user_phone,
               target_url, website, city, country, requested_service, lead_source,
               status, priority, assigned_admin, notes, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Prospect Outreach', 'New', $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO UPDATE SET
               contact_name = COALESCE(NULLIF(crm_leads.contact_name, ''), EXCLUDED.contact_name),
               business_name = COALESCE(NULLIF(crm_leads.business_name, ''), EXCLUDED.business_name),
               user_email = COALESCE(NULLIF(crm_leads.user_email, ''), EXCLUDED.user_email),
               user_phone = COALESCE(NULLIF(crm_leads.user_phone, ''), EXCLUDED.user_phone),
               target_url = COALESCE(NULLIF(crm_leads.target_url, ''), EXCLUDED.target_url),
               website = COALESCE(NULLIF(crm_leads.website, ''), EXCLUDED.website),
               assigned_admin = COALESCE(NULLIF(crm_leads.assigned_admin, ''), EXCLUDED.assigned_admin),
               updated_at = CURRENT_TIMESTAMP
             RETURNING id, (xmax = 0) AS inserted`,
            [
              finalLeadId,
              cand.contactName,
              cand.businessName,
              cand.email || null,
              cand.phone || null,
              cand.websiteUrl || null,
              cand.websiteUrl || null,
              cand.location || '',
              cand.country || '',
              cand.suggestedService,
              cand.priority,
              adminEmail,
              cand.notes
            ]
          );
          if (dbStats) dbStats.dbWrites++;

          const wasInserted = leadInsertRes.rows?.[0]?.inserted !== false;
          itemStatus = wasInserted ? 'added' : 'already_exists';
          deduplicated = !wasInserted;
          if (!wasInserted) matchedBy = 'idempotent lead ID conflict';

          // Track newly created lead in local array for subsequent items in same transaction
          existingLeads.push({
            id: finalLeadId,
            contact_name: cand.contactName,
            business_name: cand.businessName,
            user_email: cand.email,
            user_phone: cand.phone,
            target_url: cand.websiteUrl,
            website: cand.websiteUrl,
            city: cand.location,
            country: cand.country
          });
        }

        // Atomically upsert & link authoritative prospects record (never overwriting non-empty CRM data)
        await txDb.query(
          `INSERT INTO prospects (
             id, business_name, location, phone, email, website_url, status,
             website_availability, website_quality_score, website_quality_category, website_evidence,
             whatsapp_link, source, source_provenance, contact_evidence,
             verification_status, qualification_status, reviewed_status, crm_lead_id, promoted_at,
             suggested_service, email_draft, whatsapp_draft, notes, outreach_status, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7,
             $8, $9, $10, $11,
             $12, $13, $14, $15,
             $16, 'QUALIFIED', 'PROMOTED', $17, CURRENT_TIMESTAMP,
             $18, $19, $20, $21, 'NOT_CONTACTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           )
           ON CONFLICT (id) DO UPDATE SET
             phone = COALESCE(NULLIF(prospects.phone, ''), EXCLUDED.phone),
             email = COALESCE(NULLIF(prospects.email, ''), EXCLUDED.email),
             website_url = COALESCE(NULLIF(prospects.website_url, ''), EXCLUDED.website_url),
             whatsapp_link = COALESCE(NULLIF(prospects.whatsapp_link, ''), EXCLUDED.whatsapp_link),
             website_availability = COALESCE(NULLIF(prospects.website_availability, ''), EXCLUDED.website_availability),
             website_quality_score = COALESCE(prospects.website_quality_score, EXCLUDED.website_quality_score),
             website_quality_category = COALESCE(NULLIF(prospects.website_quality_category, ''), EXCLUDED.website_quality_category),
             website_evidence = COALESCE(NULLIF(prospects.website_evidence, ''), EXCLUDED.website_evidence),
             suggested_service = COALESCE(NULLIF(prospects.suggested_service, ''), EXCLUDED.suggested_service),
             email_draft = COALESCE(NULLIF(prospects.email_draft, ''), EXCLUDED.email_draft),
             whatsapp_draft = COALESCE(NULLIF(prospects.whatsapp_draft, ''), EXCLUDED.whatsapp_draft),
             verification_status = $16,
             qualification_status = 'QUALIFIED',
             reviewed_status = 'PROMOTED',
             crm_lead_id = COALESCE(NULLIF(prospects.crm_lead_id, ''), EXCLUDED.crm_lead_id),
             promoted_at = COALESCE(prospects.promoted_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP`,
          [
            effectiveProspectId,
            cand.businessName,
            cand.location,
            cand.phone || null,
            cand.email || null,
            cand.websiteUrl || null,
            cand.status,
            cand.websiteAvailability,
            cand.websiteQualityScore,
            cand.websiteQualityCategory,
            cand.websiteEvidence || null,
            cand.whatsappLink,
            cand.source,
            JSON.stringify(cand.sourceProvenance),
            JSON.stringify(cand.contactEvidence),
            finalVerification,
            finalLeadId,
            cand.suggestedService,
            cand.emailDraft || null,
            cand.whatsappDraft || null,
            cand.notes
          ]
        );
        if (dbStats) {
          dbStats.dbWrites++;
          if (itemStatus === 'added') dbStats.rowsInserted++;
          else dbStats.rowsUpdated++;
        }

        if (!matchedProspect) {
          existingProspects.push({
            id: effectiveProspectId,
            business_name: cand.businessName,
            location: cand.location,
            phone: cand.phone,
            email: cand.email,
            website_url: cand.websiteUrl,
            crm_lead_id: finalLeadId,
            reviewed_status: 'PROMOTED',
            verification_status: finalVerification
          });
        }

        results[cand.originalIndex] = {
          id: cand.clientTempId,
          prospect_id: effectiveProspectId,
          lead_id: finalLeadId,
          business_name: cand.businessName,
          status: itemStatus,
          deduplicated,
          ...(matchedBy ? { matchedBy } : {})
        };
        if (itemStatus === 'added') summary.added++;
        else summary.already_exists++;
      } catch (itemErr: any) {
        results[cand.originalIndex] = {
          id: cand.clientTempId,
          prospect_id: null,
          lead_id: null,
          business_name: cand.businessName,
          status: 'failed',
          deduplicated: false,
          error: itemErr?.message || 'Database insert error'
        };
        summary.failed++;
      }
    }

    await txDb.query('COMMIT');
    return {
      success: summary.failed === 0 || summary.added > 0 || summary.already_exists > 0,
      summary,
      results
    };
  } catch (txErr: any) {
    await txDb.query('ROLLBACK').catch(() => undefined);
    for (const cand of normalizedItems) {
      if (!results[cand.originalIndex]) {
        results[cand.originalIndex] = {
          id: cand.clientTempId,
          prospect_id: null,
          lead_id: null,
          business_name: cand.businessName,
          status: 'failed',
          deduplicated: false,
          error: txErr?.message || 'Transaction failed'
        };
        summary.failed++;
      }
    }
    return { success: false, summary, results };
  } finally {
    if (txDb !== db && typeof txDb.release === 'function') {
      txDb.release();
    }
  }
}
