
import type { 
  Lead, SiteAnalytics, Project, Post, Booking, Prospect,
  ClientProject, ProjectMilestone, ProjectDeliverable, ProjectActivity,
  CrmOutreachLog, CrmOutreachSummary, OutreachDeliveryStatus
} from '../types.js';
import { checkSession, ensureCsrfToken, getCsrfToken, setCsrfToken } from './auth.js';

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const csrfToken = getCsrfToken();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }
  return headers;
};

export const getProspects = async (): Promise<Prospect[]> => {
  try {
    const response = await fetch('/api/prospects', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch prospects');
    return response.json();
  } catch (error) {
    console.error('Error fetching prospects:', error);
    return [];
  }
};

export const updateProspect = async (id: string, updates: Partial<Prospect>): Promise<void> => {
  try {
    const response = await fetch(`/api/prospects/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update prospect');
  } catch (error) {
    console.error('Error updating prospect:', error);
    throw error;
  }
};

export const deleteProspect = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`/api/prospects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete prospect');
  } catch (error) {
    console.error('Error deleting prospect:', error);
    throw error;
  }
};

export const purgeProspects = async (): Promise<void> => {
  try {
    const response = await fetch('/api/prospects', {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to purge prospects');
  } catch (error) {
    console.error('Error purging prospects:', error);
    throw error;
  }
};

export type DiscoveryJobStatus =
  | 'DISCOVERING'
  | 'ENRICHING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'STOPPED';

export interface LocateMetrics {
  discovered: number;
  unique: number;
  website_opportunities: number;
  no_official_website?: number;
  public_phone_found?: number;
  public_email_found?: number;
  phone_only?: number;
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

export interface LocateDbStats {
  dbReads: number;
  dbWrites: number;
  rowsInserted: number;
  rowsUpdated: number;
  excludedInserts: number;
}

export interface LocateProviderStats {
  overpassQueries: number;
  nominatimQueries: number;
  groundingQueries: number;
  nvidiaQueries?: number;
  publicResearchQueries?: number;
  cacheHits: number;
  providerFailures: string[];
  cooldownsTriggered: string[];
  stopReason: string;
}

export interface LocateProspectItem {
  id: string;
  canonical_key?: string;
  name: string;
  label: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  status: string;
  website_quality_category?: string;
  website_availability?: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  website_quality_score?: number;
  evidence?: string;
  whatsapp_link?: string;
  whatsapp_unconfirmed?: boolean;
  social_profiles?: Record<string, string | null>;
  sources_checked?: string[];
  has_public_email?: boolean;
  has_public_phone?: boolean;
  phone_only?: boolean;
  isTemporary?: boolean;
  type: string;
  country: string;
  source?: string;
  source_provenance?: Record<string, unknown>;
  contact_evidence?: any[];
  discovery_timestamp?: string;
  verification_status?: string;
  qualified?: boolean;
  isDuplicate?: boolean;
  isExistingRecord?: boolean;
  reviewed_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';
  crm_lead_id?: string | null;
  promoted_at?: string | null;
  suggested_service?: string;
  email_draft?: string;
  whatsapp_draft?: string;
  outreach_status?: string;
}

export interface LocateResponse {
  httpStatus: number;
  success: boolean;
  jobId?: string;
  activeJobId?: string;
  status?: DiscoveryJobStatus;
  results: LocateProspectItem[];
  existingMatches: LocateProspectItem[];
  needsContact: LocateProspectItem[];
  excludedGoodWebsites: LocateProspectItem[];
  metrics?: LocateMetrics;
  db_stats?: LocateDbStats;
  expandedQueries?: string[];
  source?: string;
  location_resolved?: string;
  shortfall_explanation?: string | null;
  provider_stats?: LocateProviderStats;
  search_duration_ms?: number;
  providerError?: boolean;
  clarificationRequired?: boolean;
  message?: string;
  error?: string;
  errorCode?: string;
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
  metrics: LocateMetrics;
  dbStats: LocateDbStats;
  providerStats: LocateProviderStats;
  error: string | null;
  errorCode: string | null;
}

function extractSafeNonJsonSnippet(raw: string): string {
  if (!raw) return '';
  const stripped = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.slice(0, 140);
}

async function parseSafeJsonResponse<T = Record<string, any>>(
  response: Response
): Promise<{ parsed: T | null; isJson: boolean; snippet?: string }> {
  setCsrfToken(response.headers.get('x-csrf-token'));
  const raw = await response.text();
  if (!raw || !raw.trim()) {
    return { parsed: null, isJson: false, snippet: '' };
  }
  try {
    return { parsed: JSON.parse(raw) as T, isJson: true };
  } catch {
    return { parsed: null, isJson: false, snippet: extractSafeNonJsonSnippet(raw) };
  }
}

export const locateProspects = async (payload: {
  query: string;
  skipWebsites?: boolean;
  targetCount?: number;
  clientJobId?: string;
}): Promise<LocateResponse> => {
  try {
    await ensureCsrfToken();

    const executeLocate = async () => {
      const response = await fetch('/api/prospects/locate', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const parsedOutcome = await parseSafeJsonResponse<Partial<LocateResponse>>(response);
      return { response, ...parsedOutcome };
    };

    let { response, parsed, isJson, snippet } = await executeLocate();

    // If a stale or missing XSRF-TOKEN cookie caused a 403 CSRF rejection, refresh session CSRF once and retry.
    if (
      response.status === 403 &&
      (!isJson || parsed?.errorCode === 'CSRF_VALIDATION_FAILED' || /csrf/i.test(String(parsed?.error || '')))
    ) {
      await checkSession();
      const retryOutcome = await executeLocate();
      response = retryOutcome.response;
      parsed = retryOutcome.parsed;
      isJson = retryOutcome.isJson;
      snippet = retryOutcome.snippet;
    }

    if (!isJson || !parsed) {
      const detail = snippet || response.statusText || 'non-JSON payload';
      return {
        httpStatus: response.status,
        success: false,
        status: 'FAILED',
        results: [],
        existingMatches: [],
        needsContact: [],
        excludedGoodWebsites: [],
        providerError: response.status >= 500,
        errorCode: `HTTP_${response.status}_NON_JSON`,
        error: `Discovery service returned HTTP ${response.status} (${detail}). Please retry shortly.`
      };
    }

    return {
      httpStatus: response.status,
      success: Boolean(parsed.success && response.ok),
      jobId: parsed.jobId,
      activeJobId: parsed.activeJobId,
      status: parsed.status,
      results: Array.isArray(parsed.results) ? parsed.results : [],
      existingMatches: Array.isArray(parsed.existingMatches) ? parsed.existingMatches : [],
      needsContact: Array.isArray(parsed.needsContact) ? parsed.needsContact : [],
      excludedGoodWebsites: Array.isArray(parsed.excludedGoodWebsites) ? parsed.excludedGoodWebsites : [],
      metrics: parsed.metrics,
      db_stats: parsed.db_stats,
      expandedQueries: Array.isArray(parsed.expandedQueries) ? parsed.expandedQueries : undefined,
      source: parsed.source,
      location_resolved: parsed.location_resolved,
      shortfall_explanation: parsed.shortfall_explanation ?? null,
      provider_stats: parsed.provider_stats,
      search_duration_ms: parsed.search_duration_ms,
      providerError: Boolean(parsed.providerError),
      clarificationRequired: Boolean(parsed.clarificationRequired),
      message: parsed.message,
      error: parsed.error || (!response.ok ? `Request failed with status HTTP ${response.status}.` : undefined),
      errorCode: parsed.errorCode || (!response.ok ? `HTTP_${response.status}` : undefined)
    };
  } catch (error: any) {
    return {
      httpStatus: 0,
      success: false,
      status: 'FAILED',
      results: [],
      existingMatches: [],
      needsContact: [],
      excludedGoodWebsites: [],
      providerError: true,
      errorCode: 'NETWORK_ERROR',
      error: error?.message || 'Unable to reach discovery server. Verify connection and retry.'
    };
  }
};

export const getLocateJobStatus = async (jobId: string): Promise<{
  success: boolean;
  httpStatus: number;
  job?: DiscoveryJobSnapshot;
  errorCode?: string;
  error?: string;
}> => {
  try {
    const response = await fetch(`/api/prospects/locate/status/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    const { parsed, isJson } = await parseSafeJsonResponse<{
      success?: boolean;
      job?: DiscoveryJobSnapshot;
      errorCode?: string;
      error?: string;
    }>(response);

    if (!isJson || !parsed) {
      return {
        success: false,
        httpStatus: response.status,
        errorCode: `HTTP_${response.status}_NON_JSON`,
        error: `Status endpoint returned HTTP ${response.status}.`
      };
    }

    return {
      success: Boolean(parsed.success && response.ok),
      httpStatus: response.status,
      job: parsed.job,
      errorCode: parsed.errorCode,
      error: parsed.error
    };
  } catch (err: any) {
    return {
      success: false,
      httpStatus: 0,
      errorCode: 'NETWORK_ERROR',
      error: err?.message || 'Network error polling status'
    };
  }
};

export const stopLocateJob = async (jobId: string): Promise<{
  success: boolean;
  jobId?: string;
  stopped?: boolean;
  status?: DiscoveryJobStatus;
  errorCode?: string;
  error?: string;
}> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/prospects/locate/stop/${encodeURIComponent(jobId)}`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    const { parsed } = await parseSafeJsonResponse<{
      success?: boolean;
      jobId?: string;
      stopped?: boolean;
      status?: DiscoveryJobStatus;
      errorCode?: string;
      error?: string;
    }>(response);
    return {
      success: Boolean(parsed?.success && response.ok),
      jobId: parsed?.jobId,
      stopped: parsed?.stopped,
      status: parsed?.status,
      errorCode: parsed?.errorCode,
      error: parsed?.error
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: 'NETWORK_ERROR',
      error: err?.message || 'Failed to stop discovery job'
    };
  }
};

export const getLocateJobHistory = async (): Promise<{
  success: boolean;
  history: DiscoveryJobSnapshot[];
  error?: string;
}> => {
  try {
    const response = await fetch('/api/prospects/locate/history', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    const { parsed } = await parseSafeJsonResponse<{
      success?: boolean;
      history?: DiscoveryJobSnapshot[];
      error?: string;
    }>(response);
    return {
      success: Boolean(parsed?.success && response.ok),
      history: Array.isArray(parsed?.history) ? parsed.history : [],
      error: parsed?.error
    };
  } catch (err: any) {
    return {
      success: false,
      history: [],
      error: err?.message || 'Failed to fetch discovery job history'
    };
  }
};

/**
 * @deprecated Prefer `locateProspects`; `/api/prospects/search` delegates directly to the authoritative locate engine.
 */
export const searchProspects = async (region: string, niche: string): Promise<{ success: boolean; count: number }> => {
  try {
    const response = await fetch('/api/prospects/search', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ region, niche }),
    });
    const { parsed } = await parseSafeJsonResponse<{ success?: boolean; count?: number; results?: any[] }>(response);
    return {
      success: Boolean(parsed?.success && response.ok),
      count: typeof parsed?.count === 'number' ? parsed.count : (Array.isArray(parsed?.results) ? parsed.results.length : 0)
    };
  } catch (error) {
    console.error('Error searching prospects:', error);
    throw error;
  }
};

export const generateProspectDraft = async (
  id: string,
  prospect?: Partial<Prospect> | Record<string, any>
): Promise<{ success: boolean; ai_draft?: string; email_draft?: string; whatsapp_draft?: string; suggested_email?: string | null }> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/prospects/generate', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, ...(prospect ? { prospect } : {}) }),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) throw new Error(parsed?.error || 'Failed to generate prospect draft');
    return parsed || { success: false };
  } catch (error) {
    console.error('Error generating prospect draft:', error);
    throw error;
  }
};

export const sendProspectOutreach = async (id: string, channel: string, draft: string): Promise<{ success: boolean }> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/prospects/send', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, channel, draft }),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    return parsed || { success: false };
  } catch (error) {
    console.error('Error sending prospect outreach:', error);
    throw error;
  }
};

export const scrapeProspectContacts = async (params: {
  id?: string;
  website_url?: string;
  name?: string;
  location?: string;
  social_profiles?: Record<string, string | null>;
  website_quality_category?: string;
  website_quality_score?: number;
  evidence?: string;
}): Promise<{
  success: boolean;
  isTemporary?: boolean;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  social_profiles?: Record<string, string>;
  contact_evidence?: any[];
  pages_scraped?: string[];
  sources_checked?: string[];
  email_draft?: string;
  whatsapp_draft?: string;
  error?: string;
}> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/prospects/scrape', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) {
      throw new Error(parsed?.error || 'Failed to scrape prospect contacts');
    }
    return parsed || { success: false };
  } catch (error) {
    console.error('Error scraping prospect contacts:', error);
    throw error;
  }
};

