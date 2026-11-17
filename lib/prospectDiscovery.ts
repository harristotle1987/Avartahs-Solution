import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import pool from './neon.js';
import {
  cleanQueryParts,
  ContactEvidence,
  escapeOverpassValue,
  expandBusinessCategory,
  extractCanonicalKeys,
  extractContactsFromHtml,
  extractMetaTagContacts,
  extractSchemaOrgContacts,
  extractSocialLinksFromHtml,
  inferSourceTypeFromUrl,
  isSafeUrl,
  isSocialOrDirectoryDomain,
  mapInternalStatusToCategory,
  normalizeAndValidatePhone,
  normalizeDomain,
  parseOsmElementToBusiness,
  passesContactGate,
  researchPublicContactsForBusiness,
  safeFetchWithRedirects,
  validateEmail,
  WebsiteQualityCategory
} from './prospects.js';

export const PROSPECT_ENGINE_LIMITS = {
  minTarget: 15,
  maxTarget: 20,
  defaultTarget: 20,
  rawBatchSize: 50,
  enrichmentConcurrency: 3,
  maxRawCandidates: 500,
  maxProviderRequests: 16,
  maxJobDurationMs: 38000,
  nominatimMinSpacingMs: 1100,
  providerTimeoutMs: 6500,
  websiteTimeoutMs: 4000,
  geocodeCacheTtlMs: 30 * 60 * 1000,
  queryExpansionCacheTtlMs: 30 * 60 * 1000,
  domainAssessmentTtlMs: 24 * 60 * 60 * 1000,
  maxRetriesOnRateLimit: 2,
  overpassCooldownBaseMs: 15000,
  overpassCooldownMaxMs: 300000,
  nominatimCooldownBaseMs: 30000,
  nominatimCooldownMaxMs: 300000,
  geminiCooldownMs: 60000,
  nvidiaCooldownMs: 60000,
  jobHistoryMaxEntries: 25,
  maxPublicResearchQueries: 12
} as const;

export type ProspectEngineLimits = {
  -readonly [K in keyof typeof PROSPECT_ENGINE_LIMITS]: number;
};

export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
] as const;

export type DiscoveryJobStatus =
  | 'DISCOVERING'
  | 'ENRICHING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'STOPPED';

export interface DiscoveryMetrics {
  discovered: number;
  unique: number;
  website_opportunities: number;
  no_official_website: number;
  public_phone_found: number;
  public_email_found: number;
  phone_only: number;
  contact_qualified: number;
  contact_verified: number;
  website_qualified: number;
  newly_qualified: number;
  qualified: number;
  duplicates: number;
  batch_duplicates: number;
  existing_crm_matches: number;
  excluded_good_websites: number;
  excluded: number;
  provider_failures: number;
}

export interface DiscoveryDbStats {
  dbReads: number;
  dbWrites: number;
  rowsInserted: number;
  rowsUpdated: number;
  excludedInserts: number;
}

export interface DiscoveryProviderStats {
  overpassQueries: number;
  nominatimQueries: number;
  groundingQueries: number;
  nvidiaQueries: number;
  publicResearchQueries: number;
  cacheHits: number;
  providerFailures: string[];
  cooldownsTriggered: string[];
  stopReason: string;
}

export interface EvaluatedProspectRecord {
  id: string;
  canonical_key: string;
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  website: string;
  status:
    | 'NO_WEBSITE'
    | 'BROKEN_WEBSITE'
    | 'OUTDATED_WEBSITE'
    | 'GOOD_WEBSITE'
    | 'NEEDS_REVIEW'
    | 'NEEDS_CONTACT';
  website_quality_category: WebsiteQualityCategory;
  website_availability: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  website_quality_score: number;
  evidence: string;
  whatsapp_link?: string;
  whatsapp_unconfirmed: boolean;
  social_profiles?: Record<string, string | null>;
  type: string;
  country: string;
  source: string;
  source_provenance: Record<string, unknown>;
  contact_evidence: ContactEvidence[];
  sources_checked: string[];
  has_public_email: boolean;
  has_public_phone: boolean;
  phone_only: boolean;
  isTemporary: boolean;
  discovery_timestamp: string;
  verification_status: string;
  qualified: boolean;
  isDuplicate: boolean;
  isExistingRecord: boolean;
  reviewed_status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';
  crm_lead_id: string | null;
  promoted_at: string | null;
  suggested_service: string;
  email_draft: string;
  whatsapp_draft: string;
  outreach_status: string;
}

export interface DiscoveryJobSnapshot {
  jobId: string;
  adminEmail: string;
  query: string;
  niche: string;
  location: string;
  targetCount: number;
  status: DiscoveryJobStatus;
  stageMessage: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  batchesProcessed: number;
  metrics: DiscoveryMetrics;
  dbStats: DiscoveryDbStats;
  providerStats: DiscoveryProviderStats;
  error: string | null;
  errorCode: string | null;
}

export interface DiscoveryRunInput {
  query: string;
  skipWebsites?: boolean;
  targetCount?: number | string;
  adminEmail: string;
  clientJobId?: string;
}

export interface DiscoveryRunResult {
  httpStatus: number;
  body: {
    success: boolean;
    jobId: string;
    status: DiscoveryJobStatus;
    results: EvaluatedProspectRecord[];
    existingMatches: EvaluatedProspectRecord[];
    needsContact: EvaluatedProspectRecord[];
    excludedGoodWebsites: EvaluatedProspectRecord[];
    metrics: DiscoveryMetrics;
    db_stats: DiscoveryDbStats;
    expandedQueries: string[];
    source: string;
    location_resolved: string;
    shortfall_explanation: string | null;
    provider_stats: DiscoveryProviderStats;
    search_duration_ms: number;
    providerError: boolean;
    error?: string;
    errorCode?: string;
    activeJobId?: string;
  };
}

export interface DbQueryExecutor {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface SafeFetchOutcome {
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
  error?: string;
}

export interface GeminiGroundingInput {
  apiKey: string;
  model: string;
  prompt: string;
  signal?: AbortSignal;
}

export interface NvidiaGenerateInput {
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface DiscoveryDependencies {
  db?: DbQueryExecutor;
  fetchFn?: typeof fetch;
  safeFetchFn?: (
    url: string,
    opts?: { maxRedirects?: number; timeoutMs?: number; maxResponseBodyBytes?: number; headers?: Record<string, string> }
  ) => Promise<SafeFetchOutcome>;
  nvidiaGenerateFn?: (input: NvidiaGenerateInput) => Promise<string>;
  geminiGenerateFn?: (input: GeminiGroundingInput) => Promise<string>;
  sleepFn?: (ms: number) => Promise<void>;
  nowFn?: () => number;
  nvidiaApiKey?: string;
  geminiApiKey?: string;
  limits?: Partial<ProspectEngineLimits>;
}

interface ProviderHealthState {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastError?: string;
}

interface GeocodeCacheEntry {
  lat: number;
  lon: number;
  displayName: string;
  countryContext: string;
  expiresAt: number;
}

interface DomainAssessmentSummary {
  status: 'NO_WEBSITE' | 'BROKEN_WEBSITE' | 'OUTDATED_WEBSITE' | 'GOOD_WEBSITE' | 'NEEDS_REVIEW';
  website_quality_category: WebsiteQualityCategory;
  website_availability: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  qualityScore: number;
  evidence: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  socialProfiles?: Record<string, string>;
  pagesScraped?: string[];
  contactEvidence: ContactEvidence[];
  whatsapp_unconfirmed: boolean;
  checkedAt: string;
  expiresAt: number;
}

interface RawCandidate {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  whatsapp_link?: string | null;
  social_profiles?: Record<string, string | null>;
  type: string;
  source: string;
  source_provenance: Record<string, unknown>;
}

interface ExistingProspectRow {
  id: string;
  business_name: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  reviewed_status: string | null;
  crm_lead_id: string | null;
  promoted_at: string | Date | null;
  outreach_status: string | null;
  suggested_service: string | null;
  email_draft: string | null;
  whatsapp_draft: string | null;
  verification_status: string | null;
}

export function clampTargetCount(requested?: number | string): number {
  const num = Number(requested);
  if (!Number.isFinite(num) || num <= 0) {
    return PROSPECT_ENGINE_LIMITS.defaultTarget;
  }
  return Math.min(Math.max(Math.trunc(num), PROSPECT_ENGINE_LIMITS.minTarget), PROSPECT_ENGINE_LIMITS.maxTarget);
}

export function sanitizeDiscoveryQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function buildDeterministicProspectId(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed.toLowerCase()).digest('hex');
  return `prs_${hash.slice(0, 24)}`;
}

export function parseRetryAfterMs(headerVal: string | null | undefined, nowMs: number): number | null {
  if (!headerVal) return null;
  const trimmed = headerVal.trim();
  if (/^\d+$/.test(trimmed)) {
    const secs = parseInt(trimmed, 10);
    return secs > 0 ? Math.min(secs * 1000, 300_000) : null;
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate) && parsedDate > nowMs) {
    return Math.min(parsedDate - nowMs, 300_000);
  }
  return null;
}

function createAbortError(message: string): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

