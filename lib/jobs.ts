/**
 * Provider-Independent Multi-Source Job Search Engine Adapter Interface & Utilities
 * Genuine multi-source job aggregators (freehire, ever-jobs).
 * Zero fabricated listings, zero invented company names, zero mock data.
 */

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  remote_status: 'REMOTE' | 'HYBRID' | 'ONSITE';
  description: string;
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'UNKNOWN';
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  pay_period?: 'YEARLY' | 'MONTHLY' | 'HOURLY' | 'PROJECT' | null;
  posted_at: string;
  discovered_at: string;
  application_url: string;
  source_name: string;
  source_job_id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'UNCERTAIN' | 'UNVERIFIED';
  verification_evidence: string;
  match_score: number;
  match_reason: string;
  source_provenance: any;
}

export interface JobProviderResult {
  sourceName: string;
  success: boolean;
  jobsCount: number;
  latencyMs: number;
  error?: string;
  jobs: NormalizedJob[];
}

export interface JobSearchFilters {
  query?: string;
  keyword?: string;
  location?: string;
  country?: string;
  remotePreference?: string; // 'all' | 'remote' | 'hybrid' | 'onsite'
  remote?: string;
  jobType?: string;          // 'all' | 'full_time' | 'part_time' | 'contract' | 'intern'
  experienceLevel?: string;  // 'all' | 'entry' | 'mid' | 'senior'
  datePosted?: string;       // 'all' | '24h' | '7d' | '30d'
}

/**
 * Normalizes text for deduplication fingerprinting.
 */