export const logProspectOutreach = async (
  id: string,
  payload: {
    channel: 'WhatsApp' | 'Email' | 'whatsapp' | 'email';
    recipient: string;
    subject?: string;
    message: string;
    delivery_status?: OutreachDeliveryStatus;
    provider?: string;
    ai_generated?: boolean;
    crm_lead_id?: string;
    business_name?: string;
    send_via_email?: boolean;
  }
): Promise<{
  success: boolean;
  logged?: boolean;
  status: string;
  delivery_status?: OutreachDeliveryStatus;
  provider?: string;
  provider_message_id?: string | null;
  error?: string;
  id?: string;
  log?: CrmOutreachLog;
}> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/prospects/${id}/outreach-log`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) {
      throw new Error(parsed?.error || 'Failed to log outreach');
    }
    return parsed;
  } catch (error) {
    console.error('Error logging outreach:', error);
    throw error;
  }
};

export const getCrmOutreachLogs = async (params?: {
  channel?: 'ALL' | 'email' | 'whatsapp';
  delivery_status?: string;
  lead_id?: string;
  prospect_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  logs: CrmOutreachLog[];
  total: number;
  summary: CrmOutreachSummary;
  emailConfigured: boolean;
}> => {
  try {
    const query = new URLSearchParams();
    if (params?.channel && params.channel !== 'ALL') query.set('channel', params.channel);
    if (params?.delivery_status && params.delivery_status !== 'ALL') query.set('delivery_status', params.delivery_status);
    if (params?.lead_id) query.set('lead_id', params.lead_id);
    if (params?.prospect_id) query.set('prospect_id', params.prospect_id);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const qs = query.toString();
    const response = await fetch(`/api/crm/outreach-logs${qs ? `?${qs}` : ''}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) {
      throw new Error(parsed?.error || 'Failed to fetch CRM outreach logs');
    }
    return parsed;
  } catch (error) {
    console.error('Error fetching CRM outreach logs:', error);
    throw error;
  }
};