function combineSignals(timeoutMs: number, jobSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!jobSignal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([timeoutSignal, jobSignal]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (jobSignal.aborted || timeoutSignal.aborted) {
    controller.abort();
    return controller.signal;
  }
  jobSignal.addEventListener('abort', abort, { once: true });
  timeoutSignal.addEventListener('abort', abort, { once: true });
  return controller.signal;
}

function isPermanent4xx(status: number): boolean {
  return status >= 400 && status < 500 && status !== 429 && status !== 408;
}

function classifySocialProfileHost(domain: string | null): string {
  if (!domain) return 'social';
  if (domain.includes('instagram')) return 'instagram';
  if (domain.includes('facebook') || domain.includes('fb.com')) return 'facebook';
  if (domain.includes('linkedin')) return 'linkedin';
  if (domain.includes('twitter') || domain === 'x.com') return 'twitter';
  return 'directory';
}

function generateSuggestedService(status?: string | null): string {
  if (!status || status === 'NO_WEBSITE') {
    return 'Custom Web Architecture & Mobile-First Booking Engine';
  }
  if (status === 'BROKEN_WEBSITE') {
    return 'Emergency Infrastructure Rebuild & Modern Domain Recovery';
  }
  if (status === 'OUTDATED_WEBSITE') {
    return 'Modern High-Performance Redesign & Mobile Conversion Funnel';
  }
  return 'Digital Authority & Local Search Engine Optimization';
}

function generatePersonalizedEmailDraft(
  name: string,
  location: string,
  niche: string,
  status?: string | null,
  websiteUrl?: string | null,
  evidence?: string
): string {
  const cleanName = name || 'Business Owner';
  const cleanLoc = location || 'your area';
  if (!websiteUrl || status === 'NO_WEBSITE') {
    return `Dear ${cleanName} Team,\n\nI came across ${cleanName} in ${cleanLoc} and was impressed by your local reputation in the ${niche} sector. While reviewing your digital footprint, I noticed that your business does not currently have a dedicated, mobile-optimized website.\n\nAt Avartah Solutions, we build high-converting web architecture, automated appointment booking systems, and digital infrastructure tailored to help local businesses capture bookings 24/7.\n\nWould you be open to a brief 10-minute consultation this week to review tailored recommendations for ${cleanName}?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
  }
  if (status === 'BROKEN_WEBSITE') {
    return `Dear ${cleanName} Team,\n\nI was reviewing your business listing for ${cleanName} in ${cleanLoc} and noticed that your registered website (${websiteUrl}) is currently inaccessible (${evidence || 'persistent connection error'}).\n\nAt Avartah Solutions, we specialize in high-availability web recovery and modern conversion-focused web engineering.\n\nWe would be glad to help restore and modernize your online presence cleanly. Would you have 10 minutes for a quick chat this week?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
  }
  return `Dear ${cleanName} Team,\n\nI recently reviewed ${cleanName}'s online presence (${websiteUrl}) in ${cleanLoc} and noted key opportunities to strengthen mobile responsiveness and conversion speed (${evidence || 'website audit findings'}).\n\nAt Avartah Solutions, we re-engineer local business websites into fast, mobile-first client booking engines.\n\nWould you be open to a brief 10-minute call this week to share our audit notes?\n\nBest regards,\nHarrison Oyeghe\nPrincipal Engineer, Avartah Solutions\nharrison@avartah.com | https://avartah.com`;
}

function generatePersonalizedWhatsAppDraft(
  name: string,
  status?: string | null,
  location?: string,
  websiteUrl?: string | null
): string {
  const cleanName = name || 'Business Owner';
  const cleanLoc = location || 'your area';
  if (!websiteUrl || status === 'NO_WEBSITE') {
    return `Hello ${cleanName} team! Harrison from Avartah Solutions here. We noticed your business in ${cleanLoc} and love your work. We help local businesses scale client bookings with mobile-first websites. Would you be open to a quick 5-minute chat?`;
  }
  if (status === 'BROKEN_WEBSITE') {
    return `Hi ${cleanName} team! Harrison from Avartah Solutions here. We noticed your website (${websiteUrl}) is currently returning errors. We help businesses recover and upgrade their web infrastructure. Open to a quick chat?`;
  }
  return `Hello ${cleanName} team! Harrison from Avartah here. We reviewed ${websiteUrl} and spotted practical ways to boost mobile loading and client bookings. Open to a quick 5-minute review?`;
}

async function defaultNvidiaGenerate(
  input: NvidiaGenerateInput,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(input.timeoutMs || PROSPECT_ENGINE_LIMITS.providerTimeoutMs);
  const combinedSignal =
    input.signal && typeof (AbortSignal as any).any === 'function'
      ? (AbortSignal as any).any([input.signal, timeoutSignal])
      : input.signal || timeoutSignal;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (input.systemPrompt) {
    messages.push({ role: 'system', content: input.systemPrompt });
  }
  messages.push({ role: 'user', content: input.prompt });

  const response = await fetchFn('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`
    },
    body: JSON.stringify({
      model: input.model || 'meta/llama-3.3-70b-instruct',
      messages,
      temperature: 0.1,
      max_tokens: 2048
    }),
    signal: combinedSignal
  });

  if (!response.ok) {
    const err = new Error(`NVIDIA NIM HTTP ${response.status}`) as Error & {
      status?: number;
      retryAfter?: string | null;
    };
    err.status = response.status;
    err.retryAfter = response.headers.get('retry-after');
    throw err;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data?.choices?.[0]?.message?.content || '';
}

async function defaultGeminiGenerate(input: GeminiGroundingInput): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: input.apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
  const response = await ai.models.generateContent({
    model: input.model,
    contents: input.prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });
  return response.text || '';
}

export class ProspectDiscoveryEngine {
  private readonly db: DbQueryExecutor;
  private readonly fetchFn: typeof fetch;
  private readonly safeFetchFn: NonNullable<DiscoveryDependencies['safeFetchFn']>;
  private readonly nvidiaGenerateFn: NonNullable<DiscoveryDependencies['nvidiaGenerateFn']>;
  private readonly geminiGenerateFn: NonNullable<DiscoveryDependencies['geminiGenerateFn']>;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private readonly nowFn: () => number;
  private readonly nvidiaApiKey?: string;
  private readonly geminiApiKey?: string;
  public readonly limits: ProspectEngineLimits;

  private readonly providerHealth = new Map<string, ProviderHealthState>();
  private readonly geocodeCache = new Map<string, GeocodeCacheEntry>();
  private readonly queryExpansionCache = new Map<string, { expandedTerms: string[]; osmTagClauses: string[]; normalizedNiche: string; expiresAt: number }>();
  private readonly domainAssessmentCache = new Map<string, DomainAssessmentSummary>();

  private lastNominatimRequestAt = 0;
  private nominatimMutex: Promise<void> = Promise.resolve();

  private readonly jobs = new Map<string, DiscoveryJobSnapshot>();
  private readonly jobHistoryOrder: string[] = [];
  private readonly jobControllers = new Map<string, AbortController>();
  private readonly activeConcurrentKeys = new Map<string, string>();

  constructor(deps: DiscoveryDependencies = {}) {
    this.db = deps.db || pool;
    this.fetchFn = deps.fetchFn || fetch;
    this.safeFetchFn = deps.safeFetchFn || safeFetchWithRedirects;
    this.nvidiaGenerateFn = deps.nvidiaGenerateFn || ((input) => defaultNvidiaGenerate(input, this.fetchFn));
    this.geminiGenerateFn = deps.geminiGenerateFn || defaultGeminiGenerate;
    this.sleepFn = deps.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.nowFn = deps.nowFn || (() => Date.now());
    this.nvidiaApiKey = deps.nvidiaApiKey !== undefined ? deps.nvidiaApiKey : process.env.NVIDIA_API_KEY;
    this.geminiApiKey = deps.geminiApiKey !== undefined ? deps.geminiApiKey : process.env.GEMINI_API_KEY;
    this.limits = { ...PROSPECT_ENGINE_LIMITS, ...(deps.limits || {}) };
  }

  public getHealthStateSnapshot(): Record<string, ProviderHealthState> {
    const out: Record<string, ProviderHealthState> = {};
    for (const [k, v] of this.providerHealth.entries()) {
      out[k] = { ...v };
    }
    return out;
  }

  public getJobStatus(jobId: string): DiscoveryJobSnapshot | null {
    const job = this.jobs.get(jobId);
    return job ? this.cloneSnapshot(job) : null;
  }

  public getJobHistory(adminEmail?: string): DiscoveryJobSnapshot[] {
    const results: DiscoveryJobSnapshot[] = [];
    for (let i = this.jobHistoryOrder.length - 1; i >= 0; i--) {
      const snap = this.jobs.get(this.jobHistoryOrder[i]);
      if (!snap) continue;
      if (adminEmail && snap.adminEmail.toLowerCase() !== adminEmail.toLowerCase()) continue;
      results.push(this.cloneSnapshot(snap));
    }
    return results;
  }

  public stopJob(jobId: string, adminEmail?: string): { found: boolean; stopped: boolean; status?: DiscoveryJobStatus } {
    const snap = this.jobs.get(jobId);
    if (!snap) return { found: false, stopped: false };
    if (adminEmail && snap.adminEmail.toLowerCase() !== adminEmail.toLowerCase()) {
      return { found: false, stopped: false };
    }
    if (snap.status === 'DISCOVERING' || snap.status === 'ENRICHING') {
      snap.status = 'STOPPED';
      snap.stageMessage = 'Stopped by administrator.';
      snap.providerStats.stopReason = 'admin_stopped';
      const controller = this.jobControllers.get(jobId);
      if (controller && !controller.signal.aborted) {
        controller.abort(createAbortError('Stopped by administrator'));
      }
      return { found: true, stopped: true, status: 'STOPPED' };
    }
    return { found: true, stopped: false, status: snap.status };
  }

  private cloneSnapshot(snap: DiscoveryJobSnapshot): DiscoveryJobSnapshot {
    return {
      ...snap,
      metrics: { ...snap.metrics },
      dbStats: { ...snap.dbStats },
      providerStats: {
        ...snap.providerStats,
        providerFailures: [...snap.providerStats.providerFailures],
        cooldownsTriggered: [...snap.providerStats.cooldownsTriggered]
      }
    };
  }

  private recordJobSnapshot(snap: DiscoveryJobSnapshot): void {
    this.jobs.set(snap.jobId, snap);
    if (!this.jobHistoryOrder.includes(snap.jobId)) {
      this.jobHistoryOrder.push(snap.jobId);
      while (this.jobHistoryOrder.length > this.limits.jobHistoryMaxEntries) {
        const oldestId = this.jobHistoryOrder.shift();
        if (oldestId && !this.jobControllers.has(oldestId)) {
          this.jobs.delete(oldestId);
        }
      }
    }
  }

  private isProviderInCooldown(providerKey: string): boolean {
    const state = this.providerHealth.get(providerKey);
    if (!state) return false;
    return state.cooldownUntil > this.nowFn();
  }

  private markProviderSuccess(providerKey: string): void {
    this.providerHealth.set(providerKey, {
      consecutiveFailures: 0,
      cooldownUntil: 0
    });
  }

  private markProviderFailure(
    providerKey: string,
    baseCooldownMs: number,
    maxCooldownMs: number,
    reason: string,
    retryAfterHeader?: string | null
  ): number {
    const prev = this.providerHealth.get(providerKey) || { consecutiveFailures: 0, cooldownUntil: 0 };
    const failures = prev.consecutiveFailures + 1;
    const now = this.nowFn();
    const retryAfterMs = parseRetryAfterMs(retryAfterHeader, now);
    const backoffMs = retryAfterMs ?? Math.min(maxCooldownMs, baseCooldownMs * Math.pow(2, failures - 1));
    this.providerHealth.set(providerKey, {
      consecutiveFailures: failures,
      cooldownUntil: now + backoffMs,
      lastError: reason
    });
    return backoffMs;
  }

