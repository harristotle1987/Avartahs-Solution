/**
 * AVARTAH SOLUTIONS — SEARCH JOB EXECUTION RUNNER
 * Bounded, Resumable Search Jobs with Minimal Database Writes & Polling Safety
 */

import pool from './neon.js';
import {
  SearchJobConfig,
  DEFAULT_SEARCH_CONFIG,
  RawCandidate,
  QualifiedProspect,
  ExcludedCandidate,
  calculateQualificationScore,
  inspectAndAssessWebsite,
  checkBatchedCrmDuplicates,
  bulkInsertQualifiedProspects,
  generateDraftsForProspect
} from './prospectEngine.js';
import {
  validateEmail,
  normalizeAndValidatePhone,
  passesContactGate,
  normalizeBusinessKey,
  normalizeDomain,
  safeFetchWithRedirects
} from './prospects.js';
import { GoogleGenAI } from '@google/genai';

export type SearchJobStatus =
  | 'READY'
  | 'DISCOVERING'
  | 'ENRICHING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'STOPPED_AT_LIMIT'
  | 'PAUSED';

export interface SearchJobState {
  id: string;
  category: string;
  location: string;
  status: SearchJobStatus;
  config: SearchJobConfig;
  progress: {
    batchesCompleted: number;
    candidatesProcessed: number;
    qualifiedFound: number;
    duplicatesSkipped: number;
    candidatesRejected: number;
    providerErrors: number;
  };
  cursorPosition: {
    page: number;
    offset: number;
    providerIndex: number;
    currentSource: string;
  };
  qualifiedProspects: QualifiedProspect[];
  excludedCandidates: ExcludedCandidate[];
  providerFailureCounts: Record<string, number>;
  startTime: string;
  completionTime: string | null;
  errorMessage: string | null;
}

// In-memory registry of search jobs
const activeJobs = new Map<string, SearchJobState>();

/**
 * Returns an existing job by ID or retrieves it from the `search_jobs` Neon database table.
 */