export const updateCrmOutreachLogStatus = async (
  logId: string,
  payload: {
    delivery_status: OutreachDeliveryStatus;
    error_message?: string | null;
    provider_message_id?: string | null;
  }
): Promise<{ success: boolean; log: CrmOutreachLog }> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/crm/outreach-logs/${encodeURIComponent(logId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const { parsed } = await parseSafeJsonResponse<any>(response);
  if (!response.ok) {
    throw new Error(parsed?.error || 'Failed to update outreach log status');
  }
  return parsed;
};

export const generateCrmLeadPitch = async (
  leadId: string
): Promise<{
  success: boolean;
  ai_generated: boolean;
  model_backed?: boolean;
  email: { subject: string; body: string };
  whatsappMessage: string;
}> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/outreach`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action: 'generate_pitch' })
  });
  const { parsed } = await parseSafeJsonResponse<any>(response);
  if (!response.ok) {
    throw new Error(parsed?.error || 'Failed to generate lead pitch');
  }
  return parsed;
};

export const sendOrLogCrmLeadOutreach = async (
  leadId: string,
  payload: {
    channel: 'email' | 'whatsapp';
    recipient: string;
    subject?: string;
    message: string;
    delivery_status?: OutreachDeliveryStatus;
    ai_generated?: boolean;
    send_via_email?: boolean;
  }
): Promise<{
  success: boolean;
  logged?: boolean;
  delivery_status: OutreachDeliveryStatus;
  provider?: string;
  provider_message_id?: string | null;
  error?: string;
  log?: CrmOutreachLog;
}> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}/outreach`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  const { parsed } = await parseSafeJsonResponse<any>(response);
  if (!response.ok) {
    throw new Error(parsed?.error || 'Failed to record CRM lead outreach');
  }
  return parsed;
};