  private async sleepCancellable(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) throw createAbortError('Job aborted');
    await Promise.race([
      this.sleepFn(ms),
      new Promise<never>((_resolve, reject) => {
        if (!signal) return;
        const onAbort = () => reject(createAbortError('Job aborted'));
        signal.addEventListener('abort', onAbort, { once: true });
      })
    ]);
  }

  private async enqueueNominatimSpacing(signal?: AbortSignal): Promise<void> {
    const prev = this.nominatimMutex;
    let release!: () => void;
    this.nominatimMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await prev;
      if (signal?.aborted) throw createAbortError('Job aborted');
      const now = this.nowFn();
      const elapsed = now - this.lastNominatimRequestAt;
      if (this.lastNominatimRequestAt > 0 && elapsed < this.limits.nominatimMinSpacingMs) {
        const waitMs = this.limits.nominatimMinSpacingMs - elapsed;
        await this.sleepCancellable(waitMs, signal);
      }
      this.lastNominatimRequestAt = this.nowFn();
    } finally {
      release();
    }
  }

  private async fetchWithProviderBackoff(
    providerKey: string,
    url: string,
    init: RequestInit,
    opts: {
      baseCooldownMs: number;
      maxCooldownMs: number;
      maxRetries: number;
      jobSignal?: AbortSignal;
      providerStats: DiscoveryProviderStats;
    }
  ): Promise<Response | null> {
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      if (opts.jobSignal?.aborted) throw createAbortError('Job aborted');
      try {
        const response = await this.fetchFn(url, {
          ...init,
          signal: combineSignals(this.limits.providerTimeoutMs, opts.jobSignal)
        });

        if (response.ok) {
          this.markProviderSuccess(providerKey);
          return response;
        }

        if (isPermanent4xx(response.status)) {
          if (response.status === 401 || response.status === 403) {
            this.markProviderFailure(
              providerKey,
              opts.baseCooldownMs,
              opts.maxCooldownMs,
              `HTTP ${response.status} permanent`
            );
          }
          opts.providerStats.providerFailures.push(`${providerKey} HTTP ${response.status} (no retry)`);
          return response;
        }

        if (response.status === 429 || response.status >= 500) {
          const retryAfter = response.headers?.get?.('retry-after') || null;
          const jitter = Math.floor(Math.random() * 150);
          const cooldownMs = this.markProviderFailure(
            providerKey,
            opts.baseCooldownMs,
            opts.maxCooldownMs,
            `HTTP ${response.status}`,
            retryAfter
          );
          opts.providerStats.providerFailures.push(`${providerKey} HTTP ${response.status}`);
          opts.providerStats.cooldownsTriggered.push(`${providerKey}:${Math.round(cooldownMs / 1000)}s`);

          // Do not immediately spin on an exhausted 429 quota
          if (response.status === 429) {
            return response;
          }
          if (attempt < opts.maxRetries) {
            await this.sleepCancellable(Math.min(1200, 300 * Math.pow(2, attempt)) + jitter, opts.jobSignal);
            continue;
          }
          return response;
        }

        return response;
      } catch (err: any) {
        if (opts.jobSignal?.aborted) throw createAbortError('Job aborted');
        const msg = err?.name === 'TimeoutError' ? 'timeout' : (err?.message || 'network error');
        const cooldownMs = this.markProviderFailure(
          providerKey,
          opts.baseCooldownMs,
          opts.maxCooldownMs,
          msg
        );
        opts.providerStats.providerFailures.push(`${providerKey}: ${msg}`);
        opts.providerStats.cooldownsTriggered.push(`${providerKey}:${Math.round(cooldownMs / 1000)}s`);
        if (attempt < opts.maxRetries) {
          await this.sleepCancellable(250 * (attempt + 1), opts.jobSignal);
          continue;
        }
        return null;
      }
    }
    return null;
  }

  private getExpandedCategoryCached(niche: string) {
    const key = niche.trim().toLowerCase();
    const now = this.nowFn();
    const cached = this.queryExpansionCache.get(key);
    if (cached && cached.expiresAt > now) {
      return {
        normalizedNiche: cached.normalizedNiche,
        expandedTerms: [...cached.expandedTerms],
        osmTagClauses: [...cached.osmTagClauses],
        fromCache: true
      };
    }
    const fresh = expandBusinessCategory(niche);
    this.queryExpansionCache.set(key, {
      ...fresh,
      expiresAt: now + this.limits.queryExpansionCacheTtlMs
    });
    return { ...fresh, fromCache: false };
  }

  private async geocodeLocationCached(
    searchLocation: string,
    providerStats: DiscoveryProviderStats,
    budgetState: { providerRequests: number },
    jobSignal?: AbortSignal
  ): Promise<{ lat: number; lon: number; displayName: string; countryContext: string }> {
    const cacheKey = searchLocation.trim().toLowerCase();
    const now = this.nowFn();
    const cached = this.geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      providerStats.cacheHits++;
      return {
        lat: cached.lat,
        lon: cached.lon,
        displayName: cached.displayName,
        countryContext: cached.countryContext
      };
    }

    if (this.isProviderInCooldown('nominatim')) {
      providerStats.providerFailures.push('nominatim skipped (in cooldown)');
      return { lat: 0, lon: 0, displayName: searchLocation, countryContext: searchLocation };
    }

    if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
      return { lat: 0, lon: 0, displayName: searchLocation, countryContext: searchLocation };
    }

    await this.enqueueNominatimSpacing(jobSignal);
    budgetState.providerRequests++;
    providerStats.nominatimQueries++;

    const res = await this.fetchWithProviderBackoff(
      'nominatim',
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchLocation)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'AvartahProspectFinder/3.0 (contact@avartah.com)' } },
      {
        baseCooldownMs: this.limits.nominatimCooldownBaseMs,
        maxCooldownMs: this.limits.nominatimCooldownMaxMs,
        maxRetries: 1,
        jobSignal,
        providerStats
      }
    );

    if (res && res.ok) {
      const locs = await res.json().catch(() => null);
      if (Array.isArray(locs) && locs.length > 0) {
        const lat = parseFloat(locs[0].lat) || 0;
        const lon = parseFloat(locs[0].lon) || 0;
        const displayName = String(locs[0].display_name || searchLocation);
        this.geocodeCache.set(cacheKey, {
          lat,
          lon,
          displayName,
          countryContext: displayName,
          expiresAt: this.nowFn() + this.limits.geocodeCacheTtlMs
        });
        return { lat, lon, displayName, countryContext: displayName };
      }
    }

    return { lat: 0, lon: 0, displayName: searchLocation, countryContext: searchLocation };
  }

  private async fetchOverpassRing(
    areaLat: number,
    areaLon: number,
    radiusMeters: number,
    normalizedNiche: string,
    osmTagClauses: string[],
    resolvedAreaName: string,
    providerStats: DiscoveryProviderStats,
    budgetState: { providerRequests: number },
    jobSignal?: AbortSignal
  ): Promise<{ candidates: RawCandidate[]; ok: boolean }> {
    if (areaLat === 0 && areaLon === 0) return { candidates: [], ok: false };
    if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
      return { candidates: [], ok: false };
    }

    const escapedNiche = escapeOverpassValue(normalizedNiche);
    const tagQueries = osmTagClauses.map((clause) => `${clause}(around:${radiusMeters},${areaLat},${areaLon});`).join('');
    const overpassQuery = `[out:json][timeout:15];(${tagQueries}nwr["name"~"${escapedNiche}",i](around:${radiusMeters},${areaLat},${areaLon}););out center 150;`;

    // Choose up to 2 healthy mirrors (primary + at most 1 fallback) to avoid hammering all mirrors on each search
    const healthyMirrors = OVERPASS_MIRRORS.filter((m) => !this.isProviderInCooldown(`overpass:${m}`));
    const mirrorsToTry = healthyMirrors.slice(0, 2);

    if (mirrorsToTry.length === 0) {
      providerStats.providerFailures.push('All Overpass mirrors are currently in cooldown');
      return { candidates: [], ok: false };
    }

    for (const mirror of mirrorsToTry) {
      if (budgetState.providerRequests >= this.limits.maxProviderRequests) break;
      budgetState.providerRequests++;
      providerStats.overpassQueries++;

      const opRes = await this.fetchWithProviderBackoff(
        `overpass:${mirror}`,
        mirror,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AvartahProspectFinder/3.0 (contact@avartah.com)'
          },
          body: 'data=' + encodeURIComponent(overpassQuery)
        },
        {
          baseCooldownMs: this.limits.overpassCooldownBaseMs,
          maxCooldownMs: this.limits.overpassCooldownMaxMs,
          maxRetries: 0,
          jobSignal,
          providerStats
        }
      );

      if (opRes && opRes.ok) {
        const opData = await opRes.json().catch(() => null);
        if (opData && Array.isArray(opData.elements)) {
          const candidates: RawCandidate[] = [];
          for (const el of opData.elements) {
            const parsed = parseOsmElementToBusiness(el, resolvedAreaName);
            if (parsed) candidates.push(parsed);
          }
          return { candidates, ok: true };
        }
        providerStats.providerFailures.push(`overpass:${mirror} returned malformed payload`);
      }
    }

    return { candidates: [], ok: false };
  }

  private async fetchNominatimVariation(
    poiQuery: string,
    resolvedAreaName: string,
    providerStats: DiscoveryProviderStats,
    budgetState: { providerRequests: number },
    jobSignal?: AbortSignal
  ): Promise<{ candidates: RawCandidate[]; ok: boolean; rateLimited: boolean }> {
    if (this.isProviderInCooldown('nominatim')) {
      return { candidates: [], ok: false, rateLimited: true };
    }
    if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
      return { candidates: [], ok: false, rateLimited: false };
    }

    await this.enqueueNominatimSpacing(jobSignal);
    budgetState.providerRequests++;
    providerStats.nominatimQueries++;

    const nomRes = await this.fetchWithProviderBackoff(
      'nominatim',
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(poiQuery)}&format=json&addressdetails=1&extratags=1&limit=50`,
      { headers: { 'User-Agent': 'AvartahProspectFinder/3.0 (contact@avartah.com)' } },
      {
        baseCooldownMs: this.limits.nominatimCooldownBaseMs,
        maxCooldownMs: this.limits.nominatimCooldownMaxMs,
        maxRetries: 0,
        jobSignal,
        providerStats
      }
    );

    if (!nomRes) return { candidates: [], ok: false, rateLimited: false };
    if (nomRes.status === 429) return { candidates: [], ok: false, rateLimited: true };
    if (!nomRes.ok) return { candidates: [], ok: false, rateLimited: false };

    const nomData = await nomRes.json().catch(() => null);
    if (!Array.isArray(nomData)) {
      providerStats.providerFailures.push(`nominatim malformed response for "${poiQuery}"`);
      return { candidates: [], ok: false, rateLimited: false };
    }

    const candidates: RawCandidate[] = [];
    for (const place of nomData) {
      const parsed = parseOsmElementToBusiness(place, resolvedAreaName);
      if (parsed) {
        candidates.push({
          ...parsed,
          source: 'osm-nominatim-poi',
          source_provenance: {
            ...parsed.source_provenance,
            provider: 'osm-nominatim-poi',
            query: poiQuery
          }
        });
      }
    }

    return { candidates, ok: true, rateLimited: false };
  }

  private async fetchNvidiaDiscoveryPass(
    sanitizedQuery: string,
    searchNiche: string,
    searchLocation: string,
    resolvedAreaName: string,
    areaLat: number,
    areaLon: number,
    neededCount: number,
    providerStats: DiscoveryProviderStats,
    budgetState: { providerRequests: number },
    jobSignal?: AbortSignal
  ): Promise<{ candidates: RawCandidate[]; ok: boolean }> {
    if (!this.nvidiaApiKey) return { candidates: [], ok: false };
    if (this.isProviderInCooldown('nvidia-nim')) {
      providerStats.providerFailures.push('nvidia-nim skipped (in cooldown)');
      return { candidates: [], ok: false };
    }
    if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
      return { candidates: [], ok: false };
    }

    budgetState.providerRequests++;
    providerStats.nvidiaQueries++;

    const requestCount = Math.min(Math.max(neededCount * 2, 15), 35);
    const prompt = `List up to ${requestCount} real, currently operating local businesses matching "${searchNiche}" in "${searchLocation}".
For each business, provide only real published information you know with confidence:
- name: Official business name
- location: Street address or neighborhood in ${searchLocation}
- phone: Public business telephone number (if known, else null)
- email: Public business email (if known, else null — NEVER invent or guess hello@/info@ placeholders)
- website_url: Official website URL (if known, else null)
- type: Specific category (e.g. Day Spa, Law Firm, Dental Clinic)