export function normalizeKey(text: string): string {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Computes a stable deduplication fingerprint across cross-posted listings.
 * Preserves distinct titles, levels, and employers to prevent false merging.
 */
export function computeJobFingerprint(title: string, company: string, location: string): string {
  const t = normalizeKey(title);
  const c = normalizeKey(company);
  const l = normalizeKey(location);
  return `job-${c}-${t}-${l}`.slice(0, 150);
}

/**
 * Validates URLs against SSRF protection rules and ensures valid http/https scheme.
 * Defends against loopback, AWS/GCP cloud metadata, private subnets, and non-FQDN hostnames.
 */
export function isSafeJobUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const trimmed = urlStr.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (!host || host.length < 3 || !host.includes('.')) return false;

    // Loopback, localhost, wildcard
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.localhost')
    ) {
      return false;
    }

    // Cloud metadata services
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host === 'instance-data'
    ) {
      return false;
    }

    // Private IPv4 subnets (RFC 1918 & carrier-grade NAT)
    if (
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.startsWith('100.64.')
    ) {
      return false;
    }

    // 172.16.0.0 - 172.31.255.255
    if (host.startsWith('172.')) {
      const parts = host.split('.');
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (!isNaN(second) && second >= 16 && second <= 31) {
          return false;
        }
      }
    }

    // Private / local domains
    if (
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.endsWith('.lan') ||
      host.endsWith('.home') ||
      host.endsWith('.corp')
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Cleans an application URL for deduplication checking (stripping tracking query params).
 */
export function cleanJobApplicationUrl(urlStr: string): string {
  if (!urlStr) return '';
  try {
    const u = new URL(urlStr.trim());
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return urlStr.trim().toLowerCase();
  }
}

/**
 * Deduplicates raw jobs across providers using stable fingerprints and verified URLs,
 * while strictly avoiding false merges between distinct vacancies.
 */
export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const map = new Map<string, NormalizedJob>();
  const seenUrls = new Set<string>();

  for (const job of jobs) {
    // Validate records strictly; reject missing titles, employers, or invalid URLs
    if (!job.title || !job.company || !job.application_url || !isSafeJobUrl(job.application_url)) {
      continue;
    }

    const cleanUrl = cleanJobApplicationUrl(job.application_url);
    if (cleanUrl && seenUrls.has(cleanUrl)) {
      continue;
    }

    const fp = computeJobFingerprint(job.title, job.company, job.location);
    if (!map.has(fp)) {
      map.set(fp, job);
      if (cleanUrl) seenUrls.add(cleanUrl);
    } else {
      const existing = map.get(fp)!;
      // Prefer direct ATS listings over third-party aggregators
      if (job.source_name.toLowerCase().includes('ats') && !existing.source_name.toLowerCase().includes('ats')) {
        map.set(fp, job);
        if (cleanUrl) seenUrls.add(cleanUrl);
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Applies every supported search filter on the backend so none are silently ignored.
 * Supports country aliases (GB/UK -> United Kingdom, US/USA -> United States, etc.),
 * multi-term query matching, remote preferences, job types, and recency limits.
 */
export function applyJobFilters(jobs: NormalizedJob[], filters: JobSearchFilters): NormalizedJob[] {
  const q = (filters.query || filters.keyword || '').trim().toLowerCase();
  const locFilter = (filters.location || '').trim().toLowerCase();
  const countryFilter = (filters.country || 'all').trim().toLowerCase();
  const remotePref = (filters.remotePreference || filters.remote || 'all').toLowerCase();
  const jobType = (filters.jobType || 'all').toLowerCase();
  const expLevel = (filters.experienceLevel || 'all').toLowerCase();
  const datePosted = (filters.datePosted || 'all').toLowerCase();

  return jobs.filter((job) => {
    // 1. Keyword search (query) - requires all significant terms to match across title, company, or description
    if (q) {
      const titleLower = (job.title || '').toLowerCase();
      const descLower = (job.description || '').toLowerCase();
      const companyLower = (job.company || '').toLowerCase();
      const fullText = `${titleLower} ${companyLower} ${descLower}`;

      // Check if exact phrase matches anywhere
      if (!fullText.includes(q)) {
        const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'at', 'of', 'for', 'with', 'to', 'on', 'by', 'as', 'is', 'it', 'from']);
        const allWords: string[] = q.split(/[\s,+/|]+/).map((w: string) => w.trim()).filter(Boolean);
        const significantWords: string[] = allWords.filter((w: string) => !stopWords.has(w));
        const terms: string[] = significantWords.length > 0 ? significantWords : allWords;

        // Every required search term must match across title, company, or description
        const allMatch = terms.every((term: string) => 
          titleLower.includes(term) || companyLower.includes(term) || descLower.includes(term)
        );

        if (!allMatch) return false;
      }
    }

    // 2. Location filter (ignore if empty or 'all')
    if (locFilter && locFilter !== 'all') {
      const jobLoc = (job.location || '').toLowerCase();
      const jobCountry = (job.country || '').toLowerCase();
      const parts = locFilter.split(',').map(s => s.trim()).filter(Boolean);
      const matchesLoc = parts.some(part => jobLoc.includes(part) || jobCountry.includes(part));
      if (!matchesLoc) {
        return false;
      }
    }

    // 3. Country filter (with geographic alias expansion)
    if (countryFilter && countryFilter !== 'all') {
      const jobCountry = (job.country || '').toLowerCase();
      const jobLoc = (job.location || '').toLowerCase();

      const countryAliases: Record<string, string[]> = {
        gb: ['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales', 'london', 'gb'],
        uk: ['united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales', 'london', 'gb'],
        us: ['united states', 'usa', 'u.s.', 'america', 'us'],
        usa: ['united states', 'usa', 'u.s.', 'america', 'us'],
        de: ['germany', 'deutschland', 'berlin', 'munich', 'frankfurt', 'de'],
        ca: ['canada', 'toronto', 'vancouver', 'ca'],
        au: ['australia', 'sydney', 'melbourne', 'au'],
        fr: ['france', 'paris', 'fr'],
        nl: ['netherlands', 'amsterdam', 'nl']
      };

      const aliases = countryAliases[countryFilter] || [countryFilter];
      const matchesCountry = aliases.some(alias =>
        jobCountry.includes(alias) || jobLoc.includes(alias)
      );

      if (!matchesCountry) {
        return false;
      }
    }

    // 4. Remote preference filter
    if (remotePref !== 'all') {
      const rawRemote = ((job.remote_status || (job as any).remote || '') as string).toLowerCase().replace(/[^a-z]/g, '');
      const locLower = (job.location || '').toLowerCase();
      const titleLower = (job.title || '').toLowerCase();

      const isRemoteJob = rawRemote.includes('remote') || locLower.includes('remote') || locLower.includes('worldwide') || locLower.includes('anywhere') || titleLower.includes('remote');
      const isHybridJob = rawRemote.includes('hybrid') || locLower.includes('hybrid');
      const isOnsiteJob = (rawRemote.includes('onsite') || !isRemoteJob) && !isHybridJob;

      if (remotePref === 'remote' && !isRemoteJob) return false;
      if (remotePref === 'hybrid' && !isHybridJob) return false;
      if ((remotePref === 'onsite' || remotePref === 'on-site') && !isOnsiteJob) return false;
    }

    // 5. Job type filter
    if (jobType !== 'all') {
      const rawType = ((job.employment_type || (job as any).jobType || '') as string).toLowerCase().replace(/[^a-z]/g, '');
      if ((jobType === 'full_time' || jobType === 'full-time') && !rawType.includes('full')) return false;
      if ((jobType === 'part_time' || jobType === 'part-time') && !rawType.includes('part')) return false;
      if (jobType === 'contract' && !rawType.includes('contract') && !rawType.includes('freelance')) return false;
      if ((jobType === 'intern' || jobType === 'internship') && !rawType.includes('intern')) return false;
    }

    // 6. Experience level filter
    if (expLevel !== 'all') {
      const title = (job.title || '').toLowerCase();
      const desc = (job.description || '').toLowerCase();
      const explicitLevel = (((job as any).experienceLevel || '') as string).toLowerCase();

      const titleEntry = /\b(junior|entry|graduate|intern|associate)\b/i.test(title);
      const titleSenior = /\b(senior|sr\.?|lead|principal|staff|director|head|vp)\b/i.test(title);

      const descEntry = /\b(entry[\s-]level|junior\s+(developer|engineer|designer)|recent\s+graduate)\b/i.test(desc);
      const descSenior = /\b(5\+\s*years|8\+\s*years|senior\s+(developer|engineer)|staff\s+(developer|engineer))\b/i.test(desc);

      const isEntry = explicitLevel === 'entry' || titleEntry || descEntry;
      const isSenior = explicitLevel === 'senior' || explicitLevel === 'lead' || explicitLevel === 'executive' || titleSenior || descSenior;

      if (expLevel === 'entry') {
        if (!isEntry || titleSenior) return false;
      } else if (expLevel === 'senior') {
        if (!isSenior || titleEntry) return false;
      } else if (expLevel === 'mid') {
        if (titleEntry || titleSenior) return false;
      }
    }

    // 7. Date posted filter (honest handling: undated listings do not match specific time windows)
    if (datePosted !== 'all') {
      try {
        const postedDateStr = job.posted_at || (job as any).datePosted;
        if (!postedDateStr) {
          return false;
        }
        const postedMs = new Date(postedDateStr).getTime();
        if (!isNaN(postedMs)) {
          const now = Date.now();
          const diffMs = now - postedMs;
          if ((datePosted === '24h' || datePosted === '1d') && diffMs > 24 * 60 * 60 * 1000) return false;
          if (datePosted === '7d' && diffMs > 7 * 24 * 60 * 60 * 1000) return false;
          if (datePosted === '30d' && diffMs > 30 * 24 * 60 * 60 * 1000) return false;
        } else {
          return false;
        }
      } catch {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculates match score and explanation based on filters and relevance.
 */
export function calculateMatchScore(
  job: { title: string; description: string; company?: string; location: string; remote_status: string; posted_at: string },
  filters: JobSearchFilters
): { score: number; reason: string } {
  let score = 70;
  const reasons: string[] = [];

  const q = (filters.query || filters.keyword || '').toLowerCase().trim();
  const titleLower = (job.title || '').toLowerCase();
  const descLower = (job.description || '').toLowerCase();
  const companyLower = (job.company || '').toLowerCase();

  if (q) {
    if (titleLower.includes(q)) {
      score += 25;
      reasons.push(`Exact title match for "${filters.query || filters.keyword}"`);
    } else {
      const stopWords = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'at', 'of', 'for', 'with', 'to', 'on', 'by', 'as', 'is', 'it', 'from']);
      const allWords = q.split(/[\s,+/|]+/).map(w => w.trim()).filter(Boolean);
      const keywords = allWords.filter(w => !stopWords.has(w));
      const wordsToCheck = keywords.length > 0 ? keywords : allWords;

      let matchedInTitle = 0;
      let matchedInDesc = 0;
      let matchedInCompany = 0;

      for (const kw of wordsToCheck) {
        if (titleLower.includes(kw)) {
          matchedInTitle++;
        } else if (companyLower.includes(kw)) {
          matchedInCompany++;
        } else if (descLower.includes(kw)) {
          matchedInDesc++;
        }
      }

      if (matchedInTitle === wordsToCheck.length && wordsToCheck.length > 0) {
        score += 20;
        reasons.push(`All keywords match in job title`);
      } else if (matchedInTitle > 0) {
        score += 10 + (matchedInTitle * 3);
        reasons.push(`Key terms match in job title`);
      } else if (matchedInDesc > 0 || matchedInCompany > 0) {
        score += 5 + Math.min(10, (matchedInDesc + matchedInCompany) * 2);
        reasons.push(`Keyword match in role details`);
      } else {
        score -= 10;
      }
    }
  } else {
    reasons.push('Curated active opportunity');
  }

  // Location / Remote matching
  const remotePref = filters.remotePreference || filters.remote;
  if (remotePref && remotePref !== 'all') {
    if (remotePref === 'remote' && job.remote_status === 'REMOTE') {
      score += 10;
      reasons.push('Verified remote position');
    } else if (remotePref === 'onsite' && job.remote_status === 'ONSITE') {
      score += 10;
      reasons.push('Verified on-site position');
    } else if (remotePref === 'hybrid' && job.remote_status === 'HYBRID') {
      score += 10;
      reasons.push('Verified hybrid position');
    }
  }

  // Recency
  try {
    if (job.posted_at) {
      const postDate = new Date(job.posted_at).getTime();
      const daysDiff = (Date.now() - postDate) / (1000 * 60 * 60 * 24);
      if (!isNaN(daysDiff) && daysDiff <= 7) {
        score += 8;
        reasons.push('Recent publication');
      }
    }
  } catch (e) {}

  score = Math.max(40, Math.min(99, score));
  return { score, reason: reasons.join(' • ') || 'Verified opportunity' };
}