export interface AddToCrmItemResult {
  id: string;
  prospect_id: string | null;
  lead_id: string | null;
  business_name: string;
  status: 'added' | 'already_exists' | 'rejected' | 'failed';
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
  error?: string;
}

export const bulkAddProspectsToCrm = async (payload: {
  prospects: Array<Partial<Prospect> | Record<string, any>>;
  requested_service?: string;
  priority?: string;
  notes?: string;
  contact_name?: string;
}): Promise<AddToCrmBatchResponse> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/prospects/crm/add', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const { parsed } = await parseSafeJsonResponse<AddToCrmBatchResponse>(response);
    if (!response.ok || !parsed) {
      throw new Error(parsed?.error || `CRM admission failed (HTTP ${response.status})`);
    }
    return parsed;
  } catch (error) {
    console.error('Error adding prospects to CRM:', error);
    throw error;
  }
};

export const promoteProspectToCrm = async (
  id: string, 
  options?: { 
    requested_service?: string; 
    priority?: string; 
    notes?: string; 
    contact_name?: string;
    prospect?: Partial<Prospect> | Record<string, any>;
  }
): Promise<{
  success: boolean;
  lead_id?: string | null;
  prospect_id?: string | null;
  deduplicated?: boolean;
  status?: 'added' | 'already_exists' | 'rejected' | 'failed';
  matchedBy?: string;
  message?: string;
}> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/prospects/${id}/promote`, {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(options || {}),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) {
      throw new Error(parsed?.error || 'Failed to promote prospect to CRM');
    }
    return parsed;
  } catch (error) {
    console.error('Error promoting prospect to CRM:', error);
    throw error;
  }
};

export const reassessProspectWebsite = async (
  id: string, 
  website_url?: string,
  location?: string
): Promise<{ success: boolean; isTemporary?: boolean; assessment: any; prospect: Prospect | null }> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/prospects/reassess-website', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id, website_url, ...(location ? { location } : {}) }),
    });
    const { parsed } = await parseSafeJsonResponse<any>(response);
    if (!response.ok) {
      throw new Error(parsed?.error || 'Failed to reassess website');
    }
    return parsed;
  } catch (error) {
    console.error('Error reassessing website:', error);
    throw error;
  }
};

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * FETCH: PROJECTS
 */
export const getProjects = async (limit: number = 50, offset: number = 0): Promise<Project[]> => {
  console.log('[Frontend] Fetching projects...');
  try {
    const url = `/api/projects?limit=${limit}&offset=${offset}`;
    console.log('[Frontend] Fetching from:', url);
    const response = await fetch(url);
    console.log('[Frontend] Projects response status:', response.status);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText} - ${errorText}`);
  } catch (e: any) {
    console.warn('API Fetch Notice (Projects):', e?.message || e);
    return [];
  }
};