Return ONLY a valid JSON array inside a json code block. Use null for any unknown phone, email, or website_url.`;

    try {
      const text = await this.nvidiaGenerateFn({
        apiKey: this.nvidiaApiKey,
        model: 'meta/llama-3.3-70b-instruct',
        systemPrompt:
          'You are a strict commercial business directory extractor. Return strictly valid JSON arrays. Never fabricate phone numbers, email addresses, or domain names.',
        prompt,
        timeoutMs: this.limits.providerTimeoutMs,
        signal: jobSignal
      });
      this.markProviderSuccess('nvidia-nim');

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        return { candidates: [], ok: true };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        providerStats.providerFailures.push('nvidia-nim returned malformed JSON');
        return { candidates: [], ok: false };
      }
      if (!Array.isArray(parsed)) return { candidates: [], ok: true };

      const candidates: RawCandidate[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i] as Record<string, any>;
        if (item && typeof item.name === 'string' && item.name.trim()) {
          const itemLoc = typeof item.location === 'string' && item.location.trim() ? item.location.trim() : resolvedAreaName;
          const seed = `${item.name.trim()}|${itemLoc}|${item.website_url || ''}|${item.phone || ''}`;
          candidates.push({
            id: buildDeterministicProspectId(`nvidia:${seed}`),
            name: item.name.trim(),
            location: itemLoc,
            latitude: areaLat,
            longitude: areaLon,
            phone: typeof item.phone === 'string' ? item.phone : null,
            email: typeof item.email === 'string' ? item.email : null,
            website_url: typeof item.website_url === 'string' ? item.website_url : null,
            type: typeof item.type === 'string' && item.type.trim() ? item.type.trim() : searchNiche,
            source: 'nvidia-nim',
            source_provenance: {
              provider: 'nvidia-nim',
              model: 'meta/llama-3.3-70b-instruct',
              query: sanitizedQuery,
              checked_at: new Date(this.nowFn()).toISOString()
            }
          });
        }
      }
      return { candidates, ok: true };
    } catch (err: any) {
      if (jobSignal?.aborted) throw createAbortError('Job aborted');
      const errMsg = String(err?.message || err);
      const httpStatus = typeof err?.status === 'number' ? err.status : undefined;
      const retryAfterHeader = typeof err?.retryAfter === 'string' ? err.retryAfter : null;
      const cooldownMs = this.markProviderFailure(
        'nvidia-nim',
        httpStatus === 401 || httpStatus === 403 ? this.limits.nvidiaCooldownMs * 3 : this.limits.nvidiaCooldownMs,
        this.limits.nvidiaCooldownMs * 5,
        errMsg,
        retryAfterHeader
      );
      providerStats.providerFailures.push(
        httpStatus === 429 || errMsg.includes('429')
          ? 'nvidia-nim rate limited (429)'
          : httpStatus === 401 || httpStatus === 403
          ? `nvidia-nim auth error (${httpStatus})`
          : 'nvidia-nim error'
      );
      providerStats.cooldownsTriggered.push(`nvidia-nim:${Math.round(cooldownMs / 1000)}s`);
      return { candidates: [], ok: false };
    }
  }

  private async fetchGeminiGroundingPass(
    sanitizedQuery: string,
    searchNiche: string,
    searchLocation: string,
    resolvedAreaName: string,
    areaLat: number,
    areaLon: number,
    neededCount: number,
    providerStats: DiscoveryProviderStats,
    budgetState: { providerRequests: number },
    jobSignal?: AbortSignal
  ): Promise<{ candidates: RawCandidate[]; ok: boolean }> {
    if (!this.geminiApiKey) return { candidates: [], ok: false };
    if (this.isProviderInCooldown('gemini-grounding')) {
      providerStats.providerFailures.push('gemini-grounding skipped (in cooldown)');
      return { candidates: [], ok: false };
    }
    if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
      return { candidates: [], ok: false };
    }

    budgetState.providerRequests++;
    providerStats.groundingQueries++;

    const requestCount = Math.min(Math.max(neededCount * 2, 20), 40);
    const prompt = `Search Google for real registered businesses matching: "${searchNiche} in ${searchLocation}".
Find up to ${requestCount} real, currently operating local businesses in that specific location.
For each business, extract their real published public information:
- name: Official business name
- location: Exact street address or neighborhood in ${searchLocation}
- phone: Publicly published business phone number (if known, else null)
- email: Publicly published business email (if known, else null)
- website_url: Official website URL (if known, else null)
- type: Specific category (e.g. Day Spa, Law Firm, Furniture Store)

