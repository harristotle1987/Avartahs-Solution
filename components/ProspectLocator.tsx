import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Search,
  MapPin,
  Loader2,
  Globe,
  Compass,
  X,
  MessageSquare,
  History,
  Mail,
  ExternalLink,
  Download,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Send,
  UserPlus,
  Filter,
  ShieldCheck,
  Tag,
  Phone,
  Copy,
  Check,
  Sparkles,
  Radar,
  Square,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal
} from 'lucide-react';
import {
  WebsiteQualityCategory,
  mapInternalStatusToCategory,
  buildMailtoUrl,
  buildWhatsAppUrl,
  generateValueFirstPitch
} from '../lib/prospects';
import {
  DiscoveryJobSnapshot,
  DiscoveryJobStatus,
  LocateDbStats,
  LocateMetrics,
  LocateProviderStats,
  LocateProspectItem,
  getLocateJobHistory,
  getLocateJobStatus,
  locateProspects,
  stopLocateJob,
  bulkAddProspectsToCrm,
  reassessProspectWebsite,
  scrapeProspectContacts,
  logProspectOutreach
} from '../lib/api';
import type { ContactEvidence } from '../lib/prospects';

interface ContactHistory {
  date: string;
  channel: 'Email' | 'WhatsApp';
  status: string;
}

interface ProspectResult {
  id: string;
  canonical_key?: string;
  latitude: number;
  longitude: number;
  label: string;
  name: string;
  type: string;
  country: string;
  phone?: string;
  website?: string;
  email?: string;
  email_draft?: string;
  whatsapp_draft?: string;
  status:
    | 'discovered'
    | 'analyzing'
    | 'ready'
    | 'sent'
    | 'failed'
    | 'NO_WEBSITE'
    | 'BROKEN_WEBSITE'
    | 'OUTDATED_WEBSITE'
    | 'GOOD_WEBSITE'
    | 'NEEDS_REVIEW'
    | 'NEEDS_CONTACT';
  website_quality_category?: WebsiteQualityCategory;
  website_quality_score?: number;
  website_availability?: 'ONLINE' | 'PERSISTENT_FAILURE' | 'TEMPORARILY_UNAVAILABLE' | 'NONE' | 'UNVERIFIED';
  evidence?: string;
  whatsapp_link?: string;
  whatsapp_unconfirmed?: boolean;
  social_profiles?: Record<string, string | null>;
  sources_checked?: string[];
  contact_evidence?: ContactEvidence[];
  has_public_email?: boolean;
  has_public_phone?: boolean;
  phone_only?: boolean;
  isTemporary?: boolean;
  source?: string;
  discovery_timestamp?: string;
  history?: ContactHistory[];
  isDuplicate?: boolean;
  isExistingRecord?: boolean;
  reviewed_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROMOTED';
  verification_status?: string;
  crm_lead_id?: string | null;
  promoted_at?: string | null;
  suggested_service?: string;
  outreach_status?: string;
  last_outreach_at?: string;
}

type ReviewTabKey = 'qualified' | 'phone_only' | 'needs_contact' | 'excluded_good' | 'existing_crm';

const QUICK_NICHES = [
  { label: 'Spas & Wellness', value: 'spas' },
  { label: 'Dental Clinics', value: 'dentist' },
  { label: 'Restaurants & Eateries', value: 'restaurants' },
  { label: 'Law Firms', value: 'law firms' },
  { label: 'Furniture Stores', value: 'furniture' },
  { label: 'Hotels & Lodges', value: 'hotels' },
  { label: 'Gyms & Fitness', value: 'gyms' },
  { label: 'Beauty Salons', value: 'salons' },
  { label: 'Auto Repair', value: 'auto repair' },
  { label: 'Supermarkets', value: 'supermarkets' }
];