/**
 * FETCH: PROJECT COUNT
 */
export const getProjectsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/projects/count');
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * SAVE: PROJECT
 */
export const saveProject = async (project: Partial<Project>): Promise<Project> => {
  const newProject = {
    ...project,
    id: project.id || generateUUID(),
    created_at: project.created_at || new Date().toISOString(),
    media: project.media || [],
    tags: project.tags || [],
  } as Project;

  try {
    await ensureCsrfToken();
    const response = await fetch('/api/projects', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(newProject)
    });
    if (response.ok) return newProject;
    throw new Error('Failed to save project');
  } catch (e) {
    console.error('API Save Error (Project):', e);
    throw e;
  }
};

/**
 * DELETE: PROJECT
 */
export const deleteProject = async (id: string): Promise<void> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete project');
  } catch (e) {
    console.error('API Delete Error (Project):', e);
    throw e;
  }
};

/**
 * FETCH: BLOGS
 */
export const getBlogBySlug = async (slug: string): Promise<Post> => {
  const res = await fetch(`/api/blogs/${slug}`);
  if (!res.ok) throw new Error('Failed to fetch blog');
  return res.json();
};

export const getBlogs = async (): Promise<Post[]> => {
  try {
    const response = await fetch('/api/blogs', { credentials: 'include' });
    if (response.ok) return await response.json();
    if (response.status === 401) return [];
    throw new Error('Failed to fetch blogs');
  } catch (e: any) {
    if (!e?.message?.includes('401')) {
      console.warn('API Fetch Notice (Blogs):', e?.message || e);
    }
    return [];
  }
};

/**
 * FETCH: BLOG COUNT
 */
export const getBlogsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/blogs/count');
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * SAVE: BLOG
 */
export const saveBlog = async (blog: Partial<Post>): Promise<Post> => {
  const newBlog = {
    ...blog,
    id: blog.id || generateUUID(),
    created_at: blog.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Post;

  try {
    await ensureCsrfToken();
    const response = await fetch(blog.id ? `/api/blogs/${blog.id}` : '/api/blogs', {
      method: blog.id ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(newBlog)
    });
    if (response.ok) return newBlog;
    throw new Error('Failed to save blog');
  } catch (e) {
    console.error('API Save Error (Blog):', e);
    throw e;
  }
};

/**
 * DELETE: BLOG
 */
export const deleteBlog = async (id: string): Promise<void> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/blogs/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete blog');
  } catch (e) {
    console.error('API Delete Error (Blog):', e);
    throw e;
  }
};

/**
 * AUTH: LOGIN
 */
export const apiLogin = async (email: string, password: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password })
    });
    setCsrfToken(response.headers.get('x-csrf-token'));
    return response.ok;
  } catch (e) {
    console.error('API Auth Error:', e);
    return false;
  }
};

/**
 * AUTH: CHANGE PASSWORD
 */
export const changePassword = async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
  try {
    await ensureCsrfToken();
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to change password');
    }
  } catch (e) {
    console.error('API Change Password Error:', e);
    throw e;
  }
};

/**
 * ANALYTICS: INIT
 */
export const initAnalytics = async (session: any): Promise<void> => {
  try {
    await fetch('/api/analytics/init', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(session)
    });
  } catch (e) {
    console.warn('Analytics Init Failed (Backend):', e);
  }
};

/**
 * ANALYTICS: SYNC
 */
export const syncAnalytics = async (session: any): Promise<void> => {
  try {
    await fetch('/api/analytics/sync', {
      method: 'PATCH',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(session)
    });
  } catch (e) {
    console.warn('Analytics Sync Failed (Backend):', e);
  }
};

/**
 * FETCH: DB HEALTH
 */
export const getDbHealth = async (): Promise<{ status: string; error?: string; isIpBlocked?: boolean; api_connections?: { gemini: boolean; locationiq: boolean; emailjs: boolean; nvidia: boolean; } }> => {
  try {
    const response = await fetch('/api/db-health', { credentials: 'include' });
    return await response.json();
  } catch (e) {
    return { status: 'error', error: 'Network error' };
  }
};