export async function getJobState(jobId: string): Promise<SearchJobState | null> {
  if (activeJobs.has(jobId)) {
    return activeJobs.get(jobId)!;
  }

  try {
    const res = await pool.query('SELECT * FROM search_jobs WHERE id = $1', [jobId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const jobState: SearchJobState = {
      id: row.id,
      category: row.category,
      location: row.location,
      status: row.status as SearchJobStatus,
      config: row.config || DEFAULT_SEARCH_CONFIG,
      progress: {
        batchesCompleted: row.candidates_processed ? Math.ceil(row.candidates_processed / (row.config?.batchSize || 50)) : 0,
        candidatesProcessed: row.candidates_processed || 0,
        qualifiedFound: row.qualified_prospects_found || 0,
        duplicatesSkipped: row.duplicates_skipped || 0,
        candidatesRejected: row.candidates_rejected || 0,
        providerErrors: Object.values(row.provider_failure_counts || {}).reduce<number>((a, b) => a + Number(b || 0), 0)
      },
      cursorPosition: row.cursor_position || { page: 1, offset: 0, providerIndex: 0, currentSource: 'osm-overpass' },
      qualifiedProspects: [],
      excludedCandidates: [],
      providerFailureCounts: row.provider_failure_counts || {},
      startTime: row.start_time ? new Date(row.start_time).toISOString() : new Date().toISOString(),
      completionTime: row.completion_time ? new Date(row.completion_time).toISOString() : null,
      errorMessage: row.error_message || null
    };

    activeJobs.set(jobId, jobState);
    return jobState;
  } catch (err: any) {
    console.warn('[SearchJobs] Database read warning:', err.message || err);
    return null;
  }
}

/**
 * Persists job summary to `search_jobs` Neon database table.
 */
async function persistJobSummary(job: SearchJobState): Promise<void> {
  try {
    await pool.query(
      `
      INSERT INTO search_jobs (
        id, category, location, status, cursor_position, start_time, completion_time,
        candidates_processed, qualified_prospects_found, duplicates_skipped,
        candidates_rejected, provider_failure_counts, config, error_message, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        cursor_position = EXCLUDED.cursor_position,
        completion_time = EXCLUDED.completion_time,
        candidates_processed = EXCLUDED.candidates_processed,
        qualified_prospects_found = EXCLUDED.qualified_prospects_found,
        duplicates_skipped = EXCLUDED.duplicates_skipped,
        candidates_rejected = EXCLUDED.candidates_rejected,
        provider_failure_counts = EXCLUDED.provider_failure_counts,
        error_message = EXCLUDED.error_message,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        job.id,
        job.category,
        job.location,
        job.status,
        JSON.stringify(job.cursorPosition),
        job.startTime,
        job.completionTime,
        job.progress.candidatesProcessed,
        job.progress.qualifiedFound,
        job.progress.duplicatesSkipped,
        job.progress.candidatesRejected,
        JSON.stringify(job.providerFailureCounts),
        JSON.stringify(job.config),
        job.errorMessage
      ]
    );
  } catch (err: any) {
    console.warn('[SearchJobs] Summary persistence warning:', err.message || err);
  }
}

/**
 * Helper to fetch a raw discovery candidate batch from available providers.
 */
async function fetchProviderCandidateBatch(
  category: string,
  location: string,
  page: number,
  offset: number
): Promise<{ candidates: RawCandidate[]; nextOffset: number; source: string; error?: string }> {
  const candidates: RawCandidate[] = [];
  const searchNiche = category.trim();
  const searchLocation = location.trim();
  const query = `${searchNiche} in ${searchLocation}`;

  // 1. Primary Source: Nominatim / OSM with pagination
  try {
    const encQuery = encodeURIComponent(query);
    const limit = 50;
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encQuery}&format=json&addressdetails=1&extratags=1&limit=${limit}&offset=${offset}`;

    const res = await safeFetchWithRedirects(nomUrl, {
      timeoutMs: 6000,
      headers: { 'User-Agent': 'AvartahProspectEngine/4.0 (contact@avartah.com)' }
    });

    if (res.ok && res.text) {
      const items = JSON.parse(res.text);
      if (Array.isArray(items) && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const place = items[i];
          const name = place.name || place.display_name?.split(',')[0];
          if (name && name.trim().length >= 2) {
            candidates.push({
              id: `osm-${place.place_id || place.osm_id || `${offset + i}`}`,
              name: name.trim(),
              location: place.display_name || searchLocation,
              latitude: parseFloat(place.lat) || undefined,
              longitude: parseFloat(place.lon) || undefined,
              phone: place.extratags?.phone || place.extratags?.['contact:phone'] || null,
              email: place.extratags?.email || place.extratags?.['contact:email'] || null,
              website_url: place.extratags?.website || place.extratags?.['contact:website'] || place.extratags?.url || null,
              type: place.type || searchNiche,
              source: 'osm-nominatim',
              source_provenance: { provider: 'osm-nominatim', query, page, offset }
            });
          }
        }
        return { candidates, nextOffset: offset + items.length, source: 'osm-nominatim' };
      }
    }
  } catch (err: any) {
    console.warn('[SearchJobs] Nominatim batch fetch warning:', err.message || err);
  }

  // 2. Secondary Source: NVIDIA NIM first (or Gemini Grounded Search fallback if configured)
  if ((process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY) && offset < 100) {
    try {
      const prompt = `Search for operating businesses matching "${searchNiche} in ${searchLocation}" (page ${page}).
Extract real published public information:
- name: Official business name
- location: Address in ${searchLocation}
- phone: Public phone number (or null)
- email: Public email address (or null)
- website_url: Website URL (or null)
- type: Industry type

Return ONLY a valid JSON array of objects with these exact keys inside a json code fence. Do not invent details.`;

      let rawText = '';
      let aiSource = 'nvidia-nim';
      if (process.env.NVIDIA_API_KEY) {
        const nvRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`
          },
          body: JSON.stringify({
            model: 'meta/llama-3.3-70b-instruct',
            messages: [
              { role: 'system', content: 'Return strictly valid JSON arrays. Never fabricate contacts.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 1500
          }),
          signal: AbortSignal.timeout(8000)
        });
        if (nvRes.ok) {
          const nvJson = (await nvRes.json()) as { choices?: Array<{ message?: { content?: string } }> };
          rawText = nvJson?.choices?.[0]?.message?.content || '';
        }
      } else if (process.env.GEMINI_API_KEY) {
        aiSource = 'google-grounding';
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] }
        });
        rawText = response.text || '';
      }

      if (rawText) {
        const match = rawText.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            for (let i = 0; i < parsed.length; i++) {
              const item = parsed[i];
              if (item && item.name) {
                const cleanName = item.name.trim();
                const stableId = `${aiSource}-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${offset + i}`;
                candidates.push({
                  id: stableId,
                  name: cleanName,
                  location: item.location || searchLocation,
                  phone: item.phone || null,
                  email: item.email || null,
                  website_url: item.website_url || null,
                  type: item.type || searchNiche,
                  source: aiSource,
                  source_provenance: { provider: aiSource, query, page }
                });
              }
            }
            return { candidates, nextOffset: offset + parsed.length, source: aiSource };
          }
        }
      }
    } catch (aiErr: any) {
      console.warn('[SearchJobs] AI batch fetch warning:', aiErr.message || aiErr);
    }
  }

  return { candidates, nextOffset: offset, source: 'none' };
}

/**
 * Executes continuous discovery job loop across multiple paginated batches.
 */
async function runSearchJobLoop(jobId: string): Promise<void> {
  const job = activeJobs.get(jobId);
  if (!job) return;

  const getLiveJobStatus = (): SearchJobStatus => activeJobs.get(jobId)?.status || job.status;
  job.status = 'DISCOVERING';
  await persistJobSummary(job);

  const seenInJobKeys = new Set<string>();

  while (
    getLiveJobStatus() === 'DISCOVERING' &&
    job.progress.qualifiedFound < job.config.targetCount &&
    job.progress.candidatesProcessed < job.config.maxCandidateBudget &&
    job.progress.batchesCompleted < job.config.maxBatches
  ) {
    // 1. Fetch raw candidate batch
    const { candidates, nextOffset, source, error } = await fetchProviderCandidateBatch(
      job.category,
      job.location,
      job.cursorPosition.page,
      job.cursorPosition.offset
    );

    if (error) {
      job.providerFailureCounts[source || 'unknown'] = (job.providerFailureCounts[source || 'unknown'] || 0) + 1;
      job.progress.providerErrors++;
    }

    if (!candidates || candidates.length === 0) {
      // Sources exhausted
      break;
    }

    // 2. Normalization & In-memory deduplication within current batch
    const uniqueCandidatesInBatch: RawCandidate[] = [];
    for (const cand of candidates) {
      const normKey = normalizeBusinessKey(cand.name, cand.location || job.location);
      if (seenInJobKeys.has(normKey)) {
        job.progress.duplicatesSkipped++;
        continue;
      }

      if (cand.website_url) {
        const dom = normalizeDomain(cand.website_url);
        if (dom && seenInJobKeys.has(`dom:${dom}`)) {
          job.progress.duplicatesSkipped++;
          continue;
        }
        if (dom) seenInJobKeys.add(`dom:${dom}`);
      }

      seenInJobKeys.add(normKey);
      uniqueCandidatesInBatch.push(cand);
    }

    // 3. Batched DB duplicate check (1 single query against Neon)
    const dbDuplicates = await checkBatchedCrmDuplicates(uniqueCandidatesInBatch);

    const freshCandidates: RawCandidate[] = [];
    for (const cand of uniqueCandidatesInBatch) {
      const normKey = normalizeBusinessKey(cand.name, cand.location || job.location);
      const phoneVal = normalizeAndValidatePhone(cand.phone);
      const emailVal = validateEmail(cand.email);
      const dom = normalizeDomain(cand.website_url);

      const isDbDup =
        dbDuplicates.existingNamesLocs.has(normKey) ||
        (phoneVal.normalizedPhone && dbDuplicates.existingPhones.has(phoneVal.normalizedPhone)) ||
        (emailVal.isValid && dbDuplicates.existingEmails.has(cand.email!.toLowerCase())) ||
        (dom && dbDuplicates.existingDomains.has(dom));

      if (isDbDup) {
        job.progress.duplicatesSkipped++;
      } else {
        freshCandidates.push(cand);
      }
    }

    // 4. Low-concurrency evaluation of fresh candidates in memory
    const batchQualified: QualifiedProspect[] = [];
    const concurrency = Math.min(Math.max(job.config.providerConcurrency || 2, 1), 5);

    for (let i = 0; i < freshCandidates.length; i += concurrency) {
      if (job.status !== 'DISCOVERING') break;
      if (job.progress.qualifiedFound >= job.config.targetCount) break;

      const chunk = freshCandidates.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (cand) => {
          job.progress.candidatesProcessed++;

          // Sanitize website URL
          let websiteUrl = cand.website_url;
          if (websiteUrl && (websiteUrl.includes('openstreetmap.org') || websiteUrl.includes('google.com/maps'))) {
            websiteUrl = null;
          }

          // Assess website quality & extract contacts
          const websiteAssessment = await inspectAndAssessWebsite(
            websiteUrl,
            job.location,
            job.config.recheckPeriodDays
          );

          let finalEmail = cand.email || websiteAssessment.email || null;
          let finalPhone = cand.phone || websiteAssessment.phone || null;
          let finalWa = websiteAssessment.whatsapp || null;

          const eVal = validateEmail(finalEmail);
          const pVal = normalizeAndValidatePhone(finalPhone, job.location);

          const contactData = {
            name: cand.name,
            email: eVal.isValid && !eVal.isPlaceholder ? finalEmail : null,
            phone: pVal.isValid && !pVal.isAddressNumber ? pVal.normalizedPhone : null,
            whatsapp_link: finalWa,
            website: websiteUrl
          };

          const isContactQualified = passesContactGate(contactData, job.location);

          // Contact gate check
          if (!isContactQualified) {
            job.progress.candidatesRejected++;
            job.excludedCandidates.push({
              id: cand.id,
              name: cand.name,
              location: cand.location,
              reason: 'Missing verified public contact details (email or telephone)',
              source: cand.source
            });
            return;
          }

          // Website opportunity gate check
          const isGoodWebsite =
            websiteAssessment.status === 'GOOD_WEBSITE' ||
            websiteAssessment.website_quality_category === 'Website appears functional and current';

          if (isGoodWebsite && !job.config.skipWebsites) {
            job.progress.candidatesRejected++;
            job.excludedCandidates.push({
              id: cand.id,
              name: cand.name,
              location: cand.location,
              reason: 'Already possesses modern functioning website (excluded by default)',
              source: cand.source,
              score: websiteAssessment.qualityScore
            });
            return;
          }

          if (job.config.skipWebsites && websiteUrl) {
            job.progress.candidatesRejected++;
            job.excludedCandidates.push({
              id: cand.id,
              name: cand.name,
              location: cand.location,
              reason: 'Targeting businesses without websites only (skipped existing site)',
              source: cand.source
            });
            return;
          }

          // Calculate qualification score out of 100
          const qualScore = calculateQualificationScore({
            status: websiteAssessment.status,
            websiteScore: websiteAssessment.qualityScore,
            hasEmail: eVal.isValid && !eVal.isPlaceholder,
            hasPhone: pVal.isValid && !pVal.isAddressNumber,
            hasWhatsApp: Boolean(finalWa),
            hasAddressOrCoords: Boolean(cand.location || (cand.latitude && cand.longitude)),
            hasLegitimateName: Boolean(cand.name && cand.name.trim().length >= 3),
            hasSourceEvidence: true,
            matchesCategory: true,
            matchesLocation: true
          });

          if (qualScore < job.config.minQualificationScore) {
            job.progress.candidatesRejected++;
            job.excludedCandidates.push({
              id: cand.id,
              name: cand.name,
              location: cand.location,
              reason: `Qualification score ${qualScore}/100 below minimum threshold ${job.config.minQualificationScore}`,
              source: cand.source,
              score: qualScore
            });
            return;
          }

          // Formulate personalized outreach drafts
          const { suggestedService, emailDraft, whatsappDraft } = generateDraftsForProspect(
            cand.name,
            cand.location || job.location,
            websiteAssessment.status,
            job.category,
            websiteUrl,
            websiteAssessment.evidence
          );

          let verificationStatus = 'Public Contact Validated';
          if (eVal.isValid && pVal.isValid) {
            verificationStatus = 'Email & Telephone Verified';
          } else if (eVal.isValid) {
            verificationStatus = `Email Validated (${finalEmail})`;
          } else if (pVal.isValid) {
            verificationStatus = `Phone Validated (${pVal.normalizedPhone})`;
          }

          const prospectItem: QualifiedProspect = {
            id: cand.id,
            business_name: cand.name,
            location: cand.location || job.location,
            phone: pVal.isValid && !pVal.isAddressNumber ? (pVal.normalizedPhone || '') : '',
            email: eVal.isValid && !eVal.isPlaceholder ? (finalEmail || '') : '',
            website_url: websiteUrl || '',
            status: websiteAssessment.status,
            website_quality_category: websiteAssessment.website_quality_category,
            website_quality_score: websiteAssessment.qualityScore,
            website_evidence: websiteAssessment.evidence,
            qualification_score: qualScore,
            whatsapp_link: finalWa || undefined,
            suggested_service: suggestedService,
            email_draft: emailDraft,
            whatsapp_draft: whatsappDraft,
            source: cand.source,
            source_provenance: cand.source_provenance || { provider: cand.source },
            contact_evidence: websiteAssessment.contactEvidence,
            verification_status: verificationStatus,
            qualification_status: 'QUALIFIED',
            reviewed_status: 'PENDING',
            outreach_status: 'NOT_CONTACTED',
            discovery_timestamp: new Date().toISOString()
          };

          batchQualified.push(prospectItem);
          job.qualifiedProspects.push(prospectItem);
          job.progress.qualifiedFound++;
        })
      );
    }

    // 5. BULK INSERT only qualified prospects from this batch
    if (batchQualified.length > 0) {
      await bulkInsertQualifiedProspects(batchQualified);
    }

    // Update cursor and batch progress
    job.progress.batchesCompleted++;
    job.cursorPosition.offset = nextOffset;
    job.cursorPosition.page++;

    // Checkpoint job summary to Neon DB
    await persistJobSummary(job);

    // Stop immediately if target reached
    if (job.progress.qualifiedFound >= job.config.targetCount) {
      break;
    }
  }

  // Set final status
  const currentStatus = getLiveJobStatus();
  if (currentStatus === 'PAUSED' || currentStatus === 'STOPPED_AT_LIMIT') {
    // Keep paused/stopped state
  } else if (job.progress.qualifiedFound >= job.config.targetCount) {
    job.status = 'COMPLETED';
    job.completionTime = new Date().toISOString();
  } else if (job.progress.candidatesProcessed >= job.config.maxCandidateBudget) {
    job.status = 'STOPPED_AT_LIMIT';
    job.completionTime = new Date().toISOString();
  } else if (job.progress.qualifiedFound > 0) {
    job.status = 'PARTIAL_SUCCESS';
    job.completionTime = new Date().toISOString();
  } else {
    job.status = 'FAILED';
    job.completionTime = new Date().toISOString();
    job.errorMessage = 'No qualified prospects found matching target criteria within candidate budget.';
  }

  await persistJobSummary(job);
}

/**
 * Starts or resumes a continuous search job.
 */
export async function startSearchJob(
  category: string,
  location: string,
  customConfig?: Partial<SearchJobConfig>
): Promise<SearchJobState> {
  const cleanCat = category.trim();
  const cleanLoc = location.trim();
  const jobId = `job_${cleanCat.toLowerCase().replace(/[^a-z0-9]/g, '-')}_${cleanLoc.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  // Check for active job
  if (activeJobs.has(jobId)) {
    const existing = activeJobs.get(jobId)!;
    if (existing.status === 'DISCOVERING' || existing.status === 'ENRICHING') {
      return existing;
    }
  }

  const config: SearchJobConfig = {
    ...DEFAULT_SEARCH_CONFIG,
    ...customConfig
  };

  const jobState: SearchJobState = {
    id: jobId,
    category: cleanCat,
    location: cleanLoc,
    status: 'DISCOVERING',
    config,
    progress: {
      batchesCompleted: 0,
      candidatesProcessed: 0,
      qualifiedFound: 0,
      duplicatesSkipped: 0,
      candidatesRejected: 0,
      providerErrors: 0
    },
    cursorPosition: { page: 1, offset: 0, providerIndex: 0, currentSource: 'osm-nominatim' },
    qualifiedProspects: [],
    excludedCandidates: [],
    providerFailureCounts: {},
    startTime: new Date().toISOString(),
    completionTime: null,
    errorMessage: null
  };

  activeJobs.set(jobId, jobState);
  await persistJobSummary(jobState);

  // Trigger continuous loop in background
  runSearchJobLoop(jobId).catch((err) => {
    console.error(`[SearchJobs] Job ${jobId} error:`, err);
    jobState.status = 'FAILED';
    jobState.errorMessage = err.message || 'Job execution failed';
    persistJobSummary(jobState).catch(console.error);
  });

  return jobState;
}

/**
 * Pauses an active job.
 */
export async function pauseSearchJob(jobId: string): Promise<SearchJobState | null> {
  const job = activeJobs.get(jobId);
  if (!job) return null;

  job.status = 'PAUSED';
  await persistJobSummary(job);
  return job;
}

/**
 * Resumes a paused job.
 */
export async function resumeSearchJob(jobId: string): Promise<SearchJobState | null> {
  const job = activeJobs.get(jobId);
  if (!job) return null;

  if (job.status === 'PAUSED' || job.status === 'PARTIAL_SUCCESS' || job.status === 'STOPPED_AT_LIMIT') {
    job.status = 'DISCOVERING';
    await persistJobSummary(job);
    runSearchJobLoop(jobId).catch(console.error);
  }

  return job;
}

/**
 * Stops a search job immediately and preserves already-qualified prospects.
 */
export async function stopSearchJob(jobId: string): Promise<SearchJobState | null> {
  const job = activeJobs.get(jobId);
  if (!job) return null;

  job.status = 'STOPPED_AT_LIMIT';
  job.completionTime = new Date().toISOString();

  if (job.qualifiedProspects.length > 0) {
    await bulkInsertQualifiedProspects(job.qualifiedProspects);
  }

  await persistJobSummary(job);
  return job;
}