const DEFAULT_METRICS: LocateMetrics = {
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

const TERMINAL_JOB_STATUSES = new Set<DiscoveryJobStatus>([
  'COMPLETED',
  'PARTIAL_SUCCESS',
  'FAILED',
  'STOPPED'
]);

function normalizeProspectItem(r: LocateProspectItem, fallbackStatus: ProspectResult['status'] = 'NO_WEBSITE'): ProspectResult {
  const resolvedStatus = (r.status || fallbackStatus) as ProspectResult['status'];
  const emailVal = r.email || '';
  const phoneVal = r.phone || '';
  return {
    id: r.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`),
    canonical_key: r.canonical_key,
    latitude: Number(r.latitude) || 0,
    longitude: Number(r.longitude) || 0,
    label: r.label || '',
    name: r.name || 'Unnamed Business',
    type: r.type || 'Local Business',
    country: r.country || 'N/A',
    phone: phoneVal,
    email: emailVal,
    website: r.website || '',
    email_draft: r.email_draft || '',
    whatsapp_draft: r.whatsapp_draft || '',
    status: resolvedStatus,
    website_quality_category: (r.website_quality_category as WebsiteQualityCategory) || mapInternalStatusToCategory(resolvedStatus),
    website_quality_score: typeof r.website_quality_score === 'number' ? r.website_quality_score : 0,
    website_availability: r.website_availability || 'UNVERIFIED',
    evidence: r.evidence || '',
    whatsapp_link: r.whatsapp_link,
    whatsapp_unconfirmed: Boolean(r.whatsapp_unconfirmed),
    social_profiles: r.social_profiles,
    sources_checked: Array.isArray(r.sources_checked) ? r.sources_checked : [],
    contact_evidence: Array.isArray(r.contact_evidence) ? r.contact_evidence : [],
    has_public_email: typeof r.has_public_email === 'boolean' ? r.has_public_email : Boolean(emailVal),
    has_public_phone: typeof r.has_public_phone === 'boolean' ? r.has_public_phone : Boolean(phoneVal),
    phone_only: typeof r.phone_only === 'boolean' ? r.phone_only : Boolean(phoneVal && !emailVal),
    isTemporary: typeof r.isTemporary === 'boolean' ? r.isTemporary : !r.isExistingRecord,
    source: r.source || 'OpenStreetMap',
    discovery_timestamp: r.discovery_timestamp || new Date().toISOString(),
    isDuplicate: Boolean(r.isDuplicate),
    isExistingRecord: Boolean(r.isExistingRecord),
    reviewed_status: r.reviewed_status || 'PENDING',
    verification_status: r.verification_status || 'NOT_FOUND',
    crm_lead_id: r.crm_lead_id ?? null,
    promoted_at: r.promoted_at ?? null,
    suggested_service: r.suggested_service,
    outreach_status: r.outreach_status || 'NOT_CONTACTED'
  };
}

function getJobStatusStyle(status: DiscoveryJobStatus) {
  switch (status) {
    case 'COMPLETED':
      return {
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        label: 'Completed'
      };
    case 'PARTIAL_SUCCESS':
      return {
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        label: 'Partial Success'
      };
    case 'STOPPED':
      return {
        badge: 'bg-[#C58A52]/15 text-[#D99B62] border-[#C58A52]/30',
        label: 'Stopped'
      };
    case 'FAILED':
      return {
        badge: 'bg-red-500/15 text-red-300 border-red-500/30',
        label: 'Failed'
      };
    case 'ENRICHING':
      return {
        badge: 'bg-[#C58A52]/20 text-[#D99B62] border-[#C58A52]/40',
        label: 'Enriching'
      };
    case 'DISCOVERING':
    default:
      return {
        badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        label: 'Discovering'
      };
  }
}

export const ProspectLocator: React.FC<{ onSaved?: () => void }> = ({ onSaved }) => {
  const [locationInput, setLocationInput] = useState('');
  const [nicheInput, setNicheInput] = useState('');
  const [targetCount, setTargetCount] = useState<number>(20);
  const [skipWebsites, setSkipWebsites] = useState(true);
  const [hideDuplicates, setHideDuplicates] = useState(false);

  // Filters
  const [qualityFilter, setQualityFilter] = useState<string>('ALL');
  const [contactCompletenessFilter, setContactCompletenessFilter] = useState<string>('ALL');
  const [crmStatusFilter, setCrmStatusFilter] = useState<string>('ALL');

  // Job & Results State (strictly ephemeral session memory until explicit Add to CRM)
  const [loading, setLoading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [stoppingJob, setStoppingJob] = useState(false);
  const [jobStatus, setJobStatus] = useState<DiscoveryJobStatus | null>(null);
  const [stageMessage, setStageMessage] = useState<string | null>(null);

  const [results, setResults] = useState<ProspectResult[]>([]);
  const [needsContact, setNeedsContact] = useState<ProspectResult[]>([]);
  const [excludedGoodWebsites, setExcludedGoodWebsites] = useState<ProspectResult[]>([]);
  const [existingMatches, setExistingMatches] = useState<ProspectResult[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedEvidenceIds, setExpandedEvidenceIds] = useState<string[]>([]);

  const [errorState, setErrorState] = useState<{ message: string; code?: string; status?: number } | null>(null);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [clarificationMessage, setClarificationMessage] = useState<string | null>(null);
  const [shortfallExplanation, setShortfallExplanation] = useState<string | null>(null);
  const [searchDurationMs, setSearchDurationMs] = useState<number | null>(null);

  const [metrics, setMetrics] = useState<LocateMetrics>(DEFAULT_METRICS);
  const [dbStats, setDbStats] = useState<LocateDbStats | null>(null);
  const [providerStats, setProviderStats] = useState<LocateProviderStats | null>(null);
  const [expandedQueries, setExpandedQueries] = useState<string[]>([]);
  const [resolvedLocation, setResolvedLocation] = useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useState<ReviewTabKey>('qualified');

  // Search Job History (Compact, Read-Only)
  const [historyOpen, setHistoryOpen] = useState(false);
  const [jobHistory, setJobHistory] = useState<DiscoveryJobSnapshot[]>([]);

  // Per-row Action States
  const [reassessingId, setReassessingId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [generatingDraftId, setGeneratingDraftId] = useState<string | null>(null);
  const [batchPromoting, setBatchPromoting] = useState(false);

  // Manual Outreach Modal States
  const [emailComposer, setEmailComposer] = useState<{
    isOpen: boolean;
    prospect: ProspectResult;
    subject: string;
    body: string;
  } | null>(null);

  const [whatsAppComposer, setWhatsAppComposer] = useState<{
    isOpen: boolean;
    prospect: ProspectResult;
    phone: string;
    message: string;
  } | null>(null);

  // Single & Batch CRM Promotion Modal States
  const [promoteModal, setPromoteModal] = useState<{
    isOpen: boolean;
    prospects: ProspectResult[];
    requestedService: string;
    priority: string;
    notes: string;
  } | null>(null);

  // Custom Toast state
  const [toast, setToast] = useState<{ message: string; description?: string; type: 'success' | 'error' } | null>(null);

  // Custom Confirmation Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    isSavingBatch?: boolean;
  } | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const lastPollSignatureRef = useRef<string>('');

  const showLocalToast = useCallback((message: string, description?: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, description, type });
    setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 4500);
  }, []);

  const refreshJobHistory = useCallback(async () => {
    const res = await getLocateJobHistory();
    if (mountedRef.current && res.success) {
      setJobHistory(res.history);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refreshJobHistory();
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [refreshJobHistory]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Read-only polling loop: 6s initial interval, 10s backoff when unchanged, stops immediately on terminal status or unmount
  const scheduleStatusPoll = useCallback(
    (jobId: string, delayMs: number) => {
      stopPolling();
      pollTimerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        const statusRes = await getLocateJobStatus(jobId);
        if (!mountedRef.current) return;

        if (!statusRes.success || !statusRes.job) {
          // Transient 404 before backend starts or network glitch — retry calmly at 10s while request is still active
          scheduleStatusPoll(jobId, 10000);
          return;
        }

        const snap = statusRes.job;
        setJobStatus(snap.status);
        setStageMessage(snap.stageMessage);
        setMetrics(snap.metrics);
        setDbStats(snap.dbStats);
        setProviderStats(snap.providerStats);

        if (TERMINAL_JOB_STATUSES.has(snap.status)) {
          stopPolling();
          return;
        }

        const sig = `${snap.status}|${snap.stageMessage}|${snap.metrics.discovered}|${snap.metrics.qualified}`;
        const unchanged = sig === lastPollSignatureRef.current;
        lastPollSignatureRef.current = sig;
        scheduleStatusPoll(jobId, unchanged ? 10000 : 6000);
      }, delayMs);
    },
    [stopPolling]
  );

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();

    let combinedQuery = customQuery;
    if (!combinedQuery) {
      const loc = locationInput.trim();
      const niche = nicheInput.trim();
      if (!loc && !niche) {
        setErrorState({
          message: 'Enter a business category and a target city or region to run discovery.',
          code: 'MISSING_QUERY',
          status: 400
        });
        return;
      }
      combinedQuery = loc && niche ? `${niche} in ${loc}` : loc || niche;
    }

    if (!combinedQuery) return;

    const clampedTarget = Math.min(20, Math.max(15, Number(targetCount) || 20));
    const clientJobId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    setLoading(true);
    setStoppingJob(false);
    setActiveJobId(clientJobId);
    setJobStatus('DISCOVERING');
    setStageMessage(`Initializing multi-batch discovery for "${combinedQuery}" (target ${clampedTarget})...`);
    setErrorState(null);
    setProviderNotice(null);
    setClarificationMessage(null);
    setShortfallExplanation(null);
    setSearchDurationMs(null);
    setResults([]);
    setNeedsContact([]);
    setExcludedGoodWebsites([]);
    setExistingMatches([]);
    setSelectedIds([]);
    setExpandedQueries([]);
    setResolvedLocation(null);
    setDbStats(null);
    setProviderStats(null);
    setMetrics(DEFAULT_METRICS);
    lastPollSignatureRef.current = '';

    // Start bounded read-only status polling at 6s intervals
    scheduleStatusPoll(clientJobId, 6000);

    try {
      const res = await locateProspects({
        query: combinedQuery,
        skipWebsites,
        targetCount: clampedTarget,
        clientJobId
      });

      if (!mountedRef.current) return;
      stopPolling();
      setSearchPerformed(true);

      if (res.jobId) setActiveJobId(res.jobId);
      if (res.status) setJobStatus(res.status);
      if (res.metrics) setMetrics(res.metrics);
      if (res.db_stats) setDbStats(res.db_stats);
      if (res.provider_stats) setProviderStats(res.provider_stats);
      if (typeof res.search_duration_ms === 'number') setSearchDurationMs(res.search_duration_ms);
      if (res.expandedQueries) setExpandedQueries(res.expandedQueries);
      if (res.location_resolved) setResolvedLocation(res.location_resolved);

      if (res.clarificationRequired) {
        setClarificationMessage(res.message || 'Please clarify your target niche and location.');
        setJobStatus('COMPLETED');
        return;
      }

      if (!res.success) {
        setJobStatus(res.status || 'FAILED');
        setErrorState({
          message: res.error || 'Discovery could not complete. Please retry shortly.',
          code: res.errorCode,
          status: res.httpStatus
        });
        if (res.provider_stats?.providerFailures?.length) {
          setProviderNotice(res.provider_stats.providerFailures.slice(0, 3).join(' • '));
        }
        return;
      }

      const normalizedQualified = res.results.map((r) => normalizeProspectItem(r, 'NO_WEBSITE'));
      const normalizedNeedsContact = res.needsContact.map((r) => normalizeProspectItem(r, 'NEEDS_CONTACT'));
      const normalizedExcludedGood = res.excludedGoodWebsites.map((r) => normalizeProspectItem(r, 'GOOD_WEBSITE'));
      const normalizedExisting = res.existingMatches.map((r) => ({
        ...normalizeProspectItem(r, 'NO_WEBSITE'),
        isDuplicate: true,
        isExistingRecord: true
      }));

      setResults(normalizedQualified);
      setNeedsContact(normalizedNeedsContact);
      setExcludedGoodWebsites(normalizedExcludedGood);
      setExistingMatches(normalizedExisting);
      setShortfallExplanation(res.shortfall_explanation || null);
      setStageMessage(
        res.status === 'PARTIAL_SUCCESS'
          ? `Partial research results: ${normalizedQualified.length} temporary qualified prospects ready for review (0 DB writes).`
          : res.status === 'STOPPED'
          ? `Discovery stopped by administrator (${normalizedQualified.length} temporary qualified prospects ready for review).`
          : `Completed cleanly with ${normalizedQualified.length} temporary qualified prospects ready for review (not saved to CRM).`
      );

      if (res.status === 'PARTIAL_SUCCESS' && res.provider_stats?.providerFailures?.length) {
        setProviderNotice(
          `One or more external directory requests degraded (${res.provider_stats.providerFailures[0]}). Returned partial temporary candidates.`
        );
      }

      setActiveTab('qualified');
      refreshJobHistory();
    } finally {
      if (mountedRef.current) {
        stopPolling();
        setLoading(false);
        setStoppingJob(false);
      }
    }
  };

  const handleStopJob = async () => {
    if (!activeJobId || stoppingJob) return;
    setStoppingJob(true);
    const res = await stopLocateJob(activeJobId);
    if (res.success) {
      setStageMessage('Stop signal sent — finalizing evaluated batch and halting remaining provider calls...');
      showLocalToast('Stop Signal Sent', 'Finishing current candidate batch before halting.', 'success');
    } else {
      showLocalToast('Stop Unavailable', res.error || 'Discovery job is already finalizing.', 'error');
      setStoppingJob(false);
    }
  };

  const handleQuickNiche = (nicheVal: string) => {
    setNicheInput(nicheVal);
    const loc = locationInput.trim() || 'London';
    if (!locationInput.trim()) setLocationInput(loc);
    handleSearch(undefined, `${nicheVal} in ${loc}`);
  };

  const handleReassessWebsite = async (prospect: ProspectResult) => {
    setReassessingId(prospect.id);
    try {
      const res = await reassessProspectWebsite(prospect.id, prospect.website, prospect.label);
      if (res.success && res.assessment) {
        const updatedCat = res.assessment.website_quality_category || mapInternalStatusToCategory(res.assessment.status);
        const updateFn = (r: ProspectResult): ProspectResult => {
          if (r.id !== prospect.id) return r;
          const nextEmail = res.assessment.email || r.email;
          const nextPhone = res.assessment.phone || r.phone;
          return {
            ...r,
            status: res.assessment.status,
            website_quality_category: updatedCat,
            website_quality_score: res.assessment.qualityScore,
            website_availability: res.assessment.website_availability,
            evidence: res.assessment.evidence,
            email: nextEmail,
            phone: nextPhone,
            has_public_email: Boolean(nextEmail),
            has_public_phone: Boolean(nextPhone),
            phone_only: Boolean(nextPhone && !nextEmail),
            contact_evidence: Array.isArray(res.assessment.contactEvidence) && res.assessment.contactEvidence.length > 0
              ? res.assessment.contactEvidence
              : r.contact_evidence,
            whatsapp_link: res.assessment.whatsapp || r.whatsapp_link,
            whatsapp_unconfirmed: Boolean(nextPhone && !(res.assessment.whatsapp || r.whatsapp_link))
          };
        };

        setResults((prev) => prev.map(updateFn));
        setNeedsContact((prev) => prev.map(updateFn));
        setExcludedGoodWebsites((prev) => prev.map(updateFn));
        setExistingMatches((prev) => prev.map(updateFn));
        showLocalToast('Website Reassessed (Temporary)', `${updatedCat} (Score: ${res.assessment.qualityScore}/100)`, 'success');
      }
    } catch (err: any) {
      showLocalToast('Reassessment Failed', err?.message || 'Failed to inspect website', 'error');
    } finally {
      setReassessingId(null);
    }
  };

  const handleCopyToClipboard = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedField(fieldKey);
        showLocalToast('Copied to Clipboard', 'Message copied for manual review & sending.', 'success');
        setTimeout(() => {
          if (mountedRef.current) setCopiedField(null);
        }, 2500);
      })
      .catch(() => {
        showLocalToast('Clipboard Error', 'Could not copy text to clipboard.', 'error');
      });
  };

  const handleDeepScrape = async (prospect: ProspectResult) => {
    setScrapingId(prospect.id);
    try {
      showLocalToast('Deep Research Started', `Inspecting public contact footprint for ${prospect.name}...`, 'success');
      const res = await scrapeProspectContacts({
        id: prospect.id,
        website_url: prospect.website,
        name: prospect.name,
        location: prospect.label,
        social_profiles: prospect.social_profiles,
        website_quality_category: prospect.website_quality_category,
        website_quality_score: prospect.website_quality_score,
        evidence: prospect.evidence
      });

      if (res.success) {
        const updateFn = (r: ProspectResult): ProspectResult => {
          if (r.id !== prospect.id) return r;
          const nextEmail = res.email || r.email || '';
          const nextPhone = res.phone || r.phone || '';
          const mergedEvidence = [...(r.contact_evidence || [])];
          for (const ev of res.contact_evidence || []) {
            if (!mergedEvidence.some((e) => e.contact_type === ev.contact_type && e.contact_value === ev.contact_value && e.source_url === ev.source_url)) {
              mergedEvidence.push(ev);
            }
          }
          const mergedSources = Array.from(new Set([...(r.sources_checked || []), ...(res.sources_checked || [])]));
          return {
            ...r,
            email: nextEmail,
            phone: nextPhone,
            has_public_email: Boolean(nextEmail),
            has_public_phone: Boolean(nextPhone),
            phone_only: Boolean(nextPhone && !nextEmail),
            social_profiles: { ...(r.social_profiles || {}), ...(res.social_profiles || {}) },
            contact_evidence: mergedEvidence,
            sources_checked: mergedSources,
            whatsapp_link: res.whatsapp || r.whatsapp_link,
            whatsapp_unconfirmed: Boolean(nextPhone && !(res.whatsapp || r.whatsapp_link)),
            email_draft: res.email_draft || r.email_draft,
            whatsapp_draft: res.whatsapp_draft || r.whatsapp_draft
          };
        };

        setResults((prev) => prev.map(updateFn));
        setNeedsContact((prev) => prev.map(updateFn));
        setExistingMatches((prev) => prev.map(updateFn));

        if (emailComposer?.prospect.id === prospect.id) {
          setEmailComposer((prev) => (prev ? { ...prev, prospect: updateFn(prev.prospect) } : null));
        }
        if (whatsAppComposer?.prospect.id === prospect.id) {
          setWhatsAppComposer((prev) =>
            prev ? { ...prev, phone: res.phone || prev.phone, prospect: updateFn(prev.prospect) } : null
          );
        }

        const foundDetails: string[] = [];
        if (res.email) foundDetails.push(`Email: ${res.email}`);
        if (res.phone) foundDetails.push(`Phone: ${res.phone}`);
        if (res.whatsapp) foundDetails.push('WhatsApp link confirmed');

        showLocalToast(
          foundDetails.length > 0 ? 'Deep Research Found Public Contacts' : 'Deep Research Completed',
          foundDetails.length > 0
            ? `Found ${foundDetails.join(' • ')} (temporary until Add to CRM)`
            : 'No additional public email or phone channels found across inspected sources.',
          foundDetails.length > 0 ? 'success' : 'error'
        );
      }
    } catch (err: any) {
      showLocalToast('Research Failed', err?.message || 'Failed to research public contacts', 'error');
    } finally {
      setScrapingId(null);
    }
  };

  const handleRegeneratePitch = async (channel: 'WhatsApp' | 'Email', prospect: ProspectResult) => {
    setGeneratingDraftId(prospect.id);
    try {
      const pitch = generateValueFirstPitch({
        business_name: prospect.name,
        location: prospect.label,
        website_url: prospect.website,
        website_quality_category: prospect.website_quality_category,
        website_quality_score: prospect.website_quality_score,
        website_evidence: prospect.evidence
      });

      if (channel === 'Email' && emailComposer) {
        setEmailComposer((prev) =>
          prev
            ? {
                ...prev,
                subject: pitch.email.subject,
                body: pitch.email.body
              }
            : null
        );
      } else if (channel === 'WhatsApp' && whatsAppComposer) {
        setWhatsAppComposer((prev) =>
          prev
            ? {
                ...prev,
                message: pitch.whatsappMessage
              }
            : null
        );
      }
      showLocalToast('Draft Regenerated', 'Updated copy using current website audit evidence.', 'success');
    } catch {
      showLocalToast('Generation Failed', 'Could not refresh pitch copy.', 'error');
    } finally {
      setGeneratingDraftId(null);
    }
  };

  const handleOpenEmailComposer = (prospect: ProspectResult) => {
    const pitch = generateValueFirstPitch({
      business_name: prospect.name,
      location: prospect.label,
      website_url: prospect.website,
      website_quality_category: prospect.website_quality_category,
      website_quality_score: prospect.website_quality_score,
      website_evidence: prospect.evidence
    });

    setEmailComposer({
      isOpen: true,
      prospect,
      subject: `Digital Growth & Web Modernization Proposal for ${prospect.name}`,
      body: prospect.email_draft || pitch.email.body
    });
  };

  const handleLogEmailAndConfirm = async (e?: React.MouseEvent<HTMLAnchorElement>) => {
    if (!emailComposer) return;
    const { prospect, subject, body } = emailComposer;
    const recipient = (prospect.email || '').trim();
    if (!recipient || !recipient.includes('@')) {
      if (e) e.preventDefault();
      showLocalToast('Recipient Required', 'Enter a valid email address or run Deep Scrape first.', 'error');
      return;
    }

    const mailto = buildMailtoUrl(recipient, subject, body);
    if (!mailto) {
      if (e) e.preventDefault();
      showLocalToast('Invalid Email', 'Cannot construct email link with current address.', 'error');
      return;
    }

    if (prospect.crm_lead_id) {
      try {
        await logProspectOutreach(prospect.id, {
          channel: 'email',
          recipient,
          subject,
          message: body,
          delivery_status: 'DRAFT_OPENED',
          provider: 'mailto',
          ai_generated: true,
          crm_lead_id: prospect.crm_lead_id,
          business_name: prospect.name
        });
        const markContacted = (r: ProspectResult): ProspectResult =>
          r.id === prospect.id ? { ...r, outreach_status: 'CONTACTED' } : r;
        setResults((prev) => prev.map(markContacted));
        setExistingMatches((prev) => prev.map(markContacted));
      } catch {
        // Logging error is non-blocking for manual draft open
      }
    }

    setEmailComposer(null);
    showLocalToast(
      'Email Composer Launched',
      prospect.crm_lead_id
        ? 'Recorded Draft Opened outreach audit entry in CRM.'
        : 'Opened manual email draft (temporary prospect not saved to CRM).',
      'success'
    );
  };

  const handleOpenWhatsAppComposer = (prospect: ProspectResult) => {
    const pitch = generateValueFirstPitch({
      business_name: prospect.name,
      location: prospect.label,
      website_url: prospect.website,
      website_quality_category: prospect.website_quality_category,
      website_quality_score: prospect.website_quality_score,
      website_evidence: prospect.evidence
    });

    setWhatsAppComposer({
      isOpen: true,
      prospect,
      phone: prospect.phone || '',
      message: prospect.whatsapp_draft || pitch.whatsappMessage
    });
  };

  const handleLogWhatsAppAndConfirm = async (e?: React.MouseEvent<HTMLAnchorElement>) => {
    if (!whatsAppComposer) return;
    const { prospect, phone, message } = whatsAppComposer;
    if (!phone || phone.replace(/[^\d+]/g, '').length < 7) {
      if (e) e.preventDefault();
      showLocalToast('Phone Number Required', 'Enter a valid international E.164 phone number.', 'error');
      return;
    }

    const waUrl = buildWhatsAppUrl(phone, message);
    if (!waUrl) {
      if (e) e.preventDefault();
      showLocalToast('Invalid Phone', 'Cannot build WhatsApp chat URL for this number.', 'error');
      return;
    }

    if (prospect.crm_lead_id) {
      try {
        await logProspectOutreach(prospect.id, {
          channel: 'whatsapp',
          recipient: phone,
          message,
          delivery_status: 'DRAFT_OPENED',
          provider: 'whatsapp_web',
          ai_generated: true,
          crm_lead_id: prospect.crm_lead_id,
          business_name: prospect.name
        });
        const markContacted = (r: ProspectResult): ProspectResult =>
          r.id === prospect.id ? { ...r, outreach_status: 'CONTACTED' } : r;
        setResults((prev) => prev.map(markContacted));
        setExistingMatches((prev) => prev.map(markContacted));
      } catch {
        // Non-blocking audit warning
      }
    }

    setWhatsAppComposer(null);
    showLocalToast(
      'WhatsApp Draft Ready',
      prospect.crm_lead_id
        ? 'Opened WhatsApp chat & logged Draft Opened delivery status in CRM.'
        : 'Opened manual WhatsApp draft (temporary prospect not saved to CRM).',
      'success'
    );
  };

  const openSinglePromoteModal = (prospect: ProspectResult) => {
    setPromoteModal({
      isOpen: true,
      prospects: [prospect],
      requestedService: prospect.suggested_service || 'Website Modernization & Digital Growth',
      priority: 'Medium',
      notes: `Discovered via Prospecting Engine. Website Status: ${prospect.website_quality_category || prospect.status}. Location: ${prospect.label}.`
    });
  };

  const openBatchPromoteModal = () => {
    const sourceList = activeTab === 'phone_only' ? phoneOnlyResults : filteredResults;
    const targets = sourceList.filter(
      (r) => selectedIds.includes(r.id) && r.reviewed_status !== 'PROMOTED' && !r.crm_lead_id && !r.isExistingRecord
    );
    if (targets.length === 0) {
      showLocalToast('Select Temporary Prospects', 'Select one or more unadded temporary prospects to admit to CRM.', 'error');
      return;
    }
    setPromoteModal({
      isOpen: true,
      prospects: targets,
      requestedService: 'Website Modernization & Digital Growth',
      priority: 'Medium',
      notes: `Explicitly added from Prospecting Engine (${targets.length} selected records).`
    });
  };

  const confirmPromoteToCrm = async () => {
    if (!promoteModal || promoteModal.prospects.length === 0) return;
    const { prospects, requestedService, priority, notes } = promoteModal;
    setBatchPromoting(true);
    if (prospects.length === 1) setPromotingId(prospects[0].id);

    try {
      const outcome = await bulkAddProspectsToCrm({
        requested_service: requestedService,
        priority,
        notes,
        prospects: prospects.map((prospect) => ({
          id: prospect.id,
          business_name: prospect.name,
          location: prospect.label,
          country: prospect.country,
          phone: prospect.phone,
          email: prospect.email,
          website_url: prospect.website,
          status: prospect.status,
          website_quality_category: prospect.website_quality_category,
          website_quality_score: prospect.website_quality_score,
          website_availability: prospect.website_availability,
          evidence: prospect.evidence,
          whatsapp_link: prospect.whatsapp_link,
          social_profiles: prospect.social_profiles,
          source: prospect.source,
          contact_evidence: prospect.contact_evidence,
          verification_status: prospect.verification_status,
          suggested_service: prospect.suggested_service,
          email_draft: prospect.email_draft,
          whatsapp_draft: prospect.whatsapp_draft
        }))
      });

      const resultById = new Map(outcome.results.map((r) => [r.id, r]));
      const succeededIds = new Set(
        outcome.results
          .filter((r) => r.status === 'added' || r.status === 'already_exists')
          .map((r) => r.id)
      );

      if (succeededIds.size > 0) {
        const updateFn = (r: ProspectResult): ProspectResult => {
          const itemRes = resultById.get(r.id);
          if (!itemRes || (itemRes.status !== 'added' && itemRes.status !== 'already_exists')) return r;
          return {
            ...r,
            reviewed_status: 'PROMOTED',
            crm_lead_id: itemRes.lead_id || r.crm_lead_id,
            isDuplicate: itemRes.deduplicated || r.isDuplicate,
            isExistingRecord: true,
            isTemporary: false,
            promoted_at: new Date().toISOString()
          };
        };

        setResults((prev) => prev.map(updateFn));
        setNeedsContact((prev) => prev.map(updateFn));
        setExistingMatches((prev) => prev.map(updateFn));
        setSelectedIds((prev) => prev.filter((id) => !succeededIds.has(id)));
        onSaved?.();
        setPromoteModal(null);

        const parts: string[] = [];
        if (outcome.summary.added > 0) parts.push(`${outcome.summary.added} added`);
        if (outcome.summary.already_exists > 0) parts.push(`${outcome.summary.already_exists} already in CRM`);
        if (outcome.summary.rejected > 0) parts.push(`${outcome.summary.rejected} rejected`);
        if (outcome.summary.failed > 0) parts.push(`${outcome.summary.failed} failed`);

        showLocalToast(
          prospects.length === 1
            ? outcome.summary.already_exists > 0
              ? 'Linked to Existing CRM Record'
              : 'Added to CRM'
            : 'CRM Admission Completed',
          `${parts.join(' • ')} in authoritative Neon CRM.`,
          'success'
        );
      } else {
        const firstErr = outcome.results.find((r) => r.error)?.error;
        showLocalToast('Add to CRM Failed', firstErr || 'Unable to add selected prospect(s) to CRM.', 'error');
      }
    } catch (err: any) {
      showLocalToast('Add to CRM Failed', err?.message || 'Unable to add selected prospect(s) to CRM.', 'error');
    } finally {
      setPromotingId(null);
      setBatchPromoting(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredResults.length === 0) {
      showLocalToast('Nothing to Export', 'Run a search to populate qualified prospects.', 'error');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Export Qualified Prospects (CSV)',
      message: `Download ${filteredResults.length} contact-qualified prospects including website evidence, verification labels, and personalized outreach drafts?`,
      confirmText: 'Download CSV',
      onConfirm: () => {
        try {
          const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
          const headers = [
            'ID',
            'Business Name',
            'Location',
            'Category',
            'Phone',
            'Email',
            'Website URL',
            'Website Status',
            'Quality Category',
            'Quality Score',
            'WhatsApp Unconfirmed',
            'Suggested Offering',
            'Verification Label',
            'CRM Status',
            'Source',
            'Checked At',
            'Email Draft',
            'WhatsApp Draft'
          ];

          const rows = filteredResults.map((r) => [
            escapeCsv(r.id),
            escapeCsv(r.name),
            escapeCsv(r.label),
            escapeCsv(r.type),
            escapeCsv(r.phone || ''),
            escapeCsv(r.email || ''),
            escapeCsv(r.website || ''),
            escapeCsv(r.status),
            escapeCsv(r.website_quality_category || ''),
            escapeCsv(r.website_quality_score ?? ''),
            escapeCsv(r.whatsapp_unconfirmed ? 'Unconfirmed' : r.whatsapp_link ? 'Website Link Found' : 'N/A'),
            escapeCsv(r.suggested_service || ''),
            escapeCsv(r.verification_status || ''),
            escapeCsv(r.reviewed_status || 'PENDING'),
            escapeCsv(r.source || ''),
            escapeCsv(r.discovery_timestamp || ''),
            escapeCsv(r.email_draft || ''),
            escapeCsv(r.whatsapp_draft || '')
          ]);

          const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          const cleanNiche = (nicheInput || 'qualified').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
          link.setAttribute('download', `avartah-${cleanNiche}-prospects-${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          showLocalToast('CSV Downloaded', `Exported ${filteredResults.length} qualified prospects.`, 'success');
        } catch (err: any) {
          showLocalToast('Export Failed', err?.message || 'Unable to generate CSV.', 'error');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleExportJSON = () => {
    if (filteredResults.length === 0) {
      showLocalToast('Nothing to Export', 'Run a search to populate temporary results.', 'error');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Export Temporary Results (JSON)',
      message: `Download ${filteredResults.length} temporary research prospects locally as JSON without writing to Neon?`,
      confirmText: 'Export JSON',
      onConfirm: () => {
        try {
          const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(filteredResults, null, 2))}`;
          const link = document.createElement('a');
          link.setAttribute('href', jsonString);
          link.setAttribute('download', `temporary_prospects_${new Date().toISOString().slice(0, 10)}.json`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showLocalToast('JSON Exported', `Downloaded ${filteredResults.length} temporary prospects (0 DB writes).`, 'success');
        } catch (err: any) {
          showLocalToast('Export Failed', err?.message || 'Unable to generate JSON.', 'error');
        } finally {
          setConfirmDialog(null);
        }
      }
    });
  };

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (hideDuplicates && (r.isDuplicate || r.isExistingRecord)) return false;
      if (qualityFilter !== 'ALL') {
        const cat = r.website_quality_category || mapInternalStatusToCategory(r.status);
        if (cat !== qualityFilter) return false;
      }
      if (contactCompletenessFilter === 'HAS_EMAIL' && !r.email) return false;
      if (contactCompletenessFilter === 'HAS_PHONE' && !r.phone) return false;
      if (contactCompletenessFilter === 'HAS_WHATSAPP' && !r.whatsapp_link) return false;
      if (contactCompletenessFilter === 'FULL_CONTACT' && (!r.email || !r.phone)) return false;
      if (crmStatusFilter === 'PROMOTED' && r.reviewed_status !== 'PROMOTED' && !r.crm_lead_id) return false;
      if (crmStatusFilter === 'PENDING' && (r.reviewed_status === 'PROMOTED' || Boolean(r.crm_lead_id))) return false;
      return true;
    });
  }, [results, hideDuplicates, qualityFilter, contactCompletenessFilter, crmStatusFilter]);

  const phoneOnlyResults = useMemo(() => {
    return filteredResults.filter((r) => Boolean(r.phone && !r.email));
  }, [filteredResults]);

  const activeDisplayList = useMemo(() => {
    switch (activeTab) {
      case 'phone_only':
        return phoneOnlyResults;
      case 'needs_contact':
        return needsContact;
      case 'excluded_good':
        return excludedGoodWebsites;
      case 'existing_crm':
        return existingMatches;
      case 'qualified':
      default:
        return filteredResults;
    }
  }, [activeTab, filteredResults, phoneOnlyResults, needsContact, excludedGoodWebsites, existingMatches]);

  const selectableTabList = activeTab === 'phone_only' ? phoneOnlyResults : filteredResults;
  const allQualifiedSelected =
    selectableTabList.length > 0 && selectableTabList.every((r) => selectedIds.includes(r.id));

  const toggleSelectAllQualified = () => {
    if (allQualifiedSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableTabList.map((r) => r.id));
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleEvidenceExpanded = (id: string) => {
    setExpandedEvidenceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getQualityBadgeStyle = (category?: WebsiteQualityCategory | string) => {
    const c = category || '';
    if (c.includes('No website')) {
      return { bg: 'bg-[#C58A52]/15 text-[#D99B62] border-[#C58A52]/35', label: 'No website found' };
    }
    if (c.includes('inaccessible') || c.includes('broken')) {
      return { bg: 'bg-red-500/15 text-red-300 border-red-500/35', label: 'Website broken' };
    }
    if (c.includes('outdated')) {
      return { bg: 'bg-amber-500/15 text-amber-300 border-amber-500/35', label: 'Outdated website' };
    }
    if (c.includes('functional') || c.includes('current')) {
      return { bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35', label: 'Functional & current' };
    }
    return { bg: 'bg-slate-700/30 text-slate-300 border-slate-600/40', label: 'Inconclusive' };
  };

  const currentJobStyle = jobStatus ? getJobStatusStyle(jobStatus) : null;

  return (
    <div className="bg-[#171A1D] border border-[#30363B] rounded-2xl p-4 sm:p-6 lg:p-8 shadow-2xl text-[#F2F1ED]">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-5 border-b border-[#30363B]">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#C58A52]/15 border border-[#C58A52]/30 flex items-center justify-center shrink-0">
            <Compass className="text-[#C58A52]" size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-bold text-[#F2F1ED] tracking-tight">
                Prospecting & Outreach Engine
              </h2>
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider bg-[#C58A52]/15 text-[#D99B62] border border-[#C58A52]/35">
                Temporary Research Workspace
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#A3A9AF] mt-1">
              Deep contact research for local businesses without official websites. Zero Neon writes until you click Add to CRM.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setHistoryOpen((prev) => !prev);
            refreshJobHistory();
          }}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] hover:bg-[#282D32] border border-[#30363B] text-xs font-semibold text-[#F2F1ED] flex items-center justify-center gap-2 transition-colors shrink-0 cursor-pointer"
        >
          <History size={15} className="text-[#C58A52]" />
          <span>Run History ({jobHistory.length})</span>
          {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Collapsible Compact Job History (Zero DB writes) */}
      {historyOpen && (
        <div className="mb-6 bg-[#111315] border border-[#30363B] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#A3A9AF]">
              Recent Discovery Runs (Session Memory)
            </h3>
            <span className="text-[11px] text-[#747C84]">Read-only telemetry</span>
          </div>
          {jobHistory.length === 0 ? (
            <p className="text-xs text-[#747C84]">No discovery jobs recorded in this server session yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="border-b border-[#30363B] text-[#747C84] font-mono uppercase text-[10px]">
                    <th className="py-2 pr-3">Query</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Raw</th>
                    <th className="py-2 pr-3 text-right">Qualified</th>
                    <th className="py-2 pr-3 text-right">DB R/W</th>
                    <th className="py-2 text-right">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363B]/60">
                  {jobHistory.slice(0, 8).map((item) => {
                    const st = getJobStatusStyle(item.status);
                    return (
                      <tr key={item.jobId} className="hover:bg-[#202428]/50">
                        <td className="py-2.5 pr-3 font-medium text-[#F2F1ED]">{item.query}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${st.badge}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-[#A3A9AF]">{item.metrics.discovered}</td>
                        <td className="py-2.5 pr-3 text-right font-mono text-emerald-300">
                          {item.metrics.newly_qualified}/{item.targetCount}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono text-[#A3A9AF]">
                          {item.dbStats.dbReads}/{item.dbStats.dbWrites}
                        </td>
                        <td className="py-2.5 text-right font-mono text-[#747C84]">
                          {(item.durationMs / 1000).toFixed(1)}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Persistent Ephemeral Research Notice */}
      <div className="mb-6 bg-[#111315] border border-[#C58A52]/35 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-[#A3A9AF]">
        <ShieldCheck className="text-[#C58A52] shrink-0 mt-0.5" size={16} />
        <div>
          <span className="font-semibold text-[#F2F1ED]">Temporary search results — not saved to CRM.</span>{' '}
          Discovery and deep contact research do not write to Neon. Only records you explicitly submit via{' '}
          <strong className="text-[#D99B62]">Add to CRM</strong> are saved. Refreshing or closing this page discards unadded results.
        </div>
      </div>

      {/* 1. Search Command Form */}
      <form onSubmit={(e) => handleSearch(e)} className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <label htmlFor="prospect-niche-input" className="sr-only">
              Business Niche or Category
            </label>
            <input
              id="prospect-niche-input"
              type="text"
              value={nicheInput}
              onChange={(e) => setNicheInput(e.target.value)}
              placeholder="Niche (e.g. Spas, Dental Clinics)"
              className="w-full min-h-[46px] bg-[#111315] border border-[#30363B] rounded-xl py-2.5 pl-10 pr-3 text-base sm:text-sm text-[#F2F1ED] placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
            />
            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747C84]" size={16} />
          </div>

          <div className="md:col-span-4 relative">
            <label htmlFor="prospect-location-input" className="sr-only">
              Target Location or City
            </label>
            <input
              id="prospect-location-input"
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Location (e.g. London, Lagos, Manchester)"
              className="w-full min-h-[46px] bg-[#111315] border border-[#30363B] rounded-xl py-2.5 pl-10 pr-3 text-base sm:text-sm text-[#F2F1ED] placeholder:text-[#747C84] focus:outline-none focus:border-[#C58A52] transition-colors"
            />
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#747C84]" size={16} />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="prospect-target-select" className="sr-only">
              Qualified Target Count
            </label>
            <select
              id="prospect-target-select"
              value={targetCount}
              onChange={(e) => setTargetCount(Number(e.target.value))}
              className="w-full min-h-[46px] bg-[#111315] border border-[#30363B] rounded-xl px-3 py-2.5 text-base sm:text-sm font-mono text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
            >
              {[15, 16, 17, 18, 19, 20].map((num) => (
                <option key={num} value={num}>
                  Target: {num}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 min-h-[46px] bg-[#C58A52] hover:bg-[#D99B62] disabled:bg-[#202428] disabled:text-[#747C84] text-[#111315] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              <span>{loading ? 'Running' : 'Discover'}</span>
            </button>

            {loading && activeJobId && (
              <button
                type="button"
                onClick={handleStopJob}
                disabled={stoppingJob}
                title="Stop Discovery Job"
                className="min-h-[46px] min-w-[46px] px-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/35 text-red-300 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
              >
                <Square size={15} />
              </button>
            )}
          </div>
        </div>

        {/* 2. Quick Niche Shortcuts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#747C84] shrink-0">
            Quick Niches:
          </span>
          {QUICK_NICHES.map((n) => (
            <button
              key={n.value}
              type="button"
              onClick={() => handleQuickNiche(n.value)}
              disabled={loading}
              className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium bg-[#111315] hover:bg-[#202428] text-[#A3A9AF] hover:text-[#F2F1ED] border border-[#30363B] transition-colors shrink-0 cursor-pointer disabled:opacity-50"
            >
              {n.label}
            </button>
          ))}
        </div>
      </form>

      {/* Filter & Opportunity Controls */}
      <div className="bg-[#111315] border border-[#30363B] rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[#C58A52] shrink-0 hidden sm:block" />
              <select
                aria-label="Filter by website quality category"
                value={qualityFilter}
                onChange={(e) => setQualityFilter(e.target.value)}
                className="w-full min-h-[42px] bg-[#171A1D] border border-[#30363B] text-[#F2F1ED] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C58A52]"
              >
                <option value="ALL">All Website Categories</option>
                <option value="No website found">No website found</option>
                <option value="Website inaccessible or apparently broken">Website inaccessible or broken</option>
                <option value="Website potentially outdated">Website potentially outdated</option>
                <option value="Website appears functional and current">Functional and current</option>
                <option value="Assessment inconclusive">Assessment inconclusive</option>
              </select>
            </div>

            <select
              aria-label="Filter by contact completeness"
              value={contactCompletenessFilter}
              onChange={(e) => setContactCompletenessFilter(e.target.value)}
              className="w-full min-h-[42px] bg-[#171A1D] border border-[#30363B] text-[#F2F1ED] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C58A52]"
            >
              <option value="ALL">All Contact Channels</option>
              <option value="HAS_EMAIL">Has Public Email</option>
              <option value="HAS_PHONE">Has Telephone</option>
              <option value="HAS_WHATSAPP">Confirmed WhatsApp Link</option>
              <option value="FULL_CONTACT">Both Email & Telephone</option>
            </select>

            <select
              aria-label="Filter by CRM promotion state"
              value={crmStatusFilter}
              onChange={(e) => setCrmStatusFilter(e.target.value)}
              className="w-full min-h-[42px] bg-[#171A1D] border border-[#30363B] text-[#F2F1ED] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#C58A52]"
            >
              <option value="ALL">All CRM Statuses</option>
              <option value="PENDING">Not Yet Promoted</option>
              <option value="PROMOTED">In CRM Pipeline</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#A3A9AF] hover:text-[#F2F1ED] min-h-[36px]">
              <input
                type="checkbox"
                checked={skipWebsites}
                onChange={(e) => setSkipWebsites(e.target.checked)}
                className="w-4 h-4 rounded bg-[#171A1D] border-[#30363B] accent-[#C58A52]"
              />
              <span>No official website only (incl. social-only)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-[#A3A9AF] hover:text-[#F2F1ED] min-h-[36px]">
              <input
                type="checkbox"
                checked={hideDuplicates}
                onChange={(e) => setHideDuplicates(e.target.checked)}
                className="w-4 h-4 rounded bg-[#171A1D] border-[#30363B] accent-[#C58A52]"
              />
              <span>Hide existing CRM matches</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Live Job Status Banner */}
      {(loading || jobStatus) && currentJobStyle && (
        <div className="mb-6 bg-[#111315] border border-[#30363B] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {loading ? (
              <Loader2 className="animate-spin text-[#C58A52] shrink-0" size={18} />
            ) : (
              <ShieldCheck className="text-emerald-400 shrink-0" size={18} />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold uppercase ${currentJobStyle.badge}`}>
                  {currentJobStyle.label}
                </span>
                {resolvedLocation && (
                  <span className="text-xs text-[#A3A9AF] truncate">{resolvedLocation}</span>
                )}
                {typeof searchDurationMs === 'number' && (
                  <span className="text-xs font-mono text-[#747C84]">
                    {(searchDurationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {stageMessage && (
                <p className="text-xs sm:text-sm text-[#F2F1ED] mt-1">{stageMessage}</p>
              )}
            </div>
          </div>

          {(providerStats || dbStats) && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[#A3A9AF] shrink-0">
              {providerStats && (
                <span>
                  Sources: OSM {providerStats.overpassQueries} • Nom {providerStats.nominatimQueries} • Public{' '}
                  {providerStats.publicResearchQueries || 0} • Cache {providerStats.cacheHits}
                </span>
              )}
              {dbStats && (
                <span className="text-emerald-300">
                  Neon R/W: {dbStats.dbReads}/{dbStats.dbWrites}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Progress Metrics Grid (Strictly separated honest counters) */}
      {(searchPerformed || loading) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 mb-6">
          <div className="bg-[#111315] border border-[#30363B] p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#747C84]">Raw</div>
            <div className="text-xl font-mono font-bold text-[#F2F1ED] mt-1">{metrics.discovered}</div>
          </div>
          <div className="bg-[#111315] border border-[#30363B] p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#747C84]">Unique</div>
            <div className="text-xl font-mono font-bold text-[#F2F1ED] mt-1">{metrics.unique}</div>
          </div>
          <div className="bg-[#111315] border border-[#C58A52]/35 p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#D99B62]">No Website</div>
            <div className="text-xl font-mono font-bold text-[#D99B62] mt-1">
              {metrics.no_official_website ?? results.filter((r) => r.status === 'NO_WEBSITE').length}
            </div>
          </div>
          <div className="bg-[#111315] border border-emerald-500/35 p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Phone Found</div>
            <div className="text-xl font-mono font-bold text-emerald-300 mt-1">
              {metrics.public_phone_found ?? results.filter((r) => Boolean(r.phone)).length}
            </div>
          </div>
          <div className="bg-[#111315] border border-sky-500/30 p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-400">Email Found</div>
            <div className="text-xl font-mono font-bold text-sky-300 mt-1">
              {metrics.public_email_found ?? results.filter((r) => Boolean(r.email)).length}
            </div>
          </div>
          <div className="bg-[#111315] border border-amber-500/30 p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Phone-Only</div>
            <div className="text-xl font-mono font-bold text-amber-300 mt-1">
              {metrics.phone_only ?? phoneOnlyResults.length}
            </div>
          </div>
          <div className="bg-[#111315] border border-[#30363B] p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#C58A52]">Already CRM</div>
            <div className="text-xl font-mono font-bold text-[#D99B62] mt-1">{metrics.existing_crm_matches}</div>
          </div>
          <div className="bg-[#111315] border border-[#30363B] p-3 rounded-xl">
            <div className="text-[10px] font-mono uppercase tracking-wider text-red-400">Provider Err</div>
            <div className="text-xl font-mono font-bold text-red-300 mt-1">{metrics.provider_failures}</div>
          </div>
        </div>
      )}

      {/* Clarification / Provider Notice / Structured Error States */}
      {clarificationMessage && (
        <div className="p-4 bg-[#202428] border border-[#C58A52]/35 rounded-xl text-sm text-[#F2F1ED] mb-6 flex items-start gap-3">
          <Compass className="text-[#C58A52] shrink-0 mt-0.5" size={18} />
          <p>{clarificationMessage}</p>
        </div>
      )}

      {providerNotice && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs sm:text-sm mb-6 flex items-start gap-3">
          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-semibold">Provider Degradation Notice</p>
            <p className="text-xs text-amber-300/90 mt-0.5">{providerNotice}</p>
          </div>
        </div>
      )}

      {errorState && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm mb-6 flex items-start gap-3">
          <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Discovery Request Issue</span>
              {errorState.code && (
                <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 font-mono text-[10px] text-red-200">
                  {errorState.code}
                </span>
              )}
              {typeof errorState.status === 'number' && errorState.status > 0 && (
                <span className="font-mono text-[11px] text-red-300">HTTP {errorState.status}</span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-red-200/90 mt-1">{errorState.message}</p>
          </div>
        </div>
      )}

      {shortfallExplanation && activeTab === 'qualified' && (
        <div className="p-4 bg-[#111315] border border-[#30363B] rounded-xl text-xs text-[#A3A9AF] mb-6 flex items-start gap-3">
          <Filter className="text-[#C58A52] shrink-0 mt-0.5" size={16} />
          <div>
            <p className="font-semibold text-[#F2F1ED]">Discovery Acquisition Summary</p>
            <p className="mt-1 leading-relaxed">{shortfallExplanation}</p>
          </div>
        </div>
      )}

      {/* 6. Separate Review Tabs */}
      {searchPerformed && (
        <div className="flex flex-wrap gap-2 mb-5 border-b border-[#30363B] pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('qualified')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'qualified'
                ? 'bg-[#C58A52] text-[#111315] font-bold'
                : 'bg-[#111315] border border-[#30363B] text-[#A3A9AF] hover:text-[#F2F1ED]'
            }`}
          >
            Qualified Temporary ({filteredResults.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('phone_only')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'phone_only'
                ? 'bg-sky-500 text-[#111315] font-bold'
                : 'bg-[#111315] border border-[#30363B] text-[#A3A9AF] hover:text-[#F2F1ED]'
            }`}
          >
            Phone-Only ({phoneOnlyResults.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('needs_contact')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'needs_contact'
                ? 'bg-amber-500 text-[#111315] font-bold'
                : 'bg-[#111315] border border-[#30363B] text-[#A3A9AF] hover:text-[#F2F1ED]'
            }`}
          >
            Needs Contact Research ({needsContact.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excluded_good')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'excluded_good'
                ? 'bg-[#202428] border border-[#C58A52] text-[#F2F1ED]'
                : 'bg-[#111315] border border-[#30363B] text-[#A3A9AF] hover:text-[#F2F1ED]'
            }`}
          >
            Good Websites Excluded ({excludedGoodWebsites.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('existing_crm')}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'existing_crm'
                ? 'bg-emerald-500 text-[#111315] font-bold'
                : 'bg-[#111315] border border-[#30363B] text-[#A3A9AF] hover:text-[#F2F1ED]'
            }`}
          >
            Already in CRM ({existingMatches.length})
          </button>
        </div>
      )}

      {/* 5 & 7. Results & CRM Promotion Controls */}
      {activeDisplayList.length > 0 ? (
        <div className="space-y-4">
          {/* Batch Actions Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-[#111315] border border-[#30363B] rounded-xl">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-[#747C84]">
                {activeTab === 'qualified'
                  ? 'Temporary Research Results — Select to Add to CRM'
                  : activeTab === 'phone_only'
                  ? 'Temporary Results — Phone Available, No Public Email Found'
                  : activeTab === 'needs_contact'
                  ? 'Temporary Session Review Only — Missing Contact Details'
                  : activeTab === 'excluded_good'
                  ? 'Temporary Session Review Only — Excluded Official Websites'
                  : 'Already Saved in CRM (Deduplicated Read-Only Match)'}
              </p>
              <p className="text-sm font-semibold text-[#F2F1ED] mt-0.5">
                Showing <span className="font-mono text-[#C58A52]">{activeDisplayList.length}</span> records
                {selectedIds.length > 0 && (activeTab === 'qualified' || activeTab === 'phone_only') && (
                  <span className="ml-2 text-xs text-emerald-300 font-mono">({selectedIds.length} selected)</span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(activeTab === 'qualified' || activeTab === 'phone_only') && (
                <>
                  <button
                    type="button"
                    onClick={openBatchPromoteModal}
                    disabled={selectedIds.length === 0 || batchPromoting}
                    className="min-h-[42px] px-3.5 py-2 bg-[#C58A52] hover:bg-[#D99B62] disabled:bg-[#202428] disabled:text-[#747C84] text-[#111315] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>Add Selected to CRM ({selectedIds.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="min-h-[42px] px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Export Temp CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="min-h-[42px] px-3.5 py-2 bg-[#202428] hover:bg-[#282D32] text-[#A3A9AF] hover:text-[#F2F1ED] border border-[#30363B] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Temp JSON</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Desktop Data Table (lg+) */}
          <div className="hidden lg:block bg-[#111315] border border-[#30363B] rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363B] text-[10px] font-mono uppercase tracking-wider text-[#747C84] bg-[#171A1D]">
                  {(activeTab === 'qualified' || activeTab === 'phone_only') && (
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all qualified prospects"
                        checked={allQualifiedSelected}
                        onChange={toggleSelectAllQualified}
                        className="w-4 h-4 rounded bg-[#111315] border-[#30363B] accent-[#C58A52]"
                      />
                    </th>
                  )}
                  <th className="p-3">Business & Sources</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Web Presence</th>
                  <th className="p-3">Phone / WhatsApp</th>
                  <th className="p-3">Email</th>
                  <th className="p-3 text-right">Score</th>
                  <th className="p-3">Save State</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363B]/70">
                {activeDisplayList.map((prospect, idx) => {
                  const qualityStyle = getQualityBadgeStyle(prospect.website_quality_category);
                  const isPromoted = prospect.reviewed_status === 'PROMOTED' || Boolean(prospect.crm_lead_id);
                  const isAlreadyCrm = !isPromoted && Boolean(prospect.isExistingRecord || prospect.isDuplicate);
                  const isSelected = selectedIds.includes(prospect.id);
                  const isEvidenceOpen = expandedEvidenceIds.includes(prospect.id);
                  const evidenceList = prospect.contact_evidence || [];
                  const sourcesList = prospect.sources_checked || [];
                  const emailEv = evidenceList.find((e) => e.contact_type === 'email');
                  const phoneEv = evidenceList.find((e) => e.contact_type === 'phone');

                  return (
                    <React.Fragment key={`tbl-${prospect.id}-${idx}`}>
                      <tr className={`hover:bg-[#171A1D]/80 transition-colors ${isPromoted ? 'bg-emerald-950/10' : ''}`}>
                        {(activeTab === 'qualified' || activeTab === 'phone_only') && (
                          <td className="p-3 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select ${prospect.name}`}
                              checked={isSelected}
                              disabled={isPromoted || isAlreadyCrm}
                              onChange={() => toggleRowSelection(prospect.id)}
                              className="w-4 h-4 rounded bg-[#111315] border-[#30363B] accent-[#C58A52] mt-0.5 disabled:opacity-40"
                            />
                          </td>
                        )}

                        <td className="p-3 align-top max-w-[230px]">
                          <div className="font-semibold text-[#F2F1ED] text-sm leading-snug">{prospect.name}</div>
                          <div className="text-[11px] text-[#747C84] mt-0.5">
                            {prospect.type} • {prospect.source || 'OSM'}
                          </div>
                          {prospect.evidence && (
                            <p className="text-[11px] text-[#A3A9AF] mt-1 line-clamp-2" title={prospect.evidence}>
                              {prospect.evidence}
                            </p>
                          )}
                          {(evidenceList.length > 0 || sourcesList.length > 0) && (
                            <button
                              type="button"
                              onClick={() => toggleEvidenceExpanded(prospect.id)}
                              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono text-[#C58A52] hover:underline cursor-pointer"
                            >
                              {isEvidenceOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              <span>
                                Evidence ({evidenceList.length}) • {sourcesList.length || 1} source{(sourcesList.length || 1) === 1 ? '' : 's'}
                              </span>
                            </button>
                          )}
                        </td>

                        <td className="p-3 align-top max-w-[170px] text-[#A3A9AF]">
                          <div className="line-clamp-2">{prospect.label || prospect.country}</div>
                        </td>

                        <td className="p-3 align-top">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${qualityStyle.bg}`}>
                            {qualityStyle.label}
                          </span>
                          {prospect.website ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <a
                                href={prospect.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2 truncate max-w-[140px]"
                              >
                                {prospect.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                              </a>
                              <button
                                type="button"
                                onClick={() => handleReassessWebsite(prospect)}
                                disabled={reassessingId === prospect.id}
                                title="Reassess website health"
                                className="p-1.5 rounded hover:bg-[#202428] text-[#A3A9AF] hover:text-[#F2F1ED] cursor-pointer"
                              >
                                <RefreshCw size={12} className={reassessingId === prospect.id ? 'animate-spin text-[#C58A52]' : ''} />
                              </button>
                            </div>
                          ) : (
                            <div className="text-[11px] text-[#747C84] mt-1">
                              {prospect.social_profiles && Object.values(prospect.social_profiles).some(Boolean)
                                ? 'Social profile only (no official website)'
                                : 'No official website'}
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top font-mono">
                          {prospect.phone ? (
                            <div>
                              <div className="text-emerald-300">{prospect.phone}</div>
                              <div className="text-[10px] font-sans text-[#747C84] mt-0.5">
                                {phoneEv?.verification_status || 'FOUND'} •{' '}
                                {prospect.whatsapp_link ? (
                                  <span className="text-emerald-400">WhatsApp link observed</span>
                                ) : (
                                  <span>WhatsApp unconfirmed</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[#747C84]">No phone found</span>
                          )}
                        </td>

                        <td className="p-3 align-top font-mono max-w-[200px]">
                          {prospect.email ? (
                            <div>
                              <div className="text-[#F2F1ED] truncate" title={prospect.email}>
                                {prospect.email}
                              </div>
                              <div className="text-[10px] font-sans text-emerald-400/90 mt-0.5">
                                {emailEv?.verification_status || prospect.verification_status || 'SOURCE_CONFIRMED'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="font-sans text-[11px] text-amber-300/90">No public email found</div>
                              {prospect.phone && (
                                <div className="font-sans text-[10px] text-[#747C84] mt-0.5">
                                  Phone available — email not found
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3 align-top text-right font-mono font-bold text-[#F2F1ED]">
                          {typeof prospect.website_quality_score === 'number' ? prospect.website_quality_score : 0}
                        </td>

                        <td className="p-3 align-top">
                          {isPromoted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono uppercase">
                              <CheckCircle size={11} />
                              Added to CRM
                            </span>
                          ) : isAlreadyCrm ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-[#C58A52]/15 text-[#D99B62] border border-[#C58A52]/30 text-[10px] font-mono uppercase">
                              Already in CRM
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-[#202428] text-[#A3A9AF] border border-[#30363B] text-[10px] font-mono uppercase">
                              Temporary — Not Saved
                            </span>
                          )}
                        </td>

                        <td className="p-3 align-top text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDeepScrape(prospect)}
                              disabled={scrapingId === prospect.id}
                              title="Run public contact research (no DB writes)"
                              className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg bg-[#202428] hover:bg-[#282D32] border border-[#30363B] text-[#C58A52] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {scrapingId === prospect.id ? <Loader2 size={13} className="animate-spin" /> : <Radar size={13} />}
                              <span>Research</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenWhatsAppComposer(prospect)}
                              title="Open WhatsApp Draft Composer"
                              className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 flex items-center justify-center cursor-pointer"
                            >
                              <MessageSquare size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEmailComposer(prospect)}
                              title="Open Email Draft Composer"
                              className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg bg-[#202428] hover:bg-[#282D32] border border-[#30363B] text-[#F2F1ED] flex items-center justify-center cursor-pointer"
                            >
                              <Mail size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openSinglePromoteModal(prospect)}
                              disabled={isPromoted || isAlreadyCrm || promotingId === prospect.id}
                              title="Explicitly save this prospect to CRM"
                              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#C58A52] hover:bg-[#D99B62] disabled:bg-[#202428] disabled:text-[#747C84] text-[#111315] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {promotingId === prospect.id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <UserPlus size={13} />
                              )}
                              <span>{isPromoted || isAlreadyCrm ? 'In CRM' : 'Add to CRM'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isEvidenceOpen && (
                        <tr className="bg-[#14171A]">
                          <td colSpan={(activeTab === 'qualified' || activeTab === 'phone_only') ? 9 : 8} className="p-3.5 border-t border-[#30363B]/50">
                            <div className="space-y-2 text-[11px]">
                              {sourcesList.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono uppercase text-[10px] text-[#747C84]">Sources checked:</span>
                                  {sourcesList.map((src, sIdx) => (
                                    <span key={sIdx} className="px-2 py-0.5 rounded bg-[#202428] border border-[#30363B] font-mono text-[10px] text-[#A3A9AF]">
                                      {src}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {evidenceList.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {evidenceList.map((ev, evIdx) => (
                                    <div key={evIdx} className="bg-[#111315] border border-[#30363B] rounded-lg p-2.5 space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-mono font-semibold text-[#F2F1ED]">
                                          {ev.contact_type.toUpperCase()}: {ev.contact_value}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-mono text-[9px]">
                                          {ev.verification_status}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-[#A3A9AF] flex flex-wrap items-center gap-2">
                                        <span>Type: {ev.source_type || 'public_source'}</span>
                                        {ev.discovered_at && <span>Checked: {new Date(ev.discovered_at).toLocaleString()}</span>}
                                      </div>
                                      {ev.source_url && /^https?:\/\//i.test(ev.source_url) && (
                                        <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#C58A52] hover:underline truncate block">
                                          {ev.source_url}
                                        </a>
                                      )}
                                      {ev.evidence_excerpt && (
                                        <p className="text-[10px] text-[#747C84] italic line-clamp-2">{ev.evidence_excerpt}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[#747C84]">No contact evidence entries recorded yet.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Stacked Cards (< lg) */}
          <div className="grid grid-cols-1 gap-3 lg:hidden">
            {activeDisplayList.map((prospect, idx) => {
              const qualityStyle = getQualityBadgeStyle(prospect.website_quality_category);
              const isPromoted = prospect.reviewed_status === 'PROMOTED' || Boolean(prospect.crm_lead_id);
              const isAlreadyCrm = !isPromoted && Boolean(prospect.isExistingRecord || prospect.isDuplicate);
              const isSelected = selectedIds.includes(prospect.id);
              const isEvidenceOpen = expandedEvidenceIds.includes(prospect.id);
              const evidenceList = prospect.contact_evidence || [];
              const sourcesList = prospect.sources_checked || [];

              return (
                <div
                  key={`card-${prospect.id}-${idx}`}
                  className={`bg-[#111315] border rounded-xl p-4 space-y-3 ${
                    isPromoted ? 'border-emerald-500/40' : 'border-[#30363B]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {(activeTab === 'qualified' || activeTab === 'phone_only') && (
                        <input
                          type="checkbox"
                          aria-label={`Select ${prospect.name}`}
                          checked={isSelected}
                          disabled={isPromoted || isAlreadyCrm}
                          onChange={() => toggleRowSelection(prospect.id)}
                          className="w-5 h-5 mt-0.5 rounded bg-[#171A1D] border-[#30363B] accent-[#C58A52] disabled:opacity-40"
                        />
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base text-[#F2F1ED] leading-snug">{prospect.name}</h3>
                        <p className="text-xs text-[#A3A9AF] mt-0.5">{prospect.label}</p>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded bg-[#202428] border border-[#30363B] font-mono text-xs text-[#C58A52] shrink-0">
                      {typeof prospect.website_quality_score === 'number' ? prospect.website_quality_score : 0}/100
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${qualityStyle.bg}`}>
                      {qualityStyle.label}
                    </span>
                    {isPromoted ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono uppercase">
                        Added to CRM
                      </span>
                    ) : isAlreadyCrm ? (
                      <span className="px-2 py-0.5 rounded bg-[#C58A52]/15 text-[#D99B62] border border-[#C58A52]/30 text-[10px] font-mono uppercase">
                        Already in CRM
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#202428] text-[#A3A9AF] border border-[#30363B] text-[10px] font-mono uppercase">
                        Temporary — Not Saved
                      </span>
                    )}
                  </div>

                  {prospect.evidence && (
                    <p className="text-xs text-[#A3A9AF] bg-[#171A1D] border border-[#30363B] rounded-lg p-2.5">
                      {prospect.evidence}
                    </p>
                  )}

                  <div className="space-y-1.5 text-xs">
                    {prospect.website && (
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={prospect.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-300 underline truncate flex items-center gap-1"
                        >
                          <Globe size={13} />
                          <span>{prospect.website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleReassessWebsite(prospect)}
                          disabled={reassessingId === prospect.id}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-[#202428] text-[#A3A9AF]"
                        >
                          <RefreshCw size={13} className={reassessingId === prospect.id ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    )}
                    {prospect.phone && (
                      <div className="flex items-center gap-2 font-mono text-emerald-300">
                        <Phone size={13} />
                        <span>{prospect.phone}</span>
                        <span className="font-sans text-[10px] text-[#747C84]">
                          ({prospect.whatsapp_link ? 'WhatsApp Link Found' : 'WhatsApp unconfirmed'})
                        </span>
                      </div>
                    )}
                    {prospect.email ? (
                      <div className="flex items-center gap-2 font-mono text-[#F2F1ED] truncate">
                        <Mail size={13} className="text-[#C58A52] shrink-0" />
                        <span className="truncate">{prospect.email}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-300/90">
                        No public email found{prospect.phone ? ' — Phone available' : ''}
                      </div>
                    )}
                  </div>

                  {(evidenceList.length > 0 || sourcesList.length > 0) && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleEvidenceExpanded(prospect.id)}
                        className="text-[11px] font-mono text-[#C58A52] flex items-center gap-1 cursor-pointer"
                      >
                        {isEvidenceOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        <span>Inspect Evidence ({evidenceList.length}) & Sources ({sourcesList.length || 1})</span>
                      </button>
                      {isEvidenceOpen && (
                        <div className="mt-2 space-y-1.5 bg-[#171A1D] border border-[#30363B] rounded-lg p-2.5 text-[11px]">
                          {sourcesList.length > 0 && (
                            <div className="text-[#A3A9AF] font-mono text-[10px]">Sources: {sourcesList.join(', ')}</div>
                          )}
                          {evidenceList.map((ev, evIdx) => (
                            <div key={evIdx} className="border-t border-[#30363B]/60 pt-1.5 first:border-t-0 first:pt-0">
                              <div className="font-mono text-[#F2F1ED]">
                                {ev.contact_type.toUpperCase()}: {ev.contact_value} ({ev.verification_status})
                              </div>
                              {ev.source_url && /^https?:\/\//i.test(ev.source_url) && (
                                <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#C58A52] underline truncate block">
                                  {ev.source_url}
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#30363B]/70">
                    <button
                      type="button"
                      onClick={() => handleDeepScrape(prospect)}
                      disabled={scrapingId === prospect.id}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#202428] border border-[#30363B] text-xs font-semibold text-[#C58A52] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {scrapingId === prospect.id ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
                      <span>Deep Research</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppComposer(prospect)}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare size={14} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEmailComposer(prospect)}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#202428] border border-[#30363B] text-xs font-semibold text-[#F2F1ED] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Mail size={14} />
                      <span>Email Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openSinglePromoteModal(prospect)}
                      disabled={isPromoted || isAlreadyCrm || promotingId === prospect.id}
                      className="min-h-[44px] px-3 py-2 rounded-xl bg-[#C58A52] disabled:bg-[#202428] disabled:text-[#747C84] text-[#111315] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={14} />
                      <span>{isPromoted || isAlreadyCrm ? 'In CRM' : 'Add to CRM'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : loading ? (
        <div className="text-center py-14 border border-dashed border-[#30363B] rounded-xl bg-[#111315]">
          <Loader2 className="text-[#C58A52] animate-spin mx-auto mb-3" size={28} />
          <p className="text-sm sm:text-base font-semibold text-[#F2F1ED]">
            Executing bounded multi-batch discovery...
          </p>
          <p className="text-xs text-[#A3A9AF] max-w-md mx-auto mt-1">
            Enriching candidates in memory batches of 50 with SSRF-protected website checks and zero premature database writes.
          </p>
        </div>
      ) : searchPerformed ? (
        <div className="text-center py-12 border border-dashed border-[#30363B] rounded-xl bg-[#111315]">
          <Search className="text-[#747C84] mx-auto mb-3" size={28} />
          <p className="text-sm sm:text-base font-semibold text-[#F2F1ED]">
            {activeTab === 'qualified' ? 'Zero Net-New Prospects Matched Active Criteria' : 'No Records in This Review Tab'}
          </p>
          <p className="text-xs text-[#A3A9AF] max-w-md mx-auto mt-1">
            Adjust category filters, inspect Existing CRM Matches / Needs Public Contact tabs, or try an adjacent municipality.
          </p>
        </div>
      ) : null}

      {/* Manual Email Draft Approval Modal */}
      {emailComposer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171A1D] border border-[#30363B] w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30363B]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C58A52]/15 text-[#C58A52] border border-[#C58A52]/30 rounded-xl">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F2F1ED]">Email Outreach Composer</h3>
                  <p className="text-xs text-[#A3A9AF]">Review & manually launch draft for {emailComposer.prospect.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailComposer(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#A3A9AF] hover:text-white hover:bg-[#202428] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF]">Recipient Email</label>
                  {!emailComposer.prospect.email && (
                    <button
                      type="button"
                      onClick={() => handleDeepScrape(emailComposer.prospect)}
                      disabled={scrapingId === emailComposer.prospect.id}
                      className="text-xs font-semibold text-[#C58A52] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Radar size={12} />
                      <span>Deep Scrape Contact</span>
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={emailComposer.prospect.email || ''}
                  placeholder="recipient@business.com"
                  onChange={(e) =>
                    setEmailComposer({
                      ...emailComposer,
                      prospect: { ...emailComposer.prospect, email: e.target.value }
                    })
                  }
                  className="w-full min-h-[44px] bg-[#111315] border border-[#30363B] rounded-xl px-3.5 py-2 text-base sm:text-sm font-mono text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">Subject</label>
                <input
                  type="text"
                  value={emailComposer.subject}
                  onChange={(e) => setEmailComposer({ ...emailComposer, subject: e.target.value })}
                  className="w-full min-h-[44px] bg-[#111315] border border-[#30363B] rounded-xl px-3.5 py-2 text-base sm:text-sm text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF]">Message Draft</label>
                  <button
                    type="button"
                    onClick={() => handleRegeneratePitch('Email', emailComposer.prospect)}
                    disabled={generatingDraftId === emailComposer.prospect.id}
                    className="text-xs font-semibold text-[#C58A52] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Regenerate Pitch</span>
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={emailComposer.body}
                  onChange={(e) => setEmailComposer({ ...emailComposer, body: e.target.value })}
                  className="w-full bg-[#111315] border border-[#30363B] rounded-xl p-3.5 text-sm text-[#F2F1ED] leading-relaxed focus:outline-none focus:border-[#C58A52]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#30363B]">
              <button
                type="button"
                onClick={() => handleCopyToClipboard(`Subject: ${emailComposer.subject}\n\n${emailComposer.body}`, 'email_copy')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] border border-[#30363B] text-xs font-semibold text-[#F2F1ED] flex items-center gap-2 cursor-pointer"
              >
                {copiedField === 'email_copy' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedField === 'email_copy' ? 'Copied' : 'Copy Draft'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailComposer(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] text-xs font-semibold text-[#A3A9AF] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={buildMailtoUrl(emailComposer.prospect.email || '', emailComposer.subject, emailComposer.body) || '#'}
                  onClick={handleLogEmailAndConfirm}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] text-xs font-bold flex items-center gap-2"
                >
                  <Send size={14} />
                  <span>Open Email Client</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual WhatsApp Draft Approval Modal */}
      {whatsAppComposer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171A1D] border border-[#30363B] w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30363B]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-xl">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F2F1ED]">WhatsApp Outreach Composer</h3>
                  <p className="text-xs text-[#A3A9AF]">Review & manually open chat for {whatsAppComposer.prospect.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppComposer(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#A3A9AF] hover:text-white hover:bg-[#202428] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">
                  Recipient Phone (E.164)
                </label>
                <input
                  type="text"
                  placeholder="+2348031234567 or +447911123456"
                  value={whatsAppComposer.phone}
                  onChange={(e) => setWhatsAppComposer({ ...whatsAppComposer, phone: e.target.value })}
                  className="w-full min-h-[44px] bg-[#111315] border border-[#30363B] rounded-xl px-3.5 py-2 text-base sm:text-sm font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
                />
                {!whatsAppComposer.prospect.whatsapp_link && whatsAppComposer.phone && (
                  <p className="text-[11px] text-amber-300/90 mt-1">
                    WhatsApp presence is unconfirmed from website HTML. Opening chat verifies availability.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF]">Message Draft</label>
                  <button
                    type="button"
                    onClick={() => handleRegeneratePitch('WhatsApp', whatsAppComposer.prospect)}
                    disabled={generatingDraftId === whatsAppComposer.prospect.id}
                    className="text-xs font-semibold text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={12} />
                    <span>Regenerate Pitch</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={whatsAppComposer.message}
                  onChange={(e) => setWhatsAppComposer({ ...whatsAppComposer, message: e.target.value })}
                  className="w-full bg-[#111315] border border-[#30363B] rounded-xl p-3.5 text-sm text-[#F2F1ED] leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-[#30363B]">
              <button
                type="button"
                onClick={() => handleCopyToClipboard(whatsAppComposer.message, 'whatsapp_copy')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] border border-[#30363B] text-xs font-semibold text-[#F2F1ED] flex items-center gap-2 cursor-pointer"
              >
                {copiedField === 'whatsapp_copy' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedField === 'whatsapp_copy' ? 'Copied' : 'Copy Draft'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWhatsAppComposer(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] text-xs font-semibold text-[#A3A9AF] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <a
                  href={buildWhatsAppUrl(whatsAppComposer.phone, whatsAppComposer.message) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleLogWhatsAppAndConfirm}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#111315] text-xs font-bold flex items-center gap-2"
                >
                  <ExternalLink size={14} />
                  <span>Open WhatsApp Chat</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explicit CRM Promotion Modal (Single or Selected Batch) */}
      {promoteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171A1D] border border-[#30363B] w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#30363B]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#C58A52]/15 text-[#C58A52] border border-[#C58A52]/30 rounded-xl">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F2F1ED]">
                    {promoteModal.prospects.length === 1
                      ? 'Confirm CRM Lead Promotion'
                      : `Promote ${promoteModal.prospects.length} Prospects to CRM`}
                  </h3>
                  <p className="text-xs text-[#A3A9AF]">Explicit administrator confirmation required before CRM creation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !batchPromoting && setPromoteModal(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#A3A9AF] hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">
                  Selected Target{promoteModal.prospects.length > 1 ? 's' : ''}
                </label>
                <div className="bg-[#111315] border border-[#30363B] rounded-xl px-3.5 py-2.5 text-xs text-[#F2F1ED]">
                  {promoteModal.prospects.length === 1
                    ? promoteModal.prospects[0].name
                    : `${promoteModal.prospects.length} selected: ${promoteModal.prospects
                        .slice(0, 3)
                        .map((p) => p.name)
                        .join(', ')}${promoteModal.prospects.length > 3 ? '…' : ''}`}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">Priority</label>
                  <select
                    value={promoteModal.priority}
                    onChange={(e) => setPromoteModal({ ...promoteModal, priority: e.target.value })}
                    className="w-full min-h-[44px] bg-[#111315] border border-[#30363B] rounded-xl px-3 py-2 text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">
                    Service Focus
                  </label>
                  <input
                    type="text"
                    value={promoteModal.requestedService}
                    onChange={(e) => setPromoteModal({ ...promoteModal, requestedService: e.target.value })}
                    className="w-full min-h-[44px] bg-[#111315] border border-[#30363B] rounded-xl px-3 py-2 text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#A3A9AF] mb-1 block">CRM Notes</label>
                <textarea
                  rows={3}
                  value={promoteModal.notes}
                  onChange={(e) => setPromoteModal({ ...promoteModal, notes: e.target.value })}
                  className="w-full bg-[#111315] border border-[#30363B] rounded-xl p-3 text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C58A52]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#30363B]">
              <button
                type="button"
                onClick={() => setPromoteModal(null)}
                disabled={batchPromoting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] text-xs font-semibold text-[#A3A9AF] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPromoteToCrm}
                disabled={batchPromoting}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {batchPromoting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                <span>Confirm & Promote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#171A1D] border border-[#30363B] w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-[#C58A52]/15 text-[#C58A52] border border-[#C58A52]/30 rounded-xl">
                <Compass size={18} />
              </div>
              <h3 className="text-base font-bold text-[#F2F1ED]">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-[#A3A9AF] leading-relaxed mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                disabled={confirmDialog.isSavingBatch}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#202428] text-xs font-semibold text-[#A3A9AF] hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                disabled={confirmDialog.isSavingBatch}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#C58A52] hover:bg-[#D99B62] text-[#111315] text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                {confirmDialog.isSavingBatch ? <Loader2 className="animate-spin" size={14} /> : null}
                <span>{confirmDialog.confirmText}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[250] bg-[#111315] border border-[#30363B] rounded-xl p-4 shadow-2xl flex items-start gap-3 max-w-sm">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              toast.type === 'success'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[#F2F1ED]">{toast.message}</h4>
            {toast.description && <p className="text-xs text-[#A3A9AF] mt-0.5 leading-relaxed">{toast.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[#747C84] hover:text-[#F2F1ED] p-1 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProspectLocator;