export const getServicesHealth = async (): Promise<Record<string, { status: string; latency?: number; message?: string }>> => {
  try {
    const response = await fetch('/api/services-health', {
      credentials: 'include',
      cache: 'no-store',
      headers: getAuthHeaders()
    });
    return await response.json();
  } catch (e) {
    return { 
      locationiq: { status: 'offline', message: 'Network error' },
      nvidia: { status: 'offline', message: 'Network error' }
    };
  }
};

/**
 * FETCH: ADMIN SUMMARY (Aggregated Stats)
 */
export const getAdminSummary = async (): Promise<{ 
  analytics: { total_visitors: number; avg_duration: number; recent_visitors: number };
  revenue: number;
}> => {
  try {
    const response = await fetch('/api/admin/summary', {
      credentials: 'include',
      cache: 'no-store',
      headers: getAuthHeaders()
    });
    if (response.ok) return await response.json();
    throw new Error('Summary fetch failed');
  } catch (e) {
    return { 
      analytics: { total_visitors: 0, avg_duration: 0, recent_visitors: 0 }, 
      revenue: 0 
    };
  }
};

/**
 * FETCH: LEADS
 */
export const getLeads = async (limit: number = 100, offset: number = 0): Promise<Lead[]> => {
  try {
    const response = await fetch(`/api/leads?limit=${limit}&offset=${offset}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch leads');
  } catch (e: any) {
    console.warn('API Fetch Notice (Leads):', e?.message || e);
    return [];
  }
};

/**
 * FETCH: LEADS COUNT
 */
export const getLeadsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/leads/count', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

export const getLeadStats = async (): Promise<{ total: number; new_leads: number; qualified: number; won: number; lost: number; follow_ups_due: number }> => {
  try {
    const response = await fetch('/api/leads/stats', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      return await response.json();
    }
    return { total: 0, new_leads: 0, qualified: 0, won: 0, lost: 0, follow_ups_due: 0 };
  } catch (e) {
    return { total: 0, new_leads: 0, qualified: 0, won: 0, lost: 0, follow_ups_due: 0 };
  }
};

/**
 * FETCH: ANALYTICS
 */
export const getAnalytics = async (limit: number = 100, offset: number = 0): Promise<SiteAnalytics[]> => {
  try {
    const response = await fetch(`/api/analytics?limit=${limit}&offset=${offset}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch analytics');
  } catch (e: any) {
    console.warn('API Fetch Notice (Analytics):', e?.message || e);
    return [];
  }
};

/**
 * FETCH: ANALYTICS COUNT
 */
export const getAnalyticsCount = async (): Promise<number> => {
  try {
    const response = await fetch('/api/analytics/count', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.count) || 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * FETCH: ANALYTICS FUNNEL
 */
export const getFunnelData = async (range: '7D' | '30D' | 'ALL' = 'ALL'): Promise<{ step: number; count: number }[]> => {
  try {
    const response = await fetch(`/api/analytics-funnel?range=${encodeURIComponent(range)}`, {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (response.ok) {
      return await response.json();
    }
    throw new Error('Failed to fetch funnel');
  } catch (e: any) {
    console.warn('API Fetch Notice (Funnel):', e?.message || e);
    return [];
  }
};

/**
 * LIVE WEBSITE DIAGNOSTICS (Real HTTP Probe, axe-core & Google PageSpeed)
 */
export const diagnoseWebsite = async (url: string): Promise<any> => {
  const response = await fetch('/api/audit/diagnose', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ url })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Diagnostic execution failed');
  }
  return data.diagnostics;
};

/**
 * SAVE: LEAD DATA
 */
export const saveLead = async (data: any): Promise<any> => {
  const newLead = {
    id: generateUUID(),
    session_id: data.session_id,
    target_url: data.target_url,
    user_email: data.user_email,
    user_phone: data.user_phone,
    revenue_tier: data.revenue_tier,
    core_problem: data.core_problem || "Initial scan pending",
    cta_source: data.cta_source || 'direct v4',
    status: 'pending',
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(newLead)
    });
    if (response.ok) return newLead;
    throw new Error('Failed to save lead');
  } catch (e) {
    console.error('API Save Error (Lead):', e);
    throw e;
  }
};

/**
 * SAVE: SESSION BOOKING
 */
export const saveBooking = async (data: any): Promise<any> => {
  const bookingEntry = {
    id: generateUUID(),
    ...data,
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(bookingEntry)
    });
    if (response.ok) return bookingEntry;
    
    // Attempt to read specific error from backend
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error) {
      throw new Error(errorData.error);
    }
    
    throw new Error('Failed to save booking');
  } catch (e) {
    console.error('API Save Error (Booking):', e);
    throw e;
  }
};