Return ONLY a valid JSON array of objects with these keys inside a json code fence. Do not fabricate or invent any details. If phone or email or website is not publicly available, use null.`;

    try {
      const text = await this.geminiGenerateFn({
        apiKey: this.geminiApiKey,
        model: 'gemini-4-hydrogen',
        prompt,
        signal: jobSignal
      });
      this.markProviderSuccess('gemini-grounding');

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        return { candidates: [], ok: true };
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        providerStats.providerFailures.push('gemini-grounding returned malformed JSON');
        return { candidates: [], ok: false };
      }
      if (!Array.isArray(parsed)) return { candidates: [], ok: true };

      const candidates: RawCandidate[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i] as Record<string, any>;
        if (item && typeof item.name === 'string' && item.name.trim()) {
          const itemLoc = typeof item.location === 'string' && item.location.trim() ? item.location.trim() : resolvedAreaName;
          const seed = `${item.name.trim()}|${itemLoc}|${item.website_url || ''}|${item.phone || ''}`;
          candidates.push({
            id: buildDeterministicProspectId(`grounding:${seed}`),
            name: item.name.trim(),
            location: itemLoc,
            latitude: areaLat,
            longitude: areaLon,
            phone: typeof item.phone === 'string' ? item.phone : null,
            email: typeof item.email === 'string' ? item.email : null,
            website_url: typeof item.website_url === 'string' ? item.website_url : null,
            type: typeof item.type === 'string' && item.type.trim() ? item.type.trim() : searchNiche,
            source: 'google-grounding',
            source_provenance: {
              provider: 'google-grounding',
              query: sanitizedQuery,
              checked_at: new Date(this.nowFn()).toISOString()
            }
          });
        }
      }
      return { candidates, ok: true };
    } catch (err: any) {
      if (jobSignal?.aborted) throw createAbortError('Job aborted');
      const errMsg = String(err?.message || err);
      const cooldownMs = this.markProviderFailure(
        'gemini-grounding',
        this.limits.geminiCooldownMs,
        this.limits.geminiCooldownMs * 4,
        errMsg
      );
      providerStats.providerFailures.push(
        errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')
          ? 'gemini-grounding quota/429 exhausted'
          : `gemini-grounding error`
      );
      providerStats.cooldownsTriggered.push(`gemini-grounding:${Math.round(cooldownMs / 1000)}s`);
      return { candidates: [], ok: false };
    }
  }

  public async assessWebsiteWithCache(
    websiteUrl?: string | null,
    countryContext: string = ''
  ): Promise<DomainAssessmentSummary> {
    if (!websiteUrl || !websiteUrl.trim()) {
      return {
        status: 'NO_WEBSITE',
        website_quality_category: 'No website found',
        website_availability: 'NONE',
        qualityScore: 0,
        evidence: 'No registered or published website discovered for this business.',
        contactEvidence: [],
        whatsapp_unconfirmed: false,
        checkedAt: new Date(this.nowFn()).toISOString(),
        expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
      };
    }

    if (isSocialOrDirectoryDomain(websiteUrl)) {
      const host = normalizeDomain(websiteUrl) || 'social platform';
      return {
        status: 'NO_WEBSITE',
        website_quality_category: 'No website found',
        website_availability: 'NONE',
        qualityScore: 15,
        evidence: `Social-media or directory profile only (${host}); no standalone business website found.`,
        contactEvidence: [],
        whatsapp_unconfirmed: false,
        checkedAt: new Date(this.nowFn()).toISOString(),
        expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
      };
    }

    if (!isSafeUrl(websiteUrl)) {
      return {
        status: 'NEEDS_REVIEW',
        website_quality_category: 'Assessment inconclusive',
        website_availability: 'UNVERIFIED',
        qualityScore: 30,
        evidence: 'Website URL blocked by SSRF security rules.',
        contactEvidence: [],
        whatsapp_unconfirmed: false,
        checkedAt: new Date(this.nowFn()).toISOString(),
        expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
      };
    }

    const domainKey = normalizeDomain(websiteUrl) || websiteUrl.trim().toLowerCase();
    const now = this.nowFn();
    const cached = this.domainAssessmentCache.get(domainKey);
    if (cached && cached.expiresAt > now) {
      return {
        ...cached,
        contactEvidence: [...cached.contactEvidence]
      };
    }

    let html: string | null = null;
    let httpStatus = 200;
    let isPersistentFailure = false;
    let isTransientError = false;
    let fetchError: string | null = null;
    let currentUrl = websiteUrl;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const fetchRes = await this.safeFetchFn(currentUrl, {
          timeoutMs: this.limits.websiteTimeoutMs,
          maxRedirects: 4,
          headers: { 'User-Agent': 'AvartahProspectBot/3.0 (+https://avartah.com)' }
        });

        httpStatus = fetchRes.status;
        currentUrl = fetchRes.finalUrl || currentUrl;

        if (fetchRes.ok) {
          html = fetchRes.text;
          break;
        }
        if (fetchRes.error?.includes('SSRF Blocked') || fetchRes.error?.includes('Blocked unsafe URL') || fetchRes.error?.includes('prohibited redirect')) {
          const blocked: DomainAssessmentSummary = {
            status: 'NEEDS_REVIEW',
            website_quality_category: 'Assessment inconclusive',
            website_availability: 'UNVERIFIED',
            qualityScore: 30,
            evidence: `Website target was blocked by SSRF security rules (${fetchRes.error}).`,
            contactEvidence: [],
            whatsapp_unconfirmed: false,
            checkedAt: new Date(this.nowFn()).toISOString(),
            expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
          };
          this.domainAssessmentCache.set(domainKey, blocked);
          return blocked;
        }
        if (httpStatus === 404 || httpStatus === 410 || isPermanent4xx(httpStatus)) {
          isPersistentFailure = true;
          break;
        }
        isTransientError = true;
        fetchError = fetchRes.error || `HTTP ${httpStatus}`;
        if (attempt === 1) await this.sleepFn(250);
      } catch (err: any) {
        fetchError = err?.message || 'Network error';
        isTransientError = true;
        if (attempt === 1) await this.sleepFn(250);
      }
    }

    if (isPersistentFailure) {
      const broken: DomainAssessmentSummary = {
        status: 'BROKEN_WEBSITE',
        website_quality_category: 'Website inaccessible or apparently broken',
        website_availability: 'PERSISTENT_FAILURE',
        qualityScore: 10,
        evidence: `Confirmed persistent error (${fetchError || `HTTP ${httpStatus}`}). Website is inaccessible or broken.`,
        contactEvidence: [],
        whatsapp_unconfirmed: false,
        checkedAt: new Date(this.nowFn()).toISOString(),
        expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
      };
      this.domainAssessmentCache.set(domainKey, broken);
      return broken;
    }

    if (isTransientError || html === null) {
      const transient: DomainAssessmentSummary = {
        status: 'NEEDS_REVIEW',
        website_quality_category: 'Assessment inconclusive',
        website_availability: 'TEMPORARILY_UNAVAILABLE',
        qualityScore: 40,
        evidence: `Temporary timeout or transient server issue (${fetchError || `HTTP ${httpStatus}`}). A temporary timeout does not imply that the website is broken.`,
        contactEvidence: [],
        whatsapp_unconfirmed: false,
        checkedAt: new Date(this.nowFn()).toISOString(),
        expiresAt: this.nowFn() + 15 * 60 * 1000
      };
      this.domainAssessmentCache.set(domainKey, transient);
      return transient;
    }

    const pagesScraped: string[] = [currentUrl];
    const socialProfiles: Record<string, string> = { ...extractSocialLinksFromHtml(html) };
    const allEvidence: ContactEvidence[] = [];

    const schemaRoot = extractSchemaOrgContacts(html, currentUrl, countryContext);
    const metaRoot = extractMetaTagContacts(html, currentUrl, countryContext);
    const baseRoot = extractContactsFromHtml(html, currentUrl, countryContext);

    let extractedEmail = schemaRoot.email || metaRoot.email || baseRoot.email;
    let extractedPhone = schemaRoot.phone || metaRoot.phone || baseRoot.phone;
    let extractedWhatsapp = baseRoot.whatsapp;

    if (schemaRoot.socialProfiles) Object.assign(socialProfiles, schemaRoot.socialProfiles);
    if (baseRoot.socialProfiles) {
      for (const [k, v] of Object.entries(baseRoot.socialProfiles)) {
        if (!socialProfiles[k]) socialProfiles[k] = v;
      }
    }
    allEvidence.push(...schemaRoot.evidence, ...metaRoot.evidence, ...baseRoot.contactEvidence);

    if (!extractedEmail || !extractedPhone) {
      try {
        const u = new URL(currentUrl);
        const subpageUrls = new Set<string>();
        const linkRegex = /href=["']((?:\/|(?:https?:\/\/[^"'\s/]+)?\/)(?:contact|contact-us|about|about-us|enquiries|enquiry|booking|bookings|reach-us|get-in-touch)[^"'\s?]*)["']/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          let subUrl = match[1].trim();
          if (subUrl.startsWith('/')) subUrl = `${u.origin}${subUrl}`;
          try {
            const parsedSub = new URL(subUrl);
            if (parsedSub.origin === u.origin && parsedSub.href !== currentUrl && isSafeUrl(subUrl)) {
              subpageUrls.add(subUrl);
            }
          } catch {}
          if (subpageUrls.size >= 3) break;
        }

        for (const contactPageUrl of Array.from(subpageUrls).slice(0, 3)) {
          if (extractedEmail && extractedPhone) break;
          const cFetch = await this.safeFetchFn(contactPageUrl, { timeoutMs: 3500, maxRedirects: 3 });
          if (cFetch.ok) {
            const subActual = cFetch.finalUrl || contactPageUrl;
            if (!pagesScraped.includes(subActual)) pagesScraped.push(subActual);
            const cSchema = extractSchemaOrgContacts(cFetch.text, subActual, countryContext);
            const cMeta = extractMetaTagContacts(cFetch.text, subActual, countryContext);
            const cContacts = extractContactsFromHtml(cFetch.text, subActual, countryContext);
            if (!extractedEmail) extractedEmail = cSchema.email || cMeta.email || cContacts.email;
            if (!extractedPhone) extractedPhone = cSchema.phone || cMeta.phone || cContacts.phone;
            if (!extractedWhatsapp) extractedWhatsapp = cContacts.whatsapp;
            if (cSchema.socialProfiles) Object.assign(socialProfiles, cSchema.socialProfiles);
            if (cContacts.socialProfiles) Object.assign(socialProfiles, cContacts.socialProfiles);
            allEvidence.push(...cSchema.evidence, ...cMeta.evidence, ...cContacts.contactEvidence);
          }
        }
      } catch {
        // Non-fatal subpage miss
      }
    }

    let score = 50;
    const evidenceItems: string[] = [];

    if (currentUrl.startsWith('https:')) {
      score += 10;
      evidenceItems.push('Secured via HTTPS');
    } else {
      score -= 15;
      evidenceItems.push('Missing HTTPS encryption');
    }

    const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'") || html.includes('viewport');
    const hasResponsiveCss = /(@media|\bflex\b|\bgrid\b|\bcol-|\bw-full\b)/i.test(html);
    if (hasViewport && hasResponsiveCss) {
      score += 15;
      evidenceItems.push('Mobile viewport & responsive styling present');
    } else if (!hasViewport && !hasResponsiveCss) {
      score -= 20;
      evidenceItems.push('Missing mobile responsiveness layout');
    }

    if (/(<nav|<header|<footer|<main|<section)/i.test(html)) {
      score += 10;
      evidenceItems.push('Semantic HTML navigation structure');
    }

    if (/(<h1|<h2|<h3)/i.test(html) && html.length > 4000) {
      score += 15;
      evidenceItems.push('Rich content and typography structure');
    } else if (html.length < 1000) {
      score -= 20;
      evidenceItems.push('Sparse or minimal page content');
    }

    const hasObsoleteTags = /(<font[\s>]|<center[\s>]|<marquee[\s>]|<frameset[\s>]|bgcolor=)/i.test(html);
    if (hasObsoleteTags) {
      score -= 25;
      evidenceItems.push('Obsolete/deprecated HTML markup detected');
    }

    score = Math.max(5, Math.min(95, score));

    let status: 'GOOD_WEBSITE' | 'OUTDATED_WEBSITE' | 'NEEDS_REVIEW' = 'GOOD_WEBSITE';
    let qualityCategory: WebsiteQualityCategory = 'Website appears functional and current';

    if (hasObsoleteTags || score < 50) {
      status = 'OUTDATED_WEBSITE';
      qualityCategory = 'Website potentially outdated';
    } else if (score >= 70) {
      status = 'GOOD_WEBSITE';
      qualityCategory = 'Website appears functional and current';
    } else {
      status = 'NEEDS_REVIEW';
      qualityCategory = 'Assessment inconclusive';
    }

    const summary: DomainAssessmentSummary = {
      email: extractedEmail,
      phone: extractedPhone,
      whatsapp: extractedWhatsapp,
      ...(Object.keys(socialProfiles).length > 0 ? { socialProfiles } : {}),
      pagesScraped,
      status,
      website_quality_category: qualityCategory,
      website_availability: 'ONLINE',
      qualityScore: score,
      evidence: `${evidenceItems.join('; ')} (checked ${new Date(this.nowFn()).toISOString().slice(0, 10)})`,
      contactEvidence: allEvidence,
      whatsapp_unconfirmed: Boolean(extractedPhone && !extractedWhatsapp),
      checkedAt: new Date(this.nowFn()).toISOString(),
      expiresAt: this.nowFn() + this.limits.domainAssessmentTtlMs
    };

    // Store summary only (never raw HTML)
    this.domainAssessmentCache.set(domainKey, summary);
    return {
      ...summary,
      contactEvidence: [...summary.contactEvidence]
    };
  }

  public async checkExistingProspectsBatch(
    candidates: EvaluatedProspectRecord[],
    dbStats: DiscoveryDbStats
  ): Promise<Map<string, ExistingProspectRow>> {
    const matchedMap = new Map<string, ExistingProspectRow>();
    if (candidates.length === 0) return matchedMap;

    const ids: string[] = [];
    const emails: string[] = [];
    const phones: string[] = [];
    const domains: string[] = [];
    const nameKeys: string[] = [];

    for (const c of candidates) {
      if (c.id) ids.push(c.id);
      if (c.email) emails.push(c.email.trim().toLowerCase());
      if (c.phone) {
        const trimmed = c.phone.trim();
        const digitsOnly = trimmed.replace(/[^\d+]/g, '');
        if (trimmed) phones.push(trimmed);
        if (digitsOnly && digitsOnly !== trimmed) phones.push(digitsOnly);
      }
      const keys = extractCanonicalKeys({
        name: c.name,
        location: c.label,
        website: c.website,
        phone: c.phone,
        email: c.email,
        countryContext: c.country
      });
      if (keys.domain) domains.push(keys.domain);
      if (c.name) nameKeys.push(c.name.trim().toLowerCase());
    }

    const domainPatterns = domains.map((d) => `%${d}%`);

    dbStats.dbReads++;
    const res = await this.db.query(
      `SELECT id, business_name, location, phone, email, website_url, reviewed_status, crm_lead_id, promoted_at, outreach_status, suggested_service, email_draft, whatsapp_draft, verification_status
       FROM prospects
       WHERE id = ANY($1::text[])
          OR LOWER(email) = ANY($2::text[])
          OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9+]', '', 'g') = ANY($3::text[])
          OR LOWER(business_name) = ANY($4::text[])
          OR LOWER(website_url) LIKE ANY($5::text[])
       UNION ALL
       SELECT ('crm_' || id) AS id, business_name, COALESCE(NULLIF(city, ''), country, '') AS location, user_phone AS phone, user_email AS email, COALESCE(NULLIF(target_url, ''), website) AS website_url, 'PROMOTED' AS reviewed_status, id AS crm_lead_id, created_at AS promoted_at, status AS outreach_status, requested_service AS suggested_service, NULL::text AS email_draft, NULL::text AS whatsapp_draft, 'SOURCE_CONFIRMED' AS verification_status
       FROM crm_leads
       WHERE LOWER(user_email) = ANY($2::text[])
          OR REGEXP_REPLACE(COALESCE(user_phone, ''), '[^0-9+]', '', 'g') = ANY($3::text[])
          OR LOWER(business_name) = ANY($4::text[])
          OR LOWER(COALESCE(NULLIF(target_url, ''), website)) LIKE ANY($5::text[])
       LIMIT 200`,
      [ids, emails, phones, nameKeys, domainPatterns]
    );

    const existingRows: ExistingProspectRow[] = res.rows || [];
    for (const c of candidates) {
      const cKeys = extractCanonicalKeys({
        name: c.name,
        location: c.label,
        website: c.website,
        phone: c.phone,
        email: c.email,
        countryContext: c.country
      });

      const match = existingRows.find((row) => {
        if (row.id && row.id === c.id) return true;
        if (cKeys.email && row.email && row.email.trim().toLowerCase() === cKeys.email) return true;
        if (cKeys.phone && row.phone && row.phone.replace(/[^\d+]/g, '') === cKeys.phone.replace(/[^\d+]/g, '')) return true;
        if (cKeys.domain && row.website_url && !isSocialOrDirectoryDomain(row.website_url)) {
          const rowDomain = normalizeDomain(row.website_url);
          if (rowDomain && rowDomain === cKeys.domain) return true;
        }
        if (row.business_name && row.location) {
          const rowNL = extractCanonicalKeys({ name: row.business_name, location: row.location }).nameLocation;
          if (rowNL && rowNL === cKeys.nameLocation) return true;
        }
        if (cKeys.phone === null && cKeys.email === null && cKeys.domain === null && row.business_name && c.name) {
          if (row.business_name.trim().toLowerCase() === c.name.trim().toLowerCase() && !row.location) {
            return true;
          }
        }
        return false;
      });

      if (match) {
        matchedMap.set(c.id, match);
      }
    }

    return matchedMap;
  }

  public async runLocateDiscovery(input: DiscoveryRunInput): Promise<DiscoveryRunResult> {
    const startTime = this.nowFn();
    const sanitizedQuery = sanitizeDiscoveryQuery(input.query);
    if (!sanitizedQuery) {
      return {
        httpStatus: 400,
        body: {
          success: false,
          jobId: '',
          status: 'FAILED',
          results: [],
          existingMatches: [],
          needsContact: [],
          excludedGoodWebsites: [],
          metrics: this.emptyMetrics(),
          db_stats: this.emptyDbStats(),
          expandedQueries: [],
          source: 'none',
          location_resolved: '',
          shortfall_explanation: null,
          provider_stats: this.emptyProviderStats('invalid_query'),
          search_duration_ms: 0,
          providerError: false,
          error: 'Valid search query or location is required.',
          errorCode: 'INVALID_QUERY'
        }
      };
    }

    const adminEmail = (input.adminEmail || 'admin@avartah.com').trim().toLowerCase();
    const targetGoal = clampTargetCount(input.targetCount);
    const skipWebsites = Boolean(input.skipWebsites);
    const { niche, location } = cleanQueryParts(sanitizedQuery);
    const searchLocation = location || sanitizedQuery;
    const searchNiche = niche || 'business';
    const concurrentKey = `${adminEmail}::${searchNiche.toLowerCase()}::${searchLocation.toLowerCase()}::${skipWebsites ? '1' : '0'}`;

    const existingActiveJobId = this.activeConcurrentKeys.get(concurrentKey);
    if (existingActiveJobId) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          jobId: existingActiveJobId,
          activeJobId: existingActiveJobId,
          status: 'DISCOVERING',
          results: [],
          existingMatches: [],
          needsContact: [],
          excludedGoodWebsites: [],
          metrics: this.emptyMetrics(),
          db_stats: this.emptyDbStats(),
          expandedQueries: [],
          source: 'none',
          location_resolved: searchLocation,
          shortfall_explanation: null,
          provider_stats: this.emptyProviderStats('concurrent_job_blocked'),
          search_duration_ms: 0,
          providerError: false,
          error: 'An identical discovery search is already running. Monitor or stop the active job instead of launching a duplicate.',
          errorCode: 'CONCURRENT_JOB_ACTIVE'
        }
      };
    }

    const jobId =
      typeof input.clientJobId === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(input.clientJobId)
        ? input.clientJobId
        : `job_${this.nowFn().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;

    const jobController = new AbortController();
    this.jobControllers.set(jobId, jobController);
    this.activeConcurrentKeys.set(concurrentKey, jobId);

    const expanded = this.getExpandedCategoryCached(searchNiche);
    const expandedQueries = expanded.expandedTerms.map((t) => `${t} in ${searchLocation}`);

    const providerStats = this.emptyProviderStats('none');
    if (expanded.fromCache) providerStats.cacheHits++;
    const dbStats = this.emptyDbStats();
    const metrics = this.emptyMetrics();

    const snapshot: DiscoveryJobSnapshot = {
      jobId,
      adminEmail,
      query: sanitizedQuery,
      niche: searchNiche,
      location: searchLocation,
      targetCount: targetGoal,
      status: 'DISCOVERING',
      stageMessage: 'Resolving target location...',
      startedAt: new Date(startTime).toISOString(),
      completedAt: null,
      durationMs: 0,
      batchesProcessed: 0,
      metrics,
      dbStats,
      providerStats,
      error: null,
      errorCode: null
    };
    this.recordJobSnapshot(snapshot);

    const budgetState = { providerRequests: 0, publicResearchQueries: 0 };
    const seenPrimaryKeys = new Set<string>();
    const seenNameLocations = new Set<string>();
    const seenDomains = new Set<string>();
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();
    const jobSeenQueries = new Set<string>();
    const jobSeenUrls = new Set<string>();

    const candidateQualified: EvaluatedProspectRecord[] = [];
    const needsContactList: EvaluatedProspectRecord[] = [];
    const excludedGoodWebsitesList: EvaluatedProspectRecord[] = [];

    let resolvedAreaName = searchLocation;
    let countryContext = searchLocation;
    let areaLat = 0;
    let areaLon = 0;
    let primarySource = 'osm-overpass';
    let anyProviderSucceeded = false;
    let geminiGroundedUsed = false;

    const isJobStopped = (): boolean => jobController.signal.aborted || snapshot.status === 'STOPPED';

    const isBudgetExhausted = (): boolean => {
      if (isJobStopped()) return true;
      if (this.nowFn() - startTime >= this.limits.maxJobDurationMs) {
        providerStats.stopReason = 'time_budget_reached';
        return true;
      }
      if (metrics.discovered >= this.limits.maxRawCandidates) {
        providerStats.stopReason = 'raw_candidate_limit_reached';
        return true;
      }
      if (budgetState.providerRequests >= this.limits.maxProviderRequests) {
        providerStats.stopReason = 'provider_request_budget_reached';
        return true;
      }
      return false;
    };

    try {
      const geo = await this.geocodeLocationCached(searchLocation, providerStats, budgetState, jobController.signal);
      areaLat = geo.lat;
      areaLon = geo.lon;
      resolvedAreaName = geo.displayName;
      countryContext = geo.countryContext;

      const buildEvaluatedRecord = async (cand: RawCandidate): Promise<EvaluatedProspectRecord | null> => {
        if (!cand || !cand.name || typeof cand.name !== 'string' || !cand.name.trim()) return null;

        const normName = cand.name.trim();
        const candLoc = (cand.location || resolvedAreaName).trim();

        let sanitizedWebsite: string | null = cand.website_url ? cand.website_url.trim() : null;
        let socialProfiles: Record<string, string | null> | undefined = cand.social_profiles
          ? { ...cand.social_profiles }
          : undefined;
        let candWhatsapp = cand.whatsapp_link || null;
        let rawPhone = cand.phone;

        if (sanitizedWebsite) {
          if (sanitizedWebsite.includes('wa.me/') || sanitizedWebsite.includes('api.whatsapp.com/')) {
            candWhatsapp = candWhatsapp || sanitizedWebsite;
            const digits = sanitizedWebsite.replace(/\D/g, '');
            if (!rawPhone && digits.length >= 7) rawPhone = `+${digits}`;
            sanitizedWebsite = null;
          } else if (isSocialOrDirectoryDomain(sanitizedWebsite)) {
            const d = normalizeDomain(sanitizedWebsite);
            socialProfiles = { ...(socialProfiles || {}), [classifySocialProfileHost(d)]: sanitizedWebsite };
          } else if (!isSafeUrl(sanitizedWebsite)) {
            sanitizedWebsite = null;
          }
        }

        const keys = extractCanonicalKeys({
          name: normName,
          location: candLoc,
          website: sanitizedWebsite,
          phone: rawPhone,
          email: cand.email,
          countryContext
        });

        // In-memory deduplication before expensive website crawls
        if (
          seenPrimaryKeys.has(keys.primaryKey) ||
          seenNameLocations.has(keys.nameLocation) ||
          (keys.domain && seenDomains.has(keys.domain)) ||
          (keys.phone && seenPhones.has(keys.phone)) ||
          (keys.email && seenEmails.has(keys.email))
        ) {
          metrics.duplicates++;
          metrics.batch_duplicates++;
          return null;
        }

        seenPrimaryKeys.add(keys.primaryKey);
        seenNameLocations.add(keys.nameLocation);
        if (keys.domain) seenDomains.add(keys.domain);
        if (keys.phone) seenPhones.add(keys.phone);
        if (keys.email) seenEmails.add(keys.email);
        metrics.unique++;

        const assessment = await this.assessWebsiteWithCache(sanitizedWebsite, countryContext);
        if (assessment.socialProfiles) {
          socialProfiles = { ...(socialProfiles || {}), ...assessment.socialProfiles };
        }

        const isGoodWebsite =
          assessment.status === 'GOOD_WEBSITE' ||
          assessment.website_quality_category === 'Website appears functional and current';
        const hasStandaloneWebsite = Boolean(sanitizedWebsite && !isSocialOrDirectoryDomain(sanitizedWebsite));
        const isExcludedByWebsite = isGoodWebsite || (skipWebsites && hasStandaloneWebsite);

        const sourcesChecked = new Set<string>([`public_map_listing:${cand.source}`]);
        if (assessment.pagesScraped) {
          for (const pg of assessment.pagesScraped) {
            sourcesChecked.add(`official_site:${normalizeDomain(pg) || pg}`);
          }
        }

        let discoveredEmail = cand.email || assessment.email || null;
        let discoveredPhone = rawPhone || assessment.phone || null;
        let whatsappLink = candWhatsapp || assessment.whatsapp || null;
        const contactEvidence: ContactEvidence[] = [...assessment.contactEvidence];

        // Track initial candidate contact evidence before public research
        const initialEmailVal = validateEmail(discoveredEmail, sanitizedWebsite || cand.source, {
          sourceType: sanitizedWebsite ? inferSourceTypeFromUrl(sanitizedWebsite) : 'public_map_listing',
          sourceConfirmed: Boolean(discoveredEmail)
        });
        const initialPhoneVal = normalizeAndValidatePhone(
          discoveredPhone,
          countryContext,
          sanitizedWebsite || cand.source,
          {
            sourceType: sanitizedWebsite ? inferSourceTypeFromUrl(sanitizedWebsite) : 'public_map_listing',
            sourceConfirmed: Boolean(discoveredPhone)
          }
        );

        let validEmail =
          initialEmailVal.isValid && !initialEmailVal.isPlaceholder && discoveredEmail
            ? discoveredEmail.trim().toLowerCase()
            : '';
        let validPhone =
          initialPhoneVal.isValid && !initialPhoneVal.isAddressNumber && initialPhoneVal.normalizedPhone
            ? initialPhoneVal.normalizedPhone
            : '';

        // Stage 3: Bounded public contact research for website-opportunity businesses missing email or phone
        const socialUrlsList = socialProfiles
          ? Object.values(socialProfiles).filter((u): u is string => Boolean(u && typeof u === 'string'))
          : [];
        const publicSearchAllowed =
          !isExcludedByWebsite &&
          (!validEmail || !validPhone) &&
          !isJobStopped() &&
          this.nowFn() - startTime < this.limits.maxJobDurationMs &&
          (socialUrlsList.length > 0 || budgetState.publicResearchQueries < this.limits.maxPublicResearchQueries);

        if (publicSearchAllowed) {
          const remainingResearchQueries = Math.max(
            0,
            this.limits.maxPublicResearchQueries - budgetState.publicResearchQueries
          );
          const ddgBlocked = this.isProviderInCooldown('public-search:duckduckgo');
          const bingBlocked = this.isProviderInCooldown('public-search:bing');
          const maxQueriesForCandidate = !ddgBlocked || !bingBlocked ? Math.min(1, remainingResearchQueries) : 0;

          if (socialUrlsList.length > 0 || maxQueriesForCandidate > 0) {
            const researchRes = await researchPublicContactsForBusiness(
              {
                businessName: normName,
                location: candLoc,
                city: candLoc.split(',')[0] || resolvedAreaName.split(',')[0],
                countryContext,
                existingEmail: validEmail || null,
                existingPhone: validPhone || null,
                socialUrls: socialUrlsList
              },
              {
                fetchFn: async (input, init) => {
                  const uStr = String(input);
                  const provKey = uStr.includes('bing.com') ? 'public-search:bing' : 'public-search:duckduckgo';
                  if (this.isProviderInCooldown(provKey)) {
                    return new Response('', { status: 429, statusText: 'Provider in cooldown' });
                  }
                  const r = await this.fetchFn(input, init);
                  if (r.status === 403 || r.status === 429) {
                    this.markProviderFailure(
                      provKey,
                      30000,
                      120000,
                      `HTTP ${r.status}`,
                      r.headers?.get?.('retry-after')
                    );
                  }
                  return r;
                },
                safeFetchFn: this.safeFetchFn,
                signal: jobController.signal,
                jobSeenQueries,
                jobSeenUrls,
                timeoutMs: Math.min(3500, this.limits.websiteTimeoutMs),
                maxSearchQueries: maxQueriesForCandidate,
                maxFollowupPages: 1
              }
            );

            budgetState.publicResearchQueries += researchRes.queriesExecuted;
            providerStats.publicResearchQueries += researchRes.queriesExecuted;
            for (const s of researchRes.sourcesChecked) sourcesChecked.add(s);
            if (Object.keys(researchRes.socialProfiles).length > 0) {
              socialProfiles = { ...(socialProfiles || {}), ...researchRes.socialProfiles };
            }
            if (!validEmail && researchRes.email) {
              discoveredEmail = researchRes.email;
              validEmail = researchRes.email;
            }
            if (!validPhone && researchRes.phone) {
              discoveredPhone = researchRes.phone;
              validPhone = researchRes.phone;
            }
            if (!whatsappLink && researchRes.whatsapp) {
              whatsappLink = researchRes.whatsapp;
            }
            for (const ev of researchRes.contactEvidence) {
              if (!contactEvidence.some((x) => x.contact_type === ev.contact_type && x.contact_value === ev.contact_value && x.source_url === ev.source_url)) {
                contactEvidence.push(ev);
              }
            }
          }
        }

        if (validEmail && !contactEvidence.some((e) => e.contact_type === 'email')) {
          contactEvidence.push({
            contact_value: validEmail,
            contact_type: 'email',
            source_url: sanitizedWebsite || cand.source,
            source_type: cand.source.startsWith('osm') ? 'public_map_listing' : inferSourceTypeFromUrl(cand.source),
            discovered_at: assessment.checkedAt,
            verification_status: 'FOUND'
          });
        }
        if (validPhone && !contactEvidence.some((e) => e.contact_type === 'phone')) {
          contactEvidence.push({
            contact_value: validPhone,
            contact_type: 'phone',
            source_url: sanitizedWebsite || cand.source,
            source_type: cand.source.startsWith('osm') ? 'public_map_listing' : inferSourceTypeFromUrl(cand.source),
            discovered_at: assessment.checkedAt,
            verification_status: 'FOUND'
          });
        }

        const isContactQualified = passesContactGate(
          {
            name: normName,
            email: validEmail || null,
            phone: validPhone || null,
            whatsapp_link: whatsappLink,
            website: sanitizedWebsite,
            contact_evidence: contactEvidence
          },
          countryContext
        );

        const hasPublicEmail = Boolean(validEmail);
        const hasPublicPhone = Boolean(validPhone);
        const isPhoneOnly = Boolean(hasPublicPhone && !hasPublicEmail);

        // Accurate Section 6 verification labels (never overclaim)
        let verificationStatus = 'NOT_FOUND';
        if (isContactQualified) {
          const hasConfirmedEv = contactEvidence.some((e) => e.verification_status === 'SOURCE_CONFIRMED');
          const prefix = hasConfirmedEv ? 'SOURCE_CONFIRMED' : 'FOUND';
          if (validEmail && validPhone) {
            verificationStatus = `${prefix} (Email & Phone Found)`;
          } else if (validEmail) {
            verificationStatus = `${prefix} (Public Email Found)`;
          } else if (validPhone) {
            verificationStatus = whatsappLink
              ? `${prefix} (Phone & WhatsApp Link Found — Email Not Found)`
              : `FORMAT_VALID (Phone Found — Email Not Found; WhatsApp Unconfirmed)`;
          } else if (whatsappLink) {
            verificationStatus = `${prefix} (WhatsApp Link Found)`;
          }
        }

        if (assessment.status === 'NO_WEBSITE') {
          metrics.no_official_website++;
        }
        if (!isGoodWebsite) {
          metrics.website_opportunities++;
        }
        if (hasPublicPhone) {
          metrics.public_phone_found++;
        }
        if (hasPublicEmail) {
          metrics.public_email_found++;
        }
        if (isPhoneOnly) {
          metrics.phone_only++;
        }
        if (isContactQualified) {
          metrics.contact_qualified++;
        }

        const deterministicId = buildDeterministicProspectId(keys.primaryKey);
        const suggestedService = generateSuggestedService(assessment.status);
        const emailDraft = generatePersonalizedEmailDraft(
          normName,
          candLoc,
          searchNiche,
          assessment.status,
          sanitizedWebsite,
          assessment.evidence
        );
        const whatsappDraft = generatePersonalizedWhatsAppDraft(normName, assessment.status, candLoc, sanitizedWebsite);

        const record: EvaluatedProspectRecord = {
          id: deterministicId,
          canonical_key: keys.primaryKey,
          name: normName,
          label: candLoc,
          latitude: cand.latitude || areaLat,
          longitude: cand.longitude || areaLon,
          phone: validPhone,
          email: validEmail,
          website: sanitizedWebsite || '',
          status: assessment.status,
          website_quality_category: assessment.website_quality_category,
          website_availability: assessment.website_availability,
          website_quality_score: assessment.qualityScore,
          evidence: assessment.evidence,
          whatsapp_link: whatsappLink || undefined,
          whatsapp_unconfirmed: Boolean(validPhone && !whatsappLink),
          social_profiles: socialProfiles,
          type: cand.type || searchNiche,
          country: resolvedAreaName.split(',').pop()?.trim() || 'N/A',
          source: cand.source,
          source_provenance: {
            ...cand.source_provenance,
            checked_at: assessment.checkedAt,
            canonical_key: keys.primaryKey
          },
          contact_evidence: contactEvidence,
          sources_checked: Array.from(sourcesChecked),
          has_public_email: hasPublicEmail,
          has_public_phone: hasPublicPhone,
          phone_only: isPhoneOnly,
          isTemporary: true,
          discovery_timestamp: assessment.checkedAt,
          verification_status: verificationStatus,
          qualified: false,
          isDuplicate: false,
          isExistingRecord: false,
          reviewed_status: 'PENDING',
          crm_lead_id: null,
          promoted_at: null,
          suggested_service: suggestedService,
          email_draft: emailDraft,
          whatsapp_draft: whatsappDraft,
          outreach_status: 'NOT_CONTACTED'
        };

        if (!isContactQualified) {
          record.status = 'NEEDS_CONTACT';
          needsContactList.push(record);
          metrics.excluded = needsContactList.length;
          return null;
        }

        if (isExcludedByWebsite) {
          excludedGoodWebsitesList.push(record);
          metrics.excluded_good_websites = excludedGoodWebsitesList.length;
          return null;
        }

        record.qualified = true;
        candidateQualified.push(record);
        return record;
      };

      const evaluateBatchInChunks = async (rawCandidates: RawCandidate[]): Promise<void> => {
        if (rawCandidates.length === 0 || isJobStopped()) return;
        snapshot.status = 'ENRICHING';

        // Cap by remaining raw candidate budget
        const remainingRaw = Math.max(0, this.limits.maxRawCandidates - metrics.discovered);
        const boundedRaw = rawCandidates.slice(0, remainingRaw);

        // Process in chunks of rawBatchSize (50), qualifying each batch before fetching another provider page
        for (let bStart = 0; bStart < boundedRaw.length; bStart += this.limits.rawBatchSize) {
          if (candidateQualified.length >= targetGoal || isJobStopped()) break;
          if (this.nowFn() - startTime >= this.limits.maxJobDurationMs) {
            providerStats.stopReason = 'time_budget_reached';
            break;
          }
          if (metrics.discovered >= this.limits.maxRawCandidates) {
            providerStats.stopReason = 'raw_candidate_limit_reached';
            break;
          }

          snapshot.batchesProcessed++;
          const batch = boundedRaw.slice(bStart, bStart + this.limits.rawBatchSize);
          metrics.discovered += batch.length;
          snapshot.stageMessage = `Enriching batch ${snapshot.batchesProcessed} (${candidateQualified.length}/${targetGoal} qualified)...`;

          for (let i = 0; i < batch.length; i += this.limits.enrichmentConcurrency) {
            if (candidateQualified.length >= targetGoal || isJobStopped()) break;
            if (this.nowFn() - startTime >= this.limits.maxJobDurationMs) {
              providerStats.stopReason = 'time_budget_reached';
              break;
            }
            const slice = batch.slice(i, i + this.limits.enrichmentConcurrency);
            await Promise.all(slice.map((c) => buildEvaluatedRecord(c)));
          }

          if (metrics.discovered >= this.limits.maxRawCandidates) {
            providerStats.stopReason = 'raw_candidate_limit_reached';
            break;
          }
        }
      };

      // STAGE 1A: Primary Overpass ring (15km)
      if (!isBudgetExhausted() && areaLat !== 0 && areaLon !== 0) {
        if (!isJobStopped()) {
          snapshot.status = 'DISCOVERING';
          snapshot.stageMessage = `Querying primary OSM registry in ${searchLocation}...`;
        }
        const ring1 = await this.fetchOverpassRing(
          areaLat,
          areaLon,
          15000,
          expanded.normalizedNiche,
          expanded.osmTagClauses,
          resolvedAreaName,
          providerStats,
          budgetState,
          jobController.signal
        );
        if (ring1.ok) anyProviderSucceeded = true;
        if (ring1.candidates.length > 0 && !isJobStopped()) {
          primarySource = 'osm-overpass';
          await evaluateBatchInChunks(ring1.candidates);
        }
      }

      // STAGE 1B: Automatic continuation with wider Overpass radius ring (30km) ONLY if < targetGoal
      if (candidateQualified.length < targetGoal && !isBudgetExhausted() && areaLat !== 0 && areaLon !== 0) {
        snapshot.status = 'DISCOVERING';
        snapshot.stageMessage = `Expanding discovery radius (30km) for remaining target (${candidateQualified.length}/${targetGoal})...`;
        const ring2 = await this.fetchOverpassRing(
          areaLat,
          areaLon,
          30000,
          expanded.normalizedNiche,
          expanded.osmTagClauses,
          resolvedAreaName,
          providerStats,
          budgetState,
          jobController.signal
        );
        if (ring2.ok) anyProviderSucceeded = true;
        if (ring2.candidates.length > 0 && !isJobStopped()) {
          await evaluateBatchInChunks(ring2.candidates);
        }
      }

      // STAGE 2: Distinct Nominatim POI query variations (strict >=1100ms spacing, zero bursts)
      if (candidateQualified.length < targetGoal && !isBudgetExhausted()) {
        snapshot.status = 'DISCOVERING';
        const distinctQueries = Array.from(
          new Set(expanded.expandedTerms.slice(0, 5).map((term) => `${term} in ${searchLocation}`))
        );
        for (const poiQuery of distinctQueries) {
          if (candidateQualified.length >= targetGoal || isBudgetExhausted()) break;
          snapshot.stageMessage = `Checking registry variation "${poiQuery}"...`;
          const nomResult = await this.fetchNominatimVariation(
            poiQuery,
            resolvedAreaName,
            providerStats,
            budgetState,
            jobController.signal
          );
          if (nomResult.ok) anyProviderSucceeded = true;
          if (nomResult.candidates.length > 0 && !isJobStopped()) {
            await evaluateBatchInChunks(nomResult.candidates);
          }
          if (nomResult.rateLimited) break;
        }
      }

      // STAGE 3: Single bounded AI supplement pass (prefers NVIDIA NIM; falls back to Gemini only if NVIDIA is unconfigured)
      if (
        candidateQualified.length < targetGoal &&
        !isBudgetExhausted() &&
        !geminiGroundedUsed &&
        (this.nvidiaApiKey || this.geminiApiKey)
      ) {
        geminiGroundedUsed = true;
        snapshot.status = 'DISCOVERING';
        const useNvidia = Boolean(this.nvidiaApiKey);
        snapshot.stageMessage = useNvidia
          ? `Running NVIDIA directory supplement (${candidateQualified.length}/${targetGoal})...`
          : `Running grounded search supplement (${candidateQualified.length}/${targetGoal})...`;
        const aiRes = useNvidia
          ? await this.fetchNvidiaDiscoveryPass(
              sanitizedQuery,
              searchNiche,
              searchLocation,
              resolvedAreaName,
              areaLat,
              areaLon,
              targetGoal - candidateQualified.length,
              providerStats,
              budgetState,
              jobController.signal
            )
          : await this.fetchGeminiGroundingPass(
              sanitizedQuery,
              searchNiche,
              searchLocation,
              resolvedAreaName,
              areaLat,
              areaLon,
              targetGoal - candidateQualified.length,
              providerStats,
              budgetState,
              jobController.signal
            );
        if (aiRes.ok) anyProviderSucceeded = true;
        if (aiRes.candidates.length > 0 && !isJobStopped()) {
          primarySource =
            candidateQualified.length === 0 ? (useNvidia ? 'nvidia-nim' : 'google-grounding') : primarySource;
          await evaluateBatchInChunks(aiRes.candidates);
        }
      }

      // Read-only batched Neon lookup against existing prospects + crm_leads (ZERO DB writes!)
      const existingMatches: EvaluatedProspectRecord[] = [];
      const newlyQualified: EvaluatedProspectRecord[] = [];

      if (candidateQualified.length > 0) {
        const matchedExistingMap = await this.checkExistingProspectsBatch(candidateQualified, dbStats);
        for (const cand of candidateQualified) {
          const existingRow = matchedExistingMap.get(cand.id);
          if (existingRow) {
            const reusedId =
              existingRow.id && !existingRow.id.startsWith('crm_')
                ? existingRow.id
                : cand.id;
            const reused: EvaluatedProspectRecord = {
              ...cand,
              id: reusedId,
              phone: existingRow.phone || cand.phone,
              email: existingRow.email || cand.email,
              website: existingRow.website_url || cand.website,
              reviewed_status: (existingRow.reviewed_status as EvaluatedProspectRecord['reviewed_status']) || 'PROMOTED',
              crm_lead_id: existingRow.crm_lead_id || null,
              promoted_at: existingRow.promoted_at ? new Date(existingRow.promoted_at).toISOString() : null,
              outreach_status: existingRow.outreach_status || cand.outreach_status,
              suggested_service: existingRow.suggested_service || cand.suggested_service,
              email_draft: existingRow.email_draft || cand.email_draft,
              whatsapp_draft: existingRow.whatsapp_draft || cand.whatsapp_draft,
              verification_status: existingRow.verification_status || cand.verification_status,
              isDuplicate: true,
              isExistingRecord: true,
              isTemporary: false
            };
            existingMatches.push(reused);
          } else if (newlyQualified.length < targetGoal) {
            newlyQualified.push(cand);
          }
        }
      }

      // Prioritize NO_WEBSITE / social-only businesses before BROKEN / OUTDATED websites
      const opportunityRank = (rec: EvaluatedProspectRecord): number => {
        if (rec.status === 'NO_WEBSITE') return 0;
        if (rec.status === 'BROKEN_WEBSITE') return 1;
        if (rec.status === 'OUTDATED_WEBSITE') return 2;
        return 3;
      };
      newlyQualified.sort((a, b) => opportunityRank(a) - opportunityRank(b));

      // CRITICAL: ZERO automatic Neon writes during discovery.
      // Persistence happens strictly on explicit administrator "Add to CRM".
      dbStats.dbWrites = 0;
      dbStats.rowsInserted = 0;
      dbStats.rowsUpdated = 0;
      dbStats.excludedInserts = 0;

      // Update final honest metrics (existingMatches & duplicates strictly excluded from qualified / newly_qualified)
      metrics.existing_crm_matches = existingMatches.length;
      metrics.duplicates = metrics.batch_duplicates + existingMatches.length;
      metrics.newly_qualified = newlyQualified.length;
      metrics.qualified = newlyQualified.length;
      metrics.contact_verified = newlyQualified.length;
      metrics.website_qualified = newlyQualified.length;
      metrics.provider_failures = providerStats.providerFailures.length;

      // Determine honest terminal status
      const wasStopped = snapshot.status === 'STOPPED' || jobController.signal.aborted;
      let terminalStatus: DiscoveryJobStatus;
      let httpStatus = 200;
      let providerErrorFlag = false;
      let errorMsg: string | undefined;
      let errorCode: string | undefined;

      if (wasStopped) {
        terminalStatus = 'STOPPED';
        providerStats.stopReason = 'admin_stopped';
      } else if (!anyProviderSucceeded && metrics.discovered === 0 && providerStats.providerFailures.length > 0) {
        terminalStatus = 'FAILED';
        httpStatus = 502;
        providerErrorFlag = true;
        errorCode = 'PROVIDER_UNAVAILABLE';
        errorMsg = 'All discovery providers failed or are in cooldown. Please try again shortly.';
        providerStats.stopReason = 'all_providers_failed';
      } else if (newlyQualified.length >= targetGoal) {
        terminalStatus = 'COMPLETED';
        providerStats.stopReason = 'target_reached';
      } else if (newlyQualified.length > 0 || existingMatches.length > 0 || needsContactList.length > 0 || excludedGoodWebsitesList.length > 0) {
        terminalStatus = providerStats.providerFailures.length > 0 ? 'PARTIAL_SUCCESS' : 'COMPLETED';
        if (providerStats.stopReason === 'none') {
          providerStats.stopReason = 'sources_exhausted';
        }
      } else {
        terminalStatus = 'COMPLETED';
        if (providerStats.stopReason === 'none') {
          providerStats.stopReason = 'zero_results';
        }
      }

      let shortfallExplanation: string | null = null;
      if (newlyQualified.length < this.limits.minTarget && terminalStatus !== 'FAILED') {
        shortfallExplanation = `Discovered ${metrics.discovered} raw records (${metrics.unique} unique) in ${resolvedAreaName}. Qualified ${newlyQualified.length} net-new prospects against the target (${this.limits.minTarget}–${targetGoal}). Excluded ${needsContactList.length} missing public contact details, ${excludedGoodWebsitesList.length} with current websites, ${existingMatches.length} already saved in Neon/CRM, and ${metrics.batch_duplicates} batch duplicates.`;
      }

      const durationMs = this.nowFn() - startTime;
      snapshot.status = terminalStatus;
      snapshot.stageMessage =
        terminalStatus === 'COMPLETED'
          ? `Completed (${newlyQualified.length} qualified).`
          : terminalStatus === 'PARTIAL_SUCCESS'
          ? `Partial results returned (${newlyQualified.length} qualified).`
          : terminalStatus === 'STOPPED'
          ? `Stopped with ${newlyQualified.length} qualified prospects.`
          : errorMsg || 'Discovery failed.';
      snapshot.completedAt = new Date(this.nowFn()).toISOString();
      snapshot.durationMs = durationMs;
      snapshot.error = errorMsg || null;
      snapshot.errorCode = errorCode || null;

      return {
        httpStatus,
        body: {
          success: terminalStatus !== 'FAILED',
          jobId,
          status: terminalStatus,
          results: newlyQualified,
          existingMatches,
          needsContact: needsContactList,
          excludedGoodWebsites: excludedGoodWebsitesList,
          metrics: { ...metrics },
          db_stats: { ...dbStats },
          expandedQueries,
          source: primarySource,
          location_resolved: resolvedAreaName,
          shortfall_explanation: shortfallExplanation,
          provider_stats: {
            ...providerStats,
            providerFailures: [...providerStats.providerFailures],
            cooldownsTriggered: [...providerStats.cooldownsTriggered]
          },
          search_duration_ms: durationMs,
          providerError: providerErrorFlag,
          ...(errorMsg ? { error: errorMsg, errorCode } : {})
        }
      };
    } catch (err: any) {
      const durationMs = this.nowFn() - startTime;
      const isStopped = snapshot.status === 'STOPPED' || jobController.signal.aborted;
      snapshot.status = isStopped ? 'STOPPED' : 'FAILED';
      snapshot.completedAt = new Date(this.nowFn()).toISOString();
      snapshot.durationMs = durationMs;
      snapshot.error = isStopped ? 'Search stopped by administrator.' : 'Discovery execution encountered an internal failure.';
      snapshot.errorCode = isStopped ? 'JOB_STOPPED' : 'DISCOVERY_INTERNAL_ERROR';

      return {
        httpStatus: isStopped ? 200 : 500,
        body: {
          success: isStopped,
          jobId,
          status: snapshot.status,
          results: [],
          existingMatches: [],
          needsContact: [],
          excludedGoodWebsites: [],
          metrics: { ...metrics },
          db_stats: { ...dbStats },
          expandedQueries,
          source: primarySource,
          location_resolved: resolvedAreaName,
          shortfall_explanation: null,
          provider_stats: {
            ...providerStats,
            providerFailures: [...providerStats.providerFailures],
            cooldownsTriggered: [...providerStats.cooldownsTriggered]
          },
          search_duration_ms: durationMs,
          providerError: !isStopped,
          error: snapshot.error,
          errorCode: snapshot.errorCode
        }
      };
    } finally {
      this.jobControllers.delete(jobId);
      if (this.activeConcurrentKeys.get(concurrentKey) === jobId) {
        this.activeConcurrentKeys.delete(concurrentKey);
      }
    }
  }

  private emptyMetrics(): DiscoveryMetrics {
    return {
      discovered: 0,
      unique: 0,
      website_opportunities: 0,
      no_official_website: 0,
      public_phone_found: 0,
      public_email_found: 0,
      phone_only: 0,
      contact_qualified: 0,
      contact_verified: 0,
      website_qualified: 0,
      newly_qualified: 0,
      qualified: 0,
      duplicates: 0,
      batch_duplicates: 0,
      existing_crm_matches: 0,
      excluded_good_websites: 0,
      excluded: 0,
      provider_failures: 0
    };
  }

  private emptyDbStats(): DiscoveryDbStats {
    return {
      dbReads: 0,
      dbWrites: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      excludedInserts: 0
    };
  }

  private emptyProviderStats(stopReason: string): DiscoveryProviderStats {
    return {
      overpassQueries: 0,
      nominatimQueries: 0,
      groundingQueries: 0,
      nvidiaQueries: 0,
      publicResearchQueries: 0,
      cacheHits: 0,
      providerFailures: [],
      cooldownsTriggered: [],
      stopReason
    };
  }
}

export const prospectDiscoveryEngine = new ProspectDiscoveryEngine();