/**
 * FETCH: TAKEN SLOTS
 */
export const getBookings = async (): Promise<Booking[]> => {
  try {
    const response = await fetch('/api/bookings', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
};

export const fetchTakenSlots = async (date: string): Promise<string[]> => {
  if (!date || typeof date !== 'string') return [];
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
    
    const response = await fetch(`/api/bookings/slots?date=${encodeURIComponent(date)}`, {
      signal: controller?.signal
    });
    
    if (timeoutId) clearTimeout(timeoutId);
    
    if (response.ok) {
      const result = await response.json().catch(() => ({ slots: [] }));
      return Array.isArray(result?.slots) ? result.slots : [];
    }
    return [];
  } catch (e: any) {
    console.warn('[Taken Slots Notice]: Unable to fetch taken slots, defaulting to available:', e?.message || e);
    return [];
  }
};

/**
 * UPDATE: LEAD DATA
 */
export const updateLead = async (id: string, updates: Partial<Lead>): Promise<void> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update lead');
  } catch (e) {
    console.error('API Update Error (Lead):', e);
    throw e;
  }
};

/**
 * UPDATE: LEAD STATUS
 */
export const updateLeadStatus = async (id: string, status: Lead['status']): Promise<void> => {
  return updateLead(id, { status });
};

/**
 * DELETE: LEAD RECORD
 */
export const deleteLead = async (id: string): Promise<void> => {
  try {
    await ensureCsrfToken();
    const response = await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to delete lead');
  } catch (e) {
    console.error('API Delete Error (Lead):', e);
    throw e;
  }
};

/**
 * ADMIN USERS API
 */
export const getAdminUsers = async (): Promise<any[]> => {
  try {
    const response = await fetch('/api/admin/users', {
      credentials: 'include',
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Failed to fetch admin users');
    return response.json();
  } catch (error) {
    console.error('Error fetching admin users:', error);
    return [];
  }
};

export const createAdminUser = async (data: { email: string; password: string; role?: string }): Promise<any> => {
  await ensureCsrfToken();
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to create user');
  }
  return response.json();
};

export const updateAdminUser = async (id: number | string, updates: { role?: string; is_active?: boolean; password?: string }): Promise<any> => {
  await ensureCsrfToken();
  const payload: { role?: string; is_active?: boolean; password?: string } = {
    role: updates.role,
    is_active: updates.is_active
  };
  if (updates.password && updates.password.trim().length > 0) {
    payload.password = updates.password;
  }
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update user');
  }
  return response.json();
};

export const deleteAdminUser = async (id: number | string): Promise<void> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to delete user');
  }
};

export interface RegisteredUserAccount {
  id: number | string;
  email: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  active_sessions?: number;
}

export const getRegisteredUsers = async (params?: { search?: string; status?: 'all' | 'active' | 'disabled' }): Promise<RegisteredUserAccount[]> => {
  const qs = new URLSearchParams();
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  const queryStr = qs.toString();
  const response = await fetch(`/api/admin/registered-users${queryStr ? `?${queryStr}` : ''}`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to fetch registered users');
  }
  return response.json();
};

export const updateRegisteredUser = async (id: number | string, updates: { is_active: boolean }): Promise<RegisteredUserAccount> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/admin/registered-users/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to update registered user');
  }
  return response.json();
};

export const revokeRegisteredUserSessions = async (id: number | string): Promise<{ success: boolean; revoked_count: number; message?: string }> => {
  await ensureCsrfToken();
  const response = await fetch(`/api/admin/registered-users/${id}/revoke-sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to revoke registered user sessions');
  }
  return response.json();
};

// =========================================================================
// STEP 7: CLIENT PROJECT DELIVERY HUB API CLIENTS
// =========================================================================

/**
 * ADMIN: Get Delivery Projects with filters
 */
export const getDeliveryProjects = async (filters?: {
  status?: string;
  client_email?: string;
  include_archived?: boolean;
}): Promise<ClientProject[]> => {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters?.client_email) params.append('client_email', filters.client_email);
  if (filters?.include_archived) params.append('include_archived', 'true');

  const response = await fetch(`/api/admin/delivery/projects?${params.toString()}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load projects');
  }
  return response.json();
};

/**
 * ADMIN: Create Delivery Project
 */
export const createDeliveryProject = async (data: Partial<ClientProject>): Promise<ClientProject> => {
  const response = await fetch('/api/admin/delivery/projects', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create project');
  }
  return response.json();
};

/**
 * ADMIN: Get Single Delivery Project Detail
 */
export const getDeliveryProjectDetail = async (id: string): Promise<ClientProject> => {
  const response = await fetch(`/api/admin/delivery/projects/${id}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load project details');
  }
  return response.json();
};

/**
 * ADMIN: Update Delivery Project
 */
export const updateDeliveryProject = async (id: string, updates: Partial<ClientProject>): Promise<ClientProject> => {
  const response = await fetch(`/api/admin/delivery/projects/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update project');
  }
  return response.json();
};

/**
 * ADMIN: Delete Delivery Project
 */
export const deleteDeliveryProject = async (id: string): Promise<void> => {
  const response = await fetch(`/api/admin/delivery/projects/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete project');
  }
};

/**
 * ADMIN: Create Milestone
 */
export const createMilestone = async (
  projectId: string, 
  data: Partial<ProjectMilestone>
): Promise<ProjectMilestone> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/milestones`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create milestone');
  }
  return response.json();
};

/**
 * ADMIN: Update Milestone
 */
export const updateMilestone = async (
  projectId: string, 
  milestoneId: string, 
  updates: Partial<ProjectMilestone>
): Promise<ProjectMilestone> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/milestones/${milestoneId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update milestone');
  }
  return response.json();
};

/**
 * ADMIN: Delete Milestone
 */
export const deleteMilestone = async (projectId: string, milestoneId: string): Promise<void> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/milestones/${milestoneId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete milestone');
  }
};

/**
 * ADMIN: Reorder Milestones
 */
export const reorderMilestones = async (projectId: string, milestoneIds: string[]): Promise<void> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/milestones/reorder`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify({ milestone_ids: milestoneIds })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reorder milestones');
  }
};

/**
 * ADMIN: Create Deliverable
 */
export const createDeliverable = async (
  projectId: string, 
  data: Partial<ProjectDeliverable>
): Promise<ProjectDeliverable> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/deliverables`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create deliverable');
  }
  return response.json();
};

/**
 * ADMIN: Delete Deliverable
 */
export const deleteDeliverable = async (projectId: string, deliverableId: string): Promise<void> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/deliverables/${deliverableId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete deliverable');
  }
};

/**
 * ADMIN: Add Project Activity / Internal Note
 */
export const addProjectActivity = async (
  projectId: string, 
  data: { message: string; visibility?: string; type?: string }
): Promise<ProjectActivity> => {
  const response = await fetch(`/api/admin/delivery/projects/${projectId}/activities`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add activity log');
  }
  return response.json();
};

/**
 * CLIENT: Get My Projects (Isolated to current authenticated user)
 */
export const getClientDeliveryProjects = async (): Promise<ClientProject[]> => {
  const response = await fetch('/api/client/delivery/projects', {
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load projects');
  }
  return response.json();
};

/**
 * CLIENT: Get Single Project Detail (Strict IDOR Protected)
 */
export const getClientDeliveryProjectDetail = async (id: string): Promise<ClientProject> => {
  const response = await fetch(`/api/client/delivery/projects/${id}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load project details');
  }
  return response.json();
};

/**
 * CLIENT: Submit Feedback or Request Revision
 */
export const submitClientFeedback = async (
  projectId: string,
  data: { message: string; type?: 'client_feedback' | 'revision_request'; milestone_id?: string }
): Promise<{ success: boolean; message: string; project_status: string }> => {
  const response = await fetch(`/api/client/delivery/projects/${projectId}/feedback`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit feedback');
  }
  return response.json();
};

// =========================================================================
// STEP 8: AI AUTOMATION ENGINE API CLIENTS
// =========================================================================

export const runAiEnquirySummary = async (payload: { lead_id?: string; enquiry_text?: string; business_name?: string; requested_service?: string }) => {
  const response = await fetch('/api/ai/automate/enquiry-summary', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'AI Enquiry Summarizer failed');
  }
  return response.json();
};

export const runAiProposalDraft = async (payload: { client_name?: string; business_name: string; requested_service: string; scope?: string; budget_tier?: string }) => {
  const response = await fetch('/api/ai/automate/proposal-draft', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'AI Proposal Generator failed');
  }
  return response.json();
};

export const runAiAuditEnhancer = async (payload: { url: string; raw_findings?: any }) => {
  const response = await fetch('/api/ai/automate/audit-enhancer', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'AI Audit Enhancer failed');
  }
  return response.json();
};

export const runAiProjectReporter = async (payload: { project_id: string }) => {
  const response = await fetch('/api/ai/automate/project-reporter', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'AI Project Reporter failed');
  }
  return response.json();
};

export const getAiUsageStats = async () => {
  const response = await fetch('/api/admin/ai/usage', {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch AI usage statistics');
  }
  return response.json();
};



